"""Demo data: enough listings for the price model, deal badges and swap rings to be alive."""

from __future__ import annotations

import random
from datetime import timedelta

from sqlmodel import Session, select

from app.db import engine, init_db
from app.models import (
    Category,
    Condition,
    Listing,
    ListingMode,
    ListingStatus,
    Message,
    Review,
    User,
    utcnow,
)
from app.routers.stats import MEETUP_SPOTS
from app.security import hash_password

DEMO_PASSWORD = "campus123"

STUDENTS = [
    ("aarav@campus.ac.in", "Aarav Mehta", "Hostel A", 2026, "Final year CSE. Selling off my setup."),
    ("diya@campus.ac.in", "Diya Rao", "Hostel B", 2027, "ECE. Buys books, sells notes."),
    ("kabir@campus.ac.in", "Kabir Shah", "Hostel A", 2026, "Cycling club. Always trading gear."),
    ("meera@campus.ac.in", "Meera Nair", "Hostel C", 2028, "First year, furnishing my room."),
    ("rohan@campus.ac.in", "Rohan Iyer", "Hostel B", 2026, "Mech. Leaving campus in June."),
    ("sara@campus.ac.in", "Sara Khan", "Hostel C", 2027, "Design. Trades sketching gear."),
]

# (title, description, price, category, condition, mode, tags, swap_wants, swap_wants_category)
ITEMS: list[tuple] = [
    (
        "Casio FX-991EX scientific calculator",
        "Barely used, bought for engineering maths. All functions work, comes with slide cover.",
        1100,
        Category.calculators,
        Condition.like_new,
        ListingMode.sell,
        ["casio", "exam", "engineering"],
        None,
        None,
    ),
    (
        "Casio FX-82MS calculator",
        "Reliable basic scientific calculator, some scratches on the back.",
        450,
        Category.calculators,
        Condition.fair,
        ListingMode.sell,
        ["casio", "budget"],
        None,
        None,
    ),
    (
        "TI-30X calculator, exam ready",
        "Allowed in all department exams. Original battery cover intact.",
        900,
        Category.calculators,
        Condition.good,
        ListingMode.sell,
        ["ti", "exam"],
        None,
        None,
    ),
    (
        "Engineering Mathematics vol 1 & 2",
        "B.S. Grewal set. Light pencil marking in first three chapters.",
        520,
        Category.books,
        Condition.good,
        ListingMode.sell,
        ["maths", "semester1", "grewal"],
        None,
        None,
    ),
    (
        "Operating System Concepts (dinosaur book)",
        "Silberschatz 10th edition. Hardcover, spine intact.",
        700,
        Category.books,
        Condition.like_new,
        ListingMode.sell,
        ["os", "cse", "silberschatz"],
        None,
        None,
    ),
    (
        "Introduction to Algorithms - CLRS",
        "Third edition, a couple of dog-eared pages, otherwise clean.",
        850,
        Category.books,
        Condition.good,
        ListingMode.sell,
        ["clrs", "algorithms", "cse"],
        None,
        None,
    ),
    (
        "Signals and Systems textbook",
        "Oppenheim. Photocopy edition, fully readable.",
        180,
        Category.books,
        Condition.fair,
        ListingMode.sell,
        ["ece", "photocopy"],
        None,
        None,
    ),
    (
        "Complete DBMS handwritten notes",
        "Full semester, unit 1 to 5, colour coded with past year questions marked.",
        220,
        Category.notes,
        Condition.like_new,
        ListingMode.sell,
        ["dbms", "handwritten", "cse"],
        None,
        None,
    ),
    (
        "Thermodynamics notes + solved papers",
        "Three years of solved question papers bundled in.",
        160,
        Category.notes,
        Condition.good,
        ListingMode.sell,
        ["mech", "solved"],
        None,
        None,
    ),
    (
        "Dell Inspiron 15 laptop, i5 11th gen",
        "8GB RAM, 512GB SSD. Battery holds about 4 hours. Original charger included.",
        27500,
        Category.electronics,
        Condition.good,
        ListingMode.sell,
        ["dell", "laptop", "i5"],
        None,
        None,
    ),
    (
        "Lenovo IdeaPad slim, 8GB RAM",
        "Used for two years of coursework, keyboard perfect, minor lid scratch.",
        22000,
        Category.electronics,
        Condition.fair,
        ListingMode.sell,
        ["lenovo", "laptop"],
        None,
        None,
    ),
    (
        "Logitech wireless mouse + keyboard combo",
        "Silent switches, dongle included, batteries new.",
        1200,
        Category.electronics,
        Condition.like_new,
        ListingMode.sell,
        ["logitech", "peripherals"],
        None,
        None,
    ),
    (
        "boAt Rockerz headphones",
        "Over-ear, sealed replacement earcups included. Great for library sessions.",
        1400,
        Category.electronics,
        Condition.good,
        ListingMode.sell,
        ["headphones", "boat"],
        None,
        None,
    ),
    (
        "Table lamp with adjustable arm",
        "Warm/cool toggle. Perfect for late night assignment grinds.",
        450,
        Category.furniture,
        Condition.good,
        ListingMode.sell,
        ["lamp", "study"],
        None,
        None,
    ),
    (
        "Study table, foldable",
        "Fits under a hostel cot when folded. Slight water mark on one corner.",
        1600,
        Category.furniture,
        Condition.fair,
        ListingMode.sell,
        ["desk", "hostel"],
        None,
        None,
    ),
    (
        "Bookshelf, 4 shelves",
        "Metal frame, survived three tenants, will survive three more.",
        1350,
        Category.furniture,
        Condition.good,
        ListingMode.sell,
        ["shelf", "hostel"],
        None,
        None,
    ),
    (
        "Hero Sprint 21-speed geared cycle",
        "Serviced last month, new brake pads, front suspension works.",
        6200,
        Category.cycles,
        Condition.good,
        ListingMode.sell,
        ["hero", "geared", "gear cycle"],
        None,
        None,
    ),
    (
        "Btwin My Bike single speed",
        "Perfect campus commuter, basket included.",
        4300,
        Category.cycles,
        Condition.fair,
        ListingMode.sell,
        ["btwin", "commuter"],
        None,
        None,
    ),
    (
        "Cycle helmet and lock set",
        "Medium size helmet, cable lock with two keys.",
        700,
        Category.sports,
        Condition.good,
        ListingMode.sell,
        ["helmet", "lock", "cycle"],
        None,
        None,
    ),
    (
        "Badminton racket, Yonex",
        "Restrung two weeks ago at 26 lbs.",
        1500,
        Category.sports,
        Condition.like_new,
        ListingMode.sell,
        ["yonex", "badminton"],
        None,
        None,
    ),
    (
        "Lab coat and safety goggles",
        "Size M, washed and pressed. Goggles unscratched.",
        350,
        Category.lab_equipment,
        Condition.good,
        ListingMode.sell,
        ["labcoat", "chemistry"],
        None,
        None,
    ),
    (
        "Drafting kit with mini drafter",
        "Full first-year engineering drawing kit.",
        600,
        Category.stationery,
        Condition.good,
        ListingMode.sell,
        ["drafter", "drawing"],
        None,
        None,
    ),
    (
        "Free: bucket, mug and hangers",
        "Graduating, taking nothing home. Come pick it up.",
        0,
        Category.other,
        Condition.fair,
        ListingMode.giveaway,
        ["free", "hostel"],
        None,
        None,
    ),
    (
        "Free: half-used stationery box",
        "Pens, highlighters, sticky notes. Yours if you carry it.",
        0,
        Category.stationery,
        Condition.fair,
        ListingMode.giveaway,
        ["free", "stationery"],
        None,
        None,
    ),
    # --- Swap listings: deliberately arranged so a three-way ring exists ---
    (
        "Swap: my guitar for a cycle",
        "Yamaha F310 acoustic in good shape. Want a working campus cycle in return.",
        7000,
        Category.other,
        Condition.good,
        ListingMode.swap,
        ["guitar", "yamaha", "music"],
        "cycle bicycle geared",
        Category.cycles,
    ),
    (
        "Swap: my geared cycle for a laptop",
        "Firefox 21-speed, serviced. Looking for a usable laptop for coursework.",
        6800,
        Category.cycles,
        Condition.good,
        ListingMode.swap,
        ["cycle", "geared", "firefox"],
        "laptop notebook dell lenovo",
        Category.electronics,
    ),
    (
        "Swap: spare laptop for a guitar",
        "HP Pavilion, 8GB RAM, works fine as a second machine. Want an acoustic guitar.",
        21000,
        Category.electronics,
        Condition.fair,
        ListingMode.swap,
        ["hp", "laptop", "pavilion"],
        "guitar acoustic yamaha",
        Category.other,
    ),
    (
        "Swap: DSLR for a mechanical keyboard",
        "Nikon D3400 with kit lens. Would trade for a good mechanical keyboard.",
        18000,
        Category.electronics,
        Condition.good,
        ListingMode.swap,
        ["nikon", "dslr", "camera"],
        "mechanical keyboard",
        Category.electronics,
    ),
    (
        "Swap: mechanical keyboard for a DSLR",
        "Keychron K2, brown switches, hot-swappable. Want to get into photography.",
        6500,
        Category.electronics,
        Condition.like_new,
        ListingMode.swap,
        ["keychron", "mechanical", "keyboard"],
        "dslr camera nikon canon",
        Category.electronics,
    ),
]

