"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Cancel01Icon,
  FilterIcon,
  FolderLibraryIcon,
  RefreshIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const ENDPOINT = "/purchase/workflow/price-analysis"

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const primaryButton =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"
const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
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

function formatNumber(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
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

function relationLabel(item, fallback = "-") {
  if (!item) return fallback
  const name = item.businessName || item.name || item.label || fallback
  const code = item.code || item.sku || item.symbol || ""
  return `${name}${code ? ` (${code})` : ""}`
}

async function api(path) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed")
  }
  return data
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

function Skeleton({ className = "" }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-gray-200/80", className)}
      aria-hidden="true"
    />
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-xs font-medium leading-5 text-gray-500">
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

function StatusBadge({ value }) {
  const status = clean(value).toLowerCase()

  const styles = {
    draft: "bg-gray-100 text-gray-700 ring-gray-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    submitted: "bg-amber-50 text-amber-700 ring-amber-200",
    under_review: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    selected: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rejected: "bg-rose-50 text-rose-700 ring-rose-200",
    cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
  }

  const dot =
    ["completed", "active"].includes(status)
      ? "bg-emerald-500"
      : status === "rejected"
        ? "bg-rose-500"
        : ["pending", "submitted", "under_review"].includes(status)
          ? "bg-amber-500"
          : ["approved", "selected"].includes(status)
            ? "bg-indigo-500"
            : "bg-gray-400"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ring-1",
        styles[status] || "bg-slate-100 text-slate-700 ring-slate-200"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {pretty(value)}
    </span>
  )
}

