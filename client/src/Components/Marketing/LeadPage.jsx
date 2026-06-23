"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiSearch,
  FiPlus,
  FiEye,
  FiX,
  FiEdit2,
  FiRefreshCcw,
  FiCheck,
  FiAlertCircle,
  FiFilter,
  FiPhoneCall,
  FiCalendar,
  FiFileText,
  FiUserPlus,
  FiArrowLeft,
  FiMoreVertical,
  FiCopy,
  FiLoader,
  FiColumns,
  FiChevronUp,
  FiChevronDown,
} from "react-icons/fi"
import { SiMicrosoftexcel } from "react-icons/si"
import LeadInboxPanel from "../LeadInbox/LeadInboxPanel"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/* =========================
   UI TOKENS
========================= */
const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const subtleHover = "transition-colors hover:bg-gray-50/70"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const iconBtn =
  "p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent"
const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

// ✅ Premium Excel button (green)
const btnExcel =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none focus:ring-2 focus:ring-emerald-500/40 " +
  "bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_10px_20px_-12px_rgba(16,185,129,0.8)] border border-emerald-700/20"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function formatDate(dt) {
  if (!dt) return "—"
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

function formatDateTime(dt) {
  if (!dt) return "—"
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const a = parts[0]?.[0] || ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""
  return (a + b).toUpperCase()
}

function copyToClipboard(text) {
  if (!text) return
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = document.createElement("textarea")
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  document.execCommand("copy")
  document.body.removeChild(ta)
}

function get(obj, path, fallback = "") {
  if (!obj || !path) return fallback
  const parts = String(path).split(".").filter(Boolean)
  let cur = obj
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p]
    else return fallback
  }
  return cur ?? fallback
}

function safeText(v) {
  if (v === undefined || v === null) return ""
  return String(v).replace(/\r?\n/g, " ").trim()
}

function toCsvCell(value) {
  const s = safeText(value)
  const needsQuotes = /[",\n]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function downloadCSV({ filename, headers, rows }) {
  const lines = []
  lines.push(headers.map(toCsvCell).join(","))
  for (const row of rows) lines.push(row.map(toCsvCell).join(","))
  const csv = "\uFEFF" + lines.join("\n") // BOM for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* =========================
   BADGES
========================= */
function LeadStatusBadge({ status }) {
  const s = String(status || "").toLowerCase()
  const cls =
    s === "confirmed"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "contacted"
      ? "bg-sky-50 text-sky-700 ring-sky-600/10"
      : s === "pending"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : s === "lost"
      ? "bg-rose-50 text-rose-700 ring-rose-600/10"
      : "bg-gray-100 text-gray-700 ring-gray-600/10"

  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || "—"}
    </span>
  )
}

function StageBadge({ stage }) {
  const s = String(stage || "").toLowerCase()
  const cls =
    s === "won"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "lost"
      ? "bg-rose-50 text-rose-700 ring-rose-600/10"
      : s === "negotiation"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
      : s === "proposal"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : s === "qualified"
      ? "bg-sky-50 text-sky-700 ring-sky-600/10"
      : "bg-gray-100 text-gray-700 ring-gray-600/10"

  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || "—"}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const p = String(priority || "").toLowerCase()
  const cls =
    p === "high"
      ? "bg-rose-50 text-rose-700 ring-rose-600/10"
      : p === "medium"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : p === "low"
      ? "bg-sky-50 text-sky-700 ring-sky-600/10"
      : "bg-gray-100 text-gray-700 ring-gray-600/10"

  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {p || "—"}
    </span>
  )
}

/* =========================
   TOAST
========================= */
function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-green-50 border-green-200 text-green-700"
  const Icon = type === "error" ? FiAlertCircle : FiCheck

  return (
    <div className="fixed top-4 right-4 z-[80] max-w-sm w-[92vw] sm:w-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={cn("rounded-2xl border p-3 shadow-lg", styles)}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5" />
          <p className="text-sm font-semibold flex-1">{message}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 focus:outline-none" aria-label="Close">
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* =========================
   MODAL SHELL
========================= */
function ModalShell({ open, onClose, title, subtitle, icon, children, footer, maxWidthClass = "max-w-3xl" }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => (document.body.style.overflow = prev)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className={cn(
              "relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]",
              maxWidthClass
            )}
          >
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-20">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  {icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{title}</h2>
                  {subtitle ? <p className="text-sm text-gray-600 truncate">{subtitle}</p> : null}
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition focus:outline-none"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-4 sm:p-5 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">{children}</div>

            {footer ? <div className="p-4 sm:p-5 border-t border-gray-100 bg-white sticky bottom-0 z-20">{footer}</div> : null}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">{label}</label>
      {children}
      {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
    </div>
  )
}

/* =========================
   API HELPERS
========================= */
async function apiListLeads({ limit = 25, cursor, params = {}, signal } = {}) {
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", String(cursor))

  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    const s = String(v).trim()
    if (!s) return
    qs.set(k, s)
  })

  const res = await fetch(`${API_BASE}/leads?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load leads")
  return data
}

async function apiGetLeadById(id, signal) {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load lead details")
  return data?.lead || data?.item || data?.data || data
}

async function apiCreateLead(payload) {
  const res = await fetch(`${API_BASE}/leads`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Create lead failed")
  return data
}

async function apiUpdateLead(id, payload) {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Update lead failed")
  return data
}

async function apiAddLeadNote(id, note) {
  const res = await fetch(`${API_BASE}/leads/${id}/notes`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ note }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Add note failed")
  return data
}

async function apiMarkContacted(id) {
  const res = await fetch(`${API_BASE}/leads/${id}/contacted`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Mark contacted failed")
  return data
}

async function apiSetFollowUp(id, nextFollowUpAt) {
  const res = await fetch(`${API_BASE}/leads/${id}/followup`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ nextFollowUpAt }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Set followup failed")
  return data
}

async function apiConvertLead(id) {
  const res = await fetch(`${API_BASE}/leads/${id}/convert`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Convert failed")
  return data
}

/* =========================
   PURCHASE TYPES (NEW) - backend: /api/purchase-types
========================= */
async function apiListPurchaseTypes({ q = "", active = "true", limit = 100, cursor = null, signal } = {}) {
  const qs = new URLSearchParams()
  if (q) qs.set("q", q)
  if (active) qs.set("active", active) // "true" | "false" | "all"
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", String(cursor))

  const res = await fetch(`${API_BASE}/purchase-types?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load purchase types")
  return data
}

