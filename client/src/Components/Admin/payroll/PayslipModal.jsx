"use client"

import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  Cancel01Icon,
  Download01Icon,
  PrinterIcon,
  RefreshIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

function authHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function money(value, currency = "BDT") {
  return `${currency} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(val) {
  if (!val) return "—"
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export default function PayslipModal({ open, payrollId, onClose }) {
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  const loadPayslip = useCallback(async () => {
    if (!payrollId) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/payroll/${payrollId}/payslip`, {
        headers: authHeaders(),
        credentials: "include",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || "Failed to load payslip")
      setData(body.payslip || null)
    } catch (err) {
      setError(err.message || "Failed to load payslip data")
    } finally {
      setLoading(false)
    }
  }, [payrollId])

  useEffect(() => {
    if (open && payrollId) {
      loadPayslip()
    } else {
      setData(null)
      setError("")
    }
  }, [open, payrollId, loadPayslip])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const handleDownloadPdf = async () => {
    if (!payrollId || downloading) return
    setDownloading(true)
    try {
      const token = localStorage.getItem("token")
      const res = await fetch(`${API_BASE}/payroll/${payrollId}/payslip/pdf?download=1`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || "PDF download failed")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `payslip-${data?.payrollKey || payrollId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err.message || "Failed to download PDF")
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (!open) return null

  const emp = data?.employee || {}
  const company = data?.company || {}
  const payout = data?.payoutSnapshot || {}
  const att = data?.attendanceSummary || {}
  const isReversed = data?.isReversed || data?.status === "reversed"
  const monthName = MONTH_NAMES[(data?.month || 1) - 1] || `Month ${data?.month}`
  const currency = data?.currency || "BDT"

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-payslip, #printable-payslip * {
            visibility: visible;
          }
          #printable-payslip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm no-print" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
          {/* Header Action Bar */}
          <div className="no-print flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-base font-extrabold text-gray-900">Official Payslip Preview</span>
              {data && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                    isReversed
                      ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
                      : data.status === "paid"
                      ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                  }`}
                >
                  {isReversed ? "REVERSED" : data.status}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={loading || !data}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:opacity-50"
              >
                <HugeiconsIcon icon={PrinterIcon} size={15} />
                Print
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={loading || downloading || !data}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {downloading ? (
                  <HugeiconsIcon icon={RefreshIcon} size={15} className="animate-spin" />
                ) : (
                  <HugeiconsIcon icon={Download01Icon} size={15} />
                )}
                {downloading ? "Preparing..." : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={20} />
              </button>
            </div>
          </div>

          {/* Modal Body / Printable Document */}
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-6 sm:p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <HugeiconsIcon icon={RefreshIcon} size={32} className="animate-spin text-indigo-600" />
                <p className="mt-3 text-sm font-bold">Loading payslip record...</p>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-700">
                {error}
              </div>
            ) : data ? (
              <div id="printable-payslip" className="bg-white text-gray-900">
                {/* 1. Company Header */}
                <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-start">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-indigo-950 sm:text-2xl">
                      {company.name || "Organization"}
                    </h1>
                    {company.address?.city ? (
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        {[company.address.line1, company.address.city, company.address.country].filter(Boolean).join(", ")}
                      </p>
                    ) : null}
                    {(company.phone || company.email) && (
                      <p className="mt-0.5 text-xs font-semibold text-gray-500">
                        {[company.phone, company.email].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="inline-block rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1 text-xs font-black text-indigo-800">
                      SALARY SLIP
                    </span>
                    <p className="mt-1.5 text-sm font-extrabold text-gray-900">
                      {monthName.toUpperCase()} {data.year}
                    </p>
                    <p className="text-xs font-mono text-gray-500">{data.payrollKey}</p>
                  </div>
                </div>

                {/* 2. Reversed Warning Banner */}
                {isReversed && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-rose-400 bg-rose-50/90 p-4 text-rose-900">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                      <HugeiconsIcon icon={Alert02Icon} size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black tracking-wider text-rose-700">
                        REVERSED PAYROLL RECORD
                      </p>
                      <p className="text-xs font-semibold text-rose-800">
                        This payroll record was reversed on {formatDate(data.reversedAt)}.
                        {data.reversalReason ? ` Reason: "${data.reversalReason}"` : ""}
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Employee & Payment Information Grid */}
                <div className="mt-5 rounded-2xl border border-gray-100 bg-[#f8fafc] p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Employee Name
                      </span>
                      <span className="mt-1 block text-sm font-black text-gray-900">{emp.name || "—"}</span>
                      <span className="text-xs font-semibold text-gray-500">{emp.employeeId || emp.email || "—"}</span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Department & Role
                      </span>
                      <span className="mt-1 block text-sm font-black text-gray-900">{emp.department || "General"}</span>
                      <span className="text-xs font-semibold text-gray-500">{emp.position || "Staff"}</span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Pay Period
                      </span>
                      <span className="mt-1 block text-sm font-black text-gray-900">
                        {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
                      </span>
                      <span className="text-xs font-semibold text-gray-500">
                        Paid: {formatDate(data.paymentDate)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Disbursement Mode
                      </span>
                      <span className="mt-1 block text-sm font-black capitalize text-gray-900">
                        {payout.preferredPayoutMethod || data.paymentMethod || "Cash"}
                      </span>
                      <span className="text-xs font-semibold text-gray-500">
                        {payout.bankName
                          ? `${payout.bankName} (${payout.accountNumber})`
                          : payout.mfsProvider
                          ? `${payout.mfsProvider} (${payout.mfsNumber})`
                          : "Cash Handover"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Attendance Summary Bar */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white p-3 text-center sm:grid-cols-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Present</span>
                    <p className="mt-0.5 text-base font-black text-gray-900">{att.presentDays ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Late</span>
                    <p className="mt-0.5 text-base font-black text-amber-600">{att.lateDays ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Paid Leave</span>
                    <p className="mt-0.5 text-base font-black text-indigo-600">{att.paidLeaveDays ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Unpaid Leave</span>
                    <p className="mt-0.5 text-base font-black text-rose-600">{att.unpaidLeaveDays ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Absent</span>
                    <p className="mt-0.5 text-base font-black text-rose-600">{att.absentDays ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">OT Hours</span>
                    <p className="mt-0.5 text-base font-black text-emerald-600">{att.approvedOvertimeHours ?? 0}</p>
                  </div>
                </div>

                {/* 5. Earnings & Deductions Tables */}
                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {/* Earnings */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="flex items-center justify-between bg-indigo-900 px-4 py-2.5 text-white">
                      <span className="text-xs font-black uppercase tracking-wider">Earnings & Allowances</span>
                      <span className="text-xs font-black uppercase tracking-wider">Amount</span>
                    </div>
                    <div className="divide-y divide-gray-100 bg-white text-xs font-semibold">
                      <div className="flex justify-between px-4 py-2.5">
                        <span>
                          Basic Salary
                          {data.salarySnapshot?.isProrated && data.salarySnapshot?.activeDays ? (
                            <span className="ml-1 text-[11px] font-normal text-gray-500">
                              (Prorated {data.salarySnapshot.activeDays}/{data.salarySnapshot.totalDaysInMonth || 30}d)
                            </span>
                          ) : null}
                        </span>
                        <span className="font-bold">{money(data.basicSalary, currency)}</span>
                      </div>
                      {(data.earnings || [])
                        .filter((e) => e.source !== "basic_salary")
                        .map((earning, i) => (
                          <div key={i} className="flex justify-between px-4 py-2.5">
                            <span>{earning.name}</span>
                            <span className="font-bold">{money(earning.amount, currency)}</span>
                          </div>
                        ))}
                    </div>
                    <div className="flex justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs font-black text-gray-900">
                      <span>Total Gross Earnings</span>
                      <span className="text-sm font-black text-indigo-700">{money(data.grossSalary, currency)}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="flex items-center justify-between bg-slate-800 px-4 py-2.5 text-white">
                      <span className="text-xs font-black uppercase tracking-wider">Deductions & Adjustments</span>
                      <span className="text-xs font-black uppercase tracking-wider">Amount</span>
                    </div>
                    <div className="divide-y divide-gray-100 bg-white text-xs font-semibold">
                      {(data.deductions || []).map((deduction, i) => (
                        <div key={i} className="flex justify-between px-4 py-2.5">
                          <span>{deduction.name}</span>
                          <span className="font-bold text-rose-600">{money(deduction.amount, currency)}</span>
                        </div>
                      ))}
                      {(!data.deductions || data.deductions.length === 0) && Number(data.taxDeduction || 0) > 0 ? (
                        <div className="flex justify-between px-4 py-2.5">
                          <span>Tax Deduction / TDS</span>
                          <span className="font-bold text-rose-600">{money(data.taxDeduction, currency)}</span>
                        </div>
                      ) : null}
                      {(!data.deductions || data.deductions.length === 0) && Number(data.totalDeductions || 0) === 0 ? (
                        <div className="px-4 py-2.5 text-gray-400 italic">No deductions recorded</div>
                      ) : null}
                    </div>
                    <div className="flex justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs font-black text-gray-900">
                      <span>Total Deductions</span>
                      <span className="text-sm font-black text-rose-600">{money(data.totalDeductions, currency)}</span>
                    </div>
                  </div>
                </div>

                {/* 6. Net Payable Banner */}
                <div
                  className={`mt-5 rounded-2xl border-2 p-5 ${
                    isReversed ? "border-rose-400 bg-rose-50/60" : "border-indigo-600 bg-indigo-50/50"
                  }`}
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          isReversed ? "text-rose-700" : "text-indigo-700"
                        }`}
                      >
                        Net Payable Salary
                      </span>
                      <p
                        className={`mt-1 text-2xl font-black sm:text-3xl ${
                          isReversed ? "text-rose-700" : "text-gray-950"
                        }`}
                      >
                        {money(data.netPayable, currency)}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                        Amount in Words
                      </span>
                      <p className="mt-1 text-xs font-extrabold italic text-gray-700">
                        {data.netSalaryInWords || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 7. Signatures & Authorization Section */}
                <div className="mt-12 grid grid-cols-2 gap-6 pt-6 text-center sm:grid-cols-4">
                  <div className="border-t border-gray-300 pt-2">
                    <p className="text-xs font-bold text-gray-900">Prepared By</p>
                    <p className="text-[11px] text-gray-500">Payroll Officer</p>
                  </div>
                  <div className="border-t border-gray-300 pt-2">
                    <p className="text-xs font-bold text-gray-900">Verified By</p>
                    <p className="text-[11px] text-gray-500">HR Compliance</p>
                  </div>
                  <div className="border-t border-gray-300 pt-2">
                    <p className="text-xs font-bold text-gray-900">Approved By</p>
                    <p className="text-[11px] text-gray-500">Finance & Accounts</p>
                  </div>
                  <div className="border-t border-gray-300 pt-2">
                    <p className="text-xs font-bold text-gray-900">Received By</p>
                    <p className="text-[11px] text-gray-500">Employee Signature</p>
                  </div>
                </div>

                {/* Footer Note */}
                <div className="mt-8 border-t border-gray-100 pt-3 text-center text-[11px] font-semibold text-gray-400">
                  This payslip is a system-generated record from the finalized payroll snapshot. Confidential document.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
