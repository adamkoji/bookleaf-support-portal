# Executive Engineering Write-Up — BookLeaf Author Support Portal

## 1. What I Prioritised (And Why)

BookLeaf's core operational bottleneck is not just ticket volume—it is **context switching**. Support agents spend most of their time looking up an author's ISBN, checking whether a book is printed by Repro India or Epitome Books, verifying if pending royalties cross the ₹1,000 minimum threshold, or checking whether a book is still stuck in cover design, and then manually typing out BookLeaf's standard SLA policies.

I prioritised three architectural pillars to eliminate that friction end-to-end:

1. **Zero-Lookup Grounded AI Triage (`backend/app/ai_service.py`)**:
   - Every incoming ticket is automatically enriched with the author's live database state (`royalty_pending`, `last_royalty_payout_date`, `print_partner`, `isbn`, `status`, `available_on`) and matched against modularised BookLeaf policy rules (`KB_MODULES`) before calling `gemini-2.5-flash`.
   - The AI does not generate generic polite filler—it cites exact figures (e.g., *"Your pending balance of ₹850 for The Nagpur Notebooks is currently below the ₹1,000 minimum payout threshold..."*) and surfaces structured **Key Facts Used**, **AI Reasoning**, and **Recommended Internal Action Items** alongside the editable draft.
2. **3-Pane Admin Operations Console (`frontend/src/app/admin/page.jsx`)**:
   - Designed for high-throughput triage: a filterable Ticket Queue (by status, category, priority, date, and search), a central Conversation + AI Copilot workspace (with 1-click **"Load into Reply Composer"** and custom prompt refinement), and a collapsible Right Context Sidebar showing the author's complete book portfolio and live status/priority/category/assignee controls.
3. **Strict Role Separation & Defensive Data Hygiene**:
   - The Author Portal (`GET /api/author/tickets/{id}`) enforces a hard schema boundary (`TicketAuthorDetailOut`) so internal admin notes, AI confidence scores, and internal escalation reasoning never leak to authors.
   - Books in production (`BK013`, `BK015`) with `null` financial and publication fields are handled defensively across SQLite, Pydantic schemas, React cards, and LLM prompts so the system never renders broken `₹null` values or hallucinates release dates.

---

## 2. Trade-Offs Made Within the 4-Day Window

| Decision | Trade-Off Made | Why It Was the Right Call for This Scope |
| :--- | :--- | :--- |
| **SQLite (WAL Mode) over Managed Postgres** | Single-node file database instead of multi-node horizontal scaling. | Enables zero-config, deterministic seeding (`bookleaf_sample_data.json`) and instant evaluation while still supporting concurrent reads/writes via `PRAGMA journal_mode=WAL`. SQLAlchemy ORM makes swapping `DATABASE_URL` to PostgreSQL a 1-line change. |
| **Base64 Data URLs for Attachments** | Stored up to 5MB image/PDF uploads directly in `tickets.attachment_data` (`TEXT`) rather than S3/Cloudflare R2. | Allows real end-to-end file uploads and multimodal `gemini-2.5-flash` vision/document inspection to work immediately without requiring evaluators to configure AWS IAM keys. |
| **Inline AI Triage with Deterministic Fallback** | Ran AI triage synchronously during ticket submission/reply (~1.5s latency) rather than setting up Redis + Celery workers. | Guarantees that the moment a ticket appears in the Admin Queue, its Category, Priority, Summary, and Draft Response are already populated—and our deterministic fallback engine (`_deterministic_triage`) ensures 100% uptime even without an API key. |
| **Demo Quick-Switch over Email Magic Links / OAuth** | Used JWT bearer tokens + a 1-click Navbar Account Switcher instead of building SMTP password-reset and OAuth flows. | Lets evaluators inspect all 10 seeded author personas (`AUTH001`–`AUTH010`) and the Admin Console in seconds while still enforcing real `bcrypt` password verification and JWT middleware on every API route. |

---

## 3. Evolving This Into BookLeaf's Production Platform (Bubble + n8n Migration Path)

BookLeaf's current stack relies on **Bubble** (front-office portals) and **n8n** (workflow automation). This codebase is structured so BookLeaf can either **replace** fragile no-code bottlenecks incrementally or **plug the FastAPI AI & Data Engine directly into existing n8n/Bubble workflows**:

```
[Author / Admin Next.js UI]  <───>  [FastAPI Core + Gemini AI Engine]  <───>  [PostgreSQL (Supabase/RDS)]
                                              │                 ▲
                          Outbound Webhooks   │                 │  Inbound Sync Webhooks
                                              ▼                 │
                                       [n8n Automation Workflows]
                                     (Print Partner Emails, Razorpay/
                                      Bank Payouts, Slack Escalations,
                                      Amazon/Flipkart Scraper Sync)
```

1. **Phase 1 — Drop-In AI Triage Microservice for n8n (Week 1–2)**:
   - Expose `ai_service.py` via a dedicated webhook endpoint (`POST /api/webhooks/triage`). Existing Bubble forms or support emails can trigger an n8n workflow that calls FastAPI, receives the structured JSON classification + grounded draft + confidence score, and auto-routes `Critical` tickets (e.g., ISBN mismatches) to a `#critical-ops` Slack channel while auto-drafting replies for `Low`/`Medium` queries.
2. **Phase 2 — Automated External Partner Loops via n8n (Week 3–4)**:
   - When an Admin clicks **"Send Official Response"** on a `Printing & Quality` or `ISBN & Metadata` ticket, FastAPI emits an outbound webhook to n8n with the structured `ai_action_items` and `book.print_partner` (`Repro India` or `Epitome Books`). n8n automatically opens a reprint order or metadata correction ticket with the print partner and writes the tracking ID back to `ticket_internal_notes`.
3. **Phase 3 — Database Cutover & High-Volume Guardrails (Month 2)**:
   - Point SQLAlchemy `DATABASE_URL` to managed PostgreSQL (Supabase/Neon), offload `attachment_data` to Cloudflare R2, and introduce a confidence threshold gate: tickets with `ai_confidence >= 0.92` in deterministic categories (like standard royalty cycle inquiries) can be queued for 1-click batch approval by Ops, cutting average first-response time from hours to under 2 minutes.

