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
    returnNo: "",
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
  selectedSupplierName,
  selectedPurchaseOrderName,
  selectedGoodsReceiptName,
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

        {filters.supplier !== "all" ? (
          <FilterChip
            label="Supplier"
            value={selectedSupplierName || "Selected supplier"}
            onClear={() => updateFilter("supplier", "all")}
          />
        ) : null}

        {filters.purchaseOrder !== "all" ? (
          <FilterChip
            label="Order"
            value={selectedPurchaseOrderName || "Selected order"}
            onClear={() => updateFilter("purchaseOrder", "all")}
          />
        ) : null}

        {filters.goodsReceipt !== "all" ? (
          <FilterChip
            label="Receipt"
            value={selectedGoodsReceiptName || "Selected receipt"}
            onClear={() => updateFilter("goodsReceipt", "all")}
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
          placeholder="Search return number..."
          type="search"
          aria-label="Search purchase returns"
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

function PurchaseReturnTableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`return-skeleton-${index}`}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-32" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-24" />
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

function PurchaseReturnMobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <article key={`mobile-return-skeleton-${index}`} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-28" />
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

function PurchaseReturnActions({
  item,
  busy,
  canManage,
  canApprove,
  canPost,
  canReverse,
  canDelete,
  onView,
  onEdit,
  onSubmit,
  onApprove,
  onPost,
  onReverse,
  onCancel,
  onDelete,
  mobile = false,
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const working = String(busy.id) === String(item._id)

  useEffect(() => {
    if (!open) return undefined

    const close = () => setOpen(false)
    const onPointer = (event) => {
      if (!event.target.closest?.("[data-pr-actions-menu]")) close()
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
    const estimatedHeight = 320
    const gutter = 8
    const left = Math.min(
      window.innerWidth - menuWidth - gutter,
      Math.max(gutter, rect.right - menuWidth)
    )
    const fitsBelow =
      window.innerHeight - rect.bottom >= Math.min(estimatedHeight, 280)
    const top = fitsBelow
      ? rect.bottom + gutter
      : Math.max(gutter, rect.top - estimatedHeight - gutter)

    setPosition({ top, left })
    setOpen((previous) => !previous)
  }

  const menuItems = []

  if (canManage && item.status === "draft") {
    menuItems.push(
      {
        key: "edit",
        label: "Edit return",
        icon: Edit02Icon,
        onClick: () => onEdit(item),
      },
      {
        key: "submit",
        label: "Submit for approval",
        icon: Tick02Icon,
        onClick: () => onSubmit(item),
      }
    )
  }

  if (canApprove && item.status === "submitted") {
    menuItems.push({
      key: "approve",
      label: "Approve return",
      icon: Tick02Icon,
      onClick: () => onApprove(item),
    })
  }

  if (canPost && item.status === "approved") {
    menuItems.push({
      key: "post",
      label: "Post inventory return",
      icon: FloppyDiskIcon,
      onClick: () => onPost(item),
    })
  }

  if (canReverse && item.status === "posted") {
    menuItems.push({
      key: "reverse",
      label: "Reverse return",
      icon: RefreshIcon,
      danger: true,
      onClick: () => onReverse(item),
    })
  }

  if (canManage && ["draft", "submitted", "approved"].includes(item.status)) {
    menuItems.push({
      key: "cancel",
      label: "Cancel return",
      icon: Cancel01Icon,
      danger: true,
      onClick: () => onCancel(item),
    })
  }

  if (canDelete && ["draft", "cancelled"].includes(item.status)) {
    menuItems.push({
      key: "delete",
      label: "Delete return",
      icon: Archive02Icon,
      danger: true,
      separator: true,
      onClick: () => onDelete(item),
    })
  }

  const activeBusyType = working ? busy.type : ""

  return (
    <div
      className={cn("flex items-center gap-2", mobile ? "w-full" : "justify-end")}
      data-pr-actions-menu
    >
      <button
        type="button"
        className={cn(
          button,
          ghostButton,
          mobile ? "h-10 flex-1 px-3" : "h-10 px-3"
        )}
        onClick={() => onView(item)}
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
          aria-label={`More actions for ${item.returnNo}`}
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
              data-pr-actions-menu
              className="fixed z-[150] w-[250px] overflow-hidden rounded-2xl border border-gray-100 bg-white p-1.5 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)]"
              style={{ top: position.top, left: position.left }}
            >
              {menuItems.map((menuItem) => (
                <div key={menuItem.key}>
                  {menuItem.separator ? (
                    <div className="my-1 border-t border-gray-100" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      menuItem.onClick()
                    }}
                    disabled={working}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                      menuItem.danger
                        ? "text-rose-700 hover:bg-rose-50"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <Icon icon={menuItem.icon} className="h-4 w-4 shrink-0" />
                    <span>{menuItem.label}</span>
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
      subtitle={state.item?.returnNo || "Purchase return"}
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
      title="Purchase-return filters"
      subtitle="Filter return history"
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
            onClick={onClose}
          >
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
  const purchaseOrderMap = useMemo(
    () => new Map(purchaseOrders.map((item) => [String(item._id), item])),
    [purchaseOrders]
  )
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((item) => [String(item._id), item])),
    [warehouses]
  )
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

  const filterChipCount = useMemo(
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
    const results = await Promise.allSettled([
      api("/purchase/purchase-returns/meta"),
      api("/purchase/goods-receipts/options?limit=100"),
      api("/suppliers/options?limit=200&includeUnavailable=true"),
      api("/purchase/purchase-orders/options?limit=100"),
      api("/inventory/warehouses/options?limit=100"),
      api("/inventory/products?status=active&limit=100"),
      api("/inventory/units/options?limit=200"),
    ])
    const value = (index, fallback = {}) =>
      results[index].status === "fulfilled" ? results[index].value : fallback

    setMeta({ ...FALLBACK_META, ...value(0) })
    setGoodsReceipts(value(1).goodsReceipts || [])
    setSuppliers(value(2).suppliers || [])
    setPurchaseOrders(value(3).purchaseOrders || [])
    setWarehouses(value(4).warehouses || [])
    setProducts(value(5).products || [])
    setUnits(value(6).units || [])

    const firstFailure = results.find((result) => result.status === "rejected")
    if (firstFailure) {
      toast.error(firstFailure.reason?.message || "Some purchase-return options could not be loaded")
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

  const loadReturns = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const data = await api(
        `/purchase/purchase-returns?${buildParams({ append })}`,
        { signal }
      )
      const incoming = data.purchaseReturns || []
      setReturns((previous) => (append ? [...previous, ...incoming] : incoming))
      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error.name !== "AbortError") {
        toast.error(error.message || "Failed to load purchase returns")
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
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      loadReturns({ signal: controller.signal })
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
    Promise.all([loadReferenceData(), loadReturns()])

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
      purchaseOrder: "all",
      goodsReceipt: "all",
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
    ...(!formModal.item && clean(form.returnNo) ? { returnNo: clean(form.returnNo).toUpperCase() } : {}),
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
      await Promise.all([loadReturns({ showLoader: false }), loadReferenceData()])
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
      setConfirmState((previous) => ({ ...previous, open: false }))
      await Promise.all([loadReturns({ showLoader: false }), loadReferenceData()])
      return true
    } catch (error) {
      if (reasonState.open) {
        setReasonState((previous) => ({
          ...previous,
          error: error.message || "Action failed",
        }))
      } else {
        toast.error(error.message || "Action failed")
      }
      return false
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const performDelete = async (item) => {
    setBusy({ id: item._id, type: "delete" })
    try {
      await api(`/purchase/purchase-returns/${item._id}`, { method: "DELETE" })
      toast.success("Purchase return deleted")
      setConfirmState((previous) => ({ ...previous, open: false }))
      if (detailsModal.item?._id === item._id) {
        setDetailsModal({ open: false, item: null })
      }
      await Promise.all([
        loadReturns({ showLoader: false }),
        loadReferenceData(),
      ])
      return true
    } catch (error) {
      toast.error(error.message || "Failed to delete purchase return")
      return false
    } finally {
      setBusy({ id: "", type: "" })
    }
  }

  const requestConfirm = (item, type) => {
    const config = {
      submit: {
        title: "Submit purchase return",
        message: `Submit ${item.returnNo} for approval?`,
        actionLabel: "Submit",
        danger: false,
      },
      approve: {
        title: "Approve purchase return",
        message: `Approve ${item.returnNo}? It will become ready for inventory posting.`,
        actionLabel: "Approve",
        danger: false,
      },
      post: {
        title: "Post purchase return",
        message: `Post ${item.returnNo} to inventory? Stock will be reduced from the selected source buckets.`,
        actionLabel: "Post Return",
        danger: false,
      },
      delete: {
        title: "Delete purchase return",
        message: `Delete ${item.returnNo}? Only eligible draft or cancelled returns should be removed.`,
        actionLabel: "Delete Return",
        danger: true,
      },
    }[type]

    if (!config) return

    setConfirmState({
      open: true,
      item,
      type,
      ...config,
    })
  }

  const confirmAction = async () => {
    const item = confirmState.item
    if (!item) return

    if (confirmState.type === "delete") {
      await performDelete(item)
      return
    }

    await runAction(item, confirmState.type)
  }

  const selectedSupplierName =
    filters.supplier === "all"
      ? ""
      : relationLabel(
          supplierMap.get(String(filters.supplier)),
          "Selected supplier"
        )
  const selectedPurchaseOrderName =
    filters.purchaseOrder === "all"
      ? ""
      : purchaseOrderMap.get(String(filters.purchaseOrder))?.orderNo ||
        "Selected order"
  const selectedGoodsReceiptName =
    filters.goodsReceipt === "all"
      ? ""
      : receiptMap.get(String(filters.goodsReceipt))?.receiptNo ||
        "Selected receipt"
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
                Purchase Returns
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
                New Purchase Return
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
            selectedSupplierName={selectedSupplierName}
            selectedPurchaseOrderName={selectedPurchaseOrderName}
            selectedGoodsReceiptName={selectedGoodsReceiptName}
            selectedWarehouseName={selectedWarehouseName}
            selectedProductName={selectedProductName}
            onClearStatus={() => switchTab("all")}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-gray-900">{returns.length}</span> returns
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only purchase-return access.
        </div>
      ) : null}

      <div className={cn(card, "mb-5 p-2")}>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {["all", ...meta.statuses].map((status) => (
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
          ))}
        </div>
      </div>

      <div className={cn(card, "overflow-hidden rounded-3xl")}>
        <div className="hidden max-h-[650px] overflow-auto lg:block">
          <table className="min-w-[1120px] w-full text-left">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <th className="px-5 py-3.5">Return</th>
                <th className="px-5 py-3.5">Supplier / Receipt</th>
                <th className="px-5 py-3.5">Warehouse</th>
                <th className="px-5 py-3.5">Quantity</th>
                <th className="px-5 py-3.5">Value</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <PurchaseReturnTableSkeleton />
              ) : returns.length ? (
                returns.map((item) => (
                  <tr
                    key={item._id}
                    className="group bg-white transition hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {item.returnNo}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {formatDate(item.returnDate)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="max-w-[250px] truncate text-sm font-semibold text-gray-900">
                        {relationLabel(
                          item.supplier,
                          item.supplierSnapshot?.name || "Supplier"
                        )}
                      </p>
                      <p className="mt-1 max-w-[250px] truncate text-xs font-medium text-gray-500">
                        {item.goodsReceipt?.receiptNo || "-"} ·{" "}
                        {item.purchaseOrder?.orderNo || "-"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700">
                      {relationLabel(item.warehouse, "-")}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {formatNumber(item.totalReturnQuantity)}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {formatMoney(item.totalReturnValue, item.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge value={item.status} />
                    </td>
                    <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                      <PurchaseReturnActions
                        item={item}
                        busy={busy}
                        canManage={canManage}
                        canApprove={canApprove}
                        canPost={canPost}
                        canReverse={canReverse}
                        canDelete={canDelete}
                        onView={openDetails}
                        onEdit={openEdit}
                        onSubmit={(row) => requestConfirm(row, "submit")}
                        onApprove={(row) => requestConfirm(row, "approve")}
                        onPost={(row) => requestConfirm(row, "post")}
                        onReverse={(row) => requestReason(row, "reverse")}
                        onCancel={(row) => requestReason(row, "cancel")}
                        onDelete={(row) => requestConfirm(row, "delete")}
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
                      No purchase returns found
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                      Create a return from a posted goods receipt or adjust the filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {loading ? (
            <PurchaseReturnMobileSkeleton />
          ) : returns.length ? (
            returns.map((item) => (
              <article key={item._id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {item.returnNo}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {formatDate(item.returnDate)} · {item.goodsReceipt?.receiptNo || "-"}
                    </p>
                  </div>
                  <StatusBadge value={item.status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400">Supplier</p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {relationLabel(
                        item.supplier,
                        item.supplierSnapshot?.name || "Supplier"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Warehouse</p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {relationLabel(item.warehouse, "-")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Quantity</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatNumber(item.totalReturnQuantity)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">Value</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatMoney(item.totalReturnValue, item.currency)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <PurchaseReturnActions
                    item={item}
                    busy={busy}
                    canManage={canManage}
                    canApprove={canApprove}
                    canPost={canPost}
                    canReverse={canReverse}
                    canDelete={canDelete}
                    onView={openDetails}
                    onEdit={openEdit}
                    onSubmit={(row) => requestConfirm(row, "submit")}
                    onApprove={(row) => requestConfirm(row, "approve")}
                    onPost={(row) => requestConfirm(row, "post")}
                    onReverse={(row) => requestReason(row, "reverse")}
                    onCancel={(row) => requestReason(row, "cancel")}
                    onDelete={(row) => requestConfirm(row, "delete")}
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
                No purchase returns found
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {returns.length} return{returns.length === 1 ? "" : "s"} loaded
          </p>
          {hasMore ? (
            <button
              type="button"
              className={cn(button, ghostButton, "min-w-[140px]")}
              onClick={() => loadReturns({ append: true })}
              disabled={loadingMore}
            >
              <Icon
                icon={RefreshIcon}
                className={cn("h-4 w-4", loadingMore ? "animate-spin" : "")}
              />
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          ) : returns.length ? (
            <span className="text-xs font-semibold text-gray-400">
              All returns loaded
            </span>
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
              {!formModal.item ? <Field label="Return No. (blank for Auto)"><input className={input} value={form.returnNo} onChange={(event) => setForm((previous) => ({ ...previous, returnNo: event.target.value.toUpperCase() }))} placeholder="Enter a number in Manual mode" /></Field> : null}
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
