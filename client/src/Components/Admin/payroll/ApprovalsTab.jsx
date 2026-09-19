"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Dollar01Icon,
  FilterIcon,
  PencilEdit02Icon,
  RefreshIcon,
  RotateLeft01Icon,
  Search01Icon,
  Settings01Icon,
  Shield01Icon,
  UserIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card = "rounded-2xl border border-gray-200 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const tableCard = "rounded-[10px] border border-gray-200 bg-white shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "bg-rose-600 text-white hover:bg-rose-700"
const btnSoft = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 hover:bg-indigo-100"
const input = "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

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

function money(value, currency = "BDT") {
  return `${currency} ${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
}

function formatDateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StageBadge({ stageName, status, sequence }) {
  let tone = "bg-gray-100 text-gray-700 ring-gray-600/10"
  if (status === "approved") tone = "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
  else if (status === "in_progress" || status === "in_review" || status === "submitted")
    tone = "bg-amber-50 text-amber-700 ring-amber-600/20"
  else if (status === "sent_back") tone = "bg-indigo-50 text-indigo-700 ring-indigo-600/20"
  else if (status === "rejected") tone = "bg-rose-50 text-rose-700 ring-rose-600/20"

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${tone}`}>
      {sequence ? <span className="text-[10px] opacity-75">#{sequence}</span> : null}
      <span className="truncate max-w-[140px]">{stageName || "Review"}</span>
    </span>
  )
}

