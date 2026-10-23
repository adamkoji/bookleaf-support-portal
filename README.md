# BookLeaf Publishing — Author Support & Communication Portal

A full-stack Author Support & Operations Portal built for **BookLeaf Publishing**. It connects two role-separated views—an **Author Self-Service Portal** and an **Internal Admin AI Triage & Operations Console**—on top of a shared FastAPI + SQLite WAL backend and a two-stage `gemini-3.1-flash-lite-preview` / `gemini-2.5-flash` multimodal AI triage pipeline.

---

## Live Demo Links

- **Live Web Application (Author & Admin Portals)**: `[Live URL Placeholder]`
- **Interactive OpenAPI 3.0 / Swagger Spec**: `[Backend URL Placeholder]/docs`
- **ReDoc API Reference**: `[Backend URL Placeholder]/redoc`

---

## Test Login Credentials (Pre-Seeded Dataset)

The database automatically seeds on startup from `bookleaf_sample_data.json` with **2 Admin accounts**, **10 Author accounts**, **18 books**, and **6 realistic support tickets** spanning different categories, priorities, and lifecycle states.

> **Instant Demo Tip**: Both `/author` and `/admin` include a **Quick Account Switcher** in the top navigation bar so you can jump between any of the 10 authors or the Admin Ops view in one click without re-typing credentials.

### 1. Admin Operations Accounts
- **Password for all Admin accounts**: `admin123`

| Role | Name | Email | Default View |
| :--- | :--- | :--- | :--- |
| Support Lead | BookLeaf Support Lead | `admin@bookleafpub.com` | `/admin` (Ticket Queue + AI Triage Console) |
| Ops Admin | Shivangi (Ops Admin) | `ops@bookleafpub.com` | `/admin` (Ticket Queue + AI Triage Console) |

### 2. Seeded Author Accounts
- **Password for all Author accounts**: `author123`

| Author ID | Name | Email | City | Books & Testing Scenarios |
| :--- | :--- | :--- | :--- | :--- |
| `AUTH001` | **Priya Sharma** | `priya.sharma@email.com` | Mumbai | 2 Published books (`Whispers of the Ganges` ₹3,570 pending; `The Saffron Diaries` ₹0 pending). Pre-seeded Q3 Royalty query (`TKT-1001`). |
| `AUTH002` | **Rohit Kapoor** | `rohit.kapoor@email.com` | Delhi | 2 Published books (`Code & Karma` 876 sold; `Startup Sutra` 1,203 sold, ₹7,744 pending). Pre-seeded Critical ISBN mismatch ticket (`TKT-1002`). |
| `AUTH003` | **Ananya Reddy** | `ananya.reddy@email.com` | Hyderabad | 1 Published book (`Between Two Temples`, ₹2,546 pending, first payout pending (`null` last payout date)). |
| `AUTH004` | **Vikram Joshi** | `vikram.joshi@email.com` | Pune | 2 Published books (`Debugging Life` ₹3,350 pending; `The Last Monsoon` ₹0 pending). Pre-seeded High-priority defective print ticket (`TKT-1003`). |
| `AUTH005` | **Meera Nair** | `meera.nair@email.com` | Kochi | 2 Published books (`Cardamom & Chaos` ₹0 pending; `Letters from Lakshadweep` ₹3,055 pending). |
| `AUTH006` | **Arjun Malhotra** | `arjun.malhotra@email.com` | Chandigarh | 1 Published book (`Turban Tales`, ₹2,464 earned/pending, ₹0 paid so far). |
| `AUTH007` | **Sneha Kulkarni** | `sneha.kulkarni@email.com` | Bangalore | 3 books: 2 Published (`The Algorithm of Love`, `Ctrl+Alt+Delete My Ex`) + 1 In Production (`Midnight in Mysore` — `In Production - Cover Design`, `null` MRP/ISBN/royalty fields). Pre-seeded cover timeline ticket (`TKT-1004`). |
| `AUTH008` | **Farhan Sheikh** | `farhan.sheikh@email.com` | Lucknow | 1 Published book (`Ghazal of the Forgotten`, ₹3,120 earned & fully paid, ₹0 pending). Pre-seeded resolved Hindi edition query (`TKT-1006`). |
| `AUTH009` | **Kavita Deshmukh** | `kavita.deshmukh@email.com` | Nagpur | 2 books: 1 In Production (`Raising Roots` — `In Production - Typesetting`) + 1 Published (`The Nagpur Notebooks` — ₹850 pending, under the ₹1,000 minimum payout threshold). Pre-seeded stock unavailability ticket (`TKT-1005`). |
| `AUTH010` | **Diya Chatterjee** | `diya.chatterjee@email.com` | Kolkata | 2 Published books (`Durga's Daughters` ₹2,540 pending; `Howrah Nights` ₹1,575 pending, ₹0 paid). |

