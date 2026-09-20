"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Calendar03Icon,
  Cancel01Icon,
  FilterIcon,
  FolderLibraryIcon,
  RefreshIcon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const ENDPOINT = "/purchase/workflow/reports"

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const primaryButton =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"
const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatNumber(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function formatMoney(value, currency = "") {
  const amount = formatNumber(value, 2)
  return currency ? `${currency} ${amount}` : amount
}

function defaultDates() {
  const to = new Date()
  const from = new Date(to.getTime() - 365 * 86400000)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

async function api(path) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed")
  }
  return data
}

function Icon({
  icon,
  className = "h-4 w-4",
  strokeWidth = 1.8,
  ...props
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}

function Spinner({ className = "h-4 w-4" }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-current border-r-transparent animate-spin",
        className
      )}
      aria-hidden="true"
    />
  )
}

function Skeleton({ className = "" }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-gray-200/80", className)}
      aria-hidden="true"
    />
  )
}

function StatusBadge({ value }) {
  const status = clean(value).toLowerCase()
  const styles = {
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    partial: "bg-amber-50 text-amber-700 ring-amber-200",
    partially_paid: "bg-amber-50 text-amber-700 ring-amber-200",
    unpaid: "bg-rose-50 text-rose-700 ring-rose-200",
    due: "bg-rose-50 text-rose-700 ring-rose-200",
  }
  const dot = ["paid", "completed"].includes(status)
    ? "bg-emerald-500"
    : ["partial", "partially_paid"].includes(status)
      ? "bg-amber-500"
      : "bg-rose-500"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1",
        styles[status] || "bg-slate-100 text-slate-700 ring-slate-200"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {pretty(value)}
    </span>
  )
}

function FocusPlaceholderInput({
  placeholder = "",
  onFocus,
  onBlur,
  ...props
}) {
  const [focused, setFocused] = useState(false)

  return (
    <input
      {...props}
      placeholder={focused ? placeholder : ""}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
    />
  )
}

function MetricCard({ label, value, description, loading, tone = "text-gray-950" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(card, "p-4 sm:p-5")}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
        {label}
      </p>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className={cn("mt-2 text-2xl font-black tracking-tight sm:text-3xl", tone)}>
          {value}
        </p>
      )}

      {description ? (
        <p className="mt-1 text-xs font-medium leading-5 text-gray-500">
          {description}
        </p>
      ) : null}
    </motion.div>
  )
}

