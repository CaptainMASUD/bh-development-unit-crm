"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
  FiSave,
  FiArrowLeft,
  FiAlertCircle,
  FiCheck,
} from "react-icons/fi"

const API_BASE = "http://localhost:4000/api"
const LEADS_API = `${API_BASE}/leads`

/* ---------- premium styles ---------- */
const premiumCard =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-14px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_46px_-18px_rgba(0,0,0,0.45)] transition-all"

const inputBase =
  "w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

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
  if (Array.isArray(data?.leads)) {
    return { items: data.leads, count: Number(data.count ?? data.leads.length) }
  }
  if (Array.isArray(data)) return { items: data, count: data.length }
  return { items: [], count: 0 }
}

function isValidEmail(email) {
  if (!email) return true
  // simple but good enough
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase()
  const cls =
    s === "confirmed"
      ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-600/10"
      : s === "lost"
        ? "bg-rose-100 text-rose-800 ring-1 ring-rose-600/10"
        : s === "pending"
          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-600/10"
          : s === "contacted"
            ? "bg-sky-100 text-sky-800 ring-1 ring-sky-600/10"
            : "bg-gray-100 text-gray-700 ring-1 ring-gray-600/10"

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold", cls)}>
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

/* ---------- Toast (small success/error) ---------- */
function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-emerald-50 border-emerald-200 text-emerald-700"
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
   CREATE LEAD MODAL (UPDATED DESIGN)
========================= */
function CreateLeadModal({ open, onClose, onCreated }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")
  const [toast, setToast] = useState({ open: false, type: "success", message: "" })

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    source: "",
  })

  const [errors, setErrors] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    source: "",
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
    setErrors({ name: "", email: "", phone: "", companyName: "", source: "" })
  }, [open])

  const update = (key) => (e) => {
    const v = e.target.value
    setForm((p) => ({ ...p, [key]: v }))
    setErrors((p) => ({ ...p, [key]: "" }))
    setServerError("")
  }

  const validate = () => {
    const next = { name: "", email: "", phone: "", companyName: "", source: "" }
    if (!form.name.trim()) next.name = "Contact name is required."
    if (form.email.trim() && !isValidEmail(form.email.trim())) next.email = "Please enter a valid email."
    // phone optional; you can add local BD validation if needed
    setErrors(next)
    return !Object.values(next).some(Boolean)
  }

  const reset = () => {
    setForm({ name: "", email: "", phone: "", companyName: "", source: "" })
    setErrors({ name: "", email: "", phone: "", companyName: "", source: "" })
    setServerError("")
  }

  const submit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    setServerError("")
    try {
      const payload = {
        contact: {
          name: form.name.trim(),
          email: form.email.trim() ? form.email.trim().toLowerCase() : undefined,
          phone: form.phone.trim() || undefined,
          companyName: form.companyName.trim() || undefined,
        },
        source: form.source.trim() || undefined,
      }

      const res = await fetch(LEADS_API, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to create lead")

      // ✅ success toast inside modal + auto close
      setToast({ open: true, type: "success", message: "Lead created successfully." })
      onCreated?.(data?.lead)

      // small delay looks nicer
      setTimeout(() => {
        reset()
        onClose?.()
      }, 450)
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
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => !isSubmitting && onClose?.()}
          />

          {/* modal */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]"
          >
            {/* header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                  <div className="relative w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <FiPlus className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Add New Lead</h2>
                  <p className="text-sm text-gray-600">Marketing lead entry • auto creates pending customer</p>
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

            {/* content */}
            <div className="p-6 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">
              {serverError ? (
                <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 mt-0.5" />
                  <span className="font-semibold">{serverError}</span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: form */}
                <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-gray-50/40 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Contact Name *" icon={<FiUser className="w-4 h-4" />} error={errors.name}>
                      <input
                        ref={firstInputRef}
                        value={form.name}
                        onChange={update("name")}
                        className={inputBase}
                        placeholder="Contact person name"
                      />
                    </Field>

                    <Field label="Company" icon={<FiDatabase className="w-4 h-4" />} hint="optional">
                      <input
                        value={form.companyName}
                        onChange={update("companyName")}
                        className={inputBase}
                        placeholder="Company name"
                      />
                    </Field>

                    <Field label="Phone" icon={<FiPhone className="w-4 h-4" />} hint="optional">
                      <input
                        value={form.phone}
                        onChange={update("phone")}
                        className={inputBase}
                        placeholder="01XXXXXXXXX"
                      />
                    </Field>

                    <Field label="Email" icon={<FiMail className="w-4 h-4" />} hint="optional" error={errors.email}>
                      <input
                        value={form.email}
                        onChange={update("email")}
                        className={inputBase}
                        placeholder="email@example.com"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Lead Source" icon={<FiMapPin className="w-4 h-4" />} hint="optional">
                        <input
                          value={form.source}
                          onChange={update("source")}
                          className={inputBase}
                          placeholder="Facebook / Referral / Website / etc."
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* Right: summary */}
                <div className="rounded-2xl border border-gray-100 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Preview</h3>

                  <div className="space-y-3 text-sm">
                    <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/40">
                      <p className="text-xs text-gray-500">Contact</p>
                      <p className="font-semibold text-gray-900">{form.name.trim() || "—"}</p>
                      <p className="text-gray-600 mt-1">{form.companyName.trim() || "—"}</p>
                    </div>

                    <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/40">
                      <p className="text-xs text-gray-500">Reach</p>
                      <p className="text-gray-800">{form.phone.trim() || "—"}</p>
                      <p className="text-gray-800">{form.email.trim() || "—"}</p>
                    </div>

                    <div className="p-3 rounded-xl border border-gray-100 bg-indigo-50">
                      <p className="text-xs text-indigo-700 font-semibold">After create</p>
                      <ul className="mt-2 list-disc pl-5 text-indigo-700 text-xs space-y-1">
                        <li>Lead will be created (status: new)</li>
                        <li>A Customer will be created (status: pending, origin: lead)</li>
                        <li>Admin can assign + activate later</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* footer */}
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

                  <button
                    onClick={submit}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.8)]"
                  >
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
   LEAD DETAILS (unchanged UI, same API)
