import base64
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI
from google import genai
from google.genai import types as genai_types

from app.config import settings
from app.models import User, Book

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

VALID_CATEGORIES = [
    "Royalty & Payments",
    "ISBN & Metadata Issues",
    "Printing & Quality",
    "Distribution & Availability",
    "Book Status & Production Updates",
    "General Inquiry",
]

VALID_PRIORITIES = ["Critical", "High", "Medium", "Low"]

NAIVE_FULL_CONTEXT_TOKENS = 1850

CORE_OVERVIEW_AND_TONE = """
[BOOKLEAF PUBLISHING — CORE OVERVIEW & TONE GUIDELINES]
- Company Overview: BookLeaf Publishing operates in India and the US, offering two primary publishing packages: "Standard Free" and "Bestseller Breakthrough".
- Printing Network: Primary In-House printing facility in Delhi, with overflow and specialized format partnerships with Repro India and Epitome Books.
- Core Tone Principle: "Authors are our partners, not customers to be managed." Always be empathetic, transparent, collaborative, and respectful.
- Response Rules:
  1. Acknowledge the author's concern warmly and directly in the opening sentence.
  2. Be specific: cite exact numbers, ₹ amounts, copy counts, ISBNs, dates, print partners, and statuses from the injected Author/Book database context. Never invent figures.
  3. Own BookLeaf's faults directly without corporate deflection or blaming the author.
  4. Provide clear 48-hour escalation timelines when technical/production investigation is needed.
  5. Close with a clear, actionable next step.
""".strip()

KB_MODULES: dict[str, str] = {
    "Royalty & Payments": """
[KB MODULE: ROYALTY & PAYMENTS]
- Royalty Split: 80/20 split (80% of net profit goes to the author; 20% to BookLeaf).
- Net Profit Formula: MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping/fulfillment charges.
- Payout Schedule: Calculated quarterly and disbursed within 45 days of the end of each quarter.
- Minimum Payout Threshold: ₹1,000. If total pending royalty is below ₹1,000, the balance automatically rolls over to the next quarterly cycle.
- Payment Method: Direct bank transfer (NEFT/IMPS) to the author's linked bank account in the dashboard.
- Sales Transparency: A line-by-line sales and royalty breakdown is available in the Author Dashboard.
""".strip(),
    "ISBN & Metadata Issues": """
[KB MODULE: ISBN & METADATA ISSUES]
- Imprint Policy: Every book receives a unique ISBN assigned under BookLeaf's publisher imprint (authors wishing to use their own imprint must obtain their ISBN independently prior to production).
- Escalation Rule: Any ISBN error (duplicate ISBN, wrong book linked, mismatch between Amazon listing and physical copy) is treated as a HIGH or CRITICAL priority issue and escalated to the production & metadata team immediately with a strict 48-hour resolution timeline.
- Metadata Updates: Book title/subtitle/description/category metadata updates take 3–5 business days to propagate across retail platforms after submission.
""".strip(),
    "Printing & Quality": """
[KB MODULE: PRINTING & QUALITY]
- Facilities: BookLeaf's In-House Delhi facility handles the majority of print runs; overflow or special formats are fulfilled by Repro India or Epitome Books.
- Standard Turnaround: 5–7 business days for printing and dispatch.
- Quality Defect Protocol: For any physical quality defects (misprints, blurry images/diagrams, faded ink, binding defects, misaligned or miscut pages):
  1. Apologize sincerely and own the issue without deflection.
  2. Ask the author to share clear photos of the defective copies (and order IDs if not already attached).
  3. Confirm that BookLeaf will arrange a free replacement reprint within 5–7 business days after verification.
""".strip(),
    "Distribution & Availability": """
[KB MODULE: DISTRIBUTION & AVAILABILITY]
- Retail Channels: Books are distributed across Amazon India, Flipkart, Amazon US, Amazon UK, and the BookLeaf Store.
- Launch Timeline: Newly published listings go live across all selected channels within 7–10 business days after publication.
- "Currently Unavailable" / Out-of-Stock Issues: Almost always caused by an automated inventory/stock feed sync lag between our print partner and the marketplace. Confirm that we are triggering an immediate distribution feed re-sync, which resolves within 24–48 hours.
""".strip(),
    "Book Status & Production Updates": """
[KB MODULE: BOOK STATUS & PRODUCTION UPDATES]
- Official Production Pipeline:
  Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Common Bottlenecks: Delays most frequently happen at Cover Design (awaiting concept alignment/approval) and Proofreading (revision rounds).
- Communication Rule: Always reference the book's exact current status from the database, remain honest and collaborative (never blame the author for delays), note that MRP/royalty per copy are finalized once typesetting & cover specs lock, and provide a clear 48-hour or stage-specific timeline.
""".strip(),
    "General Inquiry": """
[KB MODULE: GENERAL INQUIRY]
- Profile & Metadata Updates: Updates to book descriptions, author bios, bank details, or contact info can be submitted via the Author Dashboard or by emailing BookLeaf support, and reflect on retail platforms within 3–5 business days.
- Package & Account Support: Support covers both Standard Free and Bestseller Breakthrough packages with a 48-hour response commitment.
""".strip(),
}

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Royalty & Payments": [
        "royalty", "royalties", "payment", "payout", "paid", "pending", "earned",
        "money", "bank", "neft", "transfer", "split", "80/20", "threshold", "1000",
        "1,000", "sales", "copies sold", "amount", "₹", "rs", "inr", "commission",
        "quarter", "quarterly", "disbursement", "credit", "ledger",
    ],
    "ISBN & Metadata Issues": [
        "isbn", "barcode", "metadata", "wrong book", "mismatch", "duplicate",
        "imprint", "edition", "subtitle", "author name", "spelling", "catalog",
        "onix", "wrong listing",
    ],
    "Printing & Quality": [
        "print", "printing", "quality", "blurry", "faded", "ink", "binding",
        "defect", "defective", "misprint", "torn", "page", "pages", "cover",
        "trim", "trimming", "misaligned", "reprint", "damaged", "paper",
        "repro", "epitome", "in-house", "copy", "copies",
    ],
    "Distribution & Availability": [
        "amazon", "flipkart", "store", "unavailable", "currently unavailable",
        "out of stock", "stock", "distribution", "channel", "available",
        "availability", "live", "listing", "link", "uk", "us", "marketplace",
        "delisted", "buy button",
    ],
    "Book Status & Production Updates": [
        "status", "production", "stage", "timeline", "when will", "delay",
        "delayed", "typesetting", "cover design", "proofreading", "editing",
        "manuscript", "publish", "publication date", "progress", "mockup",
        "draft", "launch",
    ],
    "General Inquiry": [
        "bio", "description", "update", "account", "profile", "package",
        "bestseller", "standard", "contact", "phone", "email", "general",
        "question", "help", "inquiry",
    ],
}