REVIEW_COMMENTS = [
    "Met at the library steps, exactly as described.",
    "Quick replies and fair on price.",
    "Item was cleaner than the photos, honestly.",
    "Showed up late but sorted it out.",
    "Would trade with again.",
]


def seed_if_empty() -> int:
    init_db()
    with Session(engine) as session:
        if session.exec(select(User)).first():
            return 0
        return _seed(session)


def _seed(session: Session) -> int:
    rng = random.Random(20)
    now = utcnow()

    users: list[User] = []
    for index, (email, name, block, grad, bio) in enumerate(STUDENTS):
        user = User(
            email=email,
            name=name,
            hashed_password=hash_password(DEMO_PASSWORD),
            hostel_block=block,
            grad_year=grad,
            bio=bio,
            avatar_seed=name.split()[0].lower(),
            is_email_verified=True,
            created_at=now - timedelta(days=120 - index * 12),
        )
        session.add(user)
        users.append(user)
    session.commit()
    for user in users:
        session.refresh(user)

    listings: list[Listing] = []
    for index, item in enumerate(ITEMS):
        title, description, price, category, condition, mode, tags, wants, wants_cat = item
        seller = users[index % len(users)]
        spot = MEETUP_SPOTS[index % len(MEETUP_SPOTS)]
        created = now - timedelta(days=rng.randint(0, 13), hours=rng.randint(0, 20))
        listing = Listing(
            seller_id=int(seller.id or 0),
            title=title,
            description=description,
            price=float(price),
            original_price=float(price) or None,
            category=category,
            condition=condition,
            mode=mode,
            status=ListingStatus.active,
            images=[f"https://picsum.photos/seed/campus-{index + 1}/800/600"],
            tags=tags,
            swap_wants=wants,
            swap_wants_category=wants_cat,
            meetup_spot=spot["name"],
            location_lat=float(spot["lat"]),
            location_lng=float(spot["lng"]),
            views=rng.randint(3, 180),
            created_at=created,
            updated_at=created,
        )
        listings.append(listing)
        session.add(listing)

    # One graduating seller uses the auto-markdown clock.
    listings[9].auto_markdown_percent = 25.0
    listings[9].markdown_deadline = now + timedelta(days=10)
    listings[14].auto_markdown_percent = 15.0
    listings[14].markdown_deadline = now + timedelta(days=6)

    # A couple of completed deals so trust scores are not all identical.
    listings[3].status = ListingStatus.sold
    listings[18].status = ListingStatus.sold
    session.commit()
    for listing in listings:
        session.refresh(listing)

    for index in range(9):
        seller = users[index % len(users)]
        author = users[(index + 2) % len(users)]
        session.add(
            Review(
                seller_id=int(seller.id or 0),
                author_id=int(author.id or 0),
                rating=rng.choice([5, 5, 4, 4, 3]),
                comment=REVIEW_COMMENTS[index % len(REVIEW_COMMENTS)],
                created_at=now - timedelta(days=rng.randint(1, 60)),
            )
        )

    starter = listings[9]
    buyer = users[3]
    session.add(
        Message(
            listing_id=int(starter.id or 0),
            sender_id=int(buyer.id or 0),
            recipient_id=starter.seller_id,
            body="Hi! Is the Dell still available? Can I see it at the canteen this evening?",
            created_at=now - timedelta(hours=5),
        )
    )
    session.add(
        Message(
            listing_id=int(starter.id or 0),
            sender_id=starter.seller_id,
            recipient_id=int(buyer.id or 0),
            body="Yes, still up. 6pm at the Main Canteen works for me.",
            created_at=now - timedelta(hours=4),
        )
    )
    session.commit()
    return len(listings)


if __name__ == "__main__":
    created = seed_if_empty()
    print(f"Seeded {created} listings" if created else "Database already has data, nothing seeded")