---

## Local Setup Instructions

### Prerequisites
- **Python** 3.10+
- **Node.js** 18+ and `npm`
- **Gemini API Key** (Optional — if omitted or rate-limited, the backend automatically falls back to a deterministic rule-based classifier & context-aware draft generator so the app always runs out of the box).

### 1. Backend Setup (`/backend`)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside `backend/` (or copy variables from below):

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
JWT_SECRET_KEY=bookleaf-super-secret-jwt-key-2025
DATABASE_URL=sqlite:///./bookleaf.db
```

Start the FastAPI server on port `8000`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Backend API: `http://localhost:8000`
- Interactive Swagger UI: `http://localhost:8000/docs`

### 2. Frontend Setup (`/frontend`)

Open a second terminal:

```bash
cd frontend
npm install
```

(Optional) Create `frontend/.env.local` if your backend runs on a non-default URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the Next.js development server on port `3000`:

```bash
npm run dev
```
- Web App: `http://localhost:3000`

### 3. One-Command Docker Compose Run (Optional)

```bash
docker compose up --build
```

---

## Architecture & Engineering Decisions

### 1. Stack Selection
- **Backend (`FastAPI` + `SQLAlchemy` + `SQLite WAL`)**:
  - FastAPI provides automatic OpenAPI 3.0 generation (`/docs`), strict Pydantic v2 request/response validation, and clean dependency injection for JWT role verification (`author` vs `admin`).
  - SQLite configured with `PRAGMA journal_mode=WAL;` and `PRAGMA foreign_keys=ON;` gives zero-config portability for evaluators while supporting concurrent reads/writes between the Author Portal, Admin Console, and AI background pipeline.
- **Frontend (`Next.js 15 App Router` + `React 19` + `Tailwind CSS`, Plain JS/JSX)**:
  - Built strictly in clean `.js` / `.jsx` with custom tactile UI primitives (`<CustomSelect />`, `<BookLeafLogo />`, `<NavbarAccountSwitcher />`) styled around BookLeaf's coral (`#EC6568`), warm parchment (`#F9ECF0`), and dark ink (`#181818`) palette.
  - Responsive across mobile (`360px+`), tablet (`768px+`), and desktop (`1280px+`), including a 3-pane Admin split console on desktop and tabbed slide-over drawers on mobile/tablet.

### 2. Defensive Data Hygiene for "In Production" Books
Books still in production (`BK013` *Midnight in Mysore* and `BK015` *Raising Roots*) intentionally have `null` values in `bookleaf_sample_data.json` for `publication_date`, `mrp`, `author_royalty_per_copy`, `total_copies_sold`, `total_royalty_earned`, `royalty_paid`, `royalty_pending`, `last_royalty_payout_date`, and `print_partner`, plus an empty `available_on: []` array.
- **Database & API Layer**: Nullable columns are preserved honestly in SQLite rather than coerced to fake zeros where `null` carries domain meaning (e.g., `mrp: null` means unpriced, `publication_date: null` means unreleased).
- **UI Layer**: The Author "My Books" cards and Admin Context Sidebar inspect `status.startsWith("In Production")` and `null` fields to render clear badges (`"In Production (TBD)"`, `"Pricing TBD"`, `"Not yet listed on retail channels"`) instead of crashing or showing `₹null` / `NaN`.
- **AI Prompt Layer**: The book snapshot serializer explicitly annotates `null` fields as `"TBD (Book is still in production)"` so the LLM never hallucinates a missing royalty payout or fake release date.

### 3. End-to-End Real-Time Sync
Both portals operate against the same SQLite tables (`users`, `books`, `tickets`, `ticket_messages`, `ticket_internal_notes`).
- When an author submits a new ticket (with optional image/PDF attachment) or replies on a thread, it immediately appears in the Admin Queue with live AI classification and draft generation.
- When an admin sends an official response or updates ticket status (`Open` -> `In Progress` -> `Resolved` -> `Closed`), the Author Portal reflects the update immediately and is also polled every 8 seconds while viewing a ticket.

---

## AI Integration Strategy

The AI layer (`backend/app/ai_service.py`) is designed around three production constraints: **token efficiency**, **multimodal grounding**, and **zero-downtime fallback**.

### 1. Two-Stage Selective KB Injection (~75% Token Reduction)
Instead of stuffing the entire BookLeaf Knowledge Base and every book an author owns into one monolithic prompt:
1. **Scoped Book Context**: If a ticket targets a specific `book_id` (e.g., `BK003`), we serialize only that book's exact operational telemetry (`isbn`, `status`, `mrp`, `total_copies_sold`, `royalty_pending`, `last_royalty_payout_date`, `print_partner`, `available_on`). We only pass a compact summary of all the author's books when the ticket is `"General / Account Level"`.
2. **Modular Knowledge Base (`KB_MODULES`)**: BookLeaf's operational policies, SLA timelines, and the 7 official sample query-to-response calibration rules are partitioned into category-specific modules (`Royalty & Payments`, `ISBN & Metadata`, `Printing & Quality`, `Distribution & Availability`, `Production & Publishing Status`, `General Inquiry`), reducing prompt context size by ~75% compared to full-KB injection.

