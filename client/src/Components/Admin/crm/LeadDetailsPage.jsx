"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiArrowLeft,
  FiEdit2,
  FiFileText,
  FiCalendar,
  FiPhoneCall,
  FiUserPlus,
  FiTrash2,
  FiRefreshCcw,
  FiAlertCircle,
  FiLoader,
  FiCopy,
  FiExternalLink,
} from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/* =========================
   UI TOKENS
========================= */
const shell =
  "min-h-screen bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(99,102,241,0.20),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(14,165,233,0.14),transparent),linear-gradient(to_bottom,#f8fafc,white)]"
const container = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 sm:py-7"

const card =
  "rounded-3xl border border-gray-100 bg-white/80 backdrop-blur-xl shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)]"
const softCard = "rounded-3xl border border-gray-100 bg-white shadow-[0_14px_40px_-32px_rgba(0,0,0,0.35)]"

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
const btnPrimary =
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_10px_18px_-14px_rgba(79,70,229,0.65)]"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white hover:bg-rose-50"

const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

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

function initials(name) {
  const s = String(name || "").trim()
  if (!s) return "?"
  const parts = s.split(/\s+/).slice(0, 2)
  const init = parts.map((p) => p[0]?.toUpperCase()).join("")
  return init || "?"
}

async function copyToClipboard(text, showToast) {
  try {
    if (!text) return
    await navigator.clipboard.writeText(String(text))
    showToast?.("Copied to clipboard", "success")
  } catch {
    showToast?.("Could not copy", "error")
  }
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
   UI PRIMITIVES
========================= */
function SectionCard({ title, subtitle, right, children, className }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(card, "p-5 sm:p-6", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-extrabold text-gray-900">{title}</h3>
          {subtitle ? <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </motion.div>
  )
}

function InfoRow({ label, value, actions }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-900 break-words">{value ?? "—"}</p>
      </div>
      {actions ? <div className="shrink-0 pt-1">{actions}</div> : null}
    </div>
  )
}

function IconPillButton({ title, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50 transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-60"
      )}
    >
      {children}
    </button>
  )
}

