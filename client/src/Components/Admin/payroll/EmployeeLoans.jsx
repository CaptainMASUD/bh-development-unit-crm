"use client"

/**
 * AdminEmployeeLoansPage.updated.jsx
 * BusinessHub CRM — Employee Loan Management UI
 *
 * Lead-page style update:
 * - Premium header card with matching loan icon
 * - Search + filters inside header card
 * - Active filter chips with quick clear
 * - Column picker with view-preference save
 * - Excel export
 * - Dynamic clean table
 * - Mobile loan cards
 * - Create / Edit / View / Cancel / Manual Payment modals
 *
 * Backend endpoints used:
 * - GET    /api/view-preferences/employee-loans.list
 * - PUT    /api/view-preferences/employee-loans.list
 * - GET    /api/users/employees?active=true&limit=100
 * - GET    /api/employee-loans
 * - POST   /api/employee-loans
 * - PATCH  /api/employee-loans/:id
 * - PATCH  /api/employee-loans/:id/cancel
 * - POST   /api/employee-loans/:id/manual-payment
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  Delete02Icon,
  Dollar01Icon,
  File02Icon,
  FilterIcon,
  GridTableIcon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
  TradeDownIcon,
  TradeUpIcon,
  UserIcon,
  ViewIcon,
  Xls01Icon,
} from "@hugeicons/core-free-icons"
import * as XLSX from "xlsx"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const VIEW_KEY = "employee-loans.list"

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const btnSuccess = "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
const btnGreen = "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
const btnRed = "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20"
const btnSoft = "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
const iconBtn =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const label = "mb-1.5 block text-sm font-semibold text-gray-800"
const chip = "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

const LOAN_STATUSES = ["all", "active", "paid", "cancelled"]
const SORT_OPTIONS = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["highest_loan", "Highest loan"],
  ["highest_remaining", "Highest remaining"],
  ["lowest_remaining", "Lowest remaining"],
]

const MONTHS = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
]

const DEFAULT_COLUMNS = [
  "employee",
  "loanNo",
  "status",
  "loanAmount",
  "paidAmount",
  "remainingAmount",
  "installmentAmount",
  "startPeriod",
  "progress",
  "createdAt",
]

const FALLBACK_ALLOWED_COLUMNS = [
  "employee",
  "employeeId",
  "department",
  "position",
  "loanNo",
  "status",
  "loanAmount",
  "paidAmount",
  "remainingAmount",
  "installmentAmount",
  "startPeriod",
  "issueDate",
  "reason",
  "repaymentsCount",
  "progress",
  "createdAt",
  "updatedAt",
]

const COLUMN_LABELS = {
  employee: "Employee",
  employeeId: "Employee ID",
  department: "Department",
  position: "Position",
  loanNo: "Loan No",
  status: "Status",
  loanAmount: "Loan Amount",
  paidAmount: "Paid",
  remainingAmount: "Remaining",
  installmentAmount: "Installment",
  startPeriod: "Start Period",
  issueDate: "Issue Date",
  reason: "Reason",
  repaymentsCount: "Repayments",
  progress: "Progress",
  createdAt: "Created",
  updatedAt: "Updated",
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function getAuthHeaders(extra = {}) {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Request failed")
  }

  return data
}

function normalizeApiList(data, key = "") {
  if (key && Array.isArray(data?.[key])) return data[key]
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.data)) return data.data
  if (Array.isArray(data?.results)) return data.results
  if (Array.isArray(data?.employees)) return data.employees
  if (Array.isArray(data?.employeeLoans)) return data.employeeLoans
  if (Array.isArray(data?.loans)) return data.loans
  return []
}

function formatMoney(value, currency = "BDT") {
  const n = Number(value || 0)
  return `${currency || "BDT"} ${n.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value, withTime = false) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function formatDateInput(value) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const first = parts[0]?.[0] || ""
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""
  return (first + last).toUpperCase()
}

function employeeName(employee) {
  if (!employee) return "Unknown employee"
  if (typeof employee === "string") return employee
  return employee.name || employee.email || employee.employeeId || "Unknown employee"
}

function employeeMeta(employee) {
  if (!employee || typeof employee === "string") return "—"

  const department = employee?.department?.name || ""
  const position = employee?.position?.title || ""
  const employeeId = employee?.employeeId || ""

  return [employeeId, department, position].filter(Boolean).join(" • ") || employee.email || "—"
}

function getEmployeeId(employee) {
  return employee?._id || employee?.id || ""
}

function getLoanId(loan) {
  return loan?._id || loan?.id || ""
}

function getMonthName(month) {
  const item = MONTHS.find(([value]) => Number(value) === Number(month))
  return item?.[1] || month || "—"
}

function getLoanProgress(loan) {
  const total = Number(loan?.loanAmount || 0)
  const paid = Number(loan?.paidAmount || 0)
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (paid / total) * 100))
}

function badgeClass(value) {
  const v = String(value || "").toLowerCase()

  if (["active", "success", "paid", "completed"].includes(v)) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
  }

  if (["pending", "draft", "scheduled"].includes(v)) {
    return "bg-amber-50 text-amber-800 ring-amber-600/10"
  }

  if (["cancelled", "failed", "danger", "overdue"].includes(v)) {
    return "bg-rose-50 text-rose-700 ring-rose-600/10"
  }

  if (["payroll", "manual", "all status", "selected"].includes(v)) {
    return "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
  }

  return "bg-gray-100 text-gray-700 ring-gray-600/10"
}

function Badge({ value }) {
  const text = value === true ? "yes" : value === false ? "no" : String(value || "—")
  return (
    <span className={cn(chip, badgeClass(text))}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
      {text}
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
      <span className="max-w-[180px] truncate sm:max-w-[220px]">{value}</span>
      <HugeiconsIcon icon={Cancel01Icon} size={14} className="shrink-0 text-indigo-600" />
    </button>
  )
}

function ProgressBar({ paid = 0, total = 0 }) {
  const value = Number(total || 0) > 0 ? Math.min(100, Math.max(0, (Number(paid || 0) / Number(total || 0)) * 100)) : 0

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500">Repayment progress</span>
        <span className="text-xs font-black text-gray-800">{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function Field({ label: labelText, hint, children }) {
  return (
    <div>
      <label className={label}>{labelText}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  )
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm">
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-900">{title}</p>
      {subtitle ? <p className="mt-1 max-w-md text-sm text-gray-500">{subtitle}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
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
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.()
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
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
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-gray-50/70 p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                  {icon}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
                  {subtitle ? <p className="truncate text-sm text-gray-600">{subtitle}</p> : null}
                </div>
              </div>

              <button type="button" onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100">
                <HugeiconsIcon icon={Cancel01Icon} size={20} className="text-gray-700" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">
              {children}
            </div>

            {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</div> : null}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* =========================
   API
========================= */

