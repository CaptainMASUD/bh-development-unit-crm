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
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  FilterIcon,
  FloppyDiskIcon,
  Folder01Icon,
  FolderLibraryIcon,
  HierarchySquare01Icon,
  Image01Icon,
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const CATEGORY_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_CATEGORY_MANAGE || "inventory-category:manage"

const CATEGORY_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_CATEGORY_DELETE || "inventory-category:delete"

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"

const btnPrimary =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"

const btnGhost =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"

const btnDanger =
  "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"

const btnWarning =
  "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50"

const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

const chip =
  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

const emptyCategoryForm = {
  name: "",
  code: "",
  slug: "",
  parent: "",
  description: "",
  imageUrl: "",
  sortOrder: "0",
  status: "active",
}

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

function normalizeId(value) {
  return value?._id || value || ""
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
}

function flattenTree(nodes = [], depth = 0, result = []) {
  for (const node of nodes) {
    result.push({ ...node, depth })
    flattenTree(node.children || [], depth + 1, result)
  }

  return result
}

function countTreeNodes(nodes = []) {
  return nodes.reduce(
    (total, node) => total + 1 + countTreeNodes(node.children || []),
    0
  )
}

function filterCategoryTree(nodes = [], query = "") {
  const search = clean(query).toLowerCase()
  if (!search) return nodes

  return nodes.reduce((result, node) => {
    const children = filterCategoryTree(node.children || [], search)
    const matches = [node.name, node.code, node.slug]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search))

    if (matches || children.length) {
      result.push({ ...node, children })
    }

    return result
  }, [])
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
  return <div className={cn("animate-pulse rounded-lg bg-gray-200/80", className)} aria-hidden="true" />
}

function CategoryTableSkeleton({ rows = 7 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`category-skeleton-${index}`}>
      <td className="border-b border-gray-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-11 w-11 rounded-2xl" />
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-3 w-52" />
          </div>
        </div>
      </td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-20" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-6 w-32 rounded-lg" /></td>
      <td className="border-b border-gray-100 px-5 py-3"><SkeletonBlock className="h-4 w-28" /></td>
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

function CategoryMobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <div key={`category-mobile-skeleton-${index}`} className="p-4">
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

function CategoryTreeSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`category-tree-skeleton-${index}`}
          className="rounded-2xl border border-gray-100 bg-white p-4"
          style={{ marginLeft: `${Math.min(index % 3, 2) * 16}px` }}
        >
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-8 w-8 rounded-lg" />
            <SkeletonBlock className="h-11 w-11 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-44 max-w-full" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
            <SkeletonBlock className="h-7 w-20 rounded-full" />
            <SkeletonBlock className="h-10 w-20 rounded-xl" />
            <SkeletonBlock className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
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

function StatusBadge({ value }) {
  const key = String(value || "").toLowerCase()

  const style =
    key === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : key === "inactive"
        ? "bg-gray-100 text-gray-700 ring-gray-200"
        : key === "archived"
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
          key === "active"
            ? "bg-emerald-500"
            : key === "inactive"
              ? "bg-gray-400"
              : key === "archived"
                ? "bg-amber-500"
                : "bg-slate-400"
        )}
      />
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

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.()
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
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
    throw new Error(data?.message || data?.error || "Request failed")
  }

  return data
}