========================= */
function LeadDetails({ leadId, onBack, onChanged }) {
  const [lead, setLead] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    source: "",
    status: "new",
  })

  const load = async () => {
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(`${LEADS_API}/${leadId}`, { headers: getAuthHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to load lead")
      const l = data?.lead
      setLead(l || null)
      setForm({
        name: l?.contact?.name || "",
        email: l?.contact?.email || "",
        phone: l?.contact?.phone || "",
        companyName: l?.contact?.companyName || "",
        source: l?.source || "",
        status: l?.status || "new",
      })
    } catch (e) {
      setError(e?.message || "Failed to load lead.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!leadId) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) return setError("Contact name is required.")
    setSaving(true)
    setError("")
    try {
      const body = {
        contact: {
          name: form.name.trim(),
          email: form.email.trim() ? form.email.trim().toLowerCase() : undefined,
          phone: form.phone.trim() || undefined,
          companyName: form.companyName.trim() || undefined,
        },
        source: form.source.trim() || undefined,
        status: form.status,
      }

      const res = await fetch(`${LEADS_API}/${leadId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update lead")

      await load()
      onChanged?.()
    } catch (e) {
      setError(e?.message || "Update failed.")
    } finally {
      setSaving(false)
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
        body: JSON.stringify({ note: note.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to add note")
      setNote("")
      await load()
      onChanged?.()
    } catch (e) {
      setError(e?.message || "Add note failed.")
    } finally {
      setAddingNote(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
        >
          <FiArrowLeft />
          Back
        </button>

        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead?.contact?.name || "Lead"}</h1>
            <p className="text-sm text-gray-500">
              {lead?.contact?.companyName || "—"} • <StatusBadge status={lead?.status} />
            </p>
          </div>

          <button
            onClick={save}
            disabled={saving || isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 text-sm font-semibold"
          >
            <FiSave />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        {isLoading ? (
          <div className="mt-6 p-6 rounded-xl border border-gray-100 bg-gray-50 animate-pulse">
            <div className="h-4 w-48 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-72 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-56 bg-gray-200 rounded" />
          </div>
        ) : !lead ? (
          <div className="mt-6 p-8 text-center text-gray-500">No lead data found.</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-gray-50/40 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Field label="Contact Name *" icon={<FiUser className="w-4 h-4" />}>
                  <input value={form.name} onChange={update("name")} className={inputBase} />
                </Field>

                <Field label="Company" icon={<FiDatabase className="w-4 h-4" />}>
                  <input value={form.companyName} onChange={update("companyName")} className={inputBase} />
                </Field>

                <Field label="Phone" icon={<FiPhone className="w-4 h-4" />}>
                  <input value={form.phone} onChange={update("phone")} className={inputBase} />
                </Field>

                <Field label="Email" icon={<FiMail className="w-4 h-4" />}>
                  <input value={form.email} onChange={update("email")} className={inputBase} />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Source" icon={<FiMapPin className="w-4 h-4" />}>
                    <input value={form.source} onChange={update("source")} className={inputBase} />
                  </Field>
                </div>

                <Field label="Status" icon={<FiUsers className="w-4 h-4" />}>
                  <select value={form.status} onChange={update("status")} className={inputBase}>
                    <option value="new">new</option>
                    <option value="contacted">contacted</option>
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                    <option value="lost">lost</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Notes</h3>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Add a note</label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={cn(inputBase, "text-sm")}
                  placeholder="Write note..."
                />
                <button
                  onClick={addNote}
                  disabled={addingNote || !note.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-60 text-sm font-semibold"
                >
                  <FiFileText />
                  {addingNote ? "Adding..." : "Add Note"}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {Array.isArray(lead?.notes) && lead.notes.length > 0 ? (
                  lead.notes
                    .slice()
                    .reverse()
                    .map((n, idx) => (
                      <div key={n?._id || idx} className="p-3 rounded-xl border border-gray-100 bg-white">
                        <p className="text-sm text-gray-900">{n?.note || "—"}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {n?.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                        </p>
                      </div>
                    ))
                ) : (
                  <div className="p-3 rounded-xl border border-gray-100 bg-white text-sm text-gray-500">No notes yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================
   MAIN LEAD PAGE
========================= */
export default function LeadPage() {
  const [leads, setLeads] = useState([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState(null)

  const abortRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  const fetchLeads = async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(LEADS_API, {
        headers: getAuthHeaders(),
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
  }

  useEffect(() => {
    fetchLeads()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    if (!debounced) return leads
    return leads.filter((l) => {
      const c = l?.contact || {}
      const s = `${c?.name || ""} ${c?.companyName || ""} ${c?.phone || ""} ${c?.email || ""} ${l?.source || ""} ${
        l?.status || ""
      }`.toLowerCase()
      return s.includes(debounced)
    })
  }, [leads, debounced])

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
      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={cn(premiumCard, "p-6")}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <FiUsers className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Leads</h1>
                <p className="text-sm text-gray-500">Marketing team • Create • Update • Notes</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl ring-1 ring-indigo-600/10 bg-indigo-50 text-indigo-700">
                <FiDatabase className="w-4 h-4" />
                <span className="font-extrabold">{filtered.length}</span>
                <span className="text-sm">{filtered.length === 1 ? "lead" : "leads"}</span>
                {debounced && <span className="text-sm text-indigo-600">(filtered)</span>}
              </div>

              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.8)] active:scale-[0.99] transition"
              >
                <FiPlus className="w-4 h-4" />
                Add Lead
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search by name / phone / company / email / source / status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(inputBase, "pl-10")}
          />
        </div>
        <div className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
          {debounced ? "result(s)" : `of ${count}`}
        </div>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">{error}</div>}

      <div className={cn(premiumCard, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">No.</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Contact</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Company</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {isLoading && leads.length === 0 ? (
                  [...Array(6)].map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {[...Array(6)].map((__, i) => (
                        <td key={i} className="px-6 py-4">
                          <div className="h-4 w-full max-w-[10rem] bg-gray-200 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? (
                  filtered.map((l, index) => (
                    <motion.tr
                      key={l?._id || `lead-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{l?.contact?.name || "Unnamed"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{l?.contact?.companyName || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{l?.contact?.phone || "—"}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={l?.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedLeadId(l._id)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_10px_26px_-18px_rgba(79,70,229,0.9)] active:scale-[0.99] transition"
                        >
                          <FiEye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      {debounced ? "No leads match your search." : "No leads found."}
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center p-4 text-sm text-gray-600 border-t border-gray-100 bg-white">
          <span>
            Showing {filtered.length} {debounced ? "result(s)" : `of ${count}`}
          </span>
          {!debounced && !isLoading && leads.length > 0 && (
            <button
              onClick={fetchLeads}
              className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-[0.99] transition"
            >
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
            onCreated={() => fetchLeads()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
