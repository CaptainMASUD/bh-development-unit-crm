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
  Image01Icon,
  RefreshIcon,
  RestoreBinIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const BRAND_MANAGE_PERMISSION =
  PERMISSIONS?.INVENTORY_BRAND_MANAGE || "inventory-brand:manage"

const BRAND_DELETE_PERMISSION =
  PERMISSIONS?.INVENTORY_BRAND_DELETE || "inventory-brand:delete"

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

const warningButton =
  "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50"

const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

const chip =
  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

const emptyBrandForm = {
  name: "",
  code: "",
  description: "",
  logoUrl: "",
  website: "",
  country: "",
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

function normalizeWebsite(value) {
  const website = clean(value)

  if (!website) return ""

  return /^https?:\/\//i.test(website)
    ? website
    : `https://${website}`
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

function ActiveFilterChips({
  activeTab,
  filters,
  updateFilter,
  resetFilters,
}) {
  const hasFilters =
    clean(filters.q) ||
    clean(filters.country) ||
    (activeTab === "current" && filters.status !== "all")

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

      {clean(filters.country) ? (
        <FilterChip
          label="Country"
          value={clean(filters.country)}
          onClear={() => updateFilter("country", "")}
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
  onOpenFilters,
}) {
  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "lg:min-w-[540px] lg:max-w-[74%] lg:flex-[0_1_74%]"
          : "lg:max-w-[50%] lg:flex-[0_1_50%]"
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

        {clean(filters.country) ? (
          <FilterChip
            label="Country"
            value={clean(filters.country)}
            onClear={() => updateFilter("country", "")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search brand name or code..."
          type="text"
          aria-label="Search product brands"
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

export default function ProductBrandSetup() {
  const currentUser = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])

  const canManage = hasPermission(currentUser, BRAND_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, BRAND_DELETE_PERMISSION)

  const [activeTab, setActiveTab] = useState("current")
  const [brands, setBrands] = useState([])
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

  const [form, setForm] = useState(emptyBrandForm)
  const [formError, setFormError] = useState("")

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    country: "",
  })

  const activeFilterCount = useMemo(() => {
    let count = 0

    if (clean(filters.q)) count += 1
    if (clean(filters.country)) count += 1

    if (activeTab === "current" && filters.status !== "all") {
      count += 1
    }

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
      country: "",
    })
  }

  const loadBrands = async ({
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

      if (clean(filters.country)) {
        params.set("country", clean(filters.country))
      }

      if (activeTab === "archived") {
        params.set("status", "archived")
      } else if (filters.status !== "all") {
        params.set("status", filters.status)
      }

      if (append && nextCursor) {
        params.set("cursor", nextCursor)
      }

      const data = await api(
        `/inventory/brands?${params.toString()}`,
        { signal }
      )

      const incomingBrands = data.brands || []

      setBrands((previous) =>
        append ? [...previous, ...incomingBrands] : incomingBrands
      )

      setHasMore(Boolean(data.hasMore))
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error(error.message || "Failed to load product brands")
      }
    } finally {
      if (append) setLoadingMore(false)
      else if (showLoader) setLoading(false)
    }
  }

  const refresh = async () => {
    await loadBrands()
  }

  useEffect(() => {
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      loadBrands({ signal: controller.signal })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    activeTab,
    filters.q,
    filters.status,
    filters.country,
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
    setForm(emptyBrandForm)
    setModal({ open: true, item: null })
  }

  const openEditModal = (item) => {
    if (item.status === "archived") {
      toast.error("Restore the archived brand before editing it.")
      return
    }

    setFormError("")

    setForm({
      name: item.name || "",
      code: item.code || "",
      description: item.description || "",
      logoUrl: item.logoUrl || "",
      website: item.website || "",
      country: item.country || "",
      sortOrder: String(item.sortOrder ?? 0),
      status: item.status || "active",
    })

    setModal({ open: true, item })
  }

  const closeModal = () => {
    if (saving) return

    setFormError("")
    setModal({ open: false, item: null })
    setForm(emptyBrandForm)
  }

  const saveBrand = async (event) => {
    event.preventDefault()
    setFormError("")

    const name = clean(form.name)
    const code = clean(form.code).toUpperCase()
    const sortOrder = Number(form.sortOrder)

    if (!name) {
      return setFormError("Brand name is required.")
    }

    if (!code) {
      return setFormError("Brand code is required.")
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
      description: clean(form.description),
      logoUrl: clean(form.logoUrl),
      website: normalizeWebsite(form.website),
      country: clean(form.country),
      sortOrder,
      status: form.status,
    }

    setSaving(true)

    try {
      await api(
        modal.item?._id
          ? `/inventory/brands/${modal.item._id}`
          : "/inventory/brands",
        {
          method: modal.item?._id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      )

      toast.success(modal.item ? "Brand updated" : "Brand created")

      closeModal()
      await loadBrands()
    } catch (error) {
      setFormError(error.message || "Failed to save brand.")
    } finally {
      setSaving(false)
    }
  }

  const updateBrandStatus = async (item, status) => {
    try {
      await api(`/inventory/brands/${item._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })

      toast.success(
        `Brand marked as ${pretty(status).toLowerCase()}`
      )

      await loadBrands()
    } catch (error) {
      toast.error(error.message || "Failed to update brand status")
    }
  }

  const archiveBrand = async (item) => {
    const confirmed = window.confirm(
      `Archive "${item.name}"? The brand can be restored later.`
    )

    if (!confirmed) return

    try {
      await api(`/inventory/brands/${item._id}`, {
        method: "DELETE",
      })

      toast.success("Brand archived")
      await loadBrands()
    } catch (error) {
      toast.error(error.message || "Failed to archive brand")
    }
  }

  const restoreBrand = async (item) => {
    try {
      await api(`/inventory/brands/${item._id}/restore`, {
        method: "PATCH",
      })

      toast.success("Brand restored as inactive")
      await loadBrands()
    } catch (error) {
      toast.error(error.message || "Failed to restore brand")
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
                Product Brands
              </h1>

              <p className="mt-0.5 text-sm text-gray-500">
                Maintain searchable product brands, logos, countries,
                websites, status, and display order.
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
                Add Brand
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
            <span className="text-gray-900">{brands.length}</span>{" "}
            {activeTab === "archived" ? "archived brands" : "brands"}
            {hasMore ? "+" : ""}
          </p>
        </div>
      </section>

      {!canManage ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          You have view-only brand access. Brand creation, editing,
          status changes, archiving, and restoration controls are hidden.
        </div>
      ) : null}

      <div className={`${card} mb-6 p-2`}>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {[
            {
              key: "current",
              label: "Current Brands",
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

      <BrandList
        brands={brands}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onEdit={openEditModal}
        onStatusChange={updateBrandStatus}
        onArchive={archiveBrand}
        onRestore={restoreBrand}
        onLoadMore={() => loadBrands({ append: true })}
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

      <BrandFormModal
        open={modal.open}
        item={modal.item}
        form={form}
        setForm={setForm}
        error={formError}
        saving={saving}
        onClose={closeModal}
        onSubmit={saveBrand}
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
      title="Brand filters"
      subtitle="Filter product brands by status and country."
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
      <div className="grid gap-4 md:grid-cols-2">
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
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </Field>
        ) : (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-sm font-black text-amber-800">
              Archived brands
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-700">
              This tab only displays archived brand records.
            </p>
          </div>
        )}

        <Field label="Country">
          <FocusPlaceholderInput
            className={input}
            value={filters.country}
            onChange={(event) =>
              updateFilter("country", event.target.value)
            }
            placeholder="Example: Bangladesh"
            maxLength={100}
          />
        </Field>

        <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm font-black text-gray-900">
            Active filters
          </p>

          <ActiveFilterChips
            activeTab={activeTab}
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
          />
        </div>
      </div>
    </ModalShell>
  )
}

function BrandList({
  brands,
  loading,
  loadingMore,
  hasMore,
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
        <div className="hidden max-h-[620px] overflow-auto md:block">
          <table className="min-w-[1080px] w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Country</th>
                <th className="px-5 py-3">Website</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {brands.map((brand) => (
                <tr
                  key={brand._id}
                  className="group bg-white transition hover:bg-gray-50/70"
                >
                  <td className="px-5 py-4">
                    <div className="flex min-w-[250px] items-center gap-3">
                      <BrandLogo brand={brand} />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-900">
                          {brand.name}
                        </p>

                        <p className="mt-0.5 max-w-[320px] truncate text-xs font-semibold text-gray-500">
                          {brand.description || "No description"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-indigo-700">
                    {brand.code}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                    {brand.country || "-"}
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                    {brand.website ? (
                      <a
                        href={brand.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-[220px] items-center gap-1.5 truncate font-bold text-indigo-700 hover:underline"
                      >
                        <Icon icon={ViewIcon} className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {brand.website.replace(/^https?:\/\//i, "")}
                        </span>
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="px-5 py-4 text-sm font-black text-gray-700">
                    {brand.sortOrder ?? 0}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge value={brand.status} />
                  </td>

                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                    {formatDate(brand.updatedAt)}
                  </td>

                  <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                    <BrandActions
                      brand={brand}
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

              {!brands.length ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-sm font-bold text-gray-500"
                  >
                    {loading
                      ? "Loading product brands..."
                      : "No product brands found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 md:hidden">
          {brands.map((brand) => (
            <BrandMobileCard
              key={brand._id}
              brand={brand}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              onRestore={onRestore}
              canManage={canManage}
              canDelete={canDelete}
            />
          ))}

          {!brands.length ? (
            <div className="px-5 py-14 text-center text-sm font-bold text-gray-500">
              {loading
                ? "Loading product brands..."
                : "No product brands found."}
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

function BrandMobileCard({
  brand,
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
        <BrandLogo brand={brand} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black text-gray-900">
                {brand.name}
              </h3>

              <p className="mt-0.5 text-xs font-black text-indigo-700">
                {brand.code}
              </p>
            </div>

            <StatusBadge value={brand.status} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-xs">
            <div>
              <p className="font-bold text-gray-400">Country</p>
              <p className="mt-1 font-black text-gray-700">
                {brand.country || "-"}
              </p>
            </div>

            <div>
              <p className="font-bold text-gray-400">Sort order</p>
              <p className="mt-1 font-black text-gray-700">
                {brand.sortOrder ?? 0}
              </p>
            </div>

            {brand.website ? (
              <div className="col-span-2">
                <p className="font-bold text-gray-400">Website</p>
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate font-black text-indigo-700 hover:underline"
                >
                  {brand.website.replace(/^https?:\/\//i, "")}
                </a>
              </div>
            ) : null}
          </div>

          {brand.description ? (
            <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-gray-500">
              {brand.description}
            </p>
          ) : null}

          {canManage || canDelete ? (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <BrandActions
                brand={brand}
                onEdit={onEdit}
                onStatusChange={onStatusChange}
                onArchive={onArchive}
                onRestore={onRestore}
                canManage={canManage}
                canDelete={canDelete}
                mobile
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function BrandLogo({ brand, size = "h-11 w-11" }) {
  const [failed, setFailed] = useState(false)
  const showLogo = clean(brand.logoUrl) && !failed
  const initials = clean(brand.name).slice(0, 2).toUpperCase() || "BR"

  useEffect(() => {
    setFailed(false)
  }, [brand.logoUrl])

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700",
        size
      )}
    >
      {showLogo ? (
        <img
          src={brand.logoUrl}
          alt=""
          className="h-full w-full object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xs font-black tracking-wide">
          {initials}
        </span>
      )}
    </div>
  )
}

function BrandActions({
  brand,
  onEdit,
  onStatusChange,
  onArchive,
  onRestore,
  canManage,
  canDelete,
  mobile = false,
}) {
  if (!canManage && !canDelete) {
    return (
      <span className="text-xs font-bold text-gray-400">View only</span>
    )
  }

  if (brand.status === "archived") {
    return canDelete ? (
      <div className={cn("flex gap-2", mobile ? "flex-wrap" : "justify-end")}>
        <button
          className={cn(
            button,
            ghostButton,
            mobile ? "px-3 py-2" : "px-3"
          )}
          onClick={() => onRestore(brand)}
          type="button"
          title="Restore brand"
        >
          <Icon icon={RestoreBinIcon} className="h-4 w-4" />
          {mobile ? "Restore" : null}
        </button>
      </div>
    ) : (
      <span className="text-xs font-bold text-gray-400">Archived</span>
    )
  }

  return (
    <div className={cn("flex gap-2", mobile ? "flex-wrap" : "justify-end")}>
      {canManage ? (
        <>
          <button
            className={cn(
              button,
              ghostButton,
              mobile ? "px-3 py-2" : "px-3"
            )}
            onClick={() => onEdit(brand)}
            type="button"
            title="Edit brand"
            aria-label={`Edit ${brand.name}`}
          >
            <Icon icon={Edit02Icon} className="h-4 w-4" />
            {mobile ? "Edit" : null}
          </button>

          <button
            className={cn(
              button,
              brand.status === "active"
                ? warningButton
                : ghostButton,
              mobile ? "px-3 py-2" : "px-3"
            )}
            onClick={() =>
              onStatusChange(
                brand,
                brand.status === "active" ? "inactive" : "active"
              )
            }
            type="button"
            title={
              brand.status === "active"
                ? "Mark inactive"
                : "Activate brand"
            }
            aria-label={
              brand.status === "active"
                ? `Mark ${brand.name} inactive`
                : `Activate ${brand.name}`
            }
          >
            <Icon
              icon={
                brand.status === "active"
                  ? ViewIcon
                  : Tick02Icon
              }
              className="h-4 w-4"
            />

            {mobile
              ? brand.status === "active"
                ? "Deactivate"
                : "Activate"
              : null}
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
          onClick={() => onArchive(brand)}
          type="button"
          title="Archive brand"
          aria-label={`Archive ${brand.name}`}
        >
          <Icon icon={Archive02Icon} className="h-4 w-4" />
          {mobile ? "Archive" : null}
        </button>
      ) : null}
    </div>
  )
}

function BrandFormModal({
  open,
  item,
  form,
  setForm,
  error,
  saving,
  onClose,
  onSubmit,
}) {
  const logoUrl = clean(form.logoUrl)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    setLogoFailed(false)
  }, [logoUrl, open])

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item ? "Update product brand" : "Add product brand"}
      subtitle={
        item
          ? form.name || "Edit brand information."
          : "Create a reusable brand for product assignment."
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
            form="product-brand-form"
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
                ? "Update brand"
                : "Save brand"}
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

      <form id="product-brand-form" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Brand Name" required>
            <FocusPlaceholderInput
              className={input}
              value={form.name}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Example: Samsung"
              maxLength={120}
              required
            />
          </Field>

          <Field label="Brand Code" required>
            <FocusPlaceholderInput
              className={input}
              value={form.code}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  code: event.target.value.toUpperCase(),
                }))
              }
              placeholder="Example: SAMSUNG"
              maxLength={40}
              required
            />
          </Field>

          <Field label="Country" hint="Optional">
            <FocusPlaceholderInput
              className={input}
              value={form.country}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  country: event.target.value,
                }))
              }
              placeholder="Example: South Korea"
              maxLength={100}
            />
          </Field>

          <Field label="Website" hint="Optional">
            <FocusPlaceholderInput
              className={input}
              value={form.website}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  website: event.target.value,
                }))
              }
              placeholder="https://www.samsung.com"
              maxLength={1000}
              type="url"
            />
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
            <Field label="Logo URL" hint="Optional">
              <FocusPlaceholderInput
                className={input}
                value={form.logoUrl}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    logoUrl: event.target.value,
                  }))
                }
                placeholder="https://example.com/brand-logo.png"
                maxLength={1000}
                type="url"
              />
            </Field>
          </div>

          <div className="flex items-end">
            <div className="flex h-[84px] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-gray-50">
              {logoUrl && !logoFailed ? (
                <img
                  src={logoUrl}
                  alt="Brand logo preview"
                  className="h-full w-full object-contain p-3"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-gray-400">
                  <Icon icon={Image01Icon} className="h-5 w-5" />
                  Logo preview
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
                placeholder="Write a short description for this brand..."
                maxLength={1500}
              />
            </Field>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}