### 2. Multimodal Vision & Document Grounding (`gemini-2.5-flash`)
Authors can attach real images (`.png`, `.jpg`, `.webp`) or documents (`.pdf`, `.txt`) up to 5MB in the Support Query modal.
- The base64 data URI is decoded in `ai_service.py` and passed directly to `google-genai` via `types.Part.from_bytes(data=raw_bytes, mime_type=mime_type)` alongside the structured text prompt.
- If an author uploads a screenshot of an Amazon ISBN mismatch or a photo of a misprinted page, Gemini inspects the visual evidence directly and cites it in both `ai_reasoning` (for the admin) and `ai_draft_response` (for the author).

### 3. Structured JSON Output & Deterministic Fallback
- Calls use `response_mime_type="application/json"` with `temperature=0.1` to guarantee a strict schema (`category`, `priority`, `ai_confidence`, `ai_summary`, `ai_reasoning`, `ai_key_facts_used`, `ai_Action_items`, `ai_draft_response`).
- **Deterministic Fallback Engine (`_deterministic_triage`)**: If `GEMINI_API_KEY` is missing, invalid, or hits a quota/network error, the service seamlessly falls back to a deterministic rule-based classifier and template engine that still injects the author's real database figures (exact `royalty_pending`, `isbn`, `print_partner`, etc.). Ticket creation never fails or blocks the user.

---

## REST API Overview

Full interactive documentation with request/response schemas is served at `/docs`.

| Method | Endpoint | Auth Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate with email & password; returns JWT + user profile |
| `POST` | `/api/auth/quick-switch` | Public | Instant demo switcher for seeded Author/Admin accounts |
| `GET` | `/api/auth/demo-accounts` | Public | List all seeded Admin and Author accounts for the demo switcher |
| `GET` | `/api/auth/me` | Author / Admin | Return current authenticated user profile |
| `GET` | `/api/author/dashboard` | Author | Aggregate author KPIs, all books (with all 10 required fields), and recent tickets |
| `GET` | `/api/author/books` | Author | List all books belonging to the logged-in author |
| `GET` | `/api/author/tickets` | Author | List all support tickets created by the logged-in author |
| `POST` | `/api/author/tickets` | Author | Create a new support ticket (with optional base64 attachment) + run AI triage |
| `GET` | `/api/author/tickets/{id}` | Author | Fetch a single ticket thread (strictly strips Admin-only AI fields & internal notes) |
| `POST` | `/api/author/tickets/{id}/reply` | Author | Append an author follow-up message and re-trigger AI draft refresh |
| `GET` | `/api/admin/tickets` | Admin | List all tickets with filters (`status`, `category`, `priority`, `date_range`, `search`) + queue metrics |
| `GET` | `/api/admin/tickets/{id}` | Admin | Full ticket detail including AI triage metadata, internal notes, and full author/book portfolio |
| `PATCH` | `/api/admin/tickets/{id}` | Admin | Override ticket `status`, `priority`, `category`, or `assigned_to` |
| `POST` | `/api/admin/tickets/{id}/respond` | Admin | Send official response to author (updates status & records response time) |
| `POST` | `/api/admin/tickets/{id}/notes` | Admin | Add a private internal admin note (hidden from authors) |
| `POST` | `/api/admin/tickets/{id}/regenerate-ai` | Admin | Re-run Gemini AI triage & draft response with optional custom admin instructions |

---

## Known Limitations & Future Improvements

1. **Base64 SQLite Storage vs. Object Storage**: Attachments (up to 5MB) are currently stored as base64 data URLs in SQLite so the entire project runs self-contained with zero external cloud bucket setup. In production, attachments should stream to S3 / Cloudflare R2 with signed URLs.
2. **Polling vs. WebSockets/SSE**: The portals currently use lightweight HTTP polling (8s–10s intervals) plus immediate state hydration on actions. Replacing polling with Server-Sent Events (SSE) or WebSockets would reduce idle network chatter at scale.
3. **Synchronous AI Triage on Ticket Creation**: AI classification and drafting run during the `POST /api/author/tickets` request (~1.5s–2.5s with Gemini Flash) so the ticket arrives in the Admin Queue pre-triaged. Moving this to an async task queue (Celery / Redis or FastAPI `BackgroundTasks` with webhook push) would make ticket creation sub-50ms.
