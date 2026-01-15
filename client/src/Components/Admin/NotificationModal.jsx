"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Bell, Loader2, Search, AlertTriangle, Clock, Users } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function safeDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function msUntil(due, nowMs) {
  if (!due) return null
  return due.getTime() - nowMs
}

function formatRemaining(ms) {
  if (ms === null || ms === undefined) return "—"
  const neg = ms < 0
  const abs = Math.abs(ms)

  const totalMinutes = Math.floor(abs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours || days) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)

  return neg ? `Overdue by ${parts.join(" ")}` : `Due in ${parts.join(" ")}`
}

function cx(...xs) {
  return xs.filter(Boolean).join(" ")
}

async function fetchAdminDeadlineNotifications({ windowDays = 365, includeOverdue = true, limit = 500 }) {
  const qs = new URLSearchParams({
    windowDays: String(windowDays),
    includeOverdue: String(includeOverdue),
    limit: String(limit),
  })

  const res = await fetch(`${API_BASE}/notifications/deadlines/admin?${qs.toString()}`, {
    headers: getAuthHeaders(),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch notifications")
  return Array.isArray(data?.items) ? data.items : []
}

/**
 * ✅ Employee Tag + Icon + Names
 * Expects backend to return: item.assignees = [{ _id, name }]
 * If not present, falls back to item.assignedTo (ids) and shows "Unknown"
 */
function EmployeeTag({ item, isDarkMode }) {
  const assignees = Array.isArray(item?.assignees) ? item.assignees : []
  const ids = Array.isArray(item?.assignedTo) ? item.assignedTo : []

  const names =
    assignees.length > 0
      ? assignees.map((a) => a?.name).filter(Boolean)
      : ids.length > 0
      ? ids.map(() => "Unknown")
      : []

  const label = names.length > 0 ? names.join(", ") : "Unassigned"

  return (
    <div className="mt-2 flex items-center gap-2 min-w-0">
      <span
        className={cx(
          "inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
          isDarkMode ? "bg-white/5 border-white/10 text-gray-100" : "bg-gray-50 border-gray-200 text-gray-700"
        )}
      >
        <Users className="w-3.5 h-3.5" />
        Employee
      </span>

      <span
        className={cx(
          "text-xs font-semibold truncate min-w-0",
          isDarkMode ? "text-gray-200" : "text-gray-700"
        )}
        title={label}
      >
        {label}
      </span>
    </div>
  )
}

function NotificationItem({ item, nowMs, isDarkMode, onOpen }) {
  const due = safeDate(item?.dueAt)
  const ms = due ? msUntil(due, nowMs) : null

  const overdue = ms !== null && ms < 0
  const tagCls = overdue
    ? isDarkMode
      ? "bg-red-500/15 text-red-200 border border-red-500/20"
      : "bg-red-50 text-red-700 border border-red-200"
    : isDarkMode
    ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/20"
    : "bg-emerald-50 text-emerald-700 border border-emerald-200"

  return (
    <button
      onClick={() => onOpen?.(item)}
      className={cx(
        "w-full text-left px-5 py-4 flex items-start gap-3 hover:translate-y-[-1px] active:translate-y-0 transition-transform",
        isDarkMode ? "hover:bg-white/5" : "hover:bg-gray-50"
      )}
    >
      <div
        className={cx(
          "mt-1 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
          overdue
            ? isDarkMode
              ? "bg-red-500/15 text-red-200 border-red-500/20"
              : "bg-red-50 text-red-700 border-red-200"
            : isDarkMode
            ? "bg-indigo-500/15 text-indigo-200 border-indigo-500/20"
            : "bg-indigo-50 text-indigo-700 border-indigo-200"
        )}
      >
        {overdue ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cx("text-sm font-semibold truncate", isDarkMode ? "text-white" : "text-gray-900")}>
            {item?.title || "Untitled task"}
          </p>
          <span className={cx("text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap", tagCls)}>
            {item?.status || "pending"}
          </span>
        </div>

        <p className={cx("mt-1 text-xs truncate", isDarkMode ? "text-gray-300" : "text-gray-600")}>
          {item?.customerName || "Customer"}
          {item?.companyName ? ` • ${item.companyName}` : ""}
        </p>

        {/* ✅ Employee tag + icon + names */}
        <EmployeeTag item={item} isDarkMode={isDarkMode} />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={cx(
              "text-xs font-semibold px-2 py-1 rounded-full",
              isDarkMode ? "bg-white/10 text-gray-100" : "bg-gray-100 text-gray-700"
            )}
          >
            {due ? due.toLocaleString() : "No due time"}
          </span>

          {due ? (
            <span className={cx("text-xs font-semibold px-2 py-1 rounded-full", tagCls)}>{formatRemaining(ms)}</span>
          ) : null}
        </div>
      </div>
    </button>
  )
}

const DAY = 24 * 60 * 60 * 1000
const isOverdue = (ms) => ms !== null && ms < 0
const isUpcoming = (ms) => ms !== null && ms >= 0
const withinDays = (ms, days) => ms !== null && ms >= 0 && ms <= days * DAY

export default function AdminNotificationModal({ open, onClose, isDarkMode, onOpenCustomer }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [items, setItems] = useState([])
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState("upcoming")
  const [nowMs, setNowMs] = useState(Date.now())

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
    const id = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true

    setLoading(true)
    setError("")

    fetchAdminDeadlineNotifications({ windowDays: 365, includeOverdue: true, limit: 500 })
      .then((arr) => {
        if (!alive) return
        setItems(Array.isArray(arr) ? arr : [])
      })
      .catch((e) => {
        if (!alive) return
        setItems([])
        setError(e?.message || "Failed to load notifications.")
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open])

  const enriched = useMemo(() => {
    const q = query.trim().toLowerCase()

    return (Array.isArray(items) ? items : [])
      .map((it) => {
        const due = safeDate(it?.dueAt)
        const ms = due ? msUntil(due, nowMs) : null
        return { ...it, _due: due, _ms: ms }
      })
      .filter((it) => {
        if (!q) return true
        const assignees = (Array.isArray(it?.assignees) ? it.assignees : [])
          .map((a) => a?.name || "")
          .join(" ")
          .toLowerCase()
        const hay = `${it.title || ""} ${it.customerName || ""} ${it.companyName || ""} ${assignees}`.toLowerCase()
        return hay.includes(q)
      })
  }, [items, query, nowMs])

  const counts = useMemo(() => {
    const c = { upcoming: 0, d3: 0, d7: 0, overdue: 0, all: 0 }
    for (const it of enriched) {
      c.all++
      if (isUpcoming(it._ms)) c.upcoming++
      if (withinDays(it._ms, 3)) c.d3++
      if (withinDays(it._ms, 7)) c.d7++
      if (isOverdue(it._ms)) c.overdue++
    }
    return c
  }, [enriched])

  const filtered = useMemo(() => {
    let arr = [...enriched]

    if (activeTab === "upcoming") arr = arr.filter((x) => isUpcoming(x._ms))
    if (activeTab === "d3") arr = arr.filter((x) => withinDays(x._ms, 3))
    if (activeTab === "d7") arr = arr.filter((x) => withinDays(x._ms, 7))
    if (activeTab === "overdue") arr = arr.filter((x) => isOverdue(x._ms))

    const dueMs = (x) => (x._due ? x._due.getTime() : Number.MAX_SAFE_INTEGER)

    if (activeTab === "upcoming") arr.sort((a, b) => dueMs(b) - dueMs(a))
    else arr.sort((a, b) => dueMs(a) - dueMs(b))

    return arr
  }, [enriched, activeTab])

  const onOpenItem = (item) => {
    const customerId = item?.customerId
    if (!customerId) return
    onClose?.()
    onOpenCustomer?.(customerId)
  }

  if (!open) return null

  const shell = isDarkMode ? "bg-gray-900 text-white border-white/10" : "bg-white text-gray-900 border-gray-100"

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />

      <div className={cx("relative w-full max-w-3xl rounded-3xl shadow-2xl border overflow-hidden", shell)}>
        <div
          className={cx(
            "px-6 py-5 flex items-center justify-between",
            isDarkMode ? "bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10" : "bg-gray-50"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cx(
                "w-10 h-10 rounded-2xl flex items-center justify-center border",
                isDarkMode ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
              )}
            >
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold truncate">Deadlines (Admin)</p>
              <p className={cx("text-xs truncate", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                Shows all employee task deadlines + assignees
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            className={cx(
              "p-2 rounded-2xl border hover:scale-105 transition-transform",
              isDarkMode ? "border-white/10 hover:bg-white/5" : "border-gray-200 hover:bg-white"
            )}
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search
                className={cx(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                  isDarkMode ? "text-gray-300" : "text-gray-500"
                )}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search task / customer / employee…"
                className={cx(
                  "w-full pl-10 pr-3 py-2.5 rounded-2xl border outline-none",
                  isDarkMode
                    ? "bg-white/5 border-white/10 placeholder:text-gray-400 focus:border-purple-400"
                    : "bg-white border-gray-200 placeholder:text-gray-500 focus:border-purple-500"
                )}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                ["upcoming", "Upcoming", counts.upcoming],
                ["d3", "3 Days", counts.d3],
                ["d7", "7 Days", counts.d7],
                ["overdue", "Overdue", counts.overdue],
                ["all", "All", counts.all],
              ].map(([key, label, count]) => {
                const active = activeTab === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={cx(
                      "px-3 py-2 rounded-2xl text-xs font-semibold border",
                      active
                        ? isDarkMode
                          ? "bg-white/10 border-purple-400/40 text-white"
                          : "bg-gray-900 text-white border-gray-900"
                        : isDarkMode
                        ? "bg-transparent border-white/10 text-gray-200 hover:bg-white/5"
                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {label} <span className="ml-1 opacity-80">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error ? (
            <div
              className={cx(
                "mt-4 p-4 rounded-2xl border text-sm font-semibold",
                isDarkMode ? "bg-red-500/10 border-red-500/20 text-red-100" : "bg-red-50 border-red-200 text-red-700"
              )}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className={cx("max-h-[70vh] overflow-y-auto", isDarkMode ? "bg-gray-900" : "bg-white")}>
          {loading ? (
            <div className="p-10 flex items-center justify-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className={cx("text-sm font-semibold", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                Loading notifications…
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div
                className={cx(
                  "mx-auto w-12 h-12 rounded-2xl flex items-center justify-center border",
                  isDarkMode ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                )}
              >
                <Bell className="w-5 h-5" />
              </div>
              <p className={cx("mt-3 text-sm font-semibold", isDarkMode ? "text-gray-100" : "text-gray-800")}>
                No matching deadlines
              </p>
              <p className={cx("mt-1 text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                Try switching tabs or clearing search.
              </p>
            </div>
          ) : (
            <div className={cx("divide-y", isDarkMode ? "divide-white/10" : "divide-gray-100")}>
              {filtered.map((it) => (
                <NotificationItem
                  key={String(it.taskId)}
                  item={it}
                  nowMs={nowMs}
                  isDarkMode={isDarkMode}
                  onOpen={onOpenItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
