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
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Edit02Icon,
  FilterIcon,
  FloppyDiskIcon,
  FolderLibraryIcon,
  HierarchySquare01Icon,
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const LOCATION_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_LOCATION_MANAGE ||
  "inventory-location:manage"

const LOCATION_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_LOCATION_DELETE ||
  "inventory-location:delete"

const LOCATION_TYPES = [
  ["zone", "Zone"],
  ["aisle", "Aisle"],
  ["rack", "Rack"],
  ["shelf", "Shelf"],
  ["bin", "Bin"],
  ["receiving", "Receiving"],
  ["dispatch", "Dispatch"],
  ["returns", "Returns"],
  ["quarantine", "Quarantine"],
  ["damaged", "Damaged"],
  ["other", "Other"],
]

const LOCATION_STATUSES = [
  ["active", "Active"],
  ["inactive", "Inactive"],
]

const emptyLocationForm = {
  warehouse: "",
  name: "",
  code: "",
  locationType: "bin",
  parent: "",
  description: "",
  barcode: "",
  capacityQuantity: "0",
  sortOrder: "0",
  isReceivable: false,
  isPickable: true,
  isDispatchable: false,
  isQuarantine: false,
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

function relationLabel(item, fallback = "Unnamed") {
  if (!item) return fallback

  const name = item.name || item.label || fallback
  const code = item.code || ""

  return `${name}${code ? ` (${code})` : ""}`
}

function flattenTree(nodes = [], depth = 0, result = []) {
  for (const node of nodes) {
    result.push({
      ...node,
      treeDepth: depth,
    })

    flattenTree(node.children || [], depth + 1, result)
  }

  return result
}

function countTree(nodes = []) {
  return nodes.reduce(
    (count, node) =>
      count + 1 + countTree(node.children || []),
    0
  )
}

function filterTree(nodes = [], query = "") {
  const search = clean(query).toLowerCase()
  if (!search) return nodes

  return nodes.reduce((result, node) => {
    const children = filterTree(node.children || [], search)

    const matches = [
      node.name,
      node.code,
      node.locationType,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value).toLowerCase().includes(search)
      )

    if (matches || children.length) {
      result.push({
        ...node,
        children,
      })
    }

    return result
  }, [])
}

