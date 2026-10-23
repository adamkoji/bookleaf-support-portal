"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ArrowRight,
  AlertCircle,
  Headphones,
} from "lucide-react";
import BookLeafLogo from "@/components/BookLeafLogo";
import CustomSelect from "@/components/CustomSelect";
import {
  loginApi,
  fetchDemoAccounts,
  getStoredUser,
  getStoredToken,
} from "@/lib/api";

const DEMO_PERSONAS = [
  {
    title: "Priya Sharma",
    roleLabel: "Published Author • Mumbai",
    description:
      "Author of 'Whispers of the Ganges' & 'The Saffron Diaries' with ₹3,570 pending royalty.",
    email: "priya.sharma@email.com",
    password: "author123",
    role: "author",
  },
  {
    title: "Sneha Kulkarni",
    roleLabel: "Bestselling Author • Bangalore",
    description:
      "2 published books + 'Midnight in Mysore' currently in Cover Design production.",
    email: "sneha.kulkarni@email.com",
    password: "author123",
    role: "author",
  },
  {
    title: "Rohit Kapoor",
    roleLabel: "Published Author • Delhi",
    description:
      "2,000+ copies sold across 'Code & Karma' & 'Startup Sutra'.",
    email: "rohit.kapoor@email.com",
    password: "author123",
    role: "author",
  },
  {
    title: "BookLeaf Support Team",
    roleLabel: "Support Lead • Operations Desk",
    description:
      "Manage author support tickets, review AI-drafted replies, and update book inquiries.",
    email: "admin@bookleafpub.com",
    password: "admin123",
    role: "admin",
  },
];

