"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CreditCardIcon,
  Delete02Icon,
  Dollar01Icon,
  Download01Icon,
  File02Icon,
  FilterIcon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  PrinterIcon,
  RefreshIcon,
  RotateLeft01Icon,
  Search01Icon,
  Shield01Icon,
  SquareLock01Icon,
  SquareUnlock01Icon,
  UserGroupIcon,
  UserIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import PayslipModal from "./PayslipModal"
import ApprovalsTab from "./ApprovalsTab"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 20

const shell = "min-h-screen bg-[#f6f7fb]"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const tableCard = "rounded-[10px] border border-gray-200 bg-white shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const btnSoft = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 hover:bg-indigo-100"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const STATUSES = ["", "draft", "calculated", "approved", "paid", "cancelled", "reversed"]
const PAYMENT_METHODS = ["cash", "bank", "mobile_banking", "cheque", "other"]

function authHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Request failed")
  return data
}

async function downloadBlob(path, filename, options = {}) {
  const token = localStorage.getItem("token")
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    credentials: "include",
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.message || "Download failed")
  }
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

function getId(value) {
  return value?._id || value || ""
}

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function monthName(month) {
  return MONTHS[Number(month || 1) - 1] || ""
}

function money(value, currency = "BDT") {
  return `${currency} ${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function dateInput(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
}

function payrollDisplayId(payroll) {
  if (!payroll) return "—"
  const year = payroll.year || new Date(payroll.periodStart || Date.now()).getFullYear()
  const month = String(payroll.month || 1).padStart(2, "0")
  const employeeId = String(getId(payroll.employee) || "")
  const shortId = employeeId ? employeeId.slice(-6).toUpperCase() : String(payroll._id || "").slice(-6).toUpperCase()
  return `PAY-${year}${month}-${shortId || "NEW"}`
}

function Field({ title, children, hint }) {
  return (
    <label className="block">
      <span className={label}>{title}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}
    </label>
  )
}

function StatusBadge({ status }) {
  const style = {
    draft: "bg-gray-100 text-gray-700 ring-gray-600/10",
    calculated: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    approved: "bg-amber-50 text-amber-700 ring-amber-600/10",
    paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-600/10",
    reversed: "bg-purple-50 text-purple-700 ring-purple-600/10",
  }[status || "draft"]

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${style}`}>{pretty(status || "draft")}</span>
}

