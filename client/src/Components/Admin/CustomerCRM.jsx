"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  FiChevronDown,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiFolder,
  FiHash,
  FiPlus,
  FiSave,
  FiTrash2,
  FiUpload,
  FiX,
  FiFilter,
  FiSearch,
  FiRotateCcw,
  FiTag,
} from "react-icons/fi"
import {
  HiOutlineArchive,
  HiOutlineDocument,
  HiOutlineDocumentText,
  HiOutlinePhotograph,
  HiOutlineTable,
} from "react-icons/hi"
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const TASKS_PAGE_SIZE = 20

/* =================== HELPERS =================== */
const cn = (...c) => c.filter(Boolean).join(" ")

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ""
  const units = ["B", "KB", "MB", "GB"]
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDateTime(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function toLocalInputValue(value) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function formatTimeLeft(ms) {
  if (ms === null || ms === undefined) return "—"
  const neg = ms < 0
  const abs = Math.abs(ms)

  const totalSeconds = Math.floor(abs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours || days) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)

  return `${neg ? "Overdue by " : "Due in "}${parts.join(" ")}`
}

function getTaskTargetDate(t) {
  const v = t?.dueAt
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function duePill(timeLeftMs, status) {
  if (timeLeftMs === null) return "bg-gray-100 text-gray-700 border border-gray-200"
  if (timeLeftMs < 0 && status !== "done") return "bg-red-50 text-red-700 border border-red-200"
  return "bg-emerald-50 text-emerald-700 border border-emerald-200"
}

function fileIcon(mimeType = "", name = "") {
  const n = (name || "").toLowerCase()
  const m = (mimeType || "").toLowerCase()

  const isPdf = m.includes("pdf") || n.endsWith(".pdf")
  if (isPdf) return <HiOutlineDocumentText className="w-5 h-5" />

  const isWord =
    m.includes("msword") ||
    m.includes("officedocument.wordprocessingml") ||
    n.endsWith(".doc") ||
    n.endsWith(".docx")
  if (isWord) return <HiOutlineDocument className="w-5 h-5" />

  const isExcel =
    m.includes("ms-excel") ||
    m.includes("officedocument.spreadsheetml") ||
    n.endsWith(".xls") ||
    n.endsWith(".xlsx") ||
    n.endsWith(".csv")
  if (isExcel) return <HiOutlineTable className="w-5 h-5" />

  const isImage =
    m.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].some((x) => n.endsWith(x))
  if (isImage) return <HiOutlinePhotograph className="w-5 h-5" />

  const isZip =
    m.includes("zip") ||
    m.includes("rar") ||
    m.includes("7z") ||
    [".zip", ".rar", ".7z"].some((x) => n.endsWith(x))
  if (isZip) return <HiOutlineArchive className="w-5 h-5" />

  return <HiOutlineDocument className="w-5 h-5" />
}

/** resolve assignees from either populated objects OR ids */
function resolveAssignees(taskAssignedTo, assignedEmployees) {
  const arr = Array.isArray(taskAssignedTo) ? taskAssignedTo : []
  const map = new Map((assignedEmployees || []).map((u) => [String(u._id), u]))

  return arr
    .map((x) => {
      if (x && typeof x === "object") {
        const id = String(x._id || x.id || "")
        const name = x.name || x.fullName || x.email || map.get(id)?.name || id
        return { _id: id || name, name }
      }
      const id = String(x)
      const u = map.get(id)
      return { _id: id, name: u?.name || u?.email || id }
    })
    .filter((x) => x && x._id)
}

/* ✅ ONLY TWO ROLES: ADMIN + EMPLOYEE */
function roleBadgeClasses(role) {
  const r = String(role || "").toLowerCase()
  if (r === "employee") return "bg-amber-500 text-white border border-amber-500"
  return "bg-indigo-600 text-white border border-indigo-600"
}

function roleLabel(role) {
  const r = String(role || "").toLowerCase()
  return r === "employee" ? "EMPLOYEE" : "ADMIN"
}

function normalizeRole(role) {
  const r = String(role || "").toLowerCase()
  return r === "employee" ? "employee" : "admin"
}

/* =================== API =================== */
async function presignUploadForTask({ file, customerId, taskId, subtitleId }) {
  const res = await fetch(`${API_BASE}/upload/presign`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      customerId,
      taskId,
      subtitleId: subtitleId || undefined,
      scope: "subtitle",
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to presign upload")
  return data
}

async function putToS3({ uploadUrl, file }) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  })
  if (!res.ok) throw new Error("S3 upload failed")
}

async function addSubtitleFilesApi({ customerId, taskId, subtitleId, body }) {
  const res = await fetch(
    `${API_BASE}/customers/${customerId}/tasks/${taskId}/subtitles/${subtitleId}/files`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to save subtitle files")
  return data
}

async function addSubtitleNoteApi({ customerId, taskId, subtitleId, text }) {
  const res = await fetch(
    `${API_BASE}/customers/${customerId}/tasks/${taskId}/subtitles/${subtitleId}/notes`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text }),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to save subtitle note")
  return data
}

async function patchSubtitleFileApi({ customerId, taskId, subtitleId, fileId, body }) {
  const res = await fetch(
    `${API_BASE}/customers/${customerId}/tasks/${taskId}/subtitles/${subtitleId}/files/${fileId}`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to update subtitle file")
  return data
}

async function deleteSubtitleFileApi({ customerId, taskId, subtitleId, fileId }) {
  const res = await fetch(
    `${API_BASE}/customers/${customerId}/tasks/${taskId}/subtitles/${subtitleId}/files/${fileId}`,
    { method: "DELETE", headers: getAuthHeaders() }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to delete subtitle file")
  return data
}

async function patchTaskAdmin({ customerId, taskId, body }) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/tasks/${taskId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to update task")
  return data
}

async function patchTaskStatus({ customerId, taskId, status }) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to update status")
  return data
}

async function deleteTaskApi({ customerId, taskId }) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/tasks/${taskId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to delete task")
  return data
}

async function fetchTaskTemplatesApi() {
  const res = await fetch(`${API_BASE}/task-templates?active=true`, { headers: getAuthHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch task templates")
  return data?.templates || []
}

async function fetchCustomerTasksApi({ customerId, limit = TASKS_PAGE_SIZE, cursor = null }) {
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", String(cursor))

  const res = await fetch(`${API_BASE}/customers/${customerId}/tasks?${qs.toString()}`, {
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch tasks")
  return {
    tasks: Array.isArray(data?.tasks) ? data.tasks : [],
    nextCursor: data?.nextCursor || null,
    hasMore: !!data?.hasMore,
    count: Number(data?.count ?? 0),
  }
}

/* ---- JOBS ---- */
async function fetchCustomerJobsApi({ customerId }) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/jobs`, { headers: getAuthHeaders() })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch jobs")
  const jobsFlat = Array.isArray(data?.jobsFlat) ? data.jobsFlat : Array.isArray(data?.jobs) ? data.jobs : []
  const jobsTree = Array.isArray(data?.jobsTree) ? data.jobsTree : []
  return { jobsFlat, jobsTree }
}

async function createJobApi({ customerId, title, parentJobId = null }) {
  const res = await fetch(`${API_BASE}/customers/${customerId}/jobs`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      title: String(title || "").trim(),
      parentJobId: parentJobId ? String(parentJobId) : null,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to create job")
  return data
}

async function deleteJobApi({ customerId, jobId, force = false }) {
  const qs = new URLSearchParams()
  if (force) qs.set("force", "true")

  const res = await fetch(`${API_BASE}/customers/${customerId}/jobs/${jobId}?${qs.toString()}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to delete job")
  return data
}

/* =================== UI PARTS =================== */
function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-700 border-gray-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  }
  const cls = tones[tone] || tones.gray
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide border",
        cls
      )}
    >
      {children}
    </span>
  )
}

