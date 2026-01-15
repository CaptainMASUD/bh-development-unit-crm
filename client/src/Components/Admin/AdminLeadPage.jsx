"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { FiSearch, FiRefreshCcw, FiEye, FiX, FiCheck, FiAlertCircle, FiZap } from "react-icons/fi"
import { HiOutlineUserGroup } from "react-icons/hi2"
import { Loader2 } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

/* ---------- styles ---------- */
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]"
const subtleHover = "transition-colors hover:bg-gray-50/60"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition"
const btnPrimary =
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.65)]"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

// ✅ Amber "Activate" button (matches indigo)
const btnActive =
  "bg-amber-600 text-white hover:bg-amber-700 shadow-[0_12px_30px_-18px_rgba(245,158,11,0.55)]"

// ✅ Modal tiles: MORE shadow as you asked
const panel =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_18px_45px_-22px_rgba(0,0,0,0.35)]"
const panelHeader = "flex items-center justify-between mb-3"
const label = "text-xs font-semibold text-gray-500"
const value = "text-sm font-semibold text-gray-900"
const divider = "h-px bg-gray-100 my-4"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

/* ---------- helpers ---------- */
function getAuthHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function normalizeLeadsResponse(data) {
  if (Array.isArray(data?.leads)) return { items: data.leads, count: Number(data.count ?? data.leads.length) }
  return { items: [], count: 0 }
}