async function apiCreatePurchaseType({ name, key }) {
  const res = await fetch(`${API_BASE}/purchase-types`, {
    method: "POST",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ name, key }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to create purchase type")
  return data
}

/* =========================
   COLUMNS (ONLY YOUR LIST) + FRIENDLY LABELS + EXPORT VALUES
========================= */
const COLUMNS_STORAGE_KEY = "marketingLeads.columns.onlySpecified.v5"

const COLUMN_DEFS = [
  {
    key: "leadNumber",
    label: "Lead No.",
    widthClass: "min-w-[170px]",
    fields: ["leadNumber"],
    render: (l, { showToast }) => {
      const ln = l?.leadNumber || ""
      return ln ? (
        <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
          <span className="font-bold font-mono">{ln}</span>
          <button
            className="ml-1 p-1 rounded-lg hover:bg-black/5"
            title="Copy"
            onClick={() => {
              copyToClipboard(ln)
              showToast?.("success", "Lead number copied.")
            }}
          >
            <FiCopy className="w-3.5 h-3.5" />
          </button>
        </span>
      ) : (
        "—"
      )
    },
    exportValue: (l) => l?.leadNumber || "",
  },
  {
    key: "contact.name",
    label: "Contact name",
    widthClass: "min-w-[240px]",
    fields: ["contact.name"],
    render: (l) => (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-indigo-700">{initials(get(l, "contact.name", ""))}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{get(l, "contact.name", "—")}</p>
        </div>
      </div>
    ),
    exportValue: (l) => get(l, "contact.name", ""),
  },
  {
    key: "contact.companyName",
    label: "Company",
    widthClass: "min-w-[240px]",
    fields: ["contact.companyName"],
    render: (l) => <span className="text-sm font-semibold text-gray-900">{get(l, "contact.companyName", "—")}</span>,
    exportValue: (l) => get(l, "contact.companyName", ""),
  },
  {
    key: "contact.email",
    label: "Email",
    widthClass: "min-w-[260px]",
    fields: ["contact.email"],
    render: (l) => <span className="text-sm text-gray-900 break-all">{get(l, "contact.email", "—")}</span>,
    exportValue: (l) => get(l, "contact.email", ""),
  },
  {
    key: "contact.phone",
    label: "Phone",
    widthClass: "min-w-[190px]",
    fields: ["contact.phone"],
    render: (l) => <span className="text-sm font-semibold text-gray-900">{get(l, "contact.phone", "—")}</span>,
    exportValue: (l) => get(l, "contact.phone", ""),
  },
  {
    key: "status",
    label: "Status",
    widthClass: "min-w-[140px]",
    fields: ["status"],
    render: (l) => <LeadStatusBadge status={l?.status} />,
    exportValue: (l) => l?.status || "",
  },
  {
    key: "pipelineStage",
    label: "Stage",
    widthClass: "min-w-[160px]",
    fields: ["pipelineStage"],
    render: (l) => <StageBadge stage={l?.pipelineStage} />,
    exportValue: (l) => l?.pipelineStage || "",
  },
  {
    key: "priority",
    label: "Priority",
    widthClass: "min-w-[140px]",
    fields: ["priority"],
    render: (l) => <PriorityBadge priority={l?.priority} />,
    exportValue: (l) => l?.priority || "",
  },
  {
    key: "purchaseType",
    label: "Purchase type",
    widthClass: "min-w-[190px]",
    fields: ["purchaseType"],
    render: (l) => <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>{l?.purchaseType || "—"}</span>,
    exportValue: (l) => l?.purchaseType || "",
  },
  {
    key: "source",
    label: "Source",
    widthClass: "min-w-[190px]",
    fields: ["source"],
    render: (l) => <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>{l?.source || "—"}</span>,
    exportValue: (l) => l?.source || "",
  },
  {
    key: "tags",
    label: "Tags",
    widthClass: "min-w-[280px]",
    fields: ["tags"],
    render: (l) => {
      const tags = Array.isArray(l?.tags) ? l.tags : []
      return (
        <div className="flex flex-wrap gap-1.5">
          {tags.length ? (
            tags.slice(0, 10).map((t) => (
              <span key={String(t)} className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                {String(t)}
              </span>
            ))
          ) : (
            <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>No tags</span>
          )}
          {tags.length > 10 ? <span className="text-xs text-gray-400">+{tags.length - 10}</span> : null}
        </div>
      )
    },
    exportValue: (l) => (Array.isArray(l?.tags) ? l.tags.map(String).join(", ") : ""),
  },
  {
    key: "nextFollowUpAt",
    label: "Next follow-up",
    widthClass: "min-w-[210px]",
    fields: ["nextFollowUpAt"],
    render: (l) => <span className="text-sm font-semibold text-gray-900">{formatDateTime(l?.nextFollowUpAt)}</span>,
    exportValue: (l) => (l?.nextFollowUpAt ? formatDateTime(l.nextFollowUpAt) : ""),
  },
  {
    key: "lastContactedAt",
    label: "Last contacted",
    widthClass: "min-w-[210px]",
    fields: ["lastContactedAt"],
    render: (l) => <span className="text-sm font-semibold text-gray-900">{formatDateTime(l?.lastContactedAt)}</span>,
    exportValue: (l) => (l?.lastContactedAt ? formatDateTime(l.lastContactedAt) : ""),
  },
  {
    key: "createdAt",
    label: "Created",
    widthClass: "min-w-[200px]",
    fields: ["createdAt"],
    render: (l) => <span className="text-sm font-semibold text-gray-900">{formatDateTime(l?.createdAt)}</span>,
    exportValue: (l) => (l?.createdAt ? formatDateTime(l.createdAt) : ""),
  },
  {
    key: "updatedAt",
    label: "Updated",
    widthClass: "min-w-[200px]",
    fields: ["updatedAt"],
    render: (l) => <span className="text-sm font-semibold text-gray-900">{formatDateTime(l?.updatedAt)}</span>,
    exportValue: (l) => (l?.updatedAt ? formatDateTime(l.updatedAt) : ""),
  },
]

const DEFAULT_VISIBLE_COLUMNS = ["contact.name", "status", "pipelineStage", "priority", "nextFollowUpAt"]

function loadColumnsFromStorage() {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return DEFAULT_VISIBLE_COLUMNS
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return DEFAULT_VISIBLE_COLUMNS
    const valid = arr.filter((k) => COLUMN_DEFS.some((c) => c.key === k))
    return valid.length ? valid : DEFAULT_VISIBLE_COLUMNS
  } catch {
    return DEFAULT_VISIBLE_COLUMNS
  }
}

function saveColumnsToStorage(cols) {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(cols))
  } catch {}
}

function deriveFieldsParam(visibleColumns) {
  const set = new Set()
  for (const key of visibleColumns || []) {
    const def = COLUMN_DEFS.find((c) => c.key === key)
    if (!def?.fields) continue
    for (const f of def.fields) set.add(f)
  }
  set.add("_id")
  return Array.from(set).join(",")
}

/* =========================
   PURCHASE TYPE SELECT (NEW)
   - dropdown from /api/purchase-types
   - add new option inline
========================= */
function PurchaseTypePicker({
  label = "Purchase type",
  value,
  onChange,
  options,
  loading,
  error,
  onCreate,
  createBusy,
  placeholder = "Select purchase type",
  allowEmpty = true,
  hint,
}) {
  const [mode, setMode] = useState("select") // "select" | "add"
  const [newName, setNewName] = useState("")
  const [localErr, setLocalErr] = useState("")

  useEffect(() => {
    // If current value isn't in options (legacy data), keep in select mode but show it as custom.
    if (!value) return
    const has = (options || []).some((o) => String(o?.name || "") === String(value))
    if (!has) {
      // keep it; user may change it
    }
  }, [value, options])

  const startAdd = () => {
    setLocalErr("")
    setNewName("")
    setMode("add")
  }

  const cancelAdd = () => {
    setLocalErr("")
    setNewName("")
    setMode("select")
  }

  const submitAdd = async () => {
    setLocalErr("")
    const name = String(newName || "").trim()
    if (!name) return setLocalErr("Enter a purchase type name.")
    try {
      const createdName = await onCreate?.(name)
      // createdName should be the final display name
      onChange?.(createdName || name)
      setMode("select")
      setNewName("")
    } catch (e) {
      setLocalErr(e?.message || "Failed to add purchase type")
    }
  }

  const val = String(value || "")

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {mode === "select" ? (
          <>
            <div className="flex items-center gap-2">
              <select
                value={val}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === "__add__") return startAdd()
                  onChange?.(v)
                }}
                className={input}
                disabled={loading}
              >
                {allowEmpty ? <option value="">{placeholder}</option> : null}

                {/* If current value is legacy/custom and not in options, show it */}
                {val &&
                !(options || []).some((o) => String(o?.name || "") === val) &&
                val !== "__add__" ? (
                  <option value={val}>{val} (custom)</option>
                ) : null}

                {(options || []).map((o) => (
                  <option key={o?._id || o?.key || o?.name} value={o?.name || ""}>
                    {o?.name || "—"}
                  </option>
                ))}

                <option value="__add__">+ Add new…</option>
              </select>

              <button type="button" onClick={startAdd} className={cn(btn, btnGhost, "px-3 py-2 text-sm")} disabled={loading}>
                <FiPlus className="w-4 h-4" />
                Add
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <FiLoader className="w-3.5 h-3.5 animate-spin" /> Loading purchase types…
              </p>
            ) : null}

            {error ? <p className="text-xs text-rose-700">{error}</p> : null}
          </>
        ) : (
          <div className={cn(card, "p-3")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">Add purchase type</p>
                <p className="text-xs text-gray-500">This will be saved and available in the dropdown.</p>
              </div>
              <button type="button" className={cn(iconBtn, "p-2")} onClick={cancelAdd} disabled={createBusy} title="Close">
                <FiX className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={input}
                placeholder="e.g., Retail, Corporate, Wholesale…"
              />
              <button type="button" onClick={submitAdd} disabled={createBusy} className={cn(btn, btnPrimary, "disabled:opacity-60")}>
                {createBusy ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiCheck className="w-4 h-4" />}
                Save
              </button>
              <button type="button" onClick={cancelAdd} disabled={createBusy} className={cn(btn, btnGhost, "px-4")}>
                Cancel
              </button>
            </div>

            {localErr ? <p className="mt-2 text-xs text-rose-700">{localErr}</p> : null}
          </div>
        )}
      </div>
    </Field>
  )
}