function Avatar({ employee, className = "h-11 w-11" }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200 ${className}`}>
      {employee?.avatarUrl ? <img src={employee.avatarUrl} alt={employee.name || "Employee"} className="h-full w-full object-cover" /> : <HugeiconsIcon icon={UserIcon} size={20} className="text-gray-500" />}
    </div>
  )
}

function Modal({ open, title, subtitle, icon, children, footer, onClose, maxWidth = "max-w-4xl" }) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <button aria-label="Close" type="button" className="fixed inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
          <div className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_80px_-35px_rgba(0,0,0,0.75)] ${maxWidth}`}>
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">{icon}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-gray-900 sm:text-lg">{title}</h2>
                  {subtitle ? <p className="truncate text-sm font-semibold text-gray-500">{subtitle}</p> : null}
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100" type="button">
                <HugeiconsIcon icon={Cancel01Icon} size={20} className="text-gray-700" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto bg-white p-4 sm:p-5">{children}</div>
            {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmployeeSearch({ value, onSelect, placeholder = "Search employee" }) {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDown = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setItems([])
      setOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: "8", sort: "newest", q })
        const data = await api(`/users/employees?${params.toString()}`)
        setItems(Array.isArray(data.employees) ? data.employees : [])
        setOpen(true)
      } catch (error) {
        toast.error(error.message || "Employee search failed")
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="relative" ref={boxRef}>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-[#f8fafc] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar employee={value} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-gray-900">{value.name || "Unnamed"}</p>
              <p className="truncate text-xs font-bold text-gray-500">{value.position?.title || value.email || "Employee"}</p>
            </div>
          </div>
          <button type="button" className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-800" onClick={() => onSelect?.(null)}>
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
      ) : (
        <div className="flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-[#f8fafc] px-3 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
          <HugeiconsIcon icon={Search01Icon} size={16} className="shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
            type="text"
          />
          {loading ? <HugeiconsIcon icon={RefreshIcon} size={16} className="animate-spin text-gray-400" /> : null}
        </div>
      )}

      {open && query.trim() && !value ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_22px_50px_-25px_rgba(15,23,42,0.55)]">
          {items.length ? (
            <div className="max-h-80 overflow-y-auto p-2">
              {items.map((employee) => (
                <button
                  key={employee._id}
                  type="button"
                  onClick={() => {
                    onSelect?.(employee)
                    setQuery("")
                    setItems([])
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-indigo-50"
                >
                  <Avatar employee={employee} className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-gray-900">{employee.name || "Unnamed"}</p>
                    <p className="truncate text-xs font-semibold text-gray-500">{employee.position?.title || employee.email || "Employee"}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="p-4 text-center text-sm font-bold text-gray-500">No employee found</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

const emptyManualItem = { name: "", calculationType: "fixed", value: 0, quantity: 1, basedOn: "manual", note: "" }
const defaultManualName = (type) => (type === "earning" ? "Bonus" : "Deduction")

export default function PayrollManager() {
  const now = new Date()
  const [tab, setTab] = useState("payrolls")
  const [payrolls, setPayrolls] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [query, setQuery] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ employee: null, department: "", position: "", status: "", year: now.getFullYear(), month: now.getMonth() + 1 })
  const [filterDraft, setFilterDraft] = useState(filters)

  const [payslipFiltersOpen, setPayslipFiltersOpen] = useState(false)
  const [payslipFilters, setPayslipFilters] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    department: "",
    position: "",
    payoutMethod: "",
    status: "",
  })
  const [payslipFilterDraft, setPayslipFilterDraft] = useState(payslipFilters)
  const [payslipQuery, setPayslipQuery] = useState("")
  const [payslipRefreshToken, setPayslipRefreshToken] = useState(0)
  const [payslipMeta, setPayslipMeta] = useState({ count: 0, loading: false })

  const [calcEmployee, setCalcEmployee] = useState(null)
  const [calcYear, setCalcYear] = useState(now.getFullYear())
  const [calcMonth, setCalcMonth] = useState(now.getMonth() + 1)
  const [manualEarnings, setManualEarnings] = useState([])
  const [manualDeductions, setManualDeductions] = useState([])
  const [manualModal, setManualModal] = useState({ open: false, type: "earning", index: null, form: { ...emptyManualItem, name: "Bonus" } })
  const [note, setNote] = useState("")
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [calculateLoading, setCalculateLoading] = useState(false)
  const [force, setForce] = useState(false)

  const [bulk, setBulk] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, department: "", position: "", force: false, note: "" })
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [payModal, setPayModal] = useState({ open: false, payroll: null, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })
  const [cancelModal, setCancelModal] = useState({ open: false, payroll: null, reason: "" })
  const [selectedPayrollIds, setSelectedPayrollIds] = useState([])
  const [bulkActionLoading, setBulkActionLoading] = useState("")
  const [bulkPayModal, setBulkPayModal] = useState({ open: false, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })
  const [bulkCancelModal, setBulkCancelModal] = useState({ open: false, reason: "" })

  const [reverseModal, setReverseModal] = useState({ open: false, payroll: null, reason: "", reversalDate: dateInput(), loading: false })
  const [periodLockModal, setPeriodLockModal] = useState({ open: false, period: null, action: "lock", reason: "", loading: false })
  const [currentPeriod, setCurrentPeriod] = useState(null)
  const [periodLoading, setPeriodLoading] = useState(false)

  const [periodsList, setPeriodsList] = useState([])
  const [periodsYear, setPeriodsYear] = useState(now.getFullYear())
  const [periodsLoading, setPeriodsLoading] = useState(false)

  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [auditActionFilter, setAuditActionFilter] = useState("")
  const [payslipModalId, setPayslipModalId] = useState(null)

  const handleDownloadPayslipPdf = async (payroll) => {
    try {
      const empName = payroll?.employee?.name ? payroll.employee.name.replace(/\s+/g, "_") : "Employee"
      const filename = `Payslip-${empName}-${payroll?.year || now.getFullYear()}-${String(payroll?.month || 1).padStart(2, "0")}.pdf`
      await downloadBlob(`/payroll/${payroll._id}/payslip/pdf?download=1`, filename)
      toast.success("Payslip PDF downloaded")
    } catch (err) {
      toast.error(err.message || "Failed to download payslip PDF")
    }
  }

  const submitForApproval = async (payroll) => {
    try {
      await api(`/payroll/${payroll._id}/submit-approval`, {
        method: "POST",
        body: JSON.stringify({ comments: "Submitted for approval review" }),
      })
      toast.success("Payroll submitted for approval review")
      loadPayrolls(page)
    } catch (err) {
      toast.error(err.message || "Failed to submit for approval")
    }
  }

  const draftPositionOptions = useMemo(() => {
    if (!filterDraft.department) return positions
    return positions.filter((item) => String(getId(item.department)) === String(filterDraft.department))
  }, [filterDraft.department, positions])

  const bulkPositionOptions = useMemo(() => {
    if (!bulk.department) return positions
    return positions.filter((item) => String(getId(item.department)) === String(bulk.department))
  }, [bulk.department, positions])

  const payslipDraftPositionOptions = useMemo(() => {
    if (!payslipFilterDraft.department) return positions
    return positions.filter((item) => String(getId(item.department)) === String(payslipFilterDraft.department))
  }, [payslipFilterDraft.department, positions])

  const payslipActiveFilters = useMemo(() => {
    const list = [
      { key: "year", label: "Year", value: String(payslipFilters.year || now.getFullYear()) },
      { key: "month", label: "Month", value: monthName(payslipFilters.month || now.getMonth() + 1) },
    ]

    if (payslipFilters.department) {
      list.push({
        key: "department",
        label: "Department",
        value: departments.find((item) => String(item._id) === String(payslipFilters.department))?.name || "Selected",
      })
    }

    if (payslipFilters.position) {
      list.push({
        key: "position",
        label: "Position",
        value: positions.find((item) => String(item._id) === String(payslipFilters.position))?.title || "Selected",
      })
    }

    if (payslipFilters.payoutMethod) {
      list.push({
        key: "payoutMethod",
        label: "Payout",
        value: pretty(payslipFilters.payoutMethod),
      })
    }

    if (payslipFilters.status) {
      list.push({
        key: "status",
        label: "Status",
        value: pretty(payslipFilters.status),
      })
    }

    return list
  }, [departments, now, payslipFilters, positions])

  const payslipExtraFilterCount = useMemo(
    () =>
      [
        payslipFilters.department,
        payslipFilters.position,
        payslipFilters.payoutMethod,
        payslipFilters.status,
      ].filter(Boolean).length,
    [payslipFilters]
  )

  const hasClearablePayslipFilters = useMemo(
    () =>
      Boolean(
        payslipQuery.trim() ||
          payslipExtraFilterCount ||
          Number(payslipFilters.year) !== now.getFullYear() ||
          Number(payslipFilters.month) !== now.getMonth() + 1
      ),
    [now, payslipExtraFilterCount, payslipFilters.month, payslipFilters.year, payslipQuery]
  )

  const clearPayslipFilter = (key) => {
    setPayslipFilters((prev) => {
      const next = { ...prev }

      if (key === "year") next.year = now.getFullYear()
      else if (key === "month") next.month = now.getMonth() + 1
      else if (key === "department") {
        next.department = ""
        next.position = ""
      } else next[key] = ""

      return next
    })
  }

  const resetPayslipSearchAndFilters = () => {
    const next = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      department: "",
      position: "",
      payoutMethod: "",
      status: "",
    }

    setPayslipQuery("")
    setPayslipFilters(next)
    setPayslipFilterDraft(next)
  }

  const filteredPayrolls = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return payrolls
    return payrolls.filter((payroll) =>
      [payroll.employee?.name, payroll.employee?.email, payroll.employee?.position?.title, payroll.employee?.department?.name, payroll.status, payrollDisplayId(payroll), payroll.payrollKey]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
  }, [payrolls, query])

  const activeFilters = useMemo(() => {
    const list = []
    if (filters.employee) list.push({ key: "employee", label: "Employee", value: filters.employee.name || "Selected" })
    if (filters.department) list.push({ key: "department", label: "Department", value: departments.find((x) => String(x._id) === String(filters.department))?.name || "Selected" })
    if (filters.position) list.push({ key: "position", label: "Position", value: positions.find((x) => String(x._id) === String(filters.position))?.title || "Selected" })
    if (filters.status) list.push({ key: "status", label: "Status", value: pretty(filters.status) })
    if (filters.year) list.push({ key: "year", label: "Year", value: String(filters.year) })
    if (filters.month) list.push({ key: "month", label: "Month", value: monthName(filters.month) })
    return list
  }, [departments, filters, positions])

  const hasClearableSearchOrFilters = useMemo(() => {
    const defaultYear = now.getFullYear()
    const defaultMonth = now.getMonth() + 1

    return Boolean(
      query.trim() ||
        filters.employee ||
        filters.department ||
        filters.position ||
        filters.status ||
        (filters.year && Number(filters.year) !== defaultYear) ||
        (filters.month && Number(filters.month) !== defaultMonth)
    )
  }, [filters, now, query])

  const clearSearchAndExtraFilters = () => {
    const next = {
      employee: null,
      department: "",
      position: "",
      status: "",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    }

    setQuery("")
    setFilters(next)
    setFilterDraft(next)
  }

  const summary = useMemo(() => {
    const totalNet = payrolls.reduce((sum, item) => sum + Number(item.netPayable || 0), 0)
    const totalPaid = payrolls.filter((x) => x.status === "paid").reduce((sum, item) => sum + Number(item.netPayable || 0), 0)
    const pending = payrolls.filter((x) => ["draft", "calculated", "approved"].includes(x.status)).length
    return { records: payrolls.length, totalNet, totalPaid, pending }
  }, [payrolls])

  const selectedPayrolls = useMemo(
    () => payrolls.filter((payroll) => selectedPayrollIds.includes(payroll._id)),
    [payrolls, selectedPayrollIds]
  )

  const loadAccessLists = useCallback(async () => {
    try {
      const [depRes, posRes, bankRes] = await Promise.all([api("/access-control/departments"), api("/access-control/positions"), api("/banks/accounts?limit=150&status=active")])
      setDepartments(depRes.departments || [])
      setPositions(posRes.positions || [])
      setBankAccounts((bankRes.accounts || []).filter((item) => item.ledgerAccount))
    } catch (error) {
      toast.error(error.message || "Failed to load filter data")
    }
  }, [])

  const loadPayrolls = useCallback(
    async (targetPage = page) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("limit", String(PAGE_SIZE))
        params.set("page", String(targetPage))
        if (filters.employee?._id) params.set("employee", filters.employee._id)
        if (filters.department) params.set("department", filters.department)
        if (filters.position) params.set("position", filters.position)
        if (filters.status) params.set("status", filters.status)
        if (filters.year) params.set("year", String(filters.year))
        if (filters.month) params.set("month", String(filters.month))

        const data = await api(`/payroll?${params.toString()}`)
        setPayrolls(data.payrolls || [])
        setPage(Number(data.page || targetPage))
        setTotalPages(Math.max(Number(data.totalPages || 1), 1))
      } catch (error) {
        toast.error(error.message || "Failed to load payrolls")
      } finally {
        setLoading(false)
      }
    },
    [filters, page]
  )

  useEffect(() => {
    loadAccessLists()
  }, [loadAccessLists])

  useEffect(() => {
    loadPayrolls(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  useEffect(() => {
    setSelectedPayrollIds((prev) => prev.filter((id) => payrolls.some((payroll) => payroll._id === id)))
  }, [payrolls])

  const clearSingleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: key === "employee" ? null : "", ...(key === "department" ? { position: "" } : {}) }))
  }

  const resetFilters = () => {
    const next = { employee: null, department: "", position: "", status: "", year: now.getFullYear(), month: now.getMonth() + 1 }
    setQuery("")
    setFilters(next)
    setFilterDraft(next)
  }

  const updateFilterDraft = (key, value) => setFilterDraft((prev) => ({ ...prev, [key]: value, ...(key === "department" ? { position: "" } : {}) }))

  const openManualModal = (type, index = null) => {
    const items = type === "earning" ? manualEarnings : manualDeductions
    setManualModal({
      open: true,
      type,
      index,
      form: index === null ? { ...emptyManualItem, name: defaultManualName(type) } : { ...emptyManualItem, ...(items[index] || {}) },
    })
  }

  const closeManualModal = () => {
    setManualModal({ open: false, type: "earning", index: null, form: { ...emptyManualItem, name: "Bonus" } })
  }

  const updateManualModalForm = (key, value) => {
    setManualModal((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))
  }

  const saveManualItem = (event) => {
    event.preventDefault()
    const type = manualModal.type
    const item = {
      ...manualModal.form,
      name: manualModal.form.name?.trim() || defaultManualName(type),
      value: Number(manualModal.form.value || 0),
      quantity: Number(manualModal.form.quantity || 1),
    }
    const setter = type === "earning" ? setManualEarnings : setManualDeductions
    setter((prev) => {
      if (manualModal.index === null) return [...prev, item]
      return prev.map((existing, index) => (index === manualModal.index ? item : existing))
    })
    closeManualModal()
  }

  const removeManualItem = (type, index) => {
    const setter = type === "earning" ? setManualEarnings : setManualDeductions
    setter((prev) => prev.filter((_, i) => i !== index))
  }

  const makePreview = async () => {
    if (!calcEmployee?._id) return toast.error("Select an employee")
    setPreviewLoading(true)
    try {
      const data = await api("/payroll/preview", {
        method: "POST",
        body: JSON.stringify({ employee: calcEmployee._id, year: Number(calcYear), month: Number(calcMonth), manualEarnings, manualDeductions, note }),
      })
      setPreview(data.payroll || null)
      toast.success("Payroll preview generated")
    } catch (error) {
      toast.error(error.message || "Preview failed")
    } finally {
      setPreviewLoading(false)
    }
  }

  const savePayroll = async () => {
    if (!calcEmployee?._id) return toast.error("Select an employee")
    setCalculateLoading(true)
    try {
      const data = await api("/payroll/calculate", {
        method: "POST",
        body: JSON.stringify({ employee: calcEmployee._id, year: Number(calcYear), month: Number(calcMonth), manualEarnings, manualDeductions, note, force }),
      })
      toast.success("Payroll calculated")
      setSelectedPayroll(data.payroll || null)
      setDetailsOpen(Boolean(data.payroll))
      loadPayrolls(1)
    } catch (error) {
      toast.error(error.message || "Calculate failed")
    } finally {
      setCalculateLoading(false)
    }
  }

  const runBulk = async () => {
    setBulkLoading(true)
    try {
      const data = await api("/payroll/bulk-calculate", {
        method: "POST",
        body: JSON.stringify({
          year: Number(bulk.year),
          month: Number(bulk.month),
          force: bulk.force,
          note: bulk.note,
          ...(bulk.department ? { department: bulk.department } : {}),
          ...(bulk.position ? { position: bulk.position } : {}),
        }),
      })
      setBulkResult(data)
      toast.success("Bulk payroll completed")
      loadPayrolls(1)
    } catch (error) {
      toast.error(error.message || "Bulk payroll failed")
    } finally {
      setBulkLoading(false)
    }
  }

  const readPayroll = async (payroll) => {
    if (!payroll?._id) return
    setDetailsOpen(true)
    setDetailsLoading(true)
    try {
      const data = await api(`/payroll/${payroll._id}`)
      setSelectedPayroll(data.payroll || null)
    } catch (error) {
      toast.error(error.message || "Failed to load payroll")
    } finally {
      setDetailsLoading(false)
    }
  }

  const approvePayroll = async (payroll) => {
    try {
      const data = await api(`/payroll/${payroll._id}/approve`, { method: "PATCH", body: JSON.stringify({}) })
      toast.success("Payroll approved")
      setSelectedPayroll(data.payroll || null)
      loadPayrolls(page)
    } catch (error) {
      toast.error(error.message || "Approve failed")
    }
  }

  const payPayroll = async (event) => {
    event.preventDefault()
    try {
      const data = await api(`/payroll/${payModal.payroll._id}/pay`, {
        method: "PATCH",
        body: JSON.stringify({ paymentMethod: payModal.paymentMethod, bankAccount: payModal.bankAccount, paymentDate: payModal.paymentDate, transactionRef: payModal.transactionRef }),
      })
      toast.success("Payroll marked as paid")
      setSelectedPayroll(data.payroll || null)
      setPayModal({ open: false, payroll: null, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })
      loadPayrolls(page)
    } catch (error) {
      toast.error(error.message || "Payment update failed")
    }
  }

  const cancelPayroll = async (event) => {
    event.preventDefault()
    try {
      const data = await api(`/payroll/${cancelModal.payroll._id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason: cancelModal.reason }),
      })
      toast.success("Payroll cancelled")
      setSelectedPayroll(data.payroll || null)
      setCancelModal({ open: false, payroll: null, reason: "" })
      loadPayrolls(page)
    } catch (error) {
      toast.error(error.message || "Cancel failed")
    }
  }

  const deletePayroll = async (payroll) => {
    if (!window.confirm("Delete this payroll?")) return
    try {
      await api(`/payroll/${payroll._id}`, { method: "DELETE" })
      toast.success("Payroll deleted")
      setDetailsOpen(false)
      setSelectedPayroll(null)
      loadPayrolls(page)
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  const togglePayrollSelection = (payrollId) => {
    setSelectedPayrollIds((prev) =>
      prev.includes(payrollId) ? prev.filter((id) => id !== payrollId) : [...prev, payrollId]
    )
  }

  const selectAllVisible = (checked, rows = filteredPayrolls) => {
    if (!checked) {
      setSelectedPayrollIds([])
      return
    }
    setSelectedPayrollIds(rows.map((payroll) => payroll._id))
  }

  const clearSelection = () => setSelectedPayrollIds([])

  const bulkApproveSelected = async () => {
    const targets = selectedPayrolls.filter((payroll) => !["paid", "cancelled"].includes(payroll.status))
    if (!targets.length) return toast.error("No eligible payroll selected")

    setBulkActionLoading("approve")
    let success = 0
    let failed = 0

    for (const payroll of targets) {
      try {
        await api(`/payroll/${payroll._id}/approve`, { method: "PATCH", body: JSON.stringify({}) })
        success += 1
      } catch {
        failed += 1
      }
    }

    toast.success(`Approved ${success}${failed ? `, failed ${failed}` : ""}`)
    clearSelection()
    setBulkActionLoading("")
    loadPayrolls(page)
  }

  const bulkPaySelected = async (event) => {
    event.preventDefault()
    const targets = selectedPayrolls.filter((payroll) => !["paid", "cancelled"].includes(payroll.status))
    if (!targets.length) return toast.error("No eligible payroll selected")

    setBulkActionLoading("pay")
    let success = 0
    let failed = 0

    for (const payroll of targets) {
      try {
        await api(`/payroll/${payroll._id}/pay`, {
          method: "PATCH",
          body: JSON.stringify({
            paymentMethod: bulkPayModal.paymentMethod,
            bankAccount: bulkPayModal.bankAccount,
            paymentDate: bulkPayModal.paymentDate,
            transactionRef: bulkPayModal.transactionRef,
          }),
        })
        success += 1
      } catch {
        failed += 1
      }
    }

    toast.success(`Marked paid ${success}${failed ? `, failed ${failed}` : ""}`)
    setBulkPayModal({ open: false, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })
    clearSelection()
    setBulkActionLoading("")
    loadPayrolls(page)
  }

  const bulkCancelSelected = async (event) => {
    event.preventDefault()
    const targets = selectedPayrolls.filter((payroll) => !["paid", "cancelled"].includes(payroll.status))
    if (!targets.length) return toast.error("No eligible payroll selected")

    setBulkActionLoading("cancel")
    let success = 0
    let failed = 0

    for (const payroll of targets) {
      try {
        await api(`/payroll/${payroll._id}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({ reason: bulkCancelModal.reason }),
        })
        success += 1
      } catch {
        failed += 1
      }
    }

    toast.success(`Cancelled ${success}${failed ? `, failed ${failed}` : ""}`)
    setBulkCancelModal({ open: false, reason: "" })
    clearSelection()
    setBulkActionLoading("")
    loadPayrolls(page)
  }

  const fetchCurrentPeriod = useCallback(async (year, month) => {
    if (!year || !month) return
    setPeriodLoading(true)
    try {
      const data = await api(`/payroll/periods/${year}/${month}`)
      setCurrentPeriod(data || null)
    } catch {
      setCurrentPeriod(null)
    } finally {
      setPeriodLoading(false)
    }
  }, [])

  const fetchPeriods = useCallback(async (year) => {
    setPeriodsLoading(true)
    try {
      const data = await api(`/payroll/periods?year=${year}`)
      setPeriodsList(data.periods || [])
    } catch (err) {
      toast.error(err.message || "Failed to load periods")
    } finally {
      setPeriodsLoading(false)
    }
  }, [])

  const fetchAuditLogs = useCallback(async (targetPage = 1, action = auditActionFilter) => {
    setAuditLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(targetPage))
      params.set("limit", "20")
      if (action) params.set("action", action)
      const data = await api(`/payroll/audit-logs?${params.toString()}`)
      setAuditLogs(data.logs || [])
      setAuditPage(data.page || 1)
      setAuditTotalPages(data.totalPages || 1)
    } catch (err) {
      toast.error(err.message || "Failed to load audit logs")
    } finally {
      setAuditLoading(false)
    }
  }, [auditActionFilter])

  const handleReversePayroll = async (e) => {
    e?.preventDefault()
    if (!reverseModal.payroll?._id) return
    if (!reverseModal.reason?.trim()) {
      toast.error("Reversal justification reason is required.")
      return
    }
    setReverseModal((p) => ({ ...p, loading: true }))
    try {
      const data = await api(`/payroll/${reverseModal.payroll._id}/reverse`, {
        method: "PATCH",
        body: JSON.stringify({
          reason: reverseModal.reason.trim(),
          reversalDate: reverseModal.reversalDate,
        }),
      })
      toast.success(data.message || "Payroll payout reversed successfully.")
      setReverseModal({ open: false, payroll: null, reason: "", reversalDate: dateInput(), loading: false })
      loadPayrolls(page)
      fetchCurrentPeriod(filters.year, filters.month)
      if (selectedPayroll?._id === reverseModal.payroll._id) {
        setSelectedPayroll(data.payroll)
      }
    } catch (err) {
      toast.error(err.message || "Reversal failed")
      setReverseModal((p) => ({ ...p, loading: false }))
    }
  }

  const handlePeriodLockToggle = async (e) => {
    e?.preventDefault()
    const targetPeriod = periodLockModal.period || currentPeriod
    const y = targetPeriod?.year || filters.year
    const m = targetPeriod?.month || filters.month
    if (periodLockModal.action === "unlock" && !periodLockModal.reason?.trim()) {
      toast.error("A justification reason is required to unlock a period.")
      return
    }
    setPeriodLockModal((p) => ({ ...p, loading: true }))
    try {
      const endpoint = periodLockModal.action === "lock" ? `/payroll/periods/${y}/${m}/lock` : `/payroll/periods/${y}/${m}/unlock`
      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({
          reason: periodLockModal.reason?.trim() || "",
        }),
      })
      toast.success(data.message || `Period ${periodLockModal.action === "lock" ? "locked" : "unlocked"} successfully.`)
      setPeriodLockModal({ open: false, period: null, action: "lock", reason: "", loading: false })
      fetchCurrentPeriod(filters.year, filters.month)
      if (tab === "periods") fetchPeriods(periodsYear)
      loadPayrolls(page)
    } catch (err) {
      toast.error(err.message || "Period operation failed")
      setPeriodLockModal((p) => ({ ...p, loading: false }))
    }
  }

  useEffect(() => {
    if (filters.year && filters.month) {
      fetchCurrentPeriod(filters.year, filters.month)
    }
  }, [filters.year, filters.month, fetchCurrentPeriod])

  useEffect(() => {
    if (tab === "periods") {
      fetchPeriods(periodsYear)
    } else if (tab === "audit") {
      fetchAuditLogs(1, auditActionFilter)
    }
  }, [tab, periodsYear, auditActionFilter, fetchPeriods, fetchAuditLogs])

  const renderManualItems = (type) => {
    const items = type === "earning" ? manualEarnings : manualDeductions
    const isEarning = type === "earning"
    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${type}-${index}`} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-gray-900">{item.name || defaultManualName(type)}</p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                {pretty(item.calculationType || "fixed")} · Value {item.value || 0} · Qty {item.quantity || 1}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className={`${btn} ${btnGhost} h-9 px-3 py-2`} type="button" onClick={() => openManualModal(type, index)}>
                <HugeiconsIcon icon={PencilEdit02Icon} size={16} /> Edit
              </button>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-100 bg-white text-rose-600 transition hover:bg-rose-50" type="button" onClick={() => removeManualItem(type, index)} title={`Remove ${isEarning ? "earning" : "deduction"}`}>
                <HugeiconsIcon icon={Delete02Icon} size={16} />
              </button>
            </div>
          </div>
        ))}
        <button type="button" className={`${btn} ${btnSoft} w-full sm:w-auto`} onClick={() => openManualModal(type)}>
          <HugeiconsIcon icon={Add01Icon} size={16} /> Add {type === "earning" ? "Earning" : "Deduction"}
        </button>
      </div>
    )
  }

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <HugeiconsIcon icon={Dollar01Icon} size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Payroll Manager</h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                Manage payroll records, salary calculations, bulk runs and payment actions.
              </p>
            </div>
          </div>

          {tab === "payrolls" ? (
            <ChipSearchToolbar
              chips={activeFilters}
              query={query}
              onQueryChange={setQuery}
              placeholder={activeFilters.length ? "Search payroll..." : "Search payroll records..."}
              onRemoveChip={clearSingleFilter}
              onOpenFilters={() => {
                setFilterDraft(filters)
                setFiltersOpen(true)
              }}
              filterCount={activeFilters.length}
              showClear={hasClearableSearchOrFilters}
              onClear={clearSearchAndExtraFilters}
              resultText={`Showing ${filteredPayrolls.length} payroll record${filteredPayrolls.length === 1 ? "" : "s"}`}
              onRefresh={() => loadPayrolls(page)}
              refreshing={loading}
            />
          ) : null}

          {tab === "payslips" ? (
            <ChipSearchToolbar
              chips={payslipActiveFilters}
              query={payslipQuery}
              onQueryChange={setPayslipQuery}
              placeholder="Search employee, ID, email, designation..."
              onRemoveChip={clearPayslipFilter}
              onOpenFilters={() => {
                setPayslipFilterDraft(payslipFilters)
                setPayslipFiltersOpen(true)
              }}
              filterCount={payslipExtraFilterCount}
              showClear={hasClearablePayslipFilters}
              onClear={resetPayslipSearchAndFilters}
              resultText={`Showing ${payslipMeta.count} payslip${payslipMeta.count === 1 ? "" : "s"}`}
              onRefresh={() => setPayslipRefreshToken((value) => value + 1)}
              refreshing={payslipMeta.loading}
            />
          ) : null}
        </div>

        <PayrollTabBar tab={tab} onChange={setTab} />

        {tab === "payrolls" && (
          <>
            <PeriodLockBanner
              period={currentPeriod}
              loading={periodLoading}
              year={filters.year}
              month={filters.month}
              onToggleLock={() => {
                const isLocked = currentPeriod?.status === "locked"
                setPeriodLockModal({
                  open: true,
                  period: currentPeriod,
                  action: isLocked ? "unlock" : "lock",
                  reason: "",
                  loading: false,
                })
              }}
            />
            <PayrollTable
              payrolls={filteredPayrolls}
              loading={loading}
              page={page}
              totalPages={totalPages}
              loadPayrolls={loadPayrolls}
              readPayroll={readPayroll}
              approvePayroll={approvePayroll}
              setPayModal={setPayModal}
              setReverseModal={setReverseModal}
              selectedIds={selectedPayrollIds}
              selectedPayrolls={selectedPayrolls}
              toggleSelection={togglePayrollSelection}
              selectAllVisible={selectAllVisible}
              clearSelection={clearSelection}
              bulkApproveSelected={bulkApproveSelected}
              setBulkPayModal={setBulkPayModal}
              setBulkCancelModal={setBulkCancelModal}
              bulkActionLoading={bulkActionLoading}
              onOpenPayslip={(p) => setPayslipModalId(p._id)}
              onDownloadPdf={handleDownloadPayslipPdf}
              submitForApproval={submitForApproval}
            />
          </>
        )}

        {tab === "approvals" && (
          <ApprovalsTab
            departments={departments}
            onOpenPayslip={(p) => setPayslipModalId(p._id)}
            onDownloadPdf={handleDownloadPayslipPdf}
          />
        )}

        {tab === "calculate" && (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.7fr)]">
            <div className={`${card} overflow-visible p-4 sm:p-5`}>
              <SectionHeader icon={<HugeiconsIcon icon={Dollar01Icon} size={20} />} title="Calculate Payroll" subtitle="Select employee and month, then preview before saving." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-3"><Field title="Employee"><EmployeeSearch value={calcEmployee} onSelect={setCalcEmployee} placeholder="Search employee by name, email, or ID" /></Field></div>
                <Field title="Year"><input className={input} type="number" value={calcYear} onChange={(e) => setCalcYear(e.target.value)} /></Field>
                <Field title="Month"><MonthSelect value={calcMonth} onChange={setCalcMonth} /></Field>
                <label className="flex items-end"><span className="flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3"><span className="text-sm font-extrabold text-gray-800">Force Recalculate</span><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /></span></label>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-extrabold text-gray-900">Manual Earnings</h3>
                  </div>
                  {renderManualItems("earning")}
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-extrabold text-gray-900">Manual Deductions</h3>
                  </div>
                  {renderManualItems("deduction")}
                </div>
              </div>
              <div className="mt-5"><Field title="Payroll Note"><textarea className="min-h-[95px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" /></Field></div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button className={`${btn} ${btnGhost}`} type="button" onClick={makePreview} disabled={previewLoading}><HugeiconsIcon icon={ViewIcon} size={16} /> {previewLoading ? "Previewing..." : "Preview Payroll"}</button>
                <button className={`${btn} ${btnPrimary}`} type="button" onClick={savePayroll} disabled={calculateLoading}><HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} /> {calculateLoading ? "Calculating..." : "Calculate & Save"}</button>
              </div>
            </div>
            <PayrollPreviewCard payroll={preview} />
          </section>
        )}

        {tab === "payslips" && (
          <PayslipsTab
            filters={payslipFilters}
            search={payslipQuery}
            refreshToken={payslipRefreshToken}
            onMetaChange={setPayslipMeta}
            onOpenPayslip={(p) => setPayslipModalId(p._id)}
            onDownloadPdf={handleDownloadPayslipPdf}
          />
        )}

        {tab === "bulk" && (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
            <div className={`${card} p-4 sm:p-5`}>
              <SectionHeader icon={<HugeiconsIcon icon={UserGroupIcon} size={20} />} title="Bulk Payroll Run" subtitle="Calculate payroll for all active employees or filter by department/position." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field title="Year"><input className={input} type="number" value={bulk.year} onChange={(e) => setBulk((p) => ({ ...p, year: e.target.value }))} /></Field>
                <Field title="Month"><MonthSelect value={bulk.month} onChange={(value) => setBulk((p) => ({ ...p, month: value }))} /></Field>
                <Field title="Department"><DepartmentSelect value={bulk.department} departments={departments} onChange={(value) => setBulk((p) => ({ ...p, department: value, position: "" }))} /></Field>
                <Field title="Position"><PositionSelect value={bulk.position} positions={bulkPositionOptions} onChange={(value) => setBulk((p) => ({ ...p, position: value }))} /></Field>
              </div>
              <div className="mt-4"><Field title="Bulk Note"><textarea className="min-h-[92px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" value={bulk.note} onChange={(e) => setBulk((p) => ({ ...p, note: e.target.value }))} /></Field></div>
              <label className="mt-4 flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"><span className="text-sm font-extrabold text-gray-900">Force Recalculate</span><input type="checkbox" checked={bulk.force} onChange={(e) => setBulk((p) => ({ ...p, force: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /></label>
              <div className="mt-5 flex justify-end"><button className={`${btn} ${btnPrimary}`} type="button" onClick={runBulk} disabled={bulkLoading}><HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} /> {bulkLoading ? "Running..." : "Run Bulk Payroll"}</button></div>
            </div>
            <BulkResult result={bulkResult} />
          </section>
        )}

        {tab === "periods" && (
          <PeriodsTab
            periods={periodsList}
            year={periodsYear}
            setYear={setPeriodsYear}
            loading={periodsLoading}
            onToggleLock={(period) => {
              const isLocked = period?.status === "locked"
              setPeriodLockModal({
                open: true,
                period,
                action: isLocked ? "unlock" : "lock",
                reason: "",
                loading: false,
              })
            }}
          />
        )}

        {tab === "audit" && (
          <AuditTab
            logs={auditLogs}
            loading={auditLoading}
            page={auditPage}
            totalPages={auditTotalPages}
            actionFilter={auditActionFilter}
            setActionFilter={setAuditActionFilter}
            onPageChange={(p) => fetchAuditLogs(p, auditActionFilter)}
          />
        )}
      </div>

      <FilterModal open={filtersOpen} onClose={() => setFiltersOpen(false)} filterDraft={filterDraft} setFilterDraft={setFilterDraft} apply={() => { setFilters(filterDraft); setFiltersOpen(false) }} clear={() => { const next = { employee: null, department: "", position: "", status: "", year: now.getFullYear(), month: now.getMonth() + 1 }; setFilterDraft(next); setFilters(next); setFiltersOpen(false) }} departments={departments} positions={draftPositionOptions} update={updateFilterDraft} />

      <PayslipFilterModal
        open={payslipFiltersOpen}
        onClose={() => setPayslipFiltersOpen(false)}
        draft={payslipFilterDraft}
        setDraft={setPayslipFilterDraft}
        departments={departments}
        positions={payslipDraftPositionOptions}
        apply={() => {
          setPayslipFilters(payslipFilterDraft)
          setPayslipFiltersOpen(false)
        }}
        clear={() => {
          const next = {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            department: "",
            position: "",
            payoutMethod: "",
            status: "",
          }
          setPayslipFilterDraft(next)
          setPayslipFilters(next)
          setPayslipFiltersOpen(false)
        }}
      />

      <Modal open={detailsOpen} title="Payroll Details" subtitle={selectedPayroll ? `${selectedPayroll.employee?.name || "Employee"} • ${monthName(selectedPayroll.month)} ${selectedPayroll.year}` : "Payroll"} icon={<HugeiconsIcon icon={File02Icon} size={20} />} onClose={() => setDetailsOpen(false)} maxWidth="max-w-6xl" footer={selectedPayroll ? <DetailFooter payroll={selectedPayroll} approvePayroll={approvePayroll} setPayModal={setPayModal} setCancelModal={setCancelModal} deletePayroll={deletePayroll} setReverseModal={setReverseModal} onOpenPayslip={(p) => setPayslipModalId(p._id)} onDownloadPdf={handleDownloadPayslipPdf} /> : null}>
        {detailsLoading ? <div className="py-16 text-center text-sm font-bold text-gray-500">Loading payroll...</div> : selectedPayroll ? <PayslipView payroll={selectedPayroll} /> : <div className="py-16 text-center text-sm font-bold text-gray-500">No payroll selected</div>}
      </Modal>

      <Modal
        open={manualModal.open}
        title={`${manualModal.index === null ? "Add" : "Edit"} ${manualModal.type === "earning" ? "Manual Earning" : "Manual Deduction"}`}
        icon={<HugeiconsIcon icon={Add01Icon} size={20} />}
        onClose={closeManualModal}
        maxWidth="max-w-2xl"
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} type="button" onClick={closeManualModal}>
              Cancel
            </button>
            <button className={`${btn} ${btnPrimary}`} form="manual-adjustment-form" type="submit">
              {manualModal.index === null ? "Add" : "Update"}
            </button>
          </div>
        }
      >
        <form id="manual-adjustment-form" onSubmit={saveManualItem} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field title="Name">
            <input
              className={input}
              value={manualModal.form.name}
              onChange={(e) => updateManualModalForm("name", e.target.value)}
              placeholder={manualModal.type === "earning" ? "Bonus" : "Deduction"}
              autoFocus
            />
          </Field>
          <Field title="Calculation Type">
            <select
              className={input}
              value={manualModal.form.calculationType}
              onChange={(e) => updateManualModalForm("calculationType", e.target.value)}
            >
              <option value="fixed">Fixed Amount</option>
              <option value="percentage">Percentage</option>
              <option value="per_day">Per Day</option>
              <option value="per_hour">Per Hour</option>
              <option value="per_minute">Per Minute</option>
              <option value="variable">Manual Amount</option>
            </select>
          </Field>
          <Field title="Value">
            <input
              className={input}
              type="number"
              min="0"
              value={manualModal.form.value}
              onChange={(e) => updateManualModalForm("value", e.target.value)}
            />
          </Field>
          <Field title="Quantity">
            <input
              className={input}
              type="number"
              min="0"
              value={manualModal.form.quantity}
              onChange={(e) => updateManualModalForm("quantity", e.target.value)}
            />
          </Field>
        </form>
      </Modal>

      <Modal open={payModal.open} title="Mark Payroll Paid" subtitle={payModal.payroll?.employee?.name || "Payment details"} icon={<HugeiconsIcon icon={CreditCardIcon} size={20} />} onClose={() => setPayModal({ open: false, payroll: null, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" onClick={() => setPayModal({ open: false, payroll: null, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })}>Cancel</button><button className={`${btn} ${btnPrimary}`} form="payroll-pay-form" type="submit">Post Payment</button></div>}>
        <form id="payroll-pay-form" className="space-y-4" onSubmit={payPayroll}>
          <Field title="Payment Method"><select className={input} value={payModal.paymentMethod} onChange={(e) => setPayModal((p) => ({ ...p, paymentMethod: e.target.value }))}>{PAYMENT_METHODS.map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field>
          {["bank", "mobile_banking", "cheque"].includes(payModal.paymentMethod) ? <Field title="Pay From Bank Account"><select className={input} value={payModal.bankAccount || ""} onChange={(e) => setPayModal((p) => ({ ...p, bankAccount: e.target.value }))} required><option value="">Select connected account</option>{bankAccounts.map((item) => <option key={item._id} value={item._id}>{item.bank?.shortName || item.bank?.bankName} — {item.accountName} ({item.accountNumber})</option>)}</select></Field> : null}
          <Field title="Payment Date"><input className={input} type="date" value={payModal.paymentDate} onChange={(e) => setPayModal((p) => ({ ...p, paymentDate: e.target.value }))} /></Field>
          <Field title="Transaction Reference"><input className={input} value={payModal.transactionRef} onChange={(e) => setPayModal((p) => ({ ...p, transactionRef: e.target.value }))} placeholder="Bank / bKash / cheque reference" /></Field>
        </form>
      </Modal>

      <Modal open={bulkPayModal.open} title="Post Selected Payroll Payments" subtitle={`${selectedPayrolls.length} selected payroll record(s)`} icon={<HugeiconsIcon icon={CreditCardIcon} size={20} />} onClose={() => !bulkActionLoading && setBulkPayModal({ open: false, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" disabled={Boolean(bulkActionLoading)} onClick={() => setBulkPayModal({ open: false, paymentMethod: "cash", bankAccount: "", paymentDate: dateInput(), transactionRef: "" })}>Cancel</button><button className={`${btn} ${btnPrimary}`} form="payroll-bulk-pay-form" disabled={bulkActionLoading === "pay"} type="submit">{bulkActionLoading === "pay" ? "Posting..." : "Post Payments"}</button></div>}>
        <form id="payroll-bulk-pay-form" className="space-y-4" onSubmit={bulkPaySelected}>
          <Field title="Payment Method"><select className={input} value={bulkPayModal.paymentMethod} onChange={(e) => setBulkPayModal((p) => ({ ...p, paymentMethod: e.target.value }))}>{PAYMENT_METHODS.map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field>
          {["bank", "mobile_banking", "cheque"].includes(bulkPayModal.paymentMethod) ? <Field title="Pay From Bank Account"><select className={input} value={bulkPayModal.bankAccount || ""} onChange={(e) => setBulkPayModal((p) => ({ ...p, bankAccount: e.target.value }))} required><option value="">Select connected account</option>{bankAccounts.map((item) => <option key={item._id} value={item._id}>{item.bank?.shortName || item.bank?.bankName} — {item.accountName} ({item.accountNumber})</option>)}</select></Field> : null}
          <Field title="Payment Date"><input className={input} type="date" value={bulkPayModal.paymentDate} onChange={(e) => setBulkPayModal((p) => ({ ...p, paymentDate: e.target.value }))} /></Field>
          <Field title="Transaction Reference"><input className={input} value={bulkPayModal.transactionRef} onChange={(e) => setBulkPayModal((p) => ({ ...p, transactionRef: e.target.value }))} placeholder="Optional shared payment note/reference" /></Field>
        </form>
      </Modal>

      <Modal open={bulkCancelModal.open} title="Cancel Selected Payrolls" subtitle={`${selectedPayrolls.length} selected payroll record(s)`} icon={<HugeiconsIcon icon={Cancel01Icon} size={20} />} onClose={() => !bulkActionLoading && setBulkCancelModal({ open: false, reason: "" })} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" disabled={Boolean(bulkActionLoading)} onClick={() => setBulkCancelModal({ open: false, reason: "" })}>Back</button><button className={`${btn} ${btnDanger}`} form="payroll-bulk-cancel-form" disabled={bulkActionLoading === "cancel"} type="submit">{bulkActionLoading === "cancel" ? "Cancelling..." : "Cancel Selected"}</button></div>}>
        <form id="payroll-bulk-cancel-form" onSubmit={bulkCancelSelected}><Field title="Reason"><textarea className="min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" value={bulkCancelModal.reason} onChange={(e) => setBulkCancelModal((p) => ({ ...p, reason: e.target.value }))} placeholder="Why are these payroll records cancelled?" /></Field></form>
      </Modal>

      <Modal
        open={reverseModal.open}
        title="Reverse Payroll Payout"
        subtitle={reverseModal.payroll ? `${reverseModal.payroll.employee?.name || "Employee"} • ${monthName(reverseModal.payroll.month)} ${reverseModal.payroll.year}` : "Reversal Confirmation"}
        icon={<HugeiconsIcon icon={RotateLeft01Icon} size={20} />}
        onClose={() => !reverseModal.loading && setReverseModal({ open: false, payroll: null, reason: "", reversalDate: dateInput(), loading: false })}
        maxWidth="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              type="button"
              disabled={reverseModal.loading}
              onClick={() => setReverseModal({ open: false, payroll: null, reason: "", reversalDate: dateInput(), loading: false })}
            >
              Back
            </button>
            <button
              className={`${btn} ${btnDanger}`}
              form="payroll-reverse-form"
              disabled={reverseModal.loading}
              type="submit"
            >
              {reverseModal.loading ? "Reversing Payout..." : "Confirm Reversal"}
            </button>
          </div>
        }
      >
        <form id="payroll-reverse-form" onSubmit={handleReversePayroll} className="space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3">
              <HugeiconsIcon icon={Alert02Icon} size={20} className="shrink-0 text-rose-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-extrabold text-rose-900">Financial Audit & Accounting Notice</h4>
                <p className="mt-1 text-xs font-semibold text-rose-700">
                  Executing a reversal will safely generate offsetting Journal Entries for both payment and accrual, void associated bank transactions, revert any deducted employee loan installments, and restore the employee's loan balance.
                </p>
              </div>
            </div>
          </div>

          {reverseModal.payroll && (
            <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 text-xs font-bold text-gray-700 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Employee:</span>
                <span className="text-gray-900">{reverseModal.payroll.employee?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Net Payable:</span>
                <span className="text-emerald-700 font-extrabold">{money(reverseModal.payroll.netPayable, reverseModal.payroll.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method:</span>
                <span className="text-gray-900">{pretty(reverseModal.payroll.paymentMethod)}</span>
              </div>
            </div>
          )}

          <Field title="Reversal Date">
            <input
              className={input}
              type="date"
              value={reverseModal.reversalDate}
              onChange={(e) => setReverseModal((p) => ({ ...p, reversalDate: e.target.value }))}
            />
          </Field>

          <Field title="Justification Reason *">
            <textarea
              className="min-h-[100px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
              value={reverseModal.reason}
              onChange={(e) => setReverseModal((p) => ({ ...p, reason: e.target.value }))}
              placeholder="State the audit / administrative justification for reversing this payout (required)..."
              required
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={periodLockModal.open}
        title={periodLockModal.action === "lock" ? "Lock Payroll Period" : "Unlock Payroll Period"}
        subtitle={periodLockModal.period ? `${monthName(periodLockModal.period.month)} ${periodLockModal.period.year}` : `${monthName(filters.month)} ${filters.year}`}
        icon={periodLockModal.action === "lock" ? <HugeiconsIcon icon={SquareLock01Icon} size={20} /> : <HugeiconsIcon icon={SquareUnlock01Icon} size={20} />}
        onClose={() => !periodLockModal.loading && setPeriodLockModal({ open: false, period: null, action: "lock", reason: "", loading: false })}
        maxWidth="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              type="button"
              disabled={periodLockModal.loading}
              onClick={() => setPeriodLockModal({ open: false, period: null, action: "lock", reason: "", loading: false })}
            >
              Cancel
            </button>
            <button
              className={`${btn} ${periodLockModal.action === "lock" ? btnPrimary : btnDanger}`}
              form="period-lock-form"
              disabled={periodLockModal.loading}
              type="submit"
            >
              {periodLockModal.loading ? "Processing..." : periodLockModal.action === "lock" ? "Lock Period" : "Unlock Period"}
            </button>
          </div>
        }
      >
        <form id="period-lock-form" onSubmit={handlePeriodLockToggle} className="space-y-4">
          <div className={`rounded-2xl border p-4 ${periodLockModal.action === "lock" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"}`}>
            <p className={`text-xs font-bold ${periodLockModal.action === "lock" ? "text-amber-800" : "text-rose-800"}`}>
              {periodLockModal.action === "lock"
                ? "Locking this period will freeze attendance modifications and prevent salary recalculations or updates for all records in this month."
                : "Unlocking this period will permit authorized administrators to modify attendance or recalculate payrolls for this month. All unlock events are permanently recorded in the audit log."}
            </p>
          </div>

          <Field title={periodLockModal.action === "lock" ? "Lock Reason (Optional)" : "Unlock Justification Reason *"}>
            <textarea
              className="min-h-[100px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
              value={periodLockModal.reason}
              onChange={(e) => setPeriodLockModal((p) => ({ ...p, reason: e.target.value }))}
              placeholder={periodLockModal.action === "lock" ? "E.g., Monthly payroll reconciled and finalized" : "Explain why this locked period must be reopened..."}
              required={periodLockModal.action === "unlock"}
            />
          </Field>
        </form>
      </Modal>

      <PayslipModal
        open={Boolean(payslipModalId)}
        payrollId={payslipModalId}
        onClose={() => setPayslipModalId(null)}
      />
    </div>
  )
}

