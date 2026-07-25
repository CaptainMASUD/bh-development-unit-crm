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

const BRANCH_OPTIONS_PATH =
  import.meta.env.VITE_BRANCH_OPTIONS_PATH || ""

const MANAGER_OPTIONS_PATH =
  import.meta.env.VITE_WAREHOUSE_MANAGER_OPTIONS_PATH || ""

const EMPTY_OPTIONS = Object.freeze([])

const WAREHOUSE_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_WAREHOUSE_MANAGE ||
  "inventory-warehouse:manage"

const WAREHOUSE_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_WAREHOUSE_DELETE ||
  "inventory-warehouse:delete"

const WAREHOUSE_TYPES = [
  ["central", "Central"],
  ["regional", "Regional"],
  ["store", "Store"],
  ["distribution", "Distribution"],
  ["transit", "Transit"],
  ["returns", "Returns"],
  ["production", "Production"],
  ["virtual", "Virtual"],
  ["other", "Other"],
]

const WAREHOUSE_STATUSES = [
  ["active", "Active"],
  ["inactive", "Inactive"],
]

const emptyWarehouseForm = {
  name: "",
  code: "",
  warehouseType: "store",
  branch: "",
  manager: "",
  description: "",
  address: {
    addressLine1: "",
    addressLine2: "",
    area: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Bangladesh",
  },
  contactName: "",
  phone: "",
  email: "",
  timezone: "Asia/Dhaka",
  isDefault: false,
  allowNegativeStock: false,
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

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatNumber(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function formatAddress(address = {}) {
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.area,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter((value) => clean(value))

  return parts.join(", ") || "No address"
}

function extractCollection(data, keys = []) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key]
  }

  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data)) return data

  return []
}

