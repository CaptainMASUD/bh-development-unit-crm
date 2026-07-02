"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { FiInbox, FiLoader, FiRefreshCcw, FiSend, FiUsers } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const cn = (...classes) => classes.filter(Boolean).join(" ")

const getAuthHeaders = () => {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")
  } catch {
    return null
  }
}

const apiJson = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Request failed")
  return data
}

const formatDateTime = (value) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const getUserId = (user) => String(user?._id || user?.id || user?.user?._id || user?.user?.id || "")

const initials = (name = "") => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "U"
  return `${parts[0]?.[0] || "U"}${parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""}`.toUpperCase()
}

const roleLabel = (role = "") => {
  const safe = String(role || "").replaceAll("_", " ")
  if (!safe) return "User"
  return safe.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function LeadInboxPanel({ leadId, lead, showToast, compact = false, onUnreadChange }) {
  const [participants, setParticipants] = useState([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const bottomRef = useRef(null)
  const user = useMemo(() => getStoredUser(), [])
  const meId = getUserId(user)

  const notify = (type, message) => {
    if (showToast) showToast(type, message)
  }

  const selectedUser = useMemo(
    () => participants.find((participant) => String(participant?._id) === String(selectedUserId)) || null,
    [participants, selectedUserId]
  )

  const unreadTotal = useMemo(
    () => participants.reduce((sum, item) => sum + Number(item?.unreadCount || 0), 0),
    [participants]
  )

  const loadParticipants = async ({ silent = false } = {}) => {
    const id = leadId || lead?._id
    if (!id) return
    if (!silent) setLoading(true)
    setError("")
    try {
      const data = await apiJson(`${API_BASE}/lead-messages/${id}/participants`)
      const users = Array.isArray(data?.participants) ? data.participants : []
      setParticipants(users)
      onUnreadChange?.(Number(data?.unreadCount || 0))
      setSelectedUserId((current) => {
        if (current && users.some((item) => String(item?._id) === String(current))) return current
        return users[0]?._id || ""
      })
    } catch (err) {
      const message = err?.message || "Failed to load inbox users"
      setError(message)
      if (!silent) notify("error", message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadThread = async ({ silent = false } = {}) => {
    const id = leadId || lead?._id
    if (!id || !selectedUserId) {
      setMessages([])
      return
    }
    if (!silent) setThreadLoading(true)
    setError("")
    try {
      const data = await apiJson(`${API_BASE}/lead-messages/${id}?recipientId=${encodeURIComponent(selectedUserId)}&limit=100`)
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
      await apiJson(`${API_BASE}/lead-messages/${id}/read?recipientId=${encodeURIComponent(selectedUserId)}`, { method: "PATCH" }).catch(() => {})
      setParticipants((prev) => prev.map((item) => (String(item?._id) === String(selectedUserId) ? { ...item, unreadCount: 0 } : item)))
      onUnreadChange?.(Math.max(0, unreadTotal - Number(selectedUser?.unreadCount || 0)))
    } catch (err) {
      const message = err?.message || "Failed to load inbox"
      setError(message)
      if (!silent) notify("error", message)
    } finally {
      if (!silent) setThreadLoading(false)
    }
  }

  const refresh = async () => {
    await loadParticipants()
    await loadThread()
  }

  useEffect(() => {
    setSelectedUserId("")
    setMessages([])
    loadParticipants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, lead?._id])

  useEffect(() => {
    loadThread()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" })
  }, [messages.length])

  const send = async () => {
    const id = leadId || lead?._id
    const message = draft.trim()
    if (!id || !message || !selectedUserId || sending) return
    setSending(true)
    setError("")
    try {
      const data = await apiJson(`${API_BASE}/lead-messages/${id}`, {
        method: "POST",
        body: JSON.stringify({ message, recipientId: selectedUserId }),
      })
      setMessages((prev) => [...prev, data?.data].filter(Boolean))
      setDraft("")
      notify("success", "Message sent.")
    } catch (err) {
      const messageText = err?.message || "Failed to send message"
      setError(messageText)
      notify("error", messageText)
    } finally {
      setSending(false)
    }
  }

  const title = lead?.contact?.companyName || lead?.contact?.name || "Lead"

  return (
    <div className={cn("rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]", compact ? "p-4" : "p-5")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
            <FiInbox className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black text-gray-950">Inbox</p>
              {unreadTotal ? <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">{unreadTotal}</span> : null}
            </div>
            <p className="truncate text-xs font-semibold text-gray-500">Admin ↔ Assignee · {title}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          disabled={loading || threadLoading}
        >
          <FiRefreshCcw className={cn("h-4 w-4", loading || threadLoading ? "animate-spin" : "")} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid h-[560px] overflow-hidden rounded-3xl border border-gray-100 bg-gray-50/70 md:grid-cols-[280px_1fr]">
        <div className="h-full border-b border-gray-100 bg-white md:border-b-0 md:border-r">
          <div className="flex h-14 items-center justify-between border-b border-gray-100 px-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-gray-500">People</p>
              <p className="text-[11px] font-semibold text-gray-400">{participants.length} available</p>
            </div>
            <FiUsers className="h-4 w-4 text-gray-400" />
          </div>
          <div className="h-[calc(100%-56px)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm font-semibold text-gray-500">
                <FiLoader className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : participants.length ? (
              participants.map((participant) => {
                const active = String(participant?._id) === String(selectedUserId)
                return (
                  <button
                    key={participant?._id}
                    type="button"
                    onClick={() => setSelectedUserId(participant?._id)}
                    className={cn(
                      "mb-2 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                      active ? "border-indigo-200 bg-indigo-50 shadow-sm" : "border-transparent bg-white hover:border-gray-100 hover:bg-gray-50"
                    )}
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black", active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700")}>
                      {initials(participant?.name || participant?.email)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-gray-950">{participant?.name || "User"}</span>
                      <span className="block truncate text-xs font-semibold text-gray-500">{roleLabel(participant?.role)}</span>
                    </span>
                    {participant?.unreadCount ? (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">{participant.unreadCount}</span>
                    ) : null}
                  </button>
                )
              })
            ) : (
              <div className="flex h-40 flex-col items-center justify-center px-4 text-center">
                <FiUsers className="h-6 w-6 text-gray-400" />
                <p className="mt-2 text-sm font-black text-gray-900">No assigned users</p>
                <p className="mt-1 text-xs font-semibold text-gray-500">Assign an employee with lead access to this lead first.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-gray-950">{selectedUser?.name || "Select a person"}</p>
              <p className="truncate text-xs font-semibold text-gray-500">{selectedUser ? selectedUser.email || roleLabel(selectedUser.role) : "Choose a user from the left"}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {threadLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-gray-500">
                <FiLoader className="h-4 w-4 animate-spin" />
                Loading chat...
              </div>
            ) : selectedUser && messages.length ? (
              <div className="space-y-3">
                {messages.map((item) => {
                  const sender = item?.senderId || {}
                  const senderId = String(sender?._id || item?.senderId || "")
                  const mine = meId && senderId === meId
                  const senderName = sender?.name || sender?.email || "User"
                  return (
                    <div key={item?._id || `${senderId}-${item?.createdAt}`} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[86%] rounded-2xl border px-4 py-3 shadow-sm", mine ? "border-indigo-200 bg-indigo-600 text-white" : "border-gray-100 bg-white text-gray-900")}>
                        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={cn("text-xs font-black", mine ? "text-white" : "text-gray-900")}>{mine ? "You" : senderName}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold", mine ? "bg-white/15 text-indigo-50" : "bg-gray-100 text-gray-500")}>
                            {roleLabel(item?.senderRole || sender?.role)}
                          </span>
                        </div>
                        <p className={cn("whitespace-pre-wrap text-sm font-semibold leading-relaxed", mine ? "text-white" : "text-gray-800")}>{item?.message || "—"}</p>
                        <p className={cn("mt-2 text-[11px] font-bold", mine ? "text-indigo-100" : "text-gray-400")}>{formatDateTime(item?.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm">
                  <FiInbox className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-black text-gray-900">{selectedUser ? "No messages yet" : "Select a conversation"}</p>
                <p className="mt-1 max-w-sm text-xs font-semibold text-gray-500">
                  {selectedUser ? "Start the thread with a short update." : "Pick an assigned user from the left side."}
                </p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white p-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault()
                  send()
                }
              }}
              rows={2}
              maxLength={2000}
              disabled={!selectedUser}
              placeholder={selectedUser ? `Message ${selectedUser.name || "user"}...` : "Select a user to send a message"}
              className="min-h-[70px] w-full resize-none rounded-2xl border-0 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none ring-1 ring-gray-100 transition placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold text-gray-400">{draft.trim().length}/2000 · Ctrl+Enter to send</span>
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || !selectedUser || sending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSend className="h-4 w-4" />}
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