const apiGetViewPref = async (signal) => {
  const res = await fetch(`${API_BASE}/view-preferences/${encodeURIComponent(VIEW_KEY)}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok && res.status !== 304 && res.status !== 404) {
    throw new Error(data?.message || "Failed to load view preferences")
  }

  return data
}

const apiSaveViewPref = (columns) =>
  apiJson(`${API_BASE}/view-preferences/${encodeURIComponent(VIEW_KEY)}`, {
    method: "PUT",
    body: JSON.stringify({ columns }),
  })

const apiListEmployees = async (signal) => {
  const data = await apiJson(`${API_BASE}/users/employees?active=true&limit=100`, { signal })
  return normalizeApiList(data, "employees")
}

const apiListLoans = async ({ page = 1, limit = 20, status = "all", employee = "", q = "", signal } = {}) => {
  const qs = new URLSearchParams()
  qs.set("page", String(page))
  qs.set("limit", String(limit))

  if (status && status !== "all") qs.set("status", status)
  if (employee) qs.set("employee", employee)
  if (q) qs.set("q", q)

  return apiJson(`${API_BASE}/employee-loans?${qs.toString()}`, { signal })
}

const apiCreateLoan = (payload) =>
  apiJson(`${API_BASE}/employee-loans`, {
    method: "POST",
    body: JSON.stringify(payload),
  })

const apiUpdateLoan = (id, payload) =>
  apiJson(`${API_BASE}/employee-loans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })

const apiCancelLoan = (id, payload) =>
  apiJson(`${API_BASE}/employee-loans/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })

const apiManualPayment = (id, payload) =>
  apiJson(`${API_BASE}/employee-loans/${id}/manual-payment`, {
    method: "POST",
    body: JSON.stringify(payload),
  })

/* =========================
   TABLE COLUMNS
========================= */

function getColumnRawValue(loan, column) {
  const employee = loan?.employee

  if (column === "employee") return employeeName(employee)
  if (column === "employeeId") return typeof employee === "object" ? employee?.employeeId || "" : ""
  if (column === "department") return typeof employee === "object" ? employee?.department?.name || loan?.department?.name || "" : loan?.department?.name || ""
  if (column === "position") return typeof employee === "object" ? employee?.position?.title || loan?.position?.title || "" : loan?.position?.title || ""
  if (column === "loanNo") return loan?.loanNo || ""
  if (column === "status") return loan?.status || ""
  if (column === "loanAmount") return Number(loan?.loanAmount || 0)
  if (column === "paidAmount") return Number(loan?.paidAmount || 0)
  if (column === "remainingAmount") return Number(loan?.remainingAmount || 0)
  if (column === "installmentAmount") return Number(loan?.installmentAmount || 0)
  if (column === "startPeriod") return `${getMonthName(loan?.startMonth)} ${loan?.startYear || ""}`.trim()
  if (column === "issueDate") return loan?.issueDate || ""
  if (column === "reason") return loan?.reason || ""
  if (column === "repaymentsCount") return Array.isArray(loan?.repayments) ? loan.repayments.length : 0
  if (column === "progress") return getLoanProgress(loan)
  if (column === "createdAt") return loan?.createdAt || ""
  if (column === "updatedAt") return loan?.updatedAt || ""

  return loan?.[column] ?? ""
}

function renderColumnValue(loan, column) {
  if (column === "employee") {
    return (
      <div className="flex min-w-[220px] items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700">
          {initials(employeeName(loan.employee))}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-gray-900">{employeeName(loan.employee)}</p>
          <p className="truncate text-xs font-semibold text-gray-500">{employeeMeta(loan.employee)}</p>
        </div>
      </div>
    )
  }

  if (column === "status") return <Badge value={loan.status} />

  if (["loanAmount", "paidAmount", "remainingAmount", "installmentAmount"].includes(column)) {
    const isRemaining = column === "remainingAmount"
    return (
      <span className={isRemaining && loan.status === "active" ? "font-black text-rose-700" : "font-bold text-gray-900"}>
        {formatMoney(getColumnRawValue(loan, column))}
      </span>
    )
  }

  if (column === "startPeriod") {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <HugeiconsIcon icon={Calendar03Icon} size={16} className="text-gray-400" />
        {getColumnRawValue(loan, column) || "—"}
      </div>
    )
  }

  if (column === "issueDate" || column === "createdAt" || column === "updatedAt") {
    return formatDate(getColumnRawValue(loan, column), column !== "issueDate")
  }

  if (column === "progress") {
    return (
      <div className="min-w-[160px]">
        <ProgressBar paid={loan.paidAmount} total={loan.loanAmount} />
      </div>
    )
  }

  if (column === "loanNo") {
    return <span className="font-black text-gray-900">{loan.loanNo || "—"}</span>
  }

  const value = getColumnRawValue(loan, column)
  return value === undefined || value === null || value === "" ? "—" : String(value)
}

function exportValue(loan, column) {
  const value = getColumnRawValue(loan, column)

  if (["loanAmount", "paidAmount", "remainingAmount", "installmentAmount"].includes(column)) {
    return Number(value || 0)
  }

  if (column === "progress") {
    return `${Math.round(Number(value || 0))}%`
  }

  if (column === "issueDate" || column === "createdAt" || column === "updatedAt") {
    return formatDate(value, column !== "issueDate")
  }

  return value || ""
}

/* =========================
   COLUMN PICKER
========================= */

function ColumnPickerModal({ open, onClose, allowed = [], selected = [], onSave }) {
  const [q, setQ] = useState("")
  const [local, setLocal] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setQ("")
    setErr("")
    setSaving(false)
    setLocal(selected?.length ? selected : allowed)
  }, [open, selected, allowed])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return allowed

    return allowed.filter((column) => {
      const labelText = String(COLUMN_LABELS[column] || column).toLowerCase()
      return labelText.includes(s) || String(column).toLowerCase().includes(s)
    })
  }, [q, allowed])

  const toggle = (column) => {
    setLocal((prev) =>
      prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column]
    )
  }

  const move = (column, direction) => {
    setLocal((prev) => {
      const currentIndex = prev.indexOf(column)
      if (currentIndex < 0) return prev

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev

      const next = [...prev]
      ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
      return next
    })
  }

  const save = async (columns) => {
    setErr("")
    setSaving(true)

    try {
      await onSave?.(columns)
      onClose?.()
    } catch (error) {
      setErr(error?.message || "Failed to save columns")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Choose columns"
      subtitle="Show, hide and arrange employee loan table columns. Actions stay visible."
      icon={<HugeiconsIcon icon={GridTableIcon} size={20} />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button className={cn(btn, btnGhost, "px-3 py-2")} disabled={saving} onClick={() => setLocal(allowed)}>
              Show all
            </button>
            <button className={cn(btn, btnGhost, "px-3 py-2")} disabled={saving} onClick={() => setLocal(DEFAULT_COLUMNS)}>
              Default
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button className={cn(btn, btnGhost)} disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button className={cn(btn, btnPrimary)} disabled={saving || !local.length} onClick={() => save(local)}>
              {saving ? "Saving..." : "Apply"}
            </button>
          </div>
        </div>
      }
    >
      {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2">
        <HugeiconsIcon icon={Search01Icon} size={16} className="text-gray-400" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="flex-1 border-0 bg-transparent text-sm outline-none"
          placeholder="Search columns..."
        />
        <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>{local.length} selected</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-7">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
            <p className="text-sm font-bold text-gray-900">Available columns</p>
            <p className="text-xs text-gray-500">Select or deselect columns for the table.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
            {filtered.map((column) => {
              const checked = local.includes(column)

              return (
                <button
                  key={column}
                  type="button"
                  onClick={() => toggle(column)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition",
                    checked ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-white hover:bg-gray-50"
                  )}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{COLUMN_LABELS[column] || column}</span>
                    <span className="block truncate text-[11px] text-gray-400">{column}</span>
                  </div>

                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                      checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-transparent"
                    )}
                  >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">Selected order</p>
              <p className="mt-0.5 text-xs text-gray-500">Use arrows to arrange table columns.</p>
            </div>

            <div className="max-h-[430px] space-y-2 overflow-y-auto p-3">
              {local.map((column, index) => (
                <div key={column} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xs font-bold text-gray-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{COLUMN_LABELS[column] || column}</p>
                      <p className="truncate text-[11px] text-gray-400">{column}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => move(column, "up")}
                      disabled={index === 0}
                      className="rounded-xl border border-gray-200 bg-white p-2 transition hover:bg-gray-50 disabled:opacity-40"
                      title="Move up"
                    >
                      <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="rotate-180 text-gray-700" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(column, "down")}
                      disabled={index === local.length - 1}
                      className="rounded-xl border border-gray-200 bg-white p-2 transition hover:bg-gray-50 disabled:opacity-40"
                      title="Move down"
                    >
                      <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="text-gray-700" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(column)}
                      className="rounded-xl border border-gray-200 bg-white p-2 transition hover:bg-gray-50"
                      title="Remove"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-gray-700" />
                    </button>
                  </div>
                </div>
              ))}

              {!local.length ? (
                <EmptyState
                  icon={<HugeiconsIcon icon={GridTableIcon} size={20} />}
                  title="No columns selected"
                  subtitle="Choose at least one column to show in the employee loan table."
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   MODALS
========================= */

function LoanUpsertModal({ open, onClose, mode = "create", initial, employees = [], onSaved }) {
  const currentDate = useMemo(() => new Date(), [])
  const [form, setForm] = useState({
    employee: "",
    loanNo: "",
    loanAmount: "",
    paidAmount: "",
    installmentAmount: "",
    issueDate: "",
    startYear: "",
    startMonth: "",
    reason: "",
    note: "",
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return

    const loan = initial || {}

    setErr("")
    setLoading(false)
    setForm({
      employee: typeof loan.employee === "string" ? loan.employee : loan.employee?._id || "",
      loanNo: loan.loanNo || "",
      loanAmount: loan.loanAmount ?? "",
      paidAmount: loan.paidAmount ?? "",
      installmentAmount: loan.installmentAmount ?? "",
      issueDate: formatDateInput(loan.issueDate) || formatDateInput(currentDate),
      startYear: loan.startYear || currentDate.getFullYear(),
      startMonth: loan.startMonth || currentDate.getMonth() + 1,
      reason: loan.reason || "",
      note: loan.note || "",
    })
  }, [open, initial, currentDate])

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const selectedEmployee = employees.find((item) => String(getEmployeeId(item)) === String(form.employee))

  const submit = async () => {
    setErr("")

    if (mode === "create" && !form.employee) return setErr("Employee is required.")
    if (Number(form.loanAmount || 0) <= 0) return setErr("Loan amount must be greater than 0.")
    if (Number(form.installmentAmount || 0) <= 0) return setErr("Monthly installment must be greater than 0.")
    if (!form.startYear || !form.startMonth) return setErr("Start year and month are required.")

    const payload = {
      ...(mode === "create" ? { employee: form.employee } : {}),
      ...(form.loanNo.trim() && mode === "create" ? { loanNo: form.loanNo.trim() } : {}),
      loanAmount: Number(form.loanAmount || 0),
      installmentAmount: Number(form.installmentAmount || 0),
      issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : undefined,
      startYear: Number(form.startYear),
      startMonth: Number(form.startMonth),
      reason: form.reason.trim(),
      note: form.note.trim(),
    }

    if (mode === "create" && form.paidAmount !== "") {
      payload.paidAmount = Number(form.paidAmount || 0)
    }

    setLoading(true)

    try {
      if (mode === "edit") {
        await apiUpdateLoan(getLoanId(initial), payload)
        toast.success("Loan updated.")
      } else {
        await apiCreateLoan(payload)
        toast.success("Employee loan created.")
      }

      onSaved?.()
      onClose?.()
    } catch (error) {
      setErr(error?.message || "Save failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit employee loan" : "Create employee loan"}
      subtitle={mode === "edit" ? initial?.loanNo || "" : ""}
      icon={mode === "edit" ? <HugeiconsIcon icon={PencilEdit02Icon} size={20} /> : <HugeiconsIcon icon={Add01Icon} size={20} />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <button type="button" className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>
            {loading ? <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin" /> : <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />}
            {mode === "edit" ? "Update loan" : "Create loan"}
          </button>
        </div>
      }
    >
      {err ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Employee *">
          <select className={input} value={form.employee} onChange={update("employee")} disabled={mode === "edit"}>
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={getEmployeeId(employee)} value={getEmployeeId(employee)}>
                {employee.name || employee.email || "Employee"} {employee.employeeId ? `(${employee.employeeId})` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Loan number">
          <input
            className={input}
            value={form.loanNo}
            onChange={update("loanNo")}
            placeholder="Auto generated"
            disabled={mode === "edit"}
          />
        </Field>

        <Field label="Loan amount *">
          <input
            type="number"
            min="0"
            className={input}
            value={form.loanAmount}
            onChange={update("loanAmount")}
            placeholder="50000"
          />
        </Field>

        <Field label="Monthly installment *">
          <input
            type="number"
            min="0"
            className={input}
            value={form.installmentAmount}
            onChange={update("installmentAmount")}
            placeholder="5000"
          />
        </Field>

        {mode === "create" ? (
          <Field label="Already paid amount">
            <input
              type="number"
              min="0"
              className={input}
              value={form.paidAmount}
              onChange={update("paidAmount")}
              placeholder="0"
            />
          </Field>
        ) : null}

        <Field label="Issue date">
          <input type="date" className={input} value={form.issueDate} onChange={update("issueDate")} />
        </Field>

        <Field label="Deduction start year *">
          <input
            type="number"
            min="2000"
            max="3000"
            className={input}
            value={form.startYear}
            onChange={update("startYear")}
          />
        </Field>

        <Field label="Deduction start month *">
          <select className={input} value={form.startMonth} onChange={update("startMonth")}>
            {MONTHS.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <div className="md:col-span-2">
          <Field label="Reason">
            <input
              className={input}
              value={form.reason}
              onChange={update("reason")}
              placeholder="Advance salary, emergency loan, staff support..."
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Note">
            <textarea
              className={cn(input, "min-h-[110px]")}
              value={form.note}
              onChange={update("note")}
              placeholder="Internal notes for admin/payroll team..."
            />
          </Field>
        </div>

      </div>
    </ModalShell>
  )
}

function ManualPaymentModal({ open, onClose, loan, onSaved }) {
  const [form, setForm] = useState({
    amount: "",
    paymentDate: "",
    transactionRef: "",
    note: "",
  })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    const today = new Date()
    setErr("")
    setLoading(false)
    setForm({
      amount: "",
      paymentDate: formatDateInput(today),
      transactionRef: "",
      note: "",
    })
  }, [open])

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const submit = async () => {
    setErr("")

    if (Number(form.amount || 0) <= 0) return setErr("Payment amount must be greater than 0.")

    setLoading(true)

    try {
      await apiManualPayment(getLoanId(loan), {
        amount: Number(form.amount || 0),
        paymentDate: form.paymentDate ? new Date(form.paymentDate).toISOString() : undefined,
        transactionRef: form.transactionRef.trim(),
        note: form.note.trim(),
      })

      toast.success("Manual payment added.")
      onSaved?.()
      onClose?.()
    } catch (error) {
      setErr(error?.message || "Payment failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Add manual payment"
      subtitle={loan?.loanNo || employeeName(loan?.employee)}
      icon={<HugeiconsIcon icon={CreditCardIcon} size={20} />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className={cn(btn, btnGreen)} onClick={submit} disabled={loading}>
            {loading ? <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin" /> : <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />}
            Add payment
          </button>
        </div>
      }
    >
      {err ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500">Remaining</p>
            <p className="mt-1 text-lg font-black text-gray-900">{formatMoney(loan?.remainingAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Installment</p>
            <p className="mt-1 text-lg font-black text-gray-900">{formatMoney(loan?.installmentAmount)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <Field label="Amount *">
          <input type="number" min="0" className={input} value={form.amount} onChange={update("amount")} />
        </Field>

        <Field label="Payment date">
          <input type="date" className={input} value={form.paymentDate} onChange={update("paymentDate")} />
        </Field>

        <Field label="Transaction reference">
          <input className={input} value={form.transactionRef} onChange={update("transactionRef")} placeholder="Cash/bank/mobile ref" />
        </Field>

        <Field label="Note">
          <textarea className={cn(input, "min-h-[100px]")} value={form.note} onChange={update("note")} />
        </Field>
      </div>
    </ModalShell>
  )
}

function CancelLoanModal({ open, onClose, loan, onSaved }) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setReason("")
    setErr("")
    setLoading(false)
  }, [open])

  const submit = async () => {
    setErr("")
    if (!reason.trim()) return setErr("Cancel reason is required.")

    setLoading(true)

    try {
      await apiCancelLoan(getLoanId(loan), { cancelReason: reason.trim() })
      toast.success("Loan cancelled.")
      onSaved?.()
      onClose?.()
    } catch (error) {
      setErr(error?.message || "Cancel failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Cancel employee loan?"
      subtitle={loan?.loanNo || employeeName(loan?.employee)}
      icon={<HugeiconsIcon icon={Alert02Icon} size={20} />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>
            Keep loan
          </button>
          <button type="button" className={cn(btn, btnRed)} onClick={submit} disabled={loading}>
            {loading ? <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin" /> : <HugeiconsIcon icon={CancelCircleIcon} size={16} />}
            Cancel loan
          </button>
        </div>
      }
    >
      {err ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {err}
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
        Cancelling will stop future payroll deductions for this loan. Paid loans cannot be cancelled.
      </div>

      <Field label="Cancel reason *">
        <textarea
          className={cn(input, "min-h-[120px]")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Write why this loan is being cancelled..."
        />
      </Field>
    </ModalShell>
  )
}

function LoanDetailsModal({ open, onClose, loan, onEdit, onPayment, onCancel }) {
  const repayments = Array.isArray(loan?.repayments) ? loan.repayments : []

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Loan details"
      subtitle={loan?.loanNo || employeeName(loan?.employee)}
      icon={<HugeiconsIcon icon={ViewIcon} size={20} />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col justify-between gap-2 sm:flex-row">
          <button type="button" className={cn(btn, btnGhost)} onClick={onClose}>
            Close
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            {loan?.status === "active" ? (
              <>
                <button type="button" className={cn(btn, btnGreen)} onClick={() => onPayment?.(loan)}>
                  <HugeiconsIcon icon={CreditCardIcon} size={16} />
                  Manual payment
                </button>
                <button type="button" className={cn(btn, btnPrimary)} onClick={() => onEdit?.(loan)}>
                  <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
                  Edit
                </button>
                <button type="button" className={cn(btn, btnRed)} onClick={() => onCancel?.(loan)}>
                  <HugeiconsIcon icon={CancelCircleIcon} size={16} />
                  Cancel
                </button>
              </>
            ) : null}
          </div>
        </div>
      }
    >
      {!loan ? (
        <EmptyState icon={<HugeiconsIcon icon={File02Icon} size={20} />} title="No loan selected" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className={cn(card, "p-5 lg:col-span-5")}>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-black text-indigo-700">
                  {initials(employeeName(loan.employee))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black text-gray-900">{employeeName(loan.employee)}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-500">{employeeMeta(loan.employee)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge value={loan.status} />
                    <Badge value={loan.loanNo} />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <ProgressBar paid={loan.paidAmount} total={loan.loanAmount} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
              <SummaryTile icon={<HugeiconsIcon icon={Dollar01Icon} size={20} />} label="Loan amount" value={formatMoney(loan.loanAmount)} />
              <SummaryTile icon={<HugeiconsIcon icon={TradeUpIcon} size={20} />} label="Paid amount" value={formatMoney(loan.paidAmount)} tone="emerald" />
              <SummaryTile icon={<HugeiconsIcon icon={TradeDownIcon} size={20} />} label="Remaining" value={formatMoney(loan.remainingAmount)} tone="rose" />
              <SummaryTile icon={<HugeiconsIcon icon={Calendar03Icon} size={20} />} label="Monthly installment" value={formatMoney(loan.installmentAmount)} tone="indigo" />
            </div>
          </div>

          <div className={cn(card, "p-5")}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-gray-900">Loan information</p>
                <p className="mt-1 text-sm text-gray-500">Issue date, deduction start, reason and internal notes.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DetailRow label="Issue date" value={formatDate(loan.issueDate)} />
              <DetailRow label="Deduction starts" value={`${getMonthName(loan.startMonth)} ${loan.startYear || ""}`} />
              <DetailRow label="Reason" value={loan.reason || "—"} />
              <DetailRow label="Created" value={formatDate(loan.createdAt, true)} />
              <div className="md:col-span-2">
                <DetailRow label="Note" value={loan.note || "—"} />
              </div>
              {loan.status === "cancelled" ? (
                <>
                  <DetailRow label="Cancelled at" value={formatDate(loan.cancelledAt, true)} />
                  <DetailRow label="Cancel reason" value={loan.cancelReason || "—"} />
                </>
              ) : null}
            </div>
          </div>

          <div className={cn(card, "overflow-hidden")}>
            <div className="border-b border-gray-100 bg-gray-50/70 px-5 py-4">
              <p className="text-sm font-black text-gray-900">Repayment history</p>
              <p className="mt-1 text-sm text-gray-500">Manual payments and payroll deductions will appear here.</p>
            </div>

            <div className="p-4">
              {repayments.length ? (
                <div className="space-y-3">
                  {repayments
                    .slice()
                    .sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0))
                    .map((repayment, index) => (
                      <div key={repayment._id || index} className="rounded-2xl border border-gray-100 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge value={repayment.method || "manual"} />
                              {repayment.payroll ? <Badge value="payroll linked" /> : null}
                            </div>
                            <p className="mt-2 text-sm font-bold text-gray-900">{repayment.note || "Loan repayment"}</p>
                            <p className="mt-1 text-xs font-semibold text-gray-500">
                              {formatDate(repayment.paymentDate, true)}
                              {repayment.transactionRef ? ` • Ref: ${repayment.transactionRef}` : ""}
                            </p>
                          </div>
                          <p className="text-lg font-black text-gray-900">{formatMoney(repayment.amount)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState
                  icon={<HugeiconsIcon icon={CreditCardIcon} size={20} />}
                  title="No repayment yet"
                  subtitle="Payroll deductions or manual payments will be listed here."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  )
}


function HeaderSearchFilters({
  filters,
  updateFilter,
  resetFilters,
  selectedEmployee,
  selectedSortLabel,
  activeFilterCount,
  onOpenFilters,
}) {
  return (
    <div
      className={cn(
        "w-full transition-all duration-200",
        activeFilterCount
          ? "lg:min-w-[520px] lg:max-w-[72%] lg:flex-[0_1_72%]"
          : "lg:max-w-[46%] lg:flex-[0_1_46%]"
      )}
    >
      <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <HugeiconsIcon icon={Search01Icon} size={16} className="shrink-0 text-gray-400" />

        {filters.q.trim() ? (
          <FilterChip label="Search" value={filters.q.trim()} onClear={() => updateFilter("q", "")} />
        ) : null}

        {filters.status !== "all" ? (
          <FilterChip label="Status" value={filters.status} onClear={() => updateFilter("status", "all")} />
        ) : null}

        {filters.employee ? (
          <FilterChip
            label="Employee"
            value={selectedEmployee ? employeeName(selectedEmployee) : "Selected employee"}
            onClear={() => updateFilter("employee", "")}
          />
        ) : null}

        {filters.sort !== "newest" ? (
          <FilterChip label="Sort" value={selectedSortLabel} onClear={() => updateFilter("sort", "newest")} />
        ) : null}

        <input
          className="min-w-[110px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder={activeFilterCount ? "Search..." : "Search loan no..."}
          type="text"
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
          <HugeiconsIcon icon={FilterIcon} size={14} />
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
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function LoanFilterModal({
  open,
  onClose,
  filters,
  updateFilter,
  resetFilters,
  employees,
  selectedEmployee,
  selectedSortLabel,
  activeFilterCount,
  loadLoans,
}) {
  const apply = () => {
    loadLoans?.()
    onClose?.()
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filter employee loans"
      subtitle="Filter and sort employee loans like the lead list."
      icon={<HugeiconsIcon icon={FilterIcon} size={20} />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(chip, activeFilterCount ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10" : "bg-gray-100 text-gray-600 ring-gray-600/10")}>
              {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
            </span>
            {selectedEmployee ? (
              <span className={cn(chip, "bg-white text-gray-700 ring-gray-200")}>
                <HugeiconsIcon icon={UserIcon} size={14} />
                {employeeName(selectedEmployee)}
              </span>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className={cn(btn, btnGhost)} onClick={resetFilters}>
              Reset
            </button>
            <button type="button" className={cn(btn, btnPrimary)} onClick={apply}>
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Loan status">
          <select className={input} value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            {LOAN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All loan status" : status}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sort order">
          <select className={input} value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
            {SORT_OPTIONS.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <div className="md:col-span-2">
          <Field label="Employee">
            <select className={input} value={filters.employee} onChange={(event) => updateFilter("employee", event.target.value)}>
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={getEmployeeId(employee)} value={getEmployeeId(employee)}>
                  {employee.name || employee.email || "Employee"} {employee.employeeId ? `(${employee.employeeId})` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm font-black text-gray-900">Active filters</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.q.trim() ? (
              <FilterChip label="Search" value={filters.q.trim()} onClear={() => updateFilter("q", "")} />
            ) : null}
            {filters.status !== "all" ? (
              <FilterChip label="Status" value={filters.status} onClear={() => updateFilter("status", "all")} />
            ) : null}
            {filters.employee ? (
              <FilterChip
                label="Employee"
                value={selectedEmployee ? employeeName(selectedEmployee) : "Selected employee"}
                onClear={() => updateFilter("employee", "")}
              />
            ) : null}
            {filters.sort !== "newest" ? (
              <FilterChip label="Sort" value={selectedSortLabel} onClear={() => updateFilter("sort", "newest")} />
            ) : null}
            {!activeFilterCount ? (
              <span className="text-sm font-semibold text-gray-500">No active filter selected.</span>
            ) : null}
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function RowActionMenu({ loan, onView, onEdit, onPayment, onCancel }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)

  const canManage = loan?.status === "active"

  const closeMenu = useCallback(() => {
    setOpen(false)
  }, [])

  const runAction = useCallback(
    (action) => {
      closeMenu()
      window.requestAnimationFrame(() => {
        action?.(loan)
      })
    },
    [closeMenu, loan]
  )

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = 216
      const height = canManage ? 210 : 126
      const gap = 8
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
      const openAbove = rect.bottom + height + gap > window.innerHeight
      const top = openAbove ? Math.max(12, rect.top - height - gap) : Math.min(window.innerHeight - height - 12, rect.bottom + gap)

      setPosition({ top, left })
    }

    updatePosition()

    const close = () => closeMenu()
    const onKey = (event) => event.key === "Escape" && closeMenu()

    window.addEventListener("click", close)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)

    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, canManage, closeMenu])

  const itemClass =
    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50"

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{ position: "fixed", top: position.top, left: position.left, width: 216 }}
            className="z-[9999] overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 text-left shadow-[0_18px_50px_-24px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={itemClass} onClick={() => runAction(onView)}>
              <HugeiconsIcon icon={ViewIcon} size={16} className="text-indigo-600" />
              View details
            </button>

            {canManage ? (
              <>
                <button type="button" className={itemClass} onClick={() => runAction(onPayment)}>
                  <HugeiconsIcon icon={CreditCardIcon} size={16} className="text-emerald-600" />
                  Manual payment
                </button>
                <button type="button" className={itemClass} onClick={() => runAction(onEdit)}>
                  <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="text-gray-600" />
                  Edit loan
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  onClick={() => runAction(onCancel)}
                >
                  <HugeiconsIcon icon={CancelCircleIcon} size={16} />
                  Cancel loan
                </button>
              </>
            ) : (
              <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                No more actions for {loan?.status || "this"} loan.
              </div>
            )}
          </motion.div>,
          document.body
        )
      : null

  return (
    <div className="relative flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <button type="button" className={cn(btn, btnPrimary, "h-10 px-3 py-2 shadow-sm shadow-indigo-600/20")} onClick={() => runAction(onView)}>
        <HugeiconsIcon icon={ViewIcon} size={16} />
        View
      </button>

      <button
        ref={buttonRef}
        type="button"
        className={iconBtn}
        title="More actions"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
      >
        <HugeiconsIcon icon={MoreVerticalIcon} size={16} />
      </button>

      {menu}
    </div>
  )
}


function TableLoadingState({ colSpan = 1 }) {
  return (
    <tr>
      <td colSpan={colSpan} className="bg-white p-8">
        <div className="flex justify-center p-10">
          <HugeiconsIcon icon={RefreshIcon} size={24} className="animate-spin text-indigo-600" />
        </div>
      </td>
    </tr>
  )
}

function MobileLoadingState() {
  return (
    <div className="flex justify-center rounded-2xl border border-gray-100 bg-white p-10">
      <HugeiconsIcon icon={RefreshIcon} size={24} className="animate-spin text-indigo-600" />
    </div>
  )
}

/* =========================
   PAGE
========================= */

export default function AdminEmployeeLoansPage() {
  const [employees, setEmployees] = useState([])
  const [loans, setLoans] = useState([])
  const [columns, setColumns] = useState(DEFAULT_COLUMNS)
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [prefLoading, setPrefLoading] = useState(false)
  const [err, setErr] = useState("")

  const [filters, setFilters] = useState({
    q: "",
    status: "all",
    employee: "",
    sort: "newest",
    page: 1,
    limit: 20,
  })

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  })

  const [upsertModal, setUpsertModal] = useState({ open: false, mode: "create", loan: null })
  const [detailsModal, setDetailsModal] = useState({ open: false, loan: null })
  const [paymentModal, setPaymentModal] = useState({ open: false, loan: null })
  const [cancelModal, setCancelModal] = useState({ open: false, loan: null })

  const loadColumns = useCallback(async () => {
    const controller = new AbortController()
    setPrefLoading(true)

    try {
      const data = await apiGetViewPref(controller.signal)
      const savedColumns =
        data?.columns ||
        data?.viewPreference?.columns ||
        data?.preference?.columns ||
        data?.item?.columns ||
        []

      if (Array.isArray(savedColumns) && savedColumns.length) {
        const safeColumns = savedColumns.filter((column) => FALLBACK_ALLOWED_COLUMNS.includes(column))
        setColumns(safeColumns.length ? safeColumns : DEFAULT_COLUMNS)
      }
    } catch {
      setColumns(DEFAULT_COLUMNS)
    } finally {
      setPrefLoading(false)
    }

    return () => controller.abort()
  }, [])

  const saveColumns = async (nextColumns) => {
    const safeColumns = nextColumns.filter((column) => FALLBACK_ALLOWED_COLUMNS.includes(column))
    setColumns(safeColumns.length ? safeColumns : DEFAULT_COLUMNS)

    try {
      await apiSaveViewPref(safeColumns.length ? safeColumns : DEFAULT_COLUMNS)
      toast.success("Columns updated.")
    } catch (error) {
      localStorage.setItem(VIEW_KEY, JSON.stringify(safeColumns.length ? safeColumns : DEFAULT_COLUMNS))
      toast.success("Columns updated locally.")
    }
  }

  const loadEmployees = useCallback(async () => {
    const controller = new AbortController()
    setEmployeeLoading(true)

    try {
      const list = await apiListEmployees(controller.signal)
      setEmployees(list)
    } catch {
      setEmployees([])
    } finally {
      setEmployeeLoading(false)
    }

    return () => controller.abort()
  }, [])

  const loadLoans = useCallback(async () => {
    const controller = new AbortController()
    setLoading(true)
    setErr("")

    try {
      const data = await apiListLoans({
        ...filters,
        signal: controller.signal,
      })

      const items = normalizeApiList(data, "employeeLoans")

      setLoans(items)
      setPagination({
        total: Number(data?.total || items.length || 0),
        page: Number(data?.page || filters.page || 1),
        limit: Number(data?.limit || filters.limit || 20),
        totalPages: Number(data?.totalPages || 1),
      })
    } catch (error) {
      setErr(error?.message || "Failed to load employee loans.")
      setLoans([])
    } finally {
      setLoading(false)
    }

    return () => controller.abort()
  }, [filters])

  useEffect(() => {
    const localColumns = localStorage.getItem(VIEW_KEY)
    if (localColumns) {
      try {
        const parsed = JSON.parse(localColumns)
        if (Array.isArray(parsed) && parsed.length) {
          setColumns(parsed.filter((column) => FALLBACK_ALLOWED_COLUMNS.includes(column)))
        }
      } catch {}
    }

    loadColumns()
    loadEmployees()
  }, [loadColumns, loadEmployees])

  useEffect(() => {
    loadLoans()
  }, [loadLoans])

  const sortedLoans = useMemo(() => {
    const safe = Array.isArray(loans) ? [...loans] : []

    if (filters.sort === "oldest") {
      return safe.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    }

    if (filters.sort === "highest_loan") {
      return safe.sort((a, b) => Number(b.loanAmount || 0) - Number(a.loanAmount || 0))
    }

    if (filters.sort === "highest_remaining") {
      return safe.sort((a, b) => Number(b.remainingAmount || 0) - Number(a.remainingAmount || 0))
    }

    if (filters.sort === "lowest_remaining") {
      return safe.sort((a, b) => Number(a.remainingAmount || 0) - Number(b.remainingAmount || 0))
    }

    return safe.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [loans, filters.sort])

  const stats = useMemo(() => {
    const safe = Array.isArray(loans) ? loans : []

    return safe.reduce(
      (acc, loan) => {
        acc.totalLoans += Number(loan.loanAmount || 0)
        acc.totalPaid += Number(loan.paidAmount || 0)
        acc.totalRemaining += Number(loan.remainingAmount || 0)

        if (loan.status === "active") acc.active += 1
        if (loan.status === "paid") acc.paid += 1
        if (loan.status === "cancelled") acc.cancelled += 1

        return acc
      },
      {
        active: 0,
        paid: 0,
        cancelled: 0,
        totalLoans: 0,
        totalPaid: 0,
        totalRemaining: 0,
      }
    )
  }, [loans])

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(getEmployeeId(employee)) === String(filters.employee)),
    [employees, filters.employee]
  )

  const selectedSortLabel = useMemo(() => {
    return SORT_OPTIONS.find(([value]) => value === filters.sort)?.[1] || "Newest first"
  }, [filters.sort])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.q.trim()) count += 1
    if (filters.status !== "all") count += 1
    if (filters.employee) count += 1
    if (filters.sort !== "newest") count += 1
    return count
  }, [filters])

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? Number(value) : 1,
    }))
  }

  const resetFilters = () => {
    setFilters((prev) => ({
      ...prev,
      q: "",
      status: "all",
      employee: "",
      sort: "newest",
      page: 1,
    }))
  }

  const refreshAll = () => {
    loadLoans()
    loadEmployees()
  }

  const exportLoans = () => {
    const visibleColumns = columns.length ? columns : DEFAULT_COLUMNS

    const rows = sortedLoans.map((loan) => {
      const row = {}

      visibleColumns.forEach((column) => {
        row[COLUMN_LABELS[column] || column] = exportValue(loan, column)
      })

      return row
    })

    if (!rows.length) {
      toast.error("No loan data to export.")
      return
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Employee Loans")
    XLSX.writeFile(wb, `employee-loans-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const openCreate = () => setUpsertModal({ open: true, mode: "create", loan: null })
  const openEdit = (loan) => setUpsertModal({ open: true, mode: "edit", loan })
  const openDetails = (loan) => setDetailsModal({ open: true, loan })
  const openPayment = (loan) => setPaymentModal({ open: true, loan })
  const openCancel = (loan) => setCancelModal({ open: true, loan })

  const closeUpsert = () => setUpsertModal({ open: false, mode: "create", loan: null })
  const closeDetails = () => setDetailsModal({ open: false, loan: null })
  const closePayment = () => setPaymentModal({ open: false, loan: null })
  const closeCancel = () => setCancelModal({ open: false, loan: null })

  const canGoPrev = Number(pagination.page || 1) > 1
  const canGoNext = Number(pagination.page || 1) < Number(pagination.totalPages || 1)

  return (
    <div className={shell}>
      <Toaster position="top-right" />

      <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-8">
        <section className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                <HugeiconsIcon icon={CreditCardIcon} size={20} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Employee Loans</h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className={cn(btn, btnGhost)} onClick={refreshAll} disabled={loading || employeeLoading}>
                <HugeiconsIcon icon={RefreshIcon} size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button type="button" className={cn(btn, btnGhost)} onClick={() => setColumnModalOpen(true)} disabled={prefLoading}>
                <HugeiconsIcon icon={GridTableIcon} size={16} />
                Columns
              </button>
              <button type="button" className={cn(btn, btnGhost)} onClick={exportLoans}>
                <HugeiconsIcon icon={Xls01Icon} size={16} />
                Export
              </button>
              <button type="button" className={cn(btn, btnPrimary)} onClick={openCreate}>
                <HugeiconsIcon icon={Add01Icon} size={16} />
                New Loan
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <HeaderSearchFilters
              filters={filters}
              updateFilter={updateFilter}
              resetFilters={resetFilters}
              selectedEmployee={selectedEmployee}
              selectedSortLabel={selectedSortLabel}
              activeFilterCount={activeFilterCount}
              onOpenFilters={() => setFilterModalOpen(true)}
            />

            <p className="text-sm font-bold text-gray-500">
              Showing <span className="text-gray-900">{sortedLoans.length}</span> of <span className="text-gray-900">{pagination.total}</span> loans
            </p>
          </div>
        </section>

        {err ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            <div className="flex items-start gap-2">
              <HugeiconsIcon icon={AlertCircleIcon} size={16} className="mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          </div>
        ) : null}

        <section className={cn(card, "overflow-hidden")}>
          <div className="hidden h-[620px] overflow-auto xl:block">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="sticky top-0 z-20 bg-gray-50/95">
                <tr>
                  {(columns.length ? columns : DEFAULT_COLUMNS).map((column) => (
                    <Th key={column}>{COLUMN_LABELS[column] || column}</Th>
                  ))}
                  <Th align="right" sticky>Actions</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <TableLoadingState colSpan={(columns.length ? columns.length : DEFAULT_COLUMNS.length) + 1} />
                ) : sortedLoans.length ? (
                  <AnimatePresence initial={false}>
                    {sortedLoans.map((loan) => (
                      <motion.tr
                        key={getLoanId(loan)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="transition hover:bg-gray-50/70"
                      >
                        {(columns.length ? columns : DEFAULT_COLUMNS).map((column) => (
                          <Td key={`${getLoanId(loan)}-${column}`}>
                            {renderColumnValue(loan, column)}
                          </Td>
                        ))}
                        <Td align="right" sticky>
                          <RowActionMenu
                            loan={loan}
                            onView={openDetails}
                            onEdit={openEdit}
                            onPayment={openPayment}
                            onCancel={openCancel}
                          />
                        </Td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                ) : (
                  <tr>
                    <td colSpan={(columns.length ? columns.length : DEFAULT_COLUMNS.length) + 1} className="p-6">
                      <EmptyState
                        icon={<HugeiconsIcon icon={CreditCardIcon} size={20} />}
                        title="No employee loans found"
                        subtitle="Create a new employee loan to start monthly salary deduction tracking."
                        action={
                          <button type="button" className={cn(btn, btnPrimary)} onClick={openCreate}>
                            <HugeiconsIcon icon={Add01Icon} size={16} />
                            Create first loan
                          </button>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 xl:hidden">
            {loading ? (
              <MobileLoadingState />
            ) : sortedLoans.length ? (
              sortedLoans.map((loan) => (
                <LoanMobileCard
                  key={getLoanId(loan)}
                  loan={loan}
                  onView={openDetails}
                  onEdit={openEdit}
                  onPayment={openPayment}
                  onCancel={openCancel}
                />
              ))
            ) : (
              <EmptyState
                icon={<HugeiconsIcon icon={CreditCardIcon} size={20} />}
                title="No employee loans found"
                subtitle="Create a new employee loan to start monthly salary deduction tracking."
                action={
                  <button type="button" className={cn(btn, btnPrimary)} onClick={openCreate}>
                    <HugeiconsIcon icon={Add01Icon} size={16} />
                    Create first loan
                  </button>
                }
              />
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-gray-500">
              Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} total
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={cn(btn, btnGhost, "px-3 py-2")}
                disabled={!canGoPrev || loading}
                onClick={() => updateFilter("page", Number(pagination.page || 1) - 1)}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                Previous
              </button>
              <button
                type="button"
                className={cn(btn, btnGhost, "px-3 py-2")}
                disabled={!canGoNext || loading}
                onClick={() => updateFilter("page", Number(pagination.page || 1) + 1)}
              >
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <LoanFilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        employees={employees}
        selectedEmployee={selectedEmployee}
        selectedSortLabel={selectedSortLabel}
        activeFilterCount={activeFilterCount}
        loadLoans={loadLoans}
      />

      <ColumnPickerModal
        open={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        allowed={FALLBACK_ALLOWED_COLUMNS}
        selected={columns}
        onSave={saveColumns}
      />

      <LoanUpsertModal
        open={upsertModal.open}
        mode={upsertModal.mode}
        initial={upsertModal.loan}
        employees={employees}
        onClose={closeUpsert}
        onSaved={refreshAll}
      />

      <LoanDetailsModal
        open={detailsModal.open}
        loan={detailsModal.loan}
        onClose={closeDetails}
        onEdit={(loan) => {
          closeDetails()
          openEdit(loan)
        }}
        onPayment={(loan) => {
          closeDetails()
          openPayment(loan)
        }}
        onCancel={(loan) => {
          closeDetails()
          openCancel(loan)
        }}
      />

      <ManualPaymentModal
        open={paymentModal.open}
        loan={paymentModal.loan}
        onClose={closePayment}
        onSaved={refreshAll}
      />

      <CancelLoanModal
        open={cancelModal.open}
        loan={cancelModal.loan}
        onClose={closeCancel}
        onSaved={refreshAll}
      />
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-gray-900">{value || "—"}</p>
    </div>
  )
}

function SummaryTile({ icon, label, value, tone = "gray" }) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700"
        : tone === "indigo"
          ? "bg-indigo-50 text-indigo-700"
          : "bg-gray-50 text-gray-700"

  return (
    <div className={cn(card, "p-5")}>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl text-xl", toneClass)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-1 truncate text-lg font-black text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function Th({ children, align = "left", sticky = false }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-5 py-3 text-[11px] font-black uppercase tracking-wide text-gray-400",
        align === "right" ? "text-right" : "text-left",
        sticky ? "sticky right-0 z-20 bg-gray-50/95 shadow-[-12px_0_24px_-24px_rgba(0,0,0,0.65)]" : ""
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, align = "left", sticky = false }) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-700",
        align === "right" ? "text-right" : "text-left",
        sticky ? "sticky right-0 z-10 bg-white shadow-[-12px_0_24px_-24px_rgba(0,0,0,0.65)]" : ""
      )}
    >
      {children}
    </td>
  )
}

function LoanMobileCard({ loan, onView, onEdit, onPayment, onCancel }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700">
            {initials(employeeName(loan.employee))}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-gray-900">{employeeName(loan.employee)}</p>
            <p className="truncate text-xs font-semibold text-gray-500">{employeeMeta(loan.employee)}</p>
          </div>
        </div>

        <Badge value={loan.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniInfo label="Loan no" value={loan.loanNo || "—"} />
        <MiniInfo label="Installment" value={formatMoney(loan.installmentAmount)} />
        <MiniInfo label="Loan" value={formatMoney(loan.loanAmount)} />
        <MiniInfo label="Remaining" value={formatMoney(loan.remainingAmount)} />
      </div>

      <div className="mt-4">
        <ProgressBar paid={loan.paidAmount} total={loan.loanAmount} />
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className={cn(btn, btnPrimary, "px-3 py-2 shadow-sm shadow-indigo-600/20")} onClick={() => onView?.(loan)}>
          <HugeiconsIcon icon={ViewIcon} size={16} />
          View
        </button>

        {loan.status === "active" ? (
          <>
            <button type="button" className={cn(btn, btnGreen, "px-3 py-2")} onClick={() => onPayment?.(loan)}>
              <HugeiconsIcon icon={CreditCardIcon} size={16} />
              Pay
            </button>
            <button type="button" className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onEdit?.(loan)}>
              <HugeiconsIcon icon={PencilEdit02Icon} size={16} />
              Edit
            </button>
            <button type="button" className={cn(btn, btnRed, "px-3 py-2")} onClick={() => onCancel?.(loan)}>
              <HugeiconsIcon icon={CancelCircleIcon} size={16} />
              Cancel
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function MiniInfo({ label, value }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-gray-900">{value}</p>
    </div>
  )
}
