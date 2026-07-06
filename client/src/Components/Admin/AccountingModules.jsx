"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiAlertCircle,
  FiBarChart2,
  FiBriefcase,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiFilter,
  FiRefreshCcw,
  FiSearch,
  FiTrendingDown,
  FiTrendingUp,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
const ghostButton = `${button} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const ROW_LIMIT = 30

const MODULES = {
  receivables: {
    label: "Receivable",
    title: "Accounts Receivable",
    endpoint: "/accounting/receivables",
    icon: FiTrendingUp,
  },
  payables: {
    label: "Payable",
    title: "Accounts Payable",
    endpoint: "/accounting/payables",
    icon: FiCreditCard,
  },
  profitLoss: {
    label: "Profit & Loss",
    title: "Profit & Loss",
    endpoint: "/accounting/profit-loss",
    icon: FiBarChart2,
  },
}

function getAuthHeaders() {
  const token = localStorage.getItem("token")

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) throw new Error(data?.message || data?.error || "Request failed")

  return data
}

function toDateInput(value = new Date()) {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function startOfMonth() {
  const date = new Date()
  date.setDate(1)
  return toDateInput(date)
}

function formatMoney(value, currency = "BDT") {
  const amount = Number(value || 0)

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "BDT",
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency || "BDT"} ${amount.toLocaleString()}`
  }
}