function WorkflowStatusBadge({ status }) {
  const styles = {
    draft: "bg-gray-100 text-gray-700 ring-gray-600/10",
    submitted: "bg-sky-50 text-sky-700 ring-sky-600/20",
    in_review: "bg-amber-50 text-amber-700 ring-amber-600/20",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    sent_back: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
  }
  const labels = {
    draft: "Draft",
    submitted: "Submitted",
    in_review: "In Review",
    approved: "Approved",
    sent_back: "Sent Back",
    rejected: "Rejected",
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${styles[status] || styles.draft}`}>
      {labels[status] || status || "Draft"}
    </span>
  )
}

export default function ApprovalsTab({
  departments = [],
  onOpenPayslip,
  onDownloadPdf,
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tabFilter, setTabFilter] = useState("awaiting_my_review")
  const [department, setDepartment] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [metrics, setMetrics] = useState({
    totalPeriodCount: 0,
    totalNetPayable: 0,
    awaitingMyReview: 0,
    pendingFinalApproval: 0,
    approved: 0,
    sentBack: 0,
  })

  const [selectedIds, setSelectedIds] = useState([])
  const [reviewDrawerPayroll, setReviewDrawerPayroll] = useState(null)
  const [workflowSettingsOpen, setWorkflowSettingsOpen] = useState(false)

  // Modals for single actions
  const [actionModal, setActionModal] = useState({
    open: false,
    type: "", // 'approve' | 'send_back' | 'reject'
    payroll: null,
    reason: "",
    loading: false,
  })

  // Bulk action states
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)

  const loadApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        page: String(page),
        limit: String(limit),
      })
      if (tabFilter && tabFilter !== "all") params.set("tab", tabFilter)
      if (department) params.set("department", department)
      if (search.trim()) params.set("search", search.trim())

      const res = await api(`/payroll/approvals?${params.toString()}`)
      setItems(res.items || [])
      setTotal(res.total || 0)
      if (res.metrics) setMetrics(res.metrics)
    } catch (err) {
      toast.error(err.message || "Failed to load approval requests")
    } finally {
      setLoading(false)
    }
  }, [year, month, tabFilter, department, search, page, limit])

  useEffect(() => {
    loadApprovals()
  }, [loadApprovals])

  const totalPages = Math.ceil(total / limit) || 1

  // Handle single action submission
  const executeAction = async () => {
    const { type, payroll, reason } = actionModal
    if (!payroll) return

    if ((type === "send_back" || type === "reject") && !reason.trim()) {
      toast.error(`A reason is required to ${type === "send_back" ? "send back" : "reject"} payroll.`)
      return
    }

    setActionModal((prev) => ({ ...prev, loading: true }))
    try {
      if (type === "approve") {
        await api(`/payroll/${payroll._id}/approve`, {
          method: "POST",
          body: JSON.stringify({ comments: reason.trim() }),
        })
        toast.success("Payroll stage approved successfully")
      } else if (type === "send_back") {
        await api(`/payroll/${payroll._id}/send-back`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        })
        toast.success("Payroll sent back to preparer for revision")
      } else if (type === "reject") {
        await api(`/payroll/${payroll._id}/reject`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        })
        toast.success("Payroll rejected")
      }

      setActionModal({ open: false, type: "", payroll: null, reason: "", loading: false })
      if (reviewDrawerPayroll && reviewDrawerPayroll._id === payroll._id) {
        setReviewDrawerPayroll(null)
      }
      loadApprovals()
    } catch (err) {
      toast.error(err.message || "Action failed")
      setActionModal((prev) => ({ ...prev, loading: false }))
    }
  }

  // Bulk Submit
  const handleBulkSubmit = async () => {
    if (!window.confirm(`Submit all eligible calculated payrolls for ${MONTHS[month - 1]} ${year} for approval review?`)) {
      return
    }
    setBulkSubmitting(true)
    try {
      const res = await api("/payroll/approvals/bulk-submit", {
        method: "POST",
        body: JSON.stringify({
          year,
          month,
          department: department || undefined,
          comments: "Bulk submitted from approvals dashboard",
        }),
      })
      toast.success(res.message || "Bulk submission complete")
      loadApprovals()
    } catch (err) {
      toast.error(err.message || "Bulk submit failed")
    } finally {
      setBulkSubmitting(false)
    }
  }

  // Bulk Approve Selected
  const handleBulkApproveSelected = async () => {
    if (!selectedIds.length) return
    if (!window.confirm(`Approve current stage for ${selectedIds.length} selected payroll record(s)?`)) {
      return
    }
    setBulkApproving(true)
    try {
      const res = await api("/payroll/approvals/bulk-approve", {
        method: "POST",
        body: JSON.stringify({
          payrollIds: selectedIds,
          comments: "Bulk approved from approvals table",
        }),
      })
      toast.success(res.message || "Bulk approval finished")
      setSelectedIds([])
      loadApprovals()
    } catch (err) {
      toast.error(err.message || "Bulk approve failed")
    } finally {
      setBulkApproving(false)
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const selectAll = (checked) => {
    if (checked) {
      setSelectedIds(items.map((i) => i._id))
    } else {
      setSelectedIds([])
    }
  }

  const allSelected = items.length > 0 && items.every((i) => selectedIds.includes(i._id))

  return (
    <div className="space-y-5">
      {/* Top 4 Compact Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Awaiting My Review */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Awaiting My Review</p>
              <p className="mt-1 text-2xl font-black text-amber-600">{metrics.awaitingMyReview}</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">Requires your approval</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-600/10">
              <HugeiconsIcon icon={Clock01Icon} size={20} />
            </div>
          </div>
        </div>

        {/* Card 2: Pending Final Approval */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Pending Final Approval</p>
              <p className="mt-1 text-2xl font-black text-indigo-600">{metrics.pendingFinalApproval}</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">At final stage before payout</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-600/10">
              <HugeiconsIcon icon={Shield01Icon} size={20} />
            </div>
          </div>
        </div>

        {/* Card 3: Approved */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Fully Approved</p>
              <p className="mt-1 text-2xl font-black text-emerald-600">{metrics.approved}</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">Ready for disbursement</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/10">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} />
            </div>
          </div>
        </div>

        {/* Card 4: Sent Back */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Sent Back</p>
              <p className="mt-1 text-2xl font-black text-rose-600">{metrics.sentBack}</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">Returned for revisions</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-600/10">
              <HugeiconsIcon icon={RotateLeft01Icon} size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Chip Filter, Search, Month/Year, Workflow Settings */}
      <div className={`${card} p-4 sm:p-5 space-y-4`}>
        {/* Row 1: Chip tabs & action buttons */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Chip filters */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["awaiting_my_review", `Awaiting Review (${metrics.awaitingMyReview})`],
              ["pending_final_approval", `Final Approval (${metrics.pendingFinalApproval})`],
              ["approved", `Approved (${metrics.approved})`],
              ["sent_back", `Sent Back (${metrics.sentBack})`],
              ["all", `All (${metrics.totalPeriodCount})`],
            ].map(([key, label]) => {
              const active = tabFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTabFilter(key)
                    setPage(1)
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-black transition ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${btn} ${btnGhost} h-9 px-3 text-xs`}
              onClick={() => setWorkflowSettingsOpen(true)}
              title="Configure approval workflow stages and maker-checker rules"
            >
              <HugeiconsIcon icon={Settings01Icon} size={15} />
              Workflow Settings
            </button>
            <button
              type="button"
              className={`${btn} ${btnSoft} h-9 px-3 text-xs`}
              onClick={handleBulkSubmit}
              disabled={bulkSubmitting}
            >
              <HugeiconsIcon icon={Add01Icon} size={15} />
              {bulkSubmitting ? "Submitting..." : "Submit All for Review"}
            </button>
            {selectedIds.length > 0 ? (
              <button
                type="button"
                className={`${btn} ${btnPrimary} h-9 px-3 text-xs`}
                onClick={handleBulkApproveSelected}
                disabled={bulkApproving}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
                {bulkApproving ? "Approving..." : `Approve Selected (${selectedIds.length})`}
              </button>
            ) : null}
          </div>
        </div>

        {/* Row 2: Search, Period & Department selectors */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search box */}
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              className={`${input} pl-9`}
              placeholder="Search employee or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* Month selector */}
          <select
            className={input}
            value={month}
            onChange={(e) => {
              setMonth(Number(e.target.value))
              setPage(1)
            }}
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          {/* Year selector */}
          <input
            type="number"
            className={input}
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value))
              setPage(1)
            }}
          />

          {/* Department selector */}
          <select
            className={input}
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* High-density Approvals Table */}
      <section className={`${tableCard} overflow-hidden`}>
        <div className="max-h-[620px] overflow-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-20 bg-gray-50/95">
              <tr>
                <th className="w-11 border-b border-gray-200 bg-gray-50/95 px-3 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={!items.length || loading}
                    onChange={(e) => selectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-gray-600">
                  Employee
                </th>
                <th className="border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-gray-600">
                  Period
                </th>
                <th className="border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-gray-600">
                  Net Pay
                </th>
                <th className="border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-gray-600">
                  Current Stage
                </th>
                <th className="border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-gray-600">
                  Prepared By
                </th>
                <th className="border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-xs font-black uppercase tracking-[0.08em] text-gray-600">
                  Workflow Status
                </th>
                <th className="border-b border-gray-200 bg-gray-50/95 px-4 py-3.5 text-right text-xs font-black uppercase tracking-[0.08em] text-gray-600 min-w-[160px]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="bg-white px-5 py-16 text-center">
                    <HugeiconsIcon icon={RefreshIcon} size={24} className="mx-auto animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : items.length ? (
                items.map((payroll) => {
                  const checked = selectedIds.includes(payroll._id)
                  const wf = payroll.approvalWorkflow || {}
                  const currentStage = wf.stages?.[wf.currentStageIndex || 0]

                  return (
                    <tr
                      key={payroll._id}
                      className={`group align-middle transition ${
                        checked ? "bg-indigo-50/40" : "bg-white hover:bg-indigo-50/20"
                      }`}
                    >
                      <td className="w-11 border-b border-gray-100 px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(payroll._id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      <td className="border-b border-gray-100 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 ring-1 ring-gray-200">
                            {payroll.employee?.avatarUrl ? (
                              <img
                                src={payroll.employee.avatarUrl}
                                alt={payroll.employee.name}
                                className="h-full w-full rounded-xl object-cover"
                              />
                            ) : (
                              <HugeiconsIcon icon={UserIcon} size={16} className="text-gray-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-950">
                              {payroll.employee?.name || "Unknown"}
                            </p>
                            <p className="truncate text-xs font-semibold text-gray-500">
                              {payroll.employee?.position?.title || payroll.employee?.department?.name || payroll.employee?.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="border-b border-gray-100 px-4 py-3 text-xs font-bold text-gray-700">
                        {MONTHS[payroll.month - 1]} {payroll.year}
                      </td>

                      <td className="border-b border-gray-100 px-4 py-3 text-sm font-black text-emerald-700">
                        {money(payroll.netPayable, payroll.currency)}
                      </td>

                      <td className="border-b border-gray-100 px-4 py-3">
                        {wf.isWorkflowEnabled ? (
                          <StageBadge
                            stageName={wf.status === "approved" ? "Fully Approved" : currentStage?.name || "Stage 1"}
                            sequence={(wf.currentStageIndex || 0) + 1}
                            status={wf.status}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-gray-400">Direct Approval</span>
                        )}
                      </td>

                      <td className="border-b border-gray-100 px-4 py-3 text-xs font-semibold text-gray-600">
                        {wf.preparedBy?.name || payroll.calculatedBy?.name || "System"}
                      </td>

                      <td className="border-b border-gray-100 px-4 py-3">
                        <WorkflowStatusBadge status={wf.status || payroll.status} />
                      </td>

                      <td className="border-b border-gray-100 px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className={`${btn} ${btnSoft} h-8 px-2.5 text-xs`}
                            onClick={() => setReviewDrawerPayroll(payroll)}
                            title="Open review drawer with detailed breakdown and history"
                          >
                            <HugeiconsIcon icon={ViewIcon} size={14} />
                            Review
                          </button>

                          {["submitted", "in_review"].includes(wf.status) ? (
                            <>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                onClick={() =>
                                  setActionModal({
                                    open: true,
                                    type: "approve",
                                    payroll,
                                    reason: "",
                                    loading: false,
                                  })
                                }
                                title="Quick approve stage"
                              >
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100"
                                onClick={() =>
                                  setActionModal({
                                    open: true,
                                    type: "send_back",
                                    payroll,
                                    reason: "",
                                    loading: false,
                                  })
                                }
                                title="Send back for revision"
                              >
                                <HugeiconsIcon icon={RotateLeft01Icon} size={15} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="bg-white px-5 py-16 text-center">
                    <HugeiconsIcon icon={Shield01Icon} size={32} className="mx-auto text-gray-300" />
                    <p className="mt-3 text-sm font-extrabold text-gray-900">No payroll approvals in this view</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      Select another tab or period to view approval records.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-gray-600">
            Page {page} of {totalPages} ({total} records)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${btn} ${btnGhost} h-8 px-3 text-xs`}
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} /> Previous
            </button>
            <button
              type="button"
              className={`${btn} ${btnGhost} h-8 px-3 text-xs`}
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Review Drawer / Modal */}
      {reviewDrawerPayroll ? (
        <PayrollReviewDrawer
          payroll={reviewDrawerPayroll}
          onClose={() => setReviewDrawerPayroll(null)}
          onAction={(type) =>
            setActionModal({
              open: true,
              type,
              payroll: reviewDrawerPayroll,
              reason: "",
              loading: false,
            })
          }
          onOpenPayslip={() => onOpenPayslip?.(reviewDrawerPayroll)}
          onDownloadPdf={() => onDownloadPdf?.(reviewDrawerPayroll)}
        />
      ) : null}

      {/* Action Dialog Modal (Approve / Send Back / Reject) */}
      {actionModal.open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !actionModal.loading && setActionModal((p) => ({ ...p, open: false }))} />
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900">
                {actionModal.type === "approve"
                  ? "Approve Stage"
                  : actionModal.type === "send_back"
                  ? "Send Back to Preparer"
                  : "Reject Payroll"}
              </h3>
              <button
                type="button"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                onClick={() => setActionModal((p) => ({ ...p, open: false }))}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-600">
                Employee: <strong className="text-gray-950">{actionModal.payroll?.employee?.name}</strong> (
                {MONTHS[actionModal.payroll?.month - 1]} {actionModal.payroll?.year})
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {actionModal.type === "approve" ? "Optional Review Comments" : "Mandatory Reason / Notes"}
                </label>
                <textarea
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
                  rows={3}
                  placeholder={
                    actionModal.type === "approve"
                      ? "Add verification notes (optional)..."
                      : "Explain why this payroll is being returned or rejected (required)..."
                  }
                  value={actionModal.reason}
                  onChange={(e) => setActionModal((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                className={`${btn} ${btnGhost}`}
                disabled={actionModal.loading}
                onClick={() => setActionModal((p) => ({ ...p, open: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${btn} ${
                  actionModal.type === "approve"
                    ? btnPrimary
                    : actionModal.type === "send_back"
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : btnDanger
                }`}
                disabled={actionModal.loading}
                onClick={executeAction}
              >
                {actionModal.loading ? "Processing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Approval Workflow Configuration Modal */}
      {workflowSettingsOpen ? (
        <ApprovalWorkflowSettingsModal
          onClose={() => setWorkflowSettingsOpen(false)}
          onSaved={() => {
            setWorkflowSettingsOpen(false)
            loadApprovals()
          }}
        />
      ) : null}
    </div>
  )
}

/* =========================================================
   REVIEW DRAWER COMPONENT
========================================================= */
function PayrollReviewDrawer({ payroll, onClose, onAction, onOpenPayslip, onDownloadPdf }) {
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const wf = payroll.approvalWorkflow || {}
  const stages = wf.stages || []
  const currentStageIndex = wf.currentStageIndex || 0

  useEffect(() => {
    let active = true
    setHistoryLoading(true)
    api(`/payroll/${payroll._id}/approval-history`)
      .then((res) => {
        if (active) setHistory(res.history || [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHistoryLoading(false)
      })
    return () => {
      active = false
    }
  }, [payroll._id])

  return (
    <div className="fixed inset-0 z-[95] overflow-hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="relative w-screen max-w-2xl bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  <HugeiconsIcon icon={Shield01Icon} size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black text-gray-900">
                    {payroll.employee?.name || "Payroll Review"}
                  </h2>
                  <p className="text-xs font-semibold text-gray-500">
                    {payroll.employee?.position?.title || payroll.employee?.department?.name} ·{" "}
                    {MONTHS[payroll.month - 1]} {payroll.year}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
                <HugeiconsIcon icon={Cancel01Icon} size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Financial Metrics Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Basic Salary</p>
                  <p className="mt-1 text-sm font-black text-gray-900">{money(payroll.basicSalary, payroll.currency)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Gross Earnings</p>
                  <p className="mt-1 text-sm font-black text-gray-900">{money(payroll.grossSalary, payroll.currency)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Deductions</p>
                  <p className="mt-1 text-sm font-black text-rose-600">{money(payroll.totalDeductions, payroll.currency)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Net Payable</p>
                  <p className="mt-1 text-sm font-black text-emerald-700">{money(payroll.netPayable, payroll.currency)}</p>
                </div>
              </div>

              {/* Visual Multi-stage Approval Stepper */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-black text-gray-900 mb-4">Approval Progression</h3>

                <div className="space-y-4">
                  {/* Step 0: Prepared */}
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900">1. Prepared & Calculated</p>
                      <p className="text-[11px] font-semibold text-gray-500">
                        By {wf.preparedBy?.name || payroll.calculatedBy?.name || "System"} on{" "}
                        {formatDate(payroll.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Step: Workflow Stages */}
                  {stages.map((stg, idx) => {
                    const isPassed = idx < currentStageIndex || wf.status === "approved"
                    const isCurrent = idx === currentStageIndex && ["submitted", "in_review"].includes(wf.status)

                    let iconBg = "bg-gray-100 text-gray-400"
                    if (isPassed) iconBg = "bg-emerald-100 text-emerald-700"
                    else if (isCurrent) iconBg = "bg-amber-100 text-amber-700 animate-pulse"

                    return (
                      <div key={stg.stageId || idx} className="flex items-start gap-3">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                          {isPassed ? (
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                          ) : (
                            <span className="text-xs font-bold">{idx + 2}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-900">{stg.name}</p>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                              Requires: {stg.requiredPermission}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-gray-500 mt-0.5">
                            {isPassed
                              ? `Approved (${stg.approvalsCount || 1}/${stg.approvalsRequired || 1})`
                              : isCurrent
                              ? "Awaiting authorization"
                              : "Pending prior stage"}
                          </p>
                          {stg.comments ? (
                            <p className="mt-1 text-xs italic text-gray-600">"{stg.comments}"</p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}

                  {/* Final Step: Disbursement */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        payroll.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : wf.status === "approved"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <HugeiconsIcon icon={Dollar01Icon} size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-900">Disbursement</p>
                      <p className="text-[11px] font-semibold text-gray-500">
                        {payroll.status === "paid"
                          ? `Paid on ${formatDate(payroll.paymentDate)} via ${payroll.paymentMethod}`
                          : wf.status === "approved"
                          ? "Cleared for payout"
                          : "Locked until final approval"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maker-Checker Notice if applicable */}
              {wf.enforceMakerChecker ? (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs font-semibold text-indigo-900">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Shield01Icon} size={16} className="text-indigo-600 shrink-0" />
                    <span>
                      Maker-Checker Segregation active: Preparer cannot authorize their own payroll stages or payout.
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Rejection / Send-back Notice if applicable */}
              {wf.status === "sent_back" && wf.sendBackReason ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs">
                  <p className="font-bold text-amber-900">Returned for Revision:</p>
                  <p className="mt-1 text-amber-800">"{wf.sendBackReason}"</p>
                </div>
              ) : null}

              {wf.status === "rejected" && wf.rejectionReason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs">
                  <p className="font-bold text-rose-900">Rejection Notice:</p>
                  <p className="mt-1 text-rose-800">"{wf.rejectionReason}"</p>
                </div>
              ) : null}

              {/* Immutable Audit History Trail */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-black text-gray-900 mb-3">Immutable Approval History</h3>
                {historyLoading ? (
                  <p className="text-xs text-gray-400">Loading audit history...</p>
                ) : history.length ? (
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={h._id || i} className="border-b border-gray-100 pb-2.5 last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black capitalize text-gray-900">
                            {h.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-400">
                            {formatDateTime(h.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-600 mt-0.5">
                          Actor: <strong>{h.actor?.name || "User"}</strong> ({h.actorRole || "staff"})
                        </p>
                        {h.comments ? (
                          <p className="text-xs italic text-gray-500 mt-1">"{h.comments}"</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-gray-400">No approval history events recorded yet.</p>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="border-t border-gray-100 bg-gray-50 p-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${btn} ${btnGhost} h-9 px-3 text-xs`}
                  onClick={onOpenPayslip}
                >
                  View Payslip
                </button>
                <button
                  type="button"
                  className={`${btn} ${btnGhost} h-9 px-3 text-xs`}
                  onClick={onDownloadPdf}
                >
                  Download PDF
                </button>
              </div>

              {["submitted", "in_review"].includes(wf.status) ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`${btn} ${btnDanger} h-9 px-3 text-xs`}
                    onClick={() => onAction("reject")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className={`${btn} bg-amber-600 text-white hover:bg-amber-700 h-9 px-3 text-xs`}
                    onClick={() => onAction("send_back")}
                  >
                    Send Back
                  </button>
                  <button
                    type="button"
                    className={`${btn} ${btnPrimary} h-9 px-4 text-xs`}
                    onClick={() => onAction("approve")}
                  >
                    Approve Stage
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   WORKFLOW SETTINGS MODAL COMPONENT
========================================================= */
function ApprovalWorkflowSettingsModal({ onClose, onSaved }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const [enforceMakerChecker, setEnforceMakerChecker] = useState(true)
  const [stages, setStages] = useState([])

  useEffect(() => {
    let active = true
    api("/payroll/approval-workflow")
      .then((res) => {
        if (!active) return
        const wf = res.workflow || {}
        setIsEnabled(wf.isEnabled !== false)
        setEnforceMakerChecker(wf.enforceMakerChecker !== false)
        setStages(
          Array.isArray(wf.stages) && wf.stages.length
            ? wf.stages
            : [
                {
                  stageId: "review",
                  name: "Payroll Review",
                  sequence: 1,
                  requiredPermission: "payroll:review",
                  requiredApprovals: 1,
                  allowSendBack: true,
                  allowReject: true,
                },
                {
                  stageId: "final_approval",
                  name: "Final Approval",
                  sequence: 2,
                  requiredPermission: "payroll:approve",
                  requiredApprovals: 1,
                  allowSendBack: true,
                  allowReject: true,
                },
              ]
        )
      })
      .catch((err) => toast.error(err.message || "Failed to load workflow settings"))
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const addStage = () => {
    setStages((prev) => [
      ...prev,
      {
        stageId: `stage_${Date.now()}`,
        name: `Stage ${prev.length + 1}`,
        sequence: prev.length + 1,
        requiredPermission: "payroll:approve",
        requiredApprovals: 1,
        allowSendBack: true,
        allowReject: true,
      },
    ])
  }

  const removeStage = (index) => {
    if (stages.length <= 1) {
      toast.error("At least one approval stage is required.")
      return
    }
    setStages((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((s, idx) => ({ ...s, sequence: idx + 1 }))
    )
  }

  const updateStage = (index, field, value) => {
    setStages((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, [field]: value } : s))
    )
  }

  const saveSettings = async () => {
    if (isEnabled && !stages.length) {
      toast.error("At least one stage is required when workflow is enabled.")
      return
    }

    setSaving(true)
    try {
      await api("/payroll/approval-workflow", {
        method: "PUT",
        body: JSON.stringify({
          isEnabled,
          enforceMakerChecker,
          stages,
        }),
      })
      toast.success("Approval workflow configuration saved.")
      onSaved()
    } catch (err) {
      toast.error(err.message || "Failed to save workflow settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              <HugeiconsIcon icon={Settings01Icon} size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900">Payroll Approval Workflow</h3>
              <p className="text-xs font-semibold text-gray-500">Configure multi-stage Maker-Checker governance</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100">
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-sm font-bold text-gray-400">Loading settings...</div>
          ) : (
            <>
              {/* Toggles */}
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-extrabold text-gray-900">Enable Multi-Level Approval</span>
                    <p className="text-xs font-semibold text-gray-500">
                      Requires payroll to pass configured stages before disbursement.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer border-t border-gray-200/60 pt-3">
                  <div>
                    <span className="text-sm font-extrabold text-gray-900">Enforce Maker-Checker Segregation</span>
                    <p className="text-xs font-semibold text-gray-500">
                      Preparer cannot review, approve, or disburse their own payroll.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enforceMakerChecker}
                    onChange={(e) => setEnforceMakerChecker(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              </div>

              {/* Stages List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-gray-900">Configured Stages</h4>
                  <button
                    type="button"
                    className={`${btn} ${btnSoft} h-8 px-3 text-xs`}
                    onClick={addStage}
                  >
                    <HugeiconsIcon icon={Add01Icon} size={14} /> Add Stage
                  </button>
                </div>

                <div className="space-y-3">
                  {stages.map((stage, idx) => (
                    <div
                      key={stage.stageId || idx}
                      className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-xs font-black text-indigo-700">
                          {idx + 1}
                        </span>
                        <input
                          className={`${input} flex-1`}
                          placeholder="Stage name (e.g. Payroll Review)"
                          value={stage.name}
                          onChange={(e) => updateStage(idx, "name", e.target.value)}
                        />
                        <button
                          type="button"
                          className="rounded-xl p-2 text-rose-500 hover:bg-rose-50"
                          onClick={() => removeStage(idx)}
                          title="Remove stage"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Required Permission</label>
                          <select
                            className={input}
                            value={stage.requiredPermission}
                            onChange={(e) => updateStage(idx, "requiredPermission", e.target.value)}
                          >
                            <option value="payroll:review">payroll:review</option>
                            <option value="payroll:approve">payroll:approve</option>
                            <option value="payroll:manage">payroll:manage</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Required Approvals</label>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            className={input}
                            value={stage.requiredApprovals || 1}
                            onChange={(e) =>
                              updateStage(idx, "requiredApprovals", Math.max(1, Number(e.target.value) || 1))
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold text-gray-700 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={stage.allowSendBack !== false}
                            onChange={(e) => updateStage(idx, "allowSendBack", e.target.checked)}
                            className="rounded border-gray-300 text-indigo-600"
                          />
                          Allow Send-Back
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={stage.allowReject !== false}
                            onChange={(e) => updateStage(idx, "allowReject", e.target.checked)}
                            className="rounded border-gray-300 text-indigo-600"
                          />
                          Allow Reject
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-4">
          <button type="button" className={`${btn} ${btnGhost}`} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={`${btn} ${btnPrimary}`} onClick={saveSettings} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  )
}
