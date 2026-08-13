import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { EmptyState, Spinner } from '../components/ui'
import { API_BASE, api } from '../lib/api'
import { avatarUrl, timeAgo } from '../lib/format'
import type { ChatMessage, Thread } from '../lib/types'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'

export function Chat() {
  const { user } = useAuth()
  const { push } = useToast()
  const [params, setParams] = useSearchParams()
  const [threads, setThreads] = useState<Thread[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const listingId = params.get('listing') ? Number(params.get('listing')) : null
  const counterpartId = params.get('with') ? Number(params.get('with')) : null
  const active = threads.find((t) => t.listing_id === listingId && t.counterpart.id === counterpartId)

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await api.threads())
    } catch (error) {
      push((error as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [push])

  const loadMessages = useCallback(async () => {
    if (!listingId || !counterpartId) return
    try {
      setMessages(await api.thread(listingId, counterpartId))
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }, [listingId, counterpartId, push])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Live delivery: the backend pushes each new message to the recipient's socket.
  useEffect(() => {
    if (!user) return
    const url = `${API_BASE.replace(/^http/, 'ws')}/api/chat/ws/${user.id}`
    let socket: WebSocket
    try {
      socket = new WebSocket(url)
    } catch {
      return
    }
    socket.onmessage = () => {
      void loadThreads()
      void loadMessages()
    }
    return () => socket.close()
  }, [user, loadThreads, loadMessages])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!listingId || !draft.trim()) return
    try {
      const message = await api.sendMessage(listingId, draft.trim())
      setMessages((current) => [...current, message])
      setDraft('')
      void loadThreads()
    } catch (error) {
      push((error as Error).message, 'error')
    }
  }

  if (loading) return <Spinner />

  if (threads.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="No conversations yet"
        hint="Message a seller from any listing and the thread shows up here."
        action={
          <Link to="/" className="btn-primary">
            Browse listings
          </Link>
        }
      />
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className={`card overflow-hidden p-2 ${active ? 'hidden lg:block' : ''}`}>
        {threads.map((thread) => {
          const isActive = active === thread
          return (
            <button
              key={`${thread.listing_id}-${thread.counterpart.id}`}
              onClick={() =>
                setParams({ listing: String(thread.listing_id), with: String(thread.counterpart.id) })
              }
              className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${
                isActive ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <img
                src={thread.listing_image ?? avatarUrl(thread.counterpart.avatar_seed)}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{thread.listing_title}</p>
                <p className="truncate text-xs text-slate-500">
                  {thread.counterpart.name.split(' ')[0]}: {thread.last_message}
                </p>
              </div>
              {thread.unread > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-glow-500 px-1 text-[10px] font-bold text-white">
                  {thread.unread}
                </span>
              )}
            </button>
          )
        })}
      </aside>

      <section className="card flex h-[70vh] flex-col">
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-white/5 p-3">
              <button
                className="text-slate-400 lg:hidden"
                onClick={() => setParams({})}
                aria-label="Back to threads"
              >
                ←
              </button>
              <img
                src={avatarUrl(active.counterpart.avatar_seed)}
                alt=""
                className="h-9 w-9 rounded-lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{active.counterpart.name}</p>
                <Link
                  to={`/listing/${active.listing_id}`}
                  className="truncate text-xs text-glow-400 hover:underline"
                >
                  {active.listing_title}
                </Link>
              </div>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((message) => {
                const mine = message.sender_id === user?.id
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                        mine
                          ? 'rounded-br-sm bg-glow-500 text-white'
                          : 'rounded-bl-sm bg-white/8 text-slate-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/60' : 'text-slate-500'}`}>
                        {timeAgo(message.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-white/5 p-3">
              <input
                className="input flex-1"
                placeholder="Type a message…"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="btn-primary">
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-slate-500">
            Pick a conversation
          </div>
        )}
      </section>
    </div>
  )
}
