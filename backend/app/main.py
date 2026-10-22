from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal, get_db
from app.models import User, Book, Ticket
from app.seed import seed_database
from app.routers import auth, author, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
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
