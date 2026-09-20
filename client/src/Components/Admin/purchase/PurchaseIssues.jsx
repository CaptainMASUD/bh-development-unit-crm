"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  FilterIcon,
  FolderLibraryIcon,
  RefreshIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const ENDPOINT = "/purchase/workflow/issues?purchaseType=industrial_purchase"

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
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits })
}

function formatMoney(value, currency = "") {
  const amount = formatNumber(value, 2)
  return currency ? `${currency} ${amount}` : amount
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

async function api(path, options = {}) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed")
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

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
      </label>
      {children}
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
  const status = clean(value).toLowerCase()
  const styles = {
    draft: "bg-gray-100 text-gray-700 ring-gray-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    submitted: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    purchased: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    partially_paid: "bg-amber-50 text-amber-700 ring-amber-200",
    cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
    rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  }
  const dot = ["purchased", "completed", "paid"].includes(status)
    ? "bg-emerald-500"
    : status === "rejected"
      ? "bg-rose-500"
      : ["pending", "submitted", "partially_paid"].includes(status)
        ? "bg-amber-500"
        : status === "approved"
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

function TypeBadge({ value }) {
  return (
    <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700 ring-1 ring-indigo-200">
      {pretty(value)}
    </span>
  )
}

function PaymentPlanBadge({ value }) {
  const plan = clean(value).toLowerCase()
  const isDeferred = ["due", "credit", "partial", "installment"].some((keyword) =>
    plan.includes(keyword)
  )

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1",
        isDeferred
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
      )}
    >
      {pretty(value)}
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
  purchaseType,
  setPurchaseType,
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

        {purchaseType !== "all" ? (
          <FilterChip
            label="Type"
            value={pretty(purchaseType)}
            onClear={() => setPurchaseType("all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[150px] basis-[180px] flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ outline: "none", boxShadow: "none" }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reference, product or supplier..."
          type="search"
          aria-label="Search purchase issues"
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
  purchaseType,
  setPurchaseType,
  purchaseTypes,
  onReset,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Purchase-issue filters"
      subtitle="Refine supplier and purchase-type results"
      icon={<Icon icon={FilterIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={cn(button, ghostButton)} onClick={onReset}>
            Reset
          </button>
          <button type="button" className={cn(button, primaryButton)} onClick={onClose}>
            <Icon icon={Tick02Icon} className="h-4 w-4" />
            Apply Filters
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
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

        <Field label="Purchase Type">
          <select
            className={input}
            value={purchaseType}
            onChange={(event) => setPurchaseType(event.target.value)}
          >
            <option value="all">All purchase types</option>
            {purchaseTypes.map((item) => (
              <option key={item} value={item}>
                {pretty(item)}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </ModalShell>
  )
}

function DetailsModal({ item, open, onClose }) {
  const currency = item?.currency || ""

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item?.purchaseReference || "Purchase-issue details"}
      subtitle={
        item
          ? `${item.product?.name || "Product"} · ${
              item.supplier?.businessName || item.supplier?.name || "Supplier"
            }`
          : ""
      }
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex justify-end">
          <button type="button" className={cn(button, ghostButton)} onClick={onClose}>
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
                Type
              </p>
              <div className="mt-2">
                <TypeBadge value={item.purchaseType} />
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Quantity
              </p>
              <p className="mt-2 text-lg font-black text-gray-950">
                {formatNumber(item.quantity)}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Net Amount
              </p>
              <p className="mt-2 text-lg font-black text-indigo-700">
                {formatMoney(item.netAmount, currency)}
              </p>
            </div>
          </div>

          <SectionCard
            title="Purchase information"
            description="Purchase issue data recorded by the purchase workflow."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Reference", item.purchaseReference || "-"],
                ["Purchase Type", pretty(item.purchaseType)],
                ["Product", relationLabel(item.product, "-")],
                ["Supplier", relationLabel(item.supplier, "-")],
                ["Quantity", formatNumber(item.quantity)],
                ["Unit Price", formatMoney(item.unitPrice, currency)],
                ["Net Amount", formatMoney(item.netAmount, currency)],
                ["Payment Plan", pretty(item.paymentPlan)],
                ["Status", pretty(item.status)],
                ["Purchase Request", item.request?.requestReference || item.sourceRequestReference || "-"],
                ["Purchase Analysis", item.analysis?.analysisReference || "-"],
                ["Purchase Order", item.purchaseOrder?.orderNo || "-"],
                ["Notes", item.note || "-"],
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
    <tr key={`purchase-issues-skeleton-${index}`}>
      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
      <td className="px-5 py-4"><Skeleton className="h-7 w-24 rounded-full" /></td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-24" />
      </td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-36" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-5 py-4"><Skeleton className="h-7 w-24 rounded-full" /></td>
      <td className="px-5 py-4"><Skeleton className="h-7 w-24 rounded-full" /></td>
      <td className="sticky right-0 bg-white px-5 py-4">
        <Skeleton className="ml-auto h-10 w-20 rounded-xl" />
      </td>
    </tr>
  ))
}

function MobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <article key={`purchase-issues-mobile-skeleton-${index}`} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-14 w-full rounded-xl" />
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
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

export default function PurchaseIssues() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [supplier, setSupplier] = useState("all")
  const [purchaseType, setPurchaseType] = useState("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [details, setDetails] = useState({ open: false, item: null })
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(25)

  const load = useCallback(async ({ showToast = false, targetPage = 1 } = {}) => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams()
      params.set("page", String(targetPage))
      params.set("limit", String(limit))
      params.set("purchaseType", "industrial_purchase")
      if (supplier && supplier !== "all") params.set("supplier", supplier)
      if (clean(query)) params.set("q", clean(query))

      const data = await api(`/purchase/workflow/issues?${params.toString()}`)
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total) || 0)
      setTotalPages(Number(data?.totalPages) || 1)
      setPage(Number(data?.page) || targetPage)
      if (showToast) toast.success("Purchase issues refreshed")
    } catch (loadError) {
      const message = loadError?.message || "Failed to load purchase issues"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [limit, supplier, query])

  useEffect(() => {
    load()
  }, [load])

  const createIssue = async () => {
    try {
      setSaving(true)
      const data = await api("/purchase/workflow/industrial-issues/options")
      const choices = data?.analyses || []
      if (!choices.length) throw new Error("No completed Purchase Analysis is ready to issue.")
      const selected = window.prompt(`Select analysis number:\n${choices.map((item, index) => `${index + 1}. ${item.analysisReference} — ${item.product?.name || "Product"}`).join("\n")}`, "1")
      if (!selected) return
      const analysis = choices[Number(selected) - 1]
      if (!analysis) throw new Error("Select a valid analysis number.")
      const note = window.prompt("Industrial Purchase Issue note", "") || ""
      await api("/purchase/workflow/industrial-issues", { method: "POST", body: JSON.stringify({ analysis: analysis._id, note }) })
      toast.success("Industrial Purchase Issue draft created")
      await load()
    } catch (actionError) { toast.error(actionError.message) } finally { setSaving(false) }
  }

  const transition = async (item, action) => {
    try {
      if (action === "finalize" && !window.confirm("Finalize this Issue and create its draft Purchase Order?")) return
      setSaving(true)
      await api(`/purchase/workflow/industrial-issues/${item._id}/${action}`, { method: "POST", body: "{}" })
      toast.success(action === "submit" ? "Issue submitted" : "Draft Purchase Order created")
      await load()
    } catch (actionError) { toast.error(actionError.message) } finally { setSaving(false) }
  }

  const suppliers = useMemo(() => {
    const map = new Map()
    rows.forEach((item) => {
      const source = item.supplier
      const key = String(
        normalizeId(source) || source?.businessName || source?.name || ""
      )
      if (!key || map.has(key)) return
      map.set(key, { key, name: relationLabel(source, "Supplier") })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const purchaseTypes = useMemo(
    () => [
      ...new Set(
        rows
          .map((item) => clean(item.purchaseType).toLowerCase())
          .filter(Boolean)
      ),
    ],
    [rows]
  )

  const selectedSupplierName =
    supplier === "all"
      ? ""
      : suppliers.find((item) => item.key === supplier)?.name || "Selected supplier"

  const filterCount =
    (supplier !== "all" ? 1 : 0) + (purchaseType !== "all" ? 1 : 0)

  const filtered = useMemo(() => {
    const search = clean(query).toLowerCase()

    return rows.filter((item) => {
      const supplierKey = String(
        normalizeId(item.supplier) ||
          item.supplier?.businessName ||
          item.supplier?.name ||
          ""
      )

      if (supplier !== "all" && supplierKey !== supplier) return false
      if (
        purchaseType !== "all" &&
        clean(item.purchaseType).toLowerCase() !== purchaseType
      ) {
        return false
      }
      if (!search) return true

      const haystack = [
        item.purchaseReference,
        item.purchaseType,
        item.product?.name,
        item.product?.sku,
        item.supplier?.businessName,
        item.supplier?.name,
        item.quantity,
        item.netAmount,
        item.paymentPlan,
        item.status,
      ]
        .filter((value) => value != null && value !== "")
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [rows, query, supplier, purchaseType])

  const resetFilters = () => {
    setQuery("")
    setSupplier("all")
    setPurchaseType("all")
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
                Purchase Issues
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Review issued purchases, suppliers, quantities and payment plans.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
          <button type="button" className={cn(button, primaryButton)} onClick={createIssue} disabled={saving}>New Industrial Issue</button>
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={() => load({ showToast: true })}
            disabled={loading}
          >
            {loading ? <Spinner /> : <Icon icon={RefreshIcon} className="h-4 w-4" />}
            Refresh
          </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilters
            query={query}
            setQuery={setQuery}
            supplier={supplier}
            setSupplier={setSupplier}
            supplierName={selectedSupplierName}
            purchaseType={purchaseType}
            setPurchaseType={setPurchaseType}
            filterCount={filterCount}
            onOpenFilters={() => setFilterOpen(true)}
            onReset={resetFilters}
          />

          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-gray-900">{filtered.length}</span> purchase record
            {filtered.length === 1 ? "" : "s"}
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
            <Icon icon={Alert02Icon} className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-bold text-rose-800">Could not load purchase issues</p>
              <p className="mt-0.5 text-sm font-medium text-rose-700">{error}</p>
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
          <table className="w-full min-w-[1360px] text-left">
            <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
              <tr className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5">Quantity</th>
                <th className="px-5 py-3.5">Net Amount</th>
                <th className="px-5 py-3.5">Payment Plan</th>
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
                filtered.map((item, index) => {
                  const currency = item.currency || ""

                  return (
                    <motion.tr
                      key={item._id || `${item.purchaseReference}-${index}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.015, 0.15) }}
                      className="group bg-white transition hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.purchaseReference || "-"}
                        </p>
                        {item.createdAt ? (
                          <p className="mt-1 text-xs font-medium text-gray-500">
                            {formatDate(item.createdAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <TypeBadge value={item.purchaseType} />
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
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-indigo-700">
                        {formatMoney(item.netAmount, currency)}
                      </td>
                      <td className="px-5 py-4">
                        <PaymentPlanBadge value={item.paymentPlan} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={item.status} />
                      </td>
                      <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                        <div className="flex justify-end gap-2">
                          {item.status === "draft" ? <button type="button" className={cn(button, primaryButton, "h-10 px-3")} onClick={() => transition(item, "submit")} disabled={saving}>Submit</button> : null}
                          {item.status === "ready" ? <button type="button" className={cn(button, primaryButton, "h-10 px-3")} onClick={() => transition(item, "finalize")} disabled={saving}>Create PO</button> : null}
                          <button
                            type="button"
                            className={cn(button, ghostButton, "h-10 px-3")}
                            onClick={() => setDetails({ open: true, item })}
                          >
                            <Icon icon={ViewIcon} className="h-4 w-4" />
                            View
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-5 py-14 text-center">
                    <Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-3 text-sm font-bold text-gray-900">No purchase issues found</p>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                      Adjust the search or filters to find another purchase record.
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
            filtered.map((item, index) => {
              const currency = item.currency || ""

              return (
                <motion.article
                  key={item._id || `${item.purchaseReference}-${index}`}
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
                        {item.purchaseReference || "-"}
                      </p>
                    </div>
                    <StatusBadge value={item.status} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <TypeBadge value={item.purchaseType} />
                    <PaymentPlanBadge value={item.paymentPlan} />
                  </div>

                  <div className="mt-3 rounded-xl border border-gray-100 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                      Supplier
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                      {relationLabel(item.supplier, "-")}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                    <div>
                      <p className="text-xs font-bold text-gray-400">Quantity</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatNumber(item.quantity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400">Net Amount</p>
                      <p className="mt-1 text-sm font-black text-indigo-700">
                        {formatMoney(item.netAmount, currency)}
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
              )
            })
          ) : (
            <div className="p-12 text-center">
              <Icon icon={FolderLibraryIcon} className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-900">No purchase issues found</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between text-xs font-semibold text-gray-600">
          <p>
            Showing {rows.length} of {total} purchase record{total === 1 ? "" : "s"} {totalPages > 1 ? `· Page ${page} of ${totalPages}` : ""}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(button, ghostButton, "h-8 px-3 text-xs")}
                disabled={page <= 1 || loading}
                onClick={() => {
                  const prev = Math.max(page - 1, 1)
                  setPage(prev)
                  load({ targetPage: prev })
                }}
              >
                <Icon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                className={cn(button, ghostButton, "h-8 px-3 text-xs")}
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const next = Math.min(page + 1, totalPages)
                  setPage(next)
                  load({ targetPage: next })
                }}
              >
                Next
                <Icon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : filtered.length ? (
            <span className="text-xs font-semibold text-gray-400">
              Purchase Management · Purchase Issues
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
        purchaseType={purchaseType}
        setPurchaseType={setPurchaseType}
        purchaseTypes={purchaseTypes}
        onReset={() => {
          setSupplier("all")
          setPurchaseType("all")
        }}
      />

      <DetailsModal
        item={details.item}
        open={details.open}
        onClose={() => setDetails({ open: false, item: null })}
      />
    </div>
  )
}
