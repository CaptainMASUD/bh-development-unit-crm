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
  DollarCircleIcon,
  FilterIcon,
  FolderLibraryIcon,
  RefreshIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const ENDPOINT = "/purchase/workflow/dues"

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

function isOverdue(value) {
  if (!value) return false
  const deadline = new Date(value)
  if (Number.isNaN(deadline.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)
  return deadline < today
}

function relationLabel(item, fallback = "-") {
  if (!item) return fallback
  const name = item.businessName || item.name || item.label || fallback
  const code = item.code || item.orderNo || item.sku || ""
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
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    settled: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    partial: "bg-amber-50 text-amber-700 ring-amber-200",
    partially_paid: "bg-amber-50 text-amber-700 ring-amber-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    due: "bg-rose-50 text-rose-700 ring-rose-200",
    overdue: "bg-rose-50 text-rose-700 ring-rose-200",
    open: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    active: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    cancelled: "bg-gray-100 text-gray-600 ring-gray-200",
  }
  const dot = ["paid", "completed", "settled"].includes(status)
    ? "bg-emerald-500"
    : ["due", "overdue"].includes(status)
      ? "bg-rose-500"
      : ["partial", "partially_paid", "pending"].includes(status)
        ? "bg-amber-500"
        : status === "cancelled"
          ? "bg-gray-400"
          : "bg-indigo-500"

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
  deadline,
  setDeadline,
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

        {deadline !== "all" ? (
          <FilterChip
            label="Deadline"
            value={deadline === "overdue" ? "Overdue" : "Upcoming / Current"}
            onClear={() => setDeadline("all")}
          />
        ) : null}

        <FocusPlaceholderInput
          className="h-8 min-w-[150px] basis-[180px] flex-1 border-0 bg-transparent px-1 py-0 text-sm font-medium text-gray-800 outline-none ring-0 shadow-none placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ outline: "none", boxShadow: "none" }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reference, order or supplier..."
          type="search"
          aria-label="Search purchase dues"
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
  deadline,
  setDeadline,
  onReset,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Purchase-due filters"
      subtitle="Refine supplier and deadline results"
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

        <Field label="Payment Deadline">
          <select
            className={input}
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          >
            <option value="all">All deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="current">Upcoming / Current</option>
          </select>
        </Field>
      </div>
    </ModalShell>
  )
}

