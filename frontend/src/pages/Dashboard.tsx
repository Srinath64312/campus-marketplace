import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState, Spinner, Stat } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORY_ICON, daysUntil, rupees, timeAgo } from '../lib/format'
import type { Listing, ListingStatus } from '../lib/types'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'

const STATUSES: ListingStatus[] = ['active', 'reserved', 'sold', 'archived']

export function Dashboard() {
  const { user } = useAuth()
  const { push } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const pages = await Promise.all(
        STATUSES.map((status) => api.listings({ seller_id: user.id, status, page_size: 50 })),
      )
      setListings(pages.flatMap((page) => page.items))
    } catch (error) {
      push((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [user, push])

  useEffect(() => {
    void load()
  }, [load])

  async function setStatus(listing: Listing, status: ListingStatus) {
    try {
      const updated = await api.updateListing(listing.id, { status })
      setListings((current) => current.map((item) => (item.id === listing.id ? updated : item)))
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  async function remove(listing: Listing) {
    if (!window.confirm(`Delete “${listing.title}”?`)) return
    await api.deleteListing(listing.id)
    setListings((current) => current.filter((item) => item.id !== listing.id))
    push('Listing deleted', 'success')
  }

  if (loading) return <Spinner />

  const active = listings.filter((x) => x.status === 'active')
  const views = listings.reduce((sum, x) => sum + x.views, 0)
  const saves = listings.reduce((sum, x) => sum + x.wishlist_count, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">My listings</h1>
          <p className="text-sm text-slate-400">Track interest and mark things sold as you go.</p>
        </div>
        <Link to="/sell" className="btn-primary">
          + Post an item
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Live" value={active.length} />
        <Stat label="Total views" value={views} />
        <Stat label="Times saved" value={saves} />
        <Stat label="Sold" value={listings.filter((x) => x.status === 'sold').length} />
      </div>

      {listings.length === 0 ? (
        <EmptyState
          icon="📦"
          title="You have not posted anything yet"
          hint="That calculator in your drawer is worth something to a first-year."
          action={
            <Link to="/sell" className="btn-primary">
              Post your first item
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const markdown = daysUntil(listing.markdown_deadline)
            return (
              <div key={listing.id} className="card flex flex-wrap items-center gap-4 p-4">
                <Link
                  to={`/listing/${listing.id}`}
                  className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-800 text-2xl"
                >
                  {listing.images[0] ? (
                    <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    CATEGORY_ICON[listing.category]
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <Link to={`/listing/${listing.id}`} className="truncate font-medium hover:text-glow-400">
                    {listing.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {rupees(listing.effective_price)} · {listing.views} views ·{' '}
                    {listing.wishlist_count} saved · {timeAgo(listing.created_at)}
                    {markdown !== null && markdown > 0 && listing.auto_markdown_percent > 0
                      ? ` · auto -${listing.auto_markdown_percent}% in ${markdown}d`
                      : ''}
                  </p>
                </div>

                <select
                  value={listing.status}
                  onChange={(event) => void setStatus(listing, event.target.value as ListingStatus)}
                  className="input w-32 py-1.5 text-xs"
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <Link to={`/listing/${listing.id}/edit`} className="btn-ghost px-3 py-1.5 text-xs">
                    Edit
                  </Link>
                  <button
                    onClick={() => void remove(listing)}
                    className="btn-danger px-3 py-1.5 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
