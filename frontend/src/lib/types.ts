export const CATEGORIES = [
  'books',
  'electronics',
  'calculators',
  'cycles',
  'notes',
  'furniture',
  'stationery',
  'apparel',
  'sports',
  'lab_equipment',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'worn'] as const
export type Condition = (typeof CONDITIONS)[number]

export const MODES = ['sell', 'swap', 'giveaway'] as const
export type Mode = (typeof MODES)[number]

export type ListingStatus = 'active' | 'reserved' | 'sold' | 'archived'

export interface SellerSummary {
  id: number
  name: string
  avatar_seed: string
  hostel_block: string | null
  trust_score: number
  trust_tier: string
  rating: number | null
}

export interface DealScore {
  label: 'steal' | 'good_deal' | 'fair' | 'above_market'
  score: number
  delta_percent: number
  market_price: number
  basis: number
}

export interface Listing {
  id: number
  title: string
  description: string
  price: number
  effective_price: number
  category: Category
  condition: Condition
  mode: Mode
  status: ListingStatus
  images: string[]
  tags: string[]
  swap_wants: string | null
  swap_wants_category: Category | null
  meetup_spot: string | null
  location_lat: number | null
  location_lng: number | null
  views: number
  auto_markdown_percent: number
  markdown_deadline: string | null
  original_price: number | null
  created_at: string
  updated_at: string
  seller: SellerSummary
  deal: DealScore | null
  saved: boolean
  wishlist_count: number
}

export interface ListingPage {
  items: Listing[]
  total: number
  page: number
  page_size: number
  facets: Record<string, Record<string, number>>
}

export interface User {
  id: number
  name: string
  email: string
  campus: string
  hostel_block: string | null
  grad_year: number | null
  bio: string | null
  avatar_seed: string
  is_email_verified: boolean
  created_at: string
}

export interface Profile extends User {
  trust_score: number
  trust_tier: string
  rating: number | null
  reviews: number
  completed_deals: number
  trust_signals: string[]
  active_listings: number
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface PriceSuggestion {
  suggested: number
  low: number
  high: number
  confidence: number
  currency: string
  comparables: number
  rationale: string[]
}

export interface SavedSearch {
  id: number
  label: string
  query: string | null
  category: Category | null
  max_price: number | null
  created_at: string
}

export interface Alert {
  id: number
  kind: string
  message: string
  read: boolean
  listing_id: number | null
  created_at: string
}

export interface ChatMessage {
  id: number
  listing_id: number
  sender_id: number
  recipient_id: number
  body: string
  read: boolean
  created_at: string
}

export interface Thread {
  listing_id: number
  listing_title: string
  listing_image: string | null
  counterpart: SellerSummary
  last_message: string
  last_from_me: boolean
  last_at: string
  unread: number
}

export interface SwapMatch {
  listings: Listing[]
  strength: number
  length: number
  summary: string
}

export interface Stats {
  total_listings: number
  active_listings: number
  given_away: number
  students: number
  median_price: number
  trending_categories: { category: string; count: number }[]
  daily_new: { date: string; count: number }[]
  swap_rings_open: number
}

export interface MeetupSpot {
  name: string
  lat: number
  lng: number
  safety: string
  hours: string
}

export interface Review {
  id: number
  seller_id: number
  author_id: number
  author_name: string
  rating: number
  comment: string | null
  created_at: string
}
