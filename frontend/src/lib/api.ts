import type {
  Alert,
  AuthResponse,
  ChatMessage,
  Listing,
  ListingPage,
  MeetupSpot,
  PriceSuggestion,
  Profile,
  Review,
  SavedSearch,
  Stats,
  SwapMatch,
  Thread,
  User,
} from './types'

export const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')
const TOKEN_KEY = 'campus-marketplace-token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const detail = payload?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg ?? '').join(', ')
          : `Request failed (${response.status})`
    throw new ApiError(response.status, message)
  }
  return payload as T
}

function qs(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)))
    else search.append(key, String(value))
  }
  const out = search.toString()
  return out ? `?${out}` : ''
}

export interface ListingQuery {
  q?: string
  category?: string[]
  condition?: string[]
  mode?: string
  status?: string
  seller_id?: number
  min_price?: number
  max_price?: number
  free_only?: boolean
  lat?: number
  lng?: number
  radius_km?: number
  sort?: string
  page?: number
  page_size?: number
}

export const api = {
  signup: (body: Record<string, unknown>) =>
    request<AuthResponse>('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/api/auth/me'),
  updateMe: (body: Record<string, unknown>) =>
    request<Profile>('/api/me', { method: 'PATCH', body: JSON.stringify(body) }),

  listings: (query: ListingQuery = {}) => request<ListingPage>(`/api/listings${qs(query)}`),
  listing: (id: number) => request<Listing>(`/api/listings/${id}`),
  similar: (id: number) => request<Listing[]>(`/api/listings/${id}/similar`),
  createListing: (body: Record<string, unknown>) =>
    request<Listing>('/api/listings', { method: 'POST', body: JSON.stringify(body) }),
  updateListing: (id: number, body: Record<string, unknown>) =>
    request<Listing>(`/api/listings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteListing: (id: number) => request<void>(`/api/listings/${id}`, { method: 'DELETE' }),

  wishlist: () => request<Listing[]>('/api/wishlist'),
  addToWishlist: (id: number) => request<Listing>(`/api/wishlist/${id}`, { method: 'POST' }),
  removeFromWishlist: (id: number) => request<void>(`/api/wishlist/${id}`, { method: 'DELETE' }),

  savedSearches: () => request<SavedSearch[]>('/api/saved-searches'),
  createSavedSearch: (body: Record<string, unknown>) =>
    request<SavedSearch>('/api/saved-searches', { method: 'POST', body: JSON.stringify(body) }),
  deleteSavedSearch: (id: number) => request<void>(`/api/saved-searches/${id}`, { method: 'DELETE' }),

  alerts: () => request<Alert[]>('/api/alerts'),
  markAlertsRead: () => request<void>('/api/alerts/read', { method: 'POST' }),

  threads: () => request<Thread[]>('/api/chat/threads'),
  thread: (listingId: number, counterpartId: number) =>
    request<ChatMessage[]>(`/api/chat/${listingId}/${counterpartId}`),
  sendMessage: (listingId: number, body: string) =>
    request<ChatMessage>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ listing_id: listingId, body }),
    }),

  priceSuggest: (body: Record<string, unknown>) =>
    request<PriceSuggestion>('/api/ai/price-suggest', { method: 'POST', body: JSON.stringify(body) }),

  swapRings: () => request<SwapMatch[]>('/api/swaps/rings'),
  swapsFor: (id: number) => request<SwapMatch[]>(`/api/swaps/for/${id}`),

  stats: () => request<Stats>('/api/stats'),
  meetupSpots: () => request<MeetupSpot[]>('/api/meetup-spots'),

  profile: (id: number) => request<Profile>(`/api/users/${id}`),
  reviews: (id: number) => request<Review[]>(`/api/users/${id}/reviews`),
  createReview: (body: Record<string, unknown>) =>
    request<Review>('/api/reviews', { method: 'POST', body: JSON.stringify(body) }),
  report: (body: Record<string, unknown>) =>
    request<{ reports: number; auto_hidden: boolean }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  upload: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ url: string }>('/api/uploads', { method: 'POST', body: form })
  },
}
