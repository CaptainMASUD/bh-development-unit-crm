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
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const UNIT_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_UNIT_MANAGE || "inventory-unit:manage"

const UNIT_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_UNIT_DELETE || "inventory-unit:delete"

const UNIT_TYPES = [
  ["count", "Count"],
  ["weight", "Weight"],
  ["volume", "Volume"],
  ["length", "Length"],
  ["area", "Area"],
  ["time", "Time"],
  ["other", "Other"],
]

const UNIT_STATUSES = [
  ["active", "Active"],
  ["inactive", "Inactive"],
]

const emptyUnitForm = {
  name: "",
  code: "",
  symbol: "",
  unitType: "count",
  allowDecimal: false,
  decimalPlaces: "0",
  description: "",
  sortOrder: "0",
  status: "active",
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
      className={cn(
        "inline-block rounded-full border-2 border-current border-r-transparent animate-spin",
        className
      )}
      aria-hidden="true"
    />
  )
}

function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gray-200/80",
        className
      )}
      aria-hidden="true"
    />
  )
}

function UnitTableSkeleton({ rows = 7 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`unit-skeleton-${index}`}>
      <td className="border-b border-gray-100 px-5 py-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-3 w-52" />
        </div>
      </td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-20" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-8 w-14 rounded-xl" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-7 w-20 rounded-full" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-7 w-28 rounded-full" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-16" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-10" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-7 w-20 rounded-full" /></td>
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

function UnitMobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <div key={`unit-mobile-skeleton-${index}`} className="p-4">
      <div className="flex items-start gap-3">
        <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
            <SkeletonBlock className="h-7 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="h-7 w-24 rounded-full" />
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

function UnitTypeBadge({ value }) {
  const type = String(value || "").toLowerCase()

  const style =
    type === "count"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
      : type === "weight"
        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
        : type === "volume"
          ? "bg-sky-50 text-sky-700 ring-sky-100"
          : type === "length"
            ? "bg-violet-50 text-violet-700 ring-violet-100"
            : type === "area"
              ? "bg-amber-50 text-amber-700 ring-amber-100"
              : type === "time"
                ? "bg-rose-50 text-rose-700 ring-rose-100"
                : "bg-slate-100 text-slate-700 ring-slate-200"

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
  maxWidthClass = "max-w-4xl",
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

function HeaderSearchFilters({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  onOpenFilters,
}) {
  const chipCount = [
    activeTab === "current" && filters.status !== "all",
    filters.unitType !== "all",
    filters.allowDecimal !== "all",
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
            : "xl:min-w-[540px] xl:max-w-[78%] xl:flex-[0_1_78%]"
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

        {filters.unitType !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(filters.unitType)}
            onClear={() => updateFilter("unitType", "all")}
          />
        ) : null}

        {filters.allowDecimal !== "all" ? (
          <FilterChip
            label="Quantity"
            value={filters.allowDecimal === "true" ? "Decimal allowed" : "Whole numbers"}
            onClear={() => updateFilter("allowDecimal", "all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[120px] flex-[1_1_170px] border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 shadow-none outline-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ boxShadow: "none" }}
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search unit name, code or symbol..."
          type="text"
          aria-label="Search inventory units"
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-bold transition",
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

export default function InventoryUnitSetup() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, UNIT_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, UNIT_DELETE_PERMISSION)

  const [activeTab, setActiveTab] = useState("current")
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [modal, setModal] = useState({
    open: false,
    item: null,
  })

  const [form, setForm] = useState(emptyUnitForm)
  const [formError, setFormError] = useState("")

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    item: null,
  })

  const [actionState, setActionState] = useState({
    open: false,
    item: null,
    type: "",
    value: "",
    title: "",
    message: "",
    danger: false,
    loading: false,
    error: "",
  })

  const [actionBusy, setActionBusy] = useState({
    id: "",
    type: "",
  })

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    unitType: "all",
    allowDecimal: "all",
  })

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (clean(filters.q)) count += 1

    if (activeTab === "current" && filters.status !== "all") {
      count += 1
    }

    if (filters.unitType !== "all") count += 1
    if (filters.allowDecimal !== "all") count += 1

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
      unitType: "all",
      allowDecimal: "all",
    })
  }

  const loadUnits = async ({
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

      if (filters.unitType !== "all") {
        params.set("unitType", filters.unitType)
      }

      if (filters.allowDecimal !== "all") {
        params.set("allowDecimal", filters.allowDecimal)
      }

      if (append && nextCursor) {
        params.set("cursor", nextCursor)
      }

      const data = await api(
        `/inventory/units?${params.toString()}`,
        { signal }
      )

      const incomingUnits = data.units || []

      setUnits((previous) =>
        append ? [...previous, ...incomingUnits] : incomingUnits
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load inventory units")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  const refresh = async () => {
    await loadUnits()
  }

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      loadUnits({ signal: controller.signal })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.status,
    filters.unitType,
    filters.allowDecimal,
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
    setForm(emptyUnitForm)
    setModal({ open: true, item: null })
  }

  const openEditModal = (item) => {
    if (item.status === "archived") {
      toast.error("Restore the archived unit before editing it.")
      return
    }

    setFormError("")

    setForm({
      name: item.name || "",
      code: item.code || "",
      symbol: item.symbol || "",
      unitType: item.unitType || "count",
      allowDecimal: Boolean(item.allowDecimal),
      decimalPlaces: String(
        item.allowDecimal ? item.decimalPlaces ?? 2 : 0
      ),
      description: item.description || "",
      sortOrder: String(item.sortOrder ?? 0),
      status: item.status || "active",
    })

    setModal({ open: true, item })
  }

  const closeModal = () => {
    if (saving) return

    setFormError("")
    setModal({ open: false, item: null })
    setForm(emptyUnitForm)
  }

  const updateAllowDecimal = (allowDecimal) => {
    setForm((previous) => ({
      ...previous,
      allowDecimal,
      decimalPlaces: allowDecimal
        ? Number(previous.decimalPlaces || 0) >= 1
          ? previous.decimalPlaces
          : "2"
        : "0",
    }))
  }

  const saveUnit = async (event) => {
    event.preventDefault()
    setFormError("")

    const name = clean(form.name)
    const code = clean(form.code).toUpperCase()
    const symbol = clean(form.symbol)
    const decimalPlaces = Number(form.decimalPlaces)
    const sortOrder = Number(form.sortOrder)

    if (!name) {
      return setFormError("Unit name is required.")
    }

    if (!code) {
      return setFormError("Unit code is required.")
    }

    if (!symbol) {
      return setFormError("Unit symbol is required.")
    }

    if (
      !Number.isInteger(decimalPlaces) ||
      decimalPlaces < 0 ||
      decimalPlaces > 6
    ) {
      return setFormError(
        "Decimal places must be an integer between 0 and 6."
      )
    }

    if (!form.allowDecimal && decimalPlaces !== 0) {
      return setFormError(
        "Decimal places must be 0 when decimal quantities are not allowed."
      )
    }

    if (form.allowDecimal && decimalPlaces < 1) {
      return setFormError(
        "Decimal places must be at least 1 when decimal quantities are allowed."
      )
    }

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0 ||
      sortOrder > 1000000
    ) {
      return setFormError(
        "Sort order must be an integer between 0 and 1000000."
      )
    }

    const payload = {
      name,
      code,
      symbol,
      unitType: form.unitType,
      allowDecimal: Boolean(form.allowDecimal),
      decimalPlaces: form.allowDecimal ? decimalPlaces : 0,
      description: clean(form.description),
      sortOrder,
      status: form.status,
    }

    setSaving(true)

    try {
      await api(
        modal.item?._id
          ? `/inventory/units/${modal.item._id}`
          : "/inventory/units",
        {
          method: modal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      )

      toast.success(
        modal.item ? "Inventory unit updated" : "Inventory unit created"
      )

      setModal({ open: false, item: null })
      setForm(emptyUnitForm)
      setFormError("")
      await loadUnits()
    } catch (error) {
      setFormError(error.message || "Failed to save inventory unit.")
    } finally {
      setSaving(false)
    }
  }

  const openUnitDetails = (item) => {
    setDetailsModal({ open: true, item })
  }

  const openUnitAction = (type, item, value = "") => {
    const config =
      type === "status"
        ? {
            title: `Mark unit ${pretty(value).toLowerCase()}`,
            message: `Update "${item.name}" from ${pretty(item.status)} to ${pretty(value)}.`,
            danger: value === "inactive",
          }
        : type === "archive"
          ? {
              title: "Archive inventory unit",
              message:
                `Archive "${item.name}"? The unit can be restored later. ` +
                "Products already assigned to this unit may prevent the action until they are reassigned.",
              danger: true,
            }
          : {
              title: "Restore inventory unit",
              message: `Restore "${item.name}" as inactive so it can be reviewed before activation.`,
              danger: false,
            }

    setActionState({
      open: true,
      item,
      type,
      value,
      title: config.title,
      message: config.message,
      danger: config.danger,
      loading: false,
      error: "",
    })
  }

  const closeUnitAction = () => {
    if (actionState.loading) return
    setActionState({
      open: false,
      item: null,
      type: "",
      value: "",
      title: "",
      message: "",
      danger: false,
      loading: false,
      error: "",
    })
  }

  const confirmUnitAction = async () => {
    const item = actionState.item
    if (!item?._id) return

    setActionState((previous) => ({
      ...previous,
      loading: true,
      error: "",
    }))
    setActionBusy({ id: item._id, type: actionState.type })

    try {
      if (actionState.type === "status") {
        await api(`/inventory/units/${item._id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: actionState.value }),
        })
        toast.success(`Unit marked as ${pretty(actionState.value).toLowerCase()}`)
      } else if (actionState.type === "archive") {
        await api(`/inventory/units/${item._id}`, { method: "DELETE" })
        toast.success("Inventory unit archived")
      } else if (actionState.type === "restore") {
        await api(`/inventory/units/${item._id}/restore`, { method: "PATCH" })
        toast.success("Inventory unit restored as inactive")
      }

      setActionState({
        open: false,
        item: null,
        type: "",
        value: "",
        title: "",
        message: "",
        danger: false,
        loading: false,
        error: "",
      })
      await loadUnits({ showLoader: false })
    } catch (error) {
      setActionState((previous) => ({
        ...previous,
        loading: false,
        error: error.message || "Action failed",
      }))
    } finally {
      setActionBusy({ id: "", type: "" })
    }
  }

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

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
                Units
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
                Add Unit
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
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing{" "}
            <span className="text-gray-900">{units.length}</span>{" "}
            {activeTab === "archived" ? "archived units" : "units"}
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only unit access. Unit creation, editing,
          status changes, archiving, and restoration controls are
          hidden.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            {
              key: "current",
              label: "Current Units",
              icon: FolderLibraryIcon,
            },
            {
              key: "archived",
              label: "Archived",
              icon: Archive02Icon,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:px-4 sm:text-sm",
                activeTab === tab.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => switchTab(tab.key)}
              type="button"
            >
              <Icon icon={tab.icon} className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <UnitList
        units={units}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onView={openUnitDetails}
        onEdit={openEditModal}
        onAction={openUnitAction}
        actionBusy={actionBusy}
        onLoadMore={() => loadUnits({ append: true })}
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
      />

      <UnitFormModal
        open={modal.open}
        item={modal.item}
        form={form}
        setForm={setForm}
        error={formError}
        saving={saving}
        onClose={closeModal}
        onSubmit={saveUnit}
        onAllowDecimalChange={updateAllowDecimal}
      />

      <UnitDetailsModal
        state={detailsModal}
        onClose={() => setDetailsModal({ open: false, item: null })}
        onEdit={openEditModal}
        canManage={canManage}
      />

      <ConfirmUnitActionModal
        state={actionState}
        onClose={closeUnitAction}
        onConfirm={confirmUnitAction}
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
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Unit filters"
      subtitle="Filter inventory units by type, quantity precision, and status."
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
        {activeTab === "current" ? (
          <Field label="Status">
            <select
              className={input}
              value={filters.status}
              onChange={(event) =>
                updateFilter("status", event.target.value)
              }
            >
              <option value="all">Active + Inactive</option>

              {UNIT_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-sm font-black text-amber-800">
              Archived units
            </p>

            <p className="mt-1 text-xs font-semibold text-amber-700">
              This tab only displays archived unit records.
            </p>
          </div>
        )}

        <Field label="Unit Type">
          <select
            className={input}
            value={filters.unitType}
            onChange={(event) =>
              updateFilter("unitType", event.target.value)
            }
          >
            <option value="all">All unit types</option>

            {UNIT_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quantity Precision">
          <select
            className={input}
            value={filters.allowDecimal}
            onChange={(event) =>
              updateFilter("allowDecimal", event.target.value)
            }
          >
            <option value="all">Whole + Decimal</option>
            <option value="false">Whole numbers only</option>
            <option value="true">Decimal quantities allowed</option>
          </select>
        </Field>
      </div>
    </ModalShell>
  )
}

function UnitList({
  units,
  loading,
  loadingMore,
  hasMore,
  onView,
  onEdit,
  onAction,
  actionBusy,
  onLoadMore,
  canManage,
  canDelete,
}) {
  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="hidden h-[560px] overflow-auto md:block lg:h-[610px] xl:h-[650px]">
          <table className="min-w-[1050px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50/95 text-[11px] font-black uppercase tracking-wide text-gray-500 backdrop-blur">
              <tr>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Symbol</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Quantity</th>
                <th className="px-5 py-3">Precision</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="sticky right-0 bg-gray-50/95 px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <UnitTableSkeleton />
              ) : units.length ? (
                units.map((unit) => (
                  <tr key={unit._id} className="group bg-white transition hover:bg-indigo-50/30">
                    <td className="px-5 py-3.5">
                      <div className="min-w-[220px]">
                        <p className="truncate text-sm font-semibold text-gray-900">{unit.name}</p>
                        <p className="mt-0.5 max-w-[300px] truncate text-xs font-medium text-gray-500">
                          {unit.description || "No description"}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-indigo-700">{unit.code}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex min-w-10 justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-800">
                        {unit.symbol}
                      </span>
                    </td>
                    <td className="px-5 py-3.5"><UnitTypeBadge value={unit.unitType} /></td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1",
                        unit.allowDecimal
                          ? "bg-sky-50 text-sky-700 ring-sky-100"
                          : "bg-gray-100 text-gray-700 ring-gray-200"
                      )}>
                        {unit.allowDecimal ? "Decimal allowed" : "Whole numbers"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-700">
                      {unit.allowDecimal ? `${unit.decimalPlaces} places` : "0 places"}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-700">{unit.sortOrder ?? 0}</td>
                    <td className="px-5 py-3.5"><StatusBadge value={unit.status} /></td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-600">{formatDate(unit.updatedAt)}</td>
                    <td className="sticky right-0 bg-white px-5 py-3 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-indigo-50/30">
                      <UnitActions
                        unit={unit}
                        busy={String(actionBusy.id) === String(unit._id)}
                        onView={onView}
                        onEdit={onEdit}
                        onAction={onAction}
                        canManage={canManage}
                        canDelete={canDelete}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-3 text-sm font-bold text-gray-900">No inventory units found</p>
                    <p className="mt-1 text-sm font-medium text-gray-500">Create a unit or adjust the current filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <UnitMobileSkeleton />
          ) : units.length ? (
            units.map((unit) => (
              <UnitMobileCard
                key={unit._id}
                unit={unit}
                busy={String(actionBusy.id) === String(unit._id)}
                onView={onView}
                onEdit={onEdit}
                onAction={onAction}
                canManage={canManage}
                canDelete={canDelete}
              />
            ))
          ) : (
            <div className="px-5 py-14 text-center">
              <Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-900">No inventory units found</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 sm:px-5">
          <p className="text-xs font-medium text-gray-500">
            {units.length} unit{units.length === 1 ? "" : "s"} loaded
          </p>
          {hasMore ? (
            <button
              className={cn(button, ghostButton, "min-w-[126px] px-3 py-2")}
              onClick={onLoadMore}
              disabled={loadingMore}
              type="button"
            >
              {loadingMore ? <Spinner /> : <Icon icon={RefreshIcon} className="h-4 w-4" />}
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          ) : (
            <span className="text-xs font-medium text-gray-400">All units loaded</span>
          )}
        </div>
      </div>
    </div>
  )
}

function UnitMobileCard({
  unit,
  busy,
  onView,
  onEdit,
  onAction,
  canManage,
  canDelete,
}) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 px-2 text-center text-sm font-black text-indigo-700">
          {unit.symbol}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-gray-900">{unit.name}</h3>
              <p className="mt-0.5 text-xs font-semibold text-indigo-700">{unit.code}</p>
            </div>
            <StatusBadge value={unit.status} />
          </div>

          <div className="mt-2"><UnitTypeBadge value={unit.unitType} /></div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <MiniMetric label="Quantity" value={unit.allowDecimal ? "Decimal allowed" : "Whole only"} />
            <MiniMetric label="Precision" value={unit.allowDecimal ? `${unit.decimalPlaces} places` : "0 places"} />
            <MiniMetric label="Sort order" value={String(unit.sortOrder ?? 0)} />
            <MiniMetric
              label="Example"
              value={unit.allowDecimal
                ? `${Number(1.25).toFixed(Math.min(Number(unit.decimalPlaces || 2), 2))} ${unit.symbol}`
                : `1 ${unit.symbol}`}
            />
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <UnitActions
              unit={unit}
              busy={busy}
              onView={onView}
              onEdit={onEdit}
              onAction={onAction}
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

function UnitActions({
  unit,
  busy,
  onView,
  onEdit,
  onAction,
  canManage,
  canDelete,
  mobile = false,
}) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, transformOrigin: "top right" })
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const updateMenuPosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 250
    const gap = 8
    const estimatedHeight = 250
    const shouldOpenUp = window.innerHeight - rect.bottom < 230
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
  if (unit.status !== "archived") {
    if (canManage) {
      items.push(["edit", "Edit unit", Edit02Icon])
      UNIT_STATUSES.forEach(([status, label]) => {
        if (status !== unit.status) {
          items.push([`status-${status}`, `Mark ${label.toLowerCase()}`, Tick02Icon, status === "inactive" ? "warning" : undefined])
        }
      })
    }
    if (canDelete) items.push(["archive", "Archive unit", Archive02Icon, "danger"])
  } else if (canDelete) {
    items.push(["restore", "Restore unit", RestoreBinIcon])
  }

  const handleItem = (key) => {
    setOpen(false)
    if (key === "edit") return onEdit(unit)
    if (key.startsWith("status-")) return onAction("status", unit, key.replace("status-", ""))
    if (key === "archive") return onAction("archive", unit)
    if (key === "restore") return onAction("restore", unit)
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
          <div className="p-1.5">
            {items.length ? items.map(([key, label, icon, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleItem(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                  tone === "danger"
                    ? "text-rose-700 hover:bg-rose-50"
                    : tone === "warning"
                      ? "text-amber-700 hover:bg-amber-50"
                      : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon icon={icon} className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            )) : (
              <p className="px-3 py-2.5 text-sm font-medium text-gray-400">No additional actions</p>
            )}
          </div>
        </motion.div>,
        document.body
      )
    : null

  return (
    <div ref={rootRef} className={cn("flex items-center gap-2", mobile ? "justify-end" : "justify-end")}>
      <button
        className={cn(button, ghostButton, mobile ? "px-3 py-2" : "px-3 py-2")}
        onClick={() => onView(unit)}
        disabled={busy}
        type="button"
      >
        {busy ? <Spinner /> : <Icon icon={ViewIcon} className="h-4 w-4" />}
        <span>View</span>
      </button>

      {(canManage || canDelete) ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (busy) return
            setOpen((previous) => !previous)
          }}
          disabled={busy}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl font-black leading-none text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`More actions for ${unit.name}`}
        >
          ⋮
        </button>
      ) : null}

      {menu}
    </div>
  )
}

function UnitDetailsModal({ state, onClose, onEdit, canManage }) {
  const unit = state.item
  if (!unit) return null

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title="Unit details"
      subtitle={unit.code || ""}
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(button, ghostButton)} type="button" onClick={onClose}>Close</button>
          {canManage && unit.status !== "archived" ? (
            <button
              className={cn(button, primaryButton)}
              type="button"
              onClick={() => {
                onClose()
                onEdit(unit)
              }}
            >
              <Icon icon={Edit02Icon} className="h-4 w-4" />
              Edit
            </button>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Name" value={unit.name || "—"} />
        <DetailItem label="Code" value={unit.code || "—"} />
        <DetailItem label="Symbol" value={unit.symbol || "—"} />
        <DetailItem label="Type" value={pretty(unit.unitType)} />
        <DetailItem label="Decimal" value={unit.allowDecimal ? "Allowed" : "Whole numbers only"} />
        <DetailItem label="Precision" value={`${unit.decimalPlaces ?? 0} places`} />
        <DetailItem label="Sort Order" value={String(unit.sortOrder ?? 0)} />
        <DetailItem label="Status" value={pretty(unit.status)} />
        <DetailItem label="Updated" value={formatDate(unit.updatedAt)} />
        {clean(unit.description) ? (
          <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-gray-700">{unit.description}</p>
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

function ConfirmUnitActionModal({ state, onClose, onConfirm }) {
  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={state.title}
      subtitle={state.item?.name || ""}
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
      <p className="text-sm font-medium leading-6 text-gray-700">{state.message}</p>
    </ModalShell>
  )
}

function UnitFormModal({
  open,
  item,
  form,
  setForm,
  error,
  saving,
  onClose,
  onSubmit,
  onAllowDecimalChange,
}) {
  const previewQuantity = form.allowDecimal
    ? Number(1.25).toFixed(
        Math.min(Math.max(Number(form.decimalPlaces || 1), 1), 2)
      )
    : "1"

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update inventory unit" : "Add inventory unit"}
      subtitle={
        item
          ? form.name || "Edit unit information."
          : "Create a reusable quantity unit for products."
      }
      icon={
        <Icon
          icon={item ? Edit02Icon : Add01Icon}
          className="h-5 w-5"
        />
      }
      maxWidthClass="max-w-5xl"
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
            form="inventory-unit-form"
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
                ? "Update unit"
                : "Save unit"}
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

      <form id="inventory-unit-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Unit Name" required>
            <FocusPlaceholderInput
              className={input}
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Example: Kilogram"
              maxLength={100}
              required
            />
          </Field>

          <Field label="Unit Code" required>
            <FocusPlaceholderInput
              className={input}
              value={form.code}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="Example: KG"
              maxLength={30}
              required
            />
          </Field>

          <Field label="Symbol" required>
            <FocusPlaceholderInput
              className={input}
              value={form.symbol}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  symbol: event.target.value,
                }))
              }
              placeholder="Example: kg"
              maxLength={20}
              required
            />
          </Field>

          <Field label="Unit Type" required>
            <select
              className={input}
              value={form.unitType}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  unitType: event.target.value,
                }))
              }
              required
            >
              {UNIT_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sort Order" required>
            <FocusPlaceholderInput
              className={input}
              type="number"
              min="0"
              max="1000000"
              step="1"
              value={form.sortOrder}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  sortOrder: event.target.value,
                }))
              }
              placeholder="Example: 10"
              required
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
              {UNIT_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-gray-900">
                  Allow Decimal Quantities
                </p>

                <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                  Enable values such as 1.25 kg or 2.5 litres.
                </p>
              </div>

              <Toggle
                checked={Boolean(form.allowDecimal)}
                onChange={onAllowDecimalChange}
                label="Allow decimal quantities"
              />
            </div>
          </div>

          <Field
            label="Decimal Places"
            required={form.allowDecimal}
            hint={
              form.allowDecimal
                ? "Choose an integer from 1 to 6."
                : "Automatically set to 0 for whole-number units."
            }
          >
            <FocusPlaceholderInput
              className={input}
              type="number"
              min={form.allowDecimal ? "1" : "0"}
              max="6"
              step="1"
              value={form.decimalPlaces}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  decimalPlaces: event.target.value,
                }))
              }
              placeholder="Example: 2"
              disabled={!form.allowDecimal}
              required={form.allowDecimal}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Description" hint="Optional">
              <FocusPlaceholderTextarea
                className={cn(input, "min-h-[120px] resize-none")}
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Write a short explanation for this unit..."
                maxLength={1000}
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-indigo-500">
              Quantity preview
            </p>

            <p className="mt-2 text-2xl font-black text-indigo-700">
              {previewQuantity} {clean(form.symbol) || "unit"}
            </p>

            <p className="mt-1 text-xs font-semibold text-indigo-600">
              {form.allowDecimal
                ? `${form.decimalPlaces || 1} decimal place${
                    Number(form.decimalPlaces || 1) === 1 ? "" : "s"
                  }`
                : "Whole-number quantities only"}
            </p>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}
