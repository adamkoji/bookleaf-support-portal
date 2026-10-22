"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Feather,
  ShieldCheck,
  BookOpen,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Layers,
} from "lucide-react";
import {
  loginApi,
  fetchDemoAccounts,
  getStoredUser,
  getStoredToken,
} from "@/lib/api";

const FEATURED_DEMO_CARDS = [
  {
    title: "BookLeaf Admin Console",
    subtitle: "BookLeaf Support Lead (admin@bookleafpub.com)",
    badge: "ADMIN OPS & AI TRIAGE",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    description:
      "Full Ticket Queue, AI Triage & Draft Studio, Priority/Category Overrides, Internal Ops Notes & Live Book DB Context.",
    email: "admin@bookleafpub.com",
    password: "admin123",
    role: "admin",
  },
  {
    title: "Priya Sharma (AUTH001)",
    subtitle: "priya.sharma@email.com • Mumbai",
    badge: "2 BOOKS • ₹3,570 PENDING ROYALTY",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    description:
      "Author of 'Whispers of the Ganges' (BK001) & 'The Saffron Diaries' (BK002). Has open ticket TKT-1001 on pending royalty payout.",
    email: "priya.sharma@email.com",
    password: "author123",
    role: "author",
  },
  {
    title: "Sneha Kulkarni (AUTH007)",
    subtitle: "sneha.kulkarni@email.com • Bangalore",
    badge: "2 BESTSELLERS + 1 IN PRODUCTION",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    description:
      "Includes 'Midnight in Mysore' (BK013 — In Production: Cover Design with null MRP/publication date edge cases).",
    email: "sneha.kulkarni@email.com",
    password: "author123",
    role: "author",
  },
  {
    title: "Rohit Kapoor (AUTH002)",
    subtitle: "rohit.kapoor@email.com • Delhi",
    badge: "2,079 COPIES SOLD • ISBN ISSUE",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    description:
      "High-volume author of 'Code & Karma' (BK003) & 'Startup Sutra' (BK004). Has active Amazon ISBN mismatch ticket TKT-1003.",
    email: "rohit.kapoor@email.com",
    password: "author123",
    role: "author",
  },
];

