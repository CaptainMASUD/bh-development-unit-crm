"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  Archive02Icon,
  Cancel01Icon,
  Edit02Icon,
  FilterIcon,
  FloppyDiskIcon,
  FolderLibraryIcon,
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const STOCK_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_STOCK_MANAGE || "inventory-stock:manage"

const STOCK_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_STOCK_DELETE || "inventory-stock:delete"

const STOCK_STATUSES = [
  ["active", "Active"],
  ["inactive", "Inactive"],
]

const emptySummary = {
  stockRows: 0,
  productCount: 0,
  warehouseCount: 0,
  onHandQuantity: 0,
  reservedQuantity: 0,
  quarantineQuantity: 0,
  availableQuantity: 0,
  incomingQuantity: 0,
  outgoingQuantity: 0,
  inventoryValue: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
}

const emptyInitializeForm = {
  product: "",
  warehouse: "",
  location: "",
  reorderLevel: "0",
  minimumStock: "0",
  maximumStock: "0",
}

const emptySettingsForm = {
  reorderLevel: "0",
  minimumStock: "0",
  maximumStock: "0",
  lastCountedAt: "",
  status: "active",
}

const shell = "min-h-screen bg-gray-50"

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"

const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"

const primaryButton =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"

const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"

const dangerButton =
  "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"

const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

const chip =
  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function normalizeId(value) {
  return value?._id || value || ""
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

function toDateInput(value) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16)
}

