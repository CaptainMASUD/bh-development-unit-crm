"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiRefreshCcw,
  FiSave,
  FiTrash2,
  FiUsers,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-[#f6f7fb]"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const textarea = "min-h-[88px] w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

const dayOptions = [
  ["0", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
]

const emptyShift = { name: "", startTime: "09:00", endTime: "18:00", breakMinutes: 60, graceMinutes: 10, overtimeAfterMinutes: 0, isActive: true, note: "" }
const emptyAssignment = { employee: "", shift: "", rosterType: "weekly", startDate: new Date().toISOString().slice(0, 10), endDate: "", weekdays: [0, 1, 2, 3, 4], monthDays: [], isActive: true, note: "" }
const emptyWeeklyOff = { name: "", scope: "company", employee: "", offType: "fixed", fixedDays: [5], customDate: "", rotationStartDate: "", rotationCycleDays: 7, rotationOffDays: [5], paid: true, isActive: true }
const emptyHoliday = { name: "", holidayDate: new Date().toISOString().slice(0, 10), holidayType: "paid", appliesTo: "company", department: "", employee: "", note: "", isActive: true }

function authHeaders() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
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

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-extrabold text-gray-900">{label}</span>{children}</label>
}

function ToggleDays({ value = [], onChange, type = "week" }) {
  const options = type === "month" ? Array.from({ length: 31 }, (_, index) => [String(index + 1), String(index + 1)]) : dayOptions
  const set = new Set((value || []).map(Number))
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([raw, label]) => {
        const n = Number(raw)
        const active = set.has(n)
        return (
          <button
            key={raw}
            type="button"
            className={`rounded-xl px-3 py-2 text-xs font-extrabold ring-1 transition ${active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"}`}
            onClick={() => onChange(active ? value.filter((item) => Number(item) !== n) : [...value, n])}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Badge({ children, tone = "gray" }) {
  const styles = {
    gray: "bg-gray-100 text-gray-700 ring-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/10",
    rose: "bg-rose-50 text-rose-700 ring-rose-600/10",
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${styles[tone]}`}>{children}</span>
}

function employeeLabel(employee) {
  return employee ? `${employee.name || employee.email || "Employee"}${employee.employeeId ? ` • ${employee.employeeId}` : ""}` : "Employee"
}

function dayNames(days = []) {
  return days.map((day) => dayOptions.find(([value]) => Number(value) === Number(day))?.[1]?.slice(0, 3)).filter(Boolean).join(", ") || "-"
}

export default function RosterShiftSetup() {
  const [tab, setTab] = useState("shifts")
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [assignments, setAssignments] = useState([])
  const [weeklyOffs, setWeeklyOffs] = useState([])
  const [holidays, setHolidays] = useState([])

  const [shiftForm, setShiftForm] = useState(emptyShift)
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignment)
  const [weeklyOffForm, setWeeklyOffForm] = useState(emptyWeeklyOff)
  const [holidayForm, setHolidayForm] = useState(emptyHoliday)
  const tabs = [
    ["shifts", "Shift Setup", FiClock],
    ["assign", "Employee Roster Assign", FiUsers],
    ["weekly-off", "Weekly Off Setup", FiCalendar],
    ["holidays", "Holiday Setup", FiBriefcase],
  ]

  const loadAll = async () => {
    setLoading(true)
    try {
      const [emp, shiftData, assignmentData, offData, holidayData] = await Promise.all([
        api("/users/employees?limit=100"),
        api("/roster/shifts"),
        api("/roster/assignments"),
        api("/roster/weekly-offs"),
        api(`/roster/holidays?year=${new Date().getFullYear()}`),
      ])
      setEmployees(emp.employees || [])
      setShifts(shiftData.shifts || [])
      setAssignments(assignmentData.rosterAssignments || [])
      setWeeklyOffs(offData.weeklyOffs || [])
      setHolidays(holidayData.holidays || [])
    } catch (error) {
      toast.error(error.message || "Failed to load roster setup")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const saveShift = async (event) => {
    event.preventDefault()
    try {
      await api("/roster/shifts", { method: "POST", body: JSON.stringify(shiftForm) })
      toast.success("Shift created")
      setShiftForm(emptyShift)
      loadAll()
    } catch (error) {
      toast.error(error.message || "Shift create failed")
    }
  }

  const saveAssignment = async (event) => {
    event.preventDefault()
    try {
      const payload = { ...assignmentForm, endDate: assignmentForm.endDate || null }
      await api("/roster/assignments", { method: "POST", body: JSON.stringify(payload) })
      toast.success("Roster assigned")
      setAssignmentForm(emptyAssignment)
      loadAll()
    } catch (error) {
      toast.error(error.message || "Roster assign failed")
    }
  }

  const saveWeeklyOff = async (event) => {
    event.preventDefault()
    try {
      const payload = {
        ...weeklyOffForm,
        employee: weeklyOffForm.scope === "employee" ? weeklyOffForm.employee : null,
        customDates: weeklyOffForm.customDate ? [{ date: weeklyOffForm.customDate, paid: weeklyOffForm.paid }] : [],
      }
      await api("/roster/weekly-offs", { method: "POST", body: JSON.stringify(payload) })
      toast.success("Weekly off setup created")
      setWeeklyOffForm(emptyWeeklyOff)
      loadAll()
    } catch (error) {
      toast.error(error.message || "Weekly off create failed")
    }
  }

  const saveHoliday = async (event) => {
    event.preventDefault()
    try {
      await api("/roster/holidays", { method: "POST", body: JSON.stringify(holidayForm) })
      toast.success("Holiday created")
      setHolidayForm(emptyHoliday)
      loadAll()
    } catch (error) {
      toast.error(error.message || "Holiday create failed")
    }
  }

  const remove = async (path, label) => {
    if (!window.confirm(`Delete ${label}?`)) return
    try {
      await api(path, { method: "DELETE" })
      toast.success("Deleted")
      loadAll()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.isActive !== false), [employees])

  return (
    <div className={shell}>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className={`${card} mb-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiCalendar /></div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Roster / Shift Setup</h1>
                <p className="mt-1 text-sm font-semibold text-gray-500">Manage shifts, employee rosters, weekly offs, and holidays.</p>
              </div>
            </div>
            <button className={`${btn} ${btnGhost}`} onClick={loadAll} type="button"><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>
          </div>
        </div>

        <div className="mb-5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5">
          <div className="flex min-w-max gap-1">
            {tabs.map(([key, label, Icon]) => (
              <button key={key} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${tab === key ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`} onClick={() => setTab(key)} type="button">
                <Icon /> {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "shifts" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={saveShift} className={`${card} space-y-4 p-4 sm:p-5`}>
              <h2 className="text-lg font-extrabold text-gray-900">Create Shift</h2>
              <Field label="Shift name"><input required className={input} value={shiftForm.name} onChange={(e) => setShiftForm((p) => ({ ...p, name: e.target.value }))} placeholder="Morning Shift" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start time"><input className={input} type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm((p) => ({ ...p, startTime: e.target.value }))} /></Field>
                <Field label="End time"><input className={input} type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm((p) => ({ ...p, endTime: e.target.value }))} /></Field>
                <Field label="Break time (minutes)"><input className={input} type="number" min="0" value={shiftForm.breakMinutes} onChange={(e) => setShiftForm((p) => ({ ...p, breakMinutes: e.target.value }))} /></Field>
                <Field label="Grace time (minutes)"><input className={input} type="number" min="0" value={shiftForm.graceMinutes} onChange={(e) => setShiftForm((p) => ({ ...p, graceMinutes: e.target.value }))} /></Field>
              </div>
              <Field label="Overtime starts after end time (minutes)"><input className={input} type="number" min="0" value={shiftForm.overtimeAfterMinutes} onChange={(e) => setShiftForm((p) => ({ ...p, overtimeAfterMinutes: e.target.value }))} /></Field>
              <Field label="Note"><textarea className={textarea} value={shiftForm.note} onChange={(e) => setShiftForm((p) => ({ ...p, note: e.target.value }))} /></Field>
              <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave /> Save Shift</button>
            </form>
            <DataTable headers={["Shift", "Time", "Break", "Grace", "Status", ""]}>
              {shifts.map((shift) => (
                <tr key={shift._id}>
                  <Cell strong>{shift.name}</Cell>
                  <Cell>{shift.startTime} - {shift.endTime}</Cell>
                  <Cell>{shift.breakMinutes || 0} min</Cell>
                  <Cell>{shift.graceMinutes || 0} min</Cell>
                  <Cell><Badge tone={shift.isActive ? "emerald" : "gray"}>{shift.isActive ? "Active" : "Inactive"}</Badge></Cell>
                  <Cell right><button className="text-rose-600" onClick={() => remove(`/roster/shifts/${shift._id}`, shift.name)}><FiTrash2 /></button></Cell>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : null}

        {tab === "assign" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
            <form onSubmit={saveAssignment} className={`${card} space-y-4 p-4 sm:p-5`}>
              <h2 className="text-lg font-extrabold text-gray-900">Assign Employee To Shift</h2>
              <Field label="Employee"><select required className={input} value={assignmentForm.employee} onChange={(e) => setAssignmentForm((p) => ({ ...p, employee: e.target.value }))}><option value="">Select employee</option>{activeEmployees.map((employee) => <option key={employee._id} value={employee._id}>{employeeLabel(employee)}</option>)}</select></Field>
              <Field label="Shift"><select required className={input} value={assignmentForm.shift} onChange={(e) => setAssignmentForm((p) => ({ ...p, shift: e.target.value }))}><option value="">Select shift</option>{shifts.filter((s) => s.isActive !== false).map((shift) => <option key={shift._id} value={shift._id}>{shift.name}</option>)}</select></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Roster type"><select className={input} value={assignmentForm.rosterType} onChange={(e) => setAssignmentForm((p) => ({ ...p, rosterType: e.target.value }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></Field>
                <Field label="Start date"><input className={input} type="date" value={assignmentForm.startDate} onChange={(e) => setAssignmentForm((p) => ({ ...p, startDate: e.target.value }))} /></Field>
                <Field label="End date"><input className={input} type="date" value={assignmentForm.endDate} onChange={(e) => setAssignmentForm((p) => ({ ...p, endDate: e.target.value }))} /></Field>
              </div>
              {assignmentForm.rosterType === "weekly" ? <Field label="Weekly roster days"><ToggleDays value={assignmentForm.weekdays} onChange={(days) => setAssignmentForm((p) => ({ ...p, weekdays: days }))} /></Field> : null}
              {assignmentForm.rosterType === "monthly" ? <Field label="Monthly roster dates"><ToggleDays type="month" value={assignmentForm.monthDays} onChange={(days) => setAssignmentForm((p) => ({ ...p, monthDays: days }))} /></Field> : null}
              <Field label="Note"><textarea className={textarea} value={assignmentForm.note} onChange={(e) => setAssignmentForm((p) => ({ ...p, note: e.target.value }))} /></Field>
              <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave /> Assign Roster</button>
            </form>
            <DataTable headers={["Employee", "Shift", "Type", "Days", "Date Range", ""]}>
              {assignments.map((item) => (
                <tr key={item._id}>
                  <Cell strong>{employeeLabel(item.employee)}</Cell>
                  <Cell>{item.shift?.name || "-"}</Cell>
                  <Cell><Badge tone="indigo">{item.rosterType}</Badge></Cell>
                  <Cell>{item.rosterType === "weekly" ? dayNames(item.weekdays) : item.rosterType === "monthly" ? item.monthDays?.join(", ") : "Every day"}</Cell>
                  <Cell>{String(item.startDate || "").slice(0, 10)} - {item.endDate ? String(item.endDate).slice(0, 10) : "Open"}</Cell>
                  <Cell right><button className="text-rose-600" onClick={() => remove(`/roster/assignments/${item._id}`, "roster assignment")}><FiTrash2 /></button></Cell>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : null}

        {tab === "weekly-off" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
            <form onSubmit={saveWeeklyOff} className={`${card} space-y-4 p-4 sm:p-5`}>
              <h2 className="text-lg font-extrabold text-gray-900">Weekly Off Setup</h2>
              <Field label="Name"><input className={input} value={weeklyOffForm.name} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, name: e.target.value }))} placeholder="Friday Off" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Scope"><select className={input} value={weeklyOffForm.scope} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, scope: e.target.value }))}><option value="company">Company</option><option value="employee">Employee</option></select></Field>
                <Field label="Off type"><select className={input} value={weeklyOffForm.offType} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, offType: e.target.value }))}><option value="fixed">Fixed off day</option><option value="custom">Custom off day</option><option value="rotating">Rotating off day</option></select></Field>
              </div>
              {weeklyOffForm.scope === "employee" ? <Field label="Employee"><select required className={input} value={weeklyOffForm.employee} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, employee: e.target.value }))}><option value="">Select employee</option>{activeEmployees.map((employee) => <option key={employee._id} value={employee._id}>{employeeLabel(employee)}</option>)}</select></Field> : null}
              {weeklyOffForm.offType === "fixed" ? <Field label="Fixed off day"><ToggleDays value={weeklyOffForm.fixedDays} onChange={(days) => setWeeklyOffForm((p) => ({ ...p, fixedDays: days }))} /></Field> : null}
              {weeklyOffForm.offType === "custom" ? <Field label="Custom off date"><input className={input} type="date" value={weeklyOffForm.customDate} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, customDate: e.target.value }))} /></Field> : null}
              {weeklyOffForm.offType === "rotating" ? <div className="grid grid-cols-2 gap-3"><Field label="Rotation start"><input className={input} type="date" value={weeklyOffForm.rotationStartDate} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, rotationStartDate: e.target.value }))} /></Field><Field label="Cycle days"><input className={input} type="number" min="1" value={weeklyOffForm.rotationCycleDays} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, rotationCycleDays: e.target.value }))} /></Field></div> : null}
              <label className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm font-extrabold text-gray-800"><span>Paid off day</span><input type="checkbox" checked={weeklyOffForm.paid} onChange={(e) => setWeeklyOffForm((p) => ({ ...p, paid: e.target.checked }))} /></label>
              <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave /> Save Weekly Off</button>
            </form>
            <DataTable headers={["Name", "Scope", "Type", "Days / Date", "Paid", ""]}>
              {weeklyOffs.map((item) => (
                <tr key={item._id}>
                  <Cell strong>{item.name || "Weekly Off"}</Cell>
                  <Cell>{item.scope === "employee" ? employeeLabel(item.employee) : "Company"}</Cell>
                  <Cell><Badge tone="indigo">{item.offType}</Badge></Cell>
                  <Cell>{item.offType === "fixed" ? dayNames(item.fixedDays) : item.offType === "custom" ? `${item.customDates?.length || 0} custom date(s)` : `${item.rotationCycleDays} day cycle`}</Cell>
                  <Cell><Badge tone={item.paid ? "emerald" : "rose"}>{item.paid ? "Paid" : "Unpaid"}</Badge></Cell>
                  <Cell right><button className="text-rose-600" onClick={() => remove(`/roster/weekly-offs/${item._id}`, "weekly off")}><FiTrash2 /></button></Cell>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : null}

        {tab === "holidays" ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={saveHoliday} className={`${card} space-y-4 p-4 sm:p-5`}>
              <h2 className="text-lg font-extrabold text-gray-900">Company Holiday</h2>
              <Field label="Holiday name"><input required className={input} value={holidayForm.name} onChange={(e) => setHolidayForm((p) => ({ ...p, name: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Holiday date"><input required className={input} type="date" value={holidayForm.holidayDate} onChange={(e) => setHolidayForm((p) => ({ ...p, holidayDate: e.target.value }))} /></Field>
                <Field label="Type"><select className={input} value={holidayForm.holidayType} onChange={(e) => setHolidayForm((p) => ({ ...p, holidayType: e.target.value }))}><option value="paid">Paid holiday</option><option value="unpaid">Unpaid holiday</option></select></Field>
              </div>
              <Field label="Note"><textarea className={textarea} value={holidayForm.note} onChange={(e) => setHolidayForm((p) => ({ ...p, note: e.target.value }))} /></Field>
              <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave /> Save Holiday</button>
            </form>
            <DataTable headers={["Holiday", "Date", "Type", "Note", ""]}>
              {holidays.map((item) => (
                <tr key={item._id}>
                  <Cell strong>{item.name}</Cell>
                  <Cell>{String(item.holidayDate || "").slice(0, 10)}</Cell>
                  <Cell><Badge tone={item.holidayType === "paid" ? "emerald" : "rose"}>{item.holidayType}</Badge></Cell>
                  <Cell>{item.note || "-"}</Cell>
                  <Cell right><button className="text-rose-600" onClick={() => remove(`/roster/holidays/${item._id}`, item.name)}><FiTrash2 /></button></Cell>
                </tr>
              ))}
            </DataTable>
          </section>
        ) : null}

      </div>
    </div>
  )
}

function DataTable({ headers, children }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>{headers.map((head) => <th key={head} className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-xs font-extrabold uppercase tracking-[0.06em] text-gray-600">{head}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

function Cell({ children, strong = false, right = false }) {
  return <td className={`border-b border-gray-100 px-5 py-4 text-sm ${right ? "text-right" : ""} ${strong ? "font-extrabold text-gray-900" : "font-semibold text-gray-600"}`}>{children}</td>
}
