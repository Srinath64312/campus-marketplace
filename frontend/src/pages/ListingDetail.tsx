import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { CampusMap } from '../components/CampusMap'
import { ListingCard } from '../components/ListingCard'
import { DealBadge, Modal, Spinner, TrustBadge } from '../components/ui'
import { api } from '../lib/api'
import {
  CATEGORY_ICON,
  CONDITION_LABEL,
  MODE_LABEL,
  daysUntil,
  rupees,
  timeAgo,
  titleCase,
} from '../lib/format'
import type { Listing, SwapMatch } from '../lib/types'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'

const REPORT_REASONS = ['Spam or scam', 'Prohibited item', 'Wrong category', 'Already sold', 'Offensive content']

export function ListingDetail() {
  const { id } = useParams()
  const listingId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { push } = useToast()

  const [listing, setListing] = useState<Listing | null>(null)
  const [similar, setSimilar] = useState<Listing[]>([])
  const [swaps, setSwaps] = useState<SwapMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [item, similarItems] = await Promise.all([api.listing(listingId), api.similar(listingId)])
      setListing(item)
      setSimilar(similarItems)
      if (item.mode === 'swap') setSwaps(await api.swapsFor(listingId))
    } catch (error) {
      push((error as Error).message, 'error')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [listingId, navigate, push])

  useEffect(() => {
    void load()
  }, [load])

  if (loading || !listing) return <Spinner label="Loading listing…" />

  const isOwner = user?.id === listing.seller.id
  const markdownDays = daysUntil(listing.markdown_deadline)

  async function toggleSave() {
    if (!listing) return
    if (!user) {
      push('Log in to save this', 'info')
      return
    }
    try {
      if (listing.saved) await api.removeFromWishlist(listing.id)
      else await api.addToWishlist(listing.id)
      setListing({ ...listing, saved: !listing.saved })
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  async function contactSeller(event: React.FormEvent) {
    event.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    setSending(true)
    try {
      await api.sendMessage(listingId, message)
      setMessage('')
      push('Message sent — continue in Chat', 'success')
      navigate(`/chat?listing=${listingId}&with=${listing?.seller.id}`)
    } catch (error) {
      push((error as Error).message, 'error')
    } finally {
      setSending(false)
    }
  }

  async function remove() {
    if (!window.confirm('Delete this listing permanently?')) return
    try {
      await api.deleteListing(listingId)
      push('Listing deleted', 'success')
      navigate('/dashboard')
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  async function submitReport() {
    try {
      const result = await api.report({ listing_id: listingId, reason: reportReason })
      setReportOpen(false)
      push(
        result.auto_hidden
          ? 'Reported. This listing has been auto-hidden pending review.'
          : 'Reported. Thanks for keeping campus clean.',
        'success',
      )
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/3] bg-ink-800">
              {listing.images[activeImage] ? (
                <img
                  src={listing.images[activeImage]}
                  alt={listing.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-7xl opacity-50">
                  {CATEGORY_ICON[listing.category]}
                </div>
              )}
              <div className="absolute left-3 top-3 flex gap-2">
                <span className="rounded-full border border-white/10 bg-ink-950/80 px-3 py-1 text-xs font-semibold text-slate-200">
                  {MODE_LABEL[listing.mode]}
                </span>
                {listing.deal && <DealBadge deal={listing.deal} />}
              </div>
            </div>
            {listing.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {listing.images.map((url, index) => (
                  <button
                    key={url}
                    onClick={() => setActiveImage(index)}
                    className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border ${
                      index === activeImage ? 'border-glow-400' : 'border-white/10'
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl">{listing.title}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Posted {timeAgo(listing.created_at)} · {listing.views} views ·{' '}
                  {listing.wishlist_count} saved
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl text-white">{rupees(listing.effective_price)}</p>
                {listing.effective_price < listing.price && (
                  <p className="text-sm text-slate-500 line-through">{rupees(listing.price)}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="chip">
                {CATEGORY_ICON[listing.category]} {titleCase(listing.category)}
              </span>
              <span className="chip">{CONDITION_LABEL[listing.condition]}</span>
              {listing.tags.map((tag) => (
                <Link key={tag} to={`/?q=${encodeURIComponent(tag)}`} className="chip">
                  #{tag}
                </Link>
              ))}
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {listing.description || 'No description provided.'}
            </p>

            {markdownDays !== null && markdownDays > 0 && listing.auto_markdown_percent > 0 && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-400">
                ⏳ Seller is leaving campus. This price auto-drops to{' '}
                {rupees(listing.price * (1 - listing.auto_markdown_percent / 100))} over the next{' '}
                {markdownDays} days — or grab it now before someone else does.
              </div>
            )}

            {listing.deal && (
              <div className="rounded-xl border border-white/10 bg-ink-800/60 p-4">
                <p className="text-sm text-slate-300">
                  Campus median for {titleCase(listing.category)} in this condition is{' '}
                  <b className="text-white">{rupees(listing.deal.market_price)}</b>. This ask is{' '}
                  <b className={listing.deal.delta_percent < 0 ? 'text-mint-400' : 'text-amber-400'}>
                    {Math.abs(listing.deal.delta_percent)}%{' '}
                    {listing.deal.delta_percent < 0 ? 'below' : 'above'}
                  </b>{' '}
                  it, across {listing.deal.basis} comparable listings.
                </p>
              </div>
            )}
          </div>

          {swaps.length > 0 && (
            <div className="card space-y-3 p-5">
              <h2 className="text-lg">⇄ Trades available right now</h2>
              <p className="text-sm text-slate-400">
                Direct swaps and multi-person rings that include this item.
              </p>
              {swaps.slice(0, 4).map((match, index) => (
                <div key={index} className="rounded-xl border border-glow-400/20 bg-glow-500/5 p-3">
                  <p className="text-sm text-glow-400">
                    {match.length === 2 ? 'Direct swap' : `${match.length}-way ring`} ·{' '}
                    {Math.round(match.strength * 100)}% fit
                  </p>
                  <p className="mt-1 text-sm text-slate-300">{match.summary}</p>
                </div>
              ))}
              <Link to="/swaps" className="btn-ghost w-full">
                See all swap rings
              </Link>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card space-y-4 p-5">
            <TrustBadge seller={listing.seller} />
            {listing.seller.hostel_block && (
              <p className="text-xs text-slate-500">Usually around {listing.seller.hostel_block}</p>
            )}

            {isOwner ? (
              <div className="flex gap-2">
                <Link to={`/listing/${listing.id}/edit`} className="btn-ghost flex-1">
                  Edit
                </Link>
                <button onClick={remove} className="btn-danger flex-1">
                  Delete
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={contactSeller} className="space-y-2">
                  <label className="label" htmlFor="message">
                    Message the seller
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={3}
                    className="input resize-none"
                    placeholder="Hi! Is this still available? Can we meet at the library steps?"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <button type="submit" className="btn-primary w-full" disabled={sending}>
                    {sending ? 'Sending…' : '💬 Send message'}
                  </button>
                </form>
                <div className="flex gap-2">
                  <button onClick={toggleSave} className="btn-ghost flex-1">
                    {listing.saved ? '♥ Saved' : '♡ Save'}
                  </button>
                  <button onClick={() => setReportOpen(true)} className="btn-ghost flex-1">
                    ⚑ Report
                  </button>
                </div>
              </>
            )}
          </div>

          {listing.meetup_spot && listing.location_lat !== null && listing.location_lng !== null && (
            <div className="card space-y-3 p-5">
              <h2 className="text-lg">Hand-off spot</h2>
              <p className="text-sm text-slate-400">📍 {listing.meetup_spot}</p>
              <CampusMap
                height={160}
                selected={listing.meetup_spot}
                spots={[
                  {
                    name: listing.meetup_spot,
                    lat: listing.location_lat,
                    lng: listing.location_lng,
                    safety: 'high',
                    hours: '—',
                  },
                ]}
              />
            </div>
          )}
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Similar on campus</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {similar.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}

      <Modal open={reportOpen} title="Report this listing" onClose={() => setReportOpen(false)}>
        <div className="space-y-3">
          <select
            className="input"
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
          >
            {REPORT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Three independent reports hide a listing automatically until a human looks at it.
          </p>
          <button onClick={submitReport} className="btn-danger w-full">
            Submit report
          </button>
        </div>
      </Modal>
    </div>
  )
}