function HeaderSearchFilters({
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  parentName,
  onOpenFilters,
}) {
  const chipCount = [
    filters.status !== "all",
    filters.parent !== "all",
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

        {filters.status !== "all" ? (
          <FilterChip label="Status" value={pretty(filters.status)} onClear={() => updateFilter("status", "all")} />
        ) : null}

        {filters.parent !== "all" ? (
          <FilterChip
            label="Parent"
            value={filters.parent === "root" ? "Root categories" : parentName || "Selected category"}
            onClear={() => updateFilter("parent", "all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[120px] flex-[1_1_170px] border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 shadow-none outline-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ boxShadow: "none" }}
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search category name, code or slug..."
          type="text"
          aria-label="Search product categories"
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
          {activeFilterCount ? <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{activeFilterCount}</span> : null}
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

export default function ProductCategorySetup() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, CATEGORY_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, CATEGORY_DELETE_PERMISSION)

  const [activeTab, setActiveTab] = useState("list")
  const [categories, setCategories] = useState([])
  const [categoryTree, setCategoryTree] = useState([])
  const [directoryTree, setDirectoryTree] = useState([])
  const [parentOptions, setParentOptions] = useState([])

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

  const [form, setForm] = useState(emptyCategoryForm)
  const [formError, setFormError] = useState("")

  const [detailsModal, setDetailsModal] = useState({ open: false, item: null })
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
  const [actionBusy, setActionBusy] = useState({ id: "", type: "" })

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    parent: "all",
  })

  const directoryItems = useMemo(
    () => flattenTree(directoryTree),
    [directoryTree]
  )

  const parentMap = useMemo(() => {
    const map = new Map()

    for (const item of directoryItems) {
      map.set(String(item._id), item)
    }

    return map
  }, [directoryItems])

  const selectedParentRecord = useMemo(() => {
    if (filters.parent === "all" || filters.parent === "root") return null
    return parentMap.get(String(filters.parent)) || null
  }, [filters.parent, parentMap])

  const selectedParentName = selectedParentRecord?.name || ""

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (clean(filters.q)) count += 1
    if (filters.status !== "all") count += 1
    if (filters.parent !== "all") count += 1

    return count
  }, [filters])

  const visibleTree = useMemo(
    () => filterCategoryTree(categoryTree, filters.q),
    [categoryTree, filters.q]
  )

  const visibleTreeCount = useMemo(
    () => countTreeNodes(visibleTree),
    [visibleTree]
  )

  const showingCount =
    activeTab === "list" ? categories.length : visibleTreeCount

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
      parent: "all",
    })
  }

  const loadDirectory = async () => {
    try {
      const data = await api("/inventory/categories/tree?status=all")
      setDirectoryTree(data.categories || [])
    } catch (error) {
      toast.error(error.message || "Failed to load category hierarchy")
    }
  }

  const loadParentOptions = async (excludeId = "") => {
    try {
      const params = new URLSearchParams({
        limit: "200",
      })

      if (excludeId) params.set("exclude", excludeId)

      const data = await api(
        `/inventory/categories/options?${params.toString()}`
      )

      setParentOptions(data.categories || [])
    } catch (error) {
      toast.error(error.message || "Failed to load parent categories")
    }
  }

  const loadCategories = async ({
    append = false,
    showLoader = true,
  } = {}) => {
    if (append) setLoadingMore(true)
    else if (showLoader) setLoading(true)

    try {
      const params = new URLSearchParams({
        limit: "40",
      })

      if (clean(filters.q)) params.set("q", clean(filters.q))
      if (filters.status !== "all") {
        params.set("status", filters.status)
      }

      if (filters.parent === "root") {
        params.set("parent", "root")
      } else if (filters.parent !== "all") {
        params.set("parent", filters.parent)
      }

      if (append && nextCursor) {
        params.set("cursor", nextCursor)
      }

      const data = await api(
        `/inventory/categories?${params.toString()}`
      )

      const incoming = data.categories || []

      setCategories((previous) =>
        append ? [...previous, ...incoming] : incoming
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      toast.error(error.message || "Failed to load product categories")
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  const loadTree = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)

    try {
      const params = new URLSearchParams()

      if (filters.status !== "all") {
        params.set("status", filters.status)
      }

      const suffix = params.toString() ? `?${params.toString()}` : ""
      const data = await api(`/inventory/categories/tree${suffix}`)

      let roots = data.categories || []

      if (filters.parent === "root") {
        roots = roots.filter((category) => !category.parent)
      } else if (filters.parent !== "all") {
        const parentId = String(filters.parent)

        const findSubtree = (nodes) => {
          for (const node of nodes) {
            if (String(node._id) === parentId) return [node]

            const nested = findSubtree(node.children || [])
            if (nested.length) return nested
          }

          return []
        }

        roots = findSubtree(roots)
      }

      setCategoryTree(roots)
    } catch (error) {
      toast.error(error.message || "Failed to load category tree")
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  const refresh = async () => {
    await Promise.all([
      activeTab === "list" ? loadCategories() : loadTree(),
      loadDirectory(),
    ])
  }

  useEffect(() => {
    loadDirectory()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTab === "list") {
        loadCategories()
      } else {
        loadTree()
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [activeTab, filters.q, filters.status, filters.parent])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFilterOpen(false)
  }

  const openCreateModal = async () => {
    setFormError("")
    setForm(emptyCategoryForm)
    setModal({ open: true, item: null })
    await loadParentOptions()
  }

  const openEditModal = async (item) => {
    setFormError("")

    setForm({
      name: item.name || "",
      code: item.code || "",
      slug: item.slug || "",
      parent: normalizeId(item.parent),
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      sortOrder: String(item.sortOrder ?? 0),
      status:
        item.status === "archived"
          ? "inactive"
          : item.status || "active",
    })

    setModal({ open: true, item })
    await loadParentOptions(item._id)
  }

  const closeModal = () => {
    setFormError("")
    setModal({ open: false, item: null })
    setForm(emptyCategoryForm)
  }

  const saveCategory = async (event) => {
    event.preventDefault()
    setFormError("")

    const name = clean(form.name)
    const code = clean(form.code).toUpperCase()
    const slug = slugify(form.slug)
    const sortOrder = Number(form.sortOrder)

    if (!name) return setFormError("Category name is required.")
    if (!code) return setFormError("Category code is required.")

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
      modal.item?._id &&
      String(form.parent || "") === String(modal.item._id)
    ) {
      return setFormError("A category cannot be its own parent.")
    }

    const payload = {
      name,
      code,
      parent: form.parent || null,
      description: clean(form.description),
      imageUrl: clean(form.imageUrl),
      sortOrder,
      status: form.status,
    }

    if (slug) payload.slug = slug

    setSaving(true)

    try {
      await api(
        modal.item?._id
          ? `/inventory/categories/${modal.item._id}`
          : "/inventory/categories",
        {
          method: modal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      )

      toast.success(
        modal.item ? "Category updated" : "Category created"
      )

      closeModal()
      await Promise.all([
        activeTab === "list" ? loadCategories() : loadTree(),
        loadDirectory(),
      ])
    } catch (error) {
      setFormError(error.message || "Failed to save category.")
    } finally {
      setSaving(false)
    }
  }

  const openCategoryDetails = (item) => {
    setDetailsModal({ open: true, item })
  }

  const openCategoryAction = (type, item, value = "") => {
    const config =
      type === "status"
        ? {
            title: `Mark category ${pretty(value).toLowerCase()}`,
            message: `Update "${item.name}" from ${pretty(item.status)} to ${pretty(value)}.`,
            danger: value === "inactive",
          }
        : type === "archive"
          ? {
              title: "Archive product category",
              message:
                `Archive "${item.name}"? The category can be restored later. ` +
                "Existing products and child-category relationships remain protected by backend rules.",
              danger: true,
            }
          : {
              title: "Restore product category",
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

  const closeCategoryAction = () => {
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

  const refreshCategoryViews = async () => {
    await Promise.all([
      activeTab === "list"
        ? loadCategories({ showLoader: false })
        : loadTree({ showLoader: false }),
      loadDirectory(),
    ])
  }

  const confirmCategoryAction = async () => {
    const item = actionState.item
    if (!item?._id) return

    setActionState((previous) => ({ ...previous, loading: true, error: "" }))
    setActionBusy({ id: item._id, type: actionState.type })

    try {
      if (actionState.type === "status") {
        await api(`/inventory/categories/${item._id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: actionState.value }),
        })
        toast.success(`Category marked as ${pretty(actionState.value).toLowerCase()}`)
      } else if (actionState.type === "archive") {
        await api(`/inventory/categories/${item._id}`, { method: "DELETE" })
        toast.success("Category archived")
      } else if (actionState.type === "restore") {
        await api(`/inventory/categories/${item._id}/restore`, { method: "PATCH" })
        toast.success("Category restored as inactive")
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
      await refreshCategoryViews()
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

  const getParentName = (category) => {
    const parentId = normalizeId(category.parent)
    if (!parentId) return "Root category"

    return (
      category.parent?.name ||
      parentMap.get(String(parentId))?.name ||
      "Parent category"
    )
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
                Product Categories
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={cn(btn, btnGhost)}
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

            {canManage ? (
              <button
                className={cn(btn, btnPrimary)}
                onClick={openCreateModal}
                type="button"
              >
                <Icon icon={Add01Icon} className="h-4 w-4" />
                Add Category
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <HeaderSearchFilters
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            activeFilterCount={activeFilterCount}
            parentName={selectedParentName}
            onOpenFilters={() => setFilterOpen(true)}
          />

          <p className="shrink-0 text-sm font-bold text-gray-500">
            Showing{" "}
            <span className="text-gray-900">{showingCount}</span>{" "}
            {activeTab === "list" ? "categories" : "tree items"}
            {activeTab === "list" && hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only category access. Category creation, editing,
          status changes, archiving, and restoration controls are hidden.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            {
              key: "list",
              label: "Category List",
              icon: Folder01Icon,
            },
            {
              key: "tree",
              label: "Hierarchy Tree",
              icon: HierarchySquare01Icon,
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

      {activeTab === "list" ? (
        <CategoryList
          categories={categories}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          getParentName={getParentName}
          onView={openCategoryDetails}
          onEdit={openEditModal}
          onAction={openCategoryAction}
          actionBusy={actionBusy}
          onLoadMore={() => loadCategories({ append: true })}
          canManage={canManage}
          canDelete={canDelete}
        />
      ) : (
        <CategoryTree
          categories={visibleTree}
          loading={loading}
          getParentName={getParentName}
          onView={openCategoryDetails}
          onEdit={openEditModal}
          onAction={openCategoryAction}
          actionBusy={actionBusy}
          canManage={canManage}
          canDelete={canDelete}
        />
      )}

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        parentOptions={directoryItems}
        selectedParentName={selectedParentName}
      />

      <CategoryFormModal
        open={modal.open}
        item={modal.item}
        form={form}
        setForm={setForm}
        parentOptions={parentOptions}
        error={formError}
        saving={saving}
        onClose={closeModal}
        onSubmit={saveCategory}
      />

      <CategoryDetailsModal
        state={detailsModal}
        getParentName={getParentName}
        onClose={() => setDetailsModal({ open: false, item: null })}
        onEdit={openEditModal}
        canManage={canManage}
      />

      <ConfirmCategoryActionModal
        state={actionState}
        onClose={closeCategoryAction}
        onConfirm={confirmCategoryAction}
      />
    </div>
  )
}

function FilterModal({
  open,
  onClose,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  parentOptions,
  selectedParentName,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Category filters"
      subtitle="Filter categories by status and hierarchy level."
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
              className={cn(btn, btnGhost)}
              onClick={resetFilters}
              type="button"
            >
              Reset
            </button>

            <button
              className={cn(btn, btnPrimary)}
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
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Status">
          <select
            className={input}
            value={filters.status}
            onChange={(event) =>
              updateFilter("status", event.target.value)
            }
          >
            <option value="all">Current: Active + Inactive</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="archived">Archived only</option>
          </select>
        </Field>

        <Field label="Parent Category">
          <select
            className={input}
            value={filters.parent}
            onChange={(event) =>
              updateFilter("parent", event.target.value)
            }
          >
            <option value="all">All hierarchy levels</option>
            <option value="root">Root categories only</option>

            {parentOptions.map((category) => (
              <option key={category._id} value={category._id}>
                {"— ".repeat(category.depth)}
                {category.name} ({category.code})
              </option>
            ))}
          </select>
        </Field>
      </div>
    </ModalShell>
  )
}

function CategoryList({
  categories,
  loading,
  loadingMore,
  hasMore,
  getParentName,
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
          <table className="min-w-[1080px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50/95 text-[11px] font-black uppercase tracking-wide text-gray-500 backdrop-blur">
              <tr>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Slug</th>
                <th className="px-5 py-3">Parent</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="sticky right-0 bg-gray-50/95 px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <CategoryTableSkeleton />
              ) : categories.length ? (
                categories.map((category) => (
                  <tr key={category._id} className="group bg-white transition hover:bg-indigo-50/30">
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-[240px] items-center gap-3">
                        <CategoryImage category={category} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{category.name}</p>
                          <p className="mt-0.5 max-w-[310px] truncate text-xs font-medium text-gray-500">
                            {category.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-indigo-700">{category.code}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex max-w-[220px] truncate rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                        {category.slug}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-700">{getParentName(category)}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-700">{category.sortOrder ?? 0}</td>
                    <td className="px-5 py-3.5"><StatusBadge value={category.status} /></td>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-600">{formatDate(category.updatedAt)}</td>
                    <td className="sticky right-0 bg-white px-5 py-3 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-indigo-50/30">
                      <CategoryActions
                        category={category}
                        busy={String(actionBusy.id) === String(category._id)}
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
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-3 text-sm font-bold text-gray-900">No product categories found</p>
                    <p className="mt-1 text-sm font-medium text-gray-500">Create a category or adjust the current filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <CategoryMobileSkeleton />
          ) : categories.length ? (
            categories.map((category) => (
              <CategoryMobileCard
                key={category._id}
                category={category}
                parentName={getParentName(category)}
                busy={String(actionBusy.id) === String(category._id)}
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
              <p className="mt-3 text-sm font-bold text-gray-900">No product categories found</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 sm:px-5">
          <p className="text-xs font-medium text-gray-500">{categories.length} categor{categories.length === 1 ? "y" : "ies"} loaded</p>
          {hasMore ? (
            <button className={cn(btn, btnGhost, "min-w-[126px] px-3 py-2")} onClick={onLoadMore} disabled={loadingMore} type="button">
              {loadingMore ? <Spinner /> : <Icon icon={RefreshIcon} className="h-4 w-4" />}
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          ) : (
            <span className="text-xs font-medium text-gray-400">All categories loaded</span>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryMobileCard({
  category,
  parentName,
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
        <CategoryImage category={category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-gray-900">{category.name}</h3>
              <p className="mt-0.5 text-xs font-semibold text-indigo-700">{category.code}</p>
            </div>
            <StatusBadge value={category.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <MiniMetric label="Parent" value={parentName} />
            <MiniMetric label="Sort order" value={String(category.sortOrder ?? 0)} />
            <div className="col-span-2"><MiniMetric label="Slug" value={category.slug || "—"} /></div>
          </div>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <CategoryActions
              category={category}
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

function CategoryImage({ category, size = "h-11 w-11" }) {
  const [failed, setFailed] = useState(false)
  const showImage = clean(category.imageUrl) && !failed

  useEffect(() => {
    setFailed(false)
  }, [category.imageUrl])

  return (
    <div className={cn(
      "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700",
      size
    )}>
      {showImage ? (
        <img src={category.imageUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <Icon icon={Folder01Icon} className="h-5 w-5" />
      )}
    </div>
  )
}

function CategoryActions({
  category,
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
    const estimatedHeight = 260
    const shouldOpenUp = window.innerHeight - rect.bottom < 240
    const top = shouldOpenUp
      ? Math.max(12, rect.top - Math.min(estimatedHeight, window.innerHeight - 24) - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - 12)
    const left = Math.min(Math.max(12, rect.right - menuWidth), Math.max(12, window.innerWidth - menuWidth - 12))
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
  if (category.status !== "archived") {
    if (canManage) {
      items.push(["edit", "Edit category", Edit02Icon])
      if (category.status !== "active") items.push(["status-active", "Mark active", Tick02Icon])
      if (category.status !== "inactive") items.push(["status-inactive", "Mark inactive", Alert02Icon, "warning"])
    }
    if (canDelete) items.push(["archive", "Archive category", Archive02Icon, "danger"])
  } else if (canDelete) {
    items.push(["restore", "Restore category", RestoreBinIcon])
  }

  const handleItem = (key) => {
    setOpen(false)
    if (key === "edit") return onEdit(category)
    if (key.startsWith("status-")) return onAction("status", category, key.replace("status-", ""))
    if (key === "archive") return onAction("archive", category)
    if (key === "restore") return onAction("restore", category)
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
    <div ref={rootRef} className="flex items-center justify-end gap-2">
      <button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onView(category)} disabled={busy} type="button">
        {busy ? <Spinner /> : <Icon icon={ViewIcon} className="h-4 w-4" />}
        <span>View</span>
      </button>
      {(canManage || canDelete) ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !busy && setOpen((previous) => !previous)}
          disabled={busy}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl font-black leading-none text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`More actions for ${category.name}`}
        >
          ⋮
        </button>
      ) : null}
      {menu}
    </div>
  )
}

function CategoryTree({
  categories,
  loading,
  getParentName,
  onView,
  onEdit,
  onAction,
  actionBusy,
  canManage,
  canDelete,
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)] sm:p-4">
      {loading ? (
        <CategoryTreeSkeleton />
      ) : categories.length ? (
        <div className="space-y-2">
          {categories.map((category) => (
            <CategoryTreeNode
              key={category._id}
              category={category}
              depth={0}
              getParentName={getParentName}
              onView={onView}
              onEdit={onEdit}
              onAction={onAction}
              actionBusy={actionBusy}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-14 text-center">
          <Icon icon={HierarchySquare01Icon} className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-bold text-gray-900">No categories found in this hierarchy</p>
        </div>
      )}
    </div>
  )
}

function CategoryTreeNode({
  category,
  depth,
  getParentName,
  onView,
  onEdit,
  onAction,
  actionBusy,
  canManage,
  canDelete,
}) {
  const hasChildren = Boolean(category.children?.length)
  const [expanded, setExpanded] = useState(depth < 2)
  const busy = String(actionBusy.id) === String(category._id)

  return (
    <div>
      <div
        className="rounded-2xl border border-gray-100 bg-white p-3 transition hover:border-indigo-100 hover:bg-indigo-50/20 sm:p-4"
        style={{ marginLeft: `${Math.min(depth, 5) * 16}px` }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => hasChildren && setExpanded((value) => !value)}
              disabled={!hasChildren}
              className={cn(
                "mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition",
                hasChildren
                  ? "bg-gray-100 text-gray-700 hover:bg-indigo-100 hover:text-indigo-700"
                  : "text-gray-300"
              )}
              aria-label={hasChildren ? (expanded ? "Collapse category" : "Expand category") : "No child categories"}
            >
              {hasChildren ? (
                <Icon icon={expanded ? ArrowDown01Icon : ArrowRight01Icon} className="h-4 w-4" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
              )}
            </button>

            <CategoryImage category={category} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-gray-900">{category.name}</h3>
                <StatusBadge value={category.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-gray-500">
                <span className="font-semibold text-indigo-700">{category.code}</span>
                <span>{getParentName(category)}</span>
                <span>{category.slug}</span>
              </div>
            </div>
          </div>

          <CategoryActions
            category={category}
            busy={busy}
            onView={onView}
            onEdit={onEdit}
            onAction={onAction}
            canManage={canManage}
            canDelete={canDelete}
          />
        </div>
      </div>

      {hasChildren && expanded ? (
        <div className="mt-2 space-y-2">
          {category.children.map((child) => (
            <CategoryTreeNode
              key={child._id}
              category={child}
              depth={depth + 1}
              getParentName={getParentName}
              onView={onView}
              onEdit={onEdit}
              onAction={onAction}
              actionBusy={actionBusy}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CategoryDetailsModal({ state, getParentName, onClose, onEdit, canManage }) {
  const category = state.item
  if (!category) return null

  return (
    <ModalShell
      open={state.open}
      onClose={onClose}
      title="Category details"
      subtitle={category.code || ""}
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(btn, btnGhost)} type="button" onClick={onClose}>Close</button>
          {canManage && category.status !== "archived" ? (
            <button className={cn(btn, btnPrimary)} type="button" onClick={() => { onClose(); onEdit(category) }}>
              <Icon icon={Edit02Icon} className="h-4 w-4" />
              Edit
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <CategoryImage category={category} size="h-16 w-16" />
          <div>
            <h3 className="text-xl font-black text-gray-950">{category.name}</h3>
            <div className="mt-2"><StatusBadge value={category.status} /></div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Code" value={category.code || "—"} />
          <DetailItem label="Slug" value={category.slug || "—"} />
          <DetailItem label="Parent" value={getParentName(category)} />
          <DetailItem label="Sort Order" value={String(category.sortOrder ?? 0)} />
          <DetailItem label="Updated" value={formatDate(category.updatedAt)} />
        </div>
        {clean(category.description) ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-gray-700">{category.description}</p>
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

function ConfirmCategoryActionModal({ state, onClose, onConfirm }) {
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
          <button className={cn(btn, btnGhost)} type="button" onClick={onClose} disabled={state.loading}>Cancel</button>
          <button className={cn(btn, state.danger ? btnDanger : btnPrimary)} type="button" onClick={onConfirm} disabled={state.loading}>
            {state.loading ? <Spinner /> : <Icon icon={Tick02Icon} className="h-4 w-4" />}
            {state.loading ? "Processing..." : "Confirm"}
          </button>
        </div>
      }
    >
      {state.error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div> : null}
      <p className="text-sm font-medium leading-6 text-gray-700">{state.message}</p>
    </ModalShell>
  )
}

function CategoryFormModal({
  open,
  item,
  form,
  setForm,
  parentOptions,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  const imageUrl = clean(form.imageUrl)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [imageUrl, open])

  const generatedSlug = slugify(`${form.name}-${form.code}`)

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update product category" : "Add product category"}
      subtitle={
        item
          ? form.name || "Edit category information."
          : "Create a category and place it inside the product hierarchy."
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
            className={cn(btn, btnGhost)}
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className={cn(btn, btnPrimary)}
            type="submit"
            form="product-category-form"
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
                ? "Update category"
                : "Save category"}
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

      <form id="product-category-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Category Name" required>
            <FocusPlaceholderInput
              className={input}
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Example: Men's Clothing"
              maxLength={120}
              required
            />
          </Field>

          <Field label="Category Code" required>
            <FocusPlaceholderInput
              className={input}
              value={form.code}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="Example: MENS"
              maxLength={40}
              required
            />
          </Field>

          <Field
            label="Slug"
            hint={
              generatedSlug
                ? `Leave empty to generate: ${generatedSlug}`
                : "Leave empty to generate it automatically."
            }
          >
            <FocusPlaceholderInput
              className={input}
              value={form.slug}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  slug: event.target.value,
                }))
              }
              placeholder="Example: mens-clothing"
              maxLength={180}
            />
          </Field>

          <Field
            label="Parent Category"
            hint="Leave empty to create a root category."
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
            >
              <option value="">No parent — root category</option>

              {parentOptions.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name} ({category.code})
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>

          <div className="md:col-span-2">
            <Field label="Image URL" hint="Optional">
              <FocusPlaceholderInput
                className={input}
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://example.com/category-image.jpg"
                maxLength={1000}
                type="url"
              />
            </Field>
          </div>

          <div className="flex items-end">
            <div className="flex h-[84px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-gray-50">
              {imageUrl && !imageFailed ? (
                <img
                  src={imageUrl}
                  alt="Category preview"
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400">
                  <Icon icon={Image01Icon} className="h-5 w-5" />
                  Image preview
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
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
                placeholder="Write a short description for this category..."
                maxLength={1500}
              />
            </Field>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}
