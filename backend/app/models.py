from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Category(str, Enum):
    books = "books"
    electronics = "electronics"
    calculators = "calculators"
    cycles = "cycles"
    notes = "notes"
    furniture = "furniture"
    stationery = "stationery"
    apparel = "apparel"
    sports = "sports"
    lab_equipment = "lab_equipment"
    other = "other"


class Condition(str, Enum):
    new = "new"
    like_new = "like_new"
    good = "good"
    fair = "fair"
    worn = "worn"


class ListingMode(str, Enum):
    sell = "sell"
    swap = "swap"
    giveaway = "giveaway"


class ListingStatus(str, Enum):
    active = "active"
    reserved = "reserved"
    sold = "sold"
    archived = "archived"


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    hashed_password: str
    campus: str = "Main Campus"
    hostel_block: str | None = None
    grad_year: int | None = None
    bio: str | None = None
    avatar_seed: str = "student"
    is_email_verified: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class Listing(SQLModel, table=True):
    __tablename__ = "listings"

    id: int | None = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(index=True)
    description: str = ""
    price: float = 0.0
    category: Category = Field(default=Category.other, index=True)
    condition: Condition = Field(default=Condition.good, index=True)
    mode: ListingMode = Field(default=ListingMode.sell, index=True)
    status: ListingStatus = Field(default=ListingStatus.active, index=True)
    images: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # What the seller wants in return when mode == swap (free text + category hint).
    swap_wants: str | None = None
    swap_wants_category: Category | None = None
    meetup_spot: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    views: int = 0
    # "Leaving campus" urgency: auto markdown drops the price until the deadline.
    auto_markdown_percent: float = 0.0
    markdown_deadline: datetime | None = None
    original_price: float | None = None
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow)


class WishlistItem(SQLModel, table=True):
    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("user_id", "listing_id", name="uq_wishlist_user_listing"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)


class SavedSearch(SQLModel, table=True):
    """A standing want-ad: new listings that match fire an alert."""

    __tablename__ = "saved_searches"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    label: str
    query: str | None = None
    category: Category | None = None
    max_price: float | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Alert(SQLModel, table=True):
    __tablename__ = "alerts"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    listing_id: int | None = Field(default=None, foreign_key="listings.id")
    kind: str = "match"  # match | price_drop | swap
    message: str = ""
    read: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    sender_id: int = Field(foreign_key="users.id", index=True)
    recipient_id: int = Field(foreign_key="users.id", index=True)
    body: str
    read: bool = False
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Report(SQLModel, table=True):
    __tablename__ = "reports"

    id: int | None = Field(default=None, primary_key=True)
    listing_id: int = Field(foreign_key="listings.id", index=True)
    reporter_id: int = Field(foreign_key="users.id")
    reason: str
    details: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Review(SQLModel, table=True):
    __tablename__ = "reviews"

    id: int | None = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="users.id", index=True)
    author_id: int = Field(foreign_key="users.id")
    listing_id: int | None = Field(default=None, foreign_key="listings.id")
    rating: int = 5
    comment: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
