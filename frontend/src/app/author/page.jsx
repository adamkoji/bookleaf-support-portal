"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  MessageSquare,
  Plus,
  TrendingUp,
  IndianRupee,
  Award,
  AlertCircle,
  Paperclip,
  Send,
  X,
  FileText,
  ArrowLeft,
} from "lucide-react";
import BookLeafLogo from "@/components/BookLeafLogo";
import NavbarAccountSwitcher from "@/components/NavbarAccountSwitcher";
import CustomSelect from "@/components/CustomSelect";
import {
  getStoredUser,
  getStoredToken,
  fetchCurrentUser,
  fetchAuthorBooks,
  fetchAuthorTickets,
  fetchAuthorTicketDetail,
  createAuthorTicket,
  replyAuthorTicket,
  formatINR,
  formatDateTime,
  formatRelativeTime,
} from "@/lib/api";

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getStatusPillStyle(status) {
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

function getBookStatusStyle(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("published")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-[#FFF5F6] text-[#EC6568] border-[#F5D8DA]";
}

export default function AuthorPortalPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [books, setBooks] = useState([]);
  const [summary, setSummary] = useState({
    total_books: 0,
    published_books: 0,
    in_production_books: 0,
    total_copies_sold: 0,
    total_royalty_earned: 0,
    total_royalty_paid: 0,
    total_royalty_pending: 0,
  });
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [activeTab, setActiveTab] = useState("books"); // "books" | "tickets"
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New Query Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [formBookId, setFormBookId] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAttachment, setFormAttachment] = useState("");
  const [formAttachmentData, setFormAttachmentData] = useState("");
  const [formAttachmentSize, setFormAttachmentSize] = useState(0);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef(null);

  // Follow-up Reply State
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadAuthorData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [booksRes, ticketsRes] = await Promise.all([
        fetchAuthorBooks(),
        fetchAuthorTickets(),
      ]);
      setBooks(booksRes.books || []);
      setSummary(
        booksRes.summary || {
          total_books: 0,
          published_books: 0,
          in_production_books: 0,
          total_copies_sold: 0,
          total_royalty_earned: 0,
          total_royalty_paid: 0,
          total_royalty_pending: 0,
        }
      );
      const ticketList = ticketsRes || [];
      setTickets(ticketList);

      if (ticketList.length > 0) {
        setSelectedTicketId((prevId) => {
          const exists = ticketList.some((t) => t.id === prevId);
          return exists ? prevId : ticketList[0].id;
        });
      } else {
        setSelectedTicketId(null);
        setActiveTicket(null);
      }
    } catch (err) {
      if (!isBackground) {
        setError(err.message || "Failed to load author portal data.");
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (storedUser?.role === "admin") {
      router.replace("/admin");
      return;
    }
    setUser(storedUser);

    fetchCurrentUser()
      .then((freshUser) => {
        if (freshUser.role === "admin") {
          router.replace("/admin");
          return;
        }
        setUser(freshUser);
        loadAuthorData(false);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router, loadAuthorData]);

  useEffect(() => {
    if (!selectedTicketId) {
      setActiveTicket(null);
      return;
    }
    fetchAuthorTicketDetail(selectedTicketId)
      .then((detail) => setActiveTicket(detail))
      .catch(() => {});
  }, [selectedTicketId]);

  // Silent background polling every 3 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const updatedList = await fetchAuthorTickets();
        setTickets(updatedList || []);
        if (selectedTicketId) {
          const updatedDetail = await fetchAuthorTicketDetail(selectedTicketId);
          setActiveTicket(updatedDetail);
        }
      } catch {
        // Silent background poll ignore
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [user, selectedTicketId]);

  function openRaiseQueryModal(preselectedBookId = "") {
    setFormBookId(preselectedBookId ? String(preselectedBookId) : "");
    setFormSubject("");
    setFormDescription("");
    setFormAttachment("");
    setFormAttachmentData("");
    setFormAttachmentSize(0);
    setFormError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setShowNewModal(true);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Attachment size must be 5 MB or smaller.");
      return;
    }
    setFormError("");
    setFormAttachment(file.name);
    setFormAttachmentSize(file.size);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setFormAttachmentData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function clearSelectedAttachment() {
    setFormAttachment("");
    setFormAttachmentData("");
    setFormAttachmentSize(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleCreateTicketSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (formSubject.trim().length < 3) {
      setFormError("Please enter a subject of at least 3 characters.");
      return;
    }
    if (formDescription.trim().length < 3) {
      setFormError("Please provide a detailed description of your query.");
      return;
    }

    setSubmittingTicket(true);
    try {
      const payload = {
        book_id: formBookId ? Number(formBookId) : null,
        subject: formSubject.trim(),
        description: formDescription.trim(),
        attachment_name: formAttachment ? formAttachment.trim() : null,
        attachment_data: formAttachmentData || null,
      };
      const created = await createAuthorTicket(payload);
      setShowNewModal(false);
      await loadAuthorData(true);
      setSelectedTicketId(created.id);
      setActiveTicket(created);
      setActiveTab("tickets");
      setMobileShowThread(true);
    } catch (err) {
      setFormError(err.message || "Could not submit query.");
    } finally {
      setSubmittingTicket(false);
    }
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!activeTicket || replyText.trim().length < 2) return;
    setSendingReply(true);
    try {
      const updated = await replyAuthorTicket(
        activeTicket.id,
        replyText.trim()
      );
      setActiveTicket(updated);
      setReplyText("");
      await loadAuthorData(true);
    } catch (err) {
      alert(err.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDFD] flex flex-col text-[#222222] overflow-x-hidden">
      {/* Official Clean White Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-24 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <BookLeafLogo href="/" />
            {user && (
              <div className="hidden md:block pl-5 border-l border-neutral-200 truncate">
                <p className="text-sm font-semibold text-[#222222] truncate">
                  Welcome, {user.name}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {user.email}
                  {user.city ? ` • ${user.city}` : ""}
                </p>
              </div>
            )}
          </div>

          <NavbarAccountSwitcher
            currentUser={user}
            onUserSwitched={(newUser) => {
              setUser(newUser);
              if (newUser.role === "author") {
                loadAuthorData(false);
              }
            }}
          />
        </div>
      </header>

      {/* Subtle Blush Hero Banner */}
      <section className="bg-gradient-to-b from-[#FFF5F6] to-[#FFFDFD] border-b border-[#F8E2E4]/60 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#EC6568]">
                Your Author Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-neutral-600 mt-1">
                Live sales reports, royalty payouts, and direct support for your
                books.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openRaiseQueryModal("")}
              className="group w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-full bg-[#EC6568] hover:bg-[#D95356] text-white font-medium px-6 py-2.5 text-sm shadow-sm hover:shadow-[0_10px_25px_-6px_rgba(236,101,104,0.45)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 shrink-0"
            >
              <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
              <span>Raise Support Query</span>
            </button>
          </div>

          {/* 4 Clean KPI Cards with Soft Blush Icon Circles (Screenshot 2 Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 animate-fade-up">
            <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-5 flex items-center gap-4 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Total Books</p>
                <p className="text-2xl font-bold text-[#222222]">
                  {summary.total_books}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {summary.published_books} Published
                  {summary.in_production_books > 0
                    ? ` • ${summary.in_production_books} In Production`
                    : ""}
                </p>
              </div>
            </div>

            <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-5 flex items-center gap-4 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Copies Sold</p>
                <p className="text-2xl font-bold text-[#222222]">
                  {Number(summary.total_copies_sold || 0).toLocaleString(
                    "en-IN"
                  )}
                </p>
                <p className="text-[11px] text-neutral-400">
                  Live across all stores
                </p>
              </div>
            </div>

            <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-5 flex items-center gap-4 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Total Royalty Earned</p>
                <p className="text-2xl font-bold text-[#222222]">
                  {formatINR(summary.total_royalty_earned)}
                </p>
                <p className="text-[11px] text-neutral-400">
                  Paid: {formatINR(summary.total_royalty_paid)}
                </p>
              </div>
            </div>

            <div className="group bg-white rounded-2xl border border-[#F5D8DA] hover:border-[#EC6568]/60 p-5 flex items-center gap-4 shadow-sm hover:shadow-[0_14px_30px_-10px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-[#FDE8E9] group-hover:bg-[#EC6568] flex items-center justify-center text-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 shrink-0">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-neutral-500">Pending Royalty</p>
                <p className="text-2xl font-bold text-[#EC6568]">
                  {formatINR(summary.total_royalty_pending)}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {summary.total_royalty_pending >= 1000
                    ? "Eligible for next payout"
                    : "Min. payout: ₹1,000"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-6">
        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-center gap-3 text-sm text-rose-800">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Simple Navigation Tabs */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 border-b border-neutral-200 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab("books")}
            className={`flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-full px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
              activeTab === "books"
                ? "bg-[#111111] text-white shadow-sm -translate-y-0.5"
                : "bg-white text-neutral-600 border border-neutral-200 hover:border-[#EC6568] hover:text-[#EC6568] hover:bg-[#FFF5F6]/50"
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span>My Books ({books.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={`flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-full px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
              activeTab === "tickets"
                ? "bg-[#111111] text-white shadow-sm -translate-y-0.5"
                : "bg-white text-neutral-600 border border-neutral-200 hover:border-[#EC6568] hover:text-[#EC6568] hover:bg-[#FFF5F6]/50"
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span>My Support Queries ({tickets.length})</span>
          </button>
        </div>

        {/* TAB 1: MY BOOKS */}
        {activeTab === "books" && (
          <section className="animate-fade-up">
            {loading ? (
              <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center text-sm text-neutral-500">
                Loading your books...
              </div>
            ) : books.length === 0 ? (
              <div className="bg-white rounded-3xl border border-neutral-200 p-12 text-center text-sm text-neutral-500">
                No books found under your account.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {books.map((book) => {
                  const isInProduction =
                    !(book.status || "").toLowerCase().includes("published") ||
                    book.mrp === null;

                  return (
                    <div
                      key={book.id}
                      className="group bg-white rounded-3xl border border-[#F5D8DA] hover:border-[#EC6568]/60 shadow-sm hover:shadow-[0_18px_38px_-12px_rgba(236,101,104,0.16)] hover:-translate-y-1 transition-all duration-300 p-6 sm:p-7 flex flex-col justify-between"
                    >
                      <div>
                        {/* Title & Single Clean Status Pill */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-[#EC6568]">
                              {book.genre || "Book"}
                            </p>
                            <h3 className="text-xl font-bold text-[#222222] group-hover:text-[#EC6568] transition-colors duration-300 mt-0.5">
                              {book.title}
                            </h3>
                            <p className="text-xs text-neutral-400 mt-1">
                              ISBN: {book.isbn || "Pending"} •{" "}
                              {book.publication_date
                                ? `Published ${book.publication_date}`
                                : "In Production (TBD)"}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3.5 py-1 text-xs font-medium ${getBookStatusStyle(
                              book.status
                            )}`}
                          >
                            {book.status}
                          </span>
                        </div>

                        {/* 5 Key Financial & Sales Numbers (MRP, Copies Sold, Royalty Earned, Royalty Paid, Pending Payout) */}
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-2xl bg-[#FFF5F6]/70 group-hover:bg-[#FFF5F6] border border-[#F8E2E4] transition-colors duration-300 p-4 text-xs">
                          <div>
                            <span className="text-neutral-500 block">MRP</span>
                            <span className="font-bold text-[#222222] text-sm mt-0.5 block">
                              {book.mrp !== null
                                ? formatINR(book.mrp)
                                : "In Production (TBD)"}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 block">
                              Copies Sold
                            </span>
                            <span className="font-bold text-[#222222] text-sm mt-0.5 block">
                              {isInProduction && book.total_copies_sold === 0
                                ? "Not yet live"
                                : book.total_copies_sold.toLocaleString(
                                    "en-IN"
                                  )}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 block">
                              Royalty Earned
                            </span>
                            <span className="font-bold text-[#222222] text-sm mt-0.5 block">
                              {formatINR(book.total_royalty_earned)}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500 block">
                              Royalty Paid
                            </span>
                            <span className="font-bold text-[#3898A6] text-sm mt-0.5 block">
                              {formatINR(book.royalty_paid)}
                            </span>
                          </div>

                          <div className="col-span-2 sm:col-span-1">
                            <span className="text-neutral-500 block">
                              Royalty Pending
                            </span>
                            <span className="font-bold text-[#EC6568] text-sm mt-0.5 block">
                              {formatINR(book.royalty_pending)}
                            </span>
                          </div>
                        </div>

                        {/* Store Availability Tags */}
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-neutral-500">
                            Available on:
                          </span>
                          {book.available_on && book.available_on.length > 0 ? (
                            book.available_on.map((platform) => (
                              <span
                                key={platform}
                                className="rounded-full bg-neutral-100 px-3 py-0.5 text-xs text-neutral-700"
                              >
                                {platform}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs italic text-neutral-500">
                              Distribution setup pending publication
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Coral Pill Action Button */}
                      <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span className="text-xs text-neutral-400">
                          {book.last_royalty_payout_date
                            ? `Last payout: ${book.last_royalty_payout_date}`
                            : book.print_partner
                            ? `Print partner: ${book.print_partner}`
                            : "Production in progress"}
                        </span>

                        <button
                          type="button"
                          onClick={() => openRaiseQueryModal(book.id)}
                          className="w-full sm:w-auto text-center rounded-full bg-[#EC6568] hover:bg-[#D95356] text-white text-xs font-medium px-5 py-2.5 sm:py-2 shadow-sm hover:shadow-[0_8px_20px_-6px_rgba(236,101,104,0.45)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
                        >
                          Ask Support About This Book
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: MY SUPPORT QUERIES */}
        {activeTab === "tickets" && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-up">
            {/* Left Column: Clean List of Queries (Visible on Desktop, or on Mobile when !mobileShowThread) */}
            <div
              className={`lg:col-span-5 bg-white rounded-3xl border border-[#F5D8DA] shadow-sm overflow-hidden ${
                mobileShowThread ? "hidden lg:block" : "block"
              }`}
            >
              <div className="px-5 sm:px-6 py-4 border-b border-neutral-100 bg-[#FFF5F6]/60 flex items-center justify-between">
                <h2 className="text-base font-bold text-[#222222]">
                  My Support Queries
                </h2>
                <span className="text-xs text-neutral-400 lg:hidden">
                  Tap a query to open thread
                </span>
              </div>

              {tickets.length === 0 ? (
                <div className="p-10 text-center space-y-4">
                  <p className="text-sm text-neutral-500">
                    You haven&apos;t raised any support queries yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => openRaiseQueryModal("")}
                    className="rounded-full bg-[#EC6568] hover:bg-[#D95356] text-white text-xs font-medium px-5 py-2.5 transition-all duration-300"
                  >
                    Raise Support Query
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 max-h-[600px] overflow-y-auto">
                  {tickets.map((t) => {
                    const isSelected = t.id === selectedTicketId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTicketId(t.id);
                          setMobileShowThread(true);
                        }}
                        className={`group w-full text-left px-5 sm:px-6 py-4 transition-all duration-200 block ${
                          isSelected
                            ? "bg-[#FFF5F6] border-l-4 border-l-[#EC6568]"
                            : "hover:bg-[#FFF5F6]/40 hover:pl-7"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-neutral-400 truncate">
                            {t.book ? t.book.title : "General Account Query"}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0 ${getStatusPillStyle(
                              t.status
                            )}`}
                          >
                            {t.status}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-[#222222] group-hover:text-[#EC6568] transition-colors line-clamp-1">
                          {t.subject}
                        </p>

                        <p className="text-[11px] text-neutral-400 mt-1">
                          Updated {formatRelativeTime(t.updated_at)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Clean Conversation Thread (Visible on Desktop, or on Mobile when mobileShowThread) */}
            <div
              className={`lg:col-span-7 bg-white rounded-3xl border border-[#F5D8DA] shadow-sm overflow-hidden flex-col min-h-[480px] sm:min-h-[540px] ${
                mobileShowThread ? "flex" : "hidden lg:flex"
              }`}
            >
              {/* Mobile Sticky Back Button */}
              <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-[#F5D8DA] px-4 py-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMobileShowThread(false)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#FFF5F6] border border-[#F5D8DA] px-3.5 py-1.5 text-xs font-semibold text-[#EC6568] active:scale-95 transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to My Queries ({tickets.length})</span>
                </button>
              </div>

              {!activeTicket ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-neutral-400">
                  <MessageSquare className="h-9 w-9 mb-2 text-[#EC6568]/50" />
                  <p className="text-sm">
                    Select a query on the left to view your conversation with
                    BookLeaf Support.
                  </p>
                </div>
              ) : (
                <>
                  {/* Conversation Header */}
                  <div className="px-6 py-5 border-b border-neutral-100 bg-[#FFF5F6]/50">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-medium text-[#EC6568]">
                        {activeTicket.book
                          ? activeTicket.book.title
                          : "General / Account Query"}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-0.5 text-xs font-medium ${getStatusPillStyle(
                          activeTicket.status
                        )}`}
                      >
                        {activeTicket.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#222222]">
                      {activeTicket.subject}
                    </h3>

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
                              <p className="text-xs font-semibold text-[#222222] group-hover:text-[#EC6568] truncate max-w-[220px]">
                                {activeTicket.attachment_name}
                              </p>
                              <p className="text-[11px] text-neutral-400">
                                Image attached • Click to view / download
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

                  {/* Messages */}
                  <div className="flex-1 p-6 space-y-4 overflow-y-auto max-h-[420px]">
                    {(activeTicket.messages || []).map((msg) => {
                      const isAdmin = msg.sender_role === "admin";
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isAdmin ? "items-start" : "items-end"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-4 border ${
                              isAdmin
                                ? "bg-[#FFF5F6] border-[#F5D8DA] text-[#222222]"
                                : "bg-neutral-50 border-neutral-200 text-[#222222]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1.5">
                              <span className="text-xs font-bold text-[#222222]">
                                {isAdmin
                                  ? `${msg.sender_name} (BookLeaf Support)`
                                  : "You"}
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                {formatDateTime(msg.created_at)}
                              </span>
                            </div>
                            <div className="text-sm leading-relaxed whitespace-pre-line text-neutral-700">
                              {msg.message}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Simple Reply Input */}
                  <form
                    onSubmit={handleSendReply}
                    className="p-4 bg-white border-t border-neutral-100 flex items-end gap-3"
                  >
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply to BookLeaf Support..."
                      className="flex-1 rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-[#222222] focus:border-[#EC6568] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || replyText.trim().length < 2}
                      className="inline-flex items-center gap-2 rounded-full bg-[#EC6568] hover:bg-[#D95356] disabled:opacity-50 text-white font-medium px-6 py-3 text-xs shadow-sm transition shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{sendingReply ? "Sending..." : "Send"}</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </section>
        )}
      </main>

      {/* RAISE SUPPORT QUERY MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-[#F5D8DA] shadow-2xl w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto">
            <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 sm:py-5 bg-[#FFF5F6] rounded-t-3xl border-b border-[#F5D8DA] flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-[#222222]">
                Ask BookLeaf Support
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-neutral-400 hover:text-[#222222] transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateTicketSubmit}
              className="p-5 sm:p-7 space-y-4"
            >
              {formError && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Which book is this about?
                </label>
                <CustomSelect
                  rounded="xl"
                  direction="down"
                  value={formBookId}
                  onChange={(val) => setFormBookId(String(val))}
                  options={[
                    {
                      value: "",
                      label: "General / Account Level",
                      sublabel: "Royalty account, profile, or general publishing inquiry",
                      badge: "Account",
                    },
                    ...books.map((b) => ({
                      value: String(b.id),
                      label: b.title,
                      sublabel: b.isbn ? `ISBN: ${b.isbn}` : "ISBN Pending",
                      badge: b.status,
                      icon: BookOpen,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="How can we help you today?"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-[#222222] focus:border-[#EC6568] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Message *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Share the details of your question or concern..."
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-[#222222] focus:border-[#EC6568] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Attachment (Optional — Images or Documents up to 5 MB)
                </label>
                <div className="space-y-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-[#E8D8DA] bg-white hover:bg-[#FFF5F6] hover:border-[#EC6568] px-4 py-2 text-xs font-medium text-[#222222] transition-all duration-200"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-[#EC6568]" />
                    <span>
                      {formAttachment ? "Change Attached File" : "Attach File"}
                    </span>
                  </button>

                  {formAttachment && (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF5F6] border border-[#F5D8DA] p-2.5 pr-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {formAttachmentData &&
                        formAttachmentData.startsWith("data:image/") ? (
                          <img
                            src={formAttachmentData}
                            alt={formAttachment}
                            className="h-11 w-11 rounded-xl object-cover border border-white shadow-sm shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-xl bg-[#FDE8E9] flex items-center justify-center text-[#EC6568] shrink-0">
                            <FileText className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#222222] truncate">
                            {formAttachment}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {formAttachmentSize
                              ? `${formatFileSize(formAttachmentSize)} • Ready to upload & analyze`
                              : "Ready to upload"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={clearSelectedAttachment}
                        className="h-7 w-7 rounded-full bg-white hover:bg-[#EC6568] text-neutral-500 hover:text-white flex items-center justify-center transition shrink-0"
                        title="Remove attachment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-full border border-neutral-200 bg-white px-5 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="rounded-full bg-[#EC6568] hover:bg-[#D95356] disabled:opacity-60 text-white font-medium px-6 py-2.5 text-xs shadow-sm transition"
                >
                  {submittingTicket ? "Submitting..." : "Submit Query"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
