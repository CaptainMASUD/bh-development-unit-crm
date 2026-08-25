"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Cancel01Icon,
  FolderLibraryIcon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const ENDPOINT = "/purchase/workflow/reports"

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function clean(value) {
  return String(value ?? "").trim()
}

function pretty(value) {
  return String(value || "-")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase())
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

function isDateKey(key) {
  return /date|createdAt|updatedAt|month/i.test(key)
}

function displayValue(value, key = "") {
  if (value == null || value === "") return "-"

  if (typeof value === "number") {
    return formatNumber(value)
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  if (isDateKey(key) && typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return formatDate(value)
    }
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => displayValue(item)).join(", ") : "-"
  }

  if (typeof value === "object") {
    return (
      value.businessName ||
      value.name ||
      value.label ||
      value.code ||
      value.orderNo ||
      value.reference ||
      "-"
    )
  }

  return pretty(value)
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

function MetricCard({ label, value, description, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(card, "p-4 sm:p-5")}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
        {label}
      </p>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="mt-2 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
          {value}
        </p>
      )}

      {description ? (
        <p className="mt-1 text-xs font-medium leading-5 text-gray-500">
          {description}
        </p>
      ) : null}
    </motion.div>
  )
}

function reportColumns(rows) {
  const keys = []
  const seen = new Set()

  rows.slice(0, 10).forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return

    Object.keys(row).forEach((key) => {
      if (
        key === "_id" ||
        key === "__v" ||
        seen.has(key)
      ) {
        return
      }

      seen.add(key)
      keys.push(key)
    })
  })

  return keys.slice(0, 8)
}

function ReportTableSkeleton({ columns = 4, rows = 5 }) {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <tr key={`report-skeleton-${rowIndex}`}>
      {Array.from({ length: columns }).map((__, columnIndex) => (
        <td key={columnIndex} className="px-5 py-4">
          <Skeleton
            className={cn(
              "h-4",
              columnIndex === 0 ? "w-32" : "w-24"
            )}
          />
        </td>
      ))}
    </tr>
  ))
}

function ReportSection({
  title,
  description,
  rows,
  loading,
  query,
  emptyMessage,
}) {
  const filteredRows = useMemo(() => {
    const search = clean(query).toLowerCase()
    if (!search) return rows

    return rows.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(search)
    )
  }, [rows, query])

  const columns = useMemo(
    () => reportColumns(filteredRows.length ? filteredRows : rows),
    [filteredRows, rows]
  )

  return (
    <section className={cn(card, "overflow-hidden rounded-3xl")}>
      <div className="flex flex-col gap-2 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-base font-black text-gray-900">
            {title}
          </h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-gray-500">
            {description}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black text-gray-600">
          {loading ? "Loading" : `${filteredRows.length} records`}
        </span>
      </div>

      <div className="hidden max-h-[460px] overflow-auto md:block">
        <table className="w-full min-w-[760px] text-left">
          <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
            <tr className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
              {(columns.length ? columns : ["report"]).map((column) => (
                <th key={column} className="whitespace-nowrap px-5 py-3.5">
                  {pretty(column)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <ReportTableSkeleton columns={Math.max(columns.length, 4)} />
            ) : filteredRows.length && columns.length ? (
              filteredRows.map((row, rowIndex) => (
                <motion.tr
                  key={row?._id || `${title}-${rowIndex}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(rowIndex * 0.015, 0.12) }}
                  className="bg-white transition hover:bg-gray-50/70"
                >
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="max-w-[260px] whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-700"
                    >
                      <span className="block truncate">
                        {displayValue(row?.[column], column)}
                      </span>
                    </td>
                  ))}
                </motion.tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  className="px-5 py-12 text-center"
                >
                  <Icon
                    icon={FolderLibraryIcon}
                    className="mx-auto h-8 w-8 text-gray-300"
                  />
                  <p className="mt-3 text-sm font-bold text-gray-900">
                    {emptyMessage}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    {query
                      ? "Try another search term."
                      : "No report records are currently available."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-3 w-48" />
              <Skeleton className="mt-2 h-3 w-36" />
            </div>
          ))
        ) : filteredRows.length && columns.length ? (
          filteredRows.map((row, rowIndex) => (
            <motion.article
              key={row?._id || `${title}-mobile-${rowIndex}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4"
            >
              <p className="truncate text-sm font-black text-gray-900">
                {displayValue(row?.[columns[0]], columns[0])}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                {columns.slice(1, 5).map((column) => (
                  <div key={column}>
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                      {pretty(column)}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {displayValue(row?.[column], column)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.article>
          ))
        ) : (
          <div className="p-10 text-center">
            <Icon
              icon={FolderLibraryIcon}
              className="mx-auto h-8 w-8 text-gray-300"
            />
            <p className="mt-3 text-sm font-bold text-gray-900">
              {emptyMessage}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

export default function PurchaseReportsPage() {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")

  const load = useCallback(async ({ showToast = false } = {}) => {
    setLoading(true)
    setError("")

    try {
      const result = await api(ENDPOINT)
      setData(result || {})

      if (showToast) {
        toast.success("Purchase reports refreshed")
      }
    } catch (loadError) {
      const message =
        loadError?.message || "Unable to load purchase reports"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const monthly = Array.isArray(data.monthly) ? data.monthly : []
  const suppliers = Array.isArray(data.suppliers) ? data.suppliers : []
  const products = Array.isArray(data.products) ? data.products : []
  const payment = Array.isArray(data.payment) ? data.payment : []

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
                Purchase Reports
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Procurement performance, supplier, product and payment reporting.
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
          <div className="w-full lg:max-w-[50%] lg:flex-[0_1_50%]">
            <div className="flex min-h-[40px] items-center gap-2 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
              <Icon
                icon={Search01Icon}
                className="h-4 w-4 shrink-0 text-gray-400"
              />

              <FocusPlaceholderInput
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                style={{ outline: "none", boxShadow: "none" }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search report data..."
                type="search"
                aria-label="Search purchase reports"
              />

              {clean(query) ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Clear report search"
                  title="Clear search"
                >
                  <Icon icon={Cancel01Icon} className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-gray-900">
              {monthly.length + suppliers.length + products.length + payment.length}
            </span>{" "}
            report rows
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
                Could not load purchase reports
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

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Months"
          value={monthly.length}
          description="Monthly reporting periods"
          loading={loading}
        />
        <MetricCard
          label="Suppliers"
          value={suppliers.length}
          description="Supplier performance rows"
          loading={loading}
        />
        <MetricCard
          label="Products"
          value={products.length}
          description="Product procurement rows"
          loading={loading}
        />
        <MetricCard
          label="Payment States"
          value={payment.length}
          description="Payment reporting rows"
          loading={loading}
        />
      </section>

      <div className="space-y-5">
        <ReportSection
          title="Monthly Performance"
          description="Monthly purchase and procurement performance."
          rows={monthly}
          loading={loading}
          query={query}
          emptyMessage="No monthly report data"
        />

        <ReportSection
          title="Supplier Performance"
          description="Supplier-level procurement activity and commercial performance."
          rows={suppliers}
          loading={loading}
          query={query}
          emptyMessage="No supplier report data"
        />

        <ReportSection
          title="Product Performance"
          description="Product-level quantity, value and purchasing information."
          rows={products}
          loading={loading}
          query={query}
          emptyMessage="No product report data"
        />

        <ReportSection
          title="Payment Reporting"
          description="Payment-plan, paid, due and settlement information."
          rows={payment}
          loading={loading}
          query={query}
          emptyMessage="No payment report data"
        />
      </div>
    </div>
  )
}
