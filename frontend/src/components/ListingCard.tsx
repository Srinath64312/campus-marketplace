import { Link } from 'react-router-dom'

import { CATEGORY_ICON, CONDITION_LABEL, daysUntil, rupees, timeAgo, titleCase } from '../lib/format'
import type { Listing } from '../lib/types'
import { DealBadge, TrustBadge } from './ui'

interface Props {
  listing: Listing
  onToggleSave?: (listing: Listing) => void
}

export function ListingCard({ listing, onToggleSave }: Props) {
  const markdownDays = daysUntil(listing.markdown_deadline)
  const isMarkedDown = listing.effective_price < listing.price

  return (
    <article className="card group relative flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-glow">
      <Link to={`/listing/${listing.id}`} className="relative block aspect-[4/3] overflow-hidden bg-ink-800">
        {listing.images[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl opacity-60">
            {CATEGORY_ICON[listing.category]}
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {listing.mode === 'swap' && (
            <span className="rounded-full border border-glow-400/40 bg-ink-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-glow-400">
              ⇄ Swap
            </span>
          )}
          {listing.mode === 'giveaway' && (
            <span className="rounded-full border border-mint-400/40 bg-ink-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-mint-400">
              Free
            </span>
          )}
          {listing.deal && <DealBadge deal={listing.deal} compact />}
        </div>
        {onToggleSave && (
          <button
            onClick={(event) => {
              event.preventDefault()
              onToggleSave(listing)
            }}
            aria-label={listing.saved ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-ink-950/80 text-base backdrop-blur transition hover:scale-110 ${
              listing.saved ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {listing.saved ? '♥' : '♡'}
          </button>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/listing/${listing.id}`} className="line-clamp-2 font-medium text-white hover:text-glow-400">
            {listing.title}
          </Link>
          <div className="shrink-0 text-right">
            <p className="font-display text-lg text-white">{rupees(listing.effective_price)}</p>
            {isMarkedDown && (
              <p className="text-xs text-slate-500 line-through">{rupees(listing.price)}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
          <span className="chip">
            {CATEGORY_ICON[listing.category]} {titleCase(listing.category)}
          </span>
          <span className="chip">{CONDITION_LABEL[listing.condition]}</span>
          {listing.meetup_spot && <span className="chip">📍 {listing.meetup_spot}</span>}
        </div>

        {listing.swap_wants && (
          <p className="line-clamp-1 rounded-lg border border-glow-400/20 bg-glow-500/5 px-2.5 py-1.5 text-xs text-glow-400">
            Wants: {listing.swap_wants}
          </p>
        )}

        {markdownDays !== null && markdownDays > 0 && listing.auto_markdown_percent > 0 && (
          <p className="text-xs text-amber-400">
            ⏳ Auto-markdown running · {listing.auto_markdown_percent}% off by day {markdownDays}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-3">
          <TrustBadge seller={listing.seller} />
          <span className="text-[11px] text-slate-500">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </article>
  )
}

export function ListingCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-8 w-full" />
      </div>
    </div>
  )
}
