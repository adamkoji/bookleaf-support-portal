from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.auth import require_admin
from app.database import get_db
from app.models import User, Book, Ticket, TicketMessage, InternalNote
from app.schemas import (
    AdminTicketResponse,
    AdminTicketUpdateRequest,
    AdminReplyRequest,
    AdminInternalNoteRequest,
    RegenerateAIRequest,
    AdminAuthorWithBooksOut,
)
from app.ai_service import analyze_and_draft_ticket, NAIVE_FULL_CONTEXT_TOKENS

router = APIRouter(prefix="/api/admin", tags=["Admin Support Queue"])

PRIORITY_RANK = {
    "Critical": 0,
    "High": 1,
    "Medium": 2,
    "Low": 3,
}

STATUS_RANK = {
    "Open": 0,
    "In Progress": 1,
    "Resolved": 2,
    "Closed": 3,
}


@router.get("/tickets")
def list_admin_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    category: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    date_filter: Optional[str] = Query(default=None, alias="date"),
    search: Optional[str] = Query(default=None),
    sort_by: Optional[str] = Query(default="urgent"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    all_tickets = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.author),
            joinedload(Ticket.book),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.messages),
            joinedload(Ticket.internal_notes),
        )
        .all()
    )

    # Compute queue-wide summary stats across all tickets
    total_count = len(all_tickets)
    open_count = sum(1 for t in all_tickets if t.status == "Open")
    in_progress_count = sum(1 for t in all_tickets if t.status == "In Progress")
    resolved_count = sum(1 for t in all_tickets if t.status in ("Resolved", "Closed"))
    critical_high_count = sum(
        1 for t in all_tickets if t.priority in ("Critical", "High") and t.status not in ("Resolved", "Closed")
    )
    avg_tokens = (
        round(sum((t.ai_tokens_used or 0) for t in all_tickets) / total_count)
        if total_count > 0
        else 0
    )

    # Apply query filters
    filtered = all_tickets
    if status_filter and status_filter.lower() != "all":
        filtered = [t for t in filtered if (t.status or "").lower() == status_filter.strip().lower()]

    if category and category.lower() != "all":
        filtered = [t for t in filtered if (t.category or "").lower() == category.strip().lower()]

    if priority and priority.lower() != "all":
        filtered = [t for t in filtered if (t.priority or "").lower() == priority.strip().lower()]

    if date_filter and date_filter.lower() != "all":
        df = date_filter.strip().lower()
        now_utc = datetime.utcnow()
        if df == "today":
            filtered = [
                t for t in filtered
                if t.created_at and (now_utc - t.created_at).total_seconds() <= 86400
            ]
        elif df in ("7d", "last_7_days", "week"):
            filtered = [
                t for t in filtered
                if t.created_at and (now_utc - t.created_at).total_seconds() <= 7 * 86400
            ]
        elif df in ("30d", "last_30_days", "month"):
            filtered = [
                t for t in filtered
                if t.created_at and (now_utc - t.created_at).total_seconds() <= 30 * 86400
            ]
        else:
            # Support YYYY-MM-DD prefix matching if passed
            filtered = [
                t for t in filtered
                if t.created_at and t.created_at.strftime("%Y-%m-%d").startswith(df)
            ]

    if search and search.strip():
        q = search.strip().lower()
        filtered = [
            t
            for t in filtered
            if q in (t.ticket_code or "").lower()
            or q in (t.subject or "").lower()
            or q in (t.description or "").lower()
            or (t.author and q in (t.author.name or "").lower())
            or (t.author and q in (t.author.email or "").lower())
            or (t.book and q in (t.book.title or "").lower())
            or (t.book and q in (t.book.book_code or "").lower())
        ]

    # Sort tickets
    if sort_by == "newest":
        filtered.sort(key=lambda t: (t.created_at or datetime.min), reverse=True)
    elif sort_by == "oldest":
        filtered.sort(key=lambda t: (t.created_at or datetime.min), reverse=False)
    elif sort_by == "updated":
        filtered.sort(key=lambda t: (t.updated_at or datetime.min), reverse=True)
    else:
        # Default "urgent": Unresolved first, then Priority (Critical -> Low), then oldest unresolved first
        filtered.sort(
            key=lambda t: (
                STATUS_RANK.get(t.status, 99),
                PRIORITY_RANK.get(t.priority, 99),
                (t.created_at.timestamp() if t.created_at else 0),
            )
        )

    return {
        "tickets": [AdminTicketResponse.model_validate(t) for t in filtered],
        "summary": {
            "total": total_count,
            "open": open_count,
            "in_progress": in_progress_count,
            "resolved": resolved_count,
            "critical_high_open": critical_high_count,
            "avg_tokens_per_ticket": avg_tokens,
            "naive_full_context_tokens": NAIVE_FULL_CONTEXT_TOKENS,
            "estimated_token_savings_pct": (
                round(max(0, (NAIVE_FULL_CONTEXT_TOKENS - avg_tokens) / NAIVE_FULL_CONTEXT_TOKENS * 100))
                if avg_tokens > 0
                else 75
            ),
        },
    }


