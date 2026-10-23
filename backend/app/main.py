import sys
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal, get_db
from app.models import User, Book, Ticket
from app.seed import seed_database
from app.routers import auth, author, admin

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def _ensure_attachment_data_column():
    try:
        with engine.begin() as conn:
            rows = conn.execute(text("PRAGMA table_info(tickets);")).fetchall()
            cols = [r[1] for r in rows]
            if rows and "attachment_data" not in cols:
                conn.execute(text("ALTER TABLE tickets ADD COLUMN attachment_data TEXT;"))
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_attachment_data_column()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="BookLeaf Author Support & Communication Portal API",
    description="Backend API for BookLeaf Publishing Author Portal & Admin Support Queue",
    version="1.0.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def log_api_requests(request: Request, call_next):
    start_perf = time.perf_counter()
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        duration_ms = (time.perf_counter() - start_perf) * 1000.0
        msg = f"🌐 [API] {request.method} {request.url.path} -> {response.status_code} ({duration_ms:.1f}ms)"
        try:
            print(msg, flush=True)
        except Exception:
            print(msg.encode("ascii", errors="replace").decode("ascii"), flush=True)
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(author.router)
app.include_router(admin.router)


@app.get("/api/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    user_count = db.query(User).count()
    author_count = db.query(User).filter(User.role == "author").count()
    admin_count = db.query(User).filter(User.role == "admin").count()
    book_count = db.query(Book).count()
    ticket_count = db.query(Ticket).count()
    return {
        "status": "healthy",
        "service": "BookLeaf Portal Backend",
        "stats": {
            "total_users": user_count,
            "authors": author_count,
            "admins": admin_count,
            "books": book_count,
            "tickets": ticket_count,
        },
    }