function formatNumber(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function formatMoney(value, currency = "BDT") {
  return `${clean(currency || "BDT")} ${formatNumber(value, 2)}`
}

function relationLabel(item, fallback = "Unnamed") {
  if (!item) return fallback

  const name = item.name || item.label || fallback
  const code = item.sku || item.code || item.barcode || ""

  return `${name}${code ? ` (${code})` : ""}`
}

function hasAnyQuantity(stock) {
  const currentStock = stock || {}

  return [
    currentStock.onHandQuantity,
    currentStock.reservedQuantity,
    currentStock.quarantineQuantity,
    currentStock.incomingQuantity,
    currentStock.outgoingQuantity,
  ].some((value) => Number(value || 0) !== 0)
}

function isLowStock(stock) {
  const currentStock = stock || {}

  return (
    Number(currentStock.reorderLevel || 0) > 0 &&
    Number(currentStock.availableQuantity || 0) <=
      Number(currentStock.reorderLevel || 0)
  )
}

function isOutOfStock(stock) {
  return Number(stock?.availableQuantity || 0) <= 0
}

function stockHealth(stock) {
  const currentStock = stock || {}

  if (currentStock.status === "archived") {
    return {
      label: "Archived",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    }
  }

  if (isOutOfStock(currentStock)) {
    return {
      label: "Out of Stock",
      className: "bg-rose-50 text-rose-700 ring-rose-100",
    }
  }

  if (isLowStock(currentStock)) {
    return {
      label: "Low Stock",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    }
  }

  return {
    label: "Healthy",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  }
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

function RequiredMark() {
  return <span className="ml-1 text-rose-500">*</span>
}

function Field({ label, children, hint, required = false }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
        {required ? <RequiredMark /> : null}
      </label>

      {children}

      {hint ? (
        <p className="mt-1 text-xs font-medium text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-black text-gray-900">{title}</h3>

        {description ? (
          <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
            {description}
          </p>
        ) : null}
      </div>

      {children}
    </section>
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

function StatusBadge({ value }) {
  const status = String(value || "").toLowerCase()

  const style =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "inactive"
        ? "bg-gray-100 text-gray-700 ring-gray-200"
        : status === "archived"
          ? "bg-amber-50 text-amber-700 ring-amber-100"
          : "bg-slate-100 text-slate-700 ring-slate-200"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1",
        style
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "active"
            ? "bg-emerald-500"
            : status === "inactive"
              ? "bg-gray-400"
              : status === "archived"
                ? "bg-amber-500"
                : "bg-slate-400"
        )}
      />

      {pretty(value)}
    </span>
  )
}

function HealthBadge({ stock }) {
  const health = stockHealth(stock)

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        health.className
      )}
    >
      {health.label}
    </span>
  )
}

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      title={`Remove ${label} filter`}
      aria-label={`Remove ${label} filter`}
    >
      <span className="text-indigo-400">{label}:</span>
      <span className="max-w-[180px] truncate sm:max-w-[220px]">
        {value}
      </span>
      <Icon icon={Cancel01Icon} className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidthClass = "max-w-5xl",
}) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={cn(
              "relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]",
              maxWidthClass
            )}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-gray-50/90 p-4 backdrop-blur sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                  {icon}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                    {title}
                  </h2>

                  {subtitle ? (
                    <p className="truncate text-sm text-gray-600">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-700 transition hover:bg-gray-100"
                aria-label="Close modal"
              >
                <Icon icon={Cancel01Icon} className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">
              {children}
            </div>

            {footer ? (
              <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function headers() {
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
      ...headers(),
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed")
  }

  return data
}

function ActiveFilterChips({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  productName,
  warehouseName,
  locationName,
}) {
  const hasFilters =
    clean(filters.q) ||
    filters.product !== "all" ||
    filters.warehouse !== "all" ||
    filters.location !== "all" ||
    (activeTab === "all" && filters.status !== "all") ||
    (activeTab === "all" && filters.hasStock !== "all")

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {clean(filters.q) ? (
        <FilterChip
          label="Search"
          value={clean(filters.q)}
          onClear={() => updateFilter("q", "")}
        />
      ) : null}

      {filters.product !== "all" ? (
        <FilterChip
          label="Product"
          value={productName || "Selected product"}
          onClear={() => updateFilter("product", "all")}
        />
      ) : null}

      {filters.warehouse !== "all" ? (
        <FilterChip
          label="Warehouse"
          value={warehouseName || "Selected warehouse"}
          onClear={() => updateFilter("warehouse", "all")}
        />
      ) : null}

      {filters.location !== "all" ? (
        <FilterChip
          label="Location"
          value={
            filters.location === "none"
              ? "No location"
              : locationName || "Selected location"
          }
          onClear={() => updateFilter("location", "all")}
        />
      ) : null}

      {activeTab === "all" && filters.status !== "all" ? (
        <FilterChip
          label="Status"
          value={pretty(filters.status)}
          onClear={() => updateFilter("status", "all")}
        />
      ) : null}

      {activeTab === "all" && filters.hasStock !== "all" ? (
        <FilterChip
          label="Balance"
          value="On-hand stock only"
          onClear={() => updateFilter("hasStock", "all")}
        />
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
        >
          <Icon icon={Cancel01Icon} className="h-3.5 w-3.5" />
          Clear all
        </button>
      ) : null}
    </div>
  )
}

function HeaderSearchFilters({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  productName,
  warehouseName,
  locationName,
  onOpenFilters,
}) {
  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "lg:min-w-[560px] lg:max-w-[82%] lg:flex-[0_1_82%]"
          : "lg:max-w-[55%] lg:flex-[0_1_55%]"
      )}
    >
      <div className="flex min-h-[50px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon
          icon={Search01Icon}
          className="h-4 w-4 shrink-0 text-gray-400"
        />

        {clean(filters.q) ? (
          <FilterChip
            label="Search"
            value={clean(filters.q)}
            onClear={() => updateFilter("q", "")}
          />
        ) : null}

        {filters.product !== "all" ? (
          <FilterChip
            label="Product"
            value={productName || "Selected product"}
            onClear={() => updateFilter("product", "all")}
          />
        ) : null}

        {filters.warehouse !== "all" ? (
          <FilterChip
            label="Warehouse"
            value={warehouseName || "Selected warehouse"}
            onClear={() => updateFilter("warehouse", "all")}
          />
        ) : null}

        {filters.location !== "all" ? (
          <FilterChip
            label="Location"
            value={
              filters.location === "none"
                ? "No location"
                : locationName || "Selected location"
            }
            onClear={() => updateFilter("location", "all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search product name, SKU, or barcode..."
          type="text"
          aria-label="Search product stock"
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition",
            activeFilterCount
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          )}
        >
          <Icon icon={FilterIcon} className="h-3.5 w-3.5" />
          Filters

          {activeFilterCount ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        {activeFilterCount ? (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            title="Clear search and filters"
            aria-label="Clear search and filters"
          >
            <Icon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function SummaryCards({ summary, onOpenLow, onOpenOut }) {
  const items = [
    {
      label: "Products",
      value: formatNumber(summary.productCount, 0),
      note: `${formatNumber(summary.stockRows, 0)} stock positions`,
    },
    {
      label: "Warehouses",
      value: formatNumber(summary.warehouseCount, 0),
      note: "Included in current filters",
    },
    {
      label: "On Hand",
      value: formatNumber(summary.onHandQuantity),
      note: `${formatNumber(summary.availableQuantity)} available`,
    },
    {
      label: "Reserved",
      value: formatNumber(summary.reservedQuantity),
      note: `${formatNumber(summary.quarantineQuantity)} quarantined`,
    },
    {
      label: "Incoming",
      value: formatNumber(summary.incomingQuantity),
      note: `${formatNumber(summary.outgoingQuantity)} outgoing`,
    },
    {
      label: "Inventory Value",
      value: formatMoney(summary.inventoryValue),
      note: "Based on average cost",
    },
  ]

  return (
    <div className="mb-6 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className={cn(card, "p-4")}>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">
              {item.label}
            </p>

            <p className="mt-2 truncate text-xl font-black text-gray-900">
              {item.value}
            </p>

            <p className="mt-1 truncate text-xs font-semibold text-gray-500">
              {item.note}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOpenLow}
          className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 p-4 text-left transition hover:border-amber-200 hover:bg-amber-100/70"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-amber-600">
              Low Stock Positions
            </p>

            <p className="mt-1 text-2xl font-black text-amber-800">
              {formatNumber(summary.lowStockCount, 0)}
            </p>
          </div>

          <Icon icon={Alert02Icon} className="h-6 w-6 text-amber-600" />
        </button>

        <button
          type="button"
          onClick={onOpenOut}
          className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 p-4 text-left transition hover:border-rose-200 hover:bg-rose-100/70"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-rose-600">
              Out of Stock Positions
            </p>

            <p className="mt-1 text-2xl font-black text-rose-800">
              {formatNumber(summary.outOfStockCount, 0)}
            </p>
          </div>

          <Icon icon={Alert02Icon} className="h-6 w-6 text-rose-600" />
        </button>
      </div>
    </div>
  )
}

export default function StockOverview() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(
    currentUser,
    STOCK_MANAGE_PERMISSION
  )

  const canDelete = hasPermission(
    currentUser,
    STOCK_DELETE_PERMISSION
  )

  const [activeTab, setActiveTab] = useState("all")
  const [stocks, setStocks] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [filterLocations, setFilterLocations] = useState([])
  const [formLocations, setFormLocations] = useState([])

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openingStockId, setOpeningStockId] = useState("")
  const [loadingDetailsId, setLoadingDetailsId] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [initializeModal, setInitializeModal] = useState(false)
  const [initializeForm, setInitializeForm] = useState(
    emptyInitializeForm
  )
  const [initializeError, setInitializeError] = useState("")

  const [settingsModal, setSettingsModal] = useState({
    open: false,
    item: null,
  })
  const [settingsForm, setSettingsForm] = useState(
    emptySettingsForm
  )
  const [settingsError, setSettingsError] = useState("")

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    stock: null,
  })

  const [filters, setFilters] = useState({
    q: "",
    product: "all",
    warehouse: "all",
    location: "all",
    status: "all",
    hasStock: "all",
  })

  const productMap = useMemo(
    () =>
      new Map(
        products
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [products]
  )

  const warehouseMap = useMemo(
    () =>
      new Map(
        warehouses
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [warehouses]
  )

  const filterLocationMap = useMemo(
    () =>
      new Map(
        filterLocations
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [filterLocations]
  )

  const selectedProductName = useMemo(() => {
    if (filters.product === "all") return ""

    return relationLabel(
      productMap.get(String(filters.product)),
      "Selected product"
    )
  }, [filters.product, productMap])

  const selectedWarehouseName = useMemo(() => {
    if (filters.warehouse === "all") return ""

    return relationLabel(
      warehouseMap.get(String(filters.warehouse)),
      "Selected warehouse"
    )
  }, [filters.warehouse, warehouseMap])

  const selectedLocationName = useMemo(() => {
    if (
      filters.location === "all" ||
      filters.location === "none"
    ) {
      return ""
    }

    return relationLabel(
      filterLocationMap.get(String(filters.location)),
      "Selected location"
    )
  }, [filters.location, filterLocationMap])

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (clean(filters.q)) count += 1
    if (filters.product !== "all") count += 1
    if (filters.warehouse !== "all") count += 1
    if (filters.location !== "all") count += 1

    if (activeTab === "all" && filters.status !== "all") {
      count += 1
    }

    if (activeTab === "all" && filters.hasStock !== "all") {
      count += 1
    }

    return count
  }, [activeTab, filters])

  const updateFilter = (key, value) => {
    setFilters((previous) => {
      const next = {
        ...previous,
        [key]: value,
      }

      if (key === "warehouse") {
        next.location = "all"
      }

      return next
    })
  }

  const resetFilters = () => {
    setFilters({
      q: "",
      product: "all",
      warehouse: "all",
      location: "all",
      status: "all",
      hasStock: "all",
    })
  }

  const loadSetupOptions = async () => {
    try {
      const [productData, warehouseData] = await Promise.all([
        api(
          "/inventory/products?status=active&productType=inventory&trackInventory=true&limit=100"
        ),
        api("/inventory/warehouses/options?limit=100"),
      ])

      setProducts(productData.products || [])
      setWarehouses(warehouseData.warehouses || [])
    } catch (error) {
      toast.error(
        error.message || "Failed to load inventory options"
      )
    }
  }

  const loadLocations = async (
    warehouseId,
    target = "filter"
  ) => {
    if (!warehouseId || warehouseId === "all") {
      if (target === "form") setFormLocations([])
      else setFilterLocations([])
      return []
    }

    try {
      const data = await api(
        `/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(
          warehouseId
        )}&limit=200`
      )

      const rows = data.locations || []

      if (target === "form") setFormLocations(rows)
      else setFilterLocations(rows)

      return rows
    } catch (error) {
      if (target === "form") setFormLocations([])
      else setFilterLocations([])

      toast.error(
        error.message || "Failed to load warehouse locations"
      )

      return []
    }
  }

  const buildListParams = ({ append = false } = {}) => {
    const params = new URLSearchParams({
      limit: "50",
    })

    if (clean(filters.q)) {
      params.set("q", clean(filters.q))
    }

    if (filters.product !== "all") {
      params.set("product", filters.product)
    }

    if (filters.warehouse !== "all") {
      params.set("warehouse", filters.warehouse)
    }

    if (filters.location !== "all") {
      params.set("location", filters.location)
    }

    if (activeTab === "archived") {
      params.set("status", "archived")
    } else if (
      activeTab === "all" &&
      filters.status !== "all"
    ) {
      params.set("status", filters.status)
    }

    if (activeTab === "low") {
      params.set("lowStock", "true")
    }

    if (activeTab === "out") {
      params.set("outOfStock", "true")
    }

    if (
      activeTab === "all" &&
      filters.hasStock === "true"
    ) {
      params.set("hasStock", "true")
    }

    if (append && nextCursor) {
      params.set("cursor", nextCursor)
    }

    return params
  }

  const buildSummaryParams = () => {
    const params = new URLSearchParams()

    if (filters.product !== "all") {
      params.set("product", filters.product)
    }

    if (filters.warehouse !== "all") {
      params.set("warehouse", filters.warehouse)
    }

    if (
      filters.location !== "all" &&
      filters.location !== "none"
    ) {
      params.set("location", filters.location)
    }

    return params
  }

  const loadStocks = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const data = await api(
        `/inventory/stocks?${buildListParams({
          append,
        }).toString()}`,
        { signal }
      )

      const incoming = data.stocks || []

      setStocks((previous) =>
        append ? [...previous, ...incoming] : incoming
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load stock overview")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  const loadSummary = async ({ signal } = {}) => {
    try {
      const data = await api(
        `/inventory/stocks/summary?${buildSummaryParams().toString()}`,
        { signal }
      )

      setSummary({
        ...emptySummary,
        ...(data.summary || {}),
      })
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load stock summary")
      }
    }
  }

  useEffect(() => {
    loadSetupOptions()
  }, [])

  useEffect(() => {
    loadLocations(filters.warehouse, "filter")
  }, [filters.warehouse])

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      Promise.all([
        loadStocks({ signal: controller.signal }),
        loadSummary({ signal: controller.signal }),
      ])
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.product,
    filters.warehouse,
    filters.location,
    filters.status,
    filters.hasStock,
  ])

  const refresh = async () => {
    await Promise.all([
      loadSetupOptions(),
      loadStocks(),
      loadSummary(),
    ])
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
    setNextCursor(null)
    setHasMore(false)

    setFilters((previous) => ({
      ...previous,
      status: "all",
      hasStock: "all",
    }))
  }

  const openInitializeModal = async () => {
    const warehouseId =
      filters.warehouse !== "all" ? filters.warehouse : ""

    setInitializeError("")
    setInitializeForm({
      ...emptyInitializeForm,
      product:
        filters.product !== "all" ? filters.product : "",
      warehouse: warehouseId,
    })
    setInitializeModal(true)

    await loadLocations(warehouseId, "form")
  }

  const closeInitializeModal = () => {
    if (saving) return

    setInitializeModal(false)
    setInitializeForm(emptyInitializeForm)
    setInitializeError("")
    setFormLocations([])
  }

  const updateInitializeWarehouse = async (warehouseId) => {
    setInitializeForm((previous) => ({
      ...previous,
      warehouse: warehouseId,
      location: "",
    }))

    await loadLocations(warehouseId, "form")
  }

  const initializeStock = async (event) => {
    event.preventDefault()
    setInitializeError("")

    const reorderLevel = Number(
      initializeForm.reorderLevel || 0
    )
    const minimumStock = Number(
      initializeForm.minimumStock || 0
    )
    const maximumStock = Number(
      initializeForm.maximumStock || 0
    )

    if (!initializeForm.product) {
      return setInitializeError("Product is required.")
    }

    if (!initializeForm.warehouse) {
      return setInitializeError("Warehouse is required.")
    }

    for (const [label, value] of [
      ["Reorder level", reorderLevel],
      ["Minimum stock", minimumStock],
      ["Maximum stock", maximumStock],
    ]) {
      if (!Number.isFinite(value) || value < 0) {
        return setInitializeError(
          `${label} must be a valid non-negative number.`
        )
      }
    }

    if (maximumStock > 0 && minimumStock > maximumStock) {
      return setInitializeError(
        "Maximum stock must be greater than or equal to minimum stock."
      )
    }

    if (maximumStock > 0 && reorderLevel > maximumStock) {
      return setInitializeError(
        "Reorder level cannot be greater than maximum stock."
      )
    }

    setSaving(true)

    try {
      const data = await api("/inventory/stocks/initialize", {
        method: "POST",
        body: JSON.stringify({
          product: initializeForm.product,
          warehouse: initializeForm.warehouse,
          location: initializeForm.location || null,
          reorderLevel,
          minimumStock,
          maximumStock,
        }),
      })

      toast.success(
        data.message || "Stock position initialized"
      )

      setInitializeModal(false)
      setInitializeForm(emptyInitializeForm)
      setInitializeError("")
      setFormLocations([])

      await Promise.all([loadStocks(), loadSummary()])
    } catch (error) {
      setInitializeError(
        error.message || "Failed to initialize stock position."
      )
    } finally {
      setSaving(false)
    }
  }

  const openSettingsModal = async (stock) => {
    if (stock.status === "archived") {
      toast.error(
        "Restore the archived stock record before editing it."
      )
      return
    }

    setOpeningStockId(stock._id)
    setSettingsError("")

    try {
      const data = await api(`/inventory/stocks/${stock._id}`)
      const item = data.stock

      setSettingsForm({
        reorderLevel: String(item.reorderLevel ?? 0),
        minimumStock: String(item.minimumStock ?? 0),
        maximumStock: String(item.maximumStock ?? 0),
        lastCountedAt: toDateInput(item.lastCountedAt),
        status: item.status || "active",
      })

      setSettingsModal({
        open: true,
        item,
      })
    } catch (error) {
      toast.error(
        error.message || "Failed to load stock settings"
      )
    } finally {
      setOpeningStockId("")
    }
  }

  const closeSettingsModal = () => {
    if (saving) return

    setSettingsModal({
      open: false,
      item: null,
    })
    setSettingsForm(emptySettingsForm)
    setSettingsError("")
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    setSettingsError("")

    const reorderLevel = Number(settingsForm.reorderLevel || 0)
    const minimumStock = Number(settingsForm.minimumStock || 0)
    const maximumStock = Number(settingsForm.maximumStock || 0)

    for (const [label, value] of [
      ["Reorder level", reorderLevel],
      ["Minimum stock", minimumStock],
      ["Maximum stock", maximumStock],
    ]) {
      if (!Number.isFinite(value) || value < 0) {
        return setSettingsError(
          `${label} must be a valid non-negative number.`
        )
      }
    }

    if (maximumStock > 0 && minimumStock > maximumStock) {
      return setSettingsError(
        "Maximum stock must be greater than or equal to minimum stock."
      )
    }

    if (maximumStock > 0 && reorderLevel > maximumStock) {
      return setSettingsError(
        "Reorder level cannot be greater than maximum stock."
      )
    }

    if (
      settingsForm.status === "inactive" &&
      hasAnyQuantity(settingsModal.item)
    ) {
      return setSettingsError(
        "A stock position with balances or pending quantities cannot be deactivated."
      )
    }

    setSaving(true)

    try {
      await api(
        `/inventory/stocks/${settingsModal.item._id}/settings`,
        {
          method: "PATCH",
          body: JSON.stringify({
            reorderLevel,
            minimumStock,
            maximumStock,
            lastCountedAt:
              settingsForm.lastCountedAt || null,
            status: settingsForm.status,
          }),
        }
      )

      toast.success("Stock settings updated")

      setSettingsModal({
        open: false,
        item: null,
      })
      setSettingsForm(emptySettingsForm)
      setSettingsError("")

      await Promise.all([loadStocks(), loadSummary()])
    } catch (error) {
      setSettingsError(
        error.message || "Failed to update stock settings."
      )
    } finally {
      setSaving(false)
    }
  }

  const openDetailsModal = async (stock) => {
    setLoadingDetailsId(stock._id)

    try {
      const data = await api(`/inventory/stocks/${stock._id}`)

      setDetailsModal({
        open: true,
        stock: data.stock,
      })
    } catch (error) {
      toast.error(
        error.message || "Failed to load stock position details"
      )
    } finally {
      setLoadingDetailsId("")
    }
  }

  const archiveStock = async (stock) => {
    const confirmed = window.confirm(
      `Archive the stock position for "${stock.product?.name || "this product"}"? Only a zero-balance position with no reserved, quarantine, incoming, or outgoing quantity can be archived.`
    )

    if (!confirmed) return

    try {
      await api(`/inventory/stocks/${stock._id}`, {
        method: "DELETE",
      })

      toast.success("Zero-balance stock position archived")
      await Promise.all([loadStocks(), loadSummary()])
    } catch (error) {
      toast.error(
        error.message || "Failed to archive stock position"
      )
    }
  }

  const restoreStock = async (stock) => {
    try {
      await api(`/inventory/stocks/${stock._id}/restore`, {
        method: "PATCH",
      })

      toast.success("Stock position restored as inactive")
      await Promise.all([loadStocks(), loadSummary()])
    } catch (error) {
      toast.error(
        error.message || "Failed to restore stock position"
      )
    }
  }

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

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
                Stock Overview
              </h1>

              <p className="mt-0.5 text-sm text-gray-500">
                Review live stock positions, availability, valuation,
                thresholds, and warehouse-level balances.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={cn(button, ghostButton)}
              onClick={refresh}
              disabled={loading}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn(
                  "h-4 w-4",
                  loading ? "animate-spin" : ""
                )}
              />
              Refresh
            </button>

            {canManage && activeTab !== "archived" ? (
              <button
                className={cn(button, primaryButton)}
                onClick={openInitializeModal}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Initialize Position
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <HeaderSearchFilters
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            activeFilterCount={activeFilterCount}
            productName={selectedProductName}
            warehouseName={selectedWarehouseName}
            locationName={selectedLocationName}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing{" "}
            <span className="text-gray-900">{stocks.length}</span>{" "}
            stock positions
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      <SummaryCards
        summary={summary}
        onOpenLow={() => switchTab("low")}
        onOpenOut={() => switchTab("out")}
      />

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only stock access. Initialization, settings,
          archive, and restore controls are hidden.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            {
              key: "all",
              label: "All Stock",
              icon: FolderLibraryIcon,
            },
            {
              key: "low",
              label: "Low Stock",
              icon: Alert02Icon,
            },
            {
              key: "out",
              label: "Out of Stock",
              icon: Alert02Icon,
            },
            {
              key: "archived",
              label: "Archived",
              icon: Archive02Icon,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm",
                activeTab === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => switchTab(tab.key)}
              type="button"
            >
              <Icon icon={tab.icon} className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <StockList
        stocks={stocks}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        openingStockId={openingStockId}
        loadingDetailsId={loadingDetailsId}
        onView={openDetailsModal}
        onEdit={openSettingsModal}
        onArchive={archiveStock}
        onRestore={restoreStock}
        onLoadMore={() => loadStocks({ append: true })}
        canManage={canManage}
        canDelete={canDelete}
      />

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activeTab={activeTab}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        products={products}
        warehouses={warehouses}
        locations={filterLocations}
        selectedProductName={selectedProductName}
        selectedWarehouseName={selectedWarehouseName}
        selectedLocationName={selectedLocationName}
      />

      <InitializeModal
        open={initializeModal}
        form={initializeForm}
        setForm={setInitializeForm}
        products={products}
        warehouses={warehouses}
        locations={formLocations}
        error={initializeError}
        saving={saving}
        onClose={closeInitializeModal}
        onSubmit={initializeStock}
        onWarehouseChange={updateInitializeWarehouse}
      />

      <SettingsModal
        state={settingsModal}
        form={settingsForm}
        setForm={setSettingsForm}
        error={settingsError}
        saving={saving}
        onClose={closeSettingsModal}
        onSubmit={saveSettings}
      />

      <StockDetailsModal
        state={detailsModal}
        onClose={() =>
          setDetailsModal({
            open: false,
            stock: null,
          })
        }
      />
    </div>
  )
}