function PaymentModal({ item, open, onClose, onSuccess }) {
  const [options, setOptions] = useState({ cashAccounts: [], bankAccounts: [] })
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [confirmPrompt, setConfirmPrompt] = useState(false)

  const [paymentType, setPaymentType] = useState("full")
  const [amount, setAmount] = useState("")
  const [paymentAccountType, setPaymentAccountType] = useState("cash")
  const [cashAccount, setCashAccount] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [bankCheckNumber, setBankCheckNumber] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState("")

  const currency = item?.currency || item?.purchaseOrder?.currency || ""
  const remainingDue = Number(item?.remainingDue || 0)

  useEffect(() => {
    if (!open || !item) return
    setError("")
    setConfirmPrompt(false)
    setPaymentType("full")
    setAmount(String(remainingDue))
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setNote("")
    setBankCheckNumber("")

    setLoadingOptions(true)
    api("/purchase/workflow/dues/options")
      .then((res) => {
        const cash = Array.isArray(res?.cashAccounts) ? res.cashAccounts : []
        const bank = Array.isArray(res?.bankAccounts) ? res.bankAccounts : []
        setOptions({ cashAccounts: cash, bankAccounts: bank })
        if (cash.length) setCashAccount(cash[0]._id)
        if (bank.length) setBankAccount(bank[0]._id)
      })
      .catch((e) => {
        setError(e.message || "Failed to load payment accounts.")
      })
      .finally(() => setLoadingOptions(false))
  }, [open, item, remainingDue])

  const parsedAmount = Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100
  const newRemaining = Math.max(0, Math.round((remainingDue - parsedAmount) * 100) / 100)

  const handleTypeToggle = (type) => {
    setPaymentType(type)
    if (type === "full") {
      setAmount(String(remainingDue))
    } else {
      if (parsedAmount >= remainingDue || parsedAmount <= 0) {
        setAmount(String(Math.round((remainingDue / 2) * 100) / 100))
      }
    }
  }

  const handleAmountChange = (val) => {
    setAmount(val)
    const valNum = Number(val || 0)
    if (valNum >= remainingDue && remainingDue > 0) {
      setPaymentType("full")
    } else {
      setPaymentType("partial")
    }
  }

  const validate = () => {
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Payment amount must be greater than zero.")
      return false
    }
    if (parsedAmount > remainingDue) {
      setError(`Payment amount cannot exceed the remaining due (${formatMoney(remainingDue, currency)}).`)
      return false
    }
    if (paymentAccountType === "cash" && !cashAccount) {
      setError("Please select an active cash account.")
      return false
    }
    if (paymentAccountType === "bank") {
      if (!bankAccount) {
        setError("Please select an active bank account.")
        return false
      }
      if (!clean(bankCheckNumber)) {
        setError("Please enter the check / reference number for bank payment.")
        return false
      }
    }
    setError("")
    return true
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    if (!validate()) return

    if (!confirmPrompt) {
      setConfirmPrompt(true)
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const payload = {
        amount: parsedAmount,
        paymentAccountType,
        cashAccount: paymentAccountType === "cash" ? cashAccount : null,
        bankAccount: paymentAccountType === "bank" ? bankAccount : null,
        bankCheckNumber: paymentAccountType === "bank" ? bankCheckNumber : null,
        paymentDate,
        note,
      }

      const res = await fetch(`${API_BASE}/purchase/workflow/dues/${item._id}/pay`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("token") ? { Authorization: `Bearer ${localStorage.getItem("token")}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result?.message || result?.error || "Payment recording failed.")

      toast.success(result?.message || `Payment of ${formatMoney(parsedAmount, currency)} recorded successfully.`)
      onSuccess?.(result?.due)
      onClose?.()
    } catch (err) {
      setError(err.message || "Payment recording failed.")
      setConfirmPrompt(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Record Purchase Payment"
      subtitle={item ? `${item.dueReference} · ${item.supplier?.businessName || item.supplier?.name || "Supplier"}` : ""}
      icon={<Icon icon={DollarCircleIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-semibold text-gray-500">
            {confirmPrompt ? (
              <span className="text-amber-700 font-bold">Please confirm payment details before submitting.</span>
            ) : (
              <span>Remaining after payment: <strong className="text-gray-900">{formatMoney(newRemaining, currency)}</strong></span>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              className={cn(button, ghostButton)}
              onClick={confirmPrompt ? () => setConfirmPrompt(false) : onClose}
              disabled={submitting}
            >
              {confirmPrompt ? "Back" : "Cancel"}
            </button>
            <button
              type="button"
              className={cn(button, primaryButton, confirmPrompt ? "bg-emerald-600 hover:bg-emerald-700" : "")}
              onClick={handleSubmit}
              disabled={submitting || loadingOptions}
            >
              {submitting ? (
                <>
                  <Spinner />
                  Processing...
                </>
              ) : confirmPrompt ? (
                <>
                  <Icon icon={Tick02Icon} className="h-4 w-4" />
                  Confirm & Post Payment
                </>
              ) : (
                <>
                  <Icon icon={DollarCircleIcon} className="h-4 w-4" />
                  Continue to Pay
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      {item ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 flex items-start gap-2">
              <Icon icon={Alert02Icon} className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-center">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Total Payable</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{formatMoney(item.originalNetAmount, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Already Paid</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">{formatMoney(item.currentPaidAmount, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Current Due</p>
              <p className="mt-1 text-sm font-black text-rose-700">{formatMoney(remainingDue, currency)}</p>
            </div>
          </div>

          <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => handleTypeToggle("full")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-bold transition",
                paymentType === "full" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              )}
            >
              Full Payment ({formatMoney(remainingDue, currency)})
            </button>
            <button
              type="button"
              onClick={() => handleTypeToggle("partial")}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-bold transition",
                paymentType === "partial" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
              )}
            >
              Partial Payment
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment Amount">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remainingDue}
                className={input}
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.00"
                required
              />
            </Field>

            <Field label="Payment Date">
              <input
                type="date"
                className={input}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment Method">
              <select
                className={input}
                value={paymentAccountType}
                onChange={(e) => setPaymentAccountType(e.target.value)}
              >
                <option value="cash">Cash Payment</option>
                <option value="bank">Bank / Cheque Payment</option>
              </select>
            </Field>

            {paymentAccountType === "cash" ? (
              <Field label="Cash Account">
                <select
                  className={input}
                  value={cashAccount}
                  onChange={(e) => setCashAccount(e.target.value)}
                  disabled={loadingOptions || !options.cashAccounts.length}
                >
                  {options.cashAccounts.length ? (
                    options.cashAccounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>
                        {acc.name} ({acc.account?.code || "Asset"})
                      </option>
                    ))
                  ) : (
                    <option value="">No active cash account available</option>
                  )}
                </select>
              </Field>
            ) : (
              <Field label="Bank Account">
                <select
                  className={input}
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  disabled={loadingOptions || !options.bankAccounts.length}
                >
                  {options.bankAccounts.length ? (
                    options.bankAccounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>
                        {acc.accountName} - {acc.accountNumber} ({acc.bank?.shortName || "Bank"})
                      </option>
                    ))
                  ) : (
                    <option value="">No active bank account available</option>
                  )}
                </select>
              </Field>
            )}
          </div>

          {paymentAccountType === "bank" ? (
            <Field label="Cheque / Transaction Reference">
              <input
                type="text"
                className={input}
                value={bankCheckNumber}
                onChange={(e) => setBankCheckNumber(e.target.value)}
                placeholder="Cheque No, TT Ref, or Bank Ref"
                required
              />
            </Field>
          ) : null}

          <Field label="Payment Notes / Remarks (Optional)">
            <textarea
              className={cn(input, "h-20 resize-none py-2")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Partial settlement against PO-2026-..."
            />
          </Field>

          {confirmPrompt ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">Are you sure you want to execute this payment?</p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-xs font-semibold text-amber-800">
                <li>Amount: <strong>{formatMoney(parsedAmount, currency)}</strong></li>
                <li>Method: <strong>{paymentAccountType === "cash" ? "Cash" : "Bank"}</strong></li>
                <li>An official Journal Entry will be posted to Accounts Payable and Treasury Ledgers.</li>
                <li>This action immediately reduces remaining supplier due to <strong>{formatMoney(newRemaining, currency)}</strong>.</li>
              </ul>
            </div>
          ) : null}
        </form>
      ) : null}
    </ModalShell>
  )
}

function DetailsModal({ item, open, onClose, onPayDue }) {
  const currency = item?.currency || item?.purchaseOrder?.currency || ""
  const overdue =
    Boolean(item) &&
    isOverdue(item.paymentDeadline) &&
    Number(item.remainingDue || 0) > 0

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={item?.dueReference || "Purchase-due details"}
      subtitle={
        item
          ? `${item.purchaseOrder?.orderNo || "Purchase order"} · ${
              item.supplier?.businessName || item.supplier?.name || "Supplier"
            }`
          : ""
      }
      icon={<Icon icon={ViewIcon} className="h-5 w-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <div>
            {item && Number(item.remainingDue || 0) > 0 && item.status !== "paid" && item.status !== "cancelled" ? (
              <button
                type="button"
                className={cn(button, primaryButton, "bg-emerald-600 hover:bg-emerald-700 text-white")}
                onClick={() => {
                  onClose()
                  onPayDue?.(item)
                }}
              >
                <Icon icon={DollarCircleIcon} className="h-4 w-4" />
                Record Payment
              </button>
            ) : null}
          </div>
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
                Original Amount
              </p>
              <p className="mt-2 text-lg font-black text-gray-950">
                {formatMoney(item.originalNetAmount, currency)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Paid
              </p>
              <p className="mt-2 text-lg font-black text-emerald-700">
                {formatMoney(item.currentPaidAmount, currency)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-400">
                Remaining Due
              </p>
              <p className="mt-2 text-lg font-black text-rose-700">
                {formatMoney(item.remainingDue, currency)}
              </p>
            </div>
          </div>

          <SectionCard
            title="Due information"
            description="Current payable balance linked to the purchase order."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Reference", item.dueReference || "-"],
                ["Purchase Order", item.purchaseOrder?.orderNo || "-"],
                ["Supplier", relationLabel(item.supplier, "-")],
                ["Original Amount", formatMoney(item.originalNetAmount, currency)],
                ["Paid Amount", formatMoney(item.currentPaidAmount, currency)],
                ["Remaining Due", formatMoney(item.remainingDue, currency)],
                ["Payment Deadline", formatDate(item.paymentDeadline)],
                ["Status", pretty(item.status)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-bold text-gray-400">{label}</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {Array.isArray(item.payments) && item.payments.length > 0 ? (
            <SectionCard
              title="Payment History"
              description="Chronological record of settlements applied against this purchase due."
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Account / Method</th>
                      <th className="py-2.5 px-3">Reference / Check</th>
                      <th className="py-2.5 px-3">Recorded By</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
                    {item.payments.map((p, idx) => (
                      <tr key={p._id || idx} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3">{formatDate(p.paymentDate || p.createdAt)}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">{formatMoney(p.amount, currency)}</td>
                        <td className="py-2.5 px-3">
                          {p.cashAccount ? `Cash: ${p.cashAccount.name || "Cash"}` : p.bankAccount ? `Bank: ${p.bankAccount.accountName || "Bank"}` : "Manual"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-600">{p.bankCheckNumber || p.reference || "-"}</td>
                        <td className="py-2.5 px-3">{p.paidBy?.name || "-"}</td>
                        <td className="py-2.5 px-3 text-gray-500 max-w-[180px] truncate">{p.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : null}

          {item.paymentDeadline ? (
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm font-semibold",
                overdue
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              )}
            >
              {overdue
                ? `Payment deadline passed on ${formatDate(item.paymentDeadline)}.`
                : `Payment deadline: ${formatDate(item.paymentDeadline)}.`}
            </div>
          ) : null}
        </div>
      ) : null}
    </ModalShell>
  )
}

function TableSkeleton({ rows = 8 }) {
  return Array.from({ length: rows }).map((_, index) => (
    <tr key={`purchase-dues-skeleton-${index}`}>
      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-36" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
      <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
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
    <article key={`purchase-dues-mobile-skeleton-${index}`} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-28" />
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

export default function PurchaseDues() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [supplier, setSupplier] = useState("all")
  const [deadline, setDeadline] = useState("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [details, setDetails] = useState({ open: false, item: null })
  const [paymentModal, setPaymentModal] = useState({ open: false, item: null })
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
      if (supplier && supplier !== "all") params.set("supplier", supplier)
      if (deadline && deadline !== "all") params.set("deadline", deadline)
      if (clean(query)) params.set("q", clean(query))

      const data = await api(`${ENDPOINT}?${params.toString()}`)
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total) || 0)
      setTotalPages(Number(data?.totalPages) || 1)
      setPage(Number(data?.page) || targetPage)
      if (showToast) toast.success("Purchase dues refreshed")
    } catch (loadError) {
      const message = loadError?.message || "Failed to load purchase dues"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [limit, supplier, deadline, query])

  useEffect(() => {
    load()
  }, [load])

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

  const selectedSupplierName =
    supplier === "all"
      ? ""
      : suppliers.find((item) => item.key === supplier)?.name || "Selected supplier"

  const filterCount =
    (supplier !== "all" ? 1 : 0) + (deadline !== "all" ? 1 : 0)

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
      if (deadline === "overdue" && !isOverdue(item.paymentDeadline)) return false
      if (deadline === "current" && isOverdue(item.paymentDeadline)) return false
      if (!search) return true

      const haystack = [
        item.dueReference,
        item.purchaseOrder?.orderNo,
        item.supplier?.businessName,
        item.supplier?.name,
        item.originalNetAmount,
        item.currentPaidAmount,
        item.remainingDue,
        item.paymentDeadline,
        item.status,
      ]
        .filter((value) => value != null && value !== "")
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [rows, query, supplier, deadline])

  const resetFilters = () => {
    setQuery("")
    setSupplier("all")
    setDeadline("all")
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
                Purchase Dues
              </h1>
              <p className="mt-1 text-sm font-medium text-gray-500">
                Track supplier balances, paid amounts and payment deadlines.
              </p>
            </div>
          </div>

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

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilters
            query={query}
            setQuery={setQuery}
            supplier={supplier}
            setSupplier={setSupplier}
            supplierName={selectedSupplierName}
            deadline={deadline}
            setDeadline={setDeadline}
            filterCount={filterCount}
            onOpenFilters={() => setFilterOpen(true)}
            onReset={resetFilters}
          />

          <p className="shrink-0 text-sm font-semibold text-gray-500">
            <span className="text-gray-900">{filtered.length}</span> due record
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
              <p className="text-sm font-bold text-rose-800">Could not load purchase dues</p>
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
          <table className="w-full min-w-[1320px] text-left">
            <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
              <tr className="text-[11px] font-black uppercase tracking-[0.08em] text-gray-400">
                <th className="px-5 py-3.5">Reference</th>
                <th className="px-5 py-3.5">Purchase Order</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5">Original Amount</th>
                <th className="px-5 py-3.5">Paid</th>
                <th className="px-5 py-3.5">Remaining</th>
                <th className="px-5 py-3.5">Deadline</th>
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
                  const overdue =
                    isOverdue(item.paymentDeadline) && Number(item.remainingDue || 0) > 0
                  const currency = item.currency || item.purchaseOrder?.currency || ""

                  return (
                    <motion.tr
                      key={item._id || `${item.dueReference}-${index}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.015, 0.15) }}
                      className="group bg-white transition hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {item.dueReference || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-[220px] truncate text-sm font-semibold text-gray-900">
                          {item.purchaseOrder?.orderNo || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="max-w-[240px] truncate text-sm font-semibold text-gray-900">
                          {relationLabel(item.supplier, "-")}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-900">
                        {formatMoney(item.originalNetAmount, currency)}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-emerald-700">
                        {formatMoney(item.currentPaidAmount, currency)}
                      </td>
                      <td className="px-5 py-4 text-sm font-black text-rose-700">
                        {formatMoney(item.remainingDue, currency)}
                      </td>
                      <td className="px-5 py-4">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            overdue ? "text-rose-700" : "text-gray-900"
                          )}
                        >
                          {formatDate(item.paymentDeadline)}
                        </p>
                        {overdue ? (
                          <p className="mt-1 text-xs font-black text-rose-500">Overdue</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge value={item.status} />
                      </td>
                      <td className="sticky right-0 bg-white px-5 py-4 shadow-[-16px_0_24px_-24px_rgba(15,23,42,0.7)] group-hover:bg-gray-50/70">
                        <div className="flex justify-end gap-2">
                          {Number(item.remainingDue || 0) > 0 && item.status !== "paid" && item.status !== "cancelled" ? (
                            <button
                              type="button"
                              className={cn(button, primaryButton, "h-10 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10")}
                              onClick={() => setPaymentModal({ open: true, item })}
                            >
                              <Icon icon={DollarCircleIcon} className="h-4 w-4" />
                              Pay Due
                            </button>
                          ) : null}
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
                    <p className="mt-3 text-sm font-bold text-gray-900">No purchase dues found</p>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                      Adjust the search or filters to find another due record.
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
              const overdue =
                isOverdue(item.paymentDeadline) && Number(item.remainingDue || 0) > 0
              const currency = item.currency || item.purchaseOrder?.currency || ""

              return (
                <motion.article
                  key={item._id || `${item.dueReference}-${index}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.15) }}
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {item.dueReference || "-"}
                      </p>
                      <p className="mt-1 truncate text-xs font-medium text-gray-500">
                        {item.purchaseOrder?.orderNo || "No purchase order"}
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
                      <p className="text-xs font-bold text-gray-400">Original</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatMoney(item.originalNetAmount, currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400">Paid</p>
                      <p className="mt-1 text-sm font-bold text-emerald-700">
                        {formatMoney(item.currentPaidAmount, currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400">Remaining</p>
                      <p className="mt-1 text-sm font-black text-rose-700">
                        {formatMoney(item.remainingDue, currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400">Deadline</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold",
                          overdue ? "text-rose-700" : "text-gray-900"
                        )}
                      >
                        {formatDate(item.paymentDeadline)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {Number(item.remainingDue || 0) > 0 && item.status !== "paid" && item.status !== "cancelled" ? (
                      <button
                        type="button"
                        className={cn(button, primaryButton, "h-10 flex-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white")}
                        onClick={() => setPaymentModal({ open: true, item })}
                      >
                        <Icon icon={DollarCircleIcon} className="h-4 w-4" />
                        Pay Due
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={cn(button, ghostButton, "h-10 flex-1 px-3")}
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
              <p className="mt-3 text-sm font-bold text-gray-900">No purchase dues found</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between text-xs font-semibold text-gray-600">
          <p>
            Showing {rows.length} of {total} due record{total === 1 ? "" : "s"} {totalPages > 1 ? `· Page ${page} of ${totalPages}` : ""}
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
              Purchase Management · Purchase Dues
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
        deadline={deadline}
        setDeadline={setDeadline}
        onReset={() => {
          setSupplier("all")
          setDeadline("all")
        }}
      />

      <DetailsModal
        item={details.item}
        open={details.open}
        onClose={() => setDetails({ open: false, item: null })}
        onPayDue={(item) => setPaymentModal({ open: true, item })}
      />

      <PaymentModal
        item={paymentModal.item}
        open={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, item: null })}
        onSuccess={() => load({ showToast: true })}
      />
    </div>
  )
}
