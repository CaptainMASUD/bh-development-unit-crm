"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FiUsers,
  FiUserCheck,
  FiDatabase,
  FiRefreshCcw,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiClipboard,
  FiTrendingUp,
  FiActivity,
  FiShield,
  FiChevronDown,
  FiX,
  FiSearch,
  FiFilter,
  FiArrowUpRight,
  FiCalendar,
} from "react-icons/fi"
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts"

const API = `${import.meta.env.VITE_API_URL}`

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"
const soft =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_42px_-24px_rgba(0,0,0,0.28)]"

const CHART_COLORS = ["#6366F1", "#F59E0B", "#22C55E", "#6B7280", "#EF4444"]

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

function StatusPill({ status }) {
  const s = safeLower(status) || "in_progress"
  const cls =
    s === "complete"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "in_progress"
        ? "bg-amber-50 text-amber-800 ring-amber-600/10"
        : s === "pending"
          ? "bg-slate-50 text-slate-700 ring-slate-600/10"
          : s === "done"
            ? "bg-green-50 text-green-700 ring-green-600/10"
            : "bg-gray-100 text-gray-700 ring-gray-600/10"
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s}
    </span>
  )
}

function Toast({ type = "success", message, onClose }) {
  if (!message) return null
  const styles =
    type === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700"
  const Icon = type === "error" ? FiAlertCircle : FiCheckCircle

  return (
    <div className="fixed top-4 right-4 z-[80] max-w-sm w-[92vw] sm:w-auto">
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        className={`rounded-2xl border p-3 shadow-lg ${styles}`}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5" />
          <p className="text-sm font-semibold flex-1">{message}</p>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 active:scale-95 transition"
            aria-label="Close toast"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function StatCard({ icon, title, value, hint, tone = "indigo" }) {
  const toneCfg = {
    indigo: {
      badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
      glow: "shadow-[0_18px_50px_-30px_rgba(79,70,229,0.40)]",
    },
    amber: {
      badge: "bg-amber-50 text-amber-800 ring-amber-600/10",
      glow: "shadow-[0_18px_50px_-30px_rgba(245,158,11,0.35)]",
    },
    green: {
      badge: "bg-green-50 text-green-700 ring-green-600/10",
      glow: "shadow-[0_18px_50px_-30px_rgba(34,197,94,0.35)]",
    },
    gray: {
      badge: "bg-gray-100 text-gray-700 ring-gray-600/10",
      glow: "shadow-[0_18px_50px_-34px_rgba(75,85,99,0.25)]",
    },
  }
  const cfg = toneCfg[tone] || toneCfg.indigo

  return (
    <div className={`${card} ${cfg.glow}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-500">{title}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">{value}</p>
          </div>
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ${cfg.badge}`}>{icon}</div>
        </div>
        <p className="mt-3 text-xs text-gray-500">{hint || "—"}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, icon, children, onClick, clickable }) {
  return (
    <div
      className={`${soft} overflow-hidden ${
        clickable ? "cursor-pointer hover:shadow-[0_18px_52px_-28px_rgba(0,0,0,0.32)] transition-shadow" : ""
      }`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return
        if (e.key === "Enter" || e.key === " ") onClick?.()
      }}
    >
      <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="p-5 bg-white">{children}</div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className={`${card} p-5 animate-pulse`}>
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="h-10 w-24 bg-gray-200 rounded mt-3" />
      <div className="h-3 w-48 bg-gray-200 rounded mt-3" />
    </div>
  )
}

function ListSkeleton({ rows = 5 }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${card} p-4 animate-pulse`}>
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-64 bg-gray-200 rounded mt-2" />
          <div className="h-3 w-48 bg-gray-200 rounded mt-2" />
        </div>
      ))}
    </div>
  )
}

function PanelFooter({ loading, disabled, onClick, label }) {
  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent px-4 pb-4 pt-3">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition px-4 py-2 text-sm font-semibold"
      >
        <FiChevronDown className={`w-4 h-4 ${loading ? "animate-bounce" : ""}`} />
        {loading ? "Loading…" : label}
      </button>
    </div>
  )
}

/* =============================
   ✅ Standard-size search (not full width)
============================= */
function FilterChip({ label, value, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10"
      title={`${label}: ${value}`}
    >
      <span className="truncate max-w-[170px]">
        <span className="opacity-70">{label}:</span> <span className="font-black">{String(value)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="h-4.5 w-4.5 inline-flex items-center justify-center rounded-full hover:bg-indigo-600/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
        aria-label={`Remove ${label} filter`}
        title="Remove"
      >
        <FiX className="w-3 h-3" />
      </button>
    </span>
  )
}

const searchWrap = [
  "w-full sm:w-auto sm:max-w-3xl",
  "rounded-2xl border border-gray-200 bg-white",
  "px-3 py-1 sm:px-3.5 sm:py-1",
  "min-h-[44px] sm:min-h-[46px]",
  "flex items-center gap-2 flex-wrap",
  "transition shadow-none",
  "focus-within:border-indigo-300",
  "focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
].join(" ")

const searchInput = [
  "w-full sm:w-72 md:w-80",
  "bg-transparent",
  "text-sm text-gray-900 placeholder:text-gray-400",
  "border-0 outline-none ring-0 shadow-none appearance-none",
  "h-8 sm:h-9",
  "focus:outline-none focus:ring-0 focus:shadow-none",
].join(" ")

/* =============================
   ✅ FILTER CONTROLS
============================= */
const CONTROL_WRAP =
  "h-12 rounded-2xl border border-gray-200 bg-white px-3 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.25)]"
const CONTROL_INNER =
  "h-full w-full bg-transparent outline-none border-0 ring-0 focus:outline-none focus:ring-0 focus:border-0 text-sm font-bold text-gray-900 placeholder:text-gray-400"
const ICON_WRAP = "w-5 h-5 flex items-center justify-center text-gray-400 shrink-0"

function Select({ icon, value, onChange, options }) {
  return (
    <div className={`flex items-center gap-2 ${CONTROL_WRAP}`}>
      <span className={ICON_WRAP}>{icon}</span>
      <div className="relative w-full h-full flex items-center">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${CONTROL_INNER} appearance-none pr-10`}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <FiChevronDown className="pointer-events-none absolute right-2 w-4 h-4 text-gray-400" />
      </div>
    </div>
  )
}

