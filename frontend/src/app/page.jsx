"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IndianRupee,
  BookOpen,
  Sparkles,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Headphones,
} from "lucide-react";
import BookLeafLogo from "@/components/BookLeafLogo";
import { getStoredUser, getStoredToken } from "@/lib/api";

const FEATURES = [
  {
    icon: IndianRupee,
    title: "Book & Royalty Transparency",
    description:
      "View live copy sales, MRP, 80/20 royalty earnings, disbursed payouts, pending balances, and real-time production stages for every title in your catalog.",
  },
  {
    icon: BookOpen,
    title: "Direct Book-Linked Tickets",
    description:
      "Raise support queries linked directly to a specific book or your general author account—covering royalties, ISBN metadata, print quality, and store availability.",
  },
  {
    icon: Sparkles,
    title: "AI-Assisted Support Triage",
    description:
      "Automatically classifies incoming queries across 6 publishing categories, prioritizes urgent blockers, and drafts policy-accurate replies using live book records.",
  },
  {
    icon: MessageSquare,
    title: "Real-Time Status & Replies",
    description:
      "Seamless multi-turn conversation threads between authors and the BookLeaf support team with live status updates from Open to In Progress and Resolved.",
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    role: "For Authors",
    title: "Check Your Books & Raise a Query",
    description:
      "Sign in to inspect your book sales, royalty ledger, or production progress. Need help? Select any book and submit a query in seconds.",
  },
  {
    step: "02",
    role: "Smart Triage Engine",
    title: "Instant Context & Policy Matching",
    description:
      "Our AI engine pairs your query with your exact book record (ISBN, copies sold, pending payout, print partner) and BookLeaf's publishing policies.",
  },
  {
    step: "03",
    role: "For Support Operations",
    title: "Fast, Accurate Resolution",
    description:
      "BookLeaf specialists review the AI-prepared draft, add internal ops notes, and send a verified response that appears on your dashboard in real time.",
  },
];

