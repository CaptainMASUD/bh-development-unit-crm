"use client"

import { useEffect, useMemo, useRef, useState, useLayoutEffect, useId, useCallback } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiUsers,
  FiSearch,
  FiX,
  FiFilter,
  FiChevronDown,
  FiRefreshCcw,
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiCalendar,
} from "react-icons/fi"
import { Loader2 } from "lucide-react"

/**
 * ✅ UPDATE (Customer header)
 * - Customer header badges now show SHORT FORM + number:
 *   P, IP, D, OD, T
 * - Each badge has a tooltip (title) so user understands:
 *   "Pending", "In Progress", "Done", "Overdue", "Total"
 * - Adds a tiny legend line under customer email (still clean) so user understands quickly.
 * - Keeps task row: dot + colored "Task" badge + title
 *
 * API:
 * GET /api/workload/employees
 * Query:
 * - employeeId (optional)
 * - taskStatus = all | pending | in_progress | done
 * - includeEmptyCustomers = true|false
 * - windowDays (optional)  -> empty => ALL
 * - completedFrom (optional ISO)
 * - completedTo (optional ISO)
 */

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const ENDPOINTS = {
  LIST_EMPLOYEE_WORKLOAD: `${API_BASE}/workload/employees`,
}

/* =========================
   STYLES
========================= */
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]"
const subtleHover = "transition-colors hover:bg-gray-50/60"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"
const btnPrimary =
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.65)]"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/* =========================
   TOAST
