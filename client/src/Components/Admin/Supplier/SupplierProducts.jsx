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

const SUPPLIER_MANAGE_PERMISSION =
  PERMISSIONS?.SUPPLIER_MANAGE || "supplier:manage"
const SUPPLIER_DELETE_PERMISSION =
  PERMISSIONS?.SUPPLIER_DELETE || "supplier:delete"

const FALLBACK_META = {
  supplierProductStatuses: ["active", "inactive", "archived"],
  taxTypes: ["none", "inclusive", "exclusive"],
}

const CURRENT_STATUSES = ["active", "inactive"]

const emptyStats = {
  productLinkCount: 0,
  activeProductLinkCount: 0,
  inactiveProductLinkCount: 0,
  archivedProductLinkCount: 0,
  preferredProductLinkCount: 0,
  defaultProductCount: 0,
}

const emptyForm = {
  product: "",
  purchaseUnit: "",
  supplierSku: "",
  unitPrice: "0",
  currency: "BDT",
  minimumOrderQuantity: "0",
  packSize: "1",
  leadTimeDays: "0",
  taxType: "none",
  taxRate: "0",
  isPreferred: false,
  validFrom: "",
  validTo: "",
  notes: "",
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

function formatDate(value) {
  if (!value) return "-"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function formatNumber(value, maximumFractionDigits = 6) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function formatMoney(value, currency = "BDT") {
  return `${clean(currency || "BDT")} ${Number(value || 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }
  )}`
}

function relationLabel(item, fallback = "Unnamed") {
  if (!item) return fallback

  const name = item.businessName || item.name || item.label || fallback
  const code = item.code || item.sku || item.symbol || ""

  return `${name}${code ? ` (${code})` : ""}`
}

function isPriceActive(link) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const from = link.validFrom ? new Date(link.validFrom) : null
  const to = link.validTo ? new Date(link.validTo) : null

  if (from) from.setHours(0, 0, 0, 0)
  if (to) to.setHours(23, 59, 59, 999)

  return (!from || from <= today) && (!to || to >= today)
}

function priceValidityLabel(link) {
  if (link.status === "archived") return "Archived"
  if (!link.validFrom && !link.validTo) return "No expiry"

  const now = new Date()
  const from = link.validFrom ? new Date(link.validFrom) : null
  const to = link.validTo ? new Date(link.validTo) : null

  if (from && from > now) return "Upcoming"
  if (to && to < now) return "Expired"
  return "Valid"
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
        <p className="mt-1 text-xs font-medium text-gray-500">{hint}</p>
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

function SupplierStatusBadge({ value }) {
  const status = String(value || "").toLowerCase()
  const style =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "pending_approval"
        ? "bg-sky-50 text-sky-700 ring-sky-100"
        : status === "on_hold"
          ? "bg-amber-50 text-amber-700 ring-amber-100"
          : status === "draft"
            ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
            : "bg-gray-100 text-gray-700 ring-gray-200"

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

function PreferredBadge({ value }) {
  return value ? (
    <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-100">
      Preferred
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-500 ring-1 ring-gray-200">
      Standard
    </span>
  )
}

function ValidityBadge({ link }) {
  const label = priceValidityLabel(link)
  const style =
    label === "Valid" || label === "No expiry"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : label === "Upcoming"
        ? "bg-sky-50 text-sky-700 ring-sky-100"
        : label === "Expired"
          ? "bg-rose-50 text-rose-700 ring-rose-100"
          : "bg-amber-50 text-amber-700 ring-amber-100"

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        style
      )}
    >
      {label}
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
    const error = new Error(data?.message || data?.error || "Request failed")
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

function SummaryCards({ supplier, stats, onSelectTab }) {
  const items = [
    {
      label: "Linked Products",
      value: formatNumber(stats.productLinkCount, 0),
      note: "All lifecycle states",
      tab: "all",
    },
    {
      label: "Active Links",
      value: formatNumber(stats.activeProductLinkCount, 0),
      note: "Available for purchasing",
      tab: "active",
    },
    {
      label: "Inactive Links",
      value: formatNumber(stats.inactiveProductLinkCount, 0),
      note: "Temporarily unavailable",
      tab: "inactive",
    },
    {
      label: "Archived Links",
      value: formatNumber(stats.archivedProductLinkCount, 0),
      note: "Preserved history",
      tab: "archived",
    },
    {
      label: "Preferred Products",
      value: formatNumber(stats.preferredProductLinkCount, 0),
      note: "Default purchasing source",
      tab: "preferred",
    },
    {
      label: "Supplier Status",
      value: pretty(supplier?.status || "not selected"),
      note:
        supplier?.status === "active"
          ? "Active links can be created"
          : "Activate supplier for active links",
      tab: "all",
    },
  ]

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onSelectTab(item.tab)}
          disabled={!supplier}
          className={cn(
            card,
            "p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/20 disabled:cursor-default disabled:opacity-70"
          )}
        >
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">
            {item.label}
          </p>
          <p className="mt-2 truncate text-xl font-black text-gray-900">
            {item.value}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-gray-500">
            {item.note}
          </p>
        </button>
      ))}
    </div>
  )
}

