"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Search,
  Filter,
  Send,
  RefreshCw,
  Lock,
  BookOpen,
  User,
  Paperclip,
  Sliders,
  ZapOff,
  FileText,
  Phone,
  MapPin,
  Calendar,
  Hash,
  Store,
  Printer,
  Copy,
  Check,
} from "lucide-react";
import NavbarAccountSwitcher from "@/components/NavbarAccountSwitcher";
import {
  getStoredToken,
  getStoredUser,
  fetchCurrentUser,
  fetchAdminTickets,
  fetchAdminTicketDetail,
  updateAdminTicket,
  sendAdminReply,
  addAdminInternalNote,
  regenerateAdminTicketAI,
  fetchAdminsList,
  formatINR,
  formatDateTime,
  formatRelativeTime,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/lib/api";

function getPriorityStyle(priority) {
  const p = (priority || "").toLowerCase();
  if (p === "critical") {
    return "bg-rose-100 text-rose-900 border-rose-300";
  }
  if (p === "high") {
    return "bg-orange-100 text-orange-900 border-orange-300";
  }
  if (p === "medium") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getStatusStyle(status) {
  const s = (status || "").toLowerCase();
  if (s === "open") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (s === "in progress") {
    return "bg-blue-50 text-blue-800 border-blue-200";
  }
  if (s === "resolved") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function AdminPortalPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [adminsList, setAdminsList] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    critical_high_open: 0,
    avg_tokens_per_ticket: 410,
    naive_full_context_tokens: 1850,
    estimated_token_savings_pct: 78,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("urgent");

  // Active Ticket & Workspace State
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyStatusTarget, setReplyStatusTarget] = useState("Resolved");
  const [sendingReply, setSendingReply] = useState(false);
  const [regeneratingAI, setRegeneratingAI] = useState(false);
  const [internalNoteText, setInternalNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [overriddenTickets, setOverriddenTickets] = useState({});
  const [toastMsg, setToastMsg] = useState("");
  const [copiedDraft, setCopiedDraft] = useState(false);

  function showToast(msg) {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? "" : prev));
    }, 3500);
  }

  const loadQueue = useCallback(
    async (isBackground = false) => {
      try {
        if (!isBackground) setLoading(true);
        const res = await fetchAdminTickets({
          status: statusFilter,
          category: categoryFilter,
          priority: priorityFilter,
          search: searchQuery,
          sort_by: sortBy,
        });

        const list = res.tickets || [];
        setTickets(list);
        if (res.summary) setSummary(res.summary);

        if (list.length > 0) {
          setSelectedTicketId((prevId) => {
            const found = list.find((t) => t.id === prevId);
            return found ? prevId : list[0].id;
          });
        } else {
          setSelectedTicketId(null);
          setActiveTicket(null);
        }
      } catch {
        // Ignore background poll error
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [statusFilter, categoryFilter, priorityFilter, searchQuery, sortBy]
  );

  // Auth Check
  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (storedUser?.role === "author") {
      router.replace("/author");
      return;
    }
    setAdminUser(storedUser);

    fetchCurrentUser()
      .then((fresh) => {
        if (fresh.role !== "admin") {
          router.replace("/author");
          return;
        }
        setAdminUser(fresh);
        fetchAdminsList()
          .then((list) => setAdminsList(list || []))
          .catch(() => {});
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  // Load tickets whenever filters change
  useEffect(() => {
    if (adminUser) {
      loadQueue(false);
    }
  }, [adminUser, loadQueue]);

  // Load active ticket detail when selectedTicketId changes
  useEffect(() => {
    if (!selectedTicketId) {
      setActiveTicket(null);
      setReplyDraft("");
      return;
    }
    fetchAdminTicketDetail(selectedTicketId)
      .then((detail) => {
        setActiveTicket(detail);
        setReplyDraft(detail.ai_draft_response || "");
      })
      .catch(() => {});
  }, [selectedTicketId]);

  // Background poll every 4 seconds for new author tickets/replies
  useEffect(() => {
    if (!adminUser) return;
    const interval = setInterval(() => {
      loadQueue(true);
      if (selectedTicketId) {
        fetchAdminTicketDetail(selectedTicketId)
          .then((detail) => setActiveTicket(detail))
          .catch(() => {});
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [adminUser, selectedTicketId, loadQueue]);

  async function handleOverrideField(field, value) {
    if (!activeTicket) return;
    try {
      const updated = await updateAdminTicket(activeTicket.id, {
        [field]: value,
      });
      setActiveTicket(updated);
      setOverriddenTickets((prev) => ({ ...prev, [activeTicket.id]: true }));
      showToast(`Updated ticket ${field.replace("_", " ")}`);
      loadQueue(true);
    } catch (err) {
      alert(err.message || "Failed to update ticket");
    }
  }

  async function handleSendAdminResponse(e) {
    e.preventDefault();
    if (!activeTicket || replyDraft.trim().length < 2) return;
    setSendingReply(true);
    try {
      const updated = await sendAdminReply(
        activeTicket.id,
        replyDraft.trim(),
        replyStatusTarget
      );
      setActiveTicket(updated);
      showToast(
        `Reply sent to ${activeTicket.author?.name || "Author"} & marked ${replyStatusTarget}`
      );
      loadQueue(true);
    } catch (err) {
      alert(err.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleRegenerateAI(forceFallback = false) {
    if (!activeTicket) return;
    setRegeneratingAI(true);
    try {
      const updated = await regenerateAdminTicketAI(
        activeTicket.id,
        forceFallback
      );
      setActiveTicket(updated);
      setReplyDraft(updated.ai_draft_response || "");
      setOverriddenTickets((prev) => ({ ...prev, [activeTicket.id]: false }));
      showToast(
        forceFallback
          ? "Simulated AI Outage: Generated via Deterministic Fallback Engine"
          : "AI Triage & Draft regenerated"
      );
      loadQueue(true);
    } catch (err) {
      alert(err.message || "Failed to regenerate AI response");
    } finally {
      setRegeneratingAI(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!activeTicket || internalNoteText.trim().length < 2) return;
    setAddingNote(true);
    try {
      const updated = await addAdminInternalNote(
        activeTicket.id,
        internalNoteText.trim()
      );
      setActiveTicket(updated);
      setInternalNoteText("");
      showToast("Internal Ops Note saved (Hidden from Author)");
    } catch (err) {
      alert(err.message || "Failed to add internal note");
    } finally {
      setAddingNote(false);
    }
  }

  function handleCopyDraft() {
    if (!replyDraft) return;
    navigator.clipboard?.writeText(replyDraft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  const activeBook = activeTicket?.book;
  const activeAuthor = activeTicket?.author;
  const activeTokens = activeTicket?.ai_tokens_used || 412;
  const baselineTokens = summary.naive_full_context_tokens || 1850;
  const activeSavingsPct = Math.max(
    0,
    Math.round(((baselineTokens - activeTokens) / baselineTokens) * 100)
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">
                  BookLeaf Admin Operations Console
                </span>
                <span className="hidden sm:inline-flex items-center rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  AI Triage Studio
                </span>
              </div>
              {adminUser && (
                <p className="text-xs text-slate-400 truncate">
                  Signed in as{" "}
                  <span className="text-slate-200 font-medium">
                    {adminUser.name}
                  </span>{" "}
                  ({adminUser.email})
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {toastMsg && (
              <div className="hidden lg:flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 text-xs font-medium text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>{toastMsg}</span>
              </div>
            )}

            <NavbarAccountSwitcher
              currentUser={adminUser}
              onUserSwitched={(newUser) => setAdminUser(newUser)}
            />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-5 flex-1 space-y-4">
        {/* Operations Metrics & AI Cost Bar */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Open & In-Progress Queue
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {summary.open + summary.in_progress}{" "}
                <span className="text-xs font-normal text-slate-500">
                  of {summary.total} total
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {summary.open} Open • {summary.in_progress} In Progress
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                Critical & High Priority
              </p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {summary.critical_high_open}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Requires 48-hour SLA attention
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resolved Tickets
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {summary.resolved}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Synced with Author Portal in real time
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-emerald-200/90 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                AI Token Optimization
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                ~{summary.avg_tokens_per_ticket}{" "}
                <span className="text-xs font-semibold text-emerald-700">
                  tokens/tkt (~{summary.estimated_token_savings_pct}% saved)
                </span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Top-2 KB selector vs {summary.naive_full_context_tokens} naive
                baseline
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Cpu className="h-5 w-5" />
            </div>
          </div>
        </section>

        {/* Filter & Triage Bar */}
        <section className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Filter className="h-3.5 w-3.5 text-emerald-600" />
            <span>Filter Queue:</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Ticket ID (TKT-1001), subject, author, or book..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="All">Status: All</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                Status: {s}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="All">Category: All (6 Categories)</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="All">Priority: All</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                Priority: {p}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-600 focus:outline-none"
          >
            <option value="urgent">
              Sort: Urgent & Oldest Unresolved First
            </option>
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
          </select>

          {(statusFilter !== "All" ||
            categoryFilter !== "All" ||
            priorityFilter !== "All" ||
            searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("All");
                setCategoryFilter("All");
                setPriorityFilter("All");
                setSearchQuery("");
              }}
              className="text-xs font-semibold text-rose-600 hover:underline px-2"
            >
              Reset
            </button>
          )}
        </section>

        {/* Master-Detail 3-Column Workspace */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* COLUMN 1: Left Ticket Queue (3 cols) */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Support Queue ({tickets.length})
              </span>
              <button
                type="button"
                onClick={() => loadQueue(false)}
                className="text-xs text-slate-500 hover:text-emerald-700 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading support queue...
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No tickets match the selected filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[760px] overflow-y-auto">
                {tickets.map((t) => {
                  const isSelected = t.id === selectedTicketId;
                  const isCritical = t.priority === "Critical";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`w-full text-left p-3.5 transition block ${
                        isSelected
                          ? "bg-emerald-50/80 border-l-4 border-l-emerald-600"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {isCritical && (
                            <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                          )}
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {t.ticket_code}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${getPriorityStyle(
                              t.priority
                            )}`}
                          >
                            {t.priority || "Medium"}
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusStyle(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-900 line-clamp-2">
                        {t.subject}
                      </p>

                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-medium truncate">
                          {t.author?.name || "Author"}
                        </span>
                        <span className="text-slate-400">
                          {formatRelativeTime(t.updated_at)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {t.category && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 truncate max-w-[160px]">
                            {t.category}
                          </span>
                        )}
                        {t.book && (
                          <span className="rounded bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 text-[10px] font-mono text-amber-900">
                            {t.book.book_code}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUMN 2: Center Conversation & AI Response Studio (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            {!activeTicket ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-400">
                Select a ticket from the queue to inspect conversation and AI
                triage studio.
              </div>
            ) : (
              <>
                {/* Ticket Conversation Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-900 text-white px-2.5 py-0.5 text-xs font-mono font-bold">
                          {activeTicket.ticket_code}
                        </span>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-xs font-bold ${getPriorityStyle(
                            activeTicket.priority
                          )}`}
                        >
                          {activeTicket.priority} Priority
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusStyle(
                            activeTicket.status
                          )}`}
                        >
                          {activeTicket.status}
                        </span>
                        <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {activeTicket.category}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        Opened {formatDateTime(activeTicket.created_at)}
                      </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      {activeTicket.subject}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span>
                        Author:{" "}
                        <strong className="text-slate-900">
                          {activeAuthor?.name}
                        </strong>{" "}
                        ({activeAuthor?.author_code})
                      </span>
                      <span>•</span>
                      <span>
                        Book:{" "}
                        <strong className="text-slate-900">
                          {activeBook
                            ? `${activeBook.title} (${activeBook.book_code})`
                            : "General / Account Level"}
                        </strong>
                      </span>
                      {activeTicket.attachment_name && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                          <Paperclip className="h-3 w-3 text-amber-600" />
                          {activeTicket.attachment_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thread Messages */}
                  <div className="p-4 sm:p-5 space-y-3.5 max-h-[300px] overflow-y-auto bg-slate-50/40">
                    {(activeTicket.messages || []).map((msg) => {
                      const isAdmin = msg.sender_role === "admin";
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isAdmin ? "items-end" : "items-start"
                          }`}
                        >
                          <div
                            className={`max-w-[90%] rounded-2xl p-3.5 border shadow-sm ${
                              isAdmin
                                ? "bg-emerald-50/90 border-emerald-200 text-slate-900"
                                : "bg-white border-slate-200 text-slate-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-xs font-bold">
                                {isAdmin
                                  ? `${msg.sender_name} (Admin Support)`
                                  : `${msg.sender_name} (Author)`}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDateTime(msg.created_at)}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm whitespace-pre-line leading-relaxed text-slate-800">
                              {msg.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI-Drafted Response Studio */}
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-slate-900 to-emerald-950 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-bold">
                        AI Context-Aware Response Studio
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          activeTicket.ai_provider_status === "success"
                            ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                            : "bg-amber-500/20 border-amber-400/40 text-amber-300"
                        }`}
                      >
                        {activeTicket.ai_provider_status === "success"
                          ? "AI Live Model"
                          : "Context-Aware Fallback Engine"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-emerald-200">
                        {activeTokens} tokens | ~{activeSavingsPct}% saved
                      </span>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* AI Triage Reasoning Box */}
                    {activeTicket.ai_reasoning && (
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3 text-xs text-slate-800">
                        <span className="font-bold text-emerald-950 block mb-0.5">
                          AI Triage & Classification Reasoning:
                        </span>
                        <span>{activeTicket.ai_reasoning}</span>
                      </div>
                    )}

                    {/* Action Toolbar for Regenerate & Simulate Outage */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={regeneratingAI}
                          onClick={() => handleRegenerateAI(false)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 text-emerald-600 ${
                              regeneratingAI ? "animate-spin" : ""
                            }`}
                          />
                          <span>Regenerate AI Draft</span>
                        </button>

                        <button
                          type="button"
                          disabled={regeneratingAI}
                          onClick={() => handleRegenerateAI(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition"
                          title="Simulates LLM timeout/outage to verify Requirement D.3 Graceful Degradation"
                        >
                          <ZapOff className="h-3.5 w-3.5 text-amber-700" />
                          <span>Test Graceful Fallback (Simulate AI Outage)</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setReplyDraft(activeTicket.ai_draft_response || "")
                          }
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Reset to AI Draft
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyDraft}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          {copiedDraft ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Editable Response Textarea */}
                    <form onSubmit={handleSendAdminResponse} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Edit AI Draft or Write Custom Response to Author:
                        </label>
                        <textarea
                          rows={9}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Write response to author..."
                          className="w-full rounded-xl border border-slate-300 bg-slate-50/60 p-3.5 text-xs sm:text-sm text-slate-900 font-sans leading-relaxed focus:bg-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Upon Send, Set Status:
                          </label>
                          <select
                            value={replyStatusTarget}
                            onChange={(e) =>
                              setReplyStatusTarget(e.target.value)
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none"
                          >
                            <option value="Resolved">
                              Send Reply & Mark Resolved
                            </option>
                            <option value="In Progress">
                              Send Reply & Mark In Progress
                            </option>
                            <option value="Open">Keep Open</option>
                            <option value="Closed">Mark Closed</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={
                            sendingReply || replyDraft.trim().length < 2
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 text-xs shadow-sm transition"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>
                            {sendingReply
                              ? "Sending to Author..."
                              : `Send Response (${replyStatusTarget})`}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Internal Ops Notes (Strictly Admin-Only) */}
                <div className="bg-amber-50/70 rounded-2xl border border-amber-200/90 p-4 sm:p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-700" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                        Internal Ops Notes — Never Visible to Author
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded-md px-2 py-0.5">
                      {(activeTicket.internal_notes || []).length} note(s)
                    </span>
                  </div>

                  {(activeTicket.internal_notes || []).length > 0 && (
                    <div className="space-y-2">
                      {activeTicket.internal_notes.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl bg-white border border-amber-200 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="font-bold text-amber-900">
                              {n.admin_name}
                            </span>
                            <span>{formatDateTime(n.created_at)}</span>
                          </div>
                          <p className="text-slate-800">{n.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddNote} className="flex gap-2">
                    <input
                      type="text"
                      value={internalNoteText}
                      onChange={(e) => setInternalNoteText(e.target.value)}
                      placeholder="Add private internal note for Finance / Production / Ops team..."
                      className="flex-1 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-amber-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={
                        addingNote || internalNoteText.trim().length < 2
                      }
                      className="rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold px-4 py-2 text-xs transition shrink-0"
                    >
                      {addingNote ? "Saving..." : "Add Internal Note"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* COLUMN 3: Right Context & Override Sidebar (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            {activeTicket && (
              <>
                {/* Ticket Triage & Override Controls */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Triage & Overrides
                      </h3>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        overriddenTickets[activeTicket.id]
                          ? "bg-purple-100 text-purple-800"
                          : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {overriddenTickets[activeTicket.id]
                        ? "Admin Overridden"
                        : "AI Classified"}
                    </span>
                  </div>

                  {/* Status Override */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Ticket Status
                    </label>
                    <select
                      value={activeTicket.status || "Open"}
                      onChange={(e) =>
                        handleOverrideField("status", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    >
                      {TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority Override */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Priority Level (Override AI)
                    </label>
                    <select
                      value={activeTicket.priority || "Medium"}
                      onChange={(e) =>
                        handleOverrideField("priority", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    >
                      {TICKET_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Override */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Category (Override AI)
                    </label>
                    <select
                      value={activeTicket.category || "General Inquiry"}
                      onChange={(e) =>
                        handleOverrideField("category", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    >
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Assigned Admin */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Assigned Support Owner
                    </label>
                    <select
                      value={activeTicket.assigned_to_id || ""}
                      onChange={(e) =>
                        handleOverrideField(
                          "assigned_to_id",
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      {adminsList.map((adm) => (
                        <option key={adm.id} value={adm.id}>
                          {adm.name} ({adm.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Author Profile Context Card */}
                {activeAuthor && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-emerald-600" />
                        Author DB Record
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {activeAuthor.author_code}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5">
                      <p className="font-bold text-slate-900 text-sm">
                        {activeAuthor.name}
                      </p>
                      <p className="text-slate-600">{activeAuthor.email}</p>
                      <div className="flex flex-wrap items-center gap-3 text-slate-500 pt-1">
                        {activeAuthor.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {activeAuthor.phone}
                          </span>
                        )}
                        {activeAuthor.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {activeAuthor.city}
                          </span>
                        )}
                        {activeAuthor.joined_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Joined{" "}
                            {activeAuthor.joined_date}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Live Book Database Context Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                      Linked Book DB Snapshot
                    </span>
                    {activeBook && (
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        {activeBook.book_code}
                      </span>
                    )}
                  </div>

                  {!activeBook ? (
                    <p className="text-xs text-slate-500 italic">
                      General / Account-Level Ticket (No single book selected).
                    </p>
                  ) : (
                    <div className="space-y-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">
                          {activeBook.title}
                        </p>
                        <span className="inline-block mt-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          {activeBook.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 border border-slate-200/70 p-2.5">
                        <div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Hash className="h-2.5 w-2.5" /> ISBN
                          </span>
                          <span className="font-mono font-semibold text-slate-800 block mt-0.5">
                            {activeBook.isbn || "Pending"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" /> Pub Date
                          </span>
                          <span className="font-semibold text-slate-800 block mt-0.5">
                            {activeBook.publication_date ||
                              "In Production (TBD)"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">
                            MRP / Royalty Rate
                          </span>
                          <span className="font-semibold text-slate-800 block mt-0.5">
                            {activeBook.mrp !== null
                              ? `${formatINR(activeBook.mrp)} (${formatINR(
                                  activeBook.author_royalty_per_copy
                                )}/copy)`
                              : "In Production (TBD)"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Printer className="h-2.5 w-2.5" /> Print Partner
                          </span>
                          <span className="font-semibold text-slate-800 block mt-0.5">
                            {activeBook.print_partner || "Unassigned"}
                          </span>
                        </div>
                      </div>

                      {/* Financial Ledger Figures */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-slate-200 p-2">
                          <span className="text-[10px] text-slate-500 block">
                            Copies Sold
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {activeBook.total_copies_sold}
                          </span>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-2">
                          <span className="text-[10px] text-slate-500 block">
                            Total Earned
                          </span>
                          <span className="font-bold text-emerald-700 text-sm">
                            {formatINR(activeBook.total_royalty_earned)}
                          </span>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-2">
                          <span className="text-[10px] text-slate-500 block">
                            Royalty Paid
                          </span>
                          <span className="font-bold text-slate-800 text-sm">
                            {formatINR(activeBook.royalty_paid)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                          <span className="text-[10px] text-amber-900 block">
                            Royalty Pending
                          </span>
                          <span className="font-bold text-amber-800 text-sm">
                            {formatINR(activeBook.royalty_pending)}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1">
                        <span>Last Payout Date:</span>
                        <span className="font-semibold text-slate-900">
                          {activeBook.last_royalty_payout_date || "None"}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1 mb-1">
                          <Store className="h-3 w-3" /> Distribution Channels
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {activeBook.available_on &&
                          activeBook.available_on.length > 0 ? (
                            activeBook.available_on.map((ch) => (
                              <span
                                key={ch}
                                className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                              >
                                {ch}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] italic text-amber-700">
                              Distribution setup pending publication
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

