"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  Image01Icon,
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const PRODUCT_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_PRODUCT_MANAGE || "inventory-product:manage"

const PRODUCT_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_PRODUCT_DELETE || "inventory-product:delete"

const SUPPLIER_OPTIONS_PATH =
  import.meta.env.VITE_SUPPLIER_OPTIONS_PATH ||
  "/suppliers/options?limit=200&includeUnavailable=true"

const PRODUCT_TYPES = [
  ["inventory", "Inventory Product"],
  ["non_inventory", "Non-Inventory Product"],
  ["service", "Service"],
]

const PRODUCT_STATUSES = [
  ["active", "Active"],
  ["inactive", "Inactive"],
  ["discontinued", "Discontinued"],
]

const TRACKING_TYPES = [
  ["none", "No Batch / Serial Tracking"],
  ["batch", "Batch Tracking"],
  ["serial", "Serial Number Tracking"],
]

const COSTING_METHODS = [
  ["weighted_average", "Weighted Average"],
  ["fifo", "FIFO"],
  ["standard", "Standard Cost"],
]

const TAX_TYPES = [
  ["none", "No Tax"],
  ["exclusive", "Tax Exclusive"],
  ["inclusive", "Tax Inclusive"],
]

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

const emptyProductForm = {
  name: "",
  sku: "",
  barcode: "",
  productType: "inventory",
  category: "",
  brand: "",
  baseUnit: "",
  defaultSupplier: "",
  description: "",
  imageUrl: "",
  purchasePrice: "0",
  sellingPrice: "0",
  wholesalePrice: "0",
  minimumSellingPrice: "0",
  currency: "BDT",
  taxType: "none",
  taxRate: "0",
  trackInventory: true,
  trackingType: "none",
  costingMethod: "weighted_average",
  allowNegativeStock: false,
  reorderLevel: "0",
  minimumStock: "0",
  maximumStock: "0",
  status: "active",
}

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

function formatDate(value) {
  if (!value) return "-"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatMoney(value, currency = "BDT") {
  const amount = Number(value || 0)

  return `${clean(currency || "BDT").toUpperCase()} ${amount.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`
}

function normalizeId(value) {
  return value?._id || value || ""
}

function optionLabel(item, type) {
  if (!item) return ""

  if (type === "category") {
    return `${item.name || "Unnamed category"}${
      item.code ? ` (${item.code})` : ""
    }`
  }

  if (type === "brand") {
    return `${item.name || "Unnamed brand"}${
      item.code ? ` (${item.code})` : ""
    }`
  }

  if (type === "unit") {
    const name = item.name || item.unitName || item.label || "Unnamed unit"
    const code = item.symbol || item.code || item.shortName || ""

    return `${name}${code ? ` (${code})` : ""}`
  }

  if (type === "supplier") {
    const name =
      item.name ||
      item.supplierName ||
      item.companyName ||
      item.businessName ||
      "Unnamed supplier"

    const code = item.code || item.supplierCode || ""

    return `${name}${code ? ` (${code})` : ""}`
  }

  return item.name || item.label || item.code || "Unnamed option"
}

function buildOptionMap(items = []) {
  return new Map(
    items
      .filter((item) => item?._id)
      .map((item) => [String(item._id), item])
  )
}

function resolveRelationLabel(value, map, type, fallback) {
  if (!value) return fallback

  if (typeof value === "object" && value !== null) {
    return optionLabel(value, type)
  }

  const item = map.get(String(value))

  return item ? optionLabel(item, type) : fallback
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
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent",
        className
      )}
    />
  )
}

function SkeletonBlock({ className = "h-4 w-full" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-gray-200/80",
        className
      )}
    />
  )
}

function ProductTableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`product-skeleton-${index}`}>
      <td className="border-b border-gray-100 px-5 py-3">
        <div className="flex min-w-[250px] items-center gap-3">
          <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
        </div>
      </td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-7 w-24 rounded-full" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><div className="space-y-2"><SkeletonBlock className="h-4 w-32" /><SkeletonBlock className="h-3 w-24" /></div></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-24" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-32" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-24" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-24" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-7 w-24 rounded-full" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-20" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-7 w-24 rounded-full" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-24" /></td>
      <td className="sticky right-0 border-b border-gray-100 bg-white px-5 py-2">
        <div className="flex justify-end gap-2">
          <SkeletonBlock className="h-10 w-20 rounded-xl" />
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
        </div>
      </td>
    </tr>
  ))
}

function ProductMobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <div key={`product-mobile-skeleton-${index}`} className="p-4">
      <div className="flex items-start gap-3">
        <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-40 max-w-full" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <SkeletonBlock className="h-7 w-20 rounded-full" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-7 w-24 rounded-full" />
            <SkeletonBlock className="h-7 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-28 w-full rounded-xl" />
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <SkeletonBlock className="h-10 w-20 rounded-xl" />
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  ))
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

      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
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

function FocusPlaceholderTextarea({
  placeholder = "",
  onFocus,
  onBlur,
  ...props
}) {
  const [focused, setFocused] = useState(false)

  return (
    <textarea
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

function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-indigo-600" : "bg-gray-300"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}

function StatusBadge({ value }) {
  const status = String(value || "").toLowerCase()

  const style =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "inactive"
        ? "bg-gray-100 text-gray-700 ring-gray-200"
        : status === "discontinued"
          ? "bg-rose-50 text-rose-700 ring-rose-100"
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
              : status === "discontinued"
                ? "bg-rose-500"
                : status === "archived"
                  ? "bg-amber-500"
                  : "bg-slate-400"
        )}
      />

      {pretty(value)}
    </span>
  )
}

function TypeBadge({ value }) {
  const type = String(value || "").toLowerCase()

  const style =
    type === "inventory"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
      : type === "non_inventory"
        ? "bg-sky-50 text-sky-700 ring-sky-100"
        : "bg-violet-50 text-violet-700 ring-violet-100"

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        style
      )}
    >
      {pretty(value)}
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

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5">
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

