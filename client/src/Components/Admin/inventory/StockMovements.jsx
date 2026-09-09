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

const MOVEMENT_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_MOVEMENT_MANAGE ||
  "inventory-movement:manage"

const MOVEMENT_POST_PERMISSION =
  PERMISSIONS?.INVENTORY_MOVEMENT_POST ||
  "inventory-movement:post"

const MOVEMENT_REVERSE_PERMISSION =
  PERMISSIONS?.INVENTORY_MOVEMENT_REVERSE ||
  "inventory-movement:reverse"

const MOVEMENT_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_MOVEMENT_DELETE ||
  "inventory-movement:delete"

const COST_VIEW_PERMISSION =
  PERMISSIONS?.INVENTORY_REPORT_COST_VIEW ||
  "inventory-report:cost-view"

const MOVEMENT_TYPES = [
  ["opening_stock", "Opening Stock"],
  ["purchase_receipt", "Purchase Receipt"],
  ["purchase_return", "Purchase Return"],
  ["sales_issue", "Sales Issue"],
  ["sales_return", "Sales Return"],
  ["warehouse_transfer", "Warehouse Transfer"],
  ["stock_adjustment", "Stock Adjustment"],
  ["production_issue", "Production Issue"],
  ["production_receipt", "Production Receipt"],
  ["reservation", "Reservation"],
  ["release_reservation", "Release Reservation"],
  ["quarantine", "Quarantine"],
  ["release_quarantine", "Release Quarantine"],
  ["incoming_commitment", "Incoming Commitment"],
  ["outgoing_commitment", "Outgoing Commitment"],
  ["other", "Other"],
]

const FILTER_MOVEMENT_TYPES = [
  ...MOVEMENT_TYPES,
  ["reversal", "Reversal"],
]

const STOCK_EFFECTS = [
  ["in", "Stock In"],
  ["out", "Stock Out"],
  ["transfer", "Transfer"],
  ["reserve", "Reserve"],
  ["release", "Release Reservation"],
  ["quarantine", "Move to Quarantine"],
  ["release_quarantine", "Release Quarantine"],
  ["in_quarantine", "Stock In to Quarantine"],
  ["out_quarantine", "Stock Out from Quarantine"],
  ["incoming", "Add Incoming"],
  ["incoming_clear", "Clear Incoming"],
  ["outgoing", "Add Outgoing"],
  ["outgoing_clear", "Clear Outgoing"],
]

const SOURCE_EFFECTS = new Set([
  "out",
  "transfer",
  "reserve",
  "release",
  "quarantine",
  "release_quarantine",
  "out_quarantine",
  "outgoing",
  "outgoing_clear",
])

const DESTINATION_EFFECTS = new Set([
  "in",
  "transfer",
  "in_quarantine",
  "incoming",
  "incoming_clear",
])

const PHYSICAL_EFFECTS = new Set([
  "in",
  "out",
  "transfer",
  "in_quarantine",
  "out_quarantine",
])

const MOVEMENT_DEFAULT_EFFECT = {
  opening_stock: "in",
  purchase_receipt: "in",
  purchase_return: "out",
  sales_issue: "out",
  sales_return: "in",
  warehouse_transfer: "transfer",
  stock_adjustment: "in",
  production_issue: "out",
  production_receipt: "in",
  reservation: "reserve",
  release_reservation: "release",
  quarantine: "quarantine",
  release_quarantine: "release_quarantine",
  incoming_commitment: "incoming",
  outgoing_commitment: "outgoing",
  other: "in",
}