/* =========================
   COLUMNS MODAL
========================= */
function ColumnsModal({ open, onClose, visibleColumns, setVisibleColumns }) {
  const [draft, setDraft] = useState(visibleColumns || DEFAULT_VISIBLE_COLUMNS)

  useEffect(() => {
    if (!open) return
    setDraft(visibleColumns || DEFAULT_VISIBLE_COLUMNS)
  }, [open, visibleColumns])

  const toggle = (key) => {
    setDraft((p) => {
      const has = p.includes(key)
      const next = has ? p.filter((x) => x !== key) : [...p, key]
      return next.length ? next : p
    })
  }

  const move = (key, dir) => {
    setDraft((p) => {
      const idx = p.indexOf(key)
      if (idx === -1) return p
      const ni = dir === "up" ? idx - 1 : idx + 1
      if (ni < 0 || ni >= p.length) return p
      const copy = p.slice()
      const [it] = copy.splice(idx, 1)
      copy.splice(ni, 0, it)
      return copy
    })
  }

  const apply = () => {
    setVisibleColumns(draft)
    saveColumnsToStorage(draft)
    onClose?.()
  }

  const preset = (name) => {
    if (name === "default") setDraft(DEFAULT_VISIBLE_COLUMNS)
    if (name === "all") setDraft(COLUMN_DEFS.map((c) => c.key))
  }

  const selectedSet = new Set(draft)

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Choose columns"
      subtitle="Show/hide columns in the table"
      icon={<FiColumns className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => preset("default")} className={cn(btn, btnGhost, "px-3 py-2 text-sm")}>
              Default
            </button>
            <button onClick={() => preset("all")} className={cn(btn, btnGhost, "px-3 py-2 text-sm")}>
              Show all
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className={cn(btn, btnGhost)}>
              Cancel
            </button>
            <button onClick={apply} className={cn(btn, btnPrimary)}>
              Apply
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <div className={cn(card, "p-4")}>
            <p className="text-sm font-bold text-gray-900">Available columns</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COLUMN_DEFS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-gray-50/60 transition cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(c.key)}
                    onChange={() => toggle(c.key)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.label}</p>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className={cn(card, "p-4")}>
            <p className="text-sm font-bold text-gray-900">Selected order</p>
            <p className="text-xs text-gray-500 mt-1">Use the arrows to reorder.</p>

            <div className="mt-4 space-y-2">
              {draft.map((key, idx) => {
                const c = COLUMN_DEFS.find((x) => x.key === key)
                if (!c) return null
                return (
                  <div key={key} className="flex items-center gap-2 p-3 rounded-2xl border border-gray-100 bg-white">
                    <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200 shrink-0")}>{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.label}</p>
                    </div>

                    <button className={cn(iconBtn, "p-2")} onClick={() => move(key, "up")} disabled={idx === 0} title="Move up">
                      <FiChevronUp className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                      className={cn(iconBtn, "p-2")}
                      onClick={() => move(key, "down")}
                      disabled={idx === draft.length - 1}
                      title="Move down"
                    >
                      <FiChevronDown className="w-4 h-4 text-gray-700" />
                    </button>
                    <button className={cn(iconBtn, "p-2")} onClick={() => toggle(key)} title="Remove">
                      <FiX className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   MODALS (UPSERT / NOTE / FOLLOWUP / FILTERS)
========================= */
function LeadUpsertModal({ open, onClose, mode = "create", initial, onSaved, purchaseTypesState }) {
  const { items: purchaseTypes, loading: ptLoading, error: ptError, create: createPurchaseType, creating } =
    purchaseTypesState || {}

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    source: "",
    status: "new",
    pipelineStage: "new",
    priority: "medium",
    purchaseType: "",
    tags: "",
    website: "",
    industry: "",
    address: "",
    assignedTo: "",
  })

  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setError("")
    const c = initial || {}
    setForm({
      name: c?.contact?.name || "",
      email: c?.contact?.email || "",
      phone: c?.contact?.phone || "",
      companyName: c?.contact?.companyName || "",
      source: c?.source || "",
      status: c?.status || "new",
      pipelineStage: c?.pipelineStage || "new",
      priority: c?.priority || "medium",
      purchaseType: c?.purchaseType || "",
      tags: Array.isArray(c?.tags) ? c.tags.join(", ") : "",
      website: c?.company?.website || "",
      industry: c?.company?.industry || "",
      address: c?.company?.address || "",
      assignedTo: typeof c?.assignedTo === "string" ? c.assignedTo : c?.assignedTo?._id || "",
    })
  }, [open, initial])

  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    setError("")
    if (!form.name.trim()) return setError("Contact name is required.")
    if (!form.companyName.trim()) return setError("Company name is required.")

    const payload = {
      contact: {
        name: form.name.trim(),
        email: form.email.trim() ? form.email.trim().toLowerCase() : "",
        phone: form.phone.trim() || "",
        companyName: form.companyName.trim(),
      },
      source: form.source.trim() || "",
      status: form.status,
      pipelineStage: form.pipelineStage,
      priority: String(form.priority || "medium").toLowerCase(),
      purchaseType: form.purchaseType.trim() || "",
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      company: {
        website: form.website.trim() || "",
        industry: form.industry.trim() || "",
        address: form.address.trim() || "",
      },
      ...(form.assignedTo.trim() ? { assignedTo: form.assignedTo.trim() } : {}),
    }

    setIsSubmitting(true)
    try {
      if (mode === "create") await apiCreateLead(payload)
      else await apiUpdateLead(initial?._id, payload)
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e?.message || "Save failed")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit lead" : "Create lead"}
      subtitle="Contact + pipeline + company info"
      icon={mode === "edit" ? <FiEdit2 className="w-5 h-5" /> : <FiPlus className="w-5 h-5" />}
      footer={
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)} disabled={isSubmitting}>
            Cancel
          </button>
          <button onClick={submit} disabled={isSubmitting} className={cn(btn, btnPrimary, "disabled:opacity-60")}>
            {isSubmitting ? "Saving..." : mode === "edit" ? "Update" : "Create"}
          </button>
        </div>
      }
    >
      {error ? <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Contact name *">
          <input value={form.name} onChange={update("name")} className={input} placeholder="Person name" />
        </Field>

        <Field label="Company *">
          <input value={form.companyName} onChange={update("companyName")} className={input} placeholder="Company name" />
        </Field>

        <Field label="Email">
          <input value={form.email} onChange={update("email")} className={input} placeholder="email@example.com" />
        </Field>

        <Field label="Phone">
          <input value={form.phone} onChange={update("phone")} className={input} placeholder="01XXXXXXXXX" />
        </Field>

        <Field label="Status">
          <select value={form.status} onChange={update("status")} className={input}>
            <option value="new">new</option>
            <option value="contacted">contacted</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="lost">lost</option>
          </select>
        </Field>

        <Field label="Stage">
          <select value={form.pipelineStage} onChange={update("pipelineStage")} className={input}>
            <option value="new">new</option>
            <option value="qualified">qualified</option>
            <option value="proposal">proposal</option>
            <option value="negotiation">negotiation</option>
            <option value="won">won</option>
            <option value="lost">lost</option>
          </select>
        </Field>

        <Field label="Priority">
          <select value={form.priority} onChange={update("priority")} className={input}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </Field>

        {/* ✅ Purchase type now uses backend options + add new */}
        <div className="md:col-span-1">
          <PurchaseTypePicker
            label="Purchase type"
            value={form.purchaseType}
            onChange={(v) => setForm((p) => ({ ...p, purchaseType: v }))}
            options={purchaseTypes || []}
            loading={!!ptLoading}
            error={ptError || ""}
            onCreate={createPurchaseType}
            createBusy={!!creating}
            placeholder="Select purchase type"
            allowEmpty={true}
            hint="Choose from saved types or add a new one."
          />
        </div>

        <Field label="Source">
          <input value={form.source} onChange={update("source")} className={input} placeholder="Facebook / referral / walk-in..." />
        </Field>

        <Field label="Tags (comma separated)">
          <input value={form.tags} onChange={update("tags")} className={input} placeholder="vip, hot, retail, ..." />
        </Field>

        {/* ✅ Company section */}
        <div className="md:col-span-2">
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-bold text-gray-900 mb-3">Company</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Website">
                <input value={form.website} onChange={update("website")} className={input} placeholder="https://..." />
              </Field>
              <Field label="Industry">
                <input value={form.industry} onChange={update("industry")} className={input} placeholder="Industry" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Address">
                  <input value={form.address} onChange={update("address")} className={input} placeholder="Street, area, city" />
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Assigned to */}
        <div className="md:col-span-2">
          <Field label="Assigned To (optional User ID)">
            <input value={form.assignedTo} onChange={update("assignedTo")} className={input} placeholder="UserId (optional)" />
          </Field>
        </div>
      </div>
    </ModalShell>
  )
}

