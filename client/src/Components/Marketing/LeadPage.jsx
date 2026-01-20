"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FiUsers,
  FiSearch,
  FiDatabase,
  FiPlus,
  FiEye,
  FiX,
  FiMail,
  FiPhone,
  FiUser,
  FiMapPin,
  FiFileText,
  FiArrowLeft,
  FiAlertCircle,
  FiCheck,
  FiCalendar,
  FiClock,
  FiRefreshCcw,
  FiCopy,
  FiEdit2,
  FiSave,
  FiTag,
  FiStar,
} from "react-icons/fi"

/**
 * ✅ Marketing Team Lead Page (ONLY what marketing can do)
 *
 * Backend routes:
 * - POST   /api/leads
 * - GET    /api/leads
 * - GET    /api/leads/:id
 * - PATCH  /api/leads/:id
 * - POST   /api/leads/:id/notes
 * - PATCH  /api/leads/:id/followup
 * - GET    /api/leads/:id/timeline
 *
 * Marketing limitations (backend):
 * - Can only access leads assigned to them
 * - Cannot reassign / delete / convert
 */

const API_BASE = `${import.meta?.env?.VITE_API_URL || "http://localhost:4000"}/api`
const LEADS_API = `${API_BASE}/leads`

/* ---------- styles ---------- */
const premiumCard =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-14px_rgba(0,0,0,0.35)] transition-all"

const softPanel = "rounded-2xl border border-gray-100 bg-gray-50/60"

const inputBase =
  "w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"

const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition"

const btnSm = "px-3.5 py-2 text-sm"

const btnPrimary =
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.55)]"

const btnPrimarySoft =
  "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"

const btnDark = "bg-gray-900 text-white hover:bg-black"

const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"

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

function normalizeListResponse(data) {
  if (Array.isArray(data?.leads)) return { items: data.leads, count: Number(data.count ?? data.leads.length) }
  if (Array.isArray(data)) return { items: data, count: data.length }
  return { items: [], count: 0 }
}

function isValidEmail(email) {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

/** Highlight matched search term using <mark> (no gradients) */
function Highlight({ text, query }) {
  const t = String(text ?? "")
  const q = String(query ?? "").trim().toLowerCase()
  if (!q) return <>{t || "—"}</>
  const idx = t.toLowerCase().indexOf(q)
  if (idx < 0) return <>{t || "—"}</>

  const before = t.slice(0, idx)
  const mid = t.slice(idx, idx + q.length)
  const after = t.slice(idx + q.length)

  return (
    <>
      {before}
      <mark className="rounded-md px-1 bg-amber-100 text-gray-900 font-extrabold">{mid}</mark>
      {after}
    </>
  )
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase()
  const cls =
    s === "confirmed"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
      : s === "lost"
      ? "bg-rose-50 text-rose-700 ring-rose-600/10"
      : s === "pending"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : s === "contacted"
      ? "bg-sky-50 text-sky-700 ring-sky-600/10"
      : "bg-gray-100 text-gray-700 ring-gray-600/10"

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1", cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || "—"}
    </span>
  )
}

