from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth import verify_password, create_access_token, get_current_user
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    author_code: Optional[str] = None
    name: str
    email: str
    role: str
    phone: Optional[str] = None
    city: Optional[str] = None
    joined_date: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email_normalized = payload.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(email_normalized)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "author_code": user.author_code,
        }
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/demo-accounts")
def get_demo_accounts(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.role.asc(), User.author_code.asc(), User.id.asc()).all()
    accounts = []
    for u in users:
        accounts.append(
            {
                "id": u.id,
                "author_code": u.author_code,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "city": u.city,
                "default_password": "admin123" if u.role == "admin" else "author123",
                "book_count": len(u.books) if u.role == "author" else 0,
            }
        )
    return {"accounts": accounts}

