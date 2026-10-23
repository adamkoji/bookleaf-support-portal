from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth import require_author
from app.database import get_db
from app.models import User, Book, Ticket, TicketMessage
from app.schemas import (
    BookOut,
    AuthorBooksSummaryResponse,
    TicketCreateRequest,
    AuthorReplyRequest,
    AuthorTicketResponse,
)
from app.ai_service import analyze_and_draft_ticket

router = APIRouter(prefix="/api/author", tags=["Author Portal"])


def _generate_next_ticket_code(db: Session) -> str:
    last_ticket = db.query(Ticket).order_by(Ticket.id.desc()).first()
    if not last_ticket or not last_ticket.ticket_code:
        return "TKT-1001"
    try:
        num = int(last_ticket.ticket_code.split("-")[-1])
        return f"TKT-{num + 1}"
    except ValueError:
        return f"TKT-{1001 + (last_ticket.id or 0)}"


@router.get("/books", response_model=AuthorBooksSummaryResponse)
def get_author_books(
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db),
):
    books = (
        db.query(Book)
        .filter(Book.author_id == current_user.id)
        .order_by(Book.book_code.asc())
        .all()
    )

    total_books = len(books)
    published_books = sum(1 for b in books if "published" in (b.status or "").lower())
    in_production_books = total_books - published_books
    total_copies_sold = sum((b.total_copies_sold or 0) for b in books)
    total_royalty_earned = sum((b.total_royalty_earned or 0.0) for b in books)
    total_royalty_paid = sum((b.royalty_paid or 0.0) for b in books)
    total_royalty_pending = sum((b.royalty_pending or 0.0) for b in books)

    return {
        "books": [BookOut.model_validate(b) for b in books],
        "summary": {
            "total_books": total_books,
            "published_books": published_books,
            "in_production_books": in_production_books,
            "total_copies_sold": total_copies_sold,
            "total_royalty_earned": total_royalty_earned,
            "total_royalty_paid": total_royalty_paid,
            "total_royalty_pending": total_royalty_pending,
        },
    }


@router.get("/tickets", response_model=list[AuthorTicketResponse])
def get_author_tickets(
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db),
):
    tickets = (
        db.query(Ticket)
        .options(joinedload(Ticket.book), joinedload(Ticket.messages))
        .filter(Ticket.author_id == current_user.id)
        .order_by(Ticket.updated_at.desc(), Ticket.id.desc())
        .all()
    )
    return tickets


@router.get("/tickets/{ticket_id}", response_model=AuthorTicketResponse)
def get_author_ticket_detail(
    ticket_id: int,
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket)
        .options(joinedload(Ticket.book), joinedload(Ticket.messages))
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )
    if ticket.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only view your own tickets.",
        )
    return ticket


@router.post("/tickets", response_model=AuthorTicketResponse, status_code=status.HTTP_201_CREATED)
def create_author_ticket(
    payload: TicketCreateRequest,
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db),
):
    linked_book = None
    if payload.book_id is not None:
        linked_book = db.query(Book).filter(Book.id == payload.book_id).first()
        if not linked_book:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected book not found.",
            )
        if linked_book.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Selected book does not belong to your account.",
            )

    # Ensure author.books is loaded for general account-level context
    _ = current_user.books

    # Run AI triage & context-aware draft generation safely
    clean_attachment_name = payload.attachment_name.strip() if payload.attachment_name else None
    clean_attachment_data = payload.attachment_data.strip() if payload.attachment_data else None
    try:
        ai_result = analyze_and_draft_ticket(
            author=current_user,
            book=linked_book,
            subject=payload.subject.strip(),
            description=payload.description.strip(),
            conversation_history=[],
            attachment_name=clean_attachment_name,
            attachment_data=clean_attachment_data,
        )
    except Exception:
        ai_result = {
            "category": "General Inquiry",
            "priority": "Medium",
            "ai_draft_response": (
                f"Dear {current_user.name},\n\nThank you for contacting BookLeaf Support. "
                "We have received your query and our team will respond within 48 hours.\n\nWarm regards,\nBookLeaf Support Team"
            ),
            "ai_reasoning": "Fallback applied due to unexpected exception during triage.",
            "ai_tokens_used": 250,
            "ai_provider_status": "fallback",
        }

    now = datetime.utcnow()
    ticket_code = _generate_next_ticket_code(db)

    new_ticket = Ticket(
        ticket_code=ticket_code,
        author_id=current_user.id,
        book_id=linked_book.id if linked_book else None,
        subject=payload.subject.strip(),
        description=payload.description.strip(),
        attachment_name=clean_attachment_name,
        attachment_data=clean_attachment_data,
        status="Open",
        category=ai_result["category"],
        priority=ai_result["priority"],
        ai_draft_response=ai_result["ai_draft_response"],
        ai_reasoning=ai_result["ai_reasoning"],
        ai_tokens_used=ai_result["ai_tokens_used"],
        ai_provider_status=ai_result["ai_provider_status"],
        created_at=now,
        updated_at=now,
    )
    db.add(new_ticket)
    db.flush()

    initial_msg = TicketMessage(
        ticket_id=new_ticket.id,
        sender_id=current_user.id,
        sender_role="author",
        sender_name=current_user.name,
        message=payload.description.strip(),
        created_at=now,
    )
    db.add(initial_msg)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket


@router.post("/tickets/{ticket_id}/reply", response_model=AuthorTicketResponse)
def reply_to_author_ticket(
    ticket_id: int,
    payload: AuthorReplyRequest,
    current_user: User = Depends(require_author),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket)
        .options(joinedload(Ticket.book), joinedload(Ticket.messages))
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )
    if ticket.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You can only reply to your own tickets.",
        )

    now = datetime.utcnow()
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        sender_role="author",
        sender_name=current_user.name,
        message=payload.message.strip(),
        created_at=now,
    )
    db.add(msg)
    db.flush()

    # Re-open ticket if it was previously Resolved or Closed
    if ticket.status in ("Resolved", "Closed"):
        ticket.status = "In Progress"

    # Fetch the last 4 messages in chronological order and refresh AI draft for the new follow-up
    recent_messages = (
        db.query(TicketMessage)
        .filter(TicketMessage.ticket_id == ticket.id)
        .order_by(TicketMessage.created_at.asc(), TicketMessage.id.asc())
        .all()[-4:]
    )
    _ = current_user.books
    try:
        ai_result = analyze_and_draft_ticket(
            author=current_user,
            book=ticket.book,
            subject=ticket.subject,
            description=ticket.description,
            conversation_history=recent_messages,
            attachment_name=ticket.attachment_name,
            attachment_data=ticket.attachment_data,
        )
        ticket.category = ai_result["category"]
        ticket.priority = ai_result["priority"]
        ticket.ai_draft_response = ai_result["ai_draft_response"]
        ticket.ai_reasoning = ai_result["ai_reasoning"]
        ticket.ai_tokens_used = ai_result["ai_tokens_used"]
        ticket.ai_provider_status = ai_result["ai_provider_status"]
    except Exception:
        pass

    ticket.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(ticket)
    return ticket

