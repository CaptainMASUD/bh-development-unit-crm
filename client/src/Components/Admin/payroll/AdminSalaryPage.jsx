"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  Add01Icon,
  ArrowDown02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp02Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  Delete02Icon,
  Dollar01Icon,
  File02Icon,
  FilterIcon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  RefreshIcon,
  Search01Icon,
  SecurityCheckIcon,
  UserIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 20

const shell = "min-h-screen bg-[#f7f8fb]"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_16px_45px_-32px_rgba(15,23,42,0.45)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const iconBtn =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
const softInput =
  "h-10 w-full border-0 bg-transparent px-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"

const salaryTypes = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
]

const componentTypes = [
  { value: "earning", label: "Earning" },
  { value: "deduction", label: "Deduction" },
]

const calcTypes = [
  { value: "fixed", label: "Fixed" },
  { value: "percentage", label: "Percentage" },
  { value: "per_day", label: "Per Day" },
  { value: "per_hour", label: "Per Hour" },
  { value: "per_minute", label: "Per Minute" },
  { value: "variable", label: "Variable" },
]

const basedOnOptions = [
  { value: "basicSalary", label: "Basic Salary" },
  { value: "grossSalary", label: "Gross Salary" },
  { value: "netSalary", label: "Net Salary" },
  { value: "manual", label: "Manual" },
]

const emptyRules = {
  overtime: {
    enabled: false,
    calculationType: "per_hour",
    value: 0,
    basedOn: "basicSalary",
  },
  lateDeduction: {
    enabled: false,
    graceMinutes: 0,
    calculationType: "fixed",
    value: 0,
    basedOn: "basicSalary",
  },
  absentDeduction: {
    enabled: true,
    calculationType: "per_day",
    value: 0,
    basedOn: "basicSalary",
  },
  unpaidLeaveDeduction: {
    enabled: true,
    calculationType: "per_day",
    value: 0,
    basedOn: "basicSalary",
  },
  weeklyHolidayPaid: true,
  paidLeaveAllowed: true,
}

const emptyComponent = {
  name: "",
  type: "earning",
  calculationType: "fixed",
  value: 0,
  basedOn: "basicSalary",
  isRecurring: true,
  isTaxable: false,
  isActive: true,
  note: "",
}

const emptyForm = {
  employee: "",
  employeeObject: null,
  salaryType: "monthly",
  currency: "BDT",
  basicSalary: "",
  workingDaysPerMonth: 26,
  workingHoursPerDay: 8,
  components: [],
  rules: emptyRules,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  isActive: true,
  note: "",
}

const defaultFilters = { active: "all", department: "", position: "" }

function HIcon({ icon, size = 18, className = "" }) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color="currentColor"
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    />
  )
}

function authHeaders(isJson = true) {
  const token = localStorage.getItem("token")
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(options.isJson !== false), ...(options.headers || {}) },
    credentials: "include",
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Request failed")
  return data
}

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function getId(value) {
  return value?._id || value || ""
}

function money(value, currency = "BDT") {
  const n = Number(value || 0)
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: currency || "BDT",
    maximumFractionDigits: 0,
  }).format(n)
}

function dateText(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function toDateInput(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

function safeRules(rules = {}) {
  return {
    overtime: { ...emptyRules.overtime, ...(rules.overtime || {}) },
    lateDeduction: { ...emptyRules.lateDeduction, ...(rules.lateDeduction || {}) },
    absentDeduction: { ...emptyRules.absentDeduction, ...(rules.absentDeduction || {}) },
    unpaidLeaveDeduction: {
      ...emptyRules.unpaidLeaveDeduction,
      ...(rules.unpaidLeaveDeduction || {}),
    },
    weeklyHolidayPaid:
      typeof rules.weeklyHolidayPaid === "boolean" ? rules.weeklyHolidayPaid : true,
    paidLeaveAllowed:
      typeof rules.paidLeaveAllowed === "boolean" ? rules.paidLeaveAllowed : true,
  }
}

function calculatePreview(profileOrForm) {
  const basicSalary = Number(profileOrForm.basicSalary || 0)
  const components = Array.isArray(profileOrForm.components) ? profileOrForm.components : []
  const active = components.filter((item) => item.isActive !== false)

  const fixedEarnings = active.reduce((sum, item) => {
    if (item.type === "earning" && item.calculationType === "fixed") return sum + Number(item.value || 0)
    return sum
  }, 0)

  const grossSalary = basicSalary + fixedEarnings

  const fixedDeductions = active.reduce((sum, item) => {
    if (item.type !== "deduction") return sum
    if (item.calculationType === "fixed") return sum + Number(item.value || 0)
    if (item.calculationType === "percentage") {
      const base = item.basedOn === "grossSalary" ? grossSalary : basicSalary
      return sum + (base * Number(item.value || 0)) / 100
    }
    return sum
  }, 0)

  return {
    basicSalary: Math.round(basicSalary * 100) / 100,
    fixedEarnings: Math.round(fixedEarnings * 100) / 100,
    grossSalary: Math.round(grossSalary * 100) / 100,
    fixedDeductions: Math.round(fixedDeductions * 100) / 100,
    netSalary: Math.round((grossSalary - fixedDeductions) * 100) / 100,
  }
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold text-gray-900">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}
    </label>
  )
}

function Modal({ open, title, subtitle, icon, children, footer, onClose, maxWidthClass = "max-w-5xl" }) {
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
    const onKey = (event) => event.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
          <div className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)] ${maxWidthClass}`}>
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  {icon}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold text-gray-900 sm:text-lg">{title}</h2>
                  {subtitle ? <p className="truncate text-sm font-semibold text-gray-500">{subtitle}</p> : null}
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100" type="button">
                <HIcon icon={Cancel01Icon} className="h-5 w-5 text-gray-700" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto bg-[#fbfcff] p-4 sm:p-5">{children}</div>
            {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmployeeAvatar({ employee, size = "h-11 w-11" }) {
  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200`}>
      {employee?.avatarUrl ? (
        <img src={employee.avatarUrl} alt={employee.name || "Employee"} className="h-full w-full object-cover" />
      ) : (
        <HIcon icon={UserIcon} className="h-5 w-5 text-gray-500" />
      )}
    </div>
  )
}

