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

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
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
    tradeType: "local",
    commercialLC: "",
    importShipment: "",
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
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true">
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

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      title={`Remove ${label} filter`}
      aria-label={`Remove ${label} filter`}
    >
      <span className="text-indigo-400">{label}:</span>
      <span className="max-w-[180px] truncate sm:max-w-[220px]">{value}</span>
      <Icon icon={Cancel01Icon} className="h-3.5 w-3.5 shrink-0" />
    </button>
  )
}

function Skeleton({ className = "" }) {
  return <div className={cn("animate-pulse rounded-lg bg-gray-200/80", className)} />
}

function HeaderSearchFilters({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  filterChipCount,
  selectedPurchaseOrderName,
  selectedSupplierName,
  selectedWarehouseName,
  selectedProductName,
  onClearStatus,
  onOpenFilters,
}) {
  const hasAnything = Boolean(clean(filters.q)) || filterChipCount > 0

  return (
    <div
      className={cn(
        "w-full transition-[max-width,flex-basis] duration-200",
        filterChipCount === 0
          ? "lg:max-w-[50%] lg:flex-[0_1_50%]"
          : filterChipCount <= 2
            ? "lg:max-w-[64%] lg:flex-[0_1_64%]"
            : "lg:max-w-[78%] lg:flex-[0_1_78%]"
      )}
    >
      <div className="flex min-h-[40px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />

        {activeTab !== "all" ? (
          <FilterChip label="Status" value={pretty(activeTab)} onClear={onClearStatus} />
        ) : null}

        {filters.purchaseOrder !== "all" ? (
          <FilterChip
            label="Order"
            value={selectedPurchaseOrderName || "Selected order"}
            onClear={() => updateFilter("purchaseOrder", "all")}
          />
        ) : null}

        {filters.supplier !== "all" ? (
          <FilterChip
            label="Supplier"
            value={selectedSupplierName || "Selected supplier"}
            onClear={() => updateFilter("supplier", "all")}
          />
        ) : null}

        {filters.warehouse !== "all" ? (
          <FilterChip
            label="Warehouse"
            value={selectedWarehouseName || "Selected warehouse"}
            onClear={() => updateFilter("warehouse", "all")}
          />
        ) : null}

        {filters.product !== "all" ? (
          <FilterChip
            label="Product"
            value={selectedProductName || "Selected product"}
            onClear={() => updateFilter("product", "all")}
          />
        ) : null}

        {filters.dateFrom ? (
          <FilterChip
            label="From"
            value={formatDate(filters.dateFrom)}
            onClear={() => updateFilter("dateFrom", "")}
          />
        ) : null}

        {filters.dateTo ? (
          <FilterChip
            label="To"
            value={formatDate(filters.dateTo)}
            onClear={() => updateFilter("dateTo", "")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[150px] basis-[180px] flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ outline: "none", boxShadow: "none" }}
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search receipt number..."
          type="search"
          aria-label="Search goods receipts"
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition",
            filterChipCount
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          )}
        >
          <Icon icon={FilterIcon} className="h-3.5 w-3.5" />
          Filters
          {filterChipCount ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
              {filterChipCount}
            </span>
          ) : null}
        </button>

        {hasAnything ? (
          <button
            type="button"
            onClick={() => resetFilters(false)}
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

function GoodsReceiptTableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`receipt-skeleton-${index}`}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-32" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-3 w-28" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-36" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-14" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-7 w-20 rounded-full" />
      </td>
      <td className="sticky right-0 bg-white px-5 py-4">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-20 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </td>
    </tr>
  ))
}

function GoodsReceiptMobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <article key={`mobile-receipt-skeleton-${index}`} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
        {Array.from({ length: 4 }).map((__, metricIndex) => (
          <div key={metricIndex}>
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </article>
  ))
}

