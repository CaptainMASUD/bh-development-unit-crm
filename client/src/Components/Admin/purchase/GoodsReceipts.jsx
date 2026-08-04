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

const MANAGE_PERMISSION =
  PERMISSIONS?.GOODS_RECEIPT_MANAGE || "goods-receipt:manage"
const APPROVE_PERMISSION =
  PERMISSIONS?.GOODS_RECEIPT_APPROVE || "goods-receipt:approve"
const POST_PERMISSION =
  PERMISSIONS?.GOODS_RECEIPT_POST || "goods-receipt:post"
const REVERSE_PERMISSION =
  PERMISSIONS?.GOODS_RECEIPT_REVERSE || "goods-receipt:reverse"
const DELETE_PERMISSION =
  PERMISSIONS?.GOODS_RECEIPT_DELETE || "goods-receipt:delete"

const FALLBACK_META = {
  statuses: ["draft", "submitted", "approved", "posted", "reversed", "cancelled"],
  editableStatuses: ["draft"],
  qualityStatuses: ["pending", "accepted", "partially_accepted", "rejected"],
}

const EMPTY_SUMMARY = {
  receiptCount: 0,
  draftCount: 0,
  submittedCount: 0,
  approvedCount: 0,
  postedCount: 0,
  reversedCount: 0,
  totalReceivedQuantity: 0,
  totalAcceptedQuantity: 0,
  totalQuarantineQuantity: 0,
  totalRejectedQuantity: 0,
  totalAcceptedValue: 0,
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

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
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

function formatNumber(value, maximumFractionDigits = 6) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits })
}

function formatMoney(value, currency = "BDT") {
  return `${clean(currency || "BDT")} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function relationLabel(item, fallback = "Unnamed") {
  if (!item) return fallback
  const name = item.businessName || item.name || item.label || fallback
  const code = item.code || item.orderNo || item.sku || item.symbol || ""
  return `${name}${code ? ` (${code})` : ""}`
}

function makeClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function idempotencyKey(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${crypto.randomUUID()}`
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) / 1_000_000
}

function parseSerials(value) {
  return [...new Set(clean(value).split(/[\n,]+/).map((item) => clean(item).toUpperCase()).filter(Boolean))]
}

function newLine(source = {}) {
  const remaining = Math.max(
    0,
    Number(source.remainingQuantity ?? source.orderedQuantity ?? 0) -
      Number(source.receivedQuantity ?? 0)
  )
  return {
    clientId: makeClientId(),
    _id: undefined,
    purchaseOrderLine: source._id || "",
    product: normalizeId(source.product),
    purchaseUnit: normalizeId(source.purchaseUnit),
    productSnapshot: source.productSnapshot || {},
    unitSnapshot: source.unitSnapshot || {},
    orderedQuantity: String(source.orderedQuantity ?? 0),
    previouslyReceivedQuantity: String(source.receivedQuantity ?? 0),
    remainingQuantity: String(source.remainingQuantity ?? remaining),
    receivedQuantity: String(source.remainingQuantity ?? remaining ?? 0),
    acceptedQuantity: String(source.remainingQuantity ?? remaining ?? 0),
    quarantineQuantity: "0",
    rejectedQuantity: "0",
    unitCost: String(source.unitPrice ?? source.unitCost ?? 0),
    acceptedLocation: normalizeId(source.destinationLocation),
    quarantineLocation: "",
    lotNumber: "",
    serialNumbersText: "",
    manufactureDate: "",
    expiryDate: "",
    inspectionNotes: "",
    trackingType: source.product?.trackingType || "none",
  }
}

function emptyForm() {
  return {
    receiptDate: todayInput(),
    purchaseOrder: "",
    supplier: "",
    warehouse: "",
    supplierDeliveryNote: "",
    supplierInvoiceNo: "",
    vehicleNo: "",
    receivedByName: "",
    currency: "BDT",
    notes: "",
    lines: [],
  }
}

function Icon({ icon, className = "h-4 w-4", strokeWidth = 1.8, ...props }) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={strokeWidth} {...props} />
}

function Field({ label, hint, required = false, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}{required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs font-medium text-gray-500">{hint}</p> : null}
    </div>
  )
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-black text-gray-900">{title}</h3>
        {description ? <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function FocusPlaceholderInput({ placeholder = "", onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      placeholder={focused ? placeholder : ""}
      onFocus={(event) => { setFocused(true); onFocus?.(event) }}
      onBlur={(event) => { setFocused(false); onBlur?.(event) }}
    />
  )
}

function FocusPlaceholderTextarea({ placeholder = "", onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      {...props}
      placeholder={focused ? placeholder : ""}
      onFocus={(event) => { setFocused(true); onFocus?.(event) }}
      onBlur={(event) => { setFocused(false); onBlur?.(event) }}
    />
  )
}

function StatusBadge({ value }) {
  const styles = {
    draft: "bg-gray-100 text-gray-700 ring-gray-200",
    submitted: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    posted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    reversed: "bg-violet-50 text-violet-700 ring-violet-200",
    cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
    pending: "bg-gray-100 text-gray-700 ring-gray-200",
    accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    partially_accepted: "bg-sky-50 text-sky-700 ring-sky-200",
    rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  }
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1", styles[value] || styles.draft)}>{pretty(value)}</span>
}

function ModalShell({ open, onClose, title, subtitle, icon, children, footer, maxWidthClass = "max-w-6xl" }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => event.key === "Escape" && onClose()
    document.addEventListener("keydown", onKeyDown)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-gray-950/45 p-3 backdrop-blur-[2px] sm:p-5">
      <div className="flex min-h-full items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cn("w-full overflow-hidden rounded-3xl bg-white shadow-2xl", maxWidthClass)} role="dialog" aria-modal="true">
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">{icon}</div><div className="min-w-0"><h2 className="truncate text-lg font-black text-gray-950">{title}</h2>{subtitle ? <p className="truncate text-sm font-medium text-gray-500">{subtitle}</p> : null}</div></div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-600 transition hover:bg-gray-100" aria-label="Close modal"><Icon icon={Cancel01Icon} className="h-5 w-5" /></button>
          </div>
          <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-4 sm:p-5">{children}</div>
          {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</div> : null}
        </motion.div>
      </div>
    </div>,
    document.body
  )
}

function headers() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
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

function SummaryCards({ summary, onSelect }) {
  const items = [
    ["All Receipts", summary.receiptCount, "all", formatMoney(summary.totalAcceptedValue)],
    ["Drafts", summary.draftCount, "draft", "Being prepared"],
    ["Submitted", summary.submittedCount, "submitted", "Waiting for approval"],
    ["Approved", summary.approvedCount, "approved", "Ready to post"],
    ["Posted", summary.postedCount, "posted", `${formatNumber(summary.totalAcceptedQuantity)} accepted`],
    ["Reversed", summary.reversedCount, "reversed", `${formatNumber(summary.totalRejectedQuantity)} rejected`],
  ]
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map(([label, value, tab, note]) => (
        <button key={label} type="button" onClick={() => onSelect(tab)} className={cn(card, "p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/20")}>
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-2 text-xl font-black text-gray-950">{formatNumber(value, 0)}</p>
          <p className="mt-1 truncate text-xs font-semibold text-gray-500">{note}</p>
        </button>
      ))}
    </div>
  )
}

