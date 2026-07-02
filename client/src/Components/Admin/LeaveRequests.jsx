"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiCalendar, FiCheck, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_12px_32px_-18px_rgba(15,23,42,0.28)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const input = "h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"

function headers() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Request failed")
  return data
}

function pretty(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function date(value) {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function StatusBadge({ status }) {
  const tone =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : status === "rejected"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : status === "cancelled"
      ? "bg-gray-100 text-gray-600 ring-gray-200"
      : "bg-amber-50 text-amber-700 ring-amber-100"
  return <span className={`rounded-full px-3 py-1 text-xs font-extrabold ring-1 ${tone}`}>{pretty(status)}</span>
}

export default function LeaveRequests() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("pending")
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [noteById, setNoteById] = useState({})
  const [reviewingId, setReviewingId] = useState("")

  const filtered = useMemo(() => items, [items])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== "all") params.set("status", status)
      if (year) params.set("year", year)
      params.set("limit", "100")
      const data = await api(`/leaves?${params.toString()}`)
      setItems(data.leaveRequests || [])
    } catch (error) {
      toast.error(error?.message || "Failed to load leave requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, year])

  const review = async (leave, nextStatus) => {
    setReviewingId(leave._id)
    try {
      await api(`/leaves/${leave._id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, adminNote: noteById[leave._id] || "" }),
      })
      toast.success(`Leave ${nextStatus}.`)
      await load()
    } catch (error) {
      toast.error(error?.message || "Review failed")
    } finally {
      setReviewingId("")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-6`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <FiCalendar className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-gray-950">Leave Requests</h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">Review employee paid and unpaid leave requests.</p>
            </div>
          </div>
          <button className={`${btn} ${btnGhost}`} onClick={load} disabled={loading}>
            <FiRefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px_160px]">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-400">
            <FiSearch className="h-4 w-4" />
            <span className="text-sm font-semibold">Search is handled by filters</span>
          </div>
          <select className={input} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
          <input className={input} type="number" value={year} onChange={(event) => setYear(event.target.value)} />
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="max-h-[68vh] overflow-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-wide text-gray-500">
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Dates</th>
                <th className="px-5 py-4">Reason</th>
                <th className="px-5 py-4">Status</th>
                <th className="sticky right-0 bg-gray-50 px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((leave) => (
                <tr key={leave._id} className="bg-white align-top">
                  <td className="px-5 py-4">
                    <p className="font-black text-gray-950">{leave.employee?.name || "Employee"}</p>
                    <p className="text-sm font-semibold text-gray-500">{leave.employee?.employeeId || leave.employee?.email || "-"}</p>
                    <p className="text-xs font-bold text-gray-400">{leave.employee?.department?.name || "-"} • {leave.employee?.position?.title || "-"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${leave.leaveType === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {pretty(leave.leaveType)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-700">
                    {date(leave.startDate)} - {date(leave.endDate)}
                    <p className="mt-1 text-xs font-extrabold text-gray-400">{leave.totalDays} day(s)</p>
                  </td>
                  <td className="max-w-md px-5 py-4 text-sm font-semibold text-gray-600">{leave.reason}</td>
                  <td className="px-5 py-4"><StatusBadge status={leave.status} /></td>
                  <td className="sticky right-0 bg-white px-5 py-4">
                    {leave.status === "pending" ? (
                      <div className="flex min-w-[280px] flex-col gap-2">
                        <input
                          className={input}
                          placeholder="Admin note (optional)"
                          value={noteById[leave._id] || ""}
                          onChange={(event) => setNoteById((prev) => ({ ...prev, [leave._id]: event.target.value }))}
                        />
                        <div className="flex justify-end gap-2">
                          <button className={`${btn} ${btnGhost} text-rose-600`} disabled={reviewingId === leave._id} onClick={() => review(leave, "rejected")}>
                            <FiX className="h-4 w-4" /> Reject
                          </button>
                          <button className={`${btn} ${btnPrimary}`} disabled={reviewingId === leave._id} onClick={() => review(leave, "approved")}>
                            <FiCheck className="h-4 w-4" /> Approve
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-right text-sm font-semibold text-gray-500">{leave.adminNote || "No action available"}</p>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm font-bold text-gray-500">
                    No leave requests found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