function GoodsReceiptActions({
  receipt,
  busy,
  canManage,
  canApprove,
  canPost,
  canReverse,
  canDelete,
  onCreatePurchaseReturn,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onPost,
  onReverse,
  onCancel,
  onReturn,
  onDelete,
  mobile = false,
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const working = String(busy.id) === String(receipt._id)

  useEffect(() => {
    if (!open) return undefined

    const close = () => setOpen(false)
    const onPointer = (event) => {
      if (!event.target.closest?.("[data-gr-actions-menu]")) close()
    }

    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)
    document.addEventListener("mousedown", onPointer)

    return () => {
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open])

  const openMenu = (event) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 250
    const estimatedHeight = 340
    const gutter = 8
    const left = Math.min(
      window.innerWidth - menuWidth - gutter,
      Math.max(gutter, rect.right - menuWidth)
    )
    const fitsBelow =
      window.innerHeight - rect.bottom >= Math.min(estimatedHeight, 300)
    const top = fitsBelow
      ? rect.bottom + gutter
      : Math.max(gutter, rect.top - estimatedHeight - gutter)

    setPosition({ top, left })
    setOpen((previous) => !previous)
  }

  const menuItems = []

  if (canManage && receipt.status === "draft") {
    menuItems.push(
      {
        key: "edit",
        label: "Edit receipt",
        icon: Edit02Icon,
        onClick: () => onEdit(receipt),
      },
      {
        key: "submit",
        label: "Submit for approval",
        icon: Tick02Icon,
        onClick: () => onSubmit(receipt),
      }
    )
  }

  if (canApprove && receipt.status === "submitted") {
    menuItems.push({
      key: "approve",
      label: "Approve receipt",
      icon: Tick02Icon,
      onClick: () => onApprove(receipt),
    })
  }

  if (canPost && receipt.status === "approved") {
    menuItems.push({
      key: "post",
      label: "Post accepted stock",
      icon: FloppyDiskIcon,
      onClick: () => onPost(receipt),
    })
  }

  if (canReverse && receipt.status === "posted") {
    menuItems.push({
      key: "reverse",
      label: "Reverse receipt",
      icon: RefreshIcon,
      danger: true,
      onClick: () => onReverse(receipt),
    })
  }

  if (canManage && ["draft", "submitted", "approved"].includes(receipt.status)) {
    menuItems.push({
      key: "cancel",
      label: "Cancel receipt",
      icon: Cancel01Icon,
      danger: true,
      onClick: () => onCancel(receipt),
    })
  }

  if (canManage && receipt.status === "posted" && onCreatePurchaseReturn) {
    menuItems.push({
      key: "return",
      label: "Create purchase return",
      icon: Add01Icon,
      onClick: () => onReturn(receipt),
    })
  }

  if (canDelete && ["draft", "cancelled"].includes(receipt.status)) {
    menuItems.push({
      key: "delete",
      label: "Delete receipt",
      icon: Archive02Icon,
      danger: true,
      separator: true,
      onClick: () => onDelete(receipt),
    })
  }

  const activeBusyType = working ? busy.type : ""

  return (
    <div
      className={cn("flex items-center gap-2", mobile ? "w-full" : "justify-end")}
      data-gr-actions-menu
    >
      <button
        type="button"
        className={cn(
          button,
          ghostButton,
          mobile ? "h-10 flex-1 px-3" : "h-10 px-3"
        )}
        onClick={() => onView(receipt)}
        disabled={working}
      >
        <Icon
          icon={activeBusyType === "view" ? RefreshIcon : ViewIcon}
          className={cn("h-4 w-4", activeBusyType === "view" ? "animate-spin" : "")}
        />
        View
      </button>

      {menuItems.length ? (
        <button
          type="button"
          onClick={openMenu}
          disabled={working}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl font-bold leading-none text-gray-600 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`More actions for ${receipt.receiptNo}`}
          title="More actions"
        >
          {working && activeBusyType !== "view" ? (
            <Icon icon={RefreshIcon} className="h-4 w-4 animate-spin" />
          ) : (
            <span aria-hidden="true">⋮</span>
          )}
        </button>
      ) : null}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              data-gr-actions-menu
              className="fixed z-[150] w-[250px] overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)]"
              style={{ top: position.top, left: position.left }}
            >
              {menuItems.map((item) => (
                <div key={item.key}>
                  {item.separator ? <div className="my-1 border-t border-gray-100" /> : null}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      item.onClick()
                    }}
                    disabled={working}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                      item.danger
                        ? "text-rose-700 hover:bg-rose-50"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <Icon icon={item.icon} className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}

function ConfirmActionModal({ state, working, onClose, onConfirm }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title || "Confirm action"}
      subtitle={state.item?.receiptNo || "Goods receipt"}
      icon={<Icon icon={Alert02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={onClose}
            disabled={working}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(button, state.danger ? dangerButton : primaryButton)}
            onClick={onConfirm}
            disabled={working}
          >
            <Icon
              icon={working ? RefreshIcon : Tick02Icon}
              className={cn("h-4 w-4", working ? "animate-spin" : "")}
            />
            {working ? "Working..." : state.actionLabel || "Continue"}
          </button>
        </div>
      }
    >
      <p className="text-sm font-medium leading-6 text-gray-600">{state.message}</p>
      {state.danger ? (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          This action is destructive and cannot be undone.
        </div>
      ) : null}
    </ModalShell>
  )
}

