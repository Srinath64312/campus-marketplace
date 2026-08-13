import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { CampusMap } from '../components/CampusMap'
import { Spinner, Stat } from '../components/ui'
import { api } from '../lib/api'
import { CATEGORY_ICON, rupees, titleCase } from '../lib/format'
import type { Category, MeetupSpot, Stats } from '../lib/types'
import { useToast } from '../store/toast'

export function Pulse() {
  const { push } = useToast()
  const [stats, setStats] = useState<Stats | null>(null)
  const [spots, setSpots] = useState<MeetupSpot[]>([])

  useEffect(() => {
    void Promise.all([api.stats(), api.meetupSpots()])
      .then(([s, m]) => {
        setStats(s)
        setSpots(m)
      })
      .catch((error) => push((error as Error).message, 'error'))
  }, [push])

  if (!stats) return <Spinner label="Reading the campus pulse…" />

  const peak = Math.max(1, ...stats.daily_new.map((d) => d.count))
  const topCount = Math.max(1, ...stats.trending_categories.map((c) => c.count))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl">📈 Campus pulse</h1>
        <p className="text-sm text-slate-400">
          What is actually moving on campus this fortnight.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Live listings" value={stats.active_listings} hint={`${stats.total_listings} all time`} />
        <Stat label="Students trading" value={stats.students} />
        <Stat label="Median price" value={rupees(stats.median_price)} hint="across active listings" />
        <Stat label="Given away free" value={stats.given_away} hint="no money changed hands" />
        <Stat label="Swap rings open" value={stats.swap_rings_open} hint="barter loops ready to close" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="text-lg">New listings · last 14 days</h2>
          <div className="flex h-40 items-end gap-1.5">
            {stats.daily_new.map((day) => (
              <div
                key={day.date}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100">
                  {day.count}
                </span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-glow-500/40 to-glow-400 transition group-hover:from-mint-500/40 group-hover:to-mint-400"
                  style={{ height: `${Math.max(4, (day.count / peak) * 100)}%` }}
                  title={`${day.date}: ${day.count}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {stats.daily_new[0]?.date} → {stats.daily_new[stats.daily_new.length - 1]?.date}
          </p>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-lg">Hot categories</h2>
          {stats.trending_categories.map((row) => (
            <Link
              key={row.category}
              to={`/?category=${row.category}`}
              className="block space-y-1 rounded-xl px-2 py-1.5 hover:bg-white/5"
            >
              <div className="flex justify-between text-sm">
                <span className="text-slate-200">
                  {CATEGORY_ICON[row.category as Category]} {titleCase(row.category)}
                </span>
                <span className="text-slate-500">{row.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-glow-500 to-mint-400"
                  style={{ width: `${(row.count / topCount) * 100}%` }}
                />
              </div>
            </Link>
          ))}
        </section>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg">Safe hand-off spots</h2>
        <p className="text-sm text-slate-400">
          Public, well-lit, busy. Always trade here rather than at a hostel door.
        </p>
        <CampusMap spots={spots} height={260} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {spots.map((spot) => (
            <div key={spot.name} className="rounded-xl border border-white/10 bg-ink-800/50 p-3">
              <p className="text-sm text-slate-100">📍 {spot.name}</p>
              <p className="text-xs text-slate-500">
                {spot.hours} ·{' '}
                <span className={spot.safety === 'high' ? 'text-mint-400' : 'text-amber-400'}>
                  {spot.safety} footfall
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