function PayrollTabBar({ tab, onChange }) {
  const tabs = [
    ["payrolls", "Payrolls", File02Icon],
    ["approvals", "Approvals", CheckmarkCircle02Icon],
    ["calculate", "Payroll Run", Dollar01Icon],
    ["payslips", "Payslips & Disbursement", Download01Icon],
    ["bulk", "Bulk Run", UserGroupIcon],
    ["periods", "Periods", SquareLock01Icon],
    ["audit", "Audit Trail", Shield01Icon],
  ]

  return (
    <div className={`${card} mb-6 overflow-x-auto px-2 py-2`}>
      <div className="flex min-w-max items-center gap-2">
        {tabs.map(([key, text, Icon]) => {
          const active = tab === key

          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <HugeiconsIcon icon={Icon} size={16} />
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ChipSearchToolbar({
  chips = [],
  query,
  onQueryChange,
  placeholder,
  onRemoveChip,
  onOpenFilters,
  filterCount = 0,
  showClear,
  onClear,
  resultText,
  onRefresh,
  refreshing = false,
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex min-h-[46px] w-full items-center gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-[#f7f8fb] px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]">
          <HugeiconsIcon icon={Search01Icon} size={16} className="shrink-0 text-gray-400" />

          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onRemoveChip?.(chip.key)}
              className="inline-flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10 transition hover:bg-indigo-100"
              title={`Reset ${chip.label}`}
            >
              <span className="truncate">
                <span className="text-indigo-500">{chip.label}:</span> {chip.value}
              </span>
              <HugeiconsIcon icon={Cancel01Icon} size={13} className="shrink-0" />
            </button>
          ))}

          <input
            className="min-w-[220px] flex-1 border-0 bg-transparent px-1 py-2 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
            value={query}
            onChange={(event) => onQueryChange?.(event.target.value)}
            placeholder={placeholder}
            type="text"
          />

          <button
            type="button"
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-extrabold transition ${
              filterCount
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
            }`}
            onClick={onOpenFilters}
          >
            <HugeiconsIcon icon={FilterIcon} size={16} />
            Filters
            {filterCount ? <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{filterCount}</span> : null}
          </button>

          {showClear ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              onClick={onClear}
              title="Reset search and filters"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 xl:justify-end">
        <span className="whitespace-nowrap text-xs font-bold text-gray-500">{resultText}</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
          title="Refresh"
        >
          <HugeiconsIcon icon={RefreshIcon} size={17} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone = "gray" }) {
  const styles = {
    gray: "border-gray-100 bg-white text-gray-950",
    indigo: "border-indigo-100 bg-indigo-50/50 text-indigo-950",
    emerald: "border-emerald-100 bg-emerald-50/50 text-emerald-950",
    amber: "border-amber-100 bg-amber-50/50 text-amber-950",
    rose: "border-rose-100 bg-rose-50/50 text-rose-950",
  }[tone] || "border-gray-100 bg-white text-gray-950"

  return (
    <div className={`rounded-xl border px-3.5 py-3 ${styles}`}>
      <p className="truncate text-[11px] font-black uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 truncate text-base font-black">{value}</p>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }) {
  return <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white">{icon}</div><div><h2 className="text-lg font-extrabold text-gray-900">{title}</h2><p className="text-sm font-semibold text-gray-500">{subtitle}</p></div></div>
}

function MonthSelect({ value, onChange }) {
  return <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
}

function DepartmentSelect({ value, departments, onChange }) {
  return <select className={input} value={value} onChange={(e) => onChange(e.target.value)}><option value="">All Departments</option>{departments.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select>
}

function PositionSelect({ value, positions, onChange }) {
  return <select className={input} value={value} onChange={(e) => onChange(e.target.value)}><option value="">All Positions</option>{positions.map((x) => <option key={x._id} value={x._id}>{x.title}</option>)}</select>
}

function PayrollActionMenu({ payroll, readPayroll, approvePayroll, setPayModal, setReverseModal, openMenuId, setOpenMenuId, onOpenPayslip, onDownloadPdf, submitForApproval }) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const canManage = payroll?.status !== "paid" && payroll?.status !== "cancelled"
  const open = openMenuId === payroll?._id

  const close = useCallback(() => setOpenMenuId(null), [setOpenMenuId])

  const runAction = useCallback(
    (action) => {
      close()
      window.requestAnimationFrame(() => action?.())
    },
    [close]
  )

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = 210
      const height = canManage ? 260 : (payroll?.status === "paid" ? 190 : 150)
      const gap = 8
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
      const openAbove = rect.bottom + height + gap > window.innerHeight
      const top = openAbove ? Math.max(12, rect.top - height - gap) : Math.min(window.innerHeight - height - 12, rect.bottom + gap)

      setPosition({ top, left })
    }

    updatePosition()

    const closeMenu = () => close()
    const onKey = (event) => event.key === "Escape" && close()

    window.addEventListener("click", closeMenu)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)

    return () => {
      window.removeEventListener("click", closeMenu)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [canManage, close, open, payroll?.status])

  const itemClass =
    "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-gray-700 transition hover:bg-gray-50"

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{ position: "fixed", top: position.top, left: position.left, width: 210 }}
            className="z-[9999] rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_22px_60px_-24px_rgba(15,23,42,0.65)] ring-1 ring-black/5"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={itemClass} onClick={() => runAction(() => readPayroll(payroll))}>
              <HugeiconsIcon icon={ViewIcon} size={16} className="text-indigo-600" />
              View details
            </button>
            <button type="button" className={itemClass} onClick={() => runAction(() => onOpenPayslip?.(payroll))}>
              <HugeiconsIcon icon={PrinterIcon} size={16} className="text-indigo-600" />
              Payslip & Print
            </button>
            <button type="button" className={itemClass} onClick={() => runAction(() => onDownloadPdf?.(payroll))}>
              <HugeiconsIcon icon={Download01Icon} size={16} className="text-emerald-600" />
              Download PDF
            </button>

            {payroll?.status === "calculated" &&
            (!payroll?.approvalWorkflow?.isWorkflowEnabled ||
              ["draft", "sent_back"].includes(payroll?.approvalWorkflow?.status)) ? (
              <button
                type="button"
                className={itemClass}
                onClick={() => runAction(() => submitForApproval?.(payroll))}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-indigo-600" />
                Submit for Approval
              </button>
            ) : null}

            {canManage ? (
              <>
                <button type="button" className={itemClass} onClick={() => runAction(() => approvePayroll(payroll))}>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="text-emerald-600" />
                  Approve
                </button>
                <button
                  type="button"
                  className={itemClass}
                  onClick={() =>
                    runAction(() =>
                      setPayModal({
                        open: true,
                        payroll,
                        paymentMethod: payroll.paymentMethod || "cash",
                        bankAccount: payroll.bankAccount?._id || payroll.bankAccount || "",
                        paymentDate: dateInput(),
                        transactionRef: payroll.transactionRef || "",
                      })
                    )
                  }
                >
                  <HugeiconsIcon icon={CreditCardIcon} size={16} className="text-amber-600" />
                  Mark paid
                </button>
              </>
            ) : null}

            {payroll?.status === "paid" ? (
              <button
                type="button"
                className={`${itemClass} text-rose-600 hover:bg-rose-50`}
                onClick={() =>
                  runAction(() =>
                    setReverseModal({
                      open: true,
                      payroll,
                      reason: "",
                      reversalDate: dateInput(),
                      loading: false,
                    })
                  )
                }
              >
                <HugeiconsIcon icon={RotateLeft01Icon} size={16} className="text-rose-600" />
                Reverse payout
              </button>
            ) : null}
          </div>,
          document.body
        )
      : null

  return (
    <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <button type="button" className={`${btn} ${btnPrimary} h-9 rounded-lg px-3 py-1.5 text-xs`} onClick={() => readPayroll(payroll)}>
        <HugeiconsIcon icon={ViewIcon} size={16} />
        View
      </button>

      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
        onClick={(event) => {
          event.stopPropagation()
          setOpenMenuId(open ? null : payroll._id)
        }}
        title="More actions"
      >
        <HugeiconsIcon icon={MoreVerticalIcon} size={16} />
      </button>

      {menu}
    </div>
  )
}

function PayrollTable({
  payrolls,
  loading,
  page,
  totalPages,
  loadPayrolls,
  readPayroll,
  approvePayroll,
  setPayModal,
  setReverseModal,
  selectedIds,
  selectedPayrolls,
  toggleSelection,
  selectAllVisible,
  clearSelection,
  bulkApproveSelected,
  setBulkPayModal,
  setBulkCancelModal,
  bulkActionLoading,
  onOpenPayslip,
  onDownloadPdf,
  submitForApproval,
}) {
  const [openMenuId, setOpenMenuId] = useState(null)
  const allVisibleSelected = payrolls.length > 0 && payrolls.every((payroll) => selectedIds.includes(payroll._id))
  const eligibleSelected = selectedPayrolls.filter((payroll) => !["paid", "cancelled"].includes(payroll.status))
  const selectionMode = selectedIds.length > 0
  const headings = ["Employee", "Payslip No", "Period", "Gross", "Deductions", "Net Payable", "Status", "Actions"]

  return (
    <section className={`${tableCard} overflow-hidden`}>
      {selectedPayrolls.length ? (
        <div className="flex flex-col gap-3 border-b border-indigo-100 bg-indigo-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-sm font-black text-indigo-900">{selectedPayrolls.length} payroll selected</p>
            <p className="text-xs font-bold text-indigo-500">
              Eligible for pay/approve/cancel: {eligibleSelected.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} ${btnSoft}`} type="button" disabled={!eligibleSelected.length || bulkActionLoading === "approve"} onClick={bulkApproveSelected}>
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} /> {bulkActionLoading === "approve" ? "Approving..." : "Approve Selected"}
            </button>
            <button className={`${btn} ${btnPrimary}`} type="button" disabled={!eligibleSelected.length || bulkActionLoading === "pay"} onClick={() => setBulkPayModal((p) => ({ ...p, open: true }))}>
              <HugeiconsIcon icon={CreditCardIcon} size={16} /> Mark Paid
            </button>
            <button className={`${btn} ${btnGhost} text-rose-600`} type="button" disabled={!eligibleSelected.length || bulkActionLoading === "cancel"} onClick={() => setBulkCancelModal({ open: true, reason: "" })}>
              <HugeiconsIcon icon={Cancel01Icon} size={16} /> Cancel
            </button>
            <button className={`${btn} ${btnGhost}`} type="button" onClick={clearSelection}>Clear</button>
          </div>
        </div>
      ) : null}

      <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-20 bg-gray-50/95">
            <tr>
              <th className="w-11 border-b border-gray-200 bg-gray-50/95 px-3 py-3.5 text-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!payrolls.length || loading}
                  onChange={(event) => selectAllVisible(event.target.checked, payrolls)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  title="Select all visible payrolls"
                />
              </th>
              {headings.map((heading) => (
                <th
                  key={heading}
                  className={`border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-gray-600 ${
                    heading === "Actions" ? "min-w-[170px] text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="bg-white px-5 py-16 text-center">
                  <HugeiconsIcon icon={RefreshIcon} size={24} className="mx-auto animate-spin text-indigo-600" />
                </td>
              </tr>
            ) : payrolls.length ? (
              payrolls.map((payroll) => {
                const checked = selectedIds.includes(payroll._id)

                return (
                  <tr key={payroll._id} className={`group align-top transition ${checked ? "bg-indigo-50/40" : "bg-white hover:bg-indigo-50/30"}`}>
                    <td className="w-11 border-b border-gray-100 px-3 py-3 text-center">
                      {selectionMode ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelection(payroll._id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          title="Select payroll"
                        />
                      ) : null}
                    </td>

                    <td className="border-b border-gray-100 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar employee={payroll.employee} className="h-10 w-10" />
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-gray-950">{payroll.employee?.name || "Unknown employee"}</p>
                          <p className="truncate text-sm font-semibold text-gray-500">{payroll.employee?.position?.title || payroll.employee?.email || "Employee"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="border-b border-gray-100 px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-50 px-3 py-1.5 text-xs font-black text-gray-700 ring-1 ring-gray-200">
                        {payrollDisplayId(payroll)}
                      </span>
                    </td>

                    <td className="border-b border-gray-100 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-gray-900">{monthName(payroll.month)} {payroll.year}</p>
                        {payroll.salarySnapshot?.isProrated ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-600/20"
                            title={`Prorated (${payroll.salarySnapshot.activeDays}/${payroll.salarySnapshot.totalDaysInMonth} days): ${payroll.salarySnapshot.prorationReason || ""}`}
                          >
                            <HugeiconsIcon icon={Clock01Icon} size={12} className="text-amber-600" /> Prorated
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-500">{formatDate(payroll.periodStart)} - {formatDate(payroll.periodEnd)}</p>
                    </td>

                    <td className="border-b border-gray-100 px-4 py-3 text-sm font-black text-gray-800">{money(payroll.grossSalary, payroll.currency)}</td>
                    <td className="border-b border-gray-100 px-4 py-3 text-sm font-black text-rose-600">{money(payroll.totalDeductions, payroll.currency)}</td>
                    <td className="border-b border-gray-100 px-4 py-3 text-sm font-black text-emerald-700">{money(payroll.netPayable, payroll.currency)}</td>
                    <td className="border-b border-gray-100 px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={payroll.status} />
                        {payroll.approvalWorkflow?.isWorkflowEnabled && payroll.approvalWorkflow?.status !== "draft" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full ring-1 ring-indigo-600/10">
                            <HugeiconsIcon icon={Shield01Icon} size={10} />
                            {payroll.approvalWorkflow.status === "approved"
                              ? "Approved"
                              : payroll.approvalWorkflow.status === "sent_back"
                              ? "Sent Back"
                              : payroll.approvalWorkflow.currentStageName || "In Review"}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="min-w-[170px] border-b border-gray-100 bg-white px-4 py-2.5 text-right group-hover:bg-indigo-50/20">
                      <PayrollActionMenu
                        payroll={payroll}
                        readPayroll={readPayroll}
                        approvePayroll={approvePayroll}
                        setPayModal={setPayModal}
                        setReverseModal={setReverseModal}
                        openMenuId={openMenuId}
                        setOpenMenuId={setOpenMenuId}
                        onOpenPayslip={onOpenPayslip}
                        onDownloadPdf={onDownloadPdf}
                        submitForApproval={submitForApproval}
                      />
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={9} className="bg-white px-5 py-16 text-center">
                  <HugeiconsIcon icon={File02Icon} size={32} className="mx-auto text-gray-300" />
                  <p className="mt-3 text-sm font-extrabold text-gray-900">No payroll records found</p>
                  <p className="mt-1 text-sm font-semibold text-gray-500">Calculate payroll or adjust filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-gray-600">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button className={`${btn} ${btnGhost}`} disabled={page <= 1 || loading} onClick={() => loadPayrolls(page - 1)}><HugeiconsIcon icon={ArrowLeft01Icon} size={16} /> Previous</button>
          <button className={`${btn} ${btnGhost}`} disabled={page >= totalPages || loading} onClick={() => loadPayrolls(page + 1)}>Next <HugeiconsIcon icon={ArrowRight01Icon} size={16} /></button>
        </div>
      </div>
    </section>
  )
}

function PayrollPreviewCard({ payroll }) {
  if (!payroll) return <div className={`${card} flex min-h-[360px] items-center justify-center p-8 text-center`}><div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10"><HugeiconsIcon icon={ViewIcon} size={24} /></div><h3 className="mt-4 text-lg font-extrabold text-gray-900">Preview will show here</h3><p className="mt-2 text-sm font-semibold text-gray-500">Select employee and click Preview Payroll.</p></div></div>
  const loanTotal = getLoanDeductionTotal(payroll)
  const taxTotal = getTaxDeductionTotal(payroll)
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="border-b border-gray-100 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">Payroll Preview</h3>
            <p className="mt-1 text-sm font-semibold text-gray-500">{monthName(payroll.month)} {payroll.year}</p>
          </div>
          <StatusBadge status={payroll.status} />
        </div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-600/10">
          <p className="text-xs font-bold text-indigo-500">Net Payable</p>
          <p className="mt-1 text-3xl font-black text-indigo-700">{money(payroll.netPayable, payroll.currency)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Gross" value={money(payroll.grossSalary, payroll.currency)} />
          <MiniStat label="Tax / TDS" value={money(taxTotal, payroll.currency)} tone={taxTotal > 0 ? "rose" : "gray"} />
          <MiniStat label="Deductions" value={money(payroll.totalDeductions, payroll.currency)} tone="rose" />
          <MiniStat label="Loan Deduction" value={money(loanTotal, payroll.currency)} tone={loanTotal > 0 ? "amber" : "gray"} />
          <MiniStat label="Payable Days" value={payroll.attendanceSummary?.payableDays || 0} />
        </div>
        <RosterSummaryCard payroll={payroll} compact />
        <LoanDeductionNotice payroll={payroll} />
      </div>
    </div>
  )
}

function BulkResult({ result }) {
  return <div className={`${card} overflow-hidden`}><div className="border-b border-gray-100 p-4 sm:p-5"><h3 className="text-lg font-extrabold text-gray-900">Bulk Result</h3><p className="mt-1 text-sm font-semibold text-gray-500">Success and failed payroll results.</p></div>{result ? <div className="p-4 sm:p-5"><div className="grid grid-cols-3 gap-2"><MiniStat label="Total" value={result.total || 0} /><MiniStat label="Success" value={result.success || 0} tone="emerald" /><MiniStat label="Failed" value={result.failed || 0} tone="rose" /></div><div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">{(result.results || []).map((item, index) => <div key={`${item.employee}-${index}`} className="rounded-2xl border border-gray-100 bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-gray-900">{item.name || "Employee"}</p><p className="truncate text-xs font-semibold text-gray-500">{item.email || item.employee}</p><p className={`mt-1 text-xs font-bold ${item.success ? "text-emerald-600" : "text-rose-600"}`}>{item.message}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${item.success ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" : "bg-rose-50 text-rose-700 ring-rose-600/10"}`}>{item.success ? "Done" : "Failed"}</span></div></div>)}</div></div> : <div className="p-8 text-center"><HugeiconsIcon icon={UserGroupIcon} size={32} className="mx-auto text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-500">Run bulk payroll to see result.</p></div>}</div>
}

