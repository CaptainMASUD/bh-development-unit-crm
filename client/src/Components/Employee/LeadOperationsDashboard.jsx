"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  FiAlertCircle,
  FiBell,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiRefreshCcw,
  FiTarget,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PIPELINE_STAGES = ["new", "qualified", "discovery", "proposal", "negotiation", "won", "lost"]
const STAGE_LABELS = {
  new: "New",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
}
const STAGE_TONES = {
  new: "bg-slate-100 text-slate-700",
  qualified: "bg-sky-100 text-sky-700",
  discovery: "bg-violet-100 text-violet-700",
  proposal: "bg-amber-100 text-amber-800",
  negotiation: "bg-orange-100 text-orange-800",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-rose-100 text-rose-700",
}

const card = "rounded-3xl border border-gray-100 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)]"

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiJson(path, signal) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || data?.error || "Request failed")
  return data
}

function formatDate(value, withTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date)
}

function isToday(value) {
  if (!value) return false
  const date = new Date(value)
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}

function StatCard({ icon, title, value, hint, tone }) {
  return (
    <div className={`${card} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{value}</p>
          <p className="mt-1 text-xs font-medium text-gray-500">{hint}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      </div>
    </div>
  )
}

function StageBadge({ stage }) {
  const normalized = String(stage || "new").toLowerCase()
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STAGE_TONES[normalized] || STAGE_TONES.new}`}>
      {STAGE_LABELS[normalized] || normalized}
    </span>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-gray-100 p-4">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="mt-3 h-3 w-72 max-w-full rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}

export default function LeadOperationsDashboard({ embedded = false }) {
  const [leads, setLeads] = useState([])
  const [leadSummary, setLeadSummary] = useState(null)
  const [queueSummary, setQueueSummary] = useState({})
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState(null)
  const abortRef = useRef(null)

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null")
    } catch {
      return null
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError("")

    try {
      const [leadResult, queueResult, notificationResult] = await Promise.allSettled([
        apiJson("/leads?limit=60&sort=newest&includeSummary=true", controller.signal),
        apiJson("/work-queue/summary", controller.signal),
        apiJson("/notifications/my", controller.signal),
      ])

      if (leadResult.status === "rejected") throw leadResult.reason

      setLeads(Array.isArray(leadResult.value?.items) ? leadResult.value.items : [])
      setLeadSummary(leadResult.value?.summary || null)
      setQueueSummary(queueResult.status === "fulfilled" ? queueResult.value?.summary || {} : {})
      setUnreadAlerts(notificationResult.status === "fulfilled"
        ? Number(notificationResult.value?.unreadCount || 0)
        : 0)
      setLastUpdated(new Date())
    } catch (loadError) {
      if (loadError?.name !== "AbortError") {
        setError(loadError?.message || "Failed to load the lead dashboard.")
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
    return () => abortRef.current?.abort()
  }, [loadDashboard])

  const dashboard = useMemo(() => {
    const byStage = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0]))
    if (leadSummary?.byStage) {
      PIPELINE_STAGES.forEach((stage) => {
        byStage[stage] = Number(leadSummary.byStage[stage] || 0)
      })
    } else {
      leads.forEach((lead) => {
        const stage = String(lead?.pipelineStage || "new").toLowerCase()
        byStage[stage] = (byStage[stage] || 0) + 1
      })
    }

    return {
      byStage,
      total: Number(leadSummary?.total ?? leads.length),
      overdue: Number(leadSummary?.overdue ?? leads.filter((lead) => lead?.isOverdue).length),
      followUpsToday: Number(leadSummary?.followUpsToday ?? leads.filter((lead) => isToday(lead?.nextFollowUpAt)).length),
      latest: leads.slice(0, 10),
      active: Number(leadSummary?.active ?? leads.filter((lead) => !["won", "lost"].includes(String(lead?.pipelineStage || ""))).length),
      maxStageCount: Math.max(1, ...Object.values(byStage)),
    }
  }, [leadSummary, leads])

  return (
    <div className={embedded ? "space-y-5" : "min-h-screen bg-gradient-to-b from-gray-50 to-white p-1 sm:p-3"}>
      <div className={embedded ? "space-y-5" : "mx-auto max-w-[1500px]"}>
        {!embedded && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`${card} mb-5 p-5 sm:p-6`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <FiTrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-gray-950">Lead Dashboard</h1>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  {user?.name ? `Welcome, ${user.name}. ` : ""}Your latest lead pipeline and today&apos;s workload.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-gray-500">Last updated</p>
                <p className="text-sm font-bold text-gray-800">{lastUpdated ? formatDate(lastUpdated, true) : "—"}</p>
              </div>
              <button
                type="button"
                onClick={loadDashboard}
                disabled={loading}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
              >
                <FiRefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>
        )}

        {error ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<FiTarget className="h-5 w-5" />} title="Total leads" value={loading && !leads.length ? "—" : dashboard.total} hint="All accessible leads" tone="bg-indigo-50 text-indigo-700" />
          <StatCard icon={<FiTrendingUp className="h-5 w-5" />} title="Active pipeline" value={loading && !leads.length ? "—" : dashboard.active} hint="Excludes won and lost" tone="bg-sky-50 text-sky-700" />
          <StatCard icon={<FiClock className="h-5 w-5" />} title="Overdue" value={loading && !leads.length ? "—" : dashboard.overdue} hint="Needs attention now" tone="bg-rose-50 text-rose-700" />
          <StatCard icon={<FiCalendar className="h-5 w-5" />} title="Follow-ups today" value={loading && !leads.length ? "—" : dashboard.followUpsToday} hint="Scheduled for today" tone="bg-amber-50 text-amber-800" />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.75fr]">
          <div className={`${card} overflow-hidden`}>
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-black text-gray-950">Pipeline snapshot</h2>
              <p className="mt-1 text-sm text-gray-500">Stage distribution across all accessible leads.</p>
            </div>
            <div className="space-y-4 p-5">
              {PIPELINE_STAGES.map((stage) => {
                const count = dashboard.byStage[stage] || 0
                const width = `${Math.max(count ? 6 : 0, (count / dashboard.maxStageCount) * 100)}%`
                return (
                  <div key={stage} className="grid grid-cols-[105px_1fr_32px] items-center gap-3">
                    <span className="text-sm font-bold text-gray-700">{STAGE_LABELS[stage]}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width }} />
                    </div>
                    <span className="text-right text-sm font-black text-gray-900">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className={`${card} p-5`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <FiZap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-950">Today&apos;s work</h2>
                <p className="text-sm text-gray-500">Personal queue summary</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ["Pending", queueSummary.pending || 0, "bg-amber-50 text-amber-800"],
                ["In progress", queueSummary.inProgress || 0, "bg-sky-50 text-sky-700"],
                ["Done", queueSummary.done || 0, "bg-emerald-50 text-emerald-700"],
                ["Overdue", queueSummary.overdue || 0, "bg-rose-50 text-rose-700"],
              ].map(([label, value, tone]) => (
                <div key={label} className={`rounded-2xl p-4 ${tone}`}>
                  <p className="text-xs font-bold">{label}</p>
                  <p className="mt-1 text-2xl font-black">{loading ? "—" : value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-700">
                <FiBell className="h-4 w-4 text-indigo-600" />Unread alerts
              </span>
              <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-black text-white">{loading ? "—" : unreadAlerts}</span>
            </div>
          </div>
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-gray-950">Latest leads</h2>
              <p className="mt-1 text-sm text-gray-500">Newest records appear first.</p>
            </div>
            <FiFileText className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500">Lead</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500">Company</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500">Stage</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500">Priority</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500">Next follow-up</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && !leads.length ? (
                  <tr><td colSpan="6" className="p-5"><LoadingRows /></td></tr>
                ) : dashboard.latest.length ? dashboard.latest.map((lead) => (
                  <tr key={lead?._id} className="transition hover:bg-indigo-50/40">
                    <td className="px-5 py-3">
                      <p className="font-bold text-gray-950">{lead?.contact?.name || "Unnamed lead"}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{lead?.leadNumber || lead?.contact?.email || "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-700">{lead?.contact?.companyName || "—"}</td>
                    <td className="px-5 py-3"><StageBadge stage={lead?.pipelineStage} /></td>
                    <td className="px-5 py-3 text-sm font-bold capitalize text-gray-700">{lead?.priority || "—"}</td>
                    <td className={`px-5 py-3 text-sm font-medium ${lead?.isOverdue ? "text-rose-700" : "text-gray-700"}`}>{formatDate(lead?.nextFollowUpAt, true)}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-600">{formatDate(lead?.createdAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="p-10 text-center">
                      <FiCheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
                      <p className="mt-3 font-bold text-gray-900">No leads available</p>
                      <p className="mt-1 text-sm text-gray-500">Newly assigned leads will appear here.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

