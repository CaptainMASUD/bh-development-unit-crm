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
} from "react-icons/fi"

/**
 * Marketing Leads Page (JSX only)
 * - Uses your backend routes: /api/leads + /api/leads/:id/* actions
 * - No DELETE UI (backend restricts delete to Admin/SuperAdmin)
 * - Marketing-friendly: lead number visible in list + quick actions
 */

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

/* =========================
   TOAST
========================= */
function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-green-50 border-green-200 text-green-700"
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

            {footer ? (
              <div className="p-4 sm:p-5 border-t border-gray-100 bg-white sticky bottom-0 z-20">{footer}</div>
            ) : null}
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
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

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
   MODALS
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
    tags: "",
    website: "",
    industry: "",
    address: "",
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
      tags: Array.isArray(c?.tags) ? c.tags.join(", ") : "",
      website: c?.company?.website || "",
      industry: c?.company?.industry || "",
      address: c?.company?.address || "",
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
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      company: {
        website: form.website.trim() || "",
        industry: form.industry.trim() || "",
        address: form.address.trim() || "",
      },
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
      title={mode === "edit" ? "Edit Lead" : "Create Lead"}
      subtitle="Marketing capture + pipeline"
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
      {error ? (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      ) : null}

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
          <input value={form.source} onChange={update("source")} className={input} placeholder="Facebook / referral / walk-in..." />
        </Field>

        <Field label="Tags (comma separated)">
          <input value={form.tags} onChange={update("tags")} className={input} placeholder="vip, hot, retail, ..." />
        </Field>

        <div className="md:col-span-2">
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-bold text-gray-900 mb-3">Company Info</p>
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
      {error ? (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      ) : null}
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
      {error ? (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>
      ) : null}

      <Field label="Next Follow-up Date & Time">
        <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className={input} />
      </Field>
    </ModalShell>
  )
}

function FiltersModal({ open, onClose, draft, setDraft, onApply, onClearDraft }) {
  const hasAnyDraft = useMemo(() => Object.values(draft || {}).some((v) => String(v || "").trim()), [draft])

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Server-side filters (fast)"
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
        <div className="lg:col-span-12">
          <div className={cn(card, "overflow-hidden")}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
              <p className="text-sm font-bold text-gray-900">Filter Options</p>
              <p className="text-xs text-gray-500">Mapped to GET /api/leads query parameters</p>
            </div>

            <div className="p-4 space-y-4">
              <Field label="Text search (q)">
                <input
                  value={draft.q || ""}
                  onChange={(e) => setDraft((p) => ({ ...p, q: e.target.value }))}
                  className={input}
                  placeholder="Name / email / phone / company"
                />
              </Field>

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

              <p className="text-xs text-gray-500">
                Tip: use Follow-up filters daily to see who needs callbacks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   ROW ACTIONS MENU (Marketing)
   - No delete
========================= */
function RowActionsMenu({
  lead,
  onView,
  onEdit,
  onAddNote,
  onSetFollowUp,
  onMarkContacted,
  onConvert,
  busy,
  converting,
  showToast,
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  const converted =
    !!lead?.convertedCustomer ||
    !!lead?.convertedCustomerId ||
    !!lead?.customerId ||
    !!lead?.convertedCustomer?._id

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
              {busy ? (
                <FiLoader className="w-4 h-4 text-gray-500 animate-spin" />
              ) : (
                <FiPhoneCall className="w-4 h-4 text-gray-500" />
              )}
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
              {converting ? (
                <FiLoader className="w-4 h-4 text-indigo-600 animate-spin" />
              ) : (
                <FiUserPlus className="w-4 h-4 text-indigo-600" />
              )}
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
function LeadDetails({
  leadId,
  refreshTick,
  onBack,
  onEdit,
  onAddNote,
  onSetFollowUp,
  onMarkContacted,
  onConvert,
  showToast,
}) {
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
    !!lead?.convertedCustomer ||
    !!lead?.convertedCustomerId ||
    !!lead?.customerId ||
    !!lead?.convertedCustomer?._id

  const customerId =
    lead?.customerId ||
    lead?.convertedCustomerId ||
    lead?.convertedCustomer?._id ||
    (typeof lead?.convertedCustomer === "string" ? lead.convertedCustomer : "")

  const contact = lead?.contact || {}
  const company = lead?.company || {}

  return (
    <div className={cn(shell, "p-4 sm:p-6 lg:p-8")}>
      <div className="mb-6">
        <div className={cn(card, "p-5 sm:p-6")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={onBack}
                  className={cn(
                    "h-10 w-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                    "flex items-center justify-center"
                  )}
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
                    {converted ? (
                      <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Converted</span>
                    ) : null}
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
                  Add Note
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
                <p className="text-xs font-bold text-gray-500">Name</p>
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
            <p className="text-sm font-bold text-gray-900">Company</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Website</p>
                <p className="text-sm font-semibold text-gray-900 mt-1 break-all">{company?.website || "—"}</p>
              </div>
              <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Industry</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{company?.industry || "—"}</p>
              </div>
              <div className="sm:col-span-2 p-4 rounded-2xl border border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500">Address</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{company?.address || "—"}</p>
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
                <div className="p-4 rounded-2xl border border-gray-100 bg-gray-50/60 text-sm text-gray-600">
                  No notes yet.
                </div>
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
                        <li
                          key={n?._id || `${idx}-${text.slice(0, 10)}`}
                          className="p-4 rounded-2xl border border-gray-100 bg-white"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap flex-1">{text || "—"}</p>
                            <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200 shrink-0")}>
                              {formatDateTime(at)}
                            </span>
                          </div>
                          {by ? <p className="text-xs text-gray-500 mt-2">By: {by}</p> : null}
                        </li>
                      )
                    })}
                </ul>
              )}
            </div>
          </div>
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
            <p className="text-sm font-bold text-gray-900">Quick Actions</p>
            <p className="text-xs text-gray-500 mt-1">One-click operations</p>

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
   MAIN PAGE (MARKETING)
