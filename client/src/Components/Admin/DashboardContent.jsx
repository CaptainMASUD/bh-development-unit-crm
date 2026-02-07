"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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

import ReportModal from "./DashboardContentReportModal"

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
    <div className="fixed top-4 right-4 z-[60] max-w-sm w-[92vw] sm:w-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
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
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ${cfg.badge}`}>
            {icon}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">{hint || "—"}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, icon, children, onClickHint }) {
  return (
    <div className={`${soft} overflow-hidden`}>
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

        {onClickHint ? (
          <span className="text-xs font-semibold text-gray-500">{onClickHint}</span>
        ) : null}
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

// --- helpers to map chart label -> backend status
function mapCustomerChartNameToStatus(name) {
  const n = safeLower(name)
  if (n.includes("progress")) return "in_progress"
  if (n.includes("complete")) return "complete"
  if (n.includes("other")) return "other"
  return "all"
}
function mapTaskChartNameToStatus(name) {
  const n = safeLower(name)
  if (n === "pending") return "pending"
  if (n.includes("progress")) return "in_progress"
  if (n === "done") return "done"
  return "all"
}

function buildTrendKeys(days) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const keys = []
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(now)
    dt.setDate(now.getDate() - i)
    keys.push(dt.toISOString().slice(0, 10)) // YYYY-MM-DD
  }
  return keys
}

export default function Dashboard() {
  const DAYS = 7
  const PAGE_SIZE = 6

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [toast, setToast] = useState({ type: "success", message: "" })
  const toastTimer = useRef(null)

  const [me, setMe] = useState(null)

  const [customerStats, setCustomerStats] = useState({
    total: 0,
    inProgress: 0,
    complete: 0,
    other: 0,
  })

  const [employeesCount, setEmployeesCount] = useState(0)
  const [adminsCount, setAdminsCount] = useState(0)
  const [superAdminsCount, setSuperAdminsCount] = useState(0)

  const [customerStatusChart, setCustomerStatusChart] = useState([])
  const [taskStatusChart, setTaskStatusChart] = useState([])
  const [customersTrend, setCustomersTrend] = useState([])

  // Lists
  const [recentCustomers, setRecentCustomers] = useState([])
  const [recentTasks, setRecentTasks] = useState([])

  // Cursor-based for customers (kept from your customers endpoint)
  const [customersCursor, setCustomersCursor] = useState(null)
  const [customersHasMore, setCustomersHasMore] = useState(true)
  const [customersLoadingMore, setCustomersLoadingMore] = useState(false)

  // Cursor-based for tasks (UPDATED to use /api/dashboard/reports/tasks)
  const [tasksCursor, setTasksCursor] = useState(null)
  const [tasksHasMore, setTasksHasMore] = useState(true)
  const [tasksLoadingMore, setTasksLoadingMore] = useState(false)

  const isSuperAdmin = me?.role === "superadmin"
  const abortRef = useRef(null)

  // ---- Report Modal State
  const [reportOpen, setReportOpen] = useState(false)
  const [reportType, setReportType] = useState(null) // "customers" | "tasks" | "newCustomers"
  const [reportTitle, setReportTitle] = useState("")
  const [reportSubtitle, setReportSubtitle] = useState("")
  const [reportStatus, setReportStatus] = useState("all")
  const [reportDate, setReportDate] = useState(null) // YYYY-MM-DD

  const openReport = ({ type, title, subtitle, status = "all", date = null }) => {
    setReportType(type)
    setReportTitle(title || "Report")
    setReportSubtitle(subtitle || "")
    setReportStatus(status || "all")
    setReportDate(date || null)
    setReportOpen(true)
  }

  const closeReport = () => {
    setReportOpen(false)
    setReportType(null)
    setReportTitle("")
    setReportSubtitle("")
    setReportStatus("all")
    setReportDate(null)
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(
      () => setToast({ type: "success", message: "" }),
      2200
    )
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
        inProgress: Number(data?.customerStats?.inProgress ?? 0),
        complete: Number(data?.customerStats?.complete ?? 0),
        other: Number(data?.customerStats?.other ?? 0),
      })

      setCustomerStatusChart(Array.isArray(data?.customerStatusChart) ? data.customerStatusChart : [])
      setTaskStatusChart(Array.isArray(data?.taskStatusChart) ? data.taskStatusChart : [])

      // Trend needs YYYY-MM-DD to call report endpoint.
      // Since backend trend only returns labels, we compute keys client-side based on DAYS.
      const trendKeys = buildTrendKeys(DAYS)
      const trendRaw = Array.isArray(data?.newCustomersTrend) ? data.newCustomersTrend : []
      const trendWithKey = trendRaw.map((x, idx) => ({
        ...x,
        _key: trendKeys[idx] || null,
        _index: idx,
      }))
      setCustomersTrend(trendWithKey)

      const rc = Array.isArray(data?.recentCustomers) ? data.recentCustomers : []
      const rt = Array.isArray(data?.recentTasks) ? data.recentTasks : []

      setRecentCustomers(rc)
      setRecentTasks(rt)

      // init customers cursor (use last item _id)
      const lastCustomerId = rc?.length ? rc[rc.length - 1]?._id : null
      setCustomersCursor(lastCustomerId || null)
      setCustomersHasMore(Boolean(lastCustomerId))

      // For tasks list pagination, we now use /reports/tasks cursor format returned by backend (ISO|taskId)
      // But initial dashboard recentTasks doesn't provide cursor format, so we synthesize from last row.
      // Our report endpoint sorts by updatedAt desc, _id desc, same as dashboard recentTasks.
      const lastTask = rt?.length ? rt[rt.length - 1] : null
      const lastUpdated = lastTask?.updatedAt || lastTask?.createdAt
      const lastTaskId = lastTask?._id
      const initialTaskCursor =
        lastUpdated && lastTaskId ? `${new Date(lastUpdated).toISOString()}|${String(lastTaskId)}` : null
      setTasksCursor(initialTaskCursor)
      setTasksHasMore(Boolean(initialTaskCursor))

      // role-gated counts
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
    const getV = (name) =>
      Number(taskStatusChart.find((x) => safeLower(x?.name) === name)?.value ?? 0)

    const pending = getV("pending")
    const inProgress = getV("in progress") || getV("in_progress")
    const done = getV("done")
    const total = pending + inProgress + done

    return { total, pending, inProgress, done }
  }, [taskStatusChart])

  // ✅ Load more customers (kept from your /api/customers endpoint)
  const loadMoreCustomers = async () => {
    if (customersLoadingMore || !customersHasMore || !customersCursor) return
    setCustomersLoadingMore(true)

    try {
      const res = await fetch(
        `${API}/api/customers?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(customersCursor)}`,
        {
          headers: getAuthHeaders(),
          credentials: "include",
        }
      )
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

  // ✅ Load more tasks (UPDATED: use new backend)
  const loadMoreTasks = async () => {
    if (tasksLoadingMore || !tasksHasMore) return
    setTasksLoadingMore(true)

    try {
      const cursorTry = tasksCursor ? `&cursor=${encodeURIComponent(tasksCursor)}` : ""
      const res = await fetch(
        `${API}/api/dashboard/reports/tasks?status=all&limit=${PAGE_SIZE}${cursorTry}`,
        {
          headers: getAuthHeaders(),
          credentials: "include",
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to load more tasks")

      const items = Array.isArray(data?.items) ? data.items : []
      const nextCursor = data?.nextCursor || null
      const hasMore = Boolean(data?.hasMore) && Boolean(nextCursor) && items.length > 0

      // map items to the shape your UI expects (same as dashboard recentTasks)
      const mapped = items.map((t) => ({
        _id: t._id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
        _customerName: t.customerName,
        _companyName: t.companyName,
        _customerStatus: t.customerStatus,
      }))

      setRecentTasks((prev) => {
        const map = new Map(prev.map((x) => [String(x._id), x]))
        mapped.forEach((x) => map.set(String(x._id), x))
        return Array.from(map.values())
      })

      setTasksCursor(nextCursor)
      setTasksHasMore(hasMore)
    } catch (e) {
      showToast("error", e?.message || "Failed to load more tasks")
    } finally {
      setTasksLoadingMore(false)
    }
  }

  // ---- Chart click handlers (open modal)
  const onCustomerPieClick = (slice) => {
    const label = slice?.name
    const status = mapCustomerChartNameToStatus(label)
    openReport({
      type: "customers",
      title: "Customer Status Report",
      subtitle: `Filter: ${label || "All"}`,
      status,
    })
  }

  const onTaskBarClick = (bar) => {
    const label = bar?.name
    const status = mapTaskChartNameToStatus(label)
    openReport({
      type: "tasks",
      title: "Task Status Report",
      subtitle: `Filter: ${label || "All"}`,
      status,
    })
  }

  const onTrendPointClick = (state) => {
    // recharts passes a click "state" with activePayload etc.
    const p = state?.activePayload?.[0]?.payload
    const dateKey = p?._key
    const label = p?.name
    if (!dateKey) return

    openReport({
      type: "newCustomers",
      title: "New Customers Report",
      subtitle: `Date: ${label} (${dateKey})`,
      date: dateKey,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <AnimatePresence>
        {toast.message && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast({ type: "success", message: "" })}
          />
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <ReportModal
        open={reportOpen}
        onClose={closeReport}
        apiBase={API}
        type={reportType}
        title={reportTitle}
        subtitle={reportSubtitle}
        initialStatus={reportStatus}
        initialDate={reportDate}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
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

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      {/* Top Stats */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 ${
          isSuperAdmin ? "xl:grid-cols-5" : "xl:grid-cols-4"
        }`}
      >
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
            <StatCard
              icon={<FiUsers className="w-5 h-5" />}
              title="Customers"
              value={customerStats.total}
              hint="Total customers visible"
              tone="indigo"
            />
            <StatCard
              icon={<FiUserCheck className="w-5 h-5" />}
              title="Employees"
              value={employeesCount}
              hint="Employees (role-gated)"
              tone="gray"
            />
            <StatCard
              icon={<FiShield className="w-5 h-5" />}
              title="Admins"
              value={adminsCount}
              hint="Admin accounts (role-gated)"
              tone="gray"
            />
            <StatCard
              icon={<FiClipboard className="w-5 h-5" />}
              title="Tasks"
              value={taskStats.total}
              hint="All CRM tasks"
              tone="amber"
            />
            {isSuperAdmin ? (
              <StatCard
                icon={<FiShield className="w-5 h-5" />}
                title="Super Admins"
                value={superAdminsCount}
                hint="Visible only to Super Admin"
                tone="green"
              />
            ) : null}
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="xl:col-span-1">
          <ChartCard
            title="Customer Status"
            subtitle="In progress vs completed"
            icon={<FiDatabase className="w-5 h-5" />}
           
          >
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : customerStatusChart.length ? (
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
                      onClick={onCustomerPieClick}
                      className="cursor-pointer"
                    >
                      {customerStatusChart.map((_, i) => (
                        <Cell key={`c-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">No data</div>
              )}
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-1">
          <ChartCard
            title="Task Status"
            subtitle="Pending / In progress / Done"
            icon={<FiClipboard className="w-5 h-5" />}
           
          >
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskStatusChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]} onClick={onTaskBarClick} className="cursor-pointer">
                      {taskStatusChart.map((_, i) => (
                        <Cell key={`b-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-1">
          <ChartCard
            title="New Customers"
            subtitle="Last 7 days trend"
            icon={<FiTrendingUp className="w-5 h-5" />}
            
          >
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={customersTrend}
                    margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                    onClick={onTrendPointClick}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={3} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Lists */}
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
          </div>

          <div className="bg-gray-50 h-[420px] overflow-y-auto">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : recentCustomers.length ? (
              <>
                <div className="p-4 space-y-3">
                  {recentCustomers.map((c) => (
                    <div key={c._id} className={`${card} p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-gray-900 truncate">{c?.name || "Unnamed"}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {c?.companyName || c?.email || c?.phone || "—"}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created: <span className="font-semibold text-gray-700">{fmtDate(c?.createdAt)}</span>
                          </p>
                        </div>
                        <StatusPill status={c?.status} />
                      </div>
                    </div>
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

                    return (
                      <div key={t?._id || `t-${idx}`} className={`${card} p-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-gray-900 truncate">{t?.title || "Untitled task"}</p>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                              <span className="font-semibold text-gray-700">{t?._customerName || "—"}</span>
                              {t?._companyName ? <span className="text-gray-400"> • </span> : null}
                              {t?._companyName ? <span>{t._companyName}</span> : null}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Updated:{" "}
                              <span className="font-semibold text-gray-700">{fmtDate(t?.updatedAt || t?.createdAt)}</span>
                            </p>
                          </div>

                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${pill}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                            {s || "pending"}
                          </span>
                        </div>
                      </div>
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
    </div>
  )
}
