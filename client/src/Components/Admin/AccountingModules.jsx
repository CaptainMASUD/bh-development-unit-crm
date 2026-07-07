"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiActivity,
  FiAlertCircle,
  FiArchive,
  FiBarChart2,
  FiBookOpen,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiFilter,
  FiGrid,
  FiLayers,
  FiLock,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiSearch,
  FiSend,
  FiSettings,
  FiShield,
  FiShuffle,
  FiTrendingDown,
  FiTrendingUp,
  FiUnlock,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const ROW_LIMIT = 30

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const btnSoft = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 hover:bg-indigo-100"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

const NAV_GROUPS = [
  {
    key: "sales",
    label: "Sales",
    icon: FiTrendingUp,
    items: [
      ["deals-income", "Deals Income", FiBriefcase],
      ["invoices", "Invoices", FiFileText],
      ["customer-payments", "Customer Payments", FiDollarSign],
      ["receivables", "Receivables", FiTrendingUp],
    ],
  },
  {
    key: "purchases",
    label: "Purchases",
    icon: FiCreditCard,
    items: [
      ["expenses", "Expenses", FiCreditCard],
      ["vendor-bills", "Vendor Bills", FiArchive],
      ["vendor-payments", "Vendor Payments", FiDollarSign],
      ["payables", "Payables", FiTrendingDown],
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: FiBarChart2,
    items: [
      ["profit-loss", "Profit & Loss", FiBarChart2],
      ["receivable-aging", "Receivable Aging", FiTrendingUp],
      ["payable-aging", "Payable Aging", FiTrendingDown],
    ],
  },
  {
    key: "tax-vat",
    label: "Tax / VAT",
    icon: FiShield,
    items: [
      ["vat-setup", "VAT Setup", FiSettings],
      ["input-vat", "Input VAT", FiTrendingDown],
      ["output-vat", "Output VAT", FiTrendingUp],
      ["tax-reports", "Tax Reports", FiFileText],
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: FiSettings,
    items: [
      ["fiscal-year", "Fiscal Year", FiCalendar],
      ["period-closing", "Period Closing", FiLock],
      ["approval-rules", "Approval Rules", FiShield],
      ["audit-trail", "Audit Trail", FiActivity],
    ],
  },
]

const VIEW_LABELS = Object.fromEntries(NAV_GROUPS.flatMap((group) => group.items.map(([key, label]) => [key, label])))

function getAuthHeaders(extra = {}) {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...getAuthHeaders(options.headers || {}), ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || data?.error || "Request failed")
  return data
}

function money(value, currency = "BDT") {
  const n = Number(value || 0)
  try {
    return new Intl.NumberFormat("en-BD", { style: "currency", currency: currency || "BDT", maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${currency || "BDT"} ${n.toLocaleString()}`
  }
}

function dateText(value, withTime = false) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("en-US", { month: "short", day: "2-digit", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) })
}

function pretty(value) {
  return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function exportCsv(filename, rows = []) {
  if (!rows.length) return toast.error("No rows to export.")
  const headers = Object.keys(rows[0])
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function useFinanceData(path, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const abortRef = useRef(null)

  const load = useCallback(async () => {
    if (!enabled || !path) return null
    abortRef.current?.abort?.()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError("")
    try {
      const result = await api(path, { signal: controller.signal })
      setData(result)
      return result
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to load data")
        toast.error(err.message || "Failed to load data")
      }
      return null
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [path, enabled, ...deps])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort?.()
  }, [load])

  return { data, setData, loading, error, reload: load }
}

function Field({ title, children, hint }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}
    </label>
  )
}

function Badge({ value }) {
  const key = String(value || "").toLowerCase()
  const styles = {
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    approved: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    posted: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    draft: "bg-gray-100 text-gray-700 ring-gray-600/10",
    pending: "bg-amber-50 text-amber-800 ring-amber-600/10",
    partially_paid: "bg-amber-50 text-amber-800 ring-amber-600/10",
    overdue: "bg-rose-50 text-rose-700 ring-rose-600/10",
    void: "bg-rose-50 text-rose-700 ring-rose-600/10",
    closed: "bg-rose-50 text-rose-700 ring-rose-600/10",
    open: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  }
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", styles[key] || "bg-gray-100 text-gray-700 ring-gray-600/10")}>{pretty(value)}</span>
}

function Stat({ label, value, icon, tone = "bg-indigo-50 text-indigo-700" }) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-gray-950">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tone)}>{icon}</div>
      </div>
    </div>
  )
}

function EmptyState({ title = "No data yet", text = "Records will appear here when available." }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
      <div>
        <FiAlertCircle className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-3 text-sm font-extrabold text-gray-900">{title}</p>
        <p className="mt-1 text-sm font-semibold text-gray-500">{text}</p>
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, icon, actions }) {
  return (
    <div className={`${card} mb-6 p-5`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">{icon}</div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-gray-950">{title}</h1>
            <p className="mt-1 text-sm font-semibold text-gray-500">{subtitle}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

function DateFilters({ filters, setFilters, onRefresh, loading }) {
  return (
    <div className={`${card} mb-6 p-4`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Field title="From"><input className={input} type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} /></Field>
        <Field title="To"><input className={input} type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} /></Field>
        <div className="flex items-end">
          <button className={cn(btn, btnGhost, "h-11 w-full")} type="button" onClick={onRefresh} disabled={loading}>
            <FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>
    </div>
  )
}

function TableShell({ children }) {
  return <div className={`${card} overflow-hidden`}><div className="overflow-x-auto">{children}</div></div>
}

function FinanceNav({ active, setActive }) {
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(NAV_GROUPS.map((group) => [group.key, true])))
  return (
    <div className={`${card} sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden`}>
      <div className="border-b border-gray-100 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Finance / Accounting</p>
        <p className="mt-1 text-sm font-semibold text-gray-500">Accounting command center</p>
      </div>
      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-2">
        <button
          type="button"
          onClick={() => setActive("dashboard")}
          className={cn("mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-black transition", active === "dashboard" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50")}
        >
          <FiGrid /> Dashboard
        </button>
        {NAV_GROUPS.map((group) => {
          const Icon = group.icon
          const isOpen = openGroups[group.key]
          return (
            <div key={group.key} className="mb-1">
              <button
                type="button"
                onClick={() => setOpenGroups((p) => ({ ...p, [group.key]: !p[group.key] }))}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-black text-gray-800 transition hover:bg-gray-50"
              >
                <span className="flex items-center gap-3"><Icon className="h-4 w-4 text-gray-500" /> {group.label}</span>
                <FiChevronDown className={cn("h-4 w-4 text-gray-400 transition", isOpen ? "rotate-180" : "")} />
              </button>
              {isOpen ? (
                <div className="mt-1 space-y-1 pl-3">
                  {group.items.map(([key, title, ItemIcon]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setActive(key)}
                      className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition", active === key ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")}
                    >
                      <ItemIcon className="h-4 w-4" />
                      <span className="truncate">{title}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DashboardView({ filters, setFilters }) {
  const qs = new URLSearchParams(filters).toString()
  const profit = useFinanceData(`/accounting/profit-loss?${qs}`, [qs])
  const receivables = useFinanceData(`/accounting/receivables?${qs}&limit=8`, [qs])
  const payables = useFinanceData(`/accounting/payables?${qs}&limit=8`, [qs])
  const trial = useFinanceData(`/accounting/trial-balance?${qs}`, [qs])
  const cash = useFinanceData(`/accounting/cash-flow?${qs}`, [qs])
  const loading = profit.loading || receivables.loading || payables.loading || trial.loading || cash.loading
  const reload = () => {
    profit.reload()
    receivables.reload()
    payables.reload()
    trial.reload()
    cash.reload()
  }
  const s = profit.data?.summary || {}
  return (
    <>
      <SectionHeader title="Finance Dashboard" subtitle="Live accounting view from income, payables, cash, and ledger reports." icon={<FiGrid className="h-6 w-6" />} actions={<button className={cn(btn, btnPrimary)} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue" value={money(s.revenue)} icon={<FiTrendingUp />} tone="bg-emerald-50 text-emerald-700" />
        <Stat label="Expenses" value={money(s.operatingExpenses)} icon={<FiTrendingDown />} tone="bg-rose-50 text-rose-700" />
        <Stat label="Net Profit" value={money(s.netProfit)} icon={<FiBarChart2 />} tone={Number(s.netProfit || 0) >= 0 ? "bg-indigo-50 text-indigo-700" : "bg-rose-50 text-rose-700"} />
        <Stat label="Cash Movement" value={money(cash.data?.totals?.net)} icon={<FiActivity />} tone="bg-sky-50 text-sky-700" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <MiniPanel title="Receivables" rows={[
          ["Total receivable", money(receivables.data?.summary?.receivableAmount)],
          ["Overdue", money(receivables.data?.summary?.overdueAmount)],
          ["Unbilled", money(receivables.data?.summary?.unbilledAmount)],
        ]} />
        <MiniPanel title="Payables" rows={[
          ["Payable", money(payables.data?.summary?.payableAmount)],
          ["Pending", money(payables.data?.summary?.pendingAmount)],
          ["Approved", money(payables.data?.summary?.approvedAmount)],
        ]} />
        <MiniPanel title="Trial Balance" rows={[
          ["Debits", money(trial.data?.totals?.debit)],
          ["Credits", money(trial.data?.totals?.credit)],
          ["Balanced", trial.data?.isBalanced ? "Yes" : "No"],
        ]} />
      </div>
    </>
  )
}

function MiniPanel({ title, rows }) {
  return (
    <div className={`${card} p-5`}>
      <h3 className="text-base font-black text-gray-950">{title}</h3>
      <div className="mt-4 divide-y divide-gray-100">
        {rows.map(([labelText, value]) => (
          <div key={labelText} className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-bold text-gray-500">{labelText}</span>
            <span className="text-sm font-black text-gray-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ReceivablesView({ filters, setFilters }) {
  const [query, setQuery] = useState("")
  const qs = new URLSearchParams({ ...filters, q: query, limit: ROW_LIMIT }).toString()
  const { data, loading, reload } = useFinanceData(`/accounting/receivables?${qs}`, [qs])
  const rows = data?.rows || []
  return (
    <>
      <SectionHeader title="Receivables" subtitle="Outstanding customer receivables from won deals and invoices." icon={<FiTrendingUp className="h-6 w-6" />} actions={<button className={cn(btn, btnGhost)} onClick={() => exportCsv("receivables.csv", rows)}><FiDownload /> Export</button>} />
      <SearchAndDates query={query} setQuery={setQuery} filters={filters} setFilters={setFilters} loading={loading} reload={reload} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Receivable" value={money(data?.summary?.receivableAmount)} icon={<FiDollarSign />} />
        <Stat label="Overdue" value={money(data?.summary?.overdueAmount)} icon={<FiAlertCircle />} tone="bg-rose-50 text-rose-700" />
        <Stat label="Unbilled" value={money(data?.summary?.unbilledAmount)} icon={<FiFileText />} tone="bg-sky-50 text-sky-700" />
      </div>
      <ReceivableTable rows={rows} />
    </>
  )
}

function ReceivableTable({ rows }) {
  if (!rows.length) return <EmptyState title="No receivables found" />
  return (
    <TableShell>
      <table className="min-w-full divide-y divide-gray-100 text-left">
        <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400">
          <tr>{["Deal", "Client", "Deal Value", "Invoiced", "Collected", "Due", "Unbilled", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row._id} className="hover:bg-gray-50/60">
              <td className="px-5 py-4"><p className="text-sm font-black text-gray-900">{row.dealNo || "-"}</p><p className="text-xs font-semibold text-gray-500">{row.title}</p></td>
              <td className="px-5 py-4 text-sm font-bold text-gray-700">{row.customer?.companyName || row.customer?.name || "-"}</td>
              <td className="px-5 py-4 text-sm font-black">{money(row.grandTotal, row.currency)}</td>
              <td className="px-5 py-4 text-sm font-bold">{money(row.invoicedAmount, row.currency)}</td>
              <td className="px-5 py-4 text-sm font-bold text-emerald-700">{money(row.paidAmount, row.currency)}</td>
              <td className="px-5 py-4 text-sm font-bold text-rose-700">{money(row.invoiceDueAmount, row.currency)}</td>
              <td className="px-5 py-4 text-sm font-bold">{money(row.unbilledAmount, row.currency)}</td>
              <td className="px-5 py-4"><Badge value={row.isOverdue ? "overdue" : row.unbilledAmount > 0 ? "unbilled" : "current"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function PayablesView({ filters, setFilters }) {
  const [query, setQuery] = useState("")
  const qs = new URLSearchParams({ ...filters, q: query, limit: ROW_LIMIT }).toString()
  const { data, loading, reload } = useFinanceData(`/accounting/payables?${qs}`, [qs])
  const rows = data?.rows || []
  return (
    <>
      <SectionHeader title="Payables" subtitle="Expense commitments and approved liabilities awaiting payment." icon={<FiTrendingDown className="h-6 w-6" />} actions={<button className={cn(btn, btnGhost)} onClick={() => exportCsv("payables.csv", rows)}><FiDownload /> Export</button>} />
      <SearchAndDates query={query} setQuery={setQuery} filters={filters} setFilters={setFilters} loading={loading} reload={reload} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Payable" value={money(data?.summary?.payableAmount)} icon={<FiCreditCard />} />
        <Stat label="Pending" value={money(data?.summary?.pendingAmount)} icon={<FiAlertCircle />} tone="bg-amber-50 text-amber-700" />
        <Stat label="Approved" value={money(data?.summary?.approvedAmount)} icon={<FiCheckCircle />} tone="bg-indigo-50 text-indigo-700" />
      </div>
      <ExpenseTable rows={rows} />
    </>
  )
}

function SearchAndDates({ query, setQuery, filters, setFilters, loading, reload }) {
  return (
    <div className={`${card} mb-6 p-4`}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
        <Field title="Search"><div className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records" /></div></Field>
        <Field title="From"><input className={input} type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} /></Field>
        <Field title="To"><input className={input} type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} /></Field>
        <div className="flex items-end"><button className={cn(btn, btnGhost, "h-11 w-full")} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button></div>
      </div>
    </div>
  )
}

function ExpenseTable({ rows }) {
  if (!rows.length) return <EmptyState title="No records found" />
  return (
    <TableShell>
      <table className="min-w-full divide-y divide-gray-100 text-left">
        <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400">
          <tr>{["Title", "Vendor", "Category", "Date", "Amount", "Method", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row._id} className="hover:bg-gray-50/60">
              <td className="px-5 py-4 text-sm font-black text-gray-900">{row.title || row.billNo || "-"}</td>
              <td className="px-5 py-4 text-sm font-bold text-gray-700">{row.payeeVendor || row.vendorName || "-"}</td>
              <td className="px-5 py-4 text-sm font-bold text-gray-600">{row.category?.name || row.expenseAccount?.name || "-"}</td>
              <td className="px-5 py-4 text-sm font-bold text-gray-600">{dateText(row.expenseDate || row.billDate)}</td>
              <td className="px-5 py-4 text-sm font-black text-gray-900">{money(row.amount || row.total, row.currency)}</td>
              <td className="px-5 py-4 text-sm font-bold text-gray-600">{pretty(row.paymentMethod || "-")}</td>
              <td className="px-5 py-4"><Badge value={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function DealsIncomeView({ filters, setFilters }) {
  const qs = new URLSearchParams(filters).toString()
  const { data, loading, reload } = useFinanceData(`/accounting/profit-loss?${qs}`, [qs])
  const rows = data?.revenueByCurrency || []
  return (
    <>
      <SectionHeader title="Deals Income" subtitle="Accrual revenue recognized from won deals." icon={<FiBriefcase className="h-6 w-6" />} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Revenue" value={money(data?.summary?.revenue)} icon={<FiTrendingUp />} tone="bg-emerald-50 text-emerald-700" />
        <Stat label="Deal Count" value={data?.summary?.dealCount || 0} icon={<FiBriefcase />} />
        <Stat label="Cash Collected" value={money(data?.summary?.cashCollected)} icon={<FiDollarSign />} tone="bg-sky-50 text-sky-700" />
      </div>
      <SimpleRows title="Revenue by Currency" rows={rows.map((r) => [r.currency, money(r.revenue, r.currency), `${r.count} deals`])} />
    </>
  )
}

function InvoicesView() {
  const { data, loading, reload } = useFinanceData("/invoices?limit=50", [])
  const invoices = data?.invoices || data?.items || []
  return (
    <>
      <SectionHeader title="Invoices" subtitle="Customer invoices from the sales flow." icon={<FiFileText className="h-6 w-6" />} actions={<button className={cn(btn, btnGhost)} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>} />
      {!invoices.length ? <EmptyState title="No invoices loaded" /> : (
        <TableShell>
          <table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Invoice", "Customer", "Issued", "Due", "Total", "Paid", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((row) => <tr key={row._id} className="hover:bg-gray-50/60"><td className="px-5 py-4 text-sm font-black">{row.invoiceNo}</td><td className="px-5 py-4 text-sm font-bold">{row.customerId?.name || row.customer?.name || "-"}</td><td className="px-5 py-4 text-sm font-bold">{dateText(row.issuedAt)}</td><td className="px-5 py-4 text-sm font-bold">{dateText(row.dueAt)}</td><td className="px-5 py-4 text-sm font-black">{money(row.total, row.currency)}</td><td className="px-5 py-4 text-sm font-bold text-emerald-700">{money(row.paidTotal, row.currency)}</td><td className="px-5 py-4"><Badge value={row.status} /></td></tr>)}
            </tbody>
          </table>
        </TableShell>
      )}
    </>
  )
}

function CustomerPaymentsView() {
  return <JournalSourceView title="Customer Payments" subtitle="Payments posted against invoices." icon={<FiDollarSign className="h-6 w-6" />} sourceType="customer_payment" />
}

function ExpensesView({ filters, setFilters }) {
  const qs = new URLSearchParams({ ...filters, limit: ROW_LIMIT }).toString()
  const { data, loading, reload } = useFinanceData(`/accounting/payables?${qs}`, [qs])
  return (
    <>
      <SectionHeader title="Expenses" subtitle="Expense accounting view connected to payables." icon={<FiCreditCard className="h-6 w-6" />} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <ExpenseTable rows={data?.rows || []} />
    </>
  )
}

function VendorBillsView() {
  const { data, loading, reload } = useFinanceData("/accounting/vendor-bills?limit=50", [])
  const accounts = useFinanceData("/accounting/accounts?type=expense&limit=100", [])
  const [form, setForm] = useState({ vendorName: "", total: "", billDate: today(), dueDate: "", memo: "", post: true, expenseAccount: "" })
  const bills = data?.vendorBills || []
  const create = async (e) => {
    e.preventDefault()
    try {
      await api("/accounting/vendor-bills", { method: "POST", body: JSON.stringify({ ...form, total: Number(form.total || 0), post: Boolean(form.post), expenseAccount: form.expenseAccount || undefined }) })
      toast.success("Vendor bill created")
      setForm({ vendorName: "", total: "", billDate: today(), dueDate: "", memo: "", post: true, expenseAccount: "" })
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Vendor Bills" subtitle="Create, approve, and track supplier bills." icon={<FiArchive className="h-6 w-6" />} actions={<button className={cn(btn, btnGhost)} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>} />
      <form onSubmit={create} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Field title="Vendor"><input className={input} value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} required /></Field>
          <Field title="Amount"><input className={input} type="number" value={form.total} onChange={(e) => setForm((p) => ({ ...p, total: e.target.value }))} required /></Field>
          <Field title="Bill Date"><input className={input} type="date" value={form.billDate} onChange={(e) => setForm((p) => ({ ...p, billDate: e.target.value }))} /></Field>
          <Field title="Due Date"><input className={input} type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} /></Field>
          <Field title="Expense Account"><select className={input} value={form.expenseAccount} onChange={(e) => setForm((p) => ({ ...p, expenseAccount: e.target.value }))}><option value="">Default expense</option>{(accounts.data?.accounts || []).map((a) => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}</select></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700"><input type="checkbox" checked={form.post} onChange={(e) => setForm((p) => ({ ...p, post: e.target.checked }))} /> Post immediately</label>
          <button className={cn(btn, btnPrimary)} type="submit"><FiPlus /> Create Bill</button>
        </div>
      </form>
      <ExpenseTable rows={bills} />
    </>
  )
}

function VendorPaymentsView() {
  return <JournalSourceView title="Vendor Payments" subtitle="Cash/bank payments posted against vendor bills." icon={<FiDollarSign className="h-6 w-6" />} sourceType="vendor_payment" />
}

function JournalSourceView({ title, subtitle, icon, sourceType }) {
  const { data, loading, reload } = useFinanceData(`/accounting/journals?sourceType=${sourceType}&limit=50`, [sourceType])
  const rows = data?.journalEntries || []
  return (
    <>
      <SectionHeader title={title} subtitle={subtitle} icon={icon} actions={<button className={cn(btn, btnGhost)} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>} />
      <JournalTable rows={rows} />
    </>
  )
}

function CashBankView() {
  const { data, loading, reload } = useFinanceData("/accounting/cash-accounts?limit=100", [])
  const accounts = useFinanceData("/accounting/accounts?type=asset&limit=100", [])
  const [form, setForm] = useState({ name: "", type: "bank", account: "", openingBalance: "", institution: "", accountNo: "" })
  const create = async (e) => {
    e.preventDefault()
    try {
      await api("/accounting/cash-accounts", { method: "POST", body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance || 0), account: form.account || undefined }) })
      toast.success("Cash/bank account created")
      setForm({ name: "", type: "bank", account: "", openingBalance: "", institution: "", accountNo: "" })
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Cash & Bank Accounts" subtitle="Operational cash, bank, card, and mobile banking accounts." icon={<FiCreditCard className="h-6 w-6" />} actions={<button className={cn(btn, btnGhost)} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>} />
      <form onSubmit={create} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Field title="Name"><input className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></Field>
          <Field title="Type"><select className={input} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>{["cash", "bank", "mobile_banking", "card", "other"].map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field>
          <Field title="Ledger Account"><select className={input} value={form.account} onChange={(e) => setForm((p) => ({ ...p, account: e.target.value }))}><option value="">Default</option>{(accounts.data?.accounts || []).map((a) => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}</select></Field>
          <Field title="Institution"><input className={input} value={form.institution} onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))} /></Field>
          <Field title="Opening Balance"><input className={input} type="number" value={form.openingBalance} onChange={(e) => setForm((p) => ({ ...p, openingBalance: e.target.value }))} /></Field>
        </div>
        <div className="mt-4 flex justify-end"><button className={cn(btn, btnPrimary)} type="submit"><FiPlus /> Add Account</button></div>
      </form>
      <CashAccountTable rows={data?.cashAccounts || []} />
    </>
  )
}

function CashAccountTable({ rows }) {
  if (!rows.length) return <EmptyState title="No cash/bank accounts" />
  return (
    <TableShell>
      <table className="min-w-full divide-y divide-gray-100 text-left">
        <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Name", "Type", "Ledger Account", "Institution", "Opening", "Reconciled"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={row._id}><td className="px-5 py-4 text-sm font-black">{row.name}</td><td className="px-5 py-4"><Badge value={row.type} /></td><td className="px-5 py-4 text-sm font-bold">{row.account?.code} - {row.account?.name}</td><td className="px-5 py-4 text-sm font-bold">{row.institution || "-"}</td><td className="px-5 py-4 text-sm font-black">{money(row.openingBalance, row.currency)}</td><td className="px-5 py-4 text-sm font-bold">{dateText(row.lastReconciledAt)}</td></tr>)}</tbody>
      </table>
    </TableShell>
  )
}

function MoneyTransferView() {
  const cash = useFinanceData("/accounting/cash-accounts?limit=100", [])
  const [form, setForm] = useState({ from: "", to: "", amount: "", date: today(), memo: "" })
  const submit = async (e) => {
    e.preventDefault()
    const from = (cash.data?.cashAccounts || []).find((x) => x._id === form.from)
    const to = (cash.data?.cashAccounts || []).find((x) => x._id === form.to)
    if (!from || !to || from._id === to._id) return toast.error("Select different accounts")
    try {
      await api("/accounting/journals", {
        method: "POST",
        body: JSON.stringify({
          date: form.date,
          sourceType: "bank_transfer",
          reference: "TRANSFER",
          memo: form.memo || `Transfer ${from.name} to ${to.name}`,
          lines: [
            { account: to.account?._id || to.account, debit: Number(form.amount || 0), credit: 0, description: to.name },
            { account: from.account?._id || from.account, debit: 0, credit: Number(form.amount || 0), description: from.name },
          ],
        }),
      })
      toast.success("Transfer posted")
      setForm({ from: "", to: "", amount: "", date: today(), memo: "" })
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Money Transfer" subtitle="Move money between cash and bank accounts with balanced journals." icon={<FiShuffle className="h-6 w-6" />} />
      <form onSubmit={submit} className={`${card} p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Field title="From"><CashSelect rows={cash.data?.cashAccounts || []} value={form.from} onChange={(value) => setForm((p) => ({ ...p, from: value }))} /></Field>
          <Field title="To"><CashSelect rows={cash.data?.cashAccounts || []} value={form.to} onChange={(value) => setForm((p) => ({ ...p, to: value }))} /></Field>
          <Field title="Amount"><input className={input} type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></Field>
          <Field title="Date"><input className={input} type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></Field>
        </div>
        <div className="mt-4 flex justify-end"><button className={cn(btn, btnPrimary)} type="submit"><FiSend /> Post Transfer</button></div>
      </form>
    </>
  )
}

function BankReconciliationView() {
  const cash = useFinanceData("/accounting/cash-accounts?limit=100", [])
  const [form, setForm] = useState({ id: "", balance: "", reconciledAt: today() })
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api(`/accounting/cash-accounts/${form.id}/reconcile`, { method: "PATCH", body: JSON.stringify({ balance: Number(form.balance || 0), reconciledAt: form.reconciledAt }) })
      toast.success("Account reconciled")
      cash.reload()
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Bank Reconciliation" subtitle="Save reconciliation checkpoints for cash and bank accounts." icon={<FiCheckCircle className="h-6 w-6" />} />
      <form onSubmit={submit} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Field title="Account"><CashSelect rows={cash.data?.cashAccounts || []} value={form.id} onChange={(value) => setForm((p) => ({ ...p, id: value }))} /></Field>
          <Field title="Statement Balance"><input className={input} type="number" value={form.balance} onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))} required /></Field>
          <Field title="Reconciled At"><input className={input} type="date" value={form.reconciledAt} onChange={(e) => setForm((p) => ({ ...p, reconciledAt: e.target.value }))} /></Field>
          <div className="flex items-end"><button className={cn(btn, btnPrimary, "h-11 w-full")} type="submit"><FiSave /> Save</button></div>
        </div>
      </form>
      <CashAccountTable rows={cash.data?.cashAccounts || []} />
    </>
  )
}