function DateInput({ value, onChange, ariaLabel }) {
  return (
    <div className={`flex items-center gap-2 ${CONTROL_WRAP}`}>
      <span className={ICON_WRAP}>
        <FiCalendar className="w-4 h-4" />
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`${CONTROL_INNER} appearance-none`}
      />
    </div>
  )
}

function ModalShell({ open, title, subtitle, onClose, children, rightHeader }) {
  const escClose = useCallback(
    (e) => {
      if (e.key === "Escape") onClose?.()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener("keydown", escClose)
    return () => document.removeEventListener("keydown", escClose)
  }, [open, escClose])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onClose?.()
            }}
          />
          <motion.div
            className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.99 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="w-full sm:max-w-6xl bg-white sm:rounded-3xl rounded-t-3xl shadow-[0_20px_80px_-40px_rgba(0,0,0,0.55)] border border-gray-100 overflow-hidden max-h-[92vh]"
            >
              <div className="p-4 sm:p-6 border-b border-gray-100 bg-white sticky top-0 z-[2]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900 truncate">
                        {title}
                      </h2>
                      <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                        Report
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {rightHeader}
                    <button
                      onClick={onClose}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                      aria-label="Close modal"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 overflow-auto max-h-[calc(92vh-84px)]">{children}</div>
              <div className="sm:hidden h-3 bg-gray-50" />
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

