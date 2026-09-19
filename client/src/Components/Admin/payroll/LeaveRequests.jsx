"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  FilterIcon,
  RefreshIcon,
  Search01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"

const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"

const input =
  "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

const chip =
  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

const DEFAULT_FILTERS = {
  q: "",
  status: "all",
  year: "",
}

const STATUS_OPTIONS = ["all", "pending", "approved", "rejected", "cancelled"]

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

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

  if (!res.ok) throw new Error(data?.message || "Request failed")

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

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)

  if (!parts.length) return "?"

  const first = parts[0]?.[0] || ""
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""

  return (first + last).toUpperCase()
}

function employeeName(employee) {
  return employee?.name || employee?.email || "Employee"
}

function employeeMeta(employee) {
  const employeeId = employee?.employeeId || ""
  const department = employee?.department?.name || ""
  const position = employee?.position?.title || ""

  return [employeeId, department, position].filter(Boolean).join(" • ") || "-"
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

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tone}`}>
      {pretty(status)}
    </span>
  )
}

function FilterChip({ label, value, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      title={`Remove ${label} filter`}
      aria-label={`Remove ${label} filter`}
    >
      <span className="text-indigo-400">{label}:</span>
      <span className="max-w-[180px] truncate sm:max-w-[220px]">{value}</span>
      <HugeiconsIcon icon={Cancel01Icon} size={14} className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
    </button>
  )
}

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidthClass = "max-w-3xl",
}) {
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

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.()
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative flex min-h-full items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]",
            maxWidthClass
          )}
        >
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-gray-50/80 p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
                {icon}
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                  {title}
                </h2>

                {subtitle ? (
                  <p className="truncate text-sm font-normal text-gray-500">{subtitle}</p>
                ) : null}
              </div>
            </div>

            <button type="button" onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100">
              <HugeiconsIcon icon={Cancel01Icon} size={20} className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">
            {children}
          </div>

          {footer ? (
            <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function HeaderSearchFilters({
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  totalCount,
  visibleCount,
  onOpenFilters,
}) {
  return (
    <div className="mt-5 w-full lg:w-1/2">
      <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-2xl border border-gray-200 bg-[#f7f8fb] px-2.5 py-1 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
        <HugeiconsIcon icon={Search01Icon} size={16} className="h-4 w-4 shrink-0 text-gray-400" />

        {filters.q.trim() ? (
          <FilterChip label="Search" value={filters.q.trim()} onClear={() => updateFilter("q", "")} />
        ) : null}

        {filters.status !== "all" ? (
          <FilterChip
            label="Status"
            value={pretty(filters.status)}
            onClear={() => updateFilter("status", "all")}
          />
        ) : null}

        {filters.year ? (
          <FilterChip label="Year" value={filters.year} onClear={() => updateFilter("year", "")} />
        ) : null}

        <input
          className="min-w-[130px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-normal text-gray-800 outline-none placeholder:text-gray-400 focus:outline-none focus:ring-0"
          value={filters.q}
          onChange={(event) => updateFilter("q", event.target.value)}
          placeholder="Search employee, ID, reason..."
          type="text"
        />

        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition",
            activeFilterCount
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
          )}
        >
          <HugeiconsIcon icon={FilterIcon} size={14} className="h-3.5 w-3.5" />
          Filters

          {activeFilterCount ? (
            <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
              {activeFilterCount}
            </span>
          ) : null}
        </button>

        {activeFilterCount ? (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            title="Clear search and filters"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
        <span>Showing {visibleCount} of {totalCount} leave requests</span>
      </div>
    </div>
  )
}

function LeaveFilterModal({
  open,
  onClose,
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  load,
}) {
  const handleApply = () => {
    load?.()
    onClose?.()
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filter leave requests"
      subtitle="Search and filter employee leave requests."
      icon={<HugeiconsIcon icon={FilterIcon} size={20} className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={cn(
              chip,
              activeFilterCount
                ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                : "bg-gray-100 text-gray-600 ring-gray-600/10"
            )}
          >
            {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
          </span>

          <div className="flex justify-end gap-2">
            <button type="button" className={cn(btn, btnGhost)} onClick={resetFilters}>
              Reset
            </button>

            <button type="button" className={cn(btn, btnPrimary)} onClick={handleApply}>
              Apply filters
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Leave status</label>
          <select
            className={input}
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All leave status" : pretty(item)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Year</label>
          <input
            className={input}
            type="number"
            placeholder="All years"
            value={filters.year}
            onChange={(event) => updateFilter("year", event.target.value)}
          />
        </div>

        <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          <p className="text-sm font-semibold text-gray-900">Active filters</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {filters.q.trim() ? (
              <FilterChip label="Search" value={filters.q.trim()} onClear={() => updateFilter("q", "")} />
            ) : null}

            {filters.status !== "all" ? (
              <FilterChip
                label="Status"
                value={pretty(filters.status)}
                onClear={() => updateFilter("status", "all")}
              />
            ) : null}

            {filters.year ? (
              <FilterChip label="Year" value={filters.year} onClear={() => updateFilter("year", "")} />
            ) : null}

            {!activeFilterCount ? (
              <span className="text-sm font-normal text-gray-500">No active filter selected.</span>
            ) : null}
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function LeaveMobileCard({ leave, noteById, setNoteById, reviewingId, review }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-semibold text-indigo-700">
            {initials(employeeName(leave.employee))}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-950">{employeeName(leave.employee)}</p>
            <p className="truncate text-xs font-normal text-gray-500">{employeeMeta(leave.employee)}</p>
          </div>
        </div>

        <StatusBadge status={leave.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3">
        <div>
          <p className="text-xs font-medium text-gray-500">Type</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{pretty(leave.leaveType)}</p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500">Total days</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{leave.totalDays || 0} day(s)</p>
        </div>

        <div className="col-span-2">
          <p className="text-xs font-medium text-gray-500">Dates</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {date(leave.startDate)} - {date(leave.endDate)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-gray-500">Reason</p>
        <p className="mt-1 text-sm font-normal text-gray-700">{leave.reason || "-"}</p>
      </div>

      {leave.status === "pending" ? (
        <div className="mt-4 space-y-2">
          <input
            className={input}
            placeholder="Admin note (optional)"
            value={noteById[leave._id] || ""}
            onChange={(event) =>
              setNoteById((prev) => ({
                ...prev,
                [leave._id]: event.target.value,
              }))
            }
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              className={`${btn} ${btnGhost} text-rose-600`}
              disabled={reviewingId === leave._id}
              onClick={() => review(leave, "rejected")}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} className="h-4 w-4" />
              Reject
            </button>

            <button
              className={`${btn} ${btnPrimary}`}
              disabled={reviewingId === leave._id}
              onClick={() => review(leave, "approved")}
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="h-4 w-4" />
              Approve
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-gray-50 p-3 text-sm font-normal text-gray-500">
          {leave.adminNote || "No action available"}
        </div>
      )}
    </div>
  )
}

export default function LeaveRequests() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState("")
  const [noteById, setNoteById] = useState({})
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS })
  }

  const activeFilterCount = useMemo(() => {
    return [
      filters.q.trim(),
      filters.status !== "all" ? filters.status : "",
      filters.year,
    ].filter(Boolean).length
  }, [filters])

  const filtered = useMemo(() => {
    const search = filters.q.trim().toLowerCase()

    if (!search) return items

    return items.filter((leave) => {
      const employee = leave.employee || {}

      const haystack = [
        employee.name,
        employee.employeeId,
        employee.email,
        employee.department?.name,
        employee.position?.title,
        leave.leaveType,
        leave.reason,
        leave.status,
        leave.adminNote,
        date(leave.startDate),
        date(leave.endDate),
        leave.totalDays,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [items, filters.q])

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams()

      if (filters.status !== "all") params.set("status", filters.status)
      if (filters.year) params.set("year", filters.year)

      params.set("limit", "100")

      const data = await api(`/leaves?${params.toString()}`)
      setItems(data.leaveRequests || [])
    } catch (error) {
      toast.error(error?.message || "Failed to load leave requests")
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.year])

  useEffect(() => {
    load()
  }, [load])

  const review = async (leave, nextStatus) => {
    setReviewingId(leave._id)

    try {
      await api(`/leaves/${leave._id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          status: nextStatus,
          adminNote: noteById[leave._id] || "",
        }),
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />

      <LeaveFilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        activeFilterCount={activeFilterCount}
        load={load}
      />

      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 sm:h-14 sm:w-14">
                <HugeiconsIcon icon={Calendar03Icon} size={22} className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
                  Leave Requests
                </h1>
                <p className="mt-1 text-sm font-normal text-gray-500">
                  Review employee paid and unpaid leave requests.
                </p>
              </div>
            </div>

            <button className={`${btn} ${btnGhost} shrink-0`} onClick={load} disabled={loading}>
              <HugeiconsIcon icon={RefreshIcon} size={16} className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <HeaderSearchFilters
            filters={filters}
            updateFilter={updateFilter}
            resetFilters={resetFilters}
            activeFilterCount={activeFilterCount}
            totalCount={items.length}
            visibleCount={filtered.length}
            onOpenFilters={() => setFilterModalOpen(true)}
          />
        </div>
      </div>

      <div className={`${card} hidden overflow-hidden lg:block`}>
        <div className="h-[68vh] overflow-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-gray-50">
              <tr className="border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Dates</th>
                <th className="px-5 py-4">Reason</th>
                <th className="px-5 py-4">Status</th>
                <th className="sticky right-0 z-30 bg-gray-50 px-5 py-4 text-right shadow-[-12px_0_24px_-24px_rgba(15,23,42,0.45)]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="bg-white px-5 py-16 text-center">
                    <div className="flex justify-center">
                      <HugeiconsIcon icon={RefreshIcon} size={24} className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading &&
                filtered.map((leave) => (
                  <tr key={leave._id} className="bg-white align-top transition hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <div className="flex min-w-[230px] items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-semibold text-indigo-700">
                          {initials(employeeName(leave.employee))}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-950">
                            {employeeName(leave.employee)}
                          </p>
                          <p className="truncate text-xs font-normal text-gray-500">
                            {employeeMeta(leave.employee)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          leave.leaveType === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {pretty(leave.leaveType)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm font-medium text-gray-700">
                      {date(leave.startDate)} - {date(leave.endDate)}
                      <p className="mt-1 text-xs font-semibold text-gray-400">
                        {leave.totalDays} day(s)
                      </p>
                    </td>

                    <td className="max-w-md px-5 py-4 text-sm font-normal text-gray-600">
                      <p className="line-clamp-3">{leave.reason || "-"}</p>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={leave.status} />
                    </td>

                    <td className="sticky right-0 z-10 bg-white px-5 py-4 shadow-[-12px_0_24px_-24px_rgba(15,23,42,0.45)]">
                      {leave.status === "pending" ? (
                        <div className="flex min-w-[280px] flex-col gap-2">
                          <input
                            className={input}
                            placeholder="Admin note (optional)"
                            value={noteById[leave._id] || ""}
                            onChange={(event) =>
                              setNoteById((prev) => ({
                                ...prev,
                                [leave._id]: event.target.value,
                              }))
                            }
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              className={`${btn} ${btnGhost} text-rose-600`}
                              disabled={reviewingId === leave._id}
                              onClick={() => review(leave, "rejected")}
                            >
                              <HugeiconsIcon icon={Cancel01Icon} size={16} className="h-4 w-4" />
                              Reject
                            </button>

                            <button
                              className={`${btn} ${btnPrimary}`}
                              disabled={reviewingId === leave._id}
                              onClick={() => review(leave, "approved")}
                            >
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} className="h-4 w-4" />
                              Approve
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="min-w-[220px] text-right text-sm font-normal text-gray-500">
                          {leave.adminNote || "No action available"}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}

              {!loading && !filtered.length ? (
                <tr>
                  <td colSpan={6} className="bg-white px-5 py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-500">
                        <HugeiconsIcon icon={UserIcon} size={20} className="h-5 w-5" />
                      </div>

                      <p className="text-sm font-semibold text-gray-900">No leave requests found.</p>
                      <p className="mt-1 text-sm font-normal text-gray-500">
                        Try clearing search or changing filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="flex justify-center rounded-2xl border border-gray-100 bg-white p-10">
            <HugeiconsIcon icon={RefreshIcon} size={24} className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : null}

        {!loading &&
          filtered.map((leave) => (
            <LeaveMobileCard
              key={leave._id}
              leave={leave}
              noteById={noteById}
              setNoteById={setNoteById}
              reviewingId={reviewingId}
              review={review}
            />
          ))}

        {!loading && !filtered.length ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-500">
              <HugeiconsIcon icon={UserIcon} size={20} className="h-5 w-5" />
            </div>

            <p className="text-sm font-semibold text-gray-900">No leave requests found.</p>
            <p className="mt-1 text-sm font-normal text-gray-500">
              Try clearing search or changing filters.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}