function relationLabel(item, fallback = "Unnamed") {
  if (!item) return fallback

  const name =
    item.name ||
    item.employeeName ||
    item.branchName ||
    item.fullName ||
    item.email ||
    fallback

  const code =
    item.code ||
    item.employeeId ||
    item.branchCode ||
    ""

  return `${name}${code ? ` (${code})` : ""}`
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

function WarehouseTypeBadge({ value }) {
  const type = String(value || "").toLowerCase()

  const style =
    type === "central"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
      : type === "regional"
        ? "bg-violet-50 text-violet-700 ring-violet-100"
        : type === "store"
          ? "bg-sky-50 text-sky-700 ring-sky-100"
          : type === "distribution"
            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
            : type === "production"
              ? "bg-amber-50 text-amber-700 ring-amber-100"
              : type === "returns"
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

function BooleanBadge({ value, trueLabel, falseLabel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        value
          ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
          : "bg-gray-100 text-gray-600 ring-gray-200"
      )}
    >
      {value ? trueLabel : falseLabel}
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

function RelationSelect({
  value,
  onChange,
  options,
  emptyLabel,
  currentItem,
  disabled = false,
}) {
  const currentId = clean(value)
  const exists = options.some(
    (item) => String(item?._id) === String(currentId)
  )

  return (
    <select
      className={input}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      <option value="">{emptyLabel}</option>

      {currentId && !exists ? (
        <option value={currentId}>
          {relationLabel(currentItem, "Current assigned record")}
        </option>
      ) : null}

      {options.map((item) => (
        <option key={item._id} value={item._id}>
          {relationLabel(item)}
        </option>
      ))}
    </select>
  )
}

function ActiveFilterChips({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
  branchName,
}) {
  const hasFilters =
    clean(filters.q) ||
    (activeTab === "current" && filters.status !== "all") ||
    filters.warehouseType !== "all" ||
    filters.isDefault !== "all" ||
    filters.branch !== "all"

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {clean(filters.q) ? (
        <FilterChip
          label="Search"
          value={clean(filters.q)}
          onClear={() => updateFilter("q", "")}
        />
      ) : null}

      {activeTab === "current" && filters.status !== "all" ? (
        <FilterChip
          label="Status"
          value={pretty(filters.status)}
          onClear={() => updateFilter("status", "all")}
        />
      ) : null}

      {filters.warehouseType !== "all" ? (
        <FilterChip
          label="Type"
          value={pretty(filters.warehouseType)}
          onClear={() => updateFilter("warehouseType", "all")}
        />
      ) : null}

      {filters.isDefault !== "all" ? (
        <FilterChip
          label="Default"
          value={
            filters.isDefault === "true"
              ? "Default only"
              : "Non-default only"
          }
          onClear={() => updateFilter("isDefault", "all")}
        />
      ) : null}

      {filters.branch !== "all" ? (
        <FilterChip
          label="Branch"
          value={
            filters.branch === "none"
              ? "No branch"
              : branchName || "Selected branch"
          }
          onClear={() => updateFilter("branch", "all")}
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
  branchName,
  onOpenFilters,
}) {
  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "lg:min-w-[540px] lg:max-w-[76%] lg:flex-[0_1_76%]"
          : "lg:max-w-[52%] lg:flex-[0_1_52%]"
      )}
    >
      <div className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon
          icon={Search01Icon}
          className="h-4 w-4 shrink-0 text-gray-400"
        />

        {clean(filters.q) ? (
          <FilterChip
            label="Search"
            value={clean(filters.q)}
            onClear={() => updateFilter("q", "")}
          />
        ) : null}

        {activeTab === "current" && filters.status !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(filters.status)}
            onClear={() => updateFilter("status", "all")}
          />
        ) : null}

        {filters.warehouseType !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(filters.warehouseType)}
            onClear={() => updateFilter("warehouseType", "all")}
          />
        ) : null}

        {filters.branch !== "all" ? (
          <FilterChip
            label="Branch"
            value={
              filters.branch === "none"
                ? "No branch"
                : branchName || "Selected branch"
            }
            onClear={() => updateFilter("branch", "all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search warehouse name or code..."
          type="text"
          aria-label="Search warehouses"
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

export default function WarehouseSetup({
  branchOptions: suppliedBranchOptions = EMPTY_OPTIONS,
  managerOptions: suppliedManagerOptions = EMPTY_OPTIONS,
}) {
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
    WAREHOUSE_MANAGE_PERMISSION
  )

  const canDelete = hasPermission(
    currentUser,
    WAREHOUSE_DELETE_PERMISSION
  )

  const [activeTab, setActiveTab] = useState("current")
  const [warehouses, setWarehouses] = useState([])
  const [branches, setBranches] = useState(suppliedBranchOptions)
  const [managers, setManagers] = useState(suppliedManagerOptions)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openingWarehouseId, setOpeningWarehouseId] = useState("")
  const [loadingDetailsId, setLoadingDetailsId] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [modal, setModal] = useState({
    open: false,
    item: null,
  })

  const [detailsModal, setDetailsModal] = useState({
    open: false,
    warehouse: null,
    stats: null,
  })

  const [form, setForm] = useState(emptyWarehouseForm)
  const [formError, setFormError] = useState("")

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    warehouseType: "all",
    branch: "all",
    isDefault: "all",
  })

  useEffect(() => {
    setBranches(suppliedBranchOptions)
  }, [suppliedBranchOptions])

  useEffect(() => {
    setManagers(suppliedManagerOptions)
  }, [suppliedManagerOptions])

  const branchMap = useMemo(
    () =>
      new Map(
        branches
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [branches]
  )

  const selectedBranchName = useMemo(() => {
    if (filters.branch === "all" || filters.branch === "none") {
      return ""
    }

    return relationLabel(
      branchMap.get(String(filters.branch)),
      "Selected branch"
    )
  }, [filters.branch, branchMap])

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (clean(filters.q)) count += 1

    if (activeTab === "current" && filters.status !== "all") {
      count += 1
    }

    if (filters.warehouseType !== "all") count += 1
    if (filters.branch !== "all") count += 1
    if (filters.isDefault !== "all") count += 1

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
      warehouseType: "all",
      branch: "all",
      isDefault: "all",
    })
  }

  const loadOptionalOptions = async () => {
    const tasks = []

    if (!suppliedBranchOptions.length && BRANCH_OPTIONS_PATH) {
      tasks.push(
        api(BRANCH_OPTIONS_PATH)
          .then((data) => {
            setBranches(
              extractCollection(data, ["branches", "options"])
            )
          })
          .catch(() => undefined)
      )
    }

    if (!suppliedManagerOptions.length && MANAGER_OPTIONS_PATH) {
      tasks.push(
        api(MANAGER_OPTIONS_PATH)
          .then((data) => {
            setManagers(
              extractCollection(data, [
                "users",
                "employees",
                "managers",
                "options",
              ])
            )
          })
          .catch(() => undefined)
      )
    }

    await Promise.all(tasks)
  }

  const loadWarehouses = async ({
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

      if (filters.warehouseType !== "all") {
        params.set("warehouseType", filters.warehouseType)
      }

      if (filters.branch !== "all") {
        params.set("branch", filters.branch)
      }

      if (filters.isDefault !== "all") {
        params.set("isDefault", filters.isDefault)
      }

      if (append && nextCursor) {
        params.set("cursor", nextCursor)
      }

      const data = await api(
        `/inventory/warehouses?${params.toString()}`,
        { signal }
      )

      const incoming = data.warehouses || []

      setWarehouses((previous) =>
        append ? [...previous, ...incoming] : incoming
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load warehouses")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    loadOptionalOptions()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      loadWarehouses({ signal: controller.signal })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.status,
    filters.warehouseType,
    filters.branch,
    filters.isDefault,
  ])

  const refresh = async () => {
    await Promise.all([
      loadWarehouses(),
      loadOptionalOptions(),
    ])
  }

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
    setForm(emptyWarehouseForm)
    setModal({ open: true, item: null })
  }

  const openEditModal = async (warehouse) => {
    if (warehouse.status === "archived") {
      toast.error("Restore the archived warehouse before editing it.")
      return
    }

    setOpeningWarehouseId(warehouse._id)
    setFormError("")

    try {
      const data = await api(
        `/inventory/warehouses/${warehouse._id}`
      )

      const item = data.warehouse

      setForm({
        name: item.name || "",
        code: item.code || "",
        warehouseType: item.warehouseType || "store",
        branch: normalizeId(item.branch),
        manager: normalizeId(item.manager),
        description: item.description || "",
        address: {
          addressLine1: item.address?.addressLine1 || "",
          addressLine2: item.address?.addressLine2 || "",
          area: item.address?.area || "",
          city: item.address?.city || "",
          state: item.address?.state || "",
          postalCode: item.address?.postalCode || "",
          country: item.address?.country || "Bangladesh",
        },
        contactName: item.contactName || "",
        phone: item.phone || "",
        email: item.email || "",
        timezone: item.timezone || "Asia/Dhaka",
        isDefault: Boolean(item.isDefault),
        allowNegativeStock: Boolean(item.allowNegativeStock),
        status: item.status || "active",
      })

      setModal({ open: true, item })
    } catch (error) {
      toast.error(error.message || "Failed to load warehouse")
    } finally {
      setOpeningWarehouseId("")
    }
  }

  const openDetailsModal = async (warehouse) => {
    setLoadingDetailsId(warehouse._id)

    try {
      const data = await api(
        `/inventory/warehouses/${warehouse._id}?includeStats=true`
      )

      setDetailsModal({
        open: true,
        warehouse: data.warehouse,
        stats: data.stats || null,
      })
    } catch (error) {
      toast.error(
        error.message || "Failed to load warehouse details"
      )
    } finally {
      setLoadingDetailsId("")
    }
  }

  const closeModal = () => {
    if (saving) return

    setFormError("")
    setModal({ open: false, item: null })
    setForm(emptyWarehouseForm)
  }

  const updateAddress = (key, value) => {
    setForm((previous) => ({
      ...previous,
      address: {
        ...previous.address,
        [key]: value,
      },
    }))
  }

  const updateStatus = (status) => {
    setForm((previous) => ({
      ...previous,
      status,
      isDefault: status === "active" ? previous.isDefault : false,
    }))
  }

  const updateDefault = (isDefault) => {
    setForm((previous) => ({
      ...previous,
      isDefault,
      status: isDefault ? "active" : previous.status,
    }))
  }

  const saveWarehouse = async (event) => {
    event.preventDefault()
    setFormError("")

    const name = clean(form.name)
    const code = clean(form.code).toUpperCase()
    const email = clean(form.email).toLowerCase()

    if (!name) {
      return setFormError("Warehouse name is required.")
    }

    if (!code) {
      return setFormError("Warehouse code is required.")
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return setFormError(
        "Enter a valid warehouse email address."
      )
    }

    if (form.isDefault && form.status !== "active") {
      return setFormError(
        "Only an active warehouse can be the default warehouse."
      )
    }

    const payload = {
      name,
      code,
      warehouseType: form.warehouseType,
      branch: form.branch || null,
      manager: form.manager || null,
      description: clean(form.description),
      address: {
        addressLine1: clean(form.address.addressLine1),
        addressLine2: clean(form.address.addressLine2),
        area: clean(form.address.area),
        city: clean(form.address.city),
        state: clean(form.address.state),
        postalCode: clean(form.address.postalCode),
        country:
          clean(form.address.country || "Bangladesh") ||
          "Bangladesh",
      },
      contactName: clean(form.contactName),
      phone: clean(form.phone),
      email,
      timezone: clean(form.timezone || "Asia/Dhaka") || "Asia/Dhaka",
      isDefault: Boolean(form.isDefault),
      allowNegativeStock: Boolean(form.allowNegativeStock),
      status: form.status,
    }

    setSaving(true)

    try {
      await api(
        modal.item?._id
          ? `/inventory/warehouses/${modal.item._id}`
          : "/inventory/warehouses",
        {
          method: modal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      )

      toast.success(
        modal.item ? "Warehouse updated" : "Warehouse created"
      )

      setModal({ open: false, item: null })
      setForm(emptyWarehouseForm)
      setFormError("")
      await loadWarehouses()
    } catch (error) {
      setFormError(error.message || "Failed to save warehouse.")
    } finally {
      setSaving(false)
    }
  }

  const updateWarehouseStatus = async (warehouse, status) => {
    if (status === warehouse.status) return

    if (warehouse.isDefault && status !== "active") {
      toast.error(
        "Set another warehouse as default before deactivating this warehouse."
      )
      return
    }

    try {
      await api(
        `/inventory/warehouses/${warehouse._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      )

      toast.success(
        `Warehouse marked as ${pretty(status).toLowerCase()}`
      )

      await loadWarehouses()
    } catch (error) {
      toast.error(
        error.message || "Failed to update warehouse status"
      )
    }
  }

  const archiveWarehouse = async (warehouse) => {
    const confirmed = window.confirm(
      `Archive "${warehouse.name}"? The warehouse must not be default and cannot have stock activity or balances. Zero-balance locations will also be archived.`
    )

    if (!confirmed) return

    try {
      await api(`/inventory/warehouses/${warehouse._id}`, {
        method: "DELETE",
      })

      toast.success("Warehouse archived safely")
      await loadWarehouses()
    } catch (error) {
      toast.error(error.message || "Failed to archive warehouse")
    }
  }

  const restoreWarehouse = async (warehouse) => {
    try {
      await api(
        `/inventory/warehouses/${warehouse._id}/restore`,
        {
          method: "PATCH",
        }
      )

      toast.success("Warehouse restored as inactive")
      await loadWarehouses()
    } catch (error) {
      toast.error(error.message || "Failed to restore warehouse")
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
                Warehouses
              </h1>

              <p className="mt-0.5 text-sm text-gray-500">
                Manage storage facilities, branch assignments,
                contacts, stock policy, and warehouse lifecycle.
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
                Add Warehouse
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
            branchName={selectedBranchName}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing{" "}
            <span className="text-gray-900">
              {warehouses.length}
            </span>{" "}
            {activeTab === "archived"
              ? "archived warehouses"
              : "warehouses"}
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only warehouse access. Create, edit,
          status, archive, and restore controls are hidden.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            {
              key: "current",
              label: "Current Warehouses",
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
                "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold transition sm:px-5",
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

      <WarehouseList
        warehouses={warehouses}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        openingWarehouseId={openingWarehouseId}
        loadingDetailsId={loadingDetailsId}
        onView={openDetailsModal}
        onEdit={openEditModal}
        onStatusChange={updateWarehouseStatus}
        onArchive={archiveWarehouse}
        onRestore={restoreWarehouse}
        onLoadMore={() => loadWarehouses({ append: true })}
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
        branches={branches}
        selectedBranchName={selectedBranchName}
      />

      <WarehouseFormModal
        open={modal.open}
        item={modal.item}
        form={form}
        setForm={setForm}
        branches={branches}
        managers={managers}
        error={formError}
        saving={saving}
        onClose={closeModal}
        onSubmit={saveWarehouse}
        onAddressChange={updateAddress}
        onStatusChange={updateStatus}
        onDefaultChange={updateDefault}
      />

      <WarehouseDetailsModal
        state={detailsModal}
        onClose={() =>
          setDetailsModal({
            open: false,
            warehouse: null,
            stats: null,
          })
        }
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
  branches,
  selectedBranchName,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Warehouse filters"
      subtitle="Filter warehouses by type, branch, default assignment, and status."
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

              {WAREHOUSE_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-sm font-black text-amber-800">
              Archived warehouses
            </p>

            <p className="mt-1 text-xs font-semibold text-amber-700">
              This tab only shows archived warehouse records.
            </p>
          </div>
        )}

        <Field label="Warehouse Type">
          <select
            className={input}
            value={filters.warehouseType}
            onChange={(event) =>
              updateFilter("warehouseType", event.target.value)
            }
          >
            <option value="all">All warehouse types</option>

            {WAREHOUSE_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Branch">
          <select
            className={input}
            value={filters.branch}
            onChange={(event) =>
              updateFilter("branch", event.target.value)
            }
          >
            <option value="all">All branches</option>
            <option value="none">No branch</option>

            {filters.branch !== "all" &&
            filters.branch !== "none" &&
            !branches.some(
              (branch) =>
                String(branch._id) === String(filters.branch)
            ) ? (
              <option value={filters.branch}>
                {selectedBranchName || "Selected branch"}
              </option>
            ) : null}

            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {relationLabel(branch)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Default Assignment">
          <select
            className={input}
            value={filters.isDefault}
            onChange={(event) =>
              updateFilter("isDefault", event.target.value)
            }
          >
            <option value="all">Default + Non-default</option>
            <option value="true">Default only</option>
            <option value="false">Non-default only</option>
          </select>
        </Field>

        <div className="md:col-span-2 lg:col-span-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm font-black text-gray-900">
            Active filters
          </p>

          <ActiveFilterChips
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            branchName={selectedBranchName}
          />
        </div>
      </div>
    </ModalShell>
  )
}

function WarehouseList({
  warehouses,
  loading,
  loadingMore,
  hasMore,
  openingWarehouseId,
  loadingDetailsId,
  onView,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  onLoadMore,
  canManage,
  canDelete,
}) {
  return (
    <div>
      <div className={cn(card, "overflow-hidden")}>
        <div className="hidden max-h-[650px] overflow-auto lg:block">
          <table className="min-w-[1380px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Branch</th>
                <th className="px-5 py-3">Manager</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Default</th>
                <th className="px-5 py-3">Negative Stock</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {warehouses.map((warehouse) => (
                <tr
                  key={warehouse._id}
                  className="group bg-white transition hover:bg-gray-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="min-w-[230px]">
                      <p className="truncate text-sm font-black text-gray-900">
                        {warehouse.name}
                      </p>

                      <p className="mt-0.5 text-xs font-black text-indigo-700">
                        {warehouse.code}
                      </p>

                      <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">
                        {warehouse.timezone || "Asia/Dhaka"}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <WarehouseTypeBadge
                      value={warehouse.warehouseType}
                    />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {relationLabel(warehouse.branch, "No branch")}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {relationLabel(warehouse.manager, "No manager")}
                  </td>

                  <td className="px-5 py-4">
                    <p className="max-w-[260px] truncate text-sm font-semibold text-gray-700">
                      {formatAddress(warehouse.address)}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="max-w-[190px] truncate text-sm font-black text-gray-700">
                      {warehouse.contactName || "No contact"}
                    </p>

                    <p className="mt-0.5 max-w-[190px] truncate text-xs font-semibold text-gray-500">
                      {warehouse.phone ||
                        warehouse.email ||
                        "No contact details"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <BooleanBadge
                      value={warehouse.isDefault}
                      trueLabel="Default"
                      falseLabel="Standard"
                    />
                  </td>

                  <td className="px-5 py-4">
                    <BooleanBadge
                      value={warehouse.allowNegativeStock}
                      trueLabel="Allowed"
                      falseLabel="Blocked"
                    />
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge value={warehouse.status} />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                    {formatDate(warehouse.updatedAt)}
                  </td>

                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                    <WarehouseActions
                      warehouse={warehouse}
                      opening={
                        String(openingWarehouseId) ===
                        String(warehouse._id)
                      }
                      loadingDetails={
                        String(loadingDetailsId) ===
                        String(warehouse._id)
                      }
                      onView={onView}
                      onEdit={onEdit}
                      onStatusChange={onStatusChange}
                      onArchive={onArchive}
                      onRestore={onRestore}
                      canManage={canManage}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))}

              {!warehouses.length ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center text-sm font-bold text-gray-500"
                  >
                    {loading
                      ? "Loading warehouses..."
                      : "No warehouses found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {warehouses.map((warehouse) => (
            <WarehouseMobileCard
              key={warehouse._id}
              warehouse={warehouse}
              opening={
                String(openingWarehouseId) === String(warehouse._id)
              }
              loadingDetails={
                String(loadingDetailsId) === String(warehouse._id)
              }
              onView={onView}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              onRestore={onRestore}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}

          {!warehouses.length ? (
            <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
              {loading
                ? "Loading warehouses..."
                : "No warehouses found."}
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

function WarehouseMobileCard({
  warehouse,
  opening,
  loadingDetails,
  onView,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  canManage,
  canDelete,
}) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 px-2 text-center text-xs font-black text-indigo-700">
          {warehouse.code?.slice(0, 4)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-900">
                {warehouse.name}
              </h3>

              <p className="mt-0.5 text-xs font-black text-indigo-700">
                {warehouse.code}
              </p>
            </div>

            <StatusBadge value={warehouse.status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <WarehouseTypeBadge value={warehouse.warehouseType} />

            {warehouse.isDefault ? (
              <BooleanBadge
                value
                trueLabel="Default"
                falseLabel=""
              />
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <div>
              <p className="font-bold text-gray-400">Branch</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {relationLabel(warehouse.branch, "No branch")}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Manager</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {relationLabel(warehouse.manager, "No manager")}
              </p>
            </div>

            <div className="col-span-2">
              <p className="font-bold text-gray-400">Address</p>
              <p className="mt-1 line-clamp-2 font-black text-gray-700">
                {formatAddress(warehouse.address)}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Negative stock</p>
              <p className="mt-1 font-black text-gray-700">
                {warehouse.allowNegativeStock
                  ? "Allowed"
                  : "Blocked"}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Timezone</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {warehouse.timezone || "Asia/Dhaka"}
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <WarehouseActions
              warehouse={warehouse}
              opening={opening}
              loadingDetails={loadingDetails}
              onView={onView}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              onRestore={onRestore}
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

function WarehouseActions({
  warehouse,
  opening,
  loadingDetails,
  onView,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  canManage,
  canDelete,
  mobile = false,
}) {
  if (warehouse.status === "archived") {
    return (
      <div
        className={cn(
          "flex gap-2",
          mobile ? "flex-wrap" : "justify-end"
        )}
      >
        <button
          className={cn(
            button,
            ghostButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onView(warehouse)}
          disabled={loadingDetails}
          type="button"
          title="View warehouse"
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
            className={cn(
              button,
              ghostButton,
              mobile ? "px-3 py-2" : "px-3"
            )}
            onClick={() => onRestore(warehouse)}
            type="button"
            title="Restore warehouse"
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
        className={cn(
          button,
          ghostButton,
          mobile ? "px-3 py-2" : "px-3"
        )}
        onClick={() => onView(warehouse)}
        disabled={loadingDetails}
        type="button"
        title="View warehouse"
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
              "rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-black text-gray-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60",
              mobile ? "min-w-[126px]" : "w-[112px]"
            )}
            value={warehouse.status}
            onChange={(event) =>
              onStatusChange(warehouse, event.target.value)
            }
            disabled={warehouse.isDefault}
            aria-label={`Update ${warehouse.name} status`}
            title={
              warehouse.isDefault
                ? "A default warehouse must remain active."
                : "Update status"
            }
          >
            {WAREHOUSE_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button
            className={cn(
              button,
              ghostButton,
              mobile ? "px-3 py-2" : "px-3"
            )}
            onClick={() => onEdit(warehouse)}
            disabled={opening}
            type="button"
            title="Edit warehouse"
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
          className={cn(
            button,
            dangerButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onArchive(warehouse)}
          type="button"
          title="Archive warehouse"
        >
          <Icon icon={Archive02Icon} className="h-4 w-4" />
          {mobile ? "Archive" : null}
        </button>
      ) : null}
    </div>
  )
}

function WarehouseFormModal({
  open,
  item,
  form,
  setForm,
  branches,
  managers,
  error,
  saving,
  onClose,
  onSubmit,
  onAddressChange,
  onStatusChange,
  onDefaultChange,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update warehouse" : "Add warehouse"}
      subtitle={
        item
          ? form.name || "Edit warehouse information."
          : "Create a warehouse and configure its operating rules."
      }
      icon={
        <Icon
          icon={item ? Edit02Icon : Add01Icon}
          className="h-5 w-5"
        />
      }
      maxWidthClass="max-w-6xl"
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
            form="warehouse-form"
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
                ? "Update warehouse"
                : "Save warehouse"}
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

      <form id="warehouse-form" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionCard
            title="Warehouse identity"
            description="Core warehouse assignment and lifecycle information."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Warehouse Name" required>
                <FocusPlaceholderInput
                  className={input}
                  value={form.name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: Dhaka Central Warehouse"
                  maxLength={160}
                  required
                />
              </Field>

              <Field label="Warehouse Code" required>
                <FocusPlaceholderInput
                  className={input}
                  value={form.code}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Example: WH-DHK-01"
                  maxLength={50}
                  required
                />
              </Field>

              <Field label="Warehouse Type" required>
                <select
                  className={input}
                  value={form.warehouseType}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      warehouseType: event.target.value,
                    }))
                  }
                  required
                >
                  {WAREHOUSE_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Branch"
                hint={
                  branches.length
                    ? "Optional"
                    : "Provide branchOptions or configure VITE_BRANCH_OPTIONS_PATH."
                }
              >
                <RelationSelect
                  value={form.branch}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      branch: event.target.value,
                    }))
                  }
                  options={branches}
                  emptyLabel="No branch"
                  currentItem={item?.branch}
                />
              </Field>

              <Field
                label="Manager"
                hint={
                  managers.length
                    ? "Optional"
                    : "Provide managerOptions or configure VITE_WAREHOUSE_MANAGER_OPTIONS_PATH."
                }
              >
                <RelationSelect
                  value={form.manager}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      manager: event.target.value,
                    }))
                  }
                  options={managers}
                  emptyLabel="No manager"
                  currentItem={item?.manager}
                />
              </Field>

              <Field label="Status" required>
                <select
                  className={input}
                  value={form.status}
                  onChange={(event) =>
                    onStatusChange(event.target.value)
                  }
                  required
                >
                  {WAREHOUSE_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Description" hint="Optional">
                  <FocusPlaceholderTextarea
                    className={cn(
                      input,
                      "min-h-[100px] resize-none"
                    )}
                    value={form.description}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Describe the warehouse purpose and operating scope..."
                    maxLength={2000}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Address"
            description="Physical or operational address for the warehouse."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Address Line 1">
                <FocusPlaceholderInput
                  className={input}
                  value={form.address.addressLine1}
                  onChange={(event) =>
                    onAddressChange(
                      "addressLine1",
                      event.target.value
                    )
                  }
                  placeholder="Building, road, or street"
                  maxLength={250}
                />
              </Field>

              <Field label="Address Line 2">
                <FocusPlaceholderInput
                  className={input}
                  value={form.address.addressLine2}
                  onChange={(event) =>
                    onAddressChange(
                      "addressLine2",
                      event.target.value
                    )
                  }
                  placeholder="Floor, block, or landmark"
                  maxLength={250}
                />
              </Field>

              <Field label="Area">
                <FocusPlaceholderInput
                  className={input}
                  value={form.address.area}
                  onChange={(event) =>
                    onAddressChange("area", event.target.value)
                  }
                  placeholder="Example: Badda"
                  maxLength={120}
                />
              </Field>

              <Field label="City">
                <FocusPlaceholderInput
                  className={input}
                  value={form.address.city}
                  onChange={(event) =>
                    onAddressChange("city", event.target.value)
                  }
                  placeholder="Example: Dhaka"
                  maxLength={120}
                />
              </Field>

              <Field label="State / Division">
                <FocusPlaceholderInput
                  className={input}
                  value={form.address.state}
                  onChange={(event) =>
                    onAddressChange("state", event.target.value)
                  }
                  placeholder="Example: Dhaka Division"
                  maxLength={120}
                />
              </Field>

              <Field label="Postal Code">
                <FocusPlaceholderInput
                  className={input}
                  value={form.address.postalCode}
                  onChange={(event) =>
                    onAddressChange(
                      "postalCode",
                      event.target.value
                    )
                  }
                  placeholder="Example: 1212"
                  maxLength={40}
                />
              </Field>

              <Field label="Country">
                <FocusPlaceholderInput
                  className={input}
                  value={form.address.country}
                  onChange={(event) =>
                    onAddressChange("country", event.target.value)
                  }
                  placeholder="Example: Bangladesh"
                  maxLength={120}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Contact and operations"
            description="Warehouse contact details, timezone, and stock-control policy."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Contact Person">
                <FocusPlaceholderInput
                  className={input}
                  value={form.contactName}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      contactName: event.target.value,
                    }))
                  }
                  placeholder="Example: Warehouse Supervisor"
                  maxLength={160}
                />
              </Field>

              <Field label="Phone">
                <FocusPlaceholderInput
                  className={input}
                  value={form.phone}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Example: +880 1XXXXXXXXX"
                  maxLength={60}
                  type="tel"
                />
              </Field>

              <Field label="Email">
                <FocusPlaceholderInput
                  className={input}
                  value={form.email}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }))
                  }
                  placeholder="warehouse@example.com"
                  maxLength={180}
                  type="email"
                />
              </Field>

              <Field label="Timezone">
                <FocusPlaceholderInput
                  className={input}
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      timezone: event.target.value,
                    }))
                  }
                  placeholder="Example: Asia/Dhaka"
                  maxLength={80}
                />
              </Field>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      Default Warehouse
                    </p>

                    <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                      Becomes the default warehouse for this branch.
                    </p>
                  </div>

                  <Toggle
                    checked={Boolean(form.isDefault)}
                    onChange={onDefaultChange}
                    label="Set as default warehouse"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      Allow Negative Stock
                    </p>

                    <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
                      Permit warehouse transactions below available quantity.
                    </p>
                  </div>

                  <Toggle
                    checked={Boolean(form.allowNegativeStock)}
                    onChange={(value) =>
                      setForm((previous) => ({
                        ...previous,
                        allowNegativeStock: value,
                      }))
                    }
                    label="Allow negative warehouse stock"
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </form>
    </ModalShell>
  )
}

function WarehouseDetailsModal({ state, onClose }) {
  const warehouse = state.warehouse
  const stats = state.stats || {}

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={warehouse?.name || "Warehouse details"}
      subtitle={
        warehouse
          ? `${warehouse.code} · ${pretty(
              warehouse.warehouseType
            )}`
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
      {warehouse ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Locations", stats.locationCount || 0],
              ["Products", stats.productCount || 0],
              ["Stock Rows", stats.stockRows || 0],
              [
                "On Hand",
                formatNumber(stats.onHandQuantity || 0),
              ],
              [
                "Inventory Value",
                formatNumber(stats.inventoryValue || 0),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
              >
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                  {label}
                </p>

                <p className="mt-2 text-xl font-black text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Warehouse information">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Status"
                  value={<StatusBadge value={warehouse.status} />}
                />
                <DetailRow
                  label="Type"
                  value={
                    <WarehouseTypeBadge
                      value={warehouse.warehouseType}
                    />
                  }
                />
                <DetailRow
                  label="Branch"
                  value={relationLabel(
                    warehouse.branch,
                    "No branch"
                  )}
                />
                <DetailRow
                  label="Manager"
                  value={relationLabel(
                    warehouse.manager,
                    "No manager"
                  )}
                />
                <DetailRow
                  label="Timezone"
                  value={warehouse.timezone || "Asia/Dhaka"}
                />
                <DetailRow
                  label="Default"
                  value={warehouse.isDefault ? "Yes" : "No"}
                />
                <DetailRow
                  label="Negative stock"
                  value={
                    warehouse.allowNegativeStock
                      ? "Allowed"
                      : "Blocked"
                  }
                />
              </div>
            </SectionCard>

            <SectionCard title="Contact and address">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Contact"
                  value={warehouse.contactName || "-"}
                />
                <DetailRow
                  label="Phone"
                  value={warehouse.phone || "-"}
                />
                <DetailRow
                  label="Email"
                  value={warehouse.email || "-"}
                />
                <DetailRow
                  label="Address"
                  value={formatAddress(warehouse.address)}
                />
              </div>
            </SectionCard>
          </div>

          {warehouse.description ? (
            <SectionCard title="Description">
              <p className="text-sm font-semibold leading-6 text-gray-600">
                {warehouse.description}
              </p>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
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
