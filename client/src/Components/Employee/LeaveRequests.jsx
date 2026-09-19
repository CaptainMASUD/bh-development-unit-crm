"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Calendar03Icon,
  Cancel01Icon,
  RefreshIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_12px_32px_-18px_rgba(15,23,42,0.28)]"

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"

const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"

const input =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"

const label = "mb-1.5 block text-sm font-semibold text-gray-700"

const createEmptyForm = () => ({
  leaveType: "paid",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  reason: "",
})

function headers() {
  const token = localStorage.getItem("token")

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
    credentials: "include",
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.message || "Request failed")
  }

  return data
}

function pretty(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function date(value) {
  if (!value) return "-"

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) return "-"

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function daysBetween(startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}

function StatusBadge({ status }) {
  const tone =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : status === "rejected"
        ? "bg-rose-50 text-rose-700"
        : status === "cancelled"
          ? "bg-gray-100 text-gray-600"
          : "bg-amber-50 text-amber-700"

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${tone}`}>
      {pretty(status)}
    </span>
  )
}

export default function EmployeeLeaveRequests() {
  const [items, setItems] = useState([])
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(createEmptyForm)
  const [saving, setSaving] = useState(false)
  const requestedDays = useMemo(() => daysBetween(form.startDate, form.endDate), [form.startDate, form.endDate])
  const selectedRemaining =
    form.leaveType === "paid"
      ? Number(balance?.paidRemaining || 0)
      : Number(balance?.unpaidRemaining || 0)
  const exceedsBalance = requestedDays > 0 && requestedDays > selectedRemaining

  const load = async () => {
    setLoading(true)

    try {
      const data = await api(`/leaves/me?year=${new Date().getFullYear()}`)
      setItems(data.leaveRequests || [])
      setBalance(data.balance || null)
    } catch (error) {
      toast.error(error?.message || "Failed to load leaves")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openApplyModal = () => {
    setForm(createEmptyForm())
    setOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setOpen(false)
  }

  const submit = async () => {
    if (!form.reason.trim()) {
      toast.error("Reason is required.")
      return
    }
    if (!requestedDays) {
      toast.error("Please choose a valid date range.")
      return
    }
    if (exceedsBalance) {
      toast.error(`This request exceeds your remaining ${form.leaveType} leave balance.`)
      return
    }

    setSaving(true)

    try {
      await api("/leaves/me", {
        method: "POST",
        body: JSON.stringify(form),
      })

      toast.success("Leave request submitted.")
      setForm(createEmptyForm())
      setOpen(false)
      await load()
    } catch (error) {
      toast.error(error?.message || "Failed to submit leave request")
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (leave) => {
    try {
      await api(`/leaves/me/${leave._id}/cancel`, {
        method: "PATCH",
      })

      toast.success("Leave request cancelled.")
      await load()
    } catch (error) {
      toast.error(error?.message || "Cancel failed")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
              <HugeiconsIcon icon={Calendar03Icon} size={20} />
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl">
                My Leave
              </h1>

              <p className="mt-1 text-sm font-medium text-gray-500">
                Apply for paid or unpaid leave and track approval status.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={load} disabled={loading}>
              <HugeiconsIcon icon={RefreshIcon} size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button className={`${btn} ${btnPrimary}`} onClick={openApplyModal}>
              <HugeiconsIcon icon={Add01Icon} size={14} />
              Apply Leave
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-gray-500">Paid Entitlement</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-950">
            {balance?.entitlement?.paidDays || 0}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-gray-500">Paid Used</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-950">
            {balance?.paidUsed || 0}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-gray-500">Paid Remaining</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-950">
            {balance?.paidRemaining || 0}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-gray-500">Unpaid Entitlement</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-950">
            {balance?.entitlement?.unpaidDays || 0}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <p className="text-sm font-semibold text-gray-500">Unpaid Remaining</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-950">
            {balance?.unpaidRemaining || 0}
          </p>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="max-h-[66vh] overflow-auto">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-wide text-gray-500">
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Dates</th>
                <th className="px-5 py-4">Reason</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {items.map((leave) => (
                <tr key={leave._id} className="bg-white">
                  <td className="px-5 py-4 text-sm font-black text-gray-950">
                    {pretty(leave.leaveType)}
                  </td>

                  <td className="px-5 py-4 text-sm font-bold text-gray-700">
                    {date(leave.startDate)} - {date(leave.endDate)}
                    <p className="text-xs text-gray-400">
                      {leave.totalDays} day(s)
                    </p>
                  </td>

                  <td className="max-w-md px-5 py-4 text-sm font-semibold text-gray-600">
                    {leave.reason}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={leave.status} />
                  </td>

                  <td className="px-5 py-4 text-right">
                    {leave.status === "pending" ? (
                      <button
                        className={`${btn} ${btnGhost} text-rose-600`}
                        onClick={() => cancel(leave)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-gray-500">
                        {leave.adminNote || "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {!items.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm font-bold text-gray-500"
                  >
                    No leave requests yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onMouseDown={(event) => event.stopPropagation()}
              className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-white/20"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-base font-bold text-gray-950 sm:text-lg">
                    Apply for Leave
                  </h2>

                  <p className="mt-1 text-sm font-medium text-gray-500">
                    Submit your request against your current leave setup and remaining balance.
                  </p>
                </div>

                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-2xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  onClick={closeModal}
                  disabled={saving}
                  aria-label="Close modal"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto px-5 py-5 sm:px-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={label}>Leave Type</label>
                    <select
                      className={input}
                      value={form.leaveType}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          leaveType: event.target.value,
                        }))
                      }
                    >
                      <option value="paid">Paid Leave</option>
                      <option value="unpaid">Unpaid Leave</option>
                    </select>
                  </div>

                  <div>
                    <label className={label}>Start Date</label>
                    <input
                      className={input}
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className={label}>End Date</label>
                    <input
                      className={input}
                      type="date"
                      value={form.endDate}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div
                      className={`mb-2 rounded-2xl border p-3 text-sm font-semibold ${
                        exceedsBalance
                          ? "border-rose-100 bg-rose-50 text-rose-700"
                          : "border-indigo-100 bg-indigo-50 text-indigo-700"
                      }`}
                    >
                      Requesting {requestedDays || 0} day(s). Remaining {pretty(form.leaveType)} leave: {selectedRemaining} day(s).
                    </div>

                    <label className={label}>Reason</label>
                    <textarea
                      className={`${input} h-28 resize-none py-3`}
                      value={form.reason}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          reason: event.target.value,
                        }))
                      }
                      placeholder="Write the reason for leave..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button className={`${btn} ${btnGhost}`} onClick={closeModal} disabled={saving}>
                  Cancel
                </button>

                <button className={`${btn} ${btnPrimary}`} onClick={submit} disabled={saving}>
                  <HugeiconsIcon icon={SentIcon} size={14} />
                  {saving ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