export default function HomePage() {
  const [sessionUser, setSessionUser] = useState(null);

  useEffect(() => {
    const u = getStoredUser();
    const t = getStoredToken();
    if (u && t) {
      setSessionUser(u);
    }
  }, []);

  const portalHref = sessionUser
    ? sessionUser.role === "admin"
      ? "/admin"
      : "/author"
    : "/login";

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#222222] overflow-x-hidden">
      {/* Top Header with <BookLeafLogo /> and strictly 2 Links: Home & Login */}
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <BookLeafLogo href="/" />

          <nav className="flex items-center gap-1.5 sm:gap-5 text-xs sm:text-sm font-medium shrink-0">
            <Link
              href="/"
              className="relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-[#EC6568] font-semibold bg-[#FFF0F1]/70 hover:bg-[#FFF0F1] transition-all duration-200 after:content-[''] after:absolute after:left-3 sm:after:left-3.5 after:right-3 sm:after:right-3.5 after:bottom-1 after:h-[2px] after:rounded-full after:bg-[#EC6568] after:transition-all after:duration-300"
            >
              Home
            </Link>
            <Link
              href="/login"
              className="relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-neutral-600 hover:text-[#EC6568] hover:bg-[#FFF0F1]/60 transition-all duration-200 after:content-[''] after:absolute after:left-1/2 after:right-1/2 hover:after:left-3 sm:hover:after:left-3.5 hover:after:right-3 sm:hover:after:right-3.5 after:bottom-1 after:h-[2px] after:rounded-full after:bg-[#EC6568] after:transition-all after:duration-300"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section (Warm Blush-Pink Wave Style) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#FFF5F6] to-[#FCE8EA]/70 py-10 sm:py-16 lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-16 h-[480px] w-[480px] rounded-full bg-[#FCE8EA]/80 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 bottom-0 h-[280px] w-[380px] rounded-full bg-[#FFF5F6] blur-xl"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-center sm:text-left animate-fade-up">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#EC6568] leading-[1.15]">
              Author Support, Made Simple & Transparent
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-neutral-600 leading-relaxed max-w-xl mx-auto sm:mx-0">
              Welcome to BookLeaf Publishing&apos;s dedicated Author Support &
              Communication Portal. Track your book royalties, monitor
              production milestones, and get fast, context-aware assistance
              from our publishing team.
            </p>

            <div className="pt-1 sm:pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Link
                href={portalHref}
                className="group w-full sm:w-auto justify-center inline-flex items-center gap-2.5 rounded-full bg-[#EC6568] hover:bg-[#D95356] text-white font-medium px-7 sm:px-8 py-3.5 text-sm shadow-sm hover:-translate-y-0.5 active:scale-[0.98] hover:shadow-[0_12px_28px_-6px_rgba(236,101,104,0.5)] transition-all duration-300"
              >
                <span>
                  {sessionUser
                    ? `Go to Your Dashboard (${sessionUser.name})`
                    : "Login to Support Portal"}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </Link>
            </div>
          </div>

          {/* Right Preview Card with Floating Animation & Interactive Sub-Cards */}
          <div className="lg:col-span-5 animate-fade-up delay-100">
            <div className="animate-float bg-white rounded-3xl border border-[#F5D8DA] shadow-xl shadow-[#EC6568]/10 hover:shadow-2xl hover:shadow-[#EC6568]/15 transition-shadow duration-500 p-5 sm:p-7 space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-[#FDE8E9] flex items-center justify-center text-[#EC6568] transition-transform duration-300 hover:scale-110">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#222222]">
                      Two Connected Workspaces
                    </p>
                    <p className="text-xs text-neutral-500">
                      Built for Authors & BookLeaf Support
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <Link
                  href={portalHref}
                  className="group block rounded-2xl bg-[#FFF5F6] hover:bg-[#FCE8EA]/70 border border-[#F5D8DA] hover:border-[#EC6568] p-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#222222] group-hover:text-[#EC6568] transition-colors text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#EC6568] transition-transform duration-300 group-hover:scale-110" />
                      <span>Author Portal</span>
                    </p>
                    <ArrowRight className="h-4 w-4 text-[#EC6568] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  <p className="text-neutral-600 mt-1.5 leading-relaxed">
                    View all your published & in-production titles, quarterly
                    royalty ledgers, store availability, and raise book-specific
                    support queries.
                  </p>
                </Link>

                <Link
                  href="/login"
                  className="group block rounded-2xl bg-neutral-50 hover:bg-[#FFF5F6] border border-neutral-200/80 hover:border-[#EC6568] p-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#222222] group-hover:text-[#EC6568] transition-colors text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#EC6568] transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                      <span>Support Operations Desk</span>
                    </p>
                    <ArrowRight className="h-4 w-4 text-[#EC6568] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  <p className="text-neutral-600 mt-1.5 leading-relaxed">
                    AI-triaged ticket queue with automatic category & priority
                    scoring, live database context, and ready-to-send policy
                    drafts.
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features 2x2 Grid with Interactive Group Cards & Morphing Icons */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 animate-fade-up">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#222222]">
              Everything You Need After Submitting Your Manuscript
            </h2>
            <p className="text-sm sm:text-base text-neutral-500 mt-2">
              Designed around BookLeaf Publishing&apos;s real author workflows,
              royalty policies, and production stages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            {FEATURES.map((feat) => {
              const IconComponent = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="group p-5 sm:p-7 rounded-3xl border border-[#F8E2E4] sm:border-transparent hover:border-[#FAD4D6] bg-[#FFFDFD] sm:bg-transparent hover:bg-[#FFF9FA]/90 hover:shadow-[0_14px_34px_rgba(236,101,104,0.09)] hover:-translate-y-1.5 transition-all duration-300 flex items-start gap-4 sm:gap-5 cursor-default"
                >
                  <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-[#FDE8E9] text-[#EC6568] group-hover:bg-[#EC6568] group-hover:text-white group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-md group-hover:shadow-[#EC6568]/25 transition-all duration-300 flex items-center justify-center shrink-0">
                    <IconComponent className="h-5 w-5 sm:h-7 sm:w-7 transition-transform duration-300" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#222222] group-hover:text-[#EC6568] transition-colors duration-200">
                      {feat.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 mt-1.5 sm:mt-2 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section with Reactive Step Cards */}
      <section className="py-12 sm:py-16 bg-[#FFF5F6] border-y border-[#F8E2E4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#222222]">
              How the Support Portal Works
            </h2>
            <p className="text-sm text-neutral-600 mt-2">
              From raising a book query to receiving a verified resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className="group bg-white rounded-3xl border border-[#F5D8DA] hover:border-[#EC6568]/70 p-5 sm:p-7 shadow-sm hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(236,101,104,0.13)] transition-all duration-300 flex flex-col justify-between cursor-default"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-[#EC6568] bg-[#FFF5F6] border border-[#F5D8DA] group-hover:bg-[#EC6568] group-hover:text-white group-hover:border-[#EC6568] transition-colors duration-300 rounded-full px-3.5 py-1">
                      {item.role}
                    </span>
                    <span className="text-2xl font-bold text-[#EC6568]/30 group-hover:text-[#EC6568] group-hover:scale-110 transition-all duration-300 origin-right">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#222222] group-hover:text-[#EC6568] transition-colors duration-200">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Warm Coral Bottom CTA Banner */}
      <section className="bg-[#EC6568] text-white py-10 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div>
            <h2 className="text-xl sm:text-3xl font-bold">
              Ready to check your books or manage support tickets?
            </h2>
            <p className="text-xs sm:text-sm text-white/90 mt-1">
              Sign in with your author account or use the 1-click demo switcher
              on the login page.
            </p>
          </div>

          <Link
            href="/login"
            className="group w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-full bg-white hover:bg-neutral-50 text-[#222222] font-semibold px-7 py-3.5 text-sm shadow-sm hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] transition-all duration-300 shrink-0"
          >
            <span>Go to Login</span>
            <ArrowRight className="h-4 w-4 text-[#EC6568] transition-transform duration-300 group-hover:translate-x-1.5" />
          </Link>
        </div>
      </section>

      {/* Clean BookLeaf Dark Footer */}
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
