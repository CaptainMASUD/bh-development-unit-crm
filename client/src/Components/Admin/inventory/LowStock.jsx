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
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/* -------------------------------------------------------------------------- */
/*                                  STYLES                                    */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function number(value, maximumFractionDigits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits,
  })
}

function relationLabel(item, fallback = "-") {
  if (!item) return fallback

  const name =
    item.businessName ||
    item.name ||
    item.label ||
    fallback

  const code =
    item.code ||
    item.sku ||
    item.symbol ||
    ""

  return `${name}${code ? ` (${code})` : ""}`
}

function getStockStatus(row) {
  return Number(row.availableQuantity || 0) <= 0
    ? "out_of_stock"
    : "low_stock"
}

function getWarehouseKey(row) {
  return String(
    row.warehouse?._id ||
      row.warehouse?.id ||
      row.warehouse?.name ||
      ""
  )
}

async function api(path) {
  const token = localStorage.getItem("token")

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Request failed"
    )
  }

  return data
}

/* -------------------------------------------------------------------------- */
/*                                   ICON                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                FIELD                                       */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  hint,
  children,
}) {
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

/* -------------------------------------------------------------------------- */
/*                         FOCUS PLACEHOLDER INPUT                            */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                              STATUS BADGE                                  */
/* -------------------------------------------------------------------------- */

function StatusBadge({ value }) {
  const outOfStock = value === "out_of_stock"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ring-1",
        outOfStock
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-amber-50 text-amber-700 ring-amber-200"
      )}
    >
      {outOfStock ? "Out of stock" : "Low stock"}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*                               FILTER CHIP                                  */
/* -------------------------------------------------------------------------- */

function FilterChip({
  label,
  value,
  onClear,
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      title={`Remove ${label} filter`}
      aria-label={`Remove ${label} filter`}
    >
      <span className="text-indigo-400">
        {label}:
      </span>

      <span className="max-w-[180px] truncate sm:max-w-[220px]">
        {value}
      </span>

      <Icon
        icon={Cancel01Icon}
        className="h-3.5 w-3.5 shrink-0"
      />
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*                                SKELETON                                    */
/* -------------------------------------------------------------------------- */

function Skeleton({
  className = "",
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gray-200/80",
        className
      )}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*                               MODAL SHELL                                  */
/* -------------------------------------------------------------------------- */

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

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow =
        previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.()
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    )

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      )
  }, [open, onClose])

  if (
    !open ||
    typeof document === "undefined"
  ) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close modal"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{
              opacity: 0,
              y: 14,
              scale: 0.99,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 24,
            }}
            className={cn(
              "relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]",
              maxWidthClass
            )}
          >
            {/* Modal header */}
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
                <Icon
                  icon={Cancel01Icon}
                  className="h-5 w-5"
                />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">
              {children}
            </div>

            {/* Footer */}
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

/* -------------------------------------------------------------------------- */
/*                          SEARCH + FILTER AREA                              */
/* -------------------------------------------------------------------------- */

