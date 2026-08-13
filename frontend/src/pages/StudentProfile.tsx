import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { ListingCard } from '../components/ListingCard'
import { EmptyState, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { TRUST_LABEL, avatarUrl, timeAgo } from '../lib/format'
import type { Listing, Profile, Review } from '../lib/types'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'

export function StudentProfile() {
  const { id } = useParams()
  const userId = Number(id)
  const { user } = useAuth()
  const { push } = useToast()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    try {
      const [p, l, r] = await Promise.all([
        api.profile(userId),
        api.listings({ seller_id: userId, page_size: 12 }),
        api.reviews(userId),
      ])
      setProfile(p)
      setListings(l.items)
      setReviews(r)
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }, [userId, push])

  useEffect(() => {
    void load()
  }, [load])

  if (!profile) return <Spinner />

  async function submitReview(event: React.FormEvent) {
    event.preventDefault()
    try {
      await api.createReview({ seller_id: userId, rating, comment: comment.trim() || null })
      setComment('')
      push('Review posted', 'success')
      void load()
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center gap-5 p-6">
        <img
          src={avatarUrl(profile.avatar_seed)}
          alt=""
          className="h-20 w-20 rounded-2xl border border-white/10 bg-ink-800"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl">{profile.name}</h1>
          <p className="text-sm text-slate-400">
            {profile.campus}
            {profile.hostel_block ? ` · ${profile.hostel_block}` : ''}
            {profile.grad_year ? ` · Class of ${profile.grad_year}` : ''}
          </p>
          {profile.bio && <p className="mt-2 text-sm text-slate-300">{profile.bio}</p>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-4 text-center">
          <p className="font-display text-4xl text-mint-400">{profile.trust_score}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {TRUST_LABEL[profile.trust_tier] ?? 'Student'}
          </p>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg">Why this score</h2>
        <div className="flex flex-wrap gap-2">
          {profile.trust_signals.map((signal) => (
            <span
              key={signal}
              className="rounded-full border border-mint-400/25 bg-mint-500/10 px-3 py-1 text-xs text-mint-400"
            >
              ✓ {signal}
            </span>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {profile.completed_deals} completed deals · {profile.reviews} reviews
          {profile.rating ? ` · ${profile.rating}★ average` : ''} · joined {timeAgo(profile.created_at)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Listings by {profile.name.split(' ')[0]}</h2>
        {listings.length === 0 ? (
          <EmptyState icon="📦" title="No listings right now" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Reviews</h2>
        {user && user.id !== userId && (
          <form onSubmit={submitReview} className="card space-y-3 p-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`text-2xl transition ${value <= rating ? 'text-amber-400' : 'text-slate-700'}`}
                  aria-label={`${value} stars`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              className="input resize-none"
              placeholder="Turned up on time, item was exactly as described."
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <button type="submit" className="btn-primary">
              Post review
            </button>
          </form>
        )}
        {reviews.length === 0 ? (
          <EmptyState icon="⭐" title="No reviews yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {reviews.map((review) => (
              <div key={review.id} className="card space-y-1 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200">{review.author_name}</span>
                  <span className="text-amber-400">{'★'.repeat(review.rating)}</span>
                </div>
                {review.comment && <p className="text-sm text-slate-400">{review.comment}</p>}
                <p className="text-[11px] text-slate-600">{timeAgo(review.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
