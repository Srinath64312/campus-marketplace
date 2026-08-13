import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'

const DEMO = { email: 'aarav@campus.ac.in', password: 'campus123' }

export function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup'
  const { login, signup } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [hostel, setHostel] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (isSignup) {
        await signup({
          name: name.trim(),
          email: email.trim(),
          password,
          hostel_block: hostel.trim() || null,
          grad_year: gradYear ? Number(gradYear) : null,
        })
        push('Welcome to campus 🎓', 'success')
      } else {
        await login(email.trim(), password)
        push('Logged in', 'success')
      }
      navigate('/')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function demoLogin() {
    setBusy(true)
    setError(null)
    try {
      await login(DEMO.email, DEMO.password)
      navigate('/')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="card space-y-5 p-6">
        <div>
          <h1 className="text-2xl">{isSignup ? 'Join your campus market' : 'Welcome back'}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isSignup
              ? 'A campus email unlocks a verified badge and higher trust score.'
              : 'Log in to save items, chat with sellers and post your own.'}
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="label" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                required
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="you@campus.ac.in"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {isSignup && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="hostel">
                  Hostel block
                </label>
                <input
                  id="hostel"
                  className="input"
                  placeholder="H4"
                  value={hostel}
                  onChange={(event) => setHostel(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="grad">
                  Graduating
                </label>
                <input
                  id="grad"
                  type="number"
                  min={2024}
                  max={2035}
                  className="input"
                  placeholder="2027"
                  value={gradYear}
                  onChange={(event) => setGradYear(event.target.value)}
                />
              </div>
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        <div className="space-y-2 border-t border-white/5 pt-4">
          <button onClick={demoLogin} className="btn-ghost w-full" disabled={busy}>
            🎭 Try the demo account
          </button>
          <p className="text-center text-xs text-slate-500">
            {DEMO.email} · {DEMO.password}
          </p>
        </div>

        <p className="text-center text-sm text-slate-400">
          {isSignup ? 'Already here?' : 'New to campus?'}{' '}
          <Link to={isSignup ? '/login' : '/signup'} className="text-glow-400 hover:underline">
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </div>
  )
}
