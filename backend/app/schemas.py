from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

TicketStatusLiteral = Literal["Open", "In Progress", "Resolved", "Closed"]
TicketPriorityLiteral = Literal["Critical", "High", "Medium", "Low"]
TicketCategoryLiteral = Literal[
    "Royalty & Payments",
    "ISBN & Metadata Issues",
    "Printing & Quality",
    "Distribution & Availability",
    "Book Status & Production Updates",
    "General Inquiry",
]


# -------------------- User & Book Schemas --------------------

class AuthorBriefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_code: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    joined_date: Optional[str] = None


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    book_code: str
    author_id: int
    title: str
    isbn: Optional[str] = None
    genre: Optional[str] = None
    publication_date: Optional[str] = None
    status: str
    mrp: Optional[float] = None
    author_royalty_per_copy: Optional[float] = None
    total_copies_sold: int = 0
    total_royalty_earned: float = 0.0
    royalty_paid: float = 0.0
    royalty_pending: float = 0.0
    last_royalty_payout_date: Optional[str] = None
    print_partner: Optional[str] = None
    available_on: list[str] = []


class AuthorBooksSummaryResponse(BaseModel):
    books: list[BookOut]
    summary: dict


class AdminAuthorWithBooksOut(AuthorBriefOut):
    books: list[BookOut] = []


# -------------------- Message & Internal Note Schemas --------------------

class TicketMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    sender_id: int
    sender_role: str
    sender_name: str
    message: str
    created_at: datetime


class InternalNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    admin_id: int
    admin_name: str
    note: str
    created_at: datetime


# -------------------- Request Schemas --------------------

class TicketCreateRequest(BaseModel):
    book_id: Optional[int] = None
    subject: str = Field(..., min_length=3, max_length=250)
    description: str = Field(..., min_length=3, max_length=10000)
    attachment_name: Optional[str] = Field(default=None, max_length=255)


class AuthorReplyRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=10000)


class AdminTicketUpdateRequest(BaseModel):
    status: Optional[TicketStatusLiteral] = None
    category: Optional[TicketCategoryLiteral] = None
    priority: Optional[TicketPriorityLiteral] = None
    assigned_to_id: Optional[int] = None
    ai_draft_response: Optional[str] = None


class AdminReplyRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=10000)
    status: Optional[TicketStatusLiteral] = None


class AdminInternalNoteRequest(BaseModel):
    note: str = Field(..., min_length=2, max_length=5000)


class RegenerateAIRequest(BaseModel):
    force_fallback: bool = False


# -------------------- Ticket Response Schemas --------------------

class AuthorTicketResponse(BaseModel):
    """
    SECURITY RULE: Strictly for Author endpoints.
    Exposes ticket metadata and conversation messages ONLY.
    NEVER exposes internal_notes, ai_draft_response, ai_reasoning, or ai_tokens_used.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_code: str
    author_id: int
    book_id: Optional[int] = None
    book: Optional[BookOut] = None
    subject: str
    description: str
    attachment_name: Optional[str] = None
    status: str
    category: Optional[str] = None
    priority: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: list[TicketMessageOut] = []


class AdminTicketResponse(BaseModel):
    """
    Full Ticket Response for Admin endpoints.
    Exposes author details, book details, AI triage & draft fields, messages, and internal notes.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_code: str
    author_id: int
    author: Optional[AuthorBriefOut] = None
    book_id: Optional[int] = None
    book: Optional[BookOut] = None
    subject: str
    description: str
    attachment_name: Optional[str] = None
    status: str
    category: Optional[str] = None
    priority: Optional[str] = None
    ai_draft_response: Optional[str] = None
    ai_reasoning: Optional[str] = None
    ai_tokens_used: int = 0
    ai_provider_status: str = "pending"
    assigned_to_id: Optional[int] = None
    assigned_to: Optional[AuthorBriefOut] = None
    created_at: datetime
    updated_at: datetime
    messages: list[TicketMessageOut] = []
    internal_notes: list[InternalNoteOut] = []

