"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEdit3,
  FiRefreshCcw,
  FiSave,
  FiSearch,
  FiTrash2,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-[#f5f6fa]"
const card = "rounded-2xl border border-gray-200 bg-white shadow-[0_14px_36px_-22px_rgba(15,23,42,0.38)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const btnSoft = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 hover:bg-indigo-100"
const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
const textarea =
  "min-h-[88px] w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500/40"

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const STATUS_OPTIONS = [
  { value: "present", label: "Present", icon: FiCheck },
  { value: "late", label: "Late", icon: FiClock },
  { value: "half_day", label: "Half Day", icon: FiClock },
  { value: "absent", label: "Absent", icon: FiX },
  { value: "paid_leave", label: "Paid Leave", icon: FiCalendar },
  { value: "unpaid_leave", label: "Unpaid Leave", icon: FiCalendar },
  { value: "weekly_holiday", label: "Weekend", icon: FiCalendar },
  { value: "holiday", label: "Holiday", icon: FiCalendar },
]

const noTimeStatuses = ["absent", "paid_leave", "unpaid_leave", "weekly_holiday", "holiday"]

const statusTheme = {
  present: {
    label: "Present",
    icon: FiCheck,
    card: "border-emerald-200 bg-emerald-50/70",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    button: "border-emerald-200 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  late: {
    label: "Late",
    icon: FiClock,
    card: "border-amber-200 bg-amber-50/70",
    chip: "bg-amber-50 text-amber-700 ring-amber-600/10",
    button: "border-amber-200 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20",
    dot: "bg-amber-500",
  },
  half_day: {
    label: "Half Day",
    icon: FiClock,
    card: "border-orange-200 bg-orange-50/70",
    chip: "bg-orange-50 text-orange-700 ring-orange-600/10",
    button: "border-orange-200 bg-orange-50 text-orange-700 ring-2 ring-orange-500/20",
    dot: "bg-orange-500",
  },
  absent: {
    label: "Absent",
    icon: FiX,
    card: "border-rose-200 bg-rose-50/70",
    chip: "bg-rose-50 text-rose-700 ring-rose-600/10",
    button: "border-rose-200 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20",
    dot: "bg-rose-500",
  },
  paid_leave: {
    label: "Paid Leave",
    icon: FiCalendar,
    card: "border-blue-200 bg-blue-50/70",
    chip: "bg-blue-50 text-blue-700 ring-blue-600/10",
    button: "border-blue-200 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20",
    dot: "bg-blue-500",
  },
  unpaid_leave: {
    label: "Unpaid Leave",
    icon: FiCalendar,
    card: "border-purple-200 bg-purple-50/70",
    chip: "bg-purple-50 text-purple-700 ring-purple-600/10",
    button: "border-purple-200 bg-purple-50 text-purple-700 ring-2 ring-purple-500/20",
    dot: "bg-purple-500",
  },
  weekly_holiday: {
    label: "Weekend",
    icon: FiCalendar,
    card: "border-gray-200 bg-gray-50",
    chip: "bg-gray-100 text-gray-600 ring-gray-600/10",
    button: "border-gray-200 bg-gray-50 text-gray-700 ring-2 ring-gray-400/20",
    dot: "bg-gray-400",
  },
  holiday: {
    label: "Holiday",
    icon: FiCalendar,
    card: "border-cyan-200 bg-cyan-50/70",
    chip: "bg-cyan-50 text-cyan-700 ring-cyan-600/10",
    button: "border-cyan-200 bg-cyan-50 text-cyan-700 ring-2 ring-cyan-500/20",
    dot: "bg-cyan-500",
  },
  empty: {
    label: "No Record",
    icon: FiEdit3,
    card: "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30",
    chip: "bg-gray-100 text-gray-500 ring-gray-600/10",
    button: "border-indigo-200 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20",
    dot: "bg-gray-300",
  },
}

const emptyForm = {
  status: "present",
  checkIn: "09:00",
  checkOut: "18:00",
  lateMinutes: 0,
  overtimeMinutes: 0,
  isOvertimeApproved: false,
  note: "",
}

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

function pad(value) {
  return String(value).padStart(2, "0")
}

function toDateInput(date = new Date()) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toMonthInput(date = new Date()) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

function getDayKey(value) {
  return toDateInput(value)
}

function getMonthName(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })
}