export default function LoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("priya.sharma@email.com");
  const [password, setPassword] = useState("author123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [selectedDropdownEmail, setSelectedDropdownEmail] = useState("kavita.deshmukh@email.com");
  const [existingSessionUser, setExistingSessionUser] = useState(null);

  useEffect(() => {
    const user = getStoredUser();
    const token = getStoredToken();
    if (user && token) {
      setExistingSessionUser(user);
    }

    fetchDemoAccounts()
      .then((res) => {
        if (res?.accounts) {
          setDemoAccounts(res.accounts);
        }
      })
      .catch(() => {});
  }, []);

  async function performLogin(targetEmail, targetPassword) {
    setError("");
    setLoading(true);
    try {
      const data = await loginApi(targetEmail, targetPassword);
      if (data.user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/author");
      }
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    performLogin(email, password);
  }

  function handleDropdownDemoLogin() {
    if (!selectedDropdownEmail) return;
    const found = demoAccounts.find((a) => a.email === selectedDropdownEmail);
    const pw = found
      ? found.default_password
      : selectedDropdownEmail.includes("bookleafpub.com")
      ? "admin123"
      : "author123";
    setEmail(selectedDropdownEmail);
    setPassword(pw);
    performLogin(selectedDropdownEmail, pw);
  }

  const allAuthors = demoAccounts.filter((a) => a.role === "author");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 flex flex-col justify-between text-slate-900">
      {/* Top Banner */}
      <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Feather className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                BookLeaf Publishing
              </span>
              <span className="block text-xs text-emerald-300/90">
                Author Support, Royalty Ledger & AI Triage Portal
              </span>
            </div>
          </div>

          {existingSessionUser && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  existingSessionUser.role === "admin" ? "/admin" : "/author"
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Continue as {existingSessionUser.name} ({existingSessionUser.role})
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Standard Login Form */}
          <div className="lg:col-span-5 bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-8">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                JWT Role-Based Authentication
              </span>
              <h1 className="text-2xl font-bold text-slate-900 mt-3">
                Sign in to your portal
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Authors access their book sales, royalties & support tickets.
                Admins access the AI triage queue.
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya.sharma@email.com"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Default passwords: Authors{" "}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    author123
                  </code>{" "}
                  • Admins{" "}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                    admin123
                  </code>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-3 px-4 text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
              >
                <span>{loading ? "Signing in..." : "Sign In to Portal"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                <span>Architecture Highlights</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>• Strict RBAC isolation between Authors & Admin Ops</li>
                <li>• Token-conscious AI selector (~75% fewer tokens/ticket)</li>
                <li>• Real-time 3s background sync from Admin to Author</li>
              </ul>
            </div>
          </div>

          {/* Right Column: 1-Click Evaluator Demo Switcher */}
          <div className="lg:col-span-7 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/15 p-6 sm:p-8 text-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/30 px-3 py-1 text-xs font-semibold text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  1-Click Evaluator Demo Switcher
                </span>
                <h2 className="text-xl font-bold text-white mt-2">
                  Instant Role & Persona Login
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Click any card below to immediately log in and inspect that
                  persona&apos;s workspace.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {FEATURED_DEMO_CARDS.map((card) => (
                <button
                  key={card.email}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(card.email);
                    setPassword(card.password);
                    performLogin(card.email, card.password);
                  }}
                  className="group text-left rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-white/10 hover:border-emerald-400/60 p-4 transition flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${card.badgeColor}`}
                      >
                        {card.badge}
                      </span>
                      {card.role === "admin" ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                      {card.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {card.subtitle}
                    </p>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
                    <span>1-Click Sign In</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
                  </div>
                </button>
              ))}
            </div>

            {/* Dropdown for all 10 seeded authors + second admin */}
            <div className="mt-5 pt-5 border-t border-white/10">
              <label className="block text-xs font-semibold text-slate-200 mb-2">
                Or choose from any of the 10 Seeded Authors & Ops Accounts:
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                  value={selectedDropdownEmail}
                  onChange={(e) => setSelectedDropdownEmail(e.target.value)}
                  className="flex-1 rounded-xl bg-slate-900 border border-white/20 px-3.5 py-2.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                >
                  <optgroup label="BookLeaf Admin Accounts">
                    <option value="admin@bookleafpub.com">
                      [ADMIN] BookLeaf Support Lead (admin@bookleafpub.com)
                    </option>
                    <option value="ops@bookleafpub.com">
                      [ADMIN] Shivangi - Ops Admin (ops@bookleafpub.com)
                    </option>
                  </optgroup>
                  <optgroup label="All 10 Seeded Author Accounts">
                    {(allAuthors.length > 0
                      ? allAuthors
                      : [
                          {
                            author_code: "AUTH001",
                            name: "Priya Sharma",
                            email: "priya.sharma@email.com",
                            city: "Mumbai",
                          },
                          {
                            author_code: "AUTH002",
                            name: "Rohit Kapoor",
                            email: "rohit.kapoor@email.com",
                            city: "Delhi",
                          },
                          {
                            author_code: "AUTH003",
                            name: "Ananya Reddy",
                            email: "ananya.reddy@email.com",
                            city: "Hyderabad",
                          },
                          {
                            author_code: "AUTH004",
                            name: "Vikram Joshi",
                            email: "vikram.joshi@email.com",
                            city: "Pune",
                          },
                          {
                            author_code: "AUTH005",
                            name: "Meera Nair",
                            email: "meera.nair@email.com",
                            city: "Kochi",
                          },
                          {
                            author_code: "AUTH006",
                            name: "Arjun Malhotra",
                            email: "arjun.malhotra@email.com",
                            city: "Chandigarh",
                          },
                          {
                            author_code: "AUTH007",
                            name: "Sneha Kulkarni",
                            email: "sneha.kulkarni@email.com",
                            city: "Bangalore",
                          },
                          {
                            author_code: "AUTH008",
                            name: "Farhan Sheikh",
                            email: "farhan.sheikh@email.com",
                            city: "Lucknow",
                          },
                          {
                            author_code: "AUTH009",
                            name: "Kavita Deshmukh",
                            email: "kavita.deshmukh@email.com",
                            city: "Nagpur",
                          },
                          {
                            author_code: "AUTH010",
                            name: "Diya Chatterjee",
                            email: "diya.chatterjee@email.com",
                            city: "Kolkata",
                          },
                        ]
                    ).map((a) => (
                      <option key={a.email} value={a.email}>
                        [{a.author_code}] {a.name} ({a.email} • {a.city})
                      </option>
                    ))}
                  </optgroup>
                </select>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDropdownDemoLogin}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 text-xs transition shrink-0"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Login Selected Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 text-center text-xs text-slate-400">
        BookLeaf Publishing — Full-Stack Author Support & AI Triage Portal (SQLite WAL • FastAPI • Next.js)
      </footer>
    </div>
  );
}

