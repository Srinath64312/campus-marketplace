import type { Category, Condition, DealScore, Mode } from './types'

export const rupees = (value: number): string =>
  value === 0
    ? 'Free'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(value)

export const titleCase = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

export const CATEGORY_ICON: Record<Category, string> = {
  books: '📚',
  electronics: '💻',
  calculators: '🧮',
  cycles: '🚲',
  notes: '📝',
  furniture: '🪑',
  stationery: '✏️',
  apparel: '👕',
  sports: '🏸',
  lab_equipment: '🥽',
  other: '📦',
}

export const CONDITION_LABEL: Record<Condition, string> = {
  new: 'Brand new',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  worn: 'Well used',
}

export const MODE_LABEL: Record<Mode, string> = {
  sell: 'For sale',
  swap: 'Open to swap',
  giveaway: 'Giving away',
}

export const DEAL_LABEL: Record<DealScore['label'], { text: string; className: string }> = {
  steal: { text: 'Steal', className: 'bg-mint-500/20 text-mint-400 border-mint-400/40' },
  good_deal: { text: 'Good deal', className: 'bg-mint-500/10 text-mint-400 border-mint-400/25' },
  fair: { text: 'Fair price', className: 'bg-white/5 text-slate-300 border-white/15' },
  above_market: { text: 'Above market', className: 'bg-amber-400/10 text-amber-400 border-amber-400/30' },
}

export const TRUST_LABEL: Record<string, string> = {
  trusted_senior: 'Trusted senior',
  reliable: 'Reliable',
  getting_started: 'Getting started',
  new_here: 'New here',
}

export function timeAgo(iso: string): string {
  const then = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime()
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000))
  const steps: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
  ]
  let value = seconds
  for (const [size, unit] of steps) {
    if (value < size) return `${Math.floor(value)} ${unit}${Math.floor(value) === 1 ? '' : 's'} ago`
    value /= size
  }
  return `${Math.floor(value)}y ago`
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime()
  return Math.ceil((then - Date.now()) / 86_400_000)
}

export const avatarUrl = (seed: string): string =>
  `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1d2547`
