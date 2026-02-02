"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import LeadDetailsPage from "./LeadDetailsPage"
import {
  FiSearch,
  FiPlus,
  FiEye,
  FiX,
  FiEdit2,
  FiTrash2,
  FiRefreshCcw,
  FiCheck,
  FiAlertCircle,
  FiFilter,
  FiPhoneCall,
  FiCalendar,
  FiFileText,
  FiUserPlus,
  FiMoreVertical,
  FiLoader,
  FiAlertTriangle,
  FiColumns,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/* =========================
   UI TOKENS (PREMIUM)
========================= */
const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const subtleHover = "transition-colors hover:bg-gray-50/70"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white hover:bg-rose-50"
const iconBtn =
  "p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-transparent"

const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

/* ✅ Search Bar styles (MORE reduced height + standard sizing) */
const searchWrap =
  [
    "w-full rounded-2xl border border-gray-200 bg-white",
    "px-3 py-1 sm:px-3.5 sm:py-1", // tighter padding
    "min-h-[40px] sm:min-h-[42px]", // standard compact height
    "flex items-center gap-2 flex-wrap",
    "transition shadow-none",
    "focus-within:border-indigo-300",
    "focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
  ].join(" ")

const searchInput =
  [
    "flex-1 min-w-[10rem] bg-transparent",
    "text-sm text-gray-900 placeholder:text-gray-400",
    "border-0 outline-none ring-0 shadow-none appearance-none",
    "h-8 sm:h-9", // smaller input height
    "focus:outline-none focus:ring-0 focus:shadow-none",
  ].join(" ")

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function getAuthHeaders(extra = {}) {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

function formatDate(dt) {
  if (!dt) return "—"
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const a = parts[0]?.[0] || ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""
  return (a + b).toUpperCase()
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

  const label = s || "—"

  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {label}
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

  const label = s || "—"

  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const p = String(priority || "medium").toLowerCase()
  const cls =
    p === "high"
      ? "bg-rose-50 text-rose-700 ring-rose-600/10"
      : p === "low"
      ? "bg-gray-50 text-gray-700 ring-gray-200"
      : "bg-amber-50 text-amber-800 ring-amber-600/10"
  const label = p || "—"
  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {label}
    </span>
  )
}

/* =========================
   FILTER CHIP (smaller for compact search bar)
========================= */
function FilterChip({ label, value, onRemove }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
        "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10"
      )}
      title={`${label}: ${value}`}
    >
      <span className="truncate max-w-[160px]">
        <span className="opacity-70">{label}:</span> <span className="font-extrabold">{String(value)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="h-4.5 w-4.5 inline-flex items-center justify-center rounded-full hover:bg-indigo-600/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
        aria-label={`Remove ${label} filter`}
        title="Remove"
      >
        <FiX className="w-3 h-3" />
      </button>
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
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
            aria-label="Close"
          >
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
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
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

function ConfirmDeleteModal({ open, title, description, confirmText = "Delete", loading, onClose, onConfirm }) {
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => closeBtnRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <FiAlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
          <button
            ref={closeBtnRef}
            disabled={loading}
            onClick={onClose}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
            aria-label="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <button
            disabled={loading}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
          >
            Cancel
          </button>

          <button
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-semibold disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
          >
            {loading ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiTrash2 className="w-4 h-4" />}
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================
   API HELPERS
========================= */
const VIEW_KEY = "leads.list"

async function apiGetViewPref(signal) {
  const res = await fetch(`${API_BASE}/view-preferences/${encodeURIComponent(VIEW_KEY)}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  if (res.status === 304) return { notModified: true }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load view preferences")
  return { ...data, etag: res.headers.get("ETag") }
}

async function apiSaveViewPref(columns) {
  const res = await fetch(`${API_BASE}/view-preferences/${encodeURIComponent(VIEW_KEY)}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ columns }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to save view preferences")
  return { ...data, etag: res.headers.get("ETag") }
}

async function apiListPurchaseTypes(signal) {
  const res = await fetch(`${API_BASE}/purchase-types`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load purchase types")
  return Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : []
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
  return data?.purchaseType || data?.item || data
}

async function apiListLeads({ limit = 25, cursor, params = {}, fields, signal } = {}) {
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", String(cursor))
  if (fields && String(fields).trim()) qs.set("fields", String(fields).trim())

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

async function apiDeleteLead(id) {
  const res = await fetch(`${API_BASE}/leads/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    credentials: "include",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Delete failed")
  return data
}

/* =========================
   COLUMN PICKER MODAL
========================= */
function ColumnPickerModal({ open, onClose, allowed = [], selected = [], onSave }) {
  const [q, setQ] = useState("")
  const [local, setLocal] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setQ("")
    setErr("")
    setSaving(false)
    setLocal(Array.isArray(selected) && selected.length ? selected : allowed)
  }, [open, selected, allowed])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return allowed
    return allowed.filter((c) => c.toLowerCase().includes(s))
  }, [q, allowed])

  const isChecked = (c) => local.includes(c)

  const toggle = (c) => setLocal((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const selectAll = () => setLocal(allowed)

  const resetToDefault = async () => {
    setErr("")
    setSaving(true)
    try {
      await onSave?.([])
      onClose?.()
    } catch (e) {
      setErr(e?.message || "Failed to reset columns")
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    setErr("")
    setSaving(true)
    try {
      await onSave?.(local)
      onClose?.()
    } catch (e) {
      setErr(e?.message || "Failed to save columns")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Columns"
      subtitle="Choose what you want to see in the list (Actions stays)."
      icon={<FiColumns className="w-5 h-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className={cn(btn, btnGhost, "px-3 py-2 text-sm")} disabled={saving}>
              Select all
            </button>
            <button onClick={resetToDefault} className={cn(btn, btnGhost, "px-3 py-2 text-sm")} disabled={saving}>
              Reset to default
            </button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className={cn(btn, btnGhost)} disabled={saving}>
              Cancel
            </button>
            <button onClick={save} className={cn(btn, btnPrimary, "disabled:opacity-60")} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      }
    >
      {err ? <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{err}</div> : null}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <div className="w-full sm:max-w-md">
          <div
            className={cn(
              "w-full h-10 rounded-2xl border border-gray-200 bg-white px-3 flex items-center gap-2",
              "focus-within:border-indigo-300 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)] transition"
            )}
          >
            <FiSearch className="w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter columns..."
              className={cn("flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 border-0 outline-none")}
            />
          </div>
        </div>

        <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
          Selected: <span className="font-bold">{local.length}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((c) => (
          <label
            key={c}
            className={cn(
              "flex items-center gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition cursor-pointer"
            )}
          >
            <input type="checkbox" checked={isChecked(c)} onChange={() => toggle(c)} className="h-4 w-4" />
            <span className="text-sm font-semibold text-gray-900">{c}</span>
          </label>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-4">Actions column is always visible.</p>
    </ModalShell>
  )
}

/* =========================
   PURCHASE TYPE MODAL
========================= */
function AddPurchaseTypeModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setKey("")
    setErr("")
    setSaving(false)
  }, [open])

  const submit = async () => {
    setErr("")
    const n = String(name || "").trim()
    if (!n) return setErr("Name is required.")
    const k = String(key || "").trim()
    setSaving(true)
    try {
      const created = await apiCreatePurchaseType({ name: n, key: k || undefined })
      onCreated?.(created)
      onClose?.()
    } catch (e) {
      setErr(e?.message || "Failed to create purchase type")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Add Purchase Type"
      subtitle="This will be available in the Create Lead dropdown."
      icon={<FiPlus className="w-5 h-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)} disabled={saving}>
            Cancel
          </button>
          <button onClick={submit} className={cn(btn, btnPrimary, "disabled:opacity-60")} disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      }
    >
      {err ? <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{err}</div> : null}

      <div className="grid grid-cols-1 gap-4">
        <Field label="Name *" hint='Example: "Retail", "Wholesale", "Service"'>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Retail" />
        </Field>

        <Field label="Key (optional)" hint='If empty, it will auto-generate from the name. Example: "retail"'>
          <input value={key} onChange={(e) => setKey(e.target.value)} className={input} placeholder="retail" />
        </Field>
      </div>
    </ModalShell>
  )
}

/* =========================
   LEAD UPSERT MODAL
========================= */
function LeadUpsertModal({ open, onClose, mode = "create", initial, onSaved }) {
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

  const [purchaseTypes, setPurchaseTypes] = useState([])
  const [ptLoading, setPtLoading] = useState(false)
  const [ptError, setPtError] = useState("")
  const [addPtOpen, setAddPtOpen] = useState(false)
  const ptAbortRef = useRef(null)

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

  const fetchPurchaseTypes = async () => {
    if (ptAbortRef.current) ptAbortRef.current.abort()
    const controller = new AbortController()
    ptAbortRef.current = controller
    setPtLoading(true)
    setPtError("")
    try {
      const items = await apiListPurchaseTypes(controller.signal)
      setPurchaseTypes(Array.isArray(items) ? items : [])
    } catch (e) {
      if (e?.name === "AbortError") return
      setPtError(e?.message || "Failed to load purchase types")
      setPurchaseTypes([])
    } finally {
      setPtLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    fetchPurchaseTypes()
    return () => ptAbortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const onPurchaseTypeCreated = async (created) => {
    await fetchPurchaseTypes()
    const createdKey = created?.key || ""
    if (createdKey) setForm((p) => ({ ...p, purchaseType: createdKey }))
  }

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
      priority: (form.priority || "medium").toLowerCase(),
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

  const purchaseTypeOptions = useMemo(() => {
    const arr = Array.isArray(purchaseTypes) ? purchaseTypes : []
    return arr
      .slice()
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")))
      .map((pt) => ({
        key: String(pt?.key || "").trim(),
        name: String(pt?.name || pt?.key || "").trim(),
      }))
      .filter((x) => x.key && x.name)
  }, [purchaseTypes])

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title={mode === "edit" ? "Edit Lead" : "Create Lead"}
        subtitle="Contact + pipeline information"
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
          <Field label="Contact Name *">
            <input value={form.name} onChange={update("name")} className={input} placeholder="Person name" />
          </Field>

          <Field label="Company Name *">
            <input value={form.companyName} onChange={update("companyName")} className={input} placeholder="Company" />
          </Field>

          <Field label="Email">
            <input value={form.email} onChange={update("email")} className={input} placeholder="email@example.com" />
          </Field>

          <Field label="Phone">
            <input value={form.phone} onChange={update("phone")} className={input} placeholder="01XXXXXXXXX" />
          </Field>

          <Field label="Priority">
            <select value={form.priority} onChange={update("priority")} className={input}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </Field>

          <Field label="Purchase Type" hint="Choose a purchase type. You can add a new one if needed.">
            <div className="flex items-center gap-2">
              <select value={form.purchaseType} onChange={update("purchaseType")} className={cn(input, "flex-1")}>
                <option value="">{ptLoading ? "Loading..." : "Select purchase type"}</option>
                {purchaseTypeOptions.map((pt) => (
                  <option key={pt.key} value={pt.key}>
                    {pt.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setAddPtOpen(true)}
                className={cn(btn, btnGhost, "px-3 py-2")}
                disabled={ptLoading}
                title="Add purchase type"
              >
                <FiPlus className="w-4 h-4" />
                Add
              </button>
            </div>

            {ptError ? (
              <p className="text-xs text-rose-700 mt-2 flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4" />
                {ptError}
              </p>
            ) : null}
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

          <Field label="Pipeline Stage">
            <select value={form.pipelineStage} onChange={update("pipelineStage")} className={input}>
              <option value="new">new</option>
              <option value="qualified">qualified</option>
              <option value="proposal">proposal</option>
              <option value="negotiation">negotiation</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select>
          </Field>

          <Field label="Source">
            <input value={form.source} onChange={update("source")} className={input} placeholder="Facebook / referral / etc." />
          </Field>

          <Field label="Tags (comma separated)">
            <input value={form.tags} onChange={update("tags")} className={input} placeholder="vip, hot, retail, ..." />
          </Field>

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

          <div className="md:col-span-2">
            <Field label="Assigned To (optional User ID)">
              <input value={form.assignedTo} onChange={update("assignedTo")} className={input} placeholder="UserId (optional)" />
            </Field>
          </div>
        </div>
      </ModalShell>

      <AnimatePresence>
        {addPtOpen ? <AddPurchaseTypeModal open={addPtOpen} onClose={() => setAddPtOpen(false)} onCreated={onPurchaseTypeCreated} /> : null}
      </AnimatePresence>
    </>
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
      title="Add Note"
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
      title="Set Follow-up"
      subtitle={lead?.contact?.name ? `Lead: ${lead.contact.name}` : ""}
      icon={<FiCalendar className="w-5 h-5" />}
      maxWidthClass="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)} disabled={loading}>
            Cancel
          </button>
          <button onClick={submit} className={cn(btn, btnPrimary, "disabled:opacity-60")} disabled={loading}>
            {loading ? "Saving..." : "Save follow-up"}
          </button>
        </div>
      }
    >
      {error ? <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div> : null}

      <Field label="Next Follow-up Date & Time">
        <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className={input} />
      </Field>
    </ModalShell>
  )
}

/* =========================
   FILTERS MODAL
========================= */
function FiltersModal({ open, onClose, draft, setDraft, onApply, onClearDraft, activeSummary }) {
  const hasAnyDraft = useMemo(() => Object.values(draft || {}).some((v) => String(v || "").trim()), [draft])

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Narrow down the deals list"
      icon={<FiFilter className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClearDraft}
            disabled={!hasAnyDraft}
            className={cn(btn, btnGhost, "px-3 py-2 text-sm disabled:opacity-60")}
          >
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <div className={cn(card, "overflow-hidden")}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Choose filters</p>
                <p className="text-xs text-gray-500">Use the search bar above for name/company/phone/email.</p>
              </div>
              {hasAnyDraft ? (
                <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Selected</span>
              ) : (
                <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>None</span>
              )}
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Status">
                  <select
                    value={draft.status || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
                    className={input}
                  >
                    <option value="">All</option>
                    <option value="new">new</option>
                    <option value="contacted">contacted</option>
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                    <option value="lost">lost</option>
                  </select>
                </Field>

                <Field label="Pipeline Stage">
                  <select
                    value={draft.pipelineStage || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, pipelineStage: e.target.value }))}
                    className={input}
                  >
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
                  <select
                    value={draft.priority || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, priority: e.target.value }))}
                    className={input}
                  >
                    <option value="">All</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                </Field>

                <Field label="Purchase Type">
                  <input
                    value={draft.purchaseType || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, purchaseType: e.target.value }))}
                    className={input}
                    placeholder="retail / wholesale / service..."
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Source">
                  <input
                    value={draft.source || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, source: e.target.value }))}
                    className={input}
                    placeholder="Facebook / referral / etc."
                  />
                </Field>

                <Field label="Tag">
                  <input
                    value={draft.tag || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, tag: e.target.value }))}
                    className={input}
                    placeholder="vip / hot / ..."
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Next Follow-up From">
                  <input
                    type="date"
                    value={draft.nextFollowUpFrom || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, nextFollowUpFrom: e.target.value }))}
                    className={input}
                  />
                </Field>
                <Field label="Next Follow-up To">
                  <input
                    type="date"
                    value={draft.nextFollowUpTo || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, nextFollowUpTo: e.target.value }))}
                    className={input}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Last Contacted From">
                  <input
                    type="date"
                    value={draft.lastContactedFrom || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, lastContactedFrom: e.target.value }))}
                    className={input}
                  />
                </Field>
                <Field label="Last Contacted To">
                  <input
                    type="date"
                    value={draft.lastContactedTo || ""}
                    onChange={(e) => setDraft((p) => ({ ...p, lastContactedTo: e.target.value }))}
                    className={input}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className={cn(card, "overflow-hidden")}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
              <p className="text-sm font-bold text-gray-900">Preview</p>
              <p className="text-xs text-gray-500">These will be applied</p>
            </div>
            <div className="p-4">{activeSummary}</div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   ACTIONS MENU (ROW)
========================= */
function RowActionsMenu({
  lead,
  onView,
  onEdit,
  onAddNote,
  onSetFollowUp,
  onMarkContacted,
  onConvert,
  onDelete,
  busy,
  converting,
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const converted = !!lead?.convertedCustomer || !!lead?.convertedCustomerId || !!lead?.customerId || !!lead?.convertedCustomer?._id

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
    "w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-semibold text-gray-800 flex items-center gap-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20"

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
            className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-gray-100 bg-white shadow-xl p-2"
          >
            <button
              className={item}
              onClick={() => {
                setOpen(false)
                onEdit?.(lead)
              }}
            >
              <FiEdit2 className="w-4 h-4 text-gray-500" /> Edit
            </button>

            <button
              className={item}
              onClick={() => {
                setOpen(false)
                onAddNote?.(lead)
              }}
            >
              <FiFileText className="w-4 h-4 text-gray-500" /> Add note
            </button>

            <button
              className={item}
              onClick={() => {
                setOpen(false)
                onSetFollowUp?.(lead)
              }}
            >
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
              className={cn(item, "text-rose-700 hover:bg-rose-50")}
              onClick={() => {
                setOpen(false)
                onDelete?.(lead)
              }}
            >
              <FiTrash2 className="w-4 h-4" /> Delete
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/* =========================
   MAIN PAGE (ADMINLEAD)
========================= */
export default function AdminLeadsPage({ onConvertedToCustomer }) {
  const PAGE_SIZE = 25

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

  const EMPTY_DRAFT = useMemo(
    () => ({
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
    }),
    []
  )

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  const [showCreate, setShowCreate] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [noteLead, setNoteLead] = useState(null)
  const [followupLead, setFollowupLead] = useState(null)

  const [deleteModal, setDeleteModal] = useState({ open: false, leadId: "", leadName: "" })
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [convertLoadingId, setConvertLoadingId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = (type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }

  const abortRef = useRef(null)

  /* ===== Columns state (server-backed) ===== */
  const [colsOpen, setColsOpen] = useState(false)
  const [allowedCols, setAllowedCols] = useState([])
  const [selectedCols, setSelectedCols] = useState([])
  const prefAbortRef = useRef(null)

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters || {})
        .filter(([k, v]) => k !== "q" && String(v || "").trim())
        .length,
    [filters]
  )

  const filterLabelMap = useMemo(
    () => ({
      status: "Status",
      pipelineStage: "Stage",
      priority: "Priority",
      purchaseType: "Purchase",
      source: "Source",
      tag: "Tag",
      nextFollowUpFrom: "FU From",
      nextFollowUpTo: "FU To",
      lastContactedFrom: "LC From",
      lastContactedTo: "LC To",
    }),
    []
  )

  const activeFilterEntries = useMemo(() => {
    return Object.entries(filters || [])
      .filter(([k]) => k !== "q")
      .filter(([, v]) => String(v || "").trim())
      .map(([k, v]) => ({ key: k, label: filterLabelMap[k] || k, value: v }))
  }, [filters, filterLabelMap])

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
    return p
  }

  const fieldsParam = useMemo(() => {
    return Array.isArray(selectedCols) && selectedCols.length ? selectedCols.join(",") : ""
  }, [selectedCols])

  const fetchViewPrefs = async () => {
    if (prefAbortRef.current) prefAbortRef.current.abort()
    const controller = new AbortController()
    prefAbortRef.current = controller
    try {
      const data = await apiGetViewPref(controller.signal)
      if (data?.notModified) return
      const allowed = Array.isArray(data?.allowedColumns) ? data.allowedColumns : []
      const columns = Array.isArray(data?.columns) ? data.columns : []
      setAllowedCols(allowed)
      setSelectedCols(columns.length ? columns : allowed)
    } catch (e) {
      setAllowedCols([
        "leadNumber",
        "contact.name",
        "contact.companyName",
        "status",
        "pipelineStage",
        "priority",
        "purchaseType",
        "nextFollowUpAt",
        "lastContactedAt",
        "source",
        "createdAt",
        "updatedAt",
      ])
      setSelectedCols((prev) => (prev.length ? prev : ["leadNumber", "status", "pipelineStage", "priority", "nextFollowUpAt"]))
    }
  }

  const fetchLeadsPage = async ({ reset = false, forceFields } = {}) => {
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
        fields: typeof forceFields === "string" ? forceFields : fieldsParam,
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

  const saveViewPrefs = async (cols) => {
    const data = await apiSaveViewPref(cols)
    const allowed = Array.isArray(data?.allowedColumns) ? data.allowedColumns : allowedCols
    const columns = Array.isArray(data?.columns) ? data.columns : cols
    setAllowedCols(allowed)
    setSelectedCols(columns)
    showToast("success", cols?.length ? "Columns saved." : "Reset to default columns.")
    await fetchLeadsPage({ reset: true, forceFields: columns.join(",") })
  }

  useEffect(() => {
    fetchViewPrefs()
    fetchLeadsPage({ reset: true })
    return () => {
      abortRef.current?.abort?.()
      prefAbortRef.current?.abort?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchLeadsPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), fieldsParam])

  const openFilters = () => {
    setDraft({
      ...EMPTY_DRAFT,
      status: filters.status,
      pipelineStage: filters.pipelineStage,
      priority: filters.priority,
      purchaseType: filters.purchaseType,
      source: filters.source,
      tag: filters.tag,
      nextFollowUpFrom: filters.nextFollowUpFrom,
      nextFollowUpTo: filters.nextFollowUpTo,
      lastContactedFrom: filters.lastContactedFrom,
      lastContactedTo: filters.lastContactedTo,
    })
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

  const clearDraft = () => setDraft(EMPTY_DRAFT)

  const applyDraft = () => {
    setFilters((p) => ({ ...p, ...draft }))
    setFiltersOpen(false)
  }

  const removeOneFilter = (key) => setFilters((p) => ({ ...p, [key]: "" }))

  const requestDelete = (lead) => {
    setDeleteModal({
      open: true,
      leadId: lead?._id || "",
      leadName: lead?.contact?.name || "this lead",
    })
  }

  const closeDelete = () => {
    if (deleteLoading) return
    setDeleteModal((p) => ({ ...p, open: false }))
  }

  const confirmDelete = async () => {
    if (!deleteModal.leadId) return
    setDeleteLoading(true)
    try {
      await apiDeleteLead(deleteModal.leadId)
      showToast("success", "Lead deleted.")
      setDeleteModal((p) => ({ ...p, open: false }))
      if (selectedLeadId === deleteModal.leadId) setSelectedLeadId(null)
      await fetchLeadsPage({ reset: true })
      bumpDetailsRefresh()
    } catch (e) {
      showToast("error", e?.message || "Delete failed")
    } finally {
      setDeleteLoading(false)
    }
  }

  const doMarkContacted = async (leadId) => {
    if (!leadId) return
    setBusyId(leadId)
    try {
      await apiMarkContacted(leadId)
      showToast("success", "Lead marked as contacted.")
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

  const disableLoadMore = isLoadingMore || isLoading || !hasMore

  const afterMutate = async () => {
    await fetchLeadsPage({ reset: true })
    bumpDetailsRefresh()
  }

  /* ===== Dynamic table columns mapping ===== */
  const columnDefs = useMemo(() => {
    return {
      leadNumber: {
        label: "Lead",
        render: (l) => {
          const no = l?.leadNumber || "—"
          const name = l?.contact?.name || "Unnamed"
          const company = l?.contact?.companyName || "—"
          const converted =
            !!l?.convertedCustomer || !!l?.convertedCustomerId || !!l?.customerId || !!l?.convertedCustomer?._id
          return (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-700">{initials(name)}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{name}</p>
                  {converted ? (
                    <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Converted</span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  <span className="text-gray-400">No:</span>{" "}
                  <span className="font-semibold text-gray-700 font-mono">{no}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="text-gray-400">Company:</span>{" "}
                  <span className="font-semibold text-gray-700">{company}</span>
                </p>
              </div>
            </div>
          )
        },
      },

      "contact.name": {
        label: "Lead",
        render: (l) => {
          const name = l?.contact?.name || "Unnamed"
          const company = l?.contact?.companyName || "—"
          const source = l?.source || ""
          const converted =
            !!l?.convertedCustomer || !!l?.convertedCustomerId || !!l?.customerId || !!l?.convertedCustomer?._id
          return (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <span className="text-sm font-bold text-indigo-700">{initials(name)}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{name}</p>
                  {converted ? (
                    <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Converted</span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  <span className="text-gray-400">Company:</span>{" "}
                  <span className="font-semibold text-gray-700">{company}</span>
                  {source ? (
                    <>
                      <span className="mx-2 text-gray-300">•</span>
                      <span className="text-gray-400">Source:</span>{" "}
                      <span className="font-semibold text-gray-700">{source}</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          )
        },
      },

      status: { label: "Status", render: (l) => <LeadStatusBadge status={l?.status} /> },
      pipelineStage: { label: "Stage", render: (l) => <StageBadge stage={l?.pipelineStage} /> },
      priority: { label: "Priority", render: (l) => <PriorityBadge priority={l?.priority} /> },
      purchaseType: {
        label: "Purchase Type",
        render: (l) => <span className="text-sm font-semibold text-gray-900">{l?.purchaseType || "—"}</span>,
      },
      nextFollowUpAt: {
        label: "Follow-up",
        render: (l) => (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900">{formatDate(l?.nextFollowUpAt)}</span>
            <span className="text-xs text-gray-500">Last contacted: {formatDate(l?.lastContactedAt)}</span>
          </div>
        ),
      },
      lastContactedAt: {
        label: "Last Contacted",
        render: (l) => <span className="text-sm text-gray-700">{formatDate(l?.lastContactedAt)}</span>,
      },
      source: { label: "Source", render: (l) => <span className="text-sm text-gray-700">{l?.source || "—"}</span> },
      createdAt: { label: "Created", render: (l) => <span className="text-sm text-gray-700">{formatDate(l?.createdAt)}</span> },
      updatedAt: { label: "Updated", render: (l) => <span className="text-sm text-gray-700">{formatDate(l?.updatedAt)}</span> },
      "contact.companyName": {
        label: "Company",
        render: (l) => <span className="text-sm font-semibold text-gray-900">{l?.contact?.companyName || "—"}</span>,
      },
      "contact.phone": { label: "Phone", render: (l) => <span className="text-sm text-gray-700">{l?.contact?.phone || "—"}</span> },
      "contact.email": { label: "Email", render: (l) => <span className="text-sm text-gray-700 break-all">{l?.contact?.email || "—"}</span> },
      tags: {
        label: "Tags",
        render: (l) => {
          const tags = Array.isArray(l?.tags) ? l.tags : []
          if (!tags.length) return <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>No tags</span>
          return (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 3).map((t) => (
                <span key={String(t)} className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                  {String(t)}
                </span>
              ))}
              {tags.length > 3 ? (
                <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>+{tags.length - 3}</span>
              ) : null}
            </div>
          )
        },
      },
    }
  }, [])

  const visibleCols = useMemo(() => {
    const base =
      Array.isArray(selectedCols) && selectedCols.length
        ? selectedCols
        : ["leadNumber", "status", "pipelineStage", "priority", "nextFollowUpAt"]

    const unique = [...new Set(base)]
    const firstKey = unique.includes("leadNumber") ? "leadNumber" : unique.includes("contact.name") ? "contact.name" : unique[0]
    const ordered = firstKey ? [firstKey, ...unique.filter((c) => c !== firstKey)] : unique

    return ordered.filter((c) => !!columnDefs[c])
  }, [selectedCols, columnDefs])

  return (
    <div className={shell}>
      <AnimatePresence>
        <Toast
          open={toast.open}
          type={toast.type}
          message={toast.message}
          onClose={() => setToast({ open: false, type: "success", message: "" })}
        />
      </AnimatePresence>

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete lead?"
        description={`This will permanently delete "${deleteModal.leadName}". This cannot be undone.`}
        confirmText="Delete"
        loading={deleteLoading}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />

      <AnimatePresence>
        {filtersOpen ? (
          <FiltersModal
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            draft={draft}
            setDraft={setDraft}
            onApply={applyDraft}
            onClearDraft={clearDraft}
            activeSummary={
              <div className="text-sm text-gray-700">
                <p className="font-bold text-gray-900">Selected filters</p>
                <p className="text-xs text-gray-500 mt-1">Tap Apply to refresh the list.</p>

                <div className="mt-3">
                  {Object.entries(draft || {}).filter(([, v]) => String(v || "").trim()).length === 0 ? (
                    <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>No filters selected</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(draft || {})
                        .filter(([, v]) => String(v || "").trim())
                        .slice(0, 10)
                        .map(([k, v]) => (
                          <span key={k} className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                            <span className="text-gray-500">{k}:</span> <span className="font-bold">{String(v)}</span>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            }
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {colsOpen ? (
          <ColumnPickerModal
            open={colsOpen}
            onClose={() => setColsOpen(false)}
            allowed={allowedCols}
            selected={selectedCols}
            onSave={saveViewPrefs}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate ? (
          <LeadUpsertModal open={showCreate} mode="create" onClose={() => setShowCreate(false)} onSaved={afterMutate} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!editLead ? (
          <LeadUpsertModal open={!!editLead} mode="edit" initial={editLead} onClose={() => setEditLead(null)} onSaved={afterMutate} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!noteLead ? <NoteModal open={!!noteLead} lead={noteLead} onClose={() => setNoteLead(null)} onAdded={afterMutate} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!followupLead ? (
          <FollowUpModal open={!!followupLead} lead={followupLead} onClose={() => setFollowupLead(null)} onSaved={afterMutate} />
        ) : null}
      </AnimatePresence>

      {/* ✅ DETAILS PAGE (separate component) */}
      {selectedLeadId ? (
        <LeadDetailsPage
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
          onDelete={(lead) => requestDelete(lead)}
          showToast={showToast}
        />
      ) : (
        <div className="p-4 sm:p-6 lg:p-8">
          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className={cn(card, "p-5 sm:p-6")}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                      <FiUserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Deals</h1>
                      <p className="text-sm text-gray-500">Dynamic columns • Server-optimized list</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60" />
                      Loaded: {leads.length}
                    </span>

                    <button onClick={() => setColsOpen(true)} className={cn(btn, btnGhost)} title="Columns">
                      <FiColumns className="w-4 h-4" />
                      Columns
                    </button>

                    <button onClick={() => fetchLeadsPage({ reset: true })} className={cn(btn, btnGhost)} title="Refresh">
                      <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                      Refresh
                    </button>

                    <button onClick={() => setShowCreate(true)} className={cn(btn, btnPrimary)}>
                      <FiPlus className="w-4 h-4" />
                      Create
                    </button>
                  </div>
                </div>

                {/* ✅ SEARCH BAR (COMPACT) */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="w-full lg:w-2/3">
                    <div className={searchWrap}>
                      <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />

                      {activeFilterEntries.map((f) => (
                        <FilterChip key={f.key} label={f.label} value={f.value} onRemove={() => removeOneFilter(f.key)} />
                      ))}

                      <input
                        type="search"
                        value={filters.q}
                        onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                        placeholder="Search by name, company, phone, email..."
                        className={searchInput}
                      />

                      <button
                        type="button"
                        onClick={openFilters}
                        className={cn(
                          "relative shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                          "flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
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

                      {(activeFilterCount || filters.q) ? (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className={cn(
                            "shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                            "flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                          )}
                          aria-label="Clear"
                          title="Clear"
                        >
                          <FiX className="w-4 h-4 text-gray-700" />
                        </button>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs text-gray-500">
                      Filters show inside the search bar. Click any chip <span className="font-bold">×</span> to remove it.
                    </p>
                  </div>

                  <div className="text-sm text-gray-600">
                    Showing <span className="font-bold text-gray-900">{leads.length}</span> deal(s)
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

          {/* TABLE */}
          <div className={cn(card, "overflow-hidden")}>
            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">No.</th>

                    {visibleCols.map((c) => (
                      <th key={c} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {columnDefs[c]?.label || c}
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
                          {[...Array(Math.max(visibleCols.length, 2))].map((__, i) => (
                            <td key={i} className="px-6 py-4">
                              <div className="h-4 w-full max-w-[12rem] bg-gray-200 rounded" />
                            </td>
                          ))}
                          <td className="px-6 py-4">
                            <div className="h-9 w-24 bg-gray-200 rounded-xl ml-auto" />
                          </td>
                        </tr>
                      ))
                    ) : leads.length > 0 ? (
                      leads.map((l, index) => {
                        const busy = busyId === l._id
                        const converting = convertLoadingId === l._id
                        return (
                          <motion.tr
                            key={l?._id || `lead-${index}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={subtleHover}
                          >
                            <td className="px-6 py-5 text-sm text-gray-500">{index + 1}</td>

                            {visibleCols.map((c) => (
                              <td key={`${l?._id}-${c}`} className="px-6 py-5 align-top">
                                {columnDefs[c]?.render?.(l) ?? <span className="text-sm text-gray-700">—</span>}
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
                                onDelete={(lead) => requestDelete(lead)}
                              />
                            </td>
                          </motion.tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={visibleCols.length + 2} className="px-6 py-12 text-center text-gray-500">
                          No deals found.
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
                  title={hasMore ? "Load next page" : "No more deals"}
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
