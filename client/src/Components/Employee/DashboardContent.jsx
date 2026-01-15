"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FiUsers,
  FiDatabase,
  FiRefreshCcw,
  FiClock,
  FiCheckCircle,
  FiUser,
  FiClipboard,
  FiAlertCircle,
  FiTrendingUp,
  FiList,
  FiPlayCircle,
  FiPauseCircle,
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
} from "recharts"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

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

function formatDateTime(v) {
  const d = v ? new Date(v) : null
  if (!d || Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

/** Premium shadow + hover */
const premiumCard =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-14px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_46px_-18px_rgba(0,0,0,0.45)] transition-all"

function IconBadge({ icon, tone = "indigo" }) {
  const toneMap = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    green: "bg-green-50 text-green-700 ring-green-600/10",
    yellow: "bg-amber-50 text-amber-800 ring-amber-600/10",
    gray: "bg-gray-100 text-gray-700 ring-gray-600/10",
    red: "bg-red-50 text-red-700 ring-red-600/10",
  }
  return (
    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ${toneMap[tone]}`}>
      {icon}
    </div>
  )
}

/* =========================
   TOP 4 CARDS: keep old color shades,
   remove ONLY the top color bar
========================= */
function StatCard({ icon, title, value, hint, tone = "indigo" }) {
  const toneCfg = {
    indigo: {
      badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
      glow: "shadow-[0_18px_50px_-26px_rgba(79,70,229,0.45)]",
    },
    yellow: {
      badge: "bg-amber-50 text-amber-800 ring-amber-600/10",
      glow: "shadow-[0_18px_50px_-26px_rgba(245,158,11,0.45)]",
    },
    green: {
      badge: "bg-green-50 text-green-700 ring-green-600/10",
      glow: "shadow-[0_18px_50px_-26px_rgba(22,163,74,0.45)]",
    },
    gray: {
      badge: "bg-gray-100 text-gray-700 ring-gray-600/10",
      glow: "shadow-[0_18px_50px_-26px_rgba(75,85,99,0.35)]",
    },
    red: {
      badge: "bg-red-50 text-red-700 ring-red-600/10",
      glow: "shadow-[0_18px_50px_-26px_rgba(220,38,38,0.4)]",
    },
  }

  const cfg = toneCfg[tone] || toneCfg.indigo

  return (
    <div className={`${premiumCard} ${cfg.glow} relative overflow-hidden`}>
      {/* top bar removed */}
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

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 truncate">{hint || "—"}</p>
          <span className="shrink-0 text-[11px] font-extrabold text-gray-700 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
            LIVE
          </span>
        </div>
      </div>
    </div>
  )
}

function Pill({ icon, label, value, tone = "indigo" }) {
  const toneMap = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    green: "bg-green-50 text-green-700 ring-green-600/10",
    yellow: "bg-amber-50 text-amber-800 ring-amber-600/10",
    gray: "bg-gray-100 text-gray-700 ring-gray-600/10",
  }
  return (
    <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl ring-1 ${toneMap[tone]}`}>
      <span className="opacity-90">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm font-extrabold">{value}</span>
    </div>
  )
}