function HeaderSearchFilters({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  categoryName,
  brandName,
  onOpenFilters,
}) {
  const chipCount = [
    activeTab === "current" && filters.status !== "all",
    filters.productType !== "all",
    filters.trackingType !== "all",
    clean(filters.currency),
    filters.category !== "all",
    filters.brand !== "all",
    filters.trackInventory !== "all",
  ].filter(Boolean).length

  const hasAnySearchOrFilter = Boolean(clean(filters.q) || chipCount)

  return (
    <div
      className={cn(
        "w-full transition-[max-width,flex-basis] duration-200 ease-out",
        chipCount === 0
          ? "xl:max-w-[50%] xl:flex-[0_1_50%]"
          : chipCount <= 2
            ? "xl:max-w-[64%] xl:flex-[0_1_64%]"
            : "xl:min-w-[560px] xl:max-w-[78%] xl:flex-[0_1_78%]"
      )}
    >
      <div className="flex min-h-[40px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />

        {activeTab === "current" && filters.status !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(filters.status)}
            onClear={() => updateFilter("status", "all")}
          />
        ) : null}

        {filters.productType !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(filters.productType)}
            onClear={() => updateFilter("productType", "all")}
          />
        ) : null}

        {filters.trackingType !== "all" ? (
          <FilterChip
            label="Tracking"
            value={pretty(filters.trackingType)}
            onClear={() => updateFilter("trackingType", "all")}
          />
        ) : null}

        {filters.category !== "all" ? (
          <FilterChip
            label="Category"
            value={categoryName || "Selected category"}
            onClear={() => updateFilter("category", "all")}
          />
        ) : null}

        {filters.brand !== "all" ? (
          <FilterChip
            label="Brand"
            value={brandName || "Selected brand"}
            onClear={() => updateFilter("brand", "all")}
          />
        ) : null}

        {clean(filters.currency) ? (
          <FilterChip
            label="Currency"
            value={clean(filters.currency).toUpperCase()}
            onClear={() => updateFilter("currency", "")}
          />
        ) : null}

        {filters.trackInventory !== "all" ? (
          <FilterChip
            label="Stock"
            value={filters.trackInventory === "true" ? "Tracked" : "Not tracked"}
            onClear={() => updateFilter("trackInventory", "all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[140px] basis-[180px] flex-[1_1_180px] border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-900 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus:shadow-none focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search product name, SKU or barcode..."
          type="text"
          aria-label="Search products"
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

        {hasAnySearchOrFilter ? (
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

export default function ProductSetup() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, PRODUCT_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, PRODUCT_DELETE_PERMISSION)

  const [activeTab, setActiveTab] = useState("current")
  const [products, setProducts] = useState([])

  const [categoryOptions, setCategoryOptions] = useState([])
  const [brandOptions, setBrandOptions] = useState([])
  const [unitOptions, setUnitOptions] = useState([])
  const [supplierOptions, setSupplierOptions] = useState([])
  const [supplierOptionsAvailable, setSupplierOptionsAvailable] =
    useState(true)
  const [supplierOptionsLoading, setSupplierOptionsLoading] =
    useState(false)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openingProductId, setOpeningProductId] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [modal, setModal] = useState({
    open: false,
    item: null,
  })

  const [form, setForm] = useState(emptyProductForm)
  const [formError, setFormError] = useState("")


  const [loadingDetailsId, setLoadingDetailsId] = useState("")
  const [detailsModal, setDetailsModal] = useState({
    open: false,
    product: null,
  })
  const [actionState, setActionState] = useState({ id: "", type: "" })
  const [actionModal, setActionModal] = useState({
    open: false,
    product: null,
    type: "",
    targetStatus: "",
    title: "",
    message: "",
    danger: false,
    loading: false,
    error: "",
  })
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    product: null,
    password: "",
    loading: false,
    error: "",
  })

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    productType: "all",
    trackingType: "all",
    currency: "",
    category: "all",
    brand: "all",
    trackInventory: "all",
  })

  const categoryMap = useMemo(
    () => buildOptionMap(categoryOptions),
    [categoryOptions]
  )

  const brandMap = useMemo(
    () => buildOptionMap(brandOptions),
    [brandOptions]
  )

  const unitMap = useMemo(
    () => buildOptionMap(unitOptions),
    [unitOptions]
  )

  const supplierMap = useMemo(
    () => buildOptionMap(supplierOptions),
    [supplierOptions]
  )

  const selectedCategoryName = useMemo(() => {
    if (filters.category === "all") return ""

    return resolveRelationLabel(
      filters.category,
      categoryMap,
      "category",
      "Selected category"
    )
  }, [filters.category, categoryMap])

  const selectedBrandName = useMemo(() => {
    if (filters.brand === "all") return ""

    return resolveRelationLabel(
      filters.brand,
      brandMap,
      "brand",
      "Selected brand"
    )
  }, [filters.brand, brandMap])

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (activeTab === "current" && filters.status !== "all") {
      count += 1
    }

    if (filters.productType !== "all") count += 1
    if (filters.trackingType !== "all") count += 1
    if (clean(filters.currency)) count += 1
    if (filters.category !== "all") count += 1
    if (filters.brand !== "all") count += 1
    if (filters.trackInventory !== "all") count += 1

    return count
  }, [activeTab, filters])

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const resetFilters = () => {
    setFilters({
      q: "",
      status: "all",
      productType: "all",
      trackingType: "all",
      currency: "",
      category: "all",
      brand: "all",
      trackInventory: "all",
    })
  }

  const loadRequiredOptions = async () => {
    const [categoryResult, brandResult, unitResult] =
      await Promise.allSettled([
        api("/inventory/categories/options?limit=200"),
        api("/inventory/brands/options?limit=200"),
        api("/inventory/units/options?limit=200"),
      ])

    if (categoryResult.status === "fulfilled") {
      setCategoryOptions(categoryResult.value.categories || [])
    } else {
      toast.error("Failed to load category options")
    }

    if (brandResult.status === "fulfilled") {
      setBrandOptions(brandResult.value.brands || [])
    } else {
      toast.error("Failed to load brand options")
    }

    if (unitResult.status === "fulfilled") {
      setUnitOptions(
        unitResult.value.units ||
          unitResult.value.inventoryUnits ||
          unitResult.value.data ||
          []
      )
    } else {
      toast.error("Failed to load inventory unit options")
    }
  }

  const loadSupplierOptions = async ({ showError = false } = {}) => {
    if (!SUPPLIER_OPTIONS_PATH) {
      setSupplierOptions([])
      setSupplierOptionsAvailable(false)
      return []
    }

    setSupplierOptionsLoading(true)

    try {
      const data = await api(SUPPLIER_OPTIONS_PATH)
      const options =
        data.suppliers || data.options || data.data || []

      setSupplierOptions(options)
      setSupplierOptionsAvailable(true)
      return options
    } catch (error) {
      setSupplierOptions([])
      setSupplierOptionsAvailable(false)
      if (showError) {
        toast.error(
          error.message ||
            "Failed to load active suppliers. Please try again."
        )
      }
      return []
    } finally {
      setSupplierOptionsLoading(false)
    }
  }

  const loadProducts = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const params = new URLSearchParams({
        limit: "40",
      })

      if (clean(filters.q)) {
        params.set("q", clean(filters.q))
      }

      if (activeTab === "archived") {
        params.set("status", "archived")
      } else if (filters.status !== "all") {
        params.set("status", filters.status)
      }

      if (filters.productType !== "all") {
        params.set("productType", filters.productType)
      }

      if (filters.trackingType !== "all") {
        params.set("trackingType", filters.trackingType)
      }

      if (clean(filters.currency)) {
        params.set("currency", clean(filters.currency).toUpperCase())
      }

      if (filters.category !== "all") {
        params.set("category", filters.category)
      }

      if (filters.brand !== "all") {
        params.set("brand", filters.brand)
      }

      if (filters.trackInventory !== "all") {
        params.set("trackInventory", filters.trackInventory)
      }

      if (append && nextCursor) {
        params.set("cursor", nextCursor)
      }

      const data = await api(
        `/inventory/products?${params.toString()}`,
        { signal }
      )

      const incomingProducts = data.products || []

      setProducts((previous) =>
        append ? [...previous, ...incomingProducts] : incomingProducts
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load products")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  const refresh = async () => {
    await Promise.all([
      loadProducts(),
      loadRequiredOptions(),
      loadSupplierOptions({ showError: true }),
    ])
  }

  useEffect(() => {
    loadRequiredOptions()
    loadSupplierOptions()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      loadProducts({ signal: controller.signal })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.status,
    filters.productType,
    filters.trackingType,
    filters.currency,
    filters.category,
    filters.brand,
    filters.trackInventory,
  ])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
    setNextCursor(null)
    setHasMore(false)

    setFilters((previous) => ({
      ...previous,
      status: "all",
    }))
  }

  const openCreateModal = () => {
    setFormError("")
    setForm(emptyProductForm)
    setModal({ open: true, item: null })
    loadSupplierOptions({ showError: true })
  }

  const openEditModal = async (product) => {
    if (product.status === "archived") {
      toast.error("Restore the archived product before editing it.")
      return
    }

    setOpeningProductId(product._id)
    setFormError("")

    try {
      const [data] = await Promise.all([
        api(`/inventory/products/${product._id}`),
        loadSupplierOptions({ showError: true }),
      ])
      const item = data.product

      setForm({
        name: item.name || "",
        sku: item.sku || "",
        barcode: item.barcode || "",
        productType: item.productType || "inventory",
        category: normalizeId(item.category),
        brand: normalizeId(item.brand),
        baseUnit: normalizeId(item.baseUnit),
        defaultSupplier: normalizeId(item.defaultSupplier),
        description: item.description || "",
        imageUrl: item.imageUrl || "",
        purchasePrice: String(item.purchasePrice ?? 0),
        sellingPrice: String(item.sellingPrice ?? 0),
        wholesalePrice: String(item.wholesalePrice ?? 0),
        minimumSellingPrice: String(
          item.minimumSellingPrice ?? 0
        ),
        currency: item.currency || "BDT",
        taxType: item.taxType || "none",
        taxRate: String(item.taxRate ?? 0),
        trackInventory:
          item.productType === "inventory"
            ? item.trackInventory !== false
            : false,
        trackingType:
          item.productType === "inventory" &&
          item.trackInventory !== false
            ? item.trackingType || "none"
            : "none",
        costingMethod:
          item.costingMethod || "weighted_average",
        allowNegativeStock: false,
        reorderLevel: String(item.reorderLevel ?? 0),
        minimumStock: String(item.minimumStock ?? 0),
        maximumStock: String(item.maximumStock ?? 0),
        status:
          item.status === "archived"
            ? "inactive"
            : item.status || "active",
      })

      setModal({ open: true, item })
    } catch (error) {
      toast.error(error.message || "Failed to load product details")
    } finally {
      setOpeningProductId("")
    }
  }

  const closeModal = () => {
    if (saving) return

    setFormError("")
    setModal({ open: false, item: null })
    setForm(emptyProductForm)
  }

  const updateProductType = (productType) => {
    setForm((previous) => {
      if (productType === "inventory") {
        return {
          ...previous,
          productType,
          trackInventory: true,
        }
      }

      return {
        ...previous,
        productType,
        trackInventory: false,
        trackingType: "none",
        allowNegativeStock: false,
        reorderLevel: "0",
        minimumStock: "0",
        maximumStock: "0",
      }
    })
  }

  const updateTrackInventory = (trackInventory) => {
    setForm((previous) => ({
      ...previous,
      trackInventory,
      trackingType: trackInventory
        ? previous.trackingType
        : "none",
      allowNegativeStock: false,
      reorderLevel: trackInventory
        ? previous.reorderLevel
        : "0",
      minimumStock: trackInventory
        ? previous.minimumStock
        : "0",
      maximumStock: trackInventory
        ? previous.maximumStock
        : "0",
    }))
  }

  const updateTaxType = (taxType) => {
    setForm((previous) => ({
      ...previous,
      taxType,
      taxRate: taxType === "none" ? "0" : previous.taxRate,
    }))
  }

  const saveProduct = async (event) => {
    event.preventDefault()
    setFormError("")

    const numericFields = {
      purchasePrice: Number(form.purchasePrice || 0),
      sellingPrice: Number(form.sellingPrice || 0),
      wholesalePrice: Number(form.wholesalePrice || 0),
      minimumSellingPrice: Number(form.minimumSellingPrice || 0),
      taxRate: Number(form.taxRate || 0),
      reorderLevel: Number(form.reorderLevel || 0),
      minimumStock: Number(form.minimumStock || 0),
      maximumStock: Number(form.maximumStock || 0),
    }

    if (!clean(form.name)) {
      return setFormError("Product name is required.")
    }

    if (!clean(form.sku)) {
      return setFormError("SKU is required.")
    }

    for (const [field, value] of Object.entries(numericFields)) {
      if (!Number.isFinite(value) || value < 0) {
        return setFormError(
          `${pretty(field)} must be a valid non-negative number.`
        )
      }
    }

    if (numericFields.taxRate > 100) {
      return setFormError("Tax rate cannot be greater than 100.")
    }

    if (
      numericFields.minimumSellingPrice > 0 &&
      numericFields.sellingPrice > 0 &&
      numericFields.minimumSellingPrice >
        numericFields.sellingPrice
    ) {
      return setFormError(
        "Minimum selling price cannot be greater than selling price."
      )
    }

    if (
      numericFields.maximumStock > 0 &&
      numericFields.minimumStock > numericFields.maximumStock
    ) {
      return setFormError(
        "Maximum stock must be greater than or equal to minimum stock."
      )
    }

    if (
      numericFields.maximumStock > 0 &&
      numericFields.reorderLevel > numericFields.maximumStock
    ) {
      return setFormError(
        "Reorder level cannot be greater than maximum stock."
      )
    }

    const isInventoryProduct = form.productType === "inventory"
    const trackInventory =
      isInventoryProduct && Boolean(form.trackInventory)

    const payload = {
      name: clean(form.name),
      sku: clean(form.sku).toUpperCase(),
      barcode: clean(form.barcode).toUpperCase(),
      productType: form.productType,
      category: form.category || null,
      brand: form.brand || null,
      baseUnit: form.baseUnit || null,
      defaultSupplier: form.defaultSupplier || null,
      description: clean(form.description),
      imageUrl: clean(form.imageUrl),
      purchasePrice: numericFields.purchasePrice,
      sellingPrice: numericFields.sellingPrice,
      wholesalePrice: numericFields.wholesalePrice,
      minimumSellingPrice:
        numericFields.minimumSellingPrice,
      currency: clean(form.currency || "BDT").toUpperCase(),
      taxType: form.taxType,
      taxRate:
        form.taxType === "none" ? 0 : numericFields.taxRate,
      trackInventory,
      trackingType: trackInventory
        ? form.trackingType
        : "none",
      costingMethod: form.costingMethod,
      allowNegativeStock: false,
      reorderLevel: trackInventory
        ? numericFields.reorderLevel
        : 0,
      minimumStock: trackInventory
        ? numericFields.minimumStock
        : 0,
      maximumStock: trackInventory
        ? numericFields.maximumStock
        : 0,
      status: form.status,
    }

    setSaving(true)

    try {
      await api(
        modal.item?._id
          ? `/inventory/products/${modal.item._id}`
          : "/inventory/products",
        {
          method: modal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      )

      toast.success(
        modal.item ? "Product updated" : "Product created"
      )

      setModal({ open: false, item: null })
      setForm(emptyProductForm)
      setFormError("")
      await loadProducts({ showLoader: false })
    } catch (error) {
      setFormError(error.message || "Failed to save product.")
    } finally {
      setSaving(false)
    }
  }

  const openDetailsModal = async (product) => {
    setLoadingDetailsId(product._id)

    try {
      const data = await api(`/inventory/products/${product._id}`)
      setDetailsModal({
        open: true,
        product: data.product || product,
      })
    } catch (error) {
      toast.error(error.message || "Failed to load product details")
    } finally {
      setLoadingDetailsId("")
    }
  }

  const closeDetailsModal = () => {
    setDetailsModal({ open: false, product: null })
  }

  const openProductAction = (type, product, targetStatus = "") => {
    const config =
      type === "status"
        ? {
            title: `Mark as ${pretty(targetStatus)}`,
            message: `Update “${product.name}” to ${pretty(targetStatus).toLowerCase()}?`,
            danger: targetStatus === "discontinued",
          }
        : type === "archive"
          ? {
              title: "Archive product",
              message: `Archive “${product.name}”? Historical inventory, purchase, sales, and accounting references will remain available.`,
              danger: true,
            }
          : {
              title: "Restore product",
              message: `Restore “${product.name}” as an inactive product?`,
              danger: false,
            }

    setActionModal({
      open: true,
      product,
      type,
      targetStatus,
      title: config.title,
      message: config.message,
      danger: config.danger,
      loading: false,
      error: "",
    })
  }

  const closeProductAction = () => {
    if (actionModal.loading) return
    setActionModal({
      open: false,
      product: null,
      type: "",
      targetStatus: "",
      title: "",
      message: "",
      danger: false,
      loading: false,
      error: "",
    })
  }

  const confirmProductAction = async () => {
    const product = actionModal.product
    if (!product?._id || !actionModal.type) return

    const actionKey =
      actionModal.type === "status"
        ? `status-${actionModal.targetStatus}`
        : actionModal.type

    setActionState({ id: product._id, type: actionKey })
    setActionModal((previous) => ({ ...previous, loading: true, error: "" }))

    try {
      if (actionModal.type === "status") {
        await api(`/inventory/products/${product._id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: actionModal.targetStatus }),
        })
        toast.success(`Product marked as ${pretty(actionModal.targetStatus).toLowerCase()}`)
      } else if (actionModal.type === "archive") {
        await api(`/inventory/products/${product._id}`, {
          method: "DELETE",
        })
        toast.success("Product archived")
      } else if (actionModal.type === "restore") {
        await api(`/inventory/products/${product._id}/restore`, {
          method: "PATCH",
        })
        toast.success("Product restored as inactive")
      }

      setActionModal({
        open: false,
        product: null,
        type: "",
        targetStatus: "",
        title: "",
        message: "",
        danger: false,
        loading: false,
        error: "",
      })
      await loadProducts({ showLoader: false })
    } catch (error) {
      setActionModal((previous) => ({
        ...previous,
        loading: false,
        error: error.message || "Failed to update product",
      }))
    } finally {
      setActionState({ id: "", type: "" })
    }
  }

  const openDeleteProduct = (product) => {
    setDeleteModal({
      open: true,
      product,
      password: "",
      loading: false,
      error: "",
    })
  }

  const closeDeleteProduct = () => {
    if (deleteModal.loading) return
    setDeleteModal({
      open: false,
      product: null,
      password: "",
      loading: false,
      error: "",
    })
  }

  const deleteProductPermanently = async (event) => {
    event.preventDefault()
    const product = deleteModal.product
    const password = clean(deleteModal.password)

    if (!product?._id) return
    if (!password) {
      setDeleteModal((previous) => ({
        ...previous,
        error: "Password is required.",
      }))
      return
    }

    setDeleteModal((previous) => ({ ...previous, loading: true, error: "" }))
    setActionState({ id: product._id, type: "delete" })

    try {
      const data = await api(`/inventory/products/${product._id}/permanent`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      })

      toast.success(data.message || "Product deleted permanently")
      setDeleteModal({
        open: false,
        product: null,
        password: "",
        loading: false,
        error: "",
      })
      setDetailsModal((previous) =>
        String(previous.product?._id) === String(product._id)
          ? { open: false, product: null }
          : previous
      )
      await loadProducts({ showLoader: false })
    } catch (error) {
      setDeleteModal((previous) => ({
        ...previous,
        loading: false,
        error: error.message || "Failed to delete product permanently.",
      }))
    } finally {
      setActionState({ id: "", type: "" })
    }
  }

  const getCategoryName = (product) =>
    resolveRelationLabel(
      product.category,
      categoryMap,
      "category",
      "Uncategorized"
    )

  const getBrandName = (product) =>
    resolveRelationLabel(
      product.brand,
      brandMap,
      "brand",
      "No brand"
    )

  const getUnitName = (product) =>
    resolveRelationLabel(
      product.baseUnit,
      unitMap,
      "unit",
      "No unit"
    )

  const getSupplierName = (product) =>
    resolveRelationLabel(
      product.defaultSupplier,
      supplierMap,
      "supplier",
      "No supplier"
    )

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: 14, fontWeight: 700 } }} />

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
                Products
              </h1>
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

            {canManage && activeTab === "current" ? (
              <button
                className={cn(button, primaryButton)}
                onClick={openCreateModal}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Product
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
            categoryName={selectedCategoryName}
            brandName={selectedBrandName}
            onOpenFilters={() => setFilterOpen(true)}
          />

          {loading ? (
            <SkeletonBlock className="h-4 w-28" />
          ) : (
            <p className="shrink-0 text-sm font-bold text-gray-500">
              Showing <span className="text-gray-900">{products.length}</span>{" "}
              {activeTab === "archived" ? "archived products" : "products"}
              {hasMore ? "+" : ""}
            </p>
          )}
        </div>
      </section>

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only product access. Product creation,
          editing, status changes, archiving, and restoration controls
          are hidden.
        </div>
      ) : null}

      <div className={`${card} mb-4 p-1.5`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            ["current", "Current"],
            ["archived", "Archived"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={cn(
                "rounded-xl px-3 py-2.5 text-xs font-extrabold transition sm:px-4 sm:text-sm",
                activeTab === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => switchTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ProductList
        products={products}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        openingProductId={openingProductId}
        getCategoryName={getCategoryName}
        getBrandName={getBrandName}
        getUnitName={getUnitName}
        getSupplierName={getSupplierName}
        loadingDetailsId={loadingDetailsId}
        actionState={actionState}
        onView={openDetailsModal}
        onEdit={openEditModal}
        onAction={openProductAction}
        onDelete={openDeleteProduct}
        onLoadMore={() => loadProducts({ append: true })}
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
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
      />

      <ProductDetailsModal
        state={detailsModal}
        getCategoryName={getCategoryName}
        getBrandName={getBrandName}
        getUnitName={getUnitName}
        getSupplierName={getSupplierName}
        onClose={closeDetailsModal}
        onEdit={openEditModal}
        onDelete={openDeleteProduct}
        canManage={canManage}
        canDelete={canDelete}
      />

      <ConfirmProductActionModal
        state={actionModal}
        onClose={closeProductAction}
        onConfirm={confirmProductAction}
      />

      <DeleteProductModal
        state={deleteModal}
        setState={setDeleteModal}
        onClose={closeDeleteProduct}
        onSubmit={deleteProductPermanently}
      />

      <ProductFormModal
        open={modal.open}
        item={modal.item}
        form={form}
        setForm={setForm}
        categoryOptions={categoryOptions}
        brandOptions={brandOptions}
        unitOptions={unitOptions}
        supplierOptions={supplierOptions}
        supplierOptionsAvailable={supplierOptionsAvailable}
        supplierOptionsLoading={supplierOptionsLoading}
        categoryMap={categoryMap}
        brandMap={brandMap}
        unitMap={unitMap}
        supplierMap={supplierMap}
        error={formError}
        saving={saving}
        onClose={closeModal}
        onSubmit={saveProduct}
        onProductTypeChange={updateProductType}
        onTrackInventoryChange={updateTrackInventory}
        onTaxTypeChange={updateTaxType}
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
  categoryOptions,
  brandOptions,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Product filters"
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-4xl"
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
            {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
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
      <div className="grid gap-4 md:grid-cols-2">
        {activeTab === "current" ? (
          <Field label="Status">
            <select
              className={input}
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="all">All current statuses</option>
              {PRODUCT_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Product Type">
          <select
            className={input}
            value={filters.productType}
            onChange={(event) => updateFilter("productType", event.target.value)}
          >
            <option value="all">All product types</option>
            {PRODUCT_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>

        <Field label="Tracking Type">
          <select
            className={input}
            value={filters.trackingType}
            onChange={(event) => updateFilter("trackingType", event.target.value)}
          >
            <option value="all">All tracking types</option>
            {TRACKING_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>

        <Field label="Category">
          <select
            className={input}
            value={filters.category}
            onChange={(event) => updateFilter("category", event.target.value)}
          >
            <option value="all">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category._id} value={category._id}>
                {optionLabel(category, "category")}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Brand">
          <select
            className={input}
            value={filters.brand}
            onChange={(event) => updateFilter("brand", event.target.value)}
          >
            <option value="all">All brands</option>
            {brandOptions.map((brand) => (
              <option key={brand._id} value={brand._id}>
                {optionLabel(brand, "brand")}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Inventory Tracking">
          <select
            className={input}
            value={filters.trackInventory}
            onChange={(event) => updateFilter("trackInventory", event.target.value)}
          >
            <option value="all">Tracked + Not tracked</option>
            <option value="true">Tracked products only</option>
            <option value="false">Not tracked only</option>
          </select>
        </Field>

        <Field label="Currency">
          <FocusPlaceholderInput
            className={input}
            value={filters.currency}
            onChange={(event) => updateFilter("currency", event.target.value.toUpperCase())}
            placeholder="Example: BDT"
            maxLength={12}
          />
        </Field>
      </div>
    </ModalShell>
  )
}

function ProductList({
  products,
  loading,
  loadingMore,
  hasMore,
  openingProductId,
  loadingDetailsId,
  actionState,
  getCategoryName,
  getBrandName,
  getUnitName,
  getSupplierName,
  onView,
  onEdit,
  onAction,
  onDelete,
  onLoadMore,
  canManage,
  canDelete,
}) {
  return (
    <div className={cn(card, "overflow-hidden rounded-3xl border-gray-200")}>
      <div className="hidden h-[560px] overflow-auto [scrollbar-gutter:stable] xl:block 2xl:h-[650px]">
        <table className="w-full min-w-[1450px] border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-20">
            <tr>
              {[
                "Product",
                "Type",
                "Category / Brand",
                "Unit",
                "Supplier",
                "Purchase",
                "Selling",
                "Inventory",
                "Tracking",
                "Status",
                "Updated",
              ].map((label) => (
                <th
                  key={label}
                  className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-black uppercase tracking-[0.06em] text-gray-600"
                >
                  {label}
                </th>
              ))}
              <th className="sticky right-0 z-30 border-b border-gray-200 bg-gray-50 px-5 py-4 text-right text-xs font-black uppercase tracking-[0.06em] text-gray-600 shadow-[-12px_0_20px_-20px_rgba(15,23,42,0.35)]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {loading ? (
              <ProductTableSkeleton rows={8} />
            ) : products.length ? (
              products.map((product) => (
                <tr key={product._id} className="group">
                  <td className="border-b border-gray-100 bg-white px-5 py-3 transition group-hover:bg-indigo-50/40">
                    <div className="flex min-w-[250px] items-center gap-3">
                      <ProductImage product={product} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-950">{product.name}</p>
                        <p className="mt-0.5 text-xs font-black text-indigo-700">{product.sku}</p>
                        <p className="mt-0.5 max-w-[280px] truncate text-xs font-medium text-gray-500">
                          {product.barcode || "No barcode"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-gray-100 bg-white px-5 py-3 transition group-hover:bg-indigo-50/40"><TypeBadge value={product.productType} /></td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 transition group-hover:bg-indigo-50/40">
                    <p className="max-w-[190px] truncate text-sm font-semibold text-gray-800">{getCategoryName(product)}</p>
                    <p className="mt-0.5 max-w-[190px] truncate text-xs font-medium text-gray-500">{getBrandName(product)}</p>
                  </td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition group-hover:bg-indigo-50/40">{getUnitName(product)}</td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition group-hover:bg-indigo-50/40"><p className="max-w-[190px] truncate">{getSupplierName(product)}</p></td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition group-hover:bg-indigo-50/40">{formatMoney(product.purchasePrice, product.currency)}</td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 transition group-hover:bg-indigo-50/40">
                    <p className="text-sm font-semibold text-indigo-700">{formatMoney(product.sellingPrice, product.currency)}</p>
                    {Number(product.wholesalePrice || 0) > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-gray-500">Wholesale {formatMoney(product.wholesalePrice, product.currency)}</p>
                    ) : null}
                  </td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 transition group-hover:bg-indigo-50/40">
                    <span className={cn(
                      "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
                      product.trackInventory
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                        : "bg-gray-100 text-gray-600 ring-gray-200"
                    )}>
                      {product.trackInventory ? "Tracked" : "Not tracked"}
                    </span>
                    {product.trackInventory ? <p className="mt-1 text-xs font-medium text-gray-500">Reorder {product.reorderLevel ?? 0}</p> : null}
                  </td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition group-hover:bg-indigo-50/40">{pretty(product.trackingType)}</td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 transition group-hover:bg-indigo-50/40"><StatusBadge value={product.status} /></td>
                  <td className="border-b border-gray-100 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition group-hover:bg-indigo-50/40">{formatDate(product.updatedAt)}</td>
                  <td className="sticky right-0 z-10 border-b border-gray-100 bg-white px-5 py-2 text-right transition shadow-[-14px_0_24px_-22px_rgba(15,23,42,0.45)] group-hover:bg-indigo-50/40">
                    <ProductActions
                      product={product}
                      opening={String(openingProductId) === String(product._id)}
                      loadingDetails={String(loadingDetailsId) === String(product._id)}
                      actionState={actionState}
                      onView={onView}
                      onEdit={onEdit}
                      onAction={onAction}
                      onDelete={onDelete}
                      canManage={canManage}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12} className="bg-white p-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8">
                    <Icon icon={FolderLibraryIcon} className="h-6 w-6 text-gray-400" />
                    <p className="mt-3 text-sm font-black text-gray-900">No products found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 xl:hidden">
        {loading ? (
          <ProductMobileSkeleton rows={5} />
        ) : products.length ? (
          products.map((product) => (
            <ProductMobileCard
              key={product._id}
              product={product}
              categoryName={getCategoryName(product)}
              brandName={getBrandName(product)}
              unitName={getUnitName(product)}
              supplierName={getSupplierName(product)}
              opening={String(openingProductId) === String(product._id)}
              loadingDetails={String(loadingDetailsId) === String(product._id)}
              actionState={actionState}
              onView={onView}
              onEdit={onEdit}
              onAction={onAction}
              onDelete={onDelete}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))
        ) : (
          <div className="p-8 text-center text-sm font-bold text-gray-500">No products found</div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs font-semibold text-gray-500">
          {loading ? "Loading products…" : `${products.length} product${products.length === 1 ? "" : "s"} loaded`}
        </p>
        {hasMore ? (
          <button
            className={cn(button, ghostButton, "min-w-[140px] py-2")}
            onClick={onLoadMore}
            disabled={loadingMore}
            type="button"
          >
            {loadingMore ? <Spinner /> : <Icon icon={RefreshIcon} className="h-4 w-4" />}
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ProductMobileCard({
  product,
  categoryName,
  brandName,
  unitName,
  supplierName,
  opening,
  loadingDetails,
  actionState,
  onView,
  onEdit,
  onAction,
  onDelete,
  canManage,
  canDelete,
}) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <ProductImage product={product} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-950">{product.name}</h3>
              <p className="mt-0.5 text-xs font-black text-indigo-700">{product.sku}</p>
            </div>
            <StatusBadge value={product.status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <TypeBadge value={product.productType} />
            <span className={cn(
              "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
              product.trackInventory
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                : "bg-gray-100 text-gray-600 ring-gray-200"
            )}>
              {product.trackInventory ? "Tracked" : "Not tracked"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <MiniMetric label="Category" value={categoryName} />
            <MiniMetric label="Brand" value={brandName} />
            <MiniMetric label="Selling" value={formatMoney(product.sellingPrice, product.currency)} />
            <MiniMetric label="Base Unit" value={unitName} />
            <div className="col-span-2"><MiniMetric label="Supplier" value={supplierName} /></div>
            <div className="col-span-2"><MiniMetric label="Tracking" value={`${pretty(product.trackingType)}${product.trackInventory ? ` · Reorder ${product.reorderLevel ?? 0}` : ""}`} /></div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <ProductActions
              product={product}
              opening={opening}
              loadingDetails={loadingDetails}
              actionState={actionState}
              onView={onView}
              onEdit={onEdit}
              onAction={onAction}
              onDelete={onDelete}
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

function MiniMetric({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}

function ProductImage({ product, size = "h-12 w-12" }) {
  const [failed, setFailed] = useState(false)
  const showImage = clean(product.imageUrl) && !failed
  const initials = clean(product.name).slice(0, 2).toUpperCase() || "PR"

  useEffect(() => {
    setFailed(false)
  }, [product.imageUrl])

  return (
    <div className={cn(
      "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700",
      size
    )}>
      {showImage ? (
        <img
          src={product.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xs font-black tracking-wide">{initials}</span>
      )}
    </div>
  )
}

function ProductActions({
  product,
  opening,
  loadingDetails,
  actionState,
  onView,
  onEdit,
  onAction,
  onDelete,
  canManage,
  canDelete,
  mobile = false,
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, transformOrigin: "top right" })
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const busy = String(actionState.id) === String(product._id)

  const updateMenuPosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 250
    const gap = 8
    const estimatedHeight = 360
    const shouldOpenUp = window.innerHeight - rect.bottom < 280
    const top = shouldOpenUp
      ? Math.max(12, rect.top - Math.min(estimatedHeight, window.innerHeight - 24) - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - 12)
    const left = Math.min(
      Math.max(12, rect.right - menuWidth),
      Math.max(12, window.innerWidth - menuWidth - 12)
    )
    setMenuStyle({ top, left, transformOrigin: shouldOpenUp ? "bottom right" : "top right" })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    updateMenuPosition()
    const closeOutside = (event) => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const reposition = () => updateMenuPosition()
    document.addEventListener("mousedown", closeOutside)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      document.removeEventListener("mousedown", closeOutside)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open, updateMenuPosition])

  const items = []

  if (product.status !== "archived") {
    if (canManage) {
      items.push(["edit", "Edit product", Edit02Icon])
      PRODUCT_STATUSES.forEach(([status, label]) => {
        if (status !== product.status) {
          items.push([
            `status-${status}`,
            `Mark ${label.toLowerCase()}`,
            status === "discontinued" ? Alert02Icon : Tick02Icon,
            status === "discontinued" ? "warning" : undefined,
          ])
        }
      })
    }
    if (canDelete) items.push(["archive", "Archive product", Archive02Icon, "warning"])
  } else if (canDelete) {
    items.push(["restore", "Restore product", RestoreBinIcon])
  }

  if (canDelete) items.push(["delete", "Delete product", Cancel01Icon, "danger"])

  const handleItem = (key) => {
    setOpen(false)
    if (key === "edit") return onEdit(product)
    if (key.startsWith("status-")) return onAction("status", product, key.replace("status-", ""))
    if (key === "archive") return onAction("archive", product)
    if (key === "restore") return onAction("restore", product)
    if (key === "delete") return onDelete(product)
  }

  const menu = open && typeof document !== "undefined"
    ? createPortal(
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14 }}
          style={{ top: menuStyle.top, left: menuStyle.left, transformOrigin: menuStyle.transformOrigin }}
          className="fixed z-[9999] w-[250px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)]"
        >
          <div className="max-h-[min(70vh,420px)] overflow-y-auto p-2">
            {items.length ? items.map(([key, text, icon, tone]) => {
              const itemBusy = busy && actionState.type === key
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => handleItem(key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                    tone === "danger"
                      ? "text-rose-700 hover:bg-rose-50"
                      : tone === "warning"
                        ? "text-amber-800 hover:bg-amber-50"
                        : "text-gray-800 hover:bg-gray-50"
                  )}
                >
                  {itemBusy ? <Spinner /> : <Icon icon={icon} className="h-4 w-4 shrink-0" />}
                  <span>{text}</span>
                </button>
              )
            }) : (
              <p className="px-3 py-2 text-sm font-semibold text-gray-400">No additional actions</p>
            )}
          </div>
        </motion.div>,
        document.body
      )
    : null

  return (
    <div ref={rootRef} className="relative flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onView(product)}
        disabled={loadingDetails}
        className={cn(button, primaryButton, mobile ? "h-10 px-3" : "h-10 px-4")}
      >
        {loadingDetails ? <Spinner /> : <Icon icon={ViewIcon} className="h-4 w-4" />}
        View
      </button>

      {items.length ? (
        <button
          ref={buttonRef}
          type="button"
          aria-label="More product actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            if (!open) updateMenuPosition()
            setOpen((previous) => !previous)
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
        >
          <span className="-mt-1 text-xl font-black leading-none">⋮</span>
        </button>
      ) : null}
      {menu}
    </div>
  )
}

function RelationSelect({
  value,
  onChange,
  options,
  map,
  type,
  emptyLabel,
  currentLabel,
  disabled = false,
}) {
  const currentId = clean(value)
  const currentExists = currentId && map.has(currentId)

  return (
    <select
      className={input}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      <option value="">{emptyLabel}</option>

      {currentId && !currentExists ? (
        <option value={currentId}>
          {currentLabel || "Current assigned record"}
        </option>
      ) : null}

      {options.map((item) => (
        <option
          key={item._id}
          value={item._id}
          disabled={item.isSelectable === false}
        >
          {optionLabel(item, type)}
          {item.isSelectable === false ? ` — ${pretty(item.status)}` : ""}
        </option>
      ))}
    </select>
  )
}

function ProductDetailsModal({
  state,
  getCategoryName,
  getBrandName,
  getUnitName,
  getSupplierName,
  onClose,
  onEdit,
  onDelete,
  canManage,
  canDelete,
}) {
  const product = state.product
  if (!product) return null

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title="Product details"
      subtitle={product.sku || ""}
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose}>Close</button>
          {canManage && product.status !== "archived" ? (
            <button className={cn(button, primaryButton)} type="button" onClick={() => { onClose(); onEdit(product) }}>
              <Icon icon={Edit02Icon} className="h-4 w-4" />
              Edit
            </button>
          ) : null}
          {canDelete ? (
            <button className={cn(button, dangerButton)} type="button" onClick={() => onDelete(product)}>
              <Icon icon={Cancel01Icon} className="h-4 w-4" />
              Delete
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProductImage product={product} size="h-16 w-16" />
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black text-gray-950">{product.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge value={product.status} />
              <TypeBadge value={product.productType} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="SKU" value={product.sku || "—"} />
          <DetailItem label="Barcode" value={product.barcode || "—"} />
          <DetailItem label="Category" value={getCategoryName(product)} />
          <DetailItem label="Brand" value={getBrandName(product)} />
          <DetailItem label="Base Unit" value={getUnitName(product)} />
          <DetailItem label="Default Supplier" value={getSupplierName(product)} />
          <DetailItem label="Purchase Price" value={formatMoney(product.purchasePrice, product.currency)} />
          <DetailItem label="Selling Price" value={formatMoney(product.sellingPrice, product.currency)} />
          <DetailItem label="Wholesale Price" value={formatMoney(product.wholesalePrice, product.currency)} />
          <DetailItem label="Tracking" value={pretty(product.trackingType)} />
          <DetailItem label="Costing Method" value={pretty(product.costingMethod)} />
          <DetailItem label="Reorder Level" value={String(product.reorderLevel ?? 0)} />
        </div>

        {clean(product.description) ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-gray-700">{product.description}</p>
          </div>
        ) : null}
      </div>
    </ModalShell>
  )
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}

function ConfirmProductActionModal({ state, onClose, onConfirm }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title}
      subtitle={state.product?.name || ""}
      icon={<Icon icon={state.danger ? Alert02Icon : Tick02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={state.loading}>Cancel</button>
          <button
            className={cn(button, state.danger ? dangerButton : primaryButton)}
            type="button"
            onClick={onConfirm}
            disabled={state.loading}
          >
            {state.loading ? <Spinner /> : <Icon icon={Tick02Icon} className="h-4 w-4" />}
            {state.loading ? "Processing..." : "Confirm"}
          </button>
        </div>
      }
    >
      {state.error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div>
      ) : null}
      <p className="text-sm font-semibold leading-6 text-gray-700">{state.message}</p>
    </ModalShell>
  )
}

function DeleteProductModal({ state, setState, onClose, onSubmit }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title="Delete product"
      subtitle={state.product?.name || ""}
      icon={<Icon icon={Cancel01Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={state.loading}>Cancel</button>
          <button
            className={cn(button, dangerButton)}
            type="submit"
            form="product-delete-form"
            disabled={state.loading}
          >
            {state.loading ? <Spinner /> : <Icon icon={Cancel01Icon} className="h-4 w-4" />}
            {state.loading ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      }
    >
      {state.error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div>
      ) : null}

      <form id="product-delete-form" onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          Permanent delete cannot be undone. Products referenced by transactions should normally be archived instead.
        </div>
        <Field label="Your Password" required>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            value={state.password}
            onChange={(event) => setState((previous) => ({ ...previous, password: event.target.value, error: "" }))}
            placeholder="Enter password"
            required
            autoFocus
          />
        </Field>
      </form>
    </ModalShell>
  )
}

function ProductFormModal({
  open,
  item,
  form,
  setForm,
  categoryOptions,
  brandOptions,
  unitOptions,
  supplierOptions,
  supplierOptionsAvailable,
  supplierOptionsLoading,
  categoryMap,
  brandMap,
  unitMap,
  supplierMap,
  error,
  saving,
  onClose,
  onSubmit,
  onProductTypeChange,
  onTrackInventoryChange,
  onTaxTypeChange,
}) {
  const imageUrl = clean(form.imageUrl)
  const [imageFailed, setImageFailed] = useState(false)

  const isInventoryProduct = form.productType === "inventory"
  const inventoryControlsEnabled =
    isInventoryProduct && Boolean(form.trackInventory)

  useEffect(() => {
    setImageFailed(false)
  }, [imageUrl, open])

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update product" : "Add product"}
      subtitle={
        item
          ? form.name || "Edit product information."
          : "Create an inventory item, non-inventory item, or service."
      }
      icon={
        <Icon
          icon={item ? Edit02Icon : Add01Icon}
          className="h-5 w-5"
        />
      }
      maxWidthClass="max-w-6xl"
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
            form="product-form"
            disabled={saving}
          >
            <Icon
              icon={saving ? RefreshIcon : FloppyDiskIcon}
              className={cn(
                "h-4 w-4",
                saving ? "animate-spin" : ""
              )}
            />

            {saving
              ? "Saving..."
              : item
                ? "Update product"
                : "Save product"}
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

      <form id="product-form" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionCard
            title="Product identity"
            description="Core identifiers and reusable product assignments."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Product Name" required>
                <FocusPlaceholderInput
                  className={input}
                  value={form.name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: Premium Cotton T-Shirt"
                  maxLength={160}
                  required
                />
              </Field>

              <Field label="SKU" required>
                <FocusPlaceholderInput
                  className={input}
                  value={form.sku}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      sku: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Example: TSHIRT-BLK-M"
                  maxLength={80}
                  required
                />
              </Field>

              <Field label="Barcode" hint="Optional">
                <FocusPlaceholderInput
                  className={input}
                  value={form.barcode}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      barcode: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Scan or enter barcode"
                  maxLength={120}
                />
              </Field>

              <Field label="Product Type" required>
                <select
                  className={input}
                  value={form.productType}
                  onChange={(event) =>
                    onProductTypeChange(event.target.value)
                  }
                  required
                >
                  {PRODUCT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Category" hint="Optional">
                <RelationSelect
                  value={form.category}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      category: event.target.value,
                    }))
                  }
                  options={categoryOptions}
                  map={categoryMap}
                  type="category"
                  emptyLabel="No category"
                  currentLabel="Current category"
                />
              </Field>

              <Field label="Brand" hint="Optional">
                <RelationSelect
                  value={form.brand}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      brand: event.target.value,
                    }))
                  }
                  options={brandOptions}
                  map={brandMap}
                  type="brand"
                  emptyLabel="No brand"
                  currentLabel="Current brand"
                />
              </Field>

              <Field label="Base Unit" hint="Optional">
                <RelationSelect
                  value={form.baseUnit}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      baseUnit: event.target.value,
                    }))
                  }
                  options={unitOptions}
                  map={unitMap}
                  type="unit"
                  emptyLabel="No base unit"
                  currentLabel="Current base unit"
                />
              </Field>

              <Field
                label="Default Supplier"
                hint={
                  supplierOptionsAvailable
                    ? supplierOptionsLoading
                      ? "Loading active suppliers..."
                      : "All suppliers are shown; only approved active suppliers can be selected as the default."
                    : "Supplier options are currently unavailable."
                }
              >
                <RelationSelect
                  value={form.defaultSupplier}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      defaultSupplier: event.target.value,
                    }))
                  }
                  options={supplierOptions}
                  map={supplierMap}
                  type="supplier"
                  emptyLabel="No default supplier"
                  currentLabel="Current supplier"
                  disabled={
                    supplierOptionsLoading ||
                    (!supplierOptionsAvailable &&
                      !form.defaultSupplier)
                  }
                />
              </Field>

              <Field label="Status" required>
                <select
                  className={input}
                  value={form.status}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      status: event.target.value,
                    }))
                  }
                  required
                >
                  {PRODUCT_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Image URL" hint="Optional">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.imageUrl}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        imageUrl: event.target.value,
                      }))
                    }
                    placeholder="https://example.com/product-image.jpg"
                    maxLength={1000}
                    type="url"
                  />
                </Field>
              </div>

              <div className="flex items-end">
                <div className="flex h-[84px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-white">
                  {imageUrl && !imageFailed ? (
                    <img
                      src={imageUrl}
                      alt="Product preview"
                      className="h-full w-full object-cover"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-400">
                      <Icon icon={Image01Icon} className="h-5 w-5" />
                      Image preview
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Description" hint="Optional">
                  <FocusPlaceholderTextarea
                    className={cn(input, "min-h-[110px] resize-none")}
                    value={form.description}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Write a clear product description..."
                    maxLength={3000}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Pricing and tax"
            description="Purchase, retail, wholesale, minimum sale price, currency, and tax treatment."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Purchase Price">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      purchasePrice: event.target.value,
                    }))
                  }
                  placeholder="Example: 500"
                />
              </Field>

              <Field label="Selling Price">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      sellingPrice: event.target.value,
                    }))
                  }
                  placeholder="Example: 750"
                />
              </Field>

              <Field label="Wholesale Price">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.wholesalePrice}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      wholesalePrice: event.target.value,
                    }))
                  }
                  placeholder="Example: 650"
                />
              </Field>

              <Field
                label="Minimum Selling Price"
                hint="Cannot exceed the selling price."
              >
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumSellingPrice}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      minimumSellingPrice: event.target.value,
                    }))
                  }
                  placeholder="Example: 600"
                />
              </Field>

              <Field label="Currency" required>
                <FocusPlaceholderInput
                  className={input}
                  value={form.currency}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      currency: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Example: BDT"
                  maxLength={12}
                  required
                />
              </Field>

              <Field label="Tax Type" required>
                <select
                  className={input}
                  value={form.taxType}
                  onChange={(event) =>
                    onTaxTypeChange(event.target.value)
                  }
                  required
                >
                  {TAX_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Tax Rate (%)"
                hint={
                  form.taxType === "none"
                    ? "Tax rate is disabled when tax type is none."
                    : "Use a value from 0 to 100."
                }
              >
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.taxRate}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      taxRate: event.target.value,
                    }))
                  }
                  placeholder="Example: 15"
                  disabled={form.taxType === "none"}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Inventory controls"
            description="Stock tracking is available only for inventory products."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      Track Inventory
                    </p>

                    <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                      Maintain stock quantities for this product.
                    </p>
                  </div>

                  <Toggle
                    checked={Boolean(form.trackInventory)}
                    onChange={onTrackInventoryChange}
                    disabled={!isInventoryProduct}
                    label="Track product inventory"
                  />
                </div>
              </div>

              {!isInventoryProduct ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm font-semibold text-indigo-800">
                  Non-inventory products and services do not maintain
                  stock, batch, serial, or reorder values.
                </div>
              ) : null}

              <Field label="Tracking Type">
                <select
                  className={input}
                  value={form.trackingType}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      trackingType: event.target.value,
                    }))
                  }
                  disabled={!inventoryControlsEnabled}
                >
                  {TRACKING_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Costing Method">
                <select
                  className={input}
                  value={form.costingMethod}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      costingMethod: event.target.value,
                    }))
                  }
                >
                  {COSTING_METHODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Reorder Level">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.reorderLevel}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      reorderLevel: event.target.value,
                    }))
                  }
                  placeholder="Example: 10"
                  disabled={!inventoryControlsEnabled}
                />
              </Field>

              <Field label="Minimum Stock">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumStock}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      minimumStock: event.target.value,
                    }))
                  }
                  placeholder="Example: 5"
                  disabled={!inventoryControlsEnabled}
                />
              </Field>

              <Field
                label="Maximum Stock"
                hint="Use 0 when no maximum limit is required."
              >
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maximumStock}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      maximumStock: event.target.value,
                    }))
                  }
                  placeholder="Example: 100"
                  disabled={!inventoryControlsEnabled}
                />
              </Field>
            </div>
          </SectionCard>
        </div>
      </form>
    </ModalShell>
  )
}
