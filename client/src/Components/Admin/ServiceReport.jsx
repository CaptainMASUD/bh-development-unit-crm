"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FiRefreshCw, FiAlertCircle, FiCheck, FiSearch, FiClock, FiBarChart2 } from "react-icons/fi"
import { Loader2 } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const cn = (...c) => c.filter(Boolean).join(" ")

function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed top-5 right-5 z-[80]">
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-900 text-white shadow-2xl text-sm font-semibold">
        <FiCheck className="w-4 h-4" />
        {message}
      </div>
    </div>
  )
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  }
  const cls = tones[tone] || tones.gray
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide border",
        cls
      )}
    >
      {children}
    </span>
  )
}

function SectionCard({ title, icon, subtitle = "", right, children }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-[0_18px_60px_-45px_rgba(0,0,0,0.55)] overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900 truncate">{title}</p>
            {subtitle ? <p className="text-xs text-gray-500 truncate">{subtitle}</p> : null}
          </div>
        </div>
        <div className="shrink-0">{right}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function StatTile({ label, value, tone = "gray", icon }) {
  const tones = {
    gray: "bg-gray-50 border-gray-100 text-gray-900",
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-900",
    amber: "bg-amber-50 border-amber-100 text-amber-900",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
    sky: "bg-sky-50 border-sky-100 text-sky-900",
  }
  const cls = tones[tone] || tones.gray
  return (
    <div className={cn("rounded-2xl border p-4 flex items-center justify-between gap-3", cls)}>
      <div className="min-w-0">
        <p className="text-xs font-extrabold text-gray-500">{label}</p>
        <p className="mt-1 text-xl font-extrabold">{value}</p>
      </div>
      {icon ? (
        <div className="w-10 h-10 rounded-2xl bg-white/60 border border-gray-200 flex items-center justify-center text-gray-700 shrink-0">
          {icon}
        </div>
      ) : null}
    </div>
  )
}

function fmtDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function msToHuman(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return "0m"
  const s = Math.floor(n / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${mm}m`
}

function pick(obj, keys, fallback = undefined) {
  for (const k of keys) {
    const v = obj?.[k]
    if (v !== undefined && v !== null) return v
  }
  return fallback
}

/**
 * ✅ CustomerServiceReport
 * Uses your backend routes:
 * - GET /api/reports/services/customer/:customerId/summary
 * - GET /api/reports/services/customer/:customerId/history
 * - GET /api/reports/services/global/summary
 *
 * Props:
 * - customerId (required)
 * - showToast (optional)
 * - setPageError (optional)
 */
export default function CustomerServiceReport({ customerId, showToast, setPageError }) {
  const [toast, setToast] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [mode, setMode] = useState("customer") // "customer" | "global"
  const [view, setView] = useState("summary") // "summary" | "history"
  const [q, setQ] = useState("")
  const [rangeDays, setRangeDays] = useState(365)

  const [customerSummary, setCustomerSummary] = useState(null)
  const [customerHistory, setCustomerHistory] = useState([])
  const [globalSummary, setGlobalSummary] = useState(null)

  const pushToast = useCallback(
    (msg) => {
      if (showToast) return showToast(msg)
      setToast(msg)
      window.setTimeout(() => setToast(""), 2000)
    },
    [showToast]
  )

  const setAnyError = useCallback(
    (msg) => {
      setError(msg || "")
      if (setPageError) setPageError(msg || "")
    },
    [setPageError]
  )

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (rangeDays) params.set("rangeDays", String(rangeDays))
    return params.toString() ? `?${params.toString()}` : ""
  }, [q, rangeDays])

  const fetchCustomerSummary = useCallback(async () => {
    const res = await fetch(
      `${API_BASE}/reports/services/customer/${customerId}/summary${buildQuery()}`,
      { headers: getAuthHeaders() }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || "Failed to fetch customer service summary")
    // allow different backend shapes
    return data?.summary || data
  }, [customerId, buildQuery])

  const fetchCustomerHistory = useCallback(async () => {
    const res = await fetch(
      `${API_BASE}/reports/services/customer/${customerId}/history${buildQuery()}`,
      { headers: getAuthHeaders() }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || "Failed to fetch customer service history")
    const items = data?.items || data?.history || data?.rows || data?.data || []
    return Array.isArray(items) ? items : []
  }, [customerId, buildQuery])

  const fetchGlobalSummary = useCallback(async () => {
    const res = await fetch(`${API_BASE}/reports/services/global/summary${buildQuery()}`, {
      headers: getAuthHeaders(),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || "Failed to fetch global service summary")
    return data?.summary || data
  }, [buildQuery])

  const refresh = useCallback(async () => {
    if (!customerId && mode === "customer") return
    setLoading(true)
    setAnyError("")
    try {
      if (mode === "customer") {
        if (view === "summary") {
          const s = await fetchCustomerSummary()
          setCustomerSummary(s)
        } else {
          const h = await fetchCustomerHistory()
          setCustomerHistory(h)
        }
      } else {
        const g = await fetchGlobalSummary()
        setGlobalSummary(g)
      }
      pushToast("Report updated")
    } catch (e) {
      setAnyError(e?.message || "Failed to load report.")
    } finally {
      setLoading(false)
    }
  }, [customerId, mode, view, fetchCustomerSummary, fetchCustomerHistory, fetchGlobalSummary, pushToast, setAnyError])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, mode, view])

  const customerServices = useMemo(() => {
    const raw = pick(customerSummary, ["services", "items", "rows"], [])
    const list = Array.isArray(raw) ? raw : []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter((x) => {
      const title = String(pick(x, ["serviceTitle", "title", "name", "taskTitle"], "") || "").toLowerCase()
      const code = String(pick(x, ["serviceCode", "code", "templateId", "serviceId"], "") || "").toLowerCase()
      return title.includes(s) || code.includes(s)
    })
  }, [customerSummary, q])

  const globalServices = useMemo(() => {
    const raw = pick(globalSummary, ["services", "items", "rows"], [])
    const list = Array.isArray(raw) ? raw : []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter((x) => {
      const title = String(pick(x, ["serviceTitle", "title", "name"], "") || "").toLowerCase()
      const code = String(pick(x, ["serviceCode", "code", "templateId", "serviceId"], "") || "").toLowerCase()
      return title.includes(s) || code.includes(s)
    })
  }, [globalSummary, q])

  const historyRows = useMemo(() => {
    const list = Array.isArray(customerHistory) ? customerHistory : []
    const s = q.trim().toLowerCase()
    if (!s) return list
    return list.filter((x) => {
      const title = String(pick(x, ["serviceTitle", "title", "taskTitle", "name"], "") || "").toLowerCase()
      const status = String(pick(x, ["status"], "") || "").toLowerCase()
      const idish = String(pick(x, ["serviceId", "templateId", "taskId", "_id"], "") || "").toLowerCase()
      return title.includes(s) || status.includes(s) || idish.includes(s)
    })
  }, [customerHistory, q])

  const headline = useMemo(() => {
    if (mode === "global") return "Service Report (Global)"
    return "Service Report (Customer)"
  }, [mode])

  const topStats = useMemo(() => {
    const src = mode === "global" ? globalSummary : customerSummary
    if (!src) return null

    // accept multiple backend shapes
    const totalRequests = pick(src, ["totalRequests", "total", "count"], 0)
    const uniqueServices = pick(src, ["uniqueServices", "unique", "serviceCount"], 0)
    const totalDurationMs = pick(src, ["totalDurationMs", "totalMs", "totalDuration"], 0)

    return {
      totalRequests,
      uniqueServices,
      totalDurationMs,
    }
  }, [mode, globalSummary, customerSummary])

  const Toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {/* mode */}
      <div className="inline-flex rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => {
            setMode("customer")
            setView("summary")
          }}
          className={cn(
            "px-3 py-2 text-xs font-extrabold",
            mode === "customer" ? "bg-indigo-600 text-white" : "text-gray-700 hover:bg-gray-50"
          )}
        >
          CUSTOMER
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("global")
            setView("summary")
          }}
          className={cn(
            "px-3 py-2 text-xs font-extrabold border-l border-gray-200",
            mode === "global" ? "bg-indigo-600 text-white" : "text-gray-700 hover:bg-gray-50"
          )}
        >
          GLOBAL
        </button>
      </div>

      {/* view (only for customer) */}
      {mode === "customer" ? (
        <div className="inline-flex rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setView("summary")}
            className={cn(
              "px-3 py-2 text-xs font-extrabold",
              view === "summary" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
            )}
          >
            SUMMARY
          </button>
          <button
            type="button"
            onClick={() => setView("history")}
            className={cn(
              "px-3 py-2 text-xs font-extrabold border-l border-gray-200",
              view === "history" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
            )}
          >
            HISTORY
          </button>
        </div>
      ) : null}

      {/* range */}
      <select
        className="px-3 py-2 rounded-2xl border border-gray-200 bg-white text-xs font-extrabold text-gray-700"
        value={rangeDays}
        onChange={(e) => setRangeDays(Number(e.target.value) || 365)}
        title="Date range window"
      >
        <option value={30}>LAST 30 DAYS</option>
        <option value={90}>LAST 90 DAYS</option>
        <option value={180}>LAST 180 DAYS</option>
        <option value={365}>LAST 365 DAYS</option>
        <option value={3650}>ALL (10Y)</option>
      </select>

      {/* search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-gray-200 bg-white">
        <FiSearch className="w-4 h-4 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search service / status / id..."
          className="outline-none text-xs font-semibold text-gray-800 placeholder:text-gray-400 w-56"
        />
      </div>

      <button
        type="button"
        onClick={refresh}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold shadow-sm",
          "bg-indigo-600 text-white hover:bg-indigo-700",
          loading ? "opacity-70" : ""
        )}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
        {loading ? "LOADING..." : "REFRESH"}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <Toast message={toast} />

      <SectionCard
        title={headline}
        subtitle="Optimized view for service usage, frequency & durations"
        icon={<FiBarChart2 className="w-5 h-5" />}
        right={Toolbar}
      >
        {error ? (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-start gap-2">
            <FiAlertCircle className="w-4 h-4 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Top stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatTile
            label="Total Requests"
            value={topStats ? Number(topStats.totalRequests || 0) : "—"}
            tone="indigo"
            icon={<FiBarChart2 />}
          />
          <StatTile
            label="Unique Services"
            value={topStats ? Number(topStats.uniqueServices || 0) : "—"}
            tone="amber"
            icon={<FiSearch />}
          />
          <StatTile
            label="Total Time"
            value={topStats ? msToHuman(topStats.totalDurationMs || 0) : "—"}
            tone="sky"
            icon={<FiClock />}
          />
        </div>

        {/* Body */}
        <div className="mt-5">
          {mode === "global" ? (
            <GlobalSummaryTable rows={globalServices} />
          ) : view === "summary" ? (
            <CustomerSummaryTable rows={customerServices} />
          ) : (
            <CustomerHistoryTable rows={historyRows} />
          )}
        </div>
      </SectionCard>

      <p className="text-xs text-gray-500 px-1">
        Tip: “running services” = tasks where <span className="font-bold">status=in_progress</span>. If your history API
        includes in-progress rows, they’ll show here too.
      </p>
    </div>
  )
}

/* ------------------ tables ------------------ */

function HeadCell({ children, className }) {
  return (
    <th className={cn("text-left text-[11px] font-extrabold text-gray-500 py-3 px-3", className)}>{children}</th>
  )
}
function Cell({ children, className }) {
  return <td className={cn("text-sm font-semibold text-gray-800 py-3 px-3", className)}>{children}</td>
}

function titleFromRow(r) {
  return (
    String(pick(r, ["serviceTitle", "title", "name", "taskTitle"], "") || "").trim() ||
    String(pick(r, ["templateTitle"], "") || "").trim() ||
    "—"
  )
}

function idFromRow(r) {
  return String(pick(r, ["serviceId", "templateId", "id", "_id"], "") || "").trim() || "—"
}

function countFromRow(r) {
  return Number(pick(r, ["count", "totalCount", "requests"], 0) || 0)
}

function durationMsFromRow(r) {
  return Number(pick(r, ["totalDurationMs", "durationMs", "totalMs", "totalDuration"], 0) || 0)
}

function avgMsFromRow(r) {
  return Number(pick(r, ["avgDurationMs", "avgMs", "avgDuration"], 0) || 0)
}

function lastUsedFromRow(r) {
  return pick(r, ["lastUsedAt", "lastAt", "lastUsed", "updatedAt", "lastSeenAt"], null)
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase()
  if (s === "done" || s === "complete" || s === "completed") return <Badge tone="emerald">DONE</Badge>
  if (s === "in_progress") return <Badge tone="sky">IN PROGRESS</Badge>
  if (s === "pending") return <Badge tone="amber">PENDING</Badge>
  if (!s) return <Badge>—</Badge>
  return <Badge>{String(status).toUpperCase()}</Badge>
}

function EmptyState({ title = "No data", subtitle = "Nothing found for the selected filters." }) {
  return (
    <div className="p-10 rounded-2xl border border-gray-100 bg-gray-50 text-sm text-gray-500 text-center">
      <p className="font-extrabold text-gray-700">{title}</p>
      <p className="mt-1">{subtitle}</p>
    </div>
  )
}

function CustomerSummaryTable({ rows }) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return <EmptyState title="No services found" subtitle="Try changing range or search keyword." />

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="min-w-[900px] w-full bg-white">
        <thead className="bg-gray-50/60 border-b border-gray-100">
          <tr>
            <HeadCell>Service</HeadCell>
            <HeadCell className="w-[180px]">Service ID</HeadCell>
            <HeadCell className="w-[140px]">Requests</HeadCell>
            <HeadCell className="w-[180px]">Total Time</HeadCell>
            <HeadCell className="w-[180px]">Avg Time</HeadCell>
            <HeadCell className="w-[220px]">Last Used</HeadCell>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={`${idFromRow(r)}-${i}`} className="border-b border-gray-100 last:border-b-0">
              <Cell>
                <div className="min-w-0">
                  <p className="font-extrabold text-gray-900 truncate">{titleFromRow(r)}</p>
                  <p className="text-xs text-gray-500 font-semibold truncate">
                    {String(pick(r, ["serviceCode", "code"], "") || "").trim() || "—"}
                  </p>
                </div>
              </Cell>
              <Cell className="text-xs text-gray-600 font-extrabold break-all">{idFromRow(r)}</Cell>
              <Cell>
                <Badge tone="indigo">{countFromRow(r)}</Badge>
              </Cell>
              <Cell>
                <Badge tone="amber">{msToHuman(durationMsFromRow(r))}</Badge>
              </Cell>
              <Cell>
                <Badge tone="sky">{msToHuman(avgMsFromRow(r))}</Badge>
              </Cell>
              <Cell className="text-xs text-gray-600 font-extrabold">{fmtDate(lastUsedFromRow(r))}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GlobalSummaryTable({ rows }) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return <EmptyState title="No global services found" subtitle="Try changing range or search keyword." />

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="min-w-[900px] w-full bg-white">
        <thead className="bg-gray-50/60 border-b border-gray-100">
          <tr>
            <HeadCell>Service</HeadCell>
            <HeadCell className="w-[180px]">Service ID</HeadCell>
            <HeadCell className="w-[140px]">Total Requests</HeadCell>
            <HeadCell className="w-[180px]">Total Time</HeadCell>
            <HeadCell className="w-[180px]">Avg Time</HeadCell>
            <HeadCell className="w-[220px]">Last Seen</HeadCell>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={`${idFromRow(r)}-${i}`} className="border-b border-gray-100 last:border-b-0">
              <Cell>
                <div className="min-w-0">
                  <p className="font-extrabold text-gray-900 truncate">{titleFromRow(r)}</p>
                  <p className="text-xs text-gray-500 font-semibold truncate">
                    {String(pick(r, ["serviceCode", "code"], "") || "").trim() || "—"}
                  </p>
                </div>
              </Cell>
              <Cell className="text-xs text-gray-600 font-extrabold break-all">{idFromRow(r)}</Cell>
              <Cell>
                <Badge tone="indigo">{countFromRow(r)}</Badge>
              </Cell>
              <Cell>
                <Badge tone="amber">{msToHuman(durationMsFromRow(r))}</Badge>
              </Cell>
              <Cell>
                <Badge tone="sky">{msToHuman(avgMsFromRow(r))}</Badge>
              </Cell>
              <Cell className="text-xs text-gray-600 font-extrabold">{fmtDate(lastUsedFromRow(r))}</Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CustomerHistoryTable({ rows }) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return <EmptyState title="No history found" subtitle="Try changing range or search keyword." />

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="min-w-[1050px] w-full bg-white">
        <thead className="bg-gray-50/60 border-b border-gray-100">
          <tr>
            <HeadCell>Service</HeadCell>
            <HeadCell className="w-[180px]">Task ID</HeadCell>
            <HeadCell className="w-[140px]">Status</HeadCell>
            <HeadCell className="w-[220px]">Created</HeadCell>
            <HeadCell className="w-[220px]">Completed</HeadCell>
            <HeadCell className="w-[180px]">Duration</HeadCell>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => {
            const taskId = String(pick(r, ["taskId", "_id", "id"], "") || "").trim() || "—"
            const status = pick(r, ["status"], "")
            const createdAt = pick(r, ["createdAt", "startAt", "startedAt"], null)
            const completedAt = pick(r, ["completedAt", "endAt", "endedAt"], null)

            // if backend doesn't compute durationMs, we compute a safe one for done tasks
            const durationMs =
              Number(pick(r, ["durationMs", "totalDurationMs"], 0) || 0) ||
              (createdAt && completedAt ? new Date(completedAt).getTime() - new Date(createdAt).getTime() : 0)

            return (
              <tr key={`${taskId}-${i}`} className="border-b border-gray-100 last:border-b-0">
                <Cell>
                  <div className="min-w-0">
                    <p className="font-extrabold text-gray-900 truncate">{titleFromRow(r)}</p>
                    <p className="text-xs text-gray-500 font-semibold truncate">
                      Service ID:{" "}
                      <span className="font-extrabold text-gray-700">{String(pick(r, ["templateId", "serviceId"], "") || "—")}</span>
                    </p>
                  </div>
                </Cell>
                <Cell className="text-xs text-gray-600 font-extrabold break-all">{taskId}</Cell>
                <Cell>
                  <StatusBadge status={status} />
                </Cell>
                <Cell className="text-xs text-gray-600 font-extrabold">{fmtDate(createdAt)}</Cell>
                <Cell className="text-xs text-gray-600 font-extrabold">{fmtDate(completedAt)}</Cell>
                <Cell>
                  <Badge tone={String(status || "").toLowerCase() === "in_progress" ? "sky" : "amber"}>
                    {msToHuman(durationMs)}
                  </Badge>
                </Cell>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