function ReasonModal({ state, saving, onClose, onSubmit, setReason }) {
  return (
    <ModalShell open={state.open} onClose={onClose} title={state.title || "Provide a reason"} subtitle={state.item?.receiptNo || "Goods receipt"} icon={<Icon icon={Alert02Icon} className="h-5 w-5" />} maxWidthClass="max-w-lg" footer={<div className="flex justify-end gap-3"><button type="button" className={cn(button, ghostButton)} onClick={onClose} disabled={saving}>Cancel</button><button type="button" className={cn(button, state.danger ? dangerButton : primaryButton)} onClick={onSubmit} disabled={saving}><Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />{saving ? "Saving" : state.actionLabel || "Continue"}</button></div>}>
      <Field label="Reason" required><FocusPlaceholderTextarea className={cn(input, "min-h-[120px] resize-none")} value={state.reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the business reason..." maxLength={1000} autoFocus /></Field>
      {state.error ? <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{state.error}</p> : null}
    </ModalShell>
  )
}

export default function GoodsReceipts({ initialPurchaseOrderId = "", onCreatePurchaseReturn }) {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, MANAGE_PERMISSION)
  const canApprove = hasPermission(currentUser, APPROVE_PERMISSION)
  const canPost = hasPermission(currentUser, POST_PERMISSION)
  const canReverse = hasPermission(currentUser, REVERSE_PERMISSION)
  const canDelete = hasPermission(currentUser, DELETE_PERMISSION)

  const [meta, setMeta] = useState(FALLBACK_META)
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [receipts, setReceipts] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [locationsByWarehouse, setLocationsByWarehouse] = useState({})

  const [activeTab, setActiveTab] = useState("all")
  const [filters, setFilters] = useState({ q: "", purchaseOrder: "all", supplier: "all", warehouse: "all", product: "all", dateFrom: "", dateTo: "" })
  const [filterOpen, setFilterOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [busy, setBusy] = useState({ id: "", type: "" })

  const [formModal, setFormModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [detailsModal, setDetailsModal] = useState({ open: false, item: null })
  const [reasonState, setReasonState] = useState({ open: false, item: null, type: "", title: "", actionLabel: "", danger: false, reason: "", error: "" })

  const warehouseMap = useMemo(() => new Map(warehouses.map((item) => [String(item._id), item])), [warehouses])

  const totals = useMemo(() => {
    return form.lines.reduce((result, line) => {
      result.received += Number(line.receivedQuantity || 0)
      result.accepted += Number(line.acceptedQuantity || 0)
      result.quarantine += Number(line.quarantineQuantity || 0)
      result.rejected += Number(line.rejectedQuantity || 0)
      result.value += Number(line.acceptedQuantity || 0) * Number(line.unitCost || 0)
      return result
    }, { received: 0, accepted: 0, quarantine: 0, rejected: 0, value: 0 })
  }, [form.lines])

  const loadLocations = async (warehouseId) => {
    if (!warehouseId) return []
    if (locationsByWarehouse[warehouseId]) return locationsByWarehouse[warehouseId]
    try {
      const data = await api(`/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(warehouseId)}&limit=200`)
      const rows = data.locations || []
      setLocationsByWarehouse((previous) => ({ ...previous, [warehouseId]: rows }))
      return rows
    } catch (error) {
      toast.error(error.message || "Failed to load warehouse locations")
      return []
    }
  }

  const loadReferenceData = async () => {
    try {
      const [metaData, orderData, supplierData, productData, warehouseData] = await Promise.all([
        api("/purchase/goods-receipts/meta"),
        api("/purchase/purchase-orders/options?limit=100"),
        api("/suppliers/options?limit=100"),
        api("/inventory/products?status=active&limit=100"),
        api("/inventory/warehouses/options?limit=100"),
      ])
      setMeta({ ...FALLBACK_META, ...(metaData || {}) })
      setPurchaseOrders(orderData.purchaseOrders || [])
      setSuppliers(supplierData.suppliers || [])
      setProducts(productData.products || [])
      setWarehouses(warehouseData.warehouses || [])
    } catch (error) {
      toast.error(error.message || "Failed to load goods-receipt options")
    }
  }

  const buildParams = ({ append = false } = {}) => {
    const params = new URLSearchParams({ limit: "40" })
    if (activeTab !== "all") params.set("status", activeTab)
    if (clean(filters.q)) params.set("q", clean(filters.q))
    if (filters.purchaseOrder !== "all") params.set("purchaseOrder", filters.purchaseOrder)
    if (filters.supplier !== "all") params.set("supplier", filters.supplier)
    if (filters.warehouse !== "all") params.set("warehouse", filters.warehouse)
    if (filters.product !== "all") params.set("product", filters.product)
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
    if (filters.dateTo) params.set("dateTo", filters.dateTo)
    if (append && nextCursor) params.set("cursor", nextCursor)
    return params
  }

  const loadReceipts = async ({ append = false, signal } = {}) => {
    append ? setLoadingMore(true) : setLoading(true)
    try {
      const data = await api(`/purchase/goods-receipts?${buildParams({ append })}`, { signal })
      const incoming = data.goodsReceipts || []
      setReceipts((previous) => append ? [...previous, ...incoming] : incoming)
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error.name !== "AbortError") toast.error(error.message || "Failed to load goods receipts")
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  const loadSummary = async ({ signal } = {}) => {
    try {
      const data = await api(`/purchase/goods-receipts/summary?${buildParams()}`, { signal })
      setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) })
    } catch (error) {
      if (error.name !== "AbortError") toast.error(error.message || "Failed to load receipt summary")
    }
  }

  useEffect(() => { loadReferenceData() }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      Promise.all([loadReceipts({ signal: controller.signal }), loadSummary({ signal: controller.signal })])
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeTab, filters.q, filters.purchaseOrder, filters.supplier, filters.warehouse, filters.product, filters.dateFrom, filters.dateTo])

  useEffect(() => {
    if (initialPurchaseOrderId && canManage) openCreate(initialPurchaseOrderId)
  }, [initialPurchaseOrderId])

  const refresh = async () => Promise.all([loadReferenceData(), loadReceipts(), loadSummary()])

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setNextCursor(null)
    setHasMore(false)
  }

  const resetFilters = () => {
    setActiveTab("all")
    setFilters({ q: "", purchaseOrder: "all", supplier: "all", warehouse: "all", product: "all", dateFrom: "", dateTo: "" })
    setFilterOpen(false)
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setNextCursor(null)
    setHasMore(false)
  }

  const hydrateFromOrder = async (orderId, current = emptyForm()) => {
    if (!orderId) return { ...current, purchaseOrder: "", supplier: "", warehouse: "", lines: [] }
    const data = await api(`/purchase/purchase-orders/${orderId}`)
    const order = data.purchaseOrder
    const defaultWarehouse = normalizeId(order.defaultWarehouse) || normalizeId(order.lines?.[0]?.destinationWarehouse)
    const locations = await loadLocations(defaultWarehouse)
    const defaultLocation = normalizeId(order.defaultLocation) || locations.find((item) => !item.isQuarantine)?._id || locations[0]?._id || ""
    const lines = (order.lines || [])
      .map((line) => {
        const remaining = roundQuantity(Number(line.orderedQuantity || 0) - Number(line.cancelledQuantity || 0) - Number(line.receivedQuantity || 0))
        return { ...line, remainingQuantity: remaining }
      })
      .filter((line) => line.remainingQuantity > 0)
      .map((line) => ({ ...newLine(line), acceptedLocation: normalizeId(line.destinationLocation) || defaultLocation }))

    return {
      ...current,
      purchaseOrder: order._id,
      supplier: normalizeId(order.supplier),
      warehouse: defaultWarehouse,
      currency: order.currency || "BDT",
      lines,
    }
  }

  async function openCreate(orderId = "") {
    setBusy({ id: orderId, type: "create" })
    try {
      let next = emptyForm()
      if (orderId) next = await hydrateFromOrder(orderId, next)
      setForm(next)
      setFormError("")
      setFormModal({ open: true, item: null })
    } catch (error) {
      toast.error(error.message || "Failed to prepare goods receipt")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const changeOrder = async (orderId) => {
    setBusy({ id: orderId, type: "order" })
    try {
      const next = await hydrateFromOrder(orderId, { ...form, lines: [] })
      setForm(next)
      setFormError("")
    } catch (error) {
      setFormError(error.message || "Failed to load purchase order")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const changeWarehouse = async (warehouseId) => {
    const locations = await loadLocations(warehouseId)
    const accepted = locations.find((item) => !item.isQuarantine)?._id || locations[0]?._id || ""
    const quarantine = locations.find((item) => item.isQuarantine)?._id || ""
    setForm((previous) => ({
      ...previous,
      warehouse: warehouseId,
      lines: previous.lines.map((line) => ({
        ...line,
        acceptedLocation: accepted,
        quarantineLocation: Number(line.quarantineQuantity || 0) > 0 ? quarantine : "",
      })),
    }))
  }

  const setLine = (clientId, patch) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => line.clientId === clientId ? { ...line, ...patch } : line),
    }))
  }

  const allocateLine = (clientId, field, value) => {
    const numeric = Math.max(0, Number(value || 0))
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => {
        if (line.clientId !== clientId) return line
        const next = { ...line, [field]: value }
        if (field === "receivedQuantity") {
          next.acceptedQuantity = String(numeric)
          next.quarantineQuantity = "0"
          next.rejectedQuantity = "0"
        }
        if (field === "quarantineQuantity" && numeric === 0) next.quarantineLocation = ""
        return next
      }),
    }))
  }

  const removeLine = (clientId) => {
    setForm((previous) => ({ ...previous, lines: previous.lines.filter((line) => line.clientId !== clientId) }))
  }

  const addOrderLine = () => {
    const selected = purchaseOrders.find((order) => String(order._id) === String(form.purchaseOrder))
    const existing = new Set(form.lines.map((line) => String(line.purchaseOrderLine)))
    const source = selected?.lines?.find((line) => !existing.has(String(line._id)))
    if (!source) return toast.error("All available purchase-order lines are already included.")
    setForm((previous) => ({ ...previous, lines: [...previous.lines, newLine(source)] }))
  }

  const openEdit = async (receipt) => {
    setBusy({ id: receipt._id, type: "edit" })
    try {
      const data = await api(`/purchase/goods-receipts/${receipt._id}`)
      const item = data.goodsReceipt
      await loadLocations(normalizeId(item.warehouse))
      setForm({
        receiptDate: toDateInput(item.receiptDate),
        purchaseOrder: normalizeId(item.purchaseOrder),
        supplier: normalizeId(item.supplier),
        warehouse: normalizeId(item.warehouse),
        supplierDeliveryNote: item.supplierDeliveryNote || "",
        supplierInvoiceNo: item.supplierInvoiceNo || "",
        vehicleNo: item.vehicleNo || "",
        receivedByName: item.receivedByName || "",
        currency: item.currency || "BDT",
        notes: item.notes || "",
        lines: (item.lines || []).map((line) => ({
          ...newLine(),
          clientId: line._id || makeClientId(),
          _id: line._id,
          purchaseOrderLine: normalizeId(line.purchaseOrderLine),
          product: normalizeId(line.product),
          purchaseUnit: normalizeId(line.purchaseUnit),
          productSnapshot: line.productSnapshot || {},
          unitSnapshot: line.unitSnapshot || {},
          orderedQuantity: String(line.orderedQuantity ?? 0),
          previouslyReceivedQuantity: String(line.previouslyReceivedQuantity ?? 0),
          remainingQuantity: String(Math.max(0, Number(line.orderedQuantity || 0) - Number(line.previouslyReceivedQuantity || 0))),
          receivedQuantity: String(line.receivedQuantity ?? 0),
          acceptedQuantity: String(line.acceptedQuantity ?? 0),
          quarantineQuantity: String(line.quarantineQuantity ?? 0),
          rejectedQuantity: String(line.rejectedQuantity ?? 0),
          unitCost: String(line.unitCost ?? 0),
          acceptedLocation: normalizeId(line.acceptedLocation),
          quarantineLocation: normalizeId(line.quarantineLocation),
          lotNumber: line.lotNumber || "",
          serialNumbersText: (line.serialNumbers || []).join("\n"),
          manufactureDate: toDateInput(line.manufactureDate),
          expiryDate: toDateInput(line.expiryDate),
          inspectionNotes: line.inspectionNotes || "",
          trackingType: line.product?.trackingType || "none",
        })),
      })
      setFormError("")
      setFormModal({ open: true, item })
    } catch (error) {
      toast.error(error.message || "Failed to load goods receipt")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const openDetails = async (receipt) => {
    setBusy({ id: receipt._id, type: "view" })
    try {
      const data = await api(`/purchase/goods-receipts/${receipt._id}`)
      setDetailsModal({ open: true, item: data.goodsReceipt })
    } catch (error) {
      toast.error(error.message || "Failed to load goods receipt")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const closeForm = (force = false) => {
    if (saving && !force) return
    setFormModal({ open: false, item: null })
    setForm(emptyForm())
    setFormError("")
  }

  const validateForm = () => {
    if (!form.receiptDate) return "Receipt date is required."
    if (!form.purchaseOrder) return "Purchase order is required."
    if (!form.warehouse) return "Receiving warehouse is required."
    if (!form.lines.length) return "At least one goods-receipt line is required."
    for (let index = 0; index < form.lines.length; index += 1) {
      const line = form.lines[index]
      const label = `Line ${index + 1}`
      const received = Number(line.receivedQuantity)
      const accepted = Number(line.acceptedQuantity)
      const quarantine = Number(line.quarantineQuantity)
      const rejected = Number(line.rejectedQuantity)
      if (!line.purchaseOrderLine || !line.product) return `${label}: purchase-order line and product are required.`
      if (!Number.isFinite(received) || received <= 0) return `${label}: received quantity must be greater than zero.`
      if (Number.isFinite(Number(line.remainingQuantity)) && accepted + quarantine > Number(line.remainingQuantity)) return `${label}: accepted plus quarantine exceeds the remaining ordered quantity.`
      if ([accepted, quarantine, rejected].some((value) => !Number.isFinite(value) || value < 0)) return `${label}: allocation quantities must be valid non-negative numbers.`
      if (roundQuantity(accepted + quarantine + rejected) !== roundQuantity(received)) return `${label}: accepted, quarantine, and rejected quantities must equal received quantity.`
      if (!Number.isFinite(Number(line.unitCost)) || Number(line.unitCost) < 0) return `${label}: unit cost is invalid.`
      if (quarantine > 0 && !line.quarantineLocation) return `${label}: quarantine location is required.`
      if (line.manufactureDate && line.expiryDate && new Date(line.expiryDate) < new Date(line.manufactureDate)) return `${label}: expiry date cannot be before manufacture date.`
      const serials = parseSerials(line.serialNumbersText)
      if (line.trackingType === "serial" && serials.length !== roundQuantity(accepted + quarantine)) return `${label}: one serial number is required for each accepted or quarantined unit.`
      if (serials.length && accepted > 0 && quarantine > 0) return `${label}: split accepted and quarantined serial stock into separate lines.`
    }
    return ""
  }

  const buildPayload = () => ({
    receiptDate: form.receiptDate,
    purchaseOrder: form.purchaseOrder,
    supplier: form.supplier || null,
    warehouse: form.warehouse,
    supplierDeliveryNote: clean(form.supplierDeliveryNote),
    supplierInvoiceNo: clean(form.supplierInvoiceNo),
    vehicleNo: clean(form.vehicleNo),
    receivedByName: clean(form.receivedByName),
    currency: clean(form.currency || "BDT").toUpperCase(),
    notes: clean(form.notes),
    ...(formModal.item ? { version: formModal.item.__v } : {}),
    lines: form.lines.map((line) => ({
      ...(line._id ? { _id: line._id } : {}),
      purchaseOrderLine: line.purchaseOrderLine,
      product: line.product,
      purchaseUnit: line.purchaseUnit || null,
      receivedQuantity: Number(line.receivedQuantity || 0),
      acceptedQuantity: Number(line.acceptedQuantity || 0),
      quarantineQuantity: Number(line.quarantineQuantity || 0),
      rejectedQuantity: Number(line.rejectedQuantity || 0),
      unitCost: Number(line.unitCost || 0),
      acceptedLocation: line.acceptedLocation || null,
      quarantineLocation: line.quarantineLocation || null,
      lotNumber: clean(line.lotNumber).toUpperCase(),
      serialNumbers: parseSerials(line.serialNumbersText),
      manufactureDate: line.manufactureDate || null,
      expiryDate: line.expiryDate || null,
      inspectionNotes: clean(line.inspectionNotes),
    })),
  })

  const saveReceipt = async (event) => {
    event.preventDefault()
    setFormError("")
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)
    setSaving(true)
    try {
      const editing = Boolean(formModal.item?._id)
      const data = await api(editing ? `/purchase/goods-receipts/${formModal.item._id}` : "/purchase/goods-receipts", {
        method: editing ? "PATCH" : "POST",
        headers: editing ? {} : { "Idempotency-Key": idempotencyKey("GRN") },
        body: JSON.stringify(buildPayload()),
      })
      toast.success(data.message || (editing ? "Goods receipt updated" : "Goods receipt created"))
      closeForm(true)
      await Promise.all([loadReferenceData(), loadReceipts(), loadSummary()])
    } catch (error) {
      setFormError(error.message || "Failed to save goods receipt")
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (receipt, type, reason = "") => {
    setBusy({ id: receipt._id, type })
    try {
      const body = ["reverse", "cancel"].includes(type) ? { reason } : {}
      const data = await api(`/purchase/goods-receipts/${receipt._id}/${type}`, { method: "POST", body: JSON.stringify(body) })
      toast.success(data.message || `${pretty(type)} completed`)
      setReasonState((previous) => ({ ...previous, open: false, reason: "", error: "" }))
      await Promise.all([loadReferenceData(), loadReceipts(), loadSummary()])
      if (detailsModal.item?._id === receipt._id) {
        const detail = await api(`/purchase/goods-receipts/${receipt._id}`)
        setDetailsModal({ open: true, item: detail.goodsReceipt })
      }
    } catch (error) {
      if (reasonState.open) setReasonState((previous) => ({ ...previous, error: error.message || "Action failed" }))
      else toast.error(error.message || "Action failed")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const openReason = (receipt, type) => {
    const config = type === "reverse"
      ? ["Reverse goods receipt", "Reverse Receipt", true]
      : ["Cancel goods receipt", "Cancel Receipt", true]
    setReasonState({ open: true, item: receipt, type, title: config[0], actionLabel: config[1], danger: config[2], reason: "", error: "" })
  }

  const deleteReceipt = async (receipt) => {
    if (!window.confirm(`Delete ${receipt.receiptNo}? Only unposted draft or cancelled receipts can be deleted.`)) return
    setBusy({ id: receipt._id, type: "delete" })
    try {
      const data = await api(`/purchase/goods-receipts/${receipt._id}`, { method: "DELETE" })
      toast.success(data.message || "Goods receipt deleted")
      await Promise.all([loadReferenceData(), loadReceipts(), loadSummary()])
    } catch (error) {
      toast.error(error.message || "Failed to delete goods receipt")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const actionButtons = (receipt, mobile = false) => {
    const working = busy.id === receipt._id
    const small = mobile ? "flex-1" : "h-9 w-9 p-0"
    return (
      <div className={cn("flex flex-wrap items-center gap-2", mobile ? "mt-4" : "justify-end")}>
        <button className={cn(button, ghostButton, small)} type="button" onClick={() => openDetails(receipt)} disabled={working} title="View"><Icon icon={busy.id === receipt._id && busy.type === "view" ? RefreshIcon : ViewIcon} className={cn("h-4 w-4", busy.id === receipt._id && busy.type === "view" ? "animate-spin" : "")} />{mobile ? "View" : null}</button>
        {canManage && receipt.status === "draft" ? <button className={cn(button, ghostButton, small)} type="button" onClick={() => openEdit(receipt)} disabled={working} title="Edit"><Icon icon={Edit02Icon} className="h-4 w-4" />{mobile ? "Edit" : null}</button> : null}
        {canManage && receipt.status === "draft" ? <button className={cn(button, primaryButton, small)} type="button" onClick={() => runAction(receipt, "submit")} disabled={working} title="Submit"><Icon icon={Tick02Icon} className="h-4 w-4" />{mobile ? "Submit" : null}</button> : null}
        {canApprove && receipt.status === "submitted" ? <button className={cn(button, primaryButton, small)} type="button" onClick={() => runAction(receipt, "approve")} disabled={working} title="Approve"><Icon icon={Tick02Icon} className="h-4 w-4" />{mobile ? "Approve" : null}</button> : null}
        {canPost && receipt.status === "approved" ? <button className={cn(button, primaryButton, mobile ? "flex-1" : "px-3")} type="button" onClick={() => runAction(receipt, "post")} disabled={working}><Icon icon={Tick02Icon} className="h-4 w-4" />Post</button> : null}
        {canReverse && receipt.status === "posted" ? <button className={cn(button, dangerButton, mobile ? "flex-1" : "px-3")} type="button" onClick={() => openReason(receipt, "reverse")} disabled={working}><Icon icon={RefreshIcon} className="h-4 w-4" />Reverse</button> : null}
        {canManage && ["draft", "submitted", "approved"].includes(receipt.status) ? <button className={cn(button, dangerButton, small)} type="button" onClick={() => openReason(receipt, "cancel")} disabled={working} title="Cancel"><Icon icon={Cancel01Icon} className="h-4 w-4" />{mobile ? "Cancel" : null}</button> : null}
        {canManage && receipt.status === "posted" && onCreatePurchaseReturn ? <button className={cn(button, ghostButton, mobile ? "flex-1" : "px-3")} type="button" onClick={() => onCreatePurchaseReturn(receipt)} disabled={working}><Icon icon={Add01Icon} className="h-4 w-4" />Return</button> : null}
        {canDelete && ["draft", "cancelled"].includes(receipt.status) ? <button className={cn(button, dangerButton, small)} type="button" onClick={() => deleteReceipt(receipt)} disabled={working} title="Delete"><Icon icon={Archive02Icon} className="h-4 w-4" />{mobile ? "Delete" : null}</button> : null}
      </div>
    )
  }

  const activeFilterCount = [filters.purchaseOrder !== "all", filters.supplier !== "all", filters.warehouse !== "all", filters.product !== "all", Boolean(filters.dateFrom), Boolean(filters.dateTo)].filter(Boolean).length

  return (
    <div className={shell}>
      <Toaster position="top-right" />
      <div className="mx-auto max-w-[1600px] px-3 py-5 sm:px-5 lg:px-7">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"><Icon icon={FolderLibraryIcon} className="h-5 w-5" /></div><div><h1 className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">Goods Receipts</h1><p className="mt-1 text-sm font-medium text-gray-500">Inspect supplier deliveries and post accepted stock.</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" className={cn(button, ghostButton)} onClick={refresh}><Icon icon={RefreshIcon} className="h-4 w-4" />Refresh</button>{canManage ? <button type="button" className={cn(button, primaryButton)} onClick={() => openCreate()}><Icon icon={Add01Icon} className="h-4 w-4" />New Goods Receipt</button> : null}</div>
        </div>

        {!canManage ? <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">You have view-only goods-receipt access.</div> : null}

        <SummaryCards summary={summary} onSelect={switchTab} />

        <div className={cn(card, "mb-6 p-2")}><div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">{["all", "draft", "submitted", "approved", "posted", "reversed", "cancelled"].map((status) => <button key={status} type="button" onClick={() => switchTab(status)} className={cn("rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm", activeTab === status ? "bg-indigo-600 text-white shadow-sm" : "text-gray-700 hover:bg-gray-50")}>{status === "all" ? "All" : pretty(status)}</button>)}</div></div>

        <div className={cn(card, "mb-5 p-3 sm:p-4")}><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-3 focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]"><Icon icon={Search01Icon} className="h-4 w-4 text-gray-400" /><FocusPlaceholderInput className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm font-semibold text-gray-800 outline-none" value={filters.q} onChange={(event) => updateFilter("q", event.target.value)} placeholder="Search by receipt number..." /></div><button type="button" className={cn(button, ghostButton)} onClick={() => setFilterOpen(true)}><Icon icon={FilterIcon} className="h-4 w-4" />Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</button>{activeFilterCount ? <button type="button" className={cn(button, ghostButton)} onClick={resetFilters}>Clear</button> : null}</div></div>

        <div className={cn(card, "overflow-hidden")}>
          <div className="hidden overflow-x-auto lg:block"><table className="min-w-full"><thead className="bg-gray-50"><tr className="text-left text-xs font-black uppercase tracking-wide text-gray-400"><th className="px-5 py-4">Receipt</th><th className="px-5 py-4">Purchase Order</th><th className="px-5 py-4">Supplier</th><th className="px-5 py-4">Inspection</th><th className="px-5 py-4">Value</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan="7" className="px-5 py-16 text-center text-sm font-semibold text-gray-500"><Icon icon={RefreshIcon} className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading goods receipts...</td></tr> : receipts.length ? receipts.map((receipt) => <tr key={receipt._id} className="transition hover:bg-gray-50/70"><td className="px-5 py-4"><p className="font-black text-gray-950">{receipt.receiptNo}</p><p className="mt-1 text-xs font-semibold text-gray-500">{formatDate(receipt.receiptDate)}</p></td><td className="px-5 py-4"><p className="font-bold text-gray-900">{receipt.purchaseOrder?.orderNo || "-"}</p><p className="mt-1 text-xs font-semibold text-gray-500">{relationLabel(receipt.warehouse, "-")}</p></td><td className="px-5 py-4"><p className="font-bold text-gray-900">{receipt.supplier?.businessName || receipt.supplierSnapshot?.name || "-"}</p><p className="mt-1 text-xs font-semibold text-gray-500">{receipt.supplierDeliveryNote || receipt.supplierInvoiceNo || "No supplier document"}</p></td><td className="px-5 py-4"><p className="font-black text-gray-950">{formatNumber(receipt.totalAcceptedQuantity)} accepted</p><p className="mt-1 text-xs font-semibold text-gray-500">{formatNumber(receipt.totalQuarantineQuantity)} quarantine · {formatNumber(receipt.totalRejectedQuantity)} rejected</p></td><td className="px-5 py-4"><p className="font-black text-gray-950">{formatMoney(receipt.totalAcceptedValue, receipt.currency)}</p><p className="mt-1 text-xs font-semibold text-gray-500">{formatNumber(receipt.lineCount, 0)} lines</p></td><td className="px-5 py-4"><StatusBadge value={receipt.status} /></td><td className="px-5 py-4">{actionButtons(receipt)}</td></tr>) : <tr><td colSpan="7" className="px-5 py-16 text-center"><Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 font-black text-gray-900">No goods receipts found</p><p className="mt-1 text-sm font-medium text-gray-500">Create a receipt from an approved purchase order.</p></td></tr>}
          </tbody></table></div>
          <div className="divide-y divide-gray-100 lg:hidden">{loading ? <div className="p-10 text-center text-sm font-semibold text-gray-500"><Icon icon={RefreshIcon} className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading...</div> : receipts.length ? receipts.map((receipt) => <article key={receipt._id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-gray-950">{receipt.receiptNo}</p><p className="mt-1 text-xs font-semibold text-gray-500">{formatDate(receipt.receiptDate)}</p></div><StatusBadge value={receipt.status} /></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3 text-sm"><div><p className="text-xs font-bold text-gray-400">Order</p><p className="mt-1 font-bold text-gray-900">{receipt.purchaseOrder?.orderNo || "-"}</p></div><div><p className="text-xs font-bold text-gray-400">Supplier</p><p className="mt-1 font-bold text-gray-900">{receipt.supplier?.businessName || receipt.supplierSnapshot?.name || "-"}</p></div><div><p className="text-xs font-bold text-gray-400">Accepted</p><p className="mt-1 font-bold text-gray-900">{formatNumber(receipt.totalAcceptedQuantity)}</p></div><div><p className="text-xs font-bold text-gray-400">Value</p><p className="mt-1 font-black text-gray-950">{formatMoney(receipt.totalAcceptedValue, receipt.currency)}</p></div></div>{actionButtons(receipt, true)}</article>) : <div className="p-12 text-center"><Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 font-black text-gray-900">No goods receipts found</p></div>}</div>
          {hasMore ? <div className="border-t border-gray-100 p-4 text-center"><button type="button" className={cn(button, ghostButton)} onClick={() => loadReceipts({ append: true })} disabled={loadingMore}><Icon icon={RefreshIcon} className={cn("h-4 w-4", loadingMore ? "animate-spin" : "")} />{loadingMore ? "Loading" : "Load More"}</button></div> : null}
        </div>
      </div>

      <ModalShell open={filterOpen} onClose={() => setFilterOpen(false)} title="Goods-receipt filters" subtitle="Narrow the receiving history" icon={<Icon icon={FilterIcon} className="h-5 w-5" />} maxWidthClass="max-w-3xl" footer={<div className="flex justify-end gap-3"><button type="button" className={cn(button, ghostButton)} onClick={resetFilters}>Reset</button><button type="button" className={cn(button, primaryButton)} onClick={() => setFilterOpen(false)}>Apply Filters</button></div>}>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Purchase Order"><select className={input} value={filters.purchaseOrder} onChange={(event) => updateFilter("purchaseOrder", event.target.value)}><option value="all">All purchase orders</option>{purchaseOrders.map((order) => <option key={order._id} value={order._id}>{order.orderNo}</option>)}</select></Field><Field label="Supplier"><select className={input} value={filters.supplier} onChange={(event) => updateFilter("supplier", event.target.value)}><option value="all">All suppliers</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{relationLabel(supplier)}</option>)}</select></Field><Field label="Warehouse"><select className={input} value={filters.warehouse} onChange={(event) => updateFilter("warehouse", event.target.value)}><option value="all">All warehouses</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{relationLabel(warehouse)}</option>)}</select></Field><Field label="Product"><select className={input} value={filters.product} onChange={(event) => updateFilter("product", event.target.value)}><option value="all">All products</option>{products.map((product) => <option key={product._id} value={product._id}>{relationLabel(product)}</option>)}</select></Field><Field label="Date From"><input className={input} type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} /></Field><Field label="Date To"><input className={input} type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} /></Field></div>
      </ModalShell>

      <ModalShell open={formModal.open} onClose={closeForm} title={formModal.item ? "Update goods receipt" : "Create goods receipt"} subtitle={formModal.item?.receiptNo || "Receive against an approved purchase order"} icon={<Icon icon={formModal.item ? Edit02Icon : Add01Icon} className="h-5 w-5" />} maxWidthClass="max-w-[1500px]" footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className={cn(button, ghostButton)} onClick={closeForm} disabled={saving}>Cancel</button><button type="submit" form="goods-receipt-form" className={cn(button, primaryButton)} disabled={saving}><Icon icon={saving ? RefreshIcon : FloppyDiskIcon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />{saving ? "Saving" : formModal.item ? "Update Receipt" : "Save Draft"}</button></div>}>
        <form id="goods-receipt-form" onSubmit={saveReceipt} className="space-y-5">
          {formError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</div> : null}
          <SectionCard title="Receipt information" description="The supplier and currency are inherited from the selected purchase order."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Receipt Date" required><input className={input} type="date" value={form.receiptDate} onChange={(event) => setForm((previous) => ({ ...previous, receiptDate: event.target.value }))} /></Field><Field label="Purchase Order" required><select className={input} value={form.purchaseOrder} onChange={(event) => changeOrder(event.target.value)} disabled={Boolean(formModal.item)}><option value="">Select approved order</option>{purchaseOrders.map((order) => <option key={order._id} value={order._id}>{order.orderNo} · {order.supplier?.businessName || order.supplierSnapshot?.name || "Supplier"}</option>)}</select></Field><Field label="Receiving Warehouse" required><select className={input} value={form.warehouse} onChange={(event) => changeWarehouse(event.target.value)}><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{relationLabel(warehouse)}</option>)}</select></Field><Field label="Currency"><FocusPlaceholderInput className={input} value={form.currency} onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="BDT" maxLength={12} /></Field><Field label="Supplier Delivery Note"><FocusPlaceholderInput className={input} value={form.supplierDeliveryNote} onChange={(event) => setForm((previous) => ({ ...previous, supplierDeliveryNote: event.target.value }))} placeholder="Delivery challan or note" /></Field><Field label="Supplier Invoice"><FocusPlaceholderInput className={input} value={form.supplierInvoiceNo} onChange={(event) => setForm((previous) => ({ ...previous, supplierInvoiceNo: event.target.value }))} placeholder="Supplier invoice number" /></Field><Field label="Vehicle Number"><FocusPlaceholderInput className={input} value={form.vehicleNo} onChange={(event) => setForm((previous) => ({ ...previous, vehicleNo: event.target.value }))} placeholder="Delivery vehicle" /></Field><Field label="Received By"><FocusPlaceholderInput className={input} value={form.receivedByName} onChange={(event) => setForm((previous) => ({ ...previous, receivedByName: event.target.value }))} placeholder="Receiver name" /></Field></div></SectionCard>

          <SectionCard title="Inspection lines" description="Accepted plus quarantine plus rejected quantity must exactly equal received quantity."><div className="space-y-4">
            {form.lines.map((line, index) => {
              const locations = locationsByWarehouse[form.warehouse] || []
              const productName = line.productSnapshot?.name || products.find((item) => String(item._id) === String(line.product))?.name || `Line ${index + 1}`
              const allocated = Number(line.acceptedQuantity || 0) + Number(line.quarantineQuantity || 0) + Number(line.rejectedQuantity || 0)
              return <div key={line.clientId} className="rounded-2xl border border-gray-200 bg-white p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-black text-gray-950">{productName}</p><p className="mt-1 text-xs font-semibold text-gray-500">Ordered {formatNumber(line.orderedQuantity)} · Previously received {formatNumber(line.previouslyReceivedQuantity)} · Remaining {formatNumber(line.remainingQuantity)}</p></div><button type="button" className={cn(button, dangerButton, "px-3 py-2")} onClick={() => removeLine(line.clientId)}><Icon icon={Cancel01Icon} className="h-4 w-4" />Remove</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Received Quantity" required><input className={input} type="number" min="0.000001" step="0.000001" value={line.receivedQuantity} onChange={(event) => allocateLine(line.clientId, "receivedQuantity", event.target.value)} /></Field><Field label="Accepted Quantity"><input className={input} type="number" min="0" step="0.000001" value={line.acceptedQuantity} onChange={(event) => allocateLine(line.clientId, "acceptedQuantity", event.target.value)} /></Field><Field label="Quarantine Quantity"><input className={input} type="number" min="0" step="0.000001" value={line.quarantineQuantity} onChange={(event) => allocateLine(line.clientId, "quarantineQuantity", event.target.value)} /></Field><Field label="Rejected Quantity"><input className={input} type="number" min="0" step="0.000001" value={line.rejectedQuantity} onChange={(event) => allocateLine(line.clientId, "rejectedQuantity", event.target.value)} /></Field><Field label="Unit Cost"><input className={input} type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => setLine(line.clientId, { unitCost: event.target.value })} /></Field><Field label="Accepted Location"><select className={input} value={line.acceptedLocation} onChange={(event) => setLine(line.clientId, { acceptedLocation: event.target.value })} disabled={!form.warehouse}><option value="">No specific location</option>{locations.filter((item) => !item.isQuarantine).map((location) => <option key={location._id} value={location._id}>{relationLabel(location)}</option>)}</select></Field><Field label="Quarantine Location" required={Number(line.quarantineQuantity || 0) > 0}><select className={input} value={line.quarantineLocation} onChange={(event) => setLine(line.clientId, { quarantineLocation: event.target.value })} disabled={!form.warehouse || Number(line.quarantineQuantity || 0) <= 0}><option value="">Select quarantine location</option>{locations.filter((item) => item.isQuarantine).map((location) => <option key={location._id} value={location._id}>{relationLabel(location)}</option>)}</select></Field><Field label="Lot Number"><FocusPlaceholderInput className={input} value={line.lotNumber} onChange={(event) => setLine(line.clientId, { lotNumber: event.target.value.toUpperCase() })} placeholder="Batch or lot number" /></Field><Field label="Manufacture Date"><input className={input} type="date" value={line.manufactureDate} onChange={(event) => setLine(line.clientId, { manufactureDate: event.target.value })} /></Field><Field label="Expiry Date"><input className={input} type="date" value={line.expiryDate} onChange={(event) => setLine(line.clientId, { expiryDate: event.target.value })} /></Field><div className="md:col-span-2"><Field label="Serial Numbers" hint="One serial per line, or comma-separated."><FocusPlaceholderTextarea className={cn(input, "min-h-[95px] resize-none")} value={line.serialNumbersText} onChange={(event) => setLine(line.clientId, { serialNumbersText: event.target.value })} placeholder="SN-001\nSN-002" /></Field></div><div className="md:col-span-2 xl:col-span-4"><Field label="Inspection Notes"><FocusPlaceholderTextarea className={cn(input, "min-h-[90px] resize-none")} value={line.inspectionNotes} onChange={(event) => setLine(line.clientId, { inspectionNotes: event.target.value })} placeholder="Quality findings, damage details, or acceptance notes..." /></Field></div></div><div className={cn("mt-4 rounded-2xl px-4 py-3 text-sm font-semibold", roundQuantity(allocated) === roundQuantity(line.receivedQuantity) ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>Allocated {formatNumber(allocated)} of {formatNumber(line.receivedQuantity)} received · Accepted value {formatMoney(Number(line.acceptedQuantity || 0) * Number(line.unitCost || 0), form.currency)}</div></div>
            })}
            {form.purchaseOrder ? <button type="button" className={cn(button, ghostButton, "w-full border-dashed")} onClick={addOrderLine}><Icon icon={Add01Icon} className="h-4 w-4" />Add Another Purchase-Order Line</button> : null}
          </div></SectionCard>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]"><SectionCard title="Receipt notes"><Field label="Internal Notes"><FocusPlaceholderTextarea className={cn(input, "min-h-[150px] resize-none")} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Receiving, documentation, or follow-up notes..." /></Field></SectionCard><SectionCard title="Inspection summary" description="Inventory changes only after approval and posting."><div className="rounded-2xl bg-gray-950 p-4 text-white"><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs font-bold text-gray-400">Received</p><p className="mt-1 text-lg font-black">{formatNumber(totals.received)}</p></div><div><p className="text-xs font-bold text-gray-400">Accepted</p><p className="mt-1 text-lg font-black">{formatNumber(totals.accepted)}</p></div><div><p className="text-xs font-bold text-gray-400">Quarantine</p><p className="mt-1 text-lg font-black">{formatNumber(totals.quarantine)}</p></div><div><p className="text-xs font-bold text-gray-400">Rejected</p><p className="mt-1 text-lg font-black">{formatNumber(totals.rejected)}</p></div></div><div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs font-bold text-gray-400">Accepted Stock Value</p><p className="mt-1 text-2xl font-black">{formatMoney(totals.value, form.currency)}</p></div></div></SectionCard></div>
        </form>
      </ModalShell>

      <ModalShell open={detailsModal.open} onClose={() => setDetailsModal({ open: false, item: null })} title={detailsModal.item?.receiptNo || "Goods-receipt details"} subtitle={detailsModal.item ? `${detailsModal.item.purchaseOrder?.orderNo || "Purchase order"} · ${formatDate(detailsModal.item.receiptDate)}` : ""} icon={<Icon icon={ViewIcon} className="h-5 w-5" />} maxWidthClass="max-w-6xl" footer={<div className="flex justify-end"><button type="button" className={cn(button, ghostButton)} onClick={() => setDetailsModal({ open: false, item: null })}>Close</button></div>}>
        {detailsModal.item ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Status", <StatusBadge value={detailsModal.item.status} />], ["Received", formatNumber(detailsModal.item.totalReceivedQuantity)], ["Accepted", formatNumber(detailsModal.item.totalAcceptedQuantity)], ["Quarantine", formatNumber(detailsModal.item.totalQuarantineQuantity)], ["Accepted Value", formatMoney(detailsModal.item.totalAcceptedValue, detailsModal.item.currency)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 font-black text-gray-950">{value}</div></div>)}</div><SectionCard title="Receipt information"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Purchase Order", detailsModal.item.purchaseOrder?.orderNo || "-"], ["Supplier", relationLabel(detailsModal.item.supplier, detailsModal.item.supplierSnapshot?.name)], ["Warehouse", relationLabel(detailsModal.item.warehouse, "-")], ["Receipt Date", formatDate(detailsModal.item.receiptDate)], ["Delivery Note", detailsModal.item.supplierDeliveryNote || "-"], ["Supplier Invoice", detailsModal.item.supplierInvoiceNo || "-"], ["Vehicle", detailsModal.item.vehicleNo || "-"], ["Received By", detailsModal.item.receivedByName || "-"]].map(([label, value]) => <div key={label}><p className="text-xs font-bold text-gray-400">{label}</p><p className="mt-1 text-sm font-bold text-gray-900">{value}</p></div>)}</div></SectionCard><SectionCard title="Inspection lines"><div className="overflow-x-auto"><table className="min-w-[1000px] w-full"><thead><tr className="text-left text-xs font-black uppercase text-gray-400"><th className="pb-3">Product</th><th className="pb-3">Received</th><th className="pb-3">Accepted</th><th className="pb-3">Quarantine</th><th className="pb-3">Rejected</th><th className="pb-3">Quality</th><th className="pb-3 text-right">Value</th></tr></thead><tbody className="divide-y divide-gray-100">{(detailsModal.item.lines || []).map((line) => <tr key={line._id}><td className="py-3"><p className="font-bold text-gray-900">{line.product?.name || line.productSnapshot?.name || "-"}</p><p className="text-xs font-semibold text-gray-500">{line.product?.sku || line.productSnapshot?.code || line.lotNumber || "-"}</p></td><td className="py-3 font-bold">{formatNumber(line.receivedQuantity)}</td><td className="py-3 font-bold">{formatNumber(line.acceptedQuantity)}</td><td className="py-3 font-bold">{formatNumber(line.quarantineQuantity)}</td><td className="py-3 font-bold">{formatNumber(line.rejectedQuantity)}</td><td className="py-3"><StatusBadge value={line.qualityStatus} /></td><td className="py-3 text-right font-black">{formatMoney(line.lineValue, detailsModal.item.currency)}</td></tr>)}</tbody></table></div></SectionCard>{detailsModal.item.movement ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-semibold text-indigo-800">Inventory movement: {detailsModal.item.movement.movementNo} · {pretty(detailsModal.item.movement.status)}</div> : null}{detailsModal.item.reversalReason || detailsModal.item.cancellationReason ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{detailsModal.item.reversalReason || detailsModal.item.cancellationReason}</div> : null}</div> : null}
      </ModalShell>

      <ReasonModal state={reasonState} saving={busy.id === reasonState.item?._id && busy.type === reasonState.type} setReason={(reason) => setReasonState((previous) => ({ ...previous, reason, error: "" }))} onClose={() => setReasonState((previous) => ({ ...previous, open: false, reason: "", error: "" }))} onSubmit={() => { if (!clean(reasonState.reason)) return setReasonState((previous) => ({ ...previous, error: "Reason is required." })); runAction(reasonState.item, reasonState.type, clean(reasonState.reason)) }} />
    </div>
  )
}
