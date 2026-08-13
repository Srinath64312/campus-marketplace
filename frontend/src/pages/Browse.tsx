import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EMPTY_FILTERS, Filters, SORTS } from '../components/Filters'
import type { FilterState } from '../components/Filters'
import { ListingCard, ListingCardSkeleton } from '../components/ListingCard'
import { EmptyState } from '../components/ui'
import { api } from '../lib/api'
import { rupees } from '../lib/format'
import type { Listing, ListingPage, MeetupSpot, Stats } from '../lib/types'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'

const PAGE_SIZE = 12

export function Browse() {
  const { user, refreshAlerts } = useAuth()
  const { push } = useToast()
  const [params, setParams] = useSearchParams()

  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS, q: params.get('q') ?? '' })
  const [queryInput, setQueryInput] = useState(filters.q)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ListingPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [spots, setSpots] = useState<MeetupSpot[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    void api.meetupSpots().then(setSpots).catch(() => undefined)
    void api.stats().then(setStats).catch(() => undefined)
  }, [])

  // Debounce the search box so every keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: queryInput }))
      setPage(1)
      setParams(queryInput ? { q: queryInput } : {}, { replace: true })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [queryInput, setParams])

  const spot = useMemo(
    () => spots.find((s) => s.name === filters.nearSpot),
    [spots, filters.nearSpot],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.listings({
        q: filters.q || undefined,
        category: filters.categories.length ? filters.categories : undefined,
        condition: filters.conditions.length ? filters.conditions : undefined,
        mode: filters.mode || undefined,
        max_price: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        free_only: filters.freeOnly,
        lat: spot?.lat,
        lng: spot?.lng,
        radius_km: spot ? 0.4 : undefined,
        sort: filters.sort,
        page,
        page_size: PAGE_SIZE,
      })
      setData(response)
    } catch (error) {
      push((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [filters, page, spot, push])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleSave(listing: Listing) {
    if (!user) {
      push('Log in to save items to your wishlist', 'info')
      return
    }
    try {
      if (listing.saved) await api.removeFromWishlist(listing.id)
      else await api.addToWishlist(listing.id)
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((x) => (x.id === listing.id ? { ...x, saved: !x.saved } : x)),
            }
          : current,
      )
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  async function saveSearch() {
    if (!user) {
      push('Log in to get pinged when something matches', 'info')
      return
    }
    try {
      await api.createSavedSearch({
        label: filters.q || filters.categories[0] || 'Everything new',
        query: filters.q || null,
        category: filters.categories[0] ?? null,
        max_price: filters.maxPrice ? Number(filters.maxPrice) : null,
      })
      await refreshAlerts()
      push('Want-ad saved. You will be alerted on every new match.', 'success')
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-glow-500/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-glow-400">
            Student-to-student since move-in day
          </p>
          <h1 className="text-3xl leading-tight sm:text-4xl">
            Everything the senior batch is leaving behind.
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Buy it, swap it or take it for free — with a price coach that tells you what things are
            actually worth on this campus.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                🔍
              </span>
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Try 'calulator', 'clrs', 'gear cycle' — typos are fine"
                className="input pl-10"
                aria-label="Search listings"
              />
            </div>
            <button onClick={saveSearch} className="btn-ghost whitespace-nowrap">
              🔔 Alert me on matches
            </button>
          </div>

          {stats && (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
              <span>
                <b className="text-white">{stats.active_listings}</b> live listings
              </span>
              <span>
                <b className="text-white">{stats.students}</b> students
              </span>
              <span>
                <b className="text-white">{stats.given_away}</b> free giveaways
              </span>
              <Link to="/swaps" className="text-glow-400 hover:underline">
                <b>{stats.swap_rings_open}</b> open swap rings →
              </Link>
              <span>
                median ask <b className="text-white">{rupees(stats.median_price)}</b>
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className={showFilters ? 'block' : 'hidden lg:block'}>
          <Filters
            value={filters}
            onChange={(next) => {
              setFilters(next)
              setPage(1)
            }}
            facets={data?.facets}
            spots={spots.map((s) => s.name)}
          />
        </div>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              {loading ? 'Searching…' : `${data?.total ?? 0} item${data?.total === 1 ? '' : 's'}`}
              {filters.q && !loading && <span className="text-slate-500"> for “{filters.q}”</span>}
            </p>
            <div className="flex items-center gap-2">
              <button className="btn-ghost lg:hidden" onClick={() => setShowFilters((v) => !v)}>
                ⚙ Filters
              </button>
              <select
                className="input w-auto py-2"
                value={filters.sort}
                onChange={(event) => setFilters({ ...filters, sort: event.target.value })}
                aria-label="Sort listings"
              >
                {SORTS.map((sort) => (
                  <option key={sort.value} value={sort.value}>
                    {sort.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ListingCardSkeleton key={index} />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} onToggleSave={toggleSave} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🔎"
              title="Nothing matches that yet"
              hint="Loosen a filter, or save this search and we will alert you the second someone posts it."
              action={
                <button className="btn-primary" onClick={saveSearch}>
                  🔔 Alert me on matches
                </button>
              }
            />
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
                ← Prev
              </button>
              <span className="text-sm text-slate-400">
                Page {page} / {totalPages}
              </span>
              <button
                className="btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
