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
    PERMISSIONS?.INVENTORY_TRANSFER_MANAGE ||
    "inventory-transfer:manage",
  approve:
    PERMISSIONS?.INVENTORY_TRANSFER_APPROVE ||
    "inventory-transfer:approve",
  dispatch:
    PERMISSIONS?.INVENTORY_TRANSFER_DISPATCH ||
    "inventory-transfer:dispatch",
  receive:
    PERMISSIONS?.INVENTORY_TRANSFER_RECEIVE ||
    "inventory-transfer:receive",
  reverse:
    PERMISSIONS?.INVENTORY_TRANSFER_REVERSE ||
    "inventory-transfer:reverse",
  delete:
    PERMISSIONS?.INVENTORY_TRANSFER_DELETE ||
    "inventory-transfer:delete",
}

const TRANSFER_MODES = [
  ["direct", "Direct Transfer"],
  ["two_step", "Two-Step Transfer"],
]

const TRANSFER_STATUSES = [
  ["draft", "Draft"],
  ["submitted", "Submitted"],
  ["approved", "Approved"],
  ["dispatched", "Dispatched"],
  ["partially_received", "Partially Received"],
  ["received", "Received"],
  ["closed_short", "Closed Short"],
  ["rejected", "Rejected"],
  ["cancelled", "Cancelled"],
  ["reversed", "Reversed"],
]

const emptySummary = {
  totalTransfers: 0,
  draft: 0,
  awaitingApproval: 0,
  inTransit: 0,
  received: 0,
  requestedQuantity: 0,
  dispatchedQuantity: 0,
  receivedQuantity: 0,
  shortQuantity: 0,
  transferValue: 0,
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
const warningButton =
  "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
const successButton =
  "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
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

function createClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createRequestKey(prefix = "transfer") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function nowInputValue() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16)
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

function toDateInput(value, dateOnly = false) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000).toISOString()
  return dateOnly ? local.slice(0, 10) : local.slice(0, 16)
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

function parseSerials(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\n,]+/)
        .map((item) => clean(item).toUpperCase())
        .filter(Boolean)
    ),
  ]
}

function remainingQuantity(line) {
  return Math.max(
    Number(line.dispatchedQuantity || 0) -
      Number(line.receivedQuantity || 0) -
      Number(line.shortQuantity || 0),
    0
  )
}

function emptyLine() {
  return {
    clientId: createClientId(),
    product: "",
    sourceLocation: "",
    destinationLocation: "",
    requestedQuantity: "1",
    unitCost: "0",
    lotNumber: "",
    serialNumbersText: "",
    manufactureDate: "",
    expiryDate: "",
    note: "",
  }
}

function emptyForm() {
  return {
    transferDate: nowInputValue(),
    expectedDeliveryDate: "",
    transferMode: "two_step",
    sourceWarehouse: "",
    destinationWarehouse: "",
    reference: "",
    externalReference: "",
    clientRequestId: createRequestKey("request"),
    currency: "BDT",
    reason: "",
    notes: "",
    lines: [emptyLine()],
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
        <p className="mt-1 text-xs font-medium text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

function SectionCard({ title, description, children, action }) {
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

function StatusBadge({ value }) {
  const status = String(value || "").toLowerCase()
  const style =
    status === "received"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "draft"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
        : status === "submitted"
          ? "bg-sky-50 text-sky-700 ring-sky-100"
          : status === "approved"
            ? "bg-teal-50 text-teal-700 ring-teal-100"
            : ["dispatched", "partially_received"].includes(status)
              ? "bg-violet-50 text-violet-700 ring-violet-100"
              : status === "closed_short"
                ? "bg-amber-50 text-amber-700 ring-amber-100"
                : status === "rejected"
                  ? "bg-rose-50 text-rose-700 ring-rose-100"
                  : status === "reversed"
                    ? "bg-orange-50 text-orange-700 ring-orange-100"
                    : "bg-gray-100 text-gray-700 ring-gray-200"

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
          status === "received"
            ? "bg-emerald-500"
            : status === "draft"
              ? "bg-indigo-500"
              : status === "submitted"
                ? "bg-sky-500"
                : status === "approved"
                  ? "bg-teal-500"
                  : ["dispatched", "partially_received"].includes(status)
                    ? "bg-violet-500"
                    : status === "closed_short"
                      ? "bg-amber-500"
                      : status === "rejected"
                        ? "bg-rose-500"
                        : status === "reversed"
                          ? "bg-orange-500"
                          : "bg-gray-400"
        )}
      />
      {pretty(value)}
    </span>
  )
}

function ModeBadge({ value }) {
  const direct = value === "direct"
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        direct
          ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
          : "bg-sky-50 text-sky-700 ring-sky-100"
      )}
    >
      {direct ? "Direct" : "Two-Step"}
    </span>
  )
}

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      aria-label={`Remove ${label} filter`}
    >
      <span className="text-indigo-400">{label}:</span>
      <span className="max-w-[190px] truncate">{value}</span>
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
    const handler = (event) => {
      if (event.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
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
                    <p className="truncate text-sm text-gray-600">{subtitle}</p>
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

function SummaryCards({ summary, onSelectStatus }) {
  const rows = [
    ["Transfers", summary.totalTransfers, "All matching transfers", "all"],
    ["Drafts", summary.draft, "Still editable", "draft"],
    ["Awaiting Approval", summary.awaitingApproval, "Submitted documents", "submitted"],
    ["In Transit", summary.inTransit, "Dispatched or partial", "dispatched"],
    ["Received", summary.received, "Completed receipt", "received"],
    ["Transfer Value", formatMoney(summary.transferValue), `${formatNumber(summary.shortQuantity)} short`, "all"],
  ]

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {rows.map(([label, value, note, status]) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelectStatus(status)}
          className={cn(
            card,
            "p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/20"
          )}
        >
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">
            {label}
          </p>
          <p className="mt-2 truncate text-xl font-black text-gray-900">
            {typeof value === "number" ? formatNumber(value, 0) : value}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-gray-500">
            {note}
          </p>
        </button>
      ))}
    </div>
  )
}