function MiniMetric({ icon, label, value, tone = "gray" }) {
  const toneMap = {
    gray: "bg-gray-50 border-gray-100",
    yellow: "bg-amber-50 border-amber-100",
    green: "bg-green-50 border-green-100",
    indigo: "bg-indigo-50 border-indigo-100",
  }
  const iconMap = {
    gray: "text-gray-700",
    yellow: "text-amber-800",
    green: "text-green-700",
    indigo: "text-indigo-700",
  }

  return (
    <div className={`rounded-2xl border ${toneMap[tone] || toneMap.gray} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`${iconMap[tone] || iconMap.gray}`}>{icon}</span>
          <p className="text-xs text-gray-600">{label}</p>
        </div>
        <p className="text-xl font-extrabold tracking-tight text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status, variant = "task" }) {
  const s = safeLower(status)
  let cls = "bg-gray-100 text-gray-700"

  if (variant === "task") {
    cls =
      s === "done"
        ? "bg-green-100 text-green-800"
        : s === "in_progress"
          ? "bg-amber-100 text-amber-900"
          : s === "pending"
            ? "bg-gray-100 text-gray-700"
            : "bg-gray-100 text-gray-700"
  } else {
    cls =
      s === "complete"
        ? "bg-green-100 text-green-800"
        : s === "in_progress"
          ? "bg-amber-100 text-amber-900"
          : "bg-gray-100 text-gray-700"
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className={`${premiumCard} p-4`}>
      <div className="animate-pulse flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="h-4 w-44 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-72 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-56 bg-gray-200 rounded" />
        </div>
        <div className="h-6 w-20 bg-gray-200 rounded-full" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center ring-1 ring-indigo-600/10">
        <FiTrendingUp className="w-6 h-6" />
      </div>
      <p className="mt-3 text-sm font-extrabold text-gray-900">No tasks in progress</p>
      <p className="mt-1 text-sm text-gray-500">Everything looks good — new tasks will appear here.</p>
    </div>
  )
}

function ChartCard({ title, subtitle, icon, children }) {
  return (
    <div className={`${premiumCard} overflow-hidden`}>
      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <IconBadge icon={icon} tone="indigo" />
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

const CHART_COLORS = ["#6366F1", "#F59E0B", "#22C55E", "#6B7280", "#EF4444"]

export default function DashboardContent() {
  const [customers, setCustomers] = useState([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const abortRef = useRef(null)

  const currentUserId = useMemo(() => {
    try {
      const stored = localStorage.getItem("user")
      const u = stored ? JSON.parse(stored) : null
      return u?._id || u?.id || null
    } catch {
      return null
    }
  }, [])

  const fetchCustomers = async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: "GET",
        headers: getAuthHeaders(),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to fetch customers")

      const list = Array.isArray(data?.customers) ? data.customers : []
      setCustomers(list)
      setCount(Number(data?.count ?? list.length))
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error(e)
        setError(e?.message || "Failed to load dashboard data.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const customerStats = useMemo(() => {
    const total = count || customers.length
    const inProgress = customers.filter((c) => safeLower(c?.status) === "in_progress").length
    const complete = customers.filter((c) => safeLower(c?.status) === "complete").length

    const assignedToMe = currentUserId
      ? customers.filter((c) => String(c?.assignedTo?._id || c?.assignedTo || "") === String(currentUserId)).length
      : 0

    return { total, inProgress, complete, assignedToMe }
  }, [customers, count, currentUserId])

  const taskStats = useMemo(() => {
    const allTasks = customers.flatMap((c) =>
      Array.isArray(c?.crmTasks)
        ? c.crmTasks.map((t) => ({
            ...t,
            _customerId: c?._id,
            _customerName: c?.name,
            _companyName: c?.companyName,
            _assignedToName: c?.assignedTo?.name,
          }))
        : []
    )

    const total = allTasks.length
    const pending = allTasks.filter((t) => safeLower(t?.status) === "pending").length
    const inProgress = allTasks.filter((t) => safeLower(t?.status) === "in_progress").length
    const done = allTasks.filter((t) => safeLower(t?.status) === "done").length

    return { total, pending, inProgress, done, allTasks }
  }, [customers])

  const inProgressTasks = useMemo(() => {
    const list = taskStats.allTasks
      .filter((t) => safeLower(t?.status) === "in_progress")
      .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))
    return list.slice(0, 10)
  }, [taskStats.allTasks])

  const customerStatusChart = useMemo(() => {
    const total = customerStats.total
    const completed = customerStats.complete
    const inProg = customerStats.inProgress
    const other = Math.max(0, total - completed - inProg)

    return [
      { name: "In Progress", value: inProg },
      { name: "Completed", value: completed },
      { name: "Other", value: other },
    ].filter((x) => x.value > 0)
  }, [customerStats.total, customerStats.complete, customerStats.inProgress])

  const taskStatusChart = useMemo(() => {
    return [
      { name: "Pending", value: taskStats.pending },
      { name: "In Progress", value: taskStats.inProgress },
      { name: "Done", value: taskStats.done },
    ]
  }, [taskStats.pending, taskStats.inProgress, taskStats.done])

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={`${premiumCard} p-6`}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                <FiUsers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
                <p className="text-sm text-gray-500">Customers and task activity at a glance</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Pill
                icon={<FiDatabase className="w-4 h-4" />}
                label="Customers"
                value={isLoading && customers.length === 0 ? "—" : customerStats.total}
                tone="indigo"
              />

              <button
                onClick={fetchCustomers}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60 shadow-sm"
                title="Refresh"
              >
                <FiRefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${premiumCard} mb-6 p-4 bg-red-50 border border-red-200 text-red-700 flex items-start gap-2`}
        >
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm">{error}</span>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<FiUsers className="w-5 h-5" />} title="Total Customers" value={isLoading && customers.length === 0 ? "—" : customerStats.total} hint="All customers visible to you" tone="indigo" />
        <StatCard icon={<FiClock className="w-5 h-5" />} title="In Progress" value={isLoading && customers.length === 0 ? "—" : customerStats.inProgress} hint="Currently being handled" tone="yellow" />
        <StatCard icon={<FiCheckCircle className="w-5 h-5" />} title="Completed" value={isLoading && customers.length === 0 ? "—" : customerStats.complete} hint="Finished customers" tone="green" />
        <StatCard icon={<FiUser className="w-5 h-5" />} title="Assigned to You" value={isLoading && customers.length === 0 ? "—" : customerStats.assignedToMe} hint="Your active ownership" tone="gray" />
      </motion.div>

      {/* Charts (Task Activity removed) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="xl:col-span-1">
          <ChartCard title="Customer Status" subtitle="Distribution of customers" icon={<FiUsers className="w-5 h-5" />}>
            <div className="h-64">
              {isLoading && customers.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : customerStatusChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie data={customerStatusChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
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
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="xl:col-span-2">
          <ChartCard title="Task Status" subtitle="Pending vs In Progress vs Done" icon={<FiClipboard className="w-5 h-5" />}>
            <div className="h-64">
              {isLoading && customers.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-500">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskStatusChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {taskStatusChart.map((_, i) => (
                        <Cell key={`b-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>
        </motion.div>
      </div>

      {/* Task Summary + In Progress Tasks */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Task summary */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="xl:col-span-1">
          <div className={`${premiumCard} p-5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IconBadge icon={<FiClipboard className="w-5 h-5" />} tone="indigo" />
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Task Overview</h2>
                  <p className="text-sm text-gray-500">Across your customers</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric icon={<FiList className="w-4 h-4" />} label="Total" value={isLoading && customers.length === 0 ? "—" : taskStats.total} tone="gray" />
              <MiniMetric icon={<FiPlayCircle className="w-4 h-4" />} label="In Progress" value={isLoading && customers.length === 0 ? "—" : taskStats.inProgress} tone="yellow" />
              <MiniMetric icon={<FiPauseCircle className="w-4 h-4" />} label="Pending" value={isLoading && customers.length === 0 ? "—" : taskStats.pending} tone="indigo" />
              <MiniMetric icon={<FiCheckCircle className="w-4 h-4" />} label="Done" value={isLoading && customers.length === 0 ? "—" : taskStats.done} tone="green" />
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span className="inline-flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLoading ? "bg-amber-500" : "bg-green-500"}`} />
                {isLoading ? "Updating…" : "Up to date"}
              </span>
              <span className="font-semibold text-gray-700">{!isLoading && customers.length > 0 ? "Ready" : "—"}</span>
            </div>
          </div>
        </motion.div>

        {/* In progress tasks list */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="xl:col-span-2">
          <div className={`${premiumCard} overflow-hidden`}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <IconBadge icon={<FiTrendingUp className="w-5 h-5" />} tone="indigo" />
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">In Progress Tasks</h2>
                  <p className="text-sm text-gray-500">Most recently updated</p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{Math.min(inProgressTasks.length, 10)}</span>{" "}
                <span className="text-gray-400">/</span>{" "}
                <span className="font-semibold text-gray-900">{taskStats.inProgress}</span>
              </div>
            </div>

            <div className="p-4 space-y-3 bg-gray-50">
              <AnimatePresence>
                {isLoading && customers.length === 0 ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : inProgressTasks.length > 0 ? (
                  inProgressTasks.map((t, idx) => (
                    <motion.div
                      key={t?._id || `task-${idx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      whileHover={{ y: -2 }}
                      className={`${premiumCard} p-4 bg-white`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-gray-900 truncate">{t?.title || "Untitled task"}</p>

                          <p className="text-xs text-gray-500 mt-1">
                            <span className="font-semibold text-gray-700">{t?._customerName || "—"}</span>
                            {t?._companyName ? <span className="text-gray-400"> • </span> : null}
                            {t?._companyName ? <span>{t._companyName}</span> : null}
                          </p>

                          <p className="text-xs text-gray-500 mt-1">
                            Updated <span className="font-semibold text-gray-700">{formatDateTime(t?.updatedAt || t?.createdAt)}</span>
                            <span className="text-gray-400"> • </span>
                            Assigned <span className="font-semibold text-gray-700">{t?._assignedToName || "—"}</span>
                          </p>

                          {t?.description ? <p className="text-sm text-gray-600 mt-2 line-clamp-2">{t.description}</p> : null}
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <StatusBadge status={t?.status} variant="task" />
                          <StatusBadge
                            status={
                              t?._customerId
                                ? customers.find((c) => String(c._id) === String(t._customerId))?.status || "—"
                                : "—"
                            }
                            variant="customer"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className={`${premiumCard} bg-white`}>
                    <EmptyState />
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex justify-between items-center p-4 text-sm text-gray-500 border-t border-gray-100 bg-white">
              <span className="inline-flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLoading ? "bg-amber-500" : "bg-green-500"}`} />
                {isLoading ? "Updating…" : "Up to date"}
              </span>
              <span className="font-semibold text-gray-700">{!isLoading && customers.length > 0 ? "Ready" : "—"}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