function NoteModal({ open, onClose, lead, onAdded }) {
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setNote("")
    setError("")
    setLoading(false)
  }, [open])

  const submit = async () => {
    setError("")
    if (!note.trim()) return setError("Write a note first.")
    setLoading(true)
    try {
      await apiAddLeadNote(lead?._id, note.trim())
      onAdded?.()
      onClose?.()
    } catch (e) {
      setError(e?.message || "Failed to add note")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Add note"
      subtitle={lead?.contact?.name ? `Lead: ${lead.contact.name}` : ""}
      icon={<FiFileText className="w-5 h-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)} disabled={loading}>
            Cancel
          </button>
          <button onClick={submit} className={cn(btn, btnPrimary, "disabled:opacity-60")} disabled={loading}>
            {loading ? "Saving..." : "Add note"}
          </button>
        </div>
      }
    >
      {error ? <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div> : null}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} className={cn(input, "min-h-[140px]")} />
    </ModalShell>
  )
}

function FollowUpModal({ open, onClose, lead, onSaved }) {
  const [dt, setDt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setLoading(false)
    const existing = lead?.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null
    if (existing && !Number.isNaN(existing.getTime())) {
      const iso = new Date(existing.getTime() - existing.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setDt(iso)
    } else {
      setDt("")
    }
  }, [open, lead])

  const submit = async () => {
    setError("")
    if (!dt) return setError("Select a date/time.")
    setLoading(true)
    try {
      await apiSetFollowUp(lead?._id, new Date(dt).toISOString())
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e?.message || "Failed to set follow up")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Set follow-up"
      subtitle={lead?.contact?.name ? `Lead: ${lead.contact.name}` : ""}
      icon={<FiCalendar className="w-5 h-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)} disabled={loading}>
            Cancel
          </button>
          <button onClick={submit} className={cn(btn, btnPrimary, "disabled:opacity-60")} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      }
    >
      {error ? <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div> : null}
      <Field label="Next follow-up date & time">
        <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className={input} />
      </Field>
    </ModalShell>
  )
}

function FiltersModal({ open, onClose, draft, setDraft, onApply, onClearDraft, purchaseTypesState }) {
  const { items: purchaseTypes, loading: ptLoading, error: ptError, create: createPurchaseType, creating } =
    purchaseTypesState || {}

  const hasAnyDraft = useMemo(() => Object.values(draft || {}).some((v) => String(v || "").trim()), [draft])

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle=""
      icon={<FiFilter className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button type="button" onClick={onClearDraft} disabled={!hasAnyDraft} className={cn(btn, btnGhost, "px-3 py-2 text-sm disabled:opacity-60")}>
            Clear
          </button>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className={cn(btn, btnGhost)}>
              Cancel
            </button>
            <button onClick={onApply} className={cn(btn, btnPrimary)}>
              Apply
            </button>
          </div>
        </div>
      }
    >
      <div className={cn(card, "overflow-hidden")}>
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-sm font-bold text-gray-900">Filter options</p>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Status">
              <select value={draft.status || ""} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))} className={input}>
                <option value="">All</option>
                <option value="new">new</option>
                <option value="contacted">contacted</option>
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="lost">lost</option>
              </select>
            </Field>

            <Field label="Stage">
              <select value={draft.pipelineStage || ""} onChange={(e) => setDraft((p) => ({ ...p, pipelineStage: e.target.value }))} className={input}>
                <option value="">All</option>
                <option value="new">new</option>
                <option value="qualified">qualified</option>
                <option value="proposal">proposal</option>
                <option value="negotiation">negotiation</option>
                <option value="won">won</option>
                <option value="lost">lost</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Priority">
              <select value={draft.priority || ""} onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value }))} className={input}>
                <option value="">All</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </Field>

            {/* ✅ Purchase type filter now dropdown + add */}
            <PurchaseTypePicker
              label="Purchase type"
              value={draft.purchaseType || ""}
              onChange={(v) => setDraft((p) => ({ ...p, purchaseType: v }))}
              options={purchaseTypes || []}
              loading={!!ptLoading}
              error={ptError || ""}
              onCreate={async (name) => {
                const createdName = await createPurchaseType?.(name)
                // when created, also set filter to that new value
                setDraft((p) => ({ ...p, purchaseType: createdName || name }))
                return createdName || name
              }}
              createBusy={!!creating}
              placeholder="All purchase types"
              allowEmpty={true}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Source">
              <input value={draft.source || ""} onChange={(e) => setDraft((p) => ({ ...p, source: e.target.value }))} className={input} placeholder="Facebook / referral / etc." />
            </Field>

            <Field label="Tag">
              <input value={draft.tag || ""} onChange={(e) => setDraft((p) => ({ ...p, tag: e.target.value }))} className={input} placeholder="vip / hot / ..." />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Next follow-up (from)">
              <input type="date" value={draft.nextFollowUpFrom || ""} onChange={(e) => setDraft((p) => ({ ...p, nextFollowUpFrom: e.target.value }))} className={input} />
            </Field>
            <Field label="Next follow-up (to)">
              <input type="date" value={draft.nextFollowUpTo || ""} onChange={(e) => setDraft((p) => ({ ...p, nextFollowUpTo: e.target.value }))} className={input} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Last contacted (from)">
              <input type="date" value={draft.lastContactedFrom || ""} onChange={(e) => setDraft((p) => ({ ...p, lastContactedFrom: e.target.value }))} className={input} />
            </Field>
            <Field label="Last contacted (to)">
              <input type="date" value={draft.lastContactedTo || ""} onChange={(e) => setDraft((p) => ({ ...p, lastContactedTo: e.target.value }))} className={input} />
            </Field>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   ROW ACTIONS MENU