/* =========================
   API
========================= */
async function apiGetLead(id, signal) {
  const res = await fetch(`${API_BASE}/leads/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load lead")
  return data?.lead || data?.item || data
}

/* =========================
   DETAILS PAGE
   CHANGE: Top bar right side order => Back then Refresh
========================= */
export default function LeadDetailsPage({
  leadId,
  refreshTick,
  onBack,
  onEdit,
  onAddNote,
  onSetFollowUp,
  onMarkContacted,
  onConvert,
  onDelete,
  showToast,
}) {
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const abortRef = useRef(null)

  const converted = useMemo(() => {
    const l = lead
    return !!l?.convertedCustomer || !!l?.convertedCustomerId || !!l?.customerId || !!l?.convertedCustomer?._id
  }, [lead])

  const load = async () => {
    if (!leadId) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setErr("")
    try {
      const data = await apiGetLead(leadId, controller.signal)
      setLead(data)
    } catch (e) {
      if (e?.name === "AbortError") return
      setErr(e?.message || "Failed to load lead")
      setLead(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, refreshTick])

  const contact = lead?.contact || {}
  const company = lead?.company || {}
  const tags = Array.isArray(lead?.tags) ? lead.tags : []

  const headerName = contact?.name || "Unnamed lead"
  const headerSubtitle = contact?.companyName || company?.name || ""

  return (
    <div className={shell}>
      {/* TOP STICKY BAR (Left: name only, Right: Back + Refresh) */}
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* LEFT: Customer name */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white flex items-center justify-center font-extrabold shadow-sm shrink-0">
                {initials(headerName)}
              </div>

              <div className="min-w-0">
                <p className="text-xs text-gray-500 leading-4">Lead details</p>
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-base sm:text-lg font-extrabold text-gray-900 truncate min-w-0">{headerName}</h2>
                  {converted ? (
                    <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10 shrink-0")}>
                      Converted
                    </span>
                  ) : null}
                </div>
                {headerSubtitle ? <p className="text-xs sm:text-sm text-gray-600 truncate">{headerSubtitle}</p> : null}
              </div>
            </div>

            {/* RIGHT: Back then Refresh */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onBack} className={cn(btnBase, btnGhost, "px-3 py-2")} title="Back">
                <FiArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                onClick={load}
                className={cn(btnBase, btnGhost, "px-3 py-2")}
                disabled={loading}
                title="Refresh details"
              >
                <FiRefreshCcw className={cn("w-4 h-4", loading ? "animate-spin" : "")} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={container}>
        {/* ERROR */}
        <AnimatePresence>
          {err ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-5 rounded-3xl border border-rose-200 bg-rose-50 p-4 sm:p-5 text-rose-800 flex items-start gap-3"
            >
              <div className="mt-0.5">
                <FiAlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold">Something went wrong</p>
                <p className="text-sm font-semibold break-words">{err}</p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ACTION BAR CARD (buttons moved here) */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className={cn(card, "p-4 sm:p-5 mb-5")}
        >
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => lead && onEdit?.(lead)}
                className={cn(btnBase, btnGhost, "px-3 py-2")}
                disabled={!lead || loading}
              >
                <FiEdit2 className="w-4 h-4" />
                Edit
              </button>

              <button
                onClick={() => lead && onAddNote?.(lead)}
                className={cn(btnBase, btnGhost, "px-3 py-2")}
                disabled={!lead || loading}
              >
                <FiFileText className="w-4 h-4" />
                Add note
              </button>

              <button
                onClick={() => lead && onSetFollowUp?.(lead)}
                className={cn(btnBase, btnGhost, "px-3 py-2")}
                disabled={!lead || loading}
              >
                <FiCalendar className="w-4 h-4" />
                Follow-up
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => lead?._id && onMarkContacted?.(lead._id)}
                className={cn(btnBase, btnPrimary, "px-3 py-2")}
                disabled={!lead || loading}
                title="Mark contacted"
              >
                {loading ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiPhoneCall className="w-4 h-4" />}
                Mark contacted
              </button>

              <button
                onClick={() => lead?._id && onConvert?.(lead._id)}
                className={cn(btnBase, btnPrimary, "px-3 py-2")}
                disabled={!lead || loading || converted}
                title={converted ? "Already converted" : "Convert to customer"}
              >
                <FiUserPlus className="w-4 h-4" />
                {converted ? "Converted" : "Convert"}
              </button>

              <button
                onClick={() => lead && onDelete?.(lead)}
                className={cn(btnBase, btnDanger, "px-3 py-2")}
                disabled={!lead || loading}
                title="Delete lead"
              >
                <FiTrash2 className="w-4 h-4 text-rose-700" />
                Delete
              </button>
            </div>
          </div>
        </motion.div>

        {/* EMPTY STATE */}
        {!leadId ? (
          <div className={cn(softCard, "p-8 text-center")}>
            <p className="text-sm font-extrabold text-gray-900">No lead selected</p>
            <p className="text-sm text-gray-600 mt-1">Go back and pick a lead to view details.</p>
          </div>
        ) : null}

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT */}
          <div className="lg:col-span-8 space-y-4">
            <SectionCard
              title="Overview"
              subtitle="Pipeline status and key metadata"
              right={
                lead ? (
                  <div className="flex items-center gap-2">
                    <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                      ID: <span className="font-extrabold">{String(lead?._id || "—").slice(-8)}</span>
                    </span>
                  </div>
                ) : null
              }
            >
              {loading && !lead ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-1/2 bg-gray-200 rounded" />
                  <div className="h-4 w-2/3 bg-gray-200 rounded" />
                  <div className="h-4 w-1/3 bg-gray-200 rounded" />
                  <div className="h-24 w-full bg-gray-100 rounded-2xl" />
                </div>
              ) : lead ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-extrabold text-gray-900 mb-2">Pipeline</p>
                    <div className="flex flex-wrap gap-2">
                      <LeadStatusBadge status={lead?.status} />
                      <StageBadge stage={lead?.pipelineStage} />
                      <PriorityBadge priority={lead?.priority} />
                      <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
                        Purchase: <span className="font-extrabold">{lead?.purchaseType || "—"}</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-3xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-4">
                      <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Follow-up</p>
                      <p className="text-sm font-extrabold text-gray-900 mt-1">{formatDate(lead?.nextFollowUpAt)}</p>
                      <p className="text-xs text-gray-500 mt-1">Last contacted: {formatDate(lead?.lastContactedAt)}</p>
                    </div>

                    <div className="rounded-3xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-4">
                      <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Source</p>
                      <p className="text-sm font-extrabold text-gray-900 mt-1">{lead?.source || "—"}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {formatDate(lead?.createdAt)} • Updated: {formatDate(lead?.updatedAt)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-extrabold text-gray-900 mb-2">Tags</p>
                    {tags.length ? (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <span key={String(t)} className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                            {String(t)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>No tags</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No lead loaded.</div>
              )}
            </SectionCard>

            <SectionCard title="Quick actions" subtitle="Small tools to speed up your workflow">
              {!lead ? (
                <div className="text-sm text-gray-600">Load a lead to see actions.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-gray-100 bg-white p-4">
                    <p className="text-sm font-extrabold text-gray-900">Copy contact</p>
                    <p className="text-xs text-gray-500 mt-1">Copy email/phone instantly.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className={cn(btnBase, btnGhost, "px-3 py-2")}
                        onClick={() => copyToClipboard(contact?.email, showToast)}
                        disabled={!contact?.email}
                      >
                        <FiCopy className="w-4 h-4" />
                        Email
                      </button>
                      <button
                        className={cn(btnBase, btnGhost, "px-3 py-2")}
                        onClick={() => copyToClipboard(contact?.phone, showToast)}
                        disabled={!contact?.phone}
                      >
                        <FiCopy className="w-4 h-4" />
                        Phone
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-100 bg-white p-4">
                    <p className="text-sm font-extrabold text-gray-900">Open company site</p>
                    <p className="text-xs text-gray-500 mt-1">Launch website in a new tab.</p>
                    <div className="mt-3">
                      <a
                        href={company?.website || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          btnBase,
                          btnPrimary,
                          "w-full",
                          !company?.website ? "pointer-events-none opacity-60" : ""
                        )}
                        onClick={(e) => {
                          if (!company?.website) e.preventDefault()
                        }}
                      >
                        <FiExternalLink className="w-4 h-4" />
                        Open website
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-4 space-y-4">
            <SectionCard title="Contact" subtitle="Primary person information">
              {loading && !lead ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-2/3 bg-gray-200 rounded" />
                  <div className="h-4 w-1/2 bg-gray-200 rounded" />
                  <div className="h-4 w-3/4 bg-gray-200 rounded" />
                  <div className="h-24 w-full bg-gray-100 rounded-2xl" />
                </div>
              ) : lead ? (
                <div className="divide-y divide-gray-100">
                  <InfoRow label="Name" value={contact?.name || "—"} />
                  <InfoRow label="Company" value={contact?.companyName || "—"} />
                  <InfoRow
                    label="Phone"
                    value={contact?.phone || "—"}
                    actions={
                      contact?.phone ? (
                        <IconPillButton title="Copy phone" onClick={() => copyToClipboard(contact?.phone, showToast)}>
                          <FiCopy className="w-4 h-4" />
                        </IconPillButton>
                      ) : null
                    }
                  />
                  <InfoRow
                    label="Email"
                    value={contact?.email || "—"}
                    actions={
                      contact?.email ? (
                        <IconPillButton title="Copy email" onClick={() => copyToClipboard(contact?.email, showToast)}>
                          <FiCopy className="w-4 h-4" />
                        </IconPillButton>
                      ) : null
                    }
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-600">No contact info.</div>
              )}
            </SectionCard>

            <SectionCard title="Company info" subtitle="Website, industry, and address">
              {!lead ? (
                <div className="text-sm text-gray-600">No company info.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <InfoRow
                    label="Website"
                    value={company?.website || "—"}
                    actions={
                      company?.website ? (
                        <div className="flex items-center gap-2">
                          <IconPillButton
                            title="Copy website"
                            onClick={() => copyToClipboard(company?.website, showToast)}
                          >
                            <FiCopy className="w-4 h-4" />
                          </IconPillButton>
                          <a
                            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 hover:bg-gray-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                            title="Open website"
                            href={company?.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FiExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ) : null
                    }
                  />
                  <InfoRow label="Industry" value={company?.industry || "—"} />
                  <InfoRow label="Address" value={company?.address || "—"} />
                </div>
              )}
            </SectionCard>

            <AnimatePresence>{showToast ? null : null}</AnimatePresence>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  )
}
