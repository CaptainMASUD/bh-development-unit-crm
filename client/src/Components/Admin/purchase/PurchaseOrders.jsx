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
  PrinterIcon,
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import PurchaseOrderPrint from "./PurchaseOrderPrint"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const MANAGE_PERMISSION =
  PERMISSIONS?.PURCHASE_ORDER_MANAGE || "purchase-order:manage"
const APPROVE_PERMISSION =
  PERMISSIONS?.PURCHASE_ORDER_APPROVE || "purchase-order:approve"
const DELETE_PERMISSION =
  PERMISSIONS?.PURCHASE_ORDER_DELETE || "purchase-order:delete"

const FALLBACK_META = {
  statuses: [
    "draft",
    "submitted",
    "approved",
    "partially_received",
    "received",
    "closed",
    "rejected",
    "cancelled",
  ],
  editableStatuses: ["draft", "rejected"],
  openStatuses: ["approved", "partially_received"],
  discountTypes: ["none", "percent", "fixed"],
  taxTypes: ["none", "exclusive", "inclusive"],
  tradeTypes: ["local", "import"],
  importStatuses: ["not_applicable", "lc_pending", "lc_open", "shipped", "customs_clearance", "goods_received", "settled", "closed"],
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
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
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
  const code = item.code || item.sku || item.symbol || ""
  return `${name}${code ? ` (${code})` : ""}`
}

function makeClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function idempotencyKey(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${crypto.randomUUID()}`
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) / 1_000_000
}

function calculateLine(line) {
  const quantity = Math.max(0, Number(line.orderedQuantity || 0))
  const unitPrice = Math.max(0, Number(line.unitPrice || 0))
  const subtotal = roundMoney(quantity * unitPrice)
  let discountAmount = 0

  if (line.discountType === "percent") {
    discountAmount = roundMoney(subtotal * (Number(line.discountValue || 0) / 100))
  } else if (line.discountType === "fixed") {
    discountAmount = roundMoney(Math.min(subtotal, Number(line.discountValue || 0)))
  }

  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount))
  let taxAmount = 0
  let lineTotal = taxableAmount

  if (line.taxType === "exclusive") {
    taxAmount = roundMoney(taxableAmount * (Number(line.taxRate || 0) / 100))
    lineTotal = roundMoney(taxableAmount + taxAmount)
  } else if (line.taxType === "inclusive") {
    const rate = Number(line.taxRate || 0)
    taxAmount = rate > 0 ? roundMoney(taxableAmount - taxableAmount / (1 + rate / 100)) : 0
  }

  return { subtotal, discountAmount, taxableAmount, taxAmount, lineTotal }
}

function calculateOrder(form) {
  const lineTotals = form.lines.map(calculateLine)
  const subtotal = roundMoney(lineTotals.reduce((sum, item) => sum + item.subtotal, 0))
  const discountTotal = roundMoney(
    lineTotals.reduce((sum, item) => sum + item.discountAmount, 0)
  )
  const taxTotal = roundMoney(lineTotals.reduce((sum, item) => sum + item.taxAmount, 0))
  const shippingCost = Math.max(0, Number(form.shippingCost || 0))
  const otherCost = Math.max(0, Number(form.otherCost || 0))
  const grandTotal = roundMoney(
    lineTotals.reduce((sum, item) => sum + item.lineTotal, 0) +
      shippingCost +
      otherCost
  )

  return { subtotal, discountTotal, taxTotal, shippingCost, otherCost, grandTotal }
}

function newLine(defaults = {}) {
  return {
    clientId: makeClientId(),
    _id: undefined,
    product: "",
    supplierProduct: "",
    purchaseUnit: "",
    destinationWarehouse: defaults.defaultWarehouse || "",
    destinationLocation: defaults.defaultLocation || "",
    supplierSku: "",
    description: "",
    orderedQuantity: "1",
    unitPrice: "0",
    discountType: "none",
    discountValue: "0",
    taxType: "none",
    taxRate: "0",
    notes: "",
  }
}

function emptyForm() {
  return {
    orderDate: todayInput(),
    expectedDeliveryDate: "",
    tradeType: "local",
    supplier: "",
    supplierQuotationRef: "",
    supplierReference: "",
    defaultWarehouse: "",
    defaultLocation: "",
    currency: "BDT",
    exchangeRate: "1",
    paymentTermType: "immediate",
    paymentTermDays: "0",
    incoterm: "",
    shippingAddress: {
      label: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Bangladesh",
    },
    shippingCost: "0",
    otherCost: "0",
    notes: "",
    termsAndConditions: "",
    lines: [newLine()],
  }
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
    partially_received: "bg-sky-50 text-sky-700 ring-sky-200",
    received: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    closed: "bg-slate-100 text-slate-700 ring-slate-200",
    rejected: "bg-rose-50 text-rose-700 ring-rose-200",
    cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1",
        styles[value] || "bg-gray-100 text-gray-700 ring-gray-200"
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
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gray-200/80",
        className
      )}
    />
  )
}

function HeaderSearchFilters({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  filterChipCount,
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
        <Icon
          icon={Search01Icon}
          className="h-4 w-4 shrink-0 text-gray-400"
        />

        {activeTab !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(activeTab)}
            onClear={onClearStatus}
          />
        ) : null}

        {filters.tradeType !== "all" ? (
          <FilterChip
            label="Trade"
            value={pretty(filters.tradeType)}
            onClear={() => updateFilter("tradeType", "all")}
          />
        ) : null}

        {filters.importStatus !== "all" ? (
          <FilterChip
            label="Import"
            value={pretty(filters.importStatus)}
            onClear={() => updateFilter("importStatus", "all")}
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

        {clean(filters.currency) ? (
          <FilterChip
            label="Currency"
            value={clean(filters.currency).toUpperCase()}
            onClear={() => updateFilter("currency", "")}
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
          placeholder="Search order number..."
          type="search"
          aria-label="Search purchase orders"
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

function PurchaseOrderTableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`order-skeleton-${index}`}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-3 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-32" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-1.5 w-28 rounded-full" />
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

function PurchaseOrderMobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <article key={`mobile-order-skeleton-${index}`} className="p-4">
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

function PurchaseOrderActions({
  order,
  busy,
  meta,
  canManage,
  canApprove,
  canDelete,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onCancel,
  onCloseOrder,
  onReceipt,
  onDelete,
  onPrint,
  mobile = false,
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const working = String(busy.id) === String(order._id)

  useEffect(() => {
    if (!open) return undefined

    const close = () => setOpen(false)
    const onPointer = (event) => {
      if (!event.target.closest?.("[data-po-actions-menu]")) close()
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

  const menuItems = [
    {
      key: "print",
      label: "Print / PDF",
      icon: PrinterIcon,
      onClick: () => onPrint?.(order),
    },
  ]

  if (canManage && meta.editableStatuses.includes(order.status)) {
    menuItems.push({
      key: "edit",
      label: "Edit order",
      icon: Edit02Icon,
      onClick: () => onEdit(order),
    })
  }

  if (canManage && ["draft", "rejected"].includes(order.status)) {
    menuItems.push({
      key: "submit",
      label: "Submit for approval",
      icon: Tick02Icon,
      onClick: () => onSubmit(order),
    })
  }

  if (canApprove && order.status === "submitted") {
    menuItems.push(
      {
        key: "approve",
        label: "Approve order",
        icon: Tick02Icon,
        onClick: () => onApprove(order),
      },
      {
        key: "reject",
        label: "Reject order",
        icon: Cancel01Icon,
        danger: true,
        onClick: () => onReject(order),
      }
    )
  }

  if (
    canManage &&
    ["draft", "submitted", "approved", "rejected"].includes(order.status) &&
    Number(order.totalReceivedQuantity || 0) === 0
  ) {
    menuItems.push({
      key: "cancel",
      label: "Cancel order",
      icon: Cancel01Icon,
      danger: true,
      onClick: () => onCancel(order),
    })
  }

  if (
    canApprove &&
    ["approved", "partially_received", "received"].includes(order.status)
  ) {
    menuItems.push({
      key: "close",
      label: "Close order",
      icon: Archive02Icon,
      onClick: () => onCloseOrder(order),
    })
  }

  if (canManage && meta.openStatuses.includes(order.status) && onReceipt) {
    menuItems.push({
      key: "receipt",
      label: "Create goods receipt",
      icon: Add01Icon,
      onClick: () => onReceipt(order),
    })
  }

  if (
    canDelete &&
    ["draft", "rejected", "cancelled"].includes(order.status)
  ) {
    menuItems.push({
      key: "delete",
      label: "Delete order",
      icon: Archive02Icon,
      danger: true,
      separator: true,
      onClick: () => onDelete(order),
    })
  }

  const activeBusyType = working ? busy.type : ""

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        mobile ? "w-full" : "justify-end"
      )}
      data-po-actions-menu
    >
      <button
        type="button"
        className={cn(
          button,
          ghostButton,
          mobile ? "h-10 flex-1 px-3" : "h-10 px-3"
        )}
        onClick={() => onView(order)}
        disabled={working}
      >
        <Icon
          icon={activeBusyType === "view" ? RefreshIcon : ViewIcon}
          className={cn(
            "h-4 w-4",
            activeBusyType === "view" ? "animate-spin" : ""
          )}
        />
        View
      </button>

      {menuItems.length ? (
        <button
          type="button"
          onClick={openMenu}
          disabled={working}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl font-bold leading-none text-gray-600 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`More actions for ${order.orderNo}`}
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
              data-po-actions-menu
              className="fixed z-[150] w-[250px] overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)]"
              style={{ top: position.top, left: position.left }}
            >
              {menuItems.map((item) => (
                <div key={item.key}>
                  {item.separator ? (
                    <div className="my-1 border-t border-gray-100" />
                  ) : null}
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

function PurchaseOrderList({
  orders,
  loading,
  loadingMore,
  hasMore,
  busy,
  meta,
  canManage,
  canApprove,
  canDelete,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onCancel,
  onCloseOrder,
  onReceipt,
  onDelete,
  onPrint,
  onLoadMore,
}) {
  const actionProps = {
    busy,
    meta,
    canManage,
    canApprove,
    canDelete,
    onView,
    onEdit,
    onSubmit,
    onApprove,
    onReject,
    onCancel,
    onCloseOrder,
    onReceipt,
    onDelete,
    onPrint,
  }

  return (
    <div className={cn(card, "overflow-hidden rounded-3xl")}>
      <div className="hidden h-[600px] overflow-auto lg:block xl:h-[650px]">
        <table className="w-full min-w-[1120px] text-left">
          <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
            <tr className="text-xs font-black uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Supplier</th>
              <th className="px-5 py-3">Delivery</th>
              <th className="px-5 py-3">Quantity</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Status</th>
              <th className="sticky right-0 bg-gray-50/95 px-5 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <PurchaseOrderTableSkeleton />
            ) : orders.length ? (
              orders.map((order) => {
                const ordered = Number(order.totalOrderedQuantity || 0)
                const received = Number(order.totalReceivedQuantity || 0)
                const progress = ordered
                  ? Math.min(100, (received / ordered) * 100)
                  : 0

                return (
                  <tr
                    key={order._id}
                    className="group bg-white transition hover:bg-indigo-50/30"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {order.orderNo}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {formatDate(order.orderDate)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide", order.tradeType === "import" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600")}>{pretty(order.tradeType || "local")}</span>
                        {order.tradeType === "import" ? <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">{pretty(order.importStatus || "lc_pending")}</span> : null}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="max-w-[230px] truncate text-sm font-semibold text-gray-900">
                        {order.supplier?.businessName ||
                          order.supplierSnapshot?.name ||
                          "-"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {order.supplier?.code ||
                          order.supplierSnapshot?.code ||
                          "-"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-800">
                        {formatDate(order.expectedDeliveryDate)}
                      </p>
                      <p className="mt-1 max-w-[220px] truncate text-xs font-medium text-gray-500">
                        {relationLabel(
                          order.defaultWarehouse,
                          "No default warehouse"
                        )}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatNumber(received)} / {formatNumber(ordered)}
                      </p>
                      <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatMoney(order.grandTotal, order.currency)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {formatNumber(order.lineCount, 0)} lines
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge value={order.status} />
                    </td>

                    <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.45)] group-hover:bg-indigo-50/30">
                      <PurchaseOrderActions order={order} {...actionProps} />
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-16 text-center"
                >
                  <Icon
                    icon={FolderLibraryIcon}
                    className="mx-auto h-8 w-8 text-gray-300"
                  />
                  <p className="mt-3 text-sm font-bold text-gray-900">
                    No purchase orders found
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Create an order or adjust the current filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 lg:hidden">
        {loading ? (
          <PurchaseOrderMobileSkeleton />
        ) : orders.length ? (
          orders.map((order) => (
            <article key={order._id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {order.orderNo}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    {formatDate(order.orderDate)}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-gray-400">{pretty(order.tradeType || "local")}{order.tradeType === "import" ? ` · ${pretty(order.importStatus || "lc_pending")}` : ""}</p>
                </div>
                <StatusBadge value={order.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                <div>
                  <p className="text-xs font-bold text-gray-400">Supplier</p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                    {order.supplier?.businessName ||
                      order.supplierSnapshot?.name ||
                      "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400">Total</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatMoney(order.grandTotal, order.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400">Received</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatNumber(order.totalReceivedQuantity)} /{" "}
                    {formatNumber(order.totalOrderedQuantity)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400">Delivery</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {formatDate(order.expectedDeliveryDate)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <PurchaseOrderActions
                  order={order}
                  {...actionProps}
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
              No purchase orders found
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-gray-500">
          {orders.length} order{orders.length === 1 ? "" : "s"} loaded
        </p>

        {hasMore ? (
          <button
            type="button"
            className={cn(button, ghostButton, "min-w-[140px]")}
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            <Icon
              icon={RefreshIcon}
              className={cn("h-4 w-4", loadingMore ? "animate-spin" : "")}
            />
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        ) : orders.length ? (
          <span className="text-xs font-semibold text-gray-400">
            All orders loaded
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ConfirmActionModal({ state, working, onClose, onConfirm }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title || "Confirm action"}
      subtitle={state.item?.orderNo || "Purchase order"}
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
            className={cn(
              button,
              state.danger ? dangerButton : primaryButton
            )}
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
      <p className="text-sm font-medium leading-6 text-gray-600">
        {state.message}
      </p>

      {state.danger ? (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          This action is destructive and cannot be undone.
        </div>
      ) : null}
    </ModalShell>
  )
}

function ReasonModal({ state, saving, onClose, onSubmit }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title || "Provide a reason"}
      subtitle={state.item?.orderNo || "Purchase order"}
      icon={<Icon icon={Alert02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" className={cn(button, ghostButton)} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className={cn(button, state.danger ? dangerButton : primaryButton)} onClick={onSubmit} disabled={saving}>
            <Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />
            {saving ? "Saving" : state.actionLabel || "Continue"}
          </button>
        </div>
      }
    >
      <Field label="Reason" required>
        <FocusPlaceholderTextarea
          className={cn(input, "min-h-[120px] resize-none")}
          value={state.reason}
          onChange={(event) => state.setReason(event.target.value)}
          placeholder="Enter the business reason..."
          maxLength={1000}
          autoFocus
        />
      </Field>
      {state.error ? <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{state.error}</p> : null}
    </ModalShell>
  )
}

export default function PurchaseOrders({ onCreateGoodsReceipt }) {
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
  const canDelete = hasPermission(currentUser, DELETE_PERMISSION)

  const [meta, setMeta] = useState(FALLBACK_META)
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [units, setUnits] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [locationsByWarehouse, setLocationsByWarehouse] = useState({})
  const [supplierLinks, setSupplierLinks] = useState([])

  const [activeTab, setActiveTab] = useState("all")
  const [filters, setFilters] = useState({
    q: "",
    supplier: "all",
    warehouse: "all",
    product: "all",
    tradeType: "all",
    importStatus: "all",
    currency: "",
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
  const [saving, setSaving] = useState(false)
  const [detailsModal, setDetailsModal] = useState({ open: false, item: null })
  const [printOrder, setPrintOrder] = useState(null)
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

  const supplierMap = useMemo(
    () => new Map(suppliers.map((item) => [String(item._id), item])),
    [suppliers]
  )
  const productMap = useMemo(
    () => new Map(products.map((item) => [String(item._id), item])),
    [products]
  )
  const unitMap = useMemo(
    () => new Map(units.map((item) => [String(item._id), item])),
    [units]
  )
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((item) => [String(item._id), item])),
    [warehouses]
  )
  const linkMap = useMemo(
    () => new Map(supplierLinks.map((item) => [String(item._id), item])),
    [supplierLinks]
  )
  const totals = useMemo(() => calculateOrder(form), [form])

  const loadLocations = async (warehouseId) => {
    if (!warehouseId) return []
    if (locationsByWarehouse[warehouseId]) return locationsByWarehouse[warehouseId]
    try {
      const data = await api(
        `/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(warehouseId)}&limit=200`
      )
      const rows = data.locations || []
      setLocationsByWarehouse((previous) => ({ ...previous, [warehouseId]: rows }))
      return rows
    } catch (error) {
      toast.error(error.message || "Failed to load warehouse locations")
      return []
    }
  }

  const loadSupplierLinks = async (supplierId) => {
    if (!supplierId) {
      setSupplierLinks([])
      return []
    }
    try {
      const data = await api(`/suppliers/${supplierId}/products?status=active&limit=100`)
      const rows = data.supplierProducts || []
      setSupplierLinks(rows)
      return rows
    } catch (error) {
      setSupplierLinks([])
      toast.error(error.message || "Failed to load supplier products")
      return []
    }
  }

  const loadReferenceData = async () => {
    const results = await Promise.allSettled([
      api("/purchase/purchase-orders/meta"),
      api("/suppliers/options?limit=200&includeUnavailable=true"),
      api("/inventory/products?status=active&limit=100"),
      api("/inventory/units/options?limit=200"),
      api("/inventory/warehouses/options?limit=100"),
    ])
    const value = (index, fallback = {}) =>
      results[index].status === "fulfilled" ? results[index].value : fallback

    setMeta({ ...FALLBACK_META, ...value(0) })
    setSuppliers(value(1).suppliers || [])
    setProducts(value(2).products || [])
    setUnits(value(3).units || [])
    setWarehouses(value(4).warehouses || [])

    const firstFailure = results.find((result) => result.status === "rejected")
    if (firstFailure) {
      toast.error(firstFailure.reason?.message || "Some purchase-order options could not be loaded")
    }
  }

  const buildParams = ({ append = false } = {}) => {
    const params = new URLSearchParams({ limit: "40" })
    if (activeTab !== "all") params.set("status", activeTab)
    if (clean(filters.q)) params.set("q", clean(filters.q))
    if (filters.supplier !== "all") params.set("supplier", filters.supplier)
    if (filters.warehouse !== "all") params.set("warehouse", filters.warehouse)
    if (filters.product !== "all") params.set("product", filters.product)
    if (filters.tradeType !== "all") params.set("tradeType", filters.tradeType)
    if (filters.importStatus !== "all") params.set("importStatus", filters.importStatus)
    if (clean(filters.currency)) params.set("currency", clean(filters.currency).toUpperCase())
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
    if (filters.dateTo) params.set("dateTo", filters.dateTo)
    if (append && nextCursor) params.set("cursor", nextCursor)
    return params
  }

  const loadOrders = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const data = await api(`/purchase/purchase-orders?${buildParams({ append })}`, { signal })
      const incoming = data.purchaseOrders || []
      setOrders((previous) => (append ? [...previous, ...incoming] : incoming))
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error.name !== "AbortError") toast.error(error.message || "Failed to load purchase orders")
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }


  useEffect(() => {
    loadReferenceData()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      loadOrders({ signal: controller.signal })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.supplier,
    filters.warehouse,
    filters.product,
    filters.tradeType,
    filters.importStatus,
    filters.currency,
    filters.dateFrom,
    filters.dateTo,
  ])

  const refresh = async () => {
    await Promise.all([loadReferenceData(), loadOrders()])
  }

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setNextCursor(null)
    setHasMore(false)
  }

  const resetFilters = (closeFilter = false) => {
    setActiveTab("all")
    setFilters({
      q: "",
      supplier: "all",
      warehouse: "all",
      product: "all",
      tradeType: "all",
      importStatus: "all",
      currency: "",
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

  const openCreate = () => {
    const next = emptyForm()
    setForm(next)
    setSupplierLinks([])
    setFormError("")
    setFormModal({ open: true, item: null })
  }

  const openEdit = async (order) => {
    setBusy({ id: order._id, type: "edit" })
    try {
      const data = await api(`/purchase/purchase-orders/${order._id}`)
      const item = data.purchaseOrder
      await loadSupplierLinks(normalizeId(item.supplier))
      const warehouseIds = new Set([
        normalizeId(item.defaultWarehouse),
        ...(item.lines || []).map((line) => normalizeId(line.destinationWarehouse)),
      ])
      await Promise.all([...warehouseIds].filter(Boolean).map(loadLocations))
      setForm({
        orderDate: toDateInput(item.orderDate),
        expectedDeliveryDate: toDateInput(item.expectedDeliveryDate),
        tradeType: item.tradeType || "local",
        supplier: normalizeId(item.supplier),
        supplierQuotationRef: item.supplierQuotationRef || "",
        supplierReference: item.supplierReference || "",
        defaultWarehouse: normalizeId(item.defaultWarehouse),
        defaultLocation: normalizeId(item.defaultLocation),
        currency: item.currency || "BDT",
        exchangeRate: String(item.exchangeRate ?? 1),
        paymentTermType: item.paymentTermType || "immediate",
        paymentTermDays: String(item.paymentTermDays ?? 0),
        incoterm: item.incoterm || "",
        shippingAddress: {
          label: item.shippingAddress?.label || "",
          addressLine1: item.shippingAddress?.addressLine1 || "",
          addressLine2: item.shippingAddress?.addressLine2 || "",
          city: item.shippingAddress?.city || "",
          state: item.shippingAddress?.state || "",
          postalCode: item.shippingAddress?.postalCode || "",
          country: item.shippingAddress?.country || "Bangladesh",
        },
        shippingCost: String(item.shippingCost ?? 0),
        otherCost: String(item.otherCost ?? 0),
        notes: item.notes || "",
        termsAndConditions: item.termsAndConditions || "",
        lines: (item.lines || []).map((line) => ({
          ...newLine(),
          clientId: line._id || makeClientId(),
          _id: line._id,
          product: normalizeId(line.product),
          supplierProduct: normalizeId(line.supplierProduct),
          purchaseUnit: normalizeId(line.purchaseUnit),
          destinationWarehouse: normalizeId(line.destinationWarehouse),
          destinationLocation: normalizeId(line.destinationLocation),
          supplierSku: line.supplierSku || "",
          description: line.description || "",
          orderedQuantity: String(line.orderedQuantity ?? 0),
          unitPrice: String(line.unitPrice ?? 0),
          discountType: line.discountType || "none",
          discountValue: String(line.discountValue ?? 0),
          taxType: line.taxType || "none",
          taxRate: String(line.taxRate ?? 0),
          notes: line.notes || "",
        })),
      })
      setFormError("")
      setFormModal({ open: true, item })
    } catch (error) {
      toast.error(error.message || "Failed to load purchase order")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const openDetails = async (order) => {
    setBusy({ id: order._id, type: "view" })
    try {
      const data = await api(`/purchase/purchase-orders/${order._id}`)
      setDetailsModal({ open: true, item: data.purchaseOrder })
    } catch (error) {
      toast.error(error.message || "Failed to load purchase order")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const closeForm = (force = false) => {
    if (saving && !force) return
    setFormModal({ open: false, item: null })
    setForm(emptyForm())
    setFormError("")
    setSupplierLinks([])
  }

  const changeSupplier = async (supplierId) => {
    const supplier = supplierMap.get(String(supplierId))
    setForm((previous) => ({
      ...previous,
      supplier: supplierId,
      currency: supplier?.procurement?.currency || previous.currency || "BDT",
      paymentTermType: supplier?.procurement?.paymentTermType || previous.paymentTermType,
      paymentTermDays: String(supplier?.procurement?.paymentTermDays ?? previous.paymentTermDays),
      incoterm: supplier?.procurement?.incoterm || previous.incoterm,
      lines: previous.lines.map((line) => ({ ...line, supplierProduct: "", supplierSku: "" })),
    }))
    await loadSupplierLinks(supplierId)
  }

  const changeDefaultWarehouse = async (warehouseId) => {
    const locations = await loadLocations(warehouseId)
    const firstLocation = locations[0]?._id || ""
    setForm((previous) => ({
      ...previous,
      defaultWarehouse: warehouseId,
      defaultLocation: firstLocation,
      lines: previous.lines.map((line) => ({
        ...line,
        destinationWarehouse: line.destinationWarehouse || warehouseId,
        destinationLocation: line.destinationLocation || firstLocation,
      })),
    }))
  }

  const setLine = (clientId, patch) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId ? { ...line, ...patch } : line
      ),
    }))
  }

  const changeLineWarehouse = async (clientId, warehouseId) => {
    const locations = await loadLocations(warehouseId)
    setLine(clientId, {
      destinationWarehouse: warehouseId,
      destinationLocation: locations[0]?._id || "",
    })
  }

  const changeSupplierLink = (clientId, linkId) => {
    const link = linkMap.get(String(linkId))
    if (!link) {
      setLine(clientId, { supplierProduct: "" })
      return
    }
    setLine(clientId, {
      supplierProduct: linkId,
      product: normalizeId(link.product),
      purchaseUnit: normalizeId(link.purchaseUnit) || normalizeId(link.product?.baseUnit),
      supplierSku: link.supplierSku || "",
      unitPrice: String(link.unitPrice ?? 0),
      taxType: link.taxType || "none",
      taxRate: String(link.taxRate ?? 0),
      description: link.product?.name || "",
    })
  }

  const addLine = () => {
    setForm((previous) => ({
      ...previous,
      lines: [...previous.lines, newLine({ defaultWarehouse: previous.defaultWarehouse, defaultLocation: previous.defaultLocation })],
    }))
  }

  const removeLine = (clientId) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.length === 1 ? previous.lines : previous.lines.filter((line) => line.clientId !== clientId),
    }))
  }

  const validateForm = () => {
    if (!form.orderDate) return "Purchase-order date is required."
    if (!form.supplier) return "Supplier is required."
    if (!form.lines.length) return "At least one line is required."
    if (form.expectedDeliveryDate && new Date(form.expectedDeliveryDate) < new Date(form.orderDate)) {
      return "Expected delivery date cannot be before the order date."
    }
    if (!Number.isFinite(Number(form.exchangeRate)) || Number(form.exchangeRate) <= 0) {
      return "Exchange rate must be greater than zero."
    }
    for (const [label, value] of [["Shipping cost", form.shippingCost], ["Other cost", form.otherCost], ["Payment term days", form.paymentTermDays]]) {
      if (!Number.isFinite(Number(value)) || Number(value) < 0) return `${label} must be a valid non-negative number.`
    }
    for (let index = 0; index < form.lines.length; index += 1) {
      const line = form.lines[index]
      const label = `Line ${index + 1}`
      if (!line.product) return `${label}: product is required.`
      if (!Number.isFinite(Number(line.orderedQuantity)) || Number(line.orderedQuantity) <= 0) return `${label}: quantity must be greater than zero.`
      if (!Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0) return `${label}: unit price is invalid.`
      if (!Number.isFinite(Number(line.discountValue)) || Number(line.discountValue) < 0) return `${label}: discount is invalid.`
      if (line.discountType === "percent" && Number(line.discountValue) > 100) return `${label}: discount cannot exceed 100%.`
      if (!Number.isFinite(Number(line.taxRate)) || Number(line.taxRate) < 0 || Number(line.taxRate) > 100) return `${label}: tax rate must be between 0 and 100.`
    }
    return ""
  }

  const buildPayload = () => ({
    orderDate: form.orderDate,
    expectedDeliveryDate: form.expectedDeliveryDate || null,
    tradeType: form.tradeType || "local",
    supplier: form.supplier,
    supplierQuotationRef: clean(form.supplierQuotationRef),
    supplierReference: clean(form.supplierReference),
    defaultWarehouse: form.defaultWarehouse || null,
    defaultLocation: form.defaultLocation || null,
    currency: clean(form.currency || "BDT").toUpperCase(),
    exchangeRate: Number(form.exchangeRate || 1),
    paymentTermType: clean(form.paymentTermType),
    paymentTermDays: Number(form.paymentTermDays || 0),
    incoterm: clean(form.incoterm).toUpperCase(),
    shippingAddress: { ...form.shippingAddress },
    shippingCost: Number(form.shippingCost || 0),
    otherCost: Number(form.otherCost || 0),
    notes: clean(form.notes),
    termsAndConditions: clean(form.termsAndConditions),
    ...(formModal.item ? { version: formModal.item.__v } : {}),
    lines: form.lines.map((line) => ({
      ...(line._id ? { _id: line._id } : {}),
      product: line.product,
      supplierProduct: line.supplierProduct || null,
      purchaseUnit: line.purchaseUnit || null,
      destinationWarehouse: line.destinationWarehouse || form.defaultWarehouse || null,
      destinationLocation: line.destinationLocation || form.defaultLocation || null,
      supplierSku: clean(line.supplierSku).toUpperCase(),
      description: clean(line.description),
      orderedQuantity: Number(line.orderedQuantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      discountType: line.discountType,
      discountValue: Number(line.discountValue || 0),
      taxType: line.taxType,
      taxRate: line.taxType === "none" ? 0 : Number(line.taxRate || 0),
      notes: clean(line.notes),
    })),
  })

  const saveOrder = async (event) => {
    event.preventDefault()
    setFormError("")
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)
    setSaving(true)
    try {
      const editing = Boolean(formModal.item?._id)
      const data = await api(
        editing
          ? `/purchase/purchase-orders/${formModal.item._id}`
          : "/purchase/purchase-orders",
        {
          method: editing ? "PATCH" : "POST",
          headers: editing ? {} : { "Idempotency-Key": idempotencyKey("PPO") },
          body: JSON.stringify(buildPayload()),
        }
      )
      toast.success(data.message || (editing ? "Purchase order updated" : "Purchase order created"))
      closeForm(true)
      await loadOrders({ showLoader: false })
    } catch (error) {
      setFormError(error.message || "Failed to save purchase order")
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (order, type, reason = "") => {
    setBusy({ id: order._id, type })
    try {
      const endpoints = {
        submit: ["submit", {}],
        approve: ["approve", {}],
        reject: ["reject", { reason }],
        cancel: ["cancel", { reason }],
        close: ["close", { reason }],
      }
      const [endpoint, body] = endpoints[type]
      const data = await api(`/purchase/purchase-orders/${order._id}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(body),
      })
      toast.success(data.message || `${pretty(type)} completed`)
      setReasonState((previous) => ({ ...previous, open: false, reason: "", error: "" }))
      setConfirmState((previous) => ({ ...previous, open: false, item: null }))
      await loadOrders({ showLoader: false })
      if (detailsModal.item?._id === order._id) {
        const detail = await api(`/purchase/purchase-orders/${order._id}`)
        setDetailsModal({ open: true, item: detail.purchaseOrder })
      }
    } catch (error) {
      if (reasonState.open) {
        setReasonState((previous) => ({ ...previous, error: error.message || "Action failed" }))
      } else {
        toast.error(error.message || "Action failed")
      }
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const openReason = (order, type) => {
    const config = {
      reject: ["Reject purchase order", "Reject", true],
      cancel: ["Cancel purchase order", "Cancel Order", true],
      close: ["Close purchase order", "Close Order", false],
    }[type]
    setReasonState({
      open: true,
      item: order,
      type,
      title: config[0],
      actionLabel: config[1],
      danger: config[2],
      reason: "",
      error: "",
    })
  }

  const openConfirm = (order, type) => {
    const config = {
      submit: {
        title: "Submit purchase order",
        message: `Submit ${order.orderNo} for approval?`,
        actionLabel: "Submit",
        danger: false,
      },
      approve: {
        title: "Approve purchase order",
        message: `Approve ${order.orderNo}? The order will become available for receiving.`,
        actionLabel: "Approve",
        danger: false,
      },
      delete: {
        title: "Delete purchase order",
        message: `Delete ${order.orderNo}? This is only allowed for unreceived draft, rejected, or cancelled orders and cannot be undone.`,
        actionLabel: "Delete",
        danger: true,
      },
    }[type]

    if (!config) return

    setConfirmState({
      open: true,
      item: order,
      type,
      ...config,
    })
  }

  const closeConfirm = () => {
    if (
      confirmState.item?._id &&
      busy.id === confirmState.item._id &&
      busy.type === confirmState.type
    ) {
      return
    }

    setConfirmState({
      open: false,
      item: null,
      type: "",
      title: "",
      message: "",
      actionLabel: "",
      danger: false,
    })
  }

  const deleteOrder = async (order) => {
    setBusy({ id: order._id, type: "delete" })

    try {
      const data = await api(`/purchase/purchase-orders/${order._id}`, {
        method: "DELETE",
      })
      toast.success(data.message || "Purchase order deleted")
      setConfirmState({
        open: false,
        item: null,
        type: "",
        title: "",
        message: "",
        actionLabel: "",
        danger: false,
      })
      await loadOrders({ showLoader: false })
    } catch (error) {
      toast.error(error.message || "Failed to delete purchase order")
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const filterChipCount = useMemo(
    () =>
      [
        activeTab !== "all",
        filters.supplier !== "all",
        filters.warehouse !== "all",
        filters.product !== "all",
        filters.tradeType !== "all",
        filters.importStatus !== "all",
        Boolean(clean(filters.currency)),
        Boolean(filters.dateFrom),
        Boolean(filters.dateTo),
      ].filter(Boolean).length,
    [activeTab, filters]
  )

  const selectedSupplierName = useMemo(
    () =>
      filters.supplier === "all"
        ? ""
        : relationLabel(
            supplierMap.get(String(filters.supplier)),
            "Selected supplier"
          ),
    [filters.supplier, supplierMap]
  )

  const selectedWarehouseName = useMemo(
    () =>
      filters.warehouse === "all"
        ? ""
        : relationLabel(
            warehouseMap.get(String(filters.warehouse)),
            "Selected warehouse"
          ),
    [filters.warehouse, warehouseMap]
  )

  const selectedProductName = useMemo(
    () =>
      filters.product === "all"
        ? ""
        : relationLabel(
            productMap.get(String(filters.product)),
            "Selected product"
          ),
    [filters.product, productMap]
  )

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
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

      <section className={cn(card, "mb-4 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Purchase Orders
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
                onClick={openCreate}
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                New Purchase Order
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <HeaderSearchFilters
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            filterChipCount={filterChipCount}
            selectedSupplierName={selectedSupplierName}
            selectedWarehouseName={selectedWarehouseName}
            selectedProductName={selectedProductName}
            onClearStatus={() => switchTab("all")}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing <span className="text-gray-900">{orders.length}</span>{" "}
            orders{hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only purchase-order access.
        </div>
      ) : null}

      <div className={cn(card, "mb-4 p-2")}>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {[
            "all",
            "draft",
            "submitted",
            "approved",
            "partially_received",
            "received",
            "closed",
            "rejected",
            "cancelled",
          ].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => switchTab(status)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-xs font-extrabold transition sm:px-4 sm:text-sm",
                activeTab === status
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              {status === "all" ? "All" : pretty(status)}
            </button>
          ))}
        </div>
      </div>

      <PurchaseOrderList
        orders={orders}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        busy={busy}
        meta={meta}
        canManage={canManage}
        canApprove={canApprove}
        canDelete={canDelete}
        onView={openDetails}
        onEdit={openEdit}
        onSubmit={(order) => openConfirm(order, "submit")}
        onApprove={(order) => openConfirm(order, "approve")}
        onReject={(order) => openReason(order, "reject")}
        onCancel={(order) => openReason(order, "cancel")}
        onCloseOrder={(order) => openReason(order, "close")}
        onReceipt={onCreateGoodsReceipt}
        onDelete={(order) => openConfirm(order, "delete")}
        onPrint={(order) => setPrintOrder(order)}
        onLoadMore={() => loadOrders({ append: true })}
      />

      <ModalShell
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Purchase-order filters"
        icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
        maxWidthClass="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={() => resetFilters(false)}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Status">
            <select
              className={input}
              value={activeTab}
              onChange={(event) => switchTab(event.target.value)}
            >
              {[
                "all",
                "draft",
                "submitted",
                "approved",
                "partially_received",
                "received",
                "closed",
                "rejected",
                "cancelled",
              ].map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "All statuses" : pretty(status)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Trade Type">
            <select className={input} value={filters.tradeType} onChange={(event) => updateFilter("tradeType", event.target.value)}>
              <option value="all">All trade types</option>
              {(meta.tradeTypes || FALLBACK_META.tradeTypes).map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
            </select>
          </Field>

          <Field label="Import Status">
            <select className={input} value={filters.importStatus} onChange={(event) => updateFilter("importStatus", event.target.value)} disabled={filters.tradeType === "local"}>
              <option value="all">All import statuses</option>
              {(meta.importStatuses || FALLBACK_META.importStatuses).map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
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

          <Field label="Currency">
            <FocusPlaceholderInput
              className={input}
              value={filters.currency}
              onChange={(event) =>
                updateFilter("currency", event.target.value.toUpperCase())
              }
              placeholder="BDT"
              maxLength={12}
            />
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

      <ModalShell
        open={formModal.open}
        onClose={closeForm}
        title={formModal.item ? "Update purchase order" : "Create purchase order"}
        subtitle={formModal.item?.orderNo || "New supplier order"}
        icon={<Icon icon={formModal.item ? Edit02Icon : Add01Icon} className="h-5 w-5" />}
        maxWidthClass="max-w-[1500px]"
        footer={<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" className={cn(button, ghostButton)} onClick={closeForm} disabled={saving}>Cancel</button><button type="submit" form="purchase-order-form" className={cn(button, primaryButton)} disabled={saving}><Icon icon={saving ? RefreshIcon : FloppyDiskIcon} className={cn("h-4 w-4", saving ? "animate-spin" : "")} />{saving ? "Saving" : formModal.item ? "Update Order" : "Save Draft"}</button></div>}
      >
        <form id="purchase-order-form" onSubmit={saveOrder} className="space-y-5">
          {formError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{formError}</div> : null}
          <SectionCard title="Order information" description="Select the supplier, delivery plan, currency, and purchasing terms.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Order Date" required><input className={input} type="date" value={form.orderDate} onChange={(event) => setForm((previous) => ({ ...previous, orderDate: event.target.value }))} /></Field>
              <Field label="Expected Delivery"><input className={input} type="date" value={form.expectedDeliveryDate} onChange={(event) => setForm((previous) => ({ ...previous, expectedDeliveryDate: event.target.value }))} /></Field>
              <Field label="Trade Type" required><select className={input} value={form.tradeType} onChange={(event) => setForm((previous) => ({ ...previous, tradeType: event.target.value }))} disabled={Boolean(formModal.item && formModal.item.status !== "draft" && formModal.item.status !== "rejected")}><option value="local">Local Purchase</option><option value="import">Import Purchase</option></select></Field>
              <Field label="Supplier" hint="Pending or inactive suppliers remain visible but require approval before purchasing." required><select className={input} value={form.supplier} onChange={(event) => changeSupplier(event.target.value)} disabled={Boolean(formModal.item)}><option value="">Select active supplier</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id} disabled={supplier.isSelectable === false}>{relationLabel(supplier)}{supplier.isSelectable === false ? ` — ${pretty(supplier.status)}` : ""}</option>)}</select></Field>
              <Field label="Currency" required><FocusPlaceholderInput className={input} value={form.currency} onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} placeholder="BDT" maxLength={12} /></Field>
              <Field label="Default Warehouse"><select className={input} value={form.defaultWarehouse} onChange={(event) => changeDefaultWarehouse(event.target.value)}><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{relationLabel(warehouse)}</option>)}</select></Field>
              <Field label="Default Location"><select className={input} value={form.defaultLocation} onChange={(event) => setForm((previous) => ({ ...previous, defaultLocation: event.target.value }))} disabled={!form.defaultWarehouse}><option value="">No default location</option>{(locationsByWarehouse[form.defaultWarehouse] || []).map((location) => <option key={location._id} value={location._id}>{relationLabel(location)}</option>)}</select></Field>
              <Field label="Quotation Reference"><FocusPlaceholderInput className={input} value={form.supplierQuotationRef} onChange={(event) => setForm((previous) => ({ ...previous, supplierQuotationRef: event.target.value }))} placeholder="Supplier quotation number" /></Field>
              <Field label="Supplier Reference"><FocusPlaceholderInput className={input} value={form.supplierReference} onChange={(event) => setForm((previous) => ({ ...previous, supplierReference: event.target.value }))} placeholder="Supplier order reference" /></Field>
              <Field label="Payment Term"><select className={input} value={form.paymentTermType} onChange={(event) => setForm((previous) => ({ ...previous, paymentTermType: event.target.value }))}>{["immediate", "net_7", "net_15", "net_30", "net_45", "net_60", "net_90", "custom"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></Field>
              <Field label="Payment Days"><input className={input} type="number" min="0" step="1" value={form.paymentTermDays} onChange={(event) => setForm((previous) => ({ ...previous, paymentTermDays: event.target.value }))} /></Field>
              <Field label="Exchange Rate"><input className={input} type="number" min="0.000001" step="0.000001" value={form.exchangeRate} onChange={(event) => setForm((previous) => ({ ...previous, exchangeRate: event.target.value }))} /></Field>
              <Field label="Incoterm"><FocusPlaceholderInput className={input} value={form.incoterm} onChange={(event) => setForm((previous) => ({ ...previous, incoterm: event.target.value.toUpperCase() }))} placeholder="FOB, CIF, DDP..." maxLength={30} /></Field>
            </div>
          </SectionCard>

          <SectionCard title="Order lines" description="Use an approved supplier-product source or select products manually. Server-side totals remain authoritative.">
            <div className="space-y-4">
              {form.lines.map((line, index) => {
                const lineTotal = calculateLine(line)
                const locations = locationsByWarehouse[line.destinationWarehouse] || []
                return (
                  <div key={line.clientId} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-black text-gray-950">Line {index + 1}</p><p className="mt-1 text-xs font-semibold text-gray-500">{formatMoney(lineTotal.lineTotal, form.currency)}</p></div><button type="button" className={cn(button, dangerButton, "px-3 py-2")} onClick={() => removeLine(line.clientId)} disabled={form.lines.length === 1}><Icon icon={Cancel01Icon} className="h-4 w-4" />Remove</button></div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Supplier Product"><select className={input} value={line.supplierProduct} onChange={(event) => changeSupplierLink(line.clientId, event.target.value)} disabled={!form.supplier}><option value="">Manual product selection</option>{supplierLinks.map((link) => <option key={link._id} value={link._id}>{relationLabel(link.product)} · {formatMoney(link.unitPrice, link.currency)}</option>)}</select></Field>
                      <Field label="Product" required><select className={input} value={line.product} onChange={(event) => setLine(line.clientId, { product: event.target.value, supplierProduct: "" })}><option value="">Select product</option>{products.map((product) => <option key={product._id} value={product._id}>{relationLabel(product)}</option>)}</select></Field>
                      <Field label="Purchase Unit"><select className={input} value={line.purchaseUnit} onChange={(event) => setLine(line.clientId, { purchaseUnit: event.target.value })}><option value="">Use product base unit</option>{units.map((unit) => <option key={unit._id} value={unit._id}>{relationLabel(unit)}</option>)}</select></Field>
                      <Field label="Supplier SKU"><FocusPlaceholderInput className={input} value={line.supplierSku} onChange={(event) => setLine(line.clientId, { supplierSku: event.target.value.toUpperCase() })} placeholder="Supplier item code" /></Field>
                      <Field label="Quantity" required><input className={input} type="number" min="0.000001" step="0.000001" value={line.orderedQuantity} onChange={(event) => setLine(line.clientId, { orderedQuantity: event.target.value })} /></Field>
                      <Field label="Unit Price" required><input className={input} type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLine(line.clientId, { unitPrice: event.target.value })} /></Field>
                      <Field label="Discount Type"><select className={input} value={line.discountType} onChange={(event) => setLine(line.clientId, { discountType: event.target.value, discountValue: event.target.value === "none" ? "0" : line.discountValue })}>{meta.discountTypes.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></Field>
                      <Field label="Discount Value"><input className={input} type="number" min="0" step="0.01" value={line.discountValue} onChange={(event) => setLine(line.clientId, { discountValue: event.target.value })} disabled={line.discountType === "none"} /></Field>
                      <Field label="Tax Type"><select className={input} value={line.taxType} onChange={(event) => setLine(line.clientId, { taxType: event.target.value, taxRate: event.target.value === "none" ? "0" : line.taxRate })}>{meta.taxTypes.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></Field>
                      <Field label="Tax Rate %"><input className={input} type="number" min="0" max="100" step="0.01" value={line.taxRate} onChange={(event) => setLine(line.clientId, { taxRate: event.target.value })} disabled={line.taxType === "none"} /></Field>
                      <Field label="Destination Warehouse"><select className={input} value={line.destinationWarehouse} onChange={(event) => changeLineWarehouse(line.clientId, event.target.value)}><option value="">Use default warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{relationLabel(warehouse)}</option>)}</select></Field>
                      <Field label="Destination Location"><select className={input} value={line.destinationLocation} onChange={(event) => setLine(line.clientId, { destinationLocation: event.target.value })} disabled={!line.destinationWarehouse}><option value="">Use default location</option>{locations.map((location) => <option key={location._id} value={location._id}>{relationLabel(location)}</option>)}</select></Field>
                      <div className="md:col-span-2"><Field label="Description"><FocusPlaceholderInput className={input} value={line.description} onChange={(event) => setLine(line.clientId, { description: event.target.value })} placeholder="Product or purchasing description" /></Field></div>
                      <div className="md:col-span-2"><Field label="Line Notes"><FocusPlaceholderInput className={input} value={line.notes} onChange={(event) => setLine(line.clientId, { notes: event.target.value })} placeholder="Packaging, quality, or delivery notes" /></Field></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-3 text-xs sm:grid-cols-5"><div><p className="font-bold text-gray-400">Subtotal</p><p className="mt-1 font-black text-gray-900">{formatMoney(lineTotal.subtotal, form.currency)}</p></div><div><p className="font-bold text-gray-400">Discount</p><p className="mt-1 font-black text-gray-900">{formatMoney(lineTotal.discountAmount, form.currency)}</p></div><div><p className="font-bold text-gray-400">Taxable</p><p className="mt-1 font-black text-gray-900">{formatMoney(lineTotal.taxableAmount, form.currency)}</p></div><div><p className="font-bold text-gray-400">Tax</p><p className="mt-1 font-black text-gray-900">{formatMoney(lineTotal.taxAmount, form.currency)}</p></div><div><p className="font-bold text-gray-400">Line Total</p><p className="mt-1 font-black text-indigo-700">{formatMoney(lineTotal.lineTotal, form.currency)}</p></div></div>
                  </div>
                )
              })}
              <button type="button" className={cn(button, ghostButton, "w-full border-dashed")} onClick={addLine}><Icon icon={Add01Icon} className="h-4 w-4" />Add Another Line</button>
            </div>
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <SectionCard title="Shipping address and notes">
              <div className="grid gap-4 md:grid-cols-2">
                {[["Label", "label"], ["Address Line 1", "addressLine1"], ["Address Line 2", "addressLine2"], ["City", "city"], ["State", "state"], ["Postal Code", "postalCode"], ["Country", "country"]].map(([label, key]) => <Field key={key} label={label}><FocusPlaceholderInput className={input} value={form.shippingAddress[key]} onChange={(event) => setForm((previous) => ({ ...previous, shippingAddress: { ...previous.shippingAddress, [key]: event.target.value } }))} placeholder={label} /></Field>)}
                <div className="md:col-span-2"><Field label="Internal Notes"><FocusPlaceholderTextarea className={cn(input, "min-h-[100px] resize-none")} value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Internal purchase notes..." /></Field></div>
                <div className="md:col-span-2"><Field label="Terms and Conditions"><FocusPlaceholderTextarea className={cn(input, "min-h-[120px] resize-none")} value={form.termsAndConditions} onChange={(event) => setForm((previous) => ({ ...previous, termsAndConditions: event.target.value }))} placeholder="Supplier-facing terms and conditions..." /></Field></div>
              </div>
            </SectionCard>
            <SectionCard title="Order totals" description="Final totals are recalculated by the backend.">
              <div className="space-y-3">
                <Field label="Shipping Cost"><input className={input} type="number" min="0" step="0.01" value={form.shippingCost} onChange={(event) => setForm((previous) => ({ ...previous, shippingCost: event.target.value }))} /></Field>
                <Field label="Other Cost"><input className={input} type="number" min="0" step="0.01" value={form.otherCost} onChange={(event) => setForm((previous) => ({ ...previous, otherCost: event.target.value }))} /></Field>
                <div className="rounded-2xl bg-gray-950 p-4 text-white"><div className="flex justify-between text-sm text-gray-300"><span>Subtotal</span><span>{formatMoney(totals.subtotal, form.currency)}</span></div><div className="mt-2 flex justify-between text-sm text-gray-300"><span>Discount</span><span>- {formatMoney(totals.discountTotal, form.currency)}</span></div><div className="mt-2 flex justify-between text-sm text-gray-300"><span>Tax</span><span>{formatMoney(totals.taxTotal, form.currency)}</span></div><div className="mt-2 flex justify-between text-sm text-gray-300"><span>Extra Costs</span><span>{formatMoney(totals.shippingCost + totals.otherCost, form.currency)}</span></div><div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">Grand Total</p><p className="mt-1 text-2xl font-black">{formatMoney(totals.grandTotal, form.currency)}</p></div></div>
              </div>
            </SectionCard>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        open={detailsModal.open}
        onClose={() => setDetailsModal({ open: false, item: null })}
        title={detailsModal.item?.orderNo || "Purchase-order details"}
        subtitle={detailsModal.item ? `${detailsModal.item.supplier?.businessName || detailsModal.item.supplierSnapshot?.name || "Supplier"} · ${formatDate(detailsModal.item.orderDate)}` : ""}
        icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
        maxWidthClass="max-w-6xl"
        footer={
          <div className="flex w-full items-center justify-between">
            {detailsModal.item ? (
              <button
                type="button"
                className={cn(button, ghostButton)}
                onClick={() => {
                  const target = detailsModal.item
                  setDetailsModal({ open: false, item: null })
                  setPrintOrder(target)
                }}
              >
                <Icon icon={PrinterIcon} className="h-4 w-4 text-indigo-600" />
                Print / PDF
              </button>
            ) : <div />}
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Status", <StatusBadge value={detailsModal.item.status} />], ["Grand Total", formatMoney(detailsModal.item.grandTotal, detailsModal.item.currency)], ["Ordered", formatNumber(detailsModal.item.totalOrderedQuantity)], ["Received", formatNumber(detailsModal.item.totalReceivedQuantity)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 font-black text-gray-950">{value}</div></div>)}</div>
            <SectionCard title="Order information"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Supplier", relationLabel(detailsModal.item.supplier, detailsModal.item.supplierSnapshot?.name)], ["Trade Type", pretty(detailsModal.item.tradeType || "local")], ["Import Status", detailsModal.item.tradeType === "import" ? pretty(detailsModal.item.importStatus || "lc_pending") : "Not applicable"], ["Order Date", formatDate(detailsModal.item.orderDate)], ["Delivery Date", formatDate(detailsModal.item.expectedDeliveryDate)], ["Warehouse", relationLabel(detailsModal.item.defaultWarehouse, "-")], ["Payment Terms", `${pretty(detailsModal.item.paymentTermType)} · ${formatNumber(detailsModal.item.paymentTermDays, 0)} days`], ["Incoterm", detailsModal.item.incoterm || "-"], ["Quotation", detailsModal.item.supplierQuotationRef || "-"], ["Supplier Ref", detailsModal.item.supplierReference || "-"]].map(([label, value]) => <div key={label}><p className="text-xs font-bold text-gray-400">{label}</p><p className="mt-1 text-sm font-bold text-gray-900">{value}</p></div>)}</div></SectionCard>
            <SectionCard title="Order lines"><div className="overflow-x-auto"><table className="min-w-[900px] w-full"><thead><tr className="text-left text-xs font-black uppercase text-gray-400"><th className="pb-3">Product</th><th className="pb-3">Quantity</th><th className="pb-3">Received</th><th className="pb-3">Unit Price</th><th className="pb-3">Discount</th><th className="pb-3">Tax</th><th className="pb-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-gray-100">{(detailsModal.item.lines || []).map((line) => <tr key={line._id}><td className="py-3"><p className="font-bold text-gray-900">{line.product?.name || line.productSnapshot?.name || "-"}</p><p className="text-xs font-semibold text-gray-500">{line.product?.sku || line.productSnapshot?.code || line.supplierSku || "-"}</p></td><td className="py-3 font-bold">{formatNumber(line.orderedQuantity)}</td><td className="py-3 font-bold">{formatNumber(line.receivedQuantity)}</td><td className="py-3 font-bold">{formatMoney(line.unitPrice, detailsModal.item.currency)}</td><td className="py-3 font-bold">{formatMoney(line.discountAmount, detailsModal.item.currency)}</td><td className="py-3 font-bold">{formatMoney(line.taxAmount, detailsModal.item.currency)}</td><td className="py-3 text-right font-black">{formatMoney(line.lineTotal, detailsModal.item.currency)}</td></tr>)}</tbody></table></div></SectionCard>
            {(detailsModal.item.rejectionReason || detailsModal.item.cancellationReason || detailsModal.item.closeReason) ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">{detailsModal.item.rejectionReason || detailsModal.item.cancellationReason || detailsModal.item.closeReason}</div> : null}
          </div>
        ) : null}
      </ModalShell>

      <ConfirmActionModal
        state={confirmState}
        working={
          Boolean(confirmState.item?._id) &&
          busy.id === confirmState.item?._id &&
          busy.type === confirmState.type
        }
        onClose={closeConfirm}
        onConfirm={() => {
          if (!confirmState.item) return
          if (confirmState.type === "delete") {
            deleteOrder(confirmState.item)
          } else {
            runAction(confirmState.item, confirmState.type)
          }
        }}
      />

      <ReasonModal
        state={{ ...reasonState, setReason: (reason) => setReasonState((previous) => ({ ...previous, reason, error: "" })) }}
        saving={busy.id === reasonState.item?._id && busy.type === reasonState.type}
        onClose={() => setReasonState((previous) => ({ ...previous, open: false, reason: "", error: "" }))}
        onSubmit={() => {
          if (!clean(reasonState.reason)) return setReasonState((previous) => ({ ...previous, error: "Reason is required." }))
          runAction(reasonState.item, reasonState.type, clean(reasonState.reason))
        }}
      />

      {printOrder ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-6 lg:p-8 backdrop-blur-sm flex justify-center">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden self-start my-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50 no-print">
              <div>
                <h2 className="text-lg font-black text-gray-900">Purchase Order Document Preview</h2>
                <p className="text-xs font-semibold text-gray-500">{printOrder.orderNo}</p>
              </div>
              <button
                type="button"
                onClick={() => setPrintOrder(null)}
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition shadow-sm"
              >
                ✕ Close Preview
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <PurchaseOrderPrint
                initialOrderId={printOrder._id}
                embedded
                onClose={() => setPrintOrder(null)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
