"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CreditCardIcon,
  Dollar01Icon,
  Download01Icon,
  File02Icon,
  RefreshIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import PayslipModal from "../Admin/payroll/PayslipModal"

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
          <button className={button} onClick={onRefresh} disabled={loading}><HugeiconsIcon icon={RefreshIcon} size={16} className={loading ? "animate-spin" : ""} />Refresh</button>
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
  return <Shell title="My Attendance" icon={<HugeiconsIcon icon={Calendar03Icon} size={24} />} loading={loading} error={error} onRefresh={load}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metrics.map(([label, value]) => <div key={label} className={`${card} p-5`}><p className="text-sm font-semibold text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold text-gray-900">{value}</p></div>)}
    </div>
    <div className={`${card} overflow-hidden`}><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">This Month</h2></div><div className="divide-y divide-gray-100">{(data?.records || []).map((record) => <div key={record._id} className="grid grid-cols-2 gap-3 px-5 py-3 text-sm sm:grid-cols-4"><span>{new Date(record.workDate).toLocaleDateString()}</span><span className="font-semibold capitalize">{String(record.status || "").replaceAll("_", " ")}</span><span>{record.workMinutes || 0} work minutes</span><span>{record.overtimeMinutes || 0} overtime minutes</span></div>)}{!loading && !(data?.records || []).length ? <p className="p-8 text-center text-sm text-gray-500">No attendance records this month.</p> : null}</div></div>
  </Shell>
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function EmployeePayrollPage() {
  const { data, loading, error, load } = useData("/payroll/me?limit=50")
  const [selectedPayrollId, setSelectedPayrollId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  const payrolls = data?.payrolls || []

  const getTaxDeduction = (item) =>
    Number(
      item?.taxDeduction ??
        (item?.deductions || [])
          .filter((d) => d?.source === "tax")
          .reduce((sum, d) => sum + Number(d.amount || 0), 0)
    )

  const latestPayroll = payrolls[0]
  const totalNet = payrolls.reduce((sum, p) => sum + Number(p.netPayable || 0), 0)
  const totalDeductions = payrolls.reduce((sum, p) => sum + Number(p.totalDeductions || 0), 0)
  const currency = latestPayroll?.currency || "BDT"

  const handleDownloadPdf = async (id, month, year) => {
    if (downloadingId) return
    setDownloadingId(id)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_BASE}/payroll/${id}/payslip/pdf?download=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || "Failed to download PDF")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Payslip-${year}-${String(month).padStart(2, "0")}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.message || "Could not download payslip")
    } finally {
      setDownloadingId(null)
    }
  }

  const formatPayoutTarget = (item) => {
    const method = item.paymentMethod || item.payoutSnapshot?.payoutMethod || "cash"
    if (method === "bank") {
      const acc = item.payoutSnapshot?.bankDetails?.accountNumber || item.bankAccount?.accountNumber
      const bankName = item.payoutSnapshot?.bankDetails?.bankName || item.bankAccount?.bankName || "Bank"
      const masked = acc ? `••••${String(acc).slice(-4)}` : ""
      return `${bankName} ${masked}`.trim()
    }
    if (method === "mobile_banking") {
      const provider = item.payoutSnapshot?.mfsDetails?.provider || "MFS"
      const num = item.payoutSnapshot?.mfsDetails?.walletNumber
      const masked = num ? `••••${String(num).slice(-4)}` : ""
      return `${provider.toUpperCase()} ${masked}`.trim()
    }
    return method.replace(/_/g, " ").toUpperCase()
  }

  const statusBadge = (status) => {
    const s = String(status || "draft").toLowerCase()
    if (s === "paid") {
      return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20">Paid</span>
    }
    if (s === "approved") {
      return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-600/20">Approved</span>
    }
    if (s === "reversed") {
      return <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-600/20">Reversed</span>
    }
    return <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700 ring-1 ring-gray-400/20">{s}</span>
  }

  return (
    <Shell title="My Payroll & Payslips" icon={<HugeiconsIcon icon={Dollar01Icon} size={24} />} loading={loading} error={error} onRefresh={load}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-5`}>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Latest Net Pay</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600 sm:text-3xl">
            {latestPayroll ? money(latestPayroll.netPayable, latestPayroll.currency) : "—"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {latestPayroll ? `${MONTH_NAMES[(latestPayroll.month || 1) - 1]} ${latestPayroll.year}` : "No records"}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Net Received</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-900 sm:text-3xl">
            {money(totalNet, currency)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Across {payrolls.length} payslip periods</p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Deductions & Tax</p>
          <p className="mt-2 text-2xl font-extrabold text-rose-600 sm:text-3xl">
            {money(totalDeductions, currency)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Income tax, loans & statutory deductions</p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Latest Payment Status</p>
          <div className="mt-2 flex items-center gap-2">
            {latestPayroll ? statusBadge(latestPayroll.status) : <span className="text-sm font-semibold text-gray-400">—</span>}
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {latestPayroll?.paymentDate ? `Paid on ${new Date(latestPayroll.paymentDate).toLocaleDateString()}` : "Pending or scheduled"}
          </p>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-gray-900">Payslip History</h2>
            <p className="text-xs text-gray-500">View and download your monthly snapshot-frozen salary statements</p>
          </div>
          <span className="text-xs font-semibold text-gray-400">{payrolls.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-gray-50/80">
              <tr>
                {["Period", "Gross Salary", "Tax / TDS", "Deductions", "Net Payable", "Disbursement", "Status", "Actions"].map((label) => (
                  <th key={label} className="border-b border-gray-100 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payrolls.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50/60 transition">
                  <td className="px-5 py-4">
                    <p className="font-extrabold text-gray-900">
                      {MONTH_NAMES[(item.month || 1) - 1]} {item.year}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      PAY-{item.year}{String(item.month).padStart(2, "0")}-{String(item._id).slice(-4).toUpperCase()}
                    </p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-gray-700">
                    {money(item.grossSalary, item.currency)}
                  </td>
                  <td className="px-5 py-4 font-semibold text-rose-600">
                    {money(getTaxDeduction(item), item.currency)}
                  </td>
                  <td className="px-5 py-4 font-semibold text-gray-600">
                    {money(item.totalDeductions, item.currency)}
                  </td>
                  <td className="px-5 py-4 font-black text-emerald-600">
                    {money(item.netPayable, item.currency)}
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-gray-600">
                    {formatPayoutTarget(item)}
                  </td>
                  <td className="px-5 py-4">
                    {statusBadge(item.status)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPayrollId(item._id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-indigo-600 transition"
                      >
                        <HugeiconsIcon icon={ViewIcon} size={14} />
                        View
                      </button>
                      <button
                        type="button"
                        disabled={downloadingId === item._id}
                        onClick={() => handleDownloadPdf(item._id, item.month, item.year)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-100 disabled:opacity-50 transition"
                      >
                        <HugeiconsIcon
                          icon={downloadingId === item._id ? RefreshIcon : Download01Icon}
                          size={14}
                          className={downloadingId === item._id ? "animate-spin" : ""}
                        />
                        {downloadingId === item._id ? "Saving..." : "PDF"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && !payrolls.length ? (
            <div className="p-12 text-center">
              <HugeiconsIcon icon={File02Icon} size={36} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-bold text-gray-700">No payroll records found</p>
              <p className="mt-1 text-xs text-gray-400">Monthly payslips will appear here after payroll processing.</p>
            </div>
          ) : null}
        </div>
      </div>

      <PayslipModal
        open={Boolean(selectedPayrollId)}
        payrollId={selectedPayrollId}
        onClose={() => setSelectedPayrollId(null)}
      />
    </Shell>
  )
}

export function EmployeeLoansPage() {
  const { data, loading, error, load } = useData("/employee-loans/me")
  return <Shell title="My Loans" icon={<HugeiconsIcon icon={CreditCardIcon} size={24} />} loading={loading} error={error} onRefresh={load}>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{(data?.employeeLoans || []).map((loan) => <div key={loan._id} className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-gray-900">{loan.loanNo}</p><p className="mt-1 text-sm text-gray-500">{loan.reason || "Employee loan"}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">{loan.status}</span></div><div className="mt-5 grid grid-cols-3 gap-3"><div><p className="text-xs text-gray-500">Principal</p><p className="mt-1 font-semibold">{money(loan.loanAmount, loan.currency)}</p></div><div><p className="text-xs text-gray-500">Installment</p><p className="mt-1 font-semibold">{money(loan.installmentAmount, loan.currency)}</p></div><div><p className="text-xs text-gray-500">Remaining</p><p className="mt-1 font-semibold text-rose-700">{money(loan.remainingAmount, loan.currency)}</p></div></div></div>)}{!loading && !(data?.employeeLoans || []).length ? <div className={`${card} p-10 text-center text-sm text-gray-500 lg:col-span-2`}>No employee loans available.</div> : null}</div>
  </Shell>
}

export function EmployeeRosterPage() {
  const { data, loading, error, load } = useData("/roster/me")
  return <Shell title="My Roster" icon={<HugeiconsIcon icon={Clock01Icon} size={24} />} loading={loading} error={error} onRefresh={load}>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {(data?.assignments || []).map((assignment) => <div key={assignment._id} className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold text-gray-900">{assignment.shift?.name || "Assigned Shift"}</p><p className="mt-1 text-sm text-gray-500">{assignment.shift?.startTime || "—"} - {assignment.shift?.endTime || "—"}</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">{assignment.rosterType || "roster"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-gray-500">Starts</p><p className="mt-1 font-semibold">{assignment.startDate ? new Date(assignment.startDate).toLocaleDateString() : "—"}</p></div><div><p className="text-xs text-gray-500">Ends</p><p className="mt-1 font-semibold">{assignment.endDate ? new Date(assignment.endDate).toLocaleDateString() : "Open ended"}</p></div></div></div>)}
      {!loading && !(data?.assignments || []).length ? <div className={`${card} p-10 text-center text-sm text-gray-500 lg:col-span-2`}>No active roster assignment.</div> : null}
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><div className={`${card} p-5`}><h2 className="font-bold text-gray-900">Weekly Offs</h2><div className="mt-3 space-y-2">{(data?.weeklyOffs || []).map((item) => <div key={item._id} className="rounded-xl bg-gray-50 p-3 text-sm"><span className="font-semibold">{item.name || "Weekly off"}</span><span className="ml-2 text-gray-500 capitalize">{item.offType}</span></div>)}{!(data?.weeklyOffs || []).length ? <p className="text-sm text-gray-500">No weekly off setup.</p> : null}</div></div><div className={`${card} p-5`}><h2 className="font-bold text-gray-900">Holidays</h2><div className="mt-3 space-y-2">{(data?.holidays || []).map((item) => <div key={item._id} className="flex justify-between gap-3 rounded-xl bg-gray-50 p-3 text-sm"><span className="font-semibold">{item.name}</span><span className="text-gray-500">{new Date(item.holidayDate).toLocaleDateString()}</span></div>)}{!(data?.holidays || []).length ? <p className="text-sm text-gray-500">No upcoming holidays.</p> : null}</div></div></div>
  </Shell>
}
