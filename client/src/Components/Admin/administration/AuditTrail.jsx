/* eslint-disable react/prop-types, react-refresh/only-export-components -- Audit Trail administration view and helpers */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FiActivity,
  FiCalendar,
  FiClock,
  FiDatabase,
  FiEye,
  FiFilter,
  FiLayers,
  FiRefreshCw,
  FiUser,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
  FiShield,
  FiArrowRight,
} from "react-icons/fi"
import { administrationApi } from "./administrationApi"
import {
  AdministrationButton,
  AdministrationCard,
  AdministrationField,
  AdministrationHeader,
  AdministrationPage,
  AdministrationTableState,
  administrationCx,
  administrationStyles,
  AdministrationModal,
} from "./AdministrationUI"

export function formatAuditValue(val) {
  if (val === null || val === undefined) return "—"
  if (typeof val === "boolean") return val ? "true" : "false"
  if (typeof val === "object") {
    try {
      return JSON.stringify(val)
    } catch {
      return "[Object]"
    }
  }
  const s = String(val)
  return s.length > 60 ? `${s.slice(0, 57)}...` : s
}

export function formatAuditDate(dateString) {
  if (!dateString) return "—"
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return String(dateString)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date)
}

export function getAuditRelativeTime(dateString) {
  if (!dateString) return ""
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ""
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 10) return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return ""
}

