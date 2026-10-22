"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ChevronDown,
  ShieldCheck,
  BookOpen,
  LogOut,
  Check,
  Sparkles,
} from "lucide-react";
import {
  fetchDemoAccounts,
  loginApi,
  clearAuthSession,
} from "@/lib/api";

const FALLBACK_ACCOUNTS = [
  {
    name: "BookLeaf Support Lead",
    email: "admin@bookleafpub.com",
    role: "admin",
    default_password: "admin123",
    city: "Delhi NCR",
  },
  {
    name: "Shivangi - Ops Admin",
    email: "ops@bookleafpub.com",
    role: "admin",
    default_password: "admin123",
    city: "Delhi NCR",
  },
  {
    author_code: "AUTH001",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    role: "author",
    default_password: "author123",
    city: "Mumbai",
  },
  {
    author_code: "AUTH007",
    name: "Sneha Kulkarni",
    email: "sneha.kulkarni@email.com",
    role: "author",
    default_password: "author123",
    city: "Bangalore",
  },
  {
    author_code: "AUTH002",
    name: "Rohit Kapoor",
    email: "rohit.kapoor@email.com",
    role: "author",
    default_password: "author123",
    city: "Delhi",
  },
  {
    author_code: "AUTH004",
    name: "Vikram Joshi",
    email: "vikram.joshi@email.com",
    role: "author",
    default_password: "author123",
    city: "Pune",
  },
];

export default function NavbarAccountSwitcher({ currentUser, onUserSwitched }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState(FALLBACK_ACCOUNTS);
  const [switchingEmail, setSwitchingEmail] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    fetchDemoAccounts()
      .then((res) => {
        if (mounted && res?.accounts?.length) {
          setAccounts(res.accounts);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleQuickSwitch(acc) {
    try {
      setSwitchingEmail(acc.email);
      const pw = acc.default_password || (acc.role === "admin" ? "admin123" : "author123");
      const data = await loginApi(acc.email, pw);
      setOpen(false);
      if (onUserSwitched) {
        onUserSwitched(data.user);
      }
      if (data.user.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/author");
      }
    } catch (err) {
      alert(err.message || "Failed to switch account");
    } finally {
      setSwitchingEmail(null);
    }
  }

  function handleLogout() {
    clearAuthSession();
    router.push("/login");
  }

  const admins = accounts.filter((a) => a.role === "admin");
  const authors = accounts.filter((a) => a.role === "author");

  return (
    <div className="flex items-center gap-2.5" ref={menuRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          <span>Switch Demo Account</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
            <div className="bg-slate-900 px-3.5 py-2.5 text-white">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                1-Click Evaluator Role Switcher
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Instantly switch between Admin Ops & Author views
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              <div className="p-2">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  BookLeaf Admin Console
                </p>
                {admins.map((acc) => {
                  const isCurrent = currentUser?.email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={switchingEmail === acc.email}
                      onClick={() => handleQuickSwitch(acc)}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                        isCurrent
                          ? "bg-emerald-50 text-emerald-900 font-semibold"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="truncate">
                          <div className="truncate">{acc.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {acc.email}
                          </div>
                        </div>
                      </div>
                      {isCurrent ? (
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          Admin
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-2">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Seeded Authors (10 Accounts)
                </p>
                {authors.map((acc) => {
                  const isCurrent = currentUser?.email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={switchingEmail === acc.email}
                      onClick={() => handleQuickSwitch(acc)}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                        isCurrent
                          ? "bg-emerald-50 text-emerald-900 font-semibold"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <div className="truncate">
                          <div className="truncate">
                            {acc.name}{" "}
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({acc.author_code})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {acc.email} {acc.city ? `• ${acc.city}` : ""}
                          </div>
                        </div>
                      </div>
                      {isCurrent && (
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}

