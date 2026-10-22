import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    author_code = Column(String, unique=True, nullable=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "author" or "admin"
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    joined_date = Column(String, nullable=True)

    books = relationship("Book", back_populates="author", cascade="all, delete-orphan")
    tickets = relationship("Ticket", foreign_keys="Ticket.author_id", back_populates="author")
    assigned_tickets = relationship("Ticket", foreign_keys="Ticket.assigned_to_id", back_populates="assigned_to")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    book_code = Column(String, unique=True, index=True, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    isbn = Column(String, nullable=True)
    genre = Column(String, nullable=True)
    publication_date = Column(String, nullable=True)
    status = Column(String, nullable=False)
    mrp = Column(Float, nullable=True)
    author_royalty_per_copy = Column(Float, nullable=True)
    total_copies_sold = Column(Integer, default=0)
    total_royalty_earned = Column(Float, default=0.0)
    royalty_paid = Column(Float, default=0.0)
    royalty_pending = Column(Float, default=0.0)
    last_royalty_payout_date = Column(String, nullable=True)
    print_partner = Column(String, nullable=True)
    available_on_json = Column(Text, default="[]", nullable=False)

    author = relationship("User", back_populates="books")
    tickets = relationship("Ticket", back_populates="book")

    @property
    def available_on(self) -> list[str]:
        if not self.available_on_json:
            return []
        try:
            data = json.loads(self.available_on_json)
            return data if isinstance(data, list) else []
        except (json.JSONDecodeError, TypeError):
            return []

    @available_on.setter
    def available_on(self, value: list[str] | None):
        if value is None:
            self.available_on_json = "[]"
        else:
            self.available_on_json = json.dumps(value)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_code = Column(String, unique=True, index=True, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id"), nullable=True)  # NULL means "General / Account Level"
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    attachment_name = Column(String, nullable=True)
    status = Column(String, default="Open", nullable=False)  # Open, In Progress, Resolved, Closed
    category = Column(String, nullable=True)
    priority = Column(String, nullable=True)  # Critical, High, Medium, Low
    ai_draft_response = Column(Text, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    ai_tokens_used = Column(Integer, default=0)
    ai_provider_status = Column(String, default="pending")  # "success", "fallback", "pending"
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    author = relationship("User", foreign_keys=[author_id], back_populates="tickets")
    book = relationship("Book", back_populates="tickets")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_tickets")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at")
    internal_notes = relationship("InternalNote", back_populates="ticket", cascade="all, delete-orphan", order_by="InternalNote.created_at")


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sender_role = Column(String, nullable=False)  # "author" or "admin"
    sender_name = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User")


class InternalNote(Base):
    __tablename__ = "internal_notes"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_name = Column(String, nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ticket = relationship("Ticket", back_populates="internal_notes")
    admin = relationship("User")

