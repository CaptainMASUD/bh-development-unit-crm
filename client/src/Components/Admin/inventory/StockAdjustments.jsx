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
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const PERMISSION = {
  manage:
    PERMISSIONS?.INVENTORY_ADJUSTMENT_MANAGE ||
    "inventory-adjustment:manage",
  approve:
    PERMISSIONS?.INVENTORY_ADJUSTMENT_APPROVE ||
    "inventory-adjustment:approve",
  post:
    PERMISSIONS?.INVENTORY_ADJUSTMENT_POST ||
    "inventory-adjustment:post",
  reverse:
    PERMISSIONS?.INVENTORY_ADJUSTMENT_REVERSE ||
    "inventory-adjustment:reverse",
  delete:
    PERMISSIONS?.INVENTORY_ADJUSTMENT_DELETE ||
    "inventory-adjustment:delete",
}

const TYPES = [
  ["physical_count", "Physical Count"],
  ["cycle_count", "Cycle Count"],
  ["damage", "Damage"],
  ["loss", "Loss"],
  ["found", "Found Stock"],
  ["expiry", "Expiry"],
  ["quality_control", "Quality Control"],
  ["data_correction", "Data Correction"],
  ["opening_correction", "Opening Correction"],
  ["other", "Other"],
]

const MODES = [
  ["count", "Counted Quantity"],
  ["delta", "Quantity Difference"],
]

const STATUSES = [
  ["draft", "Draft"],
  ["pending_approval", "Pending Approval"],
  ["approved", "Approved"],
  ["posted", "Posted"],
  ["rejected", "Rejected"],
  ["cancelled", "Cancelled"],
  ["reversed", "Reversed"],
]

const emptySummary = {
  adjustmentCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  postedCount: 0,
  increaseQuantity: 0,
  decreaseQuantity: 0,
  netQuantity: 0,
  netValue: 0,
}

const cls = {
  page: "min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8",
  card:
    "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]",
  button:
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60",
  primary: "bg-indigo-600 text-white hover:bg-indigo-700",
  ghost: "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
  danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  warning:
    "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
  success:
    "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
  input:
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
}

function cn(...items) {
  return items.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function idOf(value) {
  return value?._id || value || ""
}

function newKey(prefix = "adjustment") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nowInput() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function dateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function formatDate(value, time = false) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function qty(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })
}

function money(value, currency = "BDT") {
  return `${currency || "BDT"} ${qty(value, 2)}`
}

function relation(item, fallback = "Unnamed") {
  if (!item) return fallback
  const name = item.name || item.label || fallback
  const code = item.sku || item.code || item.barcode || ""
  return `${name}${code ? ` (${code})` : ""}`
}

function serials(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\n,]+/)
        .map((item) => clean(item).toUpperCase())
        .filter(Boolean)
    ),
  ]
}

function rQty(value) {
  return Math.round(Number(value || 0) * 1_000_000) / 1_000_000
}

function rMoney(value) {
  return Math.round(Number(value || 0) * 10_000) / 10_000
}

function emptyLine() {
  return {
    clientId: newKey("line"),
    product: "",
    location: "",
    systemQuantity: 0,
    stockVersion: 0,
    snapshotLoaded: false,
    snapshotLoading: false,
    countedQuantity: "0",
    varianceQuantity: "0",
    unitCost: "0",
    lotNumber: "",
    serialNumbersText: "",
    note: "",
  }
}

function emptyForm() {
  return {
    adjustmentDate: nowInput(),
    warehouse: "",
    adjustmentType: "physical_count",
    adjustmentMode: "count",
    reference: "",
    currency: "BDT",
    reason: "",
    notes: "",
    idempotencyKey: newKey(),
    lines: [emptyLine()],
  }
}

function lineVariance(line, mode) {
  return mode === "delta"
    ? rQty(line.varianceQuantity)
    : rQty(Number(line.countedQuantity || 0) - Number(line.systemQuantity || 0))
}

function lineCounted(line, mode) {
  return mode === "count"
    ? rQty(line.countedQuantity)
    : rQty(Number(line.systemQuantity || 0) + Number(line.varianceQuantity || 0))
}

function lineValue(line, mode) {
  return rMoney(lineVariance(line, mode) * Number(line.unitCost || 0))
}

function totals(lines, mode) {
  return lines.reduce(
    (result, line) => {
      const variance = lineVariance(line, mode)
      const value = lineValue(line, mode)
      if (variance > 0) {
        result.increaseQuantity += variance
        result.increaseValue += value
      } else if (variance < 0) {
        result.decreaseQuantity += Math.abs(variance)
        result.decreaseValue += Math.abs(value)
      }
      result.netQuantity += variance
      result.netValue += value
      return result
    },
    {
      increaseQuantity: 0,
      decreaseQuantity: 0,
      increaseValue: 0,
      decreaseValue: 0,
      netQuantity: 0,
      netValue: 0,
    }
  )
}

function Icon({ icon, className = "h-4 w-4" }) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} />
}

function FocusInput({ placeholder = "", onFocus, onBlur, ...props }) {
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

function FocusTextarea({ placeholder = "", onFocus, onBlur, ...props }) {
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

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs font-medium text-gray-500">{hint}</p> : null}
    </div>
  )
}

function Section({ title, description, action, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-gray-900">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Modal({ open, onClose, title, subtitle, icon, footer, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => event.key === "Escape" && onClose?.()
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
        <button
          type="button"
          className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-md"
          onClick={onClose}
          aria-label="Close modal"
        />
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={cn(
            "relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]",
            wide ? "max-w-[1500px]" : "max-w-6xl"
          )}
        >
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-gray-50/90 p-4 backdrop-blur sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                {icon}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
                {subtitle ? <p className="truncate text-sm text-gray-600">{subtitle}</p> : null}
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-700 hover:bg-gray-100">
              <Icon icon={Cancel01Icon} className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4 sm:p-5">{children}</div>
          {footer ? (
            <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">
              {footer}
            </div>
          ) : null}
        </motion.div>
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
    headers: { ...headers(), ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.message || data.error || "Request failed")
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

function StatusBadge({ value }) {
  const color = {
    draft: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    pending_approval: "bg-sky-50 text-sky-700 ring-sky-100",
    approved: "bg-teal-50 text-teal-700 ring-teal-100",
    posted: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    rejected: "bg-rose-50 text-rose-700 ring-rose-100",
    cancelled: "bg-gray-100 text-gray-700 ring-gray-200",
    reversed: "bg-amber-50 text-amber-700 ring-amber-100",
  }[value] || "bg-gray-100 text-gray-700 ring-gray-200"

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-black ring-1", color)}>
      {pretty(value)}
    </span>
  )
}

function TypeBadge({ value }) {
  const color = ["damage", "loss", "expiry"].includes(value)
    ? "bg-rose-50 text-rose-700 ring-rose-100"
    : value === "found"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : ["physical_count", "cycle_count"].includes(value)
        ? "bg-sky-50 text-sky-700 ring-sky-100"
        : "bg-indigo-50 text-indigo-700 ring-indigo-100"
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-black ring-1", color)}>
      {pretty(value)}
    </span>
  )
}