export default function LoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("priya.sharma@email.com");
  const [password, setPassword] = useState("author123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [selectedDropdownEmail, setSelectedDropdownEmail] = useState(
    "kavita.deshmukh@email.com"
  );
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
    <div className="min-h-screen flex flex-col bg-white text-[#222222] overflow-x-hidden">
      {/* Official BookLeaf White Header with strictly 2 navigation links */}
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <BookLeafLogo href="/" />

          <nav className="flex items-center gap-1.5 sm:gap-5 text-xs sm:text-sm font-medium shrink-0">
            <Link
              href="/"
              className="relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-neutral-600 hover:text-[#EC6568] hover:bg-[#FFF0F1]/60 transition-all duration-200 after:content-[''] after:absolute after:left-1/2 after:right-1/2 hover:after:left-3 sm:hover:after:left-3.5 hover:after:right-3 sm:hover:after:right-3.5 after:bottom-1 after:h-[2px] after:rounded-full after:bg-[#EC6568] after:transition-all after:duration-300"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-[#EC6568] font-semibold bg-[#FFF0F1]/70 hover:bg-[#FFF0F1] transition-all duration-200 after:content-[''] after:absolute after:left-3 sm:after:left-3.5 after:right-3 sm:after:right-3.5 after:bottom-1 after:h-[2px] after:rounded-full after:bg-[#EC6568] after:transition-all after:duration-300"
            >
              Login
            </Link>
            {existingSessionUser && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    existingSessionUser.role === "admin" ? "/admin" : "/author"
                  )
                }
                className="group hidden sm:inline-flex items-center gap-2 rounded-full bg-[#EC6568] hover:bg-[#D95356] px-5 py-2 text-xs font-medium text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <span>Dashboard ({existingSessionUser.name})</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero & Login Section with Soft Blush Wave Background */}
      <section className="relative flex-1 overflow-hidden bg-gradient-to-b from-white via-[#FFF5F6] to-[#FCE8EA]/60 pt-7 sm:pt-10 pb-12 sm:pb-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-16 h-[460px] w-[460px] rounded-full bg-[#FCE8EA]/70 blur-2xl"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-7 sm:mb-10 animate-fade-up">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#EC6568]">
              Sign In to Support Portal
            </h1>
            <p className="mt-2 sm:mt-3 text-sm sm:text-lg text-neutral-600 leading-relaxed">
              Access your published books, royalty ledger, and support
              conversations, or use the quick demo switcher to explore.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Card: Sign In Form */}
            <div className="lg:col-span-5 bg-white rounded-3xl shadow-lg shadow-[#EC6568]/5 border border-[#F5D8DA] p-5 sm:p-8 animate-fade-up delay-100">
              <h2 className="text-xl font-bold text-[#222222]">
                Sign in with Email
              </h2>
              <p className="text-sm text-neutral-500 mt-1 mb-6">
                Enter your registered author or support team credentials.
              </p>

              {error && (
                <div className="mb-5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priya.sharma@email.com"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-[#222222] transition-all duration-200 focus:border-[#EC6568] focus:outline-none focus:ring-2 focus:ring-[#EC6568]/25"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-[#222222] transition-all duration-200 focus:border-[#EC6568] focus:outline-none focus:ring-2 focus:ring-[#EC6568]/25"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group w-full rounded-full bg-[#EC6568] hover:bg-[#D95356] disabled:opacity-60 text-white font-medium py-3.5 px-7 text-sm shadow-sm hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-[0_12px_28px_-6px_rgba(236,101,104,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <span>{loading ? "Signing in..." : "Sign In"}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Right Card: Quick Demo Login */}
            <div className="lg:col-span-7 bg-white/90 backdrop-blur rounded-3xl shadow-lg shadow-[#EC6568]/5 border border-[#F5D8DA] p-5 sm:p-8 animate-fade-up delay-200">
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#222222]">
                  Quick Demo Login
                </h2>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Select an author account or the BookLeaf support desk to
                  explore immediately with one click.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {DEMO_PERSONAS.map((card) => (
                  <button
                    key={card.email}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setEmail(card.email);
                      setPassword(card.password);
                      performLogin(card.email, card.password);
                    }}
                    className="group text-left rounded-2xl bg-white hover:bg-[#FFF5F6] border border-neutral-200 hover:border-[#EC6568] p-4 hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-[#FDE8E9] text-[#EC6568] group-hover:bg-[#EC6568] group-hover:text-white group-hover:scale-110 transition-all duration-300 flex items-center justify-center shrink-0">
                          {card.role === "admin" ? (
                            <Headphones className="h-4 w-4" />
                          ) : (
                            <BookOpen className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#222222] group-hover:text-[#EC6568] transition-colors truncate">
                            {card.title}
                          </h3>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {card.roleLabel}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        {card.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-xs font-medium text-[#EC6568]">
                      <span>Enter Portal</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </div>
                  </button>
                ))}
              </div>

              {/* All Accounts Selector */}
              <div className="mt-5 pt-5 border-t border-neutral-100">
                <label className="block text-xs font-medium text-neutral-600 mb-2">
                  Or switch to any other author account:
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <CustomSelect
                    className="flex-1"
                    direction="up"
                    rounded="full"
                    value={selectedDropdownEmail}
                    onChange={(val) => setSelectedDropdownEmail(val)}
                    groups={[
                      {
                        groupLabel: "BookLeaf Support Team",
                        options: [
                          {
                            value: "admin@bookleafpub.com",
                            label: "BookLeaf Support Lead",
                            sublabel: "admin@bookleafpub.com",
                            badge: "Ops Lead",
                            icon: Headphones,
                          },
                          {
                            value: "ops@bookleafpub.com",
                            label: "Shivangi - Ops Admin",
                            sublabel: "ops@bookleafpub.com",
                            badge: "Support Desk",
                            icon: Headphones,
                          },
                        ],
                      },
                      {
                        groupLabel: "Published Authors",
                        options: (allAuthors.length > 0
                          ? allAuthors
                          : [
                              {
                                name: "Priya Sharma",
                                email: "priya.sharma@email.com",
                                city: "Mumbai",
                              },
                              {
                                name: "Rohit Kapoor",
                                email: "rohit.kapoor@email.com",
                                city: "Delhi",
                              },
                              {
                                name: "Ananya Reddy",
                                email: "ananya.reddy@email.com",
                                city: "Hyderabad",
                              },
                              {
                                name: "Vikram Joshi",
                                email: "vikram.joshi@email.com",
                                city: "Pune",
                              },
                              {
                                name: "Meera Nair",
                                email: "meera.nair@email.com",
                                city: "Kochi",
                              },
                              {
                                name: "Arjun Malhotra",
                                email: "arjun.malhotra@email.com",
                                city: "Chandigarh",
                              },
                              {
                                name: "Sneha Kulkarni",
                                email: "sneha.kulkarni@email.com",
                                city: "Bangalore",
                              },
                              {
                                name: "Farhan Sheikh",
                                email: "farhan.sheikh@email.com",
                                city: "Lucknow",
                              },
                              {
                                name: "Kavita Deshmukh",
                                email: "kavita.deshmukh@email.com",
                                city: "Nagpur",
                              },
                              {
                                name: "Diya Chatterjee",
                                email: "diya.chatterjee@email.com",
                                city: "Kolkata",
                              },
                            ]
                        ).map((a) => ({
                          value: a.email,
                          label: a.name,
                          sublabel: a.email,
                          badge: a.city || "India",
                          initials: a.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2),
                        })),
                      },
                    ]}
                  />

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDropdownDemoLogin}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] hover:bg-neutral-800 hover:-translate-y-0.5 active:scale-[0.98] text-white font-medium px-6 py-2.5 text-xs transition-all duration-200 shrink-0"
                  >
                    <span>Login Selected</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Official BookLeaf Black Footer */}
      <footer className="bg-[#111111] text-white py-8 sm:py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left text-xs text-neutral-400">
          <BookLeafLogo variant="inverted" href="/" />
          <div className="space-y-1 sm:text-right">
            <p className="text-neutral-300">
              BookLeaf Publishing — Author Support & Operations Portal
            </p>
            <p>© BookLeaf Publishing. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