function LeadStatusBadge({ status }) {
  const s = String(status || "").toLowerCase()

  const cls =
    s === "confirmed"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "pending"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : s === "contacted"
      ? "bg-sky-50 text-sky-700 ring-sky-600/10"
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

function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-green-50 border-green-200 text-green-700"
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

function ModalShell({ open, onClose, title, subtitle, icon, children, footer }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
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
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)]"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  {icon}
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">{title}</h2>
                  {subtitle ? <p className="text-sm text-gray-600">{subtitle}</p> : null}
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-6 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">{children}</div>

            {footer ? <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0">{footer}</div> : null}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Lead Details Modal (Premium) ---------- */
function LeadDetailsModal({ open, onClose, lead, onStatusChange, onActivate, saving, activating }) {
  if (!open) return null

  const c = lead?.contact || {}
  const assigned = lead?.assignedTo
  const created = lead?.createdBy

  const canActivate = String(lead?.status || "").toLowerCase() === "confirmed"

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Lead Details"
      subtitle={c?.companyName ? `Company: ${c.companyName}` : "Company: —"}
      icon={<FiEye className="w-5 h-5" />}
      footer={
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)}>
            Close
          </button>

          <button
            onClick={() => onActivate?.(lead)}
            disabled={!canActivate || activating}
            className={cn(btn, btnActive, "disabled:opacity-60")}
            title={canActivate ? "Activate customer" : "Confirm the lead first to activate"}
          >
            {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiZap className="w-4 h-4" />}
            {activating ? "Activating..." : "Activate"}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact */}
        <div className={cn(panel, "p-5")}>
          <div className={panelHeader}>
            <p className="text-sm font-extrabold text-gray-900">Contact</p>
            <LeadStatusBadge status={lead?.status} />
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between gap-4">
              <span className={label}>Name</span>
              <span className={cn(value, "text-right")}>{c?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className={label}>Company</span>
              <span className={cn(value, "text-right")}>{c?.companyName || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className={label}>Email</span>
              <span className="text-sm text-gray-700 text-right break-all">{c?.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className={label}>Phone</span>
              <span className="text-sm text-gray-700 text-right">{c?.phone || "—"}</span>
            </div>
          </div>

          <div className={divider} />

          <div className="flex items-center justify-between gap-4">
            <span className={label}>Source</span>
            <span className={cn(value, "text-right")}>{lead?.source || "—"}</span>
          </div>
        </div>

        {/* Workflow */}
        <div className={cn(panel, "p-5")}>
          <div className={panelHeader}>
            <p className="text-sm font-extrabold text-gray-900">Workflow</p>
            <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60" />
              Lead
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Status</label>
            <select
              className={cn(input, "mt-1")}
              value={lead?.status || "new"}
              disabled={saving}
              onChange={(e) => onStatusChange?.(lead?._id, e.target.value)}
            >
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="lost">lost</option>
            </select>

            {/* ✅ user-friendly tip instead of endpoint text */}
            <p className="mt-2 text-xs text-gray-500">
              Tip: Set status to <span className="font-semibold text-green-700">confirmed</span> to enable{" "}
              <span className="font-semibold">Activate</span>.
            </p>
          </div>

          <div className={divider} />

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 shadow-[0_14px_35px_-24px_rgba(0,0,0,0.28)]">
              <p className="text-xs font-semibold text-gray-500">Assigned Marketing</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1">{assigned?.name || "—"}</p>
              <p className="text-xs text-gray-500 mt-0.5 break-all">{assigned?.email || ""}</p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 shadow-[0_14px_35px_-24px_rgba(0,0,0,0.28)]">
              <p className="text-xs font-semibold text-gray-500">Created By</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1">{created?.name || "—"}</p>
              <p className="text-xs text-gray-500 mt-0.5 break-all">{created?.email || ""}</p>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   ADMIN LEADS PAGE
========================= */
export default function AdminLeadPage() {
  const [leads, setLeads] = useState([])
  const [count, setCount] = useState(0)
  const [marketingUsers, setMarketingUsers] = useState([])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")
  const abortRef = useRef(null)

  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = (type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }

  const [selectedLead, setSelectedLead] = useState(null)
  const [savingLeadId, setSavingLeadId] = useState(null)
  const [activatingId, setActivatingId] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  const fetchMarketingTeam = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/marketing-team`, {
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setMarketingUsers([])
      setMarketingUsers(Array.isArray(data?.marketing) ? data.marketing : [])
    } catch {
      setMarketingUsers([])
    }
  }

  const fetchLeads = async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/leads`, {
        headers: getAuthHeaders(),
        credentials: "include",
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to fetch leads")

      const normalized = normalizeLeadsResponse(data)
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
    fetchMarketingTeam()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    if (!debounced) return leads
    return leads.filter((l) => {
      const c = l?.contact || {}
      const assigned = l?.assignedTo || {}
      const s = `${c?.name || ""} ${c?.companyName || ""} ${c?.email || ""} ${c?.phone || ""} ${l?.source || ""} ${
        l?.status || ""
      } ${assigned?.name || ""} ${assigned?.email || ""}`.toLowerCase()
      return s.includes(debounced)
    })
  }, [leads, debounced])

  const updateLeadStatus = async (leadId, status) => {
    setSavingLeadId(leadId)

    // optimistic for modal + list
    setLeads((prev) => prev.map((x) => (x?._id === leadId ? { ...x, status } : x)))
    setSelectedLead((prev) => (prev?._id === leadId ? { ...prev, status } : prev))

    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to update lead")

      showToast("success", "Lead updated.")
      await fetchLeads()
    } catch (e) {
      showToast("error", e?.message || "Update failed")
      await fetchLeads()
    } finally {
      setSavingLeadId(null)
    }
  }

  const activateLead = async (lead) => {
    const leadId = lead?._id
    if (!leadId) return

    setActivatingId(leadId)
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/convert`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Activate failed")

      showToast("success", "Activated. Customer moved to in_progress.")
      setSelectedLead(null)
      await fetchLeads()
    } catch (e) {
      showToast("error", e?.message || "Activate failed")
    } finally {
      setActivatingId(null)
    }
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

      <LeadDetailsModal
        open={!!selectedLead}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onStatusChange={updateLeadStatus}
        onActivate={activateLead}
        saving={!!selectedLead && savingLeadId === selectedLead?._id}
        activating={!!selectedLead && activatingId === selectedLead?._id}
      />

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={cn(card, "p-6")}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                  <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                    <HiOutlineUserGroup className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Leads</h1>
                  <p className="text-sm text-gray-500">Manage leads, status, and activation</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60" />
                  Total: {count}
                </span>

                <button
                  onClick={() => {
                    fetchLeads()
                    fetchMarketingTeam()
                  }}
                  className={cn(btn, btnGhost)}
                  title="Refresh"
                >
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
                  placeholder="Search name / company / email / phone / status / source / assigned…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(input, "pl-10")}
                />
              </div>

              <div className="text-sm text-gray-600">
                Showing <span className="font-extrabold text-gray-900">{filtered.length}</span>{" "}
                {debounced ? "result(s)" : `of ${count}`}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <div className={cn(card, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/70">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">No.</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Lead</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Company</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Assigned</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
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
                  filtered.map((l, index) => {
                    const c = l?.contact || {}
                    const assigned = l?.assignedTo || {}
                    const status = String(l?.status || "new").toLowerCase()
                    const canActivate = status === "confirmed"
                    const saving = savingLeadId === l._id
                    const activating = activatingId === l._id

                    return (
                      <motion.tr
                        key={l?._id || `lead-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={subtleHover}
                        onClick={() => setSelectedLead(l)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedLead(l)
                        }}
                      >
                        <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>

                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{c?.name || "Unnamed"}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {c?.email || "—"} • {c?.phone || "—"}
                          </p>
                          {l?.source ? (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Source: <span className="font-semibold">{l.source}</span>
                            </p>
                          ) : null}
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900">{c?.companyName || "—"}</p>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-gray-900">{assigned?.name || "—"}</p>
                          <p className="text-xs text-gray-500 break-all">{assigned?.email || ""}</p>
                        </td>

                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <select
                              className={cn(input, "max-w-[180px]")}
                              value={l?.status || "new"}
                              disabled={saving}
                              onChange={(e) => updateLeadStatus(l._id, e.target.value)}
                            >
                              <option value="new">new</option>
                              <option value="contacted">contacted</option>
                              <option value="pending">pending</option>
                              <option value="confirmed">confirmed</option>
                              <option value="lost">lost</option>
                            </select>
                            <LeadStatusBadge status={l?.status} />
                          </div>
                        </td>

                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setSelectedLead(l)} className={cn(btn, btnPrimary, "px-3.5 py-2")}>
                              <FiEye className="w-4 h-4" />
                              View
                            </button>

                            <button
                              onClick={() => activateLead(l)}
                              disabled={!canActivate || activating}
                              className={cn(btn, btnActive, "px-3.5 py-2 disabled:opacity-60")}
                              title={canActivate ? "Activate (confirmed lead)" : "Confirm the lead first"}
                            >
                              {activating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FiZap className="w-4 h-4" />
                              )}
                              {activating ? "Activating..." : "Activate"}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })
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
            <button onClick={fetchLeads} className={cn(btn, btnGhost, "px-4 py-2")}>
              Refresh list
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