@router.get("/tickets/{ticket_id}", response_model=AdminTicketResponse)
def get_admin_ticket_detail(
    ticket_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.author),
            joinedload(Ticket.book),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.messages),
            joinedload(Ticket.internal_notes),
        )
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )
    return ticket


@router.patch("/tickets/{ticket_id}", response_model=AdminTicketResponse)
def update_admin_ticket(
    ticket_id: int,
    payload: AdminTicketUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.author),
            joinedload(Ticket.book),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.messages),
            joinedload(Ticket.internal_notes),
        )
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    fields_set = payload.model_fields_set
    if "status" in fields_set and payload.status is not None:
        ticket.status = payload.status
    if "category" in fields_set and payload.category is not None:
        ticket.category = payload.category
    if "priority" in fields_set and payload.priority is not None:
        ticket.priority = payload.priority
    if "assigned_to_id" in fields_set:
        if payload.assigned_to_id is not None:
            assignee = db.query(User).filter(User.id == payload.assigned_to_id, User.role == "admin").first()
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned user must be a valid admin.",
                )
        ticket.assigned_to_id = payload.assigned_to_id
    if "ai_draft_response" in fields_set and payload.ai_draft_response is not None:
        ticket.ai_draft_response = payload.ai_draft_response

    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/reply", response_model=AdminTicketResponse)
def admin_reply_to_ticket(
    ticket_id: int,
    payload: AdminReplyRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.author),
            joinedload(Ticket.book),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.messages),
            joinedload(Ticket.internal_notes),
        )
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    now = datetime.utcnow()
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_admin.id,
        sender_role="admin",
        sender_name=current_admin.name,
        message=payload.message.strip(),
        created_at=now,
    )
    db.add(msg)

    if payload.status is not None:
        ticket.status = payload.status
    elif ticket.status == "Open":
        ticket.status = "In Progress"

    if ticket.assigned_to_id is None:
        ticket.assigned_to_id = current_admin.id

    ticket.updated_at = now
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/notes", response_model=AdminTicketResponse, status_code=status.HTTP_201_CREATED)
def add_internal_note(
    ticket_id: int,
    payload: AdminInternalNoteRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.author),
            joinedload(Ticket.book),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.messages),
            joinedload(Ticket.internal_notes),
        )
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    now = datetime.utcnow()
    note = InternalNote(
        ticket_id=ticket.id,
        admin_id=current_admin.id,
        admin_name=current_admin.name,
        note=payload.note.strip(),
        created_at=now,
    )
    db.add(note)
    ticket.updated_at = now
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/tickets/{ticket_id}/regenerate-ai", response_model=AdminTicketResponse)
def regenerate_ticket_ai(
    ticket_id: int,
    payload: Optional[RegenerateAIRequest] = None,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.author).joinedload(User.books),
            joinedload(Ticket.book),
            joinedload(Ticket.assigned_to),
            joinedload(Ticket.messages),
            joinedload(Ticket.internal_notes),
        )
        .filter(Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found.",
        )

    force_fallback = payload.force_fallback if payload else False

    recent_messages = (
        db.query(TicketMessage)
        .filter(TicketMessage.ticket_id == ticket.id)
        .order_by(TicketMessage.created_at.asc(), TicketMessage.id.asc())
        .all()[-4:]
    )

    ai_result = analyze_and_draft_ticket(
        author=ticket.author,
        book=ticket.book,
        subject=ticket.subject,
        description=ticket.description,
        conversation_history=recent_messages,
        force_fallback=force_fallback,
        attachment_name=ticket.attachment_name,
        attachment_data=ticket.attachment_data,
    )

    ticket.category = ai_result["category"]
    ticket.priority = ai_result["priority"]
    ticket.ai_draft_response = ai_result["ai_draft_response"]
    ticket.ai_reasoning = ai_result["ai_reasoning"]
    ticket.ai_tokens_used = ai_result["ai_tokens_used"]
    ticket.ai_provider_status = ai_result["ai_provider_status"]
    ticket.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/authors", response_model=list[AdminAuthorWithBooksOut])
def list_admin_authors(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    authors = (
        db.query(User)
        .options(joinedload(User.books))
        .filter(User.role == "author")
        .order_by(User.author_code.asc())
        .all()
    )
    return authors


@router.get("/admins")
def list_admins(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    admins = db.query(User).filter(User.role == "admin").order_by(User.id.asc()).all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "email": a.email,
            "role": a.role,
        }
        for a in admins
    ]

