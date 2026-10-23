const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "bookleaf_token";
const USER_KEY = "bookleaf_user";

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function parseErrorMessage(data, status) {
  if (!data) return `Request failed with status ${status}`;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((err) => {
        const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : "field";
        return `${field}: ${err.msg}`;
      })
      .join(", ");
  }
  return data.message || `Request failed with status ${status}`;
}

export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Unable to reach BookLeaf API at ${API_BASE_URL}. Ensure the FastAPI backend server is running on port 8000.`
    );
  }

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (response.status === 401 && !endpoint.includes("/api/auth/login")) {
    clearAuthSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login" && window.location.pathname !== "/") {
      window.location.href = "/login";
    }
    throw new Error(parseErrorMessage(data, 401));
  }

  if (!response.ok) {
    throw new Error(parseErrorMessage(data, response.status));
  }

  return data;
}

// ---------------- Auth API ----------------

export async function loginApi(email, password) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthSession(data.access_token, data.user);
  return data;
}

export async function fetchCurrentUser() {
  return apiRequest("/api/auth/me");
}

export async function fetchDemoAccounts() {
  return apiRequest("/api/auth/demo-accounts");
}

// ---------------- Author API ----------------

export async function fetchAuthorBooks() {
  return apiRequest("/api/author/books");
}

export async function fetchAuthorTickets() {
  return apiRequest("/api/author/tickets");
}

export async function fetchAuthorTicketDetail(ticketId) {
  return apiRequest(`/api/author/tickets/${ticketId}`);
}

export async function createAuthorTicket(payload) {
  return apiRequest("/api/author/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function replyAuthorTicket(ticketId, message) {
  return apiRequest(`/api/author/tickets/${ticketId}/reply`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ---------------- Admin API ----------------

export async function fetchAdminTickets(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "All") params.set("status", filters.status);
  if (filters.category && filters.category !== "All") params.set("category", filters.category);
  if (filters.priority && filters.priority !== "All") params.set("priority", filters.priority);
  if (filters.date && filters.date !== "All") params.set("date", filters.date);
  if (filters.search && filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.sort_by) params.set("sort_by", filters.sort_by);

  const qs = params.toString();
  return apiRequest(`/api/admin/tickets${qs ? `?${qs}` : ""}`);
}

export async function fetchAdminTicketDetail(ticketId) {
  return apiRequest(`/api/admin/tickets/${ticketId}`);
}

export async function updateAdminTicket(ticketId, payload) {
  return apiRequest(`/api/admin/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function sendAdminReply(ticketId, message, status) {
  const body = { message };
  if (status) body.status = status;
  return apiRequest(`/api/admin/tickets/${ticketId}/reply`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function addAdminInternalNote(ticketId, note) {
  return apiRequest(`/api/admin/tickets/${ticketId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function regenerateAdminTicketAI(ticketId, forceFallback = false) {
  return apiRequest(`/api/admin/tickets/${ticketId}/regenerate-ai`, {
    method: "POST",
    body: JSON.stringify({ force_fallback: forceFallback }),
  });
}

export async function fetchAdminAuthors() {
  return apiRequest("/api/admin/authors");
}

export async function fetchAdminsList() {
  return apiRequest("/api/admin/admins");
}

// ---------------- Formatting Helpers ----------------

export function formatINR(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "TBD";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatDateTime(isoString) {
  if (!isoString) return "—";
  const normalized = isoString.endsWith("Z") || isoString.includes("+") ? isoString : `${isoString}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const normalized = isoString.endsWith("Z") || isoString.includes("+") ? isoString : `${isoString}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export const TICKET_CATEGORIES = [
  "Royalty & Payments",
  "ISBN & Metadata Issues",
  "Printing & Quality",
  "Distribution & Availability",
  "Book Status & Production Updates",
  "General Inquiry",
];

export const TICKET_PRIORITIES = ["Critical", "High", "Medium", "Low"];
export const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

