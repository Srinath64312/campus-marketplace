import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ListingCard } from '../components/ListingCard'
import { EmptyState, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { rupees, titleCase } from '../lib/format'
import type { Listing, SavedSearch } from '../lib/types'
import { useToast } from '../store/toast'

export function Wishlist() {
  const { push } = useToast()
  const [items, setItems] = useState<Listing[]>([])
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [wishlist, saved] = await Promise.all([api.wishlist(), api.savedSearches()])
      setItems(wishlist)
      setSearches(saved)
    } catch (error) {
      push((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    void load()
  }, [load])

  async function unsave(listing: Listing) {
    await api.removeFromWishlist(listing.id)
    setItems((current) => current.filter((item) => item.id !== listing.id))
  }

  async function removeSearch(id: number) {
    await api.deleteSavedSearch(id)
    setSearches((current) => current.filter((search) => search.id !== id))
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl">Saved items</h1>
          <p className="text-sm text-slate-400">
            We watch these for you — if a seller drops the price, you get a ping.
          </p>
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon="♡"
            title="Nothing saved yet"
            hint="Tap the heart on any listing to keep an eye on it."
            action={
              <Link to="/" className="btn-primary">
                Browse listings
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <ListingCard key={item.id} listing={item} onToggleSave={unsave} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl">Want-ads</h2>
          <p className="text-sm text-slate-400">
            Standing requests. The moment a matching item is posted, it lands in your bell.
          </p>
        </div>
        {searches.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No want-ads yet"
            hint="Run a search on Browse and hit “Alert me” to create one."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searches.map((search) => (
              <div key={search.id} className="card flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-slate-100">{search.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {search.query ? `“${search.query}”` : 'any keyword'}
                    {search.category ? ` · ${titleCase(search.category)}` : ''}
                    {search.max_price ? ` · under ${rupees(search.max_price)}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => void removeSearch(search.id)}
                  className="text-slate-500 hover:text-rose-300"
                  aria-label="Delete want-ad"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
