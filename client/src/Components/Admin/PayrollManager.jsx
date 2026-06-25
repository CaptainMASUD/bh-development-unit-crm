"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiCheck,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiDollarSign,
  FiEye,
  FiFileText,
  FiFilter,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 20

const shell = "min-h-screen bg-[#f6f7fb]"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
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

const STATUSES = ["", "draft", "calculated", "approved", "paid", "cancelled"]
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
  }[status || "draft"]

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${style}`}>{pretty(status || "draft")}</span>
}

function Avatar({ employee, className = "h-11 w-11" }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200 ${className}`}>
      {employee?.avatarUrl ? <img src={employee.avatarUrl} alt={employee.name || "Employee"} className="h-full w-full object-cover" /> : <FiUser className="h-5 w-5 text-gray-500" />}
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
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">{icon}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-gray-900 sm:text-lg">{title}</h2>
                  {subtitle ? <p className="truncate text-sm font-semibold text-gray-500">{subtitle}</p> : null}
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100" type="button">
                <FiX className="h-5 w-5 text-gray-700" />
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
            <FiX />
          </button>
        </div>
      ) : (
        <div className="flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-[#f8fafc] px-3 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
          <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
            type="text"
          />
          {loading ? <FiRefreshCcw className="h-4 w-4 animate-spin text-gray-400" /> : null}
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

export default function PayrollManager() {
  const now = new Date()
  const [tab, setTab] = useState("payrolls")
  const [payrolls, setPayrolls] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [query, setQuery] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ employee: null, department: "", position: "", status: "", year: now.getFullYear(), month: now.getMonth() + 1 })
  const [filterDraft, setFilterDraft] = useState(filters)

  const [calcEmployee, setCalcEmployee] = useState(null)
  const [calcYear, setCalcYear] = useState(now.getFullYear())
  const [calcMonth, setCalcMonth] = useState(now.getMonth() + 1)
  const [manualEarnings, setManualEarnings] = useState([])
  const [manualDeductions, setManualDeductions] = useState([])
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
  const [payModal, setPayModal] = useState({ open: false, payroll: null, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })
  const [cancelModal, setCancelModal] = useState({ open: false, payroll: null, reason: "" })
  const [selectedPayrollIds, setSelectedPayrollIds] = useState([])
  const [bulkActionLoading, setBulkActionLoading] = useState("")
  const [bulkPayModal, setBulkPayModal] = useState({ open: false, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })
  const [bulkCancelModal, setBulkCancelModal] = useState({ open: false, reason: "" })

  const draftPositionOptions = useMemo(() => {
    if (!filterDraft.department) return positions
    return positions.filter((item) => String(getId(item.department)) === String(filterDraft.department))
  }, [filterDraft.department, positions])

  const bulkPositionOptions = useMemo(() => {
    if (!bulk.department) return positions
    return positions.filter((item) => String(getId(item.department)) === String(bulk.department))
  }, [bulk.department, positions])

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
      const [depRes, posRes] = await Promise.all([api("/access-control/departments"), api("/access-control/positions")])
      setDepartments(depRes.departments || [])
      setPositions(posRes.positions || [])
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

  const addManualItem = (type) => {
    if (type === "earning") setManualEarnings((prev) => [...prev, { ...emptyManualItem, name: "Bonus" }])
    else setManualDeductions((prev) => [...prev, { ...emptyManualItem, name: "Deduction" }])
  }

  const updateManualItem = (type, index, key, value) => {
    const setter = type === "earning" ? setManualEarnings : setManualDeductions
    setter((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
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
        body: JSON.stringify({ paymentMethod: payModal.paymentMethod, paymentDate: payModal.paymentDate, transactionRef: payModal.transactionRef }),
      })
      toast.success("Payroll marked as paid")
      setSelectedPayroll(data.payroll || null)
      setPayModal({ open: false, payroll: null, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })
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
    setBulkPayModal({ open: false, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })
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

  const renderManualItems = (type) => {
    const items = type === "earning" ? manualEarnings : manualDeductions
    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${type}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Field title="Name">
                <input className={input} value={item.name} onChange={(e) => updateManualItem(type, index, "name", e.target.value)} />
              </Field>
              <Field title="Type">
                <select className={input} value={item.calculationType} onChange={(e) => updateManualItem(type, index, "calculationType", e.target.value)}>
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                  <option value="per_day">Per Day</option>
                  <option value="per_hour">Per Hour</option>
                  <option value="per_minute">Per Minute</option>
                  <option value="variable">Variable</option>
                </select>
              </Field>
              <Field title="Value">
                <input className={input} type="number" min="0" value={item.value} onChange={(e) => updateManualItem(type, index, "value", e.target.value)} />
              </Field>
              <Field title="Qty">
                <input className={input} type="number" min="0" value={item.quantity} onChange={(e) => updateManualItem(type, index, "quantity", e.target.value)} />
              </Field>
              <div className="flex items-end">
                <button className={`${btn} ${btnGhost} w-full text-rose-600`} type="button" onClick={() => removeManualItem(type, index)}>
                  <FiTrash2 /> Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className={`${btn} ${btnSoft}`} onClick={() => addManualItem(type)}>
          <FiPlus /> Add {type === "earning" ? "Earning" : "Deduction"}
        </button>
      </div>
    )
  }

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 overflow-visible p-4 sm:p-5`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  <FiDollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Payroll</h1>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  ["payrolls", "Payrolls", FiFileText],
                  ["calculate", "Calculate", FiDollarSign],
                  ["bulk", "Bulk Run", FiUsers],
                ].map(([key, text, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition ${tab === key ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"}`}
                  >
                    <Icon className="h-4 w-4" /> {text}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full max-w-3xl">
              <div className="flex min-h-[44px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-[#f8fafc] px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
                <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
                {activeFilters.map((filter) => (
                  <button key={filter.key} type="button" className="inline-flex max-w-[160px] items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10 hover:bg-indigo-100" onClick={() => clearSingleFilter(filter.key)}>
                    <span className="truncate"><span className="text-indigo-500">{filter.label}:</span> {filter.value}</span>
                    <FiX className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
                <input className="min-w-[150px] flex-1 border-0 bg-transparent px-1 py-2 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search payroll" type="text" />
                <button type="button" className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-extrabold transition ${activeFilters.length ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"}`} onClick={() => { setFilterDraft(filters); setFiltersOpen(true) }}>
                  <FiFilter className="h-4 w-4" /> Filters {activeFilters.length ? <span className="rounded-full bg-white/20 px-1.5 text-xs">{activeFilters.length}</span> : null}
                </button>
                {(query || activeFilters.length) ? <button type="button" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" onClick={resetFilters}><FiX className="h-4 w-4" /></button> : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Records" value={summary.records} />
                <MiniStat label="Net Total" value={money(summary.totalNet)} tone="indigo" />
                <MiniStat label="Paid" value={money(summary.totalPaid)} tone="emerald" />
                <MiniStat label="Pending" value={summary.pending} tone="amber" />
              </div>
            </div>
          </div>
        </div>

        {tab === "payrolls" && (
          <PayrollTable
            payrolls={filteredPayrolls}
            loading={loading}
            page={page}
            totalPages={totalPages}
            loadPayrolls={loadPayrolls}
            readPayroll={readPayroll}
            approvePayroll={approvePayroll}
            setPayModal={setPayModal}
            selectedIds={selectedPayrollIds}
            selectedPayrolls={selectedPayrolls}
            toggleSelection={togglePayrollSelection}
            selectAllVisible={selectAllVisible}
            clearSelection={clearSelection}
            bulkApproveSelected={bulkApproveSelected}
            setBulkPayModal={setBulkPayModal}
            setBulkCancelModal={setBulkCancelModal}
            bulkActionLoading={bulkActionLoading}
          />
        )}

        {tab === "calculate" && (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.7fr)]">
            <div className={`${card} overflow-visible p-4 sm:p-5`}>
              <SectionHeader icon={<FiDollarSign />} title="Calculate Payroll" subtitle="Select employee and month, then preview before saving." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="md:col-span-3"><Field title="Employee"><EmployeeSearch value={calcEmployee} onSelect={setCalcEmployee} placeholder="Search employee by name, email, or ID" /></Field></div>
                <Field title="Year"><input className={input} type="number" value={calcYear} onChange={(e) => setCalcYear(e.target.value)} /></Field>
                <Field title="Month"><MonthSelect value={calcMonth} onChange={setCalcMonth} /></Field>
                <label className="flex items-end"><span className="flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3"><span className="text-sm font-extrabold text-gray-800">Force Recalculate</span><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /></span></label>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-white p-4"><h3 className="mb-3 font-extrabold text-gray-900">Manual Earnings</h3>{renderManualItems("earning")}</div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4"><h3 className="mb-3 font-extrabold text-gray-900">Manual Deductions</h3>{renderManualItems("deduction")}</div>
              </div>
              <div className="mt-5"><Field title="Payroll Note"><textarea className="min-h-[95px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" /></Field></div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button className={`${btn} ${btnGhost}`} type="button" onClick={makePreview} disabled={previewLoading}><FiEye /> {previewLoading ? "Previewing..." : "Preview Payroll"}</button>
                <button className={`${btn} ${btnPrimary}`} type="button" onClick={savePayroll} disabled={calculateLoading}><FiCheck /> {calculateLoading ? "Calculating..." : "Calculate & Save"}</button>
              </div>
            </div>
            <PayrollPreviewCard payroll={preview} />
          </section>
        )}

        {tab === "bulk" && (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
            <div className={`${card} p-4 sm:p-5`}>
              <SectionHeader icon={<FiUsers />} title="Bulk Payroll Run" subtitle="Calculate payroll for all active employees or filter by department/position." />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field title="Year"><input className={input} type="number" value={bulk.year} onChange={(e) => setBulk((p) => ({ ...p, year: e.target.value }))} /></Field>
                <Field title="Month"><MonthSelect value={bulk.month} onChange={(value) => setBulk((p) => ({ ...p, month: value }))} /></Field>
                <Field title="Department"><DepartmentSelect value={bulk.department} departments={departments} onChange={(value) => setBulk((p) => ({ ...p, department: value, position: "" }))} /></Field>
                <Field title="Position"><PositionSelect value={bulk.position} positions={bulkPositionOptions} onChange={(value) => setBulk((p) => ({ ...p, position: value }))} /></Field>
              </div>
              <div className="mt-4"><Field title="Bulk Note"><textarea className="min-h-[92px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" value={bulk.note} onChange={(e) => setBulk((p) => ({ ...p, note: e.target.value }))} /></Field></div>
              <label className="mt-4 flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"><span className="text-sm font-extrabold text-gray-900">Force Recalculate</span><input type="checkbox" checked={bulk.force} onChange={(e) => setBulk((p) => ({ ...p, force: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-indigo-600" /></label>
              <div className="mt-5 flex justify-end"><button className={`${btn} ${btnPrimary}`} type="button" onClick={runBulk} disabled={bulkLoading}><FiCheck /> {bulkLoading ? "Running..." : "Run Bulk Payroll"}</button></div>
            </div>
            <BulkResult result={bulkResult} />
          </section>
        )}
      </div>

      <FilterModal open={filtersOpen} onClose={() => setFiltersOpen(false)} filterDraft={filterDraft} setFilterDraft={setFilterDraft} apply={() => { setFilters(filterDraft); setFiltersOpen(false) }} clear={() => { const next = { employee: null, department: "", position: "", status: "", year: now.getFullYear(), month: now.getMonth() + 1 }; setFilterDraft(next); setFilters(next); setFiltersOpen(false) }} departments={departments} positions={draftPositionOptions} update={updateFilterDraft} />

      <Modal open={detailsOpen} title="Payroll Details" subtitle={selectedPayroll ? `${selectedPayroll.employee?.name || "Employee"} • ${monthName(selectedPayroll.month)} ${selectedPayroll.year}` : "Payroll"} icon={<FiFileText className="h-5 w-5" />} onClose={() => setDetailsOpen(false)} maxWidth="max-w-6xl" footer={selectedPayroll ? <DetailFooter payroll={selectedPayroll} approvePayroll={approvePayroll} setPayModal={setPayModal} setCancelModal={setCancelModal} deletePayroll={deletePayroll} /> : null}>
        {detailsLoading ? <div className="py-16 text-center text-sm font-bold text-gray-500">Loading payroll...</div> : selectedPayroll ? <PayslipView payroll={selectedPayroll} /> : <div className="py-16 text-center text-sm font-bold text-gray-500">No payroll selected</div>}
      </Modal>

      <Modal open={payModal.open} title="Mark Payroll Paid" subtitle={payModal.payroll?.employee?.name || "Payment details"} icon={<FiCreditCard className="h-5 w-5" />} onClose={() => setPayModal({ open: false, payroll: null, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" onClick={() => setPayModal({ open: false, payroll: null, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })}>Cancel</button><button className={`${btn} ${btnPrimary}`} form="payroll-pay-form" type="submit">Mark Paid</button></div>}>
        <form id="payroll-pay-form" className="space-y-4" onSubmit={payPayroll}>
          <Field title="Payment Method"><select className={input} value={payModal.paymentMethod} onChange={(e) => setPayModal((p) => ({ ...p, paymentMethod: e.target.value }))}>{PAYMENT_METHODS.map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field>
          <Field title="Payment Date"><input className={input} type="date" value={payModal.paymentDate} onChange={(e) => setPayModal((p) => ({ ...p, paymentDate: e.target.value }))} /></Field>
          <Field title="Transaction Reference"><input className={input} value={payModal.transactionRef} onChange={(e) => setPayModal((p) => ({ ...p, transactionRef: e.target.value }))} placeholder="Bank / bKash / cheque reference" /></Field>
        </form>
      </Modal>

      <Modal open={bulkPayModal.open} title="Mark Selected Paid" subtitle={`${selectedPayrolls.length} selected payroll record(s)`} icon={<FiCreditCard className="h-5 w-5" />} onClose={() => !bulkActionLoading && setBulkPayModal({ open: false, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" disabled={Boolean(bulkActionLoading)} onClick={() => setBulkPayModal({ open: false, paymentMethod: "cash", paymentDate: dateInput(), transactionRef: "" })}>Cancel</button><button className={`${btn} ${btnPrimary}`} form="payroll-bulk-pay-form" disabled={bulkActionLoading === "pay"} type="submit">{bulkActionLoading === "pay" ? "Paying..." : "Mark Selected Paid"}</button></div>}>
        <form id="payroll-bulk-pay-form" className="space-y-4" onSubmit={bulkPaySelected}>
          <Field title="Payment Method"><select className={input} value={bulkPayModal.paymentMethod} onChange={(e) => setBulkPayModal((p) => ({ ...p, paymentMethod: e.target.value }))}>{PAYMENT_METHODS.map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field>
          <Field title="Payment Date"><input className={input} type="date" value={bulkPayModal.paymentDate} onChange={(e) => setBulkPayModal((p) => ({ ...p, paymentDate: e.target.value }))} /></Field>
          <Field title="Transaction Reference"><input className={input} value={bulkPayModal.transactionRef} onChange={(e) => setBulkPayModal((p) => ({ ...p, transactionRef: e.target.value }))} placeholder="Optional shared payment note/reference" /></Field>
        </form>
      </Modal>

      <Modal open={bulkCancelModal.open} title="Cancel Selected Payrolls" subtitle={`${selectedPayrolls.length} selected payroll record(s)`} icon={<FiX className="h-5 w-5" />} onClose={() => !bulkActionLoading && setBulkCancelModal({ open: false, reason: "" })} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" disabled={Boolean(bulkActionLoading)} onClick={() => setBulkCancelModal({ open: false, reason: "" })}>Back</button><button className={`${btn} ${btnDanger}`} form="payroll-bulk-cancel-form" disabled={bulkActionLoading === "cancel"} type="submit">{bulkActionLoading === "cancel" ? "Cancelling..." : "Cancel Selected"}</button></div>}>
        <form id="payroll-bulk-cancel-form" onSubmit={bulkCancelSelected}><Field title="Reason"><textarea className="min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" value={bulkCancelModal.reason} onChange={(e) => setBulkCancelModal((p) => ({ ...p, reason: e.target.value }))} placeholder="Why are these payroll records cancelled?" /></Field></form>
      </Modal>

      <Modal open={cancelModal.open} title="Cancel Payroll" subtitle={cancelModal.payroll?.employee?.name || "Cancellation reason"} icon={<FiX className="h-5 w-5" />} onClose={() => setCancelModal({ open: false, payroll: null, reason: "" })} maxWidth="max-w-lg" footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" onClick={() => setCancelModal({ open: false, payroll: null, reason: "" })}>Back</button><button className={`${btn} ${btnDanger}`} form="payroll-cancel-form" type="submit">Cancel Payroll</button></div>}>
        <form id="payroll-cancel-form" onSubmit={cancelPayroll}><Field title="Reason"><textarea className="min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" value={cancelModal.reason} onChange={(e) => setCancelModal((p) => ({ ...p, reason: e.target.value }))} placeholder="Why is this payroll cancelled?" /></Field></form>
      </Modal>
    </div>
  )
}

function MiniStat({ label, value, tone = "gray" }) {
  const styles = {
    gray: "bg-gray-50 text-gray-900 ring-gray-100",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/10",
    rose: "bg-rose-50 text-rose-700 ring-rose-600/10",
  }
  return <div className={`rounded-2xl px-3 py-2 ring-1 ${styles[tone]}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="truncate text-lg font-black">{value}</p></div>
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

function PayrollTable({
  payrolls,
  loading,
  page,
  totalPages,
  loadPayrolls,
  readPayroll,
  approvePayroll,
  setPayModal,
  selectedIds,
  selectedPayrolls,
  toggleSelection,
  selectAllVisible,
  clearSelection,
  bulkApproveSelected,
  setBulkPayModal,
  setBulkCancelModal,
  bulkActionLoading,
}) {
  const allVisibleSelected = payrolls.length > 0 && payrolls.every((payroll) => selectedIds.includes(payroll._id))
  const eligibleSelected = selectedPayrolls.filter((payroll) => !["paid", "cancelled"].includes(payroll.status))

  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Payroll Records</h2>
          <p className="mt-1 text-sm font-semibold text-gray-500">
            View, select, approve, pay, cancel, and review payslips.
          </p>
        </div>
        <button className={`${btn} ${btnGhost}`} onClick={() => loadPayrolls(page)} type="button">
          <FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

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
              <FiCheckCircle /> {bulkActionLoading === "approve" ? "Approving..." : "Approve Selected"}
            </button>
            <button className={`${btn} ${btnPrimary}`} type="button" disabled={!eligibleSelected.length || bulkActionLoading === "pay"} onClick={() => setBulkPayModal((p) => ({ ...p, open: true }))}>
              <FiCreditCard /> Mark Paid
            </button>
            <button className={`${btn} ${btnGhost} text-rose-600`} type="button" disabled={!eligibleSelected.length || bulkActionLoading === "cancel"} onClick={() => setBulkCancelModal({ open: true, reason: "" })}>
              <FiX /> Cancel
            </button>
            <button className={`${btn} ${btnGhost}`} type="button" onClick={clearSelection}>Clear</button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="w-[58px] border-b border-gray-200 bg-gray-50 px-5 py-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!payrolls.length || loading}
                  onChange={(event) => selectAllVisible(event.target.checked, payrolls)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  title="Select all visible payrolls"
                />
              </th>
              {["Employee", "Payslip No", "Period", "Gross", "Deductions", "Net Payable", "Status", "Actions"].map((heading) => (
                <th key={heading} className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm font-bold text-gray-500">Loading payrolls...</td>
              </tr>
            ) : payrolls.length ? (
              payrolls.map((payroll) => {
                const checked = selectedIds.includes(payroll._id)
                return (
                  <tr key={payroll._id} className={`group align-top ${checked ? "bg-indigo-50/40" : ""}`}>
                    <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(payroll._id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        title="Select payroll"
                      />
                    </td>
                    <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                      <div className="flex items-center gap-3">
                        <Avatar employee={payroll.employee} />
                        <div className="min-w-0">
                          <p className="truncate text-base font-extrabold text-gray-900">{payroll.employee?.name || "Unknown employee"}</p>
                          <p className="truncate text-sm font-semibold text-gray-500">{payroll.employee?.position?.title || payroll.employee?.email || "Employee"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                      <span className="inline-flex rounded-full bg-gray-50 px-3 py-1.5 text-xs font-black text-gray-700 ring-1 ring-gray-200">
                        {payrollDisplayId(payroll)}
                      </span>
                    </td>
                    <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40">
                      <p className="text-sm font-extrabold text-gray-900">{monthName(payroll.month)} {payroll.year}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">{formatDate(payroll.periodStart)} - {formatDate(payroll.periodEnd)}</p>
                    </td>
                    <td className="border-b border-gray-100 px-5 py-4 text-sm font-extrabold text-gray-800 group-hover:bg-indigo-50/40">{money(payroll.grossSalary, payroll.currency)}</td>
                    <td className="border-b border-gray-100 px-5 py-4 text-sm font-extrabold text-rose-600 group-hover:bg-indigo-50/40">{money(payroll.totalDeductions, payroll.currency)}</td>
                    <td className="border-b border-gray-100 px-5 py-4 text-sm font-black text-emerald-700 group-hover:bg-indigo-50/40">{money(payroll.netPayable, payroll.currency)}</td>
                    <td className="border-b border-gray-100 px-5 py-4 group-hover:bg-indigo-50/40"><StatusBadge status={payroll.status} /></td>
                    <td className="border-b border-gray-100 px-5 py-4 text-right group-hover:bg-indigo-50/40">
                      <div className="flex justify-end gap-2">
                        <button className="rounded-xl p-2.5 text-indigo-600 transition hover:bg-indigo-50" onClick={() => readPayroll(payroll)} title="View"><FiEye /></button>
                        {payroll.status !== "paid" && payroll.status !== "cancelled" ? <button className="rounded-xl p-2.5 text-emerald-600 transition hover:bg-emerald-50" onClick={() => approvePayroll(payroll)} title="Approve"><FiCheckCircle /></button> : null}
                        {payroll.status !== "paid" && payroll.status !== "cancelled" ? <button className="rounded-xl p-2.5 text-amber-600 transition hover:bg-amber-50" onClick={() => setPayModal({ open: true, payroll, paymentMethod: payroll.paymentMethod || "cash", paymentDate: dateInput(), transactionRef: payroll.transactionRef || "" })} title="Pay"><FiCreditCard /></button> : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-5 py-14 text-center">
                  <FiFileText className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-3 text-sm font-extrabold text-gray-900">No payroll records found</p>
                  <p className="mt-1 text-sm font-semibold text-gray-500">Calculate payroll or adjust filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-gray-600">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button className={`${btn} ${btnGhost}`} disabled={page <= 1 || loading} onClick={() => loadPayrolls(page - 1)}><FiChevronLeft /> Previous</button>
          <button className={`${btn} ${btnGhost}`} disabled={page >= totalPages || loading} onClick={() => loadPayrolls(page + 1)}>Next <FiChevronRight /></button>
        </div>
      </div>
    </section>
  )
}

function PayrollPreviewCard({ payroll }) {
  if (!payroll) return <div className={`${card} flex min-h-[360px] items-center justify-center p-8 text-center`}><div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10"><FiEye className="h-6 w-6" /></div><h3 className="mt-4 text-lg font-extrabold text-gray-900">Preview will show here</h3><p className="mt-2 text-sm font-semibold text-gray-500">Select employee and click Preview Payroll.</p></div></div>
  const loanTotal = getLoanDeductionTotal(payroll)
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
          <MiniStat label="Deductions" value={money(payroll.totalDeductions, payroll.currency)} tone="rose" />
          <MiniStat label="Loan Deduction" value={money(loanTotal, payroll.currency)} tone={loanTotal > 0 ? "amber" : "gray"} />
          <MiniStat label="Payable Days" value={payroll.attendanceSummary?.payableDays || 0} />
        </div>
        <LoanDeductionNotice payroll={payroll} />
      </div>
    </div>
  )
}

function BulkResult({ result }) {
  return <div className={`${card} overflow-hidden`}><div className="border-b border-gray-100 p-4 sm:p-5"><h3 className="text-lg font-extrabold text-gray-900">Bulk Result</h3><p className="mt-1 text-sm font-semibold text-gray-500">Success and failed payroll results.</p></div>{result ? <div className="p-4 sm:p-5"><div className="grid grid-cols-3 gap-2"><MiniStat label="Total" value={result.total || 0} /><MiniStat label="Success" value={result.success || 0} tone="emerald" /><MiniStat label="Failed" value={result.failed || 0} tone="rose" /></div><div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">{(result.results || []).map((item, index) => <div key={`${item.employee}-${index}`} className="rounded-2xl border border-gray-100 bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-gray-900">{item.name || "Employee"}</p><p className="truncate text-xs font-semibold text-gray-500">{item.email || item.employee}</p><p className={`mt-1 text-xs font-bold ${item.success ? "text-emerald-600" : "text-rose-600"}`}>{item.message}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${item.success ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" : "bg-rose-50 text-rose-700 ring-rose-600/10"}`}>{item.success ? "Done" : "Failed"}</span></div></div>)}</div></div> : <div className="p-8 text-center"><FiUsers className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-500">Run bulk payroll to see result.</p></div>}</div>
}

function getLoanDeductions(payroll) {
  return (payroll?.deductions || []).filter((item) => item?.source === "employee_loan")
}

function getLoanDeductionTotal(payroll) {
  return getLoanDeductions(payroll).reduce((sum, item) => sum + Number(item.amount || 0), 0)
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

function FilterModal({ open, onClose, filterDraft, setFilterDraft, apply, clear, departments, positions, update }) {
  return <Modal open={open} title="Payroll Filters" subtitle="Filter by employee, department, position, month, and status." icon={<FiFilter className="h-5 w-5" />} onClose={onClose} footer={<div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost}`} type="button" onClick={clear}>Clear</button><button className={`${btn} ${btnPrimary}`} type="button" onClick={apply}>Apply Filters</button></div>}><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="md:col-span-2"><Field title="Employee"><EmployeeSearch value={filterDraft.employee} onSelect={(employee) => update("employee", employee)} /></Field></div><Field title="Year"><input className={input} type="number" value={filterDraft.year} onChange={(e) => update("year", e.target.value)} /></Field><Field title="Month"><select className={input} value={filterDraft.month} onChange={(e) => update("month", e.target.value)}><option value="">All Months</option>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></Field><Field title="Department"><DepartmentSelect value={filterDraft.department} departments={departments} onChange={(value) => update("department", value)} /></Field><Field title="Position"><PositionSelect value={filterDraft.position} positions={positions} onChange={(value) => update("position", value)} /></Field><Field title="Status"><select className={input} value={filterDraft.status} onChange={(e) => update("status", e.target.value)}>{STATUSES.map((x) => <option key={x || "all"} value={x}>{x ? pretty(x) : "All Status"}</option>)}</select></Field></div></Modal>
}

function DetailFooter({ payroll, approvePayroll, setPayModal, setCancelModal, deletePayroll }) {
  return <div className="flex flex-wrap justify-end gap-2">{payroll.status !== "paid" && payroll.status !== "cancelled" ? <button className={`${btn} ${btnSoft}`} type="button" onClick={() => approvePayroll(payroll)}><FiCheckCircle /> Approve</button> : null}{payroll.status !== "paid" && payroll.status !== "cancelled" ? <button className={`${btn} ${btnPrimary}`} type="button" onClick={() => setPayModal({ open: true, payroll, paymentMethod: payroll.paymentMethod || "cash", paymentDate: dateInput(), transactionRef: payroll.transactionRef || "" })}><FiCreditCard /> Mark Paid</button> : null}{payroll.status !== "paid" && payroll.status !== "cancelled" ? <button className={`${btn} ${btnGhost} text-rose-600`} type="button" onClick={() => setCancelModal({ open: true, payroll, reason: "" })}><FiX /> Cancel</button> : null}{!["approved", "paid"].includes(payroll.status) ? <button className={`${btn} ${btnDanger}`} type="button" onClick={() => deletePayroll(payroll)}><FiTrash2 /> Delete</button> : null}</div>
}

function PayslipView({ payroll }) {
  const employee = payroll.employee || {}
  const attendance = payroll.attendanceSummary || {}
  return <div className="bg-white"><div className="rounded-2xl border border-gray-100 bg-white p-5"><div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-indigo-600">Business Hub CRM</p><h3 className="mt-1 text-2xl font-black text-gray-900">Payslip</h3><p className="mt-1 text-sm font-bold text-gray-500">Salary slip for {monthName(payroll.month)} {payroll.year}</p></div><div className="text-left sm:text-right"><StatusBadge status={payroll.status} /><p className="mt-2 text-xs font-bold text-gray-500">Payslip No</p><p className="text-sm font-black text-gray-900">{payrollDisplayId(payroll)}</p></div></div><div className="grid grid-cols-1 gap-4 py-5 lg:grid-cols-3"><div className="lg:col-span-2"><div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100"><Avatar employee={employee} className="h-12 w-12" /><div className="min-w-0"><p className="truncate text-lg font-black text-gray-900">{employee.name || "Employee"}</p><p className="truncate text-sm font-bold text-gray-500">{employee.email || "No email"}</p><p className="truncate text-sm font-bold text-gray-500">{employee.department?.name || "No department"} • {employee.position?.title || "No position"}</p></div></div></div><div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-600/10"><p className="text-xs font-bold text-indigo-500">Net Payable</p><p className="mt-1 text-3xl font-black text-indigo-700">{money(payroll.netPayable, payroll.currency)}</p></div></div><div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-5 md:grid-cols-4"><MiniStat label="Basic" value={money(payroll.basicSalary, payroll.currency)} /><MiniStat label="Gross" value={money(payroll.grossSalary, payroll.currency)} /><MiniStat label="Deductions" value={money(payroll.totalDeductions, payroll.currency)} tone="rose" /><MiniStat label="Loan Deduction" value={money(getLoanDeductionTotal(payroll), payroll.currency)} tone={getLoanDeductionTotal(payroll) > 0 ? "amber" : "gray"} /></div><div className="mt-5"><LoanDeductionNotice payroll={payroll} /></div><div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2"><PayrollComponentTable title="Earnings" items={payroll.earnings || []} total={payroll.totalEarnings} currency={payroll.currency} /><PayrollComponentTable title="Deductions" items={payroll.deductions || []} total={payroll.totalDeductions} currency={payroll.currency} danger /></div><div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4"><h4 className="text-base font-black text-gray-900">Attendance Summary</h4><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4"><InfoLine label="Present" value={attendance.presentDays || 0} /><InfoLine label="Late" value={attendance.lateDays || 0} /><InfoLine label="Absent" value={attendance.absentDays || 0} /><InfoLine label="Half Day" value={attendance.halfDays || 0} /><InfoLine label="Paid Leave" value={attendance.paidLeaveDays || 0} /><InfoLine label="Unpaid Leave" value={attendance.unpaidLeaveDays || 0} /><InfoLine label="Payable Days" value={attendance.payableDays || 0} /><InfoLine label="Overtime Hours" value={attendance.approvedOvertimeHours || 0} /></div></div></div></div>
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
