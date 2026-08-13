import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

type Tone = 'success' | 'error' | 'info'
interface Toast {
  id: number
  message: string
  tone: Tone
}

const ToastContext = createContext<{ push: (message: string, tone?: Tone) => void } | null>(null)

const TONE_CLASS: Record<Tone, string> = {
  success: 'border-mint-400/40 bg-mint-500/15 text-mint-400',
  error: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
  info: 'border-glow-400/40 bg-glow-500/15 text-glow-400',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4000)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(22rem,90vw)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`animate-rise rounded-xl border px-4 py-3 text-sm font-medium shadow-card backdrop-blur ${TONE_CLASS[toast.tone]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