export function ActionBadge({ action }) {
  const norm = String(action || "").toLowerCase()
  let tone = "bg-gray-100 text-gray-700 ring-gray-600/10"

  if (norm.includes("create") || norm.includes("add") || norm.includes("insert") || norm.includes("post")) {
    tone = "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
  } else if (norm.includes("delete") || norm.includes("remove") || norm.includes("destroy") || norm.includes("cancel") || norm.includes("void")) {
    tone = "bg-rose-50 text-rose-700 ring-rose-600/20"
  } else if (norm.includes("update") || norm.includes("edit") || norm.includes("patch") || norm.includes("modify")) {
    tone = "bg-blue-50 text-blue-700 ring-blue-600/20"
  } else if (norm.includes("stage") || norm.includes("status") || norm.includes("transfer")) {
    tone = "bg-purple-50 text-purple-700 ring-purple-600/20"
  } else if (norm.includes("approve") || norm.includes("settle")) {
    tone = "bg-teal-50 text-teal-700 ring-teal-600/20"
  }

  return (
    <span
      className={administrationCx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-black uppercase tracking-wider ring-1",
        tone
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {String(action || "ACTION").toUpperCase()}
    </span>
  )
}

export function ModuleBadge({ module }) {
  const mod = String(module || "general").toUpperCase()
  return (
    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700 ring-1 ring-gray-200">
      {mod}
    </span>
  )
}

export default function AuditTrail() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 25, pages: 1 })
  const [stats, setStats] = useState({ totalEvents: 0, todayEvents: 0, moduleCount: 0, actorCount: 0 })
  const [filterOptions, setFilterOptions] = useState({ modules: [], actions: [], entityTypes: [], actors: [] })

  // Filters state
  const [search, setSearch] = useState("")
  const [selectedModule, setSelectedModule] = useState("")
  const [selectedAction, setSelectedAction] = useState("")
  const [selectedActor, setSelectedActor] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // Selected Log detail modal state
  const [selectedLog, setSelectedLog] = useState(null)
  const [activeDiffTab, setActiveDiffTab] = useState("diff") // "diff" | "raw"

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedModule) count++
    if (selectedAction) count++
    if (selectedActor) count++
    if (startDate) count++
    if (endDate) count++
    return count
  }, [selectedModule, selectedAction, selectedActor, startDate, endDate])

  const loadFilterOptions = useCallback(async () => {
    try {
      const res = await administrationApi.get("/audit-trail/filters")
      if (res?.data) {
        setFilterOptions(res.data)
      }
    } catch {
      // Non-blocking fallback for filter options
    }
  }, [])

  const fetchLogs = useCallback(async (targetPage = 1) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      params.set("page", String(targetPage))
      params.set("limit", String(pagination.limit))
      if (search.trim()) params.set("search", search.trim())
      if (selectedModule) params.set("module", selectedModule)
      if (selectedAction) params.set("action", selectedAction)
      if (selectedActor) params.set("actorId", selectedActor)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)

      const response = await administrationApi.get(`/audit-trail?${params.toString()}`)
      const data = response?.data || {}
      setLogs(data.items || [])
      if (data.pagination) {
        setPagination(data.pagination)
      }
      if (data.stats) {
        setStats(data.stats)
      }
    } catch (err) {
      setError(err?.message || "Failed to load audit logs.")
    } finally {
      setLoading(false)
    }
  }, [pagination.limit, search, selectedModule, selectedAction, selectedActor, startDate, endDate])

  useEffect(() => {
    loadFilterOptions()
  }, [loadFilterOptions])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  const handleResetFilters = () => {
    setSearch("")
    setSelectedModule("")
    setSelectedAction("")
    setSelectedActor("")
    setStartDate("")
    setEndDate("")
  }

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }))
  }

  return (
    <AdministrationPage>
      <AdministrationHeader
        title="Audit Trail"
        description="Immutable system-wide history of record creations, modifications, and deletions across all ERP modules."
        icon={FiShield}
        actions={
          <div className="flex items-center gap-2">
            <AdministrationButton
              icon={FiRefreshCw}
              variant="secondary"
              onClick={() => fetchLogs(pagination.page)}
              disabled={loading}
            >
              Refresh
            </AdministrationButton>
          </div>
        }
      >
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiDatabase className="h-4 w-4 text-indigo-600" />
              Total Events
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">
              {stats.totalEvents.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiClock className="h-4 w-4 text-emerald-600" />
              Today's Activity
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">
              {stats.todayEvents.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiLayers className="h-4 w-4 text-blue-600" />
              Active Modules
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">
              {stats.moduleCount}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              <FiUser className="h-4 w-4 text-purple-600" />
              Active Users
            </div>
            <p className="mt-2 text-2xl font-black text-gray-950 sm:text-3xl">
              {stats.actorCount}
            </p>
          </div>
        </div>
      </AdministrationHeader>

      <AdministrationCard className="overflow-hidden">
        {/* Toolbar & Filter toggle */}
        <div className="border-b border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div
                data-administration-search="true"
                className="flex min-h-[46px] w-full items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]"
              >
                <FiActivity className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by record identifier, user name, action, or module..."
                  className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-sm font-medium outline-none placeholder:text-gray-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilters((prev) => !prev)}
                  className={administrationCx(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition",
                    activeFilterCount > 0 || showFilters
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                  )}
                >
                  <FiFilter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-white/25 px-1.5 py-0.2 text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Show</span>
              <select
                value={pagination.limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-800 outline-none focus:border-indigo-300"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries</span>
            </div>
          </div>

          {/* Collapsible Filter Panel */}
          {showFilters && (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/75 p-4 transition">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Module</label>
                  <select
                    value={selectedModule}
                    onChange={(e) => setSelectedModule(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-indigo-300"
                  >
                    <option value="">All Modules</option>
                    {filterOptions.modules.map((m) => (
                      <option key={m} value={m}>
                        {m.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Action</label>
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-indigo-300"
                  >
                    <option value="">All Actions</option>
                    {filterOptions.actions.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">User / Actor</label>
                  <select
                    value={selectedActor}
                    onChange={(e) => setSelectedActor(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-indigo-300"
                  >
                    <option value="">All Users</option>
                    {filterOptions.actors.map((actor) => (
                      <option key={actor._id} value={actor._id}>
                        {actor.name} {actor.role ? `(${actor.role})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 outline-none focus:border-indigo-300"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 outline-none focus:border-indigo-300"
                  />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-800"
                  >
                    <FiX className="h-3.5 w-3.5" />
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit Log Table */}
        {loading ? (
          <AdministrationTableState status="loading" />
        ) : error ? (
          <AdministrationTableState
            status="error"
            title="Failed to load audit trail"
            description={error}
            onRetry={() => fetchLogs(pagination.page)}
          />
        ) : logs.length === 0 ? (
          <AdministrationTableState
            status="empty"
            title="No audit entries found"
            description={
              activeFilterCount > 0 || search
                ? "Try clearing your filters or search keywords to see all system events."
                : "System mutations and events will appear here automatically."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-black uppercase tracking-wider text-gray-500">
                  <th className="py-3.5 pl-5 pr-3">When</th>
                  <th className="px-3 py-3.5">By Whom</th>
                  <th className="px-3 py-3.5">Where (Module / Record)</th>
                  <th className="px-3 py-3.5">Action</th>
                  <th className="px-3 py-3.5">Modified Values / Summary</th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const relativeTime = getAuditRelativeTime(log.createdAt)
                  const changesCount = log.changes?.length || 0

                  return (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedLog(log)}
                      className="group cursor-pointer transition hover:bg-indigo-50/30"
                    >
                      {/* When */}
                      <td className="whitespace-nowrap py-3.5 pl-5 pr-3">
                        <div className="font-bold text-gray-900">{formatAuditDate(log.createdAt)}</div>
                        {relativeTime && (
                          <div className="text-xs font-medium text-gray-400">{relativeTime}</div>
                        )}
                      </td>

                      {/* By Whom */}
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-black text-gray-600">
                            {(log.actorName || "S").charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-gray-900">
                              {log.actorName || "System"}
                            </p>
                            {log.actorEmail ? (
                              <p className="truncate text-[11px] text-gray-400">{log.actorEmail}</p>
                            ) : log.actorRole ? (
                              <p className="truncate text-[11px] font-semibold text-indigo-600">
                                {log.actorRole}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Where */}
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ModuleBadge module={log.module} />
                          <span className="text-xs font-bold text-gray-900">{log.entityType}</span>
                        </div>
                        {log.recordIdentifier ? (
                          <div className="mt-1 truncate font-mono text-xs font-semibold text-gray-600">
                            {log.recordIdentifier}
                          </div>
                        ) : null}
                      </td>

                      {/* Action */}
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <ActionBadge action={log.action} />
                      </td>

                      {/* Modified Values / Summary */}
                      <td className="max-w-md px-3 py-3.5">
                        {log.changes && log.changes.length > 0 ? (
                          <div className="space-y-1">
                            {log.changes.slice(0, 2).map((ch, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 truncate text-xs text-gray-700 font-mono"
                              >
                                <span className="font-bold text-gray-900">{ch.path}:</span>
                                <span className="rounded bg-rose-50 px-1 py-0.5 text-rose-700 line-through">
                                  {formatAuditValue(ch.before)}
                                </span>
                                <FiArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
                                <span className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-700 font-bold">
                                  {formatAuditValue(ch.after)}
                                </span>
                              </div>
                            ))}
                            {changesCount > 2 && (
                              <p className="text-[11px] font-bold text-indigo-600">
                                +{changesCount - 2} more field{changesCount - 2 > 1 ? "s" : ""} modified
                              </p>
                            )}
                          </div>
                        ) : log.action === "create" ? (
                          <span className="text-xs font-medium text-emerald-700">
                            Created record snapshot recorded
                          </span>
                        ) : log.action === "delete" ? (
                          <span className="text-xs font-medium text-rose-700">
                            Deleted record snapshot archived
                          </span>
                        ) : log.meta?.reason ? (
                          <span className="text-xs italic text-gray-600">
                            Reason: {log.meta.reason}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-indigo-600"
                        >
                          <FiEye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && logs.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 p-4 sm:flex-row sm:p-5">
            <div className="text-xs font-medium text-gray-500">
              Showing{" "}
              <span className="font-bold text-gray-900">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-bold text-gray-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-bold text-gray-900">{pagination.total.toLocaleString()}</span>{" "}
              entries
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-3 text-xs font-bold text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>

              <button
                type="button"
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </AdministrationCard>

      {/* Audit Detail Modal */}
      {selectedLog && (
        <AdministrationModal
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log: ${selectedLog.action?.toUpperCase()} ${selectedLog.entityType}`}
          description={`Recorded on ${formatAuditDate(selectedLog.createdAt)}`}
          maxWidthClass="max-w-4xl"
          footer={
            <div className="flex justify-end">
              <AdministrationButton variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </AdministrationButton>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Meta Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-2xl border border-gray-100 bg-gray-50/75 p-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Action</p>
                <div className="mt-1">
                  <ActionBadge action={selectedLog.action} />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Module</p>
                <div className="mt-1">
                  <ModuleBadge module={selectedLog.module} />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Entity Type</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{selectedLog.entityType}</p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Record Identifier</p>
                <p className="mt-1 font-mono text-sm font-bold text-gray-900">
                  {selectedLog.recordIdentifier || "—"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Entity ID</p>
                <p className="mt-1 font-mono text-xs text-gray-600">
                  {String(selectedLog.entityId || "—")}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Timestamp</p>
                <p className="mt-1 text-xs font-semibold text-gray-900">
                  {formatAuditDate(selectedLog.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">By Whom (Actor)</p>
                <p className="mt-1 text-sm font-bold text-gray-900">
                  {selectedLog.actorName || "System"}
                </p>
                {selectedLog.actorEmail && (
                  <p className="text-xs text-gray-500">{selectedLog.actorEmail}</p>
                )}
                {selectedLog.actorRole && (
                  <p className="text-xs font-medium text-indigo-600">Role: {selectedLog.actorRole}</p>
                )}
              </div>

              {selectedLog.meta?.ip && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">IP Address</p>
                  <p className="mt-1 font-mono text-xs text-gray-700">{selectedLog.meta.ip}</p>
                </div>
              )}

              {selectedLog.meta?.path && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">API Endpoint</p>
                  <p className="mt-1 font-mono text-xs text-gray-700">
                    {selectedLog.meta.method ? `${selectedLog.meta.method} ` : ""}
                    {selectedLog.meta.path}
                  </p>
                </div>
              )}
            </div>

            {/* Changes / Modified Values Diff */}
            <div>
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="text-sm font-black text-gray-900">Modified Values & Changes</h3>
                <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveDiffTab("diff")}
                    className={administrationCx(
                      "rounded-lg px-2.5 py-1 text-xs font-bold transition",
                      activeDiffTab === "diff"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    )}
                  >
                    Diff View
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDiffTab("raw")}
                    className={administrationCx(
                      "rounded-lg px-2.5 py-1 text-xs font-bold transition",
                      activeDiffTab === "raw"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-900"
                    )}
                  >
                    Raw Snapshots
                  </button>
                </div>
              </div>

              {activeDiffTab === "diff" ? (
                selectedLog.changes && selectedLog.changes.length > 0 ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                    <table className="w-full border-collapse text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                          <th className="py-2.5 pl-4 pr-2 font-black">Field</th>
                          <th className="px-2 py-2.5 font-black text-rose-700">Previous Value (Before)</th>
                          <th className="py-2.5 pl-2 pr-4 font-black text-emerald-700">New Value (After)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {selectedLog.changes.map((change, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-2.5 pl-4 pr-2 font-bold text-gray-900 whitespace-nowrap">
                              {change.path}
                            </td>
                            <td className="px-2 py-2.5 text-rose-700 bg-rose-50/40 break-all">
                              {formatAuditValue(change.before)}
                            </td>
                            <td className="py-2.5 pl-2 pr-4 font-bold text-emerald-700 bg-emerald-50/40 break-all">
                              {formatAuditValue(change.after)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs font-medium text-gray-500">
                    {selectedLog.action === "create"
                      ? "This is a record creation event. See the 'Raw Snapshots' tab for the full initial record state."
                      : selectedLog.action === "delete"
                      ? "This is a record deletion event. See the 'Raw Snapshots' tab for the final record state prior to deletion."
                      : "No individual field diffs recorded for this action."}
                  </div>
                )
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-bold text-gray-700">Before Snapshot</p>
                    <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-[11px] text-gray-800">
                      {selectedLog.before
                        ? JSON.stringify(selectedLog.before, null, 2)
                        : "null (No prior state)"}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-bold text-gray-700">After Snapshot</p>
                    <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-[11px] text-gray-800">
                      {selectedLog.after
                        ? JSON.stringify(selectedLog.after, null, 2)
                        : "null (No subsequent state)"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </AdministrationModal>
      )}
    </AdministrationPage>
  )
}