function SearchFilters({
  query,
  setQuery,
  status,
  setStatus,
  warehouse,
  setWarehouse,
  warehouseName,
  filterChipCount,
  onOpenFilters,
  onReset,
}) {
  const hasAnything =
    Boolean(clean(query)) ||
    filterChipCount > 0

  return (
    <div
      className={cn(
        "w-full transition-[max-width,flex-basis] duration-200",
        filterChipCount === 0
          ? "lg:max-w-[55%] lg:flex-[0_1_55%]"
          : filterChipCount <= 2
            ? "lg:max-w-[72%] lg:flex-[0_1_72%]"
            : "lg:max-w-[82%] lg:flex-[0_1_82%]"
      )}
    >
      <div className="flex min-h-[50px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <Icon
          icon={Search01Icon}
          className="h-4 w-4 shrink-0 text-gray-400"
        />

        {status !== "all" ? (
          <FilterChip
            label="Status"
            value={
              status === "out_of_stock"
                ? "Out of stock"
                : "Low stock"
            }
            onClear={() =>
              setStatus("all")
            }
          />
        ) : null}

        {warehouse !== "all" ? (
          <FilterChip
            label="Warehouse"
            value={
              warehouseName ||
              "Selected warehouse"
            }
            onClear={() =>
              setWarehouse("all")
            }
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[160px] basis-[180px] flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{
            outline: "none",
            boxShadow: "none",
          }}
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Search product, SKU or warehouse..."
          type="search"
          aria-label="Search low stock items"
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
          <Icon
            icon={FilterIcon}
            className="h-3.5 w-3.5"
          />

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
            <Icon
              icon={Cancel01Icon}
              className="h-4 w-4"
            />
          </button>
        ) : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                           DESKTOP SKELETON                                 */
/* -------------------------------------------------------------------------- */

function TableSkeleton({
  rows = 8,
}) {
  return Array.from({
    length: rows,
  }).map((_, index) => (
    <tr key={index}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-24" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-4 w-16" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-4 w-16" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-4 w-16" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-4 w-20" />
      </td>

      <td className="px-5 py-4">
        <Skeleton className="h-7 w-24 rounded-full" />
      </td>
    </tr>
  ))
}

/* -------------------------------------------------------------------------- */
/*                             MOBILE SKELETON                                */
/* -------------------------------------------------------------------------- */

function MobileSkeleton({
  rows = 5,
}) {
  return Array.from({
    length: rows,
  }).map((_, index) => (
    <article
      key={index}
      className="p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>

        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
        {Array.from({
          length: 4,
        }).map((__, metricIndex) => (
          <div key={metricIndex}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-20" />
          </div>
        ))}
      </div>
    </article>
  ))
}

/* -------------------------------------------------------------------------- */
/*                            LOW STOCK TABLE                                 */
/* -------------------------------------------------------------------------- */

function LowStockList({
  rows,
  loading,
}) {
  return (
    <div
      className={cn(
        card,
        "overflow-hidden rounded-3xl"
      )}
    >
      {/* Desktop */}
      <div className="hidden max-h-[650px] overflow-auto lg:block">
        <table className="w-full min-w-[1050px] text-left">
          <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
            <tr className="text-xs font-black uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">
                Product
              </th>

              <th className="px-5 py-3">
                Warehouse / Bin
              </th>

              <th className="px-5 py-3">
                Available
              </th>

              <th className="px-5 py-3">
                Minimum
              </th>

              <th className="px-5 py-3">
                Shortage
              </th>

              <th className="px-5 py-3">
                Suggested Purchase
              </th>

              <th className="px-5 py-3">
                Status
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <TableSkeleton />
            ) : rows.length ? (
              rows.map((row, index) => {
                const status =
                  getStockStatus(row)

                return (
                  <tr
                    key={
                      row._id ||
                      `${row.product?._id}-${row.warehouse?._id}-${row.location?._id}-${index}`
                    }
                    className="group bg-white transition hover:bg-indigo-50/30"
                  >
                    {/* Product */}
                    <td className="px-5 py-4">
                      <p className="max-w-[260px] truncate text-sm font-semibold text-gray-900">
                        {row.product?.name ||
                          "Unnamed product"}
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-500">
                        {row.product?.sku ||
                          "No SKU"}
                      </p>
                    </td>

                    {/* Warehouse */}
                    <td className="px-5 py-4">
                      <p className="max-w-[220px] truncate text-sm font-semibold text-gray-900">
                        {row.warehouse?.name ||
                          "-"}
                      </p>

                      <p className="mt-1 max-w-[220px] truncate text-xs font-medium text-gray-500">
                        {row.location?.name ||
                          "No bin assigned"}
                      </p>
                    </td>

                    {/* Available */}
                    <td className="px-5 py-4">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          Number(
                            row.availableQuantity
                          ) <= 0
                            ? "text-rose-600"
                            : "text-gray-900"
                        )}
                      >
                        {number(
                          row.availableQuantity
                        )}
                      </p>
                    </td>

                    {/* Minimum */}
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {number(
                          row.effectiveReorderLevel
                        )}
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-400">
                        Reorder level
                      </p>
                    </td>

                    {/* Shortage */}
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-rose-600">
                        {number(
                          row.shortageQuantity
                        )}
                      </p>
                    </td>

                    {/* Suggested */}
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-indigo-700">
                        {number(
                          row.suggestedPurchaseQuantity
                        )}
                      </p>

                      <p className="mt-1 text-xs font-medium text-gray-400">
                        Suggested qty.
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusBadge
                        value={status}
                      />
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
                    No low-stock items found
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your
                    search or active filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="divide-y divide-gray-100 lg:hidden">
        {loading ? (
          <MobileSkeleton />
        ) : rows.length ? (
          rows.map((row, index) => {
            const status =
              getStockStatus(row)

            return (
              <article
                key={
                  row._id ||
                  `${row.product?._id}-${row.warehouse?._id}-${index}`
                }
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {row.product?.name ||
                        "Unnamed product"}
                    </p>

                    <p className="mt-1 text-xs font-medium text-gray-500">
                      {row.product?.sku ||
                        "No SKU"}
                    </p>
                  </div>

                  <StatusBadge
                    value={status}
                  />
                </div>

                {/* Warehouse */}
                <div className="mt-3 rounded-xl border border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                    Warehouse / Bin
                  </p>

                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                    {row.warehouse?.name ||
                      "-"}
                  </p>

                  <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
                    {row.location?.name ||
                      "No bin assigned"}
                  </p>
                </div>

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400">
                      Available
                    </p>

                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        Number(
                          row.availableQuantity
                        ) <= 0
                          ? "text-rose-600"
                          : "text-gray-900"
                      )}
                    >
                      {number(
                        row.availableQuantity
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400">
                      Minimum
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {number(
                        row.effectiveReorderLevel
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400">
                      Shortage
                    </p>

                    <p className="mt-1 text-sm font-bold text-rose-600">
                      {number(
                        row.shortageQuantity
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400">
                      Suggested
                    </p>

                    <p className="mt-1 text-sm font-bold text-indigo-700">
                      {number(
                        row.suggestedPurchaseQuantity
                      )}
                    </p>
                  </div>
                </div>
              </article>
            )
          })
        ) : (
          <div className="p-12 text-center">
            <Icon
              icon={FolderLibraryIcon}
              className="mx-auto h-8 w-8 text-gray-300"
            />

            <p className="mt-3 text-sm font-bold text-gray-900">
              No low-stock items found
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Try changing your search
              or filters.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading ? (
        <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {rows.length}{" "}
            {rows.length === 1
              ? "item"
              : "items"}{" "}
            shown
          </p>

          {rows.length ? (
            <span className="text-xs font-semibold text-gray-400">
              Low stock report
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                            MAIN COMPONENT                                  */
/* -------------------------------------------------------------------------- */

export default function InventoryReports() {
  const [rows, setRows] = useState([])

  const [query, setQuery] =
    useState("")

  const [status, setStatus] =
    useState("all")

  const [warehouse, setWarehouse] =
    useState("all")

  const [filterOpen, setFilterOpen] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  /* ------------------------------------------------------------------------ */
  /*                              LOAD REPORT                                 */
  /* ------------------------------------------------------------------------ */

  const load = useCallback(
    async ({
      showToast = false,
    } = {}) => {
      setLoading(true)
      setError("")

      try {
        const data = await api(
          "/inventory/reports/low-stock?limit=200"
        )

        setRows(data.rows || [])

        if (showToast) {
          toast.success(
            "Low-stock report refreshed"
          )
        }
      } catch (e) {
        const message =
          e.message ||
          "Failed to load low-stock report"

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

  /* ------------------------------------------------------------------------ */
  /*                         WAREHOUSE OPTIONS                                */
  /* ------------------------------------------------------------------------ */

  const warehouses = useMemo(() => {
    const map = new Map()

    rows.forEach((row) => {
      const item = row.warehouse

      if (!item) return

      const key = String(
        item._id ||
          item.id ||
          item.name ||
          ""
      )

      if (!key) return

      if (!map.has(key)) {
        map.set(key, {
          key,
          item,
        })
      }
    })

    return Array.from(
      map.values()
    ).sort((a, b) =>
      String(
        a.item?.name || ""
      ).localeCompare(
        String(b.item?.name || "")
      )
    )
  }, [rows])

  /* ------------------------------------------------------------------------ */
  /*                          SELECTED WAREHOUSE                              */
  /* ------------------------------------------------------------------------ */

  const selectedWarehouseName =
    useMemo(() => {
      if (warehouse === "all") {
        return ""
      }

      const selected =
        warehouses.find(
          (item) =>
            item.key === warehouse
        )

      return selected
        ? relationLabel(
            selected.item,
            "Selected warehouse"
          )
        : "Selected warehouse"
    }, [warehouse, warehouses])

  /* ------------------------------------------------------------------------ */
  /*                              FILTER DATA                                 */
  /* ------------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    const search =
      clean(query).toLowerCase()

    return rows.filter((row) => {
      const rowStatus =
        getStockStatus(row)

      if (
        status !== "all" &&
        rowStatus !== status
      ) {
        return false
      }

      if (
        warehouse !== "all" &&
        getWarehouseKey(row) !==
          warehouse
      ) {
        return false
      }

      if (!search) {
        return true
      }

      const searchable = [
        row.product?.name,
        row.product?.sku,
        row.product?.code,
        row.warehouse?.name,
        row.warehouse?.code,
        row.location?.name,
        row.location?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(search)
    })
  }, [
    rows,
    query,
    status,
    warehouse,
  ])

  /* ------------------------------------------------------------------------ */
  /*                            FILTER COUNT                                  */
  /* ------------------------------------------------------------------------ */

  const filterChipCount =
    useMemo(
      () =>
        [
          status !== "all",
          warehouse !== "all",
        ].filter(Boolean).length,
      [status, warehouse]
    )

  /* ------------------------------------------------------------------------ */
  /*                              RESET                                      */
  /* ------------------------------------------------------------------------ */

  const resetFilters = (
    close = false
  ) => {
    setQuery("")
    setStatus("all")
    setWarehouse("all")

    if (close) {
      setFilterOpen(false)
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                               UI                                        */
  /* ------------------------------------------------------------------------ */

  return (
    <div
      className={`${shell} p-4 sm:p-6 lg:p-8`}
    >
      {/* Toast */}
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
        {/* -------------------------------------------------------------- */}
        {/* HEADER                                                         */}
        {/* -------------------------------------------------------------- */}

        <section
          className={cn(
            card,
            "mb-4 p-4 sm:p-5"
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Title */}
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                  <Icon
                    icon={
                      FolderLibraryIcon
                    }
                    className="h-5 w-5"
                  />
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900">
                    Low Stock Management
                  </h1>

                  <p className="mt-0.5 text-sm font-medium text-gray-500">
                    Track shortages and
                    replenishment requirements.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    load({
                      showToast: true,
                    })
                  }
                  disabled={loading}
                  className={cn(
                    button,
                    ghostButton
                  )}
                >
                  <Icon
                    icon={RefreshIcon}
                    className={cn(
                      "h-4 w-4",
                      loading
                        ? "animate-spin"
                        : ""
                    )}
                  />

                  Refresh
                </button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <SearchFilters
                query={query}
                setQuery={setQuery}
                status={status}
                setStatus={setStatus}
                warehouse={warehouse}
                setWarehouse={
                  setWarehouse
                }
                warehouseName={
                  selectedWarehouseName
                }
                filterChipCount={
                  filterChipCount
                }
                onOpenFilters={() =>
                  setFilterOpen(true)
                }
                onReset={() =>
                  resetFilters(false)
                }
              />

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">
                  {loading
                    ? "Loading..."
                    : `${filtered.length} of ${rows.length} items`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- */}
        {/* ERROR                                                          */}
        {/* -------------------------------------------------------------- */}

        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            <Icon
              icon={Alert02Icon}
              className="mt-0.5 h-4 w-4 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="font-bold">
                Unable to load report
              </p>

              <p className="mt-0.5 font-medium text-rose-600">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100"
              aria-label="Dismiss error"
            >
              <Icon
                icon={Cancel01Icon}
                className="h-4 w-4"
              />
            </button>
          </div>
        ) : null}

        {/* -------------------------------------------------------------- */}
        {/* TABLE / MOBILE LIST                                            */}
        {/* -------------------------------------------------------------- */}

        <LowStockList
          rows={filtered}
          loading={loading}
        />
      </div>

      {/* -------------------------------------------------------------- */}
      {/* FILTER MODAL                                                   */}
      {/* -------------------------------------------------------------- */}

      <ModalShell
        open={filterOpen}
        onClose={() =>
          setFilterOpen(false)
        }
        title="Filter low stock"
        subtitle="Refine the replenishment report"
        icon={
          <Icon
            icon={FilterIcon}
            className="h-5 w-5"
          />
        }
        maxWidthClass="max-w-2xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className={cn(
                button,
                ghostButton
              )}
              onClick={() =>
                resetFilters(true)
              }
            >
              Reset filters
            </button>

            <button
              type="button"
              className={cn(
                button,
                primaryButton
              )}
              onClick={() =>
                setFilterOpen(false)
              }
            >
              Apply Filters
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Status */}
          <Field label="Stock Status">
            <select
              className={input}
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="low_stock">
                Low stock
              </option>

              <option value="out_of_stock">
                Out of stock
              </option>
            </select>
          </Field>

          {/* Warehouse */}
          <Field label="Warehouse">
            <select
              className={input}
              value={warehouse}
              onChange={(event) =>
                setWarehouse(
                  event.target.value
                )
              }
            >
              <option value="all">
                All warehouses
              </option>

              {warehouses.map(
                ({ key, item }) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {relationLabel(
                      item,
                      "Warehouse"
                    )}
                  </option>
                )
              )}
            </select>
          </Field>
        </div>
      </ModalShell>
    </div>
  )
}