function getLoanDeductions(payroll) {
  return (payroll?.deductions || []).filter((item) => item?.source === "employee_loan")
}

function getLoanDeductionTotal(payroll) {
  return getLoanDeductions(payroll).reduce((sum, item) => sum + Number(item.amount || 0), 0)
}

function getTaxDeductions(payroll) {
  return (payroll?.deductions || []).filter((item) => item?.source === "tax")
}

function getTaxDeductionTotal(payroll) {
  return Number(payroll?.taxDeduction ?? getTaxDeductions(payroll).reduce((sum, item) => sum + Number(item.amount || 0), 0))
}

function getOtherDeductionTotal(payroll) {
  const total = Number(payroll?.totalDeductions || 0)
  return Math.max(0, total - getTaxDeductionTotal(payroll))
}

function LoanDeductionNotice({ payroll }) {
  const loanDeductions = getLoanDeductions(payroll)
  if (!loanDeductions.length) return null

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-amber-900">Employee loan deduction included</p>
          <p className="mt-1 text-xs font-bold text-amber-700">
            These installments are applied to the loan record when payroll is marked paid.
          </p>
        </div>
        <p className="shrink-0 text-sm font-black text-amber-900">
          {money(getLoanDeductionTotal(payroll), payroll.currency)}
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {loanDeductions.map((item, index) => (
          <div key={item._id || item.refId || `${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-amber-100">
            <span className="truncate text-xs font-extrabold text-gray-800">
              {item.meta?.loanNo || item.name || "Employee loan"}
            </span>
            <span className="text-xs font-black text-rose-700">{money(item.amount, payroll.currency)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RosterSummaryCard({ payroll, compact = false }) {
  const roster = payroll?.rosterSummary || {}
  if (!roster || (!roster.rosteredDays && !roster.workingDays && !roster.schedule?.length)) return null

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black text-indigo-900">Roster calculation included</p>
          <p className="mt-1 text-xs font-bold text-indigo-700">
            Payroll is using roster context for scheduled shifts, off days, holidays, attendance gaps, and late days.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-600/10">
          {roster.rosteredDays || 0} shift day(s)
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <MiniStat label="Working" value={roster.workingDays || 0} tone="indigo" />
        <MiniStat label="Attended" value={roster.attendedDays || 0} tone="emerald" />
        <MiniStat label="Roster Absent" value={roster.rosterAbsentDays || 0} tone={roster.rosterAbsentDays ? "rose" : "gray"} />
        <MiniStat label="Late" value={roster.lateDays || 0} tone={roster.lateDays ? "amber" : "gray"} />
        <MiniStat label="Weekly Off" value={roster.weeklyOffDays || 0} />
        <MiniStat label="Holiday" value={roster.holidayDays || 0} />
      </div>
      {!compact && Array.isArray(roster.schedule) && roster.schedule.length ? (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-2xl bg-white ring-1 ring-indigo-100">
          {roster.schedule.slice(0, 31).map((day) => (
            <div key={day.date} className="flex items-center justify-between gap-3 border-b border-indigo-50 px-3 py-2 last:border-b-0">
              <span className="text-xs font-extrabold text-gray-700">{day.date}</span>
              <span className="truncate text-xs font-bold text-gray-500">{day.shift?.name || day.expectedStatus || "Unassigned"}</span>
              <span className="text-xs font-black text-indigo-700">{day.attendanceStatus || "-"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function FilterModal({ open, onClose, filterDraft, setFilterDraft, apply, clear, departments, positions, update }) {
  return <Modal open={open} title="Payroll Filters" subtitle="Filter by employee, department, position, month, and status." icon={<HugeiconsIcon icon={FilterIcon} size={20} />} onClose={onClose} footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" onClick={clear}>Clear</button><button className={`${btn} ${btnPrimary}`} type="button" onClick={apply}>Apply Filters</button></div>}><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="md:col-span-2"><Field title="Employee"><EmployeeSearch value={filterDraft.employee} onSelect={(employee) => update("employee", employee)} /></Field></div><Field title="Year"><input className={input} type="number" value={filterDraft.year} onChange={(e) => update("year", e.target.value)} /></Field><Field title="Month"><select className={input} value={filterDraft.month} onChange={(e) => update("month", e.target.value)}><option value="">All Months</option>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></Field><Field title="Department"><DepartmentSelect value={filterDraft.department} departments={departments} onChange={(value) => update("department", value)} /></Field><Field title="Position"><PositionSelect value={filterDraft.position} positions={positions} onChange={(value) => update("position", value)} /></Field><Field title="Status"><select className={input} value={filterDraft.status} onChange={(e) => update("status", e.target.value)}>{STATUSES.map((x) => <option key={x || "all"} value={x}>{x ? pretty(x) : "All Status"}</option>)}</select></Field></div></Modal>
}

function PayslipFilterModal({ open, onClose, draft, setDraft, departments, positions, apply, clear }) {
  const update = (key, value) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "department" ? { position: "" } : {}),
    }))
  }

  return (
    <Modal
      open={open}
      title="Payslip Filters"
      subtitle="Refine the current payslip and disbursement workspace."
      icon={<HugeiconsIcon icon={FilterIcon} size={20} />}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className={`${btn} ${btnGhost}`} type="button" onClick={clear}>Reset</button>
          <button className={`${btn} ${btnPrimary}`} type="button" onClick={apply}>Apply Filters</button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field title="Year">
          <input className={input} type="number" value={draft.year} onChange={(event) => update("year", Number(event.target.value))} />
        </Field>

        <Field title="Month">
          <select className={input} value={draft.month} onChange={(event) => update("month", Number(event.target.value))}>
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>{name}</option>
            ))}
          </select>
        </Field>

        <Field title="Department">
          <DepartmentSelect value={draft.department} departments={departments} onChange={(value) => update("department", value)} />
        </Field>

        <Field title="Position">
          <PositionSelect value={draft.position} positions={positions} onChange={(value) => update("position", value)} />
        </Field>

        <Field title="Payout Method">
          <select className={input} value={draft.payoutMethod} onChange={(event) => update("payoutMethod", event.target.value)}>
            <option value="">All Methods</option>
            <option value="bank">Bank Transfer</option>
            <option value="mobile_banking">Mobile Banking (MFS)</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </Field>

        <Field title="Status">
          <select className={input} value={draft.status} onChange={(event) => update("status", event.target.value)}>
            {STATUSES.map((status) => (
              <option key={status || "all"} value={status}>{status ? pretty(status) : "All Status"}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  )
}

function DetailFooter({ payroll, approvePayroll, setPayModal, setCancelModal, deletePayroll, setReverseModal, onOpenPayslip, onDownloadPdf }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      <div className="flex flex-wrap gap-2">
        <button
          className={`${btn} ${btnGhost}`}
          type="button"
          onClick={() => onOpenPayslip?.(payroll)}
        >
          <HugeiconsIcon icon={PrinterIcon} size={16} /> Payslip & Print
        </button>
        <button
          className={`${btn} ${btnGhost}`}
          type="button"
          onClick={() => onDownloadPdf?.(payroll)}
        >
          <HugeiconsIcon icon={Download01Icon} size={16} /> Download PDF
        </button>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {payroll.status !== "paid" && payroll.status !== "cancelled" ? (
          <button className={`${btn} ${btnSoft}`} type="button" onClick={() => approvePayroll(payroll)}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} /> Approve
          </button>
        ) : null}
        {payroll.status !== "paid" && payroll.status !== "cancelled" ? (
          <button
            className={`${btn} ${btnPrimary}`}
            type="button"
            onClick={() =>
              setPayModal({
                open: true,
                payroll,
                paymentMethod: payroll.paymentMethod || "cash",
                bankAccount: payroll.bankAccount?._id || payroll.bankAccount || "",
                paymentDate: dateInput(),
                transactionRef: payroll.transactionRef || "",
              })
            }
          >
            <HugeiconsIcon icon={CreditCardIcon} size={16} /> Mark Paid
          </button>
        ) : null}
        {payroll.status === "paid" ? (
          <button
            className={`${btn} ${btnDanger}`}
            type="button"
            onClick={() =>
              setReverseModal({
                open: true,
                payroll,
                reason: "",
                reversalDate: dateInput(),
                loading: false,
              })
            }
          >
            <HugeiconsIcon icon={RotateLeft01Icon} size={16} /> Reverse Payout
          </button>
        ) : null}
        {payroll.status !== "paid" && payroll.status !== "cancelled" ? (
          <button
            className={`${btn} ${btnGhost} text-rose-600`}
            type="button"
            onClick={() => setCancelModal({ open: true, payroll, reason: "" })}
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} /> Cancel
          </button>
        ) : null}
        {!["approved", "paid"].includes(payroll.status) ? (
          <button className={`${btn} ${btnDanger}`} type="button" onClick={() => deletePayroll(payroll)}>
            <HugeiconsIcon icon={Delete02Icon} size={16} /> Delete
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PayslipView({ payroll }) {
  const employee = payroll.employee || {}
  const attendance = payroll.attendanceSummary || {}
  const taxTotal = getTaxDeductionTotal(payroll)
  const otherDeductionTotal = getOtherDeductionTotal(payroll)
  const isReversed = payroll.status === "reversed" || payroll.isReversed
  const isProrated = Boolean(payroll.salarySnapshot?.isProrated)
  const payout = payroll.payoutSnapshot || {}
  const auditTrail = Array.isArray(payroll.auditTrail) ? payroll.auditTrail : []

  return (
    <div className="bg-white space-y-4">
      {isReversed && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
              <HugeiconsIcon icon={RotateLeft01Icon} size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-black text-rose-900">Payroll Payout Reversed</h4>
              <p className="mt-0.5 text-xs font-bold text-rose-700">
                Reversed by {payroll.reversedBy?.name || "Administrator"} on {formatDate(payroll.reversedAt)}.
                {payroll.reversalReason ? ` Reason: "${payroll.reversalReason}"` : ""}
              </p>
              {payroll.reversalJournalEntry ? (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  Reversal Journal Entry #{payroll.reversalJournalEntry} recorded and loan repayment restored.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {isProrated && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <HugeiconsIcon icon={Clock01Icon} size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-black text-amber-950">Prorated Salary Calculation Applied</h4>
              <p className="mt-0.5 text-xs font-bold text-amber-800">
                {payroll.salarySnapshot.prorationReason === "mid_month_join"
                  ? "Employee joined mid-month"
                  : payroll.salarySnapshot.prorationReason === "mid_month_leave"
                  ? "Employee departed mid-month"
                  : "Mid-month service tenure"}: active for {payroll.salarySnapshot.activeDays} of {payroll.salarySnapshot.totalDaysInMonth} days ({Math.round(payroll.salarySnapshot.prorationRatio * 1000) / 10}%).
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Unprorated Basic: {money(payroll.salarySnapshot.unproratedBasicSalary || payroll.basicSalary, payroll.currency)} → Prorated Basic: {money(payroll.basicSalary, payroll.currency)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-indigo-600">Business Hub CRM</p>
            <h3 className="mt-1 text-2xl font-black text-gray-900">Payslip</h3>
            <p className="mt-1 text-sm font-bold text-gray-500">Salary slip for {monthName(payroll.month)} {payroll.year}</p>
          </div>
          <div className="text-left sm:text-right">
            <StatusBadge status={payroll.status} />
            <p className="mt-2 text-xs font-bold text-gray-500">Payslip No</p>
            <p className="text-sm font-black text-gray-900">{payrollDisplayId(payroll)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 py-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
              <Avatar employee={employee} className="h-12 w-12" />
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-gray-900">{employee.name || "Employee"}</p>
                <p className="truncate text-sm font-bold text-gray-500">{employee.email || "No email"}</p>
                <p className="truncate text-sm font-bold text-gray-500">{employee.department?.name || "No department"} • {employee.position?.title || "No position"}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-600/10">
            <p className="text-xs font-bold text-indigo-500">Net Payable</p>
            <p className="mt-1 text-3xl font-black text-indigo-700">{money(payroll.netPayable, payroll.currency)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-5 md:grid-cols-4">
          <MiniStat label="Basic" value={money(payroll.basicSalary, payroll.currency)} />
          <MiniStat label="Gross" value={money(payroll.grossSalary, payroll.currency)} />
          <MiniStat label="Deductions" value={money(payroll.totalDeductions, payroll.currency)} tone="rose" />
          <MiniStat label="Loan Deduction" value={money(getLoanDeductionTotal(payroll), payroll.currency)} tone={getLoanDeductionTotal(payroll) > 0 ? "amber" : "gray"} />
        </div>

        {(payroll.status === "paid" || payroll.status === "reversed" || payout.payoutMethod || payroll.paymentMethod) && (
          <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon icon={CreditCardIcon} size={16} className="text-indigo-600" />
              <h4 className="text-sm font-black text-gray-900">Disbursement & Payout Details</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <InfoLine label="Method" value={pretty(payout.payoutMethod || payroll.paymentMethod || "Cash")} />
              <InfoLine label="Payment Date" value={formatDate(payout.paymentDate || payroll.paymentDate)} />
              <InfoLine label="Account / Wallet" value={payout.accountNumber || payout.mfsNumber || payroll.bankAccount?.accountNumber || "—"} />
              <InfoLine label="Reference" value={payout.transactionRef || payroll.transactionRef || "—"} />
            </div>
          </div>
        )}

        <div className="mt-5"><RosterSummaryCard payroll={payroll} /></div>
        <div className="mt-5"><LoanDeductionNotice payroll={payroll} /></div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <PayrollComponentTable title="Earnings" items={payroll.earnings || []} total={payroll.totalEarnings} currency={payroll.currency} />
          <PayrollComponentTable title="Deductions" items={payroll.deductions || []} total={payroll.totalDeductions} currency={payroll.currency} danger />
        </div>

        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <h4 className="text-base font-black text-gray-900">Attendance Summary</h4>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <InfoLine label="Present" value={attendance.presentDays || 0} />
            <InfoLine label="Late" value={attendance.lateDays || 0} />
            <InfoLine label="Absent" value={attendance.absentDays || 0} />
            <InfoLine label="Half Day" value={attendance.halfDays || 0} />
            <InfoLine label="Paid Leave" value={attendance.paidLeaveDays || 0} />
            <InfoLine label="Unpaid Leave" value={attendance.unpaidLeaveDays || 0} />
            <InfoLine label="Payable Days" value={attendance.payableDays || 0} />
            <InfoLine label="Overtime Hours" value={attendance.approvedOvertimeHours || 0} />
          </div>
        </div>

        {auditTrail.length > 0 && (
          <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <HugeiconsIcon icon={Shield01Icon} size={16} className="text-indigo-600" />
              <h4 className="text-sm font-black text-gray-900">Payroll Lifecycle Audit Trail</h4>
            </div>
            <div className="space-y-2">
              {auditTrail.map((ev, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 p-3">
                  <div>
                    <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase text-indigo-700">
                      {pretty(ev.action)}
                    </span>
                    <p className="mt-1 text-xs font-semibold text-gray-600">
                      {ev.note || "Status change recorded"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-extrabold text-gray-800">{ev.performedBy?.name || "System"}</p>
                    <p className="text-[10px] font-semibold text-gray-400">{new Date(ev.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PayrollComponentTable({ title, items, total, currency, danger = false }) {
  return <div className="overflow-hidden rounded-2xl border border-gray-100"><div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3"><h4 className="font-black text-gray-900">{title}</h4><p className={`text-sm font-black ${danger ? "text-rose-600" : "text-emerald-700"}`}>{money(total, currency)}</p></div><div className="divide-y divide-gray-100">{items.length ? items.map((item, index) => {
    const isLoan = item.source === "employee_loan"
    const label = isLoan ? item.meta?.loanNo || item.name : item.name
    const sourceLabel = isLoan ? "Employee Loan" : pretty(item.source)
    return (
      <div key={`${item.name}-${index}`} className={`flex items-start justify-between gap-3 px-4 py-3 ${isLoan ? "bg-amber-50/55" : ""}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-gray-900">{label}</p>
          <p className={`text-xs font-semibold ${isLoan ? "text-amber-700" : "text-gray-500"}`}>
            {sourceLabel} • {pretty(item.calculationType)} • Qty {item.quantity || 1}
          </p>
          {isLoan && item.meta?.remainingBeforeDeduction !== undefined ? (
            <p className="mt-1 text-xs font-bold text-amber-700">
              Remaining before deduction: {money(item.meta.remainingBeforeDeduction, currency)}
            </p>
          ) : null}
        </div>
        <p className={`shrink-0 text-sm font-black ${danger ? "text-rose-600" : "text-gray-900"}`}>{money(item.amount, currency)}</p>
      </div>
    )
  }) : <p className="px-4 py-8 text-center text-sm font-bold text-gray-500">No items</p>}</div></div>
}