function Field({ label, icon, hint, error, children }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2">
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">{label}</label>
        {hint ? <span className="text-xs text-gray-500 mb-1.5">{hint}</span> : null}
      </div>

      <div className="relative">
        {icon ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600">{icon}</span> : null}
        <div className={icon ? "pl-10" : ""}>
          {children}
          {error ? (
            <div className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
              <FiAlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ---------- Toast ---------- */
function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-indigo-50 border-indigo-200 text-indigo-800"
  const Icon = type === "error" ? FiAlertCircle : FiCheck

  return (
    <div className="fixed top-4 right-4 z-[60] max-w-sm w-[92vw] sm:w-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={cn("rounded-2xl border p-3 shadow-lg", styles)}
      >
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5" />
          <p className="text-sm font-semibold flex-1">{message}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5" aria-label="Close toast">
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/* =========================
   CREATE LEAD MODAL (Marketing)
   ✅ FIXED: Separate Company vs Contact Person (no "together")
========================= */
function CreateLeadModal({ open, onClose, onCreated }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")
  const [toast, setToast] = useState({ open: false, type: "success", message: "" })

  const [form, setForm] = useState({
    companyName: "",
    contactPersonName: "",
    email: "",
    phone: "",
    source: "",
  })

  const [errors, setErrors] = useState({
    companyName: "",
    contactPersonName: "",
    email: "",
  })

  const firstInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const t = setTimeout(() => firstInputRef.current?.focus(), 120)

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", onKey)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    setServerError("")
    setErrors({ companyName: "", contactPersonName: "", email: "" })
  }, [open])

  const update = (key) => (e) => {
    const v = e.target.value
    setForm((p) => ({ ...p, [key]: v }))
    setErrors((p) => ({ ...p, [key]: "" }))
    setServerError("")
  }

  const validate = () => {
    const next = { companyName: "", contactPersonName: "", email: "" }
    if (!form.companyName.trim()) next.companyName = "Company name is required."
    if (!form.contactPersonName.trim()) next.contactPersonName = "Contact person name is required."
    if (form.email.trim() && !isValidEmail(form.email.trim())) next.email = "Please enter a valid email."
    setErrors(next)
    return !Object.values(next).some(Boolean)
  }

  const reset = () => {
    setForm({ companyName: "", contactPersonName: "", email: "", phone: "", source: "" })
    setErrors({ companyName: "", contactPersonName: "", email: "" })
    setServerError("")
  }

  const submit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    setServerError("")
    try {
      const payload = {
        contact: {
          name: form.contactPersonName.trim(), // ✅ Contact Person
          email: form.email.trim() ? form.email.trim().toLowerCase() : "",
          phone: form.phone.trim() || "",
          companyName: form.companyName.trim(), // ✅ Company
        },
        source: form.source.trim() || "",
      }

      const res = await fetch(LEADS_API, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to create lead")

      setToast({ open: true, type: "success", message: "Lead created." })
      onCreated?.(data?.lead || data)

      setTimeout(() => {
        reset()
        onClose?.()
      }, 350)
    } catch (e) {
      const msg = e?.message || "Create failed"
      setServerError(msg)
      setToast({ open: true, type: "error", message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <AnimatePresence>
        <Toast
          open={toast.open}
          type={toast.type}
          message={toast.message}
          onClose={() => setToast({ open: false, type: "success", message: "" })}
        />
      </AnimatePresence>

      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => !isSubmitting && onClose?.()}
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <FiPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Add New Lead</h2>
                  <p className="text-sm text-gray-600">Create a lead assigned to you</p>
                </div>
              </div>

              <button
                onClick={() => !isSubmitting && onClose?.()}
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition disabled:opacity-60"
                aria-label="Close"
                disabled={isSubmitting}
              >
                <FiX className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-6 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">
              {serverError ? (
                <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 mt-0.5" />
                  <span className="font-semibold">{serverError}</span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Company Name *" icon={<FiDatabase className="w-4 h-4" />} error={errors.companyName}>
                  <input
                    ref={firstInputRef}
                    value={form.companyName}
                    onChange={update("companyName")}
                    className={inputBase}
                    placeholder="Company name"
                  />
                </Field>

                <Field label="Contact Person Name *" icon={<FiUser className="w-4 h-4" />} error={errors.contactPersonName}>
                  <input
                    value={form.contactPersonName}
                    onChange={update("contactPersonName")}
                    className={inputBase}
                    placeholder="Contact person name"
                  />
                </Field>

                <Field label="Phone" icon={<FiPhone className="w-4 h-4" />} hint="optional">
                  <input value={form.phone} onChange={update("phone")} className={inputBase} placeholder="01XXXXXXXXX" />
                </Field>

                <Field label="Email" icon={<FiMail className="w-4 h-4" />} hint="optional" error={errors.email}>
                  <input value={form.email} onChange={update("email")} className={inputBase} placeholder="email@example.com" />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Source" icon={<FiMapPin className="w-4 h-4" />} hint="optional">
                    <input
                      value={form.source}
                      onChange={update("source")}
                      className={inputBase}
                      placeholder="Facebook, Referral, Website, etc."
                    />
                  </Field>
                </div>
              </div>

              {/* prettier “preview tags” */}
              <div className="mt-5">
                <p className="text-xs font-extrabold text-gray-600 mb-2">Preview</p>
                <div className="flex flex-wrap gap-2">
                  <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-600/10")}>
                    <FiDatabase className="w-4 h-4" />
                    Company: <span className="font-extrabold">{form.companyName.trim() || "—"}</span>
                  </span>
                  <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                    <FiUser className="w-4 h-4" />
                    Contact: <span className="font-extrabold">{form.contactPersonName.trim() || "—"}</span>
                  </span>
                  <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-600/10")}>
                    <FiPhone className="w-4 h-4" />
                    {form.phone.trim() || "No phone"}
                  </span>
                  <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-600/10")}>
                    <FiMail className="w-4 h-4" />
                    {form.email.trim() || "No email"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <button
                  onClick={reset}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
                >
                  Reset
                </button>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => !isSubmitting && onClose?.()}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button onClick={submit} disabled={isSubmitting} className={cn(btn, btnPrimary, "disabled:opacity-60")}>
                    {isSubmitting ? "Creating..." : "Create Lead"}
                  </button>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Tip: Press <span className="font-semibold">Esc</span> to close.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* =========================
   DETAILS PAGE (UPDATED UI)
   ✅ Clear separation: Company vs Contact
   ✅ Better “Customer Details” with tags + marks (no gradients)
========================= */

function TopTabs({ value, onChange }) {
  const TabBtn = ({ active, icon, label, val }) => (
    <button
      onClick={() => onChange(val)}
      className={cn(btn, btnSm, "rounded-xl font-extrabold", active ? btnPrimary : btnGhost, active ? "border border-indigo-600" : "")}
      type="button"
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TabBtn active={value === "details"} val="details" icon={<FiUser className="w-4 h-4" />} label="Details" />
      <TabBtn active={value === "followup"} val="followup" icon={<FiCalendar className="w-4 h-4" />} label="Follow-up" />
      <TabBtn active={value === "notes"} val="notes" icon={<FiFileText className="w-4 h-4" />} label="Notes" />
    </div>
  )
}

function extractTagsFromText(text) {
  const t = String(text || "")
  const matches = t.match(/#[a-z0-9_]+/gi) || []
  const uniq = Array.from(new Set(matches.map((x) => x.toLowerCase())))
  return uniq.slice(0, 6)
}

function isImportantNote(text) {
  const t = String(text || "").toLowerCase()
  return t.includes("urgent") || t.includes("important") || t.includes("asap") || t.includes("!") || t.includes("follow up")
}

function NotesShowcase({ leadId, notes = [], readableDate }) {
  const storageKey = `lead_notes_starred_${leadId || "x"}`
  const [starred, setStarred] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      const arr = JSON.parse(raw || "[]")
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  })

  const persist = (nextSet) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(nextSet)))
    } catch {
      // ignore
    }
  }

  const toggleStar = (id) => {
    if (!id) return
    setStarred((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      persist(next)
      return next
    })
  }

  const list = Array.isArray(notes) ? notes.slice().reverse() : []
  const top = list.slice(0, 8)

  return (
    <div className={cn(premiumCard, "p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-gray-900">Recent Notes</h3>
          <p className="text-sm text-gray-500 mt-1">Hashtags become tags (example: #meeting #price). Star important notes.</p>
        </div>

        <div className={cn("px-3 py-2 rounded-xl text-xs font-extrabold", "bg-gray-50 text-gray-700 border border-gray-200")}>
          {notes?.length || 0} total
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {top.length > 0 ? (
          top.map((n, idx) => {
            const id = n?._id || `${idx}`
            const tags = extractTagsFromText(n?.note)
            const important = isImportantNote(n?.note)
            const isStar = starred.has(id)

            return (
              <div key={id} className={cn(softPanel, "p-4")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-white border border-gray-200 text-indigo-600">
                        <FiFileText className="w-4 h-4" />
                      </span>

                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-gray-900 truncate">{n?.note || "—"}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <FiClock className="w-3.5 h-3.5" />
                            {n?.createdAt ? readableDate(n.createdAt) : "—"}
                          </span>

                          {important ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              <FiAlertCircle className="w-3.5 h-3.5" />
                              Important
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tg) => (
                          <span
                            key={tg}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200"
                          >
                            <FiTag className="w-3.5 h-3.5" />
                            {tg.replace("#", "")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                        <FiTag className="w-4 h-4" />
                        No tags
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => toggleStar(id)}
                    className={cn(
                      "shrink-0 rounded-xl border px-3 py-2 text-xs font-extrabold transition",
                      isStar ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    )}
                    title={isStar ? "Unstar" : "Star"}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      <FiStar className="w-4 h-4" />
                      {isStar ? "Starred" : "Star"}
                    </span>
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className={cn(softPanel, "p-4 text-sm text-gray-500")}>No notes yet.</div>
        )}

        {list.length > 8 ? <p className="text-xs text-gray-500">Showing latest 8 notes.</p> : null}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, onCopy }) {
  return (
    <div className={cn(softPanel, "p-4 flex items-start justify-between gap-3")}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 text-indigo-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-sm font-extrabold text-gray-900 truncate">{value || "—"}</p>
        </div>
      </div>

      {onCopy ? (
        <button
          onClick={onCopy}
          className={cn(btn, btnGhost, btnSm, "font-extrabold shrink-0")}
          type="button"
          title="Copy"
        >
          <FiCopy className="w-4 h-4" />
          Copy
        </button>
      ) : null}
    </div>
  )
}

function LeadDetails({ leadId, onBack, onChanged }) {
  const [lead, setLead] = useState(null)
  const [activities, setActivities] = useState([])

  const [isLoading, setIsLoading] = useState(false)
  const [isTimelineLoading, setIsTimelineLoading] = useState(false)

  const [error, setError] = useState("")
  const [toast, setToast] = useState({ open: false, type: "success", message: "" })

  const [tab, setTab] = useState("details")

  // Details edit mode
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)

  // Follow-up edit mode
  const [isEditingFollowup, setIsEditingFollowup] = useState(false)
  const [savingFollowup, setSavingFollowup] = useState(false)

  // notes
  const [note, setNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)

  // follow-up form
  const [followup, setFollowup] = useState({ lastContactedAt: "", nextFollowUpAt: "" })

  // timeline pagination
  const [timelineCursor, setTimelineCursor] = useState(null)
  const [timelineHasMore, setTimelineHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const timelineLimit = 20

  // lead form (✅ separate companyName vs contactPersonName)
  const [form, setForm] = useState({
    companyName: "",
    contactPersonName: "",
    email: "",
    phone: "",
    source: "",
    status: "new",
  })

  const showToast = useCallback((type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }, [])

  const readableDate = (d) => {
    if (!d) return "—"
    try {
      return new Date(d).toLocaleString()
    } catch {
      return "—"
    }
  }

  const isoToLocalInput = (d) => {
    if (!d) return ""
    try {
      return new Date(d).toISOString().slice(0, 16)
    } catch {
      return ""
    }
  }

  const localInputToISOOrNull = (val) => {
    if (!val) return null
    const dt = new Date(val)
    if (Number.isNaN(dt.getTime())) return null
    return dt.toISOString()
  }

  const loadLead = useCallback(async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(`${LEADS_API}/${leadId}`, { headers: getAuthHeaders(), credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to load lead")

      const l = data?.lead || data
      setLead(l || null)

      setForm({
        companyName: l?.contact?.companyName || "",
        contactPersonName: l?.contact?.name || "",
        email: l?.contact?.email || "",
        phone: l?.contact?.phone || "",
        source: l?.source || "",
        status: l?.status || "new",
      })

      setFollowup({
        lastContactedAt: isoToLocalInput(l?.lastContactedAt),
        nextFollowUpAt: isoToLocalInput(l?.nextFollowUpAt),
      })

      // reset edit modes after reload
      setIsEditingDetails(false)
      setIsEditingFollowup(false)
    } catch (e) {
      setLead(null)
      setError(e?.message || "Failed to load lead.")
    } finally {
      setIsLoading(false)
    }
  }, [leadId])

  const loadTimelineFirst = useCallback(async () => {
    setIsTimelineLoading(true)
    try {
      const res = await fetch(`${LEADS_API}/${leadId}/timeline?limit=${timelineLimit}`, {
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActivities([])
        setTimelineCursor(null)
        setTimelineHasMore(false)
        return
      }
      const rows = Array.isArray(data?.activities) ? data.activities : []
      setActivities(rows)
      setTimelineCursor(data?.nextCursor || null)
      setTimelineHasMore(!!data?.hasMore)
    } catch {
      setActivities([])
      setTimelineCursor(null)
      setTimelineHasMore(false)
    } finally {
      setIsTimelineLoading(false)
    }
  }, [leadId])

  const loadMoreTimeline = async () => {
    if (!timelineHasMore || !timelineCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(
        `${LEADS_API}/${leadId}/timeline?limit=${timelineLimit}&cursor=${encodeURIComponent(timelineCursor)}`,
        { headers: getAuthHeaders(), credentials: "include" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return
      const rows = Array.isArray(data?.activities) ? data.activities : []
      setActivities((prev) => [...prev, ...rows])
      setTimelineCursor(data?.nextCursor || null)
      setTimelineHasMore(!!data?.hasMore)
    } catch {
      // ignore
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!leadId) return
    loadLead()
    loadTimelineFirst()
  }, [leadId, loadLead, loadTimelineFirst])

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }))

  const isAccessDenied =
    !!error && (String(error).toLowerCase().includes("cannot access") || String(error).toLowerCase().includes("cannot update"))

  const validateLead = () => {
    if (!form.companyName.trim()) return "Company name is required."
    if (!form.contactPersonName.trim()) return "Contact person name is required."
    if (form.email.trim() && !isValidEmail(form.email.trim())) return "Please enter a valid email."
    return ""
  }

  const saveDetails = async () => {
    const v = validateLead()
    if (v) {
      setError(v)
      showToast("error", v)
      return
    }

    setSavingDetails(true)
    setError("")
    try {
      const body = {
        contact: {
          name: form.contactPersonName.trim(), // ✅ contact
          email: form.email.trim() ? form.email.trim().toLowerCase() : "",
          phone: form.phone.trim() || "",
          companyName: form.companyName.trim(), // ✅ company
        },
        source: form.source.trim() || "",
        status: form.status,
      }

      const res = await fetch(`${LEADS_API}/${leadId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update lead")

      showToast("success", "Lead updated.")
      setIsEditingDetails(false)
      await loadLead()
      onChanged?.()
    } catch (e) {
      const msg = e?.message || "Update failed."
      setError(msg)
      showToast("error", msg)
    } finally {
      setSavingDetails(false)
    }
  }

  const saveFollowup = async () => {
    setSavingFollowup(true)
    setError("")
    try {
      const payload = {
        lastContactedAt: localInputToISOOrNull(followup.lastContactedAt),
        nextFollowUpAt: localInputToISOOrNull(followup.nextFollowUpAt),
      }

      const res = await fetch(`${LEADS_API}/${leadId}/followup`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update follow-up")

      showToast("success", "Follow-up saved.")
      setIsEditingFollowup(false)
      await loadLead()
      onChanged?.()
    } catch (e) {
      const msg = e?.message || "Follow-up update failed."
      setError(msg)
      showToast("error", msg)
    } finally {
      setSavingFollowup(false)
    }
  }

  const addNote = async () => {
    if (!note.trim()) return
    setAddingNote(true)
    setError("")
    try {
      const res = await fetch(`${LEADS_API}/${leadId}/notes`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ note: note.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to add note")

      setNote("")
      showToast("success", "Note added.")
      await loadLead()
      await loadTimelineFirst()
      onChanged?.()
    } catch (e) {
      const msg = e?.message || "Add note failed."
      setError(msg)
      showToast("error", msg)
    } finally {
      setAddingNote(false)
    }
  }

  const setNow = () => {
    const now = new Date()
    const next = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    setFollowup((p) => ({
      lastContactedAt: p.lastContactedAt || now.toISOString().slice(0, 16),
      nextFollowUpAt: p.nextFollowUpAt || next.toISOString().slice(0, 16),
    }))
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ""))
      showToast("success", "Copied.")
    } catch {
      showToast("error", "Copy failed.")
    }
  }

  const refreshAll = () => {
    loadLead()
    loadTimelineFirst()
  }

  const c = lead?.contact || {}
  const companyTitle = c?.companyName || "—"
  const contactTitle = c?.name || "—"
  const email = c?.email || ""
  const phone = c?.phone || ""

  return (
    <div className="min-h-screen bg-gray-50/50">
      <AnimatePresence>
        <Toast
          open={toast.open}
          type={toast.type}
          message={toast.message}
          onClose={() => setToast({ open: false, type: "success", message: "" })}
        />
      </AnimatePresence>

      {/* HEADER CARD (premium / no gradient) */}
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className={cn(premiumCard, "p-5 sm:p-6")}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 text-indigo-600 flex items-center justify-center shadow-sm">
                    <FiUser className="w-7 h-7" />
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500">Lead Profile</p>

                  {/* ✅ Separate company + contact (no “together”) */}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-600/10")}>
                      <FiDatabase className="w-4 h-4" />
                      Company: <span className="font-extrabold text-gray-900">{isLoading ? "Loading..." : companyTitle}</span>
                    </span>

                    <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                      <FiUser className="w-4 h-4" />
                      Contact: <span className="font-extrabold">{contactTitle}</span>
                    </span>

                    <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-600/10")}>
                      <FiDatabase className="w-4 h-4" />
                      {lead?.leadNumber || "LD—"}
                    </span>

                    <StatusBadge status={form.status || lead?.status} />

                    {lead?.source ? (
                      <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-600/10")}>
                        <FiMapPin className="w-4 h-4" />
                        {lead.source}
                      </span>
                    ) : null}

                    {lead?.assignedTo?.name ? (
                      <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                        <FiUser className="w-4 h-4" />
                        Assigned: {lead.assignedTo.name}
                      </span>
                    ) : null}
                  </div>

                  {/* small contact pills */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold border",
                        "bg-white border-gray-200 text-gray-700"
                      )}
                    >
                      <FiMail className="w-4 h-4 text-indigo-600" />
                      {email ? email : "No email"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold border",
                        "bg-white border-gray-200 text-gray-700"
                      )}
                    >
                      <FiPhone className="w-4 h-4 text-indigo-600" />
                      {phone ? phone : "No phone"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-end">
                <button onClick={onBack} className={cn(btn, btnGhost, btnSm, "font-extrabold")}>
                  <FiArrowLeft />
                  Back
                </button>
                <button onClick={refreshAll} className={cn(btn, btnGhost, btnSm, "font-extrabold")} title="Refresh">
                  <FiRefreshCcw className={cn("w-4 h-4", isLoading || isTimelineLoading ? "animate-spin" : "")} />
                  Refresh
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <TopTabs value={tab} onChange={setTab} />
              <div className="text-xs font-semibold text-gray-500">
                {tab === "details"
                  ? isEditingDetails
                    ? "Editing enabled"
                    : "Read-only"
                  : tab === "followup"
                  ? isEditingFollowup
                    ? "Editing enabled"
                    : "Read-only"
                  : "Notes & activity"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className={cn(premiumCard, "p-6 animate-pulse")}>
            <div className="h-5 w-64 bg-gray-200 rounded mb-4" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="h-64 bg-gray-200 rounded-2xl" />
              <div className="h-64 bg-gray-200 rounded-2xl lg:col-span-2" />
            </div>
          </div>
        ) : !lead ? (
          <div className={cn(premiumCard, "p-10 text-center text-gray-500")}>No lead data found.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* LEFT / MAIN */}
            <div className="lg:col-span-2 space-y-4">
              {/* DETAILS TAB */}
              {tab === "details" ? (
                <div className={cn(premiumCard, "p-5 sm:p-6")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">Customer Details</h3>
                      <p className="text-sm text-gray-500 mt-1">Company and Contact are separate fields. Click Edit to update.</p>
                    </div>

                    <button
                      onClick={() => {
                        if (!isEditingDetails) return setIsEditingDetails(true)
                        setIsEditingDetails(false)
                        loadLead()
                      }}
                      disabled={isAccessDenied || savingDetails}
                      className={cn(btn, isEditingDetails ? btnGhost : btnPrimary, btnSm, "font-extrabold disabled:opacity-60")}
                      type="button"
                    >
                      <FiEdit2 />
                      {isEditingDetails ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  {/* Nice “tag-style” summary (no gradients) */}
                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoRow
                      icon={<FiDatabase className="w-5 h-5" />}
                      label="Company"
                      value={lead?.contact?.companyName || "—"}
                      onCopy={() => copyToClipboard(lead?.contact?.companyName || "")}
                    />
                    <InfoRow
                      icon={<FiUser className="w-5 h-5" />}
                      label="Contact Person"
                      value={lead?.contact?.name || "—"}
                      onCopy={() => copyToClipboard(lead?.contact?.name || "")}
                    />
                    <InfoRow
                      icon={<FiMail className="w-5 h-5" />}
                      label="Email"
                      value={lead?.contact?.email || "No email"}
                      onCopy={() => copyToClipboard(lead?.contact?.email || "")}
                    />
                    <InfoRow
                      icon={<FiPhone className="w-5 h-5" />}
                      label="Phone"
                      value={lead?.contact?.phone || "No phone"}
                      onCopy={() => copyToClipboard(lead?.contact?.phone || "")}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Status" icon={<FiDatabase className="w-4 h-4" />} hint="lead status">
                      <select
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                        className={cn(inputBase, "font-semibold")}
                        disabled={!isEditingDetails || isAccessDenied}
                      >
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="pending">pending</option>
                        <option value="confirmed">confirmed</option>
                        <option value="lost">lost</option>
                      </select>
                    </Field>

                    <div className="hidden md:block" />

                    <Field label="Company Name *" icon={<FiDatabase className="w-4 h-4" />}>
                      <input
                        value={form.companyName}
                        onChange={update("companyName")}
                        className={inputBase}
                        disabled={!isEditingDetails || isAccessDenied}
                        placeholder="Company name"
                      />
                    </Field>

                    <Field label="Contact Person Name *" icon={<FiUser className="w-4 h-4" />}>
                      <input
                        value={form.contactPersonName}
                        onChange={update("contactPersonName")}
                        className={inputBase}
                        disabled={!isEditingDetails || isAccessDenied}
                        placeholder="Contact person"
                      />
                    </Field>

                    <Field label="Phone" icon={<FiPhone className="w-4 h-4" />} hint="optional">
                      <input
                        value={form.phone}
                        onChange={update("phone")}
                        className={inputBase}
                        disabled={!isEditingDetails || isAccessDenied}
                        placeholder="01XXXXXXXXX"
                      />
                    </Field>

                    <Field label="Email" icon={<FiMail className="w-4 h-4" />} hint="optional">
                      <input
                        value={form.email}
                        onChange={update("email")}
                        className={inputBase}
                        disabled={!isEditingDetails || isAccessDenied}
                        placeholder="email@example.com"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Source" icon={<FiMapPin className="w-4 h-4" />} hint="optional">
                        <input
                          value={form.source}
                          onChange={update("source")}
                          className={inputBase}
                          disabled={!isEditingDetails || isAccessDenied}
                          placeholder="Facebook, Referral, Website"
                        />
                      </Field>
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <button
                          onClick={saveDetails}
                          disabled={!isEditingDetails || savingDetails || isAccessDenied}
                          className={cn(btn, btnPrimary, "w-full sm:w-auto font-extrabold disabled:opacity-60")}
                          type="button"
                        >
                          <FiSave />
                          {savingDetails ? "Saving..." : "Save Details"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* FOLLOW-UP TAB (NO GREEN) */}
              {tab === "followup" ? (
                <div className={cn(premiumCard, "p-5 sm:p-6")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">Follow-up</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Click <span className="font-bold">Edit</span> to update dates, then Save.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={setNow}
                        className={cn(btn, btnGhost, btnSm, "font-extrabold")}
                        disabled={!isEditingFollowup || isAccessDenied}
                        title="Set now + next day"
                        type="button"
                      >
                        <FiClock />
                        Set Now
                      </button>

                      <button
                        onClick={() => {
                          if (!isEditingFollowup) return setIsEditingFollowup(true)
                          setIsEditingFollowup(false)
                          loadLead()
                        }}
                        disabled={isAccessDenied || savingFollowup}
                        className={cn(btn, isEditingFollowup ? btnGhost : btnPrimary, btnSm, "font-extrabold disabled:opacity-60")}
                        type="button"
                      >
                        <FiEdit2 />
                        {isEditingFollowup ? "Cancel" : "Edit"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={cn(softPanel, "p-4")}>
                      <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2">
                        <FiClock className="text-indigo-600" /> Last Contacted
                      </label>
                      <input
                        type="datetime-local"
                        value={followup.lastContactedAt}
                        onChange={(e) => setFollowup((p) => ({ ...p, lastContactedAt: e.target.value }))}
                        className={cn(inputBase, "mt-2")}
                        disabled={!isEditingFollowup || isAccessDenied}
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Current:{" "}
                        <span className="font-extrabold text-gray-800">
                          {lead?.lastContactedAt ? readableDate(lead.lastContactedAt) : "—"}
                        </span>
                      </p>
                    </div>

                    <div className={cn(softPanel, "p-4")}>
                      <label className="text-xs font-extrabold text-gray-600 flex items-center gap-2">
                        <FiCalendar className="text-indigo-600" /> Next Follow-up
                      </label>
                      <input
                        type="datetime-local"
                        value={followup.nextFollowUpAt}
                        onChange={(e) => setFollowup((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
                        className={cn(inputBase, "mt-2")}
                        disabled={!isEditingFollowup || isAccessDenied}
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Current:{" "}
                        <span className="font-extrabold text-gray-800">
                          {lead?.nextFollowUpAt ? readableDate(lead.nextFollowUpAt) : "—"}
                        </span>
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
                        <div className="grid grid-cols-2 sm:flex gap-2">
                          <button
                            onClick={() => {
                              const now = new Date()
                              const next = new Date(now.getTime() + 24 * 60 * 60 * 1000)
                              setFollowup((p) => ({
                                lastContactedAt: p.lastContactedAt || now.toISOString().slice(0, 16),
                                nextFollowUpAt: next.toISOString().slice(0, 16),
                              }))
                            }}
                            className={cn(btn, btnGhost, btnSm, "font-extrabold w-full sm:w-auto")}
                            disabled={!isEditingFollowup || isAccessDenied}
                            type="button"
                          >
                            Tomorrow
                          </button>

                          <button
                            onClick={() => {
                              const now = new Date()
                              const next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                              setFollowup((p) => ({
                                lastContactedAt: p.lastContactedAt || now.toISOString().slice(0, 16),
                                nextFollowUpAt: next.toISOString().slice(0, 16),
                              }))
                            }}
                            className={cn(btn, btnGhost, btnSm, "font-extrabold w-full sm:w-auto")}
                            disabled={!isEditingFollowup || isAccessDenied}
                            type="button"
                          >
                            +7 Days
                          </button>
                        </div>

                        <button
                          onClick={saveFollowup}
                          disabled={!isEditingFollowup || savingFollowup || isAccessDenied}
                          className={cn(btn, btnPrimary, "w-full sm:w-auto font-extrabold disabled:opacity-60")}
                          type="button"
                        >
                          <FiSave />
                          {savingFollowup ? "Saving..." : "Save Follow-up"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* NOTES TAB */}
              {tab === "notes" ? (
                <div className="space-y-4">
                  {/* note editor */}
                  <div className={cn(premiumCard, "p-5 sm:p-6")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-gray-900">Add Note</h3>
                        <p className="text-sm text-gray-500 mt-1">Tip: use tags like #meeting #price #urgent</p>
                      </div>
                      <span
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-extrabold",
                          "bg-indigo-50 text-indigo-700 border border-indigo-200"
                        )}
                      >
                        <FiTag className="inline mr-2 -mt-0.5" />
                        Tags enabled
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className={cn(inputBase, "text-sm")}
                        placeholder="Write note..."
                        disabled={isAccessDenied}
                      />
                      <button
                        onClick={addNote}
                        disabled={addingNote || !note.trim() || isAccessDenied}
                        className={cn(btn, btnDark, "w-full px-4 py-2.5 text-sm font-extrabold disabled:opacity-60")}
                        type="button"
                      >
                        <FiFileText />
                        {addingNote ? "Adding..." : "Add Note"}
                      </button>
                    </div>
                  </div>

                  {/* premium notes display (separate component) */}
                  <NotesShowcase leadId={leadId} notes={lead?.notes || []} readableDate={readableDate} />

                  {/* timeline */}
                  <div className={cn(premiumCard, "p-5 sm:p-6")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold text-gray-900">Timeline</h3>
                        <p className="text-sm text-gray-500 mt-1">Recent activities on this lead.</p>
                      </div>

                      <button
                        onClick={loadTimelineFirst}
                        className={cn(btn, btnGhost, btnSm, "font-extrabold")}
                        disabled={isAccessDenied}
                        type="button"
                      >
                        <FiRefreshCcw className={cn("w-4 h-4", isTimelineLoading ? "animate-spin" : "")} />
                        Refresh
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {isTimelineLoading ? (
                        <div className={cn(softPanel, "p-4 text-sm text-gray-500 animate-pulse")}>Loading timeline...</div>
                      ) : activities.length > 0 ? (
                        <>
                          {activities.map((a, idx) => (
                            <div key={a?._id || idx} className={cn(softPanel, "p-4")}>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">
                                  {a?.type || "activity"}
                                </p>
                                <p className="text-xs text-gray-500">{a?.createdAt ? readableDate(a.createdAt) : ""}</p>
                              </div>

                              <p className="text-sm font-extrabold text-gray-900 mt-2">{a?.title || a?.text || a?.note || "—"}</p>

                              {a?.createdBy ? (
                                <p className="mt-2 text-xs text-gray-500">
                                  By: <span className="font-extrabold text-gray-800">{a.createdBy?.name || "—"}</span>
                                </p>
                              ) : null}
                            </div>
                          ))}

                          {timelineHasMore ? (
                            <button onClick={loadMoreTimeline} disabled={loadingMore} className={cn(btn, btnGhost, "w-full")} type="button">
                              {loadingMore ? "Loading..." : "Load more"}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <div className={cn(softPanel, "p-4 text-sm text-gray-500")}>No timeline items.</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {isAccessDenied ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
                  <div className="flex items-start gap-2">
                    <FiAlertCircle className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="text-sm font-extrabold">Access restricted</p>
                      <p className="text-xs mt-1 text-rose-700/90">You can only view/update leads assigned to you.</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* RIGHT / SIDEBAR */}
            <div className="space-y-4">
              <div className={cn(premiumCard, "p-5 sm:p-6")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">Quick Actions</h3>
                    <p className="text-sm text-gray-500 mt-1">Contact + shortcuts.</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-2">
                  <a
                    href={email ? `mailto:${email}` : undefined}
                    onClick={(e) => !email && e.preventDefault()}
                    className={cn(
                      btn,
                      email ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-100 text-gray-400 cursor-not-allowed",
                      "w-full justify-start px-4 py-2.5 font-extrabold shadow-[0_12px_30px_-18px_rgba(79,70,229,0.45)]"
                    )}
                  >
                    <FiMail />
                    Email {email ? "" : "(no email)"}
                  </a>

                  <a
                    href={phone ? `tel:${phone}` : undefined}
                    onClick={(e) => !phone && e.preventDefault()}
                    className={cn(
                      btn,
                      phone ? "bg-gray-900 text-white hover:bg-black" : "bg-gray-100 text-gray-400 cursor-not-allowed",
                      "w-full justify-start px-4 py-2.5 font-extrabold shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)]"
                    )}
                  >
                    <FiPhone />
                    Call {phone ? "" : "(no phone)"}
                  </a>

                  <button
                    onClick={() => copyToClipboard(lead?.leadNumber || "")}
                    className={cn(btn, btnGhost, "w-full justify-start px-4 py-2.5 font-extrabold")}
                    title="Copy lead number"
                    type="button"
                  >
                    <FiCopy />
                    Copy Lead No.
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-xs font-semibold text-gray-500">Assigned To</p>
                  <p className="text-sm font-extrabold text-gray-900 mt-1">{lead?.assignedTo?.name || "—"}</p>
                  <p className="text-xs text-gray-500 break-all mt-0.5">{lead?.assignedTo?.email || ""}</p>
                </div>

                <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <p className="text-xs font-semibold text-gray-500">Created By</p>
                  <p className="text-sm font-extrabold text-gray-900 mt-1">{lead?.createdBy?.name || "—"}</p>
                  <p className="text-xs text-gray-500 break-all mt-0.5">{lead?.createdBy?.email || ""}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================
   MAIN MARKETING LEAD PAGE
   ✅ Search placeholder uses commas (no slash)
   ✅ Table uses <mark> highlight for search term
========================= */
export default function LeadPage() {
  const [leads, setLeads] = useState([])
  const [count, setCount] = useState(0)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = useCallback((type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }, [])

  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")

  const [statusFilter, setStatusFilter] = useState("all")

  const [showCreate, setShowCreate] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState(null)

  const abortRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  const fetchLeads = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(LEADS_API, {
        headers: getAuthHeaders(),
        credentials: "include",
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to fetch leads")

      const normalized = normalizeListResponse(data)
      setLeads(normalized.items)
      setCount(normalized.count)
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load leads.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
    return () => abortRef.current?.abort?.()
  }, [fetchLeads])

  const filtered = useMemo(() => {
    let arr = leads
    if (statusFilter !== "all") arr = arr.filter((l) => String(l?.status || "").toLowerCase() === statusFilter)

    if (!debounced) return arr
    return arr.filter((l) => {
      const c = l?.contact || {}
      const s = `${c?.companyName || ""} ${c?.name || ""} ${c?.phone || ""} ${c?.email || ""} ${l?.source || ""} ${
        l?.status || ""
      } ${l?.leadNumber || ""}`.toLowerCase()
      return s.includes(debounced)
    })
  }, [leads, debounced, statusFilter])

  const quickUpdateStatus = async (leadId, status) => {
    setLeads((prev) => prev.map((x) => (x?._id === leadId ? { ...x, status } : x)))

    try {
      const res = await fetch(`${LEADS_API}/${leadId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update status")
      showToast("success", "Status updated.")
      await fetchLeads()
    } catch (e) {
      showToast("error", e?.message || "Status update failed.")
      await fetchLeads()
    }
  }

  if (selectedLeadId) {
    return (
      <LeadDetails
        leadId={selectedLeadId}
        onBack={() => {
          setSelectedLeadId(null)
          fetchLeads()
        }}
        onChanged={() => fetchLeads()}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <AnimatePresence>
        <Toast
          open={toast.open}
          type={toast.type}
          message={toast.message}
          onClose={() => setToast({ open: false, type: "success", message: "" })}
        />
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={cn(premiumCard, "p-6")}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <FiUsers className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Leads</h1>
                  <p className="text-sm text-gray-500">Marketing team • Leads assigned to you</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                  <FiDatabase className="w-4 h-4" />
                  Total: {count}
                </span>

                <button onClick={() => setShowCreate(true)} className={cn(btn, btnPrimary)}>
                  <FiPlus className="w-4 h-4" />
                  Add Lead
                </button>

                <button onClick={fetchLeads} className={cn(btn, btnGhost)} title="Refresh" type="button">
                  <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="relative flex-1 w-full">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search: company, contact, lead no, phone, email, source, status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(inputBase, "pl-10")}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(inputBase, "min-w-[190px]")}
                  title="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="pending">pending</option>
                  <option value="confirmed">confirmed</option>
                  <option value="lost">lost</option>
                </select>

                <div className="text-sm text-gray-500 flex items-center justify-end">
                  Showing <span className="font-extrabold text-gray-900 mx-1">{filtered.length}</span>{" "}
                  {debounced || statusFilter !== "all" ? "result(s)" : `of ${count}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <div className={cn(premiumCard, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">No.</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Company</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Contact Person</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Next Follow-up</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {isLoading && leads.length === 0 ? (
                  [...Array(6)].map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {[...Array(7)].map((__, i) => (
                        <td key={i} className="px-6 py-4">
                          <div className="h-4 w-full max-w-[10rem] bg-gray-200 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? (
                  filtered.map((l, index) => {
                    const c = l?.contact || {}
                    const nextFollow = l?.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleString() : "—"

                    return (
                      <motion.tr
                        key={l?._id || `lead-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>

                        <td className="px-6 py-4">
                          <p className="font-extrabold text-gray-900">
                            <Highlight text={c?.companyName || "—"} query={debounced} />
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <Highlight text={l?.leadNumber || "LD-—"} query={debounced} />
                          </p>
                          {l?.source ? (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Source: <span className="font-semibold"><Highlight text={l.source} query={debounced} /></span>
                            </p>
                          ) : null}
                        </td>

                        <td className="px-6 py-4">
                          <p className="font-extrabold text-gray-900">
                            <Highlight text={c?.name || "Unnamed"} query={debounced} />
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 break-all">
                            <Highlight text={c?.email || "—"} query={debounced} />
                          </p>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          <Highlight text={c?.phone || "—"} query={debounced} />
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <select
                              className={cn(inputBase, "max-w-[180px]")}
                              value={l?.status || "new"}
                              onChange={(e) => quickUpdateStatus(l._id, e.target.value)}
                            >
                              <option value="new">new</option>
                              <option value="contacted">contacted</option>
                              <option value="pending">pending</option>
                              <option value="confirmed">confirmed</option>
                              <option value="lost">lost</option>
                            </select>
                            <StatusBadge status={l?.status} />
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">{nextFollow}</td>

                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedLeadId(l._id)}
                            className={cn(btn, btnPrimary, "px-3.5 py-2 text-sm font-semibold")}
                            type="button"
                          >
                            <FiEye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      {debounced || statusFilter !== "all" ? "No leads match your filters." : "No leads found."}
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-4 text-sm text-gray-600 border-t border-gray-100 bg-white">
          <span>
            Showing {filtered.length} {debounced || statusFilter !== "all" ? "result(s)" : `of ${count}`}
          </span>

          {!debounced && statusFilter === "all" && !isLoading && leads.length > 0 && (
            <button onClick={fetchLeads} className={cn(btn, btnGhost, "px-4 py-2 text-sm font-semibold")} type="button">
              Refresh
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateLeadModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              showToast("success", "Lead added.")
              fetchLeads()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