const emptySummary = {
  movementCount: 0,
  postedCount: 0,
  draftCount: 0,
  reversedCount: 0,
  totalQuantity: 0,
  totalValue: 0,
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `movement-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function nowInputValue() {
  const date = new Date()
  const offset = date.getTimezoneOffset()

  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16)
}

function emptyLine(effect = "in") {
  return {
    clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    product: "",
    effect,
    sourceWarehouse: "",
    sourceLocation: "",
    destinationWarehouse: "",
    destinationLocation: "",
    quantity: "1",
    requestedUnitCost: "0",
    lotNumber: "",
    serialNumbersText: "",
    manufactureDate: "",
    expiryDate: "",
    note: "",
  }
}

function emptyMovementForm() {
  return {
    movementDate: nowInputValue(),
    movementType: "other",
    reference: "",
    currency: "BDT",
    reason: "",
    notes: "",
    sourceType: "manual",
    sourceId: "",
    idempotencyKey: newIdempotencyKey(),
    lines: [emptyLine("in")],
  }
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
  if (value === null || value === undefined || value === "") return "—"
  return `${clean(currency || "BDT")} ${formatNumber(value, 2)}`
}

function relationLabel(item, fallback = "Unnamed") {
  if (!item) return fallback

  const name = item.name || item.label || fallback
  const code = item.sku || item.code || item.barcode || ""

  return `${name}${code ? ` (${code})` : ""}`
}

function parseSerialNumbers(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\n,]+/)
        .map((item) => clean(item).toUpperCase())
        .filter(Boolean)
    ),
  ]
}

function lineRequiresSource(effect) {
  return SOURCE_EFFECTS.has(effect)
}

function lineRequiresDestination(effect) {
  return DESTINATION_EFFECTS.has(effect)
}

function isPhysicalEffect(effect) {
  return PHYSICAL_EFFECTS.has(effect)
}

function estimatedLineValue(line) {
  if (!isPhysicalEffect(line.effect)) return 0

  return (
    Number(line.quantity || 0) *
    Number(line.requestedUnitCost || 0)
  )
}

function movementEstimatedValue(lines = []) {
  return lines.reduce(
    (total, line) => total + estimatedLineValue(line),
    0
  )
}

function sourceDestinationSummary(movement) {
  const sources = movement.sourceWarehouses || []
  const destinations = movement.destinationWarehouses || []

  const sourceText = sources.length
    ? sources
        .slice(0, 2)
        .map((item) => item?.code || item?.name)
        .filter(Boolean)
        .join(", ")
    : "—"

  const destinationText = destinations.length
    ? destinations
        .slice(0, 2)
        .map((item) => item?.code || item?.name)
        .filter(Boolean)
        .join(", ")
    : "—"

  return `${sourceText} → ${destinationText}`
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

function MovementStatusBadge({ value }) {
  const status = String(value || "").toLowerCase()

  const style =
    status === "posted"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "draft"
        ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
        : status === "reversed"
          ? "bg-amber-50 text-amber-700 ring-amber-100"
          : status === "cancelled"
            ? "bg-gray-100 text-gray-700 ring-gray-200"
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
          status === "posted"
            ? "bg-emerald-500"
            : status === "draft"
              ? "bg-indigo-500"
              : status === "reversed"
                ? "bg-amber-500"
                : status === "cancelled"
                  ? "bg-gray-400"
                  : "bg-slate-400"
        )}
      />

      {pretty(value)}
    </span>
  )
}

function MovementTypeBadge({ value }) {
  const type = String(value || "").toLowerCase()

  const style =
    ["purchase_receipt", "sales_return", "production_receipt"].includes(
      type
    )
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : ["sales_issue", "purchase_return", "production_issue"].includes(
            type
          )
        ? "bg-rose-50 text-rose-700 ring-rose-100"
        : type === "warehouse_transfer"
          ? "bg-sky-50 text-sky-700 ring-sky-100"
          : type === "stock_adjustment"
            ? "bg-amber-50 text-amber-700 ring-amber-100"
            : type === "reversal"
              ? "bg-violet-50 text-violet-700 ring-violet-100"
              : "bg-indigo-50 text-indigo-700 ring-indigo-100"

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

function EffectBadge({ value }) {
  const effect = String(value || "").toLowerCase()

  const style =
    ["in", "in_quarantine", "incoming"].includes(effect)
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : ["out", "out_quarantine", "outgoing"].includes(effect)
        ? "bg-rose-50 text-rose-700 ring-rose-100"
        : effect === "transfer"
          ? "bg-sky-50 text-sky-700 ring-sky-100"
          : ["quarantine", "release_quarantine"].includes(effect)
            ? "bg-amber-50 text-amber-700 ring-amber-100"
            : "bg-indigo-50 text-indigo-700 ring-indigo-100"

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
}) {
  const hasFilters =
    clean(filters.q) ||
    filters.movementType !== "all" ||
    clean(filters.sourceType) ||
    filters.product !== "all" ||
    filters.warehouse !== "all" ||
    filters.from ||
    filters.to ||
    activeTab !== "all"

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {activeTab !== "all" ? (
        <FilterChip
          label="Status"
          value={pretty(activeTab)}
          onClear={() => updateFilter("__tab", "all")}
        />
      ) : null}

      {clean(filters.q) ? (
        <FilterChip
          label="Search"
          value={clean(filters.q)}
          onClear={() => updateFilter("q", "")}
        />
      ) : null}

      {filters.movementType !== "all" ? (
        <FilterChip
          label="Type"
          value={pretty(filters.movementType)}
          onClear={() => updateFilter("movementType", "all")}
        />
      ) : null}

      {clean(filters.sourceType) ? (
        <FilterChip
          label="Source"
          value={clean(filters.sourceType)}
          onClear={() => updateFilter("sourceType", "")}
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

      {filters.from ? (
        <FilterChip
          label="From"
          value={filters.from}
          onClear={() => updateFilter("from", "")}
        />
      ) : null}

      {filters.to ? (
        <FilterChip
          label="To"
          value={filters.to}
          onClear={() => updateFilter("to", "")}
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

        {activeTab !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(activeTab)}
            onClear={() => updateFilter("__tab", "all")}
          />
        ) : null}

        {clean(filters.q) ? (
          <FilterChip
            label="Search"
            value={clean(filters.q)}
            onClear={() => updateFilter("q", "")}
          />
        ) : null}

        {filters.movementType !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(filters.movementType)}
            onClear={() => updateFilter("movementType", "all")}
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

        <FocusPlaceholderInput
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search movement number or reference..."
          type="text"
          aria-label="Search stock movements"
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

function SummaryCards({ summary, onSelectTab, canViewCost = true }) {
  const items = [
    {
      label: "Movements",
      value: formatNumber(summary.movementCount, 0),
      tab: "all",
      note: "Matching current filters",
    },
    {
      label: "Drafts",
      value: formatNumber(summary.draftCount, 0),
      tab: "draft",
      note: "Awaiting posting or cancellation",
    },
    {
      label: "Posted",
      value: formatNumber(summary.postedCount, 0),
      tab: "posted",
      note: "Applied to live stock",
    },
    {
      label: "Reversed",
      value: formatNumber(summary.reversedCount, 0),
      tab: "reversed",
      note: "Compensated by reversal entries",
    },
    {
      label: "Total Quantity",
      value: formatNumber(summary.totalQuantity),
      tab: "all",
      note: "Across all movement lines",
    },
    {
      label: "Total Value",
      value: canViewCost ? formatMoney(summary.totalValue) : "—",
      tab: "all",
      note: "Posted physical movement value",
    },
  ]

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={() => onSelectTab(item.tab)}
          className={cn(
            card,
            "p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/20"
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

export default function StockMovements() {
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
    MOVEMENT_MANAGE_PERMISSION
  )

  const canPost = hasPermission(
    currentUser,
    MOVEMENT_POST_PERMISSION
  )

  const canReverse = hasPermission(
    currentUser,
    MOVEMENT_REVERSE_PERMISSION
  )

  const canDelete = hasPermission(
    currentUser,
    MOVEMENT_DELETE_PERMISSION
  )

  const canCreate = canManage || canPost
  const canViewCost =
    hasPermission(currentUser, COST_VIEW_PERMISSION) ||
    currentUser?.role === "admin"

  const [activeTab, setActiveTab] = useState("all")
  const [movements, setMovements] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [locationsByWarehouse, setLocationsByWarehouse] =
    useState({})

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [actionState, setActionState] = useState({
    id: "",
    type: "",
  })
  const [openingMovementId, setOpeningMovementId] = useState("")
  const [loadingDetailsId, setLoadingDetailsId] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [formModal, setFormModal] = useState({
    open: false,
    item: null,
  })
  const [form, setForm] = useState(emptyMovementForm)
  const [formError, setFormError] = useState("")
  const [submitMode, setSubmitMode] = useState("draft")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    movement: null,
  })

  const [reasonModal, setReasonModal] = useState({
    open: false,
    type: "",
    movement: null,
    reason: "",
    error: "",
  })

  const [filters, setFilters] = useState({
    q: "",
    movementType: "all",
    sourceType: "",
    product: "all",
    warehouse: "all",
    from: "",
    to: "",
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

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (activeTab !== "all") count += 1
    if (clean(filters.q)) count += 1
    if (filters.movementType !== "all") count += 1
    if (clean(filters.sourceType)) count += 1
    if (filters.product !== "all") count += 1
    if (filters.warehouse !== "all") count += 1
    if (filters.from) count += 1
    if (filters.to) count += 1

    return count
  }, [activeTab, filters])

  const updateFilter = (key, value) => {
    if (key === "__tab") {
      setActiveTab(value)
      return
    }

    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const resetFilters = () => {
    setActiveTab("all")
    setFilters({
      q: "",
      movementType: "all",
      sourceType: "",
      product: "all",
      warehouse: "all",
      from: "",
      to: "",
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
        error.message || "Failed to load movement options"
      )
    }
  }

  const loadWarehouseLocations = async (warehouseId) => {
    if (!warehouseId) return []

    if (locationsByWarehouse[warehouseId]) {
      return locationsByWarehouse[warehouseId]
    }

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
      toast.error(
        error.message || "Failed to load warehouse locations"
      )
      return []
    }
  }

  const buildMovementParams = ({ append = false } = {}) => {
    const params = new URLSearchParams({
      limit: "40",
    })

    if (activeTab !== "all") {
      params.set("status", activeTab)
    }

    if (clean(filters.q)) {
      params.set("q", clean(filters.q))
    }

    if (filters.movementType !== "all") {
      params.set("movementType", filters.movementType)
    }

    if (clean(filters.sourceType)) {
      params.set("sourceType", clean(filters.sourceType).toLowerCase())
    }

    if (filters.product !== "all") {
      params.set("product", filters.product)
    }

    if (filters.warehouse !== "all") {
      params.set("warehouse", filters.warehouse)
    }

    if (filters.from) {
      params.set("from", filters.from)
    }

    if (filters.to) {
      params.set("to", filters.to)
    }

    if (append && nextCursor) {
      params.set("cursor", nextCursor)
    }

    return params
  }

  const loadMovements = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const data = await api(
        `/inventory/stock-movements?${buildMovementParams({
          append,
        }).toString()}`,
        { signal }
      )

      const incoming = data.movements || []

      setMovements((previous) =>
        append ? [...previous, ...incoming] : incoming
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(
          error.message || "Failed to load stock movements"
        )
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  const loadSummary = async ({ signal } = {}) => {
    try {
      const data = await api(
        `/inventory/stock-movements/summary?${buildMovementParams().toString()}`,
        { signal }
      )

      setSummary({
        ...emptySummary,
        ...(data.summary || {}),
      })
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(
          error.message || "Failed to load movement summary"
        )
      }
    }
  }

  useEffect(() => {
    loadSetupOptions()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      Promise.all([
        loadMovements({ signal: controller.signal }),
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
    filters.movementType,
    filters.sourceType,
    filters.product,
    filters.warehouse,
    filters.from,
    filters.to,
  ])

  const refresh = async () => {
    await Promise.all([
      loadSetupOptions(),
      loadMovements(),
      loadSummary(),
    ])
  }

  const exportCsv = async () => {
    setExportingCsv(true)
    try {
      const token = localStorage.getItem("token")
      const params = new URLSearchParams()
      if (activeTab !== "all") params.set("status", activeTab)
      if (filters.movementType !== "all") {
        params.set("movementType", filters.movementType)
      }
      if (filters.product !== "all") {
        params.set("product", filters.product)
      }
      if (filters.warehouse !== "all") {
        params.set("warehouse", filters.warehouse)
      }
      if (filters.from) params.set("from", filters.from)
      if (filters.to) params.set("to", filters.to)
      params.set("format", "csv")

      const response = await fetch(
        `${API_BASE}/inventory/reports/movements?${params.toString()}`,
        {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson.message || "Failed to export movements CSV")
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success("Movements CSV exported successfully")
    } catch (err) {
      toast.error(err.message || "Export failed")
    } finally {
      setExportingCsv(false)
    }
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
    setNextCursor(null)
    setHasMore(false)
  }

  const openCreateModal = () => {
    setFormError("")
    setSubmitMode(canManage ? "draft" : "post")
    setShowAdvanced(false)
    setForm(emptyMovementForm())
    setFormModal({
      open: true,
      item: null,
    })
  }

  const openEditModal = async (movement) => {
    if (movement.status !== "draft") {
      toast.error("Only a draft movement can be edited.")
      return
    }

    setOpeningMovementId(movement._id)
    setFormError("")
    setSubmitMode("draft")
    setShowAdvanced(false)

    try {
      const data = await api(
        `/inventory/stock-movements/${movement._id}`
      )

      const item = data.movement

      const lines = (item.lines || []).map((line) => ({
        clientId:
          line._id ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        product: normalizeId(line.product),
        effect: line.effect || "in",
        sourceWarehouse: normalizeId(line.sourceWarehouse),
        sourceLocation: normalizeId(line.sourceLocation),
        destinationWarehouse: normalizeId(
          line.destinationWarehouse
        ),
        destinationLocation: normalizeId(
          line.destinationLocation
        ),
        quantity: String(line.quantity ?? 1),
        requestedUnitCost: String(
          line.requestedUnitCost ?? 0
        ),
        lotNumber: line.lotNumber || "",
        serialNumbersText: (line.serialNumbers || []).join("\n"),
        manufactureDate: line.manufactureDate
          ? String(line.manufactureDate).slice(0, 10)
          : "",
        expiryDate: line.expiryDate
          ? String(line.expiryDate).slice(0, 10)
          : "",
        note: line.note || "",
      }))

      setForm({
        movementDate: toDateInput(item.movementDate),
        movementType: item.movementType || "other",
        reference: item.reference || "",
        currency: item.currency || "BDT",
        reason: item.reason || "",
        notes: item.notes || "",
        sourceType: item.sourceType || "manual",
        sourceId: normalizeId(item.sourceId),
        idempotencyKey:
          item.idempotencyKey || newIdempotencyKey(),
        lines: lines.length
          ? lines
          : [emptyLine(MOVEMENT_DEFAULT_EFFECT[item.movementType] || "in")],
      })

      setFormModal({
        open: true,
        item,
      })

      const warehouseIds = [
        ...new Set(
          lines
            .flatMap((line) => [
              line.sourceWarehouse,
              line.destinationWarehouse,
            ])
            .filter(Boolean)
        ),
      ]

      await Promise.all(
        warehouseIds.map((id) => loadWarehouseLocations(id))
      )
    } catch (error) {
      toast.error(
        error.message || "Failed to load stock movement"
      )
    } finally {
      setOpeningMovementId("")
    }
  }

  const closeFormModal = () => {
    if (saving) return

    setFormModal({
      open: false,
      item: null,
    })
    setForm(emptyMovementForm())
    setFormError("")
    setShowAdvanced(false)
  }

  const updateMovementType = (movementType) => {
    const defaultEffect =
      MOVEMENT_DEFAULT_EFFECT[movementType] || "in"

    setForm((previous) => ({
      ...previous,
      movementType,
      lines: previous.lines.map((line) =>
        !line.product
          ? {
              ...line,
              effect: defaultEffect,
            }
          : line
      ),
    }))
  }

  const updateLine = (clientId, key, value) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              [key]: value,
            }
          : line
      ),
    }))
  }

  const changeLineEffect = (clientId, effect) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) => {
        if (line.clientId !== clientId) return line

        return {
          ...line,
          effect,
          sourceWarehouse: lineRequiresSource(effect)
            ? line.sourceWarehouse
            : "",
          sourceLocation: lineRequiresSource(effect)
            ? line.sourceLocation
            : "",
          destinationWarehouse: lineRequiresDestination(effect)
            ? line.destinationWarehouse
            : "",
          destinationLocation: lineRequiresDestination(effect)
            ? line.destinationLocation
            : "",
        }
      }),
    }))
  }

  const changeLineProduct = (clientId, productId) => {
    const product = productMap.get(String(productId))

    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              product: productId,
              requestedUnitCost:
                Number(line.requestedUnitCost || 0) > 0
                  ? line.requestedUnitCost
                  : String(product?.purchasePrice ?? 0),
              lotNumber:
                product?.trackingType === "batch"
                  ? line.lotNumber
                  : "",
              serialNumbersText:
                product?.trackingType === "serial"
                  ? line.serialNumbersText
                  : "",
            }
          : line
      ),
    }))
  }

  const changeLineWarehouse = async (
    clientId,
    field,
    warehouseId
  ) => {
    const locationField =
      field === "sourceWarehouse"
        ? "sourceLocation"
        : "destinationLocation"

    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.clientId === clientId
          ? {
              ...line,
              [field]: warehouseId,
              [locationField]: "",
            }
          : line
      ),
    }))

    if (warehouseId) {
      await loadWarehouseLocations(warehouseId)
    }
  }

  const addLine = () => {
    if (form.lines.length >= 500) {
      toast.error("A movement cannot contain more than 500 lines.")
      return
    }

    setForm((previous) => ({
      ...previous,
      lines: [
        ...previous.lines,
        emptyLine(
          MOVEMENT_DEFAULT_EFFECT[previous.movementType] || "in"
        ),
      ],
    }))
  }

  const duplicateLine = (line) => {
    if (form.lines.length >= 500) {
      toast.error("A movement cannot contain more than 500 lines.")
      return
    }

    setForm((previous) => ({
      ...previous,
      lines: [
        ...previous.lines,
        {
          ...line,
          clientId: `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
        },
      ],
    }))
  }

  const removeLine = (clientId) => {
    if (form.lines.length === 1) {
      toast.error("A movement requires at least one line.")
      return
    }

    setForm((previous) => ({
      ...previous,
      lines: previous.lines.filter(
        (line) => line.clientId !== clientId
      ),
    }))
  }

  const validateForm = () => {
    if (!form.movementDate) {
      return "A valid movement date is required."
    }

    if (!MOVEMENT_TYPES.some(([value]) => value === form.movementType)) {
      return "Movement type has an invalid value."
    }

    if (!form.lines.length || form.lines.length > 500) {
      return "A movement must contain between 1 and 500 lines."
    }

    for (let index = 0; index < form.lines.length; index += 1) {
      const line = form.lines[index]
      const label = `Line ${index + 1}`
      const product = productMap.get(String(line.product))
      const quantity = Number(line.quantity)
      const unitCost = Number(line.requestedUnitCost || 0)

      if (!line.product) {
        return `${label}: product is required.`
      }

      if (!STOCK_EFFECTS.some(([value]) => value === line.effect)) {
        return `${label}: stock effect is invalid.`
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `${label}: quantity must be greater than zero.`
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return `${label}: unit cost must be a valid non-negative number.`
      }

      if (
        lineRequiresSource(line.effect) &&
        !line.sourceWarehouse
      ) {
        return `${label}: source warehouse is required.`
      }

      if (
        lineRequiresDestination(line.effect) &&
        !line.destinationWarehouse
      ) {
        return `${label}: destination warehouse is required.`
      }

      if (
        line.effect === "transfer" &&
        line.sourceWarehouse === line.destinationWarehouse &&
        (line.sourceLocation || "") ===
          (line.destinationLocation || "")
      ) {
        return `${label}: source and destination stock positions must be different.`
      }

      if (
        isPhysicalEffect(line.effect) &&
        product?.trackingType === "batch" &&
        !clean(line.lotNumber)
      ) {
        return `${label}: lot number is required for this batch-tracked product.`
      }

      if (
        isPhysicalEffect(line.effect) &&
        product?.trackingType === "serial"
      ) {
        if (!Number.isInteger(quantity)) {
          return `${label}: serial-tracked product quantity must be a whole number.`
        }

        const serials = parseSerialNumbers(
          line.serialNumbersText
        )

        if (serials.length !== quantity) {
          return `${label}: provide one unique serial number for each unit.`
        }
      }

      if (
        line.manufactureDate &&
        line.expiryDate &&
        new Date(line.expiryDate) <
          new Date(line.manufactureDate)
      ) {
        return `${label}: expiry date cannot be before manufacture date.`
      }
    }

    return ""
  }

  const buildPayload = () => ({
    movementDate: form.movementDate,
    movementType: form.movementType,
    reference: clean(form.reference).toUpperCase(),
    sourceType: clean(form.sourceType || "manual").toLowerCase(),
    sourceId: clean(form.sourceId) || null,
    idempotencyKey: clean(form.idempotencyKey),
    currency: clean(form.currency || "BDT").toUpperCase(),
    reason: clean(form.reason),
    notes: clean(form.notes),
    lines: form.lines.map((line) => ({
      product: line.product,
      effect: line.effect,
      sourceWarehouse: lineRequiresSource(line.effect)
        ? line.sourceWarehouse || null
        : null,
      sourceLocation: lineRequiresSource(line.effect)
        ? line.sourceLocation || null
        : null,
      destinationWarehouse: lineRequiresDestination(line.effect)
        ? line.destinationWarehouse || null
        : null,
      destinationLocation: lineRequiresDestination(line.effect)
        ? line.destinationLocation || null
        : null,
      quantity: Number(line.quantity),
      requestedUnitCost: Number(
        line.requestedUnitCost || 0
      ),
      lotNumber: clean(line.lotNumber).toUpperCase(),
      serialNumbers: parseSerialNumbers(
        line.serialNumbersText
      ),
      manufactureDate: line.manufactureDate || null,
      expiryDate: line.expiryDate || null,
      note: clean(line.note),
    })),
  })

  const saveMovement = async (event) => {
    event.preventDefault()
    setFormError("")

    const validationError = validateForm()

    if (validationError) {
      return setFormError(validationError)
    }

    if (submitMode === "draft" && !canManage) {
      return setFormError(
        "You do not have permission to save movement drafts."
      )
    }

    if (submitMode === "post" && !canPost) {
      return setFormError(
        "You do not have permission to post stock movements."
      )
    }

    const payload = buildPayload()
    setSaving(true)

    try {
      if (formModal.item?._id) {
        await api(
          `/inventory/stock-movements/${formModal.item._id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        )

        if (submitMode === "post") {
          await api(
            `/inventory/stock-movements/${formModal.item._id}/post`,
            {
              method: "POST",
              body: JSON.stringify({}),
            }
          )
        }
      } else if (submitMode === "post") {
        await api("/inventory/stock-movements/post", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      } else {
        await api("/inventory/stock-movements", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }

      toast.success(
        submitMode === "post"
          ? "Stock movement posted"
          : formModal.item
            ? "Movement draft updated"
            : "Movement draft created"
      )

      setFormModal({
        open: false,
        item: null,
      })
      setForm(emptyMovementForm())
      setFormError("")
      setShowAdvanced(false)

      await Promise.all([loadMovements(), loadSummary()])
    } catch (error) {
      setFormError(
        error.message || "Failed to save stock movement."
      )
    } finally {
      setSaving(false)
    }
  }

  const openDetailsModal = async (movement) => {
    setLoadingDetailsId(movement._id)

    try {
      const data = await api(
        `/inventory/stock-movements/${movement._id}`
      )

      setDetailsModal({
        open: true,
        movement: data.movement,
      })
    } catch (error) {
      toast.error(
        error.message || "Failed to load movement details"
      )
    } finally {
      setLoadingDetailsId("")
    }
  }

  const postMovement = async (movement) => {
    const confirmed = window.confirm(
      `Post movement "${movement.movementNo}"? Posting changes live stock balances and cannot be edited afterward.`
    )

    if (!confirmed) return

    setActionState({
      id: movement._id,
      type: "post",
    })

    try {
      await api(
        `/inventory/stock-movements/${movement._id}/post`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      )

      toast.success("Stock movement posted")
      await Promise.all([loadMovements(), loadSummary()])
    } catch (error) {
      toast.error(
        error.message || "Failed to post stock movement"
      )
    } finally {
      setActionState({
        id: "",
        type: "",
      })
    }
  }

  const openReasonModal = (type, movement) => {
    setReasonModal({
      open: true,
      type,
      movement,
      reason: "",
      error: "",
    })
  }

  const closeReasonModal = () => {
    if (saving) return

    setReasonModal({
      open: false,
      type: "",
      movement: null,
      reason: "",
      error: "",
    })
  }

  const submitReasonAction = async (event) => {
    event.preventDefault()

    const reason = clean(reasonModal.reason)
    const movement = reasonModal.movement

    if (!reason) {
      return setReasonModal((previous) => ({
        ...previous,
        error: `${
          previous.type === "cancel"
            ? "Cancellation"
            : "Reversal"
        } reason is required.`,
      }))
    }

    setSaving(true)

    try {
      await api(
        `/inventory/stock-movements/${movement._id}/${reasonModal.type}`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      )

      toast.success(
        reasonModal.type === "cancel"
          ? "Stock movement cancelled"
          : "Stock movement reversed with a compensating entry"
      )

      setReasonModal({
        open: false,
        type: "",
        movement: null,
        reason: "",
        error: "",
      })

      await Promise.all([loadMovements(), loadSummary()])
    } catch (error) {
      setReasonModal((previous) => ({
        ...previous,
        error:
          error.message ||
          `Failed to ${previous.type} stock movement.`,
      }))
    } finally {
      setSaving(false)
    }
  }

  const deleteMovement = async (movement) => {
    const confirmed = window.confirm(
      `Delete movement "${movement.movementNo}"? Only draft or cancelled non-reversal movements can be deleted.`
    )

    if (!confirmed) return

    setActionState({
      id: movement._id,
      type: "delete",
    })

    try {
      await api(
        `/inventory/stock-movements/${movement._id}`,
        {
          method: "DELETE",
        }
      )

      toast.success("Stock movement draft deleted")
      await Promise.all([loadMovements(), loadSummary()])
    } catch (error) {
      toast.error(
        error.message || "Failed to delete stock movement"
      )
    } finally {
      setActionState({
        id: "",
        type: "",
      })
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
                Stock Movements
              </h1>

              <p className="mt-0.5 text-sm text-gray-500">
                Create, review, post, cancel, and reverse controlled
                inventory transactions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={cn(button, ghostButton)}
              onClick={exportCsv}
              disabled={exportingCsv}
              type="button"
            >
              <Icon
                icon={RefreshIcon}
                className={cn(
                  "h-4 w-4",
                  exportingCsv ? "animate-spin" : "rotate-180"
                )}
              />
              {exportingCsv ? "Exporting..." : "Export CSV"}
            </button>

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

            {canCreate ? (
              <button
                className={cn(button, primaryButton)}
                onClick={openCreateModal}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                New Movement
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
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing{" "}
            <span className="text-gray-900">
              {movements.length}
            </span>{" "}
            movements
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      <SummaryCards summary={summary} onSelectTab={switchTab} canViewCost={canViewCost} />

      {!canManage && !canPost ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only movement access. Draft, posting,
          cancellation, reversal, and deletion controls depend on
          their individual permissions.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {[
            ["all", "All", FolderLibraryIcon],
            ["draft", "Drafts", Edit02Icon],
            ["posted", "Posted", Tick02Icon],
            ["reversed", "Reversed", RefreshIcon],
            ["cancelled", "Cancelled", Cancel01Icon],
          ].map(([key, label, icon]) => (
            <button
              key={key}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm",
                activeTab === key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => switchTab(key)}
              type="button"
            >
              <Icon icon={icon} className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <MovementList
        movements={movements}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        openingMovementId={openingMovementId}
        loadingDetailsId={loadingDetailsId}
        actionState={actionState}
        canViewCost={canViewCost}
        onView={openDetailsModal}
        onEdit={openEditModal}
        onPost={postMovement}
        onCancel={(movement) =>
          openReasonModal("cancel", movement)
        }
        onReverse={(movement) =>
          openReasonModal("reverse", movement)
        }
        onDelete={deleteMovement}
        onLoadMore={() => loadMovements({ append: true })}
        canManage={canManage}
        canPost={canPost}
        canReverse={canReverse}
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
        selectedProductName={selectedProductName}
        selectedWarehouseName={selectedWarehouseName}
      />

      <MovementFormModal
        state={formModal}
        form={form}
        setForm={setForm}
        products={products}
        productMap={productMap}
        warehouses={warehouses}
        locationsByWarehouse={locationsByWarehouse}
        error={formError}
        saving={saving}
        submitMode={submitMode}
        setSubmitMode={setSubmitMode}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        canManage={canManage}
        canPost={canPost}
        onClose={closeFormModal}
        onSubmit={saveMovement}
        onMovementTypeChange={updateMovementType}
        onLineChange={updateLine}
        onLineEffectChange={changeLineEffect}
        onLineProductChange={changeLineProduct}
        onLineWarehouseChange={changeLineWarehouse}
        onAddLine={addLine}
        onDuplicateLine={duplicateLine}
        onRemoveLine={removeLine}
      />

      <MovementDetailsModal
        state={detailsModal}
        canViewCost={canViewCost}
        onClose={() =>
          setDetailsModal({
            open: false,
            movement: null,
          })
        }
      />

      <ReasonModal
        state={reasonModal}
        setState={setReasonModal}
        saving={saving}
        onClose={closeReasonModal}
        onSubmit={submitReasonAction}
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
  selectedProductName,
  selectedWarehouseName,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Movement filters"
      subtitle="Filter movements by document type, source, product, warehouse, and date."
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
        <Field label="Status">
          <select
            className={input}
            value={activeTab}
            onChange={(event) =>
              updateFilter("__tab", event.target.value)
            }
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>

        <Field label="Movement Type">
          <select
            className={input}
            value={filters.movementType}
            onChange={(event) =>
              updateFilter("movementType", event.target.value)
            }
          >
            <option value="all">All movement types</option>

            {FILTER_MOVEMENT_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Source Type"
          hint="Exact source type, such as manual or stock_adjustment."
        >
          <FocusPlaceholderInput
            className={input}
            value={filters.sourceType}
            onChange={(event) =>
              updateFilter("sourceType", event.target.value)
            }
            placeholder="Example: manual"
          />
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input
              className={input}
              type="date"
              value={filters.from}
              onChange={(event) =>
                updateFilter("from", event.target.value)
              }
            />
          </Field>

          <Field label="To">
            <input
              className={input}
              type="date"
              value={filters.to}
              onChange={(event) =>
                updateFilter("to", event.target.value)
              }
            />
          </Field>
        </div>

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
          />
        </div>
      </div>
    </ModalShell>
  )
}

function MovementList({
  movements,
  loading,
  loadingMore,
  hasMore,
  openingMovementId,
  loadingDetailsId,
  actionState,
  canViewCost = true,
  onView,
  onEdit,
  onPost,
  onCancel,
  onReverse,
  onDelete,
  onLoadMore,
  canManage,
  canPost,
  canReverse,
  canDelete,
}) {
  return (
    <div>
      <div className={cn(card, "overflow-hidden")}>
        <div className="hidden max-h-[680px] overflow-auto xl:block">
          <table className="min-w-[1480px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Movement</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Products</th>
                <th className="px-5 py-3">Route</th>
                <th className="px-5 py-3">Lines</th>
                <th className="px-5 py-3">Quantity</th>
                <th className="px-5 py-3">Value</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {movements.map((movement) => (
                <tr
                  key={movement._id}
                  className="group bg-white transition hover:bg-gray-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="min-w-[210px]">
                      <p className="text-sm font-black text-indigo-700">
                        {movement.movementNo}
                      </p>

                      <p className="mt-0.5 max-w-[230px] truncate text-xs font-semibold text-gray-500">
                        {movement.reason || "No reason recorded"}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatDate(movement.movementDate, true)}
                  </td>

                  <td className="px-5 py-4">
                    <MovementTypeBadge
                      value={movement.movementType}
                    />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {movement.reference || "-"}
                  </td>

                  <td className="px-5 py-4">
                    <ProductSummary products={movement.products} />
                  </td>

                  <td className="px-5 py-4">
                    <p className="max-w-[220px] truncate text-sm font-semibold text-gray-700">
                      {sourceDestinationSummary(movement)}
                    </p>
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatNumber(movement.lineCount, 0)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatNumber(movement.totalQuantity)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-900">
                    {canViewCost
                      ? formatMoney(
                          movement.totalValue,
                          movement.currency
                        )
                      : "—"}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {pretty(movement.sourceType || "manual")}
                  </td>

                  <td className="px-5 py-4">
                    <MovementStatusBadge value={movement.status} />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                    {formatDate(movement.updatedAt, true)}
                  </td>

                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                    <MovementActions
                      movement={movement}
                      opening={
                        String(openingMovementId) ===
                        String(movement._id)
                      }
                      loadingDetails={
                        String(loadingDetailsId) ===
                        String(movement._id)
                      }
                      actionState={actionState}
                      onView={onView}
                      onEdit={onEdit}
                      onPost={onPost}
                      onCancel={onCancel}
                      onReverse={onReverse}
                      onDelete={onDelete}
                      canManage={canManage}
                      canPost={canPost}
                      canReverse={canReverse}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))}

              {!movements.length ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-5 py-14 text-center text-sm font-bold text-gray-500"
                  >
                    {loading
                      ? "Loading stock movements..."
                      : "No stock movements found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 xl:hidden">
          {movements.map((movement) => (
            <MovementMobileCard
              key={movement._id}
              movement={movement}
              canViewCost={canViewCost}
              opening={
                String(openingMovementId) === String(movement._id)
              }
              loadingDetails={
                String(loadingDetailsId) === String(movement._id)
              }
              actionState={actionState}
              onView={onView}
              onEdit={onEdit}
              onPost={onPost}
              onCancel={onCancel}
              onReverse={onReverse}
              onDelete={onDelete}
              canManage={canManage}
              canPost={canPost}
              canReverse={canReverse}
              canDelete={canDelete}
            />
          ))}

          {!movements.length ? (
            <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
              {loading
                ? "Loading stock movements..."
                : "No stock movements found."}
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

function ProductSummary({ products = [] }) {
  if (!products.length) {
    return (
      <span className="text-sm font-semibold text-gray-500">
        No products
      </span>
    )
  }

  return (
    <div className="min-w-[180px]">
      <p className="truncate text-sm font-black text-gray-800">
        {products[0]?.name || "Product"}
      </p>

      <p className="mt-0.5 text-xs font-semibold text-gray-500">
        {products.length === 1
          ? products[0]?.sku || "-"
          : `+${products.length - 1} more products`}
      </p>
    </div>
  )
}

function MovementMobileCard({
  movement,
  opening,
  loadingDetails,
  actionState,
  canViewCost = true,
  onView,
  onEdit,
  onPost,
  onCancel,
  onReverse,
  onDelete,
  canManage,
  canPost,
  canReverse,
  canDelete,
}) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 px-2 text-center text-[10px] font-black text-indigo-700">
          SM
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-indigo-700">
                {movement.movementNo}
              </h3>

              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                {formatDate(movement.movementDate, true)}
              </p>
            </div>

            <MovementStatusBadge value={movement.status} />
          </div>

          <div className="mt-2">
            <MovementTypeBadge value={movement.movementType} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <div>
              <p className="font-bold text-gray-400">Reference</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {movement.reference || "-"}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Source</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {pretty(movement.sourceType || "manual")}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Lines</p>
              <p className="mt-1 font-black text-gray-700">
                {formatNumber(movement.lineCount, 0)}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Quantity</p>
              <p className="mt-1 font-black text-gray-700">
                {formatNumber(movement.totalQuantity)}
              </p>
            </div>

            <div className="col-span-2">
              <p className="font-bold text-gray-400">Route</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {sourceDestinationSummary(movement)}
              </p>
            </div>

            <div className="col-span-2">
              <p className="font-bold text-gray-400">Value</p>
              <p className="mt-1 font-black text-gray-900">
                {canViewCost
                  ? formatMoney(
                      movement.totalValue,
                      movement.currency
                    )
                  : "—"}
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <MovementActions
              movement={movement}
              opening={opening}
              loadingDetails={loadingDetails}
              actionState={actionState}
              onView={onView}
              onEdit={onEdit}
              onPost={onPost}
              onCancel={onCancel}
              onReverse={onReverse}
              onDelete={onDelete}
              canManage={canManage}
              canPost={canPost}
              canReverse={canReverse}
              canDelete={canDelete}
              mobile
            />
          </div>
        </div>
      </div>
    </article>
  )
}

function MovementActions({
  movement,
  opening,
  loadingDetails,
  actionState,
  onView,
  onEdit,
  onPost,
  onCancel,
  onReverse,
  onDelete,
  canManage,
  canPost,
  canReverse,
  canDelete,
  mobile = false,
}) {
  const actionLoading =
    String(actionState.id) === String(movement._id)

  const canDeleteMovement =
    canDelete &&
    ["draft", "cancelled"].includes(movement.status) &&
    !movement.reversalOf

  const canReverseMovement =
    canReverse &&
    movement.status === "posted" &&
    !movement.reversalOf &&
    !movement.reversedBy

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
        onClick={() => onView(movement)}
        disabled={loadingDetails}
        type="button"
        title="View movement"
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

      {movement.status === "draft" && canManage ? (
        <button
          className={cn(
            button,
            ghostButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onEdit(movement)}
          disabled={opening}
          type="button"
          title="Edit movement draft"
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
      ) : null}

      {movement.status === "draft" && canPost ? (
        <button
          className={cn(
            button,
            successButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onPost(movement)}
          disabled={actionLoading}
          type="button"
          title="Post movement"
        >
          <Icon
            icon={actionLoading ? RefreshIcon : Tick02Icon}
            className={cn(
              "h-4 w-4",
              actionLoading ? "animate-spin" : ""
            )}
          />
          {mobile ? "Post" : null}
        </button>
      ) : null}

      {movement.status === "draft" && canManage ? (
        <button
          className={cn(
            button,
            warningButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onCancel(movement)}
          type="button"
          title="Cancel movement"
        >
          <Icon icon={Cancel01Icon} className="h-4 w-4" />
          {mobile ? "Cancel" : null}
        </button>
      ) : null}

      {canReverseMovement ? (
        <button
          className={cn(
            button,
            warningButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onReverse(movement)}
          type="button"
          title="Reverse posted movement"
        >
          <Icon icon={RefreshIcon} className="h-4 w-4" />
          {mobile ? "Reverse" : null}
        </button>
      ) : null}

      {canDeleteMovement ? (
        <button
          className={cn(
            button,
            dangerButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onDelete(movement)}
          disabled={actionLoading}
          type="button"
          title="Delete movement draft"
        >
          <Icon
            icon={actionLoading ? RefreshIcon : Archive02Icon}
            className={cn(
              "h-4 w-4",
              actionLoading ? "animate-spin" : ""
            )}
          />
          {mobile ? "Delete" : null}
        </button>
      ) : null}
    </div>
  )
}

function MovementFormModal({
  state,
  form,
  setForm,
  products,
  productMap,
  warehouses,
  locationsByWarehouse,
  error,
  saving,
  submitMode,
  setSubmitMode,
  showAdvanced,
  setShowAdvanced,
  canManage,
  canPost,
  onClose,
  onSubmit,
  onMovementTypeChange,
  onLineChange,
  onLineEffectChange,
  onLineProductChange,
  onLineWarehouseChange,
  onAddLine,
  onDuplicateLine,
  onRemoveLine,
}) {
  const estimatedValue = movementEstimatedValue(form.lines)
  const totalQuantity = form.lines.reduce(
    (total, line) => total + Number(line.quantity || 0),
    0
  )

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={
        state.item ? "Update movement draft" : "New stock movement"
      }
      subtitle={
        state.item
          ? state.item.movementNo
          : "Prepare a controlled inventory movement document."
      }
      icon={
        <Icon
          icon={state.item ? Edit02Icon : Add01Icon}
          className="h-5 w-5"
        />
      }
      maxWidthClass="max-w-[1500px]"
      footer={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-black text-gray-600">
              {form.lines.length} line
              {form.lines.length === 1 ? "" : "s"}
            </span>

            <span className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">
              Qty {formatNumber(totalQuantity)}
            </span>

            <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
              Est. {formatMoney(estimatedValue, form.currency)}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              className={cn(button, ghostButton)}
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            {canManage ? (
              <button
                className={cn(
                  button,
                  submitMode === "draft"
                    ? primaryButton
                    : ghostButton
                )}
                type="submit"
                form="stock-movement-form"
                onClick={() => setSubmitMode("draft")}
                disabled={saving}
              >
                <Icon
                  icon={saving ? RefreshIcon : FloppyDiskIcon}
                  className={cn(
                    "h-4 w-4",
                    saving && submitMode === "draft"
                      ? "animate-spin"
                      : ""
                  )}
                />
                {saving && submitMode === "draft"
                  ? "Saving..."
                  : state.item
                    ? "Update Draft"
                    : "Save Draft"}
              </button>
            ) : null}

            {canPost ? (
              <button
                className={cn(
                  button,
                  submitMode === "post"
                    ? primaryButton
                    : successButton
                )}
                type="submit"
                form="stock-movement-form"
                onClick={() => setSubmitMode("post")}
                disabled={saving}
              >
                <Icon
                  icon={saving ? RefreshIcon : Tick02Icon}
                  className={cn(
                    "h-4 w-4",
                    saving && submitMode === "post"
                      ? "animate-spin"
                      : ""
                  )}
                />
                {saving && submitMode === "post"
                  ? "Posting..."
                  : state.item
                    ? "Update & Post"
                    : "Save & Post"}
              </button>
            ) : null}
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

      <form id="stock-movement-form" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionCard
            title="Document information"
            description="Movement number is generated automatically by the server."
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Movement Date" required>
                <input
                  className={input}
                  type="datetime-local"
                  value={form.movementDate}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      movementDate: event.target.value,
                    }))
                  }
                  required
                />
              </Field>

              <Field label="Movement Type" required>
                <select
                  className={input}
                  value={form.movementType}
                  onChange={(event) =>
                    onMovementTypeChange(event.target.value)
                  }
                  required
                >
                  {MOVEMENT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Reference" hint="Optional">
                <FocusPlaceholderInput
                  className={input}
                  value={form.reference}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      reference: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Example: PO-2026-001"
                  maxLength={160}
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

              <Field label="Reason" hint="Optional">
                <FocusPlaceholderInput
                  className={input}
                  value={form.reason}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Short business reason"
                  maxLength={500}
                />
              </Field>

              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Notes" hint="Optional">
                  <FocusPlaceholderTextarea
                    className={cn(
                      input,
                      "min-h-[84px] resize-none"
                    )}
                    value={form.notes}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Add document-level notes..."
                    maxLength={3000}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                className="text-xs font-black text-indigo-700 hover:text-indigo-800"
              >
                {showAdvanced
                  ? "Hide integration fields"
                  : "Show integration fields"}
              </button>

              {showAdvanced ? (
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Field label="Source Type">
                    <FocusPlaceholderInput
                      className={input}
                      value={form.sourceType}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          sourceType: event.target.value.toLowerCase(),
                        }))
                      }
                      placeholder="Example: manual"
                      maxLength={80}
                    />
                  </Field>

                  <Field
                    label="Source ID"
                    hint="Optional valid backend document ID."
                  >
                    <FocusPlaceholderInput
                      className={input}
                      value={form.sourceId}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          sourceId: event.target.value,
                        }))
                      }
                      placeholder="Related document ObjectId"
                    />
                  </Field>

                  <Field
                    label="Idempotency Key"
                    hint="Prevents duplicate processing."
                  >
                    <FocusPlaceholderInput
                      className={input}
                      value={form.idempotencyKey}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          idempotencyKey: event.target.value,
                        }))
                      }
                      placeholder="Unique request key"
                      maxLength={180}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Movement lines"
            description="Each line must define a product, stock effect, quantity, and the required source or destination position."
            action={
              <button
                className={cn(button, ghostButton, "px-3 py-2")}
                type="button"
                onClick={onAddLine}
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Line
              </button>
            }
          >
            <div className="space-y-4">
              {form.lines.map((line, index) => (
                <MovementLineEditor
                  key={line.clientId}
                  line={line}
                  index={index}
                  products={products}
                  product={productMap.get(String(line.product))}
                  warehouses={warehouses}
                  locationsByWarehouse={locationsByWarehouse}
                  onChange={onLineChange}
                  onEffectChange={onLineEffectChange}
                  onProductChange={onLineProductChange}
                  onWarehouseChange={onLineWarehouseChange}
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

function MovementLineEditor({
  line,
  index,
  products,
  product,
  warehouses,
  locationsByWarehouse,
  onChange,
  onEffectChange,
  onProductChange,
  onWarehouseChange,
  onDuplicate,
  onRemove,
}) {
  const requiresSource = lineRequiresSource(line.effect)
  const requiresDestination = lineRequiresDestination(line.effect)
  const physical = isPhysicalEffect(line.effect)

  const sourceLocations =
    locationsByWarehouse[line.sourceWarehouse] || []

  const destinationLocations =
    locationsByWarehouse[line.destinationWarehouse] || []

  const serials = parseSerialNumbers(line.serialNumbersText)

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">
            {index + 1}
          </span>

          <div>
            <p className="text-sm font-black text-gray-900">
              Movement Line
            </p>

            <p className="text-xs font-semibold text-gray-500">
              {product
                ? relationLabel(product)
                : "Select a product"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={cn(button, ghostButton, "px-3 py-2")}
            type="button"
            onClick={() => onDuplicate(line)}
          >
            <Icon icon={Add01Icon} className="h-4 w-4" />
            Duplicate
          </button>

          <button
            className={cn(button, dangerButton, "px-3 py-2")}
            type="button"
            onClick={() => onRemove(line.clientId)}
          >
            <Icon icon={Cancel01Icon} className="h-4 w-4" />
            Remove
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Product" required>
          <select
            className={input}
            value={line.product}
            onChange={(event) =>
              onProductChange(line.clientId, event.target.value)
            }
            required
          >
            <option value="">Select product</option>

            {line.product &&
            !products.some(
              (item) =>
                String(item._id) === String(line.product)
            ) ? (
              <option value={line.product}>Current product</option>
            ) : null}

            {products.map((item) => (
              <option key={item._id} value={item._id}>
                {relationLabel(item)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Stock Effect" required>
          <select
            className={input}
            value={line.effect}
            onChange={(event) =>
              onEffectChange(line.clientId, event.target.value)
            }
            required
          >
            {STOCK_EFFECTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity" required>
          <FocusPlaceholderInput
            className={input}
            type="number"
            min="0.000001"
            step={
              product?.trackingType === "serial"
                ? "1"
                : "0.000001"
            }
            value={line.quantity}
            onChange={(event) =>
              onChange(
                line.clientId,
                "quantity",
                event.target.value
              )
            }
            placeholder="Example: 10"
            required
          />
        </Field>

        <Field
          label="Requested Unit Cost"
          hint={
            physical
              ? "Used for incoming valuation; outgoing cost is resolved from stock."
              : "Non-physical effects post zero value."
          }
        >
          <FocusPlaceholderInput
            className={input}
            type="number"
            min="0"
            step="0.0001"
            value={line.requestedUnitCost}
            onChange={(event) =>
              onChange(
                line.clientId,
                "requestedUnitCost",
                event.target.value
              )
            }
            placeholder="Example: 250"
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PositionEditor
          title="Source position"
          required={requiresSource}
          enabled={requiresSource}
          warehouse={line.sourceWarehouse}
          location={line.sourceLocation}
          warehouses={warehouses}
          locations={sourceLocations}
          onWarehouseChange={(value) =>
            onWarehouseChange(
              line.clientId,
              "sourceWarehouse",
              value
            )
          }
          onLocationChange={(value) =>
            onChange(line.clientId, "sourceLocation", value)
          }
        />

        <PositionEditor
          title="Destination position"
          required={requiresDestination}
          enabled={requiresDestination}
          warehouse={line.destinationWarehouse}
          location={line.destinationLocation}
          warehouses={warehouses}
          locations={destinationLocations}
          onWarehouseChange={(value) =>
            onWarehouseChange(
              line.clientId,
              "destinationWarehouse",
              value
            )
          }
          onLocationChange={(value) =>
            onChange(
              line.clientId,
              "destinationLocation",
              value
            )
          }
        />
      </div>

      {physical ? (
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {product?.trackingType === "batch" ? (
              <Field label="Lot Number" required>
                <FocusPlaceholderInput
                  className={input}
                  value={line.lotNumber}
                  onChange={(event) =>
                    onChange(
                      line.clientId,
                      "lotNumber",
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="Example: LOT-2026-001"
                  maxLength={120}
                  required
                />
              </Field>
            ) : null}

            {product?.trackingType === "serial" ? (
              <div className="md:col-span-2">
                <Field
                  label="Serial Numbers"
                  required
                  hint={`${serials.length} serial${
                    serials.length === 1 ? "" : "s"
                  } entered. Use commas or one value per line.`}
                >
                  <FocusPlaceholderTextarea
                    className={cn(
                      input,
                      "min-h-[110px] resize-y"
                    )}
                    value={line.serialNumbersText}
                    onChange={(event) =>
                      onChange(
                        line.clientId,
                        "serialNumbersText",
                        event.target.value
                      )
                    }
                    placeholder="SERIAL-001&#10;SERIAL-002"
                    required
                  />
                </Field>
              </div>
            ) : null}

            <Field label="Manufacture Date">
              <input
                className={input}
                type="date"
                value={line.manufactureDate}
                onChange={(event) =>
                  onChange(
                    line.clientId,
                    "manufactureDate",
                    event.target.value
                  )
                }
              />
            </Field>

            <Field label="Expiry Date">
              <input
                className={input}
                type="date"
                value={line.expiryDate}
                onChange={(event) =>
                  onChange(
                    line.clientId,
                    "expiryDate",
                    event.target.value
                  )
                }
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <Field label="Line Note" hint="Optional">
          <FocusPlaceholderInput
            className={input}
            value={line.note}
            onChange={(event) =>
              onChange(
                line.clientId,
                "note",
                event.target.value
              )
            }
            placeholder="Add a note for this line..."
            maxLength={1000}
          />
        </Field>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 lg:min-w-[210px]">
          <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">
            Estimated Line Value
          </p>

          <p className="mt-1 text-lg font-black text-indigo-700">
            {formatMoney(estimatedLineValue(line))}
          </p>
        </div>
      </div>
    </article>
  )
}

function PositionEditor({
  title,
  required,
  enabled,
  warehouse,
  location,
  warehouses,
  locations,
  onWarehouseChange,
  onLocationChange,
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        enabled
          ? "border-indigo-100 bg-indigo-50/30"
          : "border-gray-100 bg-gray-50 opacity-60"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-black text-gray-900">
          {title}
          {required ? <RequiredMark /> : null}
        </p>

        <span className="text-xs font-black text-gray-400">
          {enabled ? "Required by effect" : "Not used"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Warehouse" required={required}>
          <select
            className={input}
            value={warehouse}
            onChange={(event) =>
              onWarehouseChange(event.target.value)
            }
            disabled={!enabled}
            required={required}
          >
            <option value="">Select warehouse</option>

            {warehouse &&
            !warehouses.some(
              (item) => String(item._id) === String(warehouse)
            ) ? (
              <option value={warehouse}>Current warehouse</option>
            ) : null}

            {warehouses.map((item) => (
              <option key={item._id} value={item._id}>
                {relationLabel(item)}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Location"
          hint="Optional warehouse-level position."
        >
          <select
            className={input}
            value={location}
            onChange={(event) =>
              onLocationChange(event.target.value)
            }
            disabled={!enabled || !warehouse}
          >
            <option value="">No location</option>

            {location &&
            !locations.some(
              (item) => String(item._id) === String(location)
            ) ? (
              <option value={location}>Current location</option>
            ) : null}

            {locations.map((item) => (
              <option key={item._id} value={item._id}>
                {relationLabel(item)}
                {item.isQuarantine ? " — Quarantine" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  )
}

function MovementDetailsModal({ state, onClose, canViewCost = true }) {
  const movement = state.movement

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={movement?.movementNo || "Movement details"}
      subtitle={
        movement
          ? `${pretty(movement.movementType)} · ${formatDate(
              movement.movementDate,
              true
            )}`
          : ""
      }
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-[1500px]"
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
      {movement ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {[
              ["Status", <MovementStatusBadge value={movement.status} />],
              ["Lines", formatNumber(movement.lineCount, 0)],
              ["Quantity", formatNumber(movement.totalQuantity)],
              [
                "Value",
                canViewCost
                  ? formatMoney(movement.totalValue, movement.currency)
                  : "—",
              ],
              ["Reference", movement.reference || "-"],
              ["Source", pretty(movement.sourceType || "manual")],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  {label}
                </p>

                <div className="mt-2 text-lg font-black text-gray-900">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Document information">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Movement type"
                  value={
                    <MovementTypeBadge
                      value={movement.movementType}
                    />
                  }
                />
                <DetailRow
                  label="Movement date"
                  value={formatDate(movement.movementDate, true)}
                />
                <DetailRow
                  label="Currency"
                  value={movement.currency || "BDT"}
                />
                <DetailRow
                  label="Reason"
                  value={movement.reason || "-"}
                />
                <DetailRow
                  label="Created by"
                  value={relationLabel(
                    movement.createdBy,
                    "System"
                  )}
                />
                <DetailRow
                  label="Posted by"
                  value={relationLabel(
                    movement.postedBy,
                    "Not posted"
                  )}
                />
              </div>
            </SectionCard>

            <SectionCard title="Lifecycle">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Posted at"
                  value={formatDate(movement.postedAt, true)}
                />
                <DetailRow
                  label="Cancelled at"
                  value={formatDate(movement.cancelledAt, true)}
                />
                <DetailRow
                  label="Cancellation reason"
                  value={movement.cancellationReason || "-"}
                />
                <DetailRow
                  label="Reversal of"
                  value={
                    movement.reversalOf?.movementNo ||
                    (movement.reversalOf ? String(movement.reversalOf) : "-")
                  }
                />
                <DetailRow
                  label="Reversed by"
                  value={
                    movement.reversedBy?.movementNo ||
                    (movement.reversedBy ? String(movement.reversedBy) : "-")
                  }
                />
                <DetailRow
                  label="Updated"
                  value={formatDate(movement.updatedAt, true)}
                />
              </div>
            </SectionCard>
          </div>

          {movement.notes ? (
            <SectionCard title="Notes">
              <p className="text-sm font-semibold leading-6 text-gray-600">
                {movement.notes}
              </p>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Movement lines"
            description="Applied costs and balance snapshots are filled when the movement is posted."
          >
            <MovementDetailLines
              lines={movement.lines || []}
              currency={movement.currency}
              canViewCost={canViewCost}
            />
          </SectionCard>
        </div>
      ) : null}
    </ModalShell>
  )
}

function MovementDetailLines({ lines, currency, canViewCost = true }) {
  return (
    <div>
      <div className="hidden overflow-auto xl:block">
        <table className="min-w-[1500px] w-full text-left">
          <thead className="bg-white text-xs font-black uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Effect</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Requested Cost</th>
              <th className="px-4 py-3">Applied Cost</th>
              <th className="px-4 py-3">Applied Value</th>
              <th className="px-4 py-3">Tracking</th>
              <th className="px-4 py-3">Balance After</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {lines.map((line, index) => (
              <tr key={line._id || index}>
                <td className="px-4 py-4">
                  <p className="min-w-[210px] text-sm font-black text-gray-900">
                    {line.product?.name || "Unknown product"}
                  </p>

                  <p className="mt-0.5 text-xs font-semibold text-gray-500">
                    {line.product?.sku || "-"}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <EffectBadge value={line.effect} />
                </td>

                <td className="px-4 py-4">
                  <PositionLabel
                    warehouse={line.sourceWarehouse}
                    location={line.sourceLocation}
                  />
                </td>

                <td className="px-4 py-4">
                  <PositionLabel
                    warehouse={line.destinationWarehouse}
                    location={line.destinationLocation}
                  />
                </td>

                <td className="px-4 py-4 text-sm font-black text-gray-800">
                  {formatNumber(line.quantity)}
                </td>

                <td className="px-4 py-4 text-sm font-black text-gray-700">
                  {canViewCost
                    ? formatMoney(line.requestedUnitCost, currency)
                    : "—"}
                </td>

                <td className="px-4 py-4 text-sm font-black text-gray-700">
                  {canViewCost ? formatMoney(line.appliedUnitCost, currency) : "—"}
                </td>

                <td className="px-4 py-4 text-sm font-black text-gray-900">
                  {canViewCost ? formatMoney(line.appliedValue, currency) : "—"}
                </td>

                <td className="px-4 py-4">
                  <p className="min-w-[170px] text-xs font-semibold text-gray-600">
                    {line.lotNumber
                      ? `Lot: ${line.lotNumber}`
                      : line.serialNumbers?.length
                        ? `${line.serialNumbers.length} serials`
                        : "No tracking data"}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <BalanceSnapshot
                    snapshot={
                      line.destinationBalanceAfter ||
                      line.sourceBalanceAfter
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 xl:hidden">
        {lines.map((line, index) => (
          <div
            key={line._id || index}
            className="rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-gray-900">
                  {line.product?.name || "Unknown product"}
                </p>

                <p className="mt-0.5 text-xs font-semibold text-gray-500">
                  {line.product?.sku || "-"}
                </p>
              </div>

              <EffectBadge value={line.effect} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <ReadOnlyValue
                label="Quantity"
                value={formatNumber(line.quantity)}
              />
              <ReadOnlyValue
                label="Applied Value"
                value={canViewCost ? formatMoney(line.appliedValue, currency) : "—"}
              />
              <ReadOnlyValue
                label="Source"
                value={
                  <PositionLabel
                    warehouse={line.sourceWarehouse}
                    location={line.sourceLocation}
                  />
                }
              />
              <ReadOnlyValue
                label="Destination"
                value={
                  <PositionLabel
                    warehouse={line.destinationWarehouse}
                    location={line.destinationLocation}
                  />
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PositionLabel({ warehouse, location }) {
  if (!warehouse) {
    return (
      <span className="text-sm font-semibold text-gray-400">
        Not used
      </span>
    )
  }

  return (
    <div className="min-w-[170px]">
      <p className="text-sm font-black text-gray-800">
        {warehouse.name || warehouse.code || "Warehouse"}
      </p>

      <p className="mt-0.5 text-xs font-semibold text-gray-500">
        {location?.name ||
          location?.code ||
          "Warehouse level"}
      </p>
    </div>
  )
}

function BalanceSnapshot({ snapshot }) {
  if (!snapshot) {
    return (
      <span className="text-xs font-semibold text-gray-400">
        Not posted
      </span>
    )
  }

  return (
    <div className="min-w-[190px] text-xs font-semibold text-gray-600">
      <p>
        On hand{" "}
        <span className="font-black text-gray-800">
          {formatNumber(snapshot.onHandQuantity)}
        </span>
      </p>
      <p className="mt-1">
        Available{" "}
        <span className="font-black text-gray-800">
          {formatNumber(snapshot.availableQuantity)}
        </span>
      </p>
      <p className="mt-1">
        Version{" "}
        <span className="font-black text-gray-800">
          {snapshot.stockVersion ?? 0}
        </span>
      </p>
    </div>
  )
}

function ReasonModal({
  state,
  setState,
  saving,
  onClose,
  onSubmit,
}) {
  const isCancel = state.type === "cancel"

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={
        isCancel
          ? "Cancel stock movement"
          : "Reverse stock movement"
      }
      subtitle={state.movement?.movementNo || ""}
      icon={
        <Icon
          icon={isCancel ? Cancel01Icon : RefreshIcon}
          className="h-5 w-5"
        />
      }
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button
            className={cn(button, ghostButton)}
            onClick={onClose}
            disabled={saving}
            type="button"
          >
            Close
          </button>

          <button
            className={cn(
              button,
              isCancel ? warningButton : dangerButton
            )}
            type="submit"
            form="movement-reason-form"
            disabled={saving}
          >
            <Icon
              icon={saving ? RefreshIcon : Tick02Icon}
              className={cn(
                "h-4 w-4",
                saving ? "animate-spin" : ""
              )}
            />
            {saving
              ? "Processing..."
              : isCancel
                ? "Cancel Movement"
                : "Create Reversal"}
          </button>
        </div>
      }
    >
      {state.error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          <Icon
            icon={Alert02Icon}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>{state.error}</span>
        </div>
      ) : null}

      <form id="movement-reason-form" onSubmit={onSubmit}>
        <div
          className={cn(
            "mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold",
            isCancel
              ? "border-amber-100 bg-amber-50 text-amber-800"
              : "border-rose-100 bg-rose-50 text-rose-800"
          )}
        >
          {isCancel
            ? "Cancellation is available only for draft movements and does not change stock."
            : "Reversal creates and posts a compensating movement. The original posted document remains in the audit trail."}
        </div>

        <Field
          label={isCancel ? "Cancellation Reason" : "Reversal Reason"}
          required
        >
          <FocusPlaceholderTextarea
            className={cn(input, "min-h-[130px] resize-none")}
            value={state.reason}
            onChange={(event) =>
              setState((previous) => ({
                ...previous,
                reason: event.target.value,
                error: "",
              }))
            }
            placeholder="Explain why this action is required..."
            maxLength={1000}
            required
          />
        </Field>
      </form>
    </ModalShell>
  )
}

function ReadOnlyValue({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <div className="mt-1 font-black text-gray-800">
        {value}
      </div>
    </div>
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
