"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Send,
  RefreshCw,
  Paperclip,
  ZapOff,
  SlidersHorizontal,
  ArrowLeft,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import BookLeafLogo from "@/components/BookLeafLogo";
import NavbarAccountSwitcher from "@/components/NavbarAccountSwitcher";
import CustomSelect from "@/components/CustomSelect";
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

function getPriorityBadgeStyle(priority) {
  const p = (priority || "").toLowerCase();
  if (p === "critical") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (p === "high") {
    return "bg-[#FFF5F6] text-[#EC6568] border-[#F5D8DA]";
  }
  if (p === "medium") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-neutral-100 text-neutral-600 border-neutral-200";
}

function getStatusBadgeStyle(status) {
  const s = (status || "").toLowerCase();
  if (s === "open") {
    return "bg-[#FFF5F6] text-[#EC6568] border-[#F5D8DA]";
  }
  if (s === "in progress") {
    return "bg-sky-50 text-[#3898A6] border-sky-200";
  }
  if (s === "resolved") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-neutral-100 text-neutral-600 border-neutral-200";
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
  const [toastMsg, setToastMsg] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [mobileAdminPane, setMobileAdminPane] = useState("queue"); // "queue" | "chat" | "details"

  const lastSeenSyncRef = useRef({
    ticketId: null,
    aiDraft: "",
    msgCount: 0,
  });

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
      lastSeenSyncRef.current = { ticketId: null, aiDraft: "", msgCount: 0 };
      return;
    }
    fetchAdminTicketDetail(selectedTicketId)
      .then((detail) => {
        setActiveTicket(detail);
        const draft = detail.ai_draft_response || "";
        const msgCount = (detail.messages || []).length;
        setReplyDraft(draft);
        lastSeenSyncRef.current = {
          ticketId: detail.id,
          aiDraft: draft,
          msgCount,
        };
      })
      .catch(() => {});
  }, [selectedTicketId]);

  // Background poll every 3 seconds for new author replies & fresh AI drafts
  useEffect(() => {
    if (!adminUser) return;
    const interval = setInterval(() => {
      loadQueue(true);
      if (selectedTicketId) {
        fetchAdminTicketDetail(selectedTicketId)
          .then((detail) => {
            setActiveTicket(detail);
            const newDraft = detail.ai_draft_response || "";
            const msgs = detail.messages || [];
            const newMsgCount = msgs.length;
            const prev = lastSeenSyncRef.current;

            if (prev.ticketId === detail.id) {
              const draftChanged = newDraft && newDraft !== prev.aiDraft;
              const authorSentNewReply =
                newMsgCount > prev.msgCount &&
                msgs[msgs.length - 1]?.sender_role === "author";

              if (draftChanged || authorSentNewReply) {
                setReplyDraft(newDraft);
                lastSeenSyncRef.current = {
                  ticketId: detail.id,
                  aiDraft: newDraft,
                  msgCount: newMsgCount,
                };
                if (authorSentNewReply) {
                  showToast("New author reply received — AI draft updated!");
                }
              } else if (newMsgCount !== prev.msgCount) {
                lastSeenSyncRef.current = {
                  ...prev,
                  msgCount: newMsgCount,
                };
              }
            }
          })
          .catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [adminUser, selectedTicketId, loadQueue]);

  async function handleOverrideField(field, value) {
    if (!activeTicket) return;
    try {
      const updated = await updateAdminTicket(activeTicket.id, {
        [field]: value,
      });
      setActiveTicket(updated);
      showToast(`Updated ${field.replace("_", " ")}`);
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
      setReplyDraft("");
      lastSeenSyncRef.current = {
        ticketId: updated.id,
        aiDraft: updated.ai_draft_response || "",
        msgCount: (updated.messages || []).length,
      };
      showToast(`Reply sent to ${activeTicket.author?.name || "Author"}`);
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
      const freshDraft = updated.ai_draft_response || "";
      setReplyDraft(freshDraft);
      lastSeenSyncRef.current = {
        ticketId: updated.id,
        aiDraft: freshDraft,
        msgCount: (updated.messages || []).length,
      };
      showToast(
        forceFallback
          ? "Fallback draft generated"
          : "AI Draft regenerated"
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
      showToast("Internal note saved");
    } catch (err) {
      alert(err.message || "Failed to add internal note");
    } finally {
      setAddingNote(false);
    }
  }

  const activeBook = activeTicket?.book;
  const activeAuthor = activeTicket?.author;

  return (
    <div className="min-h-screen bg-[#FFFDFD] flex flex-col text-[#222222] overflow-x-hidden">
      {/* Official Clean White Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-100">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 h-16 sm:h-24 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <BookLeafLogo href="/" />
            <div className="hidden md:flex items-center gap-3 pl-5 border-l border-neutral-200 truncate">
              <span className="rounded-full bg-[#FFF5F6] border border-[#F5D8DA] px-3.5 py-1 text-xs font-medium text-[#EC6568] shrink-0">
                Support Desk
              </span>
              {adminUser && (
                <span className="text-xs text-neutral-500 truncate">
                  {adminUser.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {toastMsg && (
              <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#FFF5F6] border border-[#F5D8DA] px-4 py-1.5 text-xs font-medium text-[#EC6568]">
                <CheckCircle2 className="h-3.5 w-3.5" />
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

      {/* Main Content */}
      <main className="max-w-[1520px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-5">
        {/* Clean 4 Minimal Stat Cards (2x2 on mobile, 4-col on lg) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 animate-fade-up">
          <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-3.5 sm:p-4 flex items-center gap-3 sm:gap-3.5 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-neutral-500 truncate">
                Open Queries
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#222222]">
                {summary.open + summary.in_progress}
              </p>
            </div>
          </div>

          <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-3.5 sm:p-4 flex items-center gap-3 sm:gap-3.5 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-neutral-500 truncate">
                High Priority
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#EC6568]">
                {summary.critical_high_open}
              </p>
            </div>
          </div>

          <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-3.5 sm:p-4 flex items-center gap-3 sm:gap-3.5 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-neutral-500 truncate">
                Resolved
              </p>
              <p className="text-xl sm:text-2xl font-bold text-[#222222]">
                {summary.resolved}
              </p>
            </div>
          </div>

          <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-3.5 sm:p-4 flex items-center gap-3 sm:gap-3.5 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
            <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-neutral-500 truncate">
                AI Draft Efficiency
              </p>
              <p className="text-sm sm:text-lg font-bold text-[#222222] truncate">
                ~{summary.avg_tokens_per_ticket} tok{" "}
                <span className="text-[11px] sm:text-xs font-medium text-[#3898A6]">
                  (~{summary.estimated_token_savings_pct}% saved)
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Clean Filter Row (Collapsible on Mobile <md, Inline on md+) */}
        <section className="bg-[#FFF5F6]/70 rounded-2xl border border-[#F5D8DA] p-3 sm:p-3.5 space-y-3 md:space-y-0 md:flex md:flex-wrap md:items-center md:gap-3 relative z-20">
          <div className="flex items-center gap-2 md:flex-1 md:min-w-[200px]">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by author, book title, or subject..."
                className="w-full rounded-full border border-[#E8D8DA] bg-white pl-9 pr-4 py-2 text-xs text-[#222222] transition-all duration-200 focus:border-[#EC6568] focus:outline-none focus:ring-2 focus:ring-[#EC6568]/20"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilters((prev) => !prev)}
              className={`md:hidden inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium shrink-0 transition ${
                showMobileFilters
                  ? "bg-[#EC6568] text-white border-[#EC6568]"
                  : "bg-white text-[#222222] border-[#E8D8DA]"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters & Sort</span>
            </button>
          </div>

          <div
            className={`${
              showMobileFilters ? "grid" : "hidden"
            } grid-cols-1 sm:grid-cols-2 gap-2.5 md:flex md:flex-wrap md:items-center md:gap-3`}
          >
            <CustomSelect
              size="sm"
              rounded="full"
              direction="down"
              prefix="Status:"
              className="w-full md:w-40"
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={[
                { value: "All", label: "All" },
                ...TICKET_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />

            <CustomSelect
              size="sm"
              rounded="full"
              direction="down"
              prefix="Category:"
              className="w-full md:w-56"
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              options={[
                { value: "All", label: "All" },
                ...TICKET_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
            />

            <CustomSelect
              size="sm"
              rounded="full"
              direction="down"
              prefix="Priority:"
              className="w-full md:w-40"
              value={priorityFilter}
              onChange={(val) => setPriorityFilter(val)}
              options={[
                { value: "All", label: "All" },
                ...TICKET_PRIORITIES.map((p) => ({ value: p, label: p })),
              ]}
            />

            <CustomSelect
              size="sm"
              rounded="full"
              direction="down"
              prefix="Sort:"
              className="w-full md:w-48"
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              options={[
                { value: "urgent", label: "Urgent First" },
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" },
              ]}
            />
          </div>
        </section>

        {/* Mobile/Tablet Segmented Workspace Navigation (<lg) */}
        {mobileAdminPane !== "queue" && (
          <div className="lg:hidden sticky top-16 sm:top-24 z-20 bg-white/95 backdrop-blur-md rounded-2xl border border-[#F5D8DA] p-2 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMobileAdminPane("queue")}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF5F6] border border-[#F5D8DA] px-3.5 py-1.5 text-xs font-semibold text-[#EC6568] active:scale-95 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Queue ({tickets.length})</span>
            </button>

            <div className="flex items-center gap-1.5 bg-neutral-100/80 p-1 rounded-full">
              <button
                type="button"
                onClick={() => setMobileAdminPane("chat")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  mobileAdminPane === "chat"
                    ? "bg-[#111111] text-white shadow-sm"
                    : "text-neutral-600 hover:text-[#222222]"
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                <span>Chat & AI Draft</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileAdminPane("details")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  mobileAdminPane === "details"
                    ? "bg-[#111111] text-white shadow-sm"
                    : "text-neutral-600 hover:text-[#222222]"
                }`}
              >
                <BookOpen className="h-3 w-3" />
                <span>Triage & Book Info</span>
              </button>
            </div>
          </div>
        )}

        {/* Calm, Uncluttered 3-Column Support Workspace */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* COLUMN 1: Left Ticket Queue */}
          <div
            className={`lg:col-span-3 bg-white rounded-3xl border border-[#F5D8DA] shadow-sm overflow-hidden ${
              mobileAdminPane === "queue" ? "block" : "hidden lg:block"
            }`}
          >
            <div className="px-5 py-4 border-b border-neutral-100 bg-[#FFF5F6]/50 flex items-center justify-between">
              <span className="text-sm font-bold text-[#222222]">
                Author Queries ({tickets.length})
              </span>
              <span className="text-[11px] text-neutral-400 lg:hidden">
                Tap to open
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                Loading queries...
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                No queries match your filters.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-[740px] overflow-y-auto">
                {tickets.map((t) => {
                  const isSelected = t.id === selectedTicketId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTicketId(t.id);
                        setMobileAdminPane("chat");
                      }}
                      className={`group w-full text-left p-4 transition-all duration-200 block ${
                        isSelected
                          ? "bg-[#FFF5F6] border-l-4 border-l-[#EC6568]"
                          : "hover:bg-[#FFF5F6]/40 hover:pl-5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${getPriorityBadgeStyle(
                            t.priority
                          )}`}
                        >
                          {t.priority || "Medium"}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${getStatusBadgeStyle(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-[#222222] group-hover:text-[#EC6568] transition-colors line-clamp-2">
                        {t.subject}
                      </p>

                      <p className="text-xs text-neutral-600 mt-1 truncate">
                        {t.author?.name || "Author"}
                        {t.book ? ` • ${t.book.title}` : ""}
                      </p>

                      <p className="text-[11px] text-neutral-400 mt-1">
                        {formatRelativeTime(t.updated_at)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUMN 2: Center Conversation & AI-Assisted Reply */}
          <div
            className={`lg:col-span-6 space-y-5 ${
              mobileAdminPane === "chat" ? "block" : "hidden lg:block"
            }`}
          >
            {!activeTicket ? (
              <div className="bg-white rounded-3xl border border-[#F5D8DA] p-12 text-center text-sm text-neutral-400">
                Select an author query on the left to view the conversation.
              </div>
            ) : (
              <>
                {/* Airy Chat Thread Card */}
                <div className="bg-white rounded-3xl border border-[#F5D8DA] shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-neutral-100 bg-[#FFF5F6]/50">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium text-[#EC6568]">
                        {activeAuthor?.name} •{" "}
                        {activeBook
                          ? activeBook.title
                          : "General Account Query"}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {formatDateTime(activeTicket.created_at)}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-[#222222]">
                      {activeTicket.subject}
                    </h2>

                    {activeTicket.attachment_name && (
                      <div className="mt-3">
                        {activeTicket.attachment_data &&
                        activeTicket.attachment_data.startsWith(
                          "data:image/"
                        ) ? (
                          <a
                            href={activeTicket.attachment_data}
                            download={activeTicket.attachment_name}
                            target="_blank"
                            rel="noreferrer"
                            className="group inline-flex items-center gap-3 rounded-2xl bg-white border border-[#F5D8DA] hover:border-[#EC6568] p-2 pr-4 shadow-sm transition-all"
                          >
                            <img
                              src={activeTicket.attachment_data}
                              alt={activeTicket.attachment_name}
                              className="h-12 w-12 rounded-xl object-cover border border-neutral-100 shrink-0"
                            />
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-semibold text-[#222222] group-hover:text-[#EC6568] truncate max-w-[240px]">
                                {activeTicket.attachment_name}
                              </p>
                              <p className="text-[11px] text-neutral-400">
                                Author uploaded image • Click to view / download
                              </p>
                            </div>
                          </a>
                        ) : activeTicket.attachment_data ? (
                          <a
                            href={activeTicket.attachment_data}
                            download={activeTicket.attachment_name}
                            className="inline-flex items-center gap-2 rounded-full bg-white border border-[#F5D8DA] hover:border-[#EC6568] px-3.5 py-1.5 text-xs font-medium text-[#222222] hover:text-[#EC6568] transition"
                          >
                            <Paperclip className="h-3.5 w-3.5 text-[#EC6568]" />
                            <span>{activeTicket.attachment_name}</span>
                            <span className="text-[11px] text-neutral-400">
                              (Download)
                            </span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-neutral-200 px-3 py-1 text-xs text-neutral-600">
                            <Paperclip className="h-3 w-3 text-[#EC6568]" />
                            {activeTicket.attachment_name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-6 space-y-4 max-h-[320px] overflow-y-auto">
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
                            className={`max-w-[88%] rounded-2xl p-4 border ${
                              isAdmin
                                ? "bg-[#FFF5F6] border-[#F5D8DA] text-[#222222]"
                                : "bg-neutral-50 border-neutral-200 text-[#222222]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span className="text-xs font-bold">
                                {isAdmin
                                  ? `${msg.sender_name} (Support)`
                                  : msg.sender_name}
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                {formatDateTime(msg.created_at)}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-line leading-relaxed text-neutral-700">
                              {msg.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Warm AI-Assisted Reply Card (White Card with Soft Coral/Blush Border) */}
                <div className="bg-white rounded-3xl border border-[#F3D5D7] shadow-sm p-6 space-y-4">
                  {/* Single Clean Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#222222] flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-[#EC6568]" />
                        ✨ AI Draft Suggested
                      </span>
                      <span className="text-xs text-neutral-400">
                        ({activeTicket.ai_tokens_used || 410} tokens •{" "}
                        {activeTicket.ai_provider_status === "success"
                          ? "Live Gemini"
                          : "Fallback Mode"}
                        )
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={regeneratingAI}
                        onClick={() => handleRegenerateAI(false)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white hover:bg-[#FFF5F6] hover:border-[#EC6568] px-3.5 py-1.5 text-xs font-medium text-neutral-600 transition"
                      >
                        <RefreshCw
                          className={`h-3 w-3 text-[#EC6568] ${
                            regeneratingAI ? "animate-spin" : ""
                          }`}
                        />
                        <span>Regenerate Draft</span>
                      </button>

                      <button
                        type="button"
                        disabled={regeneratingAI}
                        onClick={() => handleRegenerateAI(true)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 px-3.5 py-1.5 text-xs font-medium text-neutral-500 transition"
                        title="Test offline fallback mode"
                      >
                        <ZapOff className="h-3 w-3" />
                        <span>Simulate Fallback</span>
                      </button>
                    </div>
                  </div>

                  {activeTicket.ai_reasoning && (
                    <p className="text-xs text-neutral-500 bg-[#FFF5F6]/70 rounded-2xl px-4 py-2.5 border border-[#F8E2E4]">
                      {activeTicket.ai_reasoning}
                    </p>
                  )}

                  <form onSubmit={handleSendAdminResponse} className="space-y-3">
                    <textarea
                      rows={8}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Review or edit the suggested reply before sending..."
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/40 p-4 text-sm text-[#222222] leading-relaxed focus:bg-white focus:border-[#EC6568] focus:outline-none"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex items-center justify-between sm:justify-start gap-2">
                        <span className="text-xs text-neutral-500">
                          Mark status as:
                        </span>
                        <CustomSelect
                          size="sm"
                          rounded="full"
                          direction="up"
                          className="w-40 sm:w-36"
                          value={replyStatusTarget}
                          onChange={(val) => setReplyStatusTarget(val)}
                          options={[
                            { value: "Resolved", label: "Resolved" },
                            { value: "In Progress", label: "In Progress" },
                            { value: "Open", label: "Open" },
                          ]}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sendingReply || replyDraft.trim().length < 2}
                        className="group w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-full bg-[#EC6568] hover:bg-[#D95356] disabled:opacity-50 text-white font-medium px-7 py-2.5 text-xs shadow-sm hover:shadow-[0_10px_25px_-6px_rgba(236,101,104,0.45)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
                      >
                        <Send className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                        <span>
                          {sendingReply ? "Sending..." : "Send Reply"}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Understated Internal Team Notes (Soft Warm Neutral Card) */}
                <div className="bg-neutral-50 rounded-3xl border border-neutral-200/80 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Internal Team Notes (Private to Support)
                    </h3>
                    <span className="text-xs text-neutral-400">
                      {(activeTicket.internal_notes || []).length} note(s)
                    </span>
                  </div>

                  {(activeTicket.internal_notes || []).length > 0 && (
                    <div className="space-y-2">
                      {activeTicket.internal_notes.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-2xl bg-white border border-neutral-200/80 p-3.5 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                            <span className="font-semibold text-[#222222]">
                              {n.admin_name}
                            </span>
                            <span>{formatDateTime(n.created_at)}</span>
                          </div>
                          <p className="text-neutral-700">{n.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <form
                    onSubmit={handleAddNote}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={internalNoteText}
                      onChange={(e) => setInternalNoteText(e.target.value)}
                      placeholder="Add an internal note for the team..."
                      className="flex-1 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs text-[#222222] focus:border-[#EC6568] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={
                        addingNote || internalNoteText.trim().length < 2
                      }
                      className="w-full sm:w-auto rounded-full bg-[#111111] hover:bg-neutral-800 disabled:opacity-50 text-white font-medium px-5 py-2 text-xs transition shrink-0"
                    >
                      {addingNote ? "Saving..." : "Add Note"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* COLUMN 3: Clean Right Sidebar */}
          <div
            className={`lg:col-span-3 space-y-5 ${
              mobileAdminPane === "details" ? "block" : "hidden lg:block"
            }`}
          >
            {activeTicket && (
              <>
                {/* Ticket Settings Card */}
                <div className="bg-white rounded-3xl border border-[#F5D8DA] p-5 shadow-sm space-y-3.5 relative z-10">
                  <h3 className="text-sm font-bold text-[#222222]">
                    Ticket Settings
                  </h3>

                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">
                      Status
                    </label>
                    <CustomSelect
                      size="sm"
                      rounded="xl"
                      direction="down"
                      value={activeTicket.status || "Open"}
                      onChange={(val) => handleOverrideField("status", val)}
                      options={TICKET_STATUSES.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">
                      Priority
                    </label>
                    <CustomSelect
                      size="sm"
                      rounded="xl"
                      direction="down"
                      value={activeTicket.priority || "Medium"}
                      onChange={(val) => handleOverrideField("priority", val)}
                      options={TICKET_PRIORITIES.map((p) => ({
                        value: p,
                        label: p,
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">
                      Category
                    </label>
                    <CustomSelect
                      size="sm"
                      rounded="xl"
                      direction="down"
                      value={activeTicket.category || "General Inquiry"}
                      onChange={(val) => handleOverrideField("category", val)}
                      options={TICKET_CATEGORIES.map((c) => ({
                        value: c,
                        label: c,
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">
                      Assigned To
                    </label>
                    <CustomSelect
                      size="sm"
                      rounded="xl"
                      direction="down"
                      value={
                        activeTicket.assigned_to_id
                          ? String(activeTicket.assigned_to_id)
                          : ""
                      }
                      onChange={(val) =>
                        handleOverrideField(
                          "assigned_to_id",
                          val ? Number(val) : null
                        )
                      }
                      options={[
                        {
                          value: "",
                          label: "Unassigned",
                          sublabel: "Open in shared ops queue",
                        },
                        ...adminsList.map((adm) => ({
                          value: String(adm.id),
                          label: adm.name,
                          sublabel: adm.email,
                          initials: adm.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2),
                        })),
                      ]}
                    />
                  </div>
                </div>

                {/* Author & Book Summary Card */}
                <div className="bg-white rounded-3xl border border-[#F5D8DA] p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-[#222222]">
                    Author & Book Summary
                  </h3>

                  {activeAuthor && (
                    <div className="rounded-2xl bg-[#FFF5F6]/70 border border-[#F8E2E4] p-3.5 text-xs space-y-1">
                      <p className="font-bold text-[#222222] text-sm">
                        {activeAuthor.name}
                      </p>
                      <p className="text-neutral-600">{activeAuthor.email}</p>
                      <p className="text-neutral-500">
                        {activeAuthor.city || "India"}
                        {activeAuthor.phone ? ` • ${activeAuthor.phone}` : ""}
                      </p>
                    </div>
                  )}

                  {!activeBook ? (
                    <p className="text-xs text-neutral-400 italic">
                      General account query (no specific book linked).
                    </p>
                  ) : (
                    <div className="space-y-3 text-xs">
                      <div>
                        <p className="font-bold text-[#222222] text-sm">
                          {activeBook.title}
                        </p>
                        <p className="text-neutral-500 mt-0.5">
                          {activeBook.status} • ISBN:{" "}
                          {activeBook.isbn || "Pending"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-neutral-50 p-3">
                        <div>
                          <span className="text-neutral-400 block">MRP</span>
                          <span className="font-semibold text-[#222222]">
                            {activeBook.mrp !== null
                              ? formatINR(activeBook.mrp)
                              : "TBD"}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">
                            Copies Sold
                          </span>
                          <span className="font-semibold text-[#222222]">
                            {activeBook.total_copies_sold}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">
                            Total Earned
                          </span>
                          <span className="font-semibold text-[#222222]">
                            {formatINR(activeBook.total_royalty_earned)}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">
                            Pending Payout
                          </span>
                          <span className="font-bold text-[#EC6568]">
                            {formatINR(activeBook.royalty_pending)}
                          </span>
                        </div>
                      </div>

                      <div className="text-neutral-500 space-y-1 pt-1">
                        <p>
                          Print Partner:{" "}
                          <span className="text-[#222222] font-medium">
                            {activeBook.print_partner || "In Production"}
                          </span>
                        </p>
                        <p>
                          Last Payout:{" "}
                          <span className="text-[#222222] font-medium">
                            {activeBook.last_royalty_payout_date || "None yet"}
                          </span>
                        </p>
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
