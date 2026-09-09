"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Cancel01Icon,
  ChartLineData01Icon,
  DashboardSquare01Icon,
  Download01Icon,
  FilterIcon,
  Layers01Icon,
  Package01Icon,
  RefreshIcon,
  Search01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const COST_VIEW_PERMISSION = "inventory-report:cost-view"

const CARD =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"
const PANEL =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_42px_-24px_rgba(0,0,0,0.28)]"
const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const PRIMARY_BUTTON =
  "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const GHOST_BUTTON =
  "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const INPUT =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function numeric(value) {
  return Number(value || 0)
}

function number(value, digits = 2) {
  return numeric(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })
}

function money(value, canViewCost = true) {
  if (!canViewCost || value === null || value === undefined) return "—"
  return `BDT ${numeric(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function prettyCostingMethod(method) {
  const norm = String(method || "").toLowerCase()
  if (norm === "fifo") return "FIFO"
  if (norm === "standard") return "Standard Cost"
  if (norm === "weighted_average") return "Weighted Avg"
  return "Weighted Avg"
}

function costingBadgeStyle(method) {
  const norm = String(method || "").toLowerCase()
  if (norm === "fifo") {
    return "bg-cyan-50 text-cyan-700 ring-cyan-600/20"
  }
  if (norm === "standard") {
    return "bg-amber-50 text-amber-700 ring-amber-600/20"
  }
  return "bg-indigo-50 text-indigo-700 ring-indigo-600/20"
}

async function api(path) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Unable to complete inventory request."
    )
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

function Skeleton({ className = "" }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gray-100",
        className
      )}
    />
  )
}

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-2xl",
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn(
              "relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl",
              maxWidthClass
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 p-4 sm:p-5">
              <div>
                <h3 className="text-lg font-black text-gray-900">{title}</h3>
                {subtitle ? (
                  <p className="mt-0.5 text-xs font-semibold text-gray-500">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close modal"
              >
                <Icon icon={Cancel01Icon} className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4 sm:p-6">
              {children}
            </div>
          </motion.div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function InventoryValuation() {
  const [currentUser, setCurrentUser] = useState(null)
  const [valuationData, setValuationData] = useState({
    items: [],
    summary: { totalQuantity: 0, totalValue: 0, count: 0 },
    total: 0,
    asOfDate: null,
    isHistorical: false,
  })
  const [warehouses, setWarehouses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")

  // Filters
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [costingMethodFilter, setCostingMethodFilter] = useState("all")
  const [asOfDate, setAsOfDate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 50

  // FIFO layer modal state
  const [fifoModalItem, setFifoModalItem] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user")
      if (raw) setCurrentUser(JSON.parse(raw))
    } catch {
      setCurrentUser(null)
    }
  }, [])

  const canViewCost = useMemo(() => {
    if (!currentUser) return false
    const role = String(currentUser?.role || "").toLowerCase()
    if (role === "admin" || role === "superadmin") return true
    return (
      hasPermission(currentUser, COST_VIEW_PERMISSION) ||
      (currentUser?.permissions || []).includes("*")
    )
  }, [currentUser])

  // Load auxiliary master data (warehouses, categories)
  useEffect(() => {
    let mounted = true
    async function loadAux() {
      try {
        const [whRes, catRes] = await Promise.all([
          api("/inventory/warehouses?limit=200").catch(() => ({ warehouses: [] })),
          api("/inventory/categories?limit=200").catch(() => ({ categories: [] })),
        ])
        if (mounted) {
          setWarehouses(whRes.warehouses || [])
          setCategories(catRes.categories || [])
        }
      } catch {
        // Soft fail on auxiliary filters
      }
    }
    loadAux()
    return () => {
      mounted = false
    }
  }, [])

  const buildQueryString = useCallback(
    (forExport = false) => {
      const params = new URLSearchParams()
      if (warehouseFilter !== "all") params.append("warehouse", warehouseFilter)
      if (categoryFilter !== "all") params.append("category", categoryFilter)
      if (costingMethodFilter !== "all")
        params.append("costingMethod", costingMethodFilter)
      if (asOfDate) params.append("asOfDate", asOfDate)
      if (clean(searchQuery)) params.append("q", clean(searchQuery))

      if (forExport) {
        params.append("format", "csv")
      } else {
        params.append("limit", String(pageSize))
        params.append("skip", String((page - 1) * pageSize))
      }
      return params.toString()
    },
    [
      warehouseFilter,
      categoryFilter,
      costingMethodFilter,
      asOfDate,
      searchQuery,
      page,
      pageSize,
    ]
  )

  const loadValuation = useCallback(
    async ({ showToast = false } = {}) => {
      setLoading(true)
      setError("")
      try {
        const qs = buildQueryString(false)
        const data = await api(`/inventory/reports/valuation?${qs}`)
        setValuationData(
          data || {
            items: [],
            summary: { totalQuantity: 0, totalValue: 0, count: 0 },
            total: 0,
            asOfDate: null,
            isHistorical: false,
          }
        )
        if (showToast) {
          toast.success("Valuation report refreshed")
        }
      } catch (err) {
        const msg = err.message || "Failed to load valuation report."
        setError(msg)
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    },
    [buildQueryString]
  )

  useEffect(() => {
    loadValuation()
  }, [loadValuation])

  // Reset page when filters change
  const handleFilterChange = (setter) => (val) => {
    setter(val)
    setPage(1)
  }

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const token = localStorage.getItem("token")
      const qs = buildQueryString(true)
      const res = await fetch(
        `${API_BASE}/inventory/reports/valuation?${qs}`,
        {
          credentials: "include",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      )

      if (!res.ok) {
        throw new Error("CSV export failed. Check your permissions.")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `inventory-valuation-${asOfDate || new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Valuation CSV downloaded")
    } catch (err) {
      toast.error(err.message || "Failed to export CSV.")
    } finally {
      setExporting(false)
    }
  }

  // Warehouse breakdown calculation
  const warehouseBreakdown = useMemo(() => {
    const map = new Map()
    const items = valuationData.items || []
    for (const item of items) {
      const whName = item.warehouse?.name || "Unassigned Warehouse"
      const current = map.get(whName) || {
        warehouseName: whName,
        totalQuantity: 0,
        totalValue: 0,
      }
      current.totalQuantity += numeric(
        item.valuationQuantity ?? item.quantity
      )
      current.totalValue += numeric(item.inventoryValue)
      map.set(whName, current)
    }
    const list = Array.from(map.values()).sort(
      (a, b) => b.totalValue - a.totalValue
    )
    const maxVal = Math.max(
      ...list.map((r) => r.totalValue),
      1
    )
    return { list, maxVal }
  }, [valuationData.items])

  const summary = valuationData.summary || {
    totalQuantity: 0,
    totalValue: 0,
    count: 0,
  }
  const totalItems = valuationData.total ?? valuationData.items?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Filter items locally by search query if backend returns full or for responsiveness
  const displayItems = useMemo(() => {
    const raw = valuationData.items || []
    if (!clean(searchQuery)) return raw
    const q = searchQuery.toLowerCase()
    return raw.filter((row) => {
      const name = (row.product?.name || row.key || "").toLowerCase()
      const sku = (row.product?.sku || "").toLowerCase()
      const barcode = (row.product?.barcode || "").toLowerCase()
      const wh = (row.warehouse?.name || "").toLowerCase()
      return (
        name.includes(q) ||
        sku.includes(q) ||
        barcode.includes(q) ||
        wh.includes(q)
      )
    })
  }, [valuationData.items, searchQuery])

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6 lg:p-8">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2600,
          style: {
            borderRadius: "14px",
            fontWeight: 700,
          },
        }}
      />

      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Header */}
        <header className={cn(PANEL, "p-5 sm:p-6")}>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-md" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  <Icon icon={ChartLineData01Icon} className="h-6 w-6" />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                    Inventory Valuation
                  </h1>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-600/10">
                    Financial Reporting
                  </span>
                  {valuationData.isHistorical ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 ring-1 ring-amber-600/20">
                      As Of: {formatDate(valuationData.asOfDate)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Stock valuation across warehouses, categories, costing methods, and historical snapshots.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting || loading}
                className={cn(BUTTON, GHOST_BUTTON)}
                title="Download report as CSV"
              >
                <Icon
                  icon={Download01Icon}
                  className={cn("h-4 w-4", exporting ? "animate-pulse" : "")}
                />
                {exporting ? "Exporting..." : "Export CSV"}
              </button>

              <button
                type="button"
                onClick={() => loadValuation({ showToast: true })}
                disabled={loading}
                className={cn(BUTTON, PRIMARY_BUTTON)}
              >
                <Icon
                  icon={RefreshIcon}
                  className={cn("h-4 w-4", loading ? "animate-spin" : "")}
                />
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>
        </header>

        {/* Error Alert */}
        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <Icon icon={Alert02Icon} className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Failed to load valuation data</p>
              <p className="mt-0.5 text-sm font-medium text-rose-600">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-100"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        ) : null}

        {/* Summary KPI Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={cn(CARD, "p-5")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Total Valuation
                </p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {loading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    money(summary.totalValue, canViewCost)
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  {canViewCost
                    ? "Authoritative inventory balance"
                    : "Cost view restricted"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10">
                <Icon icon={DashboardSquare01Icon} className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className={cn(CARD, "p-5")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Valued Units
                </p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {loading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    number(summary.totalQuantity)
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Total stock quantity on hand
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                <Icon icon={Package01Icon} className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className={cn(CARD, "p-5")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Valued Positions
                </p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    number(totalItems, 0)
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Distinct product-warehouse pairs
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/10">
                <Icon icon={Layers01Icon} className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className={cn(CARD, "p-5")}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Average Unit Cost
                </p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {loading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : summary.totalQuantity > 0 && canViewCost ? (
                    money(summary.totalValue / summary.totalQuantity, true)
                  ) : (
                    "—"
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Weighted average cost across portfolio
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-600/10">
                <Icon icon={ChartLineData01Icon} className="h-5 w-5" />
              </div>
            </div>
          </div>
        </section>

        {/* Filter Controls Bar */}
        <section className={cn(PANEL, "p-4 sm:p-5")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-500">
                <Icon icon={FilterIcon} className="h-4 w-4 text-indigo-600" />
                Report Filters
              </div>
              {(warehouseFilter !== "all" ||
                categoryFilter !== "all" ||
                costingMethodFilter !== "all" ||
                asOfDate ||
                searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setWarehouseFilter("all")
                    setCategoryFilter("all")
                    setCostingMethodFilter("all")
                    setAsOfDate("")
                    setSearchQuery("")
                    setPage(1)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700"
                >
                  <Icon icon={Cancel01Icon} className="h-3.5 w-3.5" />
                  Reset all filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Search */}
              <div className="relative">
                <label className="mb-1 block text-xs font-bold text-gray-600">
                  Search
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Product, SKU, barcode..."
                    className={cn(INPUT, "pl-9")}
                  />
                  <Icon
                    icon={Search01Icon}
                    className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                  />
                </div>
              </div>

              {/* Warehouse */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">
                  Warehouse
                </label>
                <select
                  value={warehouseFilter}
                  onChange={(e) =>
                    handleFilterChange(setWarehouseFilter)(e.target.value)
                  }
                  className={INPUT}
                >
                  <option value="all">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) =>
                    handleFilterChange(setCategoryFilter)(e.target.value)
                  }
                  className={INPUT}
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Costing Method */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">
                  Costing Method
                </label>
                <select
                  value={costingMethodFilter}
                  onChange={(e) =>
                    handleFilterChange(setCostingMethodFilter)(e.target.value)
                  }
                  className={INPUT}
                >
                  <option value="all">All Methods</option>
                  <option value="weighted_average">Weighted Average</option>
                  <option value="fifo">FIFO</option>
                  <option value="standard">Standard Cost</option>
                </select>
              </div>

              {/* As Of Date */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">
                  As-Of Date (Historical)
                </label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) =>
                    handleFilterChange(setAsOfDate)(e.target.value)
                  }
                  className={INPUT}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Warehouse Value Distribution (if cost visible) */}
        {canViewCost && warehouseBreakdown.list.length > 0 ? (
          <section className={cn(PANEL, "p-5")}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-gray-900">
                  Warehouse Value Distribution
                </h2>
                <p className="text-xs font-semibold text-gray-500">
                  Inventory value allocation across active storage sites
                </p>
              </div>
              <span className="text-xs font-bold text-gray-400">
                {warehouseBreakdown.list.length} warehouse(s)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {warehouseBreakdown.list.map((wh) => {
                const pct =
                  summary.totalValue > 0
                    ? (wh.totalValue / summary.totalValue) * 100
                    : 0
                return (
                  <div
                    key={wh.warehouseName}
                    className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="truncate text-gray-800">
                        {wh.warehouseName}
                      </span>
                      <span className="tabular-nums text-gray-950">
                        {money(wh.totalValue, true)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500"
                        style={{
                          width: `${Math.max(3, (wh.totalValue / warehouseBreakdown.maxVal) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-gray-400">
                      <span>{number(wh.totalQuantity)} units</span>
                      <span>{number(pct, 1)}% of total</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* Valuation Table */}
        <section className={cn(PANEL, "overflow-hidden")}>
          <div className="flex flex-col gap-2 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="text-base font-black text-gray-900">
                Valuation Line Items
              </h2>
              <p className="text-xs font-semibold text-gray-500">
                Detailed inventory balance and cost per unit for each position
              </p>
            </div>
            <div className="text-xs font-bold text-gray-500">
              Showing {displayItems.length} of {totalItems} items
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/90 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Warehouse</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5 text-right">Quantity</th>
                  <th className="px-5 py-3.5 text-right">Unit Cost</th>
                  <th className="px-5 py-3.5 text-right">Inventory Value</th>
                  <th className="px-5 py-3.5 text-center">Layers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="mt-1 h-3 w-20" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-5 py-4">
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Skeleton className="ml-auto h-4 w-24" />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Skeleton className="mx-auto h-6 w-12" />
                      </td>
                    </tr>
                  ))
                ) : displayItems.length ? (
                  displayItems.map((item, index) => {
                    const method =
                      item.costingMethod ||
                      item.product?.costingMethod ||
                      "weighted_average"
                    const qty = numeric(
                      item.valuationQuantity ?? item.quantity
                    )
                    const unitCost =
                      item.averageCost ??
                      item.unitCost ??
                      (item.inventoryValue != null && qty > 0
                        ? item.inventoryValue / qty
                        : null)
                    const totalVal = item.inventoryValue
                    const layers = Array.isArray(item.layers) ? item.layers : []

                    return (
                      <tr
                        key={item._id || item.key || index}
                        className="transition hover:bg-indigo-50/30"
                      >
                        <td className="px-5 py-4">
                          <p className="font-extrabold text-gray-900">
                            {item.product?.name || item.key || "—"}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-gray-400">
                            {item.product?.sku && (
                              <span>SKU: {item.product.sku}</span>
                            )}
                            {item.product?.barcode && (
                              <span>• Barcode: {item.product.barcode}</span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-bold text-gray-800">
                            {item.warehouse?.name || "—"}
                          </p>
                          {item.warehouse?.code && (
                            <p className="text-xs font-semibold text-gray-400">
                              {item.warehouse.code}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1",
                              costingBadgeStyle(method)
                            )}
                          >
                            {prettyCostingMethod(method)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-gray-900 tabular-nums">
                          {number(qty)}{" "}
                          <span className="text-xs font-normal text-gray-400">
                            {item.product?.baseUnit?.code ||
                              item.product?.baseUnit?.symbol ||
                              ""}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-gray-900 tabular-nums">
                          {money(unitCost, canViewCost)}
                        </td>

                        <td className="px-5 py-4 text-right font-extrabold text-gray-950 tabular-nums">
                          {money(totalVal, canViewCost)}
                        </td>

                        <td className="px-5 py-4 text-center">
                          {method.toLowerCase() === "fifo" && layers.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setFifoModalItem(item)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-100"
                              title="View FIFO Cost Layers"
                            >
                              <Icon icon={ViewIcon} className="h-3.5 w-3.5" />
                              {layers.length} Layers
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <Icon
                        icon={Package01Icon}
                        className="mx-auto h-8 w-8 text-gray-300"
                      />
                      <p className="mt-3 text-sm font-bold text-gray-900">
                        No valuation records found
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        Try adjusting your filters or search query.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="divide-y divide-gray-100 lg:hidden">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-28" />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Skeleton className="h-10 rounded-xl" />
                    <Skeleton className="h-10 rounded-xl" />
                  </div>
                </div>
              ))
            ) : displayItems.length ? (
              displayItems.map((item, index) => {
                const method =
                  item.costingMethod ||
                  item.product?.costingMethod ||
                  "weighted_average"
                const qty = numeric(
                  item.valuationQuantity ?? item.quantity
                )
                const unitCost =
                  item.averageCost ??
                  item.unitCost ??
                  (item.inventoryValue != null && qty > 0
                    ? item.inventoryValue / qty
                    : null)
                const totalVal = item.inventoryValue
                const layers = Array.isArray(item.layers) ? item.layers : []

                return (
                  <article key={item._id || item.key || index} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-gray-900">
                          {item.product?.name || item.key || "—"}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-400">
                          {item.product?.sku
                            ? `SKU: ${item.product.sku}`
                            : "No SKU"}{" "}
                          • {item.warehouse?.name || "No Warehouse"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-black ring-1",
                          costingBadgeStyle(method)
                        )}
                      >
                        {prettyCostingMethod(method)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-2.5 text-center text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400">
                          Quantity
                        </span>
                        <p className="font-extrabold text-gray-900 tabular-nums">
                          {number(qty)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400">
                          Unit Cost
                        </span>
                        <p className="font-extrabold text-gray-900 tabular-nums">
                          {money(unitCost, canViewCost)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400">
                          Total Value
                        </span>
                        <p className="font-black text-indigo-700 tabular-nums">
                          {money(totalVal, canViewCost)}
                        </p>
                      </div>
                    </div>

                    {method.toLowerCase() === "fifo" && layers.length > 0 ? (
                      <div className="mt-2.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setFifoModalItem(item)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-800"
                        >
                          <Icon icon={ViewIcon} className="h-3.5 w-3.5" />
                          View {layers.length} FIFO Layers
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })
            ) : (
              <div className="p-8 text-center text-sm font-semibold text-gray-400">
                No valuation records found.
              </div>
            )}
          </div>

          {/* Pagination Bar */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 p-4 sm:flex-row">
            <div className="text-xs font-semibold text-gray-500">
              Page {page} of {totalPages} ({totalItems} total positions)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className={cn(BUTTON, GHOST_BUTTON, "px-3 py-1.5 text-xs")}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((prev) => prev + 1)}
                className={cn(BUTTON, GHOST_BUTTON, "px-3 py-1.5 text-xs")}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* FIFO Layers Inspection Modal */}
      <ModalShell
        open={Boolean(fifoModalItem)}
        onClose={() => setFifoModalItem(null)}
        title={`FIFO Cost Layers: ${fifoModalItem?.product?.name || "Product"}`}
        subtitle={`Warehouse: ${fifoModalItem?.warehouse?.name || "—"} • Method: FIFO`}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            FIFO inventory cost layers are tracked in chronological receipt order. Outgoing consumption exhausts the oldest layers first.
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-black uppercase text-gray-500">
                <tr>
                  <th className="px-3.5 py-2.5">Layer #</th>
                  <th className="px-3.5 py-2.5">Date</th>
                  <th className="px-3.5 py-2.5 text-right">Original Qty</th>
                  <th className="px-3.5 py-2.5 text-right">Remaining Qty</th>
                  <th className="px-3.5 py-2.5 text-right">Unit Cost</th>
                  <th className="px-3.5 py-2.5 text-right">Layer Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(fifoModalItem?.layers || []).map((layer, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3.5 py-2.5 font-bold text-gray-700">
                      #{idx + 1}
                    </td>
                    <td className="px-3.5 py-2.5 text-gray-600">
                      {formatDate(layer.date || layer.layerDate)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-gray-700">
                      {number(layer.quantity)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-extrabold text-indigo-700">
                      {number(layer.remainingQuantity ?? layer.quantity)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-gray-900">
                      {money(layer.unitCost, canViewCost)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-black text-gray-950">
                      {money(
                        numeric(layer.remainingQuantity ?? layer.quantity) *
                          numeric(layer.unitCost),
                        canViewCost
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ModalShell>
    </div>
  )
}