function formatDate(value) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function Badge({ value }) {
  const key = String(value || "").toLowerCase()

  const styles = {
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    approved: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    pending: "bg-amber-50 text-amber-800 ring-amber-600/10",
    rejected: "bg-rose-50 text-rose-700 ring-rose-600/10",
    overdue: "bg-rose-50 text-rose-700 ring-rose-600/10",
    unbilled: "bg-sky-50 text-sky-700 ring-sky-600/10",
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
        styles[key] || "bg-gray-100 text-gray-700 ring-gray-600/10"
      }`}
    >
      {pretty(value)}
    </span>
  )
}

function Metric({ label, value, icon, tone = "bg-indigo-50 text-indigo-700" }) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-gray-950">{value}</p>
        </div>

        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      </div>
    </div>
  )
}

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

function exportRows(filename, rows = []) {
  if (!rows.length) return toast.error("No rows to export.")

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? "")).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

function AccountingTabBar({ tab, onChange }) {
  return (
    <div className={`${card} mb-6 overflow-x-auto px-2 py-2`}>
      <div className="flex min-w-max items-center gap-2">
        {Object.entries(MODULES).map(([key, item]) => {
          const active = tab === key
          const TabIcon = item.icon

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FilterChip({ label, value, onRemove }) {
  return (
    <button
      type="button"
      className="inline-flex max-w-[180px] items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10 transition hover:bg-indigo-100"
      onClick={onRemove}
      title="Remove filter"
    >
      <span className="truncate">
        <span className="text-indigo-500">{label}:</span> {value}
      </span>
      <FiX className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}

function LoadMorePanel({ pageInfo, loadingMore, onLoadMore }) {
  if (!pageInfo?.hasNextPage) return null

  return (
    <div className="flex justify-center pt-1">
      <button type="button" className={ghostButton} onClick={onLoadMore} disabled={loadingMore}>
        <FiRefreshCcw className={loadingMore ? "animate-spin" : ""} />
        {loadingMore ? "Loading..." : "Load more"}
      </button>
    </div>
  )
}

function ReceivableView({ data, loadingMore, onLoadMore }) {
  const summary = data?.summary || {}
  const rows = data?.rows || []

  const exportData = rows.map((row) => ({
    dealNo: row.dealNo,
    deal: row.title,
    client: row.customer?.companyName || row.customer?.name || "",
    dealValue: row.grandTotal,
    invoiced: row.invoicedAmount,
    collected: row.paidAmount,
    invoiceDue: row.invoiceDueAmount,
    unbilled: row.unbilledAmount,
    receivable: row.receivableAmount,
    overdue: row.isOverdue ? "Yes" : "No",
  }))

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Total Receivable"
          value={formatMoney(summary.receivableAmount)}
          icon={<FiDollarSign />}
          tone="bg-rose-50 text-rose-700"
        />

        <Metric
          label="Collected"
          value={formatMoney(summary.paidAmount)}
          icon={<FiTrendingUp />}
          tone="bg-emerald-50 text-emerald-700"
        />

        <Metric
          label="Unbilled"
          value={formatMoney(summary.unbilledAmount)}
          icon={<FiBriefcase />}
          tone="bg-sky-50 text-sky-700"
        />

        <Metric
          label="Overdue"
          value={formatMoney(summary.overdueAmount)}
          icon={<FiAlertCircle />}
          tone="bg-amber-50 text-amber-800"
        />
      </div>

      <AccountingTable
        title="Receivable Aging"
        action={
          <button className={ghostButton} onClick={() => exportRows("receivables.csv", exportData)} type="button">
            <FiDownload />
            Export CSV
          </button>
        }
        columns={["Deal", "Client", "Won", "Value", "Invoiced", "Collected", "Due", "Unbilled", "Status"]}
        rows={rows.map((row) => [
          <div key="deal">
            <p className="font-bold text-gray-950">{row.title}</p>
            <p className="text-xs text-gray-500">{row.dealNo}</p>
          </div>,
          row.customer?.companyName || row.customer?.name || "-",
          formatDate(row.wonAt || row.accountingDate),
          formatMoney(row.grandTotal, row.currency),
          formatMoney(row.invoicedAmount, row.currency),
          <span key="paid" className="font-bold text-emerald-700">
            {formatMoney(row.paidAmount, row.currency)}
          </span>,
          <span
            key="due"
            className={Number(row.invoiceDueAmount || 0) > 0 ? "font-bold text-rose-700" : "font-bold text-emerald-700"}
          >
            {formatMoney(row.invoiceDueAmount, row.currency)}
          </span>,
          formatMoney(row.unbilledAmount, row.currency),
          row.isOverdue ? (
            <Badge key="overdue" value="overdue" />
          ) : Number(row.unbilledAmount || 0) > 0 ? (
            <Badge key="unbilled" value="unbilled" />
          ) : (
            <Badge key="current" value="current" />
          ),
        ])}
      />

      <LoadMorePanel pageInfo={data?.pageInfo} loadingMore={loadingMore} onLoadMore={onLoadMore} />
    </>
  )
}

function PayableView({ data, loadingMore, onLoadMore }) {
  const summary = data?.summary || {}
  const rows = data?.rows || []

  const exportData = rows.map((row) => ({
    expense: row.title,
    vendor: row.payeeVendor,
    category: row.category?.name,
    date: row.expenseDate,
    amount: row.amount,
    status: row.status,
    method: row.paymentMethod,
    bill: row.invoiceBillNo,
  }))

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Outstanding"
          value={formatMoney(summary.payableAmount)}
          icon={<FiCreditCard />}
          tone="bg-rose-50 text-rose-700"
        />

        <Metric
          label="Approved"
          value={formatMoney(summary.approvedAmount)}
          icon={<FiDollarSign />}
          tone="bg-indigo-50 text-indigo-700"
        />

        <Metric
          label="Pending"
          value={formatMoney(summary.pendingAmount)}
          icon={<FiAlertCircle />}
          tone="bg-amber-50 text-amber-800"
        />

        <Metric
          label="Paid"
          value={formatMoney(summary.paidAmount)}
          icon={<FiTrendingDown />}
          tone="bg-emerald-50 text-emerald-700"
        />
      </div>

      {data?.vendorSummary?.length ? (
        <div className={`${card} p-5`}>
          <h3 className="text-base font-black text-gray-950">Open Vendors</h3>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {data.vendorSummary.map((item) => (
              <div key={item.vendor} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="truncate text-sm font-bold text-gray-900">{item.vendor}</p>
                <p className="mt-1 text-lg font-black text-gray-950">{formatMoney(item.amount)}</p>
                <p className="text-xs font-semibold text-gray-500">
                  {item.count} item{item.count === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <AccountingTable
        title="Payable Register"
        action={
          <button className={ghostButton} onClick={() => exportRows("payables.csv", exportData)} type="button">
            <FiDownload />
            Export CSV
          </button>
        }
        columns={["Expense", "Vendor", "Category", "Date", "Amount", "Method", "Bill", "Status"]}
        rows={rows.map((row) => [
          <div key="expense">
            <p className="font-bold text-gray-950">{row.title}</p>
            <p className="text-xs text-gray-500">{row.referenceNo || row.branch || "-"}</p>
          </div>,
          row.payeeVendor || "-",
          row.category?.name || "-",
          formatDate(row.expenseDate),
          formatMoney(row.amount),
          pretty(row.paymentMethod),
          row.invoiceBillNo || "-",
          <Badge key="status" value={row.status} />,
        ])}
      />

      <LoadMorePanel pageInfo={data?.pageInfo} loadingMore={loadingMore} onLoadMore={onLoadMore} />
    </>
  )
}

function ProfitLossView({ data }) {
  const summary = data?.summary || {}
  const positive = Number(summary.netProfit || 0) >= 0

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Revenue"
          value={formatMoney(summary.revenue)}
          icon={<FiTrendingUp />}
          tone="bg-emerald-50 text-emerald-700"
        />

        <Metric
          label="Expenses"
          value={formatMoney(summary.operatingExpenses)}
          icon={<FiTrendingDown />}
          tone="bg-rose-50 text-rose-700"
        />

        <Metric
          label="Net Profit"
          value={formatMoney(summary.netProfit)}
          icon={<FiBarChart2 />}
          tone={positive ? "bg-indigo-50 text-indigo-700" : "bg-rose-50 text-rose-700"}
        />

        <Metric
          label="Cash Collected"
          value={formatMoney(summary.cashCollected)}
          icon={<FiDollarSign />}
          tone="bg-sky-50 text-sky-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <StatementCard
          title="Income Statement"
          rows={[
            ["Revenue", summary.revenue, "add"],
            ["Cost of goods sold", summary.costOfGoodsSold, "less"],
            ["Gross profit", summary.grossProfit, "total"],
            ["Operating expenses", summary.operatingExpenses, "less"],
            ["Net profit", summary.netProfit, positive ? "final" : "loss"],
          ]}
        />

        <div className={`${card} p-5`}>
          <h3 className="text-base font-black text-gray-950">Expense Categories</h3>

          <div className="mt-4 space-y-3">
            {(data?.expensesByCategory || []).length ? (
              data.expensesByCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{item.category}</p>
                    <p className="text-xs font-semibold text-gray-500">
                      {item.count} record{item.count === 1 ? "" : "s"}
                    </p>
                  </div>

                  <p className="font-black text-gray-950">{formatMoney(item.amount)}</p>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm font-semibold text-gray-500">
                No expenses found.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function StatementCard({ title, rows }) {
  return (
    <div className={`${card} p-5`}>
      <h3 className="text-base font-black text-gray-950">{title}</h3>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100">
        {rows.map(([label, value, type]) => (
          <div
            key={label}
            className={`flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0 ${
              ["total", "final", "loss"].includes(type) ? "bg-gray-50" : "bg-white"
            }`}
          >
            <p
              className={`text-sm ${
                ["total", "final", "loss"].includes(type) ? "font-black text-gray-950" : "font-bold text-gray-700"
              }`}
            >
              {label}
            </p>

            <p
              className={`text-sm font-black ${
                type === "less" || type === "loss"
                  ? "text-rose-700"
                  : type === "final"
                    ? "text-emerald-700"
                    : "text-gray-950"
              }`}
            >
              {type === "less" ? `(${formatMoney(value)})` : formatMoney(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccountingTable({ title, action, columns, rows }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-black text-gray-950">{title}</h3>
        {action}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-5 py-3 text-xs font-black uppercase text-gray-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-indigo-50/30">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="whitespace-nowrap px-5 py-3 text-sm font-semibold text-gray-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-sm font-bold text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function AccountingModules({ initialTab = "receivables" }) {
  const safeInitialTab = MODULES[initialTab] ? initialTab : "receivables"

  const [tab, setTab] = useState(safeInitialTab)
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(toDateInput(new Date()))
  const [search, setSearch] = useState("")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const abortRef = useRef(null)

  const debouncedSearch = useDebounced(search)
  const active = MODULES[tab]
  const ActiveIcon = active.icon

  useEffect(() => {
    if (MODULES[initialTab]) setTab(initialTab)
  }, [initialTab])

  const query = useMemo(() => {
    const params = new URLSearchParams()

    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (debouncedSearch && tab !== "profitLoss") params.set("q", debouncedSearch)

    params.set("limit", String(ROW_LIMIT))

    return params.toString()
  }, [from, to, debouncedSearch, tab])

  const load = useCallback(async ({ append = false, cursor = "" } = {}) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    append ? setLoadingMore(true) : setLoading(true)
    if (!append) setError("")

    try {
      const cursorQuery = cursor ? `${query}&cursor=${encodeURIComponent(cursor)}` : query
      const next = await apiJson(`${active.endpoint}?${cursorQuery}`, { signal: controller.signal })
      setData((previous) => {
        if (!append) return next
        return {
          ...next,
          rows: [...(previous?.rows || []), ...(next?.rows || [])],
          summary: next?.summary || previous?.summary,
          vendorSummary: next?.vendorSummary || previous?.vendorSummary,
          expensesByCategory: next?.expensesByCategory || previous?.expensesByCategory,
          revenueByCurrency: next?.revenueByCurrency || previous?.revenueByCurrency,
        }
      })
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError(err.message)
        if (!append) setData(null)
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [active.endpoint, query])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  useEffect(() => {
    if (tab === "profitLoss") setSearch("")
  }, [tab])

  const activeFilters = useMemo(() => {
    const list = []

    if (from) list.push({ key: "from", label: "From", value: formatDate(from) })
    if (to) list.push({ key: "to", label: "To", value: formatDate(to) })
    if (search.trim() && tab !== "profitLoss") list.push({ key: "search", label: "Search", value: search.trim() })

    return list
  }, [from, search, tab, to])

  const hasClearableFilters = useMemo(() => {
    return Boolean(from || to || search.trim())
  }, [from, search, to])

  const clearSingleFilter = (key) => {
    if (key === "from") setFrom("")
    if (key === "to") setTo("")
    if (key === "search") setSearch("")
  }

  const clearAllFilters = () => {
    setFrom("")
    setTo("")
    setSearch("")
  }

  const resetDefaultPeriod = () => {
    setFrom(startOfMonth())
    setTo(toDateInput(new Date()))
    setSearch("")
  }

  const loadMore = () => {
    const nextCursor = data?.pageInfo?.nextCursor
    if (!nextCursor || loadingMore) return
    load({ append: true, cursor: nextCursor })
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <div className="mx-auto max-w-[1550px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <ActiveIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">{active.title}</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={ghostButton} onClick={load} disabled={loading} type="button">
                <FiRefreshCcw className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="w-full max-w-5xl">
              <div className="flex min-h-[46px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
                <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />

                {activeFilters.map((filter) => (
                  <FilterChip
                    key={filter.key}
                    label={filter.label}
                    value={filter.value}
                    onRemove={() => clearSingleFilter(filter.key)}
                  />
                ))}

                <input
                  className="min-w-[170px] flex-1 border-0 bg-transparent px-1 py-2 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-gray-400"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={tab === "profitLoss" ? "Search disabled" : "Search deal, vendor, bill..."}
                  disabled={tab === "profitLoss"}
                  type="text"
                />

                <button
                  type="button"
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-extrabold transition ${
                    activeFilters.length
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                  }`}
                  onClick={resetDefaultPeriod}
                  title="Reset default period"
                >
                  <FiFilter className="h-4 w-4" />
                  Filters
                  {activeFilters.length ? <span className="rounded-full bg-white/20 px-1.5 text-xs">{activeFilters.length}</span> : null}
                </button>

                {hasClearableFilters ? (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                    onClick={clearAllFilters}
                    title="Clear all filters"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <AccountingTabBar tab={tab} onChange={setTab} />

        {error ? (
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className={`${card} flex items-center justify-center p-16 text-sm font-bold text-gray-500`}>
            <FiRefreshCcw className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
            Loading...
          </div>
        ) : null}

        <div className="space-y-5">
          {!loading && !error && tab === "receivables" ? <ReceivableView data={data} loadingMore={loadingMore} onLoadMore={loadMore} /> : null}
          {!loading && !error && tab === "payables" ? <PayableView data={data} loadingMore={loadingMore} onLoadMore={loadMore} /> : null}
          {!loading && !error && tab === "profitLoss" ? <ProfitLossView data={data} /> : null}
        </div>
      </div>
    </div>
  )
}
