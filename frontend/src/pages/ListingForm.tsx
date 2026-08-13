import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { CampusMap } from '../components/CampusMap'
import { Spinner } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORY_ICON, CONDITION_LABEL, MODE_LABEL, rupees, titleCase } from '../lib/format'
import { CATEGORIES, CONDITIONS, MODES } from '../lib/types'
import type { Category, Condition, MeetupSpot, Mode, PriceSuggestion } from '../lib/types'
import { useToast } from '../store/toast'

interface FormState {
  title: string
  description: string
  price: string
  category: Category
  condition: Condition
  mode: Mode
  images: string[]
  tags: string
  swap_wants: string
  swap_wants_category: Category | ''
  meetup_spot: string
  location_lat: number | null
  location_lng: number | null
  age_months: string
  auto_markdown_percent: string
  markdown_days: string
}

const INITIAL: FormState = {
  title: '',
  description: '',
  price: '',
  category: 'books',
  condition: 'good',
  mode: 'sell',
  images: [],
  tags: '',
  swap_wants: '',
  swap_wants_category: '',
  meetup_spot: '',
  location_lat: null,
  location_lng: null,
  age_months: '0',
  auto_markdown_percent: '0',
  markdown_days: '14',
}

export function ListingForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { push } = useToast()

  const [form, setForm] = useState<FormState>(INITIAL)
  const [spots, setSpots] = useState<MeetupSpot[]>([])
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null)
  const [coaching, setCoaching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(editing)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }))

  useEffect(() => {
    void api.meetupSpots().then(setSpots).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!id) return
    void api
      .listing(Number(id))
      .then((listing) =>
        setForm({
          title: listing.title,
          description: listing.description,
          price: String(listing.price),
          category: listing.category,
          condition: listing.condition,
          mode: listing.mode,
          images: listing.images,
          tags: listing.tags.join(', '),
          swap_wants: listing.swap_wants ?? '',
          swap_wants_category: listing.swap_wants_category ?? '',
          meetup_spot: listing.meetup_spot ?? '',
          location_lat: listing.location_lat,
          location_lng: listing.location_lng,
          age_months: '0',
          auto_markdown_percent: String(listing.auto_markdown_percent),
          markdown_days: '14',
        }),
      )
      .catch((error) => push((error as Error).message, 'error'))
      .finally(() => setLoading(false))
  }, [id, push])

  const runCoach = useCallback(async () => {
    if (form.title.trim().length < 3) {
      push('Add a title first so the coach has something to work with', 'info')
      return
    }
    setCoaching(true)
    try {
      setSuggestion(
        await api.priceSuggest({
          title: form.title,
          description: form.description,
          category: form.category,
          condition: form.condition,
          age_months: Number(form.age_months) || 0,
          listing_id: id ? Number(id) : null,
        }),
      )
    } catch (error) {
      push((error as Error).message, 'error')
    } finally {
      setCoaching(false)
    }
  }, [form, id, push])

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return
    try {
      const uploaded = await Promise.all(Array.from(files).slice(0, 4).map((file) => api.upload(file)))
      set({ images: [...form.images, ...uploaded.map((u) => u.url)].slice(0, 6) })
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const markdown = Number(form.auto_markdown_percent) || 0
      const deadline =
        markdown > 0
          ? new Date(Date.now() + (Number(form.markdown_days) || 14) * 86_400_000).toISOString()
          : null
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.mode === 'giveaway' ? 0 : Number(form.price) || 0,
        category: form.category,
        condition: form.condition,
        mode: form.mode,
        images: form.images,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        swap_wants: form.mode === 'swap' ? form.swap_wants.trim() || null : null,
        swap_wants_category: form.mode === 'swap' && form.swap_wants_category ? form.swap_wants_category : null,
        meetup_spot: form.meetup_spot || null,
        location_lat: form.location_lat,
        location_lng: form.location_lng,
        auto_markdown_percent: markdown,
        markdown_deadline: deadline,
      }
      const listing = editing
        ? await api.updateListing(Number(id), payload)
        : await api.createListing(payload)
      push(editing ? 'Listing updated' : 'Listing is live', 'success')
      navigate(`/listing/${listing.id}`)
    } catch (error) {
      push((error as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner label="Loading listing…" />

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="card space-y-4 p-5">
          <h1 className="text-2xl">{editing ? 'Edit listing' : 'Post an item'}</h1>

          <div>
            <label className="label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              required
              minLength={3}
              className="input"
              placeholder="Casio FX-991EX scientific calculator"
              value={form.title}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              rows={5}
              className="input resize-y"
              placeholder="Be honest about scratches — it sells faster."
              value={form.description}
              onChange={(event) => set({ description: event.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="category">
                Category
              </label>
              <select
                id="category"
                className="input"
                value={form.category}
                onChange={(event) => set({ category: event.target.value as Category })}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_ICON[category]} {titleCase(category)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="condition">
                Condition
              </label>
              <select
                id="condition"
                className="input"
                value={form.condition}
                onChange={(event) => set({ condition: event.target.value as Condition })}
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {CONDITION_LABEL[condition]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="age">
                Age (months)
              </label>
              <input
                id="age"
                type="number"
                min={0}
                className="input"
                value={form.age_months}
                onChange={(event) => set({ age_months: event.target.value })}
              />
            </div>
          </div>

          <div>
            <p className="label">I want to…</p>
            <div className="flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set({ mode })}
                  className={`chip ${form.mode === mode ? 'chip-active' : ''}`}
                >
                  {MODE_LABEL[mode]}
                </button>
              ))}
            </div>
          </div>

          {form.mode !== 'giveaway' && (
            <div>
              <label className="label" htmlFor="price">
                Asking price (₹)
              </label>
              <input
                id="price"
                type="number"
                min={0}
                className="input"
                value={form.price}
                onChange={(event) => set({ price: event.target.value })}
              />
            </div>
          )}

          {form.mode === 'swap' && (
            <div className="grid gap-4 rounded-xl border border-glow-400/20 bg-glow-500/5 p-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="wants">
                  What do you want in return?
                </label>
                <input
                  id="wants"
                  className="input"
                  placeholder="a geared cycle in working condition"
                  value={form.swap_wants}
                  onChange={(event) => set({ swap_wants: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="wants-category">
                  Category you want
                </label>
                <select
                  id="wants-category"
                  className="input"
                  value={form.swap_wants_category}
                  onChange={(event) => set({ swap_wants_category: event.target.value as Category })}
                >
                  <option value="">Any category</option>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {titleCase(category)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400 sm:col-span-2">
                Filling this in puts you in the barter graph — we will find three-way rings for you.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="tags">
              Tags (comma separated)
            </label>
            <input
              id="tags"
              className="input"
              placeholder="casio, exam, engineering"
              value={form.tags}
              onChange={(event) => set({ tags: event.target.value })}
            />
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="text-lg">Photos</h2>
          <div className="flex flex-wrap gap-3">
            {form.images.map((url) => (
              <div key={url} className="relative h-24 w-24 overflow-hidden rounded-xl border border-white/10">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => set({ images: form.images.filter((x) => x !== url) })}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink-950/80 text-xs text-rose-300"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-white/15 text-2xl text-slate-500 hover:border-glow-400/50 hover:text-glow-400"
            >
              +
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => void handleUpload(event.target.files)}
            />
          </div>
          <p className="text-xs text-slate-500">Up to 6 photos, 5 MB each.</p>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="text-lg">Safe hand-off spot</h2>
          <p className="text-sm text-slate-400">
            Pick where you will actually meet. Buyers filter by this.
          </p>
          <CampusMap
            spots={spots}
            selected={form.meetup_spot}
            onSelect={(spot) =>
              set({ meetup_spot: spot.name, location_lat: spot.lat, location_lng: spot.lng })
            }
          />
          <div className="flex flex-wrap gap-1.5">
            {spots.map((spot) => (
              <button
                key={spot.name}
                type="button"
                onClick={() =>
                  set({ meetup_spot: spot.name, location_lat: spot.lat, location_lng: spot.lng })
                }
                className={`chip ${form.meetup_spot === spot.name ? 'chip-active' : ''}`}
              >
                📍 {spot.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="text-lg">Leaving campus? Set an auto-markdown</h2>
          <p className="text-sm text-slate-400">
            The price slides down on its own until your deadline, so you are not haggling during exams.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="markdown">
                Total discount · {form.auto_markdown_percent}%
              </label>
              <input
                id="markdown"
                type="range"
                min={0}
                max={50}
                step={5}
                value={form.auto_markdown_percent}
                onChange={(event) => set({ auto_markdown_percent: event.target.value })}
                className="w-full accent-amber-400"
              />
            </div>
            <div>
              <label className="label" htmlFor="markdown-days">
                Over how many days
              </label>
              <input
                id="markdown-days"
                type="number"
                min={1}
                max={120}
                className="input"
                value={form.markdown_days}
                onChange={(event) => set({ markdown_days: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <div className="card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg">Price coach</h2>
            <span className="rounded-full border border-glow-400/30 bg-glow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-glow-400">
              on-campus model
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Priced from comparable listings on this campus, condition depreciation and keyword signals.
          </p>
          <button type="button" onClick={runCoach} className="btn-ghost w-full" disabled={coaching}>
            {coaching ? 'Crunching…' : '✨ Suggest a price'}
          </button>

          {suggestion && (
            <div className="animate-rise space-y-3 rounded-xl border border-white/10 bg-ink-800/60 p-4">
              <div>
                <p className="font-display text-3xl text-white">{rupees(suggestion.suggested)}</p>
                <p className="text-xs text-slate-400">
                  fair range {rupees(suggestion.low)} – {rupees(suggestion.high)}
                </p>
              </div>
              <div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-glow-500 to-mint-400"
                    style={{ width: `${Math.round(suggestion.confidence * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {Math.round(suggestion.confidence * 100)}% confidence · {suggestion.comparables}{' '}
                  comparables
                </p>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {suggestion.rationale.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-glow-400">›</span>
                    {line}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => set({ price: String(suggestion.suggested) })}
              >
                Use {rupees(suggestion.suggested)}
              </button>
            </div>
          )}
        </div>
      </aside>
    </form>
  )
}
