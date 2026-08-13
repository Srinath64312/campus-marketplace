import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, getToken, setToken } from '../lib/api'
import type { Alert, User } from '../lib/types'

interface AuthValue {
  user: User | null
  loading: boolean
  alerts: Alert[]
  unread: number
  login: (email: string, password: string) => Promise<void>
  signup: (body: Record<string, unknown>) => Promise<void>
  logout: () => void
  refreshAlerts: () => Promise<void>
  markAlertsRead: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])

  const refreshAlerts = useCallback(async () => {
    if (!getToken()) return
    try {
      setAlerts(await api.alerts())
    } catch {
      setAlerts([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await api.me()
        if (!cancelled) {
          setUserState(me)
          await refreshAlerts()
        }
      } catch {
        setToken(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [refreshAlerts])

  // Live alerts: cheap polling beats a socket for a notification badge.
  useEffect(() => {
    if (!user) return
    const timer = window.setInterval(() => void refreshAlerts(), 20_000)
    return () => window.clearInterval(timer)
  }, [user, refreshAlerts])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      alerts,
      unread: alerts.filter((a) => !a.read).length,
      setUser: setUserState,
      login: async (email, password) => {
        const response = await api.login(email, password)
        setToken(response.access_token)
        setUserState(response.user)
        await refreshAlerts()
      },
      signup: async (body) => {
        const response = await api.signup(body)
        setToken(response.access_token)
        setUserState(response.user)
      },
      logout: () => {
        setToken(null)
        setUserState(null)
        setAlerts([])
      },
      refreshAlerts,
      markAlertsRead: async () => {
        await api.markAlertsRead()
        setAlerts((current) => current.map((a) => ({ ...a, read: true })))
      },
    }),
    [user, loading, alerts, refreshAlerts],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