function formatLongDate(dayKey) {
  if (!dayKey) return "Select a date"
  const [year, month, day] = dayKey.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function dateFromDayKey(dayKey) {
  const [year, month, day] = String(dayKey || "").split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function isWeekend(dayKey) {
  const date = dateFromDayKey(dayKey)
  if (!date) return false
  const day = date.getDay()
  return day === 0 || day === 6
}

function timeToInput(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTimeAMPM(value) {
  if (!value) return ""

  let date

  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value)) {
    const [hour, minute] = value.split(":").map(Number)
    date = new Date(2000, 0, 1, hour || 0, minute || 0, 0, 0)
  } else {
    date = new Date(value)
  }

  if (Number.isNaN(date.getTime())) return ""

  return date
    .toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/^0/, "")
}

function formatRecordTimeRange(record) {
  if (!record) return ""

  const checkIn = formatTimeAMPM(record.checkIn)
  const checkOut = formatTimeAMPM(record.checkOut)

  if (checkIn && checkOut) return `${checkIn} - ${checkOut}`
  return checkIn || checkOut || ""
}

function localDateTimeISO(dayKey, timeValue) {
  if (!dayKey || !timeValue) return null
  const [year, month, day] = dayKey.split("-").map(Number)
  const [hour, minute] = timeValue.split(":").map(Number)
  const date = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function minutesBetween(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [startHour, startMinute] = startTime.split(":").map(Number)
  const [endHour, endMinute] = endTime.split(":").map(Number)
  const start = startHour * 60 + startMinute
  let end = endHour * 60 + endMinute
  if (end < start) end += 24 * 60
  return Math.max(0, end - start)
}

function minutesLabel(minutes) {
  const total = Number(minutes || 0)
  if (!total) return "0h"
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (!hours) return `${mins}m`
  if (!mins) return `${hours}h`
  return `${hours}h ${mins}m`
}

function recordDayKey(record) {
  return record?.dayKey || getDayKey(record?.workDate)
}

function getStatusMeta(status) {
  return statusTheme[status] || statusTheme.empty
}

function employeeMeta(employee) {
  if (!employee) return "Employee"
  return employee.position?.title || employee.department?.name || employee.email || "Employee"
}

function buildCalendarCells(year, month) {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells = []

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ type: "blank", key: `blank-start-${i}` })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day)
    const dayKey = toDateInput(date)
    cells.push({ type: "day", key: dayKey, day, dayKey, isToday: dayKey === toDateInput(new Date()) })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ type: "blank", key: `blank-end-${cells.length}` })
  }

  return cells
}