export default function PurchaseReportsPage() {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  const defaults = useMemo(() => defaultDates(), [])
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [supplier, setSupplier] = useState("all")
  const [purchaseType, setPurchaseType] = useState("all")
  const [paymentStatus, setPaymentStatus] = useState("all")
  const [supplierOptions, setSupplierOptions] = useState([])

  const load = useCallback(
    async ({ showToast = false, fromDate = from, toDate = to, sup = supplier, type = purchaseType, payStatus = paymentStatus } = {}) => {
      setLoading(true)
      setError("")

      try {
        const params = new URLSearchParams()
        if (fromDate) params.set("from", fromDate)
        if (toDate) params.set("to", toDate)
        if (sup && sup !== "all") params.set("supplier", sup)
        if (type && type !== "all") params.set("purchaseType", type)
        if (payStatus && payStatus !== "all") params.set("paymentStatus", payStatus)

        const result = await api(`${ENDPOINT}?${params.toString()}`)
        setData(result || {})

        if (Array.isArray(result?.suppliers)) {
          const map = new Map()
          result.suppliers.forEach((s) => {
            if (s.supplierId && !map.has(String(s.supplierId))) {
              map.set(String(s.supplierId), { id: String(s.supplierId), name: s.supplierName, code: s.supplierCode })
            }
          })
          setSupplierOptions((prev) => {
            const merged = new Map()
            prev.forEach((item) => merged.set(item.id, item))
            map.forEach((val, key) => merged.set(key, val))
            return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name))
          })
        }

        if (showToast) {
          toast.success("Purchase reports refreshed")
        }
      } catch (loadError) {
        const message = loadError?.message || "Unable to load purchase reports"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [from, to, supplier, purchaseType, paymentStatus]
  )

  useEffect(() => {
    // Initial fetch of active suppliers list for filter dropdown
    api("/suppliers?limit=200")
      .then((res) => {
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []
        setSupplierOptions(
          list
            .map((s) => ({ id: String(s._id), name: s.businessName || s.name || "Supplier", code: s.code || "" }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      })
      .catch(() => {})

    load()
  }, [load])

  const handleApplyFilters = () => {
    load({ showToast: true, fromDate: from, toDate: to, sup: supplier, type: purchaseType, payStatus: paymentStatus })
  }

  const handleResetFilters = () => {
    const d = defaultDates()
    setFrom(d.from)
    setTo(d.to)
    setSupplier("all")
    setPurchaseType("all")
    setPaymentStatus("all")
    load({ showToast: true, fromDate: d.from, toDate: d.to, sup: "all", type: "all", payStatus: "all" })
  }

  const monthly = Array.isArray(data.monthly) ? data.monthly : []
  const suppliers = Array.isArray(data.suppliers) ? data.suppliers : []
  const products = Array.isArray(data.products) ? data.products : []
  const payment = Array.isArray(data.payment) ? data.payment : []
  const summary = data.summary || {}

  const filteredMonthly = useMemo(() => {
    const s = clean(query).toLowerCase()
    if (!s) return monthly
    return monthly.filter((m) => String(m.month || "").toLowerCase().includes(s))
  }, [monthly, query])

  const filteredSuppliers = useMemo(() => {
    const s = clean(query).toLowerCase()
    if (!s) return suppliers
    return suppliers.filter((item) =>
      [item.supplierName, item.supplierCode].filter(Boolean).join(" ").toLowerCase().includes(s)
    )
  }, [suppliers, query])

  const filteredProducts = useMemo(() => {
    const s = clean(query).toLowerCase()
    if (!s) return products
    return products.filter((item) =>
      [item.productName, item.sku].filter(Boolean).join(" ").toLowerCase().includes(s)
    )
  }, [products, query])

  const filteredPayment = useMemo(() => {
    const s = clean(query).toLowerCase()
    if (!s) return payment
    return payment.filter((item) => String(item.paymentStatus || "").toLowerCase().includes(s))
  }, [payment, query])

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: "14px", fontWeight: 700 },
        }}
      />

      <section className={cn(card, "mb-5 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Purchase Reports
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Procurement performance, supplier, product and payment status analytics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={() => load({ showToast: true })}
              disabled={loading}
            >
              {loading ? <Spinner /> : <Icon icon={RefreshIcon} className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Icon icon={Calendar03Icon} className="h-3.5 w-3.5 text-gray-400" />
                From Date
              </label>
              <input
                type="date"
                className={input}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Icon icon={Calendar03Icon} className="h-3.5 w-3.5 text-gray-400" />
                To Date
              </label>
              <input
                type="date"
                className={input}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Supplier</label>
              <select
                className={input}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              >
                <option value="all">All Suppliers</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Purchase Type</label>
              <select
                className={input}
                value={purchaseType}
                onChange={(e) => setPurchaseType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="local">Local Purchase</option>
                <option value="foreign">Foreign / Import</option>
                <option value="quick_purchase">Quick Purchase</option>
                <option value="industrial_purchase">Industrial Purchase</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Payment Status</label>
              <select
                className={input}
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-200/60">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(button, primaryButton, "h-9 px-4 text-xs")}
                onClick={handleApplyFilters}
                disabled={loading}
              >
                <Icon icon={FilterIcon} className="h-3.5 w-3.5" />
                Apply Filters
              </button>
              <button
                type="button"
                className={cn(button, ghostButton, "h-9 px-3 text-xs")}
                onClick={handleResetFilters}
                disabled={loading}
              >
                Reset
              </button>
            </div>

            {/* Quick in-table search */}
            <div className="w-full sm:max-w-xs">
              <div className="flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <Icon icon={Search01Icon} className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <FocusPlaceholderInput
                  className="h-full w-full border-0 bg-transparent text-xs font-semibold text-gray-800 outline-none ring-0 placeholder:text-gray-400"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter table rows..."
                  type="search"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    <Icon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Icon icon={Alert02Icon} className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-bold text-rose-800">Could not load purchase reports</p>
              <p className="mt-0.5 text-sm font-medium text-rose-700">{error}</p>
            </div>
          </div>

          <button
            type="button"
            className={cn(button, "bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100")}
            onClick={() => load()}
          >
            Try Again
          </button>
        </motion.div>
      ) : null}

      {/* Summary Financial Metric Cards */}
      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Total Spend"
          value={formatMoney(summary.totalSpend || 0)}
          description="Gross procurement spend"
          loading={loading}
          tone="text-indigo-950"
        />
        <MetricCard
          label="Total Orders"
          value={formatNumber(summary.totalOrders || 0, 0)}
          description="Completed orders placed"
          loading={loading}
          tone="text-gray-900"
        />
        <MetricCard
          label="Total Paid"
          value={formatMoney(summary.totalPaid || 0)}
          description="Settled with suppliers"
          loading={loading}
          tone="text-emerald-700"
        />
        <MetricCard
          label="Outstanding Due"
          value={formatMoney(summary.totalDue || 0)}
          description="Remaining payable balance"
          loading={loading}
          tone="text-rose-700"
        />
      </section>

      {/* Section 1: Monthly Performance */}
      <div className="space-y-5">
        <section className={cn(card, "overflow-hidden rounded-3xl")}>
          <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-black text-gray-900">Monthly Procurement Performance</h2>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                Monthly trend of total purchase spend and order volume.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
              {loading ? "Loading" : `${filteredMonthly.length} months`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/95 text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Month</th>
                  <th className="px-5 py-3.5">Total Spend</th>
                  <th className="px-5 py-3.5">Purchase Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-semibold">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                    </tr>
                  ))
                ) : filteredMonthly.length ? (
                  filteredMonthly.map((m, idx) => (
                    <tr key={m.month || idx} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4 font-bold text-gray-900">{m.month || "-"}</td>
                      <td className="px-5 py-4 font-black text-indigo-900">{formatMoney(m.amount)}</td>
                      <td className="px-5 py-4 text-gray-700">{formatNumber(m.orders, 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm font-semibold text-gray-400">
                      No monthly procurement records for selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 2: Supplier Performance */}
        <section className={cn(card, "overflow-hidden rounded-3xl")}>
          <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-black text-gray-900">Supplier Procurement Performance</h2>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                Supplier spend volume, order frequency, and account summaries.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
              {loading ? "Loading" : `${filteredSuppliers.length} suppliers`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/95 text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Supplier Name</th>
                  <th className="px-5 py-3.5">Supplier Code</th>
                  <th className="px-5 py-3.5">Total Spend</th>
                  <th className="px-5 py-3.5">Orders Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-semibold">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                    </tr>
                  ))
                ) : filteredSuppliers.length ? (
                  filteredSuppliers.map((s, idx) => (
                    <tr key={s.supplierId || idx} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4 font-bold text-gray-900">{s.supplierName || "Unknown Supplier"}</td>
                      <td className="px-5 py-4 text-gray-500 font-mono text-xs">{s.supplierCode || "-"}</td>
                      <td className="px-5 py-4 font-black text-indigo-900">{formatMoney(s.amount)}</td>
                      <td className="px-5 py-4 text-gray-700">{formatNumber(s.orders, 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm font-semibold text-gray-400">
                      No supplier data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Product Performance */}
        <section className={cn(card, "overflow-hidden rounded-3xl")}>
          <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-black text-gray-900">Product Procurement Analytics</h2>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                Purchased quantities and financial spend aggregated by product line.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
              {loading ? "Loading" : `${filteredProducts.length} products`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/95 text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Product Name</th>
                  <th className="px-5 py-3.5">SKU</th>
                  <th className="px-5 py-3.5">Total Quantity</th>
                  <th className="px-5 py-3.5">Total Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-semibold">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-44" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                    </tr>
                  ))
                ) : filteredProducts.length ? (
                  filteredProducts.map((p, idx) => (
                    <tr key={p.productId || idx} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4 font-bold text-gray-900">{p.productName || "Unknown Product"}</td>
                      <td className="px-5 py-4 text-gray-500 font-mono text-xs">{p.sku || "-"}</td>
                      <td className="px-5 py-4 text-gray-800">{formatNumber(p.quantity)}</td>
                      <td className="px-5 py-4 font-black text-indigo-900">{formatMoney(p.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm font-semibold text-gray-400">
                      No product records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Payment Status Reporting */}
        <section className={cn(card, "overflow-hidden rounded-3xl")}>
          <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-5">
            <div>
              <h2 className="text-base font-black text-gray-900">Payment & Settlement Status</h2>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                Breakdown of purchase commitments by payment status, paid amounts and remaining dues.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
              {loading ? "Loading" : `${filteredPayment.length} states`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/95 text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5">Payment Status</th>
                  <th className="px-5 py-3.5">Total Value</th>
                  <th className="px-5 py-3.5">Paid Amount</th>
                  <th className="px-5 py-3.5">Outstanding Due</th>
                  <th className="px-5 py-3.5">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-semibold">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
                    </tr>
                  ))
                ) : filteredPayment.length ? (
                  filteredPayment.map((pay, idx) => (
                    <tr key={pay.paymentStatus || idx} className="hover:bg-gray-50/70 transition">
                      <td className="px-5 py-4">
                        <StatusBadge value={pay.paymentStatus} />
                      </td>
                      <td className="px-5 py-4 font-black text-gray-950">{formatMoney(pay.amount)}</td>
                      <td className="px-5 py-4 font-bold text-emerald-700">{formatMoney(pay.paid)}</td>
                      <td className="px-5 py-4 font-black text-rose-700">{formatMoney(pay.due)}</td>
                      <td className="px-5 py-4 text-gray-700">{formatNumber(pay.orders, 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm font-semibold text-gray-400">
                      No payment data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
