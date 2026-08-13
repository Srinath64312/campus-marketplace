import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { avatarUrl, timeAgo } from '../lib/format'
import { useAuth } from '../store/auth'

const NAV = [
  { to: '/', label: 'Browse', icon: '🛍️', end: true },
  { to: '/swaps', label: 'Swap rings', icon: '⇄' },
  { to: '/pulse', label: 'Campus pulse', icon: '📈' },
  { to: '/wishlist', label: 'Saved', icon: '♥', auth: true },
  { to: '/chat', label: 'Chat', icon: '💬', auth: true },
]

function AlertsBell() {
  const { alerts, unread, markAlertsRead } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (!open && unread) void markAlertsRead()
        }}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 hover:border-glow-400/50"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 max-h-96 w-80 animate-rise overflow-y-auto p-2">
          {alerts.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              No alerts yet. Save a search and we&apos;ll ping you the moment something matches.
            </p>
          ) : (
            alerts.map((alert) => (
              <Link
                key={alert.id}
                to={alert.listing_id ? `/listing/${alert.listing_id}` : '/wishlist'}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2.5 hover:bg-white/5"
              >
                <p className="text-sm text-slate-200">{alert.message}</p>
                <p className="text-[11px] text-slate-500">
                  {alert.kind === 'price_drop' ? '📉 Price drop' : '🎯 Match'} · {timeAgo(alert.created_at)}
                </p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const links = NAV.filter((item) => !item.auth || user)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo.svg" alt="" className="h-9 w-9" />
            <span className="hidden font-display text-lg text-white sm:block">
              Campus<span className="text-glow-400">Market</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                  }`
                }
              >
                <span className="mr-1.5">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <AlertsBell />
                <Link to="/sell" className="btn-primary hidden sm:inline-flex">
                  + Post an item
                </Link>
                <div className="group relative">
                  <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 hover:border-glow-400/50">
                    <img src={avatarUrl(user.avatar_seed)} alt="" className="h-7 w-7 rounded-lg" />
                    <span className="hidden text-sm text-slate-200 sm:block">
                      {user.name.split(' ')[0]}
                    </span>
                  </button>
                  <div className="card invisible absolute right-0 mt-2 w-44 p-1.5 opacity-0 transition group-hover:visible group-hover:opacity-100">
                    <Link to="/dashboard" className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5">
                      My listings
                    </Link>
                    <Link
                      to={`/students/${user.id}`}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                    >
                      My profile
                    </Link>
                    <button
                      onClick={() => {
                        logout()
                        navigate('/')
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">
                  Log in
                </Link>
                <Link to="/signup" className="btn-primary hidden sm:inline-flex">
                  Join campus
                </Link>
              </>
            )}
            <button
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              ☰
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="animate-rise border-t border-white/5 px-4 py-2 lg:hidden">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2.5 text-sm ${isActive ? 'bg-white/10 text-white' : 'text-slate-300'}`
                }
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
            {user && (
              <Link
                to="/sell"
                onClick={() => setMenuOpen(false)}
                className="btn-primary mt-2 w-full"
              >
                + Post an item
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600">
        Campus Marketplace · built for students who move in and out every semester
      </footer>
    </div>
  )
}
