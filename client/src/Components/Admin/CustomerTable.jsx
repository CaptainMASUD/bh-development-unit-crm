// CustomerTable.jsx
"use client"

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  memo,
} from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiEye,
  FiEdit2,
  FiTrash2,
  FiUserCheck,
  FiChevronDown,
  FiPlus,
  FiRefreshCcw,
  FiAlertCircle,
  FiArrowRight,
  FiX,
} from "react-icons/fi"
import {
  AlertTriangle,
  Loader2,
  Trash2,
  BriefcaseBusiness,
  ListTree,
  Layers3,
  ChevronDown,
} from "lucide-react"

/* =========================
   API BASE
========================= */
const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/* =========================
   UI TOKENS (BLUE THEME)
========================= */
const card = "rounded-2xl border border-gray-100 bg-white shadow-sm"
const subtleHover = "transition-colors hover:bg-gray-50/60"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"
const btnSm =
  "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg active:scale-[0.99] transition focus:outline-none text-sm font-semibold"
const btnXs =
  "inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg active:scale-[0.99] transition focus:outline-none text-xs font-semibold"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white hover:bg-rose-50"
const iconBtn =
  "p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none"
const iconBtnSm =
  "p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none"
const chip =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

/* =========================
   AUTH HEADERS
========================= */
function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/* =========================
   SMALL HELPERS
========================= */
function normalizeAssignedToArray(assignedTo) {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo
  return [assignedTo]
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined
  const parts = String(path).split(".").filter(Boolean)
  let cur = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

function formatDate(dt) {
  if (!dt) return "—"
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function JobStatusBadge({ status }) {
  const s = String(status || "").toLowerCase()
  const cls =
    s === "completed"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "on_hold"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : "bg-sky-50 text-sky-700 ring-sky-600/10"
  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || "active"}
    </span>
  )
}

/* =========================
   API (JOBS)
========================= */
async function apiJson(url, { method = "GET", body, signal } = {}) {
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.message || "Request failed")
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

async function fetchCustomerJobs(customerId, signal) {
  return apiJson(`${API_BASE}/customers/${customerId}/jobs`, { signal })
}

async function createCustomerJob(customerId, payload) {
  return apiJson(`${API_BASE}/customers/${customerId}/jobs`, {
    method: "POST",
    body: payload,
  })
}

async function updateCustomerJob(customerId, jobId, payload) {
  return apiJson(`${API_BASE}/customers/${customerId}/jobs/${jobId}`, {
    method: "PATCH",
    body: payload,
  })
}

async function deleteCustomerJob(customerId, jobId, { force = false } = {}) {
  const qs = new URLSearchParams()
  if (force) qs.set("force", "true")
  const url = `${API_BASE}/customers/${customerId}/jobs/${jobId}${
    qs.toString() ? `?${qs.toString()}` : ""
  }`
  return apiJson(url, { method: "DELETE" })
}

/* =========================
   CONFIRM DELETE MODAL
========================= */
function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmText = "Delete",
  loading,
  onClose,
  onConfirm,
  extra,
}) {
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !loading && onClose?.()}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
            {extra ? <div className="mt-3">{extra}</div> : null}
          </div>
          <button
            ref={closeBtnRef}
            disabled={loading}
            onClick={onClose}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 focus:outline-none"
            aria-label="Close"
            title="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <button
            disabled={loading}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60 focus:outline-none"
          >
            Cancel
          </button>

          <button
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-semibold disabled:opacity-60 focus:outline-none"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================
   JOB UPSERT MODAL (kept from your existing file)
