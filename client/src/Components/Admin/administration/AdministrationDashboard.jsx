/* eslint-disable react/prop-types, react-refresh/only-export-components -- views and sorting contracts are exported for focused tests */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useSelector } from "react-redux"
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLock,
  FiRefreshCw,
  FiSettings,
  FiUsers,
} from "react-icons/fi"
import { hasPermission } from "../../Auth/permissions"
import { administrationApi } from "./administrationApi"
import {
  AdministrationButton,
  AdministrationCard,
  AdministrationHeader,
  AdministrationPage,
  AdministrationStatus,
  AdministrationTableState,
} from "./AdministrationUI"

const priorityRank = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3 })
const dateValue = (value) => {
  const parsed = value ? new Date(value).getTime() : Number.POSITIVE_INFINITY
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export function sortAdministrationTasks(tasks = [], now = new Date()) {
  const current = now.getTime()
  return [...tasks].sort((left, right) => {
    const leftDate = dateValue(left.dueDate)
    const rightDate = dateValue(right.dueDate)
    const overdueDifference = Number(rightDate < current) - Number(leftDate < current)
    if (overdueDifference) return overdueDifference
    if (leftDate !== rightDate) return leftDate - rightDate
    const priorityDifference = (priorityRank[left.priority] ?? 99) - (priorityRank[right.priority] ?? 99)
    if (priorityDifference) return priorityDifference
    return String(left.key || left.title).localeCompare(String(right.key || right.title))
  })
}

const taskPermission = (target = "") => {
  if (target.includes("/company-details")) return "company:view"
  if (target.includes("/audit-trail")) return "access-control:view"
  if (target.includes("/employee-account-control")) return "users:view"
  return "administration-dashboard:view"
}

export function filterNavigableAdministrationTasks(tasks = [], user) {
  return tasks.filter((item) => item.navigationTarget && hasPermission(user, taskPermission(item.navigationTarget)))
}

const summaryCards = [
  { key: "activeEmployees", label: "Active Employees", icon: FiUsers, tone: "bg-emerald-50 text-emerald-700" },
  { key: "inactiveEmployees", label: "Inactive Employees", icon: FiClock, tone: "bg-amber-50 text-amber-700" },
  { key: "lockedAccounts", label: "Locked Accounts", icon: FiLock, tone: "bg-rose-50 text-rose-700" },
  { key: "auditRecords", label: "Audit Records", icon: FiFileText, tone: "bg-sky-50 text-sky-700" },
]

export function AdministrationDashboardView({ data, loading, error, onReload }) {
  if (loading) return <AdministrationPage><AdministrationTableState status="loading" /></AdministrationPage>
  if (error && !data) return <AdministrationPage><AdministrationCard><AdministrationTableState status="error" title="Unable to load Administration Dashboard" description={error} onRetry={onReload} /></AdministrationCard></AdministrationPage>

  const summary = data?.summary || {}
  const completeness = data?.completeness || { percent: 0, missing: [] }
  const tasks = sortAdministrationTasks(data?.tasks || [])

  return <AdministrationPage>
    <AdministrationHeader
      icon={FiSettings}
      title="Administration Dashboard"
      description="Monitor company setup, employee access, account health, and audit capacity."
      actions={<AdministrationButton icon={FiRefreshCw} type="button" onClick={onReload}>Refresh</AdministrationButton>}
    />

    {error ? <div role="alert" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Showing the last available dashboard data. Refresh failed: {error}</div> : null}

    <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map(({ key, label, icon: Icon, tone }) => <AdministrationCard key={key} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-gray-500">{label}</p><p className="mt-2 text-3xl font-black tracking-tight text-gray-950">{Number(summary[key] || 0).toLocaleString()}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span></div></AdministrationCard>)}
    </div>

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
      <AdministrationCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="text-lg font-black text-gray-950">Nearby Tasks</h2><p className="mt-1 text-sm font-medium text-gray-500">Administrative actions requiring attention, ordered by urgency.</p></div><FiActivity className="h-5 w-5 text-indigo-600" /></div>
        {tasks.length ? <div className="divide-y divide-gray-100">{tasks.map((item) => <Link key={item.key} to={item.navigationTarget} className="group flex items-start gap-4 px-5 py-4 transition hover:bg-gray-50"><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.priority === "high" || item.priority === "critical" ? "bg-rose-50 text-rose-700" : "bg-indigo-50 text-indigo-700"}`}>{item.priority === "high" || item.priority === "critical" ? <FiAlertTriangle /> : <FiClock />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm font-extrabold text-gray-950">{item.title}</strong><AdministrationStatus value={item.priority || "normal"} /></span>{item.description ? <span className="mt-1 block text-sm text-gray-500">{item.description}</span> : null}</span><FiArrowRight className="mt-3 h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" /></Link>)}</div> : <AdministrationTableState status="empty" title="No administrative actions need attention" description="Company setup, account health, and audit capacity are currently clear." />}
      </AdministrationCard>

      <AdministrationCard className="p-5">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-gray-950">Setup Completeness</h2><p className="mt-1 text-sm font-medium text-gray-500">Required company configuration.</p></div><span className="text-3xl font-black text-indigo-700">{Number(completeness.percent || 0)}%</span></div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, Number(completeness.percent || 0)))}%` }} /></div>
        <div className="mt-5 space-y-2">{completeness.missing?.length ? completeness.missing.map((item) => <div key={item} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"><FiAlertTriangle className="shrink-0" />{item}</div>) : <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-800"><FiCheckCircle />Company setup is complete.</div>}</div>
        <div className="mt-5 border-t border-gray-100 pt-4"><div className="flex items-center justify-between"><span className="text-sm font-bold text-gray-500">Company status</span><AdministrationStatus value={summary.companyStatus || "unknown"} /></div></div>
      </AdministrationCard>
    </div>
  </AdministrationPage>
}

export function UpcomingAdministrationFeature({ title = "Administration feature" }) {
  return <AdministrationPage><AdministrationHeader icon={FiSettings} title={title} description="This approved Administration capability will be delivered in the next implementation phase." /><AdministrationCard><AdministrationTableState status="empty" title="Coming in the approved next phase" description={`${title} is listed for visibility but is not available yet. No placeholder action is presented as functional.`} /></AdministrationCard></AdministrationPage>
}

export default function AdministrationDashboard() {
  const currentUser = useSelector((state) => state.user?.currentUser)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const payload = await administrationApi.get("/dashboard")
      const next = payload.data || {}
      setData({ ...next, tasks: filterNavigableAdministrationTasks(next.tasks || [], currentUser) })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [currentUser])

  useEffect(() => { loadDashboard() }, [loadDashboard])
  const viewData = useMemo(() => data ? { ...data, tasks: sortAdministrationTasks(data.tasks) } : null, [data])
  return <AdministrationDashboardView data={viewData} loading={loading} error={error} onReload={loadDashboard} />
}