function ReasonModal({ state, saving, onClose, onSubmit, setReason }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title || "Provide a reason"}
      subtitle={state.item?.receiptNo || "Goods receipt"}
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
            {saving ? "Saving..." : state.actionLabel || "Continue"}
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
  const [receipts, setReceipts] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [commercialLCOptions, setCommercialLCOptions] = useState([])
  const [shipmentOptions, setShipmentOptions] = useState([])
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
  const [confirmState, setConfirmState] = useState({
    open: false,
    item: null,
    type: "",
    title: "",
    message: "",
    actionLabel: "",
    danger: false,
  })

  const purchaseOrderMap = useMemo(
    () => new Map(purchaseOrders.map((item) => [String(item._id), item])),
    [purchaseOrders]
  )
  const supplierMap = useMemo(
    () => new Map(suppliers.map((item) => [String(item._id), item])),
    [suppliers]
  )
  const productMap = useMemo(
    () => new Map(products.map((item) => [String(item._id), item])),
    [products]
  )
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((item) => [String(item._id), item])),
    [warehouses]
  )

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
    const results = await Promise.allSettled([
      api("/purchase/goods-receipts/meta"),
      api("/purchase/purchase-orders/options?limit=100"),
      api("/suppliers/options?limit=200&includeUnavailable=true"),
      api("/inventory/products?status=active&limit=100"),
      api("/inventory/warehouses/options?limit=100"),
    ])
    const value = (index, fallback = {}) =>
      results[index].status === "fulfilled" ? results[index].value : fallback

    setMeta({ ...FALLBACK_META, ...value(0) })
    setPurchaseOrders(value(1).purchaseOrders || [])
    setSuppliers(value(2).suppliers || [])
    setProducts(value(3).products || [])
    setWarehouses(value(4).warehouses || [])

    const firstFailure = results.find((result) => result.status === "rejected")
    if (firstFailure) {
      toast.error(firstFailure.reason?.message || "Some goods-receipt options could not be loaded")
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

  const loadReceipts = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const data = await api(
        `/purchase/goods-receipts?${buildParams({ append })}`,
        { signal }
      )
      const incoming = data.goodsReceipts || []
      setReceipts((previous) => (append ? [...previous, ...incoming] : incoming))
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || "Failed to load goods receipts")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  useEffect(() => { loadReferenceData() }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      loadReceipts({ signal: controller.signal })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeTab, filters.q, filters.purchaseOrder, filters.supplier, filters.warehouse, filters.product, filters.dateFrom, filters.dateTo])

  useEffect(() => {
    if (initialPurchaseOrderId && canManage) openCreate(initialPurchaseOrderId)
  }, [initialPurchaseOrderId])

  const refresh = async () => Promise.all([loadReferenceData(), loadReceipts()])

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setNextCursor(null)
    setHasMore(false)
  }

  const resetFilters = (closeFilter = false) => {
    setActiveTab("all")
    setFilters({
      q: "",
      purchaseOrder: "all",
      supplier: "all",
      warehouse: "all",
      product: "all",
      dateFrom: "",
      dateTo: "",
    })
    setNextCursor(null)
    setHasMore(false)
    if (closeFilter) setFilterOpen(false)
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setNextCursor(null)
    setHasMore(false)
  }

  const loadImportOptions = async (order, preferredLC = "", preferredShipment = "") => {
    if (!order || order.tradeType !== "import") {
      setCommercialLCOptions([])
      setShipmentOptions([])
      return { tradeType: order?.tradeType || "local", commercialLC: "", importShipment: "" }
    }

    const lcData = await api(`/purchase/commercial-lcs?purchaseOrder=${encodeURIComponent(order._id)}&limit=100`)
    const allLCs = lcData.commercialLCs || []
    const lcs = allLCs.filter((lc) => !["draft", "application_submitted", "cancelled", "closed"].includes(lc.status))
    setCommercialLCOptions(lcs)
    const lcId = lcs.some((lc) => String(lc._id) === String(preferredLC)) ? preferredLC : (lcs[0]?._id || "")

    let shipments = []
    let shipmentId = ""
    if (lcId) {
      const shipmentData = await api(`/purchase/commercial-lcs/${lcId}/shipments`)
      shipments = (shipmentData.shipments || []).filter((shipment) => !["planned", "booked", "cancelled", "closed"].includes(shipment.status))
      shipmentId = shipments.some((shipment) => String(shipment._id) === String(preferredShipment)) ? preferredShipment : (shipments[0]?._id || "")
    }
    setShipmentOptions(shipments)
    return { tradeType: "import", commercialLC: lcId, importShipment: shipmentId }
  }

  const changeCommercialLC = async (lcId) => {
    setForm((previous) => ({ ...previous, commercialLC: lcId, importShipment: "" }))
    if (!lcId) {
      setShipmentOptions([])
      return
    }
    try {
      const shipmentData = await api(`/purchase/commercial-lcs/${lcId}/shipments`)
      const shipments = (shipmentData.shipments || []).filter((shipment) => !["planned", "booked", "cancelled", "closed"].includes(shipment.status))
      setShipmentOptions(shipments)
      setForm((previous) => ({ ...previous, commercialLC: lcId, importShipment: shipments[0]?._id || "" }))
    } catch (error) {
      setShipmentOptions([])
      setFormError(error.message || "Failed to load import shipments")
    }
  }

  const hydrateFromOrder = async (orderId, current = emptyForm()) => {
    if (!orderId) {
      setCommercialLCOptions([])
      setShipmentOptions([])
      return { ...current, purchaseOrder: "", tradeType: "local", commercialLC: "", importShipment: "", supplier: "", warehouse: "", lines: [] }
    }
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

    const importLinks = await loadImportOptions(order, current.commercialLC, current.importShipment)

    return {
      ...current,
      purchaseOrder: order._id,
      ...importLinks,
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
      const orderId = normalizeId(item.purchaseOrder)
      let importLinks = { tradeType: "local", commercialLC: "", importShipment: "" }
      if (orderId) {
        const orderData = await api(`/purchase/purchase-orders/${orderId}`)
        importLinks = await loadImportOptions(orderData.purchaseOrder, normalizeId(item.commercialLC), normalizeId(item.importShipment))
      }
      setForm({
        receiptDate: toDateInput(item.receiptDate),
        purchaseOrder: normalizeId(item.purchaseOrder),
        ...importLinks,
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
    setCommercialLCOptions([])
    setShipmentOptions([])
    setFormError("")
  }

  const validateForm = () => {
    if (!form.receiptDate) return "Receipt date is required."
    if (!form.purchaseOrder) return "Purchase order is required."
    if (form.tradeType === "import" && !form.commercialLC) return "Commercial LC is required for an import purchase receipt."
    if (form.tradeType === "import" && !form.importShipment) return "Import shipment is required for an import purchase receipt."
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
    commercialLC: form.tradeType === "import" ? (form.commercialLC || null) : null,
    importShipment: form.tradeType === "import" ? (form.importShipment || null) : null,
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
      await Promise.all([loadReferenceData(), loadReceipts({ showLoader: false })])
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
      setConfirmState((previous) => ({ ...previous, open: false }))
      await Promise.all([loadReferenceData(), loadReceipts({ showLoader: false })])
      if (detailsModal.item?._id === receipt._id) {
        const detail = await api(`/purchase/goods-receipts/${receipt._id}`)
        setDetailsModal({ open: true, item: detail.goodsReceipt })
      }
      return true
    } catch (error) {
      if (reasonState.open) setReasonState((previous) => ({ ...previous, error: error.message || "Action failed" }))
      else toast.error(error.message || "Action failed")
      return false
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

  const performDelete = async (receipt) => {
    setBusy({ id: receipt._id, type: "delete" })
    try {
      const data = await api(`/purchase/goods-receipts/${receipt._id}`, {
        method: "DELETE",
      })
      toast.success(data.message || "Goods receipt deleted")
      setConfirmState((previous) => ({ ...previous, open: false }))
      if (detailsModal.item?._id === receipt._id) {
        setDetailsModal({ open: false, item: null })
      }
      await Promise.all([
        loadReferenceData(),
        loadReceipts({ showLoader: false }),
      ])
      return true
    } catch (error) {
      toast.error(error.message || "Failed to delete goods receipt")
      return false
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const requestConfirm = (receipt, type) => {
    const config = {
      submit: {
        title: "Submit goods receipt",
        message: `Submit ${receipt.receiptNo} for approval?`,
        actionLabel: "Submit",
        danger: false,
      },
      approve: {
        title: "Approve goods receipt",
        message: `Approve ${receipt.receiptNo}? It will become ready for inventory posting.`,
        actionLabel: "Approve",
        danger: false,
      },
      post: {
        title: "Post accepted stock",
        message: `Post ${receipt.receiptNo} to inventory? Accepted quantities will create stock movement.`,
        actionLabel: "Post Receipt",
        danger: false,
      },
      delete: {
        title: "Delete goods receipt",
        message: `Delete ${receipt.receiptNo}? Only eligible draft or cancelled receipts should be removed.`,
        actionLabel: "Delete Receipt",
        danger: true,
      },
    }[type]

    if (!config) return

    setConfirmState({
      open: true,
      item: receipt,
      type,
      ...config,
    })
  }

  const confirmAction = async () => {
    const receipt = confirmState.item
    if (!receipt) return

    if (confirmState.type === "delete") {
      await performDelete(receipt)
      return
    }

    await runAction(receipt, confirmState.type)
  }

  const filterChipCount = [
    activeTab !== "all",
    filters.purchaseOrder !== "all",
    filters.supplier !== "all",
    filters.warehouse !== "all",
    filters.product !== "all",
    Boolean(filters.dateFrom),
    Boolean(filters.dateTo),
  ].filter(Boolean).length

  const selectedPurchaseOrderName =
    filters.purchaseOrder === "all"
      ? ""
      : purchaseOrderMap.get(String(filters.purchaseOrder))?.orderNo ||
        "Selected order"
  const selectedSupplierName =
    filters.supplier === "all"
      ? ""
      : relationLabel(
          supplierMap.get(String(filters.supplier)),
          "Selected supplier"
        )
  const selectedWarehouseName =
    filters.warehouse === "all"
      ? ""
      : relationLabel(
          warehouseMap.get(String(filters.warehouse)),
          "Selected warehouse"
        )
  const selectedProductName =
    filters.product === "all"
      ? ""
      : relationLabel(
          productMap.get(String(filters.product)),
          "Selected product"
        )


  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 3000, style: { borderRadius: "14px", fontWeight: 700 } }}
      />

      <section className={cn(card, "mb-5 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Goods Receipts
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={refresh}
              disabled={loading}
            >
              <Icon
                icon={RefreshIcon}
                className={cn("h-4 w-4", loading ? "animate-spin" : "")}
              />
              Refresh
            </button>
            {canManage ? (
              <button
                type="button"
                className={cn(button, primaryButton)}
                onClick={() => openCreate()}
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                New Goods Receipt
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <HeaderSearchFilters
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            filterChipCount={filterChipCount}
            selectedPurchaseOrderName={selectedPurchaseOrderName}
            selectedSupplierName={selectedSupplierName}
            selectedWarehouseName={selectedWarehouseName}
            selectedProductName={selectedProductName}
            onClearStatus={() => switchTab("all")}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-gray-900">{receipts.length}</span> receipts
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only goods-receipt access.
        </div>
      ) : null}

      <div className={cn(card, "mb-5 p-2")}>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {["all", "draft", "submitted", "approved", "posted", "reversed", "cancelled"].map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => switchTab(status)}
                className={cn(
                  "whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 sm:text-sm",
                  activeTab === status
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                {status === "all" ? "All" : pretty(status)}
              </button>
            )
          )}
        </div>
      </div>

      <div className={cn(card, "overflow-hidden rounded-3xl")}>
        <div className="hidden max-h-[650px] overflow-auto lg:block">
          <table className="min-w-[1180px] w-full text-left">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <th className="px-5 py-3.5">Receipt</th>
                <th className="px-5 py-3.5">Purchase Order</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5">Inspection</th>
                <th className="px-5 py-3.5">Value</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <GoodsReceiptTableSkeleton />
              ) : receipts.length ? (
                receipts.map((receipt) => (
                  <tr
                    key={receipt._id}
                    className="group bg-white transition hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {receipt.receiptNo}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {formatDate(receipt.receiptDate)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {receipt.purchaseOrder?.orderNo || "-"}
                      </p>
                      <p className="mt-1 max-w-[220px] truncate text-xs font-medium text-gray-500">
                        {relationLabel(receipt.warehouse, "-")}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="max-w-[220px] truncate text-sm font-semibold text-gray-900">
                        {receipt.supplier?.businessName ||
                          receipt.supplierSnapshot?.name ||
                          "-"}
                      </p>
                      <p className="mt-1 max-w-[220px] truncate text-xs font-medium text-gray-500">
                        {receipt.supplierDeliveryNote ||
                          receipt.supplierInvoiceNo ||
                          "No supplier document"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatNumber(receipt.totalAcceptedQuantity)} accepted
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {formatNumber(receipt.totalQuarantineQuantity)} quarantine ·{" "}
                        {formatNumber(receipt.totalRejectedQuantity)} rejected
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatMoney(receipt.totalAcceptedValue, receipt.currency)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {formatNumber(receipt.lineCount, 0)} lines
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge value={receipt.status} />
                    </td>
                    <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                      <GoodsReceiptActions
                        receipt={receipt}
                        busy={busy}
                        canManage={canManage}
                        canApprove={canApprove}
                        canPost={canPost}
                        canReverse={canReverse}
                        canDelete={canDelete}
                        onCreatePurchaseReturn={onCreatePurchaseReturn}
                        onView={openDetails}
                        onEdit={openEdit}
                        onSubmit={(item) => requestConfirm(item, "submit")}
                        onApprove={(item) => requestConfirm(item, "approve")}
                        onPost={(item) => requestConfirm(item, "post")}
                        onReverse={(item) => openReason(item, "reverse")}
                        onCancel={(item) => openReason(item, "cancel")}
                        onReturn={(item) => onCreatePurchaseReturn?.(item)}
                        onDelete={(item) => requestConfirm(item, "delete")}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-5 py-14 text-center">
                    <Icon
                      icon={FolderLibraryIcon}
                      className="mx-auto h-8 w-8 text-gray-300"
                    />
                    <p className="mt-3 text-sm font-bold text-gray-900">
                      No goods receipts found
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                      Create a receipt from an approved purchase order or adjust the filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {loading ? (
            <GoodsReceiptMobileSkeleton />
          ) : receipts.length ? (
            receipts.map((receipt) => (
              <article key={receipt._id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {receipt.receiptNo}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {formatDate(receipt.receiptDate)}
                    </p>
                  </div>
                  <StatusBadge value={receipt.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400">Order</p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {receipt.purchaseOrder?.orderNo || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Supplier</p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {receipt.supplier?.businessName ||
                        receipt.supplierSnapshot?.name ||
                        "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Accepted</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatNumber(receipt.totalAcceptedQuantity)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Value</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatMoney(receipt.totalAcceptedValue, receipt.currency)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <GoodsReceiptActions
                    receipt={receipt}
                    busy={busy}
                    canManage={canManage}
                    canApprove={canApprove}
                    canPost={canPost}
                    canReverse={canReverse}
                    canDelete={canDelete}
                    onCreatePurchaseReturn={onCreatePurchaseReturn}
                    onView={openDetails}
                    onEdit={openEdit}
                    onSubmit={(item) => requestConfirm(item, "submit")}
                    onApprove={(item) => requestConfirm(item, "approve")}
                    onPost={(item) => requestConfirm(item, "post")}
                    onReverse={(item) => openReason(item, "reverse")}
                    onCancel={(item) => openReason(item, "cancel")}
                    onReturn={(item) => onCreatePurchaseReturn?.(item)}
                    onDelete={(item) => requestConfirm(item, "delete")}
                    mobile
                  />
                </div>
              </article>
            ))
          ) : (
            <div className="p-12 text-center">
              <Icon
                icon={FolderLibraryIcon}
                className="mx-auto h-8 w-8 text-gray-300"
              />
              <p className="mt-3 text-sm font-bold text-gray-900">
                No goods receipts found
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {receipts.length} receipt{receipts.length === 1 ? "" : "s"} loaded
          </p>
          {hasMore ? (
            <button
              type="button"
              className={cn(button, ghostButton, "min-w-[140px]")}
              onClick={() => loadReceipts({ append: true })}
              disabled={loadingMore}
            >
              <Icon
                icon={RefreshIcon}
                className={cn("h-4 w-4", loadingMore ? "animate-spin" : "")}
              />
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          ) : receipts.length ? (
            <span className="text-xs font-semibold text-gray-400">
              All receipts loaded
            </span>
          ) : null}
        </div>
      </div>

      <ModalShell
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Goods-receipt filters"
        subtitle="Filter receiving history"
        icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
        maxWidthClass="max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={() => resetFilters(true)}
            >
              Reset
            </button>
            <button
              type="button"
              className={cn(button, primaryButton)}
              onClick={() => setFilterOpen(false)}
            >
              <Icon icon={Tick02Icon} className="h-4 w-4" />
              Apply Filters
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
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

          <Field label="Date From">
            <input
              className={input}
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </Field>

          <Field label="Date To">
            <input
              className={input}
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </Field>
        </div>
      </ModalShell>

      <ModalShell open={formModal.open} onClose={closeForm} title={formModal.item ? "Update goods receipt" : "Create goods receipt"} subtitle={formModal.item?.receiptNo || "Receive against an approved purchase order"} icon={<Icon icon={formModal.item ? Edit02Icon : Add01Icon} className="h-5 w-5" />} maxWidthClass="max-w-[1500px]" footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className={cn(button, ghostButton)} onClick={closeForm} disabled={saving}>Cancel</button><button type="submit" form="goods-receipt-form" className={cn(button, primaryButton)} disabled={saving}><Icon icon={saving ? RefreshIcon : FloppyDiskIcon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />{saving ? "Saving" : formModal.item ? "Update Receipt" : "Save Draft"}</button></div>}>
        <form id="goods-receipt-form" onSubmit={saveReceipt} className="space-y-5">
          {formError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</div> : null}
          <SectionCard title="Receipt information" description="The supplier and currency are inherited from the selected purchase order."><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Receipt Date" required><input className={input} type="date" value={form.receiptDate} onChange={(event) => setForm((previous) => ({ ...previous, receiptDate: event.target.value }))} /></Field><Field label="Purchase Order" required><select className={input} value={form.purchaseOrder} onChange={(event) => changeOrder(event.target.value)} disabled={Boolean(formModal.item)}><option value="">Select approved order</option>{purchaseOrders.map((order) => <option key={order._id} value={order._id}>{order.orderNo} · {order.supplier?.businessName || order.supplierSnapshot?.name || "Supplier"}</option>)}</select></Field>{form.tradeType === "import" ? <><Field label="Commercial LC" required hint="The LC must be opened and linked to this import PO."><select className={input} value={form.commercialLC} onChange={(event) => changeCommercialLC(event.target.value)}><option value="">Select Commercial LC</option>{commercialLCOptions.map((lc) => <option key={lc._id} value={lc._id}>{lc.lcNumber || lc.lcNo || "Commercial LC"} · {pretty(lc.status)}</option>)}</select></Field><Field label="Import Shipment" required hint="Planned/booked shipments are not receivable yet."><select className={input} value={form.importShipment} onChange={(event) => setForm((previous) => ({ ...previous, importShipment: event.target.value }))}><option value="">Select shipment</option>{shipmentOptions.map((shipment) => <option key={shipment._id} value={shipment._id}>{shipment.shipmentNo || shipment.billOfLadingNo || shipment.airwayBillNo || "Shipment"} · {pretty(shipment.status)}</option>)}</select></Field></> : null}<Field label="Receiving Warehouse" required><select className={input} value={form.warehouse} onChange={(event) => changeWarehouse(event.target.value)}><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{relationLabel(warehouse)}</option>)}</select></Field><Field label="Currency"><FocusPlaceholderInput className={input} value={form.currency} onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="BDT" maxLength={12} /></Field><Field label="Supplier Delivery Note"><FocusPlaceholderInput className={input} value={form.supplierDeliveryNote} onChange={(event) => setForm((previous) => ({ ...previous, supplierDeliveryNote: event.target.value }))} placeholder="Delivery challan or note" /></Field><Field label="Supplier Invoice"><FocusPlaceholderInput className={input} value={form.supplierInvoiceNo} onChange={(event) => setForm((previous) => ({ ...previous, supplierInvoiceNo: event.target.value }))} placeholder="Supplier invoice number" /></Field><Field label="Vehicle Number"><FocusPlaceholderInput className={input} value={form.vehicleNo} onChange={(event) => setForm((previous) => ({ ...previous, vehicleNo: event.target.value }))} placeholder="Delivery vehicle" /></Field><Field label="Received By"><FocusPlaceholderInput className={input} value={form.receivedByName} onChange={(event) => setForm((previous) => ({ ...previous, receivedByName: event.target.value }))} placeholder="Receiver name" /></Field></div></SectionCard>

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
        {detailsModal.item ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Status", <StatusBadge value={detailsModal.item.status} />], ["Received", formatNumber(detailsModal.item.totalReceivedQuantity)], ["Accepted", formatNumber(detailsModal.item.totalAcceptedQuantity)], ["Quarantine", formatNumber(detailsModal.item.totalQuarantineQuantity)], ["Accepted Value", formatMoney(detailsModal.item.totalAcceptedValue, detailsModal.item.currency)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 font-black text-gray-950">{value}</div></div>)}</div><SectionCard title="Receipt information"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Purchase Order", detailsModal.item.purchaseOrder?.orderNo || "-"], ["Commercial LC", detailsModal.item.commercialLC?.lcNumber || detailsModal.item.commercialLC?.lcNo || (detailsModal.item.commercialLC ? "Linked" : "-")], ["Import Shipment", detailsModal.item.importShipment?.shipmentNo || detailsModal.item.importShipment?.billOfLadingNo || (detailsModal.item.importShipment ? "Linked" : "-")], ["Supplier", relationLabel(detailsModal.item.supplier, detailsModal.item.supplierSnapshot?.name)], ["Warehouse", relationLabel(detailsModal.item.warehouse, "-")], ["Receipt Date", formatDate(detailsModal.item.receiptDate)], ["Delivery Note", detailsModal.item.supplierDeliveryNote || "-"], ["Supplier Invoice", detailsModal.item.supplierInvoiceNo || "-"], ["Vehicle", detailsModal.item.vehicleNo || "-"], ["Received By", detailsModal.item.receivedByName || "-"]].map(([label, value]) => <div key={label}><p className="text-xs font-bold text-gray-400">{label}</p><p className="mt-1 text-sm font-bold text-gray-900">{value}</p></div>)}</div></SectionCard><SectionCard title="Inspection lines"><div className="overflow-x-auto"><table className="min-w-[1000px] w-full"><thead><tr className="text-left text-xs font-black uppercase text-gray-400"><th className="pb-3">Product</th><th className="pb-3">Received</th><th className="pb-3">Accepted</th><th className="pb-3">Quarantine</th><th className="pb-3">Rejected</th><th className="pb-3">Quality</th><th className="pb-3 text-right">Value</th></tr></thead><tbody className="divide-y divide-gray-100">{(detailsModal.item.lines || []).map((line) => <tr key={line._id}><td className="py-3"><p className="font-bold text-gray-900">{line.product?.name || line.productSnapshot?.name || "-"}</p><p className="text-xs font-semibold text-gray-500">{line.product?.sku || line.productSnapshot?.code || line.lotNumber || "-"}</p></td><td className="py-3 font-bold">{formatNumber(line.receivedQuantity)}</td><td className="py-3 font-bold">{formatNumber(line.acceptedQuantity)}</td><td className="py-3 font-bold">{formatNumber(line.quarantineQuantity)}</td><td className="py-3 font-bold">{formatNumber(line.rejectedQuantity)}</td><td className="py-3"><StatusBadge value={line.qualityStatus} /></td><td className="py-3 text-right font-black">{formatMoney(line.lineValue, detailsModal.item.currency)}</td></tr>)}</tbody></table></div></SectionCard>{detailsModal.item.movement ? <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm font-semibold text-indigo-800">Inventory movement: {detailsModal.item.movement.movementNo} · {pretty(detailsModal.item.movement.status)}</div> : null}{detailsModal.item.reversalReason || detailsModal.item.cancellationReason ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{detailsModal.item.reversalReason || detailsModal.item.cancellationReason}</div> : null}</div> : null}
      </ModalShell>

      <ConfirmActionModal
        state={confirmState}
        working={
          Boolean(confirmState.item) &&
          String(busy.id) === String(confirmState.item?._id) &&
          busy.type === confirmState.type
        }
        onClose={() =>
          setConfirmState((previous) => ({ ...previous, open: false }))
        }
        onConfirm={confirmAction}
      />

      <ReasonModal state={reasonState} saving={busy.id === reasonState.item?._id && busy.type === reasonState.type} setReason={(reason) => setReasonState((previous) => ({ ...previous, reason, error: "" }))} onClose={() => setReasonState((previous) => ({ ...previous, open: false, reason: "", error: "" }))} onSubmit={() => { if (!clean(reasonState.reason)) return setReasonState((previous) => ({ ...previous, error: "Reason is required." })); runAction(reasonState.item, reasonState.type, clean(reasonState.reason)) }} />
    </div>
  )
}