function FilterModal({
  open,
  onClose,
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  products,
  warehouses,
  locations,
  selectedProductName,
  selectedWarehouseName,
  selectedLocationName,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Stock filters"
      subtitle="Filter stock positions by product, warehouse, location, status, and balance."
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-6xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={cn(
              chip,
              activeFilterCount
                ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                : "bg-gray-100 text-gray-600 ring-gray-600/10"
            )}
          >
            {activeFilterCount} active filter
            {activeFilterCount === 1 ? "" : "s"}
          </span>

          <div className="flex justify-end gap-2">
            <button
              className={cn(button, ghostButton)}
              onClick={resetFilters}
              type="button"
            >
              Reset
            </button>

            <button
              className={cn(button, primaryButton)}
              onClick={onClose}
              type="button"
            >
              <Icon icon={Tick02Icon} className="h-4 w-4" />
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Product">
          <select
            className={input}
            value={filters.product}
            onChange={(event) =>
              updateFilter("product", event.target.value)
            }
          >
            <option value="all">All products</option>

            {filters.product !== "all" &&
            !products.some(
              (product) =>
                String(product._id) === String(filters.product)
            ) ? (
              <option value={filters.product}>
                {selectedProductName || "Selected product"}
              </option>
            ) : null}

            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {relationLabel(product)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Warehouse">
          <select
            className={input}
            value={filters.warehouse}
            onChange={(event) =>
              updateFilter("warehouse", event.target.value)
            }
          >
            <option value="all">All warehouses</option>

            {filters.warehouse !== "all" &&
            !warehouses.some(
              (warehouse) =>
                String(warehouse._id) ===
                String(filters.warehouse)
            ) ? (
              <option value={filters.warehouse}>
                {selectedWarehouseName || "Selected warehouse"}
              </option>
            ) : null}

            {warehouses.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>
                {relationLabel(warehouse)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Location"
          hint="Choose a warehouse first."
        >
          <select
            className={input}
            value={filters.location}
            onChange={(event) =>
              updateFilter("location", event.target.value)
            }
            disabled={filters.warehouse === "all"}
          >
            <option value="all">All locations</option>
            <option value="none">No location</option>

            {filters.location !== "all" &&
            filters.location !== "none" &&
            !locations.some(
              (location) =>
                String(location._id) ===
                String(filters.location)
            ) ? (
              <option value={filters.location}>
                {selectedLocationName || "Selected location"}
              </option>
            ) : null}

            {locations.map((location) => (
              <option key={location._id} value={location._id}>
                {relationLabel(location)}
              </option>
            ))}
          </select>
        </Field>

        {activeTab === "all" ? (
          <>
            <Field label="Status">
              <select
                className={input}
                value={filters.status}
                onChange={(event) =>
                  updateFilter("status", event.target.value)
                }
              >
                <option value="all">Active + Inactive</option>

                {STOCK_STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Balance">
              <select
                className={input}
                value={filters.hasStock}
                onChange={(event) =>
                  updateFilter("hasStock", event.target.value)
                }
              >
                <option value="all">All balances</option>
                <option value="true">
                  Positive on-hand quantity
                </option>
              </select>
            </Field>
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-black text-gray-900">
              {activeTab === "low"
                ? "Low stock view"
                : activeTab === "out"
                  ? "Out-of-stock view"
                  : "Archived view"}
            </p>

            <p className="mt-1 text-xs font-semibold text-gray-500">
              The selected tab applies its stock-state filter
              automatically.
            </p>
          </div>
        )}

        <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm font-black text-gray-900">
            Active filters
          </p>

          <ActiveFilterChips
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            productName={selectedProductName}
            warehouseName={selectedWarehouseName}
            locationName={selectedLocationName}
          />
        </div>
      </div>
    </ModalShell>
  )
}

function StockList({
  stocks,
  loading,
  loadingMore,
  hasMore,
  openingStockId,
  loadingDetailsId,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onLoadMore,
  canManage,
  canDelete,
}) {
  return (
    <div>
      <div className={cn(card, "overflow-hidden")}>
        <div className="hidden max-h-[680px] overflow-auto xl:block">
          <table className="min-w-[1650px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">On Hand</th>
                <th className="px-5 py-3">Available</th>
                <th className="px-5 py-3">Reserved</th>
                <th className="px-5 py-3">Quarantine</th>
                <th className="px-5 py-3">Incoming</th>
                <th className="px-5 py-3">Outgoing</th>
                <th className="px-5 py-3">Avg. Cost</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Threshold</th>
                <th className="px-5 py-3">Health</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last Movement</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {stocks.map((stock) => (
                <tr
                  key={stock._id}
                  className="group bg-white transition hover:bg-gray-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="flex min-w-[245px] items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                        {stock.product?.imageUrl ? (
                          <img
                            src={stock.product.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-black text-indigo-600">
                            {(stock.product?.sku || "P")
                              .slice(0, 3)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-900">
                          {stock.product?.name || "Unknown product"}
                        </p>

                        <p className="mt-0.5 text-xs font-black text-indigo-700">
                          {stock.product?.sku || "-"}
                        </p>

                        <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">
                          {stock.product?.barcode || "No barcode"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <p className="min-w-[170px] text-sm font-black text-gray-800">
                      {stock.warehouse?.name || "Unknown warehouse"}
                    </p>

                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {stock.warehouse?.code || "-"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="min-w-[150px] text-sm font-black text-gray-800">
                      {stock.location?.name || "No location"}
                    </p>

                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {stock.location?.code ||
                        stock.location?.locationType ||
                        "Warehouse level"}
                    </p>
                  </td>

                  <QuantityCell value={stock.onHandQuantity} strong />
                  <QuantityCell
                    value={stock.availableQuantity}
                    strong
                    negative={
                      Number(stock.availableQuantity || 0) <= 0
                    }
                  />
                  <QuantityCell value={stock.reservedQuantity} />
                  <QuantityCell value={stock.quarantineQuantity} />
                  <QuantityCell value={stock.incomingQuantity} />
                  <QuantityCell value={stock.outgoingQuantity} />

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatMoney(stock.averageCost)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-900">
                    {formatMoney(stock.inventoryValue)}
                  </td>

                  <td className="px-5 py-4">
                    <div className="min-w-[150px] text-xs font-semibold text-gray-600">
                      <p>
                        Reorder:{" "}
                        <span className="font-black text-gray-800">
                          {formatNumber(stock.reorderLevel)}
                        </span>
                      </p>

                      <p className="mt-1">
                        Min / Max:{" "}
                        <span className="font-black text-gray-800">
                          {formatNumber(stock.minimumStock)} /{" "}
                          {formatNumber(stock.maximumStock)}
                        </span>
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <HealthBadge stock={stock} />
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge value={stock.status} />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                    {formatDate(stock.lastMovementAt, true)}
                  </td>

                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                    <StockActions
                      stock={stock}
                      opening={
                        String(openingStockId) === String(stock._id)
                      }
                      loadingDetails={
                        String(loadingDetailsId) ===
                        String(stock._id)
                      }
                      onView={onView}
                      onEdit={onEdit}
                      onArchive={onArchive}
                      onRestore={onRestore}
                      canManage={canManage}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))}

              {!stocks.length ? (
                <tr>
                  <td
                    colSpan={16}
                    className="px-5 py-14 text-center text-sm font-bold text-gray-500"
                  >
                    {loading
                      ? "Loading stock positions..."
                      : "No stock positions found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 xl:hidden">
          {stocks.map((stock) => (
            <StockMobileCard
              key={stock._id}
              stock={stock}
              opening={
                String(openingStockId) === String(stock._id)
              }
              loadingDetails={
                String(loadingDetailsId) === String(stock._id)
              }
              onView={onView}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}

          {!stocks.length ? (
            <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
              {loading
                ? "Loading stock positions..."
                : "No stock positions found."}
            </div>
          ) : null}
        </div>
      </div>

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            className={cn(button, ghostButton, "min-w-[150px]")}
            onClick={onLoadMore}
            disabled={loadingMore}
            type="button"
          >
            <Icon
              icon={RefreshIcon}
              className={cn(
                "h-4 w-4",
                loadingMore ? "animate-spin" : ""
              )}
            />

            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function QuantityCell({ value, strong = false, negative = false }) {
  return (
    <td
      className={cn(
        "px-5 py-4 text-sm",
        strong ? "font-black" : "font-bold",
        negative ? "text-rose-700" : "text-gray-700"
      )}
    >
      {formatNumber(value)}
    </td>
  )
}

function StockMobileCard({
  stock,
  opening,
  loadingDetails,
  onView,
  onEdit,
  onArchive,
  onRestore,
  canManage,
  canDelete,
}) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50">
          {stock.product?.imageUrl ? (
            <img
              src={stock.product.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-black text-indigo-700">
              {(stock.product?.sku || "P")
                .slice(0, 3)
                .toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-900">
                {stock.product?.name || "Unknown product"}
              </h3>

              <p className="mt-0.5 text-xs font-black text-indigo-700">
                {stock.product?.sku || "-"}
              </p>
            </div>

            <StatusBadge value={stock.status} />
          </div>

          <div className="mt-2">
            <HealthBadge stock={stock} />
          </div>

          <div className="mt-3 rounded-xl bg-gray-50 p-3">
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <span className="font-semibold text-gray-500">
                {relationLabel(
                  stock.warehouse,
                  "Unknown warehouse"
                )}
              </span>

              <span className="font-semibold text-gray-500">
                {relationLabel(stock.location, "No location")}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <MiniMetric
                label="On Hand"
                value={stock.onHandQuantity}
              />
              <MiniMetric
                label="Available"
                value={stock.availableQuantity}
                danger={Number(stock.availableQuantity || 0) <= 0}
              />
              <MiniMetric
                label="Reserved"
                value={stock.reservedQuantity}
              />
              <MiniMetric
                label="Quarantine"
                value={stock.quarantineQuantity}
              />
              <MiniMetric
                label="Incoming"
                value={stock.incomingQuantity}
              />
              <MiniMetric
                label="Outgoing"
                value={stock.outgoingQuantity}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-bold text-gray-400">Average Cost</p>
              <p className="mt-1 font-black text-gray-700">
                {formatMoney(stock.averageCost)}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Inventory Value</p>
              <p className="mt-1 font-black text-gray-700">
                {formatMoney(stock.inventoryValue)}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Reorder Level</p>
              <p className="mt-1 font-black text-gray-700">
                {formatNumber(stock.reorderLevel)}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Last Movement</p>
              <p className="mt-1 font-black text-gray-700">
                {formatDate(stock.lastMovementAt)}
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <StockActions
              stock={stock}
              opening={opening}
              loadingDetails={loadingDetails}
              onView={onView}
              onEdit={onEdit}
              onArchive={onArchive}
              onRestore={onRestore}
              canManage={canManage}
              canDelete={canDelete}
              mobile
            />
          </div>
        </div>
      </div>
    </article>
  )
}

function MiniMetric({ label, value, danger = false }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p
        className={cn(
          "mt-1 text-sm font-black",
          danger ? "text-rose-700" : "text-gray-800"
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  )
}

function StockActions({
  stock,
  opening,
  loadingDetails,
  onView,
  onEdit,
  onArchive,
  onRestore,
  canManage,
  canDelete,
  mobile = false,
}) {
  if (stock.status === "archived") {
    return (
      <div
        className={cn(
          "flex gap-2",
          mobile ? "flex-wrap" : "justify-end"
        )}
      >
        <button
          className={cn(
            button,
            ghostButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onView(stock)}
          disabled={loadingDetails}
          type="button"
          title="View stock position"
        >
          <Icon
            icon={loadingDetails ? RefreshIcon : ViewIcon}
            className={cn(
              "h-4 w-4",
              loadingDetails ? "animate-spin" : ""
            )}
          />
          {mobile ? "View" : null}
        </button>

        {canDelete ? (
          <button
            className={cn(
              button,
              ghostButton,
              mobile ? "px-3 py-2" : "px-3"
            )}
            onClick={() => onRestore(stock)}
            type="button"
            title="Restore stock position"
          >
            <Icon icon={RestoreBinIcon} className="h-4 w-4" />
            {mobile ? "Restore" : null}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        mobile ? "flex-wrap" : "justify-end"
      )}
    >
      <button
        className={cn(
          button,
          ghostButton,
          mobile ? "px-3 py-2" : "px-3"
        )}
        onClick={() => onView(stock)}
        disabled={loadingDetails}
        type="button"
        title="View stock position"
      >
        <Icon
          icon={loadingDetails ? RefreshIcon : ViewIcon}
          className={cn(
            "h-4 w-4",
            loadingDetails ? "animate-spin" : ""
          )}
        />
        {mobile ? "View" : null}
      </button>

      {canManage ? (
        <button
          className={cn(
            button,
            ghostButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onEdit(stock)}
          disabled={opening}
          type="button"
          title="Edit stock settings"
        >
          <Icon
            icon={opening ? RefreshIcon : Edit02Icon}
            className={cn(
              "h-4 w-4",
              opening ? "animate-spin" : ""
            )}
          />
          {mobile ? (opening ? "Loading" : "Settings") : null}
        </button>
      ) : null}

      {canDelete ? (
        <button
          className={cn(
            button,
            dangerButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onArchive(stock)}
          disabled={hasAnyQuantity(stock)}
          type="button"
          title={
            hasAnyQuantity(stock)
              ? "Only a zero-balance stock position can be archived."
              : "Archive stock position"
          }
        >
          <Icon icon={Archive02Icon} className="h-4 w-4" />
          {mobile ? "Archive" : null}
        </button>
      ) : null}
    </div>
  )
}

function InitializeModal({
  open,
  form,
  setForm,
  products,
  warehouses,
  locations,
  error,
  saving,
  onClose,
  onSubmit,
  onWarehouseChange,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Initialize stock position"
      subtitle="Create a zero-quantity stock record for one product, warehouse, and optional location."
      icon={<Icon icon={Add01Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className={cn(button, ghostButton)}
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className={cn(button, primaryButton)}
            type="submit"
            form="initialize-stock-form"
            disabled={saving}
          >
            <Icon
              icon={saving ? RefreshIcon : FloppyDiskIcon}
              className={cn(
                "h-4 w-4",
                saving ? "animate-spin" : ""
              )}
            />

            {saving ? "Initializing..." : "Initialize position"}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <Icon
            icon={Alert02Icon}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{error}</span>
        </div>
      ) : null}

      <form id="initialize-stock-form" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionCard
            title="Stock position"
            description="Only active inventory-tracked products and active warehouses can be initialized."
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Product" required>
                <select
                  className={input}
                  value={form.product}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      product: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Select product</option>

                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {relationLabel(product)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Warehouse" required>
                <select
                  className={input}
                  value={form.warehouse}
                  onChange={(event) =>
                    onWarehouseChange(event.target.value)
                  }
                  required
                >
                  <option value="">Select warehouse</option>

                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse._id}
                      value={warehouse._id}
                    >
                      {relationLabel(warehouse)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Location"
                hint="Leave empty to maintain stock at warehouse level."
              >
                <select
                  className={input}
                  value={form.location}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      location: event.target.value,
                    }))
                  }
                  disabled={!form.warehouse}
                >
                  <option value="">No location</option>

                  {locations.map((location) => (
                    <option
                      key={location._id}
                      value={location._id}
                    >
                      {relationLabel(location)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Stock-control thresholds"
            description="These settings control low-stock warnings; they do not create stock quantity."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Reorder Level">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.reorderLevel}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      reorderLevel: event.target.value,
                    }))
                  }
                  placeholder="Example: 10"
                />
              </Field>

              <Field label="Minimum Stock">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.minimumStock}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      minimumStock: event.target.value,
                    }))
                  }
                  placeholder="Example: 5"
                />
              </Field>

              <Field label="Maximum Stock">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.maximumStock}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      maximumStock: event.target.value,
                    }))
                  }
                  placeholder="Example: 100"
                />
              </Field>
            </div>
          </SectionCard>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
            The initialized position starts with zero on-hand,
            reserved, quarantine, incoming, and outgoing quantities.
            Use Stock Movements to change quantities.
          </div>
        </div>
      </form>
    </ModalShell>
  )
}

function SettingsModal({
  state,
  form,
  setForm,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  if (!state?.open || !state.item) return null

  const stock = state.item
  const hasBalance = hasAnyQuantity(stock)

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title="Stock position settings"
      subtitle={
        stock
          ? `${stock.product?.name || "Product"} · ${
              stock.warehouse?.name || "Warehouse"
            }`
          : ""
      }
      icon={<Icon icon={Edit02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className={cn(button, ghostButton)}
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className={cn(button, primaryButton)}
            type="submit"
            form="stock-settings-form"
            disabled={saving}
          >
            <Icon
              icon={saving ? RefreshIcon : FloppyDiskIcon}
              className={cn(
                "h-4 w-4",
                saving ? "animate-spin" : ""
              )}
            />

            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <Icon
            icon={Alert02Icon}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {stock ? (
        <form id="stock-settings-form" onSubmit={onSubmit}>
          <div className="space-y-4">
            <SectionCard
              title="Position"
              description="Product, warehouse, and location cannot be changed after initialization."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <ReadOnlyValue
                  label="Product"
                  value={relationLabel(
                    stock.product,
                    "Unknown product"
                  )}
                />
                <ReadOnlyValue
                  label="Warehouse"
                  value={relationLabel(
                    stock.warehouse,
                    "Unknown warehouse"
                  )}
                />
                <ReadOnlyValue
                  label="Location"
                  value={relationLabel(
                    stock.location,
                    "No location"
                  )}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Thresholds and counting"
              description="Update warning limits and the most recent physical count date."
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field label="Reorder Level">
                  <FocusPlaceholderInput
                    className={input}
                    type="number"
                    min="0"
                    step="0.000001"
                    value={form.reorderLevel}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        reorderLevel: event.target.value,
                      }))
                    }
                    placeholder="Example: 10"
                  />
                </Field>

                <Field label="Minimum Stock">
                  <FocusPlaceholderInput
                    className={input}
                    type="number"
                    min="0"
                    step="0.000001"
                    value={form.minimumStock}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        minimumStock: event.target.value,
                      }))
                    }
                    placeholder="Example: 5"
                  />
                </Field>

                <Field label="Maximum Stock">
                  <FocusPlaceholderInput
                    className={input}
                    type="number"
                    min="0"
                    step="0.000001"
                    value={form.maximumStock}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        maximumStock: event.target.value,
                      }))
                    }
                    placeholder="Example: 100"
                  />
                </Field>

                <Field label="Last Counted At">
                  <FocusPlaceholderInput
                    className={input}
                    type="datetime-local"
                    value={form.lastCountedAt}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        lastCountedAt: event.target.value,
                      }))
                    }
                    placeholder="Select date and time"
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Lifecycle"
              description="A stock position with balances or pending quantities must remain active."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Status">
                  <select
                    className={input}
                    value={form.status}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        status: event.target.value,
                      }))
                    }
                  >
                    {STOCK_STATUSES.map(([value, label]) => (
                      <option
                        key={value}
                        value={value}
                        disabled={
                          value === "inactive" && hasBalance
                        }
                      >
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                    Current quantities
                  </p>

                  <p className="mt-2 text-sm font-black text-gray-800">
                    On hand {formatNumber(stock.onHandQuantity)} ·
                    Reserved {formatNumber(stock.reservedQuantity)} ·
                    Pending{" "}
                    {formatNumber(
                      Number(stock.incomingQuantity || 0) +
                        Number(stock.outgoingQuantity || 0)
                    )}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </form>
      ) : null}
    </ModalShell>
  )
}