function VarianceBadge({ value }) {
  const number = Number(value || 0)
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        number > 0
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : number < 0
            ? "bg-rose-50 text-rose-700 ring-rose-100"
            : "bg-gray-100 text-gray-600 ring-gray-200"
      )}
    >
      {number > 0 ? "+" : ""}
      {qty(number)}
    </span>
  )
}

function SummaryCards({ summary, onSelect }) {
  const cards = [
    ["Adjustments", summary.adjustmentCount, "all"],
    ["Pending", summary.pendingCount, "pending_approval"],
    ["Approved", summary.approvedCount, "approved"],
    ["Posted", summary.postedCount, "posted"],
    ["Increase", summary.increaseQuantity, "all"],
    ["Net Value", money(summary.netValue), "all"],
  ]
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map(([label, value, tab]) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(tab)}
          className={cn(cls.card, "p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/20")}
        >
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-2 truncate text-xl font-black text-gray-900">
            {typeof value === "string" ? value : qty(value)}
          </p>
        </button>
      ))}
    </div>
  )
}

export default function StockAdjustments() {
  const user = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const can = {
    manage: hasPermission(user, PERMISSION.manage),
    approve: hasPermission(user, PERMISSION.approve),
    post: hasPermission(user, PERMISSION.post),
    reverse: hasPermission(user, PERMISSION.reverse),
    delete: hasPermission(user, PERMISSION.delete),
  }

  const [tab, setTab] = useState("all")
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [filterLocations, setFilterLocations] = useState([])
  const [formLocations, setFormLocations] = useState([])
  const [filters, setFilters] = useState({
    q: "",
    adjustmentType: "all",
    adjustmentMode: "all",
    warehouse: "all",
    product: "all",
    location: "all",
    from: "",
    to: "",
  })
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [formModal, setFormModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState({ open: false, item: null })
  const [reasonModal, setReasonModal] = useState({
    open: false,
    type: "",
    item: null,
    reason: "",
    error: "",
  })
  const [busy, setBusy] = useState({ id: "", type: "" })

  const productMap = useMemo(
    () => new Map(products.map((item) => [String(item._id), item])),
    [products]
  )

  const loadOptions = async () => {
    try {
      const [productData, warehouseData] = await Promise.all([
        api("/inventory/products?status=active&productType=inventory&trackInventory=true&limit=100"),
        api("/inventory/warehouses/options?limit=100"),
      ])
      setProducts(productData.products || [])
      setWarehouses(warehouseData.warehouses || [])
    } catch (error) {
      toast.error(error.message || "Failed to load adjustment options")
    }
  }

  const loadLocations = async (warehouseId, target = "filter") => {
    if (!warehouseId || warehouseId === "all") {
      target === "form" ? setFormLocations([]) : setFilterLocations([])
      return []
    }
    try {
      const data = await api(
        `/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(warehouseId)}&limit=200`
      )
      const rows = data.locations || []
      target === "form" ? setFormLocations(rows) : setFilterLocations(rows)
      return rows
    } catch (error) {
      target === "form" ? setFormLocations([]) : setFilterLocations([])
      toast.error(error.message || "Failed to load warehouse locations")
      return []
    }
  }

  const params = ({ append = false } = {}) => {
    const value = new URLSearchParams({ limit: "40" })
    if (tab !== "all") value.set("status", tab)
    if (clean(filters.q)) value.set("q", clean(filters.q))
    if (filters.adjustmentType !== "all") value.set("adjustmentType", filters.adjustmentType)
    if (filters.adjustmentMode !== "all") value.set("adjustmentMode", filters.adjustmentMode)
    if (filters.warehouse !== "all") value.set("warehouse", filters.warehouse)
    if (filters.product !== "all") value.set("product", filters.product)
    if (filters.location !== "all") value.set("location", filters.location)
    if (filters.from) value.set("from", filters.from)
    if (filters.to) value.set("to", filters.to)
    if (append && nextCursor) value.set("cursor", nextCursor)
    return value
  }

  const loadItems = async ({ append = false, signal } = {}) => {
    append ? setLoadingMore(true) : setLoading(true)
    try {
      const data = await api(`/inventory/stock-adjustments?${params({ append })}`, { signal })
      const incoming = data.adjustments || []
      setItems((previous) => (append ? [...previous, ...incoming] : incoming))
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error.name !== "AbortError") toast.error(error.message || "Failed to load adjustments")
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  const loadSummary = async ({ signal } = {}) => {
    try {
      const data = await api(`/inventory/stock-adjustments/summary?${params()}`, { signal })
      setSummary({ ...emptySummary, ...(data.summary || {}) })
    } catch (error) {
      if (error.name !== "AbortError") toast.error(error.message || "Failed to load adjustment summary")
    }
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    loadLocations(filters.warehouse, "filter")
  }, [filters.warehouse])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      loadItems({ signal: controller.signal })
      loadSummary({ signal: controller.signal })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    tab,
    filters.q,
    filters.adjustmentType,
    filters.adjustmentMode,
    filters.warehouse,
    filters.product,
    filters.location,
    filters.from,
    filters.to,
  ])

  const refreshAll = async () => {
    await Promise.all([loadOptions(), loadItems(), loadSummary()])
  }

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "warehouse" ? { location: "all" } : {}),
    }))
  }

  const resetFilters = () => {
    setTab("all")
    setFilters({
      q: "",
      adjustmentType: "all",
      adjustmentMode: "all",
      warehouse: "all",
      product: "all",
      location: "all",
      from: "",
      to: "",
    })
  }

  const openCreate = async () => {
    const warehouse = filters.warehouse !== "all" ? filters.warehouse : ""
    setForm({ ...emptyForm(), warehouse })
    setFormError("")
    setFormModal({ open: true, item: null })
    await loadLocations(warehouse, "form")
  }

  const openEdit = async (item) => {
    if (!["draft", "rejected"].includes(item.status)) {
      toast.error("Only a draft or rejected adjustment can be edited.")
      return
    }
    setBusy({ id: item._id, type: "open" })
    try {
      const data = await api(`/inventory/stock-adjustments/${item._id}`)
      const adjustment = data.adjustment
      const warehouse = idOf(adjustment.warehouse)
      setForm({
        adjustmentDate: dateInput(adjustment.adjustmentDate),
        warehouse,
        adjustmentType: adjustment.adjustmentType || "physical_count",
        adjustmentMode: adjustment.adjustmentMode || "count",
        reference: adjustment.reference || "",
        currency: adjustment.currency || "BDT",
        reason: adjustment.reason || "",
        notes: adjustment.notes || "",
        idempotencyKey: adjustment.idempotencyKey || newKey(),
        lines: (adjustment.lines || []).map((line) => ({
          clientId: line._id || newKey("line"),
          product: idOf(line.product),
          location: idOf(line.location),
          systemQuantity: Number(line.systemQuantity || 0),
          stockVersion: Number(line.stockVersion || 0),
          snapshotLoaded: true,
          snapshotLoading: false,
          countedQuantity: String(line.countedQuantity ?? 0),
          varianceQuantity: String(line.varianceQuantity ?? 0),
          unitCost: String(line.unitCost ?? 0),
          lotNumber: line.lotNumber || "",
          serialNumbersText: (line.serialNumbers || []).join("\n"),
          note: line.note || "",
        })),
      })
      setFormModal({ open: true, item: adjustment })
      await loadLocations(warehouse, "form")
    } catch (error) {
      toast.error(error.message || "Failed to load adjustment")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const closeForm = () => {
    if (saving) return
    setFormModal({ open: false, item: null })
    setForm(emptyForm())
    setFormError("")
    setFormLocations([])
  }

  const changeWarehouse = async (warehouse) => {
    setForm((previous) => ({
      ...previous,
      warehouse,
      lines: previous.lines.map((line) => ({
        ...line,
        location: "",
        systemQuantity: 0,
        stockVersion: 0,
        snapshotLoaded: false,
      })),
    }))
    await loadLocations(warehouse, "form")
  }

  const changeMode = (mode) => {
    setForm((previous) => ({
      ...previous,
      adjustmentMode: mode,
      lines: previous.lines.map((line) => ({
        ...line,
        countedQuantity:
          mode === "count"
            ? String(Number(line.systemQuantity || 0) + Number(line.varianceQuantity || 0))
            : line.countedQuantity,
        varianceQuantity:
          mode === "delta"
            ? String(Number(line.countedQuantity || 0) - Number(line.systemQuantity || 0))
            : line.varianceQuantity,
      })),
    }))
  }

  const updateLine = (clientId, key, value) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId ? { ...line, [key]: value } : line
      ),
    }))
  }

  const loadSnapshot = async (clientId, override = {}) => {
    const line = form.lines.find((row) => row.clientId === clientId)
    const product = override.product ?? line?.product
    const location = override.location ?? line?.location
    if (!form.warehouse || !product) return

    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((row) =>
        row.clientId === clientId ? { ...row, snapshotLoading: true } : row
      ),
    }))

    try {
      const query = new URLSearchParams({ product, warehouse: form.warehouse })
      if (location) query.set("location", location)
      const data = await api(`/inventory/stocks/position?${query}`)
      const stock = data.stock
      setForm((previous) => ({
        ...previous,
        lines: previous.lines.map((row) =>
          row.clientId === clientId
            ? {
                ...row,
                systemQuantity: Number(stock.onHandQuantity || 0),
                stockVersion: Number(stock.stockVersion || 0),
                snapshotLoaded: true,
                snapshotLoading: false,
                unitCost:
                  Number(row.unitCost || 0) > 0
                    ? row.unitCost
                    : String(stock.averageCost || productMap.get(String(product))?.purchasePrice || 0),
              }
            : row
        ),
      }))
    } catch (error) {
      const productData = productMap.get(String(product))
      if (error.status === 404) {
        setForm((previous) => ({
          ...previous,
          lines: previous.lines.map((row) =>
            row.clientId === clientId
              ? {
                  ...row,
                  systemQuantity: 0,
                  stockVersion: 0,
                  snapshotLoaded: true,
                  snapshotLoading: false,
                  unitCost:
                    Number(row.unitCost || 0) > 0
                      ? row.unitCost
                      : String(productData?.purchasePrice || 0),
                }
              : row
          ),
        }))
      } else {
        updateLine(clientId, "snapshotLoading", false)
        toast.error(error.message || "Failed to load stock snapshot")
      }
    }
  }

  const changeProduct = async (clientId, product) => {
    const productData = productMap.get(String(product))
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              product,
              systemQuantity: 0,
              stockVersion: 0,
              snapshotLoaded: false,
              unitCost:
                Number(line.unitCost || 0) > 0
                  ? line.unitCost
                  : String(productData?.purchasePrice || 0),
              lotNumber: productData?.trackingType === "batch" ? line.lotNumber : "",
              serialNumbersText:
                productData?.trackingType === "serial" ? line.serialNumbersText : "",
            }
          : line
      ),
    }))
    if (product && form.warehouse) await loadSnapshot(clientId, { product })
  }

  const changeLocation = async (clientId, location) => {
    updateLine(clientId, "location", location)
    const line = form.lines.find((row) => row.clientId === clientId)
    if (line?.product && form.warehouse) {
      await loadSnapshot(clientId, { product: line.product, location })
    }
  }

  const addLine = () => {
    if (form.lines.length >= 500) return toast.error("Maximum 500 lines are allowed.")
    setForm((previous) => ({ ...previous, lines: [...previous.lines, emptyLine()] }))
  }

  const removeLine = (clientId) => {
    if (form.lines.length === 1) return toast.error("At least one line is required.")
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.filter((line) => line.clientId !== clientId),
    }))
  }

  const duplicateLine = (line) => {
    if (form.lines.length >= 500) return toast.error("Maximum 500 lines are allowed.")
    setForm((previous) => ({
      ...previous,
      lines: [...previous.lines, { ...line, clientId: newKey("line"), snapshotLoading: false }],
    }))
  }

  const validate = () => {
    if (!form.adjustmentDate) return "A valid adjustment date is required."
    if (!form.warehouse) return "Warehouse is required."
    if (!form.lines.length) return "At least one adjustment line is required."
    const positions = new Set()

    for (let index = 0; index < form.lines.length; index += 1) {
      const line = form.lines[index]
      const label = `Line ${index + 1}`
      const product = productMap.get(String(line.product))
      if (!line.product) return `${label}: product is required.`
      const key = `${line.product}:${line.location || "none"}`
      if (positions.has(key)) return `${label}: duplicate product and location.`
      positions.add(key)

      const counted = Number(line.countedQuantity)
      const variance = Number(line.varianceQuantity)
      const unitCost = Number(line.unitCost || 0)
      if (form.adjustmentMode === "count" && (!Number.isFinite(counted) || counted < 0)) {
        return `${label}: counted quantity must be a non-negative number.`
      }
      if (form.adjustmentMode === "delta" && !Number.isFinite(variance)) {
        return `${label}: quantity difference must be a valid number.`
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return `${label}: unit cost must be a non-negative number.`
      }

      const difference = Math.abs(lineVariance(line, form.adjustmentMode))
      if (difference > 0 && product?.trackingType === "batch" && !clean(line.lotNumber)) {
        return `${label}: lot number is required for this batch-tracked product.`
      }
      if (difference > 0 && product?.trackingType === "serial") {
        if (!Number.isInteger(difference)) return `${label}: serial variance must be a whole number.`
        if (serials(line.serialNumbersText).length !== difference) {
          return `${label}: provide one unique serial number per adjusted unit.`
        }
      }
    }
    return ""
  }

  const payload = () => ({
    adjustmentDate: form.adjustmentDate,
    warehouse: form.warehouse,
    adjustmentType: form.adjustmentType,
    adjustmentMode: form.adjustmentMode,
    reference: clean(form.reference).toUpperCase(),
    idempotencyKey: clean(form.idempotencyKey),
    currency: clean(form.currency || "BDT").toUpperCase(),
    reason: clean(form.reason),
    notes: clean(form.notes),
    lines: form.lines.map((line) => ({
      product: line.product,
      location: line.location || null,
      countedQuantity: Number(line.countedQuantity || 0),
      varianceQuantity: Number(line.varianceQuantity || 0),
      unitCost: Number(line.unitCost || 0),
      lotNumber: clean(line.lotNumber).toUpperCase(),
      serialNumbers: serials(line.serialNumbersText),
      note: clean(line.note),
    })),
  })

  const save = async (event) => {
    event.preventDefault()
    setFormError("")
    const error = validate()
    if (error) return setFormError(error)
    setSaving(true)
    try {
      const data = await api(
        formModal.item?._id
          ? `/inventory/stock-adjustments/${formModal.item._id}`
          : "/inventory/stock-adjustments",
        {
          method: formModal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload()),
        }
      )
      toast.success(data.message || "Stock adjustment saved")
      setFormModal({ open: false, item: null })
      setForm(emptyForm())
      setFormError("")
      setFormLocations([])
      setShowAdvanced(false)
      await Promise.all([loadItems(), loadSummary()])
    } catch (requestError) {
      setFormError(requestError.message || "Failed to save stock adjustment")
    } finally {
      setSaving(false)
    }
  }

  const openDetails = async (item) => {
    setBusy({ id: item._id, type: "details" })
    try {
      const data = await api(`/inventory/stock-adjustments/${item._id}`)
      setDetails({ open: true, item: data.adjustment })
    } catch (error) {
      toast.error(error.message || "Failed to load adjustment details")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const action = async (item, endpoint, type, confirmText = "") => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy({ id: item._id, type })
    try {
      const data = await api(`/inventory/stock-adjustments/${item._id}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      toast.success(data.message || `${pretty(type)} completed`)
      await Promise.all([loadItems(), loadSummary()])
    } catch (error) {
      if (error.data?.staleLines?.length) {
        toast.error(`${error.message} ${error.data.staleLines.length} stale line(s).`)
      } else {
        toast.error(error.message || `Failed to ${type} adjustment`)
      }
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const deleteItem = async (item) => {
    if (!window.confirm(`Delete ${item.adjustmentNo}?`)) return
    setBusy({ id: item._id, type: "delete" })
    try {
      const data = await api(`/inventory/stock-adjustments/${item._id}`, { method: "DELETE" })
      toast.success(data.message || "Adjustment deleted")
      await Promise.all([loadItems(), loadSummary()])
    } catch (error) {
      toast.error(error.message || "Failed to delete adjustment")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const openReason = (type, item) => {
    setReasonModal({ open: true, type, item, reason: "", error: "" })
  }

  const submitReason = async (event) => {
    event.preventDefault()
    const reason = clean(reasonModal.reason)
    if (!reason) {
      return setReasonModal((previous) => ({
        ...previous,
        error: `${pretty(previous.type)} reason is required.`,
      }))
    }
    setSaving(true)
    try {
      const data = await api(
        `/inventory/stock-adjustments/${reasonModal.item._id}/${reasonModal.type}`,
        { method: "POST", body: JSON.stringify({ reason }) }
      )
      toast.success(data.message || `${pretty(reasonModal.type)} completed`)
      setReasonModal({ open: false, type: "", item: null, reason: "", error: "" })
      await Promise.all([loadItems(), loadSummary()])
    } catch (error) {
      setReasonModal((previous) => ({ ...previous, error: error.message }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cls.page}>
      <Toaster position="top-right" />

      <section className={cn(cls.card, "mb-6 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Stock Adjustments</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Count, approve, and post inventory corrections with stock-snapshot protection.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={cn(cls.button, cls.ghost)} onClick={refreshAll} disabled={loading}>
              <Icon icon={RefreshIcon} className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>
            {can.manage ? (
              <button className={cn(cls.button, cls.primary)} onClick={openCreate}>
                <Icon icon={Add01Icon} className="h-4 w-4" />
                New Adjustment
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-h-[50px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)] xl:max-w-4xl">
            <Icon icon={Search01Icon} className="h-4 w-4 text-gray-400" />
            <FocusInput
              className="min-w-[150px] flex-1 border-0 bg-transparent px-1 py-2 text-sm font-semibold outline-none"
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="Search adjustment number or reference..."
            />
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-black",
                tab !== "all" || Object.values(filters).some((value) => value && value !== "all")
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 ring-1 ring-gray-200"
              )}
            >
              <Icon icon={FilterIcon} className="h-3.5 w-3.5" />
              Filters
            </button>
          </div>
          <p className="text-sm font-bold text-gray-500">
            Showing <span className="text-gray-900">{items.length}</span> adjustments{hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      <SummaryCards summary={summary} onSelect={setTab} />

      <div className={cn(cls.card, "mb-6 p-2")}>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {[["all", "All"], ...STATUSES].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm",
                tab === value ? "bg-indigo-600 text-white" : "text-gray-700 hover:bg-gray-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AdjustmentTable
        items={items}
        loading={loading}
        busy={busy}
        can={can}
        onView={openDetails}
        onEdit={openEdit}
        onRefresh={(item) => action(item, "refresh", "refresh")}
        onSubmit={(item) =>
          action(item, "submit", "submit", `Submit ${item.adjustmentNo} for approval?`)
        }
        onApprove={(item) =>
          action(item, "approve", "approve", `Approve ${item.adjustmentNo}?`)
        }
        onReject={(item) => openReason("reject", item)}
        onPost={(item) =>
          action(
            item,
            "post",
            "post",
            `Post ${item.adjustmentNo} to inventory? Live stock balances will change.`
          )
        }
        onReverse={(item) => openReason("reverse", item)}
        onCancel={(item) => openReason("cancel", item)}
        onDelete={deleteItem}
      />

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            className={cn(cls.button, cls.ghost)}
            disabled={loadingMore}
            onClick={() => loadItems({ append: true })}
          >
            <Icon icon={RefreshIcon} className={cn("h-4 w-4", loadingMore && "animate-spin")} />
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        tab={tab}
        setTab={setTab}
        filters={filters}
        updateFilter={updateFilter}
        reset={resetFilters}
        products={products}
        warehouses={warehouses}
        locations={filterLocations}
      />

      <AdjustmentForm
        state={formModal}
        form={form}
        setForm={setForm}
        error={formError}
        saving={saving}
        products={products}
        productMap={productMap}
        warehouses={warehouses}
        locations={formLocations}
        onClose={closeForm}
        onSave={save}
        onWarehouse={changeWarehouse}
        onMode={changeMode}
        updateLine={updateLine}
        changeProduct={changeProduct}
        changeLocation={changeLocation}
        loadSnapshot={loadSnapshot}
        addLine={addLine}
        duplicateLine={duplicateLine}
        removeLine={removeLine}
      />

      <DetailsModal state={details} onClose={() => setDetails({ open: false, item: null })} />

      <ReasonModal
        state={reasonModal}
        setState={setReasonModal}
        saving={saving}
        onClose={() => !saving && setReasonModal({ open: false, type: "", item: null, reason: "", error: "" })}
        onSubmit={submitReason}
      />
    </div>
  )
}

function AdjustmentTable({ items, loading, busy, can, onView, onEdit, onRefresh, onSubmit, onApprove, onReject, onPost, onReverse, onCancel, onDelete }) {
  return (
    <div className={cn(cls.card, "overflow-hidden")}>
      <div className="hidden max-h-[680px] overflow-auto xl:block">
        <table className="min-w-[1500px] w-full text-left">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
            <tr>
              {["Adjustment", "Date", "Warehouse", "Type", "Mode", "Products", "Lines", "Increase", "Decrease", "Net Qty", "Net Value", "Status", "Updated", "Actions"].map((label) => (
                <th key={label} className={cn("px-5 py-3", label === "Actions" && "sticky right-0 bg-gray-50 text-right")}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item._id} className="group bg-white hover:bg-gray-50/70">
                <td className="px-5 py-4">
                  <p className="text-sm font-black text-indigo-700">{item.adjustmentNo}</p>
                  <p className="mt-0.5 max-w-[220px] truncate text-xs font-semibold text-gray-500">{item.reference || item.reason || "No reference"}</p>
                </td>
                <td className="px-5 py-4 text-sm font-black text-gray-700">{formatDate(item.adjustmentDate, true)}</td>
                <td className="px-5 py-4">
                  <p className="text-sm font-black text-gray-800">{item.warehouse?.name || "Unknown"}</p>
                  <p className="text-xs font-semibold text-gray-500">{item.warehouse?.code || "-"}</p>
                </td>
                <td className="px-5 py-4"><TypeBadge value={item.adjustmentType} /></td>
                <td className="px-5 py-4 text-sm font-black text-gray-700">{pretty(item.adjustmentMode)}</td>
                <td className="px-5 py-4 text-sm font-black text-gray-800">{item.products?.[0]?.name || "-"}{item.products?.length > 1 ? ` +${item.products.length - 1}` : ""}</td>
                <td className="px-5 py-4 text-sm font-black text-gray-700">{qty(item.lineCount, 0)}</td>
                <td className="px-5 py-4 text-sm font-black text-emerald-700">+{qty(item.increaseQuantity)}</td>
                <td className="px-5 py-4 text-sm font-black text-rose-700">-{qty(item.decreaseQuantity)}</td>
                <td className="px-5 py-4"><VarianceBadge value={item.netQuantity} /></td>
                <td className={cn("px-5 py-4 text-sm font-black", Number(item.netValue) > 0 ? "text-emerald-700" : Number(item.netValue) < 0 ? "text-rose-700" : "text-gray-700")}>{money(item.netValue, item.currency)}</td>
                <td className="px-5 py-4"><StatusBadge value={item.status} /></td>
                <td className="px-5 py-4 text-sm font-semibold text-gray-600">{formatDate(item.updatedAt, true)}</td>
                <td className="sticky right-0 bg-white px-5 py-4 group-hover:bg-gray-50/70">
                  <Actions item={item} busy={busy} can={can} onView={onView} onEdit={onEdit} onRefresh={onRefresh} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} onPost={onPost} onReverse={onReverse} onCancel={onCancel} onDelete={onDelete} />
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr><td colSpan={14} className="px-5 py-14 text-center text-sm font-bold text-gray-500">{loading ? "Loading stock adjustments..." : "No stock adjustments found."}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 xl:hidden">
        {items.map((item) => (
          <article key={item._id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-indigo-700">{item.adjustmentNo}</p>
                <p className="mt-1 text-xs font-semibold text-gray-500">{formatDate(item.adjustmentDate, true)}</p>
              </div>
              <StatusBadge value={item.status} />
            </div>
            <div className="mt-3 rounded-xl bg-gray-50 p-3">
              <p className="text-sm font-black text-gray-800">{relation(item.warehouse, "Unknown warehouse")}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <Metric label="Type" value={pretty(item.adjustmentType)} />
                <Metric label="Mode" value={pretty(item.adjustmentMode)} />
                <Metric label="Increase" value={`+${qty(item.increaseQuantity)}`} positive />
                <Metric label="Decrease" value={`-${qty(item.decreaseQuantity)}`} negative />
                <Metric label="Net Qty" value={qty(item.netQuantity)} positive={Number(item.netQuantity) > 0} negative={Number(item.netQuantity) < 0} />
                <Metric label="Net Value" value={money(item.netValue, item.currency)} positive={Number(item.netValue) > 0} negative={Number(item.netValue) < 0} />
              </div>
            </div>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <Actions item={item} busy={busy} can={can} mobile onView={onView} onEdit={onEdit} onRefresh={onRefresh} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} onPost={onPost} onReverse={onReverse} onCancel={onCancel} onDelete={onDelete} />
            </div>
          </article>
        ))}
        {!items.length ? <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">{loading ? "Loading..." : "No stock adjustments found."}</div> : null}
      </div>
    </div>
  )
}

function Metric({ label, value, positive, negative }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn("mt-1 text-sm font-black", positive ? "text-emerald-700" : negative ? "text-rose-700" : "text-gray-800")}>{value}</p>
    </div>
  )
}

function Actions({ item, busy, can, mobile, onView, onEdit, onRefresh, onSubmit, onApprove, onReject, onPost, onReverse, onCancel, onDelete }) {
  const active = String(busy.id) === String(item._id)
  const size = mobile ? "px-3 py-2" : "px-3"
  const cancelable = can.manage && ["draft", "pending_approval", "approved", "rejected"].includes(item.status)
  const deletable = can.delete && ["draft", "rejected", "cancelled"].includes(item.status) && !item.movement
  return (
    <div className={cn("flex items-center gap-2", mobile ? "flex-wrap" : "justify-end")}>
      <ActionButton label="View" icon={active && busy.type === "details" ? RefreshIcon : ViewIcon} spin={active && busy.type === "details"} mobile={mobile} onClick={() => onView(item)} />
      {can.manage && ["draft", "rejected"].includes(item.status) ? (
        <>
          <ActionButton label="Edit" icon={Edit02Icon} mobile={mobile} onClick={() => onEdit(item)} />
          <ActionButton label="Refresh" icon={RefreshIcon} mobile={mobile} onClick={() => onRefresh(item)} />
        </>
      ) : null}
      {can.manage && item.status === "draft" ? <ActionButton label="Submit" icon={Tick02Icon} kind="primary" mobile={mobile} onClick={() => onSubmit(item)} /> : null}
      {can.approve && item.status === "pending_approval" ? (
        <>
          <ActionButton label="Approve" icon={Tick02Icon} kind="success" mobile={mobile} onClick={() => onApprove(item)} />
          <ActionButton label="Reject" icon={Cancel01Icon} kind="danger" mobile={mobile} onClick={() => onReject(item)} />
        </>
      ) : null}
      {can.post && item.status === "approved" ? <ActionButton label="Post" icon={Tick02Icon} kind="success" mobile={mobile} onClick={() => onPost(item)} /> : null}
      {can.reverse && item.status === "posted" ? <ActionButton label="Reverse" icon={RefreshIcon} kind="warning" mobile={mobile} onClick={() => onReverse(item)} /> : null}
      {cancelable ? <ActionButton label="Cancel" icon={Cancel01Icon} kind="warning" mobile={mobile} onClick={() => onCancel(item)} /> : null}
      {deletable ? <ActionButton label="Delete" icon={Archive02Icon} kind="danger" mobile={mobile} onClick={() => onDelete(item)} /> : null}
    </div>
  )
}

function ActionButton({ label, icon, kind = "ghost", mobile, spin, onClick }) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(cls.button, cls[kind], mobile ? "px-3 py-2" : "px-3")}
    >
      <Icon icon={icon} className={cn("h-4 w-4", spin && "animate-spin")} />
      {mobile ? label : null}
    </button>
  )
}

function FilterModal({ open, onClose, tab, setTab, filters, updateFilter, reset, products, warehouses, locations }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjustment Filters"
      subtitle="Filter workflow, type, warehouse, stock position, and date."
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(cls.button, cls.ghost)} onClick={reset}>Reset</button>
          <button className={cn(cls.button, cls.primary)} onClick={onClose}><Icon icon={Tick02Icon} />Apply</button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Status"><select className={cls.input} value={tab} onChange={(event) => setTab(event.target.value)}><option value="all">All statuses</option>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Adjustment Type"><select className={cls.input} value={filters.adjustmentType} onChange={(event) => updateFilter("adjustmentType", event.target.value)}><option value="all">All types</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Adjustment Mode"><select className={cls.input} value={filters.adjustmentMode} onChange={(event) => updateFilter("adjustmentMode", event.target.value)}><option value="all">All modes</option>{MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Warehouse"><select className={cls.input} value={filters.warehouse} onChange={(event) => updateFilter("warehouse", event.target.value)}><option value="all">All warehouses</option>{warehouses.map((item) => <option key={item._id} value={item._id}>{relation(item)}</option>)}</select></Field>
        <Field label="Product"><select className={cls.input} value={filters.product} onChange={(event) => updateFilter("product", event.target.value)}><option value="all">All products</option>{products.map((item) => <option key={item._id} value={item._id}>{relation(item)}</option>)}</select></Field>
        <Field label="Location" hint="Choose a warehouse first."><select className={cls.input} value={filters.location} onChange={(event) => updateFilter("location", event.target.value)} disabled={filters.warehouse === "all"}><option value="all">All locations</option>{locations.map((item) => <option key={item._id} value={item._id}>{relation(item)}</option>)}</select></Field>
        <Field label="From"><input className={cls.input} type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></Field>
        <Field label="To"><input className={cls.input} type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function AdjustmentForm({ state, form, setForm, error, saving, products, productMap, warehouses, locations, onClose, onSave, onWarehouse, onMode, updateLine, changeProduct, changeLocation, loadSnapshot, addLine, duplicateLine, removeLine }) {
  const summary = totals(form.lines, form.adjustmentMode)
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.item ? "Update Stock Adjustment" : "New Stock Adjustment"}
      subtitle={state.item?.adjustmentNo || "Create a protected inventory count or quantity correction."}
      icon={<Icon icon={state.item ? Edit02Icon : Add01Icon} className="h-5 w-5" />}
      wide
      footer={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-gray-100 px-3 py-2 text-gray-700">{form.lines.length} lines</span>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">+{qty(summary.increaseQuantity)}</span>
            <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-700">-{qty(summary.decreaseQuantity)}</span>
            <span className="rounded-full bg-indigo-50 px-3 py-2 text-indigo-700">Net {money(summary.netValue, form.currency)}</span>
          </div>
          <div className="flex justify-end gap-2">
            <button className={cn(cls.button, cls.ghost)} type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className={cn(cls.button, cls.primary)} type="submit" form="adjustment-form" disabled={saving}><Icon icon={saving ? RefreshIcon : FloppyDiskIcon} className={cn("h-4 w-4", saving && "animate-spin")} />{saving ? "Saving..." : "Save Draft"}</button>
          </div>
        </div>
      }
    >
      {error ? <div className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700"><Icon icon={Alert02Icon} /><span>{error}</span></div> : null}
      <form id="adjustment-form" onSubmit={onSave} className="space-y-4">
        <Section title="Document Information" description="The adjustment number and stock snapshot are generated by the server.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Adjustment Date" required><input className={cls.input} type="datetime-local" value={form.adjustmentDate} onChange={(event) => setForm((previous) => ({ ...previous, adjustmentDate: event.target.value }))} required /></Field>
            <Field label="Warehouse" required><select className={cls.input} value={form.warehouse} onChange={(event) => onWarehouse(event.target.value)} required><option value="">Select warehouse</option>{warehouses.map((item) => <option key={item._id} value={item._id}>{relation(item)}</option>)}</select></Field>
            <Field label="Adjustment Type" required><select className={cls.input} value={form.adjustmentType} onChange={(event) => setForm((previous) => ({ ...previous, adjustmentType: event.target.value }))}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Adjustment Mode" required><select className={cls.input} value={form.adjustmentMode} onChange={(event) => onMode(event.target.value)}>{MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Reference"><FocusInput className={cls.input} value={form.reference} onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value.toUpperCase() }))} placeholder="COUNT-2026-001" /></Field>
            <Field label="Currency"><FocusInput className={cls.input} value={form.currency} onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="BDT" /></Field>
            <Field label="Reason"><FocusInput className={cls.input} value={form.reason} onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Reason for adjustment" /></Field>
            <Field label="Notes"><FocusTextarea className={cn(cls.input, "min-h-[84px] resize-none")} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Document notes..." /></Field>
          </div>
        </Section>

        <Section
          title="Adjustment Lines"
          description={form.adjustmentMode === "count" ? "Enter the physical counted quantity; variance is calculated from the captured system quantity." : "Enter a signed quantity difference; positive adds and negative removes stock."}
          action={<button type="button" className={cn(cls.button, cls.ghost, "px-3 py-2")} onClick={addLine}><Icon icon={Add01Icon} />Add Line</button>}
        >
          <div className="space-y-4">
            {form.lines.map((line, index) => (
              <LineEditor
                key={line.clientId}
                line={line}
                index={index}
                mode={form.adjustmentMode}
                products={products}
                product={productMap.get(String(line.product))}
                locations={locations}
                disabled={!form.warehouse}
                updateLine={updateLine}
                changeProduct={changeProduct}
                changeLocation={changeLocation}
                loadSnapshot={loadSnapshot}
                duplicateLine={duplicateLine}
                removeLine={removeLine}
              />
            ))}
          </div>
        </Section>
      </form>
    </Modal>
  )
}

function LineEditor({ line, index, mode, products, product, locations, disabled, updateLine, changeProduct, changeLocation, loadSnapshot, duplicateLine, removeLine }) {
  const variance = lineVariance(line, mode)
  const counted = lineCounted(line, mode)
  const value = lineValue(line, mode)
  const difference = Math.abs(variance)
  const serialList = serials(line.serialNumbersText)

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">{index + 1}</span>
          <div><p className="text-sm font-black text-gray-900">Stock Position</p><p className="text-xs font-semibold text-gray-500">{product ? relation(product) : "Select a product"}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn(cls.button, cls.ghost, "px-3 py-2")} onClick={() => loadSnapshot(line.clientId)} disabled={disabled || !line.product || line.snapshotLoading}><Icon icon={RefreshIcon} className={cn("h-4 w-4", line.snapshotLoading && "animate-spin")} />Snapshot</button>
          <button type="button" className={cn(cls.button, cls.ghost, "px-3 py-2")} onClick={() => duplicateLine(line)}><Icon icon={Add01Icon} />Duplicate</button>
          <button type="button" className={cn(cls.button, cls.danger, "px-3 py-2")} onClick={() => removeLine(line.clientId)}><Icon icon={Cancel01Icon} />Remove</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Product" required><select className={cls.input} value={line.product} onChange={(event) => changeProduct(line.clientId, event.target.value)} disabled={disabled} required><option value="">Select product</option>{products.map((item) => <option key={item._id} value={item._id}>{relation(item)}</option>)}</select></Field>
        <Field label="Location" hint="Leave empty for warehouse-level stock."><select className={cls.input} value={line.location} onChange={(event) => changeLocation(line.clientId, event.target.value)} disabled={disabled}><option value="">No location</option>{locations.map((item) => <option key={item._id} value={item._id}>{relation(item)}</option>)}</select></Field>
        <Field label={mode === "count" ? "Counted Quantity" : "Quantity Difference"} required><FocusInput className={cls.input} type="number" min={mode === "count" ? "0" : undefined} step={product?.trackingType === "serial" ? "1" : "0.000001"} value={mode === "count" ? line.countedQuantity : line.varianceQuantity} onChange={(event) => updateLine(line.clientId, mode === "count" ? "countedQuantity" : "varianceQuantity", event.target.value)} placeholder={mode === "count" ? "Enter count" : "-5 or 10"} disabled={disabled} /></Field>
        <Field label="Unit Cost"><FocusInput className={cls.input} type="number" min="0" step="0.0001" value={line.unitCost} onChange={(event) => updateLine(line.clientId, "unitCost", event.target.value)} placeholder="250" /></Field>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricBox label="System" value={line.snapshotLoading ? <Icon icon={RefreshIcon} className="h-4 w-4 animate-spin" /> : qty(line.systemQuantity)} />
        <MetricBox label="Counted" value={qty(counted)} />
        <MetricBox label="Variance" value={<VarianceBadge value={variance} />} />
        <MetricBox label="Variance Value" value={money(value)} positive={value > 0} negative={value < 0} />
        <MetricBox label="Version" value={line.stockVersion ?? 0} />
      </div>

      {difference > 0 && product?.trackingType === "batch" ? (
        <div className="mt-4"><Field label="Lot Number" required><FocusInput className={cls.input} value={line.lotNumber} onChange={(event) => updateLine(line.clientId, "lotNumber", event.target.value.toUpperCase())} placeholder="LOT-2026-001" /></Field></div>
      ) : null}

      {difference > 0 && product?.trackingType === "serial" ? (
        <div className="mt-4"><Field label="Serial Numbers" required hint={`${serialList.length} entered; ${qty(difference, 0)} required.`}><FocusTextarea className={cn(cls.input, "min-h-[110px] resize-y")} value={line.serialNumbersText} onChange={(event) => updateLine(line.clientId, "serialNumbersText", event.target.value)} placeholder="SERIAL-001\nSERIAL-002" /></Field></div>
      ) : null}

      <div className="mt-4"><Field label="Line Note"><FocusInput className={cls.input} value={line.note} onChange={(event) => updateLine(line.clientId, "note", event.target.value)} placeholder="Line note..." /></Field></div>
    </article>
  )
}

function MetricBox({ label, value, positive, negative }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <div className={cn("mt-2 text-sm font-black", positive ? "text-emerald-700" : negative ? "text-rose-700" : "text-gray-800")}>{value}</div>
    </div>
  )
}

function DetailsModal({ state, onClose }) {
  const item = state.item
  return (
    <Modal open={state.open} onClose={onClose} title={item?.adjustmentNo || "Adjustment Details"} subtitle={item ? `${pretty(item.adjustmentType)} · ${formatDate(item.adjustmentDate, true)}` : ""} icon={<Icon icon={ViewIcon} className="h-5 w-5" />} wide footer={<div className="flex justify-end"><button className={cn(cls.button, cls.ghost)} onClick={onClose}>Close</button></div>}>
      {item ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <MetricBox label="Status" value={<StatusBadge value={item.status} />} />
            <MetricBox label="Lines" value={qty(item.lineCount, 0)} />
            <MetricBox label="Increase" value={`+${qty(item.increaseQuantity)}`} positive />
            <MetricBox label="Decrease" value={`-${qty(item.decreaseQuantity)}`} negative />
            <MetricBox label="Net Quantity" value={qty(item.netQuantity)} positive={Number(item.netQuantity) > 0} negative={Number(item.netQuantity) < 0} />
            <MetricBox label="Net Value" value={money(item.netValue, item.currency)} positive={Number(item.netValue) > 0} negative={Number(item.netValue) < 0} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Document"><div className="space-y-3"><Detail label="Warehouse" value={relation(item.warehouse, "Unknown warehouse")} /><Detail label="Type" value={pretty(item.adjustmentType)} /><Detail label="Mode" value={pretty(item.adjustmentMode)} /><Detail label="Reference" value={item.reference || "-"} /><Detail label="Reason" value={item.reason || "-"} /><Detail label="Created By" value={relation(item.createdBy, "System")} /></div></Section>
            <Section title="Workflow"><div className="space-y-3"><Detail label="Submitted" value={formatDate(item.submittedAt, true)} /><Detail label="Approved" value={formatDate(item.approvedAt, true)} /><Detail label="Posted" value={formatDate(item.postedAt, true)} /><Detail label="Rejected Reason" value={item.rejectionReason || "-"} /><Detail label="Cancellation Reason" value={item.cancellationReason || "-"} /><Detail label="Movement" value={item.movement?.movementNo || "-"} /><Detail label="Reversal" value={item.reversalMovement?.movementNo || "-"} /></div></Section>
          </div>
          <Section title="Adjustment Lines">
            <div className="overflow-auto">
              <table className="min-w-[1200px] w-full text-left">
                <thead className="text-xs font-black uppercase text-gray-500"><tr>{["Product", "Location", "System", "Counted", "Variance", "Unit Cost", "Variance Value", "Version", "Tracking", "Note"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">{(item.lines || []).map((line) => <tr key={line._id}><td className="px-4 py-4 font-black text-gray-900">{relation(line.product, "Unknown")}</td><td className="px-4 py-4 font-semibold text-gray-700">{relation(line.location, "No location")}</td><td className="px-4 py-4 font-black">{qty(line.systemQuantity)}</td><td className="px-4 py-4 font-black">{qty(line.countedQuantity)}</td><td className="px-4 py-4"><VarianceBadge value={line.varianceQuantity} /></td><td className="px-4 py-4 font-black">{money(line.unitCost, item.currency)}</td><td className="px-4 py-4 font-black">{money(line.varianceValue, item.currency)}</td><td className="px-4 py-4 font-black">{line.stockVersion}</td><td className="px-4 py-4 text-sm">{line.lotNumber || (line.serialNumbers?.length ? `${line.serialNumbers.length} serials` : "-")}</td><td className="px-4 py-4 text-sm">{line.note || "-"}</td></tr>)}</tbody>
              </table>
            </div>
          </Section>
        </div>
      ) : null}
    </Modal>
  )
}

function Detail({ label, value }) {
  return <div className="flex justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0"><span className="font-semibold text-gray-500">{label}</span><span className="text-right font-black text-gray-800">{value}</span></div>
}

function ReasonModal({ state, setState, saving, onClose, onSubmit }) {
  return (
    <Modal open={state.open} onClose={onClose} title={`${pretty(state.type)} Stock Adjustment`} subtitle={state.item?.adjustmentNo || ""} icon={<Icon icon={state.type === "reverse" ? RefreshIcon : Cancel01Icon} className="h-5 w-5" />} footer={<div className="flex justify-end gap-2"><button className={cn(cls.button, cls.ghost)} onClick={onClose}>Close</button><button className={cn(cls.button, state.type === "reverse" ? cls.warning : cls.danger)} type="submit" form="reason-form" disabled={saving}><Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn("h-4 w-4", saving && "animate-spin")} />{saving ? "Processing..." : pretty(state.type)}</button></div>}>
      {state.error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div> : null}
      <form id="reason-form" onSubmit={onSubmit}>
        <Field label={`${pretty(state.type)} Reason`} required>
          <FocusTextarea className={cn(cls.input, "min-h-[130px] resize-none")} value={state.reason} onChange={(event) => setState((previous) => ({ ...previous, reason: event.target.value, error: "" }))} placeholder="Explain why this action is required..." />
        </Field>
      </form>
    </Modal>
  )
}