function InfoLine({ label, value }) {
  return <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100"><span className="text-sm font-bold text-gray-500">{label}</span><span className="text-sm font-black text-gray-900">{value}</span></div>
}

function PeriodLockBanner({ period, loading, year, month, onToggleLock }) {
  if (loading) return null
  const isLocked = period?.status === "locked"

  if (isLocked) {
    return (
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <HugeiconsIcon icon={SquareLock01Icon} size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-amber-950">
                Payroll Period Locked — {monthName(month)} {year}
              </h3>
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">
                Closed
              </span>
            </div>
            <p className="mt-0.5 text-xs font-bold text-amber-800">
              Locked by {period.lockedBy?.name || "Administrator"} on {formatDate(period.lockedAt)}
              {period.lockReason ? ` · "${period.lockReason}"` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleLock}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-100/70"
        >
          <HugeiconsIcon icon={SquareUnlock01Icon} size={14} className="text-amber-700" />
          Unlock Period
        </button>
      </div>
    )
  }

  return (
    <div className="mb-5 flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
        <HugeiconsIcon icon={Clock01Icon} size={16} className="text-indigo-500" />
        <span>Period Status ({monthName(month)} {year}):</span>
        <span className="font-extrabold text-gray-900 uppercase tracking-wide">
          {period?.status || "Open"}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggleLock}
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-extrabold text-gray-700 transition hover:bg-gray-100"
      >
        <HugeiconsIcon icon={SquareLock01Icon} size={14} className="text-gray-500" />
        Lock Period
      </button>
    </div>
  )
}

