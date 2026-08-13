import type { MeetupSpot } from '../lib/types'

interface Props {
  spots: MeetupSpot[]
  selected?: string | null
  onSelect?: (spot: MeetupSpot) => void
  height?: number
}

/**
 * A schematic campus map. Real lat/lng values are projected into the SVG box so
 * hand-off points keep their true relative positions without shipping a tile layer.
 */
export function CampusMap({ spots, selected, onSelect, height = 220 }: Props) {
  if (spots.length === 0) return null

  const lats = spots.map((s) => s.lat)
  const lngs = spots.map((s) => s.lng)
  const pad = 0.0012
  const minLat = Math.min(...lats) - pad
  const maxLat = Math.max(...lats) + pad
  const minLng = Math.min(...lngs) - pad
  const maxLng = Math.max(...lngs) + pad

  const project = (spot: MeetupSpot) => ({
    x: ((spot.lng - minLng) / (maxLng - minLng)) * 100,
    y: (1 - (spot.lat - minLat) / (maxLat - minLat)) * 100,
  })

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-800/60"
      style={{ height }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0v8" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        <path d="M0 62 L100 48" stroke="rgba(124,140,255,0.18)" strokeWidth="2.5" fill="none" />
        <path d="M38 0 L52 100" stroke="rgba(124,140,255,0.12)" strokeWidth="2" fill="none" />
      </svg>

      {spots.map((spot) => {
        const { x, y } = project(spot)
        const isActive = selected === spot.name
        return (
          <button
            key={spot.name}
            type="button"
            onClick={() => onSelect?.(spot)}
            style={{ left: `${x}%`, top: `${y}%` }}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            title={`${spot.name} · ${spot.hours} · ${spot.safety} footfall`}
          >
            <span
              className={`block h-3 w-3 rounded-full ring-4 transition ${
                isActive
                  ? 'bg-mint-400 ring-mint-400/25'
                  : spot.safety === 'high'
                    ? 'bg-glow-400 ring-glow-400/15 group-hover:ring-glow-400/35'
                    : 'bg-amber-400 ring-amber-400/15'
              }`}
            />
            <span
              className={`pointer-events-none absolute left-1/2 top-4 w-max max-w-[9rem] -translate-x-1/2 rounded-md border border-white/10 bg-ink-950/90 px-1.5 py-0.5 text-[10px] leading-tight transition ${
                isActive ? 'text-mint-400 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'
              }`}
            >
              {spot.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
