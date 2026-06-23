"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Bell, Loader2, Search } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function cx(...xs) {
  return xs.filter(Boolean).join(" ")
}

function formatDateTime(value) {
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

async function fetchInboxNotifications({ limit = 80 } = {}) {
  const qs = new URLSearchParams({ type: "lead", entityType: "Lead", limit: String(limit) })
  const res = await fetch(`${API_BASE}/notifications/my?${qs.toString()}`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch inbox notifications")
  return Array.isArray(data?.items) ? data.items : []
}

function InboxNotificationItem({ item, isDarkMode }) {
  return (
    <div className={cx("w-full px-6 py-4 text-left", isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cx("truncate text-sm font-bold", isDarkMode ? "text-white" : "text-gray-900")}>
              {item?.title || "Inbox message"}
            </p>
            {!item?.isRead ? <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">New</span> : null}
          </div>
          <p className={cx("mt-1 line-clamp-2 text-sm", isDarkMode ? "text-gray-300" : "text-gray-600")}>
            {item?.message || "New lead inbox message"}
          </p>
          <p className={cx("mt-2 text-xs font-semibold", isDarkMode ? "text-gray-400" : "text-gray-500")}>
            {item?.createdBy?.name || "System"} · {formatDateTime(item?.createdAt)}
          </p>
        </div>
        <Bell className={cx("mt-1 h-4 w-4 shrink-0", isDarkMode ? "text-indigo-200" : "text-indigo-600")} />
      </div>
    </div>
  )
}

export default function NotificationModal({ open, onClose, isDarkMode }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [items, setItems] = useState([])
  const [query, setQuery] = useState("")
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError("")

    fetchInboxNotifications({ limit: 100 })
      .then((arr) => {
        if (!alive) return
        setItems(Array.isArray(arr) ? arr : [])
      })
      .catch((e) => {
        if (!alive) return
        setItems([])
        setError(e?.message || "Failed to load inbox notifications.")
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (Array.isArray(items) ? items : []).filter((item) => {
      if (!q) return true
      const hay = `${item?.title || ""} ${item?.message || ""} ${item?.createdBy?.name || ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  if (!open) return null

  const shell = isDarkMode ? "bg-gray-900 text-white border-white/10" : "bg-white text-gray-900 border-gray-100"

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />

      <div className={cx("relative w-full max-w-3xl overflow-hidden rounded-3xl border shadow-2xl", shell)}>
        <div className={cx("flex items-center justify-between px-6 py-5", isDarkMode ? "bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10" : "bg-gray-50")}>
          <div className="flex min-w-0 items-center gap-3">
            <div className={cx("flex h-10 w-10 items-center justify-center rounded-2xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-gray-200")}>
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">Inbox notifications</p>
              <p className={cx("truncate text-xs", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Lead messages from admin
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            className={cx("rounded-2xl border p-2 transition-transform hover:scale-105", isDarkMode ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-white")}
            aria-label="Close"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-4 pt-5">
          <div className="relative">
            <Search className={cx("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", isDarkMode ? "text-gray-300" : "text-gray-500")} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search inbox messages..."
              className={cx(
                "w-full rounded-2xl border py-2.5 pl-10 pr-3 outline-none",
                isDarkMode
                  ? "bg-white/5 border-white/10 placeholder:text-gray-400 focus:border-purple-400"
                  : "bg-white border-gray-200 placeholder:text-gray-500 focus:border-purple-500"
              )}
            />
          </div>

          {error ? (
            <div className={cx("mt-4 rounded-2xl border p-4 text-sm font-semibold", isDarkMode ? "bg-red-500/10 border-red-500/20 text-red-100" : "bg-red-50 border-red-200 text-red-700")}>
              {error}
            </div>
          ) : null}
        </div>

        <div className={cx("max-h-[70vh] overflow-y-auto", isDarkMode ? "bg-gray-900" : "bg-white")}>
          {loading ? (
            <div className="flex items-center justify-center gap-3 p-10">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className={cx("text-sm font-semibold", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                Loading inbox notifications...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className={cx("mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border", isDarkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")}>
                <Bell className="h-5 w-5" />
              </div>
              <p className={cx("mt-3 text-sm font-semibold", isDarkMode ? "text-gray-100" : "text-gray-800")}>
                No inbox notifications
              </p>
              <p className={cx("mt-1 text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                New lead messages will appear here.
              </p>
            </div>
          ) : (
            <div className={cx("divide-y", isDarkMode ? "divide-white/10" : "divide-gray-100")}>
              {filtered.map((item) => (
                <InboxNotificationItem key={String(item._id)} item={item} isDarkMode={isDarkMode} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
