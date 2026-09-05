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
} from "@hugeicons/core-free-icons"

const API = `${import.meta.env.VITE_API_URL}/api/inventory/operations/pending-inventory`

const shell = "min-h-screen bg-gray-50"
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

function number(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function statusTone(value) {
  const normalized = clean(value).toLowerCase()

  if (["completed", "assigned", "received", "posted", "ready"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  }

  if (["cancelled", "rejected", "failed", "blocked"].includes(normalized)) {
    return "bg-rose-50 text-rose-700 ring-rose-200"
  }

  if (["pending", "awaiting", "awaiting_assignment", "partial", "processing"].includes(normalized)) {
    return "bg-amber-50 text-amber-700 ring-amber-200"
  }

  return "bg-indigo-50 text-indigo-700 ring-indigo-200"
}

async function api() {
  const token = localStorage.getItem("token")

  const response = await fetch(API, {
    credentials: "include",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Unable to load pending inventory.")
  }

  return data
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

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-xs font-medium leading-5 text-gray-500">{hint}</p>
      ) : null}
    </div>
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

function StatusBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1",
        statusTone(value)
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
    <div className={cn("animate-pulse rounded-lg bg-gray-200/80", className)} />
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
  maxWidthClass = "max-w-xl",
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

function SearchFilters({
  query,
  setQuery,
  status,
  setStatus,
  filterChipCount,
  onOpenFilters,
  onReset,
}) {
  const hasAnything = Boolean(clean(query)) || filterChipCount > 0

  return (
    <div
      className={cn(
        "w-full transition-[max-width,flex-basis] duration-200",
        filterChipCount === 0
          ? "lg:max-w-[55%] lg:flex-[0_1_55%]"
          : "lg:max-w-[72%] lg:flex-[0_1_72%]"
      )}
    >
      <div className="flex min-h-[50px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />

        {status !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(status)}
            onClear={() => setStatus("all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[160px] basis-[190px] flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ outline: "none", boxShadow: "none" }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reference, product, source..."
          type="search"
          aria-label="Search pending inventory"
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

function TableSkeleton({ rows = 7 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`pending-skeleton-${index}`}>
      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-36" /><Skeleton className="mt-2 h-3 w-20" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-5 py-4"><Skeleton className="h-7 w-24 rounded-full" /></td>
    </tr>
  ))
}

function MobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <article key={`pending-mobile-skeleton-${index}`} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-36" />
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
    </article>
  ))
}

function PendingList({ rows, loading }) {
  return (
    <div className={cn(card, "overflow-hidden rounded-3xl")}>
      <div className="hidden max-h-[650px] overflow-auto lg:block">
        <table className="w-full min-w-[1050px] text-left">
          <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
            <tr className="text-xs font-black uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Accepted</th>
              <th className="px-5 py-3">Remaining</th>
              <th className="px-5 py-3">Tracking</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableSkeleton />
            ) : rows.length ? (
              rows.map((row, index) => (
                <tr
                  key={row._id || `${row.reference}-${index}`}
                  className="group bg-white transition hover:bg-indigo-50/30"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {row.reference || "-"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="max-w-[240px] truncate text-sm font-semibold text-gray-900">
                      {row.product?.name || "-"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {row.product?.sku || "No SKU"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="max-w-[220px] truncate text-sm font-semibold text-gray-900">
                      {pretty(row.source)}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-gray-900">
                      {number(row.acceptedQuantity)}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-indigo-700">
                      {number(row.remainingQuantity)}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-700">
                      {pretty(row.trackingType)}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge value={row.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-3 text-sm font-bold text-gray-900">
                    No pending inventory found
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your search or active filters.
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
        ) : rows.length ? (
          rows.map((row, index) => (
            <article
              key={row._id || `${row.reference}-${index}`}
              className="p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {row.product?.name || "Unnamed product"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    {row.reference || "No reference"}
                  </p>
                </div>

                <StatusBadge value={row.status} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                <div>
                  <p className="text-xs font-bold text-gray-400">Source</p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                    {pretty(row.source)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-400">Tracking</p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                    {pretty(row.trackingType)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-400">Accepted</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">
                    {number(row.acceptedQuantity)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-400">Remaining</p>
                  <p className="mt-1 text-sm font-bold text-indigo-700">
                    {number(row.remainingQuantity)}
                  </p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="p-12 text-center">
            <Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm font-bold text-gray-900">
              No pending inventory found
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Try changing your search or filters.
            </p>
          </div>
        )}
      </div>

      {!loading ? (
        <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {rows.length} {rows.length === 1 ? "record" : "records"} shown
          </p>
          {rows.length ? (
            <span className="text-xs font-semibold text-gray-400">
              Pending inventory workflow
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function PendingInventory() {
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(
    async ({ showToast = false } = {}) => {
      setLoading(true)
      setError("")

      try {
        const data = await api()
        setRows(data.items || [])

        if (showToast) {
          toast.success("Pending inventory refreshed")
        }
      } catch (e) {
        const message = e?.message || "Unable to load pending inventory."
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    load()
  }, [load])

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => clean(row.status))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [rows]
  )

  const visible = useMemo(() => {
    const search = clean(query).toLowerCase()

    return rows.filter((row) => {
      if (status !== "all" && clean(row.status) !== status) {
        return false
      }

      if (!search) return true

      const searchable = [
        row.reference,
        row.product?.name,
        row.product?.sku,
        row.source,
        row.trackingType,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(search)
    })
  }, [rows, query, status])

  const filterChipCount = status === "all" ? 0 : 1

  const acceptedTotal = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + Number(row.acceptedQuantity || 0),
        0
      ),
    [rows]
  )

  const remainingTotal = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + Number(row.remainingQuantity || 0),
        0
      ),
    [rows]
  )

  const resetFilters = (close = false) => {
    setQuery("")
    setStatus("all")

    if (close) {
      setFilterOpen(false)
    }
  }

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

      <div className="mx-auto w-full max-w-[1600px]">
        <section className={cn(card, "mb-4 p-4 sm:p-5")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                  <Icon icon={FolderLibraryIcon} className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                    Pending Inventory
                  </h1>
                  <p className="mt-0.5 text-sm font-medium text-gray-500">
                    Accepted purchases waiting for warehouse, bin, and tracking assignment.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => load({ showToast: true })}
                disabled={loading}
                className={cn(button, ghostButton)}
              >
                <Icon
                  icon={RefreshIcon}
                  className={cn("h-4 w-4", loading ? "animate-spin" : "")}
                />
                Refresh
              </button>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <SearchFilters
                query={query}
                setQuery={setQuery}
                status={status}
                setStatus={setStatus}
                filterChipCount={filterChipCount}
                onOpenFilters={() => setFilterOpen(true)}
                onReset={() => resetFilters(false)}
              />

              <span className="shrink-0 text-xs font-semibold text-gray-400">
                {loading ? "Loading..." : `${visible.length} of ${rows.length} records`}
              </span>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4 shrink-0" />

            <div className="min-w-0 flex-1">
              <p className="font-bold">Unable to load pending inventory</p>
              <p className="mt-0.5 font-medium text-rose-600">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100"
              aria-label="Dismiss error"
            >
              <Icon icon={Cancel01Icon} className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={cn(card, "p-4")}>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">
              Total Records
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
              {number(rows.length, 0)}
            </p>
          </div>

          <div className={cn(card, "p-4")}>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">
              Accepted Quantity
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
              {number(acceptedTotal)}
            </p>
          </div>

          <div className={cn(card, "p-4")}>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">
              Remaining Quantity
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-indigo-700">
              {number(remainingTotal)}
            </p>
          </div>

          <div className={cn(card, "p-4")}>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">
              Workflow States
            </p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
              {number(statuses.length, 0)}
            </p>
          </div>
        </div>

        <PendingList rows={visible} loading={loading} />
      </div>

      <ModalShell
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter Pending Inventory"
        subtitle="Refine accepted inventory by workflow status"
        icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={() => resetFilters(true)}
            >
              Reset Filters
            </button>

            <button
              type="button"
              className={cn(button, primaryButton)}
              onClick={() => setFilterOpen(false)}
            >
              Apply Filters
            </button>
          </div>
        }
      >
        <Field label="Workflow Status">
          <select
            className={input}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {pretty(value)}
              </option>
            ))}
          </select>
        </Field>
      </ModalShell>
    </div>
  )
}