function EmployeeSearch({ value, onSelect, placeholder = "Search employee" }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDown = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setOpen(false)
      return undefined
    }

    let alive = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api(`/users/employees?q=${encodeURIComponent(q)}&limit=8&sort=newest`)
        const list = Array.isArray(data.employees) ? data.employees : []
        if (alive) {
          setResults(list)
          setOpen(true)
        }
      } catch (error) {
        if (alive) toast.error(error.message || "Employee search failed")
      } finally {
        if (alive) setLoading(false)
      }
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  const selected = value

  return (
    <div ref={boxRef} className="relative">
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.45)]">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeAvatar employee={selected} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-gray-900">{selected.name || "Unnamed"}</p>
              <p className="truncate text-xs font-bold text-gray-500">
                {selected.position?.title || selected.email || "Employee"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("")
              onSelect(null)
            }}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <HIcon icon={Cancel01Icon} />
          </button>
        </div>
      ) : (
        <div className="flex h-11 items-center gap-2 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-3 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
          <HIcon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => query.trim() && setOpen(true)}
            placeholder={placeholder}
            className={softInput}
            type="text"
          />
        </div>
      )}

      {open && !selected && query.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_26px_65px_-36px_rgba(15,23,42,0.55)]">
          {loading ? (
            <div className="px-4 py-4 text-sm font-bold text-gray-500">Searching...</div>
          ) : results.length ? (
            <div className="max-h-72 overflow-y-auto py-2">
              {results.map((employee) => (
                <button
                  key={employee._id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-indigo-50/70"
                  onClick={() => {
                    onSelect(employee)
                    setQuery("")
                    setOpen(false)
                  }}
                >
                  <EmployeeAvatar employee={employee} size="h-10 w-10" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-gray-900">{employee.name || "Unnamed"}</span>
                    <span className="block truncate text-xs font-bold text-gray-500">
                      {employee.position?.title || employee.email || employee.employeeId || "Employee"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-sm font-bold text-gray-500">No employees found.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
          : "bg-gray-100 text-gray-600 ring-gray-600/10"
      }`}
    >
      {active ? "Active" : "Inactive"}
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
      <HIcon icon={Cancel01Icon} className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
    </button>
  )
}

function SalaryHeaderSearchFilters({
  searchText,
  onSearchChange,
  activeFilterEntries,
  activeFilterCount,
  onClearFilter,
  onReset,
  onOpenFilters,
}) {
  return (
    <div
      className={`w-full transition-all duration-200 ${
        activeFilterCount
          ? "lg:min-w-[520px] lg:max-w-[72%] lg:flex-[0_1_72%]"
          : "lg:max-w-[46%] lg:flex-[0_1_46%]"
      }`}
    >
      <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <HIcon icon={Search01Icon} className="h-4 w-4 shrink-0 text-gray-400" />

        {searchText.trim() ? (
          <FilterChip label="Search" value={searchText.trim()} onClear={() => onSearchChange("")} />
        ) : null}

        {activeFilterEntries.map((filter) => (
          <FilterChip
            key={filter.key}
            label={filter.label}
            value={filter.value}
            onClear={() => onClearFilter(filter.key)}
          />
        ))}

        <input
          className="min-w-[110px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={activeFilterCount ? "Search..." : "Search salary profiles..."}
          type="text"
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-black transition ${
            activeFilterCount
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          }`}
        >
          <HIcon icon={FilterIcon} className="h-3.5 w-3.5" />
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
            onClick={onReset}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            title="Clear search and filters"
            aria-label="Clear search and filters"
          >
            <HIcon icon={Cancel01Icon} className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function RuleCard({ title, icon, value, onChange, showGrace = false, calculationOptions = [] }) {
  const enabled = Boolean(value?.enabled)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_12px_35px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
            {icon}
          </span>
          <p className="text-base font-extrabold leading-snug text-gray-900">{title}</p>
        </div>
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-extrabold text-gray-600 ring-1 ring-gray-100">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          Enabled
        </label>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${showGrace ? "md:grid-cols-3" : "md:grid-cols-[1fr_1fr_1.2fr]"}`}>
        <Field label="Calculation">
          <select
            className={input}
            value={value.calculationType || "fixed"}
            onChange={(event) => onChange({ ...value, calculationType: event.target.value })}
            disabled={!enabled}
          >
            {(calculationOptions.length ? calculationOptions : [
              { value: "fixed", label: "Fixed" },
              { value: "percentage", label: "Percentage" },
            ]).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Value">
          <input
            className={input}
            type="number"
            min="0"
            value={value.value ?? 0}
            onChange={(event) => onChange({ ...value, value: event.target.value })}
            disabled={!enabled}
          />
        </Field>
        {showGrace ? (
          <Field label="Grace Minutes">
            <input
              className={input}
              type="number"
              min="0"
              value={value.graceMinutes ?? 0}
              onChange={(event) => onChange({ ...value, graceMinutes: event.target.value })}
              disabled={!enabled}
            />
          </Field>
        ) : (
          <Field label="Based On">
            <select
              className={input}
              value={value.basedOn || "basicSalary"}
              onChange={(event) => onChange({ ...value, basedOn: event.target.value })}
              disabled={!enabled}
            >
              <option value="basicSalary">Basic Salary</option>
              <option value="grossSalary">Gross Salary</option>
              <option value="manual">Manual</option>
            </select>
          </Field>
        )}
      </div>
    </div>
  )
}


function salaryRuleItems(rules = {}) {
  const value = safeRules(rules)
  return [
    { key: "overtime", label: "Overtime", active: value.overtime.enabled, tone: "emerald" },
    { key: "late", label: "Late", active: value.lateDeduction.enabled, tone: "amber" },
    { key: "absent", label: "Absent", active: value.absentDeduction.enabled, tone: "rose" },
    { key: "leave", label: "Unpaid leave", active: value.unpaidLeaveDeduction.enabled, tone: "rose" },
  ].filter((item) => item.active)
}

function RulePill({ item }) {
  const tone =
    item.tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
      : item.tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-600/10"
        : "bg-rose-50 text-rose-700 ring-rose-600/10"

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-45" />
      {item.label}
    </span>
  )
}

function SalaryRowActionMenu({ profile, onView, onEdit, onDeactivate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const isActive = profile?.isActive !== false

  const closeMenu = useCallback(() => setOpen(false), [])

  const runAction = useCallback(
    (action) => {
      closeMenu()
      window.requestAnimationFrame(() => action?.(profile))
    },
    [closeMenu, profile]
  )

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return

      const width = 220
      const height = 138
      const gap = 8
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
      const openAbove = rect.bottom + height + gap > window.innerHeight
      const top = openAbove
        ? Math.max(12, rect.top - height - gap)
        : Math.min(window.innerHeight - height - 12, rect.bottom + gap)

      setPosition({ top, left })
    }

    updatePosition()
    const onOutside = () => closeMenu()
    const onKey = (event) => event.key === "Escape" && closeMenu()

    window.addEventListener("click", onOutside)
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)

    return () => {
      window.removeEventListener("click", onOutside)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, closeMenu])

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-700 transition hover:bg-gray-50"

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{ position: "fixed", top: position.top, left: position.left, width: 220 }}
            className="z-[9999] overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 text-left shadow-[0_22px_60px_-28px_rgba(15,23,42,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={itemClass} onClick={() => runAction(onEdit)}>
              <HIcon icon={PencilEdit02Icon} className="text-indigo-600" />
              Edit salary profile
            </button>

            {isActive ? (
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-amber-700 transition hover:bg-amber-50"
                onClick={() => runAction(onDeactivate)}
              >
                <HIcon icon={SecurityCheckIcon} />
                Deactivate profile
              </button>
            ) : (
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                onClick={() => runAction(onDelete)}
              >
                <HIcon icon={Delete02Icon} />
                Delete profile
              </button>
            )}
          </div>,
          document.body
        )
      : null

  return (
    <div className="relative flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`${btn} ${btnPrimary} h-10 px-3 py-2 shadow-sm shadow-indigo-600/20`}
        onClick={() => runAction(onView)}
      >
        <HIcon icon={ViewIcon} className="h-4 w-4" />
        View
      </button>

      <button
        ref={buttonRef}
        type="button"
        className={iconBtn}
        title="More actions"
        aria-label="More salary profile actions"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
      >
        <HIcon icon={MoreVerticalIcon} className="h-4 w-4" />
      </button>

      {menu}
    </div>
  )
}

function SalaryMobileCard({ profile, onView, onEdit, onDeactivate, onDelete }) {
  const employee = profile.employee || {}
  const preview = calculatePreview(profile)
  const rules = salaryRuleItems(profile.rules)

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <EmployeeAvatar employee={employee} />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-gray-900">{employee.name || "Unnamed employee"}</p>
            <p className="truncate text-xs font-semibold text-gray-500">{employee.email || "No email"}</p>
            <p className="mt-1 truncate text-xs font-bold text-indigo-600">
              {employee.department?.name || "No department"} · {employee.position?.title || "No position"}
            </p>
          </div>
        </div>
        <StatusBadge active={profile.isActive !== false} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Basic salary</p>
          <p className="mt-1 text-sm font-extrabold text-gray-900">{money(profile.basicSalary, profile.currency)}</p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-400">Net salary</p>
          <p className="mt-1 text-sm font-extrabold text-indigo-700">{money(preview.netSalary, profile.currency)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Schedule</p>
          <p className="mt-1 text-sm font-bold text-gray-800">
            {profile.workingDaysPerMonth || 26} days · {profile.workingHoursPerDay || 8} hrs
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-400">Effective</p>
          <p className="mt-1 text-sm font-bold text-gray-800">{dateText(profile.effectiveFrom)}</p>
        </div>
      </div>

      <div className="mt-4 flex min-h-7 flex-wrap gap-2">
        {rules.length ? rules.slice(0, 3).map((item) => <RulePill key={item.key} item={item} />) : (
          <span className="text-xs font-semibold text-gray-400">No active attendance rules</span>
        )}
        {rules.length > 3 ? (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-600">
            +{rules.length - 3}
          </span>
        ) : null}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <SalaryRowActionMenu
          profile={profile}
          onView={onView}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
          onDelete={onDelete}
        />
      </div>
    </article>
  )
}

function DetailItem({ label, value, tone = "gray" }) {
  const toneClass =
    tone === "indigo"
      ? "bg-indigo-50 text-indigo-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "rose"
          ? "bg-rose-50 text-rose-700"
          : "bg-gray-50 text-gray-800"

  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] opacity-60">{label}</p>
      <p className="mt-1.5 break-words text-base font-extrabold">{value || "—"}</p>
    </div>
  )
}

function SalaryProfileDetails({ profile }) {
  if (!profile) return null

  const employee = profile.employee || {}
  const preview = calculatePreview(profile)
  const rules = salaryRuleItems(profile.rules)
  const components = Array.isArray(profile.components) ? profile.components.filter((item) => item.isActive !== false) : []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <EmployeeAvatar employee={employee} size="h-14 w-14" />
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-gray-900">{employee.name || "Unnamed employee"}</p>
            <p className="truncate text-sm font-semibold text-gray-500">{employee.email || "No email"}</p>
            <p className="mt-1 truncate text-xs font-extrabold text-indigo-600">
              {employee.department?.name || "No department"} · {employee.position?.title || "No position"}
            </p>
          </div>
        </div>
        <StatusBadge active={profile.isActive !== false} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Basic salary" value={money(profile.basicSalary, profile.currency)} />
        <DetailItem label="Gross salary" value={money(preview.grossSalary, profile.currency)} tone="indigo" />
        <DetailItem label="Fixed deduction" value={money(preview.fixedDeductions, profile.currency)} tone="rose" />
        <DetailItem label="Net salary" value={money(preview.netSalary, profile.currency)} tone="emerald" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <HIcon icon={Calendar03Icon} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-gray-900">Profile setup</p>
              <p className="text-xs font-semibold text-gray-500">Salary schedule and effective period</p>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-3">
              <dt className="text-xs font-bold text-gray-400">Salary type</dt>
              <dd className="mt-1 text-sm font-extrabold text-gray-900">{pretty(profile.salaryType)}</dd>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <dt className="text-xs font-bold text-gray-400">Working schedule</dt>
              <dd className="mt-1 text-sm font-extrabold text-gray-900">
                {profile.workingDaysPerMonth || 26} days · {profile.workingHoursPerDay || 8} hrs/day
              </dd>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <dt className="text-xs font-bold text-gray-400">Effective from</dt>
              <dd className="mt-1 text-sm font-extrabold text-gray-900">{dateText(profile.effectiveFrom)}</dd>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <dt className="text-xs font-bold text-gray-400">Effective to</dt>
              <dd className="mt-1 text-sm font-extrabold text-gray-900">
                {profile.effectiveTo ? dateText(profile.effectiveTo) : "Current"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <HIcon icon={SecurityCheckIcon} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-gray-900">Attendance rules</p>
              <p className="text-xs font-semibold text-gray-500">Rules applied during payroll calculation</p>
            </div>
          </div>
          <div className="flex min-h-12 flex-wrap content-start gap-2">
            {rules.length ? rules.map((item) => <RulePill key={item.key} item={item} />) : (
              <p className="text-sm font-semibold text-gray-400">No active attendance rules.</p>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-400">Weekly holiday paid</p>
              <p className="mt-1 text-sm font-extrabold text-gray-900">{safeRules(profile.rules).weeklyHolidayPaid ? "Yes" : "No"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-400">Paid leave allowed</p>
              <p className="mt-1 text-sm font-extrabold text-gray-900">{safeRules(profile.rules).paidLeaveAllowed ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-gray-900">Salary components</p>
            <p className="text-xs font-semibold text-gray-500">Active recurring earnings and deductions</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700">
            {components.length} items
          </span>
        </div>

        {components.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {components.map((item, index) => (
              <div key={item._id || `${item.name}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-gray-900">{item.name || "Unnamed component"}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {pretty(item.calculationType)} · based on {pretty(item.basedOn)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${item.type === "earning" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {item.type === "earning" ? "+" : "-"} {item.calculationType === "percentage" ? `${Number(item.value || 0)}%` : money(item.value, profile.currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm font-semibold text-gray-400">
            No active salary components.
          </div>
        )}
      </div>

      {profile.note ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-amber-600">Internal note</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold leading-6 text-amber-900">{profile.note}</p>
        </div>
      ) : null}
    </div>
  )
}

export default function AdminSalaryPage() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [filters, setFilters] = useState(defaultFilters)
  const [filterDraft, setFilterDraft] = useState(defaultFilters)
  const [employeeFilter, setEmployeeFilter] = useState(null)
  const [employeeDraft, setEmployeeDraft] = useState(null)
  const [searchText, setSearchText] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [viewProfile, setViewProfile] = useState(null)
  const [deleteState, setDeleteState] = useState({ open: false, profile: null, loading: false })
  const [deactivateState, setDeactivateState] = useState({ open: false, profile: null, date: new Date().toISOString().slice(0, 10), loading: false })

  const filteredPositions = useMemo(() => {
    if (!filters.department) return positions
    return positions.filter((position) => String(getId(position.department)) === String(filters.department))
  }, [filters.department, positions])

  const draftPositionOptions = useMemo(() => {
    if (!filterDraft.department) return positions
    return positions.filter((position) => String(getId(position.department)) === String(filterDraft.department))
  }, [filterDraft.department, positions])

  const getDepartmentName = (id) =>
    departments.find((department) => String(department._id) === String(id))?.name || ""

  const getPositionName = (id) =>
    positions.find((position) => String(position._id) === String(id))?.title || ""

  const filterValueLabel = (key, value) => {
    if (!value || value === "all") return ""
    if (key === "department") return getDepartmentName(value) || "Selected department"
    if (key === "position") return getPositionName(value) || "Selected position"
    if (key === "active") return value === "true" ? "Active" : "Inactive"
    return pretty(value)
  }

  const activeFilterEntries = useMemo(() => {
    const entries = []

    if (employeeFilter?._id) {
      entries.push({ key: "employee", label: "Employee", value: employeeFilter.name || employeeFilter.email || "Selected employee" })
    }

    Object.entries(filters)
      .filter(([, value]) => value && value !== "all")
      .forEach(([key, value]) => {
        entries.push({
          key,
          label: key === "active" ? "Status" : key === "department" ? "Department" : "Position",
          value: filterValueLabel(key, value),
        })
      })

    return entries
  }, [employeeFilter, filters, departments, positions])

  const activeFilterCount = activeFilterEntries.length + (searchText.trim() ? 1 : 0)

  const updateFilterDraft = (key, value) => {
    setFilterDraft((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "department" ? { position: "" } : {}),
    }))
  }

  const clearSingleFilter = (key) => {
    if (key === "employee") {
      setEmployeeFilter(null)
      return
    }

    setFilters((prev) => ({
      ...prev,
      [key]: key === "active" ? "all" : "",
      ...(key === "department" ? { position: "" } : {}),
    }))
  }

  const resetFilters = () => {
    setSearchText("")
    setEmployeeFilter(null)
    setEmployeeDraft(null)
    setFilters(defaultFilters)
    setFilterDraft(defaultFilters)
  }

  const visibleProfiles = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((profile) => {
      const employee = profile.employee || {}
      return [
        employee.name,
        employee.email,
        employee.employeeId,
        employee.department?.name,
        employee.position?.title,
        profile.currency,
        profile.salaryType,
      ]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(q))
    })
  }, [profiles, searchText])

  const totals = useMemo(() => {
    const active = profiles.filter((profile) => profile.isActive).length
    const payroll = profiles.reduce((sum, profile) => sum + calculatePreview(profile).netSalary, 0)
    const avg = profiles.length ? payroll / profiles.length : 0
    return { active, inactive: profiles.length - active, payroll, avg }
  }, [profiles])

  const formPreview = useMemo(() => calculatePreview(form), [form])

  const loadAccessLists = async () => {
    try {
      const [departmentsRes, positionsRes] = await Promise.all([
        api("/access-control/departments"),
        api("/access-control/positions"),
      ])
      setDepartments(departmentsRes.departments || [])
      setPositions(positionsRes.positions || [])
    } catch (error) {
      toast.error(error.message || "Failed to load access lists")
    }
  }

  const loadProfiles = async (nextPage = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", String(PAGE_SIZE))
      params.set("page", String(nextPage))
      if (filters.active !== "all") params.set("active", filters.active)
      if (filters.department) params.set("department", filters.department)
      if (filters.position) params.set("position", filters.position)
      if (employeeFilter?._id) params.set("employee", employeeFilter._id)

      const data = await api(`/salary-profiles?${params.toString()}`)
      setProfiles(Array.isArray(data.salaryProfiles) ? data.salaryProfiles : [])
      setTotal(Number(data.total || 0))
      setTotalPages(Math.max(Number(data.totalPages || 1), 1))
      setPage(Number(data.page || nextPage))
    } catch (error) {
      toast.error(error.message || "Failed to load salary profiles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccessLists()
  }, [])

  useEffect(() => {
    loadProfiles(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, employeeFilter])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, rules: safeRules(emptyRules), components: [] })
    setModalOpen(true)
  }

  const openEdit = (profile) => {
    setEditing(profile)
    setForm({
      employee: getId(profile.employee),
      employeeObject: profile.employee || null,
      salaryType: profile.salaryType || "monthly",
      currency: profile.currency || "BDT",
      basicSalary: Number(profile.basicSalary || 0),
      workingDaysPerMonth: Number(profile.workingDaysPerMonth || 26),
      workingHoursPerDay: Number(profile.workingHoursPerDay || 8),
      components: Array.isArray(profile.components) ? profile.components.map((item) => ({ ...emptyComponent, ...item })) : [],
      rules: safeRules(profile.rules || {}),
      effectiveFrom: toDateInput(profile.effectiveFrom) || new Date().toISOString().slice(0, 10),
      effectiveTo: toDateInput(profile.effectiveTo),
      isActive: profile.isActive !== false,
      note: profile.note || "",
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateRule = (key, value) => {
    setForm((prev) => ({
      ...prev,
      rules: {
        ...prev.rules,
        [key]: value,
      },
    }))
  }

  const updateComponent = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }))
  }

  const removeComponent = (index) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const saveProfile = async (event) => {
    event.preventDefault()

    if (!form.employeeObject?._id && !form.employee) return toast.error("Select an employee")
    if (!Number(form.basicSalary || 0)) return toast.error("Basic salary is required")

    const payload = {
      employee: form.employeeObject?._id || form.employee,
      salaryType: form.salaryType,
      currency: String(form.currency || "BDT").trim().toUpperCase(),
      basicSalary: Number(form.basicSalary || 0),
      workingDaysPerMonth: Number(form.workingDaysPerMonth || 26),
      workingHoursPerDay: Number(form.workingHoursPerDay || 8),
      components: form.components
        .map((item) => ({
          name: String(item.name || "").trim(),
          type: item.type,
          calculationType: item.calculationType,
          value: Number(item.value || 0),
          basedOn: item.basedOn || "basicSalary",
          isRecurring: Boolean(item.isRecurring),
          isTaxable: Boolean(item.isTaxable),
          isActive: item.isActive !== false,
          note: String(item.note || "").trim(),
        }))
        .filter((item) => item.name && ["earning", "deduction"].includes(item.type)),
      rules: form.rules,
      effectiveFrom: form.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: form.effectiveTo || null,
      isActive: Boolean(form.isActive),
      note: String(form.note || "").trim(),
    }

    setSaving(true)
    try {
      await api(editing?._id ? `/salary-profiles/${editing._id}` : "/salary-profiles", {
        method: editing?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })
      toast.success(editing?._id ? "Salary profile updated" : "Salary profile created")
      closeModal()
      loadProfiles(page)
    } catch (error) {
      toast.error(error.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const deactivateProfile = async (event) => {
    event.preventDefault()
    if (!deactivateState.profile?._id) return

    setDeactivateState((prev) => ({ ...prev, loading: true }))
    try {
      await api(`/salary-profiles/${deactivateState.profile._id}/deactivate`, {
        method: "PATCH",
        body: JSON.stringify({ effectiveTo: deactivateState.date || new Date().toISOString().slice(0, 10) }),
      })
      toast.success("Salary profile deactivated")
      setDeactivateState({ open: false, profile: null, date: new Date().toISOString().slice(0, 10), loading: false })
      loadProfiles(page)
    } catch (error) {
      toast.error(error.message || "Deactivate failed")
      setDeactivateState((prev) => ({ ...prev, loading: false }))
    }
  }

  const deleteProfile = async () => {
    if (!deleteState.profile?._id) return
    setDeleteState((prev) => ({ ...prev, loading: true }))
    try {
      await api(`/salary-profiles/${deleteState.profile._id}`, { method: "DELETE" })
      toast.success("Salary profile deleted")
      setDeleteState({ open: false, profile: null, loading: false })
      loadProfiles(page)
    } catch (error) {
      toast.error(error.message || "Delete failed")
      setDeleteState((prev) => ({ ...prev, loading: false }))
    }
  }

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <HIcon icon={CreditCardIcon} className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Salary Profiles</h1>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  Manage employee salary, earnings, deductions, overtime and attendance deduction rules.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} ${btnGhost}`} onClick={() => loadProfiles(page)} disabled={loading}>
                <HIcon icon={RefreshIcon} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button className={`${btn} ${btnPrimary}`} onClick={openCreate}>
                <HIcon icon={Add01Icon} />
                New Salary Profile
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <SalaryHeaderSearchFilters
              searchText={searchText}
              onSearchChange={setSearchText}
              activeFilterEntries={activeFilterEntries}
              activeFilterCount={activeFilterCount}
              onClearFilter={clearSingleFilter}
              onReset={resetFilters}
              onOpenFilters={() => {
                setFilterDraft(filters)
                setEmployeeDraft(employeeFilter)
                setFiltersOpen(true)
              }}
            />

            <p className="text-sm font-bold text-gray-500">
              Showing <span className="text-gray-900">{visibleProfiles.length}</span> of <span className="text-gray-900">{total}</span> profiles
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-gray-400">Profiles</p>
                <p className="mt-2 text-2xl font-extrabold text-gray-900">{total}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                <HIcon icon={File02Icon} />
              </span>
            </div>
          </div>
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-gray-400">Active</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-700">{totals.active}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10">
                <HIcon icon={CheckmarkCircle02Icon} />
              </span>
            </div>
          </div>
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-gray-400">Loaded Payroll</p>
                <p className="mt-2 text-2xl font-extrabold text-gray-900">{money(totals.payroll)}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                <HIcon icon={Dollar01Icon} />
              </span>
            </div>
          </div>
          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-gray-400">Average Net</p>
                <p className="mt-2 text-2xl font-extrabold text-gray-900">{money(totals.avg)}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-600/10">
                <HIcon icon={Activity01Icon} />
              </span>
            </div>
          </div>
        </div>

        <section className={`${card} overflow-hidden`}>
          <div className="hidden h-[620px] overflow-auto xl:block">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur">
                <tr>
                  <th className="whitespace-nowrap border-b border-gray-100 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gray-400">Employee</th>
                  <th className="whitespace-nowrap border-b border-gray-100 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gray-400">Compensation</th>
                  <th className="whitespace-nowrap border-b border-gray-100 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gray-400">Monthly preview</th>
                  <th className="whitespace-nowrap border-b border-gray-100 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gray-400">Attendance rules</th>
                  <th className="whitespace-nowrap border-b border-gray-100 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gray-400">Effective period</th>
                  <th className="whitespace-nowrap border-b border-gray-100 px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-gray-400">Status</th>
                  <th
                    className="sticky right-0 z-30 whitespace-nowrap border-b border-l border-gray-100 bg-gray-50/95 px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.08em] text-gray-400 shadow-none drop-shadow-none"
                    style={{ boxShadow: "none", filter: "none" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="bg-white px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-xs flex-col items-center gap-3">
                        <HIcon icon={RefreshIcon} className="animate-spin text-indigo-600" size={24} />
                        <p className="text-sm font-bold text-gray-500">Loading salary profiles...</p>
                      </div>
                    </td>
                  </tr>
                ) : visibleProfiles.length ? (
                  visibleProfiles.map((profile) => {
                    const employee = profile.employee || {}
                    const preview = calculatePreview(profile)
                    const activeRules = salaryRuleItems(profile.rules)

                    return (
                      <tr
                        key={profile._id}
                        className="group cursor-default transition hover:bg-gray-50/80"
                        onDoubleClick={() => setViewProfile(profile)}
                      >
                        <td className="border-b border-gray-100 px-5 py-4 align-middle">
                          <div className="flex min-w-[240px] items-center gap-3">
                            <EmployeeAvatar employee={employee} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-extrabold text-gray-900">{employee.name || "Unnamed employee"}</p>
                              <p className="mt-0.5 truncate text-xs font-semibold text-gray-500">{employee.email || "No email"}</p>
                              <p className="mt-1 truncate text-xs font-extrabold text-indigo-600">
                                {employee.department?.name || "No department"} · {employee.position?.title || "No position"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-gray-100 px-5 py-4 align-middle">
                          <div className="min-w-[185px]">
                            <p className="text-base font-extrabold text-gray-900">{money(profile.basicSalary, profile.currency)}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-700 ring-1 ring-gray-200">
                                {pretty(profile.salaryType)}
                              </span>
                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10">
                                {profile.workingDaysPerMonth || 26}d · {profile.workingHoursPerDay || 8}h
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-gray-100 px-5 py-4 align-middle">
                          <div className="min-w-[205px] rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs font-bold text-gray-500">Gross</span>
                              <span className="text-sm font-extrabold text-gray-900">{money(preview.grossSalary, profile.currency)}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-4">
                              <span className="text-xs font-bold text-gray-500">Deduction</span>
                              <span className="text-sm font-extrabold text-rose-700">{money(preview.fixedDeductions, profile.currency)}</span>
                            </div>
                            <div className="mt-2 border-t border-gray-200 pt-2">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-xs font-extrabold text-emerald-700">Net</span>
                                <span className="text-sm font-extrabold text-emerald-700">{money(preview.netSalary, profile.currency)}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="border-b border-gray-100 px-5 py-4 align-middle">
                          <div className="flex min-w-[180px] flex-wrap gap-2">
                            {activeRules.length ? (
                              <>
                                {activeRules.slice(0, 2).map((item) => <RulePill key={item.key} item={item} />)}
                                {activeRules.length > 2 ? (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-600 ring-1 ring-gray-200">
                                    +{activeRules.length - 2} more
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-sm font-semibold text-gray-400">No active rules</span>
                            )}
                          </div>
                        </td>

                        <td className="border-b border-gray-100 px-5 py-4 align-middle">
                          <div className="min-w-[150px]">
                            <div className="flex items-center gap-2 text-sm font-extrabold text-gray-800">
                              <HIcon icon={Calendar03Icon} className="text-gray-400" />
                              {dateText(profile.effectiveFrom)}
                            </div>
                            <p className="mt-1.5 pl-6 text-xs font-semibold text-gray-400">
                              {profile.effectiveTo ? `Until ${dateText(profile.effectiveTo)}` : "Current profile"}
                            </p>
                          </div>
                        </td>

                        <td className="border-b border-gray-100 px-5 py-4 align-middle">
                          <StatusBadge active={profile.isActive !== false} />
                        </td>

                        <td
                          className="sticky right-0 z-10 border-b border-l border-gray-100 bg-white px-5 py-4 text-right align-middle shadow-none drop-shadow-none group-hover:bg-gray-50"
                          style={{ boxShadow: "none", filter: "none" }}
                        >
                          <SalaryRowActionMenu
                            profile={profile}
                            onView={setViewProfile}
                            onEdit={openEdit}
                            onDeactivate={(selected) => setDeactivateState({ open: true, profile: selected, date: new Date().toISOString().slice(0, 10), loading: false })}
                            onDelete={(selected) => setDeleteState({ open: true, profile: selected, loading: false })}
                          />
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="bg-white px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                          <HIcon icon={CreditCardIcon} size={22} />
                        </div>
                        <p className="mt-3 text-sm font-extrabold text-gray-900">No salary profiles found</p>
                        <p className="mt-1 text-sm font-semibold text-gray-500">Create a salary profile or change your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 xl:hidden">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                  <HIcon icon={RefreshIcon} className="animate-spin text-indigo-600" />
                  Loading salary profiles...
                </div>
              </div>
            ) : visibleProfiles.length ? (
              visibleProfiles.map((profile) => (
                <SalaryMobileCard
                  key={profile._id}
                  profile={profile}
                  onView={setViewProfile}
                  onEdit={openEdit}
                  onDeactivate={(selected) => setDeactivateState({ open: true, profile: selected, date: new Date().toISOString().slice(0, 10), loading: false })}
                  onDelete={(selected) => setDeleteState({ open: true, profile: selected, loading: false })}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-700 shadow-sm">
                  <HIcon icon={CreditCardIcon} size={22} />
                </div>
                <p className="mt-3 text-sm font-extrabold text-gray-900">No salary profiles found</p>
                <p className="mt-1 text-sm font-semibold text-gray-500">Create a salary profile or change your filters.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-gray-600">
              Page <span className="text-gray-900">{page}</span> of <span className="text-gray-900">{totalPages}</span> · {total} total profiles
            </p>
            <div className="flex gap-2">
              <button
                className={`${btn} ${btnGhost}`}
                disabled={loading || page <= 1}
                onClick={() => loadProfiles(page - 1)}
                type="button"
              >
                <HIcon icon={ArrowLeft01Icon} />
                Previous
              </button>
              <button
                className={`${btn} ${btnGhost}`}
                disabled={loading || page >= totalPages}
                onClick={() => loadProfiles(page + 1)}
                type="button"
              >
                Next
                <HIcon icon={ArrowRight01Icon} />
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(viewProfile)}
        title="Salary Profile Details"
        subtitle={viewProfile?.employee?.name || "Review employee compensation and salary rules"}
        icon={<HIcon icon={ViewIcon} size={20} />}
        onClose={() => setViewProfile(null)}
        maxWidthClass="max-w-5xl"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button className={`${btn} ${btnGhost}`} type="button" onClick={() => setViewProfile(null)}>
              Close
            </button>
            <button
              className={`${btn} ${btnPrimary}`}
              type="button"
              onClick={() => {
                const selected = viewProfile
                setViewProfile(null)
                window.requestAnimationFrame(() => selected && openEdit(selected))
              }}
            >
              <HIcon icon={PencilEdit02Icon} />
              Edit Profile
            </button>
          </div>
        }
      >
        <SalaryProfileDetails profile={viewProfile} />
      </Modal>

      <Modal
        open={filtersOpen}
        title="Salary Filters"
        subtitle="Filter salary profiles by employee, department, position, and status."
        icon={<HIcon icon={FilterIcon} className="h-5 w-5" />}
        onClose={() => setFiltersOpen(false)}
        maxWidthClass="max-w-4xl"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              type="button"
              onClick={() => {
                setFilterDraft(defaultFilters)
                setEmployeeDraft(null)
                setFilters(defaultFilters)
                setEmployeeFilter(null)
                setFiltersOpen(false)
              }}
            >
              Clear All
            </button>
            <button
              className={`${btn} ${btnPrimary}`}
              type="button"
              onClick={() => {
                setFilters(filterDraft)
                setEmployeeFilter(employeeDraft)
                setFiltersOpen(false)
              }}
            >
              Apply Filters
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Employee">
            <EmployeeSearch value={employeeDraft} onSelect={setEmployeeDraft} placeholder="Search employee" />
          </Field>

          <Field label="Status">
            <select
              className={input}
              value={filterDraft.active}
              onChange={(event) => updateFilterDraft("active", event.target.value)}
            >
              <option value="all">All Profiles</option>
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
            </select>
          </Field>

          <Field label="Department">
            <select
              className={input}
              value={filterDraft.department}
              onChange={(event) => updateFilterDraft("department", event.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>{department.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Position">
            <select
              className={input}
              value={filterDraft.position}
              onChange={(event) => updateFilterDraft("position", event.target.value)}
            >
              <option value="">All Positions</option>
              {draftPositionOptions.map((position) => (
                <option key={position._id} value={position._id}>{position.title}</option>
              ))}
            </select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        title={editing ? "Edit Salary Profile" : "Create Salary Profile"}
        subtitle="Assign base salary, components, overtime and deduction rules."
        icon={<HIcon icon={CreditCardIcon} className="h-5 w-5" />}
        onClose={closeModal}
        footer={
          <div className="flex justify-end gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={closeModal} type="button" disabled={saving}>Cancel</button>
            <button className={`${btn} ${btnPrimary}`} form="salary-form" type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Profile" : "Create Profile"}
            </button>
          </div>
        }
      >
        <form id="salary-form" onSubmit={saveProfile} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <div className={`${card} p-4`}>
                <div className="mb-4 flex items-center gap-2">
                  <HIcon icon={UserIcon} className="text-indigo-600" />
                  <h3 className="text-sm font-extrabold text-gray-900">Employee & Salary Setup</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Employee">
                    <EmployeeSearch
                      value={form.employeeObject}
                      onSelect={(employee) => {
                        updateForm("employeeObject", employee)
                        updateForm("employee", employee?._id || "")
                      }}
                      placeholder="Search employee"
                    />
                  </Field>
                  <Field label="Basic Salary">
                    <input
                      className={input}
                      type="number"
                      min="0"
                      value={form.basicSalary}
                      onChange={(event) => updateForm("basicSalary", event.target.value)}
                      placeholder="30000"
                    />
                  </Field>
                  <Field label="Salary Type">
                    <select className={input} value={form.salaryType} onChange={(event) => updateForm("salaryType", event.target.value)}>
                      {salaryTypes.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Currency">
                    <input
                      className={input}
                      value={form.currency}
                      onChange={(event) => updateForm("currency", event.target.value.toUpperCase())}
                      placeholder="BDT"
                    />
                  </Field>
                  <Field label="Working Days / Month">
                    <input
                      className={input}
                      type="number"
                      min="1"
                      max="31"
                      value={form.workingDaysPerMonth}
                      onChange={(event) => updateForm("workingDaysPerMonth", event.target.value)}
                    />
                  </Field>
                  <Field label="Working Hours / Day">
                    <input
                      className={input}
                      type="number"
                      min="1"
                      max="24"
                      value={form.workingHoursPerDay}
                      onChange={(event) => updateForm("workingHoursPerDay", event.target.value)}
                    />
                  </Field>
                  <Field label="Effective From">
                    <input className={input} type="date" value={form.effectiveFrom} onChange={(event) => updateForm("effectiveFrom", event.target.value)} />
                  </Field>
                  <Field label="Effective To">
                    <input className={input} type="date" value={form.effectiveTo} onChange={(event) => updateForm("effectiveTo", event.target.value)} />
                  </Field>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f8fb] px-3 py-3 ring-1 ring-gray-100">
                    <span className="text-sm font-extrabold text-gray-800">Active Profile</span>
                    <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm("isActive", event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f8fb] px-3 py-3 ring-1 ring-gray-100">
                    <span className="text-sm font-extrabold text-gray-800">Paid Leave Allowed</span>
                    <input
                      type="checkbox"
                      checked={form.rules.paidLeaveAllowed}
                      onChange={(event) => updateForm("rules", { ...form.rules, paidLeaveAllowed: event.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </label>
                </div>
              </div>

              <div className={`${card} p-4`}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <HIcon icon={Add01Icon} className="text-indigo-600" />
                    <h3 className="text-sm font-extrabold text-gray-900">Earnings & Deductions</h3>
                  </div>
                  <button
                    type="button"
                    className={`${btn} ${btnGhost}`}
                    onClick={() => updateForm("components", [...form.components, { ...emptyComponent }])}
                  >
                    <HIcon icon={Add01Icon} />
                    Add Component
                  </button>
                </div>

                <div className="space-y-3">
                  {form.components.length ? (
                    form.components.map((item, index) => (
                      <div key={index} className="rounded-2xl border border-gray-100 bg-[#fbfcff] p-3">
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_140px_160px_140px_160px_44px] lg:items-end">
                          <Field label="Name">
                            <input className={input} value={item.name} onChange={(event) => updateComponent(index, "name", event.target.value)} placeholder="House rent / Tax" />
                          </Field>
                          <Field label="Type">
                            <select className={input} value={item.type} onChange={(event) => updateComponent(index, "type", event.target.value)}>
                              {componentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Calculation">
                            <select className={input} value={item.calculationType} onChange={(event) => updateComponent(index, "calculationType", event.target.value)}>
                              {calcTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Value">
                            <input className={input} type="number" min="0" value={item.value} onChange={(event) => updateComponent(index, "value", event.target.value)} />
                          </Field>
                          <Field label="Based On">
                            <select className={input} value={item.basedOn} onChange={(event) => updateComponent(index, "basedOn", event.target.value)}>
                              {basedOnOptions.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                            </select>
                          </Field>
                          <button
                            type="button"
                            className="inline-flex h-11 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50"
                            onClick={() => removeComponent(index)}
                            title="Remove"
                          >
                            <HIcon icon={Delete02Icon} />
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-gray-100">
                            <span className="text-xs font-extrabold text-gray-700">Recurring</span>
                            <input type="checkbox" checked={item.isRecurring} onChange={(event) => updateComponent(index, "isRecurring", event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                          </label>
                          <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-gray-100">
                            <span className="text-xs font-extrabold text-gray-700">Taxable</span>
                            <input type="checkbox" checked={item.isTaxable} onChange={(event) => updateComponent(index, "isTaxable", event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                          </label>
                          <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-gray-100">
                            <span className="text-xs font-extrabold text-gray-700">Active</span>
                            <input type="checkbox" checked={item.isActive !== false} onChange={(event) => updateComponent(index, "isActive", event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                          </label>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fbfcff] p-8 text-center">
                      <p className="text-sm font-extrabold text-gray-900">No earning or deduction components yet</p>
                      <p className="mt-1 text-sm font-semibold text-gray-500">Add allowances, bonuses, tax or other fixed deductions.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={`${card} p-4`}>
                <div className="mb-4 flex items-center gap-2">
                  <HIcon icon={SecurityCheckIcon} className="text-indigo-600" />
                  <h3 className="text-sm font-extrabold text-gray-900">Attendance Salary Rules</h3>
                </div>
                <div className="space-y-4">
                  <RuleCard
                    title="Overtime Earning"
                    icon={<HIcon icon={ArrowUp02Icon} />}
                    value={form.rules.overtime}
                    onChange={(value) => updateRule("overtime", value)}
                    calculationOptions={[
                      { value: "fixed", label: "Fixed" },
                      { value: "per_hour", label: "Per Hour" },
                      { value: "percentage", label: "Percentage" },
                    ]}
                  />
                  <RuleCard
                    title="Late Deduction"
                    icon={<HIcon icon={Activity01Icon} />}
                    value={form.rules.lateDeduction}
                    onChange={(value) => updateRule("lateDeduction", value)}
                    showGrace
                    calculationOptions={[
                      { value: "fixed", label: "Fixed" },
                      { value: "per_minute", label: "Per Minute" },
                      { value: "percentage", label: "Percentage" },
                    ]}
                  />
                  <RuleCard
                    title="Absent Deduction"
                    icon={<HIcon icon={ArrowDown02Icon} />}
                    value={form.rules.absentDeduction}
                    onChange={(value) => updateRule("absentDeduction", value)}
                    calculationOptions={[
                      { value: "per_day", label: "Per Day" },
                      { value: "fixed", label: "Fixed" },
                      { value: "percentage", label: "Percentage" },
                    ]}
                  />
                  <RuleCard
                    title="Unpaid Leave Deduction"
                    icon={<HIcon icon={Calendar03Icon} />}
                    value={form.rules.unpaidLeaveDeduction}
                    onChange={(value) => updateRule("unpaidLeaveDeduction", value)}
                    calculationOptions={[
                      { value: "per_day", label: "Per Day" },
                      { value: "fixed", label: "Fixed" },
                      { value: "percentage", label: "Percentage" },
                    ]}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f8fb] px-3 py-3 ring-1 ring-gray-100">
                    <span className="text-sm font-extrabold text-gray-800">Weekly Holiday Paid</span>
                    <input
                      type="checkbox"
                      checked={form.rules.weeklyHolidayPaid}
                      onChange={(event) => updateForm("rules", { ...form.rules, weeklyHolidayPaid: event.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f8fb] px-3 py-3 ring-1 ring-gray-100">
                    <span className="text-sm font-extrabold text-gray-800">Paid Leave Allowed</span>
                    <input
                      type="checkbox"
                      checked={form.rules.paidLeaveAllowed}
                      onChange={(event) => updateForm("rules", { ...form.rules, paidLeaveAllowed: event.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </label>
                </div>
              </div>

              <div className={`${card} p-4`}>
                <Field label="Note">
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/15"
                    value={form.note}
                    onChange={(event) => updateForm("note", event.target.value)}
                    placeholder="Internal note about this salary profile..."
                  />
                </Field>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="sticky top-4 space-y-4">
                <div className={`${card} overflow-hidden`}>
                  <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-extrabold text-gray-900">Salary Preview</p>
                    <p className="text-xs font-semibold text-gray-500">Fixed monthly preview only</p>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between rounded-xl bg-[#f7f8fb] px-3 py-3">
                      <span className="text-sm font-bold text-gray-500">Basic</span>
                      <span className="text-sm font-extrabold text-gray-900">{money(formPreview.basicSalary, form.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-3">
                      <span className="text-sm font-bold text-emerald-700">Fixed Earnings</span>
                      <span className="text-sm font-extrabold text-emerald-700">+ {money(formPreview.fixedEarnings, form.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-3">
                      <span className="text-sm font-bold text-rose-700">Fixed Deductions</span>
                      <span className="text-sm font-extrabold text-rose-700">- {money(formPreview.fixedDeductions, form.currency)}</span>
                    </div>
                    <div className="rounded-2xl bg-indigo-600 p-4 text-white">
                      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/70">Net Salary</p>
                      <p className="mt-1 text-2xl font-extrabold">{money(formPreview.netSalary, form.currency)}</p>
                    </div>
                  </div>
                </div>

                <div className={`${card} p-4`}>
                  <p className="text-sm font-extrabold text-gray-900">Quick Guide</p>
                  <div className="mt-3 space-y-3 text-sm font-semibold text-gray-600">
                    <p>• Active profile replaces the old active profile for the same employee.</p>
                    <p>• Absent and unpaid leave rules are used by attendance salary impact.</p>
                    <p>• Variable components can be handled during monthly payroll processing.</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </Modal>

      <Modal
        open={deactivateState.open}
        title="Deactivate Salary Profile"
        subtitle={deactivateState.profile?.employee?.name || "Close this active profile"}
        icon={<HIcon icon={SecurityCheckIcon} className="h-5 w-5" />}
        onClose={() => !deactivateState.loading && setDeactivateState({ open: false, profile: null, date: new Date().toISOString().slice(0, 10), loading: false })}
        maxWidthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              disabled={deactivateState.loading}
              onClick={() => setDeactivateState({ open: false, profile: null, date: new Date().toISOString().slice(0, 10), loading: false })}
              type="button"
            >
              Cancel
            </button>
            <button className={`${btn} ${btnPrimary}`} disabled={deactivateState.loading} form="deactivate-form" type="submit">
              {deactivateState.loading ? "Deactivating..." : "Deactivate"}
            </button>
          </div>
        }
      >
        <form id="deactivate-form" onSubmit={deactivateProfile} className="space-y-4">
          <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            This will mark the profile inactive. You can create another active profile for this employee after this.
          </p>
          <Field label="Effective To">
            <input
              className={input}
              type="date"
              value={deactivateState.date}
              onChange={(event) => setDeactivateState((prev) => ({ ...prev, date: event.target.value }))}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={deleteState.open}
        title="Delete Salary Profile"
        subtitle={deleteState.profile?.employee?.name || "Delete inactive salary profile"}
        icon={<HIcon icon={Delete02Icon} className="h-5 w-5" />}
        onClose={() => !deleteState.loading && setDeleteState({ open: false, profile: null, loading: false })}
        maxWidthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              className={`${btn} ${btnGhost}`}
              disabled={deleteState.loading}
              onClick={() => setDeleteState({ open: false, profile: null, loading: false })}
              type="button"
            >
              Cancel
            </button>
            <button className={`${btn} ${btnDanger}`} disabled={deleteState.loading} onClick={deleteProfile} type="button">
              {deleteState.loading ? "Deleting..." : "Delete Profile"}
            </button>
          </div>
        }
      >
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          This will permanently delete the inactive salary profile. Active profiles must be deactivated first.
        </p>
      </Modal>
    </div>
  )
}