========================= */
function RowActionsMenu({ lead, onView, onEdit, onAddNote, onSetFollowUp, onMarkContacted, onConvert, busy, converting, showToast }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const converted =
    !!lead?.convertedCustomer || !!lead?.convertedCustomerId || !!lead?.customerId || !!lead?.convertedCustomer?._id

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const item =
    "w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-semibold text-gray-800 flex items-center gap-2 transition"

  return (
    <div className="relative flex items-center justify-end gap-2" ref={menuRef}>
      <button onClick={onView} className={cn(btn, btnPrimary, "px-3.5 py-2")} title="View">
        <FiEye className="w-4 h-4" />
        View
      </button>

      <button onClick={() => setOpen((v) => !v)} className={iconBtn} aria-label="More actions" title="More">
        <FiMoreVertical className="w-4 h-4 text-gray-700" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            className="absolute right-0 top-12 z-30 w-60 rounded-2xl border border-gray-100 bg-white shadow-xl p-2"
          >
            <button className={item} onClick={() => (setOpen(false), onEdit?.(lead))}>
              <FiEdit2 className="w-4 h-4 text-gray-500" /> Edit
            </button>

            <button className={item} onClick={() => (setOpen(false), onAddNote?.(lead))}>
              <FiFileText className="w-4 h-4 text-gray-500" /> Add note
            </button>

            <button className={item} onClick={() => (setOpen(false), onSetFollowUp?.(lead))}>
              <FiCalendar className="w-4 h-4 text-gray-500" /> Set follow-up
            </button>

            <button
              disabled={busy}
              className={cn(item, busy ? "opacity-60 cursor-not-allowed" : "")}
              onClick={() => {
                setOpen(false)
                onMarkContacted?.(lead?._id)
              }}
            >
              {busy ? <FiLoader className="w-4 h-4 text-gray-500 animate-spin" /> : <FiPhoneCall className="w-4 h-4 text-gray-500" />}
              Mark contacted
            </button>

            <button
              disabled={converting || converted}
              className={cn(item, converting || converted ? "opacity-60 cursor-not-allowed" : "")}
              onClick={() => {
                if (converted) return
                setOpen(false)
                onConvert?.(lead?._id)
              }}
            >
              {converting ? <FiLoader className="w-4 h-4 text-indigo-600 animate-spin" /> : <FiUserPlus className="w-4 h-4 text-indigo-600" />}
              {converted ? "Already converted" : "Convert to customer"}
            </button>

            <div className="my-1 border-t border-gray-100" />

            <button
              className={cn(item, "text-gray-700 hover:bg-gray-50")}
              onClick={() => {
                const ln = lead?.leadNumber || ""
                if (!ln) return
                copyToClipboard(ln)
                showToast?.("success", "Lead number copied.")
                setOpen(false)
              }}
            >
              <FiCopy className="w-4 h-4" /> Copy Lead No.
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/* =========================
   LEAD DETAILS (VIEW)
========================= */
function LeadDetails({ leadId, refreshTick, onBack, onEdit, onAddNote, onSetFollowUp, onMarkContacted, onConvert, showToast }) {
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const abortRef = useRef(null)

  const refetch = async () => {
    if (!leadId) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setErr("")
    try {
      const data = await apiGetLeadById(leadId, controller.signal)
      setLead(data || null)
    } catch (e) {
      if (e?.name !== "AbortError") setErr(e?.message || "Failed to load lead details")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  useEffect(() => {
    if (!leadId) return
    refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick])

  const notes = useMemo(() => (Array.isArray(lead?.notes) ? lead.notes : []), [lead])
  const tags = useMemo(() => (Array.isArray(lead?.tags) ? lead.tags : []), [lead])

  const converted =
    !!lead?.convertedCustomer || !!lead?.convertedCustomerId || !!lead?.customerId || !!lead?.convertedCustomer?._id

  const customerId =
    lead?.customerId ||
    lead?.convertedCustomerId ||
    lead?.convertedCustomer?._id ||
    (typeof lead?.convertedCustomer === "string" ? lead.convertedCustomer : "")

  const contact = lead?.contact || {}

  return (
    <div className={cn(shell, "p-4 sm:p-6 lg:p-8")}>
      <div className="mb-6">
        <div className={cn(card, "p-5 sm:p-6")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={onBack}
                  className={cn("h-10 w-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition", "flex items-center justify-center")}
                  title="Back"
                  aria-label="Back"
                >
                  <FiArrowLeft className="w-5 h-5 text-gray-700" />
                </button>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{contact?.name || "Lead"}</h1>
                    <LeadStatusBadge status={lead?.status} />
                    <StageBadge stage={lead?.pipelineStage} />
                    {lead?.priority ? <PriorityBadge priority={lead.priority} /> : null}
                    {lead?.purchaseType ? <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>{lead.purchaseType}</span> : null}
                    {converted ? <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Converted</span> : null}
                  </div>

                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {contact?.companyName ? `Company: ${contact.companyName}` : "Company: —"}
                    {lead?.source ? ` • Source: ${lead.source}` : ""}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {lead?.leadNumber ? (
                      <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                        Lead No: <span className="font-bold font-mono">{lead.leadNumber}</span>
                        <button
                          className="ml-1 p-1 rounded-lg hover:bg-black/5"
                          title="Copy"
                          onClick={() => {
                            copyToClipboard(lead.leadNumber)
                            showToast?.("success", "Lead number copied.")
                          }}
                        >
                          <FiCopy className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : null}

                    {customerId ? (
                      <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                        Customer ID: <span className="font-bold font-mono">{customerId}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => refetch()} className={cn(btn, btnGhost)} title="Refresh">
                  <FiRefreshCcw className={cn("w-4 h-4", loading ? "animate-spin" : "")} />
                  Refresh
                </button>

                <button onClick={() => onEdit?.(lead)} className={cn(btn, btnGhost)} disabled={!lead}>
                  <FiEdit2 className="w-4 h-4" />
                  Edit
                </button>

                <button onClick={() => onAddNote?.(lead)} className={cn(btn, btnGhost)} disabled={!lead}>
                  <FiFileText className="w-4 h-4" />
                  Add note
                </button>

                <button onClick={() => onSetFollowUp?.(lead)} className={cn(btn, btnGhost)} disabled={!lead}>
                  <FiCalendar className="w-4 h-4" />
                  Follow-up
                </button>

                <button onClick={() => onMarkContacted?.(lead?._id)} className={cn(btn, btnGhost)} disabled={!lead}>
                  <FiPhoneCall className="w-4 h-4" />
                  Contacted
                </button>

                <button
                  onClick={() => onConvert?.(lead?._id)}
                  className={cn(btn, btnPrimary, converted ? "opacity-60 cursor-not-allowed" : "")}
                  disabled={!lead || converted}
                >
                  <FiUserPlus className="w-4 h-4" />
                  {converted ? "Converted" : "Convert"}
                </button>
              </div>
            </div>

            {err ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 mt-0.5" />
                <span className="font-semibold">{err}</span>
              </div>
            ) : null}

            {loading && !lead ? (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm flex items-center gap-2">
                <FiLoader className="w-4 h-4 animate-spin" /> Loading lead details...
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className={cn(card, "p-5")}>
            <p className="text-sm font-bold text-gray-900">Contact</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Contact name</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{contact?.name || "—"}</p>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Company</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{contact?.companyName || "—"}</p>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Phone</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{contact?.phone || "—"}</p>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Email</p>
                <p className="text-sm font-semibold text-gray-900 mt-1 break-all">{contact?.email || "—"}</p>
              </div>
            </div>
          </div>

          <div className={cn(card, "p-5")}>
            <p className="text-sm font-bold text-gray-900">Lead info</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Status</p>
                <div className="mt-1">
                  <LeadStatusBadge status={lead?.status} />
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Stage</p>
                <div className="mt-1">
                  <StageBadge stage={lead?.pipelineStage} />
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Priority</p>
                <div className="mt-1">
                  <PriorityBadge priority={lead?.priority} />
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Purchase type</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{lead?.purchaseType || "—"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                Source: <span className="font-bold">{lead?.source || "—"}</span>
              </span>
              <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                Created: <span className="font-bold">{formatDate(lead?.createdAt)}</span>
              </span>
              <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                Updated: <span className="font-bold">{formatDate(lead?.updatedAt)}</span>
              </span>
            </div>
          </div>

          <div className={cn(card, "p-5")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Notes</p>
                <p className="text-xs text-gray-500">Call notes / WhatsApp / meeting summaries</p>
              </div>
              <button onClick={() => onAddNote?.(lead)} className={cn(btn, btnPrimary, "px-3 py-2")} disabled={!lead}>
                <FiPlus className="w-4 h-4" />
                Add
              </button>
            </div>

            <div className="mt-4">
              {notes.length === 0 ? (
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60 text-sm text-gray-600">No notes yet.</div>
              ) : (
                <ul className="space-y-3">
                  {notes
                    .slice()
                    .reverse()
                    .map((n, idx) => {
                      const text = typeof n === "string" ? n : n?.note || n?.text || ""
                      const at = n?.createdAt || n?.at || n?.date || null
                      const by = n?.createdBy?.name || n?.by?.name || n?.createdBy || ""
                      return (
                        <li key={n?._id || `${idx}-${text.slice(0, 10)}`} className="p-4 rounded-2xl border border-gray-100 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap flex-1">{text || "—"}</p>
                            <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200 shrink-0")}>{formatDateTime(at)}</span>
                          </div>
                          {by ? <p className="text-xs text-gray-500 mt-2">By: {by}</p> : null}
                        </li>
                      )
                    })}
                </ul>
              )}
            </div>
          </div>

          <LeadInboxPanel leadId={leadId} lead={lead} showToast={showToast} compact />
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className={cn(card, "p-5")}>
            <p className="text-sm font-bold text-gray-900">Follow-up</p>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Next follow-up</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{formatDateTime(lead?.nextFollowUpAt)}</p>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Last contacted</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{formatDateTime(lead?.lastContactedAt)}</p>
              </div>
            </div>
          </div>

          <div className={cn(card, "p-5")}>
            <p className="text-sm font-bold text-gray-900">Tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>No tags</span>
              ) : (
                tags.map((t) => (
                  <span key={String(t)} className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                    {String(t)}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className={cn(card, "p-5")}>
            <p className="text-sm font-bold text-gray-900">Quick actions</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => onMarkContacted?.(lead?._id)} disabled={!lead} className={cn(btn, btnGhost, "justify-start")}>
                <FiPhoneCall className="w-4 h-4" /> Mark contacted
              </button>

              <button onClick={() => onSetFollowUp?.(lead)} disabled={!lead} className={cn(btn, btnGhost, "justify-start")}>
                <FiCalendar className="w-4 h-4" /> Set follow-up
              </button>

              <button onClick={() => onAddNote?.(lead)} disabled={!lead} className={cn(btn, btnGhost, "justify-start")}>
                <FiFileText className="w-4 h-4" /> Add note
              </button>

              <button
                onClick={() => onConvert?.(lead?._id)}
                disabled={!lead || converted}
                className={cn(btn, btnPrimary, "justify-start", converted ? "opacity-60 cursor-not-allowed" : "")}
              >
                <FiUserPlus className="w-4 h-4" /> {converted ? "Converted" : "Convert"}
              </button>
            </div>

            {lead?.leadNumber ? (
              <button
                onClick={() => {
                  copyToClipboard(lead.leadNumber)
                  showToast?.("success", "Lead number copied.")
                }}
                className={cn("mt-3 w-full", btn, btnGhost)}
              >
                <FiCopy className="w-4 h-4" /> Copy Lead No.
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================
   MAIN PAGE
========================= */
export default function MarketingLeadsPage({ onConvertedToCustomer }) {
  const PAGE_SIZE = 25
  const EXPORT_PAGE_SIZE = 200
  const EXPORT_MAX_ROWS = 5000

  const [leads, setLeads] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [detailsRefreshTick, setDetailsRefreshTick] = useState(0)
  const bumpDetailsRefresh = () => setDetailsRefreshTick((x) => x + 1)

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    pipelineStage: "",
    priority: "",
    purchaseType: "",
    source: "",
    tag: "",
    nextFollowUpFrom: "",
    nextFollowUpTo: "",
    lastContactedFrom: "",
    lastContactedTo: "",
  })

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draft, setDraft] = useState(filters)

  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(() => loadColumnsFromStorage())
  const visibleColumnDefs = useMemo(
    () => visibleColumns.map((k) => COLUMN_DEFS.find((c) => c.key === k)).filter(Boolean),
    [visibleColumns]
  )
  const fieldsParam = useMemo(() => deriveFieldsParam(visibleColumns), [visibleColumns])

  const [showCreate, setShowCreate] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [noteLead, setNoteLead] = useState(null)
  const [followupLead, setFollowupLead] = useState(null)

  const [convertLoadingId, setConvertLoadingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [exporting, setExporting] = useState(false)

  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = (type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }

  const abortRef = useRef(null)

  /* =========================
     PURCHASE TYPES STATE (NEW)
  ========================= */
  const [purchaseTypes, setPurchaseTypes] = useState([])
  const [ptLoading, setPtLoading] = useState(false)
  const [ptError, setPtError] = useState("")
  const [ptCreating, setPtCreating] = useState(false)

  const loadPurchaseTypes = async ({ silent = false } = {}) => {
    if (!silent) {
      setPtLoading(true)
      setPtError("")
    }
    try {
      // load all pages up to 1000 (practically enough)
      const all = []
      let cursor = null
      let hasNext = true
      const controller = new AbortController()

      while (hasNext && all.length < 1000) {
        const data = await apiListPurchaseTypes({ active: "true", limit: 100, cursor, signal: controller.signal })
        const items = Array.isArray(data?.items) ? data.items : []
        all.push(...items)
        const page = data?.pageInfo || {}
        cursor = page?.nextCursor || null
        hasNext = !!page?.hasNextPage && !!cursor
        if (!!page?.hasNextPage && !cursor) hasNext = false
      }

      // unique by name (in case)
      const map = new Map()
      for (const it of all) {
        const name = String(it?.name || "").trim()
        if (!name) continue
        if (!map.has(name)) map.set(name, it)
      }

      // sort by name
      const sorted = Array.from(map.values()).sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")))
      setPurchaseTypes(sorted)
    } catch (e) {
      setPtError(e?.message || "Failed to load purchase types")
    } finally {
      if (!silent) setPtLoading(false)
    }
  }

  useEffect(() => {
    loadPurchaseTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createPurchaseType = async (name) => {
    const clean = String(name || "").trim()
    if (!clean) throw new Error("Name is required")
    setPtCreating(true)
    try {
      const data = await apiCreatePurchaseType({ name: clean })
      const created =
        data?.purchaseType?.name || data?.purchaseType?.key || data?.name || clean

      // Refresh list
      await loadPurchaseTypes({ silent: true })
      showToast("success", "Purchase type added.")
      return created
    } catch (e) {
      // 409: already exists -> just return name and refresh list
      const msg = e?.message || "Failed to add purchase type"
      if (String(msg).toLowerCase().includes("already")) {
        await loadPurchaseTypes({ silent: true })
        showToast("success", "Purchase type already exists (selected).")
        return clean
      }
      throw e
    } finally {
      setPtCreating(false)
    }
  }

  const purchaseTypesState = useMemo(
    () => ({
      items: purchaseTypes,
      loading: ptLoading,
      error: ptError,
      creating: ptCreating,
      reload: loadPurchaseTypes,
      create: createPurchaseType,
    }),
    [purchaseTypes, ptLoading, ptError, ptCreating]
  )

  const activeFilterCount = useMemo(
    () => Object.values(filters || {}).filter((v) => String(v || "").trim()).length,
    [filters]
  )

  const buildParams = () => {
    const p = {}
    if (filters.status) p.status = filters.status
    if (filters.pipelineStage) p.pipelineStage = filters.pipelineStage
    if (filters.priority) p.priority = filters.priority
    if (filters.purchaseType) p.purchaseType = filters.purchaseType
    if (filters.source) p.source = filters.source
    if (filters.tag) p.tag = filters.tag
    if (filters.q) p.q = filters.q
    if (filters.nextFollowUpFrom) p.nextFollowUpFrom = filters.nextFollowUpFrom
    if (filters.nextFollowUpTo) p.nextFollowUpTo = filters.nextFollowUpTo
    if (filters.lastContactedFrom) p.lastContactedFrom = filters.lastContactedFrom
    if (filters.lastContactedTo) p.lastContactedTo = filters.lastContactedTo
    if (fieldsParam) p.fields = fieldsParam
    return p
  }

  const fetchLeadsPage = async ({ reset = false } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (reset) {
      setIsLoading(true)
      setLeads([])
      setNextCursor(null)
      setHasMore(false)
    } else {
      setIsLoadingMore(true)
    }

    setError("")
    try {
      const data = await apiListLeads({
        limit: PAGE_SIZE,
        cursor: reset ? null : nextCursor,
        params: buildParams(),
        signal: controller.signal,
      })

      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.leads)
        ? data.leads
        : Array.isArray(data?.results)
        ? data.results
        : []

      const page = data?.pageInfo || {}
      const nc = page?.nextCursor ?? data?.nextCursor ?? null
      const hm = page?.hasNextPage ?? data?.hasMore ?? false

      setLeads((prev) => (reset ? items : [...prev, ...items]))
      setNextCursor(nc)
      setHasMore(!!hm)
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load leads.")
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchLeadsPage({ reset: true })
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchLeadsPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)])

  useEffect(() => {
    fetchLeadsPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsParam])

  const doMarkContacted = async (leadId) => {
    if (!leadId) return
    setBusyId(leadId)
    try {
      await apiMarkContacted(leadId)
      showToast("success", "Marked as contacted.")
      await fetchLeadsPage({ reset: true })
      bumpDetailsRefresh()
    } catch (e) {
      showToast("error", e?.message || "Failed")
    } finally {
      setBusyId(null)
    }
  }

  const doConvert = async (leadId) => {
    if (!leadId) return
    setConvertLoadingId(leadId)
    try {
      const data = await apiConvertLead(leadId)
      showToast("success", "Converted successfully.")
      await fetchLeadsPage({ reset: true })
      bumpDetailsRefresh()
      onConvertedToCustomer?.(data?.customerId || data?.customer?._id)
    } catch (e) {
      showToast("error", e?.message || "Convert failed")
    } finally {
      setConvertLoadingId(null)
    }
  }

  const afterMutate = async () => {
    await fetchLeadsPage({ reset: true })
    bumpDetailsRefresh()
  }

  const disableLoadMore = isLoadingMore || isLoading || !hasMore

  const kpis = useMemo(() => {
    const total = leads.length
    const due = leads.filter((l) => l?.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date()).length
    const contacted = leads.filter((l) => String(l?.status || "").toLowerCase() === "contacted").length
    const confirmed = leads.filter((l) => String(l?.status || "").toLowerCase() === "confirmed").length
    return { total, due, contacted, confirmed }
  }, [leads])

  const openFilters = () => {
    setDraft(filters)
    setFiltersOpen(true)
  }

  const clearFilters = () => {
    setFilters({
      q: "",
      status: "",
      pipelineStage: "",
      priority: "",
      purchaseType: "",
      source: "",
      tag: "",
      nextFollowUpFrom: "",
      nextFollowUpTo: "",
      lastContactedFrom: "",
      lastContactedTo: "",
    })
  }

  const clearDraft = () => {
    setDraft({
      q: "",
      status: "",
      pipelineStage: "",
      priority: "",
      purchaseType: "",
      source: "",
      tag: "",
      nextFollowUpFrom: "",
      nextFollowUpTo: "",
      lastContactedFrom: "",
      lastContactedTo: "",
    })
  }

  const applyDraft = () => {
    setFilters(draft)
    setFiltersOpen(false)
  }

  // ✅ Export (Excel-friendly CSV) with current column selection + current filters
  const exportToExcel = async () => {
    if (exporting) return
    if (!visibleColumnDefs.length) {
      showToast("error", "Please select at least 1 column.")
      return
    }

    setExporting(true)
    try {
      const all = []
      let cursor = null
      let hasNext = true
      const params = buildParams()

      while (hasNext && all.length < EXPORT_MAX_ROWS) {
        const data = await apiListLeads({
          limit: EXPORT_PAGE_SIZE,
          cursor,
          params,
        })

        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.leads)
          ? data.leads
          : Array.isArray(data?.results)
          ? data.results
          : []

        all.push(...items)

        const page = data?.pageInfo || {}
        const nc = page?.nextCursor ?? data?.nextCursor ?? null
        const hm = page?.hasNextPage ?? data?.hasMore ?? false

        cursor = nc
        hasNext = !!hm && !!nc
        if (!!hm && !nc) hasNext = false
      }

      if (!all.length) {
        showToast("error", "No data to export.")
        return
      }

      const headers = visibleColumnDefs.map((c) => c.label)
      const rows = all.slice(0, EXPORT_MAX_ROWS).map((l) =>
        visibleColumnDefs.map((c) => (typeof c.exportValue === "function" ? c.exportValue(l) : ""))
      )

      const today = new Date()
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      const filename = `marketing-leads-${stamp}.csv`

      downloadCSV({ filename, headers, rows })
      showToast("success", `Exported ${Math.min(all.length, EXPORT_MAX_ROWS)} lead(s)`)
    } catch (e) {
      showToast("error", e?.message || "Export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={shell}>
      <AnimatePresence>
        <Toast open={toast.open} type={toast.type} message={toast.message} onClose={() => setToast({ open: false, type: "success", message: "" })} />
      </AnimatePresence>

      <AnimatePresence>
        {filtersOpen ? (
          <FiltersModal
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            draft={draft}
            setDraft={setDraft}
            onApply={applyDraft}
            onClearDraft={clearDraft}
            purchaseTypesState={purchaseTypesState}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {columnsOpen ? (
          <ColumnsModal open={columnsOpen} onClose={() => setColumnsOpen(false)} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate ? (
          <LeadUpsertModal
            open={showCreate}
            mode="create"
            onClose={() => setShowCreate(false)}
            onSaved={afterMutate}
            purchaseTypesState={purchaseTypesState}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!editLead ? (
          <LeadUpsertModal
            open={!!editLead}
            mode="edit"
            initial={editLead}
            onClose={() => setEditLead(null)}
            onSaved={afterMutate}
            purchaseTypesState={purchaseTypesState}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!noteLead ? <NoteModal open={!!noteLead} lead={noteLead} onClose={() => setNoteLead(null)} onAdded={afterMutate} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!followupLead ? <FollowUpModal open={!!followupLead} lead={followupLead} onClose={() => setFollowupLead(null)} onSaved={afterMutate} /> : null}
      </AnimatePresence>

      {selectedLeadId ? (
        <LeadDetails
          leadId={selectedLeadId}
          refreshTick={detailsRefreshTick}
          onBack={() => {
            setSelectedLeadId(null)
            fetchLeadsPage({ reset: true })
          }}
          onEdit={(lead) => setEditLead(lead)}
          onAddNote={(lead) => setNoteLead(lead)}
          onSetFollowUp={(lead) => setFollowupLead(lead)}
          onMarkContacted={(id) => doMarkContacted(id)}
          onConvert={(id) => doConvert(id)}
          showToast={(t, m) => showToast(t, m)}
        />
      ) : (
        <div className="p-4 sm:p-6 lg:p-8">
          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className={cn(card, "p-6")}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                      <FiUserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Marketing Leads</h1>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => fetchLeadsPage({ reset: true })} className={cn(btn, btnGhost)} title="Refresh">
                      <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                      Refresh
                    </button>

                    <button onClick={() => setColumnsOpen(true)} className={cn(btn, btnGhost)} title="Columns">
                      <FiColumns className="w-4 h-4" />
                      Columns
                      <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>{visibleColumns.length}</span>
                    </button>

                    <button onClick={exportToExcel} disabled={exporting} className={cn(btnExcel, "disabled:opacity-60")} title="Export to Excel">
                      {exporting ? (
                        <FiLoader className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-white/15">
                          <SiMicrosoftexcel className="w-4 h-4" />
                        </span>
                      )}
                      Export
                    </button>

                    <button onClick={() => setShowCreate(true)} className={cn(btn, btnPrimary)}>
                      <FiPlus className="w-4 h-4" />
                      Create lead
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60" />
                    Total: {kpis.total}
                  </span>
                  <span className={cn(chip, "bg-amber-50 text-amber-800 ring-amber-600/10")}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600/50" />
                    Due follow-up: {kpis.due}
                  </span>
                  <span className={cn(chip, "bg-sky-50 text-sky-700 ring-sky-600/10")}>
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600/50" />
                    Contacted: {kpis.contacted}
                  </span>
                  <span className={cn(chip, "bg-green-50 text-green-700 ring-green-600/10")}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600/50" />
                    Confirmed: {kpis.confirmed}
                  </span>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="w-full lg:w-2/3">
                    <div
                      className={cn(
                        "w-full h-11 rounded-2xl border border-gray-200 bg-white",
                        "px-3 flex items-center gap-2",
                        "focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-transparent"
                      )}
                    >
                      <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="search"
                        value={filters.q}
                        onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                        placeholder="Search by name, company, phone, email..."
                        className={cn(
                          "flex-1 min-w-[12rem] bg-transparent",
                          "text-sm text-gray-900 placeholder:text-gray-400",
                          "border-0 outline-none ring-0 shadow-none appearance-none",
                          "focus:outline-none focus:ring-0 focus:shadow-none"
                        )}
                      />

                      <button
                        type="button"
                        onClick={openFilters}
                        className={cn(
                          "relative shrink-0 h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                          "flex items-center justify-center focus:outline-none"
                        )}
                        aria-label="Open filters"
                        title="Filters"
                      >
                        <FiFilter className="w-4 h-4 text-gray-700" />
                        {activeFilterCount ? (
                          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {activeFilterCount}
                          </span>
                        ) : null}
                      </button>

                      {activeFilterCount ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className={cn(
                            "shrink-0 h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                            "flex items-center justify-center focus:outline-none"
                          )}
                          aria-label="Clear filters"
                          title="Clear filters"
                        >
                          <FiX className="w-4 h-4 text-gray-700" />
                        </button>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs text-gray-500">Use “Columns” to show more details in the list. Export uses the same columns.</p>
                  </div>

                  <div className="text-sm text-gray-600">
                    Showing <span className="font-bold text-gray-900">{leads.length}</span> lead(s)
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {error ? (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <FiAlertCircle className="w-5 h-5 mt-0.5" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
          ) : null}

          <div className={cn(card, "overflow-hidden")}>
            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                    {visibleColumnDefs.map((c) => (
                      <th key={c.key} className={cn("px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider", c.widthClass || "")}>
                        {c.label}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence>
                    {isLoading && leads.length === 0 ? (
                      [...Array(8)].map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="px-6 py-4">
                            <div className="h-4 w-10 bg-gray-200 rounded" />
                          </td>
                          {[...Array(Math.max(visibleColumnDefs.length + 1, 3))].map((__, i) => (
                            <td key={i} className="px-6 py-4">
                              <div className="h-4 w-full max-w-[14rem] bg-gray-200 rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : leads.length > 0 ? (
                      leads.map((l, index) => {
                        const busy = busyId === l._id
                        const converting = convertLoadingId === l._id

                        return (
                          <motion.tr key={l?._id || `lead-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={subtleHover}>
                            <td className="px-6 py-5 text-sm text-gray-500">{index + 1}</td>

                            {visibleColumnDefs.map((c) => (
                              <td key={c.key} className={cn("px-6 py-5 align-top", c.widthClass || "")}>
                                {c.render ? c.render(l, { showToast }) : <span className="text-sm text-gray-700">—</span>}
                              </td>
                            ))}

                            <td className="px-6 py-5">
                              <RowActionsMenu
                                lead={l}
                                busy={busy}
                                converting={converting}
                                onView={() => setSelectedLeadId(l._id)}
                                onEdit={(lead) => setEditLead(lead)}
                                onAddNote={(lead) => setNoteLead(lead)}
                                onSetFollowUp={(lead) => setFollowupLead(lead)}
                                onMarkContacted={(id) => doMarkContacted(id)}
                                onConvert={(id) => doConvert(id)}
                                showToast={showToast}
                              />
                            </td>
                          </motion.tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={visibleColumnDefs.length + 2} className="px-6 py-12 text-center text-gray-500">
                          No leads found.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center p-4 text-sm text-gray-600 border-t border-gray-100 bg-white">
              <span>
                Loaded: <span className="font-bold text-gray-900">{leads.length}</span>
              </span>

              <div className="flex items-center gap-2">
                <button onClick={() => fetchLeadsPage({ reset: true })} className={cn(btn, btnGhost, "px-4 py-2")}>
                  Refresh list
                </button>

                <button
                  onClick={() => fetchLeadsPage({ reset: false })}
                  disabled={disableLoadMore}
                  className={cn(btn, btnPrimary, "px-4 py-2 disabled:opacity-60")}
                  title={hasMore ? "Load next page" : "No more leads"}
                >
                  {isLoadingMore ? <FiLoader className="w-4 h-4 animate-spin" /> : null}
                  {hasMore ? "Load more" : "No more"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