function CashSelect({ rows, value, onChange }) {
  return <select className={input} value={value} onChange={(e) => onChange(e.target.value)} required><option value="">Select account</option>{rows.map((row) => <option key={row._id} value={row._id}>{row.name} - {row.account?.code}</option>)}</select>
}

function ChartAccountsView() {
  const { data, loading, reload } = useFinanceData("/accounting/accounts?limit=200&active=all", [])
  const [form, setForm] = useState({ code: "", name: "", type: "asset" })
  const bootstrap = async () => {
    try {
      await api("/accounting/accounts/bootstrap", { method: "POST", body: JSON.stringify({}) })
      toast.success("Default chart created")
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }
  const create = async (e) => {
    e.preventDefault()
    try {
      await api("/accounting/accounts", { method: "POST", body: JSON.stringify(form) })
      toast.success("Account created")
      setForm({ code: "", name: "", type: "asset" })
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Chart of Accounts" subtitle="Assets, liabilities, equity, income, and expense ledger accounts." icon={<FiLayers className="h-6 w-6" />} actions={<><button className={cn(btn, btnSoft)} onClick={bootstrap}><FiRefreshCcw /> Bootstrap</button><button className={cn(btn, btnGhost)} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button></>} />
      <form onSubmit={create} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr_1fr_auto]">
          <Field title="Code"><input className={input} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required /></Field>
          <Field title="Name"><input className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></Field>
          <Field title="Type"><select className={input} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>{["asset", "liability", "equity", "revenue", "expense"].map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field>
          <div className="flex items-end"><button className={cn(btn, btnPrimary, "h-11")} type="submit"><FiPlus /> Add</button></div>
        </div>
      </form>
      <AccountTable rows={data?.accounts || []} />
    </>
  )
}

function AccountTable({ rows }) {
  if (!rows.length) return <EmptyState title="No accounts found" text="Bootstrap the default chart or create a new account." />
  return (
    <TableShell>
      <table className="min-w-full divide-y divide-gray-100 text-left">
        <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Code", "Account", "Type", "Normal", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={row._id}><td className="px-5 py-4 text-sm font-black">{row.code}</td><td className="px-5 py-4 text-sm font-bold">{row.name}</td><td className="px-5 py-4"><Badge value={row.type} /></td><td className="px-5 py-4 text-sm font-bold">{pretty(row.normalBalance)}</td><td className="px-5 py-4"><Badge value={row.isActive ? "active" : "inactive"} /></td></tr>)}</tbody>
      </table>
    </TableShell>
  )
}

function JournalEntriesView() {
  const { data, loading, reload } = useFinanceData("/accounting/journals?limit=50", [])
  const accounts = useFinanceData("/accounting/accounts?limit=200", [])
  const [form, setForm] = useState({ date: today(), memo: "", debitAccount: "", creditAccount: "", amount: "" })
  const create = async (e) => {
    e.preventDefault()
    try {
      await api("/accounting/journals", { method: "POST", body: JSON.stringify({ date: form.date, memo: form.memo, lines: [{ account: form.debitAccount, debit: Number(form.amount || 0), credit: 0 }, { account: form.creditAccount, debit: 0, credit: Number(form.amount || 0) }] }) })
      toast.success("Journal posted")
      setForm({ date: today(), memo: "", debitAccount: "", creditAccount: "", amount: "" })
      reload()
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Journal Entries" subtitle="Post balanced debit and credit entries." icon={<FiEdit3 className="h-6 w-6" />} actions={<button className={cn(btn, btnGhost)} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>} />
      <form onSubmit={create} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Field title="Date"><input className={input} type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></Field>
          <Field title="Debit"><AccountSelect rows={accounts.data?.accounts || []} value={form.debitAccount} onChange={(v) => setForm((p) => ({ ...p, debitAccount: v }))} /></Field>
          <Field title="Credit"><AccountSelect rows={accounts.data?.accounts || []} value={form.creditAccount} onChange={(v) => setForm((p) => ({ ...p, creditAccount: v }))} /></Field>
          <Field title="Amount"><input className={input} type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></Field>
          <div className="flex items-end"><button className={cn(btn, btnPrimary, "h-11 w-full")} type="submit"><FiSave /> Post</button></div>
        </div>
      </form>
      <JournalTable rows={data?.journalEntries || []} />
    </>
  )
}

function JournalTable({ rows }) {
  if (!rows.length) return <EmptyState title="No journal entries" />
  return (
    <TableShell>
      <table className="min-w-full divide-y divide-gray-100 text-left">
        <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Entry", "Date", "Source", "Memo", "Debit", "Credit", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{rows.map((row) => <tr key={row._id}><td className="px-5 py-4 text-sm font-black">{row.entryNo || "-"}</td><td className="px-5 py-4 text-sm font-bold">{dateText(row.date)}</td><td className="px-5 py-4 text-sm font-bold">{pretty(row.sourceType)}</td><td className="px-5 py-4 text-sm font-semibold text-gray-600">{row.memo || row.reference || "-"}</td><td className="px-5 py-4 text-sm font-black">{money(row.totalDebit, row.currency)}</td><td className="px-5 py-4 text-sm font-black">{money(row.totalCredit, row.currency)}</td><td className="px-5 py-4"><Badge value={row.status} /></td></tr>)}</tbody>
      </table>
    </TableShell>
  )
}

function AccountSelect({ rows, value, onChange }) {
  return <select className={input} value={value} onChange={(e) => onChange(e.target.value)} required><option value="">Select account</option>{rows.map((row) => <option key={row._id} value={row._id}>{row.code} - {row.name}</option>)}</select>
}

function GeneralLedgerView({ filters, setFilters }) {
  const accounts = useFinanceData("/accounting/accounts?limit=200", [])
  const [account, setAccount] = useState("")
  const qs = account ? new URLSearchParams({ ...filters, account, limit: ROW_LIMIT }).toString() : ""
  const ledger = useFinanceData(account ? `/accounting/general-ledger?${qs}` : "", [qs], { enabled: Boolean(account) })
  return (
    <>
      <SectionHeader title="General Ledger" subtitle="Account-level ledger drilldown from posted journals." icon={<FiBookOpen className="h-6 w-6" />} />
      <div className={`${card} mb-6 p-4`}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <Field title="Account"><AccountSelect rows={accounts.data?.accounts || []} value={account} onChange={setAccount} /></Field>
          <Field title="From"><input className={input} type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} /></Field>
          <Field title="To"><input className={input} type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} /></Field>
          <div className="flex items-end"><button className={cn(btn, btnGhost, "h-11 w-full")} onClick={ledger.reload} disabled={!account || ledger.loading}><FiRefreshCcw className={ledger.loading ? "animate-spin" : ""} /> Refresh</button></div>
        </div>
      </div>
      <LedgerTable rows={ledger.data?.entries || []} />
    </>
  )
}

function LedgerTable({ rows }) {
  if (!rows.length) return <EmptyState title="No ledger rows" text="Select an account to view ledger activity." />
  return (
    <TableShell>
      <table className="min-w-full divide-y divide-gray-100 text-left">
        <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Date", "Entry", "Source", "Account", "Debit", "Credit", "Memo"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{rows.flatMap((entry) => (entry.lines || []).map((line) => <tr key={`${entry._id}-${line._id}`}><td className="px-5 py-4 text-sm font-bold">{dateText(entry.date)}</td><td className="px-5 py-4 text-sm font-black">{entry.entryNo || "-"}</td><td className="px-5 py-4 text-sm font-bold">{pretty(entry.sourceType)}</td><td className="px-5 py-4 text-sm font-bold">{line.account?.code} - {line.account?.name}</td><td className="px-5 py-4 text-sm font-black">{money(line.debit, entry.currency)}</td><td className="px-5 py-4 text-sm font-black">{money(line.credit, entry.currency)}</td><td className="px-5 py-4 text-sm font-semibold text-gray-600">{entry.memo || line.description}</td></tr>))}</tbody>
      </table>
    </TableShell>
  )
}

function OpeningBalancesView() {
  const accounts = useFinanceData("/accounting/accounts?limit=200", [])
  const [form, setForm] = useState({ date: today(), account: "", side: "debit", amount: "" })
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api("/accounting/opening-balances", { method: "POST", body: JSON.stringify({ date: form.date, lines: [{ account: form.account, debit: form.side === "debit" ? Number(form.amount || 0) : 0, credit: form.side === "credit" ? Number(form.amount || 0) : 0 }] }) })
      toast.success("Opening balance posted")
      setForm({ date: today(), account: "", side: "debit", amount: "" })
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Opening Balances" subtitle="Post starting balances with automatic opening balance equity." icon={<FiArchive className="h-6 w-6" />} />
      <form onSubmit={submit} className={`${card} p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Field title="Date"><input className={input} type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></Field>
          <Field title="Account"><AccountSelect rows={accounts.data?.accounts || []} value={form.account} onChange={(v) => setForm((p) => ({ ...p, account: v }))} /></Field>
          <Field title="Side"><select className={input} value={form.side} onChange={(e) => setForm((p) => ({ ...p, side: e.target.value }))}><option value="debit">Debit</option><option value="credit">Credit</option></select></Field>
          <Field title="Amount"><input className={input} type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></Field>
          <div className="flex items-end"><button className={cn(btn, btnPrimary, "h-11 w-full")} type="submit"><FiSave /> Post</button></div>
        </div>
      </form>
    </>
  )
}

function ProfitLossView({ filters, setFilters }) {
  const qs = new URLSearchParams(filters).toString()
  const { data, loading, reload } = useFinanceData(`/accounting/profit-loss?${qs}`, [qs])
  const s = data?.summary || {}
  return (
    <>
      <SectionHeader title="Profit & Loss" subtitle="Accrual income statement from deals and operating expenses." icon={<FiBarChart2 className="h-6 w-6" />} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Stat label="Revenue" value={money(s.revenue)} icon={<FiTrendingUp />} tone="bg-emerald-50 text-emerald-700" /><Stat label="Expenses" value={money(s.operatingExpenses)} icon={<FiTrendingDown />} tone="bg-rose-50 text-rose-700" /><Stat label="Net Profit" value={money(s.netProfit)} icon={<FiBarChart2 />} /></div>
      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2"><SimpleRows title="Revenue by Currency" rows={(data?.revenueByCurrency || []).map((r) => [r.currency, money(r.revenue, r.currency), `${r.count} deals`])} /><SimpleRows title="Expenses by Category" rows={(data?.expensesByCategory || []).map((r) => [r.category, money(r.amount), `${r.count} entries`])} /></div>
    </>
  )
}

function TrialBalanceView({ filters, setFilters }) {
  const qs = new URLSearchParams(filters).toString()
  const { data, loading, reload } = useFinanceData(`/accounting/trial-balance?${qs}`, [qs])
  return (
    <>
      <SectionHeader title="Trial Balance" subtitle="Debit and credit proof from posted journals." icon={<FiGrid className="h-6 w-6" />} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"><Stat label="Debits" value={money(data?.totals?.debit)} icon={<FiTrendingUp />} /><Stat label="Credits" value={money(data?.totals?.credit)} icon={<FiTrendingDown />} /><Stat label="Balanced" value={data?.isBalanced ? "Yes" : "No"} icon={data?.isBalanced ? <FiCheckCircle /> : <FiAlertCircle />} tone={data?.isBalanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"} /></div>
      <TrialTable rows={data?.rows || []} />
    </>
  )
}

function TrialTable({ rows }) {
  if (!rows.length) return <EmptyState title="No trial balance rows" />
  return <TableShell><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Account", "Type", "Debit", "Credit", "Balance"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((r) => <tr key={r.account?._id}><td className="px-5 py-4 text-sm font-black">{r.account?.code} - {r.account?.name}</td><td className="px-5 py-4"><Badge value={r.account?.type} /></td><td className="px-5 py-4 text-sm font-black">{money(r.debit)}</td><td className="px-5 py-4 text-sm font-black">{money(r.credit)}</td><td className="px-5 py-4 text-sm font-black">{money(r.balance)}</td></tr>)}</tbody></table></TableShell>
}

function BalanceSheetView() {
  const [to, setTo] = useState(today())
  const { data, loading, reload } = useFinanceData(`/accounting/balance-sheet?to=${to}`, [to])
  return (
    <>
      <SectionHeader title="Balance Sheet" subtitle="Assets, liabilities, and equity as of a selected date." icon={<FiLayers className="h-6 w-6" />} />
      <div className={`${card} mb-6 p-4`}><div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]"><Field title="As Of"><input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field><div className="flex items-end"><button className={cn(btn, btnGhost, "h-11")} onClick={reload} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button></div></div></div>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"><Stat label="Assets" value={money(data?.totals?.assets)} icon={<FiTrendingUp />} /><Stat label="Liabilities" value={money(data?.totals?.liabilities)} icon={<FiTrendingDown />} /><Stat label="Equity" value={money(data?.totals?.equity)} icon={<FiLayers />} /></div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><BalanceGroup title="Assets" rows={data?.assets || []} /><BalanceGroup title="Liabilities" rows={data?.liabilities || []} /><BalanceGroup title="Equity" rows={data?.equity || []} /></div>
    </>
  )
}

function BalanceGroup({ title, rows }) {
  return <div className={`${card} p-5`}><h3 className="text-base font-black text-gray-950">{title}</h3><div className="mt-4 divide-y divide-gray-100">{rows.length ? rows.map((row) => <div key={row.account?._id} className="flex justify-between gap-3 py-3"><span className="text-sm font-bold text-gray-600">{row.account?.code} - {row.account?.name}</span><span className="text-sm font-black">{money(row.balance)}</span></div>) : <p className="py-6 text-sm font-semibold text-gray-500">No rows</p>}</div></div>
}

function CashFlowView({ filters, setFilters }) {
  const qs = new URLSearchParams(filters).toString()
  const { data, loading, reload } = useFinanceData(`/accounting/cash-flow?${qs}`, [qs])
  return (
    <>
      <SectionHeader title="Cash Flow Statement" subtitle="Cash movement from posted cash/bank journal lines." icon={<FiActivity className="h-6 w-6" />} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"><Stat label="Inflow" value={money(data?.totals?.inflow)} icon={<FiTrendingUp />} tone="bg-emerald-50 text-emerald-700" /><Stat label="Outflow" value={money(data?.totals?.outflow)} icon={<FiTrendingDown />} tone="bg-rose-50 text-rose-700" /><Stat label="Net Cash" value={money(data?.totals?.net)} icon={<FiActivity />} /></div>
      <SimpleRows title="Cash Movement by Source" rows={(data?.items || []).map((r) => [pretty(r.sourceType), money(r.net), `${money(r.inflow)} in / ${money(r.outflow)} out`])} />
    </>
  )
}

function AgingView({ type, filters, setFilters }) {
  const endpoint = type === "receivable" ? "/accounting/receivables" : "/accounting/payables"
  const qs = new URLSearchParams({ ...filters, limit: 75 }).toString()
  const { data, loading, reload } = useFinanceData(`${endpoint}?${qs}`, [qs, endpoint])
  const rows = data?.rows || []
  const buckets = buildAging(rows, type)
  return (
    <>
      <SectionHeader title={type === "receivable" ? "Receivable Aging" : "Payable Aging"} subtitle="Aging buckets for outstanding balances." icon={type === "receivable" ? <FiTrendingUp className="h-6 w-6" /> : <FiTrendingDown className="h-6 w-6" />} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">{buckets.map((b) => <Stat key={b.label} label={b.label} value={money(b.amount)} icon={<FiCalendar />} tone={b.tone} />)}</div>
    </>
  )
}

function buildAging(rows, type) {
  const now = new Date()
  const buckets = [
    { label: "Current", amount: 0, tone: "bg-emerald-50 text-emerald-700" },
    { label: "1-30 Days", amount: 0, tone: "bg-amber-50 text-amber-700" },
    { label: "31-60 Days", amount: 0, tone: "bg-orange-50 text-orange-700" },
    { label: "60+ Days", amount: 0, tone: "bg-rose-50 text-rose-700" },
  ]
  rows.forEach((row) => {
    const date = new Date(type === "receivable" ? row.oldestDueAt || row.accountingDate : row.expenseDate || row.billDate)
    const amount = Number(type === "receivable" ? row.receivableAmount : row.amount || row.total || 0)
    const days = Number.isNaN(date.getTime()) ? 0 : Math.floor((now - date) / 86400000)
    if (days <= 0) buckets[0].amount += amount
    else if (days <= 30) buckets[1].amount += amount
    else if (days <= 60) buckets[2].amount += amount
    else buckets[3].amount += amount
  })
  return buckets
}

function VatSetupView() {
  return (
    <>
      <SectionHeader title="VAT Setup" subtitle="VAT accounting accounts and setup checklist." icon={<FiSettings className="h-6 w-6" />} />
      <div className={`${card} p-5`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><InfoTile title="Input VAT" text="Uses Input VAT / Tax Receivable account 1200 for purchase-side tax." /><InfoTile title="Output VAT" text="Uses Output VAT / Tax Payable account 2100 for sales-side tax." /></div>
      </div>
    </>
  )
}

function InputVatView() {
  const bills = useFinanceData("/accounting/vendor-bills?limit=75", [])
  const rows = (bills.data?.vendorBills || []).filter((b) => Number(b.taxAmount || 0) > 0)
  return <ReportList title="Input VAT" subtitle="Purchase-side VAT from vendor bills." icon={<FiTrendingDown className="h-6 w-6" />} rows={rows.map((r) => [r.billNo, r.vendorName, money(r.taxAmount, r.currency), dateText(r.billDate)])} />
}

function OutputVatView() {
  const journals = useFinanceData("/accounting/journals?sourceType=tax&limit=75", [])
  return <ReportList title="Output VAT" subtitle="Sales-side tax journal activity." icon={<FiTrendingUp className="h-6 w-6" />} rows={(journals.data?.journalEntries || []).map((r) => [r.entryNo || "-", pretty(r.sourceType), money(r.totalCredit, r.currency), dateText(r.date)])} />
}

function TaxReportsView({ filters, setFilters }) {
  const qs = new URLSearchParams({ year: new Date(filters.from || Date.now()).getFullYear() }).toString()
  const { data, loading, reload } = useFinanceData(`/tax/reports?${qs}`, [qs])
  return (
    <>
      <SectionHeader title="Tax Reports" subtitle="Payroll tax and remittance summary." icon={<FiFileText className="h-6 w-6" />} />
      <DateFilters filters={filters} setFilters={setFilters} onRefresh={reload} loading={loading} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3"><Stat label="Tax Deducted" value={money(data?.totals?.taxDeduction)} icon={<FiShield />} /><Stat label="Yearly Tax" value={money(data?.totals?.yearlyTax)} icon={<FiFileText />} /><Stat label="Pending Remittance" value={money(data?.totals?.pendingRemittance)} icon={<FiAlertCircle />} tone="bg-amber-50 text-amber-700" /></div>
    </>
  )
}

function FiscalYearView() {
  const periods = useFinanceData("/accounting/periods?limit=60", [])
  const [form, setForm] = useState({ periodKey: "", fiscalYear: new Date().getFullYear(), name: "", startDate: monthStart(), endDate: today() })
  const save = async (e) => {
    e.preventDefault()
    try {
      await api("/accounting/periods", { method: "POST", body: JSON.stringify(form) })
      toast.success("Fiscal period saved")
      periods.reload()
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <>
      <SectionHeader title="Fiscal Year" subtitle="Create fiscal years and monthly accounting periods." icon={<FiCalendar className="h-6 w-6" />} />
      <form onSubmit={save} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5"><Field title="Period Key"><input className={input} value={form.periodKey} onChange={(e) => setForm((p) => ({ ...p, periodKey: e.target.value }))} placeholder="2026-07" required /></Field><Field title="Fiscal Year"><input className={input} value={form.fiscalYear} onChange={(e) => setForm((p) => ({ ...p, fiscalYear: e.target.value }))} /></Field><Field title="Name"><input className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="July 2026" /></Field><Field title="Start"><input className={input} type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></Field><Field title="End"><input className={input} type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></Field></div>
        <div className="mt-4 flex justify-end"><button className={cn(btn, btnPrimary)} type="submit"><FiSave /> Save Period</button></div>
      </form>
      <PeriodTable rows={periods.data?.periods || []} reload={periods.reload} />
    </>
  )
}

function PeriodClosingView() {
  const periods = useFinanceData("/accounting/periods?limit=60", [])
  return <><SectionHeader title="Period Closing" subtitle="Close and reopen accounting periods to control posting." icon={<FiLock className="h-6 w-6" />} /><PeriodTable rows={periods.data?.periods || []} reload={periods.reload} /></>
}

function PeriodTable({ rows, reload }) {
  const close = async (key) => { try { await api(`/accounting/periods/${encodeURIComponent(key)}/close`, { method: "PATCH", body: JSON.stringify({}) }); toast.success("Period closed"); reload?.() } catch (err) { toast.error(err.message) } }
  const reopen = async (key) => { try { await api(`/accounting/periods/${encodeURIComponent(key)}/reopen`, { method: "PATCH", body: JSON.stringify({}) }); toast.success("Period reopened"); reload?.() } catch (err) { toast.error(err.message) } }
  if (!rows.length) return <EmptyState title="No fiscal periods" />
  return <TableShell><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Period", "Fiscal Year", "Start", "End", "Status", "Actions"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((r) => <tr key={r._id}><td className="px-5 py-4 text-sm font-black">{r.periodKey}</td><td className="px-5 py-4 text-sm font-bold">{r.fiscalYear}</td><td className="px-5 py-4 text-sm font-bold">{dateText(r.startDate)}</td><td className="px-5 py-4 text-sm font-bold">{dateText(r.endDate)}</td><td className="px-5 py-4"><Badge value={r.status} /></td><td className="px-5 py-4"><div className="flex gap-2">{r.status === "open" ? <button className={cn(btn, btnDanger, "px-3 py-2")} onClick={() => close(r.periodKey)}><FiLock /> Close</button> : <button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => reopen(r.periodKey)}><FiUnlock /> Reopen</button>}</div></td></tr>)}</tbody></table></TableShell>
}

function ApprovalRulesView() {
  return <><SectionHeader title="Approval Rules" subtitle="Finance approval policy design surface." icon={<FiShield className="h-6 w-6" />} /><div className={`${card} p-5`}><div className="grid grid-cols-1 gap-4 md:grid-cols-3"><InfoTile title="Vendor Bills" text="Draft bills can require approval before payment." /><InfoTile title="Expenses" text="Pending expenses are treated as commitments until approved." /><InfoTile title="Journals" text="Draft journals can be reviewed before posting." /></div></div></>
}

function AuditTrailView() {
  return <JournalSourceView title="Audit Trail" subtitle="Accounting posting history from journal activity." icon={<FiActivity className="h-6 w-6" />} sourceType="" />
}

function ReportList({ title, subtitle, icon, rows }) {
  return <><SectionHeader title={title} subtitle={subtitle} icon={icon} /> <SimpleRows title={title} rows={rows} /></>
}

function SimpleRows({ title, rows }) {
  return (
    <div className={`${card} p-5`}>
      <h3 className="text-base font-black text-gray-950">{title}</h3>
      <div className="mt-4 divide-y divide-gray-100">
        {rows.length ? rows.map((row, index) => <div key={`${row[0]}-${index}`} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-3"><span className="text-sm font-black text-gray-900">{row[0]}</span><span className="text-sm font-bold text-gray-700">{row[1]}</span><span className="text-sm font-semibold text-gray-500">{row[2]}</span></div>) : <p className="py-6 text-sm font-semibold text-gray-500">No rows found.</p>}
      </div>
    </div>
  )
}

function InfoTile({ title, text }) {
  return <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><p className="text-sm font-black text-gray-900">{title}</p><p className="mt-2 text-sm font-semibold text-gray-500">{text}</p></div>
}

export default function AccountingModules() {
  const [active, setActive] = useState("dashboard")
  const [filters, setFilters] = useState({ from: monthStart(), to: today() })
  const view = useMemo(() => {
    const props = { filters, setFilters }
    const map = {
      dashboard: <DashboardView {...props} />,
      "deals-income": <DealsIncomeView {...props} />,
      invoices: <InvoicesView />,
      "customer-payments": <CustomerPaymentsView />,
      receivables: <ReceivablesView {...props} />,
      expenses: <ExpensesView {...props} />,
      "vendor-bills": <VendorBillsView />,
      "vendor-payments": <VendorPaymentsView />,
      payables: <PayablesView {...props} />,
      "profit-loss": <ProfitLossView {...props} />,
      "receivable-aging": <AgingView type="receivable" {...props} />,
      "payable-aging": <AgingView type="payable" {...props} />,
      "vat-setup": <VatSetupView />,
      "input-vat": <InputVatView />,
      "output-vat": <OutputVatView />,
      "tax-reports": <TaxReportsView {...props} />,
      "fiscal-year": <FiscalYearView />,
      "period-closing": <PeriodClosingView />,
      "approval-rules": <ApprovalRulesView />,
      "audit-trail": <AuditTrailView />,
    }
    return map[active] || map.dashboard
  }, [active, filters])

  return (
    <div className={shell}>
      <Toaster position="top-right" />
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Finance / Accounting</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-950">{VIEW_LABELS[active] || "Dashboard"}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-2 text-sm font-bold text-gray-500 shadow-sm">
            <FiFilter className="text-indigo-600" />
            {dateText(filters.from)} - {dateText(filters.to)}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
          <FinanceNav active={active} setActive={setActive} />
          <main className="min-w-0">{view}</main>
        </div>
      </div>
    </div>
  )
}