export default function SupplierProducts({ initialSupplierId = "" }) {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, SUPPLIER_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, SUPPLIER_DELETE_PERMISSION)

  const [meta, setMeta] = useState(FALLBACK_META)
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplierId, setSelectedSupplierId] = useState(
    initialSupplierId || ""
  )
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [stats, setStats] = useState(emptyStats)
  const [products, setProducts] = useState([])
  const [units, setUnits] = useState([])
  const [links, setLinks] = useState([])

  const [activeTab, setActiveTab] = useState("all")
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingSupplier, setLoadingSupplier] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [openingId, setOpeningId] = useState("")
  const [loadingDetailsId, setLoadingDetailsId] = useState("")

  const [formModal, setFormModal] = useState({
    open: false,
    item: null,
  })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    link: null,
  })

  const [filters, setFilters] = useState({
    q: "",
    product: "all",
    currency: "all",
    activeOn: "",
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

  const unitMap = useMemo(
    () =>
      new Map(
        units
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [units]
  )

  const supplierMap = useMemo(
    () =>
      new Map(
        suppliers
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [suppliers]
  )

  const selectedProductName = useMemo(() => {
    if (filters.product === "all") return ""
    return relationLabel(
      productMap.get(String(filters.product)),
      "Selected product"
    )
  }, [filters.product, productMap])

  const currencyOptions = useMemo(() => {
    const values = new Set(["BDT", "USD", "EUR", "GBP"])

    for (const link of links) {
      if (clean(link.currency)) values.add(clean(link.currency).toUpperCase())
    }

    if (selectedSupplier?.procurement?.currency) {
      values.add(selectedSupplier.procurement.currency)
    }

    return [...values]
  }, [links, selectedSupplier])

  const locallyFilteredLinks = useMemo(() => {
    const q = clean(filters.q).toLowerCase()
    if (!q) return links

    return links.filter((link) =>
      [
        link.supplierSku,
        link.product?.name,
        link.product?.sku,
        link.product?.barcode,
        link.purchaseUnit?.name,
        link.purchaseUnit?.code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    )
  }, [links, filters.q])

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (activeTab !== "all") count += 1
    if (clean(filters.q)) count += 1
    if (filters.product !== "all") count += 1
    if (filters.currency !== "all") count += 1
    if (filters.activeOn) count += 1

    return count
  }, [activeTab, filters])

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const resetFilters = () => {
    setActiveTab("all")
    setFilters({
      q: "",
      product: "all",
      currency: "all",
      activeOn: "",
    })
  }

  const loadReferenceData = async () => {
    try {
      const [metaData, supplierData, productData, unitData] = await Promise.all([
        api("/suppliers/meta"),
        api("/suppliers?limit=100"),
        api("/inventory/products?status=active&limit=100"),
        api("/inventory/units/options?limit=200"),
      ])

      setMeta({
        ...FALLBACK_META,
        ...(metaData || {}),
      })
      setSuppliers(supplierData.suppliers || [])
      setProducts(productData.products || [])
      setUnits(unitData.units || [])

      if (!selectedSupplierId) {
        const initial =
          supplierData.suppliers?.find(
            (supplier) => supplier.status === "active"
          ) || supplierData.suppliers?.[0]

        if (initial?._id) {
          setSelectedSupplierId(initial._id)
        }
      }
    } catch (error) {
      toast.error(error.message || "Failed to load supplier-product options")
    }
  }

  const loadSupplier = async (supplierId, { signal } = {}) => {
    if (!supplierId) {
      setSelectedSupplier(null)
      setStats(emptyStats)
      return
    }

    setLoadingSupplier(true)

    try {
      const data = await api(`/suppliers/${supplierId}`, { signal })
      setSelectedSupplier(data.supplier || null)
      setStats({
        ...emptyStats,
        ...(data.stats || {}),
      })
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load selected supplier")
      }
    } finally {
      setLoadingSupplier(false)
    }
  }

  const buildListParams = ({ append = false } = {}) => {
    const params = new URLSearchParams({
      limit: "50",
    })

    if (["active", "inactive", "archived"].includes(activeTab)) {
      params.set("status", activeTab)
    }

    if (activeTab === "preferred") {
      params.set("isPreferred", "true")
    }

    if (filters.product !== "all") {
      params.set("product", filters.product)
    }

    if (filters.currency !== "all") {
      params.set("currency", filters.currency)
    }

    if (filters.activeOn) {
      params.set("activeOn", filters.activeOn)
    }

    if (append && nextCursor) {
      params.set("cursor", nextCursor)
    }

    return params
  }

  const loadLinks = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (!selectedSupplierId) {
      setLinks([])
      setHasMore(false)
      setNextCursor(null)
      return
    }

    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const data = await api(
        `/suppliers/${selectedSupplierId}/products?${buildListParams({
          append,
        }).toString()}`,
        { signal }
      )

      const incoming = data.supplierProducts || []
      setLinks((previous) =>
        append ? [...previous, ...incoming] : incoming
      )
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load supplier products")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    loadReferenceData()
  }, [])

  useEffect(() => {
    if (!selectedSupplierId) return undefined

    const controller = new AbortController()

    Promise.all([
      loadSupplier(selectedSupplierId, {
        signal: controller.signal,
      }),
      loadLinks({ signal: controller.signal }),
    ])

    return () => controller.abort()
  }, [
    selectedSupplierId,
    activeTab,
    filters.product,
    filters.currency,
    filters.activeOn,
  ])

  const refresh = async () => {
    if (!selectedSupplierId) {
      await loadReferenceData()
      return
    }

    await Promise.all([
      loadReferenceData(),
      loadSupplier(selectedSupplierId),
      loadLinks(),
    ])
  }

  const selectSupplier = (supplierId) => {
    setSelectedSupplierId(supplierId)
    setLinks([])
    setActiveTab("all")
    setHasMore(false)
    setNextCursor(null)
    setFilters({
      q: "",
      product: "all",
      currency: "all",
      activeOn: "",
    })
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
    setHasMore(false)
    setNextCursor(null)
  }

  const openCreateModal = () => {
    if (!selectedSupplier) {
      toast.error("Select a supplier first.")
      return
    }

    setFormError("")
    setForm({
      ...emptyForm,
      currency: selectedSupplier.procurement?.currency || "BDT",
      status: selectedSupplier.status === "active" ? "active" : "inactive",
    })
    setFormModal({
      open: true,
      item: null,
    })
  }

  const openEditModal = async (link) => {
    if (link.status === "archived") {
      toast.error("Restore the archived product link before editing it.")
      return
    }

    setOpeningId(link._id)
    setFormError("")

    try {
      const data = await api(
        `/suppliers/${selectedSupplierId}/products/${link._id}`
      )
      const item = data.supplierProduct

      setForm({
        product: normalizeId(item.product),
        purchaseUnit: normalizeId(item.purchaseUnit),
        supplierSku: item.supplierSku || "",
        unitPrice: String(item.unitPrice ?? 0),
        currency: item.currency || "BDT",
        minimumOrderQuantity: String(item.minimumOrderQuantity ?? 0),
        packSize: String(item.packSize ?? 1),
        leadTimeDays: String(item.leadTimeDays ?? 0),
        taxType: item.taxType || "none",
        taxRate: String(item.taxRate ?? 0),
        isPreferred: Boolean(item.isPreferred),
        validFrom: toDateInput(item.validFrom),
        validTo: toDateInput(item.validTo),
        notes: item.notes || "",
        status: item.status || "active",
      })

      setFormModal({
        open: true,
        item,
      })
    } catch (error) {
      toast.error(error.message || "Failed to load supplier-product link")
    } finally {
      setOpeningId("")
    }
  }

  const closeFormModal = () => {
    if (saving) return

    setFormModal({
      open: false,
      item: null,
    })
    setForm(emptyForm)
    setFormError("")
  }

  const updateTaxType = (taxType) => {
    setForm((previous) => ({
      ...previous,
      taxType,
      taxRate: taxType === "none" ? "0" : previous.taxRate,
    }))
  }

  const updatePreferred = (isPreferred) => {
    setForm((previous) => ({
      ...previous,
      isPreferred,
      status: isPreferred ? "active" : previous.status,
    }))
  }

  const updateStatus = (status) => {
    setForm((previous) => ({
      ...previous,
      status,
      isPreferred: status === "active" ? previous.isPreferred : false,
    }))
  }

  const validateForm = () => {
    if (!form.product) return "Product is required."

    for (const [label, value] of [
      ["Unit price", form.unitPrice],
      ["Minimum order quantity", form.minimumOrderQuantity],
      ["Lead time days", form.leadTimeDays],
      ["Tax rate", form.taxRate],
    ]) {
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        return `${label} must be a valid non-negative number.`
      }
    }

    if (!Number.isFinite(Number(form.packSize)) || Number(form.packSize) <= 0) {
      return "Pack size must be greater than zero."
    }

    if (
      !Number.isInteger(Number(form.leadTimeDays)) ||
      Number(form.leadTimeDays) > 3650
    ) {
      return "Lead time days must be a whole number between 0 and 3650."
    }

    if (Number(form.taxRate) > 100) {
      return "Tax rate cannot be greater than 100."
    }

    if (
      form.validFrom &&
      form.validTo &&
      new Date(form.validTo) < new Date(form.validFrom)
    ) {
      return "Price validity end date cannot be before the start date."
    }

    if (
      (form.status === "active" || form.isPreferred) &&
      selectedSupplier?.status !== "active"
    ) {
      return "Activate the supplier before creating an active or preferred product link."
    }

    return ""
  }

  const buildPayload = () => ({
    product: form.product,
    purchaseUnit: form.purchaseUnit || null,
    supplierSku: clean(form.supplierSku).toUpperCase(),
    unitPrice: Number(form.unitPrice || 0),
    currency: clean(form.currency || "BDT").toUpperCase(),
    minimumOrderQuantity: Number(form.minimumOrderQuantity || 0),
    packSize: Number(form.packSize || 1),
    leadTimeDays: Number(form.leadTimeDays || 0),
    taxType: form.taxType,
    taxRate: form.taxType === "none" ? 0 : Number(form.taxRate || 0),
    isPreferred: Boolean(form.isPreferred),
    validFrom: form.validFrom || null,
    validTo: form.validTo || null,
    notes: clean(form.notes),
    status: form.status,
  })

  const saveLink = async (event) => {
    event.preventDefault()
    setFormError("")

    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)

    try {
      const path = formModal.item?._id
        ? `/suppliers/${selectedSupplierId}/products/${formModal.item._id}`
        : `/suppliers/${selectedSupplierId}/products`

      const data = await api(path, {
        method: formModal.item?._id ? "PATCH" : "POST",
        body: JSON.stringify(buildPayload()),
      })

      toast.success(
        data.message ||
          (formModal.item
            ? "Supplier product updated"
            : "Supplier product linked")
      )

      setFormModal({
        open: false,
        item: null,
      })
      setForm(emptyForm)
      setFormError("")

      await Promise.all([
        loadLinks(),
        loadSupplier(selectedSupplierId),
      ])
    } catch (error) {
      setFormError(error.message || "Failed to save supplier product.")
    } finally {
      setSaving(false)
    }
  }

  const openDetailsModal = async (link) => {
    setLoadingDetailsId(link._id)

    try {
      const data = await api(
        `/suppliers/${selectedSupplierId}/products/${link._id}`
      )

      setDetailsModal({
        open: true,
        link: data.supplierProduct,
      })
    } catch (error) {
      toast.error(error.message || "Failed to load link details")
    } finally {
      setLoadingDetailsId("")
    }
  }

  const updateLinkStatus = async (link, status) => {
    if (status === link.status) return

    if (status === "active" && selectedSupplier?.status !== "active") {
      toast.error("Activate the supplier before activating its product link.")
      return
    }

    try {
      const data = await api(
        `/suppliers/${selectedSupplierId}/products/${link._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      )

      toast.success(data.message || `Link marked ${status}`)
      await Promise.all([
        loadLinks(),
        loadSupplier(selectedSupplierId),
      ])
    } catch (error) {
      toast.error(error.message || "Failed to update link status")
    }
  }

  const archiveLink = async (link) => {
    const confirmed = window.confirm(
      `Archive the supplier-product link for "${link.product?.name || "this product"}"? Historical purchasing references will remain safe.`
    )

    if (!confirmed) return

    try {
      const data = await api(
        `/suppliers/${selectedSupplierId}/products/${link._id}`,
        {
          method: "DELETE",
        }
      )

      toast.success(data.message || "Supplier-product link archived")
      await Promise.all([
        loadLinks(),
        loadSupplier(selectedSupplierId),
      ])
    } catch (error) {
      toast.error(error.message || "Failed to archive product link")
    }
  }

  const restoreLink = async (link) => {
    try {
      const data = await api(
        `/suppliers/${selectedSupplierId}/products/${link._id}/restore`,
        {
          method: "PATCH",
        }
      )

      toast.success(data.message || "Product link restored as inactive")
      await Promise.all([
        loadLinks(),
        loadSupplier(selectedSupplierId),
      ])
    } catch (error) {
      toast.error(error.message || "Failed to restore product link")
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
                Supplier Products
              </h1>

              <p className="mt-0.5 text-sm text-gray-500">
                Connect products with supplier SKUs, purchase units, prices,
                order limits, lead times, tax, and preferred sourcing.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={cn(button, ghostButton)}
              onClick={refresh}
              disabled={loading || loadingSupplier}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn(
                  "h-4 w-4",
                  loading || loadingSupplier ? "animate-spin" : ""
                )}
              />
              Refresh
            </button>

            {canManage ? (
              <button
                className={cn(button, primaryButton)}
                onClick={openCreateModal}
                disabled={!selectedSupplier}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Link Product
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(280px,380px)_1fr] xl:items-start">
          <Field label="Supplier" required>
            <select
              className={input}
              value={selectedSupplierId}
              onChange={(event) => selectSupplier(event.target.value)}
            >
              <option value="">Select supplier</option>

              {selectedSupplierId &&
              !suppliers.some(
                (supplier) =>
                  String(supplier._id) === String(selectedSupplierId)
              ) ? (
                <option value={selectedSupplierId}>
                  {relationLabel(selectedSupplier, "Current supplier")}
                </option>
              ) : null}

              {suppliers.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>
                  {relationLabel(supplier)} — {pretty(supplier.status)}
                </option>
              ))}
            </select>
          </Field>

          <HeaderSearchFilters
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            activeFilterCount={activeFilterCount}
            selectedProductName={selectedProductName}
            onOpenFilters={() => setFilterOpen(true)}
            onClearTab={() => setActiveTab("all")}
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {selectedSupplier ? (
              <>
                <span className="text-sm font-black text-gray-900">
                  {selectedSupplier.businessName}
                </span>
                <span className="text-xs font-black text-indigo-700">
                  {selectedSupplier.code}
                </span>
                <SupplierStatusBadge value={selectedSupplier.status} />
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-500">
                Select a supplier to manage its product links.
              </span>
            )}
          </div>

          <p className="text-sm font-bold text-gray-500">
            Showing{" "}
            <span className="text-gray-900">
              {locallyFilteredLinks.length}
            </span>{" "}
            product links
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      <SummaryCards
        supplier={selectedSupplier}
        stats={stats}
        onSelectTab={switchTab}
      />

      {selectedSupplier && selectedSupplier.status !== "active" ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          This supplier is {pretty(selectedSupplier.status).toLowerCase()}.
          New links are saved as inactive, and active or preferred links require
          an active supplier.
        </div>
      ) : null}

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only supplier-product access. Link, edit, status,
          archive, and restore controls depend on supplier permissions.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {[
            ["all", "Current"],
            ["active", "Active"],
            ["inactive", "Inactive"],
            ["preferred", "Preferred"],
            ["archived", "Archived"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={cn(
                "inline-flex items-center justify-center rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm",
                activeTab === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => switchTab(key)}
              disabled={!selectedSupplier}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <SupplierProductList
        links={locallyFilteredLinks}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        hasSupplier={Boolean(selectedSupplier)}
        supplier={selectedSupplier}
        openingId={openingId}
        loadingDetailsId={loadingDetailsId}
        canManage={canManage}
        canDelete={canDelete}
        onView={openDetailsModal}
        onEdit={openEditModal}
        onStatusChange={updateLinkStatus}
        onArchive={archiveLink}
        onRestore={restoreLink}
        onLoadMore={() => loadLinks({ append: true })}
      />

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        products={products}
        currencies={currencyOptions}
        selectedProductName={selectedProductName}
      />

      <SupplierProductFormModal
        state={formModal}
        supplier={selectedSupplier}
        form={form}
        setForm={setForm}
        products={products}
        units={units}
        productMap={productMap}
        unitMap={unitMap}
        meta={meta}
        error={formError}
        saving={saving}
        onClose={closeFormModal}
        onSubmit={saveLink}
        onTaxTypeChange={updateTaxType}
        onPreferredChange={updatePreferred}
        onStatusChange={updateStatus}
      />

      <SupplierProductDetailsModal
        state={detailsModal}
        supplier={selectedSupplier}
        onClose={() =>
          setDetailsModal({
            open: false,
            link: null,
          })
        }
      />
    </div>
  )
}

function HeaderSearchFilters({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  selectedProductName,
  onOpenFilters,
  onClearTab,
}) {
  return (
    <div className="w-full">
      <div className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon
          icon={Search01Icon}
          className="h-4 w-4 shrink-0 text-gray-400"
        />

        {activeTab !== "all" ? (
          <FilterChip
            label="View"
            value={pretty(activeTab)}
            onClear={onClearTab}
          />
        ) : null}

        {filters.product !== "all" ? (
          <FilterChip
            label="Product"
            value={selectedProductName || "Selected product"}
            onClear={() => updateFilter("product", "all")}
          />
        ) : null}

        {filters.currency !== "all" ? (
          <FilterChip
            label="Currency"
            value={filters.currency}
            onClear={() => updateFilter("currency", "all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search loaded product links..."
          type="text"
          aria-label="Search supplier products"
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

function FilterModal({
  open,
  onClose,
  activeTab,
  setActiveTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  products,
  currencies,
  selectedProductName,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Supplier-product filters"
      subtitle="Filter the selected supplier's product prices and purchasing terms."
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
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
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Link Status">
          <select
            className={input}
            value={activeTab}
            onChange={(event) => setActiveTab(event.target.value)}
          >
            <option value="all">Active + Inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="preferred">Preferred only</option>
            <option value="archived">Archived</option>
          </select>
        </Field>

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

        <Field label="Currency">
          <select
            className={input}
            value={filters.currency}
            onChange={(event) =>
              updateFilter("currency", event.target.value)
            }
          >
            <option value="all">All currencies</option>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Price Active On"
          hint="Show links whose validity range includes this date."
        >
          <input
            className={input}
            type="date"
            value={filters.activeOn}
            onChange={(event) =>
              updateFilter("activeOn", event.target.value)
            }
          />
        </Field>
      </div>
    </ModalShell>
  )
}

function SupplierProductList({
  links,
  loading,
  loadingMore,
  hasMore,
  hasSupplier,
  supplier,
  openingId,
  loadingDetailsId,
  canManage,
  canDelete,
  onView,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  onLoadMore,
}) {
  return (
    <div>
      <div className={cn(card, "overflow-hidden")}>
        <div className="hidden max-h-[680px] overflow-auto xl:block">
          <table className="min-w-[1550px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Supplier SKU</th>
                <th className="px-5 py-3">Purchase Unit</th>
                <th className="px-5 py-3">Unit Price</th>
                <th className="px-5 py-3">MOQ</th>
                <th className="px-5 py-3">Pack Size</th>
                <th className="px-5 py-3">Lead Time</th>
                <th className="px-5 py-3">Tax</th>
                <th className="px-5 py-3">Preferred</th>
                <th className="px-5 py-3">Price Validity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {links.map((link) => (
                <tr
                  key={link._id}
                  className="group bg-white transition hover:bg-gray-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="min-w-[235px]">
                      <p className="truncate text-sm font-black text-gray-900">
                        {link.product?.name || "Unknown product"}
                      </p>
                      <p className="mt-0.5 text-xs font-black text-indigo-700">
                        {link.product?.sku || "-"}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">
                        {link.product?.barcode || "No barcode"}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {link.supplierSku || "-"}
                  </td>

                  <td className="px-5 py-4">
                    <p className="min-w-[145px] text-sm font-black text-gray-800">
                      {link.purchaseUnit?.name || "Base unit"}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {link.purchaseUnit?.symbol ||
                        link.purchaseUnit?.code ||
                        "Product base unit"}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-900">
                    {formatMoney(link.unitPrice, link.currency)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatNumber(link.minimumOrderQuantity)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatNumber(link.packSize)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatNumber(link.leadTimeDays, 0)} days
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-gray-700">
                      {pretty(link.taxType)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {formatNumber(link.taxRate, 2)}%
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <PreferredBadge value={link.isPreferred} />
                  </td>

                  <td className="px-5 py-4">
                    <div className="min-w-[165px]">
                      <ValidityBadge link={link} />
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        {formatDate(link.validFrom)} — {formatDate(link.validTo)}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge value={link.status} />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                    {formatDate(link.updatedAt)}
                  </td>

                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                    <SupplierProductActions
                      link={link}
                      supplier={supplier}
                      opening={String(openingId) === String(link._id)}
                      loadingDetails={
                        String(loadingDetailsId) === String(link._id)
                      }
                      canManage={canManage}
                      canDelete={canDelete}
                      onView={onView}
                      onEdit={onEdit}
                      onStatusChange={onStatusChange}
                      onArchive={onArchive}
                      onRestore={onRestore}
                    />
                  </td>
                </tr>
              ))}

              {!links.length ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-5 py-14 text-center text-sm font-bold text-gray-500"
                  >
                    {!hasSupplier
                      ? "Select a supplier to view linked products."
                      : loading
                        ? "Loading supplier products..."
                        : "No supplier-product links found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 xl:hidden">
          {links.map((link) => (
            <SupplierProductMobileCard
              key={link._id}
              link={link}
              supplier={supplier}
              opening={String(openingId) === String(link._id)}
              loadingDetails={
                String(loadingDetailsId) === String(link._id)
              }
              canManage={canManage}
              canDelete={canDelete}
              onView={onView}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ))}

          {!links.length ? (
            <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
              {!hasSupplier
                ? "Select a supplier to view linked products."
                : loading
                  ? "Loading supplier products..."
                  : "No supplier-product links found."}
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

function SupplierProductMobileCard(props) {
  const { link } = props

  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 px-2 text-center text-xs font-black text-indigo-700">
          {(link.product?.sku || "P").slice(0, 4)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-900">
                {link.product?.name || "Unknown product"}
              </h3>
              <p className="mt-0.5 text-xs font-black text-indigo-700">
                {link.product?.sku || "-"}
              </p>
            </div>
            <StatusBadge value={link.status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <PreferredBadge value={link.isPreferred} />
            <ValidityBadge link={link} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <MiniMetric
              label="Supplier SKU"
              value={link.supplierSku || "-"}
            />
            <MiniMetric
              label="Purchase Unit"
              value={relationLabel(link.purchaseUnit, "Base unit")}
            />
            <MiniMetric
              label="Unit Price"
              value={formatMoney(link.unitPrice, link.currency)}
            />
            <MiniMetric
              label="MOQ"
              value={formatNumber(link.minimumOrderQuantity)}
            />
            <MiniMetric
              label="Pack Size"
              value={formatNumber(link.packSize)}
            />
            <MiniMetric
              label="Lead Time"
              value={`${formatNumber(link.leadTimeDays, 0)} days`}
            />
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <SupplierProductActions {...props} mobile />
          </div>
        </div>
      </div>
    </article>
  )
}

function MiniMetric({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black text-gray-800">
        {value}
      </p>
    </div>
  )
}

function SupplierProductActions({
  link,
  supplier,
  opening,
  loadingDetails,
  canManage,
  canDelete,
  onView,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  mobile = false,
}) {
  const actionClass = mobile ? "px-3 py-2" : "px-3"

  if (link.status === "archived") {
    return (
      <div
        className={cn(
          "flex gap-2",
          mobile ? "flex-wrap" : "justify-end"
        )}
      >
        <button
          className={cn(button, ghostButton, actionClass)}
          onClick={() => onView(link)}
          disabled={loadingDetails}
          type="button"
          title="View product link"
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
            className={cn(button, ghostButton, actionClass)}
            onClick={() => onRestore(link)}
            type="button"
            title="Restore product link"
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
        className={cn(button, ghostButton, actionClass)}
        onClick={() => onView(link)}
        disabled={loadingDetails}
        type="button"
        title="View product link"
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
        <>
          <select
            className={cn(
              "rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-black text-gray-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20",
              mobile ? "min-w-[126px]" : "w-[112px]"
            )}
            value={link.status}
            onChange={(event) =>
              onStatusChange(link, event.target.value)
            }
            aria-label={`Update ${link.product?.name || "product"} link status`}
          >
            {CURRENT_STATUSES.map((status) => (
              <option
                key={status}
                value={status}
                disabled={
                  status === "active" && supplier?.status !== "active"
                }
              >
                {pretty(status)}
              </option>
            ))}
          </select>

          <button
            className={cn(button, ghostButton, actionClass)}
            onClick={() => onEdit(link)}
            disabled={opening}
            type="button"
            title="Edit product link"
          >
            <Icon
              icon={opening ? RefreshIcon : Edit02Icon}
              className={cn(
                "h-4 w-4",
                opening ? "animate-spin" : ""
              )}
            />
            {mobile ? (opening ? "Loading" : "Edit") : null}
          </button>
        </>
      ) : null}

      {canDelete ? (
        <button
          className={cn(button, dangerButton, actionClass)}
          onClick={() => onArchive(link)}
          type="button"
          title="Archive product link"
        >
          <Icon icon={Archive02Icon} className="h-4 w-4" />
          {mobile ? "Archive" : null}
        </button>
      ) : null}
    </div>
  )
}

function SupplierProductFormModal({
  state,
  supplier,
  form,
  setForm,
  products,
  units,
  productMap,
  unitMap,
  meta,
  error,
  saving,
  onClose,
  onSubmit,
  onTaxTypeChange,
  onPreferredChange,
  onStatusChange,
}) {
  const product = productMap.get(String(form.product)) || state.item?.product
  const purchaseUnit =
    unitMap.get(String(form.purchaseUnit)) || state.item?.purchaseUnit
  const effectiveUnit = purchaseUnit || product?.baseUnit
  const orderValue =
    Number(form.unitPrice || 0) * Number(form.minimumOrderQuantity || 0)

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.item ? "Update supplier product" : "Link supplier product"}
      subtitle={
        supplier
          ? `${supplier.businessName} · ${supplier.code}`
          : "Supplier product"
      }
      icon={
        <Icon
          icon={state.item ? Edit02Icon : Add01Icon}
          className="h-5 w-5"
        />
      }
      maxWidthClass="max-w-6xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
              {formatMoney(form.unitPrice, form.currency)} per{" "}
              {effectiveUnit?.symbol || effectiveUnit?.code || "unit"}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
              MOQ value {formatMoney(orderValue, form.currency)}
            </span>
          </div>

          <div className="flex justify-end gap-2">
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
              form="supplier-product-form"
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
                : state.item
                  ? "Update Product Link"
                  : "Link Product"}
            </button>
          </div>
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

      <form id="supplier-product-form" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionCard
            title="Product and purchase unit"
            description="The product cannot be changed after this supplier link is created."
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Product" required>
                <select
                  className={input}
                  value={form.product}
                  onChange={(event) => {
                    const selected = productMap.get(event.target.value)
                    setForm((previous) => ({
                      ...previous,
                      product: event.target.value,
                      purchaseUnit:
                        normalizeId(selected?.baseUnit) || previous.purchaseUnit,
                      unitPrice:
                        Number(previous.unitPrice || 0) > 0
                          ? previous.unitPrice
                          : String(selected?.purchasePrice ?? 0),
                      currency:
                        selected?.currency || previous.currency || "BDT",
                    }))
                  }}
                  disabled={Boolean(state.item)}
                  required
                >
                  <option value="">Select product</option>

                  {form.product &&
                  !products.some(
                    (item) => String(item._id) === String(form.product)
                  ) ? (
                    <option value={form.product}>
                      {relationLabel(product, "Current product")}
                    </option>
                  ) : null}

                  {products.map((item) => (
                    <option key={item._id} value={item._id}>
                      {relationLabel(item)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Purchase Unit"
                hint="Leave empty to use the product base unit."
              >
                <select
                  className={input}
                  value={form.purchaseUnit}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      purchaseUnit: event.target.value,
                    }))
                  }
                >
                  <option value="">Use product base unit</option>

                  {form.purchaseUnit &&
                  !units.some(
                    (item) =>
                      String(item._id) === String(form.purchaseUnit)
                  ) ? (
                    <option value={form.purchaseUnit}>
                      {relationLabel(purchaseUnit, "Current unit")}
                    </option>
                  ) : null}

                  {units.map((item) => (
                    <option key={item._id} value={item._id}>
                      {relationLabel(item)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Supplier SKU" hint="Optional">
                <FocusPlaceholderInput
                  className={input}
                  value={form.supplierSku}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      supplierSku: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Example: SUP-RICE-25KG"
                  maxLength={120}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Pricing and purchasing terms"
            description="Define the price source used by RFQs and purchase documents."
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Unit Price" required>
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.unitPrice}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      unitPrice: event.target.value,
                    }))
                  }
                  placeholder="Example: 20"
                  required
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

              <Field label="Minimum Order Quantity">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.minimumOrderQuantity}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      minimumOrderQuantity: event.target.value,
                    }))
                  }
                  placeholder="Example: 50"
                />
              </Field>

              <Field
                label="Pack Size"
                hint="Number of purchase units in one supplier pack."
                required
              >
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={form.packSize}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      packSize: event.target.value,
                    }))
                  }
                  placeholder="Example: 25"
                  required
                />
              </Field>

              <Field label="Lead Time (Days)">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  max="3650"
                  step="1"
                  value={form.leadTimeDays}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      leadTimeDays: event.target.value,
                    }))
                  }
                  placeholder="Example: 3"
                />
              </Field>

              <Field label="Tax Type">
                <select
                  className={input}
                  value={form.taxType}
                  onChange={(event) =>
                    onTaxTypeChange(event.target.value)
                  }
                >
                  {(meta.taxTypes || FALLBACK_META.taxTypes).map((value) => (
                    <option key={value} value={value}>
                      {pretty(value)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tax Rate (%)">
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
                  placeholder="Example: 5"
                  disabled={form.taxType === "none"}
                />
              </Field>

              <Field label="Status">
                <select
                  className={input}
                  value={form.status}
                  onChange={(event) => onStatusChange(event.target.value)}
                >
                  {CURRENT_STATUSES.map((status) => (
                    <option
                      key={status}
                      value={status}
                      disabled={
                        status === "active" && supplier?.status !== "active"
                      }
                    >
                      {pretty(status)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Validity and sourcing preference"
            description="A preferred active link becomes the product's default supplier and replaces the previous preferred supplier."
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Valid From">
                <input
                  className={input}
                  type="date"
                  value={form.validFrom}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      validFrom: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Valid To">
                <input
                  className={input}
                  type="date"
                  value={form.validTo}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      validTo: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      Preferred Supplier
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                      Use this supplier as the product's primary purchasing
                      source.
                    </p>
                  </div>

                  <Toggle
                    checked={Boolean(form.isPreferred)}
                    onChange={onPreferredChange}
                    disabled={supplier?.status !== "active"}
                    label="Set as preferred supplier"
                  />
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Notes" hint="Optional">
                  <FocusPlaceholderTextarea
                    className={cn(input, "min-h-[110px] resize-none")}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Add purchasing, packaging, quotation, or delivery notes..."
                    maxLength={1500}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>
        </div>
      </form>
    </ModalShell>
  )
}

function SupplierProductDetailsModal({ state, supplier, onClose }) {
  const link = state.link

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={link?.product?.name || "Supplier-product details"}
      subtitle={
        link
          ? `${link.product?.sku || "-"} · ${supplier?.businessName || "Supplier"}`
          : ""
      }
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
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
      {link ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryValue
              label="Unit Price"
              value={formatMoney(link.unitPrice, link.currency)}
            />
            <SummaryValue
              label="MOQ"
              value={formatNumber(link.minimumOrderQuantity)}
            />
            <SummaryValue
              label="Lead Time"
              value={`${formatNumber(link.leadTimeDays, 0)} days`}
            />
            <SummaryValue
              label="Status"
              value={<StatusBadge value={link.status} />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Product and supplier">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Supplier"
                  value={relationLabel(supplier, "Unknown supplier")}
                />
                <DetailRow
                  label="Product"
                  value={relationLabel(link.product, "Unknown product")}
                />
                <DetailRow
                  label="Supplier SKU"
                  value={link.supplierSku || "-"}
                />
                <DetailRow
                  label="Purchase unit"
                  value={relationLabel(link.purchaseUnit, "Product base unit")}
                />
                <DetailRow
                  label="Pack size"
                  value={formatNumber(link.packSize)}
                />
                <DetailRow
                  label="Preferred"
                  value={<PreferredBadge value={link.isPreferred} />}
                />
              </div>
            </SectionCard>

            <SectionCard title="Commercial terms">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Currency"
                  value={link.currency || "BDT"}
                />
                <DetailRow
                  label="Tax"
                  value={`${pretty(link.taxType)} · ${formatNumber(
                    link.taxRate,
                    2
                  )}%`}
                />
                <DetailRow
                  label="Valid from"
                  value={formatDate(link.validFrom)}
                />
                <DetailRow
                  label="Valid to"
                  value={formatDate(link.validTo)}
                />
                <DetailRow
                  label="Price state"
                  value={<ValidityBadge link={link} />}
                />
                <DetailRow
                  label="Updated"
                  value={formatDate(link.updatedAt)}
                />
              </div>
            </SectionCard>
          </div>

          {link.notes ? (
            <SectionCard title="Notes">
              <p className="text-sm font-semibold leading-6 text-gray-600">
                {link.notes}
              </p>
            </SectionCard>
          ) : null}

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
            {link.isPreferred && link.status === "active"
              ? "This active link is the product's preferred supplier source."
              : isPriceActive(link)
                ? "This supplier price is currently inside its validity range."
                : "This supplier price is outside its current validity range."}
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}

function SummaryValue({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div className="mt-2 text-lg font-black text-gray-900">{value}</div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <span className="shrink-0 font-semibold text-gray-500">{label}</span>
      <span className="min-w-0 text-right font-black text-gray-800">
        {value}
      </span>
    </div>
  )
}
