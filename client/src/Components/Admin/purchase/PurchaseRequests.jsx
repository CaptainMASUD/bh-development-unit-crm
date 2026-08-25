"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
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
const ENDPOINT = "/purchase/workflow/requests"

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const primaryButton =
  "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700"
const ghostButton =
  "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const successButton =
  "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
const dangerButton =
  "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

const EMPTY_FORM = {
  product: "",
  purpose: "manual",
  requiredQuantity: "",
  reason: "",
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

function normalizeId(value) {
  return value?._id || value || ""
}

function formatNumber(value, maximumFractionDigits = 6) {
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

async function api(path, options = {}) {
  const token = localStorage.getItem("token")

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
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

function Field({ label, hint, required = false, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
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
  const status = clean(value).toLowerCase()

  const styles = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rejected: "bg-rose-50 text-rose-700 ring-rose-200",
    cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
    draft: "bg-gray-100 text-gray-700 ring-gray-200",
  }

  const dot =
    status === "approved"
      ? "bg-emerald-500"
      : status === "rejected"
        ? "bg-rose-500"
        : status === "pending"
          ? "bg-amber-500"
          : "bg-gray-400"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ring-1",
        styles[status] || "bg-indigo-50 text-indigo-700 ring-indigo-200"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {pretty(value)}
    </span>
  )
}

function PurposeBadge({ value }) {
  const purpose = clean(value).toLowerCase()

  const style =
    purpose === "low_stock"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : purpose === "replacement"
        ? "bg-violet-50 text-violet-700 ring-violet-200"
        : purpose === "general"
          ? "bg-sky-50 text-sky-700 ring-sky-200"
          : "bg-indigo-50 text-indigo-700 ring-indigo-200"

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-black ring-1",
        style
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
  status,
  setStatus,
  purpose,
  setPurpose,
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

        {status !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(status)}
            onClear={() => setStatus("all")}
          />
        ) : null}

        {purpose !== "all" ? (
          <FilterChip
            label="Purpose"
            value={pretty(purpose)}
            onClear={() => setPurpose("all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[150px] basis-[180px] flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ outline: "none", boxShadow: "none" }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reference, product or requester..."
          type="search"
          aria-label="Search purchase requests"
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
  status,
  setStatus,
  statuses,
  purpose,
  setPurpose,
  purposes,
  onReset,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Purchase-request filters"
      subtitle="Refine request status and purpose"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <select
            className={input}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {pretty(item)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Purpose">
          <select
            className={input}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          >
            <option value="all">All purposes</option>
            {purposes.map((item) => (
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

function CreateRequestModal({
  open,
  onClose,
  onCreated,
}) {
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!open) return

    let active = true
    setLoadingProducts(true)
    setFormError("")

    api("/inventory/products/options?limit=50")
      .then((data) => {
        if (!active) return
        setProducts(data.products || data.options || [])
      })
      .catch((error) => {
        if (!active) return
        toast.error(error.message || "Failed to load products")
      })
      .finally(() => {
        if (active) setLoadingProducts(false)
      })

    return () => {
      active = false
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM)
      setFormError("")
    }
  }, [open])

  const submit = async (event) => {
    event.preventDefault()
    setFormError("")

    if (!form.product) {
      setFormError("Select a product.")
      return
    }

    if (!Number.isFinite(Number(form.requiredQuantity)) || Number(form.requiredQuantity) <= 0) {
      setFormError("Required quantity must be greater than zero.")
      return
    }

    setSaving(true)

    try {
      await api(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({
          product: form.product,
          purpose: form.purpose,
          requiredQuantity: Number(form.requiredQuantity),
          reason: clean(form.reason),
        }),
      })

      toast.success("Purchase request created")
      onCreated?.()
      onClose?.()
    } catch (error) {
      setFormError(error.message || "Failed to create purchase request")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={() => {
        if (!saving) onClose?.()
      }}
      title="Create Purchase Request"
      subtitle="Record demand for approval and commercial analysis"
      icon={<Icon icon={Add01Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="purchase-request-create-form"
            className={cn(button, primaryButton)}
            disabled={saving || loadingProducts}
          >
            {saving ? (
              <Spinner />
            ) : (
              <Icon icon={Tick02Icon} className="h-4 w-4" />
            )}
            {saving ? "Creating..." : "Create Request"}
          </button>
        </div>
      }
    >
      <form
        id="purchase-request-create-form"
        onSubmit={submit}
        className="space-y-5"
      >
        {formError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {formError}
          </div>
        ) : null}

        <SectionCard
          title="Request information"
          description="Select the required product and explain why the purchase is needed."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Product" required>
                <select
                  className={input}
                  value={form.product}
                  disabled={loadingProducts}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      product: event.target.value,
                    }))
                  }
                >
                  <option value="">
                    {loadingProducts
                      ? "Loading active products..."
                      : "Select active product"}
                  </option>

                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Purpose" required>
              <select
                className={input}
                value={form.purpose}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    purpose: event.target.value,
                  }))
                }
              >
                {["manual", "low_stock", "replacement", "general"].map(
                  (purpose) => (
                    <option key={purpose} value={purpose}>
                      {pretty(purpose)}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Required Quantity" required>
              <input
                className={input}
                type="number"
                min="0.000001"
                step="0.000001"
                value={form.requiredQuantity}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    requiredQuantity: event.target.value,
                  }))
                }
              />
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="Reason"
                hint="Optional context for the reviewer and purchasing team."
              >
                <FocusPlaceholderTextarea
                  className={cn(input, "min-h-[120px] resize-none")}
                  value={form.reason}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Explain why this purchase is required..."
                  maxLength={1500}
                />
              </Field>
            </div>
          </div>
        </SectionCard>
      </form>
    </ModalShell>
  )
}