function ConfirmDeleteModal({ open, title, description, confirmText = "Delete", loading, onClose, onConfirm }) {
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 break-words">{title}</h3>
            <p className="text-sm text-gray-600 mt-1 break-words">{description}</p>
          </div>
          <button
            ref={closeBtnRef}
            disabled={loading}
            onClick={onClose}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 shrink-0"
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 pb-4 sm:pb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <button
            disabled={loading}
            onClick={onClose}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* Smooth collapse */
function SmoothCollapse({ open, children }) {
  const innerRef = useRef(null)
  const [height, setHeight] = useState(0)
  const [isAuto, setIsAuto] = useState(false)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    if (open) {
      setIsAuto(false)
      setHeight(0)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(el.scrollHeight))
      })
    } else {
      setIsAuto(false)
      const current = el.scrollHeight
      setHeight(current)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0))
      })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const el = innerRef.current
    if (!el) return

    const ro = new ResizeObserver(() => {
      if (!open) return
      if (isAuto) return
      setHeight(el.scrollHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, isAuto])

  const onTransitionEnd = () => {
    if (!open) return
    setIsAuto(true)
  }

  return (
    <div
      className="overflow-hidden transition-[height,opacity] duration-300 ease-out will-change-[height,opacity]"
      style={{ height: isAuto ? "auto" : `${height}px`, opacity: open ? 1 : 0 }}
      onTransitionEnd={onTransitionEnd}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

/* Manual subtitles editor */
function ManualSubtitlesEditor({ value, onChange }) {
  const [input, setInput] = useState("")

  const addOne = () => {
    const t = String(input || "").trim()
    if (!t) return
    const key = t.toLowerCase()
    const exists = (value || []).some((x) => String(x).trim().toLowerCase() === key)
    if (exists) {
      setInput("")
      return
    }
    onChange([...(value || []), t])
    setInput("")
  }

  const removeOne = (idx) => onChange((value || []).filter((_, i) => i !== idx))

  return (
    <div className="md:col-span-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <FiHash /> Subtitles (optional)
      </div>

      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-white text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          placeholder="Add subtitle"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addOne()
            }
          }}
        />
        <button
          type="button"
          onClick={addOne}
          className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        >
          <FiPlus /> Add
        </button>
      </div>

      {(value || []).length ? (
        <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
          {(value || []).map((t, idx) => (
            <div key={`${t}-${idx}`} className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-800 break-words min-w-0">• {t}</p>
              <button
                type="button"
                onClick={() => removeOne(idx)}
                className="h-8 w-8 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 shrink-0"
                title="Remove"
                aria-label="Remove subtitle"
              >
                <FiX />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* =================== SUBTITLE PANEL =================== */
function SubtitleWorkPanel({
  task,
  subtitle,
  busyKey,
  noteDraft,
  setNoteDraft,
  onUpload,
  onAddNote,
  onRenameFile,
  onDeleteFile,
  inferActorRole,
}) {
  const subtitleId = String(subtitle?._id || "")
  const [open, setOpen] = useState(false)

  const [renamingFileId, setRenamingFileId] = useState("")
  const [renameValue, setRenameValue] = useState("")
  const [renameErr, setRenameErr] = useState("")

  const files = Array.isArray(subtitle?.files) ? subtitle.files : []
  const notes = Array.isArray(subtitle?.notes) ? subtitle.notes : []
  const busy = typeof busyKey === "string" && busyKey.startsWith(`${task?._id}:${subtitleId}`)
  const draft = noteDraft?.[subtitleId] || ""

  const roleForFile = (f) => inferActorRole?.(String(f?.uploadedBy || ""), task?.assignedTo) || "admin"
  const roleForNote = (n) => inferActorRole?.(String(n?.createdBy || ""), task?.assignedTo) || "admin"

  const fileCounts = files.reduce(
    (acc, f) => {
      const k = normalizeRole(roleForFile(f))
      acc[k] = (acc[k] || 0) + 1
      return acc
    },
    { admin: 0, employee: 0 }
  )

  const noteCounts = notes.reduce(
    (acc, n) => {
      const k = normalizeRole(roleForNote(n))
      acc[k] = (acc[k] || 0) + 1
      return acc
    },
    { admin: 0, employee: 0 }
  )

  const sortedFiles = files.slice().sort((a, b) => {
    const ra = normalizeRole(roleForFile(a))
    const rb = normalizeRole(roleForFile(b))

    const wa = ra === "admin" ? 0 : 1
    const wb = rb === "admin" ? 0 : 1
    if (wa !== wb) return wa - wb

    const ta = a?.uploadedAt ? new Date(a.uploadedAt).getTime() : 0
    const tb = b?.uploadedAt ? new Date(b.uploadedAt).getTime() : 0
    return tb - ta
  })

  const startRename = (f) => {
    setRenameErr("")
    const fid = String(f?._id || "")
    setRenamingFileId(fid)
    const current = String((f?.displayName || "").trim() || (f?.originalName || "").trim() || "")
    setRenameValue(current)
  }

  const cancelRename = () => {
    setRenameErr("")
    setRenamingFileId("")
    setRenameValue("")
  }

  const submitRename = async (f) => {
    setRenameErr("")
    const fid = String(f?._id || "")
    const next = String(renameValue || "").trim()
    if (!fid) return
    if (!next) {
      setRenameErr("Display name cannot be empty.")
      return
    }
    await onRenameFile?.(task?._id, subtitleId, fid, next)
    cancelRename()
  }

  const renderFileRow = (f, idx) => {
    const shown = (f.displayName || "").trim() || f.originalName || f.key
    const fid = String(f?._id || "")
    const role = roleForFile(f)
    const isEmpFile = String(role).toLowerCase() === "employee"
    const isAdminFile = !isEmpFile

    const rowClass = isAdminFile ? "border-indigo-300 bg-indigo-50/70" : "border-amber-300 bg-amber-50/70"
    const leftBar = isAdminFile ? "bg-indigo-600" : "bg-amber-500"
    const iconBox = isAdminFile
      ? "bg-indigo-100 border-indigo-200 text-indigo-800"
      : "bg-amber-100 border-amber-200 text-amber-800"

    const isRenaming = renamingFileId && renamingFileId === fid

    return (
      <div
        key={`${String(f?._id || f.key)}-${idx}`}
        className={`relative p-3 rounded-2xl border ${rowClass} flex flex-col gap-3 overflow-hidden`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${leftBar}`} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pl-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center ${iconBox} shrink-0`}
            >
              {fileIcon(f.mimeType, f.originalName)}
            </div>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-gray-900 truncate">
                {shown}
                <span
                  className={[
                    "ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide border",
                    roleBadgeClasses(role),
                  ].join(" ")}
                >
                  {roleLabel(role)}
                </span>
              </p>

              <p className="text-xs text-gray-600">
                {f.size ? `${formatBytes(f.size)} • ` : ""}
                {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            {f.url ? (
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full md:w-auto items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
              >
                <FiExternalLink className="w-4 h-4" />
                Open
              </a>
            ) : (
              <span className="text-xs text-gray-500 self-center">No direct link</span>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => startRename(f)}
              className="inline-flex w-full md:w-auto items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
              title="Rename"
            >
              <FiEdit2 className="w-4 h-4" />
              Rename
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => onDeleteFile?.(task?._id, subtitleId, fid, f)}
              className="inline-flex w-full md:w-auto items-center justify-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 text-sm font-semibold disabled:opacity-60"
              title="Delete file"
            >
              <FiTrash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {isRenaming ? (
          <div className="pl-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-extrabold text-gray-700 mb-2">Rename file display name</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  disabled={busy}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm"
                  placeholder="Display name"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submitRename(f)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60"
                >
                  <FiSave />
                  Save
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelRename}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
                >
                  <FiX />
                  Cancel
                </button>
              </div>
              {renameErr ? <p className="text-xs text-red-600 mt-2">{renameErr}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const adminTotal = fileCounts.admin + noteCounts.admin
  const employeeTotal = fileCounts.employee + noteCounts.employee

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-start sm:items-center justify-between gap-2 text-left hover:bg-gray-50/40"
        aria-expanded={open}
      >
        <div className="min-w-0 flex items-start gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 sm:mt-0">
            <FiHash className="w-4 h-4" />
          </span>

          <div className="min-w-0">
            <p className="text-[13px] sm:text-sm font-extrabold text-indigo-700 truncate">{subtitle?.text || "—"}</p>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-gray-500">
              <span>
                {files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "No files"} •{" "}
                {notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}` : "No notes"}
              </span>

              {(adminTotal || employeeTotal) ? (
                <span className="inline-flex items-center gap-1">
                  {adminTotal ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-indigo-50 text-indigo-700 border-indigo-200">
                      ADMIN {adminTotal}
                    </span>
                  ) : null}
                  {employeeTotal ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-50 text-amber-800 border-amber-200">
                      EMPLOYEE {employeeTotal}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <FiChevronDown
          className={["w-5 h-5 text-gray-600 transition-transform duration-300 shrink-0", open ? "rotate-180" : ""].join(
            " "
          )}
        />
      </button>

      <SmoothCollapse open={open}>
        <div className="px-3 sm:px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                Files / Notes
              </span>
              <span className="text-gray-400">•</span>
              <span className="inline-flex items-center gap-2 text-[10px] font-extrabold">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${roleBadgeClasses("admin")}`}>
                  ADMIN
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${roleBadgeClasses("employee")}`}>
                  EMPLOYEE
                </span>
              </span>
            </div>

            <label className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer text-sm font-semibold shrink-0">
              <FiUpload />
              {busy ? "Working..." : "Upload files"}
              <input
                type="file"
                hidden
                multiple
                disabled={busy}
                onChange={(e) => {
                  const list = Array.from(e.target.files || [])
                  e.target.value = ""
                  if (list.length) onUpload(task._id, subtitleId, list, draft)
                }}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-3 sm:p-4 mb-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-700">Add note (optional)</p>
              <button
                type="button"
                disabled={busy || !String(draft || "").trim()}
                onClick={() => onAddNote(task._id, subtitleId, draft)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
                title="Add note"
              >
                <FiPlus />
                Add
              </button>
            </div>

            <textarea
              value={draft}
              onChange={(e) => setNoteDraft((prev) => ({ ...(prev || {}), [subtitleId]: e.target.value }))}
              rows={2}
              disabled={busy}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-sm"
              placeholder="Write a note for this subtitle..."
            />

            <p className="mt-2 text-xs text-gray-500">
              Tip: If you upload files while a note is written, the note will also be saved along with the upload.
            </p>
          </div>

          <div className="mb-5">
            <p className="text-xs font-extrabold text-indigo-700 mb-2 flex items-center gap-2">
              <FiFolder className="w-4 h-4" />
              Files
            </p>

            {sortedFiles.length ? (
              <div className="space-y-2">{sortedFiles.map((f, idx) => renderFileRow(f, idx))}</div>
            ) : (
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-sm text-gray-500 text-center">
                No files uploaded for this subtitle.
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-extrabold text-indigo-700 mb-2 flex items-center gap-2">
              <FiFileText className="w-4 h-4" />
              Notes
            </p>

            {notes.length ? (
              <div className="space-y-2">
                {notes
                  .slice()
                  .reverse()
                  .map((n, idx) => {
                    const r = inferActorRole?.(String(n?.createdBy || ""), task?.assignedTo) || "admin"
                    const isEmp = String(r).toLowerCase() === "employee"
                    const noteBoxClass = isEmp ? "border-amber-200 bg-amber-50/40" : "border-indigo-200 bg-indigo-50/40"

                    return (
                      <div key={String(n?._id || idx)} className={`p-3 rounded-2xl border ${noteBoxClass}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${roleBadgeClasses(
                                r
                              )}`}
                            >
                              {roleLabel(r)}
                            </span>
                            <p className="text-xs font-semibold text-gray-700">Note</p>
                          </div>
                          <p className="text-xs text-gray-500">{formatDateTime(n?.createdAt)}</p>
                        </div>
                        <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap break-words">{n?.text || "—"}</p>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-sm text-gray-500 text-center">
                No notes yet for this subtitle.
              </div>
            )}
          </div>
        </div>
      </SmoothCollapse>
    </div>
  )
}

/* =================== JOB MODAL =================== */
function JobModal({ open, loading, jobsTree, mode, parentJobId, onClose, onSubmit }) {
  const [title, setTitle] = useState("")
  const [parentId, setParentId] = useState(parentJobId ? String(parentJobId) : "")

  useEffect(() => {
    if (!open) return
    setTitle("")
    setParentId(parentJobId ? String(parentJobId) : "")
  }, [open, parentJobId])

  if (!open) return null

  const heading = mode === "sub" ? "Create Sub Job" : "Create Job"
  const canSave = !loading && String(title || "").trim().length > 0

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 flex items-start justify-between gap-3 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900">{heading}</h3>
            <p className="text-sm text-gray-500 mt-1">Jobs can have sub-jobs.</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 shrink-0"
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Job title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              placeholder="e.g., Audit / VAT / Bookkeeping"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Parent (optional)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              disabled={loading || mode === "sub"}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              title={mode === "sub" ? "Parent is fixed for sub-job" : "Choose a parent to create sub-job"}
            >
              <option value="">No parent (root job)</option>
              {(jobsTree || []).map((j) => (
                <option key={String(j?._id)} value={String(j?._id)}>
                  {j?.title || "Job"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            onClick={() => onSubmit?.({ title, parentJobId: mode === "sub" ? parentJobId : parentId || null })}
            disabled={!canSave}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FiPlus />
                Create
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =================== TASK MODAL (Job + Sub-job as separate fields) =================== */
function TaskModal({
  open,
  mode,
  loading,
  templates,
  assignedEmployees,
  canAssign,
  jobsFlat,
  jobIdValue,
  setJobIdValue,
  value,
  setValue,
  subtitlesValue,
  setSubtitlesValue,
  templateId,
  setTemplateId,
  selectedSubtitleIds,
  setSelectedSubtitleIds,
  titleValue,
  setTitleValue,
  statusValue,
  setStatusValue,
  dueAtValue,
  setDueAtValue,
  assigneesValue,
  setAssigneesValue,
  onClose,
  onSubmit,
  isEmployeeMode = false,
}) {
  const closeBtnRef = useRef(null)
  const titleRef = useRef(null)

  // ✅ Build maps so we can show "Job" then "Sub-job"
  const jobById = useMemo(() => {
    const m = new Map()
    for (const j of jobsFlat || []) m.set(String(j?._id), j)
    return m
  }, [jobsFlat])

  const rootJobs = useMemo(() => (jobsFlat || []).filter((j) => !j?.parentJobId), [jobsFlat])

  const subJobsByParent = useMemo(() => {
    const map = new Map()
    for (const j of jobsFlat || []) {
      const pid = j?.parentJobId ? String(j.parentJobId) : ""
      if (!pid) continue
      if (!map.has(pid)) map.set(pid, [])
      map.get(pid).push(j)
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => String(a?.title || "").localeCompare(String(b?.title || "")))
      map.set(k, arr)
    }
    return map
  }, [jobsFlat])

  const deriveRootAndSubFromJobId = (jobId) => {
    const id = String(jobId || "")
    if (!id) return { rootId: "", subId: "" }
    const j = jobById.get(id)
    if (!j) return { rootId: "", subId: "" }
    if (j?.parentJobId) {
      const rootId = String(j.parentJobId)
      return { rootId, subId: id }
    }
    return { rootId: id, subId: "" }
  }

  const [selectedRootId, setSelectedRootId] = useState("")
  const [selectedSubId, setSelectedSubId] = useState("")

  useEffect(() => {
    if (!open) return
    const { rootId, subId } = deriveRootAndSubFromJobId(jobIdValue)
    setSelectedRootId(rootId)
    setSelectedSubId(subId)
  }, [open, jobIdValue, jobById])

  const onSelectRoot = (rootId) => {
    const rid = String(rootId || "")
    setSelectedRootId(rid)
    setSelectedSubId("")
    if (!rid) {
      setJobIdValue("")
      return
    }
    setJobIdValue(rid)
  }

  const onSelectSub = (subId) => {
    const sid = String(subId || "")
    setSelectedSubId(sid)
    if (sid) setJobIdValue(sid)
    else setJobIdValue(selectedRootId || "")
  }

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      closeBtnRef.current?.focus()
      titleRef.current?.focus()
    }, 80)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, onSubmit])

  if (!open) return null

  const selectedTemplate = templates.find((t) => String(t._id) === String(templateId)) || null
  const templateSubs = Array.isArray(selectedTemplate?.subtitles) ? selectedTemplate.subtitles : []
  const inTemplateMode = !!templateId

  const toggleAssignee = (id) => {
    setAssigneesValue((prev) => {
      const s = new Set(prev || [])
      const sid = String(id)
      if (s.has(sid)) s.delete(sid)
      else s.add(sid)
      return Array.from(s)
    })
  }

  const toggleSubtitle = (id) => {
    setSelectedSubtitleIds((prev) => {
      const s = new Set(prev || [])
      const sid = String(id)
      if (s.has(sid)) s.delete(sid)
      else s.add(sid)
      return Array.from(s)
    })
  }

  const heading = mode === "edit" ? "Update Task" : "Create Task"
  const submitLabel = mode === "edit" ? "Update" : "Create"

  const canSaveEmployee = !loading && String(statusValue || "").length > 0

  const canSaveAdmin =
    !loading &&
    canAssign &&
    (assigneesValue || []).length > 0 &&
    (inTemplateMode ? true : String(titleValue || "").trim().length > 0)

  const canSave = isEmployeeMode ? canSaveEmployee : canSaveAdmin
  const subJobsForSelectedRoot = selectedRootId ? subJobsByParent.get(String(selectedRootId)) || [] : []
  const controlClass =
    "w-full h-11 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50 disabled:text-gray-500"

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />

      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[94vh] sm:max-h-[88vh] flex flex-col">
        <div className="p-4 sm:p-5 flex items-start justify-between gap-3 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900">{heading}</h3>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 shrink-0 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            aria-label="Close"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {isEmployeeMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value)}
                  disabled={loading}
                  className={controlClass}
                >
                  <option value="pending">pending</option>
                  <option value="in_progress">in_progress</option>
                  <option value="done">done</option>
                </select>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 text-sm text-gray-700">
                You can update the task status here. Other fields are managed by admin.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
              {/* ✅ Job */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Job</label>
                <select
                  value={selectedRootId}
                  onChange={(e) => onSelectRoot(e.target.value)}
                  disabled={loading}
                  className={controlClass}
                >
                  <option value="">No job (independent task)</option>
                  {(rootJobs || []).map((j) => (
                    <option key={String(j?._id)} value={String(j?._id)}>
                      {j?.title || "Job"}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Sub-job field after selecting job */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sub-job</label>
                <select
                  value={selectedSubId}
                  onChange={(e) => onSelectSub(e.target.value)}
                  disabled={loading || !selectedRootId || subJobsForSelectedRoot.length === 0}
                  className={controlClass}
                >
                  {!selectedRootId ? (
                    <option value="">Select a job first</option>
                  ) : subJobsForSelectedRoot.length === 0 ? (
                    <option value="">No sub-jobs under this job</option>
                  ) : (
                    <>
                      <option value="">No sub-job (keep under the selected job)</option>
                      {subJobsForSelectedRoot.map((sj) => (
                        <option key={String(sj?._id)} value={String(sj?._id)}>
                          {sj?.title || "Sub-job"}
                        </option>
                      ))}
                    </>
                  )}
                </select>

              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Template</label>
                <select
                  value={templateId}
                  onChange={(e) => {
                    const v = e.target.value
                    setTemplateId(v)
                    setSelectedSubtitleIds([])
                    if (v) {
                      setSubtitlesValue([])
                      setTitleValue("")
                    }
                  }}
                  disabled={loading}
                  className={controlClass}
                >
                  <option value="">Manual</option>
                  {(templates || []).map((tpl) => (
                    <option key={String(tpl._id)} value={String(tpl._id)}>
                      {tpl.title}
                    </option>
                  ))}
                </select>
              </div>

              {!inTemplateMode ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
                  <input
                    ref={titleRef}
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    disabled={loading}
                    className={controlClass}
                    placeholder="Task title"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1.5">Title</p>
                  <div className="min-h-11 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                    <p className="text-sm font-extrabold text-indigo-700 break-words">{selectedTemplate?.title || "—"}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Selected subtitles: {(selectedSubtitleIds || []).length || 0}
                    </p>
                  </div>
                </div>
              )}

              {!inTemplateMode ? (
                <ManualSubtitlesEditor value={subtitlesValue} onChange={setSubtitlesValue} />
              ) : (
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <FiHash /> Subtitles
                  </div>

                  <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 max-h-56 overflow-auto">
                    {templateSubs.length ? (
                      templateSubs.map((s) => {
                        const sid = String(s?._id || "")
                        const checked = (selectedSubtitleIds || []).includes(sid)
                        return (
                          <label key={sid} className="flex items-start gap-3 p-2 rounded-xl hover:bg-white cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSubtitle(sid)}
                              disabled={loading}
                              className="w-4 h-4 mt-1 shrink-0 outline-none text-indigo-600 focus:ring-2 focus:ring-indigo-500/30"
                            />
                            <span className="text-sm text-gray-800 break-words">{s?.text || "—"}</span>
                          </label>
                        )
                      })
                    ) : (
                      <p className="text-sm text-gray-500">No subtitles in this template.</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                <select
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value)}
                  disabled={loading}
                  className={controlClass}
                >
                  <option value="pending">pending</option>
                  <option value="in_progress">in_progress</option>
                  <option value="done">done</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Due date</label>
                <input
                  type="datetime-local"
                  value={dueAtValue}
                  onChange={(e) => setDueAtValue(e.target.value)}
                  disabled={loading}
                  className={controlClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assignees</label>

                {!canAssign ? (
                  <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60 text-sm text-gray-600">
                    No assigned employees found for this customer.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3 max-h-48 overflow-auto">
                    {(assignedEmployees || []).map((u) => {
                      const id = String(u._id)
                      const checked = (assigneesValue || []).includes(id)
                      return (
                        <label
                          key={id}
                          className="flex items-start sm:items-center gap-3 p-2 rounded-xl hover:bg-white cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAssignee(id)}
                            disabled={loading}
                            className="w-4 h-4 mt-1 sm:mt-0 shrink-0 outline-none text-indigo-600 focus:ring-2 focus:ring-indigo-500/30"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                            <p className="text-xs text-gray-500 truncate">{u.email || ""}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Task notes</label>
                <textarea
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  rows={3}
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none transition resize-y focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Add short task notes..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            Cancel
          </button>

          <button
            onClick={onSubmit}
            disabled={!canSave}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === "edit" ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                {mode === "edit" ? <FiSave /> : <FiPlus />}
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =================== TASK CARD =================== */
function TaskCard({
  t,
  nowTick,
  isOpen,
  onToggle,
  onQuickStatus,
  onEdit,
  onDelete,
  isAdmin,
  isEmployee,
  deletingTaskId,
  assignedEmployees,
  subtitleBusyKey,
  subtitleNoteDraft,
  setSubtitleNoteDraft,
  uploadFilesToSubtitle,
  addNoteToSubtitle,
  renameSubtitleFile,
  deleteSubtitleFile,
  inferActorRole,

  jobById,
  showJobBadge = true,
}) {
  const busy = deletingTaskId === t._id
  const target = getTaskTargetDate(t)
  const timeLeftMs = target ? target.getTime() - nowTick : null
  const hasDue = !!t?.dueAt

  const subs = Array.isArray(t?.subtitles) ? t.subtitles : []
  const subCount = subs.length

  const assignees = resolveAssignees(t?.assignedTo, assignedEmployees)
  const assigneeCount = assignees.length
  const assigneeNamesPreview = assignees.slice(0, 2).map((a) => a.name).join(", ")
  const assigneeNamesMore = assigneeCount > 2 ? ` +${assigneeCount - 2}` : ""

  const currentJob = jobById?.get(String(t?.jobId || "")) || null
  const parentJob = currentJob?.parentJobId ? jobById?.get(String(currentJob.parentJobId)) : null

  const formatJobPath = () => {
    if (!currentJob) return null
    if (currentJob?.parentJobId) {
      const p = parentJob?.title || "Job"
      const c = currentJob?.title || "Sub-job"
      return `Sub-job: ${p} › ${c}`
    }
    return `Job: ${currentJob?.title || "Job"}`
  }

  return (
    <div className="hover:bg-gray-50/60">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <button type="button" onClick={onToggle} className="w-full sm:flex-1 min-w-0 text-left" aria-expanded={isOpen}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-extrabold text-indigo-700 truncate">{t.title || "Task"}</p>
            {hasDue ? (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${duePill(timeLeftMs, t.status)}`}>
                {t.status === "done" ? "Completed" : formatTimeLeft(timeLeftMs)}
              </span>
            ) : null}

            {showJobBadge && currentJob ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {formatJobPath()}
              </span>
            ) : showJobBadge ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                No job
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 leading-snug">
            <span className="break-words">
              {assigneeCount ? `Assigned to: ${assigneeNamesPreview}${assigneeNamesMore}` : "Unassigned"}
            </span>
            {subCount ? <span>• {subCount} subtitle{subCount === 1 ? "" : "s"}</span> : null}
            {t?.dueAt ? <span>• Due: {formatDateTime(t.dueAt)}</span> : null}
          </div>
        </button>

        <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2 justify-between sm:justify-end">
          <select
            value={t.status}
            disabled={busy}
            onChange={(e) => onQuickStatus(e.target.value)}
            className="w-full sm:w-40 h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            title="Change status"
          >
            <option value="pending">pending</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onToggle}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              aria-label={isOpen ? "Collapse" : "Expand"}
              title={isOpen ? "Hide" : "Show"}
            >
              <FiChevronDown
                className={["transition-transform duration-300 ease-out", isOpen ? "rotate-180" : "rotate-0"].join(" ")}
              />
            </button>

            <button
              onClick={onEdit}
              disabled={busy}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              title={isEmployee ? "Update status" : "Edit"}
              aria-label={isEmployee ? "Update status" : "Edit"}
            >
              <FiEdit2 />
            </button>

            {isAdmin ? (
              <button
                onClick={onDelete}
                disabled={busy}
                className="h-10 w-10 flex items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 outline-none focus:ring-2 focus:ring-red-500/20"
                title="Delete"
                aria-label="Delete"
              >
                <FiTrash2 />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <SmoothCollapse open={isOpen}>
        <div className="px-3 sm:px-6 pb-5 -mt-2">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
            {t?.description ? (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 mb-1">Task notes</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{t.description}</p>
              </div>
            ) : null}

            {t?.completedAt ? (
              <div className="text-xs mb-4">
              <div className="px-3 py-2 rounded-xl border border-gray-100 bg-white">
                <p className="text-gray-500">Completed</p>
                <p className="font-semibold text-gray-900">{formatDateTime(t.completedAt)}</p>
              </div>
              </div>
            ) : null}

            {Array.isArray(t?.subtitles) && t.subtitles.length ? (
              <div>
                <p className="text-xs font-extrabold text-indigo-700 mb-2">Subtitles</p>
                <div className="space-y-3">
                  {t.subtitles.map((s) => (
                    <SubtitleWorkPanel
                      key={String(s?._id || s?.text)}
                      task={t}
                      subtitle={s}
                      busyKey={subtitleBusyKey}
                      noteDraft={subtitleNoteDraft}
                      setNoteDraft={setSubtitleNoteDraft}
                      onUpload={uploadFilesToSubtitle}
                      onAddNote={addNoteToSubtitle}
                      onRenameFile={renameSubtitleFile}
                      onDeleteFile={deleteSubtitleFile}
                      inferActorRole={inferActorRole}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-gray-100 bg-white text-sm text-gray-500 text-center">
                No subtitles for this task.
              </div>
            )}
          </div>
        </div>
      </SmoothCollapse>
    </div>
  )
}

/* =================== CRM COMPONENT =================== */
export default function CustomerCRM({
  customerId,
  customer,
  assignedEmployees,
  isAdmin,
  isEmployee,
  refreshNonce,
  onSoftRefreshCustomer,
  setPageError,
  showToast,
}) {
  const [nowTick, setNowTick] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const pushToast = (msg, type = "success") => {
    if (!showToast) return
    showToast(msg, type)
  }

  const [templates, setTemplates] = useState([])
  const [openTaskIds, setOpenTaskIds] = useState(() => new Set())

  const [subtitleBusyKey, setSubtitleBusyKey] = useState("")
  const [subtitleNoteDraft, setSubtitleNoteDraft] = useState({})

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    title: "",
    description: "",
    confirmText: "Delete",
    payload: null,
  })
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState("")

  // JOBS
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsFlat, setJobsFlat] = useState([])
  const [jobsTree, setJobsTree] = useState([])
  const [selectedJobId, setSelectedJobId] = useState("")
  const [openJobIds, setOpenJobIds] = useState(() => new Set())
  const [jobModal, setJobModal] = useState({ open: false, mode: "root", parentJobId: null })
  const [jobSaving, setJobSaving] = useState(false)

  // TASKS
  const [tasks, setTasks] = useState([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [tasksHasMore, setTasksHasMore] = useState(false)
  const [tasksNextCursor, setTasksNextCursor] = useState(null)

  // moving

  // FILTERS
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [dueFilter, setDueFilter] = useState("all")
  const [sortBy, setSortBy] = useState("due_asc")

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [cJobId, setCJobId] = useState("") // can be root or sub job id, or ""
  const [cTemplateId, setCTemplateId] = useState("")
  const [cSelectedSubtitleIds, setCSelectedSubtitleIds] = useState([])
  const [cTitle, setCTitle] = useState("")
  const [cSubtitles, setCSubtitles] = useState([])
  const [cDesc, setCDesc] = useState("")
  const [cStatus, setCStatus] = useState("pending")
  const [cDueAt, setCDueAt] = useState("")
  const [cAssignees, setCAssignees] = useState([])

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState("")
  const [eJobId, setEJobId] = useState("")
  const [eTemplateId, setETemplateId] = useState("")
  const [eSelectedSubtitleIds, setESelectedSubtitleIds] = useState([])
  const [eTitle, setETitle] = useState("")
  const [eSubtitles, setESubtitles] = useState([])
  const [eDesc, setEDesc] = useState("")
  const [eStatus, setEStatus] = useState("pending")
  const [eDueAt, setEDueAt] = useState("")
  const [eAssignees, setEAssignees] = useState([])

  const canAssign = (assignedEmployees || []).length > 0

  const inferActorRole = (actorId, taskAssignedTo) => {
    const aid = String(actorId || "")
    if (!aid) return "admin"
    const assigned = Array.isArray(taskAssignedTo) ? taskAssignedTo : []
    const assignedIds = assigned.map((x) => String(x?._id || x)).filter(Boolean)
    if (assignedIds.includes(aid)) return "employee"
    return "admin"
  }

  const fetchTemplates = async () => {
    try {
      const list = await fetchTaskTemplatesApi()
      setTemplates(Array.isArray(list) ? list : [])
    } catch {
      // ignore
    }
  }

  const fetchJobs = async () => {
    if (!customerId) return
    setJobsLoading(true)
    setPageError?.("")
    try {
      const { jobsFlat: jf, jobsTree: jt } = await fetchCustomerJobsApi({ customerId })
      setJobsFlat(Array.isArray(jf) ? jf : [])
      setJobsTree(Array.isArray(jt) ? jt : [])
    } catch (e) {
      setPageError?.(e?.message || "Failed to load jobs.")
      setJobsFlat([])
      setJobsTree([])
    } finally {
      setJobsLoading(false)
    }
  }

  const fetchTasks = async ({ reset = false } = {}) => {
    if (!customerId) return
    if (tasksLoading) return

    setTasksLoading(true)
    setPageError?.("")

    try {
      const cursor = reset ? null : tasksNextCursor
      const result = await fetchCustomerTasksApi({ customerId, limit: TASKS_PAGE_SIZE, cursor })

      if (reset) setTasks(result.tasks)
      else setTasks((prev) => [...prev, ...result.tasks])

      setTasksHasMore(result.hasMore)
      setTasksNextCursor(result.nextCursor)
    } catch (e) {
      setPageError?.(e?.message || "Failed to load tasks.")
    } finally {
      setTasksLoading(false)
    }
  }

  const resetTasks = async () => {
    setTasks([])
    setTasksHasMore(false)
    setTasksNextCursor(null)
    await fetchTasks({ reset: true })
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    setEditingTaskId("")
    setEditOpen(false)
    setOpenTaskIds(new Set())
    setSubtitleNoteDraft({})
    setSubtitleBusyKey("")
    setSelectedJobId("")
    setOpenJobIds(new Set())
    setSearchText("")
    setStatusFilter("all")
    setAssigneeFilter("all")
    setDueFilter("all")
    setSortBy("due_asc")
    fetchJobs()
    resetTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshNonce])

  const tasksSummary = useMemo(() => {
    const counts = { pending: 0, in_progress: 0, done: 0 }
    for (const t of tasks) if (t?.status && counts[t.status] !== undefined) counts[t.status]++
    return counts
  }, [tasks])

  const jobById = useMemo(() => {
    const map = new Map()
    for (const j of jobsFlat || []) map.set(String(j?._id), j)
    return map
  }, [jobsFlat])

  const formatJobOptionLabel = (j) => {
    const pid = j?.parentJobId ? String(j.parentJobId) : ""
    if (!pid) return j?.title || "Job"
    const parent = jobById.get(pid)
    return `${parent?.title || "Job"} › ${j?.title || "Sub-job"}`
  }

  const toggleTaskOpen = (id) => {
    const sid = String(id)
    setOpenTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  const toggleJobOpen = (id) => {
    const sid = String(id)
    setOpenJobIds((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  const inferSelectedTemplateSubtitleIds = (task) => {
    const tplId = String(task?.templateId || "")
    if (!tplId) return []
    const tpl = (templates || []).find((x) => String(x?._id) === tplId)
    const tplSubs = Array.isArray(tpl?.subtitles) ? tpl.subtitles : []
    if (!tplSubs.length) return []

    const taskSubs = Array.isArray(task?.subtitles) ? task.subtitles : []
    const taskSubIds = new Set(taskSubs.map((s) => String(s?._id || "")).filter(Boolean))
    const taskTextSet = new Set(taskSubs.map((s) => String(s?.text || "").trim().toLowerCase()).filter(Boolean))

    const selected = []
    for (const s of tplSubs) {
      const sid = String(s?._id || "")
      const st = String(s?.text || "").trim().toLowerCase()
      if (!sid) continue
      if (taskSubIds.size && taskSubIds.has(sid)) selected.push(sid)
      else if (st && taskTextSet.has(st)) selected.push(sid)
    }
    return selected
  }

  /* ---------------- JOBS ---------------- */
  const openCreateJobModal = (parentJobId = null) => {
    if (!isAdmin) return
    setJobModal({ open: true, mode: parentJobId ? "sub" : "root", parentJobId })
  }

  const createJob = async ({ title, parentJobId }) => {
    if (!isAdmin) return
    const t = String(title || "").trim()
    if (!t) return

    setJobSaving(true)
    setPageError?.("")
    try {
      await createJobApi({ customerId, title: t, parentJobId: parentJobId || null })
      await fetchJobs()
      pushToast("Job created")
      setJobModal({ open: false, mode: "root", parentJobId: null })
    } catch (e) {
      const message = e?.message || "Failed to create job."
      setPageError?.(message)
      pushToast(message, "error")
    } finally {
      setJobSaving(false)
    }
  }

  const requestDeleteJob = (jobId) => {
    if (!isAdmin) return
    const j = jobById.get(String(jobId))
    setDeleteModal({
      open: true,
      title: "Delete job?",
      description: `Delete "${j?.title || "job"}". If tasks exist, you may need Force delete.`,
      confirmText: "Delete job",
      payload: { kind: "job", jobId: String(jobId), force: false },
    })
  }

  /* ---------------- CREATE TASK ---------------- */
  const openCreateModal = (prefillJobId = "") => {
    setPageError?.("")
    setCJobId(prefillJobId || selectedJobId || "")
    setCTemplateId("")
    setCSelectedSubtitleIds([])
    setCTitle("")
    setCSubtitles([])
    setCDesc("")
    setCStatus("pending")
    setCDueAt("")
    setCAssignees([])
    setCreateOpen(true)
  }

  const createTask = async () => {
    setPageError?.("")
    if (!isAdmin) return

    if (!canAssign || cAssignees.length === 0) {
      const message = "Select at least 1 assignee."
      setPageError?.(message)
      pushToast(message, "error")
      return
    }

    const inTemplateMode = !!cTemplateId
    if (!inTemplateMode && !String(cTitle || "").trim()) {
      const message = "Title is required."
      setPageError?.(message)
      pushToast(message, "error")
      return
    }

    setCreateSaving(true)
    try {
      const body = {
        jobId: String(cJobId || "").trim() ? String(cJobId) : null,
        description: String(cDesc || "").trim() || undefined,
        status: cStatus,
        dueAt: cDueAt ? new Date(cDueAt).toISOString() : null,
        assignedTo: cAssignees,
      }

      if (inTemplateMode) {
        body.templateId = cTemplateId
        body.selectedSubtitleIds = cSelectedSubtitleIds
      } else {
        body.title = String(cTitle || "").trim()
        body.subtitles = Array.isArray(cSubtitles) ? cSubtitles : []
      }

      const res = await fetch(`${API_BASE}/customers/${customerId}/tasks`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to create task")

      await onSoftRefreshCustomer?.()
      await resetTasks()
      pushToast("Task created")
      setCreateOpen(false)
    } catch (e) {
      const message = e?.message || "Failed to create task."
      setPageError?.(message)
      pushToast(message, "error")
    } finally {
      setCreateSaving(false)
    }
  }

  /* ---------------- EDIT TASK ---------------- */
  const openEditModal = (t) => {
    setPageError?.("")
    setEditingTaskId(String(t?._id || ""))

    setEDesc(String(t?.description || ""))
    setEStatus(String(t?.status || "pending"))
    setEDueAt(toLocalInputValue(t?.dueAt))
    setEJobId(String(t?.jobId || ""))

    const assigned = Array.isArray(t?.assignedTo) ? t.assignedTo : []
    setEAssignees(assigned.map((x) => String(x?._id || x)).filter(Boolean))

    const isTpl = !!t?.templateId
    setETemplateId(isTpl ? String(t.templateId) : "")

    if (!isTpl) {
      setESelectedSubtitleIds([])
      setETitle(String(t?.title || ""))
      const subs = Array.isArray(t?.subtitles) ? t.subtitles : []
      const texts = subs.map((s) => String(s?.text || "")).filter(Boolean)
      setESubtitles(texts)
    } else {
      const preselected = inferSelectedTemplateSubtitleIds(t)
      setESelectedSubtitleIds(preselected)
      setETitle("")
      setESubtitles([])
    }

    setEditOpen(true)
  }

  const updateTask = async () => {
    setPageError?.("")
    if (!editingTaskId) return

    if (isEmployee) {
      setEditSaving(true)
      try {
        await patchTaskStatus({ customerId, taskId: editingTaskId, status: eStatus })
        await resetTasks()
        pushToast("Task status updated")
        setEditOpen(false)
      } catch (e) {
        const message = e?.message || "Failed to update."
        setPageError?.(message)
        pushToast(message, "error")
      } finally {
        setEditSaving(false)
      }
      return
    }

    if (!canAssign || eAssignees.length === 0) {
      const message = "Select at least 1 assignee."
      setPageError?.(message)
      pushToast(message, "error")
      return
    }

    const inTemplateMode = !!eTemplateId
    if (!inTemplateMode && !String(eTitle || "").trim()) {
      const message = "Title is required."
      setPageError?.(message)
      pushToast(message, "error")
      return
    }

    setEditSaving(true)
    try {
      const body = {
        jobId: String(eJobId || "").trim() ? String(eJobId) : null,
        description: String(eDesc || "").trim() || "",
        status: eStatus,
        dueAt: eDueAt ? new Date(eDueAt).toISOString() : null,
        assignedTo: eAssignees,
      }

      if (inTemplateMode) {
        body.templateId = eTemplateId
        body.selectedSubtitleIds = eSelectedSubtitleIds
      } else {
        body.templateId = null
        body.title = String(eTitle || "").trim()
        body.subtitles = Array.isArray(eSubtitles) ? eSubtitles : []
      }

      await patchTaskAdmin({ customerId, taskId: editingTaskId, body })
      await resetTasks()
      pushToast("Task updated")
      setEditOpen(false)
    } catch (e) {
      const message = e?.message || "Failed to update task."
      setPageError?.(message)
      pushToast(message, "error")
    } finally {
      setEditSaving(false)
    }
  }

  /* ---------------- QUICK STATUS ---------------- */
  const quickChangeStatus = async (taskId, nextStatus) => {
    setPageError?.("")
    try {
      if (isEmployee) await patchTaskStatus({ customerId, taskId, status: nextStatus })
      else if (isAdmin) await patchTaskAdmin({ customerId, taskId, body: { status: nextStatus } })
      else throw new Error("No permission.")
      await resetTasks()
      pushToast("Status updated")
    } catch (e) {
      const message = e?.message || "Failed to update status."
      setPageError?.(message)
      pushToast(message, "error")
    }
  }

  /* ---------------- DELETE TASK ---------------- */
  const requestDeleteTask = (t) => {
    setDeleteModal({
      open: true,
      title: "Delete task?",
      description: `Delete "${t?.title || "task"}" permanently.`,
      confirmText: "Delete",
      payload: { kind: "task", taskId: t._id },
    })
  }

  /* ---------------- SUBTITLE UPLOAD/NOTES ---------------- */
  const uploadFilesToSubtitle = async (taskId, subtitleId, files, optionalNoteText) => {
    if (!taskId || !subtitleId || !files?.length) return
    setPageError?.("")
    const key = `${taskId}:${subtitleId}`
    setSubtitleBusyKey(key)

    try {
      const uploadedMeta = []

      for (const file of files) {
        const presigned = await presignUploadForTask({ file, customerId, taskId, subtitleId })
        await putToS3({ uploadUrl: presigned.uploadUrl, file })

        uploadedMeta.push({
          key: presigned.key,
          url: presigned.url || "",
          originalName: file.name,
          displayName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        })
      }

      await addSubtitleFilesApi({
        customerId,
        taskId,
        subtitleId,
        body: {
          files: uploadedMeta,
          note: String(optionalNoteText || "").trim() || undefined,
        },
      })

      setSubtitleNoteDraft((prev) => {
        const next = { ...(prev || {}) }
        next[String(subtitleId)] = ""
        return next
      })

      await resetTasks()
      pushToast("Uploaded")
    } catch (e) {
      const message = e?.message || "Upload failed."
      setPageError?.(message)
      pushToast(message, "error")
    } finally {
      setSubtitleBusyKey("")
    }
  }

  const addNoteToSubtitle = async (taskId, subtitleId, text) => {
    const t = String(text || "").trim()
    if (!taskId || !subtitleId || !t) return
    setPageError?.("")
    const key = `${taskId}:${subtitleId}`
    setSubtitleBusyKey(key)

    try {
      await addSubtitleNoteApi({ customerId, taskId, subtitleId, text: t })

      setSubtitleNoteDraft((prev) => {
        const next = { ...(prev || {}) }
        next[String(subtitleId)] = ""
        return next
      })

      await resetTasks()
      pushToast("Note added")
    } catch (e) {
      const message = e?.message || "Failed to add note."
      setPageError?.(message)
      pushToast(message, "error")
    } finally {
      setSubtitleBusyKey("")
    }
  }

  const renameSubtitleFile = async (taskId, subtitleId, fileId, nextDisplayName) => {
    const name = String(nextDisplayName || "").trim()
    if (!taskId || !subtitleId || !fileId || !name) return
    setPageError?.("")
    const key = `${taskId}:${subtitleId}:file:${fileId}`
    setSubtitleBusyKey(key)
    try {
      await patchSubtitleFileApi({
        customerId,
        taskId,
        subtitleId,
        fileId,
        body: { displayName: name },
      })
      await resetTasks()
      pushToast("Renamed")
    } catch (e) {
      const message = e?.message || "Rename failed."
      setPageError?.(message)
      pushToast(message, "error")
    } finally {
      setSubtitleBusyKey("")
    }
  }

  const deleteSubtitleFile = (taskId, subtitleId, fileId, fileObj) => {
    const shown = String(fileObj?.displayName || "").trim() || fileObj?.originalName || "file"
    setDeleteModal({
      open: true,
      title: "Delete file?",
      description: `Delete "${shown}" from this work ? This removes the file permanently.`,
      confirmText: "Delete file",
      payload: { kind: "subtitle_file", taskId: String(taskId), subtitleId: String(subtitleId), fileId: String(fileId) },
    })
  }

  /* ---------------- DELETE CONFIRM HANDLER ---------------- */
  const confirmDelete = async () => {
    const payload = deleteModal.payload
    if (!payload) return

    setPageError?.("")
    setDeleteLoading(true)

    try {
      if (payload.kind === "task") {
        if (!payload?.taskId) return
        setDeletingTaskId(payload.taskId)
        await deleteTaskApi({ customerId, taskId: payload.taskId })
        await resetTasks()
        pushToast("Task deleted")
      }

      if (payload.kind === "job") {
        if (!payload?.jobId) return
        await deleteJobApi({ customerId, jobId: payload.jobId, force: !!payload.force })
        await fetchJobs()
        await resetTasks()
        pushToast("Job deleted")
        if (String(selectedJobId) === String(payload.jobId)) setSelectedJobId("")
      }

      if (payload.kind === "subtitle_file") {
        const { taskId, subtitleId, fileId } = payload
        const key = `${taskId}:${subtitleId}:file:${fileId}`
        setSubtitleBusyKey(key)
        await deleteSubtitleFileApi({ customerId, taskId, subtitleId, fileId })
        await resetTasks()
        pushToast("File deleted")
        setSubtitleBusyKey("")
      }

      setDeleteModal((p) => ({ ...p, open: false }))
    } catch (e) {
      const msg = String(e?.message || "")
      if (payload.kind === "job" && (msg.includes("409") || msg.toLowerCase().includes("task"))) {
        setDeleteModal({
          open: true,
          title: "Job has tasks",
          description: `This job still has tasks. Use Force delete to remove job + tasks.`,
          confirmText: "Force delete",
          payload: { kind: "job", jobId: payload.jobId, force: true },
        })
      } else {
        const message = e?.message || "Delete failed."
        setPageError?.(message)
        pushToast(message, "error")
      }
    } finally {
      setDeleteLoading(false)
      setDeletingTaskId("")
    }
  }

  /* =================== FILTER LOGIC =================== */
  const withinDays = (date, days) => {
    if (!date) return false
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date(nowTick)
    const end = new Date(now)
    end.setDate(end.getDate() + days)
    return d >= now && d <= end
  }

  const isToday = (date) => {
    if (!date) return false
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date(nowTick)
    return d.toDateString() === now.toDateString()
  }

  const isOverdue = (t) => {
    if (!t?.dueAt) return false
    if (String(t?.status) === "done") return false
    const d = new Date(t.dueAt)
    if (Number.isNaN(d.getTime())) return false
    return d.getTime() < nowTick
  }

  const matchesSearch = (t, s) => {
    const q = String(s || "").trim().toLowerCase()
    if (!q) return true
    const title = String(t?.title || "").toLowerCase()
    const desc = String(t?.description || "").toLowerCase()
    const jobTitle = String(jobById.get(String(t?.jobId || ""))?.title || "").toLowerCase()
    const assignees = resolveAssignees(t?.assignedTo, assignedEmployees)
      .map((a) => String(a?.name || "").toLowerCase())
      .join(" ")
    const subtitles = (Array.isArray(t?.subtitles) ? t.subtitles : [])
      .map((x) => String(x?.text || "").toLowerCase())
      .join(" ")
    return [title, desc, jobTitle, assignees, subtitles].some((x) => x.includes(q))
  }

  const applyAllFiltersToTasks = (list) => {
    let out = Array.isArray(list) ? list.slice() : []

    if (String(selectedJobId || "")) {
      const sid = String(selectedJobId || "")
      const job = jobById.get(sid)
      const isRoot = job && !job?.parentJobId
      out = isRoot
        ? out.filter((t) => String(t?.rootJobId || "") === sid)
        : out.filter((t) => String(t?.jobId || "") === sid)
    }

    out = out.filter((t) => matchesSearch(t, searchText))

    if (statusFilter !== "all") {
      if (statusFilter === "overdue") out = out.filter((t) => isOverdue(t))
      else if (statusFilter === "no_due") out = out.filter((t) => !t?.dueAt)
      else out = out.filter((t) => String(t?.status || "") === statusFilter)
    }

    if (assigneeFilter !== "all") {
      const aid = String(assigneeFilter)
      out = out.filter((t) => {
        const arr = Array.isArray(t?.assignedTo) ? t.assignedTo : []
        const ids = arr.map((x) => String(x?._id || x)).filter(Boolean)
        return ids.includes(aid)
      })
    }

    if (dueFilter !== "all") {
      if (dueFilter === "none") out = out.filter((t) => !t?.dueAt)
      if (dueFilter === "overdue") out = out.filter((t) => isOverdue(t))
      if (dueFilter === "today") out = out.filter((t) => isToday(t?.dueAt))
      if (dueFilter === "7d") out = out.filter((t) => withinDays(t?.dueAt, 7))
      if (dueFilter === "30d") out = out.filter((t) => withinDays(t?.dueAt, 30))
    }

    const statusRank = (s) => (s === "pending" ? 0 : s === "in_progress" ? 1 : 2)
    const dueValue = (t) => {
      if (!t?.dueAt) return Number.POSITIVE_INFINITY
      const d = new Date(t.dueAt)
      if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY
      return d.getTime()
    }

    if (sortBy === "due_asc") out.sort((a, b) => dueValue(a) - dueValue(b))
    if (sortBy === "due_desc") out.sort((a, b) => dueValue(b) - dueValue(a))
    if (sortBy === "created_desc") {
      const cv = (t) => (t?.createdAt ? new Date(t.createdAt).getTime() : 0)
      out.sort((a, b) => cv(b) - cv(a))
    }
    if (sortBy === "title_asc") out.sort((a, b) => String(a?.title || "").localeCompare(String(b?.title || "")))
    if (sortBy === "status") out.sort((a, b) => statusRank(String(a?.status || "")) - statusRank(String(b?.status || "")))

    return out
  }

  const filteredTasksAll = useMemo(() => applyAllFiltersToTasks(tasks), [
    tasks,
    selectedJobId,
    jobById,
    assignedEmployees,
    searchText,
    statusFilter,
    assigneeFilter,
    dueFilter,
    sortBy,
    nowTick,
  ])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (String(searchText || "").trim()) n++
    if (statusFilter !== "all") n++
    if (assigneeFilter !== "all") n++
    if (dueFilter !== "all") n++
    if (sortBy !== "due_asc") n++
    if (String(selectedJobId || "")) n++
    return n
  }, [searchText, statusFilter, assigneeFilter, dueFilter, sortBy, selectedJobId])

  const clearFilters = () => {
    setSearchText("")
    setStatusFilter("all")
    setAssigneeFilter("all")
    setDueFilter("all")
    setSortBy("due_asc")
    setSelectedJobId("")
  }

  const renderTaskList = (taskList, { showJobBadge = true } = {}) => {
    if (tasksLoading && (!taskList || taskList.length === 0)) {
      return <div className="p-10 text-center text-gray-500 text-sm">Loading tasks...</div>
    }

    if (!taskList || taskList.length === 0) {
      return (
        <div className="p-10 text-center text-gray-500 text-sm">
          {isEmployee ? "No tasks assigned to you." : "No tasks yet."}
        </div>
      )
    }

    return (
      <div className="divide-y divide-gray-100">
        {taskList.map((t) => {
          const isOpen = openTaskIds.has(String(t._id))
          return (
            <TaskCard
              key={String(t._id)}
              t={t}
              nowTick={nowTick}
              isOpen={isOpen}
              onToggle={() => toggleTaskOpen(t._id)}
              onQuickStatus={(next) => quickChangeStatus(t._id, next)}
              onEdit={() => openEditModal(t)}
              onDelete={() => requestDeleteTask(t)}
              isAdmin={isAdmin}
              isEmployee={isEmployee}
              deletingTaskId={deletingTaskId}
              assignedEmployees={assignedEmployees}
              subtitleBusyKey={subtitleBusyKey}
              subtitleNoteDraft={subtitleNoteDraft}
              setSubtitleNoteDraft={setSubtitleNoteDraft}
              uploadFilesToSubtitle={uploadFilesToSubtitle}
              addNoteToSubtitle={addNoteToSubtitle}
              renameSubtitleFile={renameSubtitleFile}
              deleteSubtitleFile={deleteSubtitleFile}
              inferActorRole={inferActorRole}
              jobById={jobById}
              showJobBadge={showJobBadge}
            />
          )
        })}
      </div>
    )
  }

  const independentTasks = useMemo(() => {
    const list = tasks.filter((t) => !String(t?.jobId || "").trim())
    return applyAllFiltersToTasks(list)
  }, [tasks, selectedJobId, searchText, statusFilter, assigneeFilter, dueFilter, sortBy, nowTick, jobById])

  const renderJobsTreeWithTasks = () => {
    if (jobsLoading) return <div className="p-8 text-center text-gray-500 text-sm">Loading jobs...</div>

    const hasJobs = Array.isArray(jobsTree) && jobsTree.length > 0
    const showIndependentSection = independentTasks.length > 0 // ✅ ONLY show when there are independent tasks

    return (
      <div className="space-y-4">
        {showIndependentSection ? (
          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-indigo-700 truncate">Independent Tasks (No job)</p>
                <p className="text-xs text-gray-500 mt-1">
                  {independentTasks.length} task{independentTasks.length === 1 ? "" : "s"} (filtered)
                </p>
              </div>

              {isAdmin ? (
                <button
                  onClick={() => openCreateModal("")}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
                >
                  <FiPlus /> Task
                </button>
              ) : null}
            </div>
            {renderTaskList(independentTasks, { showJobBadge: false })}
          </div>
        ) : null}

        {!hasJobs ? (
          <div className="p-6 rounded-2xl border border-gray-100 bg-white text-sm text-gray-500 text-center">
            No jobs created yet.
            {isAdmin ? (
              <div className="mt-3">
                <button
                  onClick={() => openCreateJobModal(null)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
                >
                  <FiPlus /> Create first job
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {jobsTree.map((root) => {
              const rootId = String(root?._id || "")
              const rootOpen = openJobIds.has(rootId)
              const children = Array.isArray(root?.children)
                ? root.children
                : Array.isArray(root?.subJobs)
                ? root.subJobs
                : []

              const getFilteredByJob = (jobId) => {
                const base = tasks.filter((t) => String(t?.jobId || "") === String(jobId))
                return applyAllFiltersToTasks(base)
              }

              const rootTasksFiltered = getFilteredByJob(rootId)

              return (
                <div key={rootId} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleJobOpen(rootId)}
                      className="flex-1 min-w-0 text-left"
                      aria-expanded={rootOpen}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white shrink-0">
                          <FiFolder className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-indigo-700 truncate">{root?.title || "Job"}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {rootTasksFiltered.length} direct task{rootTasksFiltered.length === 1 ? "" : "s"}
                            {children.length ? ` • ${children.length} sub-job${children.length === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 justify-end">
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => openCreateModal(rootId)}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
                            title="Add task under this job"
                          >
                            <FiPlus /> Task
                          </button>
                          <button
                            onClick={() => openCreateJobModal(rootId)}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
                            title="Create sub-job"
                          >
                            <FiPlus /> Sub-job
                          </button>
                          <button
                            onClick={() => requestDeleteJob(rootId)}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold"
                            title="Delete job"
                          >
                            <FiTrash2 /> Delete
                          </button>
                        </>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => toggleJobOpen(rootId)}
                        className="h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                        aria-label={rootOpen ? "Collapse" : "Expand"}
                        title={rootOpen ? "Hide" : "Show"}
                      >
                        <FiChevronDown className={["transition-transform duration-300", rootOpen ? "rotate-180" : ""].join(" ")} />
                      </button>
                    </div>
                  </div>

                  <SmoothCollapse open={rootOpen}>
                    <div className="px-3 sm:px-6 pb-5 pt-4 space-y-4 bg-gray-50/50">
                      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-800">Direct tasks</p>
                          <span className="text-xs font-medium text-gray-500">{rootTasksFiltered.length}</span>
                        </div>
                        {renderTaskList(rootTasksFiltered, { showJobBadge: false })}
                      </div>

                      {children.length ? (
                        <div className="space-y-3">
                          {children.map((sub) => {
                            const subId = String(sub?._id || "")
                            const subTasksFiltered = getFilteredByJob(subId)

                            return (
                              <div key={subId} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">
                                      SUB-JOB
                                    </span>
                                    <p className="text-sm font-extrabold text-gray-900 truncate">{sub?.title || "Sub-job"}</p>
                                    <span className="text-xs text-gray-500">
                                      • {subTasksFiltered.length} task{subTasksFiltered.length === 1 ? "" : "s"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 justify-end">
                                    {isAdmin ? (
                                      <>
                                        <button
                                          onClick={() => openCreateModal(subId)}
                                          className="inline-flex h-10 items-center justify-center gap-2 px-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
                                          title="Add task under this sub-job"
                                        >
                                          <FiPlus /> Task
                                        </button>
                                        <button
                                          onClick={() => requestDeleteJob(subId)}
                                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                                          title="Delete sub-job"
                                          aria-label="Delete sub-job"
                                        >
                                          <FiTrash2 />
                                        </button>
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                {renderTaskList(subTasksFiltered, { showJobBadge: false })}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl border border-gray-100 bg-white text-sm text-gray-500 text-center">
                          No sub-jobs under this job.
                        </div>
                      )}
                    </div>
                  </SmoothCollapse>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  if (!customer) return <div className="p-8 text-center text-gray-500">No customer data found.</div>

  return (
    <div className="space-y-4">
      <ConfirmDeleteModal
        open={deleteModal.open}
        title={deleteModal.title}
        description={deleteModal.description}
        confirmText={deleteModal.confirmText}
        loading={deleteLoading}
        onClose={() => !deleteLoading && setDeleteModal((p) => ({ ...p, open: false }))}
        onConfirm={confirmDelete}
      />

      {isAdmin ? (
        <JobModal
          open={jobModal.open}
          loading={jobSaving}
          jobsTree={jobsTree}
          mode={jobModal.mode === "sub" ? "sub" : "root"}
          parentJobId={jobModal.parentJobId}
          onClose={() => !jobSaving && setJobModal({ open: false, mode: "root", parentJobId: null })}
          onSubmit={createJob}
        />
      ) : null}

      {isAdmin ? (
        <TaskModal
          open={createOpen}
          mode="create"
          loading={createSaving}
          templates={templates}
          assignedEmployees={assignedEmployees}
          canAssign={(assignedEmployees || []).length > 0}
          jobsFlat={jobsFlat}
          jobIdValue={cJobId}
          setJobIdValue={setCJobId}
          value={cDesc}
          setValue={setCDesc}
          subtitlesValue={cSubtitles}
          setSubtitlesValue={setCSubtitles}
          templateId={cTemplateId}
          setTemplateId={setCTemplateId}
          selectedSubtitleIds={cSelectedSubtitleIds}
          setSelectedSubtitleIds={setCSelectedSubtitleIds}
          titleValue={cTitle}
          setTitleValue={setCTitle}
          statusValue={cStatus}
          setStatusValue={setCStatus}
          dueAtValue={cDueAt}
          setDueAtValue={setCDueAt}
          assigneesValue={cAssignees}
          setAssigneesValue={setCAssignees}
          onClose={() => !createSaving && setCreateOpen(false)}
          onSubmit={createTask}
        />
      ) : null}

      <TaskModal
        open={editOpen}
        mode="edit"
        loading={editSaving}
        templates={templates}
        assignedEmployees={assignedEmployees}
        canAssign={(assignedEmployees || []).length > 0}
        jobsFlat={jobsFlat}
        jobIdValue={eJobId}
        setJobIdValue={setEJobId}
        value={eDesc}
        setValue={setEDesc}
        subtitlesValue={eSubtitles}
        setSubtitlesValue={setESubtitles}
        templateId={eTemplateId}
        setTemplateId={setETemplateId}
        selectedSubtitleIds={eSelectedSubtitleIds}
        setSelectedSubtitleIds={setESelectedSubtitleIds}
        titleValue={eTitle}
        setTitleValue={setETitle}
        statusValue={eStatus}
        setStatusValue={setEStatus}
        dueAtValue={eDueAt}
        setDueAtValue={setEDueAt}
        assigneesValue={eAssignees}
        setAssigneesValue={setEAssignees}
        onClose={() => !editSaving && setEditOpen(false)}
        onSubmit={updateTask}
        isEmployeeMode={isEmployee}
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-indigo-700">Jobs & Tasks</p>
                {activeFilterCount ? <Badge tone="indigo">{activeFilterCount} FILTERS</Badge> : null}
              </div>

              <p className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1 mt-1">
                <span>
                  {tasks.length} loaded{tasksHasMore ? " • more available" : ""}
                </span>
                <span className="text-gray-400">•</span>
                <span>
                  <span className="font-semibold">Pending:</span> {tasksSummary.pending}
                </span>
                <span className="text-gray-400">•</span>
                <span>
                  <span className="font-semibold">In progress:</span> {tasksSummary.in_progress}
                </span>
                <span className="text-gray-400">•</span>
                <span>
                  <span className="font-semibold">Done:</span> {tasksSummary.done}
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
              >
                <FiFilter />
                Filters
              </button>

              {isAdmin ? (
                <>
                  <button
                    onClick={() => openCreateJobModal(null)}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
                  >
                    <FiPlus />
                    Add Job
                  </button>
                  <button
                    onClick={() => openCreateModal("")}
                    className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold"
                  >
                    <FiPlus />
                    Add Task
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <SmoothCollapse open={filtersOpen}>
            <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4">
                  <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2 mb-1">
                    <FiSearch /> Search
                  </label>
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm outline-none"
                    placeholder="Title / note / subtitle / job / assignee..."
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2 mb-1">
                    <FiFolder /> Job
                  </label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
                  >
                    <option value="">All jobs</option>
                    {(jobsFlat || []).map((j) => (
                      <option key={String(j?._id)} value={String(j?._id)}>
                        {formatJobOptionLabel(j)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2 mb-1">
                    <FiTag /> Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
                  >
                    <option value="all">all</option>
                    <option value="pending">pending</option>
                    <option value="in_progress">in_progress</option>
                    <option value="done">done</option>
                    <option value="overdue">overdue</option>
                    <option value="no_due">no_due</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2 mb-1">
                    <FiTag /> Due
                  </label>
                  <select
                    value={dueFilter}
                    onChange={(e) => setDueFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
                  >
                    <option value="all">all</option>
                    <option value="today">today</option>
                    <option value="7d">next 7 days</option>
                    <option value="30d">next 30 days</option>
                    <option value="overdue">overdue</option>
                    <option value="none">no due</option>
                  </select>
                </div>

                <div className="lg:col-span-1">
                  <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2 mb-1">
                    <FiTag /> Sort
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
                  >
                    <option value="due_asc">due ↑</option>
                    <option value="due_desc">due ↓</option>
                    <option value="created_desc">newest</option>
                    <option value="title_asc">title</option>
                    <option value="status">status</option>
                  </select>
                </div>

                <div className="lg:col-span-4">
                  <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2 mb-1">
                    <FiTag /> Assignee
                  </label>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
                  >
                    <option value="all">all assignees</option>
                    {(assignedEmployees || []).map((u) => (
                      <option key={String(u?._id)} value={String(u?._id)}>
                        {u?.name || u?.email || "Employee"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-8 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end justify-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
                    title="Clear filters"
                  >
                    <FiRotateCcw />
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </SmoothCollapse>
        </div>

        <div className="p-4 sm:p-6 bg-gray-50/40">
          {activeFilterCount ? (
            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-indigo-700 truncate">Filtered Results</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Showing {filteredTasksAll.length} task{filteredTasksAll.length === 1 ? "" : "s"}.
                  </p>
                </div>

                <button
                  onClick={() => setOpenTaskIds(new Set(filteredTasksAll.map((t) => String(t?._id))))}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
                  title="Expand all filtered tasks"
                >
                  <FiChevronDown />
                  Expand
                </button>
              </div>

              {renderTaskList(filteredTasksAll)}
            </div>
          ) : (
            renderJobsTreeWithTasks()
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-gray-500">
            Loaded {tasks.length} • Page size {TASKS_PAGE_SIZE}
          </p>

          {tasksHasMore ? (
            <button
              onClick={() => fetchTasks({ reset: false })}
              disabled={tasksLoading}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60"
            >
              {tasksLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Load more
            </button>
          ) : (
            <span className="text-xs text-gray-400">No more tasks</span>
          )}
        </div>
      </div>
    </div>
  )
}