function PayslipsTab({
  filters,
  search,
  refreshToken,
  onMetaChange,
  onOpenPayslip,
  onDownloadPdf,
}) {
  const {
    year,
    month,
    department,
    position,
    payoutMethod,
    status,
  } = filters

  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDownloading, setBulkDownloading] = useState("")
  const [exporting, setExporting] = useState("")
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportSelection, setExportSelection] = useState({ type: "register", format: "xlsx" })
  const [downloadingSingleId, setDownloadingSingleId] = useState(null)

  const loadPayslips = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "100")
      params.set("year", String(year))
      params.set("month", String(month))
      if (department) params.set("department", department)
      if (status) params.set("status", status)

      const res = await api(`/payroll?${params.toString()}`)
      setPayrolls(res.payrolls || [])
      setSelectedIds([])
    } catch (err) {
      toast.error(err.message || "Failed to load payslips")
    } finally {
      setLoading(false)
    }
  }, [department, month, refreshToken, status, year])

  useEffect(() => {
    loadPayslips()
  }, [loadPayslips])

  const filteredPayrolls = useMemo(() => {
    let list = payrolls

    if (position) {
      list = list.filter((payroll) => String(getId(payroll.employee?.position)) === String(position))
    }

    if (payoutMethod) {
      list = list.filter((payroll) => {
        const method = payroll.paymentMethod || payroll.payoutSnapshot?.payoutMethod || "cash"
        return method === payoutMethod
      })
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      list = list.filter((payroll) =>
        [
          payroll.employee?.name,
          payroll.employee?.email,
          payroll.employee?.employeeId,
          payroll.employee?.position?.title,
          payroll.employee?.department?.name,
          payroll.payrollKey,
          payroll._id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    }

    return list
  }, [payrolls, payoutMethod, position, search])

  useEffect(() => {
    onMetaChange?.({ count: filteredPayrolls.length, loading })
  }, [filteredPayrolls.length, loading, onMetaChange])

  const stats = useMemo(() => {
    const totalRecords = filteredPayrolls.length
    const totalNet = filteredPayrolls.reduce((sum, payroll) => sum + Number(payroll.netPayable || 0), 0)

    const bankList = filteredPayrolls.filter(
      (payroll) => (payroll.paymentMethod || payroll.payoutSnapshot?.payoutMethod) === "bank"
    )
    const bankTotal = bankList.reduce((sum, payroll) => sum + Number(payroll.netPayable || 0), 0)

    const mfsList = filteredPayrolls.filter(
      (payroll) => (payroll.paymentMethod || payroll.payoutSnapshot?.payoutMethod) === "mobile_banking"
    )
    const mfsTotal = mfsList.reduce((sum, payroll) => sum + Number(payroll.netPayable || 0), 0)

    const cashList = filteredPayrolls.filter(
      (payroll) => !["bank", "mobile_banking"].includes(payroll.paymentMethod || payroll.payoutSnapshot?.payoutMethod)
    )
    const cashTotal = cashList.reduce((sum, payroll) => sum + Number(payroll.netPayable || 0), 0)

    return {
      totalRecords,
      totalNet,
      bankCount: bankList.length,
      bankTotal,
      mfsCount: mfsList.length,
      mfsTotal,
      cashCount: cashList.length,
      cashTotal,
      currency: filteredPayrolls[0]?.currency || "BDT",
    }
  }, [filteredPayrolls])

  const toggleSelectAll = (checked) => {
    setSelectedIds(checked ? filteredPayrolls.map((payroll) => payroll._id).slice(0, 100) : [])
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    )
  }

  const handleExportRegister = async (format) => {
    setExporting(`reg_${format}`)
    try {
      const dep = department ? `&department=${department}` : ""
      const filename = `Payroll-Register-${year}-${String(month).padStart(2, "0")}.${format}`
      await downloadBlob(`/payroll/export/register?year=${year}&month=${month}${dep}&format=${format}`, filename)
      toast.success(`Exported Payroll Register (${format.toUpperCase()})`)
      return true
    } catch (err) {
      toast.error(err.message || "Failed to export register")
      return false
    } finally {
      setExporting("")
    }
  }

  const handleExportAdvice = async (method, format) => {
    const key = `${method}_${format}`
    setExporting(key)

    try {
      const dep = department ? `&department=${department}` : ""
      const label = method === "bank" ? "Bank-Advice" : "MFS-Advice"
      const filename = `${label}-${year}-${String(month).padStart(2, "0")}.${format}`

      await downloadBlob(
        `/payroll/export/disbursement-advice?year=${year}&month=${month}&payoutMethod=${method}${dep}&format=${format}`,
        filename
      )

      toast.success(`Exported ${method === "bank" ? "Bank" : "MFS"} Advice (${format.toUpperCase()})`)
      return true
    } catch (err) {
      toast.error(err.message || "Failed to export disbursement advice")
      return false
    } finally {
      setExporting("")
    }
  }

  const handleExportFromModal = async (event) => {
    event?.preventDefault()

    const { type, format } = exportSelection
    let success = false

    if (type === "register") {
      success = await handleExportRegister(format)
    } else if (type === "bank") {
      success = await handleExportAdvice("bank", format)
    } else {
      success = await handleExportAdvice("mobile_banking", format)
    }

    if (success) setExportModalOpen(false)
  }

  const handleBulkDownload = async (format) => {
    if (!selectedIds.length) {
      toast.error("Please select at least 1 payslip")
      return
    }

    if (selectedIds.length > 100) {
      toast.error("Maximum 100 payslips allowed per bulk request")
      return
    }

    setBulkDownloading(format)

    try {
      const ext = format === "pdf" ? "pdf" : "zip"
      const filename = `Payslips-${year}-${String(month).padStart(2, "0")}-${format === "pdf" ? "Merged" : "Archive"}.${ext}`

      await downloadBlob(`/payroll/payslips/bulk-download`, filename, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollIds: selectedIds, format }),
      })

      toast.success(`Bulk ${format.toUpperCase()} payslips downloaded`)
    } catch (err) {
      toast.error(err.message || "Bulk download failed")
    } finally {
      setBulkDownloading("")
    }
  }

  const handleSinglePdf = async (payroll) => {
    setDownloadingSingleId(payroll._id)
    try {
      await onDownloadPdf?.(payroll)
    } finally {
      setDownloadingSingleId(null)
    }
  }

  const formatPayoutTarget = (payroll) => {
    const method = payroll.paymentMethod || payroll.payoutSnapshot?.payoutMethod || "cash"

    if (method === "bank") {
      const account = payroll.payoutSnapshot?.bankDetails?.accountNumber || payroll.bankAccount?.accountNumber
      const bankName = payroll.payoutSnapshot?.bankDetails?.bankName || payroll.bankAccount?.bankName || "Bank"
      const masked = account ? `••••${String(account).slice(-4)}` : ""

      return (
        <div>
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 ring-1 ring-blue-600/15">
            Bank
          </span>
          <p className="mt-0.5 max-w-[140px] truncate text-xs text-gray-500">{bankName} {masked}</p>
        </div>
      )
    }

    if (method === "mobile_banking") {
      const provider = payroll.payoutSnapshot?.mfsDetails?.provider || "MFS"
      const number = payroll.payoutSnapshot?.mfsDetails?.walletNumber
      const masked = number ? `••••${String(number).slice(-4)}` : ""

      return (
        <div>
          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700 ring-1 ring-purple-600/15">
            {provider.toUpperCase()}
          </span>
          <p className="mt-0.5 text-xs text-gray-500">{masked}</p>
        </div>
      )
    }

    return (
      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold capitalize text-gray-700">
        {method.replace(/_/g, " ")}
      </span>
    )
  }

  const allVisibleSelected =
    filteredPayrolls.length > 0 &&
    filteredPayrolls.every((payroll) => selectedIds.includes(payroll._id))

  const selectionMode = selectedIds.length > 0

  return (
    <div className="space-y-4">
      <div className={`${tableCard} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">Payslip Summary</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">
              {monthName(month)} {year} · current filtered payroll snapshot
            </p>
          </div>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-extrabold text-gray-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <HugeiconsIcon icon={Download01Icon} size={15} />
            Export
          </button>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-gray-100 sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Total Records</p>
            <p className="mt-1 text-lg font-black text-gray-950">{stats.totalRecords}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Net Payable</p>
            <p className="mt-1 text-lg font-black text-emerald-700">{money(stats.totalNet, stats.currency)}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Bank Advice</p>
            <p className="mt-1 text-sm font-black text-gray-900">{stats.bankCount} · {money(stats.bankTotal, stats.currency)}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">MFS Advice</p>
            <p className="mt-1 text-sm font-black text-gray-900">{stats.mfsCount} · {money(stats.mfsTotal, stats.currency)}</p>
          </div>
          <div className="col-span-2 px-4 py-3.5 sm:col-span-1">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Cash & Other</p>
            <p className="mt-1 text-sm font-black text-gray-900">{stats.cashCount} · {money(stats.cashTotal, stats.currency)}</p>
          </div>
        </div>
      </div>

      {selectionMode ? (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-indigo-600 px-2 text-xs font-black text-white">
              {selectedIds.length}
            </span>
            <p className="text-sm font-extrabold text-indigo-950">
              Selected for bulk payslip generation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={Boolean(bulkDownloading)}
              onClick={() => handleBulkDownload("pdf")}
              className={`${btn} ${btnPrimary} h-9 px-3 text-xs`}
            >
              <HugeiconsIcon
                icon={bulkDownloading === "pdf" ? RefreshIcon : File02Icon}
                size={14}
                className={bulkDownloading === "pdf" ? "animate-spin" : ""}
              />
              {bulkDownloading === "pdf" ? "Merging..." : "Merged PDF"}
            </button>

            <button
              type="button"
              disabled={Boolean(bulkDownloading)}
              onClick={() => handleBulkDownload("zip")}
              className={`${btn} ${btnSoft} h-9 px-3 text-xs`}
            >
              <HugeiconsIcon
                icon={bulkDownloading === "zip" ? RefreshIcon : Download01Icon}
                size={14}
                className={bulkDownloading === "zip" ? "animate-spin" : ""}
              />
              {bulkDownloading === "zip" ? "Archiving..." : "ZIP Archive"}
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className={`${btn} ${btnGhost} h-9 px-3 text-xs`}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <div className={`${tableCard} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left">
            <thead className="bg-gray-50/90">
              <tr>
                <th className="w-11 border-b border-gray-200 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={!filteredPayrolls.length || loading}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    title="Select all visible (up to 100)"
                  />
                </th>
                <th className="border-b border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Employee</th>
                <th className="border-b border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Period</th>
                <th className="border-b border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Gross</th>
                <th className="border-b border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Deductions</th>
                <th className="border-b border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Net Payable</th>
                <th className="border-b border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Payout</th>
                <th className="border-b border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Status</th>
                <th className="border-b border-gray-200 px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-gray-600">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center">
                    <HugeiconsIcon icon={RefreshIcon} size={24} className="mx-auto animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : filteredPayrolls.length ? (
                filteredPayrolls.map((payroll) => {
                  const checked = selectedIds.includes(payroll._id)
                  const isReversed = payroll.status === "reversed" || payroll.isReversed

                  return (
                    <tr
                      key={payroll._id}
                      className={`transition ${checked ? "bg-indigo-50/40" : "bg-white hover:bg-gray-50/70"}`}
                    >
                      <td className="w-11 px-3 py-3 text-center">
                        {selectionMode ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(payroll._id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            title="Select payslip"
                          />
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar employee={payroll.employee} className="h-10 w-10 rounded-xl" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-900">{payroll.employee?.name || "Unknown"}</p>
                            <p className="truncate text-xs text-gray-500">
                              {payroll.employee?.position?.title || payroll.employee?.department?.name || "Employee"} · {payroll.employee?.employeeId || payrollDisplayId(payroll)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-900">{monthName(payroll.month)} {payroll.year}</span>
                          {payroll.salarySnapshot?.isProrated ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-600/15">
                              Prorated
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm font-semibold text-gray-700">{money(payroll.grossSalary, payroll.currency)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-rose-600">{money(payroll.totalDeductions, payroll.currency)}</td>
                      <td className="px-4 py-3 text-sm font-black text-emerald-700">{money(payroll.netPayable, payroll.currency)}</td>
                      <td className="px-4 py-3">{formatPayoutTarget(payroll)}</td>
                      <td className="px-4 py-3">
                        {isReversed ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-600/15">
                            Reversed
                          </span>
                        ) : (
                          <StatusBadge status={payroll.status} />
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenPayslip?.(payroll)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                            title="View / Print Payslip"
                          >
                            <HugeiconsIcon icon={PrinterIcon} size={14} />
                            Payslip
                          </button>

                          <button
                            type="button"
                            disabled={downloadingSingleId === payroll._id}
                            onClick={() => handleSinglePdf(payroll)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-gray-100 px-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
                            title="Download PDF"
                          >
                            <HugeiconsIcon
                              icon={downloadingSingleId === payroll._id ? RefreshIcon : Download01Icon}
                              size={14}
                              className={downloadingSingleId === payroll._id ? "animate-spin" : ""}
                            />
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center">
                    <HugeiconsIcon icon={File02Icon} size={30} className="mx-auto text-gray-300" />
                    <p className="mt-3 text-sm font-extrabold text-gray-900">No payslips found</p>
                    <p className="mt-1 text-xs text-gray-500">Adjust the filters above or run payroll calculation.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={exportModalOpen}
        title="Export Payroll Data"
        subtitle={`${monthName(month)} ${year} · Payslips & Disbursement`}
        icon={<HugeiconsIcon icon={Download01Icon} size={20} />}
        onClose={() => !exporting && setExportModalOpen(false)}
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={`${btn} ${btnGhost}`}
              disabled={Boolean(exporting)}
              onClick={() => setExportModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="payslip-export-form"
              className={`${btn} ${btnPrimary}`}
              disabled={Boolean(exporting)}
            >
              <HugeiconsIcon icon={exporting ? RefreshIcon : Download01Icon} size={16} className={exporting ? "animate-spin" : ""} />
              {exporting ? "Exporting..." : `Download ${exportSelection.format.toUpperCase()}`}
            </button>
          </div>
        }
      >
        <form id="payslip-export-form" onSubmit={handleExportFromModal} className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">Export period</p>
                <p className="mt-1 text-sm font-black text-gray-900">{monthName(month)} {year}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-gray-600 ring-1 ring-gray-200">
                {stats.totalRecords} record{stats.totalRecords === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field title="Export Type">
              <select
                className={input}
                value={exportSelection.type}
                onChange={(event) => setExportSelection((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="register">Payroll Register</option>
                <option value="bank">Bank Disbursement Advice</option>
                <option value="mfs">MFS Disbursement Advice</option>
              </select>
            </Field>

            <Field title="File Format">
              <select
                className={input}
                value={exportSelection.format}
                onChange={(event) => setExportSelection((prev) => ({ ...prev, format: event.target.value }))}
              >
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </Field>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
            <p className="text-sm font-extrabold text-indigo-950">
              {exportSelection.type === "register"
                ? "Payroll Register"
                : exportSelection.type === "bank"
                ? "Bank Disbursement Advice"
                : "MFS Disbursement Advice"}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-indigo-700">
              {exportSelection.type === "register"
                ? "Exports the payroll register for the selected period and current department filter."
                : exportSelection.type === "bank"
                ? "Exports authorized bank payout instructions for employees using bank transfer."
                : "Exports authorized mobile-financial-service payout instructions for MFS employees."}
            </p>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function PeriodsTab({ periods, year, setYear, loading, onToggleLock }) {
  const currentYear = new Date().getFullYear()
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3]

  const totalLocked = periods.filter((p) => p.status === "locked").length
  const totalPaid = periods.filter((p) => p.status === "paid").length
  const totalEmployees = periods.reduce((sum, p) => sum + (p.totalEmployees || 0), 0)
  const totalNet = periods.reduce((sum, p) => sum + (p.totalNet || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <HugeiconsIcon icon={SquareLock01Icon} size={20} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Payroll Periods & Locking</h2>
            <p className="text-xs font-semibold text-gray-500">
              Manage period closing cycles to prevent tampering with historical payrolls and attendance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-gray-500">Year:</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-extrabold text-gray-800 outline-none focus:border-indigo-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Locked Periods" value={`${totalLocked} / 12`} tone={totalLocked > 0 ? "amber" : "gray"} />
        <MiniStat label="Paid Periods" value={`${totalPaid} / 12`} tone="emerald" />
        <MiniStat label="Total Processed Employees" value={totalEmployees} tone="indigo" />
        <MiniStat label="Total Disbursed (Year)" value={money(totalNet)} tone="emerald" />
      </div>

      <div className={`${tableCard} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Month</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Status</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Employees</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Gross</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Net Disbursed</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Lock Information</th>
                <th className="border-b border-gray-200 px-5 py-3 text-right text-xs font-black uppercase tracking-wider text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <HugeiconsIcon icon={RefreshIcon} size={24} className="mx-auto animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : periods.length ? (
                periods.map((item) => {
                  const isLocked = item.status === "locked"
                  return (
                    <tr key={`${item.year}-${item.month}`} className="hover:bg-gray-50/60">
                      <td className="px-5 py-4 font-black text-gray-900">
                        {monthName(item.month)} {item.year}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${
                            isLocked
                              ? "bg-amber-50 text-amber-800 ring-amber-600/20"
                              : item.status === "paid"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                              : item.status === "approved"
                              ? "bg-blue-50 text-blue-700 ring-blue-600/20"
                              : "bg-gray-50 text-gray-700 ring-gray-600/20"
                          }`}
                        >
                          {isLocked ? <HugeiconsIcon icon={SquareLock01Icon} size={12} /> : null}
                          {pretty(item.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-extrabold text-gray-800">{item.totalEmployees || 0}</td>
                      <td className="px-5 py-4 text-sm font-extrabold text-gray-800">{money(item.totalGross || 0)}</td>
                      <td className="px-5 py-4 text-sm font-extrabold text-emerald-700">{money(item.totalNet || 0)}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-gray-500">
                        {isLocked ? (
                          <div>
                            <p className="font-extrabold text-amber-900">By {item.lockedBy?.name || "Admin"}</p>
                            <p className="text-gray-400">{formatDate(item.lockedAt)}</p>
                            {item.lockReason ? <p className="italic text-gray-600 truncate max-w-[200px]">"{item.lockReason}"</p> : null}
                          </div>
                        ) : item.unlockedAt ? (
                          <div>
                            <p className="text-gray-400">Unlocked on {formatDate(item.unlockedAt)}</p>
                            {item.unlockReason ? <p className="italic text-gray-500 truncate max-w-[200px]">"{item.unlockReason}"</p> : null}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => onToggleLock(item)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                            isLocked
                              ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {isLocked ? <HugeiconsIcon icon={SquareUnlock01Icon} size={14} /> : <HugeiconsIcon icon={SquareLock01Icon} size={14} />}
                          {isLocked ? "Unlock" : "Lock"}
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm font-bold text-gray-400">
                    No periods generated yet for {year}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AuditTab({ logs, loading, page, totalPages, actionFilter, setActionFilter, onPageChange }) {
  const actions = [
    { value: "", label: "All Audit Actions" },
    { value: "calculated", label: "Calculated" },
    { value: "recalculated", label: "Recalculated" },
    { value: "approved", label: "Approved" },
    { value: "paid", label: "Paid" },
    { value: "reversal_executed", label: "Reversal Executed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "period_locked", label: "Period Locked" },
    { value: "period_unlocked", label: "Period Unlocked" },
    { value: "salary_profile_created", label: "Profile Created" },
    { value: "salary_profile_revised", label: "Profile Revised" },
  ]

  const actionStyle = (act) => {
    switch (act) {
      case "reversal_executed":
        return "bg-rose-50 text-rose-700 ring-rose-600/20"
      case "paid":
        return "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
      case "approved":
        return "bg-blue-50 text-blue-700 ring-blue-600/20"
      case "period_locked":
        return "bg-amber-50 text-amber-800 ring-amber-600/20"
      case "period_unlocked":
        return "bg-purple-50 text-purple-700 ring-purple-600/20"
      case "salary_profile_revised":
        return "bg-teal-50 text-teal-700 ring-teal-600/20"
      default:
        return "bg-gray-50 text-gray-700 ring-gray-600/20"
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <HugeiconsIcon icon={Shield01Icon} size={20} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Payroll Audit Trail</h2>
            <p className="text-xs font-semibold text-gray-500">
              Immutable historical event log tracking calculations, approvals, payouts, reversals, and lock events.
            </p>
          </div>
        </div>
        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs font-extrabold text-gray-800 outline-none focus:border-indigo-500"
          >
            {actions.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`${tableCard} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Timestamp</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Action</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">User</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Entity</th>
                <th className="border-b border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-gray-600">Details / Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <HugeiconsIcon icon={RefreshIcon} size={24} className="mx-auto animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : logs.length ? (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4 text-xs font-bold text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${actionStyle(log.action)}`}>
                        {pretty(log.action)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-extrabold text-gray-900">{log.user?.name || "System"}</p>
                      <p className="text-xs font-semibold text-gray-400">{log.user?.email || ""}</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-gray-700">
                      <span className="font-extrabold uppercase text-indigo-600">{pretty(log.targetType || "payroll")}</span>
                      {log.periodMonth && log.periodYear ? (
                        <p className="text-gray-500">{monthName(log.periodMonth)} {log.periodYear}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-gray-700 max-w-[340px]">
                      {log.reason ? (
                        <p className="font-bold text-gray-900 mb-0.5">"{log.reason}"</p>
                      ) : null}
                      {log.details ? (
                        <p className="text-gray-500 truncate">
                          {typeof log.details === "string" ? log.details : JSON.stringify(log.details)}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm font-bold text-gray-400">
                    No audit logs recorded for this action
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${btn} ${btnGhost} h-8 px-3 text-xs`}
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={`${btn} ${btnGhost} h-8 px-3 text-xs`}
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
