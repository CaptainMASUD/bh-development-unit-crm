"use client"

import { useCallback, useEffect, useState } from "react"
import { FiCalendar, FiClock, FiCreditCard, FiDollarSign, FiRefreshCcw } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"

function headers() {
  const token = localStorage.getItem("token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function get(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: headers(), credentials: "include" })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || "Request failed")
  return data
}

function money(value, currency = "BDT") {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function Shell({ title, icon, loading, error, onRefresh, children }) {
  return (
    <div className="min-h-screen bg-gray-50/60 p-4 sm:p-6">
      <div className="mx-auto max-w-[1450px] space-y-5">
        <div className={`${card} flex items-center justify-between gap-4 p-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">{icon}</div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
          <button className={button} onClick={onRefresh} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} />Refresh</button>
        </div>
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
        {children}
      </div>
    </div>
  )
}

function useData(path) {
  const [state, setState] = useState({ data: null, loading: true, error: "" })
  const load = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: "" }))
    try {
      const data = await get(path)
      setState({ data, loading: false, error: "" })
    } catch (error) {
      setState({ data: null, loading: false, error: error.message })
    }
  }, [path])
  useEffect(() => { load() }, [load])
  return { ...state, load }
}

export function EmployeeAttendancePage() {
  const today = new Date()
  const path = `/attendance/me/monthly-summary?year=${today.getFullYear()}&month=${today.getMonth() + 1}`
  const { data, loading, error, load } = useData(path)
  const summary = data?.summary || {}
  const metrics = [
    ["Present", summary.presentDays || 0], ["Late", summary.lateDays || 0],
    ["Absent", summary.absentDays || 0], ["Paid Leave", summary.paidLeaveDays || 0],
    ["Unpaid Leave", summary.unpaidLeaveDays || 0], ["Overtime Hours", summary.approvedOvertimeHours || 0],
  ]
  return <Shell title="My Attendance" icon={<FiCalendar />} loading={loading} error={error} onRefresh={load}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(([label, value]) => <div key={label} className={`${card} p-5`}><p className="text-sm font-semibold text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold text-gray-900">{value}</p></div>)}
    </div>
    <div className={`${card} overflow-hidden`}><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">This Month</h2></div><div className="divide-y divide-gray-100">{(data?.records || []).map((record) => <div key={record._id} className="grid grid-cols-2 gap-3 px-5 py-3 text-sm sm:grid-cols-4"><span>{new Date(record.workDate).toLocaleDateString()}</span><span className="font-semibold capitalize">{String(record.status || "").replaceAll("_", " ")}</span><span>{record.workMinutes || 0} work minutes</span><span>{record.overtimeMinutes || 0} overtime minutes</span></div>)}{!loading && !(data?.records || []).length ? <p className="p-8 text-center text-sm text-gray-500">No attendance records this month.</p> : null}</div></div>
  </Shell>
}

export function EmployeePayrollPage() {
  const { data, loading, error, load } = useData("/payroll/me?limit=50")
  const getTaxDeduction = (item) => Number(item?.taxDeduction ?? (item?.deductions || []).filter((deduction) => deduction?.source === "tax").reduce((sum, deduction) => sum + Number(deduction.amount || 0), 0))
  return <Shell title="My Payroll" icon={<FiDollarSign />} loading={loading} error={error} onRefresh={load}>
    <div className={`${card} overflow-x-auto`}><table className="w-full min-w-[900px] text-left"><thead className="bg-gray-50"><tr>{["Period", "Gross", "Tax / TDS", "Deductions", "Net Pay", "Status"].map((label) => <th key={label} className="border-b px-5 py-4 text-xs font-semibold uppercase text-gray-600">{label}</th>)}</tr></thead><tbody>{(data?.payrolls || []).map((item) => <tr key={item._id}><td className="border-b px-5 py-4 font-semibold">{item.month}/{item.year}</td><td className="border-b px-5 py-4">{money(item.grossSalary, item.currency)}</td><td className="border-b px-5 py-4 font-semibold text-rose-700">{money(getTaxDeduction(item), item.currency)}</td><td className="border-b px-5 py-4">{money(item.totalDeductions, item.currency)}</td><td className="border-b px-5 py-4 font-semibold text-emerald-700">{money(item.netPayable, item.currency)}</td><td className="border-b px-5 py-4 capitalize">{item.status}</td></tr>)}</tbody></table>{!loading && !(data?.payrolls || []).length ? <p className="p-10 text-center text-sm text-gray-500">No payroll records available.</p> : null}</div>
  </Shell>
}

export function EmployeeLoansPage() {
  const { data, loading, error, load } = useData("/employee-loans/me")
  return <Shell title="My Loans" icon={<FiCreditCard />} loading={loading} error={error} onRefresh={load}>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{(data?.employeeLoans || []).map((loan) => <div key={loan._id} className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-gray-900">{loan.loanNo}</p><p className="mt-1 text-sm text-gray-500">{loan.reason || "Employee loan"}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">{loan.status}</span></div><div className="mt-5 grid grid-cols-3 gap-3"><div><p className="text-xs text-gray-500">Principal</p><p className="mt-1 font-semibold">{money(loan.loanAmount, loan.currency)}</p></div><div><p className="text-xs text-gray-500">Installment</p><p className="mt-1 font-semibold">{money(loan.installmentAmount, loan.currency)}</p></div><div><p className="text-xs text-gray-500">Remaining</p><p className="mt-1 font-semibold text-rose-700">{money(loan.remainingAmount, loan.currency)}</p></div></div></div>)}{!loading && !(data?.employeeLoans || []).length ? <div className={`${card} p-10 text-center text-sm text-gray-500 lg:col-span-2`}>No employee loans available.</div> : null}</div>
  </Shell>
}

export function EmployeeRosterPage() {
  const { data, loading, error, load } = useData("/roster/me")
  return <Shell title="My Roster" icon={<FiClock />} loading={loading} error={error} onRefresh={load}>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {(data?.assignments || []).map((assignment) => <div key={assignment._id} className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold text-gray-900">{assignment.shift?.name || "Assigned Shift"}</p><p className="mt-1 text-sm text-gray-500">{assignment.shift?.startTime || "—"} - {assignment.shift?.endTime || "—"}</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">{assignment.rosterType || "roster"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-gray-500">Starts</p><p className="mt-1 font-semibold">{assignment.startDate ? new Date(assignment.startDate).toLocaleDateString() : "—"}</p></div><div><p className="text-xs text-gray-500">Ends</p><p className="mt-1 font-semibold">{assignment.endDate ? new Date(assignment.endDate).toLocaleDateString() : "Open ended"}</p></div></div></div>)}
      {!loading && !(data?.assignments || []).length ? <div className={`${card} p-10 text-center text-sm text-gray-500 lg:col-span-2`}>No active roster assignment.</div> : null}
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><div className={`${card} p-5`}><h2 className="font-bold text-gray-900">Weekly Offs</h2><div className="mt-3 space-y-2">{(data?.weeklyOffs || []).map((item) => <div key={item._id} className="rounded-xl bg-gray-50 p-3 text-sm"><span className="font-semibold">{item.name || "Weekly off"}</span><span className="ml-2 text-gray-500 capitalize">{item.offType}</span></div>)}{!(data?.weeklyOffs || []).length ? <p className="text-sm text-gray-500">No weekly off setup.</p> : null}</div></div><div className={`${card} p-5`}><h2 className="font-bold text-gray-900">Holidays</h2><div className="mt-3 space-y-2">{(data?.holidays || []).map((item) => <div key={item._id} className="flex justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm"><span className="font-semibold">{item.name}</span><span className="text-gray-500">{new Date(item.holidayDate).toLocaleDateString()}</span></div>)}{!(data?.holidays || []).length ? <p className="text-sm text-gray-500">No upcoming holidays.</p> : null}</div></div></div>
  </Shell>
}