/* =============================
   ✅ TABLE
============================= */
function Table({ columns, rows, rowKey, emptyText, onRowClick, colWidths = [] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_12px_30px_-18px_rgba(0,0,0,0.28)]">
      <div className="overflow-auto">
        <table className="min-w-full text-sm table-fixed">
          {colWidths?.length ? (
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
            </colgroup>
          ) : null}

          <thead className="bg-white sticky top-0 z-[1]">
            <tr className="border-b border-gray-100">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 text-left font-extrabold text-gray-700 whitespace-nowrap ${c.className || ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white">
            {rows.length ? (
              rows.map((r) => (
                <tr
                  key={rowKey(r)}
                  className={`border-b border-gray-50 hover:bg-gray-50/60 ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(r)}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 text-gray-700 align-top ${c.tdClassName || ""}`}>
                      <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap">
                        {c.render ? c.render(r) : r?.[c.key] ?? "—"}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-500 font-semibold">
                  {emptyText || "No results"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [breakpoint])
  return isMobile
}

function buildTrendKeys(days) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(now)
    dt.setDate(now.getDate() - i)
    const key = dt.toISOString().slice(0, 10)
    const label = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    out.push({ key, label })
  }
  return out
}

export default function Dashboard({ openCustomerDetails }) {
  const DAYS = 7
  const PAGE_SIZE = 10

  const isMobile = useIsMobile(640)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [toast, setToast] = useState({ type: "success", message: "" })
  const toastTimer = useRef(null)

  const [me, setMe] = useState(null)

  const [customerStats, setCustomerStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    complete: 0,
    other: 0,
  })

  const [employeesCount, setEmployeesCount] = useState(0)
  const [adminsCount, setAdminsCount] = useState(0)
  const [superAdminsCount, setSuperAdminsCount] = useState(0)

  const [taskStatusChart, setTaskStatusChart] = useState([])
  const [customersTrend, setCustomersTrend] = useState([])

  const [recentCustomers, setRecentCustomers] = useState([])
  const [recentTasks, setRecentTasks] = useState([])

  const [customersCursor, setCustomersCursor] = useState(null)
  const [customersHasMore, setCustomersHasMore] = useState(true)
  const [customersLoadingMore, setCustomersLoadingMore] = useState(false)

  const [tasksCursor, setTasksCursor] = useState(null)
  const [tasksHasMore, setTasksHasMore] = useState(true)
  const [tasksLoadingMore, setTasksLoadingMore] = useState(false)
  const [tasksLimitFallback, setTasksLimitFallback] = useState(PAGE_SIZE)

  const isSuperAdmin = me?.role === "superadmin"
  const abortRef = useRef(null)

  // ✅ helper: always open CRM section safely
  const openCRM = useCallback(
    (customerId) => {
      if (!customerId) return
      if (typeof openCustomerDetails === "function") openCustomerDetails(String(customerId))
    },
    [openCustomerDetails]
  )

  const showToast = (type, message) => {
    setToast({ type, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast({ type: "success", message: "" }), 2200)
  }

  const fetchDashboard = async (limit = PAGE_SIZE, signal) => {
    const res = await fetch(`${API}/api/dashboard?days=${DAYS}&limit=${limit}`, {
      headers: getAuthHeaders(),
      credentials: "include",
      signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || "Dashboard load failed")
    return data
  }

  const fetchAll = async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      setLoading(true)
      setError("")

      const data = await fetchDashboard(PAGE_SIZE, controller.signal)

      setMe(data?.me || null)

      setCustomerStats({
        total: Number(data?.customerStats?.total ?? data?.customersCount ?? 0),
        pending: Number(data?.customerStats?.pending ?? 0),
        inProgress: Number(data?.customerStats?.inProgress ?? 0),
        complete: Number(data?.customerStats?.complete ?? 0),
        other: Number(data?.customerStats?.other ?? 0),
      })

      setTaskStatusChart(Array.isArray(data?.taskStatusChart) ? data.taskStatusChart : [])

      const keys = buildTrendKeys(DAYS)
      const incoming = Array.isArray(data?.newCustomersTrend) ? data.newCustomersTrend : []
      const trend = keys.map((k, i) => ({
        key: k.key, // ✅ IMPORTANT for click-to-date
        name: incoming?.[i]?.name || k.label,
        value: Number(incoming?.[i]?.value ?? 0),
      }))
      setCustomersTrend(trend)

      const rc = Array.isArray(data?.recentCustomers) ? data.recentCustomers : []
      const rt = Array.isArray(data?.recentTasks) ? data.recentTasks : []
      setRecentCustomers(rc)
      setRecentTasks(rt)

      const lastCustomerId = rc?.length ? rc[rc.length - 1]?._id : null
      setCustomersCursor(lastCustomerId || null)
      setCustomersHasMore(Boolean(lastCustomerId))

      const lastTaskId = rt?.length ? rt[rt.length - 1]?._id : null
      setTasksCursor(lastTaskId || null)
      setTasksHasMore(Boolean(lastTaskId))
      setTasksLimitFallback(PAGE_SIZE)

      setEmployeesCount(Number(data?.employeesCount ?? 0))
      setAdminsCount(Number(data?.adminsCount ?? 0))
      setSuperAdminsCount(Number(data?.superAdminsCount ?? 0))
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Dashboard load failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const taskStats = useMemo(() => {
    const getV = (name) => Number(taskStatusChart.find((x) => safeLower(x?.name) === name)?.value ?? 0)
    const pending = getV("pending")
    const inProgress = getV("in progress") || getV("in_progress")
    const done = getV("done")
    const total = pending + inProgress + done
    return { total, pending, inProgress, done }
  }, [taskStatusChart])

  const customerStatusChart = useMemo(() => {
    const rows = [
      { name: "Pending", value: Number(customerStats.pending ?? 0) },
      { name: "In Progress", value: Number(customerStats.inProgress ?? 0) },
      { name: "Completed", value: Number(customerStats.complete ?? 0) },
      { name: "Other", value: Number(customerStats.other ?? 0) },
    ]
    return rows.filter((x) => x.value > 0)
  }, [customerStats])

  const loadMoreCustomers = async () => {
    if (customersLoadingMore || !customersHasMore || !customersCursor) return
    setCustomersLoadingMore(true)

    try {
      const res = await fetch(`${API}/api/customers?limit=${6}&cursor=${encodeURIComponent(customersCursor)}`, {
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to load more customers")

      const items = Array.isArray(data?.customers) ? data.customers : []
      const nextCursor = data?.nextCursor || null

      setRecentCustomers((prev) => {
        const map = new Map(prev.map((x) => [String(x._id), x]))
        items.forEach((x) => map.set(String(x._id), x))
        return Array.from(map.values())
      })

      setCustomersCursor(nextCursor)
      setCustomersHasMore(Boolean(nextCursor) && items.length > 0)
    } catch (e) {
      showToast("error", e?.message || "Failed to load more customers")
    } finally {
      setCustomersLoadingMore(false)
    }
  }

  const loadMoreTasks = async () => {
    if (tasksLoadingMore || !tasksHasMore) return
    setTasksLoadingMore(true)

    try {
      const cursorTry = tasksCursor ? `&cursor=${encodeURIComponent(tasksCursor)}` : ""
      const res = await fetch(`${API}/api/dashboard/tasks?limit=${6}${cursorTry}`, {
        headers: getAuthHeaders(),
        credentials: "include",
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const items = Array.isArray(data?.tasks) ? data.tasks : []
        const nextCursor = data?.nextCursor || null

        setRecentTasks((prev) => {
          const map = new Map(prev.map((x) => [String(x._id), x]))
          items.forEach((x) => map.set(String(x._id), x))
          return Array.from(map.values())
        })

        setTasksCursor(nextCursor)
        setTasksHasMore(Boolean(nextCursor) && items.length > 0)
      } else {
        const nextLimit = tasksLimitFallback + 6
        const data = await fetchDashboard(nextLimit)
        const rt = Array.isArray(data?.recentTasks) ? data.recentTasks : []
        setRecentTasks(rt)

        setTasksLimitFallback(nextLimit)
        setTasksHasMore(rt.length >= nextLimit)
      }
    } catch (e) {
      showToast("error", e?.message || "Failed to load more tasks")
    } finally {
      setTasksLoadingMore(false)
    }
  }

  // =========================
  // REPORT MODAL
  // =========================
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState(null)

  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState("")
  const [reportItems, setReportItems] = useState([])
  const [reportCursor, setReportCursor] = useState(null)
  const [reportHasMore, setReportHasMore] = useState(false)
  const [reportTotal, setReportTotal] = useState(0)

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    sort: "createdAt_desc",
    from: "",
    to: "",
    date: "",
  })

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draft, setDraft] = useState({
    status: "all",
    sort: "createdAt_desc",
    from: "",
    to: "",
    date: "",
  })

  const reportAbort = useRef(null)

  const closeReport = () => {
    setReportOpen(false)
    setReportType(null)
    setReportError("")
    setReportItems([])
    setReportCursor(null)
    setReportHasMore(false)
    setReportTotal(0)
    setFilters({ q: "", status: "all", sort: "createdAt_desc", from: "", to: "", date: "" })
    setDraft({ status: "all", sort: "createdAt_desc", from: "", to: "", date: "" })
    setFiltersOpen(false)
    reportAbort.current?.abort?.()
  }

  const openReport = (type, preset = {}) => {
    setReportType(type)
    setReportError("")
    setReportItems([])
    setReportCursor(null)
    setReportHasMore(false)
    setReportTotal(0)

    if (type === "customers") {
      setFilters({
        q: "",
        status: preset?.status || "all",
        sort: preset?.sort || "createdAt_desc",
        from: "",
        to: "",
        date: "",
      })
      setDraft({
        status: preset?.status || "all",
        sort: preset?.sort || "createdAt_desc",
        from: "",
        to: "",
        date: "",
      })
    } else if (type === "tasks") {
      setFilters({
        q: "",
        status: preset?.status || "all",
        sort: "createdAt_desc",
        from: preset?.from || "",
        to: preset?.to || "",
        date: "",
      })
      setDraft({
        status: preset?.status || "all",
        sort: "createdAt_desc",
        from: preset?.from || "",
        to: preset?.to || "",
        date: "",
      })
    } else if (type === "new-customers") {
      setFilters({
        q: "",
        status: "all",
        sort: "createdAt_desc",
        from: "",
        to: "",
        date: preset?.date || "",
      })
      setDraft({
        status: "all",
        sort: "createdAt_desc",
        from: "",
        to: "",
        date: preset?.date || "",
      })
    }

    setReportOpen(true)
  }

  const buildReportUrl = (cursorValue) => {
    if (!reportType) return null

    if (reportType === "customers") {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      if (cursorValue) params.set("cursor", cursorValue)
      if (filters.status && filters.status !== "all") params.set("status", filters.status)
      if (filters.q) params.set("q", filters.q)
      if (filters.sort) params.set("sort", filters.sort)
      return `${API}/api/dashboard/reports/customers?${params.toString()}`
    }

    if (reportType === "tasks") {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      if (cursorValue) params.set("cursor", cursorValue)
      if (filters.status && filters.status !== "all") params.set("status", filters.status)
      if (filters.q) params.set("q", filters.q)
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)
      return `${API}/api/dashboard/reports/tasks?${params.toString()}`
    }

    if (reportType === "new-customers") {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      if (cursorValue) params.set("cursor", cursorValue)
      if (filters.date) params.set("date", filters.date)
      return `${API}/api/dashboard/reports/new-customers?${params.toString()}`
    }

    return null
  }

  const fetchReport = async ({ reset = true, cursorValue = null } = {}) => {
    if (!reportType) return
    if (reportAbort.current) reportAbort.current.abort()
    const controller = new AbortController()
    reportAbort.current = controller

    try {
      setReportLoading(true)
      setReportError("")
      if (reset) {
        setReportItems([])
        setReportCursor(null)
        setReportHasMore(false)
        setReportTotal(0)
      }

      const url = buildReportUrl(cursorValue)
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        credentials: "include",
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Report load failed")

      const items = Array.isArray(data?.items) ? data.items : []
      const nextCursor = data?.nextCursor || null
      const hasMore = Boolean(data?.hasMore) || Boolean(nextCursor)
      const total = Number(data?.total ?? 0)

      setReportTotal(total)

      if (reset) setReportItems(items)
      else {
        setReportItems((prev) => {
          const map = new Map(prev.map((x) => [String(x?._id), x]))
          items.forEach((x) => map.set(String(x?._id), x))
          return Array.from(map.values())
        })
      }

      setReportCursor(nextCursor)
      setReportHasMore(Boolean(nextCursor) && hasMore)
    } catch (e) {
      if (e?.name !== "AbortError") setReportError(e?.message || "Report load failed")
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    if (!reportOpen || !reportType) return
    fetchReport({ reset: true, cursorValue: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOpen, reportType, JSON.stringify(filters)])

  const loadMoreReport = () => {
    if (reportLoading || !reportHasMore || !reportCursor) return
    fetchReport({ reset: false, cursorValue: reportCursor })
  }

  const reportMeta = useMemo(() => {
    if (!reportType) return { title: "Report", subtitle: "" }

    if (reportType === "customers") {
      const st =
        filters.status === "all"
          ? "All customers"
          : filters.status === "in_progress"
            ? "Customers in progress"
            : filters.status === "complete"
              ? "Completed customers"
              : filters.status === "pending"
                ? "Pending customers"
                : filters.status === "other"
                  ? "Other status customers"
                  : "Customers"
      return {
        title: "Customers Report",
        subtitle: `${st} • ${reportTotal ? `${reportTotal} total` : "Filtered view"}`,
      }
    }

    if (reportType === "tasks") {
      const st =
        filters.status === "all"
          ? "All tasks"
          : filters.status === "in_progress"
            ? "Tasks in progress"
            : filters.status === "done"
              ? "Done tasks"
              : filters.status === "pending"
                ? "Pending tasks"
                : "Tasks"
      const range = filters.from || filters.to ? ` • ${filters.from || "…"} → ${filters.to || "…"}` : ""
      return {
        title: "Tasks Report",
        subtitle: `${st}${range} • ${reportTotal ? `${reportTotal} total` : "Filtered view"}`,
      }
    }

    if (reportType === "new-customers") {
      return {
        title: "New Customers Report",
        subtitle: filters.date
          ? `Created on ${filters.date} • ${reportTotal ? `${reportTotal} total` : ""}`
          : `${reportTotal ? `${reportTotal} total` : "All new customers"}`,
      }
    }

    return { title: "Report", subtitle: "" }
  }, [reportType, filters.status, filters.from, filters.to, filters.date, reportTotal])

  const reportHeaderRight = useMemo(() => {
    if (!reportType) return null
    return (
      <div className="hidden md:flex items-center gap-2">
        <button
          onClick={() => fetchReport({ reset: true, cursorValue: null })}
          disabled={reportLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition text-sm font-semibold"
        >
          <FiRefreshCcw className={`w-4 h-4 ${reportLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
    )
  }, [reportType, reportLoading])

  const activeReportChips = useMemo(() => {
    if (!reportType) return []
    const chips = []

    const statusLabel = (v) => {
      if (!v || v === "all") return ""
      if (v === "in_progress") return "In progress"
      return String(v).replaceAll("_", " ")
    }

    if (reportType === "customers") {
      if (filters.status !== "all") chips.push({ key: "status", label: "Status", value: statusLabel(filters.status) })
      if (filters.sort && filters.sort !== "createdAt_desc") {
        chips.push({ key: "sort", label: "Sort", value: filters.sort === "createdAt_asc" ? "Oldest first" : "Newest first" })
      }
    }

    if (reportType === "tasks") {
      if (filters.status !== "all") chips.push({ key: "status", label: "Status", value: statusLabel(filters.status) })
      if (filters.from) chips.push({ key: "from", label: "From", value: filters.from })
      if (filters.to) chips.push({ key: "to", label: "To", value: filters.to })
    }

    if (reportType === "new-customers") {
      if (filters.date) chips.push({ key: "date", label: "Date", value: filters.date })
    }

    return chips
  }, [reportType, filters])

  const openFilters = () => {
    setDraft({
      status: filters.status || "all",
      sort: filters.sort || "createdAt_desc",
      from: filters.from || "",
      to: filters.to || "",
      date: filters.date || "",
    })
    setFiltersOpen(true)
  }

  const applyDraft = () => {
    setFilters((p) => ({
      ...p,
      status: draft.status ?? p.status,
      sort: draft.sort ?? p.sort,
      from: draft.from ?? p.from,
      to: draft.to ?? p.to,
      date: draft.date ?? p.date,
    }))
    setFiltersOpen(false)
  }

  const clearFilters = () => {
    if (reportType === "customers") {
      setFilters((p) => ({ ...p, q: "", status: "all", sort: "createdAt_desc", from: "", to: "", date: "" }))
    } else if (reportType === "tasks") {
      setFilters((p) => ({ ...p, q: "", status: "all", from: "", to: "", date: "", sort: "createdAt_desc" }))
    } else if (reportType === "new-customers") {
      setFilters((p) => ({ ...p, q: "", status: "all", date: "", from: "", to: "", sort: "createdAt_desc" }))
    }
  }

  const removeOneFilter = (key) => {
    if (key === "status") setFilters((p) => ({ ...p, status: "all" }))
    if (key === "sort") setFilters((p) => ({ ...p, sort: "createdAt_desc" }))
    if (key === "from") setFilters((p) => ({ ...p, from: "" }))
    if (key === "to") setFilters((p) => ({ ...p, to: "" }))
    if (key === "date") setFilters((p) => ({ ...p, date: "" }))
  }

  const FiltersModal = useMemo(() => {
    if (!filtersOpen) return null
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFiltersOpen(false)
          }}
        />
        <motion.div
          className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="w-full sm:max-w-4xl bg-white sm:rounded-3xl rounded-t-3xl shadow-[0_20px_80px_-40px_rgba(0,0,0,0.55)] border border-gray-100 overflow-hidden"
          >
            <div className="p-4 sm:p-6 border-b border-gray-100 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Filters</h3>
                  <p className="text-sm text-gray-500 mt-1">These filters will be applied to the report list.</p>
                </div>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
                  aria-label="Close filters"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {reportType === "customers" ? (
                  <>
                    <div className="md:col-span-6">
                      <Select
                        icon={<FiFilter className="w-4 h-4" />}
                        value={draft.status}
                        onChange={(v) => setDraft((p) => ({ ...p, status: v }))}
                        options={[
                          { value: "all", label: "All statuses" },
                          { value: "pending", label: "Pending" },
                          { value: "in_progress", label: "In progress" },
                          { value: "complete", label: "Completed" },
                          { value: "other", label: "Other" },
                        ]}
                      />
                    </div>

                    <div className="md:col-span-6">
                      <Select
                        icon={<FiTrendingUp className="w-4 h-4" />}
                        value={draft.sort}
                        onChange={(v) => setDraft((p) => ({ ...p, sort: v }))}
                        options={[
                          { value: "createdAt_desc", label: "Newest first" },
                          { value: "createdAt_asc", label: "Oldest first" },
                        ]}
                      />
                    </div>
                  </>
                ) : null}

                {reportType === "tasks" ? (
                  <>
                    <div className="md:col-span-4">
                      <Select
                        icon={<FiFilter className="w-4 h-4" />}
                        value={draft.status}
                        onChange={(v) => setDraft((p) => ({ ...p, status: v }))}
                        options={[
                          { value: "all", label: "All statuses" },
                          { value: "pending", label: "Pending" },
                          { value: "in_progress", label: "In progress" },
                          { value: "done", label: "Done" },
                        ]}
                      />
                    </div>

                    <div className="md:col-span-4">
                      <DateInput value={draft.from} onChange={(v) => setDraft((p) => ({ ...p, from: v }))} ariaLabel="From date" />
                    </div>
                    <div className="md:col-span-4">
                      <DateInput value={draft.to} onChange={(v) => setDraft((p) => ({ ...p, to: v }))} ariaLabel="To date" />
                    </div>

                    <div className="md:col-span-12">
                      <p className="text-xs text-gray-500 font-semibold mt-1">Tip: date filter applies to task updatedAt.</p>
                    </div>
                  </>
                ) : null}

                {reportType === "new-customers" ? (
                  <>
                    <div className="md:col-span-6">
                      <DateInput value={draft.date} onChange={(v) => setDraft((p) => ({ ...p, date: v }))} ariaLabel="Date" />
                    </div>
                    <div className="md:col-span-12">
                      <p className="text-xs text-gray-500 font-semibold mt-1">
                        Optional: select a date to filter. Leave empty to show all new customers.
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-100 bg-white flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setDraft({ status: "all", sort: "createdAt_desc", from: "", to: "", date: "" })
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition text-sm font-semibold"
              >
                Clear
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={applyDraft}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] transition text-sm font-semibold"
                >
                  Apply
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersOpen, draft, reportType])

  const reportSearchBar = useMemo(() => {
    if (!reportType) return null

    const hasAny = Boolean(filters.q) || activeReportChips.length > 0
    const placeholder = reportType === "tasks" ? "Search task title..." : "Search customer name, company, email..."

    return (
      <div className="p-4 sm:p-6 pb-3">
        <div className="flex justify-center sm:justify-start">
          <div className={searchWrap}>
            <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />

            {activeReportChips.map((c) => (
              <FilterChip key={c.key} label={c.label} value={c.value} onRemove={() => removeOneFilter(c.key)} />
            ))}

            {reportType !== "new-customers" ? (
              <input
                type="search"
                value={filters.q}
                onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                placeholder={placeholder}
                className={searchInput}
              />
            ) : (
              <div className="w-full sm:w-72 md:w-80 text-sm text-gray-500 py-2">
                {filters.date ? (
                  <span>
                    Showing customers created on <span className="font-extrabold text-gray-900">{filters.date}</span>
                  </span>
                ) : (
                  <span>
                    Showing <span className="font-extrabold text-gray-900">all</span> new customers
                  </span>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={openFilters}
              className={[
                "relative shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                "flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
              ].join(" ")}
              aria-label="Open filters"
              title="Filters"
            >
              <FiFilter className="w-4 h-4 text-gray-700" />
              {activeReportChips.length ? (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeReportChips.length}
                </span>
              ) : null}
            </button>

            {hasAny ? (
              <button
                type="button"
                onClick={clearFilters}
                className={[
                  "shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                  "flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
                ].join(" ")}
                aria-label="Clear"
                title="Clear"
              >
                <FiX className="w-4 h-4 text-gray-700" />
              </button>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Filters show inside the search bar. Click any chip <span className="font-bold">×</span> to remove it.
        </p>
      </div>
    )
  }, [reportType, filters, activeReportChips])

  const reportTable = useMemo(() => {
    if (!reportType) return null

    if (reportType === "customers" || reportType === "new-customers") {
      const columns = [
        {
          key: "name",
          label: "Customer",
          render: (r) => (
            <div className="min-w-0">
              <p className="font-extrabold text-gray-900 truncate">{r?.name || "Unnamed"}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{r?.companyName || r?.email || r?.phone || "—"}</p>
            </div>
          ),
        },
        { key: "status", label: "Status", render: (r) => <StatusPill status={r?.status} /> },
        { key: "createdAt", label: "Created", render: (r) => <span className="font-semibold text-gray-700">{fmtDate(r?.createdAt)}</span> },
        { key: "updatedAt", label: "Updated", render: (r) => <span className="font-semibold text-gray-700">{r?.updatedAt ? fmtDate(r?.updatedAt) : "—"}</span> },
      ]

      return (
        <div className="p-4 sm:p-6 pt-0 space-y-4">
          {reportError ? (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <FiAlertCircle className="w-5 h-5 mt-0.5" />
              <span className="text-sm font-semibold">{reportError}</span>
            </div>
          ) : null}

          <Table
            columns={columns}
            rows={reportItems}
            rowKey={(r) => String(r?._id)}
            emptyText={reportLoading ? "Loading…" : "No customers found"}
            colWidths={["320px", "160px", "220px", "220px"]}
            // ✅ CHANGED: open CRM directly, then close report modal
            onRowClick={(r) => {
              openCRM(r?._id)
              closeReport()
            }}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 font-semibold">
              Showing <span className="text-gray-700">{reportItems.length}</span>
              {reportTotal ? (
                <>
                  {" "}
                  of <span className="text-gray-700">{reportTotal}</span>
                </>
              ) : null}
            </p>

            <button
              onClick={loadMoreReport}
              disabled={!reportHasMore || reportLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition text-sm font-semibold"
            >
              <FiChevronDown className={`w-4 h-4 ${reportLoading ? "animate-bounce" : ""}`} />
              {reportLoading ? "Loading…" : reportHasMore ? "Load more" : "End"}
            </button>
          </div>
        </div>
      )
    }

    if (reportType === "tasks") {
      const columns = [
        {
          key: "title",
          label: "Task",
          render: (r) => (
            <div className="min-w-0">
              <p className="font-extrabold text-gray-900 truncate">{r?.title || "Untitled task"}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                <span className="font-semibold text-gray-700">{r?.customerName || "—"}</span>
                {r?.companyName ? <span className="text-gray-400"> • </span> : null}
                {r?.companyName ? <span>{r.companyName}</span> : null}
              </p>
            </div>
          ),
        },
        { key: "status", label: "Status", render: (r) => <StatusPill status={r?.status || "pending"} /> },
        { key: "updatedAt", label: "Updated", render: (r) => <span className="font-semibold text-gray-700">{fmtDate(r?.updatedAt || r?.createdAt)}</span> },
        {
          key: "customerStatus",
          label: "Customer",
          render: (r) => (
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="font-semibold text-gray-700 truncate">{r?.customerName || "—"}</span>
              <StatusPill status={r?.customerStatus} />
            </span>
          ),
        },
      ]

      return (
        <div className="p-4 sm:p-6 pt-0 space-y-4">
          {reportError ? (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <FiAlertCircle className="w-5 h-5 mt-0.5" />
              <span className="text-sm font-semibold">{reportError}</span>
            </div>
          ) : null}

          <Table
            columns={columns}
            rows={reportItems}
            rowKey={(r) => String(r?._id)}
            emptyText={reportLoading ? "Loading…" : "No tasks found"}
            colWidths={["360px", "160px", "220px", "260px"]}
            // ✅ CHANGED: open CRM by customerId then close modal
            onRowClick={(r) => {
              const cid = r?.customerId || r?._customerId
              openCRM(cid)
              closeReport()
            }}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 font-semibold">
              Showing <span className="text-gray-700">{reportItems.length}</span>
              {reportTotal ? (
                <>
                  {" "}
                  of <span className="text-gray-700">{reportTotal}</span>
                </>
              ) : null}
            </p>

            <button
              onClick={loadMoreReport}
              disabled={!reportHasMore || reportLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition text-sm font-semibold"
            >
              <FiChevronDown className={`w-4 h-4 ${reportLoading ? "animate-bounce" : ""}`} />
              {reportLoading ? "Loading…" : reportHasMore ? "Load more" : "End"}
            </button>
          </div>
        </div>
      )
    }

    return null
  }, [reportType, reportItems, reportError, reportLoading, reportHasMore, reportTotal, openCRM])

  // =========================
  // ✅ CHART CLICK → FILTERED REPORT
  // =========================
  const onCustomerStatusClick = (entry) => {
    const label = safeLower(entry?.payload?.name ?? entry?.name)
    const map = {
      pending: "pending",
      "in progress": "in_progress",
      in_progress: "in_progress",
      completed: "complete",
      complete: "complete",
      other: "other",
    }
    openReport("customers", { status: map[label] || "all" })
  }

  const onTaskStatusClick = (entry) => {
    const label = safeLower(entry?.payload?.name ?? entry?.name)
    const map = { pending: "pending", "in progress": "in_progress", in_progress: "in_progress", done: "done" }
    openReport("tasks", { status: map[label] || "all" })
  }

  const onNewCustomersClick = (payload) => {
    const dateKey = payload?.key || ""
    openReport("new-customers", { date: dateKey })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <AnimatePresence>
        {toast.message && (
          <Toast type={toast.type} message={toast.message} onClose={() => setToast({ type: "success", message: "" })} />
        )}
      </AnimatePresence>

      <ModalShell
        open={reportOpen}
        title={reportMeta.title}
        subtitle={reportMeta.subtitle}
        onClose={closeReport}
        rightHeader={reportHeaderRight}
      >
        {reportSearchBar}
        {FiltersModal}
        {reportTable}
      </ModalShell>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={`${soft} p-6`}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <FiActivity className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Customers, users and task activity overview</p>
              </div>
            </div>

            <button
              onClick={() => {
                fetchAll()
                showToast("success", "Refreshing…")
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 active:scale-[0.99] transition"
            >
              <FiRefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 ${isSuperAdmin ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            {isSuperAdmin ? <SkeletonCard /> : null}
          </>
        ) : (
          <>
            <StatCard icon={<FiUsers className="w-5 h-5" />} title="Customers" value={customerStats.total} hint="Total customers visible" tone="indigo" />
            <StatCard icon={<FiUserCheck className="w-5 h-5" />} title="Employees" value={employeesCount} hint="Employees (role-gated)" tone="gray" />
            <StatCard icon={<FiShield className="w-5 h-5" />} title="Admins" value={adminsCount} hint="Admin accounts (role-gated)" tone="gray" />
            <StatCard icon={<FiClipboard className="w-5 h-5" />} title="Tasks" value={taskStats.total} hint="All CRM tasks" tone="amber" />
            {isSuperAdmin ? (
              <StatCard icon={<FiShield className="w-5 h-5" />} title="Super Admins" value={superAdminsCount} hint="Visible only to Super Admin" tone="green" />
            ) : null}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="xl:col-span-1">
          <ChartCard
            title="Customer Status"
            subtitle="Pending / in progress / completed"
            icon={<FiDatabase className="w-5 h-5" />}
            clickable
            onClick={() => openReport("customers", { status: "all" })}
          >
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : customerStatusChart.length ? (
                <div className="h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie
                        data={customerStatusChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        onClick={(data) => onCustomerStatusClick(data)}
                      >
                        {customerStatusChart.map((_, i) => (
                          <Cell key={`c-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} style={{ cursor: "pointer" }} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">No data</div>
              )}
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-1">
          <ChartCard
            title="Task Status"
            subtitle="Pending / in progress / done"
            icon={<FiClipboard className="w-5 h-5" />}
            clickable
            onClick={() => openReport("tasks", { status: "all" })}
          >
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : (
                <div className="h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={taskStatusChart}
                      margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                      onClick={(e) => {
                        const clicked = e?.activePayload?.[0]?.payload
                        if (clicked) onTaskStatusClick(clicked)
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                        {taskStatusChart.map((_, i) => (
                          <Cell key={`b-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} style={{ cursor: "pointer" }} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-1">
          <ChartCard
            title="New Customers"
            subtitle="Last 7 days trend"
            icon={<FiTrendingUp className="w-5 h-5" />}
            clickable
            onClick={() => openReport("new-customers", {})}
          >
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : (
                <div className="h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={customersTrend}
                      margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                      onClick={(e) => {
                        const clicked = e?.activePayload?.[0]?.payload
                        if (clicked) onNewCustomersClick(clicked)
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </ChartCard>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent Customers */}
        <div className={`${soft} overflow-hidden`}>
          <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 flex items-center justify-center">
                <FiUsers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Recent Customers</h3>
                <p className="text-sm text-gray-500">Latest created customers</p>
              </div>
            </div>

            <button
              onClick={() => openReport("customers", { status: "all" })}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition text-sm font-semibold"
            >
              View report <FiArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-gray-50 h-[420px] overflow-y-auto">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : recentCustomers.length ? (
              <>
                <div className="p-4 space-y-3">
                  {recentCustomers.map((c) => (
                    <button
                      key={c._id}
                      className={`${card} p-4 w-full text-left hover:bg-gray-50/60 transition`}
                      // ✅ open CRM directly
                      onClick={() => openCRM(c?._id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-gray-900 truncate">{c?.name || "Unnamed"}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">{c?.companyName || c?.email || c?.phone || "—"}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created: <span className="font-semibold text-gray-700">{fmtDate(c?.createdAt)}</span>
                          </p>
                        </div>
                        <StatusPill status={c?.status} />
                      </div>
                    </button>
                  ))}
                </div>

                <PanelFooter
                  loading={customersLoadingMore}
                  disabled={!customersHasMore}
                  onClick={loadMoreCustomers}
                  label={customersHasMore ? "See more customers" : "No more customers"}
                />
              </>
            ) : (
              <div className="p-8 text-center">
                <div className={`${card} p-8`}>
                  <p className="text-sm font-semibold text-gray-900">No customers yet</p>
                  <p className="text-sm text-gray-500 mt-1">Create a customer to see activity here.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className={`${soft} overflow-hidden`}>
          <div className="p-5 border-b border-gray-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-600/10 flex items-center justify-center">
                <FiClock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">Recent Tasks</h3>
                <p className="text-sm text-gray-500">Latest updated tasks across customers</p>
              </div>
            </div>

            <button
              onClick={() => openReport("tasks", { status: "all" })}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition text-sm font-semibold"
            >
              View report <FiArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-gray-50 h-[420px] overflow-y-auto">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : recentTasks.length ? (
              <>
                <div className="p-4 space-y-3">
                  {recentTasks.map((t, idx) => {
                    const s = safeLower(t?.status)
                    const pill =
                      s === "done"
                        ? "bg-green-50 text-green-700 ring-green-600/10"
                        : s === "in_progress"
                          ? "bg-amber-50 text-amber-800 ring-amber-600/10"
                          : "bg-gray-100 text-gray-700 ring-gray-600/10"

                    // ✅ IMPORTANT: determine correct customer id field
                    const customerId = t?.customerId || t?._customerId

                    return (
                      <button
                        key={t?._id || `t-${idx}`}
                        className={`${card} p-4 w-full text-left hover:bg-gray-50/60 transition`}
                        // ✅ NOW TASK CARD OPENS CRM DIRECTLY
                        onClick={() => openCRM(customerId)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-gray-900 truncate">{t?.title || "Untitled task"}</p>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              <span className="font-semibold text-gray-700">{t?._customerName || "—"}</span>
                              {t?._companyName ? <span className="text-gray-400"> • </span> : null}
                              {t?._companyName ? <span>{t._companyName}</span> : null}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Updated: <span className="font-semibold text-gray-700">{fmtDate(t?.updatedAt || t?.createdAt)}</span>
                            </p>
                          </div>

                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${pill}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                            {s || "pending"}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <PanelFooter
                  loading={tasksLoadingMore}
                  disabled={!tasksHasMore}
                  onClick={loadMoreTasks}
                  label={tasksHasMore ? "See more tasks" : "No more tasks"}
                />
              </>
            ) : (
              <div className="p-8 text-center">
                <div className={`${card} p-8`}>
                  <p className="text-sm font-semibold text-gray-900">No tasks yet</p>
                  <p className="text-sm text-gray-500 mt-1">Tasks will appear once added to customers.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick access on mobile */}
      <div className="sm:hidden mt-6">
        <div className={`${soft} p-4`}>
          <p className="text-sm font-extrabold text-gray-900">Reports</p>
          <p className="text-xs text-gray-500 mt-1">Open full drill-down reports in a premium modal.</p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              onClick={() => openReport("customers", { status: "all" })}
              className="w-full inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
            >
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-900">
                <FiUsers className="w-4 h-4" /> Customers report
              </span>
              <FiArrowUpRight className="w-4 h-4 text-gray-500" />
            </button>

            <button
              onClick={() => openReport("tasks", { status: "all" })}
              className="w-full inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
            >
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-900">
                <FiClipboard className="w-4 h-4" /> Tasks report
              </span>
              <FiArrowUpRight className="w-4 h-4 text-gray-500" />
            </button>

            <button
              onClick={() => openReport("new-customers", {})}
              className="w-full inline-flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 active:scale-[0.99] transition"
            >
              <span className="inline-flex items-center gap-2 text-sm font-extrabold text-gray-900">
                <FiTrendingUp className="w-4 h-4" /> New customers report
              </span>
              <FiArrowUpRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