function findSubtree(nodes = [], id = "") {
  if (!id) return nodes

  for (const node of nodes) {
    if (String(node._id) === String(id)) {
      return [node]
    }

    const nested = findSubtree(node.children || [], id)
    if (nested.length) return nested
  }

  return []
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

function LocationTypeBadge({ value }) {
  const type = String(value || "").toLowerCase()

  const style =
    type === "zone"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
      : type === "aisle"
        ? "bg-violet-50 text-violet-700 ring-violet-100"
        : type === "rack"
          ? "bg-sky-50 text-sky-700 ring-sky-100"
          : type === "shelf"
            ? "bg-cyan-50 text-cyan-700 ring-cyan-100"
            : type === "bin"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : type === "receiving"
                ? "bg-blue-50 text-blue-700 ring-blue-100"
                : type === "dispatch"
                  ? "bg-teal-50 text-teal-700 ring-teal-100"
                  : type === "returns"
                    ? "bg-amber-50 text-amber-700 ring-amber-100"
                    : type === "quarantine"
                      ? "bg-rose-50 text-rose-700 ring-rose-100"
                      : type === "damaged"
                        ? "bg-red-50 text-red-700 ring-red-100"
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

function CapabilityBadge({ enabled, label }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1",
        enabled
          ? "bg-indigo-50 text-indigo-700 ring-indigo-100"
          : "bg-gray-100 text-gray-400 ring-gray-200"
      )}
    >
      {label}
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
  warehouseName,
  parentName,
}) {
  const hasFilters =
    clean(filters.q) ||
    filters.warehouse !== "all" ||
    filters.locationType !== "all" ||
    (activeTab === "current" && filters.status !== "all") ||
    (activeTab !== "tree" && filters.parent !== "all") ||
    filters.isPickable !== "all" ||
    filters.isReceivable !== "all" ||
    filters.isQuarantine !== "all" ||
    (activeTab === "tree" && filters.includeInactive)

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {clean(filters.q) ? (
        <FilterChip
          label="Search"
          value={clean(filters.q)}
          onClear={() => updateFilter("q", "")}
        />
      ) : null}

      {filters.warehouse !== "all" ? (
        <FilterChip
          label="Warehouse"
          value={warehouseName || "Selected warehouse"}
          onClear={() => updateFilter("warehouse", "all")}
        />
      ) : null}

      {filters.locationType !== "all" ? (
        <FilterChip
          label="Type"
          value={pretty(filters.locationType)}
          onClear={() => updateFilter("locationType", "all")}
        />
      ) : null}

      {activeTab === "current" && filters.status !== "all" ? (
        <FilterChip
          label="Status"
          value={pretty(filters.status)}
          onClear={() => updateFilter("status", "all")}
        />
      ) : null}

      {activeTab !== "tree" && filters.parent !== "all" ? (
        <FilterChip
          label="Parent"
          value={
            filters.parent === "root"
              ? "Root locations"
              : parentName || "Selected parent"
          }
          onClear={() => updateFilter("parent", "all")}
        />
      ) : null}

      {filters.isPickable !== "all" ? (
        <FilterChip
          label="Pick"
          value={
            filters.isPickable === "true"
              ? "Pickable"
              : "Not pickable"
          }
          onClear={() => updateFilter("isPickable", "all")}
        />
      ) : null}

      {filters.isReceivable !== "all" ? (
        <FilterChip
          label="Receive"
          value={
            filters.isReceivable === "true"
              ? "Receivable"
              : "Not receivable"
          }
          onClear={() => updateFilter("isReceivable", "all")}
        />
      ) : null}

      {filters.isQuarantine !== "all" ? (
        <FilterChip
          label="Quarantine"
          value={
            filters.isQuarantine === "true"
              ? "Quarantine"
              : "Non-quarantine"
          }
          onClear={() => updateFilter("isQuarantine", "all")}
        />
      ) : null}

      {activeTab === "tree" && filters.includeInactive ? (
        <FilterChip
          label="Tree"
          value="Includes inactive"
          onClear={() => updateFilter("includeInactive", false)}
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
  warehouseName,
  parentName,
  onOpenFilters,
}) {
  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "lg:min-w-[560px] lg:max-w-[80%] lg:flex-[0_1_80%]"
          : "lg:max-w-[54%] lg:flex-[0_1_54%]"
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

        {filters.warehouse !== "all" ? (
          <FilterChip
            label="Warehouse"
            value={warehouseName || "Selected warehouse"}
            onClear={() => updateFilter("warehouse", "all")}
          />
        ) : null}

        {filters.locationType !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(filters.locationType)}
            onClear={() => updateFilter("locationType", "all")}
          />
        ) : null}

        {activeTab !== "tree" && filters.parent !== "all" ? (
          <FilterChip
            label="Parent"
            value={
              filters.parent === "root"
                ? "Root locations"
                : parentName || "Selected parent"
            }
            onClear={() => updateFilter("parent", "all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search location name, code or barcode..."
          type="text"
          aria-label="Search warehouse locations"
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

export default function WarehouseLocationSetup() {
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
    LOCATION_MANAGE_PERMISSION
  )

  const canDelete = hasPermission(
    currentUser,
    LOCATION_DELETE_PERMISSION
  )

  const [activeTab, setActiveTab] = useState("current")
  const [locations, setLocations] = useState([])
  const [locationTree, setLocationTree] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [filterParentOptions, setFilterParentOptions] = useState([])
  const [formParentOptions, setFormParentOptions] = useState([])

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openingLocationId, setOpeningLocationId] = useState("")
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
    location: null,
  })

  const [form, setForm] = useState(emptyLocationForm)
  const [formError, setFormError] = useState("")

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    warehouse: "all",
    locationType: "all",
    parent: "all",
    isPickable: "all",
    isReceivable: "all",
    isQuarantine: "all",
    includeInactive: false,
  })

  const warehouseMap = useMemo(
    () =>
      new Map(
        warehouses
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [warehouses]
  )

  const filterParentMap = useMemo(
    () =>
      new Map(
        filterParentOptions
          .filter((item) => item?._id)
          .map((item) => [String(item._id), item])
      ),
    [filterParentOptions]
  )

  const selectedWarehouseName = useMemo(() => {
    if (filters.warehouse === "all") return ""

    return relationLabel(
      warehouseMap.get(String(filters.warehouse)),
      "Selected warehouse"
    )
  }, [filters.warehouse, warehouseMap])

  const selectedParentName = useMemo(() => {
    if (filters.parent === "all" || filters.parent === "root") {
      return ""
    }

    return relationLabel(
      filterParentMap.get(String(filters.parent)),
      "Selected parent"
    )
  }, [filters.parent, filterParentMap])

  const visibleTree = useMemo(() => {
    let tree = filterTree(locationTree, filters.q)

    if (filters.parent !== "all" && filters.parent !== "root") {
      tree = findSubtree(tree, filters.parent)
    }

    if (filters.parent === "root") {
      return tree
    }

    if (filters.locationType !== "all") {
      const filterByType = (nodes) =>
        nodes.reduce((result, node) => {
          const children = filterByType(node.children || [])

          if (
            node.locationType === filters.locationType ||
            children.length
          ) {
            result.push({
              ...node,
              children,
            })
          }

          return result
        }, [])

      tree = filterByType(tree)
    }

    return tree
  }, [
    locationTree,
    filters.q,
    filters.parent,
    filters.locationType,
  ])

  const visibleTreeCount = useMemo(
    () => countTree(visibleTree),
    [visibleTree]
  )

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (clean(filters.q)) count += 1
    if (filters.warehouse !== "all") count += 1
    if (filters.locationType !== "all") count += 1

    if (activeTab === "current" && filters.status !== "all") {
      count += 1
    }

    if (activeTab !== "tree" && filters.parent !== "all") {
      count += 1
    }

    if (filters.isPickable !== "all") count += 1
    if (filters.isReceivable !== "all") count += 1
    if (filters.isQuarantine !== "all") count += 1

    if (activeTab === "tree" && filters.includeInactive) {
      count += 1
    }

    return count
  }, [activeTab, filters])

  const updateFilter = (key, value) => {
    setFilters((previous) => {
      const next = {
        ...previous,
        [key]: value,
      }

      if (key === "warehouse") {
        next.parent = "all"
      }

      return next
    })
  }

  const resetFilters = () => {
    setFilters({
      q: "",
      status: "all",
      warehouse: "all",
      locationType: "all",
      parent: "all",
      isPickable: "all",
      isReceivable: "all",
      isQuarantine: "all",
      includeInactive: false,
    })
  }

  const loadWarehouses = async () => {
    try {
      const data = await api(
        "/inventory/warehouses?status=all&limit=100"
      )

      setWarehouses(data.warehouses || [])
    } catch (error) {
      toast.error(
        error.message || "Failed to load warehouse options"
      )
    }
  }

  const loadParentTree = async (
    warehouseId,
    { target = "filter", excludeId = "" } = {}
  ) => {
    if (!warehouseId || warehouseId === "all") {
      if (target === "form") setFormParentOptions([])
      else setFilterParentOptions([])
      return []
    }

    try {
      const data = await api(
        `/inventory/warehouse-locations/tree?warehouse=${encodeURIComponent(
          warehouseId
        )}&includeInactive=true`
      )

      const flat = flattenTree(data.locations || [])

      const filtered = excludeId
        ? flat.filter(
            (item) =>
              String(item._id) !== String(excludeId) &&
              !(item.ancestors || []).some(
                (id) => String(id) === String(excludeId)
              )
          )
        : flat

      if (target === "form") {
        setFormParentOptions(filtered)
      } else {
        setFilterParentOptions(filtered)
      }

      return filtered
    } catch (error) {
      if (target === "form") setFormParentOptions([])
      else setFilterParentOptions([])

      toast.error(
        error.message || "Failed to load location hierarchy"
      )

      return []
    }
  }

  const loadLocations = async ({
    append = false,
    showLoader = true,
    signal,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const params = new URLSearchParams({
        limit: "50",
      })

      if (clean(filters.q)) {
        params.set("q", clean(filters.q))
      }

      if (activeTab === "archived") {
        params.set("status", "archived")
      } else if (filters.status !== "all") {
        params.set("status", filters.status)
      }

      if (filters.warehouse !== "all") {
        params.set("warehouse", filters.warehouse)
      }

      if (filters.locationType !== "all") {
        params.set("locationType", filters.locationType)
      }

      if (filters.parent !== "all") {
        params.set("parent", filters.parent)
      }

      if (filters.isPickable !== "all") {
        params.set("isPickable", filters.isPickable)
      }

      if (filters.isReceivable !== "all") {
        params.set("isReceivable", filters.isReceivable)
      }

      if (filters.isQuarantine !== "all") {
        params.set("isQuarantine", filters.isQuarantine)
      }

      if (append && nextCursor) {
        params.set("cursor", nextCursor)
      }

      const data = await api(
        `/inventory/warehouse-locations?${params.toString()}`,
        { signal }
      )

      const incoming = data.locations || []

      setLocations((previous) =>
        append ? [...previous, ...incoming] : incoming
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(
          error.message || "Failed to load warehouse locations"
        )
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  const loadTree = async ({ showLoader = true } = {}) => {
    if (
      !filters.warehouse ||
      filters.warehouse === "all"
    ) {
      setLocationTree([])
      setLoading(false)
      return
    }

    if (showLoader) setLoading(true)

    try {
      const params = new URLSearchParams({
        warehouse: filters.warehouse,
      })

      if (filters.includeInactive) {
        params.set("includeInactive", "true")
      }

      const data = await api(
        `/inventory/warehouse-locations/tree?${params.toString()}`
      )

      setLocationTree(data.locations || [])
    } catch (error) {
      toast.error(
        error.message || "Failed to load location hierarchy"
      )
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    loadWarehouses()
  }, [])

  useEffect(() => {
    loadParentTree(filters.warehouse, {
      target: "filter",
    })
  }, [filters.warehouse])

  useEffect(() => {
    if (activeTab === "tree") {
      loadTree()
      return undefined
    }

    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      loadLocations({ signal: controller.signal })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.status,
    filters.warehouse,
    filters.locationType,
    filters.parent,
    filters.isPickable,
    filters.isReceivable,
    filters.isQuarantine,
    filters.includeInactive,
  ])

  const refresh = async () => {
    await Promise.all([
      loadWarehouses(),
      activeTab === "tree" ? loadTree() : loadLocations(),
    ])
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
    setNextCursor(null)
    setHasMore(false)

    setFilters((previous) => {
      const next = {
        ...previous,
        status: "all",
        parent: "all",
      }

      if (
        tab === "tree" &&
        next.warehouse === "all"
      ) {
        const firstActive = warehouses.find(
          (warehouse) => warehouse.status === "active"
        )

        if (firstActive?._id) {
          next.warehouse = firstActive._id
        }
      }

      return next
    })
  }

  const openCreateModal = async () => {
    const selectedWarehouse =
      filters.warehouse !== "all"
        ? filters.warehouse
        : warehouses.find(
            (warehouse) => warehouse.status === "active"
          )?._id || ""

    setFormError("")

    setForm({
      ...emptyLocationForm,
      warehouse: selectedWarehouse,
    })

    setModal({ open: true, item: null })

    await loadParentTree(selectedWarehouse, {
      target: "form",
    })
  }

  const openEditModal = async (location) => {
    if (location.status === "archived") {
      toast.error("Restore the archived location before editing it.")
      return
    }

    setOpeningLocationId(location._id)
    setFormError("")

    try {
      const data = await api(
        `/inventory/warehouse-locations/${location._id}`
      )

      const item = data.location

      setForm({
        warehouse: normalizeId(item.warehouse),
        name: item.name || "",
        code: item.code || "",
        locationType: item.locationType || "bin",
        parent: normalizeId(item.parent),
        description: item.description || "",
        barcode: item.barcode || "",
        capacityQuantity: String(item.capacityQuantity ?? 0),
        sortOrder: String(item.sortOrder ?? 0),
        isReceivable: Boolean(item.isReceivable),
        isPickable: Boolean(item.isPickable),
        isDispatchable: Boolean(item.isDispatchable),
        isQuarantine: Boolean(item.isQuarantine),
        status: item.status || "active",
      })

      setModal({ open: true, item })

      await loadParentTree(normalizeId(item.warehouse), {
        target: "form",
        excludeId: item._id,
      })
    } catch (error) {
      toast.error(
        error.message || "Failed to load warehouse location"
      )
    } finally {
      setOpeningLocationId("")
    }
  }

  const openDetailsModal = async (location) => {
    setLoadingDetailsId(location._id)

    try {
      const data = await api(
        `/inventory/warehouse-locations/${location._id}`
      )

      setDetailsModal({
        open: true,
        location: data.location,
      })
    } catch (error) {
      toast.error(
        error.message || "Failed to load location details"
      )
    } finally {
      setLoadingDetailsId("")
    }
  }

  const closeModal = () => {
    if (saving) return

    setFormError("")
    setModal({ open: false, item: null })
    setForm(emptyLocationForm)
    setFormParentOptions([])
  }

  const updateWarehouse = async (warehouseId) => {
    setForm((previous) => ({
      ...previous,
      warehouse: warehouseId,
      parent: "",
    }))

    await loadParentTree(warehouseId, {
      target: "form",
      excludeId: modal.item?._id || "",
    })
  }

  const updateQuarantine = (isQuarantine) => {
    setForm((previous) => ({
      ...previous,
      isQuarantine,
      isPickable: isQuarantine
        ? false
        : previous.isPickable,
      isDispatchable: isQuarantine
        ? false
        : previous.isDispatchable,
    }))
  }

  const updateLocationType = (locationType) => {
    setForm((previous) => {
      if (locationType === "quarantine") {
        return {
          ...previous,
          locationType,
          isQuarantine: true,
          isPickable: false,
          isDispatchable: false,
        }
      }

      return {
        ...previous,
        locationType,
      }
    })
  }

  const saveLocation = async (event) => {
    event.preventDefault()
    setFormError("")

    const warehouse = warehouseMap.get(String(form.warehouse))
    const parent = formParentOptions.find(
      (item) => String(item._id) === String(form.parent)
    )

    const name = clean(form.name)
    const code = clean(form.code).toUpperCase()
    const barcode = clean(form.barcode).toUpperCase()
    const capacityQuantity = Number(form.capacityQuantity || 0)
    const sortOrder = Number(form.sortOrder || 0)

    if (!form.warehouse) {
      return setFormError("Warehouse is required.")
    }

    if (!name) {
      return setFormError("Location name is required.")
    }

    if (!code) {
      return setFormError("Location code is required.")
    }

    if (
      !Number.isFinite(capacityQuantity) ||
      capacityQuantity < 0
    ) {
      return setFormError(
        "Capacity quantity must be a valid non-negative number."
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

    if (
      form.status === "active" &&
      warehouse?.status !== "active"
    ) {
      return setFormError(
        "An active location requires an active warehouse."
      )
    }

    if (
      form.status === "active" &&
      form.parent &&
      parent?.status !== "active"
    ) {
      return setFormError(
        "An active location requires an active parent location."
      )
    }

    const payload = {
      warehouse: form.warehouse,
      name,
      code,
      locationType: form.locationType,
      parent: form.parent || null,
      description: clean(form.description),
      barcode,
      capacityQuantity,
      sortOrder,
      isReceivable: Boolean(form.isReceivable),
      isPickable: form.isQuarantine
        ? false
        : Boolean(form.isPickable),
      isDispatchable: form.isQuarantine
        ? false
        : Boolean(form.isDispatchable),
      isQuarantine: Boolean(form.isQuarantine),
      status: form.status,
    }

    setSaving(true)

    try {
      await api(
        modal.item?._id
          ? `/inventory/warehouse-locations/${modal.item._id}`
          : "/inventory/warehouse-locations",
        {
          method: modal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      )

      toast.success(
        modal.item
          ? "Warehouse location updated"
          : "Warehouse location created"
      )

      setModal({ open: false, item: null })
      setForm(emptyLocationForm)
      setFormError("")
      setFormParentOptions([])

      await Promise.all([
        activeTab === "tree" ? loadTree() : loadLocations(),
        loadParentTree(filters.warehouse, {
          target: "filter",
        }),
      ])
    } catch (error) {
      setFormError(
        error.message || "Failed to save warehouse location."
      )
    } finally {
      setSaving(false)
    }
  }

  const updateLocationStatus = async (location, status) => {
    if (status === location.status) return

    try {
      await api(
        `/inventory/warehouse-locations/${location._id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      )

      toast.success(
        `Location marked as ${pretty(status).toLowerCase()}`
      )

      await Promise.all([
        activeTab === "tree" ? loadTree() : loadLocations(),
        loadParentTree(filters.warehouse, {
          target: "filter",
        }),
      ])
    } catch (error) {
      toast.error(
        error.message || "Failed to update location status"
      )
    }
  }

  const archiveLocation = async (location) => {
    const confirmed = window.confirm(
      `Archive "${location.name}"? Move or archive child locations first. The location must not contain stock balances or pending quantities.`
    )

    if (!confirmed) return

    try {
      await api(
        `/inventory/warehouse-locations/${location._id}`,
        {
          method: "DELETE",
        }
      )

      toast.success("Warehouse location archived safely")

      await Promise.all([
        activeTab === "tree" ? loadTree() : loadLocations(),
        loadParentTree(filters.warehouse, {
          target: "filter",
        }),
      ])
    } catch (error) {
      toast.error(
        error.message || "Failed to archive warehouse location"
      )
    }
  }

  const restoreLocation = async (location) => {
    try {
      await api(
        `/inventory/warehouse-locations/${location._id}/restore`,
        {
          method: "PATCH",
        }
      )

      toast.success("Warehouse location restored as inactive")

      await Promise.all([
        loadLocations(),
        loadParentTree(filters.warehouse, {
          target: "filter",
        }),
      ])
    } catch (error) {
      toast.error(
        error.message || "Failed to restore warehouse location"
      )
    }
  }

  const getWarehouseName = (location) =>
    relationLabel(
      location.warehouse ||
        warehouseMap.get(String(normalizeId(location.warehouse))),
      "Unknown warehouse"
    )

  const getParentName = (location) =>
    relationLabel(location.parent, "Root location")

  const showingCount =
    activeTab === "tree" ? visibleTreeCount : locations.length

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster position="top-right" />

      <section className={cn(card, "mb-6 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon
                icon={HierarchySquare01Icon}
                className="h-5 w-5"
                strokeWidth={1.9}
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Warehouse Locations
              </h1>

              <p className="mt-0.5 text-sm text-gray-500">
                Organize warehouse zones, aisles, racks, shelves,
                bins, and operational areas in a controlled hierarchy.
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

            {canManage && activeTab !== "archived" ? (
              <button
                className={cn(button, primaryButton)}
                onClick={openCreateModal}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Location
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
            warehouseName={selectedWarehouseName}
            parentName={selectedParentName}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing{" "}
            <span className="text-gray-900">{showingCount}</span>{" "}
            {activeTab === "tree"
              ? "tree items"
              : activeTab === "archived"
                ? "archived locations"
                : "locations"}
            {activeTab !== "tree" && hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only location access. Create, edit,
          status, archive, and restore controls are hidden.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {[
            {
              key: "current",
              label: "Current",
              icon: FolderLibraryIcon,
            },
            {
              key: "tree",
              label: "Hierarchy",
              icon: HierarchySquare01Icon,
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
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-extrabold transition sm:px-5 sm:text-sm",
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

      {activeTab === "tree" ? (
        <LocationTree
          locations={visibleTree}
          loading={loading}
          hasWarehouse={filters.warehouse !== "all"}
          openingLocationId={openingLocationId}
          loadingDetailsId={loadingDetailsId}
          getWarehouseName={getWarehouseName}
          onView={openDetailsModal}
          onEdit={openEditModal}
          onStatusChange={updateLocationStatus}
          onArchive={archiveLocation}
          onRestore={restoreLocation}
          canManage={canManage}
          canDelete={canDelete}
        />
      ) : (
        <LocationList
          locations={locations}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          openingLocationId={openingLocationId}
          loadingDetailsId={loadingDetailsId}
          getWarehouseName={getWarehouseName}
          getParentName={getParentName}
          onView={openDetailsModal}
          onEdit={openEditModal}
          onStatusChange={updateLocationStatus}
          onArchive={archiveLocation}
          onRestore={restoreLocation}
          onLoadMore={() => loadLocations({ append: true })}
          canManage={canManage}
          canDelete={canDelete}
        />
      )}

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        activeTab={activeTab}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        warehouses={warehouses}
        parentOptions={filterParentOptions}
        selectedWarehouseName={selectedWarehouseName}
        selectedParentName={selectedParentName}
      />

      <LocationFormModal
        open={modal.open}
        item={modal.item}
        form={form}
        setForm={setForm}
        warehouses={warehouses}
        parentOptions={formParentOptions}
        error={formError}
        saving={saving}
        onClose={closeModal}
        onSubmit={saveLocation}
        onWarehouseChange={updateWarehouse}
        onLocationTypeChange={updateLocationType}
        onQuarantineChange={updateQuarantine}
      />

      <LocationDetailsModal
        state={detailsModal}
        onClose={() =>
          setDetailsModal({
            open: false,
            location: null,
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
  warehouses,
  parentOptions,
  selectedWarehouseName,
  selectedParentName,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Location filters"
      subtitle="Filter warehouse locations by hierarchy, type, status, and operational purpose."
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Warehouse"
          required={activeTab === "tree"}
          hint={
            activeTab === "tree"
              ? "A warehouse is required for hierarchy view."
              : undefined
          }
        >
          <select
            className={input}
            value={filters.warehouse}
            onChange={(event) =>
              updateFilter("warehouse", event.target.value)
            }
          >
            {activeTab !== "tree" ? (
              <option value="all">All warehouses</option>
            ) : (
              <option value="all">Select warehouse</option>
            )}

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
                {warehouse.status === "inactive"
                  ? " — Inactive"
                  : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Location Type">
          <select
            className={input}
            value={filters.locationType}
            onChange={(event) =>
              updateFilter("locationType", event.target.value)
            }
          >
            <option value="all">All location types</option>

            {LOCATION_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

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

              {LOCATION_STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : activeTab === "archived" ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-sm font-black text-amber-800">
              Archived locations
            </p>

            <p className="mt-1 text-xs font-semibold text-amber-700">
              This tab only shows archived records.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-gray-900">
                  Include Inactive
                </p>

                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Show active and inactive locations in the tree.
                </p>
              </div>

              <Toggle
                checked={Boolean(filters.includeInactive)}
                onChange={(value) =>
                  updateFilter("includeInactive", value)
                }
                label="Include inactive tree locations"
              />
            </div>
          </div>
        )}

        {activeTab !== "tree" ? (
          <Field label="Parent Location">
            <select
              className={input}
              value={filters.parent}
              onChange={(event) =>
                updateFilter("parent", event.target.value)
              }
              disabled={filters.warehouse === "all"}
            >
              <option value="all">All hierarchy levels</option>
              <option value="root">Root locations only</option>

              {filters.parent !== "all" &&
              filters.parent !== "root" &&
              !parentOptions.some(
                (location) =>
                  String(location._id) ===
                  String(filters.parent)
              ) ? (
                <option value={filters.parent}>
                  {selectedParentName || "Selected parent"}
                </option>
              ) : null}

              {parentOptions.map((location) => (
                <option key={location._id} value={location._id}>
                  {"— ".repeat(location.treeDepth)}
                  {relationLabel(location)}
                  {location.status === "inactive"
                    ? " — Inactive"
                    : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Picking">
          <select
            className={input}
            value={filters.isPickable}
            onChange={(event) =>
              updateFilter("isPickable", event.target.value)
            }
          >
            <option value="all">Pickable + Not pickable</option>
            <option value="true">Pickable only</option>
            <option value="false">Not pickable only</option>
          </select>
        </Field>

        <Field label="Receiving">
          <select
            className={input}
            value={filters.isReceivable}
            onChange={(event) =>
              updateFilter("isReceivable", event.target.value)
            }
          >
            <option value="all">
              Receivable + Not receivable
            </option>
            <option value="true">Receivable only</option>
            <option value="false">Not receivable only</option>
          </select>
        </Field>

        <Field label="Quarantine">
          <select
            className={input}
            value={filters.isQuarantine}
            onChange={(event) =>
              updateFilter("isQuarantine", event.target.value)
            }
          >
            <option value="all">
              Quarantine + Standard locations
            </option>
            <option value="true">Quarantine only</option>
            <option value="false">Non-quarantine only</option>
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
            warehouseName={selectedWarehouseName}
            parentName={selectedParentName}
          />
        </div>
      </div>
    </ModalShell>
  )
}

function LocationList({
  locations,
  loading,
  loadingMore,
  hasMore,
  openingLocationId,
  loadingDetailsId,
  getWarehouseName,
  getParentName,
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
          <table className="min-w-[1420px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Parent</th>
                <th className="px-5 py-3">Depth</th>
                <th className="px-5 py-3">Capacity</th>
                <th className="px-5 py-3">Capabilities</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {locations.map((location) => (
                <tr
                  key={location._id}
                  className="group bg-white transition hover:bg-gray-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="min-w-[240px]">
                      <p className="truncate text-sm font-black text-gray-900">
                        {location.name}
                      </p>

                      <p className="mt-0.5 text-xs font-black text-indigo-700">
                        {location.code}
                      </p>

                      <p className="mt-0.5 max-w-[260px] truncate text-xs font-semibold text-gray-500">
                        {location.barcode || "No barcode"}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {getWarehouseName(location)}
                  </td>

                  <td className="px-5 py-4">
                    <LocationTypeBadge
                      value={location.locationType}
                    />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {getParentName(location)}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {location.depth ?? 0}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {formatNumber(location.capacityQuantity)}
                  </td>

                  <td className="px-5 py-4">
                    <CapabilityBadges location={location} />
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {location.sortOrder ?? 0}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge value={location.status} />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                    {formatDate(location.updatedAt)}
                  </td>

                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                    <LocationActions
                      location={location}
                      opening={
                        String(openingLocationId) ===
                        String(location._id)
                      }
                      loadingDetails={
                        String(loadingDetailsId) ===
                        String(location._id)
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

              {!locations.length ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-14 text-center text-sm font-bold text-gray-500"
                  >
                    {loading
                      ? "Loading warehouse locations..."
                      : "No warehouse locations found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {locations.map((location) => (
            <LocationMobileCard
              key={location._id}
              location={location}
              warehouseName={getWarehouseName(location)}
              parentName={getParentName(location)}
              opening={
                String(openingLocationId) === String(location._id)
              }
              loadingDetails={
                String(loadingDetailsId) === String(location._id)
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

          {!locations.length ? (
            <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
              {loading
                ? "Loading warehouse locations..."
                : "No warehouse locations found."}
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

function LocationMobileCard({
  location,
  warehouseName,
  parentName,
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
          {location.code?.slice(0, 4)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-900">
                {location.name}
              </h3>

              <p className="mt-0.5 text-xs font-black text-indigo-700">
                {location.code}
              </p>
            </div>

            <StatusBadge value={location.status} />
          </div>

          <div className="mt-2">
            <LocationTypeBadge value={location.locationType} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <div>
              <p className="font-bold text-gray-400">Warehouse</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {warehouseName}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Parent</p>
              <p className="mt-1 truncate font-black text-gray-700">
                {parentName}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Depth</p>
              <p className="mt-1 font-black text-gray-700">
                {location.depth ?? 0}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Capacity</p>
              <p className="mt-1 font-black text-gray-700">
                {formatNumber(location.capacityQuantity)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <CapabilityBadges location={location} />
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <LocationActions
              location={location}
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

function CapabilityBadges({ location }) {
  return (
    <div className="flex max-w-[280px] flex-wrap gap-1.5">
      <CapabilityBadge
        enabled={location.isReceivable}
        label="Receive"
      />
      <CapabilityBadge
        enabled={location.isPickable}
        label="Pick"
      />
      <CapabilityBadge
        enabled={location.isDispatchable}
        label="Dispatch"
      />
      <CapabilityBadge
        enabled={location.isQuarantine}
        label="Quarantine"
      />
    </div>
  )
}

function LocationActions({
  location,
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
  if (location.status === "archived") {
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
          onClick={() => onView(location)}
          disabled={loadingDetails}
          type="button"
          title="View location"
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
            onClick={() => onRestore(location)}
            type="button"
            title="Restore location"
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
        onClick={() => onView(location)}
        disabled={loadingDetails}
        type="button"
        title="View location"
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
              "rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-black text-gray-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20",
              mobile ? "min-w-[126px]" : "w-[112px]"
            )}
            value={location.status}
            onChange={(event) =>
              onStatusChange(location, event.target.value)
            }
            aria-label={`Update ${location.name} status`}
          >
            {LOCATION_STATUSES.map(([value, label]) => (
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
            onClick={() => onEdit(location)}
            disabled={opening}
            type="button"
            title="Edit location"
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
          onClick={() => onArchive(location)}
          type="button"
          title="Archive location"
        >
          <Icon icon={Archive02Icon} className="h-4 w-4" />
          {mobile ? "Archive" : null}
        </button>
      ) : null}
    </div>
  )
}

function LocationTree({
  locations,
  loading,
  hasWarehouse,
  openingLocationId,
  loadingDetailsId,
  getWarehouseName,
  onView,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  canManage,
  canDelete,
}) {
  return (
    <div className={cn(card, "p-3 sm:p-4")}>
      {!hasWarehouse ? (
        <div className="px-5 py-14 text-center">
          <Icon
            icon={HierarchySquare01Icon}
            className="mx-auto h-8 w-8 text-gray-300"
          />

          <p className="mt-3 text-sm font-black text-gray-700">
            Select a warehouse
          </p>

          <p className="mt-1 text-sm font-semibold text-gray-500">
            A warehouse is required to display its location hierarchy.
          </p>
        </div>
      ) : locations.length ? (
        <div className="space-y-2">
          {locations.map((location) => (
            <LocationTreeNode
              key={location._id}
              location={location}
              depth={0}
              openingLocationId={openingLocationId}
              loadingDetailsId={loadingDetailsId}
              getWarehouseName={getWarehouseName}
              onView={onView}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              onRestore={onRestore}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
          {loading
            ? "Loading location hierarchy..."
            : "No locations found in this hierarchy."}
        </div>
      )}
    </div>
  )
}

function LocationTreeNode({
  location,
  depth,
  openingLocationId,
  loadingDetailsId,
  getWarehouseName,
  onView,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  canManage,
  canDelete,
}) {
  const hasChildren = Boolean(location.children?.length)
  const [expanded, setExpanded] = useState(depth < 2)

  return (
    <div>
      <div
        className="rounded-2xl border border-gray-100 bg-white p-3 transition hover:border-indigo-100 hover:bg-indigo-50/20 sm:p-4"
        style={{ marginLeft: `${Math.min(depth, 5) * 16}px` }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() =>
                hasChildren && setExpanded((value) => !value)
              }
              disabled={!hasChildren}
              className={cn(
                "mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition",
                hasChildren
                  ? "bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700"
                  : "text-gray-300"
              )}
              aria-label={
                hasChildren
                  ? expanded
                    ? "Collapse location"
                    : "Expand location"
                  : "No child locations"
              }
            >
              <Icon
                icon={
                  hasChildren && expanded
                    ? ArrowDown01Icon
                    : ArrowRight01Icon
                }
                className="h-4 w-4"
              />
            </button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 px-2 text-center text-xs font-black text-indigo-700">
              {location.code?.slice(0, 4)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-black text-gray-900">
                  {location.name}
                </h3>

                <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700">
                  {location.code}
                </span>

                <LocationTypeBadge
                  value={location.locationType}
                />

                <StatusBadge value={location.status} />
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-gray-500">
                <span>Warehouse: {getWarehouseName(location)}</span>
                <span>Depth: {location.depth ?? depth}</span>
                <span>Order: {location.sortOrder ?? 0}</span>
                <span>
                  {location.children?.length || 0} child
                  {location.children?.length === 1 ? "" : "ren"}
                </span>
              </div>

              <div className="mt-2">
                <CapabilityBadges location={location} />
              </div>
            </div>
          </div>

          <LocationActions
            location={location}
            opening={
              String(openingLocationId) === String(location._id)
            }
            loadingDetails={
              String(loadingDetailsId) === String(location._id)
            }
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

      {hasChildren && expanded ? (
        <div className="mt-2 space-y-2">
          {location.children.map((child) => (
            <LocationTreeNode
              key={child._id}
              location={child}
              depth={depth + 1}
              openingLocationId={openingLocationId}
              loadingDetailsId={loadingDetailsId}
              getWarehouseName={getWarehouseName}
              onView={onView}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              onRestore={onRestore}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LocationFormModal({
  open,
  item,
  form,
  setForm,
  warehouses,
  parentOptions,
  error,
  saving,
  onClose,
  onSubmit,
  onWarehouseChange,
  onLocationTypeChange,
  onQuarantineChange,
}) {
  const selectedWarehouse = warehouses.find(
    (warehouse) =>
      String(warehouse._id) === String(form.warehouse)
  )

  const selectedParent = parentOptions.find(
    (location) =>
      String(location._id) === String(form.parent)
  )

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={
        item ? "Update warehouse location" : "Add warehouse location"
      }
      subtitle={
        item
          ? form.name || "Edit warehouse location information."
          : "Create a warehouse location and place it in the hierarchy."
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
            form="warehouse-location-form"
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
                ? "Update location"
                : "Save location"}
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

      <form id="warehouse-location-form" onSubmit={onSubmit}>
        <div className="space-y-4">
          <SectionCard
            title="Location identity"
            description="Assign the location to a warehouse and define its hierarchy."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="Warehouse" required>
                <select
                  className={input}
                  value={form.warehouse}
                  onChange={(event) =>
                    onWarehouseChange(event.target.value)
                  }
                  required
                >
                  <option value="">Select warehouse</option>

                  {form.warehouse &&
                  !warehouses.some(
                    (warehouse) =>
                      String(warehouse._id) ===
                      String(form.warehouse)
                  ) ? (
                    <option value={form.warehouse}>
                      {relationLabel(
                        item?.warehouse,
                        "Current warehouse"
                      )}
                    </option>
                  ) : null}

                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse._id}
                      value={warehouse._id}
                      disabled={
                        form.status === "active" &&
                        warehouse.status !== "active"
                      }
                    >
                      {relationLabel(warehouse)}
                      {warehouse.status === "inactive"
                        ? " — Inactive"
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Location Name" required>
                <FocusPlaceholderInput
                  className={input}
                  value={form.name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: Rack A-01"
                  maxLength={160}
                  required
                />
              </Field>

              <Field label="Location Code" required>
                <FocusPlaceholderInput
                  className={input}
                  value={form.code}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Example: RACK-A-01"
                  maxLength={60}
                  required
                />
              </Field>

              <Field label="Location Type" required>
                <select
                  className={input}
                  value={form.locationType}
                  onChange={(event) =>
                    onLocationTypeChange(event.target.value)
                  }
                  required
                >
                  {LOCATION_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Parent Location"
                hint="Leave empty to create a root location. Maximum hierarchy depth is 20."
              >
                <select
                  className={input}
                  value={form.parent}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      parent: event.target.value,
                    }))
                  }
                  disabled={!form.warehouse}
                >
                  <option value="">No parent — root location</option>

                  {form.parent &&
                  !parentOptions.some(
                    (location) =>
                      String(location._id) ===
                      String(form.parent)
                  ) ? (
                    <option value={form.parent}>
                      {relationLabel(
                        item?.parent,
                        "Current parent"
                      )}
                    </option>
                  ) : null}

                  {parentOptions.map((location) => (
                    <option
                      key={location._id}
                      value={location._id}
                      disabled={
                        form.status === "active" &&
                        location.status !== "active"
                      }
                    >
                      {"— ".repeat(location.treeDepth)}
                      {relationLabel(location)}
                      {location.status === "inactive"
                        ? " — Inactive"
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status" required>
                <select
                  className={input}
                  value={form.status}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      status: event.target.value,
                      parent:
                        event.target.value === "active" &&
                        selectedParent?.status !== "active"
                          ? ""
                          : previous.parent,
                      warehouse:
                        event.target.value === "active" &&
                        selectedWarehouse?.status !== "active"
                          ? ""
                          : previous.warehouse,
                    }))
                  }
                  required
                >
                  {LOCATION_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Barcode" hint="Optional">
                <FocusPlaceholderInput
                  className={input}
                  value={form.barcode}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      barcode: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Scan or enter location barcode"
                  maxLength={120}
                />
              </Field>

              <Field label="Capacity Quantity">
                <FocusPlaceholderInput
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.capacityQuantity}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      capacityQuantity: event.target.value,
                    }))
                  }
                  placeholder="Example: 500"
                />
              </Field>

              <Field label="Sort Order">
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
                />
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
                    placeholder="Describe the location purpose and storage rules..."
                    maxLength={1500}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Operational capabilities"
            description="Control where inventory can be received, picked, dispatched, or quarantined."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CapabilityToggle
                label="Receivable"
                description="Allow incoming stock to be received here."
                checked={form.isReceivable}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    isReceivable: value,
                  }))
                }
              />

              <CapabilityToggle
                label="Pickable"
                description="Allow stock to be picked for outgoing operations."
                checked={form.isPickable}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    isPickable: value,
                  }))
                }
                disabled={form.isQuarantine}
              />

              <CapabilityToggle
                label="Dispatchable"
                description="Allow stock to be dispatched from this location."
                checked={form.isDispatchable}
                onChange={(value) =>
                  setForm((previous) => ({
                    ...previous,
                    isDispatchable: value,
                  }))
                }
                disabled={form.isQuarantine}
              />

              <CapabilityToggle
                label="Quarantine"
                description="Isolate stock from normal picking and dispatch."
                checked={form.isQuarantine}
                onChange={onQuarantineChange}
              />
            </div>

            {form.isQuarantine ? (
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                Quarantine locations cannot be pickable or
                dispatchable. Those controls are disabled
                automatically.
              </div>
            ) : null}
          </SectionCard>
        </div>
      </form>
    </ModalShell>
  )
}

function CapabilityToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-gray-900">
            {label}
          </p>

          <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
            {description}
          </p>
        </div>

        <Toggle
          checked={Boolean(checked)}
          onChange={onChange}
          disabled={disabled}
          label={label}
        />
      </div>
    </div>
  )
}

function LocationDetailsModal({ state, onClose }) {
  const location = state.location

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title={location?.name || "Location details"}
      subtitle={
        location
          ? `${location.code} · ${pretty(
              location.locationType
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
      {location ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Location information">
              <div className="space-y-3 text-sm">
                <DetailRow
                  label="Warehouse"
                  value={relationLabel(
                    location.warehouse,
                    "Unknown warehouse"
                  )}
                />
                <DetailRow
                  label="Status"
                  value={<StatusBadge value={location.status} />}
                />
                <DetailRow
                  label="Type"
                  value={
                    <LocationTypeBadge
                      value={location.locationType}
                    />
                  }
                />
                <DetailRow
                  label="Parent"
                  value={relationLabel(
                    location.parent,
                    "Root location"
                  )}
                />
                <DetailRow
                  label="Depth"
                  value={location.depth ?? 0}
                />
                <DetailRow
                  label="Sort order"
                  value={location.sortOrder ?? 0}
                />
                <DetailRow
                  label="Capacity"
                  value={formatNumber(
                    location.capacityQuantity
                  )}
                />
                <DetailRow
                  label="Barcode"
                  value={location.barcode || "-"}
                />
              </div>
            </SectionCard>

            <SectionCard title="Operational capabilities">
              <CapabilityBadges location={location} />

              <div className="mt-4 space-y-3 text-sm">
                <DetailRow
                  label="Receivable"
                  value={location.isReceivable ? "Yes" : "No"}
                />
                <DetailRow
                  label="Pickable"
                  value={location.isPickable ? "Yes" : "No"}
                />
                <DetailRow
                  label="Dispatchable"
                  value={
                    location.isDispatchable ? "Yes" : "No"
                  }
                />
                <DetailRow
                  label="Quarantine"
                  value={location.isQuarantine ? "Yes" : "No"}
                />
              </div>
            </SectionCard>
          </div>

          {location.ancestors?.length ? (
            <SectionCard
              title="Hierarchy path"
              description="Ancestors from the warehouse root to the selected parent."
            >
              <div className="flex flex-wrap items-center gap-2">
                {location.ancestors.map((ancestor, index) => (
                  <div
                    key={ancestor._id || index}
                    className="flex items-center gap-2"
                  >
                    {index ? (
                      <Icon
                        icon={ArrowRight01Icon}
                        className="h-4 w-4 text-gray-300"
                      />
                    ) : null}

                    <span className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700">
                      {relationLabel(ancestor)}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {location.description ? (
            <SectionCard title="Description">
              <p className="text-sm font-semibold leading-6 text-gray-600">
                {location.description}
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