def select_relevant_kb_modules(subject: str, description: str) -> list[str]:
    """
    Token-Conscious Context Selector:
    Scores all 6 KB modules against the ticket's subject + description and returns
    the top 2 most relevant category names.
    """
    text = f"{subject} {description}".lower()
    scores: dict[str, int] = {cat: 0 for cat in VALID_CATEGORIES}

    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                # Subject matches carry higher weight
                weight = 3 if kw in subject.lower() else 1
                scores[category] += weight

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_categories = [cat for cat, score in ranked if score > 0][:2]

    if not top_categories:
        top_categories = ["General Inquiry", "Book Status & Production Updates"]
    elif len(top_categories) == 1:
        fallback_second = "General Inquiry" if top_categories[0] != "General Inquiry" else "Book Status & Production Updates"
        top_categories.append(fallback_second)

    return top_categories


def build_compact_db_context(author: User, book: Optional[Book]) -> str:
    """
    Builds a compact, token-efficient database snapshot for the prompt:
    injects ONLY the linked Book record (or a compact summary of the author's books if book is None).
    """
    author_info = (
        f"Author: {author.name} (Code: {author.author_code or 'N/A'}, "
        f"Email: {author.email}, City: {author.city or 'N/A'}, Joined: {author.joined_date or 'N/A'})"
    )
    if book is not None:
        mrp_str = f"₹{book.mrp:.0f}" if book.mrp is not None else "Not finalized (In Production)"
        royalty_rate_str = (
            f"₹{book.author_royalty_per_copy:.0f}/copy"
            if book.author_royalty_per_copy is not None
            else "Not finalized (In Production)"
        )
        channels = ", ".join(book.available_on) if book.available_on else "None (Not yet live)"
        book_info = (
            f"Selected Book: '{book.title}' (Code: {book.book_code})\n"
            f"- ISBN: {book.isbn or 'Pending'}\n"
            f"- Genre: {book.genre or 'N/A'}\n"
            f"- Current Status: {book.status}\n"
            f"- Publication Date: {book.publication_date or 'Not yet published (In Production)'}\n"
            f"- MRP: {mrp_str} | Author Royalty Rate: {royalty_rate_str}\n"
            f"- Total Copies Sold: {book.total_copies_sold}\n"
            f"- Total Royalty Earned: ₹{book.total_royalty_earned:,.0f}\n"
            f"- Royalty Paid: ₹{book.royalty_paid:,.0f} (Last Payout Date: {book.last_royalty_payout_date or 'No payouts yet'})\n"
            f"- Royalty Pending: ₹{book.royalty_pending:,.0f}\n"
            f"- Print Partner: {book.print_partner or 'Not assigned yet'}\n"
            f"- Available Platforms: {channels}"
        )
        return f"{author_info}\n{book_info}"

    # General / Account-level ticket: compact summary of author's books
    author_books = getattr(author, "books", []) or []
    if not author_books:
        return f"{author_info}\nLinked Book: General / Account Level (No books found)"

    lines = [f"{author_info}\nLinked Book: General / Account Level. Compact summary of author's {len(author_books)} book(s):"]
    for b in author_books:
        lines.append(
            f"- {b.book_code} '{b.title}': Status={b.status}, ISBN={b.isbn}, "
            f"Sold={b.total_copies_sold}, Earned=₹{b.total_royalty_earned:,.0f}, "
            f"Paid=₹{b.royalty_paid:,.0f}, Pending=₹{b.royalty_pending:,.0f}, "
            f"LastPayout={b.last_royalty_payout_date or 'None'}, PrintPartner={b.print_partner or 'None'}"
        )
    return "\n".join(lines)


def estimate_tokens(text: str) -> int:
    """Estimates token count for selected context + completion."""
    if not text:
        return 0
    return max(1, int(len(text) / 6.5))



