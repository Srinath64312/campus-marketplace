from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import Category, Condition, ListingMode, ListingStatus


class SignupRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=6, max_length=128)
    campus: str = "Main Campus"
    hostel_block: str | None = None
    grad_year: int | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr
    campus: str
    hostel_block: str | None = None
    grad_year: int | None = None
    bio: str | None = None
    avatar_seed: str
    is_email_verified: bool
    created_at: datetime


class UserProfile(UserPublic):
    trust_score: int
    trust_tier: str
    rating: float | None
    reviews: int
    completed_deals: int
    trust_signals: list[str]
    active_listings: int


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserUpdate(BaseModel):
    name: str | None = None
    bio: str | None = None
    campus: str | None = None
    hostel_block: str | None = None
    grad_year: int | None = None
    avatar_seed: str | None = None


class ListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = ""
    price: float = Field(default=0, ge=0)
    category: Category = Category.other
    condition: Condition = Condition.good
    mode: ListingMode = ListingMode.sell
    images: list[str] = []
    tags: list[str] = []
    swap_wants: str | None = None
    swap_wants_category: Category | None = None
    meetup_spot: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    auto_markdown_percent: float = Field(default=0, ge=0, le=50)
    markdown_deadline: datetime | None = None


class ListingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = None
    price: float | None = Field(default=None, ge=0)
    category: Category | None = None
    condition: Condition | None = None
    mode: ListingMode | None = None
    status: ListingStatus | None = None
    images: list[str] | None = None
    tags: list[str] | None = None
    swap_wants: str | None = None
    swap_wants_category: Category | None = None
    meetup_spot: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    auto_markdown_percent: float | None = Field(default=None, ge=0, le=50)
    markdown_deadline: datetime | None = None


class SellerSummary(BaseModel):
    id: int
    name: str
    avatar_seed: str
    hostel_block: str | None = None
    trust_score: int
    trust_tier: str
    rating: float | None = None


class DealScoreOut(BaseModel):
    label: str
    score: int
    delta_percent: float
    market_price: float
    basis: int


class ListingOut(BaseModel):
    id: int
    title: str
    description: str
    price: float
    effective_price: float
    category: Category
    condition: Condition
    mode: ListingMode
    status: ListingStatus
    images: list[str]
    tags: list[str]
    swap_wants: str | None
    swap_wants_category: Category | None
    meetup_spot: str | None
    location_lat: float | None
    location_lng: float | None
    views: int
    auto_markdown_percent: float
    markdown_deadline: datetime | None
    original_price: float | None
    created_at: datetime
    updated_at: datetime
    seller: SellerSummary
    deal: DealScoreOut | None = None
    saved: bool = False
    wishlist_count: int = 0


class ListingPage(BaseModel):
    items: list[ListingOut]
    total: int
    page: int
    page_size: int
    facets: dict[str, dict[str, int]]


class PriceSuggestRequest(BaseModel):
    title: str
    description: str = ""
    category: Category = Category.other
    condition: Condition = Condition.good
    age_months: int = Field(default=0, ge=0, le=240)
    listing_id: int | None = None


class PriceSuggestResponse(BaseModel):
    suggested: float
    low: float
    high: float
    confidence: float
    currency: str
    comparables: int
    rationale: list[str]


class SavedSearchCreate(BaseModel):
    label: str
    query: str | None = None
    category: Category | None = None
    max_price: float | None = None


class SavedSearchOut(SavedSearchCreate):
    id: int
    created_at: datetime


class AlertOut(BaseModel):
    id: int
    kind: str
    message: str
    read: bool
    listing_id: int | None
    created_at: datetime


class MessageCreate(BaseModel):
    listing_id: int
    body: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: int
    listing_id: int
    sender_id: int
    recipient_id: int
    body: str
    read: bool
    created_at: datetime


class ThreadOut(BaseModel):
    listing_id: int
    listing_title: str
    listing_image: str | None
    counterpart: SellerSummary
    last_message: str
    last_from_me: bool
    last_at: datetime
    unread: int


class ReportCreate(BaseModel):
    listing_id: int
    reason: str
    details: str | None = None


class ReviewCreate(BaseModel):
    seller_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = None
    listing_id: int | None = None


class ReviewOut(BaseModel):
    id: int
    seller_id: int
    author_id: int
    author_name: str
    rating: int
    comment: str | None
    created_at: datetime


class SwapMatchOut(BaseModel):
    listings: list[ListingOut]
    strength: float
    length: int
    summary: str


class StatsOut(BaseModel):
    total_listings: int
    active_listings: int
    given_away: int
    students: int
    median_price: float
    trending_categories: list[dict]
    daily_new: list[dict]
    swap_rings_open: int


class UploadResponse(BaseModel):
    url: str
