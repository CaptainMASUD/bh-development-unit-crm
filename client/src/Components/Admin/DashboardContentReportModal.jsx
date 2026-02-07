"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { FiX, FiSearch, FiChevronDown, FiAlertCircle, FiCheckCircle } from "react-icons/fi"

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"
const soft =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_42px_-24px_rgba(0,0,0,0.28)]"

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function safeLower(v) {
  return String(v ?? "").trim().toLowerCase()
}

function fmtDate(v) {
  const d = v ? new Date(v) : null
  if (!d || Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function Pill({ value }) {
  const s = safeLower(value)

  const cls =
    s === "complete" || s === "done"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "in_progress" || s === "in progress"
        ? "bg-amber-50 text-amber-800 ring-amber-600/10"
        : s === "pending"
          ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
          : "bg-gray-100 text-gray-700 ring-gray-600/10"

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || "—"}
    </span>
  )
}

/**
 * ✅ Table scroll is inside the table container.
 * ✅ Sticky header.
 * ✅ table-fixed + explicit widths keeps columns constant.
 * ✅ min width adds horizontal scroll on mobile.
 */
function ReportTable({ columns, rows }) {
  return (
    <div className="h-full overflow-auto rounded-2xl border border-gray-100 bg-white">
      <table className="min-w-[920px] w-full table-fixed text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className="text-left font-extrabold text-gray-800 px-4 py-3 whitespace-nowrap"
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="bg-white">
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={r?._id || i} className="border-t border-gray-100 hover:bg-gray-50/60">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-gray-700 align-top">
                    {c.render ? c.render(r) : r?.[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                No results
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function ReportModal({
  open,
  onClose,
  apiBase,
  type, // "customers" | "tasks" | "newCustomers"
  title,
  subtitle,
  initialStatus = "all",
  initialDate = null, // YYYY-MM-DD (for newCustomers)
}) {
  const [mounted, setMounted] = useState(false)

  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [total, setTotal] = useState(null)

  const [status, setStatus] = useState(initialStatus)
  const [q, setQ] = useState("")
  const [date, setDate] = useState(initialDate)

  const abortRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => setMounted(true), [])

  // ✅ lock body scroll when modal open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // reset when opened or type changes
  useEffect(() => {
    if (!open) return
    setStatus(initialStatus || "all")
    setDate(initialDate || null)
    setQ("")
    setItems([])
    setNextCursor(null)
    setHasMore(false)
    setTotal(null)
    setErr("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, initialStatus, initialDate])

  const endpoint = useMemo(() => {
    if (type === "customers") return "/api/dashboard/reports/customers"
    if (type === "tasks") return "/api/dashboard/reports/tasks"
    if (type === "newCustomers") return "/api/dashboard/reports/new-customers"
    return null
  }, [type])

  // ✅ fixed column widths so they do not jump
  const columns = useMemo(() => {
    if (type === "customers" || type === "newCustomers") {
      return [
        {
          key: "name",
          title: "Customer",
          width: "32%",
          render: (r) => (
            <div className="min-w-0">
              <p className="font-extrabold text-gray-900 truncate">{r?.name || "Unnamed"}</p>
              <p className="text-xs text-gray-500 truncate">{r?.email || r?.phone || "—"}</p>
            </div>
          ),
        },
        {
          key: "companyName",
          title: "Company",
          width: "28%",
          render: (r) => <span className="truncate block">{r?.companyName || "—"}</span>,
        },
        { key: "status", title: "Status", width: "16%", render: (r) => <Pill value={r?.status} /> },
        { key: "createdAt", title: "Created", width: "24%", render: (r) => fmtDate(r?.createdAt) },
      ]
    }

    return [
      {
        key: "title",
        title: "Task",
        width: "36%",
        render: (r) => (
          <div className="min-w-0">
            <p className="font-extrabold text-gray-900 truncate">{r?.title || "Untitled"}</p>
            <p className="text-xs text-gray-500 truncate">{r?.customerName || "—"}</p>
          </div>
        ),
      },
      {
        key: "companyName",
        title: "Company",
        width: "28%",
        render: (r) => <span className="truncate block">{r?.companyName || "—"}</span>,
      },
      { key: "status", title: "Status", width: "16%", render: (r) => <Pill value={r?.status} /> },
      { key: "updatedAt", title: "Updated", width: "20%", render: (r) => fmtDate(r?.updatedAt || r?.createdAt) },
    ]
  }, [type])

  const showStatusFilter = type === "customers" || type === "tasks"
  const showSearch = type === "customers" || type === "tasks"
  const showDate = type === "newCustomers"

  const statusOptions =
    type === "customers"
      ? [
          { label: "All", value: "all" },
          { label: "Pending", value: "pending" },
          { label: "In Progress", value: "in_progress" },
          { label: "Completed", value: "complete" },
          { label: "Other", value: "other" },
        ]
      : type === "tasks"
        ? [
            { label: "All", value: "all" },
            { label: "Pending", value: "pending" },
            { label: "In Progress", value: "in_progress" },
            { label: "Done", value: "done" },
          ]
        : []

  const fetchPage = async ({ reset = false } = {}) => {
    if (!endpoint) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)
      setErr("")

      const url = new URL(`${apiBase}${endpoint}`)
      url.searchParams.set("limit", "25")

      if (type === "customers" || type === "tasks") {
        if (status) url.searchParams.set("status", status)
        if (q.trim()) url.searchParams.set("q", q.trim())
      }

      if (type === "newCustomers") {
        if (date) url.searchParams.set("date", date)
      }

      const cursorToUse = reset ? null : nextCursor
      if (cursorToUse) url.searchParams.set("cursor", cursorToUse)

      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
        credentials: "include",
        signal: controller.signal,
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Report load failed")

      const newItems = Array.isArray(data?.items) ? data.items : []
      const newNextCursor = data?.nextCursor || null
      const newHasMore = Boolean(data?.hasMore) && Boolean(newNextCursor)

      setTotal(Number.isFinite(data?.total) ? data.total : data?.total ?? null)

      if (reset) {
        setItems(newItems)
      } else {
        setItems((prev) => {
          const map = new Map(prev.map((x) => [String(x?._id), x]))
          newItems.forEach((x) => map.set(String(x?._id), x))
          return Array.from(map.values())
        })
      }

      setNextCursor(newNextCursor)
      setHasMore(newHasMore && newItems.length > 0)
    } catch (e) {
      if (e?.name !== "AbortError") setErr(e?.message || "Report load failed")
    } finally {
      setLoading(false)
    }
  }

  // ✅ initial fetch when open
  useEffect(() => {
    if (!open) return
    fetchPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ✅ Auto filtering/searching: debounce and refetch without Apply button
  useEffect(() => {
    if (!open) return

    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setItems([])
      setNextCursor(null)
      setHasMore(false)
      fetchPage({ reset: true })
    }, 320)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, date])

  // ESC close
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const accentBadge =
    type === "tasks"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : "bg-indigo-50 text-indigo-700 ring-indigo-600/10"

  const modal = (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[9999]">
          {/* ✅ click outside closes */}
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* ✅ mobile: bottom sheet style; desktop: centered */}
          <div className="absolute inset-0 grid place-items-end sm:place-items-center p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.99 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-5xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`${soft} overflow-hidden flex flex-col`}
                style={{
                  // ✅ premium responsive sizing
                  height: "min(82vh, 760px)",
                  borderRadius: "24px",
                }}
              >
                {/* Header */}
                <div className="bg-white border-b border-gray-100">
                  <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ${accentBadge}`}>
                        <FiCheckCircle className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 truncate">
                          {title || "Report"}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {subtitle ||
                            (type === "newCustomers" && date ? `Date: ${date}` : "Detailed drill-down")}
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          {typeof total === "number" ? (
                            <span className="text-xs text-gray-500">
                              Total: <span className="font-semibold text-gray-700">{total}</span>
                            </span>
                          ) : null}
                          {loading ? <span className="text-xs text-gray-400">Loading…</span> : null}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={onClose}
                      className="p-2 rounded-xl hover:bg-black/5 active:scale-95 transition"
                      aria-label="Close"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Filters (auto apply) */}
                  <div className="px-4 sm:px-5 pb-4">
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                        {showStatusFilter ? (
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                          >
                            {statusOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : null}

                        {showDate ? (
                          <input
                            type="date"
                            value={date || ""}
                            onChange={(e) => setDate(e.target.value)}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                          />
                        ) : null}

                        {showSearch ? (
                          <div className="relative w-full sm:w-auto">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              value={q}
                              onChange={(e) => setQ(e.target.value)}
                              placeholder={type === "tasks" ? "Search task title..." : "Search customer..."}
                              className="w-full sm:w-80 rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-2 text-sm font-semibold text-gray-800"
                            />
                          </div>
                        ) : null}
                      </div>

                      {/* ✅ subtle hint on desktop */}
                      <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
                        <span>Filters apply automatically</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error bar */}
                {err ? (
                  <div className="px-4 sm:px-5 pt-4 bg-gray-50">
                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
                      <FiAlertCircle className="w-5 h-5 mt-0.5" />
                      <span className="text-sm font-semibold">{err}</span>
                    </div>
                  </div>
                ) : null}

                {/* ✅ TABLE AREA (only scroll) */}
                <div className="flex-1 p-3 sm:p-5 pt-3 bg-gray-50 min-h-0">
                  <ReportTable columns={columns} rows={items} />
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-3 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => fetchPage({ reset: false })}
                    disabled={!hasMore || loading}
                    className={`${card} w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold hover:bg-gray-50 disabled:opacity-60`}
                  >
                    <FiChevronDown className={`w-4 h-4 ${loading ? "animate-bounce" : ""}`} />
                    {loading ? "Loading…" : hasMore ? "Load more" : "No more results"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
