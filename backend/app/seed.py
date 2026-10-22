import json
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import User, Book, Ticket, TicketMessage, InternalNote


def find_sample_data_path() -> Path:
    backend_dir = Path(__file__).resolve().parent.parent
    root_dir = backend_dir.parent

    candidates = [
        backend_dir / "bookleaf_sample_data.json",
        root_dir / "bookleaf_sample_data.json",
        root_dir / "FULLSTACK-SAMPLEDATA (1) (1) (1).json",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        f"Could not find bookleaf_sample_data.json in {[str(c) for c in candidates]}"
    )


def seed_database(db: Session) -> None:
    """Idempotently seed the database if the User table is empty."""
    existing_user_count = db.query(User).count()
    if existing_user_count > 0:
        return

    sample_data_path = find_sample_data_path()
    with open(sample_data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Pre-compute password hashes once for speed
    author_pw_hash = hash_password("author123")
    admin_pw_hash = hash_password("admin123")

    # 1. Create 2 Admin users
    admin_lead = User(
        author_code=None,
        name="BookLeaf Support Lead",
        email="admin@bookleafpub.com",
        password_hash=admin_pw_hash,
        role="admin",
        phone="+91-98000-00001",
        city="Delhi NCR",
        joined_date="2022-01-10",
    )
    ops_admin = User(
        author_code=None,
        name="Shivangi - Ops Admin",
        email="ops@bookleafpub.com",
        password_hash=admin_pw_hash,
        role="admin",
        phone="+91-98000-00002",
        city="Delhi NCR",
        joined_date="2022-06-15",
    )
    db.add(admin_lead)
    db.add(ops_admin)
    db.flush()

    # Maps to look up seeded authors and books by code
    authors_by_code: dict[str, User] = {}
    books_by_code: dict[str, Book] = {}

    # 2. Create all 10 Authors and their 18 Books
    for author_data in data.get("authors", []):
        author = User(
            author_code=author_data["author_id"],
            name=author_data["name"],
            email=author_data["email"],
            password_hash=author_pw_hash,
            role="author",
            phone=author_data.get("phone"),
            city=author_data.get("city"),
            joined_date=author_data.get("joined_date"),
        )
        db.add(author)
        db.flush()
        authors_by_code[author.author_code] = author

        for book_data in author_data.get("books", []):
            available_on_list = book_data.get("available_on")
            if not isinstance(available_on_list, list):
                available_on_list = []

            book = Book(
                book_code=book_data["book_id"],
                author_id=author.id,
                title=book_data["title"],
                isbn=book_data.get("isbn"),
                genre=book_data.get("genre"),
                publication_date=book_data.get("publication_date"),
                status=book_data["status"],
                mrp=book_data.get("mrp"),
                author_royalty_per_copy=book_data.get("author_royalty_per_copy"),
                total_copies_sold=book_data.get("total_copies_sold", 0) or 0,
                total_royalty_earned=book_data.get("total_royalty_earned", 0) or 0.0,
                royalty_paid=book_data.get("royalty_paid", 0) or 0.0,
                royalty_pending=book_data.get("royalty_pending", 0) or 0.0,
                last_royalty_payout_date=book_data.get("last_royalty_payout_date"),
                print_partner=book_data.get("print_partner"),
                available_on_json=json.dumps(available_on_list),
            )
            db.add(book)
            db.flush()
            books_by_code[book.book_code] = book

    now = datetime.utcnow()

    # 3. Pre-seed 4 realistic sample support tickets across different authors
    # Ticket 1: Priya Sharma (AUTH001) on BK001 ("Whispers of the Ganges") about pending ₹3,570 royalty
    priya = authors_by_code["AUTH001"]
    bk001 = books_by_code["BK001"]
    tkt1_created = now - timedelta(hours=18)
    tkt1 = Ticket(
        ticket_code="TKT-1001",
        author_id=priya.id,
        book_id=bk001.id,
        subject="Pending royalty payout of ₹3,570 for Whispers of the Ganges",
        description=(
            "Hello BookLeaf Team, my dashboard shows 342 total copies sold for 'Whispers of the Ganges' (BK001) "
            "with total royalty earned at ₹11,970. I received ₹8,400 on October 15, 2025, but ₹3,570 has been "
            "showing as pending since then. Could you please share when this remaining balance will be credited?"
        ),
        attachment_name=None,
        status="Open",
        category="Royalty & Payments",
        priority="High",
        ai_draft_response=(
            "Dear Priya,\n\n"
            "Thank you for reaching out to BookLeaf Support regarding the royalty payout for *Whispers of the Ganges* (BK001).\n\n"
            "I have reviewed your royalty ledger and confirmed the following details on your account:\n"
            "- **Total Copies Sold:** 342 copies (at ₹35 royalty/copy)\n"
            "- **Total Royalty Earned:** ₹11,970\n"
            "- **Royalty Paid:** ₹8,400 (last payout processed on 2025-10-15)\n"
            "- **Pending Royalty Balance:** ₹3,570\n\n"
            "Since your pending balance of ₹3,570 exceeds our ₹1,000 minimum payout threshold, it is eligible and queued "
            "for the upcoming quarterly disbursement cycle. Royalties are processed within 45 days of the end of the quarter "
            "via NEFT/IMPS to your registered bank account.\n\n"
            "Please let us know if you need the UTR reference once the transfer is initiated.\n\n"
            "Warm regards,\n"
            "BookLeaf Author Support Team"
        ),
        ai_reasoning=(
            "Classified as 'Royalty & Payments' with 'High' priority because the author is inquiring about an overdue/pending "
            "financial payout of ₹3,570 (above the ₹1,000 threshold) with specific ledger figures from BK001."
        ),
        ai_tokens_used=412,
        ai_provider_status="success",
        assigned_to_id=admin_lead.id,
        created_at=tkt1_created,
        updated_at=tkt1_created + timedelta(minutes=15),
    )
    db.add(tkt1)
    db.flush()

    db.add(
        TicketMessage(
            ticket_id=tkt1.id,
            sender_id=priya.id,
            sender_role="author",
            sender_name=priya.name,
            message=tkt1.description,
            created_at=tkt1_created,
        )
    )
    db.add(
        InternalNote(
            ticket_id=tkt1.id,
            admin_id=admin_lead.id,
            admin_name=admin_lead.name,
            note="Verified with Finance team: Priya's ₹3,570 NEFT batch is scheduled for Friday's payout run. Safe to send the AI draft response confirming eligibility.",
            created_at=tkt1_created + timedelta(minutes=15),
        )
    )

    # Ticket 2: Sneha Kulkarni (AUTH007) on BK013 ("Midnight in Mysore") about cover design timeline
    sneha = authors_by_code["AUTH007"]
    bk013 = books_by_code["BK013"]
    tkt2_created = now - timedelta(hours=12)
    tkt2 = Ticket(
        ticket_code="TKT-1002",
        author_id=sneha.id,
        book_id=bk013.id,
        subject="Update on cover design concepts for Midnight in Mysore (BK013)",
        description=(
            "Hi team, my third book 'Midnight in Mysore' (ISBN 978-93-5XXXX-13-4) is currently in 'In Production - Cover Design' "
            "status. Since my MRP and publication date aren't finalized yet, could you let me know when I will receive the first "
            "cover mockup options and when we will lock the MRP?"
        ),
        attachment_name="mysore_moodboard_notes.pdf",
        status="In Progress",
        category="Book Status & Production Updates",
        priority="Medium",
        ai_draft_response=(
            "Hi Sneha,\n\n"
            "Thank you for checking in on your upcoming thriller, *Midnight in Mysore* (BK013)!\n\n"
            "Your book is currently in the **In Production - Cover Design** stage (ISBN `978-93-5XXXX-13-4` has already been assigned). "
            "Here is what to expect next in our production workflow:\n"
            "1. **Cover Mockups:** Our design team typically shares 2–3 initial cover concepts within 7–10 business days of entering the Cover Design stage.\n"
            "2. **MRP & Royalty Finalization:** Once the final interior page count (typesetting) and cover specifications are approved, our production system will calculate the minimum base price and invite you to lock in your MRP and author royalty per copy.\n\n"
            "We have shared your moodboard notes with the design team and will update you as soon as the first drafts are ready for review.\n\n"
            "Best regards,\n"
            "BookLeaf Production Support"
        ),
        ai_reasoning=(
            "Categorized as 'Book Status & Production Updates' with 'Medium' priority. Author is asking for standard production "
            "timeline milestones for BK013 which is currently in 'In Production - Cover Design' with null MRP and publication date."
        ),
        ai_tokens_used=385,
        ai_provider_status="success",
        assigned_to_id=ops_admin.id,
        created_at=tkt2_created,
        updated_at=tkt2_created + timedelta(hours=1),
    )
    db.add(tkt2)
    db.flush()

    db.add(
        TicketMessage(
            ticket_id=tkt2.id,
            sender_id=sneha.id,
            sender_role="author",
            sender_name=sneha.name,
            message=tkt2.description,
            created_at=tkt2_created,
        )
    )

    # Ticket 3: Rohit Kapoor (AUTH002) on BK003 ("Code & Karma") about ISBN mismatch on Amazon
    rohit = authors_by_code["AUTH002"]
    bk003 = books_by_code["BK003"]
    tkt3_created = now - timedelta(hours=6)
    tkt3 = Ticket(
        ticket_code="TKT-1003",
        author_id=rohit.id,
        book_id=bk003.id,
        subject="ISBN mismatch and wrong edition metadata showing on Amazon India for Code & Karma",
        description=(
            "Urgent issue: When searching for my book 'Code & Karma' (BK003, ISBN 978-93-5XXXX-03-5) on Amazon India, "
            "the product page displays an outdated subtitle and an unrecognized secondary ISBN mapping, causing buyer confusion. "
            "Flipkart and BookLeaf Store show the correct details. Please push a metadata refresh to Amazon urgently!"
        ),
        attachment_name="amazon_listing_screenshot.png",
        status="Open",
        category="ISBN & Metadata Issues",
        priority="High",
        ai_draft_response=(
            "Dear Rohit,\n\n"
            "Thank you for flagging this metadata discrepancy for *Code & Karma* (BK003, official ISBN: `978-93-5XXXX-03-5`).\n\n"
            "We understand how important accurate listing data is on Amazon India, especially for an active title with 876 copies sold. "
            "Our distribution metadata team is initiating an **ONIX metadata re-sync** with Amazon India and Repro India to ensure:\n"
            "- The primary ISBN `978-93-5XXXX-03-5` is strictly mapped to the canonical product page.\n"
            "- The subtitle and book description match the official BookLeaf Store and Flipkart listings.\n\n"
            "Amazon India typically reflects ONIX feed updates within 48–72 business hours. We will monitor the listing and confirm once it updates.\n\n"
            "Best regards,\n"
            "BookLeaf Distribution & Metadata Team"
        ),
        ai_reasoning=(
            "Categorized under 'ISBN & Metadata Issues' with 'High' priority because an incorrect ISBN/metadata display on a primary "
            "marketplace (Amazon India) directly affects discoverability and sales for a high-selling book (876 copies sold)."
        ),
        ai_tokens_used=430,
        ai_provider_status="success",
        assigned_to_id=None,
        created_at=tkt3_created,
        updated_at=tkt3_created,
    )
    db.add(tkt3)
    db.flush()

    db.add(
        TicketMessage(
            ticket_id=tkt3.id,
            sender_id=rohit.id,
            sender_role="author",
            sender_name=rohit.name,
            message=tkt3.description,
            created_at=tkt3_created,
        )
    )

    # Ticket 4: Vikram Joshi (AUTH004) on BK006 ("Debugging Life") about blurry print quality
    vikram = authors_by_code["AUTH004"]
    bk006 = books_by_code["BK006"]
    tkt4_created = now - timedelta(hours=3)
    tkt4 = Ticket(
        ticket_code="TKT-1004",
        author_id=vikram.id,
        book_id=bk006.id,
        subject="Blurry interior diagrams and faded ink on recent batch of Debugging Life (BK006)",
        description=(
            "Hello Support, three readers who ordered 'Debugging Life' (BK006) this week sent me photos showing that "
            "pages 42 to 58 have blurry flowcharts, faded black ink, and slight page-edge trimming defects. Since this book "
            "is printed In-House, please urgently inspect the print file and replace the defective copies!"
        ),
        attachment_name="defective_print_pages_42_58.jpg",
        status="Open",
        category="Printing & Quality",
        priority="Critical",
        ai_draft_response=(
            "Dear Vikram,\n\n"
            "We sincerely apologize for the print quality issue experienced by your readers on recent copies of *Debugging Life* (BK006).\n\n"
            "Because *Debugging Life* is fulfilled through our **In-House** print facility, I have immediately escalated this ticket as **Critical** "
            "to our Quality Assurance & Print Production lead to:\n"
            "1. Inspect the master print-ready PDF for pages 42–58 and recalibrate the press ink density and trim settings.\n"
            "2. Dispatch complimentary replacement copies directly to the affected readers at no cost.\n\n"
            "Could you please reply with the order IDs or shipping addresses for the three affected copies so we can ship their replacements right away?\n\n"
            "Warm regards,\n"
            "BookLeaf Quality & Support Team"
        ),
        ai_reasoning=(
            "Classified as 'Printing & Quality' with 'Critical' priority because physical print defects (blurry pages 42-58, faded ink, "
            "trimming errors) are impacting paying customers of an In-House printed book (534 copies sold) and require immediate QA intervention."
        ),
        ai_tokens_used=448,
        ai_provider_status="success",
        assigned_to_id=ops_admin.id,
        created_at=tkt4_created,
        updated_at=tkt4_created,
    )
    db.add(tkt4)
    db.flush()

    db.add(
        TicketMessage(
            ticket_id=tkt4.id,
            sender_id=vikram.id,
            sender_role="author",
            sender_name=vikram.name,
            message=tkt4.description,
            created_at=tkt4_created,
        )
    )

    db.commit()