function ReadOnlyValue({ label, value }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-black text-gray-800">
        {value}
      </p>
    </div>
  )
}

function StockDetailsModal({ state, onClose }) {
  const stock = state.stock

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={stock?.product?.name || "Stock position"}
      subtitle={
        stock
          ? `${stock.product?.sku || "-"} · ${
              stock.warehouse?.name || "Warehouse"
            }`
          : ""
      }
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-6xl"
      footer={
        <div className="flex justify-end">
          <button
            className={cn(button, ghostButton)}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      }
    >
      {stock ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {[
              ["On Hand", stock.onHandQuantity],
              ["Available", stock.availableQuantity],
              ["Reserved", stock.reservedQuantity],
              ["Quarantine", stock.quarantineQuantity],
              ["Incoming", stock.incomingQuantity],
              ["Outgoing", stock.outgoingQuantity],
              ["Average Cost", formatMoney(stock.averageCost)],
              ["Inventory Value", formatMoney(stock.inventoryValue)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  {label}
                </p>

                <p className="mt-2 text-lg font-black text-gray-900">
                  {typeof value === "string"
                    ? value
                    : formatNumber(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Stock position">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Product"
                  value={relationLabel(
                    stock.product,
                    "Unknown product"
                  )}
                />
                <DetailRow
                  label="Warehouse"
                  value={relationLabel(
                    stock.warehouse,
                    "Unknown warehouse"
                  )}
                />
                <DetailRow
                  label="Location"
                  value={relationLabel(
                    stock.location,
                    "No location"
                  )}
                />
                <DetailRow
                  label="Status"
                  value={<StatusBadge value={stock.status} />}
                />
                <DetailRow
                  label="Health"
                  value={<HealthBadge stock={stock} />}
                />
                <DetailRow
                  label="Stock version"
                  value={stock.stockVersion ?? 0}
                />
              </div>
            </SectionCard>

            <SectionCard title="Control settings">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Reorder level"
                  value={formatNumber(stock.reorderLevel)}
                />
                <DetailRow
                  label="Minimum stock"
                  value={formatNumber(stock.minimumStock)}
                />
                <DetailRow
                  label="Maximum stock"
                  value={formatNumber(stock.maximumStock)}
                />
                <DetailRow
                  label="Last movement"
                  value={formatDate(stock.lastMovementAt, true)}
                />
                <DetailRow
                  label="Last counted"
                  value={formatDate(stock.lastCountedAt, true)}
                />
                <DetailRow
                  label="Updated"
                  value={formatDate(stock.updatedAt, true)}
                />
              </div>
            </SectionCard>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
            Quantity balances are maintained by posted stock
            movements. This screen only manages the position and its
            control settings.
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <span className="shrink-0 font-semibold text-gray-500">
        {label}
      </span>

      <span className="min-w-0 text-right font-black text-gray-800">
        {value}
      </span>
    </div>
  )
}

