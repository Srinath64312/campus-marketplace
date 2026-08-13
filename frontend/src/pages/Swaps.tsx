import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORY_ICON, avatarUrl, rupees } from '../lib/format'
import type { SwapMatch } from '../lib/types'
import { useToast } from '../store/toast'

export function Swaps() {
  const { push } = useToast()
  const [rings, setRings] = useState<SwapMatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api
      .swapRings()
      .then(setRings)
      .catch((error) => push((error as Error).message, 'error'))
      .finally(() => setLoading(false))
  }, [push])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl">⇄ Swap rings</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Nobody ever has exactly what you want. So we build a graph of who wants what and hunt for
          closed loops — you hand your item to one person, receive from another, and everybody walks
          away with the thing they asked for. No money changes hands.
        </p>
      </header>

      {loading ? (
        <Spinner label="Searching the barter graph…" />
      ) : rings.length === 0 ? (
        <EmptyState
          icon="⇄"
          title="No rings open right now"
          hint="Post an item as “Open to swap” and say what you want — the moment a loop closes it shows up here."
          action={
            <Link to="/sell" className="btn-primary">
              Post a swap
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {rings.map((ring, index) => (
            <article key={index} className="card animate-rise space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-glow-400/30 bg-glow-500/10 px-3 py-1 text-xs font-semibold text-glow-400">
                  {ring.length === 2 ? 'Direct swap' : `${ring.length}-way ring`}
                </span>
                <span className="text-xs text-slate-500">{Math.round(ring.strength * 100)}% fit</span>
                <p className="text-sm text-slate-300">{ring.summary}</p>
              </div>

              <div className="flex flex-wrap items-stretch gap-2">
                {ring.listings.map((listing, position) => (
                  <div key={listing.id} className="flex items-center gap-2">
                    <Link
                      to={`/listing/${listing.id}`}
                      className="flex w-44 flex-col gap-2 rounded-xl border border-white/10 bg-ink-800/60 p-3 transition hover:border-glow-400/40"
                    >
                      <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-ink-900">
                        {listing.images[0] ? (
                          <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-3xl opacity-60">{CATEGORY_ICON[listing.category]}</span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-100">{listing.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <img
                          src={avatarUrl(listing.seller.avatar_seed)}
                          alt=""
                          className="h-4 w-4 rounded-full"
                        />
                        {listing.seller.name.split(' ')[0]} · {rupees(listing.effective_price)}
                      </div>
                    </Link>
                    <span className="text-lg text-glow-400">
                      {position === ring.listings.length - 1 ? '↩' : '→'}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