========================= */
function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-emerald-50 border-emerald-200 text-emerald-700"
  const Icon = type === "error" ? FiAlertCircle : FiCheck

  return (
    <div className="fixed top-4 right-4 z-[80] max-w-sm w-[92vw] sm:w-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={cn("rounded-2xl border p-3 shadow-lg", styles)}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5" />
          <p className="text-sm font-semibold flex-1">{message}</p>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 focus:outline-none"
            aria-label="Close toast"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* =========================
   MODAL SHELL
========================= */
function ModalShell({ open, onClose, title, icon, children, footer, maxWidthClass = "max-w-3xl" }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={cn(
              "relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]",
              maxWidthClass
            )}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  {icon}
                </div>
                <h2 className="text-base font-extrabold text-gray-900">{title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition focus:outline-none"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-5 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">{children}</div>

            {footer ? <div className="p-5 border-t border-gray-100 bg-white sticky bottom-0">{footer}</div> : null}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/* =========================
   MULTISELECT
========================= */
function MultiSelectDropdown({ options = [], value = [], onChange, placeholder = "Select..." }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const reactId = useId()
  const menuId = `msd-menu-${reactId}`

  const selectedSet = useMemo(() => new Set((value || []).map(String)), [value])
  const selectedCount = selectedSet.size

  const toggle = (id) => {
    const sid = String(id)
    const next = new Set(selectedSet)
    if (next.has(sid)) next.delete(sid)
    else next.add(sid)
    onChange?.(Array.from(next))
  }

  const selectedLabels = useMemo(() => {
    if (!options.length) return ""
    const map = new Map(options.map((o) => [String(o.value), o.label]))
    return Array.from(selectedSet)
      .map((id) => map.get(String(id)))
      .filter(Boolean)
      .join(", ")
  }, [options, selectedSet])

  const [menuPos, setMenuPos] = useState({
    left: 0,
    width: 0,
    openUp: false,
    top: 0,
    bottom: 0,
    maxHeight: 260,
  })

  const recomputeMenuPos = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const GAP = 8
    const MAX = 420
    const MIN = 180
    const spaceBelow = window.innerHeight - r.bottom - GAP
    const spaceAbove = r.top - GAP
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow
    const available = Math.max(0, openUp ? spaceAbove : spaceBelow)
    const capped = Math.min(MAX, available)
    const maxHeight = Math.max(MIN, capped)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - r.width))

    setMenuPos({
      left,
      width: r.width,
      openUp,
      top: r.bottom + GAP,
      bottom: window.innerHeight - r.top + GAP,
      maxHeight,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    recomputeMenuPos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCount, options.length])

  useEffect(() => {
    if (!open) return
    const onResize = () => recomputeMenuPos()
    const onScroll = () => recomputeMenuPos()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onScroll, true)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onScroll, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const onDoc = (e) => {
      if (!open) return
      const btnEl = btnRef.current
      const menuEl = document.getElementById(menuId)
      if (btnEl?.contains(e.target)) return
      if (menuEl?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open, menuId])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const menu = (
    <AnimatePresence>
      {open ? (
        <motion.div
          id={menuId}
          initial={{ opacity: 0, y: menuPos.openUp ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: menuPos.openUp ? -6 : 6 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          style={{
            position: "fixed",
            left: menuPos.left,
            width: menuPos.width,
            top: menuPos.openUp ? undefined : menuPos.top,
            bottom: menuPos.openUp ? menuPos.bottom : undefined,
          }}
          className="z-[9999] rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
          role="listbox"
          aria-multiselectable="true"
        >
          <div className="overflow-y-auto p-2" style={{ maxHeight: menuPos.maxHeight }}>
            {options.length === 0 ? (
              <div className="p-3 text-sm text-gray-600">No options.</div>
            ) : (
              <ul className="space-y-1">
                {options.map((o) => {
                  const checked = selectedSet.has(String(o.value))
                  return (
                    <li key={String(o.value)}>
                      <button
                        type="button"
                        onClick={() => toggle(o.value)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition text-left focus:outline-none",
                          checked ? "bg-indigo-50 border-indigo-200" : "bg-white border-transparent hover:bg-gray-50"
                        )}
                      >
                        <span className="text-sm font-semibold text-gray-800">{o.label}</span>
                        <span
                          className={cn(
                            "w-6 h-6 rounded-lg border flex items-center justify-center",
                            checked ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-transparent"
                          )}
                          aria-hidden="true"
                        >
                          <FiCheck className="w-4 h-4" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 bg-white flex items-center justify-between">
            <button
              type="button"
              className={cn(btn, btnGhost, "px-3 py-2 text-sm disabled:opacity-60")}
              onClick={() => onChange?.([])}
              disabled={!selectedCount}
            >
              Clear
            </button>
            <button type="button" className={cn(btn, btnPrimary, "px-3 py-2 text-sm")} onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(input, "text-left flex items-center justify-between gap-3 focus:outline-none")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("min-w-0 truncate", selectedCount ? "text-gray-900" : "text-gray-500")}>
          {selectedCount ? selectedLabels : placeholder}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {selectedCount ? (
            <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>{selectedCount}</span>
          ) : null}
          <FiChevronDown className={cn("w-4 h-4 text-gray-500 transition", open ? "rotate-180" : "")} />
        </span>
      </button>
      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  )
}

/* =========================
   UTIL
========================= */
function formatDateTime(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function statusPill(status) {
  const s = String(status || "pending")
  if (s === "done") return "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
  if (s === "in_progress") return "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
  if (s === "pending") return "bg-amber-50 text-amber-800 ring-amber-600/10"
  return "bg-gray-100 text-gray-700 ring-gray-600/10"
}

function maxIsoDate(...values) {
  const ts = values.map((v) => (v ? new Date(v).getTime() : NaN)).filter((x) => Number.isFinite(x))
  if (!ts.length) return null
  return new Date(Math.max(...ts)).toISOString()
}

function statusDot(status) {
  const s = String(status || "pending")
  if (s === "done") return "bg-emerald-500"
  if (s === "in_progress") return "bg-indigo-500"
  if (s === "pending") return "bg-amber-500"
  return "bg-gray-400"
}

// datetime-local => ISO
function toISOFromDatetimeLocal(v) {
  if (!v) return ""
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString()
}

/* =========================
   SHORT BADGE (Customer header)
========================= */
function ShortCountBadge({ code, value, title, className }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-extrabold ring-1 select-none",
        className
      )}
    >
      <span className="opacity-80">{code}</span>
      <span className="text-gray-900">{Number(value || 0)}</span>
    </span>
  )
}

/* =========================
   FILTER MODAL
========================= */
function FiltersModal({
  open,
  onClose,

  taskStatus,
  setTaskStatus,
  includeEmptyCustomers,
  setIncludeEmptyCustomers,

  windowDays,
  setWindowDays,

  completedFrom,
  setCompletedFrom,
  completedTo,
  setCompletedTo,

  selectedEmployeeIds,
  setSelectedEmployeeIds,
  employeeOptions,

  onClear,
  onApply,
}) {
  const activeCount =
    (selectedEmployeeIds?.length || 0) +
    (taskStatus !== "all" ? 1 : 0) +
    (includeEmptyCustomers === false ? 1 : 0) +
    (String(windowDays || "").trim() ? 1 : 0) +
    (String(completedFrom || "").trim() ? 1 : 0) +
    (String(completedTo || "").trim() ? 1 : 0)

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      icon={<FiFilter className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClear}
            disabled={!activeCount}
            className={cn(btn, btnGhost, "px-3 py-2 text-sm disabled:opacity-60")}
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={cn(btn, btnGhost)}>
              Cancel
            </button>
            <button onClick={onApply} className={cn(btn, btnPrimary)}>
              Apply
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 space-y-4">
          <Field label="Employees">
            <MultiSelectDropdown
              options={employeeOptions}
              value={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
              placeholder="All employees"
            />
          </Field>

          <Field label="Task status">
            <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} className={input}>
              <option value="all">all</option>
              <option value="pending">pending</option>
              <option value="in_progress">in_progress</option>
              <option value="done">done</option>
            </select>
          </Field>

          <Field label="Window days (optional)">
            <input
              type="number"
              min={1}
              max={3650}
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
              className={input}
              placeholder="Leave empty for ALL"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Completed from">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="datetime-local"
                  value={completedFrom}
                  onChange={(e) => setCompletedFrom(e.target.value)}
                  className={cn(input, "pl-9")}
                />
              </div>
            </Field>

            <Field label="Completed to">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="datetime-local"
                  value={completedTo}
                  onChange={(e) => setCompletedTo(e.target.value)}
                  className={cn(input, "pl-9")}
                />
              </div>
            </Field>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold text-gray-900">Include empty customers</p>
              <button
                type="button"
                onClick={() => setIncludeEmptyCustomers((v) => !v)}
                className={cn(
                  "h-10 px-4 rounded-xl border text-sm font-extrabold transition",
                  includeEmptyCustomers
                    ? "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                    : "bg-indigo-600 text-white border-indigo-600"
                )}
              >
                {includeEmptyCustomers ? "true" : "false"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={cn(chip, "bg-white text-gray-800 ring-gray-200")}>
                Task status: <span className="font-extrabold">{taskStatus}</span>
              </span>
              <span className={cn(chip, "bg-white text-gray-800 ring-gray-200")}>
                Window days: <span className="font-extrabold">{String(windowDays || "ALL")}</span>
              </span>
              <span className={cn(chip, "bg-white text-gray-800 ring-gray-200")}>
                Include empty: <span className="font-extrabold">{String(includeEmptyCustomers)}</span>
              </span>
              {(selectedEmployeeIds?.length || 0) ? (
                <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                  Employees selected: <span className="font-extrabold">{selectedEmployeeIds.length}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   API
========================= */
async function fetchEmployeeWorkload({
  employeeId,
  taskStatus = "all",
  includeEmptyCustomers = true,
  windowDays, // optional
  completedFrom, // datetime-local
  completedTo, // datetime-local
  signal,
}) {
  const qs = new URLSearchParams()
  qs.set("taskStatus", String(taskStatus || "all"))
  qs.set("includeEmptyCustomers", includeEmptyCustomers ? "true" : "false")

  const wd = String(windowDays || "").trim()
  if (wd) qs.set("windowDays", wd)

  if (employeeId) qs.set("employeeId", String(employeeId))

  if (completedFrom) {
    const iso = toISOFromDatetimeLocal(completedFrom)
    if (iso) qs.set("completedFrom", iso)
  }
  if (completedTo) {
    const iso = toISOFromDatetimeLocal(completedTo)
    if (iso) qs.set("completedTo", iso)
  }

  const res = await fetch(`${ENDPOINTS.LIST_EMPLOYEE_WORKLOAD}?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load employee report")
  return { employees: Array.isArray(data?.employees) ? data.employees : [] }
}

/* =========================
   MAIN
========================= */
export default function EmployeeWorkloadReportPage() {
  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = useCallback((type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }, [])
  const closeToast = () => setToast({ open: false, type: "success", message: "" })

  // search
  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 240)
    return () => clearTimeout(t)
  }, [searchTerm])

  // applied filters (default ALL)
  const [taskStatus, setTaskStatus] = useState("all")
  const [includeEmptyCustomers, setIncludeEmptyCustomers] = useState(true)
  const [windowDays, setWindowDays] = useState("") // empty => ALL
  const [completedFrom, setCompletedFrom] = useState("")
  const [completedTo, setCompletedTo] = useState("")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])

  // modal draft
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dTaskStatus, setDTaskStatus] = useState("all")
  const [dIncludeEmpty, setDIncludeEmpty] = useState(true)
  const [dWindowDays, setDWindowDays] = useState("")
  const [dFrom, setDFrom] = useState("")
  const [dTo, setDTo] = useState("")
  const [dEmpIds, setDEmpIds] = useState([])

  const openFilters = () => {
    setDTaskStatus(taskStatus)
    setDIncludeEmpty(includeEmptyCustomers)
    setDWindowDays(String(windowDays || ""))
    setDFrom(String(completedFrom || ""))
    setDTo(String(completedTo || ""))
    setDEmpIds(Array.isArray(selectedEmployeeIds) ? selectedEmployeeIds.slice() : [])
    setFiltersOpen(true)
  }

  const clearDraft = () => {
    setDTaskStatus("all")
    setDIncludeEmpty(true)
    setDWindowDays("")
    setDFrom("")
    setDTo("")
    setDEmpIds([])
  }

  const applyDraft = () => {
    setTaskStatus(dTaskStatus)
    setIncludeEmptyCustomers(!!dIncludeEmpty)
    setWindowDays(String(dWindowDays || ""))
    setCompletedFrom(String(dFrom || ""))
    setCompletedTo(String(dTo || ""))
    setSelectedEmployeeIds(Array.isArray(dEmpIds) ? dEmpIds.slice() : [])
    setFiltersOpen(false)
  }

  const clearApplied = () => {
    setTaskStatus("all")
    setIncludeEmptyCustomers(true)
    setWindowDays("")
    setCompletedFrom("")
    setCompletedTo("")
    setSelectedEmployeeIds([])
  }

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (taskStatus !== "all") n += 1
    if (includeEmptyCustomers === false) n += 1
    if (String(windowDays || "").trim()) n += 1
    if (completedFrom) n += 1
    if (completedTo) n += 1
    if ((selectedEmployeeIds?.length || 0) > 0) n += 1
    return n
  }, [taskStatus, includeEmptyCustomers, windowDays, completedFrom, completedTo, selectedEmployeeIds])

  // data
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const abortRef = useRef(null)

  // expand
  const [openEmployeeIds, setOpenEmployeeIds] = useState(() => new Set())
  const [openCustomerKeys, setOpenCustomerKeys] = useState(() => new Set())

  const toggleEmployee = (empId) => {
    const id = String(empId)
    setOpenEmployeeIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCustomer = (empId, customerId) => {
    const key = `${String(empId)}:${String(customerId)}`
    setOpenCustomerKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const load = async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError("")
    try {
      const backendEmployeeId = selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : null

      const result = await fetchEmployeeWorkload({
        employeeId: backendEmployeeId,
        taskStatus,
        includeEmptyCustomers,
        windowDays,
        completedFrom: completedFrom || "",
        completedTo: completedTo || "",
        signal: controller.signal,
      })

      setRows(result.employees || [])
      setOpenEmployeeIds(new Set())
      setOpenCustomerKeys(new Set())
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load employee report.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskStatus, includeEmptyCustomers, windowDays, completedFrom, completedTo, JSON.stringify(selectedEmployeeIds)])

  const refreshAll = async () => {
    await load()
    showToast("success", "Refreshed.")
  }

  const employeeOptions = useMemo(() => {
    const list = (rows || [])
      .map((r) => r?.employee)
      .filter(Boolean)
      .map((e) => ({
        value: String(e._id),
        label: `${e.name || "—"}${e.email ? ` (${e.email})` : ""}`,
      }))
    const seen = new Set()
    const out = []
    for (const o of list) {
      if (seen.has(o.value)) continue
      seen.add(o.value)
      out.push(o)
    }
    return out
  }, [rows])

  const filteredRows = useMemo(() => {
    let list = Array.isArray(rows) ? rows.slice() : []

    if (selectedEmployeeIds.length > 1) {
      const set = new Set(selectedEmployeeIds.map(String))
      list = list.filter((r) => set.has(String(r?.employee?._id)))
    }

    if (debounced) {
      list = list.filter((r) => {
        const e = r?.employee || {}
        const hay = `${e.name || ""} ${e.email || ""}`.toLowerCase()
        return hay.includes(debounced)
      })
    }

    return list
  }, [rows, selectedEmployeeIds, debounced])

  const computedSummary = useMemo(() => {
    const employeesCount = filteredRows.length
    let pending = 0
    let in_progress = 0
    let done = 0
    let overdue = 0

    for (const r of filteredRows) {
      const t = r?.totals || {}
      pending += Number(t.pending || 0)
      in_progress += Number(t.in_progress || 0)
      done += Number(t.done || 0)
      overdue += Number(t.overdue || 0)
    }

    return { employeesCount, pending, in_progress, done, overdue }
  }, [filteredRows])

  const appliedChips = useMemo(() => {
    const chips = []
    if (taskStatus !== "all") chips.push({ key: "status", label: taskStatus, onRemove: () => setTaskStatus("all") })
    if (includeEmptyCustomers === false)
      chips.push({ key: "empty", label: "empty=false", onRemove: () => setIncludeEmptyCustomers(true) })
    if (String(windowDays || "").trim())
      chips.push({ key: "window", label: `window=${windowDays}`, onRemove: () => setWindowDays("") })
    if (completedFrom) chips.push({ key: "from", label: "completedFrom", onRemove: () => setCompletedFrom("") })
    if (completedTo) chips.push({ key: "to", label: "completedTo", onRemove: () => setCompletedTo("") })
    if ((selectedEmployeeIds?.length || 0) > 0)
      chips.push({
        key: "emp",
        label: `employees=${selectedEmployeeIds.length}`,
        onRemove: () => setSelectedEmployeeIds([]),
      })
    return chips
  }, [taskStatus, includeEmptyCustomers, windowDays, completedFrom, completedTo, selectedEmployeeIds])

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <AnimatePresence>
        <Toast open={toast.open} type={toast.type} message={toast.message} onClose={closeToast} />
      </AnimatePresence>

      <AnimatePresence>
        {filtersOpen ? (
          <FiltersModal
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            taskStatus={dTaskStatus}
            setTaskStatus={setDTaskStatus}
            includeEmptyCustomers={dIncludeEmpty}
            setIncludeEmptyCustomers={setDIncludeEmpty}
            windowDays={dWindowDays}
            setWindowDays={setDWindowDays}
            completedFrom={dFrom}
            setCompletedFrom={setDFrom}
            completedTo={dTo}
            setCompletedTo={setDTo}
            selectedEmployeeIds={dEmpIds}
            setSelectedEmployeeIds={setDEmpIds}
            employeeOptions={employeeOptions}
            onClear={clearDraft}
            onApply={applyDraft}
          />
        ) : null}
      </AnimatePresence>

      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={cn(card, "p-6")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                  <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                    <FiUsers className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Employee Workload</h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={refreshAll} className={cn(btn, btnGhost)} title="Refresh" disabled={isLoading}>
                  <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                  Refresh
                </button>

                <button onClick={openFilters} className={cn(btn, btnPrimary)} title="Filters">
                  <FiFilter className="w-4 h-4" />
                  Filters
                  {activeFilterCount ? (
                    <span className="ml-1 inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-white/15 text-white text-xs font-extrabold">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            {/* SEARCH + CHIPS */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="w-full lg:w-1/2">
                <div
                  className={cn(
                    "w-full h-12 rounded-2xl border border-gray-200 bg-white",
                    "px-3 flex items-center gap-2",
                    "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent"
                  )}
                >
                  <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />

                  <div
                    className={cn(
                      "flex-1 min-w-0 flex items-center gap-2",
                      "overflow-x-auto",
                      "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    )}
                    onClick={() => document.getElementById("employee-report-search")?.focus?.()}
                  >
                    {appliedChips.map((c) => (
                      <span
                        key={c.key}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-2",
                          "px-2.5 py-1 rounded-full border",
                          "bg-indigo-50 border-indigo-100 text-indigo-700",
                          "text-xs font-extrabold"
                        )}
                      >
                        <span className="truncate max-w-[140px]">{c.label}</span>
                        <button
                          type="button"
                          className="p-0.5 rounded-full hover:bg-indigo-100/80 focus:outline-none"
                          aria-label="Remove filter"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            c.onRemove?.()
                          }}
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}

                    <input
                      id="employee-report-search"
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search employee…"
                      className={cn(
                        "flex-1 min-w-[10rem] bg-transparent",
                        "text-sm text-gray-900 placeholder:text-gray-400",
                        "border-0 outline-none ring-0 shadow-none",
                        "focus:outline-none focus:ring-0 focus:shadow-none focus:border-0",
                        "appearance-none"
                      )}
                    />
                  </div>

                  {activeFilterCount ? (
                    <button
                      type="button"
                      onClick={clearApplied}
                      className={cn(
                        "shrink-0 h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                        "flex items-center justify-center focus:outline-none"
                      )}
                      aria-label="Clear filters"
                      title="Clear filters"
                    >
                      <FiX className="w-4 h-4 text-gray-700" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* HEADER SUMMARY: FULL FORM */}
              <div className="w-full lg:w-auto">
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className={cn(chip, "bg-amber-50 text-amber-800 ring-amber-600/10")}>
                      Pending <b>{computedSummary.pending}</b>
                    </span>
                    <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                      In Progress <b>{computedSummary.in_progress}</b>
                    </span>
                    <span className={cn(chip, "bg-emerald-50 text-emerald-700 ring-emerald-600/10")}>
                      Done <b>{computedSummary.done}</b>
                    </span>
                    <span className={cn(chip, "bg-rose-50 text-rose-700 ring-rose-600/10")}>
                      Overdue <b>{computedSummary.overdue}</b>
                    </span>
                    <span className={cn(chip, "bg-gray-50 text-gray-800 ring-gray-200")}>
                      Employees <b>{computedSummary.employeesCount}</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 mt-0.5" />
                <span className="text-sm font-semibold">{error}</span>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* LIST */}
      <div className={cn(card, "overflow-hidden")}>
        <div className="max-h-[72vh] overflow-y-auto">
          <div className="divide-y divide-gray-100">
            <AnimatePresence>
              {isLoading && filteredRows.length === 0 ? (
                <div className="p-6 space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredRows.length ? (
                filteredRows.map((row) => {
                  const emp = row?.employee || {}
                  const empId = String(emp?._id || "")
                  const isOpen = openEmployeeIds.has(empId)

                  const totals = row?.totals || {}
                  const pending = Number(totals.pending ?? 0)
                  const in_progress = Number(totals.in_progress ?? 0)
                  const done = Number(totals.done ?? 0)
                  const overdue = Number(totals.overdue ?? 0)
                  const dueSoon = Number(totals.dueSoon ?? 0)

                  const allTasks = (row?.customers || []).flatMap((c) => (c?.tasks || []).map((t) => ({ ...t })))
                  const lastActivityAt = allTasks.reduce((acc, t) => {
                    const d = maxIsoDate(acc, t?.completedAt, t?.createdAt, t?.dueAt)
                    return d || acc
                  }, null)

                  return (
                    <motion.div
                      key={empId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={cn("p-4 sm:p-5", subtleHover)}
                    >
                      {/* EMPLOYEE ROW */}
                      <button
                        type="button"
                        onClick={() => toggleEmployee(empId)}
                        className={cn(
                          "w-full text-left rounded-2xl border border-gray-100 bg-white",
                          "px-4 py-4",
                          "hover:bg-gray-50/60 transition",
                          "focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        )}
                        aria-expanded={isOpen}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-base font-extrabold text-gray-900 truncate">{emp?.name || "—"}</p>
                            <p className="text-xs text-gray-500 truncate">{emp?.email || "—"}</p>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {emp?.role ? (
                                <span className={cn(chip, "bg-gray-50 text-gray-800 ring-gray-200")}>
                                  {String(emp.role).toUpperCase()}
                                </span>
                              ) : null}
                              {emp?.isActive === false ? (
                                <span className={cn(chip, "bg-rose-50 text-rose-700 ring-rose-600/10")}>Inactive</span>
                              ) : null}
                              {lastActivityAt ? (
                                <span className={cn(chip, "bg-gray-50 text-gray-800 ring-gray-200")}>
                                  <FiClock className="w-3.5 h-3.5" />
                                  {formatDateTime(lastActivityAt)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <span className={cn(chip, "bg-amber-50 text-amber-800 ring-amber-600/10")} title="Pending">
                              P <b>{pending}</b>
                            </span>
                            <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")} title="In Progress">
                              IP <b>{in_progress}</b>
                            </span>
                            <span className={cn(chip, "bg-emerald-50 text-emerald-700 ring-emerald-600/10")} title="Done">
                              D <b>{done}</b>
                            </span>
                            <span className={cn(chip, "bg-rose-50 text-rose-700 ring-rose-600/10")} title="Overdue">
                              OD <b>{overdue}</b>
                            </span>
                            <span className={cn(chip, "bg-gray-50 text-gray-800 ring-gray-200")} title="Due Soon">
                              S <b>{dueSoon}</b>
                            </span>

                            <FiChevronDown className={cn("w-5 h-5 text-gray-500 transition", isOpen ? "rotate-180" : "")} />
                          </div>
                        </div>
                      </button>

                      {/* EMPLOYEE DROPDOWN */}
                      <AnimatePresence>
                        {isOpen ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
                              <div className="space-y-3">
                                {(row?.customers || []).length ? (
                                  (row.customers || []).map((c) => {
                                    const customerId = String(c?.customerId || "")
                                    const key = `${empId}:${customerId}`
                                    const cOpen = openCustomerKeys.has(key)

                                    const counts = c?.counts || {}
                                    const p = Number(counts.pending || 0)
                                    const ip = Number(counts.in_progress || 0)
                                    const d = Number(counts.done || 0)
                                    const od = Number(counts.overdue || 0)
                                    const ctasks = Array.isArray(c?.tasks) ? c.tasks : []
                                    const total = ctasks.length

                                    return (
                                      <div key={key} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                                        {/* CUSTOMER HEADER */}
                                        <button
                                          type="button"
                                          onClick={() => toggleCustomer(empId, customerId)}
                                          className={cn(
                                            "w-full text-left px-4 py-3",
                                            "flex items-start justify-between gap-3",
                                            "hover:bg-gray-50/60 transition focus:outline-none"
                                          )}
                                          aria-expanded={cOpen}
                                        >
                                          <div className="min-w-0">
                                            <p className="text-sm font-extrabold text-gray-900 truncate">
                                              {c?.customerName || "Customer"}
                                              {c?.companyName ? <span className="text-gray-500"> • {c.companyName}</span> : null}
                                            </p>

                                            <p className="text-xs text-gray-500 truncate">
                                              {c?.customerEmail || "—"}
                                              {c?.customerPhone ? ` • ${c.customerPhone}` : ""}
                                            </p>

                                            {/* ✅ tiny legend (small but helpful) */}
                                            <p className="mt-1 text-[11px] text-gray-400 truncate">
                                              P=Pending • IP=In Progress • D=Done • OD=Overdue • T=Total
                                            </p>
                                          </div>

                                          {/* ✅ SHORT FORM badges like your screenshot */}
                                          <div className="shrink-0 flex items-center gap-2">
                                            <ShortCountBadge
                                              code="P"
                                              value={p}
                                              title="Pending"
                                              className="bg-amber-50 text-amber-800 ring-amber-600/10"
                                            />
                                            <ShortCountBadge
                                              code="IP"
                                              value={ip}
                                              title="In Progress"
                                              className="bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                                            />
                                            <ShortCountBadge
                                              code="D"
                                              value={d}
                                              title="Done"
                                              className="bg-emerald-50 text-emerald-700 ring-emerald-600/10"
                                            />
                                            <ShortCountBadge
                                              code="OD"
                                              value={od}
                                              title="Overdue"
                                              className="bg-rose-50 text-rose-700 ring-rose-600/10"
                                            />
                                            <ShortCountBadge
                                              code="T"
                                              value={total}
                                              title="Total tasks"
                                              className="bg-gray-50 text-gray-800 ring-gray-200"
                                            />

                                            <FiChevronDown className={cn("w-4 h-4 text-gray-500 transition", cOpen ? "rotate-180" : "")} />
                                          </div>
                                        </button>

                                        {/* TASKS */}
                                        <AnimatePresence>
                                          {cOpen ? (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: "auto", opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              transition={{ duration: 0.2 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="px-4 pb-4">
                                                {ctasks.length ? (
                                                  <div className="mt-2 space-y-2">
                                                    {ctasks.map((t) => (
                                                      <div
                                                        key={String(t?._id)}
                                                        className={cn(
                                                          "rounded-2xl border border-gray-100 bg-white p-3",
                                                          "shadow-[0_10px_30px_-24px_rgba(0,0,0,0.5)]"
                                                        )}
                                                      >
                                                        <div className="flex items-start justify-between gap-3">
                                                          <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                              <span className={cn("w-2.5 h-2.5 rounded-full", statusDot(t?.status))} />
                                                              <span className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold bg-indigo-600 text-white">
                                                                Task
                                                              </span>
                                                              <p className="text-sm font-extrabold text-gray-900 truncate">
                                                                {t?.title || "Task"}
                                                              </p>
                                                            </div>

                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                              <span className={cn(chip, statusPill(t?.status))}>
                                                                {String(t?.status || "pending")}
                                                              </span>
                                                              <span className={cn(chip, "bg-gray-50 text-gray-800 ring-gray-200")}>
                                                                <FiCalendar className="w-3.5 h-3.5" />
                                                                {formatDateTime(t?.dueAt)}
                                                              </span>
                                                              {t?.completedAt ? (
                                                                <span
                                                                  className={cn(
                                                                    chip,
                                                                    "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
                                                                  )}
                                                                >
                                                                  done {formatDateTime(t.completedAt)}
                                                                </span>
                                                              ) : null}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-500 text-center">
                                                    No tasks
                                                  </div>
                                                )}
                                              </div>
                                            </motion.div>
                                          ) : null}
                                        </AnimatePresence>
                                      </div>
                                    )
                                  })
                                ) : (
                                  <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-500 text-center">
                                    No customers
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.div>
                  )
                })
              ) : (
                <div className="p-10 text-center text-gray-500">No employees found.</div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Showing <b className="text-gray-900">{filteredRows.length}</b>
          </span>
          <button onClick={refreshAll} className={cn(btn, btnPrimary, "px-4 py-2")} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
