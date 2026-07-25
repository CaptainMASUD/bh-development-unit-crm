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
  PERMISSIONS?.PURCHASE_RETURN_MANAGE || "purchase-return:manage"
const APPROVE_PERMISSION =
  PERMISSIONS?.PURCHASE_RETURN_APPROVE || "purchase-return:approve"
const POST_PERMISSION =
  PERMISSIONS?.PURCHASE_RETURN_POST || "purchase-return:post"
const REVERSE_PERMISSION =
  PERMISSIONS?.PURCHASE_RETURN_REVERSE || "purchase-return:reverse"
const DELETE_PERMISSION =
  PERMISSIONS?.PURCHASE_RETURN_DELETE || "purchase-return:delete"

const FALLBACK_META = {
  statuses: ["draft", "submitted", "approved", "posted", "reversed", "cancelled"],
  editableStatuses: ["draft"],
  reasons: [
    "damaged",
    "quality_failure",
    "wrong_item",
    "excess_quantity",
    "expired",
    "supplier_recall",
    "other",
  ],
  stockBuckets: ["available", "quarantine"],
}

const EMPTY_SUMMARY = {
  returnCount: 0,
  draftCount: 0,
  submittedCount: 0,
  approvedCount: 0,
  postedCount: 0,
  reversedCount: 0,
  totalReturnQuantity: 0,
  totalReturnValue: 0,
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
  return `${clean(currency || "BDT")} ${Number(value || 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`
}

function relationLabel(item, fallback = "Unnamed") {
  if (!item) return fallback
  const name = item.businessName || item.name || item.label || fallback
  const code =
    item.code || item.returnNo || item.receiptNo || item.orderNo || item.sku || item.symbol || ""
  return `${name}${code ? ` (${code})` : ""}`
}

function makeClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createIdempotencyKey(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${crypto.randomUUID()}`
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) / 1_000_000
}

function parseSerials(value) {
  return [
    ...new Set(
      clean(value)
        .split(/[\n,]+/)
        .map((item) => clean(item).toUpperCase())
        .filter(Boolean)
    ),
  ]
}

function sourceKey(goodsReceiptLine, stockBucket) {
  return `${normalizeId(goodsReceiptLine)}:${stockBucket}`
}

function emptyForm() {
  return {
    returnDate: todayInput(),
    supplier: "",
    purchaseOrder: "",
    goodsReceipt: "",
    warehouse: "",
    supplierReturnAuthorization: "",
    currency: "BDT",
    notes: "",
    lines: [],
  }
}

function buildReceiptSources(receipt, productMap = new Map()) {
  const sources = []

  for (const line of receipt?.lines || []) {
    const productId = normalizeId(line.product)
    const product =
      typeof line.product === "object"
        ? line.product
        : productMap.get(String(productId)) || null

    const available = roundQuantity(
      line.returnableAvailableQuantity ??
        Number(line.acceptedQuantity || 0) - Number(line.returnedAvailableQuantity || 0)
    )
    const quarantine = roundQuantity(
      line.returnableQuarantineQuantity ??
        Number(line.quarantineQuantity || 0) - Number(line.returnedQuarantineQuantity || 0)
    )

    const common = {
      purchaseOrderLine: normalizeId(line.purchaseOrderLine),
      goodsReceiptLine: line._id,
      product: productId,
      purchaseUnit: normalizeId(line.purchaseUnit),
      productSnapshot: line.productSnapshot || {
        code: product?.sku || "",
        name: product?.name || "",
      },
      unitSnapshot: line.unitSnapshot || {},
      productRecord: product,
      unitCost: String(line.unitCost ?? 0),
      lotNumber: line.lotNumber || "",
      trackingType: product?.trackingType || "none",
    }

    if (available > 0) {
      sources.push({
        ...common,
        clientId: makeClientId(),
        enabled: false,
        stockBucket: "available",
        sourceLocation: normalizeId(line.acceptedLocation),
        returnableQuantity: String(available),
        returnQuantity: "0",
        reasonCode: "damaged",
        reasonDetails: "",
        serialNumbersText: "",
      })
    }

    if (quarantine > 0) {
      sources.push({
        ...common,
        clientId: makeClientId(),
        enabled: false,
        stockBucket: "quarantine",
        sourceLocation: normalizeId(line.quarantineLocation),
        returnableQuantity: String(quarantine),
        returnQuantity: "0",
        reasonCode: "quality_failure",
        reasonDetails: "",
        serialNumbersText: "",
      })
    }
  }

  return sources
}

function mergeExistingLines(sources, existingLines = [], productMap = new Map()) {
  const byKey = new Map(
    sources.map((line) => [sourceKey(line.goodsReceiptLine, line.stockBucket), line])
  )

  for (const existing of existingLines) {
    const key = sourceKey(existing.goodsReceiptLine, existing.stockBucket)
    const current = byKey.get(key)
    const productId = normalizeId(existing.product)
    const product =
      typeof existing.product === "object"
        ? existing.product
        : productMap.get(String(productId)) || null

    byKey.set(key, {
      ...(current || {}),
      clientId: current?.clientId || existing._id || makeClientId(),
      _id: existing._id,
      enabled: true,
      purchaseOrderLine: normalizeId(existing.purchaseOrderLine),
      goodsReceiptLine: normalizeId(existing.goodsReceiptLine),
      product: productId,
      purchaseUnit: normalizeId(existing.purchaseUnit),
      productSnapshot: existing.productSnapshot || current?.productSnapshot || {},
      unitSnapshot: existing.unitSnapshot || current?.unitSnapshot || {},
      productRecord: product || current?.productRecord || null,
      sourceLocation: normalizeId(existing.sourceLocation),
      stockBucket: existing.stockBucket || "available",
      returnQuantity: String(existing.returnQuantity ?? 0),
      returnableQuantity: String(
        current?.returnableQuantity ?? existing.returnableQuantity ?? existing.returnQuantity ?? 0
      ),
      unitCost: String(existing.unitCost ?? current?.unitCost ?? 0),
      reasonCode: existing.reasonCode || "other",
      reasonDetails: existing.reasonDetails || "",
      lotNumber: existing.lotNumber || current?.lotNumber || "",
      serialNumbersText: (existing.serialNumbers || []).join("\n"),
      trackingType:
        existing.product?.trackingType || product?.trackingType || current?.trackingType || "none",
    })
  }

  return [...byKey.values()]
}

function Icon({ icon, className = "h-4 w-4", strokeWidth = 1.8, ...props }) {
  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}

function Field({ label, hint, required = false, children }) {
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

function FocusPlaceholderInput({ placeholder = "", onFocus, onBlur, ...props }) {
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

function FocusPlaceholderTextarea({ placeholder = "", onFocus, onBlur, ...props }) {
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

function StatusBadge({ value }) {
  const styles = {
    draft: "bg-gray-100 text-gray-700 ring-gray-200",
    submitted: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    posted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    reversed: "bg-violet-50 text-violet-700 ring-violet-200",
    cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
    available: "bg-sky-50 text-sky-700 ring-sky-200",
    quarantine: "bg-amber-50 text-amber-700 ring-amber-200",
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1",
        styles[value] || styles.draft
      )}
    >
      {pretty(value)}
    </span>
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
  maxWidthClass = "max-w-6xl",
}) {
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
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={cn(
            "w-full overflow-hidden rounded-3xl bg-white shadow-2xl",
            maxWidthClass
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                {icon}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-gray-950">{title}</h2>
                {subtitle ? (
                  <p className="truncate text-xs font-semibold text-gray-500">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
              onClick={onClose}
              aria-label="Close modal"
            >
              <Icon icon={Cancel01Icon} className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-175px)] overflow-y-auto p-4 sm:p-5">
            {children}
          </div>

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

function authHeaders() {
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
      ...authHeaders(),
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

function SummaryCards({ summary, onSelect }) {
  const items = [
    ["All Returns", summary.returnCount, "all", formatMoney(summary.totalReturnValue)],
    ["Drafts", summary.draftCount, "draft", "Being prepared"],
    ["Submitted", summary.submittedCount, "submitted", "Waiting for approval"],
    ["Approved", summary.approvedCount, "approved", "Ready to post"],
    ["Posted", summary.postedCount, "posted", `${formatNumber(summary.totalReturnQuantity)} returned`],
    ["Reversed", summary.reversedCount, "reversed", "Compensating movement created"],
  ]

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map(([label, value, tab, note]) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(tab)}
          className={cn(
            card,
            "p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/20"
          )}
        >
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">
            {label}
          </p>
          <p className="mt-2 text-xl font-black text-gray-950">
            {formatNumber(value, 0)}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-gray-500">{note}</p>
        </button>
      ))}
    </div>
  )
}

function ReasonModal({ state, saving, onClose, onSubmit, setReason }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title || "Provide a reason"}
      subtitle={state.item?.returnNo || "Purchase return"}
      icon={<Icon icon={Alert02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(button, state.danger ? dangerButton : primaryButton)}
            onClick={onSubmit}
            disabled={saving}
          >
            <Icon
              icon={saving ? RefreshIcon : Tick02Icon}
              className={cn("h-4 w-4", saving ? "animate-spin" : "")}
            />
            {saving ? "Saving" : state.actionLabel || "Continue"}
          </button>
        </div>
      }
    >
      <Field label="Reason" required>
        <FocusPlaceholderTextarea
          className={cn(input, "min-h-[120px] resize-none")}
          value={state.reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Enter the business reason..."
          maxLength={1000}
          autoFocus
        />
      </Field>
      {state.error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {state.error}
        </p>
      ) : null}
    </ModalShell>
  )
}

function FilterModal({
  open,
  onClose,
  filters,
  updateFilter,
  resetFilters,
  suppliers,
  purchaseOrders,
  goodsReceipts,
  warehouses,
  products,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filter purchase returns"
      subtitle="Narrow the list without adding permanent sidebar options."
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" className={cn(button, ghostButton)} onClick={resetFilters}>
            Clear Filters
          </button>
          <button type="button" className={cn(button, primaryButton)} onClick={onClose}>
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            Apply Filters
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier">
          <select
            className={input}
            value={filters.supplier}
            onChange={(event) => updateFilter("supplier", event.target.value)}
          >
            <option value="all">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>
                {relationLabel(supplier)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Purchase Order">
          <select
            className={input}
            value={filters.purchaseOrder}
            onChange={(event) => updateFilter("purchaseOrder", event.target.value)}
          >
            <option value="all">All purchase orders</option>
            {purchaseOrders.map((order) => (
              <option key={order._id} value={order._id}>
                {order.orderNo}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Goods Receipt">
          <select
            className={input}
            value={filters.goodsReceipt}
            onChange={(event) => updateFilter("goodsReceipt", event.target.value)}
          >
            <option value="all">All goods receipts</option>
            {goodsReceipts.map((receipt) => (
              <option key={receipt._id} value={receipt._id}>
                {receipt.receiptNo}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Warehouse">
          <select
            className={input}
            value={filters.warehouse}
            onChange={(event) => updateFilter("warehouse", event.target.value)}
          >
            <option value="all">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse._id} value={warehouse._id}>
                {relationLabel(warehouse)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Product">
          <select
            className={input}
            value={filters.product}
            onChange={(event) => updateFilter("product", event.target.value)}
          >
            <option value="all">All products</option>
            {products.map((product) => (
              <option key={product._id} value={product._id}>
                {relationLabel(product)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From Date">
            <input
              className={input}
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </Field>
          <Field label="To Date">
            <input
              className={input}
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </Field>
        </div>
      </div>
    </ModalShell>
  )
}

export default function PurchaseReturns({ initialGoodsReceiptId = "" }) {
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
  const [returns, setReturns] = useState([])
  const [goodsReceipts, setGoodsReceipts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [products, setProducts] = useState([])
  const [units, setUnits] = useState([])
  const [locationsByWarehouse, setLocationsByWarehouse] = useState({})

  const [activeTab, setActiveTab] = useState("all")
  const [filters, setFilters] = useState({
    q: "",
    supplier: "all",
    purchaseOrder: "all",
    goodsReceipt: "all",
    warehouse: "all",
    product: "all",
    dateFrom: "",
    dateTo: "",
  })
  const [filterOpen, setFilterOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [busy, setBusy] = useState({ id: "", type: "" })

  const [formModal, setFormModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [lineSearch, setLineSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [detailsModal, setDetailsModal] = useState({ open: false, item: null })
  const [reasonState, setReasonState] = useState({
    open: false,
    item: null,
    type: "",
    title: "",
    actionLabel: "",
    danger: false,
    reason: "",
    error: "",
  })

  const productMap = useMemo(
    () => new Map(products.map((item) => [String(item._id), item])),
    [products]
  )
  const unitMap = useMemo(
    () => new Map(units.map((item) => [String(item._id), item])),
    [units]
  )
  const receiptMap = useMemo(
    () => new Map(goodsReceipts.map((item) => [String(item._id), item])),
    [goodsReceipts]
  )

  const selectedReceipt = receiptMap.get(String(form.goodsReceipt)) || null
  const locations = locationsByWarehouse[form.warehouse] || []

  const selectedLines = useMemo(
    () => form.lines.filter((line) => line.enabled && Number(line.returnQuantity || 0) > 0),
    [form.lines]
  )

  const totals = useMemo(
    () =>
      selectedLines.reduce(
        (result, line) => {
          result.quantity += Number(line.returnQuantity || 0)
          result.value += Number(line.returnQuantity || 0) * Number(line.unitCost || 0)
          if (line.stockBucket === "quarantine") result.quarantine += Number(line.returnQuantity || 0)
          else result.available += Number(line.returnQuantity || 0)
          return result
        },
        { quantity: 0, value: 0, available: 0, quarantine: 0 }
      ),
    [selectedLines]
  )

  const filteredFormLines = useMemo(() => {
    const query = clean(lineSearch).toLowerCase()
    if (!query) return form.lines
    return form.lines.filter((line) => {
      const product = productMap.get(String(line.product)) || line.productRecord
      const haystack = [
        product?.name,
        product?.sku,
        line.productSnapshot?.name,
        line.productSnapshot?.code,
        line.stockBucket,
        line.lotNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [form.lines, lineSearch, productMap])

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([key, value]) => key !== "q" && value && value !== "all"
      ).length + (activeTab !== "all" ? 1 : 0),
    [filters, activeTab]
  )

  const loadLocations = async (warehouseId) => {
    if (!warehouseId) return []
    if (locationsByWarehouse[warehouseId]) return locationsByWarehouse[warehouseId]

    try {
      const data = await api(
        `/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(
          warehouseId
        )}&limit=200`
      )
      const rows = data.locations || []
      setLocationsByWarehouse((previous) => ({
        ...previous,
        [warehouseId]: rows,
      }))
      return rows
    } catch (error) {
      toast.error(error.message || "Failed to load warehouse locations")
      return []
    }
  }

  const loadReferenceData = async () => {
    try {
      const [metaData, receiptData, supplierData, orderData, warehouseData, productData, unitData] =
        await Promise.all([
          api("/purchase/purchase-returns/meta"),
          api("/purchase/goods-receipts/options?limit=100"),
          api("/suppliers/options?limit=100"),
          api("/purchase/purchase-orders/options?limit=100"),
          api("/inventory/warehouses/options?limit=100"),
          api("/inventory/products?status=active&limit=100"),
          api("/inventory/units/options?limit=200"),
        ])

      setMeta({ ...FALLBACK_META, ...(metaData || {}) })
      setGoodsReceipts(receiptData.goodsReceipts || [])
      setSuppliers(supplierData.suppliers || [])
      setPurchaseOrders(orderData.purchaseOrders || [])
      setWarehouses(warehouseData.warehouses || [])
      setProducts(productData.products || [])
      setUnits(unitData.units || [])
    } catch (error) {
      toast.error(error.message || "Failed to load purchase-return options")
    }
  }

  const buildParams = ({ append = false } = {}) => {
    const params = new URLSearchParams({ limit: "40" })
    if (activeTab !== "all") params.set("status", activeTab)
    if (clean(filters.q)) params.set("q", clean(filters.q))
    if (filters.supplier !== "all") params.set("supplier", filters.supplier)
    if (filters.purchaseOrder !== "all") params.set("purchaseOrder", filters.purchaseOrder)
    if (filters.goodsReceipt !== "all") params.set("goodsReceipt", filters.goodsReceipt)
    if (filters.warehouse !== "all") params.set("warehouse", filters.warehouse)
    if (filters.product !== "all") params.set("product", filters.product)
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
    if (filters.dateTo) params.set("dateTo", filters.dateTo)
    if (append && nextCursor) params.set("cursor", nextCursor)
    return params
  }

  const loadReturns = async ({ append = false, signal } = {}) => {
    append ? setLoadingMore(true) : setLoading(true)

    try {
      const data = await api(`/purchase/purchase-returns?${buildParams({ append })}`, {
        signal,
      })
      const incoming = data.purchaseReturns || []
      setReturns((previous) => (append ? [...previous, ...incoming] : incoming))
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || "Failed to load purchase returns")
      }
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  const loadSummary = async ({ signal } = {}) => {
    try {
      const data = await api(`/purchase/purchase-returns/summary?${buildParams()}`, {
        signal,
      })
      setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) })
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || "Failed to load purchase-return summary")
      }
    }
  }

  useEffect(() => {
    loadReferenceData()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      Promise.all([
        loadReturns({ signal: controller.signal }),
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
    filters.supplier,
    filters.purchaseOrder,
    filters.goodsReceipt,
    filters.warehouse,
    filters.product,
    filters.dateFrom,
    filters.dateTo,
  ])

  useEffect(() => {
    if (initialGoodsReceiptId && canManage) openCreate(initialGoodsReceiptId)
  }, [initialGoodsReceiptId])

  const refresh = async () =>
    Promise.all([loadReferenceData(), loadReturns(), loadSummary()])

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setNextCursor(null)
    setHasMore(false)
  }

  const resetFilters = () => {
    setActiveTab("all")
    setFilters({
      q: "",
      supplier: "all",
      purchaseOrder: "all",
      goodsReceipt: "all",
      warehouse: "all",
      product: "all",
      dateFrom: "",
      dateTo: "",
    })
    setFilterOpen(false)
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setNextCursor(null)
    setHasMore(false)
  }

  const resolveReceipt = async (receiptId) => {
    const option = receiptMap.get(String(receiptId))
    if (option) return option

    const data = await api(`/purchase/goods-receipts/${receiptId}`)
    const receipt = data.goodsReceipt
    return {
      ...receipt,
      lines: (receipt.lines || []).map((line) => ({
        ...line,
        returnableAvailableQuantity: roundQuantity(
          Number(line.acceptedQuantity || 0) - Number(line.returnedAvailableQuantity || 0)
        ),
        returnableQuarantineQuantity: roundQuantity(
          Number(line.quarantineQuantity || 0) - Number(line.returnedQuarantineQuantity || 0)
        ),
      })),
    }
  }

  const hydrateFromReceipt = async (receiptId, current = emptyForm(), existingLines = []) => {
    if (!receiptId) {
      return {
        ...current,
        supplier: "",
        purchaseOrder: "",
        goodsReceipt: "",
        warehouse: "",
        lines: [],
      }
    }

    const receipt = await resolveReceipt(receiptId)
    const warehouseId = normalizeId(receipt.warehouse)
    await loadLocations(warehouseId)
    const sources = buildReceiptSources(receipt, productMap)

    return {
      ...current,
      goodsReceipt: receipt._id,
      supplier: normalizeId(receipt.supplier),
      purchaseOrder: normalizeId(receipt.purchaseOrder),
      warehouse: warehouseId,
      currency: receipt.currency || "BDT",
      lines: mergeExistingLines(sources, existingLines, productMap),
    }
  }

  async function openCreate(receiptId = "") {
    setBusy({ id: receiptId, type: "create" })
    try {
      let next = emptyForm()
      if (receiptId) next = await hydrateFromReceipt(receiptId, next)
      setForm(next)
      setLineSearch("")
      setFormError("")
      setFormModal({ open: true, item: null })
    } catch (error) {
      toast.error(error.message || "Failed to prepare purchase return")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const changeReceipt = async (receiptId) => {
    setBusy({ id: receiptId, type: "receipt" })
    try {
      const next = await hydrateFromReceipt(receiptId, {
        ...form,
        lines: [],
      })
      setForm(next)
      setFormError("")
      setLineSearch("")
    } catch (error) {
      setFormError(error.message || "Failed to load goods receipt")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const setLine = (clientId, patch) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId ? { ...line, ...patch } : line
      ),
    }))
  }

  const toggleLine = (clientId, enabled) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => {
        if (line.clientId !== clientId) return line
        const max = Number(line.returnableQuantity || 0)
        return {
          ...line,
          enabled,
          returnQuantity:
            enabled && Number(line.returnQuantity || 0) <= 0
              ? String(Math.min(max, 1))
              : enabled
              ? line.returnQuantity
              : "0",
          serialNumbersText: enabled ? line.serialNumbersText : "",
        }
      }),
    }))
  }

  const openEdit = async (purchaseReturn) => {
    setBusy({ id: purchaseReturn._id, type: "edit" })
    try {
      const data = await api(`/purchase/purchase-returns/${purchaseReturn._id}`)
      const item = data.purchaseReturn
      const base = {
        returnDate: toDateInput(item.returnDate),
        supplier: normalizeId(item.supplier),
        purchaseOrder: normalizeId(item.purchaseOrder),
        goodsReceipt: normalizeId(item.goodsReceipt),
        warehouse: normalizeId(item.warehouse),
        supplierReturnAuthorization: item.supplierReturnAuthorization || "",
        currency: item.currency || "BDT",
        notes: item.notes || "",
        lines: [],
      }
      const hydrated = await hydrateFromReceipt(
        normalizeId(item.goodsReceipt),
        base,
        item.lines || []
      )
      setForm(hydrated)
      setLineSearch("")
      setFormError("")
      setFormModal({ open: true, item })
    } catch (error) {
      toast.error(error.message || "Failed to load purchase return")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const openDetails = async (purchaseReturn) => {
    setBusy({ id: purchaseReturn._id, type: "view" })
    try {
      const data = await api(`/purchase/purchase-returns/${purchaseReturn._id}`)
      setDetailsModal({ open: true, item: data.purchaseReturn })
    } catch (error) {
      toast.error(error.message || "Failed to load purchase return")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const closeForm = (force = false) => {
    if (saving && !force) return
    setFormModal({ open: false, item: null })
    setForm(emptyForm())
    setFormError("")
    setLineSearch("")
  }

  const validateForm = () => {
    if (!form.returnDate) return "Return date is required."
    if (!form.goodsReceipt) return "A posted goods receipt is required."
    if (!form.warehouse) return "Return warehouse is required."
    if (!selectedLines.length) return "Select at least one line and enter a return quantity."

    for (let index = 0; index < selectedLines.length; index += 1) {
      const line = selectedLines[index]
      const label = `Selected line ${index + 1}`
      const quantity = Number(line.returnQuantity)
      const returnable = Number(line.returnableQuantity)
      const unitCost = Number(line.unitCost)

      if (!line.goodsReceiptLine) return `${label}: goods-receipt line is missing.`
      if (!line.purchaseOrderLine) return `${label}: purchase-order line is missing.`
      if (!line.product) return `${label}: product is missing.`
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `${label}: return quantity must be greater than zero.`
      }
      if (quantity > returnable) {
        return `${label}: return quantity cannot exceed ${formatNumber(returnable)}.`
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return `${label}: unit cost must be a valid non-negative number.`
      }
      if (!meta.reasons.includes(line.reasonCode)) {
        return `${label}: select a valid return reason.`
      }
      if (line.stockBucket === "quarantine" && !line.sourceLocation) {
        return `${label}: quarantine source location is required.`
      }
      if (line.trackingType === "serial") {
        const serials = parseSerials(line.serialNumbersText)
        if (!Number.isInteger(quantity)) {
          return `${label}: serial-tracked quantities must be whole numbers.`
        }
        if (serials.length !== quantity) {
          return `${label}: enter one serial number for each returned unit.`
        }
      }
    }

    return ""
  }

  const buildPayload = () => ({
    returnDate: form.returnDate,
    supplier: form.supplier || null,
    purchaseOrder: form.purchaseOrder || null,
    goodsReceipt: form.goodsReceipt,
    warehouse: form.warehouse,
    supplierReturnAuthorization: clean(form.supplierReturnAuthorization).toUpperCase(),
    currency: clean(form.currency || "BDT").toUpperCase(),
    notes: clean(form.notes),
    lines: selectedLines.map((line) => ({
      ...(line._id ? { _id: line._id } : {}),
      purchaseOrderLine: line.purchaseOrderLine,
      goodsReceiptLine: line.goodsReceiptLine,
      product: line.product,
      purchaseUnit: line.purchaseUnit || null,
      sourceLocation: line.sourceLocation || null,
      stockBucket: line.stockBucket,
      returnQuantity: Number(line.returnQuantity || 0),
      unitCost: Number(line.unitCost || 0),
      reasonCode: line.reasonCode,
      reasonDetails: clean(line.reasonDetails),
      lotNumber: clean(line.lotNumber).toUpperCase(),
      serialNumbers: parseSerials(line.serialNumbersText),
    })),
    ...(formModal.item ? { version: formModal.item.__v } : {}),
  })

  const saveReturn = async (event) => {
    event.preventDefault()
    setFormError("")

    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    try {
      const editing = Boolean(formModal.item?._id)
      await api(
        editing
          ? `/purchase/purchase-returns/${formModal.item._id}`
          : "/purchase/purchase-returns",
        {
          method: editing ? "PATCH" : "POST",
          headers: editing
            ? {}
            : { "Idempotency-Key": createIdempotencyKey("purchase-return") },
          body: JSON.stringify(buildPayload()),
        }
      )
      toast.success(editing ? "Purchase return updated" : "Purchase-return draft created")
      closeForm(true)
      await Promise.all([loadReturns(), loadSummary(), loadReferenceData()])
    } catch (error) {
      setFormError(error.message || "Failed to save purchase return")
    } finally {
      setSaving(false)
    }
  }

  const requestReason = (item, type) => {
    const config = {
      reverse: {
        title: "Reverse posted purchase return",
        actionLabel: "Reverse Return",
        danger: true,
      },
      cancel: {
        title: "Cancel purchase return",
        actionLabel: "Cancel Return",
        danger: true,
      },
    }[type]

    setReasonState({
      open: true,
      item,
      type,
      title: config?.title || "Provide a reason",
      actionLabel: config?.actionLabel || "Continue",
      danger: Boolean(config?.danger),
      reason: "",
      error: "",
    })
  }

  const runAction = async (item, type, reason = "") => {
    setBusy({ id: item._id, type })
    try {
      const path = `/purchase/purchase-returns/${item._id}/${type}`
      await api(path, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      })
      toast.success(
        type === "submit"
          ? "Purchase return submitted"
          : type === "approve"
          ? "Purchase return approved"
          : type === "post"
          ? "Purchase return posted to inventory"
          : type === "reverse"
          ? "Purchase return reversed"
          : "Purchase return cancelled"
      )
      setReasonState((previous) => ({ ...previous, open: false, reason: "", error: "" }))
      await Promise.all([loadReturns(), loadSummary(), loadReferenceData()])
    } catch (error) {
      if (reasonState.open) {
        setReasonState((previous) => ({
          ...previous,
          error: error.message || "Action failed",
        }))
      } else {
        toast.error(error.message || "Action failed")
      }
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const deleteReturn = async (item) => {
    if (!window.confirm(`Delete purchase return "${item.returnNo}"?`)) return

    setBusy({ id: item._id, type: "delete" })
    try {
      await api(`/purchase/purchase-returns/${item._id}`, { method: "DELETE" })
      toast.success("Purchase return deleted")
      await Promise.all([loadReturns(), loadSummary(), loadReferenceData()])
    } catch (error) {
      toast.error(error.message || "Failed to delete purchase return")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const renderActions = (item, mobile = false) => {
    const actionClass = mobile ? "flex-1 px-3 py-2" : "h-9 w-9 p-0"
    const isBusy = busy.id === item._id

    return (
      <div className={cn("flex flex-wrap items-center gap-2", mobile ? "mt-4" : "justify-end") }>
        <button
          type="button"
          className={cn(button, ghostButton, actionClass)}
          onClick={() => openDetails(item)}
          disabled={isBusy}
          title="View purchase return"
        >
          <Icon
            icon={isBusy && busy.type === "view" ? RefreshIcon : ViewIcon}
            className={cn("h-4 w-4", isBusy && busy.type === "view" ? "animate-spin" : "")}
          />
          {mobile ? "View" : null}
        </button>

        {canManage && item.status === "draft" ? (
          <button
            type="button"
            className={cn(button, ghostButton, actionClass)}
            onClick={() => openEdit(item)}
            disabled={isBusy}
            title="Edit purchase return"
          >
            <Icon
              icon={isBusy && busy.type === "edit" ? RefreshIcon : Edit02Icon}
              className={cn("h-4 w-4", isBusy && busy.type === "edit" ? "animate-spin" : "")}
            />
            {mobile ? "Edit" : null}
          </button>
        ) : null}

        {canManage && item.status === "draft" ? (
          <button
            type="button"
            className={cn(button, primaryButton, actionClass)}
            onClick={() => runAction(item, "submit")}
            disabled={isBusy}
            title="Submit for approval"
          >
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            {mobile ? "Submit" : null}
          </button>
        ) : null}

        {canApprove && item.status === "submitted" ? (
          <button
            type="button"
            className={cn(button, primaryButton, actionClass)}
            onClick={() => runAction(item, "approve")}
            disabled={isBusy}
            title="Approve purchase return"
          >
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            {mobile ? "Approve" : null}
          </button>
        ) : null}

        {canPost && item.status === "approved" ? (
          <button
            type="button"
            className={cn(button, primaryButton, actionClass)}
            onClick={() => runAction(item, "post")}
            disabled={isBusy}
            title="Post inventory return"
          >
            <Icon icon={FloppyDiskIcon} className="h-4 w-4" />
            {mobile ? "Post" : null}
          </button>
        ) : null}

        {canReverse && item.status === "posted" ? (
          <button
            type="button"
            className={cn(button, dangerButton, actionClass)}
            onClick={() => requestReason(item, "reverse")}
            disabled={isBusy}
            title="Reverse purchase return"
          >
            <Icon icon={RefreshIcon} className="h-4 w-4" />
            {mobile ? "Reverse" : null}
          </button>
        ) : null}

        {canManage && ["draft", "submitted", "approved"].includes(item.status) ? (
          <button
            type="button"
            className={cn(button, dangerButton, actionClass)}
            onClick={() => requestReason(item, "cancel")}
            disabled={isBusy}
            title="Cancel purchase return"
          >
            <Icon icon={Cancel01Icon} className="h-4 w-4" />
            {mobile ? "Cancel" : null}
          </button>
        ) : null}

        {canDelete && ["draft", "cancelled"].includes(item.status) ? (
          <button
            type="button"
            className={cn(button, dangerButton, actionClass)}
            onClick={() => deleteReturn(item)}
            disabled={isBusy}
            title="Delete purchase return"
          >
            <Icon icon={Archive02Icon} className="h-4 w-4" />
            {mobile ? "Delete" : null}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />

      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700 ring-1 ring-indigo-100">
              <Icon icon={FolderLibraryIcon} className="h-4 w-4" />
              Purchase Management
            </div>
            <h1 className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
              Purchase Returns
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">
              Return available or quarantined stock against posted goods receipts with approval,
              posting, reversal, and quantity controls.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={refresh}
              disabled={loading}
            >
              <Icon icon={RefreshIcon} className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
              Refresh
            </button>
            {canManage ? (
              <button
                type="button"
                className={cn(button, primaryButton)}
                onClick={() => openCreate()}
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                New Purchase Return
              </button>
            ) : null}
          </div>
        </div>

        {!canManage ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            You have view-only purchase-return access. Workflow actions depend on your assigned
            permissions.
          </div>
        ) : null}

        <SummaryCards summary={summary} onSelect={switchTab} />

        <div className={cn(card, "mb-6 p-3 sm:p-4")}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-h-[44px] flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-3 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
              <Icon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />
              <FocusPlaceholderInput
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:ring-0"
                value={filters.q}
                onChange={(event) => updateFilter("q", event.target.value)}
                placeholder="Search by return number..."
                aria-label="Search purchase returns"
              />
            </div>

            <button
              type="button"
              className={cn(button, ghostButton, "relative")}
              onClick={() => setFilterOpen(true)}
            >
              <Icon icon={FilterIcon} className="h-4 w-4" />
              Filters
              {activeFilterCount ? (
                <span className="ml-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {["all", ...meta.statuses].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => switchTab(status)}
                className={cn(
                  "whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black transition",
                  activeTab === status
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                )}
              >
                {status === "all" ? "All Returns" : pretty(status)}
              </button>
            ))}
          </div>
        </div>

        <div className={cn(card, "overflow-hidden")}>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1120px] w-full">
              <thead className="border-b border-gray-100 bg-gray-50/80">
                <tr className="text-left text-[11px] font-black uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-4">Return</th>
                  <th className="px-5 py-4">Supplier / Receipt</th>
                  <th className="px-5 py-4">Warehouse</th>
                  <th className="px-5 py-4">Quantity</th>
                  <th className="px-5 py-4">Value</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-5 py-16 text-center">
                      <Icon icon={RefreshIcon} className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
                      <p className="mt-3 text-sm font-semibold text-gray-500">Loading purchase returns...</p>
                    </td>
                  </tr>
                ) : returns.length ? (
                  returns.map((item) => (
                    <tr key={item._id} className="transition hover:bg-gray-50/60">
                      <td className="px-5 py-4">
                        <p className="font-black text-gray-950">{item.returnNo}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          {formatDate(item.returnDate)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">
                          {relationLabel(item.supplier, item.supplierSnapshot?.name || "Supplier")}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-gray-500">
                          {item.goodsReceipt?.receiptNo || "-"} · {item.purchaseOrder?.orderNo || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-700">
                        {relationLabel(item.warehouse, "-")}
                      </td>
                      <td className="px-5 py-4 font-black text-gray-900">
                        {formatNumber(item.totalReturnQuantity)}
                      </td>
                      <td className="px-5 py-4 font-black text-gray-900">
                        {formatMoney(item.totalReturnValue, item.currency)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={item.status} />
                      </td>
                      <td className="px-5 py-4">{renderActions(item)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-5 py-16 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                        <Icon icon={FolderLibraryIcon} className="h-6 w-6" />
                      </div>
                      <p className="mt-3 font-black text-gray-900">No purchase returns found</p>
                      <p className="mt-1 text-sm font-semibold text-gray-500">
                        Change the filters or create a return from a posted goods receipt.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 lg:hidden">
            {loading ? (
              <div className="p-10 text-center">
                <Icon icon={RefreshIcon} className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : returns.length ? (
              returns.map((item) => (
                <div key={item._id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-gray-950">{item.returnNo}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        {formatDate(item.returnDate)} · {item.goodsReceipt?.receiptNo || "-"}
                      </p>
                    </div>
                    <StatusBadge value={item.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400">Supplier</p>
                      <p className="mt-1 truncate text-sm font-bold text-gray-800">
                        {item.supplier?.businessName || item.supplierSnapshot?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400">Warehouse</p>
                      <p className="mt-1 truncate text-sm font-bold text-gray-800">
                        {item.warehouse?.name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400">Quantity</p>
                      <p className="mt-1 text-sm font-black text-gray-900">
                        {formatNumber(item.totalReturnQuantity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400">Value</p>
                      <p className="mt-1 text-sm font-black text-gray-900">
                        {formatMoney(item.totalReturnValue, item.currency)}
                      </p>
                    </div>
                  </div>
                  {renderActions(item, true)}
                </div>
              ))
            ) : (
              <div className="p-10 text-center">
                <p className="font-black text-gray-900">No purchase returns found</p>
              </div>
            )}
          </div>

          {hasMore ? (
            <div className="border-t border-gray-100 p-4 text-center">
              <button
                type="button"
                className={cn(button, ghostButton)}
                onClick={() => loadReturns({ append: true })}
                disabled={loadingMore}
              >
                <Icon
                  icon={RefreshIcon}
                  className={cn("h-4 w-4", loadingMore ? "animate-spin" : "")}
                />
                {loadingMore ? "Loading" : "Load More"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        suppliers={suppliers}
        purchaseOrders={purchaseOrders}
        goodsReceipts={goodsReceipts}
        warehouses={warehouses}
        products={products}
      />

      <ModalShell
        open={formModal.open}
        onClose={closeForm}
        title={formModal.item ? "Update purchase return" : "Create purchase return"}
        subtitle={
          formModal.item?.returnNo ||
          selectedReceipt?.receiptNo ||
          "Return stock to a supplier"
        }
        icon={<Icon icon={formModal.item ? Edit02Icon : Add01Icon} className="h-5 w-5" />}
        maxWidthClass="max-w-7xl"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold text-gray-500">
              {selectedLines.length} selected line{selectedLines.length === 1 ? "" : "s"} · {formatNumber(totals.quantity)} units
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={cn(button, ghostButton)}
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="purchase-return-form"
                className={cn(button, primaryButton)}
                disabled={saving}
              >
                <Icon
                  icon={saving ? RefreshIcon : FloppyDiskIcon}
                  className={cn("h-4 w-4", saving ? "animate-spin" : "")}
                />
                {saving ? "Saving" : formModal.item ? "Update Draft" : "Create Draft"}
              </button>
            </div>
          </div>
        }
      >
        <form id="purchase-return-form" onSubmit={saveReturn} className="space-y-5">
          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {formError}
            </div>
          ) : null}

          <SectionCard
            title="Return source"
            description="A purchase return must reference a posted goods receipt with remaining returnable stock."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Return Date" required>
                <input
                  className={input}
                  type="date"
                  value={form.returnDate}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, returnDate: event.target.value }))
                  }
                />
              </Field>

              <Field label="Posted Goods Receipt" required>
                <select
                  className={input}
                  value={form.goodsReceipt}
                  onChange={(event) => changeReceipt(event.target.value)}
                  disabled={Boolean(formModal.item) || busy.type === "receipt"}
                >
                  <option value="">Select goods receipt</option>
                  {goodsReceipts.map((receipt) => (
                    <option key={receipt._id} value={receipt._id}>
                      {receipt.receiptNo} · {receipt.supplier?.businessName || receipt.supplierSnapshot?.name || "Supplier"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Supplier">
                <input
                  className={input}
                  value={
                    selectedReceipt?.supplier?.businessName ||
                    selectedReceipt?.supplierSnapshot?.name ||
                    suppliers.find((item) => String(item._id) === String(form.supplier))?.businessName ||
                    ""
                  }
                  readOnly
                />
              </Field>

              <Field label="Purchase Order">
                <input
                  className={input}
                  value={
                    selectedReceipt?.purchaseOrder?.orderNo ||
                    purchaseOrders.find((item) => String(item._id) === String(form.purchaseOrder))?.orderNo ||
                    ""
                  }
                  readOnly
                />
              </Field>

              <Field label="Warehouse">
                <input
                  className={input}
                  value={
                    selectedReceipt?.warehouse?.name ||
                    warehouses.find((item) => String(item._id) === String(form.warehouse))?.name ||
                    ""
                  }
                  readOnly
                />
              </Field>

              <Field label="Currency">
                <FocusPlaceholderInput
                  className={input}
                  value={form.currency}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      currency: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="BDT"
                  maxLength={12}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Supplier Return Authorization" hint="Optional RMA or supplier authorization reference">
                  <FocusPlaceholderInput
                    className={input}
                    value={form.supplierReturnAuthorization}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        supplierReturnAuthorization: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="RMA-2026-001"
                    maxLength={120}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Return lines"
            description="Enable only the stock buckets being returned. Quantities cannot exceed the current returnable balance."
          >
            <div className="mb-4 flex min-h-[44px] items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/20">
              <Icon icon={Search01Icon} className="h-4 w-4 text-gray-400" />
              <FocusPlaceholderInput
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm font-semibold outline-none focus:ring-0"
                value={lineSearch}
                onChange={(event) => setLineSearch(event.target.value)}
                placeholder="Search receipt products or stock buckets..."
              />
            </div>

            {!form.goodsReceipt ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
                <p className="font-black text-gray-900">Select a posted goods receipt first</p>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  Returnable available and quarantine stock will appear here.
                </p>
              </div>
            ) : filteredFormLines.length ? (
              <div className="space-y-4">
                {filteredFormLines.map((line, index) => {
                  const product = productMap.get(String(line.product)) || line.productRecord
                  const unit = unitMap.get(String(line.purchaseUnit))
                  const location = locations.find(
                    (item) => String(item._id) === String(line.sourceLocation)
                  )
                  const lineValue =
                    Number(line.returnQuantity || 0) * Number(line.unitCost || 0)

                  return (
                    <div
                      key={line.clientId}
                      className={cn(
                        "rounded-2xl border p-4 transition sm:p-5",
                        line.enabled
                          ? "border-indigo-200 bg-indigo-50/25"
                          : "border-gray-100 bg-white"
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <label className="mt-1 inline-flex cursor-pointer items-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              checked={Boolean(line.enabled)}
                              onChange={(event) => toggleLine(line.clientId, event.target.checked)}
                            />
                          </label>
                          <div className="min-w-0">
                            <p className="font-black text-gray-950">
                              {product?.name || line.productSnapshot?.name || `Receipt line ${index + 1}`}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-gray-500">
                              {product?.sku || line.productSnapshot?.code || "-"} · {unit?.symbol || line.unitSnapshot?.code || "Unit"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={line.stockBucket} />
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
                            Returnable {formatNumber(line.returnableQuantity)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Source Location" required={line.stockBucket === "quarantine"}>
                          <input
                            className={input}
                            value={relationLabel(location, line.sourceLocation ? "Selected location" : "No specific location")}
                            readOnly
                          />
                        </Field>

                        <Field label="Return Quantity" required={line.enabled}>
                          <input
                            className={input}
                            type="number"
                            min="0"
                            max={line.returnableQuantity}
                            step="0.000001"
                            value={line.returnQuantity}
                            disabled={!line.enabled}
                            onChange={(event) =>
                              setLine(line.clientId, { returnQuantity: event.target.value })
                            }
                          />
                        </Field>

                        <Field label="Unit Cost">
                          <input
                            className={input}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCost}
                            disabled={!line.enabled}
                            onChange={(event) =>
                              setLine(line.clientId, { unitCost: event.target.value })
                            }
                          />
                        </Field>

                        <Field label="Return Reason" required={line.enabled}>
                          <select
                            className={input}
                            value={line.reasonCode}
                            disabled={!line.enabled}
                            onChange={(event) =>
                              setLine(line.clientId, { reasonCode: event.target.value })
                            }
                          >
                            {meta.reasons.map((reason) => (
                              <option key={reason} value={reason}>
                                {pretty(reason)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Lot Number">
                          <FocusPlaceholderInput
                            className={input}
                            value={line.lotNumber}
                            disabled={!line.enabled}
                            onChange={(event) =>
                              setLine(line.clientId, {
                                lotNumber: event.target.value.toUpperCase(),
                              })
                            }
                            placeholder="Batch or lot number"
                          />
                        </Field>

                        <div className="md:col-span-1 xl:col-span-3">
                          <Field label="Reason Details" hint="Optional supporting detail">
                            <FocusPlaceholderInput
                              className={input}
                              value={line.reasonDetails}
                              disabled={!line.enabled}
                              onChange={(event) =>
                                setLine(line.clientId, { reasonDetails: event.target.value })
                              }
                              placeholder="Damage, quality issue, wrong item, supplier instruction..."
                              maxLength={1000}
                            />
                          </Field>
                        </div>

                        {line.trackingType === "serial" ? (
                          <div className="md:col-span-2 xl:col-span-4">
                            <Field
                              label="Serial Numbers"
                              hint="Enter one serial per returned unit, separated by new lines or commas."
                              required={line.enabled}
                            >
                              <FocusPlaceholderTextarea
                                className={cn(input, "min-h-[105px] resize-none")}
                                value={line.serialNumbersText}
                                disabled={!line.enabled}
                                onChange={(event) =>
                                  setLine(line.clientId, {
                                    serialNumbersText: event.target.value,
                                  })
                                }
                                placeholder="SN-001\nSN-002"
                              />
                            </Field>
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-950 px-4 py-3 text-white">
                        <p className="text-xs font-semibold text-gray-300">
                          {line.enabled
                            ? `${formatNumber(line.returnQuantity)} of ${formatNumber(line.returnableQuantity)} selected`
                            : "Not included in this return"}
                        </p>
                        <p className="text-sm font-black">
                          {formatMoney(line.enabled ? lineValue : 0, form.currency)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm font-semibold text-amber-800">
                No returnable receipt lines match this search, or all quantities have already been returned.
              </div>
            )}
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <SectionCard title="Return notes">
              <Field label="Internal Notes">
                <FocusPlaceholderTextarea
                  className={cn(input, "min-h-[160px] resize-none")}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, notes: event.target.value }))
                  }
                  placeholder="Supplier communication, packaging, transport, debit-note, or follow-up notes..."
                  maxLength={3000}
                />
              </Field>
            </SectionCard>

            <SectionCard
              title="Return summary"
              description="Stock decreases only after approval and posting."
            >
              <div className="rounded-2xl bg-gray-950 p-4 text-white">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400">Selected Lines</p>
                    <p className="mt-1 text-lg font-black">{selectedLines.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Total Quantity</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(totals.quantity)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Available Stock</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(totals.available)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Quarantine Stock</p>
                    <p className="mt-1 text-lg font-black">{formatNumber(totals.quarantine)}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-xs font-bold text-gray-400">Total Return Value</p>
                  <p className="mt-1 text-2xl font-black">
                    {formatMoney(totals.value, form.currency)}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={detailsModal.open}
        onClose={() => setDetailsModal({ open: false, item: null })}
        title={detailsModal.item?.returnNo || "Purchase-return details"}
        subtitle={
          detailsModal.item
            ? `${detailsModal.item.goodsReceipt?.receiptNo || "Goods receipt"} · ${formatDate(detailsModal.item.returnDate)}`
            : ""
        }
        icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
        maxWidthClass="max-w-6xl"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={() => setDetailsModal({ open: false, item: null })}
            >
              Close
            </button>
          </div>
        }
      >
        {detailsModal.item ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Status", <StatusBadge value={detailsModal.item.status} />],
                ["Lines", formatNumber(detailsModal.item.lineCount, 0)],
                ["Quantity", formatNumber(detailsModal.item.totalReturnQuantity)],
                ["Value", formatMoney(detailsModal.item.totalReturnValue, detailsModal.item.currency)],
                ["Posted", detailsModal.item.postedAt ? formatDate(detailsModal.item.postedAt) : "-"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
                  <div className="mt-2 font-black text-gray-950">{value}</div>
                </div>
              ))}
            </div>

            <SectionCard title="Return information">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Supplier", relationLabel(detailsModal.item.supplier, detailsModal.item.supplierSnapshot?.name)],
                  ["Purchase Order", detailsModal.item.purchaseOrder?.orderNo || "-"],
                  ["Goods Receipt", detailsModal.item.goodsReceipt?.receiptNo || "-"],
                  ["Warehouse", relationLabel(detailsModal.item.warehouse, "-")],
                  ["Return Date", formatDate(detailsModal.item.returnDate)],
                  ["Authorization", detailsModal.item.supplierReturnAuthorization || "-"],
                  ["Currency", detailsModal.item.currency || "BDT"],
                  ["Movement", detailsModal.item.movement?.movementNo || "-"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-bold text-gray-400">{label}</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Return lines">
              <div className="overflow-x-auto">
                <table className="min-w-[1050px] w-full">
                  <thead>
                    <tr className="text-left text-xs font-black uppercase text-gray-400">
                      <th className="pb-3">Product</th>
                      <th className="pb-3">Bucket</th>
                      <th className="pb-3">Location</th>
                      <th className="pb-3">Quantity</th>
                      <th className="pb-3">Reason</th>
                      <th className="pb-3">Lot / Serials</th>
                      <th className="pb-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(detailsModal.item.lines || []).map((line) => (
                      <tr key={line._id}>
                        <td className="py-3">
                          <p className="font-bold text-gray-900">
                            {line.product?.name || line.productSnapshot?.name || "-"}
                          </p>
                          <p className="text-xs font-semibold text-gray-500">
                            {line.product?.sku || line.productSnapshot?.code || "-"}
                          </p>
                        </td>
                        <td className="py-3"><StatusBadge value={line.stockBucket} /></td>
                        <td className="py-3 font-semibold text-gray-700">
                          {relationLabel(line.sourceLocation, "No specific location")}
                        </td>
                        <td className="py-3 font-black text-gray-900">
                          {formatNumber(line.returnQuantity)}
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-gray-900">{pretty(line.reasonCode)}</p>
                          <p className="max-w-[240px] truncate text-xs font-semibold text-gray-500">
                            {line.reasonDetails || "-"}
                          </p>
                        </td>
                        <td className="py-3">
                          <p className="font-bold text-gray-900">{line.lotNumber || "-"}</p>
                          <p className="text-xs font-semibold text-gray-500">
                            {(line.serialNumbers || []).length
                              ? `${line.serialNumbers.length} serials`
                              : "No serials"}
                          </p>
                        </td>
                        <td className="py-3 text-right font-black text-gray-900">
                          {formatMoney(line.lineValue, detailsModal.item.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {detailsModal.item.notes ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm font-semibold leading-6 text-gray-700">
                {detailsModal.item.notes}
              </div>
            ) : null}

            {detailsModal.item.reversalReason || detailsModal.item.cancellationReason ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                {detailsModal.item.reversalReason || detailsModal.item.cancellationReason}
              </div>
            ) : null}
          </div>
        ) : null}
      </ModalShell>

      <ReasonModal
        state={reasonState}
        saving={busy.id === reasonState.item?._id && busy.type === reasonState.type}
        setReason={(reason) =>
          setReasonState((previous) => ({ ...previous, reason, error: "" }))
        }
        onClose={() =>
          setReasonState((previous) => ({
            ...previous,
            open: false,
            reason: "",
            error: "",
          }))
        }
        onSubmit={() => {
          if (!clean(reasonState.reason)) {
            setReasonState((previous) => ({
              ...previous,
              error: "Reason is required.",
            }))
            return
          }
          runAction(reasonState.item, reasonState.type, clean(reasonState.reason))
        }}
      />
    </div>
  )
}