========================= */
export default function MarketingLeadsPage({ onConvertedToCustomer }) {
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
    source: "",
    tag: "",
    nextFollowUpFrom: "",
    nextFollowUpTo: "",
    lastContactedFrom: "",
    lastContactedTo: "",
  })

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draft, setDraft] = useState(filters)

  const [showCreate, setShowCreate] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [noteLead, setNoteLead] = useState(null)
  const [followupLead, setFollowupLead] = useState(null)

  const [convertLoadingId, setConvertLoadingId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = (type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }

  const abortRef = useRef(null)

  const activeFilterCount = useMemo(
    () => Object.values(filters || {}).filter((v) => String(v || "").trim()).length,
    [filters]
  )

  const buildParams = () => {
    const p = {}
    if (filters.status) p.status = filters.status
    if (filters.pipelineStage) p.pipelineStage = filters.pipelineStage
    if (filters.source) p.source = filters.source
    if (filters.tag) p.tag = filters.tag
    if (filters.q) p.q = filters.q
    if (filters.nextFollowUpFrom) p.nextFollowUpFrom = filters.nextFollowUpFrom
    if (filters.nextFollowUpTo) p.nextFollowUpTo = filters.nextFollowUpTo
    if (filters.lastContactedFrom) p.lastContactedFrom = filters.lastContactedFrom
    if (filters.lastContactedTo) p.lastContactedTo = filters.lastContactedTo
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

  const openFilters = () => {
    setDraft(filters)
    setFiltersOpen(true)
  }

  const clearFilters = () => {
    setFilters({
      q: "",
      status: "",
      pipelineStage: "",
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

  const afterMutate = async () => {
    await fetchLeadsPage({ reset: true })
    bumpDetailsRefresh()
  }

  const disableLoadMore = isLoadingMore || isLoading || !hasMore

  // Marketing KPI chips
  const kpis = useMemo(() => {
    const total = leads.length
    const due = leads.filter((l) => l?.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date()).length
    const contacted = leads.filter((l) => String(l?.status || "").toLowerCase() === "contacted").length
    const confirmed = leads.filter((l) => String(l?.status || "").toLowerCase() === "confirmed").length
    return { total, due, contacted, confirmed }
  }, [leads])

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

      <AnimatePresence>
        {filtersOpen ? (
          <FiltersModal
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            draft={draft}
            setDraft={setDraft}
            onApply={applyDraft}
            onClearDraft={clearDraft}
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
          <LeadUpsertModal
            open={!!editLead}
            mode="edit"
            initial={editLead}
            onClose={() => setEditLead(null)}
            onSaved={afterMutate}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!noteLead ? (
          <NoteModal open={!!noteLead} lead={noteLead} onClose={() => setNoteLead(null)} onAdded={afterMutate} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!!followupLead ? (
          <FollowUpModal
            open={!!followupLead}
            lead={followupLead}
            onClose={() => setFollowupLead(null)}
            onSaved={afterMutate}
          />
        ) : null}
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
          showToast={showToast}
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
                      <p className="text-sm text-gray-500">Capture • Follow-up • Convert (no delete access)</p>
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

                    <button onClick={() => fetchLeadsPage({ reset: true })} className={cn(btn, btnGhost)} title="Refresh">
                      <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                      Refresh
                    </button>

                    <button onClick={() => setShowCreate(true)} className={cn(btn, btnPrimary)}>
                      <FiPlus className="w-4 h-4" />
                      Create Lead
                    </button>
                  </div>
                </div>

                {/* SEARCH BAR */}
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="w-full lg:w-2/3">
                    <div
                      className={cn(
                        "w-full h-12 rounded-2xl border border-gray-200 bg-white",
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
                          "border-0 outline-none ring-0 shadow-none appearance-none"
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

                    <p className="mt-2 text-xs text-gray-500">
                      Lead number is visible in the list for quick sharing.
                    </p>
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

          {/* TABLE */}
          <div className={cn(card, "overflow-hidden")}>
            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Lead (Lead No.)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Stage</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Follow-up
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence>
                    {isLoading && leads.length === 0 ? (
                      [...Array(8)].map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          {[...Array(6)].map((__, i) => (
                            <td key={i} className="px-6 py-4">
                              <div className="h-4 w-full max-w-[12rem] bg-gray-200 rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : leads.length > 0 ? (
                      leads.map((l, index) => {
                        const busy = busyId === l._id
                        const converting = convertLoadingId === l._id

                        const name = l?.contact?.name || "Unnamed"
                        const company = l?.contact?.companyName || "—"
                        const source = l?.source || ""
                        const leadNumber = l?.leadNumber || ""

                        const converted =
                          !!l?.convertedCustomer ||
                          !!l?.convertedCustomerId ||
                          !!l?.customerId ||
                          !!l?.convertedCustomer?._id

                        return (
                          <motion.tr
                            key={l?._id || `lead-${index}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={subtleHover}
                          >
                            <td className="px-6 py-5 text-sm text-gray-500">{index + 1}</td>

                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                  <span className="text-sm font-bold text-indigo-700">{initials(name)}</span>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">{name}</p>
                                    {converted ? (
                                      <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                                        Converted
                                      </span>
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

                                  <div className="mt-1 flex items-center gap-2">
                                    {leadNumber ? (
                                      <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                                        <span className="text-gray-500">Lead No:</span>{" "}
                                        <span className="font-bold font-mono">{leadNumber}</span>
                                        <button
                                          className="ml-1 p-1 rounded-lg hover:bg-black/5"
                                          title="Copy"
                                          onClick={() => {
                                            copyToClipboard(leadNumber)
                                            showToast("success", "Lead number copied.")
                                          }}
                                        >
                                          <FiCopy className="w-3.5 h-3.5" />
                                        </button>
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-5">
                              <LeadStatusBadge status={l?.status} />
                            </td>

                            <td className="px-6 py-5">
                              <StageBadge stage={l?.pipelineStage} />
                            </td>

                            <td className="px-6 py-5 text-sm text-gray-700">
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-900">{formatDate(l?.nextFollowUpAt)}</span>
                                <span className="text-xs text-gray-500">Last contacted: {formatDate(l?.lastContactedAt)}</span>
                              </div>
                            </td>

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
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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

          <div className="mt-4 text-xs text-gray-500">
            Note: Delete is not available for Marketing (backend requires Admin/SuperAdmin for DELETE /api/leads/:id).
          </div>
        </div>
      )}
    </div>
  )
}