function PriceDifference({ value }) {
  const amount = Number(value || 0)

  return (
    <span
      className={cn(
        "font-black",
        amount > 0
          ? "text-rose-600"
          : amount < 0
            ? "text-emerald-600"
            : "text-gray-900"
      )}
    >
      {formatNumber(amount)}
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
  maxWidthClass = "max-w-3xl",
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
                className="rounded-xl p-2 text-gray-700 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
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

function SearchFilters({
  query,
  setQuery,
  supplier,
  setSupplier,
  supplierName,
  filterCount,
  onOpenFilters,
  onReset,
}) {
  const hasAnything = Boolean(clean(query)) || filterCount > 0

  return (
    <div
      className={cn(
        "w-full transition-[max-width,flex-basis] duration-200",
        filterCount === 0
          ? "lg:max-w-[50%] lg:flex-[0_1_50%]"
          : filterCount <= 2
            ? "lg:max-w-[64%] lg:flex-[0_1_64%]"
            : "lg:max-w-[78%] lg:flex-[0_1_78%]"
      )}
    >
      <div className="flex min-h-[40px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />


        {supplier !== "all" ? (
          <FilterChip
            label="Supplier"
            value={supplierName || "Selected supplier"}
            onClear={() => setSupplier("all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[150px] basis-[180px] flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ outline: "none", boxShadow: "none" }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reference, product or supplier..."
          type="search"
          aria-label="Search price analysis"
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition",
            filterCount
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          )}
        >
          <Icon icon={FilterIcon} className="h-3.5 w-3.5" />
          Filters
          {filterCount ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
              {filterCount}
            </span>
          ) : null}
        </button>

        {hasAnything ? (
          <button
            type="button"
            onClick={onReset}
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

function FilterModal({
  open,
  onClose,
  supplier,
  setSupplier,
  suppliers,
  onReset,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Price-analysis filters"
      subtitle="Refine supplier-based analysis results"
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={onReset}
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
      <Field label="Supplier">
        <select
          className={input}
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
        >
          <option value="all">All suppliers</option>
          {suppliers.map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
    </ModalShell>
  )
}

function DetailsModal({ item, open, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item?.analysisReference || "Price-analysis details"}
      subtitle={
        item
          ? `${item.product?.name || "Product"} · ${
              item.supplier?.businessName ||
              item.supplier?.name ||
              "Supplier"
            }`
          : ""
      }
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      }
    >
      {item ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Status
              </p>
              <div className="mt-2">
                <StatusBadge value={item.status} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Catalogue Price
              </p>
              <p className="mt-2 text-lg font-black text-gray-950">
                {formatNumber(item.catalogueUnitPrice)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Purchase Price
              </p>
              <p className="mt-2 text-lg font-black text-gray-950">
                {formatNumber(item.purchaseUnitPrice)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Difference
              </p>
              <p className="mt-2 text-lg">
                <PriceDifference value={item.priceDifference} />
              </p>
            </div>
          </div>

          <SectionCard
            title="Analysis information"
            description="Current pricing comparison data returned by the purchase workflow."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Reference", item.analysisReference || "-"],
                ["Product", relationLabel(item.product, "-")],
                ["Supplier", relationLabel(item.supplier, "-")],
                ["Catalogue Price", formatNumber(item.catalogueUnitPrice)],
                ["Purchase Price", formatNumber(item.purchaseUnitPrice)],
                ["Difference", formatNumber(item.priceDifference)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-bold text-gray-400">{label}</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {item.createdAt || item.updatedAt ? (
            <SectionCard title="Record timeline">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-gray-400">Created</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400">Updated</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {formatDate(item.updatedAt)}
                  </p>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  )
}

function TableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`price-analysis-skeleton-${index}`}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-2 h-3 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-24" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-36" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-7 w-24 rounded-full" />
      </td>
      <td className="sticky right-0 bg-white px-5 py-4">
        <Skeleton className="ml-auto h-10 w-20 rounded-xl" />
      </td>
    </tr>
  ))
}

function MobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <article key={`price-analysis-mobile-skeleton-${index}`} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
        {Array.from({ length: 4 }).map((__, metricIndex) => (
          <div key={metricIndex}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        ))}
      </div>

      <Skeleton className="mt-4 h-10 w-full rounded-xl" />
    </article>
  ))
}

export default function PriceAnalysis() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [supplier, setSupplier] = useState("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [details, setDetails] = useState({ open: false, item: null })

  const load = useCallback(async ({ showToast = false } = {}) => {
    setLoading(true)
    setError("")

    try {
      const data = await api(ENDPOINT)
      setRows(Array.isArray(data?.items) ? data.items : [])

      if (showToast) {
        toast.success("Price analysis refreshed")
      }
    } catch (loadError) {
      const message = loadError?.message || "Failed to load price analysis"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])


  const suppliers = useMemo(() => {
    const map = new Map()

    rows.forEach((item) => {
      const source = item.supplier
      const key = String(
        normalizeId(source) ||
          source?.businessName ||
          source?.name ||
          ""
      )

      if (!key || map.has(key)) return

      map.set(key, {
        key,
        name: relationLabel(source, "Supplier"),
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [rows])

  const selectedSupplierName =
    supplier === "all"
      ? ""
      : suppliers.find((item) => item.key === supplier)?.name ||
        "Selected supplier"

  const filterCount = supplier !== "all" ? 1 : 0

  const filtered = useMemo(() => {
    const search = clean(query).toLowerCase()

    return rows.filter((item) => {
      const supplierKey = String(
        normalizeId(item.supplier) ||
          item.supplier?.businessName ||
          item.supplier?.name ||
          ""
      )

      if (supplier !== "all" && supplierKey !== supplier) {
        return false
      }

      if (!search) return true

      const haystack = [
        item.analysisReference,
        item.product?.name,
        item.product?.sku,
        item.supplier?.businessName,
        item.supplier?.name,
        item.status,
        item.catalogueUnitPrice,
        item.purchaseUnitPrice,
        item.priceDifference,
      ]
        .filter((value) => value != null && value !== "")
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [rows, query, supplier])

  const resetFilters = () => {
    setQuery("")
    setSupplier("all")
  }

  return (
    <div className={`${shell} p-4 sm:p-6 lg:p-8`}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: "14px", fontWeight: 700 },
        }}
      />

      <section className={cn(card, "mb-5 p-4 sm:p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                Price Analysis
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Compare catalogue and purchase prices across suppliers.
              </p>
            </div>
          </div>

          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={() => load({ showToast: true })}
            disabled={loading}
          >
            {loading ? (
              <Spinner />
            ) : (
              <Icon icon={RefreshIcon} className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilters
            query={query}
            setQuery={setQuery}
            supplier={supplier}
            setSupplier={setSupplier}
            supplierName={selectedSupplierName}
            filterCount={filterCount}
            onOpenFilters={() => setFilterOpen(true)}
            onReset={resetFilters}
          />

          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-gray-900">{filtered.length}</span>{" "}
            analysis record{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Icon
              icon={Alert02Icon}
              className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
            />
            <div>
              <p className="text-sm font-bold text-rose-800">
                Could not load price analysis
              </p>
              <p className="mt-0.5 text-sm font-medium text-rose-700">
                {error}
              </p>
            </div>
          </div>

          <button
            type="button"
            className={cn(
              button,
              "bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
            )}
            onClick={() => load()}
          >
            Try Again
          </button>
        </motion.div>
      ) : null}


      <div className={cn(card, "overflow-hidden rounded-3xl")}>
        <div className="hidden max-h-[650px] overflow-auto lg:block">
          <table className="w-full min-w-[1180px] text-left">
            <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
              <tr className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5">Catalogue Price</th>
                <th className="px-5 py-3.5">Purchase Price</th>
                <th className="px-5 py-3.5">Difference</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableSkeleton />
              ) : filtered.length ? (
                filtered.map((item, index) => (
                  <motion.tr
                    key={item._id || `${item.analysisReference}-${index}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.015, 0.15) }}
                    className="group bg-white transition hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {item.analysisReference || "-"}
                      </p>
                      {item.createdAt ? (
                        <p className="mt-1 text-xs font-medium text-gray-500">
                          {formatDate(item.createdAt)}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-5 py-4">
                      <p className="max-w-[260px] truncate text-sm font-semibold text-gray-900">
                        {item.product?.name || "Unnamed product"}
                      </p>
                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {item.product?.sku || "No SKU"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <p className="max-w-[240px] truncate text-sm font-semibold text-gray-900">
                        {relationLabel(item.supplier, "-")}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {formatNumber(item.catalogueUnitPrice)}
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                      {formatNumber(item.purchaseUnitPrice)}
                    </td>

                    <td className="px-5 py-4 text-sm">
                      <PriceDifference value={item.priceDifference} />
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge value={item.status} />
                    </td>

                    <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className={cn(button, ghostButton, "h-10 px-3")}
                          onClick={() =>
                            setDetails({ open: true, item })
                          }
                        >
                          <Icon icon={ViewIcon} className="h-4 w-4" />
                          View
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-5 py-14 text-center">
                    <Icon
                      icon={FolderLibraryIcon}
                      className="mx-auto h-8 w-8 text-gray-300"
                    />
                    <p className="mt-3 text-sm font-bold text-gray-900">
                      No price-analysis records found
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                      Adjust the search or filters to find another record.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {loading ? (
            <MobileSkeleton />
          ) : filtered.length ? (
            filtered.map((item, index) => (
              <motion.article
                key={item._id || `${item.analysisReference}-${index}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.15) }}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.product?.name || "Unnamed product"}
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-gray-500">
                      {item.analysisReference || "-"}
                    </p>
                  </div>
                  <StatusBadge value={item.status} />
                </div>

                <div className="mt-4 rounded-xl border border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                    Supplier
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                    {relationLabel(item.supplier, "-")}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400">
                      Catalogue
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatNumber(item.catalogueUnitPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400">
                      Purchase
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatNumber(item.purchaseUnitPrice)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-gray-400">
                      Difference
                    </p>
                    <p className="mt-1 text-sm">
                      <PriceDifference value={item.priceDifference} />
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    className={cn(button, ghostButton, "h-10 w-full px-3")}
                    onClick={() => setDetails({ open: true, item })}
                  >
                    <Icon icon={ViewIcon} className="h-4 w-4" />
                    View Details
                  </button>
                </div>
              </motion.article>
            ))
          ) : (
            <div className="p-12 text-center">
              <Icon
                icon={FolderLibraryIcon}
                className="mx-auto h-8 w-8 text-gray-300"
              />
              <p className="mt-3 text-sm font-bold text-gray-900">
                No price-analysis records found
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {filtered.length} record{filtered.length === 1 ? "" : "s"} shown
          </p>
          {filtered.length ? (
            <span className="text-xs font-semibold text-gray-400">
              Purchase Management · Price Analysis
            </span>
          ) : null}
        </div>
      </div>

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        supplier={supplier}
        setSupplier={setSupplier}
        suppliers={suppliers}
        onReset={() => setSupplier("all")}
      />

      <DetailsModal
        item={details.item}
        open={details.open}
        onClose={() => setDetails({ open: false, item: null })}
      />
    </div>
  )
}