function StatusPill({ status, small = false }) {
  const meta = getStatusMeta(status)
  const Icon = meta.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${meta.chip} ${
        small ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
      }`}
    >
      <Icon className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {meta.label}
    </span>
  )
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs font-medium text-gray-500">{hint}</span> : null}
    </label>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs font-semibold text-gray-500">{sub}</p> : null}
    </div>
  )
}

function EmployeePicker({
  employees,
  filteredEmployees,
  employeeQuery,
  setEmployeeQuery,
  selectedEmployee,
  selectEmployee,
  clearSelectedEmployee,
  loadingEmployees,
  placeholder = "Search employee",
  showSelectedCard = true,
  centered = false,
}) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef(null)
  const query = employeeQuery.trim()
  const showResults = open && query.length > 0 && (!selectedEmployee || query.toLowerCase() !== String(selectedEmployee.name || "").toLowerCase())

  useEffect(() => {
    const onMouseDown = (event) => {
      if (!pickerRef.current) return
      if (!pickerRef.current.contains(event.target)) setOpen(false)
    }

    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  return (
    <div ref={pickerRef} className={`relative ${centered ? "mx-auto w-full max-w-xl" : "w-full"}`}>
      <div className="flex h-9 items-center gap-3 rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 transition focus-within:border-indigo-300 focus-within:bg-[#f8f9fc] focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          className="h-8 min-w-0 flex-1 appearance-none border-0 bg-transparent text-sm font-semibold text-gray-800 outline-none ring-0 placeholder:text-gray-400 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none"
          style={{ outline: "none", boxShadow: "none" }}
          value={employeeQuery}
          onChange={(event) => {
            const next = event.target.value
            setEmployeeQuery(next)
            setOpen(next.trim().length > 0)

            if (selectedEmployee && next !== selectedEmployee.name) {
              clearSelectedEmployee(false)
            }
          }}
          onFocus={() => {
            if (query.length > 0) setOpen(true)
          }}
          placeholder={placeholder}
          disabled={loadingEmployees}
          type="text"
        />
        {selectedEmployee ? (
          <button
            type="button"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={() => clearSelectedEmployee()}
            title="Clear employee"
          >
            <FiX className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showResults ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.55)]">
          {filteredEmployees.length ? (
            filteredEmployees.slice(0, 8).map((employee) => (
              <button
                key={employee._id}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50"
                onClick={() => {
                  selectEmployee(employee)
                  setOpen(false)
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-200">
                  {employee.avatarUrl ? (
                    <img src={employee.avatarUrl} alt={employee.name || "Employee"} className="h-full w-full object-cover" />
                  ) : (
                    <FiUser className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-gray-900">{employee.name || "Unnamed"}</p>
                  <p className="truncate text-xs font-semibold text-gray-500">
                    {employee.employeeId ? `${employee.employeeId} • ` : ""}
                    {employeeMeta(employee)}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-sm font-semibold text-gray-500">
              {loadingEmployees ? "Loading employees..." : employees.length ? "No employee found" : "No employees loaded"}
            </div>
          )}
        </div>
      ) : null}

      {showSelectedCard && selectedEmployee ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-indigo-100">
            {selectedEmployee.avatarUrl ? (
              <img src={selectedEmployee.avatarUrl} alt={selectedEmployee.name || "Employee"} className="h-full w-full object-cover" />
            ) : (
              <FiUser className="h-4 w-4 text-indigo-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-gray-900">{selectedEmployee.name || "Unnamed"}</p>
            <p className="truncate text-xs font-semibold text-indigo-700">{employeeMeta(selectedEmployee)}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function AttendanceManager() {
  const today = useMemo(() => new Date(), [])

  const [tab, setTab] = useState("attendance")
  const [employees, setEmployees] = useState([])
  const [employeeQuery, setEmployeeQuery] = useState("")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [viewMonth, setViewMonth] = useState(toMonthInput(today))
  const [selectedDate, setSelectedDate] = useState(toDateInput(today))
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [salaryImpact, setSalaryImpact] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [clock, setClock] = useState(new Date())
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [year, month] = viewMonth.split("-").map(Number)

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee._id) === String(selectedEmployeeId)) || null,
    [employees, selectedEmployeeId]
  )

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase()
    if (!q) return []

    return employees.filter((employee) => {
      const haystack = [
        employee.name,
        employee.email,
        employee.employeeId,
        employee.department?.name,
        employee.position?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [employees, employeeQuery])

  const recordsByDay = useMemo(() => {
    const map = {}
    records.forEach((record) => {
      const key = recordDayKey(record)
      if (key) map[key] = record
    })
    return map
  }, [records])

  const selectedRecord = recordsByDay[selectedDate] || null
  const calendarCells = useMemo(() => buildCalendarCells(year, month), [year, month])

  const cleanStats = useMemo(() => {
    const data = summary || {}
    return [
      { label: "Present", value: Number(data.presentDays || 0) + Number(data.lateDays || 0), sub: "including late" },
      { label: "Leave", value: Number(data.paidLeaveDays || 0) + Number(data.unpaidLeaveDays || 0), sub: "paid + unpaid" },
      { label: "Absent", value: Number(data.absentDays || 0), sub: "deduction days" },
      { label: "Payable", value: Number(data.payableDays || 0), sub: "salary days" },
    ]
  }, [summary])

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadEmployees = async () => {
    setLoadingEmployees(true)
    try {
      const data = await api("/users/employees?limit=100&sort=newest")
      setEmployees(Array.isArray(data.employees) ? data.employees : [])
    } catch (error) {
      toast.error(error.message || "Failed to load employees")
    } finally {
      setLoadingEmployees(false)
    }
  }

  const loadMonthlySummary = async () => {
    if (!selectedEmployeeId || !year || !month) {
      setSummary(null)
      setSalaryImpact(null)
      setRecords([])
      return
    }

    setLoadingSummary(true)
    try {
      const data = await api(`/attendance/employee/${selectedEmployeeId}/monthly-summary?year=${year}&month=${month}`)
      setSummary(data.summary || null)
      setSalaryImpact(data.salaryImpact || null)
      setRecords(Array.isArray(data.records) ? data.records : [])
    } catch (error) {
      setSummary(null)
      setSalaryImpact(null)
      setRecords([])
      toast.error(error.message || "Failed to load attendance")
    } finally {
      setLoadingSummary(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  useEffect(() => {
    loadMonthlySummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, viewMonth])

  useEffect(() => {
    if (selectedRecord) {
      setForm({
        status: selectedRecord.status || "present",
        checkIn: timeToInput(selectedRecord.checkIn),
        checkOut: timeToInput(selectedRecord.checkOut),
        lateMinutes: Number(selectedRecord.lateMinutes || 0),
        overtimeMinutes: Number(selectedRecord.overtimeMinutes || 0),
        isOvertimeApproved: Boolean(selectedRecord.isOvertimeApproved),
        note: selectedRecord.note || "",
      })
      return
    }

    const weekend = isWeekend(selectedDate)
    setForm({
      ...emptyForm,
      status: weekend ? "weekly_holiday" : "present",
      checkIn: weekend ? "" : "09:00",
      checkOut: weekend ? "" : "18:00",
    })
  }, [selectedDate, selectedRecord])

  const selectEmployee = (employee) => {
    setSelectedEmployeeId(employee?._id || "")
    setEmployeeQuery(employee?.name || "")
  }

  const clearSelectedEmployee = (clearQuery = true) => {
    setSelectedEmployeeId("")
    if (clearQuery) setEmployeeQuery("")
    setSummary(null)
    setSalaryImpact(null)
    setRecords([])
  }

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectMonthFromDate = (dayKey) => {
    const date = dateFromDayKey(dayKey)
    if (!date) return
    setViewMonth(toMonthInput(date))
  }

  const changeMonth = (amount) => {
    const next = new Date(year, month - 1 + amount, 1)
    const nextMonth = toMonthInput(next)
    setViewMonth(nextMonth)

    const selected = dateFromDayKey(selectedDate)
    if (!selected || selected.getFullYear() !== next.getFullYear() || selected.getMonth() !== next.getMonth()) {
      setSelectedDate(toDateInput(next))
    }
  }

  const chooseDay = (dayKey, openAttendance = false) => {
    setSelectedDate(dayKey)
    if (openAttendance) setTab("attendance")
  }

  const saveAttendance = async (event) => {
    event.preventDefault()

    if (!selectedEmployeeId) return toast.error("Select an employee first")
    if (!selectedDate) return toast.error("Select a date first")

    const shouldSendTimes = !noTimeStatuses.includes(form.status)
    const workMinutes = shouldSendTimes ? minutesBetween(form.checkIn, form.checkOut) : 0

    const payload = {
      employee: selectedEmployeeId,
      workDate: selectedDate,
      status: form.status,
      source: "manual",
      checkIn: shouldSendTimes && form.checkIn ? localDateTimeISO(selectedDate, form.checkIn) : null,
      checkOut: shouldSendTimes && form.checkOut ? localDateTimeISO(selectedDate, form.checkOut) : null,
      workMinutes,
      lateMinutes: Number(form.lateMinutes || 0),
      overtimeMinutes: Number(form.overtimeMinutes || 0),
      isOvertimeApproved: Boolean(form.isOvertimeApproved),
      note: form.note.trim(),
    }

    setSaving(true)
    try {
      await api("/attendance/mark", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast.success(selectedRecord ? "Attendance updated" : "Attendance saved")
      await loadMonthlySummary()
    } catch (error) {
      toast.error(error.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const deleteSelectedAttendance = async () => {
    if (!selectedRecord?._id) return
    const ok = window.confirm("Delete attendance for this date?")
    if (!ok) return

    setDeleting(true)
    try {
      await api(`/attendance/${selectedRecord._id}`, { method: "DELETE" })
      toast.success("Attendance deleted")
      await loadMonthlySummary()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const statusMeta = getStatusMeta(form.status)
  const StatusIcon = statusMeta.icon

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <FiCalendar className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Attendance</h1>
                <p className="mt-1 text-sm font-medium text-gray-500">Create, update, and review employee attendance.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-700 ring-1 ring-gray-100">
                <FiClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-gray-400">Current Time</p>
                <p className="text-lg font-extrabold text-gray-900">
                  {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className={`${card} mb-5 p-3 sm:p-4`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex w-full rounded-2xl border border-gray-100 bg-gray-50 p-1 sm:w-auto">
              {[
                { key: "attendance", label: "Attendance", icon: FiEdit3 },
                { key: "calendar", label: "Calendar", icon: FiCalendar },
              ].map((item) => {
                const Icon = item.icon
                const active = tab === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition sm:flex-none ${
                      active ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-white hover:text-gray-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_auto] xl:w-auto">
              <input
                className={`${input} h-10`}
                type="month"
                value={viewMonth}
                onChange={(event) => {
                  setViewMonth(event.target.value)
                  const [nextYear, nextMonth] = event.target.value.split("-").map(Number)
                  if (nextYear && nextMonth) setSelectedDate(`${nextYear}-${pad(nextMonth)}-01`)
                }}
              />

              <button className={`${btn} ${btnGhost} h-10 px-3`} type="button" onClick={loadMonthlySummary} disabled={!selectedEmployeeId || loadingSummary}>
                <FiRefreshCcw className={loadingSummary ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {selectedEmployee ? (
          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cleanStats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} />
            ))}
          </section>
        ) : null}

        {tab === "attendance" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className={`${card} overflow-visible`}> 
              <div className="border-b border-gray-100 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-gray-400">Mark Attendance</p>
                    <h2 className="mt-1 text-lg font-extrabold text-gray-900">{formatLongDate(selectedDate)}</h2>
                  </div>
                  {selectedRecord ? <StatusPill status={selectedRecord.status} /> : <StatusPill status="empty" />}
                </div>
              </div>

              <form onSubmit={saveAttendance} className="space-y-5 p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Employee">
                    <EmployeePicker
                      employees={employees}
                      filteredEmployees={filteredEmployees}
                      employeeQuery={employeeQuery}
                      setEmployeeQuery={setEmployeeQuery}
                      selectedEmployee={selectedEmployee}
                      selectEmployee={selectEmployee}
                      clearSelectedEmployee={clearSelectedEmployee}
                      loadingEmployees={loadingEmployees}
                      placeholder="Search employee"
                    />
                  </Field>

                  <Field label="Date">
                    <input
                      className={input}
                      type="date"
                      value={selectedDate}
                      onChange={(event) => {
                        setSelectedDate(event.target.value)
                        selectMonthFromDate(event.target.value)
                      }}
                    />
                  </Field>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-gray-800">Status</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {STATUS_OPTIONS.map((item) => {
                      const Icon = item.icon
                      const active = form.status === item.value
                      const meta = getStatusMeta(item.value)
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            if (noTimeStatuses.includes(item.value)) {
                              setForm((prev) => ({
                                ...prev,
                                status: item.value,
                                checkIn: "",
                                checkOut: "",
                                lateMinutes: 0,
                                overtimeMinutes: 0,
                              }))
                              return
                            }

                            setForm((prev) => ({
                              ...prev,
                              status: item.value,
                              checkIn: prev.checkIn || "09:00",
                              checkOut: prev.checkOut || "18:00",
                            }))
                          }}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-extrabold transition ${
                            active ? meta.button : "border-gray-100 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Check In">
                    <input
                      className={input}
                      type="time"
                      value={form.checkIn}
                      onChange={(event) => updateForm("checkIn", event.target.value)}
                      disabled={noTimeStatuses.includes(form.status)}
                    />
                  </Field>

                  <Field label="Check Out">
                    <input
                      className={input}
                      type="time"
                      value={form.checkOut}
                      onChange={(event) => updateForm("checkOut", event.target.value)}
                      disabled={noTimeStatuses.includes(form.status)}
                    />
                  </Field>

                  <Field label="Late Minutes">
                    <input
                      className={input}
                      type="number"
                      min="0"
                      value={form.lateMinutes}
                      onChange={(event) => updateForm("lateMinutes", event.target.value)}
                    />
                  </Field>

                  <Field label="Overtime Minutes">
                    <input
                      className={input}
                      type="number"
                      min="0"
                      value={form.overtimeMinutes}
                      onChange={(event) => updateForm("overtimeMinutes", event.target.value)}
                    />
                  </Field>
                </div>

                <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                  <span className="text-sm font-semibold text-gray-800">Approve overtime for salary calculation</span>
                  <input
                    type="checkbox"
                    checked={form.isOvertimeApproved}
                    onChange={(event) => updateForm("isOvertimeApproved", event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                </label>

                <Field label="Note">
                  <textarea
                    className={textarea}
                    value={form.note}
                    onChange={(event) => updateForm("note", event.target.value)}
                    placeholder="Optional note for this attendance record"
                  />
                </Field>

                <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                    <StatusIcon className="h-4 w-4" />
                    Working time: {minutesLabel(minutesBetween(form.checkIn, form.checkOut))}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {selectedRecord ? (
                      <button className={`${btn} ${btnDanger}`} type="button" onClick={deleteSelectedAttendance} disabled={deleting || saving}>
                        <FiTrash2 />
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
                    ) : null}
                    <button className={`${btn} ${btnPrimary}`} type="submit" disabled={saving || deleting || !selectedEmployeeId}>
                      <FiSave />
                      {saving ? "Saving..." : selectedRecord ? "Update Attendance" : "Save Attendance"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <aside className={`${card} h-fit p-4 sm:p-5`}>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-indigo-500">Selected</p>
                <h3 className="mt-2 text-lg font-extrabold text-gray-900">{formatLongDate(selectedDate)}</h3>
                <p className="mt-1 text-sm font-semibold text-gray-600">
                  {selectedEmployee ? `${selectedEmployee.name} • ${employeeMeta(selectedEmployee)}` : "No employee selected"}
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-3">
                  <span className="text-sm font-semibold text-gray-600">Saved Status</span>
                  {selectedRecord ? <StatusPill status={selectedRecord.status} small /> : <StatusPill status="empty" small />}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-3">
                  <span className="text-sm font-semibold text-gray-600">Check In</span>
                  <span className="text-sm font-extrabold text-gray-900">{formatTimeAMPM(selectedRecord?.checkIn) || "—"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-3">
                  <span className="text-sm font-semibold text-gray-600">Check Out</span>
                  <span className="text-sm font-extrabold text-gray-900">{formatTimeAMPM(selectedRecord?.checkOut) || "—"}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-3">
                  <span className="text-sm font-semibold text-gray-600">Work Time</span>
                  <span className="text-sm font-extrabold text-gray-900">{minutesLabel(selectedRecord?.workMinutes)}</span>
                </div>
              </div>

              <button className={`${btn} ${btnSoft} mt-4 w-full`} type="button" onClick={() => setTab("calendar")}>
                <FiCalendar />
                Open Calendar
              </button>
            </aside>
          </section>
        ) : (
          <section className={`${card} overflow-visible`}>
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-gray-400">Monthly Calendar</p>
                <h2 className="mt-1 text-lg font-extrabold text-gray-900">{getMonthName(year, month)}</h2>
                {selectedEmployee ? (
                  <p className="mt-1 text-sm font-semibold text-gray-500">
                    {selectedEmployee.name} • {employeeMeta(selectedEmployee)}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button className={`${btn} ${btnGhost} px-3`} type="button" onClick={() => changeMonth(-1)}>
                  <FiChevronLeft />
                </button>
                <button className={`${btn} ${btnSoft}`} type="button" onClick={() => setViewMonth(toMonthInput(new Date()))}>
                  This Month
                </button>
                <button className={`${btn} ${btnGhost} px-3`} type="button" onClick={() => changeMonth(1)}>
                  <FiChevronRight />
                </button>
              </div>
            </div>

            {!selectedEmployee ? (
              <div className="flex min-h-[430px] items-center justify-center p-5">
                <div className="w-full max-w-xl rounded-3xl border border-gray-100 bg-white p-5 text-center shadow-[0_18px_44px_-34px_rgba(15,23,42,0.55)] sm:p-6">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">
                    <FiUser className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold text-gray-900">Select an employee first</h3>
                  <div className="mt-4">
                    <EmployeePicker
                      employees={employees}
                      filteredEmployees={filteredEmployees}
                      employeeQuery={employeeQuery}
                      setEmployeeQuery={setEmployeeQuery}
                      selectedEmployee={selectedEmployee}
                      selectEmployee={selectEmployee}
                      clearSelectedEmployee={clearSelectedEmployee}
                      loadingEmployees={loadingEmployees}
                      placeholder="Search employee"
                      showSelectedCard={false}
                      centered
                    />
                  </div>
                </div>
              </div>
            ) : loadingSummary ? (
              <div className="px-5 py-12 text-center text-sm font-semibold text-gray-500">Loading attendance calendar...</div>
            ) : (
              <div className="p-3 sm:p-5">
                <div className="grid grid-cols-7 gap-2 pb-2">
                  {WEEK_DAYS.map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-gray-400">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => {
                    if (cell.type === "blank") {
                      return <div key={cell.key} className="hidden min-h-[104px] rounded-2xl border border-transparent sm:block" />
                    }

                    const record = recordsByDay[cell.dayKey]
                    const meta = record ? getStatusMeta(record.status) : getStatusMeta("empty")
                    const isSelected = selectedDate === cell.dayKey

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => chooseDay(cell.dayKey, true)}
                        className={`min-h-[92px] rounded-2xl border p-2 text-left transition sm:min-h-[112px] sm:p-3 ${
                          record ? meta.card : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
                        } ${isSelected ? "ring-2 ring-indigo-500/30" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-extrabold ${cell.isToday ? "text-indigo-700" : "text-gray-900"}`}>{cell.day}</span>
                          <span className={`h-2 w-2 rounded-full ${record ? meta.dot : cell.isToday ? "bg-indigo-500" : "bg-transparent"}`} />
                        </div>

                        <div className="mt-3 hidden sm:block">
                          {record ? <StatusPill status={record.status} small /> : <span className="text-xs font-semibold text-gray-400">Click to mark</span>}
                          {formatRecordTimeRange(record) ? (
                            <p className="mt-2 truncate text-xs font-semibold text-gray-500">
                              {formatRecordTimeRange(record)}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-3 sm:hidden">
                          <span className={`block h-1.5 w-8 rounded-full ${record ? meta.dot : "bg-gray-200"}`} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {salaryImpact?.hasSalaryProfile ? (
          <section className={`${card} mt-5 p-4 sm:p-5`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Per Day Rate" value={salaryImpact.perDayRate || 0} sub="from salary profile" />
              <StatCard label="Attendance Deduction" value={salaryImpact.totalAttendanceDeduction || 0} sub="absent/leave/late" />
              <StatCard label="Overtime Earning" value={salaryImpact.totalAttendanceEarning || 0} sub="approved overtime" />
              <StatCard label="Net Impact" value={salaryImpact.netAttendanceImpact || 0} sub="earning - deduction" />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
