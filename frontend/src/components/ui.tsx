import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { DEAL_LABEL, TRUST_LABEL, avatarUrl } from '../lib/format'
import type { DealScore, SellerSummary } from '../lib/types'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-glow-400/30 border-t-glow-400" />
      {label ?? 'Loading…'}
    </div>
  )
}

export function EmptyState({
  icon = '🫙',
  title,
  hint,
  action,
}: {
  icon?: string
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="text-lg">{title}</h3>
      {hint && <p className="max-w-md text-sm text-slate-400">{hint}</p>}
      {action}
    </div>
  )
}

export function DealBadge({ deal, compact = false }: { deal: DealScore; compact?: boolean }) {
  const meta = DEAL_LABEL[deal.label]
  const arrow = deal.delta_percent < 0 ? '↓' : '↑'
  return (
    <span
      title={`${Math.abs(deal.delta_percent)}% ${deal.delta_percent < 0 ? 'below' : 'above'} the campus median for this category (${deal.basis} comparables)`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.className}`}
    >
      {meta.text}
      {!compact && (
        <span className="opacity-70">
          {arrow}
          {Math.abs(deal.delta_percent)}%
        </span>
      )}
    </span>
  )
}

export function TrustBadge({ seller, withName = true }: { seller: SellerSummary; withName?: boolean }) {
  const tone =
    seller.trust_score >= 85
      ? 'text-mint-400'
      : seller.trust_score >= 65
        ? 'text-glow-400'
        : 'text-slate-400'
  return (
    <Link
      to={`/students/${seller.id}`}
      className="group flex items-center gap-2 text-xs text-slate-400 hover:text-white"
    >
      <img
        src={avatarUrl(seller.avatar_seed)}
        alt=""
        className="h-7 w-7 rounded-full border border-white/10 bg-ink-800"
      />
      <span className="leading-tight">
        {withName && <span className="block font-medium text-slate-200">{seller.name}</span>}
        <span className={`block ${tone}`}>
          {TRUST_LABEL[seller.trust_tier] ?? 'Student'} · {seller.trust_score}
          {seller.rating ? ` · ${seller.rating}★` : ''}
        </span>
      </span>
    </Link>
  )
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl text-white">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-rise p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