def resolve_llm_config() -> tuple[str, str, str, Optional[str]]:
    """
    Resolves (provider, api_key, model, base_url) from settings and environment variables.
    Supports gemini (via google-genai SDK), groq, and openai.
    """
    load_dotenv(BASE_DIR / ".env", override=True)

    raw_provider = (os.getenv("LLM_PROVIDER") or settings.LLM_PROVIDER or "gemini").strip().lower()
    api_key = (
        os.getenv("LLM_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("GROQ_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or settings.LLM_API_KEY
        or ""
    ).strip()

    # Auto-detect provider from key prefix if present
    if api_key.startswith("AIza"):
        provider = "gemini"
    elif api_key.startswith("gsk_"):
        provider = "groq"
    elif api_key.startswith("sk-"):
        provider = "openai"
    else:
        provider = raw_provider

    configured_model = (os.getenv("LLM_MODEL") or settings.LLM_MODEL or "").strip()

    if provider == "gemini":
        base_url = None
        model = (
            configured_model
            if configured_model and "gemini" in configured_model
            else "gemini-3.8-flash"
        )
    elif provider == "groq":
        base_url = "https://api.groq.com/openai/v1"
        model = configured_model or "llama-3.3-70b-versatile"
    else:
        provider = "openai"
        base_url = None
        model = (
            configured_model
            if configured_model and "gpt" in configured_model
            else "gpt-4o-mini"
        )

    return provider, api_key, model, base_url


def _extract_message_fields(m) -> tuple[str, str, str]:
    role = getattr(m, "sender_role", None) or (m.get("sender_role") if isinstance(m, dict) else "author")
    name = getattr(m, "sender_name", None) or (m.get("sender_name") if isinstance(m, dict) else role)
    msg_text = getattr(m, "message", None) or (m.get("message") if isinstance(m, dict) else str(m))
    return str(role), str(name), str(msg_text)


def build_rule_based_fallback(
    author: User,
    book: Optional[Book],
    subject: str,
    description: str,
    selected_categories: list[str],
    conversation_history: Optional[list] = None,
) -> dict:
    """
    Deterministic, context-aware fallback classifier & response generator (Requirement D.3).
    Uses exact author and book figures so responses are deeply specific even when offline,
    and adapts naturally to multi-turn follow-up messages.
    """
    latest_author_msg = ""
    has_prior_admin_reply = False
    is_followup = False

    if conversation_history and len(conversation_history) > 1:
        is_followup = True
        for m in conversation_history:
            r_role, _, r_text = _extract_message_fields(m)
            if r_role.lower() == "admin":
                has_prior_admin_reply = True
            elif r_role.lower() == "author":
                latest_author_msg = r_text.strip()

    active_query_text = latest_author_msg if (is_followup and latest_author_msg) else f"{subject} {description}"
    combined = f"{subject} {description} {latest_author_msg}".lower()
    latest_lower = active_query_text.lower().strip()
    primary_category = selected_categories[0] if selected_categories else "General Inquiry"

    # Refine category based on high-confidence signals
    if any(k in combined for k in ["isbn mismatch", "wrong isbn", "wrong book", "duplicate isbn", "onix", "metadata mismatch"]):
        primary_category = "ISBN & Metadata Issues"
    elif any(k in combined for k in ["blurry", "faded", "misprint", "defective", "binding", "torn", "print quality", "trim"]):
        primary_category = "Printing & Quality"
    elif any(k in combined for k in ["royalty", "payout", "pending", "neft", "payment", "80/20", "threshold", "1,000"]):
        primary_category = "Royalty & Payments"
    elif any(k in combined for k in ["currently unavailable", "unavailable", "out of stock", "not showing on amazon"]):
        primary_category = "Distribution & Availability"
    elif any(k in combined for k in ["in production", "cover design", "typesetting", "proofreading", "when will my book", "publication date", "mockup"]):
        primary_category = "Book Status & Production Updates"

    # Determine Priority
    if primary_category == "ISBN & Metadata Issues" and any(w in combined for w in ["wrong", "mismatch", "duplicate", "urgent", "error"]):
        priority = "Critical" if "urgent" in combined or "duplicate" in combined else "High"
    elif primary_category == "Printing & Quality" and any(w in combined for w in ["blurry", "defect", "defective", "misprint", "faded", "damaged", "torn"]):
        priority = "Critical" if any(w in combined for w in ["batch", "readers", "customers", "urgent", "multiple"]) else "High"
    elif primary_category == "Royalty & Payments":
        has_high_pending = (book and (book.royalty_pending or 0) >= 1000) or any(
            (b.royalty_pending or 0) >= 1000 for b in (getattr(author, "books", []) or [])
        )
        priority = "High" if has_high_pending or "overdue" in combined or "pending" in combined else "Medium"
    elif primary_category == "Distribution & Availability":
        priority = "High" if "unavailable" in combined or "out of stock" in combined else "Medium"
    elif primary_category == "Book Status & Production Updates":
        priority = "Medium"
    else:
        priority = "Low" if primary_category == "General Inquiry" else "Medium"

    # Reference book or first book if available
    target_book = book
    if target_book is None:
        author_books = getattr(author, "books", []) or []
        for b in author_books:
            if b.title.lower() in combined or b.book_code.lower() in combined:
                target_book = b
                break
        if target_book is None and author_books:
            target_book = author_books[0]

    first_name = author.name.split()[0] if author.name else "Author"

    # Multi-turn / Casual Follow-up Handling in Fallback Mode
    if is_followup and latest_author_msg:
        book_ref = f"*{target_book.title}* ({target_book.book_code})" if target_book else "your book"
        # Check if casual greeting, check-in, or "how is my book"
        if any(p in latest_lower for p in ["how is my book", "is it good", "doing well", "how is it doing", "sales going"]):
            if target_book and (target_book.total_copies_sold or 0) > 0:
                draft = (
                    f"Hi {first_name},\n\n"
                    f"{book_ref} is doing wonderfully! It has sold **{target_book.total_copies_sold} copies** across "
                    f"{', '.join(target_book.available_on) if target_book.available_on else 'our retail channels'} so far, "
                    f"generating **₹{target_book.total_royalty_earned:,.0f}** in total royalties.\n\n"
                    f"We are really proud to have {book_ref} in the BookLeaf catalog. Let me know if there is anything else I can help you with!\n\n"
                    f"Warm regards,\n"
                    f"BookLeaf Author Support Team"
                )
            else:
                status_label = target_book.status if target_book else "in production"
                draft = (
                    f"Hi {first_name},\n\n"
                    f"{book_ref} is progressing well and is currently at the **{status_label}** stage! "
                    f"Our team is excited about the title and will keep you posted as the next milestone is ready.\n\n"
                    f"Please let me know if you have any specific questions or feedback!\n\n"
                    f"Warm regards,\n"
                    f"BookLeaf Author Support Team"
                )
            return {
                "category": primary_category,
                "priority": priority,
                "reasoning": f"Multi-turn follow-up response to author's check-in ('{latest_author_msg[:60]}'), sharing a warm, concise update on {book_ref}.",
                "draft_response": draft,
            }

        if len(latest_lower) <= 35 and any(g in latest_lower for g in ["hi", "hii", "hello", "hey", "how are you", "thanks", "thank you", "ok", "okay"]):
            draft = (
                f"Hi {first_name},\n\n"
                f"I'm doing well, thank you for asking! Everything on your ticket regarding {book_ref} is on track on our end.\n\n"
                f"Please let me know if you have any additional questions or if there is anything else I can assist you with today!\n\n"
                f"Warm regards,\n"
                f"BookLeaf Author Support Team"
            )
            return {
                "category": primary_category,
                "priority": "Low",
                "reasoning": f"Conversational multi-turn reply to the author's brief message ('{latest_author_msg}') without repeating the full ledger summary.",
                "draft_response": draft,
            }

        if has_prior_admin_reply:
            draft = (
                f"Hi {first_name},\n\n"
                f"Thank you for your follow-up regarding {book_ref}. I have noted your message:\n"
                f"> *\"{latest_author_msg}\"*\n\n"
                f"Our team is actively tracking this under your ticket and will ensure any updates on {book_ref} "
                f"(Current Status: **{target_book.status if target_book else 'Active'}**) are completed within our **48-hour** support window.\n\n"
                f"Please let me know if you need anything else in the meantime!\n\n"
                f"Warm regards,\n"
                f"BookLeaf Author Support Team"
            )
            return {
                "category": primary_category,
                "priority": priority,
                "reasoning": f"Multi-turn follow-up draft addressing the author's latest reply ('{latest_author_msg[:80]}') without repeating previous support messages.",
                "draft_response": draft,
            }

    if primary_category == "Royalty & Payments":
        if target_book:
            pending = target_book.royalty_pending or 0
            earned = target_book.total_royalty_earned or 0
            paid = target_book.royalty_paid or 0
            sold = target_book.total_copies_sold or 0
            rate = target_book.author_royalty_per_copy
            rate_str = f"₹{rate:.0f}/copy" if rate is not None else "standard 80/20 net profit split"
            last_payout = target_book.last_royalty_payout_date or "no prior payout recorded yet"

            if pending >= 1000:
                threshold_note = (
                    f"Because your pending balance of **₹{pending:,.0f}** exceeds our **₹1,000 minimum payout threshold**, "
                    f"it is fully eligible for disbursement in the current quarterly cycle (paid within 45 days of quarter end "
                    f"via bank transfer to your linked account)."
                )
            else:
                threshold_note = (
                    f"Per BookLeaf's royalty policy (80/20 net profit split, calculated quarterly), the minimum payout threshold "
                    f"is **₹1,000**. Since the current pending balance on this title is **₹{pending:,.0f}**, it will roll over "
                    f"until your cumulative pending royalty reaches ₹1,000."
                )

            draft = (
                f"Dear {first_name},\n\n"
                f"Thank you for reaching out regarding your royalties for *{target_book.title}* ({target_book.book_code}). "
                f"I have reviewed your royalty ledger in our system and confirmed the exact figures for your book:\n\n"
                f"- **Total Copies Sold:** {sold} copies (at {rate_str})\n"
                f"- **Total Royalty Earned:** ₹{earned:,.0f}\n"
                f"- **Royalty Paid to Date:** ₹{paid:,.0f} (Last payout date: {last_payout})\n"
                f"- **Current Pending Royalty:** ₹{pending:,.0f}\n\n"
                f"{threshold_note}\n\n"
                f"I have flagged your account with our Finance team to confirm the exact transfer schedule within **48 hours**. "
                f"You can also view the line-by-line sales breakdown anytime in your Author Dashboard. Please let me know if you have any questions!\n\n"
                f"Warm regards,\n"
                f"BookLeaf Author Support Team"
            )
            reasoning = (
                f"Classified under 'Royalty & Payments' ({priority} priority). Referenced exact DB ledger for {target_book.book_code} "
                f"({sold} sold, ₹{earned:,.0f} earned, ₹{paid:,.0f} paid, ₹{pending:,.0f} pending, last payout {last_payout}) "
                f"and applied BookLeaf's 80/20 split, ₹1,000 threshold, and 45-day quarterly payout rules."
            )
        else:
            author_books = getattr(author, "books", []) or []
            total_earned = sum((b.total_royalty_earned or 0) for b in author_books)
            total_paid = sum((b.royalty_paid or 0) for b in author_books)
            total_pending = sum((b.royalty_pending or 0) for b in author_books)
            draft = (
                f"Dear {first_name},\n\n"
                f"Thank you for contacting us regarding your royalty account ({author.author_code}). "
                f"Across your {len(author_books)} published title(s) with BookLeaf, here is your current cumulative royalty summary:\n\n"
                f"- **Total Royalty Earned:** ₹{total_earned:,.0f}\n"
                f"- **Total Royalty Paid:** ₹{total_paid:,.0f}\n"
                f"- **Total Royalty Pending:** ₹{total_pending:,.0f}\n\n"
                f"Under BookLeaf's 80/20 royalty split, royalties are calculated quarterly and paid within 45 days of quarter end "
                f"via bank transfer once your pending balance meets the **₹1,000 minimum threshold**. "
                f"Our finance team will verify your next payout batch and follow up within **48 hours**.\n\n"
                f"Warm regards,\n"
                f"BookLeaf Author Support Team"
            )
            reasoning = (
                f"Classified under 'Royalty & Payments' ({priority} priority) for account-level royalty inquiry. "
                f"Injected cumulative author earnings (₹{total_earned:,.0f} earned, ₹{total_pending:,.0f} pending)."
            )

    elif primary_category == "ISBN & Metadata Issues":
        book_label = f"*{target_book.title}* ({target_book.book_code}, Official ISBN: `{target_book.isbn}`)" if target_book else "your book"
        channels_str = ", ".join(target_book.available_on) if (target_book and target_book.available_on) else "Amazon India, Flipkart, and BookLeaf Store"
        draft = (
            f"Dear {first_name},\n\n"
            f"Thank you for alerting us to this ISBN/metadata issue for {book_label}. We take listing accuracy very seriously "
            f"and sincerely apologize for the inconvenience this mismatch has caused.\n\n"
            f"At BookLeaf, any ISBN or catalog mapping discrepancy is treated as a **{priority} Priority** issue. "
            f"I have escalated your ticket directly to our Production & Distribution Metadata team to:\n"
            f"1. Verify the canonical BookLeaf imprint ISBN (`{target_book.isbn if target_book else 'assigned ISBN'}`) against our master ONIX feed.\n"
            f"2. Push an immediate metadata correction across {channels_str}.\n\n"
            f"Our production team will complete the investigation and confirm the fix within **48 hours** (marketplace frontends typically reflect metadata refreshes within 3–5 business days). "
            f"We will keep you updated right here in this ticket.\n\n"
            f"Warm regards,\n"
            f"BookLeaf Production & Metadata Support"
        )
        reasoning = (
            f"Classified as 'ISBN & Metadata Issues' with '{priority}' priority per KB rules (all ISBN errors require immediate "
            f"production escalation with a 48-hour resolution window and 3–5 business day metadata sync)."
        )

    elif primary_category == "Printing & Quality":
        partner = (target_book.print_partner if target_book and target_book.print_partner else "In-House Delhi facility")
        book_label = f"*{target_book.title}* ({target_book.book_code})" if target_book else "your book"
        draft = (
            f"Dear {first_name},\n\n"
            f"I am truly sorry to hear about the print quality issue on copies of {book_label}. "
            f"As your publishing partner, we take full ownership of print defects—this is not the standard we hold for your work.\n\n"
            f"According to our records, {book_label} is fulfilled through our **{partner}** print partner. Here is how we will resolve this immediately:\n"
            f"1. **Quality Audit (Within 48 Hours):** I have escalated this ticket to our Print QA team to inspect the print-ready interior/cover files and press calibration with {partner}.\n"
            f"2. **Free Replacement Reprint (5–7 Business Days):** BookLeaf will arrange a complimentary reprint of all defective copies within **5–7 business days** of verification.\n\n"
            f"If you haven't already, please reply with clear photos of the defective pages/binding and the affected order IDs so we can dispatch the free replacements right away.\n\n"
            f"Warm regards,\n"
            f"BookLeaf Print Quality & Support Team"
        )
        reasoning = (
            f"Classified as 'Printing & Quality' with '{priority}' priority. Identified print partner ({partner}), "
            f"took direct ownership of the defect, requested verification photos, and committed to a free reprint in 5–7 business days."
        )

    elif primary_category == "Distribution & Availability":
        book_label = f"*{target_book.title}* ({target_book.book_code}, ISBN: `{target_book.isbn}`)" if target_book else "your book"
        channels_str = ", ".join(target_book.available_on) if (target_book and target_book.available_on) else "Amazon India, Flipkart, and BookLeaf Store"
        status_str = target_book.status if target_book else "Published & Live"
        draft = (
            f"Dear {first_name},\n\n"
            f"Thank you for reaching out about the marketplace availability of {book_label}.\n\n"
            f"I checked our distribution records and confirmed that your book status is **{status_str}** and is registered across: **{channels_str}** "
            f"(printed via **{target_book.print_partner if target_book and target_book.print_partner else 'In-House'}**).\n\n"
            f"When a live title temporarily displays as *'Currently Unavailable'* or out of stock on Amazon or Flipkart, it is typically caused by an automated inventory feed sync lag. "
            f"We have triggered a manual **distribution stock re-sync** with our fulfillment team today, which resolves marketplace availability within **24–48 hours** "
            f"(note: brand-new marketplace listings take 7–10 business days after publication to go live).\n\n"
            f"We will verify the live store links in 24–48 hours and confirm back with you here.\n\n"
            f"Warm regards,\n"
            f"BookLeaf Distribution Support Team"
        )
        reasoning = (
            f"Classified as 'Distribution & Availability' ({priority} priority). Checked current book status ({status_str}) "
            f"and active channels ({channels_str}), and triggered a 24–48 hour inventory feed re-sync per KB guidelines."
        )

    elif primary_category == "Book Status & Production Updates":
        if target_book:
            status_str = target_book.status
            isbn_str = target_book.isbn or "Pending Assignment"
            pub_str = target_book.publication_date or "To be finalized upon production completion"
            mrp_str = f"₹{target_book.mrp:.0f}" if target_book.mrp is not None else "Pending (locked after typesetting & cover approval)"
        else:
            status_str = "In Production"
            isbn_str = "Assigned in dashboard"
            pub_str = "Pending completion"
            mrp_str = "Pending finalization"

        book_label = f"*{target_book.title}* ({target_book.book_code})" if target_book else "your book"
        draft = (
            f"Dear {first_name},\n\n"
            f"Thank you for checking in on the production progress of {book_label}! We are excited to help bring your book to readers.\n\n"
            f"Here is the live status from our production system:\n"
            f"- **Current Pipeline Stage:** {status_str}\n"
            f"- **Assigned ISBN:** `{isbn_str}`\n"
            f"- **MRP & Royalty Rate:** {mrp_str}\n"
            f"- **Target Publication Date:** {pub_str}\n\n"
            f"For context, BookLeaf's production pipeline follows: *Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live*.\n\n"
            f"I have requested a specific milestone check from our production coordinator and will share your exact next deliverable date within **48 hours**.\n\n"
            f"Warm regards,\n"
            f"BookLeaf Production Support Team"
        )
        reasoning = (
            f"Classified as 'Book Status & Production Updates' ({priority} priority). Referenced exact production status "
            f"('{status_str}'), ISBN ({isbn_str}), and BookLeaf's 9-stage production pipeline with a 48-hour coordinator update."
        )

    else:
        book_label = f" regarding *{target_book.title}* ({target_book.book_code})" if target_book else ""
        draft = (
            f"Dear {first_name},\n\n"
            f"Thank you for contacting BookLeaf Author Support{book_label}. We appreciate having you as a publishing partner!\n\n"
            f"I have reviewed your request under your author profile (**{author.author_code or author.email}**). "
            f"Please note that any book description, author bio, or metadata updates submitted through support or your Author Dashboard "
            f"are processed immediately by our team and reflect across retail platforms (Amazon, Flipkart, BookLeaf Store) within **3–5 business days**.\n\n"
            f"If your request requires any custom changes from our operations team, we will complete them and confirm back within **48 hours**. "
            f"Please reply with any specific text or details you would like us to apply!\n\n"
            f"Warm regards,\n"
            f"BookLeaf Author Support Team"
        )
        reasoning = (
            f"Classified as 'General Inquiry' ({priority} priority). Addressed author's request using BookLeaf KB guidelines "
            f"(3–5 business days for metadata/bio updates and 48-hour support commitment)."
        )

    return {
        "category": primary_category,
        "priority": priority,
        "reasoning": reasoning,
        "draft_response": draft,
    }


def _parse_attachment_data_url(attachment_data: Optional[str]) -> tuple[Optional[str], Optional[bytes]]:
    """
    Parses a base64 data URL like 'data:image/png;base64,iVBOR...' into (mime_type, raw_bytes).
    Returns (None, None) if not a valid data URL.
    """
    if not attachment_data or not isinstance(attachment_data, str):
        return None, None
    s = attachment_data.strip()
    if not s.startswith("data:") or ";base64," not in s:
        return None, None
    try:
        header, b64_payload = s.split(";base64,", 1)
        mime_type = header.replace("data:", "", 1).strip() or "application/octet-stream"
        raw_bytes = base64.b64decode(b64_payload)
        return mime_type, raw_bytes
    except Exception:
        return None, None


def _print_ai_telemetry(
    *,
    trigger_label: str,
    author: User,
    book: Optional[Book],
    subject: str,
    latest_message: str,
    turn_count: int,
    selected_modules: list[str],
    provider: str,
    model: str,
    provider_status: str,
    fallback_reason: Optional[str],
    latency_sec: float,
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    total_tokens: int,
    category: str,
    priority: str,
    reasoning: str,
    draft_response: str,
    attachment_name: Optional[str] = None,
    attachment_mime: Optional[str] = None,
    multimodal_analyzed: bool = False,
) -> None:
    latency_ms = latency_sec * 1000.0
    savings_pct = max(
        0,
        round(((NAIVE_FULL_CONTEXT_TOKENS - total_tokens) / NAIVE_FULL_CONTEXT_TOKENS) * 100),
    )
    book_str = f"{book.title} ({book.book_code}, Status: {book.status})" if book else "General / Account Level"
    tok_detail = (
        f"in={input_tokens}, out={output_tokens}, total={total_tokens}"
        if (input_tokens is not None and output_tokens is not None)
        else f"total={total_tokens}"
    )
    provider_line = (
        f"LIVE LLM ({provider.upper()} / {model})"
        if provider_status == "success"
        else f"FALLBACK ENGINE (Reason: {fallback_reason or 'Offline / Force Fallback'})"
    )
    if attachment_name:
        if multimodal_analyzed:
            attach_line = f"{attachment_name} ({attachment_mime or 'file'}) -> MULTIMODAL GEMINI VISION/FILE ANALYZED"
        else:
            attach_line = f"{attachment_name} ({attachment_mime or 'metadata only'})"
    else:
        attach_line = "None"
    divider = "=" * 88
    block = (
        f"\n{divider}\n"
        f"🤖 [BOOKLEAF AI TRIAGE & DRAFT TELEMETRY] — {trigger_label}\n"
        f"{divider}\n"
        f"• Author Context   : {author.name} ({author.author_code or author.email})\n"
        f"• Book Context     : {book_str}\n"
        f"• Ticket Subject   : {subject}\n"
        f"• Attachment       : {attach_line}\n"
        f"• Conversation Turn: Turn #{turn_count} | Answering: \"{latest_message[:140]}\"\n"
        f"• Selected KB (2/6): {', '.join(selected_modules)}\n"
        f"• AI Engine Mode   : {provider_line}\n"
        f"• Execution Time   : {latency_ms:.1f} ms ({latency_sec:.2f}s)\n"
        f"• Token Usage      : {tok_detail} (Baseline: {NAIVE_FULL_CONTEXT_TOKENS} | ~{savings_pct}% saved)\n"
        f"• Classification   : Category='{category}' | Priority='{priority}'\n"
        f"• AI Reasoning     : {reasoning}\n"
        f"• Generated Draft  :\n"
        f"----------------------------------------------------------------------------------------\n"
        f"{draft_response}\n"
        f"{divider}\n"
    )
    try:
        print(block, flush=True)
    except Exception:
        print(block.encode("ascii", errors="replace").decode("ascii"), flush=True)


def analyze_and_draft_ticket(
    author: User,
    book: Optional[Book],
    subject: str,
    description: str,
    conversation_history: Optional[list] = None,
    force_fallback: bool = False,
    attachment_name: Optional[str] = None,
    attachment_data: Optional[str] = None,
) -> dict:
    """
    Context-Aware AI Triage & Response Draft Engine:
    1. Selects only the top 2 relevant KB modules + Core Overview & Tone (token efficiency).
    2. Injects only the linked Book record (or compact summary if General).
    3. Includes recent conversation messages and highlights the latest author follow-up message.
    4. Calls the configured LLM provider (Gemini / Groq / OpenAI) with an 8s timeout.
    5. Gracefully falls back to the deterministic context-aware engine if no key is set,
       force_fallback=True, or the LLM API errors/times out.
    """
    start_perf = time.perf_counter()
    latest_author_message = ""
    has_admin_replied = False
    is_followup = False
    turn_count = len(conversation_history) if conversation_history else 1

    history_snippet = ""
    if conversation_history:
        recent_msgs = conversation_history[-4:]
        if len(conversation_history) > 1:
            is_followup = True
        formatted_msgs = []
        for m in recent_msgs:
            role, name, msg_text = _extract_message_fields(m)
            if role.lower() == "admin":
                has_admin_replied = True
            elif role.lower() == "author":
                latest_author_message = msg_text.strip()
            formatted_msgs.append(f"[{role.upper()} - {name}]: {msg_text}")
        history_snippet = "\n[RECENT CONVERSATION HISTORY]\n" + "\n".join(formatted_msgs)

    active_message_display = latest_author_message if (is_followup and latest_author_message) else description
    trigger_label = (
        f"Multi-Turn Follow-Up Reply (Turn #{turn_count})"
        if is_followup
        else "Initial Ticket Triage (Turn #1)"
    )

    kb_search_description = (
        f"{description}\n{latest_author_message}" if is_followup and latest_author_message else description
    )
    selected_categories = select_relevant_kb_modules(subject, kb_search_description)
    selected_kb_text = "\n\n".join(KB_MODULES[cat] for cat in selected_categories)
    db_context = build_compact_db_context(author, book)

    multi_turn_instruction = (
        "\n[MULTI-TURN CONVERSATION & FOLLOW-UP RULES]\n"
        "- If `RECENT CONVERSATION HISTORY` shows an ongoing thread where Support (ADMIN) has already replied, "
        "DO NOT repeat the exact same opening greeting or re-dump the entire book financial summary if it was already shared in a previous message.\n"
        "- Respond directly, naturally, and specifically to the author's LATEST message in the conversation while staying consistent with BookLeaf policies and database figures.\n"
        "- If the author sends a casual greeting or brief check-in (e.g., 'hii', 'how are you?', 'how is my book? is it good?'), "
        "keep the reply warm, conversational, encouraging, and concise rather than dumping a giant wall of numbers unless relevant."
    )

    system_prompt = (
        f"{CORE_OVERVIEW_AND_TONE}\n"
        f"{multi_turn_instruction}\n\n"
        f"[SELECTED KNOWLEDGE BASE MODULES (TOP 2 RELEVANT)]\n{selected_kb_text}\n\n"
        "You are an expert AI Triage & Draft Assistant for BookLeaf Publishing's Support Team.\n"
        "Analyze the ticket conversation and the injected database record, then return ONLY a valid JSON object with these exact keys:\n"
        f'- "category": Must be strictly one of {json.dumps(VALID_CATEGORIES)}\n'
        f'- "priority": Must be strictly one of {json.dumps(VALID_PRIORITIES)}\n'
        '- "reasoning": 1-2 concise sentences explaining why this category and priority were chosen and how the draft addresses the latest author message.\n'
        '- "draft_response": A warm, empathetic, ready-to-send response to the author tailored to their LATEST message in the thread.'
    )

    attachment_mime, attachment_bytes = _parse_attachment_data_url(attachment_data)
    attachment_prompt_note = ""
    if attachment_name:
        attachment_prompt_note = (
            f"\n[ATTACHED FILE CONTEXT]\n"
            f"The author attached a file (`{attachment_name}`"
            f"{f', MIME: {attachment_mime}' if attachment_mime else ''}). "
            f"Inspect the attached image/file carefully and acknowledge what you see in your `reasoning` and `draft_response`!\n"
        )
        # If it is a plain text file, also decode a snippet so text-only fallbacks can see it
        if attachment_bytes and attachment_mime and attachment_mime.startswith("text/"):
            try:
                text_preview = attachment_bytes.decode("utf-8", errors="replace")[:2000]
                attachment_prompt_note += f"Attached Text File Preview:\n{text_preview}\n"
            except Exception:
                pass

    if is_followup and latest_author_message:
        user_prompt = (
            f"[AUTHOR & BOOK DATABASE CONTEXT]\n{db_context}\n\n"
            f"[ORIGINAL TICKET]\nSubject: {subject}\nInitial Description: {description}\n"
            f"{attachment_prompt_note}"
            f"{history_snippet}\n\n"
            f"[LATEST AUTHOR FOLLOW-UP MESSAGE — RESPOND DIRECTLY TO THIS]\n"
            f"\"{latest_author_message}\"\n"
            f"(Note: Support has {'already replied previously in this thread' if has_admin_replied else 'not replied yet'}. "
            "Draft the next Support response addressing the author's latest message above directly and naturally.)\n\n"
            "Respond strictly with valid JSON."
        )
    else:
        user_prompt = (
            f"[AUTHOR & BOOK DATABASE CONTEXT]\n{db_context}\n"
            f"{history_snippet}\n\n"
            f"[INCOMING SUPPORT TICKET]\n"
            f"Subject: {subject}\n"
            f"Description: {description}\n"
            f"{attachment_prompt_note}\n"
            "Respond strictly with valid JSON."
        )

    estimated_prompt_tokens = estimate_tokens(system_prompt + "\n" + user_prompt)
    provider, api_key, model, base_url = resolve_llm_config()
    fallback_reason = None
    multimodal_analyzed = False

    if force_fallback:
        fallback_reason = "force_fallback=True requested (Simulated AI Outage)"
    elif not api_key:
        fallback_reason = "No LLM_API_KEY configured in environment"

    if not force_fallback and api_key:
        try:
            raw_content = ""
            usage_tokens = None
            in_tok = None
            out_tok = None

            if provider == "gemini":
                gemini_client = genai.Client(api_key=api_key)
                combined_prompt = f"{system_prompt}\n\n{user_prompt}"

                # When a binary/image/PDF attachment is present, pass it as a multimodal Part first
                if attachment_bytes and attachment_mime and (
                    attachment_mime.startswith("image/")
                    or attachment_mime == "application/pdf"
                    or attachment_mime.startswith("text/")
                ):
                    try:
                        file_part = genai_types.Part.from_bytes(
                            data=attachment_bytes,
                            mime_type=attachment_mime,
                        )
                        gen_resp = gemini_client.models.generate_content(
                            model=model,
                            contents=[file_part, combined_prompt],
                        )
                        raw_content = getattr(gen_resp, "text", "") or ""
                        if raw_content:
                            multimodal_analyzed = True
                        usage_meta = getattr(gen_resp, "usage_metadata", None)
                        if usage_meta:
                            in_tok = getattr(usage_meta, "prompt_token_count", None)
                            out_tok = getattr(usage_meta, "candidates_token_count", None)
                            usage_tokens = getattr(usage_meta, "total_token_count", None)
                    except Exception:
                        raw_content = ""

                if not raw_content:
                    try:
                        interaction = gemini_client.interactions.create(
                            model=model,
                            input=combined_prompt,
                        )
                        raw_content = getattr(interaction, "output_text", None) or ""
                        if not raw_content and getattr(interaction, "outputs", None):
                            for out_item in reversed(interaction.outputs):
                                txt = getattr(out_item, "text", None)
                                if txt:
                                    raw_content = txt
                                    break
                        usage_obj = getattr(interaction, "usage", None)
                        if usage_obj:
                            in_tok = getattr(usage_obj, "total_input_tokens", None)
                            out_tok = getattr(usage_obj, "total_output_tokens", None)
                            if in_tok is not None and out_tok is not None:
                                usage_tokens = int(in_tok) + int(out_tok)
                            else:
                                usage_tokens = (
                                    getattr(usage_obj, "total_tokens", None)
                                    or getattr(usage_obj, "total_token_count", None)
                                )
                    except Exception:
                        gen_resp = gemini_client.models.generate_content(
                            model=model,
                            contents=combined_prompt,
                        )
                        raw_content = getattr(gen_resp, "text", "") or ""
                        usage_meta = getattr(gen_resp, "usage_metadata", None)
                        if usage_meta:
                            in_tok = getattr(usage_meta, "prompt_token_count", None)
                            out_tok = getattr(usage_meta, "candidates_token_count", None)
                            usage_tokens = getattr(usage_meta, "total_token_count", None)
            else:
                client_kwargs = {"api_key": api_key, "timeout": 8.0}
                if base_url:
                    client_kwargs["base_url"] = base_url
                client = OpenAI(**client_kwargs)

                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    response_format={"type": "json_object"},
                )
                raw_content = response.choices[0].message.content or "{}"
                if response.usage:
                    in_tok = getattr(response.usage, "prompt_tokens", None)
                    out_tok = getattr(response.usage, "completion_tokens", None)
                    usage_tokens = getattr(response.usage, "total_tokens", None)

            # Strip markdown code fences or surrounding prose if any model includes them
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content.strip(), flags=re.IGNORECASE)
            if not cleaned.startswith("{"):
                match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
                if match:
                    cleaned = match.group(0)
            parsed = json.loads(cleaned)

            category = parsed.get("category")
            if category not in VALID_CATEGORIES:
                category = selected_categories[0]

            priority = parsed.get("priority")
            if priority not in VALID_PRIORITIES:
                priority = "Medium"

            draft_response = (parsed.get("draft_response") or "").strip()
            reasoning = (parsed.get("reasoning") or "").strip()

            if draft_response:
                tokens_used = int(usage_tokens) if usage_tokens else (estimated_prompt_tokens + estimate_tokens(raw_content))
                final_reasoning = reasoning or f"Classified via {provider.upper()} ({model}) using top-2 KB modules ({', '.join(selected_categories)})."
                latency_sec = time.perf_counter() - start_perf
                _print_ai_telemetry(
                    trigger_label=trigger_label,
                    author=author,
                    book=book,
                    subject=subject,
                    latest_message=active_message_display,
                    turn_count=turn_count,
                    selected_modules=selected_categories,
                    provider=provider,
                    model=model,
                    provider_status="success",
                    fallback_reason=None,
                    latency_sec=latency_sec,
                    input_tokens=in_tok,
                    output_tokens=out_tok,
                    total_tokens=tokens_used,
                    category=category,
                    priority=priority,
                    reasoning=final_reasoning,
                    draft_response=draft_response,
                    attachment_name=attachment_name,
                    attachment_mime=attachment_mime,
                    multimodal_analyzed=multimodal_analyzed,
                )
                return {
                    "category": category,
                    "priority": priority,
                    "ai_draft_response": draft_response,
                    "ai_reasoning": final_reasoning,
                    "ai_tokens_used": tokens_used,
                    "ai_provider_status": "success",
                    "selected_kb_modules": selected_categories,
                    "naive_full_context_tokens": NAIVE_FULL_CONTEXT_TOKENS,
                    "tokens_saved": max(0, NAIVE_FULL_CONTEXT_TOKENS - tokens_used),
                }
        except Exception as exc:
            # Graceful Degradation (Requirement D.3): never crash on LLM failure/rate-limit/timeout
            fallback_reason = f"{type(exc).__name__}: {str(exc)[:120]}"

    fallback_result = build_rule_based_fallback(
        author=author,
        book=book,
        subject=subject,
        description=description,
        selected_categories=selected_categories,
        conversation_history=conversation_history,
    )
    out_est = estimate_tokens(fallback_result["draft_response"])
    tokens_used = estimated_prompt_tokens + out_est
    latency_sec = time.perf_counter() - start_perf
    _print_ai_telemetry(
        trigger_label=trigger_label,
        author=author,
        book=book,
        subject=subject,
        latest_message=active_message_display,
        turn_count=turn_count,
        selected_modules=selected_categories,
        provider=provider,
        model=model,
        provider_status="fallback",
        fallback_reason=fallback_reason,
        latency_sec=latency_sec,
        input_tokens=estimated_prompt_tokens,
        output_tokens=out_est,
        total_tokens=tokens_used,
        category=fallback_result["category"],
        priority=fallback_result["priority"],
        reasoning=fallback_result["reasoning"],
        draft_response=fallback_result["draft_response"],
        attachment_name=attachment_name,
        attachment_mime=attachment_mime,
        multimodal_analyzed=False,
    )
    return {
        "category": fallback_result["category"],
        "priority": fallback_result["priority"],
        "ai_draft_response": fallback_result["draft_response"],
        "ai_reasoning": fallback_result["reasoning"],
        "ai_tokens_used": tokens_used,
        "ai_provider_status": "fallback",
        "selected_kb_modules": selected_categories,
        "naive_full_context_tokens": NAIVE_FULL_CONTEXT_TOKENS,
        "tokens_saved": max(0, NAIVE_FULL_CONTEXT_TOKENS - tokens_used),
    }
