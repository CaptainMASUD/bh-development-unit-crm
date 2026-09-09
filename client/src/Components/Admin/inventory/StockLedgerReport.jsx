"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Cancel01Icon,
  FilterIcon,
  FolderLibraryIcon,
  RefreshIcon,
  Search01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const REPORT_VIEW_PERMISSION =
  PERMISSIONS?.INVENTORY_REPORT_VIEW || "inventory-report:view"
const COST_VIEW_PERMISSION =
  PERMISSIONS?.INVENTORY_REPORT_COST_VIEW || "inventory-report:cost-view"

const shell = "min-h-screen bg-gray-50"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const primaryButton =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"
const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatNumber(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function formatMoney(value, currency = "BDT") {
  if (value === null || value === undefined || value === "") return "—"
  return `${clean(currency || "BDT")} ${formatNumber(value, 2)}`
}

function formatDate(value, includeTime = false) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString(
    undefined,
    includeTime
      ? {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
  )
}

function defaultDate(daysAgo = 90) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
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

function requestHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...requestHeaders(),
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || "Request failed")
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

export default function StockLedgerReport() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canViewReport =
    hasPermission(currentUser, REPORT_VIEW_PERMISSION) ||
    currentUser?.role === "admin"
  const canViewCost =
    hasPermission(currentUser, COST_VIEW_PERMISSION) ||
    currentUser?.role === "admin"

  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [locations, setLocations] = useState([])

  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("all")
  const [selectedLocationId, setSelectedLocationId] = useState("all")
  const [dateFrom, setDateFrom] = useState(defaultDate(90))
  const [dateTo, setDateTo] = useState(todayDate())

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [ledgerData, setLedgerData] = useState(null)
  const [lines, setLines] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [hasNextPage, setHasNextPage] = useState(false)

  // Load initial options: products and warehouses
  useEffect(() => {
    async function loadOptions() {
      try {
        const [prodRes, whRes] = await Promise.all([
          api(
            "/inventory/products?status=active&productType=inventory&limit=100"
          ),
          api("/inventory/warehouses/options?limit=100"),
        ])
        const prods = prodRes?.products || []
        setProducts(prods)
        setWarehouses(whRes?.warehouses || [])
        if (prods.length > 0 && !selectedProductId) {
          setSelectedProductId(String(prods[0]._id))
        }
      } catch (err) {
        toast.error(err.message || "Failed to load ledger filter options")
      }
    }
    loadOptions()
  }, [])

  // Load locations when warehouse changes
  useEffect(() => {
    async function loadLocations() {
      if (selectedWarehouseId === "all" || !selectedWarehouseId) {
        setLocations([])
        setSelectedLocationId("all")
        return
      }
      try {
        const res = await api(
          `/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(
            selectedWarehouseId
          )}&limit=100`
        )
        setLocations(res?.locations || [])
      } catch {
        setLocations([])
      }
    }
    loadLocations()
  }, [selectedWarehouseId])

  // Build query parameters
  const buildParams = ({ cursor = null } = {}) => {
    const params = new URLSearchParams()
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    if (selectedWarehouseId !== "all" && selectedWarehouseId) {
      params.set("warehouse", selectedWarehouseId)
    }
    if (selectedLocationId !== "all" && selectedLocationId) {
      params.set("location", selectedLocationId)
    }
    if (cursor) params.set("cursor", cursor)
    params.set("limit", "50")
    return params
  }

  // Load ledger data
  const loadLedger = async ({ append = false, cursor = null } = {}) => {
    if (!selectedProductId) return
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = buildParams({ cursor })
      const res = await api(
        `/inventory/reports/ledger/${selectedProductId}?${params.toString()}`
      )
      setLedgerData(res)
      const incoming = res.lines || []
      setLines((prev) => (append ? [...prev, ...incoming] : incoming))
      setHasNextPage(Boolean(res.hasNextPage || res.hasMore))
      setNextCursor(res.nextCursor || null)
    } catch (err) {
      toast.error(err.message || "Failed to load stock ledger")
      if (!append) {
        setLedgerData(null)
        setLines([])
      }
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedProductId) {
      loadLedger()
    }
  }, [
    selectedProductId,
    selectedWarehouseId,
    selectedLocationId,
    dateFrom,
    dateTo,
  ])

  // Streaming CSV Export
  const exportCsv = async () => {
    if (!selectedProductId) {
      toast.error("Please select a product first.")
      return
    }
    setExporting(true)
    try {
      const token = localStorage.getItem("token")
      const params = buildParams()
      params.set("format", "csv")
      const response = await fetch(
        `${API_BASE}/inventory/reports/ledger/${selectedProductId}?${params.toString()}`,
        {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.message || "Failed to export ledger CSV")
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `stock-ledger-${ledgerData?.product?.sku || selectedProductId}-${todayDate()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success("Ledger CSV exported successfully")
    } catch (err) {
      toast.error(err.message || "Export failed")
    } finally {
      setExporting(false)
    }
  }

  const selectedProduct = ledgerData?.product
  const opening = ledgerData?.openingBalance || {}
  const summary = ledgerData?.periodSummary || {}

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

      {/* Header Section */}
      <section className={cn(card, "mb-6 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon
                icon={FolderLibraryIcon}
                className="h-5 w-5"
                strokeWidth={1.9}
              />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Product Stock Ledger
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Detailed chronologically-ordered running stock transactions,
                inflow/outflow values, and period balances.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={cn(button, ghostButton)}
              onClick={exportCsv}
              disabled={exporting || !selectedProductId || loading}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn(
                  "h-4 w-4",
                  exporting ? "animate-spin" : "rotate-180"
                )}
              />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
            <button
              className={cn(button, ghostButton)}
              onClick={() => loadLedger()}
              disabled={loading || !selectedProductId}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn("h-4 w-4", loading ? "animate-spin" : "")}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Product Select */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-black uppercase text-gray-400">
              Product *
            </label>
            <select
              className={input}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">Select a product...</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.sku ? `(${p.sku})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Select */}
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-gray-400">
              Warehouse
            </label>
            <select
              className={input}
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} {w.code ? `(${w.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Location Select (if warehouse selected) */}
          <div>
            <label className="mb-1 block text-xs font-black uppercase text-gray-400">
              Location
            </label>
            <select
              className={input}
              value={selectedLocationId}
              disabled={selectedWarehouseId === "all" || !locations.length}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="all">
                {selectedWarehouseId === "all"
                  ? "All Locations"
                  : "All in Warehouse"}
              </option>
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name} {loc.code ? `(${loc.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-black uppercase text-gray-400">
                From
              </label>
              <input
                type="date"
                className={input}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-black uppercase text-gray-400">
                To
              </label>
              <input
                type="date"
                className={input}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Selected Product Banner */}
      {selectedProduct ? (
        <div className={cn(card, "mb-6 p-4 sm:p-5")}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-gray-900">
                  {selectedProduct.name}
                </h2>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">
                  {selectedProduct.sku || "No SKU"}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                  Method: {pretty(selectedProduct.costingMethod || "weighted_average")}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Base Unit:{" "}
                <span className="font-semibold text-gray-700">
                  {selectedProduct.baseUnit || "unit"}
                </span>{" "}
                · Barcode:{" "}
                <span className="font-semibold text-gray-700">
                  {selectedProduct.barcode || "—"}
                </span>
                {canViewCost && selectedProduct.standardCost ? (
                  <>
                    {" "}· Standard Cost:{" "}
                    <span className="font-semibold text-gray-700">
                      {formatMoney(selectedProduct.standardCost, selectedProduct.currency)}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Period Summary Cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Opening Balance */}
        <div className={cn(card, "p-4")}>
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">
            Opening Balance
          </p>
          <p className="mt-2 text-xl font-black text-gray-900">
            {formatNumber(opening.quantity ?? summary.openingQuantity ?? 0)}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Value: {canViewCost ? formatMoney(opening.inventoryValue ?? summary.openingValue) : "—"}
          </p>
        </div>

        {/* Total Inflow */}
        <div className={cn(card, "p-4")}>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-600">
            Total In (+)
          </p>
          <p className="mt-2 text-xl font-black text-emerald-700">
            {formatNumber(summary.totalQuantityIn ?? 0)}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Value: {canViewCost ? formatMoney(summary.totalValueIn) : "—"}
          </p>
        </div>

        {/* Total Outflow */}
        <div className={cn(card, "p-4")}>
          <p className="text-xs font-black uppercase tracking-wide text-rose-500">
            Total Out (-)
          </p>
          <p className="mt-2 text-xl font-black text-rose-700">
            {formatNumber(summary.totalQuantityOut ?? 0)}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Value: {canViewCost ? formatMoney(summary.totalValueOut) : "—"}
          </p>
        </div>

        {/* Net Change */}
        <div className={cn(card, "p-4")}>
          <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
            Net Change
          </p>
          <p
            className={cn(
              "mt-2 text-xl font-black",
              Number(summary.netQuantityChange || 0) >= 0
                ? "text-emerald-700"
                : "text-rose-700"
            )}
          >
            {Number(summary.netQuantityChange || 0) > 0 ? "+" : ""}
            {formatNumber(summary.netQuantityChange ?? 0)}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Units across period
          </p>
        </div>

        {/* Closing Balance */}
        <div className={cn(card, "p-4 bg-indigo-50/20 border-indigo-100")}>
          <p className="text-xs font-black uppercase tracking-wide text-indigo-700">
            Closing Balance
          </p>
          <p className="mt-2 text-xl font-black text-indigo-900">
            {formatNumber(summary.closingQuantity ?? 0)}
          </p>
          <p className="mt-1 text-xs font-semibold text-indigo-600">
            Value: {canViewCost ? formatMoney(summary.closingInventoryValue) : "—"}
          </p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className={cn(card, "overflow-hidden")}>
        <div className="max-h-[680px] overflow-auto">
          <table className="min-w-[1300px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Movement No</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">In</th>
                <th className="px-4 py-3 text-right">Out</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Value In</th>
                <th className="px-4 py-3 text-right">Value Out</th>
                <th className="px-4 py-3 text-right">Running Qty</th>
                <th className="px-4 py-3 text-right">Running Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {/* Opening Row Indicator */}
              <tr className="bg-gray-50/60 font-semibold text-gray-600">
                <td className="px-4 py-3 text-xs" colSpan={4}>
                  Beginning Balance (Prior to {formatDate(dateFrom)})
                </td>
                <td className="px-4 py-3 text-right text-xs" colSpan={2}>
                  —
                </td>
                <td className="px-4 py-3 text-right text-xs">
                  {canViewCost ? formatMoney(opening.averageCost) : "—"}
                </td>
                <td className="px-4 py-3 text-right text-xs" colSpan={2}>
                  —
                </td>
                <td className="px-4 py-3 text-right text-sm font-black text-gray-900">
                  {formatNumber(opening.quantity ?? summary.openingQuantity ?? 0)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-black text-gray-900">
                  {canViewCost ? formatMoney(opening.inventoryValue ?? summary.openingValue) : "—"}
                </td>
              </tr>

              {lines.map((line, idx) => (
                <tr
                  key={line._id || idx}
                  className="transition hover:bg-gray-50/70"
                >
                  <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                    {formatDate(line.movementDate || line.postingDate, true)}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs font-black text-indigo-700 whitespace-nowrap">
                    {line.movementNo}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {pretty(line.movementType)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-600 max-w-[180px] truncate">
                    {line.reference || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-black text-emerald-700">
                    {Number(line.quantityIn) > 0
                      ? formatNumber(line.quantityIn)
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-black text-rose-700">
                    {Number(line.quantityOut) > 0
                      ? formatNumber(line.quantityOut)
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs font-semibold text-gray-700">
                    {canViewCost ? formatMoney(line.unitCost) : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs font-semibold text-emerald-700">
                    {canViewCost && Number(line.valueIn) > 0
                      ? formatMoney(line.valueIn)
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs font-semibold text-rose-700">
                    {canViewCost && Number(line.valueOut) > 0
                      ? formatMoney(line.valueOut)
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-black text-gray-900">
                    {formatNumber(line.runningQuantity)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-black text-gray-900">
                    {canViewCost
                      ? formatMoney(line.runningInventoryValue)
                      : "—"}
                  </td>
                </tr>
              ))}

              {!loading && lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-sm font-semibold text-gray-500"
                  >
                    No stock movements recorded for this product during the selected period.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-sm font-semibold text-gray-500"
                  >
                    Loading stock ledger entries...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Load More Button */}
        {hasNextPage ? (
          <div className="flex justify-center border-t border-gray-100 p-4">
            <button
              className={cn(button, ghostButton, "min-w-[150px]")}
              onClick={() => loadLedger({ append: true, cursor: nextCursor })}
              disabled={loadingMore}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn("h-4 w-4", loadingMore ? "animate-spin" : "")}
              />
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
