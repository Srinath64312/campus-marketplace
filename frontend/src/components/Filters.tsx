import { CATEGORIES, CONDITIONS, MODES } from '../lib/types'
import { CATEGORY_ICON, CONDITION_LABEL, MODE_LABEL, titleCase } from '../lib/format'

export interface FilterState {
  q: string
  categories: string[]
  conditions: string[]
  mode: string
  maxPrice: string
  freeOnly: boolean
  sort: string
  nearSpot: string
}

export const EMPTY_FILTERS: FilterState = {
  q: '',
  categories: [],
  conditions: [],
  mode: '',
  maxPrice: '',
  freeOnly: false,
  sort: 'recent',
  nearSpot: '',
}

export const SORTS = [
  { value: 'recent', label: 'Newest' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'deal', label: 'Best deals' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'nearby', label: 'Closest to me' },
]

interface Props {
  value: FilterState
  onChange: (next: FilterState) => void
  facets?: Record<string, Record<string, number>>
  spots: string[]
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export function Filters({ value, onChange, facets, spots }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  const counts = facets?.category ?? {}

  return (
    <aside className="card h-fit space-y-5 p-4 lg:sticky lg:top-24">
      <div>
        <p className="label">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => set({ categories: toggle(value.categories, category) })}
              className={`chip ${value.categories.includes(category) ? 'chip-active' : ''}`}
            >
              {CATEGORY_ICON[category]} {titleCase(category)}
              {counts[category] ? <span className="opacity-50">{counts[category]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">Condition</p>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map((condition) => (
            <button
              key={condition}
              onClick={() => set({ conditions: toggle(value.conditions, condition) })}
              className={`chip ${value.conditions.includes(condition) ? 'chip-active' : ''}`}
            >
              {CONDITION_LABEL[condition]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label">Listing type</p>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => set({ mode: value.mode === mode ? '' : mode })}
              className={`chip ${value.mode === mode ? 'chip-active' : ''}`}
            >
              {MODE_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="max-price">
          Max price · ₹{value.maxPrice || '30000'}
        </label>
        <input
          id="max-price"
          type="range"
          min={0}
          max={30000}
          step={100}
          value={value.maxPrice || 30000}
          onChange={(event) => set({ maxPrice: event.target.value })}
          className="w-full accent-glow-500"
        />
      </div>

      <div>
        <p className="label">Meet near</p>
        <select
          className="input"
          value={value.nearSpot}
          onChange={(event) => set({ nearSpot: event.target.value })}
        >
          <option value="">Anywhere on campus</option>
          {spots.map((spot) => (
            <option key={spot} value={spot}>
              {spot}
            </option>
          ))}
        </select>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={value.freeOnly}
          onChange={(event) => set({ freeOnly: event.target.checked })}
          className="h-4 w-4 rounded accent-mint-500"
        />
        Free stuff only
      </label>

      <button className="btn-ghost w-full" onClick={() => onChange({ ...EMPTY_FILTERS, q: value.q })}>
        Reset filters
      </button>
    </aside>
  )
}