========================= */
function toLocalInputValue(dt) {
  if (!dt) return ""
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function JobUpsertModal({
  open,
  onClose,
  customer,
  mode = "create",
  initialJob,
  parentJobId,
  onSaved,
}) {
  const assignedUsers = normalizeAssignedToArray(customer?.assignedTo)
  const assigneeOptions = useMemo(
    () =>
      assignedUsers
        .filter((u) => u && typeof u === "object" && u._id)
        .map((u) => ({
          value: String(u._id),
          label: `${u.name || "Employee"}${u.email ? ` • ${u.email}` : ""}`,
        })),
    [customer?.assignedTo]
  )

  const [form, setForm] = useState({
    title: "",
    status: "active",
    code: "",
    startAt: "",
    endAt: "",
    assignedTo: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    if (mode === "edit" && initialJob) {
      setForm({
        title: String(initialJob?.title || ""),
        status: String(initialJob?.status || "active"),
        code: String(initialJob?.code || ""),
        startAt: toLocalInputValue(initialJob?.startAt),
        endAt: toLocalInputValue(initialJob?.endAt),
        assignedTo: Array.isArray(initialJob?.assignedTo)
          ? initialJob.assignedTo.map(String)
          : [],
      })
    } else {
      setForm({
        title: "",
        status: "active",
        code: "",
        startAt: "",
        endAt: "",
        assignedTo: [],
      })
    }
  }, [open, mode, initialJob])

  const submit = async () => {
    if (!customer?._id) return
    const title = String(form.title || "").trim()
    if (!title) return setError("Job title is required.")

    setSaving(true)
    setError("")
    try {
      const payload = {
        title,
        status: String(form.status || "active"),
        code: String(form.code || "").trim(),
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        assignedTo: Array.isArray(form.assignedTo)
          ? form.assignedTo.map(String)
          : [],
        ...(mode === "create" && parentJobId
          ? { parentJobId: String(parentJobId) }
          : {}),
      }

      if (mode === "edit" && initialJob?._id) {
        await updateCustomerJob(
          String(customer._id),
          String(initialJob._id),
          payload
        )
      } else {
        await createCustomerJob(String(customer._id), payload)
      }

      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-gray-100 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
              <BriefcaseBusiness className="w-5 h-5" />
            </span>
            <div>
              <p className="text-base font-bold text-gray-900">
                {mode === "edit"
                  ? "Edit Job"
                  : parentJobId
                  ? "Create Sub-job"
                  : "Create Job"}
              </p>
              <p className="text-sm text-gray-600">
                {customer?.name ? `Customer: ${customer.name}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 focus:outline-none"
            aria-label="Close"
          >
            <FiX className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Job title *
              </label>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g. Audit preparation"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="active">active</option>
                <option value="on_hold">on_hold</option>
                <option value="completed">completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Code (optional)
              </label>
              <input
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g. JOB-001"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Start (optional)
              </label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, startAt: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                End (optional)
              </label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, endAt: e.target.value }))
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Assignees (optional)
              </label>
              <select
                multiple
                value={form.assignedTo}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map(
                    (o) => o.value
                  )
                  setForm((p) => ({ ...p, assignedTo: selected }))
                }}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {assigneeOptions.length ? (
                  assigneeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No assignees yet
                  </option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Tip: Hold Ctrl/Command to select multiple.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className={cn(btn, btnGhost, "disabled:opacity-60")}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className={cn(btn, btnPrimary, "disabled:opacity-60")}
          >
            {saving ? "Saving..." : mode === "edit" ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================
   ROW EXPAND (ANIM)
========================= */
const RowExpandPanel = memo(function RowExpandPanel({
  open,
  onClosed,
  children,
}) {
  return (
    <AnimatePresence initial={false} onExitComplete={onClosed}>
      {open ? (
        <motion.div
          key="panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="overflow-hidden will-change-[height,opacity]"
        >
          <div className="py-0">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
})

/* =========================
   JOBS DROPDOWN PANEL (your existing, unchanged)
========================= */
function JobsDropdownPanel({
  customer,
  state,
  onRefresh,
  onCreateRoot,
  onCreateSub,
  onEdit,
  onDelete,
  onGoToCRM,
}) {
  const jobs = Array.isArray(state?.jobsTree) ? state.jobsTree : []
  const loading = !!state?.loading
  const error = state?.error || ""

  const [openJobIds, setOpenJobIds] = useState(() => new Set())

  useEffect(() => {
    setOpenJobIds(new Set())
  }, [customer?._id])

  const toggleJobOpen = useCallback((jobId) => {
    const id = String(jobId || "")
    if (!id) return
    setOpenJobIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const JobNode = useMemo(() => {
    const Node = function Node({ job, depth = 0 }) {
      const id = String(job?._id || "")
      const children = Array.isArray(job?.children) ? job.children : []
      const hasChildren = children.length > 0
      const isOpen = openJobIds.has(id)

      const indent = depth ? "pl-4" : ""
      const leftRail = depth
        ? "border-l-2 border-indigo-100"
        : "border-l-2 border-transparent"
      const Icon = depth ? Layers3 : BriefcaseBusiness

      return (
        <div className={cn("relative", leftRail, indent)}>
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="p-3 sm:p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => hasChildren && toggleJobOpen(id)}
                    className={cn(
                      "min-w-0 text-left",
                      "group flex items-start gap-2 rounded-xl",
                      "hover:bg-gray-50/70 focus:outline-none transition",
                      hasChildren ? "cursor-pointer" : "cursor-default"
                    )}
                    title={
                      hasChildren
                        ? isOpen
                          ? "Collapse sub-jobs"
                          : "Expand sub-jobs"
                        : ""
                    }
                  >
                    <span
                      className={cn(
                        "mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border",
                        depth
                          ? "bg-indigo-50/70 border-indigo-100 text-indigo-700"
                          : "bg-gray-50 border-gray-100 text-gray-700"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <p className="text-sm font-extrabold text-gray-900 truncate max-w-[40ch]">
                          {job?.title || "Untitled job"}
                        </p>

                        {hasChildren ? (
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-gray-500 mt-[1px] transition",
                              isOpen ? "rotate-180" : ""
                            )}
                          />
                        ) : null}

                        <JobStatusBadge status={job?.status} />

                        {job?.code ? (
                          <span
                            className={cn(
                              chip,
                              "bg-gray-50 text-gray-700 ring-gray-200"
                            )}
                          >
                            Code: {job.code}
                          </span>
                        ) : null}

                        {hasChildren ? (
                          <span
                            className={cn(
                              chip,
                              "bg-white text-gray-700 ring-gray-200"
                            )}
                          >
                            Sub-jobs: {children.length}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                        {job?.startAt ? (
                          <span
                            className={cn(
                              chip,
                              "bg-white text-gray-700 ring-gray-200"
                            )}
                          >
                            Start: {new Date(job.startAt).toLocaleString()}
                          </span>
                        ) : null}
                        {job?.endAt ? (
                          <span
                            className={cn(
                              chip,
                              "bg-white text-gray-700 ring-gray-200"
                            )}
                          >
                            End: {new Date(job.endAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onGoToCRM?.()}
                  className={cn(btnXs, btnPrimary)}
                  title="Go to CRM"
                >
                  Go <FiArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onCreateSub(job)}
                  className={cn(btnSm, btnGhost)}
                  title="Add sub-job"
                >
                  <FiPlus className="w-4 h-4" />
                  Sub
                </button>

                <button
                  type="button"
                  onClick={() => onEdit(job)}
                  className={iconBtnSm}
                  title="Edit job"
                  aria-label="Edit job"
                >
                  <FiEdit2 className="w-4 h-4 text-gray-700" />
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(job)}
                  className="p-2 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 transition focus:outline-none"
                  title="Delete job"
                  aria-label="Delete job"
                >
                  <FiTrash2 className="w-4 h-4 text-rose-600" />
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {hasChildren && isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="border-t border-gray-100 bg-gradient-to-b from-indigo-50/40 to-white overflow-hidden will-change-[height,opacity]"
                >
                  <div className="p-3 space-y-3">
                    <div className="px-1">
                      <div className="rounded-2xl border border-indigo-100 bg-white/70 p-3">
                        <p className="text-xs font-bold text-gray-900 flex items-center gap-2">
                          <ListTree className="w-4 h-4 text-indigo-700" />
                          Sub-jobs
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Nested under: {job?.title || "Job"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {children.map((child) => (
                        <Node
                          key={String(child?._id)}
                          job={child}
                          depth={depth + 1}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      )
    }

    return memo(Node)
  }, [openJobIds, onCreateSub, onEdit, onDelete, onGoToCRM, toggleJobOpen])

  return (
    <div className="p-4 sm:p-5 border-t border-gray-100">
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 via-white to-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-indigo-100/70 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <BriefcaseBusiness className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900 truncate">
                Jobs & Sub-jobs
              </p>
              <p className="text-xs text-gray-500 truncate">
                Customer:{" "}
                <span className="font-semibold text-gray-700">
                  {customer?.name || "—"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn(chip, "bg-white text-gray-800 ring-gray-200")}>
              Root: {jobs.length}
            </span>

            <button
              onClick={onRefresh}
              className={cn(btnSm, btnGhost)}
              title="Refresh jobs"
            >
              <FiRefreshCcw
                className={cn("w-4 h-4", loading ? "animate-spin" : "")}
              />
              Refresh
            </button>

            <button
              onClick={onCreateRoot}
              className={cn(btnSm, btnPrimary)}
              title="Add root job"
            >
              <FiPlus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {error ? (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm flex items-start gap-2">
            <FiAlertCircle className="w-5 h-5 mt-0.5" />
            <span className="font-semibold">{error}</span>
          </div>
        ) : null}

        <div className="p-4">
          {loading && jobs.length === 0 ? (
            <div className="p-3 rounded-xl bg-white/70 border border-indigo-100 text-gray-700 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-indigo-200 bg-white/70">
              <p className="text-sm font-bold text-gray-900">No jobs yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Click “Add” to create the first root job.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobNode key={String(job?._id)} job={job} depth={0} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* =========================
   COLUMN DEFINITIONS (IMPORTANT)
   Keys MUST match backend allowed keys
========================= */
const COLUMN_DEFS = [
  { key: "name", label: "Customer Name" },
  { key: "companyName", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },

  { key: "contactPerson.name", label: "Contact Person" },
  { key: "contactPerson.email", label: "Contact Email" },
  { key: "contactPerson.phone", label: "Contact Phone" },
  { key: "contactPerson.designation", label: "Contact Designation" },

  { key: "status", label: "Status" },
  { key: "customerType", label: "Customer Type" },
  { key: "lifecycleStage", label: "Lifecycle Stage" },
  { key: "origin", label: "Origin" },

  { key: "jobsCount", label: "Jobs Count" },
  { key: "tasksCount", label: "Tasks Count" },

  { key: "engagementLatestYear", label: "Engagement Year" },
  { key: "engagementLatestTemplateTitle", label: "Engagement Type" },

  { key: "assignedTo", label: "Assigned" },

  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },

  // Special UI column
  { key: "actions", label: "Actions" },
]

const COLUMN_MAP = new Map(COLUMN_DEFS.map((c) => [String(c.key), c]))

/* =========================
   CUSTOMER TABLE (DYNAMIC COLUMNS)
   ✅ FIX: CRUD missing => force "actions" column always visible
   ✅ Also force "name" column always visible
========================= */
export default function CustomerTable({
  customers = [],
  filtered = [],
  debounced = "",
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  disableLoadMore = false,
  onRefreshList,
  onLoadMore,

  // Page-level actions
  onViewCustomer,
  onEditCustomer,
  onAssignCustomer,
  onDeleteCustomer,

  // Navigation into CustomerDetails tabs
  onGoToCustomerCRM,
  onToast,

  // ✅ NEW: visible columns from CustomerPage
  visibleColumns = [],
}) {
  const [expandedCustomerId, setExpandedCustomerId] = useState(null)
  const [closingCustomerId, setClosingCustomerId] = useState(null)
  const [jobsByCustomerId, setJobsByCustomerId] = useState({})
  const jobsAbortRef = useRef({})

  const [jobUpsert, setJobUpsert] = useState({
    open: false,
    customer: null,
    mode: "create",
    initialJob: null,
    parentJobId: null,
  })

  const [jobDelete, setJobDelete] = useState({
    open: false,
    customer: null,
    job: null,
    force: false,
    blockInfo: null,
  })
  const [jobDeleteLoading, setJobDeleteLoading] = useState(false)

  useEffect(() => {
    return () => {
      try {
        Object.values(jobsAbortRef.current || {}).forEach((c) => c?.abort?.())
      } catch {}
    }
  }, [])

  // ✅ sanitize incoming visibleColumns to only known keys
  // ✅ IMPORTANT: force name + actions so CRUD never disappears
  const columnsToRender = useMemo(() => {
    const incoming = Array.isArray(visibleColumns)
      ? visibleColumns.map(String)
      : []

    const cleaned = incoming.filter((k) => COLUMN_MAP.has(String(k)))

    // Fallback if empty
    let list = cleaned.length
      ? cleaned
      : ["name", "companyName", "status", "assignedTo", "actions"]

    // Force required columns
    if (!list.includes("name")) list = ["name", ...list]
    if (!list.includes("actions")) list = [...list, "actions"]

    // De-dupe while keeping order
    const out = []
    const seen = new Set()
    for (const k of list) {
      const kk = String(k)
      if (!COLUMN_MAP.has(kk)) continue
      if (seen.has(kk)) continue
      seen.add(kk)
      out.push(kk)
    }
    return out
  }, [visibleColumns])

  // Total columns = No. + dynamic columns
  const totalCols = 1 + columnsToRender.length

  const loadJobsForCustomer = useCallback(async (customerId) => {
    const cid = String(customerId || "")
    if (!cid) return

    if (jobsAbortRef.current[cid]) {
      jobsAbortRef.current[cid].abort()
    }
    const controller = new AbortController()
    jobsAbortRef.current[cid] = controller

    setJobsByCustomerId((p) => ({
      ...p,
      [cid]: { ...(p[cid] || {}), loading: true, error: "" },
    }))

    try {
      const data = await fetchCustomerJobs(cid, controller.signal)
      setJobsByCustomerId((p) => ({
        ...p,
        [cid]: {
          loading: false,
          error: "",
          jobsTree: Array.isArray(data?.jobsTree) ? data.jobsTree : [],
          jobsFlat: Array.isArray(data?.jobsFlat) ? data.jobsFlat : [],
        },
      }))
    } catch (e) {
      if (e?.name === "AbortError") return
      setJobsByCustomerId((p) => ({
        ...p,
        [cid]: {
          ...(p[cid] || {}),
          loading: false,
          error: e?.message || "Failed to load jobs.",
        },
      }))
    }
  }, [])

  const toggleRowDropdown = useCallback(
    (customer) => {
      const cid = String(customer?._id || "")
      if (!cid) return

      if (expandedCustomerId === cid) {
        setClosingCustomerId(cid)
        setExpandedCustomerId(null)
        return
      }

      if (expandedCustomerId) {
        setClosingCustomerId(expandedCustomerId)
        setExpandedCustomerId(null)
        requestAnimationFrame(() => {
          setClosingCustomerId(null)
          setExpandedCustomerId(cid)
        })
      } else {
        setExpandedCustomerId(cid)
      }

      const has =
        jobsByCustomerId[cid]?.jobsTree || jobsByCustomerId[cid]?.loading
      if (!has) loadJobsForCustomer(cid)
    },
    [expandedCustomerId, jobsByCustomerId, loadJobsForCustomer]
  )

  const openCreateRootJob = (customer) => {
    setJobUpsert({
      open: true,
      customer,
      mode: "create",
      initialJob: null,
      parentJobId: null,
    })
  }

  const openCreateSubJob = (customer, parentJob) => {
    setJobUpsert({
      open: true,
      customer,
      mode: "create",
      initialJob: null,
      parentJobId: String(parentJob?._id || ""),
    })
  }

  const openEditJob = (customer, job) => {
    setJobUpsert({
      open: true,
      customer,
      mode: "edit",
      initialJob: job,
      parentJobId: null,
    })
  }

  const askDeleteJob = (customer, job) => {
    setJobDelete({ open: true, customer, job, force: false, blockInfo: null })
  }

  const closeJobDelete = () => {
    if (jobDeleteLoading) return
    setJobDelete((p) => ({ ...p, open: false }))
  }

  const confirmJobDelete = async () => {
    const customer = jobDelete.customer
    const job = jobDelete.job
    if (!customer?._id || !job?._id) return

    setJobDeleteLoading(true)
    try {
      await deleteCustomerJob(String(customer._id), String(job._id), {
        force: !!jobDelete.force,
      })
      onToast?.("success", "Job deleted.")
      setJobDelete((p) => ({ ...p, open: false }))
      await loadJobsForCustomer(String(customer._id))
    } catch (e) {
      if (e?.status === 409) {
        setJobDelete((p) => ({
          ...p,
          open: true,
          blockInfo: {
            tasksCount: e?.data?.tasksCount,
            message: e?.message,
          },
        }))
        onToast?.("error", e?.message || "Cannot delete job.")
      } else {
        onToast?.("error", e?.message || "Delete failed")
      }
    } finally {
      setJobDeleteLoading(false)
    }
  }

  const renderCell = (c, colKey, isExpanded, isClosing) => {
    if (colKey === "actions") {
      return (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onViewCustomer?.(c)}
            className={cn(btn, btnPrimary, "px-4 py-2")}
          >
            <FiEye className="w-4 h-4" />
            View
          </button>

          <button
            onClick={() => onEditCustomer?.(c)}
            className={iconBtn}
            title="Edit"
            aria-label="Edit"
          >
            <FiEdit2 className="w-4 h-4 text-gray-700" />
          </button>

          <button
            onClick={() => onAssignCustomer?.(c)}
            className={iconBtn}
            title="Assign"
            aria-label="Assign"
          >
            <FiUserCheck className="w-4 h-4 text-gray-700" />
          </button>

          <button
            onClick={() => onDeleteCustomer?.(c)}
            className={cn(iconBtn, btnDanger)}
            title="Delete"
            aria-label="Delete"
          >
            <FiTrash2 className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      )
    }

    if (colKey === "assignedTo") {
      const assignedArr = normalizeAssignedToArray(c?.assignedTo)
      const assignedNames = assignedArr
        .map((x) => (typeof x === "object" ? x?.name : String(x || "")))
        .filter(Boolean)
      const assignedDisplay = assignedNames.length
        ? assignedNames.join(", ")
        : "—"
      return <span className="text-sm text-gray-700">{assignedDisplay}</span>
    }

    if (colKey === "name") {
      return (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{c?.name || "Unnamed"}</p>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-bold",
                "px-2 py-1 rounded-full border",
                isExpanded
                  ? "bg-indigo-50 border-indigo-100 text-indigo-700"
                  : "bg-white border-gray-200 text-gray-600"
              )}
            >
              {isExpanded ? "Hide jobs" : "Show jobs"}{" "}
              <FiChevronDown
                className={cn(
                  "w-3.5 h-3.5 transition",
                  isExpanded ? "rotate-180" : ""
                )}
              />
            </span>

            {isClosing ? (
              <span className={cn(chip, "bg-gray-50 text-gray-600 ring-gray-200")}>
                Closing…
              </span>
            ) : null}
          </div>

          <p className="text-xs text-gray-500 mt-0.5">
            {c?.companyName ? `Company: ${c.companyName}` : "Company: —"} •{" "}
            {c?.contactPerson?.name
              ? `Contact: ${c.contactPerson.name}`
              : "Contact: —"}
          </p>
        </div>
      )
    }

    if (colKey === "createdAt" || colKey === "updatedAt") {
      return (
        <span className="text-sm text-gray-700">
          {formatDate(getByPath(c, colKey))}
        </span>
      )
    }

    // default text render (including nested keys like contactPerson.name)
    const v = getByPath(c, colKey)
    return (
      <span className="text-sm text-gray-700">
        {v == null || v === "" ? "—" : String(v)}
      </span>
    )
  }

  return (
    <div className={cn(card, "overflow-hidden")}>
      {/* Job delete modal (table-owned) */}
      <ConfirmDeleteModal
        open={jobDelete.open}
        title="Delete job?"
        description={
          jobDelete?.job?.title
            ? `This will delete "${jobDelete.job.title}".`
            : "This will delete this job."
        }
        confirmText={jobDelete.force ? "Force delete" : "Delete"}
        loading={jobDeleteLoading}
        onClose={closeJobDelete}
        onConfirm={confirmJobDelete}
        extra={
          <div className="space-y-3">
            {jobDelete.blockInfo?.message ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <p className="font-bold">Blocked</p>
                <p className="mt-1">
                  {jobDelete.blockInfo.message}
                  {typeof jobDelete.blockInfo.tasksCount === "number" ? (
                    <span className="font-semibold">
                      {" "}
                      (Tasks: {jobDelete.blockInfo.tasksCount})
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!jobDelete.force}
                onChange={(e) =>
                  setJobDelete((p) => ({ ...p, force: !!e.target.checked }))
                }
              />
              <span className="text-sm text-gray-700">
                Force delete (also deletes tasks under this job){" "}
                <span className="text-rose-600 font-semibold">— use carefully</span>
              </span>
            </label>
          </div>
        }
      />

      {/* Job upsert modal (table-owned) */}
      <AnimatePresence>
        {jobUpsert.open ? (
          <JobUpsertModal
            open={jobUpsert.open}
            customer={jobUpsert.customer}
            mode={jobUpsert.mode}
            initialJob={jobUpsert.initialJob}
            parentJobId={jobUpsert.parentJobId}
            onClose={() =>
              setJobUpsert({
                open: false,
                customer: null,
                mode: "create",
                initialJob: null,
                parentJobId: null,
              })
            }
            onSaved={() => {
              const cid = String(jobUpsert.customer?._id || "")
              if (cid) loadJobsForCustomer(cid)
              onToast?.(
                "success",
                jobUpsert.mode === "edit" ? "Job updated." : "Job created."
              )
            }}
          />
        ) : null}
      </AnimatePresence>

      {/* ✅ Smooth scroll container */}
      <div className="max-h-[65vh] overflow-y-auto [scrollbar-gutter:stable] overscroll-contain">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100">
            <tr>
              {/* fixed No. column */}
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
                No.
              </th>

              {/* dynamic columns */}
              {columnsToRender.map((k) => {
                const def = COLUMN_MAP.get(String(k))
                const label = def?.label || String(k)
                const alignRight = k === "actions"
                return (
                  <th
                    key={String(k)}
                    className={cn(
                      "px-6 py-4 text-sm font-semibold text-gray-600",
                      alignRight ? "text-right" : "text-left"
                    )}
                  >
                    {label}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {isLoading && customers.length === 0 ? (
              [...Array(8)].map((_, idx) => (
                <tr key={`sk-${idx}`} className="animate-pulse">
                  {[...Array(totalCols)].map((__, i) => (
                    <td key={`sk-${idx}-${i}`} className="px-6 py-4">
                      <div className="h-4 w-full max-w-[12rem] bg-gray-200 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((c, index) => {
                const isExpanded =
                  String(expandedCustomerId || "") === String(c?._id || "")
                const isClosing =
                  String(closingCustomerId || "") === String(c?._id || "")
                const showPanelRow = isExpanded || isClosing

                return (
                  <Fragment key={String(c?._id || `cust-${index}`)}>
                    <tr
                      className={cn(subtleHover, "cursor-pointer")}
                      onClick={() => toggleRowDropdown(c)}
                      title="Click row to open jobs"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {index + 1}
                      </td>

                      {columnsToRender.map((colKey) => (
                        <td
                          key={String(colKey)}
                          className={cn(
                            "px-6 py-4",
                            colKey === "actions" ? "text-right" : "text-left"
                          )}
                        >
                          {renderCell(c, colKey, isExpanded, isClosing)}
                        </td>
                      ))}
                    </tr>

                    {showPanelRow ? (
                      <tr>
                        <td colSpan={totalCols} className="p-0">
                          <RowExpandPanel
                            open={isExpanded}
                            onClosed={() => {
                              if (isClosing) setClosingCustomerId(null)
                            }}
                          >
                            <JobsDropdownPanel
                              customer={c}
                              state={
                                jobsByCustomerId[String(c._id)] || {
                                  loading: false,
                                  error: "",
                                  jobsTree: [],
                                }
                              }
                              onRefresh={() => loadJobsForCustomer(String(c._id))}
                              onCreateRoot={() => openCreateRootJob(c)}
                              onCreateSub={(parentJob) =>
                                openCreateSubJob(c, parentJob)
                              }
                              onEdit={(job) => openEditJob(c, job)}
                              onDelete={(job) => askDeleteJob(c, job)}
                              onGoToCRM={() => onGoToCustomerCRM?.(String(c._id))}
                            />
                          </RowExpandPanel>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={totalCols}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {debounced
                    ? "No customers match your search."
                    : "No customers found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center p-4 text-sm text-gray-600 border-t border-gray-100 bg-white">
        <span>
          Loaded:{" "}
          <span className="font-bold text-gray-900">{customers.length}</span>
          {debounced ? (
            <>
              {" "}
              • Showing:{" "}
              <span className="font-bold text-gray-900">{filtered.length}</span>
            </>
          ) : null}
        </span>

        <div className="flex items-center gap-2">
          <button onClick={onRefreshList} className={cn(btn, btnGhost, "px-4 py-2")}>
            Refresh list
          </button>

          <button
            onClick={onLoadMore}
            disabled={disableLoadMore}
            className={cn(btn, btnPrimary, "px-4 py-2 disabled:opacity-60")}
            title={
              debounced
                ? "Clear search to load more"
                : hasMore
                ? "Load next page"
                : "No more customers"
            }
          >
            {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {debounced
              ? "Clear search to load more"
              : hasMore
              ? "Load more"
              : "No more"}
          </button>
        </div>
      </div>
    </div>
  )
}