function DetailsModal({ item, open, onClose }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item?.requestReference || "Purchase-request details"}
      subtitle={
        item
          ? `${item.product?.name || "Product"} · ${
              item.requester?.name || "Requester"
            }`
          : ""
      }
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
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
                Purpose
              </p>
              <div className="mt-2">
                <PurposeBadge value={item.purpose} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Quantity
              </p>
              <p className="mt-2 text-lg font-black text-gray-950">
                {formatNumber(item.requiredQuantity)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Department
              </p>
              <p className="mt-2 truncate text-sm font-black text-gray-950">
                {relationLabel(item.department, "-")}
              </p>
            </div>
          </div>

          <SectionCard
            title="Request information"
            description="Demand and requester information recorded for purchasing review."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Reference", item.requestReference || "-"],
                ["Product", relationLabel(item.product, "-")],
                ["Purpose", pretty(item.purpose)],
                ["Quantity", formatNumber(item.requiredQuantity)],
                ["Requester", relationLabel(item.requester, "-")],
                ["Department", relationLabel(item.department, "-")],
                ["Status", pretty(item.status)],
                ["Created", formatDate(item.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-bold text-gray-400">{label}</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {item.reason ? (
            <SectionCard title="Reason">
              <p className="text-sm font-semibold leading-6 text-gray-700">
                {item.reason}
              </p>
            </SectionCard>
          ) : null}

          {item.rejectionReason || item.reviewReason ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
              {item.rejectionReason || item.reviewReason}
            </div>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  )
}

function ConfirmApproveModal({
  item,
  open,
  working,
  onClose,
  onConfirm,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Approve purchase request"
      subtitle={item?.requestReference || "Purchase request"}
      icon={<Icon icon={Tick02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={onClose}
            disabled={working}
          >
            Cancel
          </button>

          <button
            type="button"
            className={cn(button, primaryButton)}
            onClick={onConfirm}
            disabled={working}
          >
            {working ? (
              <Spinner />
            ) : (
              <Icon icon={Tick02Icon} className="h-4 w-4" />
            )}
            {working ? "Approving..." : "Approve Request"}
          </button>
        </div>
      }
    >
      <p className="text-sm font-medium leading-6 text-gray-600">
        Approve <strong className="font-black text-gray-900">
          {item?.requestReference || "this request"}
        </strong>
        ? It will move forward for purchasing and commercial analysis.
      </p>
    </ModalShell>
  )
}

function RejectModal({
  item,
  open,
  working,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      setReason("")
      setError("")
    }
  }, [open])

  const submit = () => {
    if (!clean(reason)) {
      setError("Rejection reason is required.")
      return
    }

    setError("")
    onConfirm(clean(reason))
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Reject purchase request"
      subtitle={item?.requestReference || "Purchase request"}
      icon={<Icon icon={Alert02Icon} className="h-5 w-5" />}
      maxWidthClass="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={cn(button, ghostButton)}
            onClick={onClose}
            disabled={working}
          >
            Cancel
          </button>

          <button
            type="button"
            className={cn(button, dangerButton)}
            onClick={submit}
            disabled={working}
          >
            {working ? (
              <Spinner />
            ) : (
              <Icon icon={Cancel01Icon} className="h-4 w-4" />
            )}
            {working ? "Rejecting..." : "Reject Request"}
          </button>
        </div>
      }
    >
      <Field
        label="Rejection Reason"
        hint="Explain why the request should not move forward."
        required
      >
        <FocusPlaceholderTextarea
          className={cn(input, "min-h-[120px] resize-none")}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setError("")
          }}
          placeholder="Enter the rejection reason..."
          maxLength={1000}
          autoFocus
        />
      </Field>

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </ModalShell>
  )
}

function TableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`request-skeleton-${index}`}>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-24" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-7 w-24 rounded-full" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="px-5 py-4">
        <Skeleton className="h-7 w-24 rounded-full" />
      </td>
      <td className="sticky right-0 bg-white px-5 py-4">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-10 w-20 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
      </td>
    </tr>
  ))
}

function MobileSkeleton({ rows = 5 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <article key={`request-mobile-skeleton-${index}`} className="p-4">
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

      <div className="mt-4 flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>
    </article>
  ))
}

export default function PurchaseRequests() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [purpose, setPurpose] = useState("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [details, setDetails] = useState({ open: false, item: null })
  const [approveState, setApproveState] = useState({
    open: false,
    item: null,
  })
  const [rejectState, setRejectState] = useState({
    open: false,
    item: null,
  })
  const [busy, setBusy] = useState({ id: "", type: "" })

  const load = useCallback(async ({ showToast = false } = {}) => {
    setLoading(true)
    setError("")

    try {
      const data = await api(ENDPOINT)
      setRows(Array.isArray(data?.items) ? data.items : [])

      if (showToast) {
        toast.success("Purchase requests refreshed")
      }
    } catch (loadError) {
      const message = loadError?.message || "Failed to load purchase requests"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const statuses = useMemo(
    () => [
      ...new Set(
        rows
          .map((item) => clean(item.status).toLowerCase())
          .filter(Boolean)
      ),
    ],
    [rows]
  )

  const purposes = useMemo(
    () => [
      ...new Set(
        rows
          .map((item) => clean(item.purpose).toLowerCase())
          .filter(Boolean)
      ),
    ],
    [rows]
  )

  const filterCount =
    (status !== "all" ? 1 : 0) +
    (purpose !== "all" ? 1 : 0)

  const filtered = useMemo(() => {
    const search = clean(query).toLowerCase()

    return rows.filter((item) => {
      if (
        status !== "all" &&
        clean(item.status).toLowerCase() !== status
      ) {
        return false
      }

      if (
        purpose !== "all" &&
        clean(item.purpose).toLowerCase() !== purpose
      ) {
        return false
      }

      if (!search) return true

      const haystack = [
        item.requestReference,
        item.product?.name,
        item.product?.sku,
        item.purpose,
        item.requiredQuantity,
        item.requester?.name,
        item.department?.name,
        item.status,
      ]
        .filter((value) => value != null && value !== "")
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [rows, query, status, purpose])

  const resetFilters = () => {
    setQuery("")
    setStatus("all")
    setPurpose("all")
  }

  const runAction = async (item, verb, reason = "") => {
    setBusy({ id: item._id, type: verb })

    try {
      await api(`${ENDPOINT}/${item._id}/${verb}`, {
        method: "POST",
        body: JSON.stringify(
          verb === "reject"
            ? { reason }
            : {}
        ),
      })

      toast.success(
        verb === "approve"
          ? "Purchase request approved"
          : "Purchase request rejected"
      )

      setApproveState({ open: false, item: null })
      setRejectState({ open: false, item: null })
      await load()
    } catch (actionError) {
      toast.error(actionError.message || `Failed to ${verb} request`)
    } finally {
      setBusy({ id: "", type: "" })
    }
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
                Purchase Requests
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Record demand, review requests and move approved needs into purchasing.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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

            <button
              type="button"
              className={cn(button, primaryButton)}
              onClick={() => setCreateOpen(true)}
            >
              <Icon icon={Add01Icon} className="h-4 w-4" />
              Create Request
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilters
            query={query}
            setQuery={setQuery}
            status={status}
            setStatus={setStatus}
            purpose={purpose}
            setPurpose={setPurpose}
            filterCount={filterCount}
            onOpenFilters={() => setFilterOpen(true)}
            onReset={resetFilters}
          />

          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-gray-900">{filtered.length}</span>{" "}
            request{filtered.length === 1 ? "" : "s"}
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
                Could not load purchase requests
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
          <table className="w-full min-w-[1280px] text-left">
            <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
              <tr className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Purpose</th>
                <th className="px-5 py-3.5">Quantity</th>
                <th className="px-5 py-3.5">Requester</th>
                <th className="px-5 py-3.5">Department</th>
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
                  const working = String(busy.id) === String(item._id)

                  return (
                    <motion.tr
                      key={item._id || `${item.requestReference}-${index}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.015, 0.15) }}
                      className="group bg-white transition hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.requestReference || "-"}
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
                        <PurposeBadge value={item.purpose} />
                      </td>

                      <td className="px-5 py-4 text-sm font-black text-gray-900">
                        {formatNumber(item.requiredQuantity)}
                      </td>

                      <td className="px-5 py-4">
                        <p className="max-w-[200px] truncate text-sm font-semibold text-gray-900">
                          {relationLabel(item.requester, "-")}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="max-w-[200px] truncate text-sm font-semibold text-gray-700">
                          {relationLabel(item.department, "-")}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge value={item.status} />
                      </td>

                      <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className={cn(button, ghostButton, "h-10 px-3")}
                            onClick={() => setDetails({ open: true, item })}
                            disabled={working}
                          >
                            <Icon icon={ViewIcon} className="h-4 w-4" />
                            View
                          </button>

                          {item.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className={cn(button, successButton, "h-10 px-3")}
                                onClick={() =>
                                  setApproveState({ open: true, item })
                                }
                                disabled={working}
                              >
                                <Icon icon={Tick02Icon} className="h-4 w-4" />
                                Approve
                              </button>

                              <button
                                type="button"
                                className={cn(button, dangerButton, "h-10 px-3")}
                                onClick={() =>
                                  setRejectState({ open: true, item })
                                }
                                disabled={working}
                              >
                                <Icon icon={Cancel01Icon} className="h-4 w-4" />
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="8" className="px-5 py-14 text-center">
                    <Icon
                      icon={FolderLibraryIcon}
                      className="mx-auto h-8 w-8 text-gray-300"
                    />
                    <p className="mt-3 text-sm font-bold text-gray-900">
                      No purchase requests found
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                      Create a new request or adjust the search and filters.
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
              const working = String(busy.id) === String(item._id)

              return (
                <motion.article
                  key={item._id || `${item.requestReference}-${index}`}
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
                        {item.requestReference || "-"}
                      </p>
                    </div>

                    <StatusBadge value={item.status} />
                  </div>

                  <div className="mt-4">
                    <PurposeBadge value={item.purpose} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
                    <div>
                      <p className="text-xs font-bold text-gray-400">Quantity</p>
                      <p className="mt-1 text-sm font-black text-gray-900">
                        {formatNumber(item.requiredQuantity)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-gray-400">Requester</p>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                        {relationLabel(item.requester, "-")}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <p className="text-xs font-bold text-gray-400">Department</p>
                      <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                        {relationLabel(item.department, "-")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        button,
                        ghostButton,
                        item.status === "pending" ? "flex-1" : "w-full"
                      )}
                      onClick={() => setDetails({ open: true, item })}
                      disabled={working}
                    >
                      <Icon icon={ViewIcon} className="h-4 w-4" />
                      View
                    </button>

                    {item.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          className={cn(button, successButton, "flex-1")}
                          onClick={() =>
                            setApproveState({ open: true, item })
                          }
                          disabled={working}
                        >
                          <Icon icon={Tick02Icon} className="h-4 w-4" />
                          Approve
                        </button>

                        <button
                          type="button"
                          className={cn(button, dangerButton, "w-full")}
                          onClick={() =>
                            setRejectState({ open: true, item })
                          }
                          disabled={working}
                        >
                          <Icon icon={Cancel01Icon} className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </motion.article>
              )
            })
          ) : (
            <div className="p-12 text-center">
              <Icon
                icon={FolderLibraryIcon}
                className="mx-auto h-8 w-8 text-gray-300"
              />
              <p className="mt-3 text-sm font-bold text-gray-900">
                No purchase requests found
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-gray-500">
            {filtered.length} request{filtered.length === 1 ? "" : "s"} shown
          </p>
          {filtered.length ? (
            <span className="text-xs font-semibold text-gray-400">
              Purchase Management · Purchase Requests
            </span>
          ) : null}
        </div>
      </div>

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        status={status}
        setStatus={setStatus}
        statuses={statuses}
        purpose={purpose}
        setPurpose={setPurpose}
        purposes={purposes}
        onReset={() => {
          setStatus("all")
          setPurpose("all")
        }}
      />

      <CreateRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load()}
      />

      <DetailsModal
        item={details.item}
        open={details.open}
        onClose={() => setDetails({ open: false, item: null })}
      />

      <ConfirmApproveModal
        item={approveState.item}
        open={approveState.open}
        working={
          Boolean(approveState.item) &&
          String(busy.id) === String(approveState.item?._id) &&
          busy.type === "approve"
        }
        onClose={() => setApproveState({ open: false, item: null })}
        onConfirm={() => {
          if (approveState.item) {
            runAction(approveState.item, "approve")
          }
        }}
      />

      <RejectModal
        item={rejectState.item}
        open={rejectState.open}
        working={
          Boolean(rejectState.item) &&
          String(busy.id) === String(rejectState.item?._id) &&
          busy.type === "reject"
        }
        onClose={() => setRejectState({ open: false, item: null })}
        onConfirm={(reason) => {
          if (rejectState.item) {
            runAction(rejectState.item, "reject", reason)
          }
        }}
      />
    </div>
  )
}