export default function StockTransfers() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, PERMISSION.manage)
  const canApprove = hasPermission(currentUser, PERMISSION.approve)
  const canDispatch = hasPermission(currentUser, PERMISSION.dispatch)
  const canReceive = hasPermission(currentUser, PERMISSION.receive)
  const canReverse = hasPermission(currentUser, PERMISSION.reverse)
  const canDelete = hasPermission(currentUser, PERMISSION.delete)

  const [activeTab, setActiveTab] = useState("all")
  const [transfers, setTransfers] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [sourceLocations, setSourceLocations] = useState([])
  const [destinationLocations, setDestinationLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [openingId, setOpeningId] = useState("")
  const [loadingDetailsId, setLoadingDetailsId] = useState("")
  const [busy, setBusy] = useState({ id: "", type: "" })

  const [formModal, setFormModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    transfer: null,
  })

  const [approvalModal, setApprovalModal] = useState({
    open: false,
    transfer: null,
    lines: [],
    error: "",
  })

  const [receiptModal, setReceiptModal] = useState({
    open: false,
    transfer: null,
    receiveAll: true,
    idempotencyKey: createRequestKey("receipt"),
    lines: [],
    error: "",
  })

  const [reasonModal, setReasonModal] = useState({
    open: false,
    type: "",
    transfer: null,
    reason: "",
    error: "",
  })

  const [filters, setFilters] = useState({
    q: "",
    transferMode: "all",
    sourceWarehouse: "all",
    destinationWarehouse: "all",
    product: "all",
    from: "",
    to: "",
  })

  const productMap = useMemo(
    () => new Map(products.map((item) => [String(item._id), item])),
    [products]
  )
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((item) => [String(item._id), item])),
    [warehouses]
  )

  const activeFilterCount = useMemo(() => {
    let count = activeTab !== "all" ? 1 : 0
    if (clean(filters.q)) count += 1
    if (filters.transferMode !== "all") count += 1
    if (filters.sourceWarehouse !== "all") count += 1
    if (filters.destinationWarehouse !== "all") count += 1
    if (filters.product !== "all") count += 1
    if (filters.from) count += 1
    if (filters.to) count += 1
    return count
  }, [activeTab, filters])

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
  }

  const resetFilters = () => {
    setActiveTab("all")
    setFilters({
      q: "",
      transferMode: "all",
      sourceWarehouse: "all",
      destinationWarehouse: "all",
      product: "all",
      from: "",
      to: "",
    })
  }

  const loadOptions = async () => {
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
      toast.error(error.message || "Failed to load transfer options")
    }
  }

  const loadLocations = async (warehouseId, target) => {
    if (!warehouseId) {
      if (target === "source") setSourceLocations([])
      else setDestinationLocations([])
      return []
    }

    try {
      const data = await api(
        `/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(
          warehouseId
        )}&limit=200`
      )
      const rows = data.locations || []
      if (target === "source") setSourceLocations(rows)
      else setDestinationLocations(rows)
      return rows
    } catch (error) {
      if (target === "source") setSourceLocations([])
      else setDestinationLocations([])
      toast.error(error.message || "Failed to load warehouse locations")
      return []
    }
  }

  const buildParams = ({ append = false } = {}) => {
    const params = new URLSearchParams({ limit: "40" })
    if (activeTab !== "all") params.set("status", activeTab)
    if (clean(filters.q)) params.set("q", clean(filters.q))
    if (filters.transferMode !== "all") {
      params.set("transferMode", filters.transferMode)
    }
    if (filters.sourceWarehouse !== "all") {
      params.set("sourceWarehouse", filters.sourceWarehouse)
    }
    if (filters.destinationWarehouse !== "all") {
      params.set("destinationWarehouse", filters.destinationWarehouse)
    }
    if (filters.product !== "all") params.set("product", filters.product)
    if (filters.from) params.set("from", filters.from)
    if (filters.to) params.set("to", filters.to)
    if (append && nextCursor) params.set("cursor", nextCursor)
    return params
  }

  const loadTransfers = async ({ append = false, signal } = {}) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    try {
      const data = await api(
        `/inventory/stock-transfers?${buildParams({ append }).toString()}`,
        { signal }
      )
      const incoming = data.transfers || []
      setTransfers((previous) =>
        append ? [...previous, ...incoming] : incoming
      )
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || "Failed to load stock transfers")
      }
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }

  const loadSummary = async ({ signal } = {}) => {
    try {
      const data = await api(
        `/inventory/stock-transfers/summary?${buildParams().toString()}`,
        { signal }
      )
      setSummary({ ...emptySummary, ...(data.summary || {}) })
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || "Failed to load transfer summary")
      }
    }
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      Promise.all([
        loadTransfers({ signal: controller.signal }),
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
    filters.transferMode,
    filters.sourceWarehouse,
    filters.destinationWarehouse,
    filters.product,
    filters.from,
    filters.to,
  ])

  const refresh = async () => {
    await Promise.all([loadOptions(), loadTransfers(), loadSummary()])
  }

  const openCreate = () => {
    setForm(emptyForm())
    setFormError("")
    setShowAdvanced(false)
    setSourceLocations([])
    setDestinationLocations([])
    setFormModal({ open: true, item: null })
  }

  const openEdit = async (transfer) => {
    if (transfer.status !== "draft") {
      toast.error("Only a draft stock transfer can be edited.")
      return
    }

    setOpeningId(transfer._id)
    try {
      const data = await api(`/inventory/stock-transfers/${transfer._id}`)
      const item = data.transfer
      const sourceWarehouse = normalizeId(item.sourceWarehouse)
      const destinationWarehouse = normalizeId(item.destinationWarehouse)
      setForm({
        transferDate: toDateInput(item.transferDate),
        expectedDeliveryDate: toDateInput(
          item.expectedDeliveryDate,
          true
        ),
        transferMode: item.transferMode || "two_step",
        sourceWarehouse,
        destinationWarehouse,
        reference: item.reference || "",
        externalReference: item.externalReference || "",
        clientRequestId: item.clientRequestId || createRequestKey("request"),
        currency: item.currency || "BDT",
        reason: item.reason || "",
        notes: item.notes || "",
        lines: (item.lines || []).map((line) => ({
          clientId: line._id || createClientId(),
          product: normalizeId(line.product),
          sourceLocation: normalizeId(line.sourceLocation),
          destinationLocation: normalizeId(line.destinationLocation),
          requestedQuantity: String(line.requestedQuantity ?? 1),
          unitCost: String(line.unitCost ?? 0),
          lotNumber: line.lotNumber || "",
          serialNumbersText: (line.serialNumbers || []).join("\n"),
          manufactureDate: toDateInput(line.manufactureDate, true),
          expiryDate: toDateInput(line.expiryDate, true),
          note: line.note || "",
        })),
      })
      setFormError("")
      setShowAdvanced(false)
      setFormModal({ open: true, item })
      await Promise.all([
        loadLocations(sourceWarehouse, "source"),
        loadLocations(destinationWarehouse, "destination"),
      ])
    } catch (error) {
      toast.error(error.message || "Failed to load stock transfer")
    } finally {
      setOpeningId("")
    }
  }

  const closeForm = () => {
    if (saving) return
    setFormModal({ open: false, item: null })
    setForm(emptyForm())
    setFormError("")
    setSourceLocations([])
    setDestinationLocations([])
    setShowAdvanced(false)
  }

  const updateWarehouse = async (field, warehouseId) => {
    const locationField =
      field === "sourceWarehouse" ? "sourceLocation" : "destinationLocation"

    setForm((previous) => ({
      ...previous,
      [field]: warehouseId,
      lines: previous.lines.map((line) => ({
        ...line,
        [locationField]: "",
      })),
    }))

    await loadLocations(
      warehouseId,
      field === "sourceWarehouse" ? "source" : "destination"
    )
  }

  const updateLine = (clientId, key, value) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId ? { ...line, [key]: value } : line
      ),
    }))
  }

  const updateLineProduct = (clientId, productId) => {
    const product = productMap.get(String(productId))
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              product: productId,
              unitCost:
                Number(line.unitCost || 0) > 0
                  ? line.unitCost
                  : String(product?.purchasePrice ?? 0),
              lotNumber:
                product?.trackingType === "batch" ? line.lotNumber : "",
              serialNumbersText:
                product?.trackingType === "serial"
                  ? line.serialNumbersText
                  : "",
            }
          : line
      ),
    }))
  }

  const addLine = () => {
    if (form.lines.length >= 500) {
      toast.error("A stock transfer cannot contain more than 500 lines.")
      return
    }
    setForm((previous) => ({
      ...previous,
      lines: [...previous.lines, emptyLine()],
    }))
  }

  const duplicateLine = (line) => {
    if (form.lines.length >= 500) {
      toast.error("A stock transfer cannot contain more than 500 lines.")
      return
    }
    setForm((previous) => ({
      ...previous,
      lines: [
        ...previous.lines,
        { ...line, clientId: createClientId() },
      ],
    }))
  }

  const removeLine = (clientId) => {
    if (form.lines.length === 1) {
      toast.error("A stock transfer requires at least one line.")
      return
    }
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.filter((line) => line.clientId !== clientId),
    }))
  }

  const validateForm = () => {
    if (!form.transferDate) return "A valid transfer date is required."
    if (!form.sourceWarehouse) return "Source warehouse is required."
    if (!form.destinationWarehouse) return "Destination warehouse is required."
    if (!form.lines.length || form.lines.length > 500) {
      return "A stock transfer must contain between 1 and 500 lines."
    }
    if (
      form.expectedDeliveryDate &&
      new Date(form.expectedDeliveryDate) < new Date(form.transferDate)
    ) {
      return "Expected delivery date cannot be before the transfer date."
    }

    const seen = new Set()
    for (let index = 0; index < form.lines.length; index += 1) {
      const line = form.lines[index]
      const label = `Line ${index + 1}`
      const product = productMap.get(String(line.product))
      const quantity = Number(line.requestedQuantity)
      const cost = Number(line.unitCost || 0)

      if (!line.product) return `${label}: product is required.`
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `${label}: requested quantity must be greater than zero.`
      }
      if (!Number.isFinite(cost) || cost < 0) {
        return `${label}: unit cost must be a valid non-negative number.`
      }
      if (
        form.sourceWarehouse === form.destinationWarehouse &&
        (line.sourceLocation || "") === (line.destinationLocation || "")
      ) {
        return `${label}: source and destination positions must be different.`
      }
      if (product?.trackingType === "batch" && !clean(line.lotNumber)) {
        return `${label}: lot number is required for this batch-tracked product.`
      }
      if (product?.trackingType === "serial") {
        if (!Number.isInteger(quantity)) {
          return `${label}: serial-tracked quantity must be a whole number.`
        }
        if (parseSerials(line.serialNumbersText).length !== quantity) {
          return `${label}: provide one unique serial number per requested unit.`
        }
      }
      if (
        line.manufactureDate &&
        line.expiryDate &&
        new Date(line.expiryDate) < new Date(line.manufactureDate)
      ) {
        return `${label}: expiry date cannot be before manufacture date.`
      }

      const key = [
        line.product,
        line.sourceLocation || "none",
        line.destinationLocation || "none",
        clean(line.lotNumber).toUpperCase() || "none",
      ].join(":")
      if (seen.has(key)) return `${label}: duplicate product stock position.`
      seen.add(key)
    }
    return ""
  }

  const buildPayload = () => ({
    transferDate: form.transferDate,
    expectedDeliveryDate: form.expectedDeliveryDate || null,
    transferMode: form.transferMode,
    sourceWarehouse: form.sourceWarehouse,
    destinationWarehouse: form.destinationWarehouse,
    reference: clean(form.reference).toUpperCase(),
    externalReference: clean(form.externalReference),
    clientRequestId: clean(form.clientRequestId),
    currency: clean(form.currency || "BDT").toUpperCase(),
    reason: clean(form.reason),
    notes: clean(form.notes),
    lines: form.lines.map((line) => ({
      product: line.product,
      sourceLocation: line.sourceLocation || null,
      destinationLocation: line.destinationLocation || null,
      requestedQuantity: Number(line.requestedQuantity),
      unitCost: Number(line.unitCost || 0),
      lotNumber: clean(line.lotNumber).toUpperCase(),
      serialNumbers: parseSerials(line.serialNumbersText),
      manufactureDate: line.manufactureDate || null,
      expiryDate: line.expiryDate || null,
      note: clean(line.note),
    })),
  })

  const saveTransfer = async (event) => {
    event.preventDefault()
    setFormError("")
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)

    setSaving(true)
    try {
      const data = await api(
        formModal.item?._id
          ? `/inventory/stock-transfers/${formModal.item._id}`
          : "/inventory/stock-transfers",
        {
          method: formModal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(buildPayload()),
        }
      )
      toast.success(data.message || "Stock transfer saved")
      setFormModal({ open: false, item: null })
      setForm(emptyForm())
      setFormError("")
      setSourceLocations([])
      setDestinationLocations([])
      setShowAdvanced(false)
      await Promise.all([loadTransfers(), loadSummary()])
    } catch (error) {
      setFormError(error.message || "Failed to save stock transfer")
    } finally {
      setSaving(false)
    }
  }

  const openDetails = async (transfer) => {
    setLoadingDetailsId(transfer._id)
    try {
      const data = await api(`/inventory/stock-transfers/${transfer._id}`)
      setDetailsModal({ open: true, transfer: data.transfer })
    } catch (error) {
      toast.error(error.message || "Failed to load transfer details")
    } finally {
      setLoadingDetailsId("")
    }
  }

  const refreshDetailsIfOpen = async (id) => {
    if (detailsModal.transfer?._id !== id) return
    const data = await api(`/inventory/stock-transfers/${id}`)
    setDetailsModal({ open: true, transfer: data.transfer })
  }

  const runSimpleAction = async (
    transfer,
    type,
    endpoint,
    confirmMessage
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setBusy({ id: transfer._id, type })
    try {
      const data = await api(
        `/inventory/stock-transfers/${transfer._id}/${endpoint}`,
        { method: "POST", body: JSON.stringify({}) }
      )
      toast.success(data.message || `${pretty(type)} completed`)
      await Promise.all([loadTransfers(), loadSummary()])
      await refreshDetailsIfOpen(transfer._id)
    } catch (error) {
      toast.error(error.message || `Failed to ${type} stock transfer`)
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const submitTransfer = (transfer) =>
    runSimpleAction(
      transfer,
      "submit",
      "submit",
      `Submit "${transfer.transferNo}" for approval?`
    )

  const executeApprovedTransfer = (transfer) => {
    const direct = transfer.transferMode === "direct"
    return runSimpleAction(
      transfer,
      direct ? "post" : "dispatch",
      direct ? "post-direct" : "dispatch",
      direct
        ? `Post direct transfer "${transfer.transferNo}"? Stock leaves the source and enters the destination in one transaction.`
        : `Dispatch "${transfer.transferNo}"? Stock leaves the source and becomes incoming at the destination.`
    )
  }

  const openApproval = async (transfer) => {
    setBusy({ id: transfer._id, type: "approval" })
    try {
      const data = await api(`/inventory/stock-transfers/${transfer._id}`)
      const item = data.transfer
      setApprovalModal({
        open: true,
        transfer: item,
        error: "",
        lines: (item.lines || []).map((line) => ({
          lineId: line._id,
          product: line.product,
          requestedQuantity: Number(line.requestedQuantity || 0),
          approvedQuantity: String(
            Number(line.approvedQuantity || 0) > 0
              ? line.approvedQuantity
              : line.requestedQuantity
          ),
        })),
      })
    } catch (error) {
      toast.error(error.message || "Failed to load approval details")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const submitApproval = async (event) => {
    event.preventDefault()
    setApprovalModal((previous) => ({ ...previous, error: "" }))

    for (let index = 0; index < approvalModal.lines.length; index += 1) {
      const row = approvalModal.lines[index]
      const approved = Number(row.approvedQuantity)
      const product = row.product
      if (
        !Number.isFinite(approved) ||
        approved <= 0 ||
        approved > row.requestedQuantity
      ) {
        return setApprovalModal((previous) => ({
          ...previous,
          error: `Line ${index + 1}: approved quantity is invalid.`,
        }))
      }
      if (
        product?.trackingType === "serial" &&
        approved !== row.requestedQuantity
      ) {
        return setApprovalModal((previous) => ({
          ...previous,
          error: `Line ${index + 1}: partial approval is not supported for serial-tracked products.`,
        }))
      }
    }

    setSaving(true)
    try {
      const data = await api(
        `/inventory/stock-transfers/${approvalModal.transfer._id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({
            lines: approvalModal.lines.map((row) => ({
              lineId: row.lineId,
              approvedQuantity: Number(row.approvedQuantity),
            })),
          }),
        }
      )
      toast.success(data.message || "Stock transfer approved")
      setApprovalModal({ open: false, transfer: null, lines: [], error: "" })
      await Promise.all([loadTransfers(), loadSummary()])
    } catch (error) {
      setApprovalModal((previous) => ({
        ...previous,
        error: error.message || "Failed to approve stock transfer",
      }))
    } finally {
      setSaving(false)
    }
  }

  const openReceipt = async (transfer) => {
    setBusy({ id: transfer._id, type: "receive" })
    try {
      const data = await api(`/inventory/stock-transfers/${transfer._id}`)
      const item = data.transfer
      const rows = (item.lines || [])
        .filter((line) => remainingQuantity(line) > 0)
        .map((line) => {
          const availableSerials = (line.serialNumbers || []).filter(
            (serial) => !(line.receivedSerialNumbers || []).includes(serial)
          )
          return {
            lineId: line._id,
            selected: true,
            product: line.product,
            remainingQuantity: remainingQuantity(line),
            quantity: String(remainingQuantity(line)),
            availableSerials,
            serialNumbersText:
              line.product?.trackingType === "serial"
                ? availableSerials.join("\n")
                : "",
          }
        })

      setReceiptModal({
        open: true,
        transfer: item,
        receiveAll: true,
        idempotencyKey: createRequestKey("receipt"),
        lines: rows,
        error: "",
      })
    } catch (error) {
      toast.error(error.message || "Failed to load receivable quantities")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const submitReceipt = async (event) => {
    event.preventDefault()
    setReceiptModal((previous) => ({ ...previous, error: "" }))

    const key = clean(receiptModal.idempotencyKey)
    if (key.length < 8) {
      return setReceiptModal((previous) => ({
        ...previous,
        error: "Idempotency key must contain at least 8 characters.",
      }))
    }

    let lines
    if (!receiptModal.receiveAll) {
      const selected = receiptModal.lines.filter((row) => row.selected)
      if (!selected.length) {
        return setReceiptModal((previous) => ({
          ...previous,
          error: "Select at least one transfer line to receive.",
        }))
      }

      for (let index = 0; index < selected.length; index += 1) {
        const row = selected[index]
        const quantity = Number(row.quantity)
        if (
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          quantity > row.remainingQuantity
        ) {
          return setReceiptModal((previous) => ({
            ...previous,
            error: `Selected line ${index + 1}: receive quantity is invalid.`,
          }))
        }

        if (row.product?.trackingType === "serial") {
          const serialNumbers = parseSerials(row.serialNumbersText)
          if (!Number.isInteger(quantity) || serialNumbers.length !== quantity) {
            return setReceiptModal((previous) => ({
              ...previous,
              error: `Selected line ${index + 1}: provide one serial number per received unit.`,
            }))
          }
          const allowed = new Set(row.availableSerials)
          if (serialNumbers.some((serial) => !allowed.has(serial))) {
            return setReceiptModal((previous) => ({
              ...previous,
              error: `Selected line ${index + 1}: one or more serial numbers are invalid or already received.`,
            }))
          }
        }
      }

      lines = selected.map((row) => ({
        lineId: row.lineId,
        quantity: Number(row.quantity),
        serialNumbers:
          row.product?.trackingType === "serial"
            ? parseSerials(row.serialNumbersText)
            : [],
      }))
    }

    setSaving(true)
    try {
      const data = await api(
        `/inventory/stock-transfers/${receiptModal.transfer._id}/receive`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: key,
            ...(lines ? { lines } : {}),
          }),
        }
      )
      toast.success(data.message || "Stock transfer receipt posted")
      setReceiptModal({
        open: false,
        transfer: null,
        receiveAll: true,
        idempotencyKey: createRequestKey("receipt"),
        lines: [],
        error: "",
      })
      await Promise.all([loadTransfers(), loadSummary()])
    } catch (error) {
      setReceiptModal((previous) => ({
        ...previous,
        error: error.message || "Failed to receive stock transfer",
      }))
    } finally {
      setSaving(false)
    }
  }

  const openReason = (type, transfer) => {
    setReasonModal({
      open: true,
      type,
      transfer,
      reason: "",
      error: "",
    })
  }

  const closeReason = () => {
    if (saving) return
    setReasonModal({
      open: false,
      type: "",
      transfer: null,
      reason: "",
      error: "",
    })
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

    const endpoint =
      reasonModal.type === "close_short" ? "close-short" : reasonModal.type
    setSaving(true)
    try {
      const data = await api(
        `/inventory/stock-transfers/${reasonModal.transfer._id}/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      )
      toast.success(data.message || `${pretty(reasonModal.type)} completed`)
      setReasonModal({
        open: false,
        type: "",
        transfer: null,
        reason: "",
        error: "",
      })
      await Promise.all([loadTransfers(), loadSummary()])
    } catch (error) {
      setReasonModal((previous) => ({
        ...previous,
        error: error.message || `Failed to ${previous.type} stock transfer`,
      }))
    } finally {
      setSaving(false)
    }
  }

  const deleteTransfer = async (transfer) => {
    if (!window.confirm(`Delete draft transfer "${transfer.transferNo}"?`)) {
      return
    }

    setBusy({ id: transfer._id, type: "delete" })
    try {
      const data = await api(`/inventory/stock-transfers/${transfer._id}`, {
        method: "DELETE",
      })
      toast.success(data.message || "Stock transfer deleted")
      await Promise.all([loadTransfers(), loadSummary()])
    } catch (error) {
      toast.error(error.message || "Failed to delete stock transfer")
    } finally {
      setBusy({ id: "", type: "" })
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
                Stock Transfers
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Move inventory between warehouse positions through direct or
                controlled dispatch-and-receive workflows.
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
                className={cn("h-4 w-4", loading ? "animate-spin" : "")}
              />
              Refresh
            </button>
            {canManage ? (
              <button
                className={cn(button, primaryButton)}
                onClick={openCreate}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                New Transfer
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <TransferSearch
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            activeFilterCount={activeFilterCount}
            productMap={productMap}
            warehouseMap={warehouseMap}
            setActiveTab={setActiveTab}
            onOpenFilters={() => setFilterOpen(true)}
          />
          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing <span className="text-gray-900">{transfers.length}</span>{" "}
            transfers{hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      <SummaryCards summary={summary} onSelectStatus={setActiveTab} />

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {[
            ["all", "All"],
            ["draft", "Drafts"],
            ["submitted", "Submitted"],
            ["approved", "Approved"],
            ["dispatched", "Dispatched"],
            ["partially_received", "Partial"],
            ["received", "Received"],
            ["closed_short", "Closed Short"],
            ["rejected", "Rejected"],
            ["cancelled", "Cancelled"],
            ["reversed", "Reversed"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={cn(
                "inline-flex items-center justify-center rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm",
                activeTab === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => setActiveTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <TransferList
        transfers={transfers}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        openingId={openingId}
        loadingDetailsId={loadingDetailsId}
        busy={busy}
        permissions={{
          canManage,
          canApprove,
          canDispatch,
          canReceive,
          canReverse,
          canDelete,
        }}
        onView={openDetails}
        onEdit={openEdit}
        onSubmit={submitTransfer}
        onApprove={openApproval}
        onReject={(item) => openReason("reject", item)}
        onExecute={executeApprovedTransfer}
        onReceive={openReceipt}
        onCloseShort={(item) => openReason("close_short", item)}
        onReverse={(item) => openReason("reverse", item)}
        onCancel={(item) => openReason("cancel", item)}
        onDelete={deleteTransfer}
        onLoadMore={() => loadTransfers({ append: true })}
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
        warehouses={warehouses}
      />

      <TransferFormModal
        state={formModal}
        form={form}
        setForm={setForm}
        products={products}
        productMap={productMap}
        warehouses={warehouses}
        sourceLocations={sourceLocations}
        destinationLocations={destinationLocations}
        error={formError}
        saving={saving}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        onClose={closeForm}
        onSubmit={saveTransfer}
        onWarehouseChange={updateWarehouse}
        onLineChange={updateLine}
        onLineProductChange={updateLineProduct}
        onAddLine={addLine}
        onDuplicateLine={duplicateLine}
        onRemoveLine={removeLine}
      />

      <ApprovalModal
        state={approvalModal}
        setState={setApprovalModal}
        saving={saving}
        onClose={() =>
          !saving &&
          setApprovalModal({
            open: false,
            transfer: null,
            lines: [],
            error: "",
          })
        }
        onSubmit={submitApproval}
      />

      <ReceiptModal
        state={receiptModal}
        setState={setReceiptModal}
        saving={saving}
        onClose={() =>
          !saving &&
          setReceiptModal({
            open: false,
            transfer: null,
            receiveAll: true,
            idempotencyKey: createRequestKey("receipt"),
            lines: [],
            error: "",
          })
        }
        onSubmit={submitReceipt}
      />

      <ReasonModal
        state={reasonModal}
        setState={setReasonModal}
        saving={saving}
        onClose={closeReason}
        onSubmit={submitReason}
      />

      <DetailsModal
        state={detailsModal}
        onClose={() =>
          setDetailsModal({ open: false, transfer: null })
        }
      />
    </div>
  )
}

function TransferSearch({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  productMap,
  warehouseMap,
  setActiveTab,
  onOpenFilters,
}) {
  const chips = []
  if (activeTab !== "all") {
    chips.push([
      "Status",
      pretty(activeTab),
      () => setActiveTab("all"),
    ])
  }
  if (clean(filters.q)) {
    chips.push(["Search", clean(filters.q), () => updateFilter("q", "")])
  }
  if (filters.transferMode !== "all") {
    chips.push([
      "Mode",
      pretty(filters.transferMode),
      () => updateFilter("transferMode", "all"),
    ])
  }
  if (filters.sourceWarehouse !== "all") {
    chips.push([
      "From",
      relationLabel(
        warehouseMap.get(String(filters.sourceWarehouse)),
        "Selected warehouse"
      ),
      () => updateFilter("sourceWarehouse", "all"),
    ])
  }
  if (filters.destinationWarehouse !== "all") {
    chips.push([
      "To",
      relationLabel(
        warehouseMap.get(String(filters.destinationWarehouse)),
        "Selected warehouse"
      ),
      () => updateFilter("destinationWarehouse", "all"),
    ])
  }
  if (filters.product !== "all") {
    chips.push([
      "Product",
      relationLabel(
        productMap.get(String(filters.product)),
        "Selected product"
      ),
      () => updateFilter("product", "all"),
    ])
  }

  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "lg:min-w-[560px] lg:max-w-[82%] lg:flex-[0_1_82%]"
          : "lg:max-w-[55%] lg:flex-[0_1_55%]"
      )}
    >
      <div className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />
        {chips.map(([label, value, clear]) => (
          <FilterChip key={`${label}-${value}`} label={label} value={value} onClear={clear} />
        ))}
        <FocusInput
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search transfer number or reference..."
          aria-label="Search stock transfers"
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
            aria-label="Clear filters"
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
  warehouses,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Transfer filters"
      subtitle="Filter by workflow stage, mode, route, product, and transfer date."
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
            <button className={cn(button, ghostButton)} onClick={resetFilters} type="button">
              Reset
            </button>
            <button className={cn(button, primaryButton)} onClick={onClose} type="button">
              <Icon icon={Tick02Icon} className="h-4 w-4" />
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Status">
          <select className={input} value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
            <option value="all">All statuses</option>
            {TRANSFER_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Transfer Mode">
          <select className={input} value={filters.transferMode} onChange={(event) => updateFilter("transferMode", event.target.value)}>
            <option value="all">All modes</option>
            {TRANSFER_MODES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Product">
          <select className={input} value={filters.product} onChange={(event) => updateFilter("product", event.target.value)}>
            <option value="all">All products</option>
            {products.map((item) => (
              <option key={item._id} value={item._id}>{relationLabel(item)}</option>
            ))}
          </select>
        </Field>
        <Field label="Source Warehouse">
          <select className={input} value={filters.sourceWarehouse} onChange={(event) => updateFilter("sourceWarehouse", event.target.value)}>
            <option value="all">All source warehouses</option>
            {warehouses.map((item) => (
              <option key={item._id} value={item._id}>{relationLabel(item)}</option>
            ))}
          </select>
        </Field>
        <Field label="Destination Warehouse">
          <select className={input} value={filters.destinationWarehouse} onChange={(event) => updateFilter("destinationWarehouse", event.target.value)}>
            <option value="all">All destination warehouses</option>
            {warehouses.map((item) => (
              <option key={item._id} value={item._id}>{relationLabel(item)}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input className={input} type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          </Field>
          <Field label="To">
            <input className={input} type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
          </Field>
        </div>
      </div>
    </ModalShell>
  )
}

function TransferList({
  transfers,
  loading,
  loadingMore,
  hasMore,
  openingId,
  loadingDetailsId,
  busy,
  permissions,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onExecute,
  onReceive,
  onCloseShort,
  onReverse,
  onCancel,
  onDelete,
  onLoadMore,
}) {
  return (
    <div>
      <div className={cn(card, "overflow-hidden")}>
        <div className="hidden max-h-[680px] overflow-auto xl:block">
          <table className="min-w-[1650px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Transfer</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Route</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3">Products</th>
                <th className="px-5 py-3">Lines</th>
                <th className="px-5 py-3">Requested</th>
                <th className="px-5 py-3">Approved</th>
                <th className="px-5 py-3">Dispatched</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Short</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Expected</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transfers.map((transfer) => (
                <tr key={transfer._id} className="group bg-white transition hover:bg-gray-50/70">
                  <td className="px-5 py-4">
                    <div className="min-w-[210px]">
                      <p className="text-sm font-black text-indigo-700">{transfer.transferNo}</p>
                      <p className="mt-0.5 max-w-[230px] truncate text-xs font-semibold text-gray-500">
                        {transfer.reference || transfer.reason || "No reference"}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-black text-gray-700">{formatDate(transfer.transferDate, true)}</td>
                  <td className="px-5 py-4"><RouteLabel transfer={transfer} /></td>
                  <td className="px-5 py-4"><ModeBadge value={transfer.transferMode} /></td>
                  <td className="px-5 py-4"><ProductSummary products={transfer.products} /></td>
                  <td className="px-5 py-4 text-sm font-black text-gray-700">{formatNumber(transfer.lineCount, 0)}</td>
                  <QtyCell value={transfer.totalRequestedQuantity} />
                  <QtyCell value={transfer.totalApprovedQuantity} />
                  <QtyCell value={transfer.totalDispatchedQuantity} />
                  <QtyCell value={transfer.totalReceivedQuantity} positive />
                  <QtyCell value={transfer.totalShortQuantity} negative />
                  <td className="px-5 py-4 text-sm font-black text-gray-900">{formatMoney(transfer.totalValue, transfer.currency)}</td>
                  <td className="px-5 py-4"><StatusBadge value={transfer.status} /></td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">{formatDate(transfer.expectedDeliveryDate)}</td>
                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                    <TransferActions
                      transfer={transfer}
                      opening={String(openingId) === String(transfer._id)}
                      loadingDetails={String(loadingDetailsId) === String(transfer._id)}
                      busy={busy}
                      permissions={permissions}
                      onView={onView}
                      onEdit={onEdit}
                      onSubmit={onSubmit}
                      onApprove={onApprove}
                      onReject={onReject}
                      onExecute={onExecute}
                      onReceive={onReceive}
                      onCloseShort={onCloseShort}
                      onReverse={onReverse}
                      onCancel={onCancel}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))}
              {!transfers.length ? (
                <tr>
                  <td colSpan={15} className="px-5 py-14 text-center text-sm font-bold text-gray-500">
                    {loading ? "Loading stock transfers..." : "No stock transfers found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 xl:hidden">
          {transfers.map((transfer) => (
            <TransferMobileCard
              key={transfer._id}
              transfer={transfer}
              opening={String(openingId) === String(transfer._id)}
              loadingDetails={String(loadingDetailsId) === String(transfer._id)}
              busy={busy}
              permissions={permissions}
              onView={onView}
              onEdit={onEdit}
              onSubmit={onSubmit}
              onApprove={onApprove}
              onReject={onReject}
              onExecute={onExecute}
              onReceive={onReceive}
              onCloseShort={onCloseShort}
              onReverse={onReverse}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          ))}
          {!transfers.length ? (
            <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
              {loading ? "Loading stock transfers..." : "No stock transfers found."}
            </div>
          ) : null}
        </div>
      </div>

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button className={cn(button, ghostButton, "min-w-[150px]")} onClick={onLoadMore} disabled={loadingMore} type="button">
            <Icon icon={RefreshIcon} className={cn("h-4 w-4", loadingMore ? "animate-spin" : "")} />
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function QtyCell({ value, positive = false, negative = false }) {
  return (
    <td className={cn("px-5 py-4 text-sm font-black", positive ? "text-emerald-700" : negative && Number(value) > 0 ? "text-rose-700" : "text-gray-700")}>
      {formatNumber(value)}
    </td>
  )
}

function RouteLabel({ transfer }) {
  return (
    <div className="min-w-[230px]">
      <p className="truncate text-sm font-black text-gray-800">
        {transfer.sourceWarehouse?.name || "Unknown source"}
      </p>
      <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">
        {transfer.sourceWarehouse?.code || "-"} → {transfer.destinationWarehouse?.code || transfer.destinationWarehouse?.name || "Unknown destination"}
      </p>
    </div>
  )
}

function ProductSummary({ products = [] }) {
  if (!products.length) return <span className="text-sm font-semibold text-gray-500">No products</span>
  return (
    <div className="min-w-[180px]">
      <p className="truncate text-sm font-black text-gray-800">{products[0]?.name || "Product"}</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-500">
        {products.length === 1 ? products[0]?.sku || "-" : `+${products.length - 1} more products`}
      </p>
    </div>
  )
}

function TransferMobileCard(props) {
  const { transfer } = props
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-xs font-black text-indigo-700">ST</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-indigo-700">{transfer.transferNo}</h3>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">{formatDate(transfer.transferDate, true)}</p>
            </div>
            <StatusBadge value={transfer.status} />
          </div>
          <div className="mt-2"><ModeBadge value={transfer.transferMode} /></div>
          <div className="mt-3 rounded-xl bg-gray-50 p-3">
            <RouteLabel transfer={transfer} />
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <MiniMetric label="Requested" value={formatNumber(transfer.totalRequestedQuantity)} />
              <MiniMetric label="Approved" value={formatNumber(transfer.totalApprovedQuantity)} />
              <MiniMetric label="Dispatched" value={formatNumber(transfer.totalDispatchedQuantity)} />
              <MiniMetric label="Received" value={formatNumber(transfer.totalReceivedQuantity)} positive />
              <MiniMetric label="Short" value={formatNumber(transfer.totalShortQuantity)} negative={Number(transfer.totalShortQuantity) > 0} />
              <MiniMetric label="Value" value={formatMoney(transfer.totalValue, transfer.currency)} />
            </div>
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            <TransferActions {...props} mobile />
          </div>
        </div>
      </div>
    </article>
  )
}

function MiniMetric({ label, value, positive = false, negative = false }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn("mt-1 text-sm font-black", positive ? "text-emerald-700" : negative ? "text-rose-700" : "text-gray-800")}>{value}</p>
    </div>
  )
}

function TransferActions({
  transfer,
  opening,
  loadingDetails,
  busy,
  permissions,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onExecute,
  onReceive,
  onCloseShort,
  onReverse,
  onCancel,
  onDelete,
  mobile = false,
}) {
  const isBusy = String(busy.id) === String(transfer._id)
  const actionClass = mobile ? "px-3 py-2" : "px-3"
  const inTransit = ["dispatched", "partially_received"].includes(transfer.status)
  const reversible = ["dispatched", "partially_received", "received", "closed_short"].includes(transfer.status)

  return (
    <div className={cn("flex items-center gap-2", mobile ? "flex-wrap" : "justify-end")}>
      <button className={cn(button, ghostButton, actionClass)} onClick={() => onView(transfer)} disabled={loadingDetails} type="button" title="View transfer">
        <Icon icon={loadingDetails ? RefreshIcon : ViewIcon} className={cn("h-4 w-4", loadingDetails ? "animate-spin" : "")} />
        {mobile ? "View" : null}
      </button>

      {permissions.canManage && transfer.status === "draft" ? (
        <>
          <button className={cn(button, ghostButton, actionClass)} onClick={() => onEdit(transfer)} disabled={opening} type="button" title="Edit draft">
            <Icon icon={opening ? RefreshIcon : Edit02Icon} className={cn("h-4 w-4", opening ? "animate-spin" : "")} />
            {mobile ? "Edit" : null}
          </button>
          <button className={cn(button, primaryButton, actionClass)} onClick={() => onSubmit(transfer)} disabled={isBusy} type="button" title="Submit for approval">
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            {mobile ? "Submit" : null}
          </button>
        </>
      ) : null}

      {permissions.canApprove && transfer.status === "submitted" ? (
        <>
          <button className={cn(button, successButton, actionClass)} onClick={() => onApprove(transfer)} disabled={isBusy} type="button" title="Review and approve">
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            {mobile ? "Approve" : null}
          </button>
          <button className={cn(button, dangerButton, actionClass)} onClick={() => onReject(transfer)} type="button" title="Reject transfer">
            <Icon icon={Cancel01Icon} className="h-4 w-4" />
            {mobile ? "Reject" : null}
          </button>
        </>
      ) : null}

      {permissions.canDispatch && transfer.status === "approved" ? (
        <button className={cn(button, successButton, actionClass)} onClick={() => onExecute(transfer)} disabled={isBusy} type="button" title={transfer.transferMode === "direct" ? "Post direct transfer" : "Dispatch transfer"}>
          <Icon icon={Tick02Icon} className="h-4 w-4" />
          {mobile ? (transfer.transferMode === "direct" ? "Post" : "Dispatch") : null}
        </button>
      ) : null}

      {permissions.canReceive && inTransit ? (
        <>
          <button className={cn(button, successButton, actionClass)} onClick={() => onReceive(transfer)} disabled={isBusy} type="button" title="Receive stock">
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            {mobile ? "Receive" : null}
          </button>
          <button className={cn(button, warningButton, actionClass)} onClick={() => onCloseShort(transfer)} type="button" title="Close remaining quantity as shortage">
            <Icon icon={Cancel01Icon} className="h-4 w-4" />
            {mobile ? "Close Short" : null}
          </button>
        </>
      ) : null}

      {permissions.canReverse && reversible ? (
        <button className={cn(button, warningButton, actionClass)} onClick={() => onReverse(transfer)} type="button" title="Reverse posted stock effects">
          <Icon icon={RefreshIcon} className="h-4 w-4" />
          {mobile ? "Reverse" : null}
        </button>
      ) : null}

      {permissions.canManage && ["draft", "submitted", "approved"].includes(transfer.status) ? (
        <button className={cn(button, warningButton, actionClass)} onClick={() => onCancel(transfer)} type="button" title="Cancel transfer">
          <Icon icon={Cancel01Icon} className="h-4 w-4" />
          {mobile ? "Cancel" : null}
        </button>
      ) : null}

      {permissions.canDelete && transfer.status === "draft" ? (
        <button className={cn(button, dangerButton, actionClass)} onClick={() => onDelete(transfer)} disabled={isBusy} type="button" title="Delete draft">
          <Icon icon={Archive02Icon} className="h-4 w-4" />
          {mobile ? "Delete" : null}
        </button>
      ) : null}
    </div>
  )
}

function TransferFormModal({
  state,
  form,
  setForm,
  products,
  productMap,
  warehouses,
  sourceLocations,
  destinationLocations,
  error,
  saving,
  showAdvanced,
  setShowAdvanced,
  onClose,
  onSubmit,
  onWarehouseChange,
  onLineChange,
  onLineProductChange,
  onAddLine,
  onDuplicateLine,
  onRemoveLine,
}) {
  const totalQuantity = form.lines.reduce((sum, line) => sum + Number(line.requestedQuantity || 0), 0)
  const totalValue = form.lines.reduce((sum, line) => sum + Number(line.requestedQuantity || 0) * Number(line.unitCost || 0), 0)

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.item ? "Update stock transfer" : "New stock transfer"}
      subtitle={state.item ? state.item.transferNo : "Prepare a warehouse-to-warehouse stock request."}
      icon={<Icon icon={state.item ? Edit02Icon : Add01Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-[1500px]"
      footer={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-black text-gray-600">{form.lines.length} line{form.lines.length === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Qty {formatNumber(totalQuantity)}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Est. {formatMoney(totalValue, form.currency)}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className={cn(button, primaryButton)} type="submit" form="stock-transfer-form" disabled={saving}>
              <Icon icon={saving ? RefreshIcon : FloppyDiskIcon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />
              {saving ? "Saving..." : state.item ? "Update Draft" : "Save Draft"}
            </button>
          </div>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form id="stock-transfer-form" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionCard title="Transfer information" description="Choose a direct transfer for one-step posting or two-step for dispatch and receipt control.">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Transfer Date" required>
                <input className={input} type="datetime-local" value={form.transferDate} onChange={(event) => setForm((previous) => ({ ...previous, transferDate: event.target.value }))} required />
              </Field>
              <Field label="Expected Delivery">
                <input className={input} type="date" value={form.expectedDeliveryDate} onChange={(event) => setForm((previous) => ({ ...previous, expectedDeliveryDate: event.target.value }))} />
              </Field>
              <Field label="Transfer Mode" required>
                <select className={input} value={form.transferMode} onChange={(event) => setForm((previous) => ({ ...previous, transferMode: event.target.value }))}>
                  {TRANSFER_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Currency" required>
                <FocusInput className={input} value={form.currency} onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="Example: BDT" maxLength={12} required />
              </Field>
              <Field label="Source Warehouse" required>
                <select className={input} value={form.sourceWarehouse} onChange={(event) => onWarehouseChange("sourceWarehouse", event.target.value)} required>
                  <option value="">Select source warehouse</option>
                  {warehouses.map((item) => <option key={item._id} value={item._id}>{relationLabel(item)}</option>)}
                </select>
              </Field>
              <Field label="Destination Warehouse" required>
                <select className={input} value={form.destinationWarehouse} onChange={(event) => onWarehouseChange("destinationWarehouse", event.target.value)} required>
                  <option value="">Select destination warehouse</option>
                  {warehouses.map((item) => <option key={item._id} value={item._id}>{relationLabel(item)}</option>)}
                </select>
              </Field>
              <Field label="Reference">
                <FocusInput className={input} value={form.reference} onChange={(event) => setForm((previous) => ({ ...previous, reference: event.target.value.toUpperCase() }))} placeholder="Example: REQ-2026-001" maxLength={160} />
              </Field>
              <Field label="External Reference">
                <FocusInput className={input} value={form.externalReference} onChange={(event) => setForm((previous) => ({ ...previous, externalReference: event.target.value }))} placeholder="Carrier or external reference" maxLength={160} />
              </Field>
              <Field label="Reason">
                <FocusInput className={input} value={form.reason} onChange={(event) => setForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Business reason" maxLength={500} />
              </Field>
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Notes">
                  <FocusTextarea className={cn(input, "min-h-[84px] resize-none")} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Add transfer notes..." maxLength={3000} />
                </Field>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-200 pt-4">
              <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="text-xs font-black text-indigo-700 hover:text-indigo-800">
                {showAdvanced ? "Hide integration field" : "Show integration field"}
              </button>
              {showAdvanced ? (
                <div className="mt-4 max-w-xl">
                  <Field label="Client Request ID" hint="Prevents duplicate transfer creation.">
                    <FocusInput className={input} value={form.clientRequestId} onChange={(event) => setForm((previous) => ({ ...previous, clientRequestId: event.target.value }))} placeholder="Unique request ID" maxLength={180} />
                  </Field>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Transfer lines"
            description="Each product can use warehouse-level stock or a location inside each selected warehouse."
            action={
              <button className={cn(button, ghostButton, "px-3 py-2")} type="button" onClick={onAddLine}>
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Line
              </button>
            }
          >
            <div className="space-y-4">
              {form.lines.map((line, index) => (
                <TransferLineEditor
                  key={line.clientId}
                  line={line}
                  index={index}
                  products={products}
                  product={productMap.get(String(line.product))}
                  sourceLocations={sourceLocations}
                  destinationLocations={destinationLocations}
                  warehousesReady={Boolean(form.sourceWarehouse && form.destinationWarehouse)}
                  onChange={onLineChange}
                  onProductChange={onLineProductChange}
                  onDuplicate={onDuplicateLine}
                  onRemove={onRemoveLine}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </form>
    </ModalShell>
  )
}

function TransferLineEditor({
  line,
  index,
  products,
  product,
  sourceLocations,
  destinationLocations,
  warehousesReady,
  onChange,
  onProductChange,
  onDuplicate,
  onRemove,
}) {
  const serialCount = parseSerials(line.serialNumbersText).length
  const estimatedValue = Number(line.requestedQuantity || 0) * Number(line.unitCost || 0)

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">{index + 1}</span>
          <div>
            <p className="text-sm font-black text-gray-900">Transfer Line</p>
            <p className="text-xs font-semibold text-gray-500">{product ? relationLabel(product) : "Select a product"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className={cn(button, ghostButton, "px-3 py-2")} type="button" onClick={() => onDuplicate(line)}><Icon icon={Add01Icon} className="h-4 w-4" />Duplicate</button>
          <button className={cn(button, dangerButton, "px-3 py-2")} type="button" onClick={() => onRemove(line.clientId)}><Icon icon={Cancel01Icon} className="h-4 w-4" />Remove</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Product" required>
          <select className={input} value={line.product} onChange={(event) => onProductChange(line.clientId, event.target.value)} disabled={!warehousesReady} required>
            <option value="">Select product</option>
            {products.map((item) => <option key={item._id} value={item._id}>{relationLabel(item)}</option>)}
          </select>
        </Field>
        <Field label="Source Location" hint="Leave empty for warehouse level.">
          <select className={input} value={line.sourceLocation} onChange={(event) => onChange(line.clientId, "sourceLocation", event.target.value)} disabled={!warehousesReady}>
            <option value="">No location</option>
            {sourceLocations.map((item) => <option key={item._id} value={item._id}>{relationLabel(item)}</option>)}
          </select>
        </Field>
        <Field label="Destination Location" hint="Leave empty for warehouse level.">
          <select className={input} value={line.destinationLocation} onChange={(event) => onChange(line.clientId, "destinationLocation", event.target.value)} disabled={!warehousesReady}>
            <option value="">No location</option>
            {destinationLocations.map((item) => <option key={item._id} value={item._id}>{relationLabel(item)}</option>)}
          </select>
        </Field>
        <Field label="Requested Quantity" required>
          <FocusInput className={input} type="number" min="0.000001" step={product?.trackingType === "serial" ? "1" : "0.000001"} value={line.requestedQuantity} onChange={(event) => onChange(line.clientId, "requestedQuantity", event.target.value)} placeholder="Example: 10" disabled={!warehousesReady} required />
        </Field>
        <Field label="Unit Cost">
          <FocusInput className={input} type="number" min="0" step="0.0001" value={line.unitCost} onChange={(event) => onChange(line.clientId, "unitCost", event.target.value)} placeholder="Example: 250" disabled={!warehousesReady} />
        </Field>
        {product?.trackingType === "batch" ? (
          <Field label="Lot Number" required>
            <FocusInput className={input} value={line.lotNumber} onChange={(event) => onChange(line.clientId, "lotNumber", event.target.value.toUpperCase())} placeholder="Example: LOT-2026-001" maxLength={120} required />
          </Field>
        ) : null}
        <Field label="Manufacture Date">
          <input className={input} type="date" value={line.manufactureDate} onChange={(event) => onChange(line.clientId, "manufactureDate", event.target.value)} />
        </Field>
        <Field label="Expiry Date">
          <input className={input} type="date" value={line.expiryDate} onChange={(event) => onChange(line.clientId, "expiryDate", event.target.value)} />
        </Field>
      </div>

      {product?.trackingType === "serial" ? (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <Field label="Serial Numbers" required hint={`${serialCount} serial${serialCount === 1 ? "" : "s"} entered. Use commas or one value per line.`}>
            <FocusTextarea className={cn(input, "min-h-[110px] resize-y")} value={line.serialNumbersText} onChange={(event) => onChange(line.clientId, "serialNumbersText", event.target.value)} placeholder="SERIAL-001&#10;SERIAL-002" required />
          </Field>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <Field label="Line Note">
          <FocusInput className={input} value={line.note} onChange={(event) => onChange(line.clientId, "note", event.target.value)} placeholder="Add a line note..." maxLength={1000} />
        </Field>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 lg:min-w-[210px]">
          <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">Estimated Line Value</p>
          <p className="mt-1 text-lg font-black text-indigo-700">{formatMoney(estimatedValue)}</p>
        </div>
      </div>
    </article>
  )
}

function ApprovalModal({ state, setState, saving, onClose, onSubmit }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title="Approve stock transfer"
      subtitle={state.transfer?.transferNo || ""}
      icon={<Icon icon={Tick02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className={cn(button, successButton)} type="submit" form="transfer-approval-form" disabled={saving}>
            <Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />
            {saving ? "Approving..." : "Approve Transfer"}
          </button>
        </div>
      }
    >
      {state.error ? <ErrorBox message={state.error} /> : null}
      <form id="transfer-approval-form" onSubmit={onSubmit}>
        <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
          Approved quantity may be lower than requested, except for serial-tracked products which must be approved in full.
        </div>
        <div className="space-y-3">
          {state.lines.map((row, index) => (
            <div key={row.lineId} className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-[1fr_180px_180px] md:items-end">
              <div>
                <p className="text-sm font-black text-gray-900">{row.product?.name || `Line ${index + 1}`}</p>
                <p className="mt-1 text-xs font-semibold text-gray-500">{row.product?.sku || "-"}{row.product?.trackingType ? ` · ${pretty(row.product.trackingType)} tracking` : ""}</p>
              </div>
              <MiniMetric label="Requested" value={formatNumber(row.requestedQuantity)} />
              <Field label="Approved Quantity" required>
                <FocusInput className={input} type="number" min="0.000001" max={row.requestedQuantity} step={row.product?.trackingType === "serial" ? "1" : "0.000001"} value={row.approvedQuantity} onChange={(event) => setState((previous) => ({ ...previous, lines: previous.lines.map((line) => line.lineId === row.lineId ? { ...line, approvedQuantity: event.target.value } : line) }))} placeholder="Approved quantity" required />
              </Field>
            </div>
          ))}
        </div>
      </form>
    </ModalShell>
  )
}

function ReceiptModal({ state, setState, saving, onClose, onSubmit }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title="Receive stock transfer"
      subtitle={state.transfer?.transferNo || ""}
      icon={<Icon icon={Tick02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-6xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className={cn(button, successButton)} type="submit" form="transfer-receipt-form" disabled={saving}>
            <Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />
            {saving ? "Receiving..." : "Post Receipt"}
          </button>
        </div>
      }
    >
      {state.error ? <ErrorBox message={state.error} /> : null}
      <form id="transfer-receipt-form" onSubmit={onSubmit}>
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600" checked={state.receiveAll} onChange={(event) => setState((previous) => ({ ...previous, receiveAll: event.target.checked, error: "" }))} />
            <span>
              <span className="block text-sm font-black text-indigo-800">Receive all remaining quantities</span>
              <span className="mt-1 block text-xs font-semibold text-indigo-600">The API receives every remaining line when no line override is sent.</span>
            </span>
          </label>
          <Field label="Receipt Idempotency Key" required hint="At least 8 characters; prevents duplicate posting.">
            <FocusInput className={input} value={state.idempotencyKey} onChange={(event) => setState((previous) => ({ ...previous, idempotencyKey: event.target.value, error: "" }))} placeholder="Unique receipt request key" required />
          </Field>
        </div>

        <div className={cn("space-y-3", state.receiveAll ? "opacity-60" : "")}>
          {state.lines.map((row, index) => (
            <div key={row.lineId} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600" checked={row.selected} disabled={state.receiveAll} onChange={(event) => setState((previous) => ({ ...previous, lines: previous.lines.map((line) => line.lineId === row.lineId ? { ...line, selected: event.target.checked } : line), error: "" }))} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-gray-900">{row.product?.name || `Line ${index + 1}`}</span>
                    <span className="mt-1 block text-xs font-semibold text-gray-500">{row.product?.sku || "-"} · Remaining {formatNumber(row.remainingQuantity)}</span>
                  </span>
                </label>
                <div className="w-full lg:w-52">
                  <Field label="Receive Quantity" required>
                    <FocusInput className={input} type="number" min="0.000001" max={row.remainingQuantity} step={row.product?.trackingType === "serial" ? "1" : "0.000001"} value={row.quantity} disabled={state.receiveAll || !row.selected} onChange={(event) => setState((previous) => ({ ...previous, lines: previous.lines.map((line) => line.lineId === row.lineId ? { ...line, quantity: event.target.value } : line), error: "" }))} placeholder="Quantity" />
                  </Field>
                </div>
              </div>
              {row.product?.trackingType === "serial" ? (
                <div className="mt-4">
                  <Field label="Received Serial Numbers" hint={`${row.availableSerials.length} serials remain available.`}>
                    <FocusTextarea className={cn(input, "min-h-[100px] resize-y")} value={row.serialNumbersText} disabled={state.receiveAll || !row.selected} onChange={(event) => setState((previous) => ({ ...previous, lines: previous.lines.map((line) => line.lineId === row.lineId ? { ...line, serialNumbersText: event.target.value } : line), error: "" }))} placeholder="Enter one serial per line..." />
                  </Field>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </form>
    </ModalShell>
  )
}

function ReasonModal({ state, setState, saving, onClose, onSubmit }) {
  const descriptions = {
    reject: "Rejecting returns a submitted transfer without creating any stock movement.",
    cancel: "Cancellation is available only before dispatch or direct posting.",
    close_short: "The remaining in-transit quantity will be cleared and recorded as shortage.",
    reverse: "Every posted dispatch, receipt, shortage-close, or direct movement will be reversed with compensating entries.",
  }

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={`${pretty(state.type)} stock transfer`}
      subtitle={state.transfer?.transferNo || ""}
      icon={<Icon icon={state.type === "reverse" ? RefreshIcon : Cancel01Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className={cn(button, state.type === "reverse" ? warningButton : dangerButton)} type="submit" form="transfer-reason-form" disabled={saving}>
            <Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />
            {saving ? "Processing..." : pretty(state.type)}
          </button>
        </div>
      }
    >
      {state.error ? <ErrorBox message={state.error} /> : null}
      <form id="transfer-reason-form" onSubmit={onSubmit}>
        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {descriptions[state.type] || "Provide a clear business reason."}
        </div>
        <Field label={`${pretty(state.type)} Reason`} required>
          <FocusTextarea className={cn(input, "min-h-[130px] resize-none")} value={state.reason} onChange={(event) => setState((previous) => ({ ...previous, reason: event.target.value, error: "" }))} placeholder="Explain why this action is required..." maxLength={1000} required />
        </Field>
      </form>
    </ModalShell>
  )
}

function ErrorBox({ message }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
      <Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function DetailsModal({ state, onClose }) {
  const transfer = state.transfer
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={transfer?.transferNo || "Transfer details"}
      subtitle={transfer ? `${pretty(transfer.transferMode)} · ${formatDate(transfer.transferDate, true)}` : ""}
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-[1500px]"
      footer={<div className="flex justify-end"><button className={cn(button, ghostButton)} type="button" onClick={onClose}>Close</button></div>}
    >
      {transfer ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <SummaryValue label="Status" value={<StatusBadge value={transfer.status} />} />
            <SummaryValue label="Requested" value={formatNumber(transfer.totalRequestedQuantity)} />
            <SummaryValue label="Approved" value={formatNumber(transfer.totalApprovedQuantity)} />
            <SummaryValue label="Dispatched" value={formatNumber(transfer.totalDispatchedQuantity)} />
            <SummaryValue label="Received" value={formatNumber(transfer.totalReceivedQuantity)} positive />
            <SummaryValue label="Short" value={formatNumber(transfer.totalShortQuantity)} negative={Number(transfer.totalShortQuantity) > 0} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Transfer document">
              <div className="space-y-3 text-sm">
                <DetailRow label="Route" value={`${relationLabel(transfer.sourceWarehouse, "Unknown source")} → ${relationLabel(transfer.destinationWarehouse, "Unknown destination")}`} />
                <DetailRow label="Mode" value={<ModeBadge value={transfer.transferMode} />} />
                <DetailRow label="Expected delivery" value={formatDate(transfer.expectedDeliveryDate)} />
                <DetailRow label="Reference" value={transfer.reference || "-"} />
                <DetailRow label="External reference" value={transfer.externalReference || "-"} />
                <DetailRow label="Reason" value={transfer.reason || "-"} />
                <DetailRow label="Created by" value={relationLabel(transfer.createdBy, "System")} />
              </div>
            </SectionCard>
            <SectionCard title="Workflow">
              <div className="space-y-3 text-sm">
                <DetailRow label="Submitted" value={formatDate(transfer.submittedAt, true)} />
                <DetailRow label="Approved" value={formatDate(transfer.approvedAt, true)} />
                <DetailRow label="Dispatched" value={formatDate(transfer.dispatchedAt, true)} />
                <DetailRow label="Received" value={formatDate(transfer.receivedAt, true)} />
                <DetailRow label="Closed" value={formatDate(transfer.closedAt, true)} />
                <DetailRow label="Close reason" value={transfer.closeReason || "-"} />
                <DetailRow label="Rejection reason" value={transfer.rejectionReason || "-"} />
                <DetailRow label="Cancellation reason" value={transfer.cancellationReason || "-"} />
                <DetailRow label="Reversal reason" value={transfer.reversalReason || "-"} />
              </div>
            </SectionCard>
          </div>

          {transfer.notes ? (
            <SectionCard title="Notes"><p className="text-sm font-semibold leading-6 text-gray-600">{transfer.notes}</p></SectionCard>
          ) : null}

          <SectionCard title="Transfer lines" description="Requested, approved, dispatched, received, short, and remaining quantities are preserved for each stock position.">
            <TransferDetailLines lines={transfer.lines || []} currency={transfer.currency} />
          </SectionCard>

          <SectionCard title="Posted stock movements" description="Direct posting uses one movement; two-step transfers use dispatch and one or more receipt movements.">
            <MovementReferences transfer={transfer} />
          </SectionCard>
        </div>
      ) : null}
    </ModalShell>
  )
}

function SummaryValue({ label, value, positive = false, negative = false }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <div className={cn("mt-2 text-lg font-black", positive ? "text-emerald-700" : negative ? "text-rose-700" : "text-gray-900")}>{value}</div>
    </div>
  )
}

function TransferDetailLines({ lines, currency }) {
  return (
    <div>
      <div className="hidden overflow-auto xl:block">
        <table className="min-w-[1550px] w-full text-left">
          <thead className="bg-white text-xs font-black uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Approved</th>
              <th className="px-4 py-3">Dispatched</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Short</th>
              <th className="px-4 py-3">Remaining</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((line, index) => (
              <tr key={line._id || index}>
                <td className="px-4 py-4"><p className="min-w-[210px] text-sm font-black text-gray-900">{line.product?.name || "Unknown product"}</p><p className="mt-0.5 text-xs font-semibold text-gray-500">{line.product?.sku || "-"}</p></td>
                <td className="px-4 py-4"><LocationLabel value={line.sourceLocation} /></td>
                <td className="px-4 py-4"><LocationLabel value={line.destinationLocation} /></td>
                <td className="px-4 py-4 text-sm font-black text-gray-700">{formatNumber(line.requestedQuantity)}</td>
                <td className="px-4 py-4 text-sm font-black text-gray-700">{formatNumber(line.approvedQuantity)}</td>
                <td className="px-4 py-4 text-sm font-black text-gray-700">{formatNumber(line.dispatchedQuantity)}</td>
                <td className="px-4 py-4 text-sm font-black text-emerald-700">{formatNumber(line.receivedQuantity)}</td>
                <td className="px-4 py-4 text-sm font-black text-rose-700">{formatNumber(line.shortQuantity)}</td>
                <td className="px-4 py-4 text-sm font-black text-gray-700">{formatNumber(line.remainingQuantity ?? remainingQuantity(line))}</td>
                <td className="px-4 py-4 text-sm font-black text-gray-700">{formatMoney(line.unitCost, currency)}</td>
                <td className="px-4 py-4 text-sm font-black text-gray-900">{formatMoney(line.lineValue, currency)}</td>
                <td className="px-4 py-4 text-xs font-semibold text-gray-600">{line.lotNumber ? `Lot: ${line.lotNumber}` : line.serialNumbers?.length ? `${line.serialNumbers.length} serials · ${line.receivedSerialNumbers?.length || 0} received` : "No tracking data"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 xl:hidden">
        {lines.map((line, index) => (
          <div key={line._id || index} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-black text-gray-900">{line.product?.name || "Unknown product"}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">{relationLabel(line.sourceLocation, "Warehouse level")} → {relationLabel(line.destinationLocation, "Warehouse level")}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniMetric label="Requested" value={formatNumber(line.requestedQuantity)} />
              <MiniMetric label="Approved" value={formatNumber(line.approvedQuantity)} />
              <MiniMetric label="Dispatched" value={formatNumber(line.dispatchedQuantity)} />
              <MiniMetric label="Received" value={formatNumber(line.receivedQuantity)} positive />
              <MiniMetric label="Short" value={formatNumber(line.shortQuantity)} negative={Number(line.shortQuantity) > 0} />
              <MiniMetric label="Remaining" value={formatNumber(line.remainingQuantity ?? remainingQuantity(line))} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LocationLabel({ value }) {
  return (
    <div className="min-w-[160px]">
      <p className="text-sm font-black text-gray-800">{value?.name || "Warehouse level"}</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-500">{value?.code || "No location"}</p>
    </div>
  )
}

function MovementReferences({ transfer }) {
  const rows = [
    ["Direct movement", transfer.directMovement],
    ["Dispatch movement", transfer.dispatchMovement],
    ["Shortage close movement", transfer.closeMovement],
  ].filter(([, value]) => value)

  return (
    <div className="space-y-3">
      {rows.map(([label, movement]) => (
        <div key={label} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 text-sm font-black text-indigo-700">{movement?.movementNo || String(movement)}</p></div>
          <StatusBadge value={movement?.status || "posted"} />
        </div>
      ))}

      {(transfer.receipts || []).map((receipt, index) => (
        <div key={receipt._id || index} className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-wide text-gray-400">Receipt {index + 1}</p><p className="mt-1 text-sm font-black text-indigo-700">{receipt.movement?.movementNo || String(receipt.movement)}</p><p className="mt-1 text-xs font-semibold text-gray-500">{formatNumber(receipt.totalQuantity)} received · {formatDate(receipt.receivedAt, true)}</p></div>
          <StatusBadge value={receipt.movement?.status || "posted"} />
        </div>
      ))}

      {!rows.length && !(transfer.receipts || []).length ? (
        <p className="text-sm font-semibold text-gray-500">No posted stock movements yet.</p>
      ) : null}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <span className="shrink-0 font-semibold text-gray-500">{label}</span>
      <span className="min-w-0 text-right font-black text-gray-800">{value}</span>
    </div>
  )
}
