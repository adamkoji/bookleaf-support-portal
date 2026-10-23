"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ChevronDown,
  BookOpen,
  LogOut,
  Check,
  Headphones,
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
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleQuickSwitch(acc) {
    try {
      setSwitchingEmail(acc.email);
      const pw =
        acc.default_password ||
        (acc.role === "admin" ? "admin123" : "author123");
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
    <div className="flex items-center gap-2 sm:gap-3 shrink-0" ref={menuRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-medium text-[#222222] transition-all duration-200 ${
            open
              ? "border-[#EC6568] bg-[#FFF0F1] ring-2 ring-[#EC6568]/20 shadow-sm"
              : "border-[#E8D8DA] bg-[#FFF5F6] hover:border-[#EC6568] hover:bg-[#FDE8E9]"
          }`}
        >
          <Users className="h-3.5 w-3.5 text-[#EC6568] shrink-0" />
          <span className="sm:hidden">Switch</span>
          <span className="hidden sm:inline">Switch Account</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[#EC6568] shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>

        <div
          className={`absolute right-0 mt-2 w-[min(320px,calc(100vw-1.5rem))] bg-white/95 backdrop-blur-md rounded-2xl border border-[#FAD4D6] shadow-[0_20px_50px_rgba(236,101,104,0.16)] z-50 overflow-hidden origin-top-right transition-all duration-200 ease-out ${
            open
              ? "scale-100 opacity-100 translate-y-0 pointer-events-auto"
              : "scale-95 opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="bg-[#FFF5F6] border-b border-[#F5D8DA] px-4 py-3">
            <p className="text-xs font-semibold text-[#222222]">
              Switch Portal Account
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Preview Author or Support Team views with 1 click
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <div>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#EC6568]">
                BookLeaf Support Team
              </p>
              <div className="space-y-0.5">
                {admins.map((acc) => {
                  const isCurrent = currentUser?.email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={switchingEmail === acc.email}
                      onClick={() => handleQuickSwitch(acc)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all duration-150 cursor-pointer ${
                        isCurrent
                          ? "bg-[#FFF0F1] text-[#EC6568] font-medium"
                          : "text-[#222222] hover:bg-[#FFF0F1] hover:text-[#EC6568] hover:pl-3.5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent
                              ? "bg-[#EC6568] text-white"
                              : "bg-[#FDE8E9] text-[#EC6568]"
                          }`}
                        >
                          <Headphones className="h-3.5 w-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="truncate">{acc.name}</div>
                          <div className="text-[11px] text-neutral-400 truncate">
                            {acc.email}
                          </div>
                        </div>
                      </div>
                      {isCurrent && (
                        <Check className="h-3.5 w-3.5 text-[#EC6568] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-1.5 border-t border-[#F8E2E4]">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#EC6568]">
                Published Authors
              </p>
              <div className="space-y-0.5">
                {authors.map((acc) => {
                  const isCurrent = currentUser?.email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      disabled={switchingEmail === acc.email}
                      onClick={() => handleQuickSwitch(acc)}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-all duration-150 cursor-pointer ${
                        isCurrent
                          ? "bg-[#FFF0F1] text-[#EC6568] font-medium"
                          : "text-[#222222] hover:bg-[#FFF0F1] hover:text-[#EC6568] hover:pl-3.5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent
                              ? "bg-[#EC6568] text-white"
                              : "bg-[#FDE8E9] text-[#EC6568]"
                          }`}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate">{acc.name}</span>
                            {acc.city && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${
                                  isCurrent
                                    ? "bg-white/90 text-[#EC6568]"
                                    : "bg-[#FFF5F6] text-neutral-500 border border-[#F5D8DA]"
                                }`}
                              >
                                {acc.city}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 truncate">
                            {acc.email}
                          </div>
                        </div>
                      </div>
                      {isCurrent && (
                        <Check className="h-3.5 w-3.5 text-[#EC6568] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-[#111111] transition shrink-0"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}
