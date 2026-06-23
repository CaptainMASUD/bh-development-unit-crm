"use client"

/**
 * AdminLeadsPage.updated.jsx — BusinessHub CRM Lead + Productivity UI
 *
 * Updated for old + new APIs:
 * OLD UPDATED:
 * - /api/view-preferences/leads.list
 * - /api/leads
 * - /api/leads/:id/stage
 * - /api/leads/:id/requirement
 * - /api/leads/:id/contacted
 * - /api/leads/:id/followup
 * - /api/leads/:id/won
 * - /api/leads/:id/lost
 * - /api/leads/:id/convert
 * - /api/leads/:id/timeline
 * - /api/activities
 * - /api/activities/quick-action
 * - /api/proposals
 * - /api/deals
 *
 * NEW PRODUCTIVITY:
 * - /api/work-queue
 * - /api/work-queue/today
 * - /api/work-queue/summary
 * - /api/notifications/my
 * - /api/notifications/my/read-all
 * - /api/templates
 * - /api/assignments/available-users
 * - /api/assignments/lead/manual
 * - /api/assignments/lead/auto
 * - /api/assignments/lead/bulk-auto
 * - /api/assignments/rules
 *
 * Vite:
 * const API_BASE = `${import.meta.env.VITE_API_URL}/api`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import {
  FiActivity,
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowRight,
  FiBarChart2,
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiColumns,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiFilter,
  FiFlag,
  FiGrid,
  FiInfo,
  FiLoader,
  FiLock,
  FiMail,
  FiMoreVertical,
  FiPhoneCall,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiSend,
  FiSliders,
  FiTarget,
  FiTrash2,
  FiTrendingUp,
  FiUnlock,
  FiUser,
  FiUserCheck,
  FiUserPlus,
  FiX,
  FiXCircle,
  FiZap,
} from "react-icons/fi"
import { SiMicrosoftexcel } from "react-icons/si"
import * as XLSX from "xlsx"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const btnSoft = "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
const iconBtn =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40"
const label = "mb-1.5 block text-sm font-semibold text-gray-800"
const chip = "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ring-1"

const LEAD_STATUSES = ["new", "contacted", "pending", "confirmed", "lost"]
const PIPELINE_STAGES = ["new", "qualified", "discovery", "proposal", "negotiation", "won", "lost"]
const ACTIVE_PIPELINE_STAGES = ["new", "qualified", "discovery", "proposal", "negotiation"]
const FINAL_PIPELINE_STAGES = ["won", "lost"]
const STAGE_LABELS = { new: "New", qualified: "Qualified", discovery: "Discovery", proposal: "Proposal", negotiation: "Negotiation", won: "Won", lost: "Lost" }
const STAGE_REQUIREMENTS = {
  new: "Capture lead details",
  qualified: "Validate need and interest",
  discovery: "Collect requirements",
  proposal: "Send quotation/proposal",
  negotiation: "Discuss price and terms",
  won: "Client accepted",
  lost: "Client rejected or no fit",
}
function getStageIndex(stage) {
  const index = ACTIVE_PIPELINE_STAGES.indexOf(String(stage || "new"))
  return index >= 0 ? index : 0
}
function getNextPipelineStage(lead) {
  const current = String(lead?.pipelineStage || "new")
  if (FINAL_PIPELINE_STAGES.includes(current)) return ""
  if (current === "proposal") return ""
  const index = getStageIndex(current)
  return ACTIVE_PIPELINE_STAGES[index + 1] || ""
}
function isFinalPipelineStage(stage) {
  return FINAL_PIPELINE_STAGES.includes(String(stage || ""))
}
function getSuggestedStatusForStage(stage, currentStatus = "") {
  if (stage === "won") return "confirmed"
  if (stage === "lost") return "lost"
  if (["qualified", "discovery", "proposal", "negotiation"].includes(stage)) return "contacted"
  return currentStatus || "new"
}
function getRequirementChecklist(lead) {
  const r = lead?.requirement || {}
  return [
    { key: "summary", label: "Requirement summary", done: Boolean(String(r.summary || "").trim()) },
    { key: "expectedSolution", label: "Expected solution", done: Boolean(String(r.expectedSolution || "").trim()) },
    { key: "timeline", label: "Timeline", done: Boolean(String(r.timeline || "").trim()) },
    { key: "decisionMaker", label: "Decision maker", done: Boolean(String(r.decisionMaker || "").trim()) },
  ]
}
function hasRequirementDetails(lead) {
  return getRequirementChecklist(lead).every((x) => x.done)
}
function hasAnyRequirementDetails(lead) {
  return getRequirementChecklist(lead).some((x) => x.done)
}
function getMissingRequirementLabels(lead) {
  return getRequirementChecklist(lead).filter((x) => !x.done).map((x) => x.label)
}
function hasProposalWork(lead, timeline = null) {
  const proposals = Array.isArray(timeline?.proposals) ? timeline.proposals : []
  if (proposals.length > 0) return true
  if (Number(lead?.proposalCount || 0) > 0) return true
  return false
}

function getProposalCount(lead, timeline = null) {
  const proposals = Array.isArray(timeline?.proposals) ? timeline.proposals : []
  return Math.max(Number(lead?.proposalCount || 0), proposals.length)
}
function getProposalShortcutInfo(lead, timeline = null) {
  const stage = String(lead?.pipelineStage || "new")
  const stageIndex = getStageIndex(stage)
  const requirementReady = hasRequirementDetails(lead)
  const proposalCount = getProposalCount(lead, timeline)
  if (stageIndex < getStageIndex("discovery")) {
    return { show: false, disabled: true, action: "", label: "Proposal", helper: "Proposal starts after discovery." }
  }
  if (stage === "discovery" && !requirementReady) {
    return { show: true, disabled: true, action: "requirement", label: "Create proposal", helper: "Complete requirement first to unlock proposal." }
  }
  if (proposalCount > 0 || ["negotiation", "won"].includes(stage)) {
    return { show: true, disabled: false, action: "manageProposal", label: "Manage proposals", helper: "View, send, accept or reject from the Proposals tab." }
  }
  return { show: true, disabled: false, action: "proposal", label: "Create proposal", helper: "Create a linked proposal for this lead." }
}

function getLatestLeadNotes(lead, limit = 4) {
  const notes = Array.isArray(lead?.notes) ? lead.notes : []
  return [...notes]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)
}
function getGuidedNextAction(stage) {
  if (stage === "discovery") return { type: "requirement", label: "Fill requirement", icon: FiTarget, text: "Discovery needs client requirement, budget, pain points and expected solution." }
  if (stage === "proposal") return { type: "proposal", label: "Create proposal", icon: FiFileText, text: "Proposal stage should create/send a quotation from this lead." }
  return null
}

function getStageDetailSummary(stage, lead, timeline = null) {
  const stageKey = String(stage || "new")
  const requirementItems = getRequirementChecklist(lead)
  const doneRequirement = requirementItems.filter((x) => x.done).length
  const proposals = Array.isArray(timeline?.proposals) ? timeline.proposals : []
  const proposalCount = Math.max(Number(lead?.proposalCount || 0), proposals.length)
  const latestProposal = proposals[0] || null

  if (stageKey === "new") {
    return {
      title: "Lead captured",
      text: lead?.contact?.name ? `${lead.contact.name}${lead?.contact?.companyName ? ` • ${lead.contact.companyName}` : ""}` : "Contact and company information",
      meta: lead?.source ? `Source: ${lead.source}` : "Ready for first contact",
    }
  }

  if (stageKey === "qualified") {
    return {
      title: "Need validated",
      text: `${lead?.leadTemperature || "warm"} lead • ${lead?.priority || "medium"} priority`,
      meta: lead?.lastContactedAt ? `Last contacted ${formatDate(lead.lastContactedAt, true)}` : "First contact still needed",
    }
  }

  if (stageKey === "discovery") {
    return {
      title: `${doneRequirement}/${requirementItems.length} requirement fields`,
      text: doneRequirement === requirementItems.length ? "Requirement is complete" : "Collect requirement before moving forward",
      meta: lead?.requirement?.expectedValue ? `Value: ${formatMoney(lead.requirement.expectedValue)}` : "Budget, timeline and decision maker needed",
    }
  }

  if (stageKey === "proposal") {
    return {
      title: proposalCount ? `${proposalCount} proposal linked` : "Proposal required",
      text: latestProposal?.title || "Create proposal before continuing",
      meta: latestProposal?.status ? `Status: ${latestProposal.status}` : "Use proposal modal to save amount and history",
    }
  }

  if (stageKey === "negotiation") {
    return {
      title: "Closing work",
      text: lead?.nextAction || "Discuss price, terms and final decision",
      meta: lead?.nextFollowUpAt ? `Follow-up ${formatDate(lead.nextFollowUpAt, true)}` : "Set next follow-up for closing",
    }
  }

  return { title: STAGE_LABELS[stageKey] || stageKey, text: STAGE_REQUIREMENTS[stageKey] || "Review stage work", meta: "" }
}

function getStageState(stage, lead, selectedStage = "", timeline = null) {
  const currentStage = String(lead?.pipelineStage || "new")
  const currentIndex = getStageIndex(currentStage)
  const stageIndex = getStageIndex(stage)
  const isCurrent = stage === currentStage
  const isSelected = stage === selectedStage
  const completed = isFinalPipelineStage(currentStage) || stageIndex < currentIndex
  const proposalReady = hasProposalWork(lead, timeline)
  const requirementReady = hasRequirementDetails(lead)

  if (stage === "discovery" && !requirementReady && (isCurrent || isSelected)) return "Required"
  if (stage === "proposal" && !proposalReady && (isCurrent || isSelected)) return "Required"
  if (completed) return "Done"
  if (isCurrent) return "Current"
  if (isSelected) return "Selected"
  return "Locked"
}
const PRIORITIES = ["low", "medium", "high"]
const TEMPERATURES = ["cold", "warm", "hot"]
const WORK_PRIORITIES = ["low", "normal", "high", "urgent"]
const ACTIVITY_TYPES = ["note", "call", "email", "meeting", "whatsapp", "task_followup"]
const ACTIVITY_STATUSES = ["pending", "completed", "cancelled"]
const ACTIVITY_RESULTS = ["", "positive", "neutral", "negative", "no_response", "interested", "not_interested", "callback_requested", "proposal_requested"]
const QUICK_ACTIONS = [
  ["call_done", "Call Done", FiPhoneCall],
  ["whatsapp_sent", "WhatsApp Sent", FiSend],
  ["email_sent", "Email Sent", FiMail],
  ["meeting_scheduled", "Meeting Scheduled", FiCalendar],
  ["followup_tomorrow", "Follow-up Tomorrow", FiClock],
  ["client_interested", "Client Interested", FiTrendingUp],
  ["client_not_interested", "Not Interested", FiXCircle],
  ["proposal_requested", "Proposal Requested", FiFileText],
  ["proposal_sent", "Proposal Sent", FiSend],
  ["deal_discussed", "Deal Discussed", FiBriefcase],
]
const PROPOSAL_STATUSES = ["draft", "sent", "accepted", "rejected", "expired", "cancelled"]
const DEAL_STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"]
const DEAL_HEALTH = ["unknown", "healthy", "at_risk", "stuck", "critical"]
const PROPOSAL_STATUS_FOR_DEAL = ["none", "draft", "sent", "accepted", "rejected", "expired"]
const TEMPLATE_CHANNELS = ["call_note", "whatsapp", "email", "meeting", "proposal_note", "general"]
const TEMPLATE_PURPOSES = ["first_contact", "follow_up", "proposal_sent", "proposal_reminder", "meeting_schedule", "lost_reason", "won_note", "general"]
const ASSIGNMENT_STRATEGIES = ["round_robin", "least_loaded", "fixed_user"]

const DEFAULT_COLUMNS = [
  "leadNumber",
  "contact.name",
  "contact.companyName",
  "status",
  "pipelineStage",
  "priority",
  "leadTemperature",
  "leadScore",
  "workQueuePriority",
  "workQueueScore",
  "nextAction",
  "nextActionAt",
  "isOverdue",
  "purchaseType",
  "nextFollowUpAt",
  "lastContactedAt",
  "lastActivityAt",
  "source",
  "convertedAt",
  "createdAt",
]

const FALLBACK_ALLOWED_COLUMNS = [
  "leadNumber",
  "contact.name",
  "contact.companyName",
  "contact.phone",
  "contact.email",
  "status",
  "pipelineStage",
  "priority",
  "leadTemperature",
  "leadScore",
  "workQueuePriority",
  "workQueueScore",
  "lastActivityAt",
  "nextAction",
  "nextActionType",
  "nextActionAt",
  "isOverdue",
  "overdueSince",
  "purchaseType",
  "source",
  "tags",
  "nextFollowUpAt",
  "lastContactedAt",
  "lostReason",
  "lostAt",
  "wonReason",
  "wonAt",
  "customerId",
  "convertedCustomer",
  "convertedAt",
  "createdAt",
  "updatedAt",
]

const COLUMN_LABELS = {
  leadNumber: "Lead No",
  "contact.name": "Contact",
  "contact.companyName": "Company",
  "contact.phone": "Phone",
  "contact.email": "Email",
  status: "Status",
  pipelineStage: "Stage",
  priority: "Priority",
  leadTemperature: "Temp",
  leadScore: "Score",
  workQueuePriority: "Queue Priority",
  workQueueScore: "Queue Score",
  lastActivityAt: "Last Activity",
  nextAction: "Next Action",
  nextActionType: "Action Type",
  nextActionAt: "Next Action At",
  isOverdue: "Overdue",
  overdueSince: "Overdue Since",
  purchaseType: "Purchase",
  source: "Source",
  tags: "Tags",
  nextFollowUpAt: "Next Follow-up",
  lastContactedAt: "Last Contacted",
  lostReason: "Lost Reason",
  lostAt: "Lost At",
  wonReason: "Won Reason",
  wonAt: "Won At",
  customerId: "Customer",
  convertedCustomer: "Converted",
  convertedAt: "Converted At",
  createdAt: "Created",
  updatedAt: "Updated",
}

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

function getByPath(obj, path) {
  if (!obj || !path) return undefined
  if (!String(path).includes(".")) return obj?.[path]
  return String(path).split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function normalizeApiList(data) {
  return Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.leads)
          ? data.leads
          : Array.isArray(data?.rules)
            ? data.rules
            : Array.isArray(data?.templates)
              ? data.templates
              : Array.isArray(data?.users)
                ? data.users
                : []
}

function formatDate(value, withTime = false) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function formatDateInput(value, mode = "datetime") {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return mode === "date" ? local.toISOString().slice(0, 10) : local.toISOString().slice(0, 16)
}

function formatMoney(value, currency = "BDT") {
  const n = Number(value || 0)
  return `${currency || "BDT"} ${n.toLocaleString()}`
}

function initials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const a = parts[0]?.[0] || ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""
  return (a + b).toUpperCase()
}

function getLeadId(lead) {
  return lead?._id || lead?.id || ""
}

function isConvertedLead(lead) {
  return Boolean(lead?.customerId || lead?.convertedCustomer || lead?.convertedAt || lead?.isConverted || lead?.converted)
}

function badgeClass(value) {
  const v = String(value || "").toLowerCase()
  if (["confirmed", "won", "accepted", "completed", "healthy", "done", "success"].includes(v)) return "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
  if (["contacted", "qualified", "sent", "in_progress", "normal"].includes(v)) return "bg-sky-50 text-sky-700 ring-sky-600/10"
  if (["proposal", "pending", "negotiation", "draft", "high", "warm", "at_risk", "snoozed"].includes(v)) return "bg-amber-50 text-amber-800 ring-amber-600/10"
  if (["lost", "rejected", "cancelled", "urgent", "hot", "critical", "stuck", "danger"].includes(v)) return "bg-rose-50 text-rose-700 ring-rose-600/10"
  return "bg-gray-100 text-gray-700 ring-gray-600/10"
}

function Badge({ value }) {
  const v = value === true ? "yes" : value === false ? "no" : String(value || "—")
  return (
    <span className={cn(chip, badgeClass(v))}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
      {v}
    </span>
  )
}

function ModalShell({ open, onClose, title, subtitle, icon, children, footer, maxWidthClass = "max-w-3xl" }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 14, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24 }} className={cn("relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]", maxWidthClass)}>
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">{icon}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
                  {subtitle ? <p className="truncate text-sm text-gray-600">{subtitle}</p> : null}
                </div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100"><FiX className="h-5 w-5 text-gray-700" /></button>
            </div>
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-white p-4 sm:p-5">{children}</div>
            {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</div> : null}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function Field({ label: labelText, hint, children }) {
  return <div><label className={label}>{labelText}</label>{children}{hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}</div>
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm">{icon}</div>
      <p className="text-sm font-bold text-gray-900">{title}</p>
      {subtitle ? <p className="mt-1 max-w-md text-sm text-gray-500">{subtitle}</p> : null}
    </div>
  )
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options, headers: getAuthHeaders(options.headers || {}) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || data?.error || "Request failed")
  return data
}

const VIEW_KEY = "leads.list"
const apiGetViewPref = async (signal) => {
  const res = await fetch(`${API_BASE}/view-preferences/${encodeURIComponent(VIEW_KEY)}`, { headers: getAuthHeaders(), credentials: "include", signal })
  const data = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 304) throw new Error(data?.message || "Failed to load view preferences")
  return data
}
const apiSaveViewPref = (columns) => apiJson(`${API_BASE}/view-preferences/${encodeURIComponent(VIEW_KEY)}`, { method: "PUT", body: JSON.stringify({ columns }) })
const apiListPurchaseTypes = async (signal) => normalizeApiList(await apiJson(`${API_BASE}/purchase-types`, { signal }))
const apiCreatePurchaseType = async (payload) => {
  const data = await apiJson(`${API_BASE}/purchase-types`, { method: "POST", body: JSON.stringify(payload) })
  return data?.purchaseType || data?.item || data
}
const apiListLeads = async ({ limit = 25, cursor, params = {}, fields, sort = "newest", signal } = {}) => {
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (sort) qs.set("sort", String(sort))
  if (cursor) qs.set("cursor", String(cursor))
  if (fields) qs.set("fields", fields)
  Object.entries(params || {}).forEach(([k, v]) => { if (String(v ?? "").trim()) qs.set(k, String(v).trim()) })
  return apiJson(`${API_BASE}/leads?${qs.toString()}`, { signal })
}
const apiGetLead = (id, signal) => apiJson(`${API_BASE}/leads/${id}`, { signal })
const apiGetLeadTimeline = (id, signal) => apiJson(`${API_BASE}/leads/${id}/timeline`, { signal })
const apiCreateLead = (payload) => apiJson(`${API_BASE}/leads`, { method: "POST", body: JSON.stringify(payload) })
const apiUpdateLead = (id, payload) => apiJson(`${API_BASE}/leads/${id}`, { method: "PUT", body: JSON.stringify(payload) })
const apiUpdateLeadAccess = (id, payload) => apiJson(`${API_BASE}/leads/${id}/access`, { method: "PATCH", body: JSON.stringify(payload) })
const apiAddLeadNote = (id, payload) => apiJson(`${API_BASE}/leads/${id}/notes`, { method: "POST", body: JSON.stringify(payload) })
const apiUpdateLeadStage = (id, payload) => apiJson(`${API_BASE}/leads/${id}/stage`, { method: "PATCH", body: JSON.stringify(payload) })
const apiUpdateRequirement = (id, payload) => apiJson(`${API_BASE}/leads/${id}/requirement`, { method: "PATCH", body: JSON.stringify(payload) })
const apiMarkContacted = (id, payload = {}) => apiJson(`${API_BASE}/leads/${id}/contacted`, { method: "PATCH", body: JSON.stringify(payload) })
const apiSetFollowUp = (id, payload) => apiJson(`${API_BASE}/leads/${id}/followup`, { method: "PATCH", body: JSON.stringify(payload) })
const apiLeadWon = (id, payload) => apiJson(`${API_BASE}/leads/${id}/won`, { method: "PATCH", body: JSON.stringify(payload) })
const apiLeadLost = (id, payload) => apiJson(`${API_BASE}/leads/${id}/lost`, { method: "PATCH", body: JSON.stringify(payload) })
const apiConvertLead = (id) => apiJson(`${API_BASE}/leads/${id}/convert`, { method: "POST" })
const apiDeleteLead = (id, password) => apiJson(`${API_BASE}/leads/${id}`, { method: "DELETE", body: JSON.stringify({ password }) })
const apiCreateActivity = (payload) => apiJson(`${API_BASE}/activities`, { method: "POST", body: JSON.stringify(payload) })
const apiQuickAction = (payload) => apiJson(`${API_BASE}/activities/quick-action`, { method: "POST", body: JSON.stringify(payload) })
const apiCompleteActivity = (id, payload) => apiJson(`${API_BASE}/activities/${id}/complete`, { method: "PATCH", body: JSON.stringify(payload) })
const apiCancelActivity = (id, payload) => apiJson(`${API_BASE}/activities/${id}/cancel`, { method: "PATCH", body: JSON.stringify(payload) })
const apiCreateProposal = (payload) => apiJson(`${API_BASE}/proposals`, { method: "POST", body: JSON.stringify(payload) })
const apiUpdateProposal = (id, payload) => apiJson(`${API_BASE}/proposals/${id}`, { method: "PUT", body: JSON.stringify(payload) })
const apiSendProposal = (id) => apiJson(`${API_BASE}/proposals/${id}/send`, { method: "PATCH" })
const apiAcceptProposal = (id) => apiJson(`${API_BASE}/proposals/${id}/accept`, { method: "PATCH" })
const apiRejectProposal = (id, payload) => apiJson(`${API_BASE}/proposals/${id}/reject`, { method: "PATCH", body: JSON.stringify(payload) })
const apiCreateDeal = (payload) => apiJson(`${API_BASE}/deals`, { method: "POST", body: JSON.stringify(payload) })
const apiCreateDealFromProposal = (proposalId, payload) => apiJson(`${API_BASE}/deals/from-proposal/${proposalId}`, { method: "POST", body: JSON.stringify(payload) })
const apiUpdateDeal = (id, payload) => apiJson(`${API_BASE}/deals/${id}`, { method: "PUT", body: JSON.stringify(payload) })
const apiDealWon = (id, payload) => apiJson(`${API_BASE}/deals/${id}/won`, { method: "PATCH", body: JSON.stringify(payload) })
const apiDealLost = (id, payload) => apiJson(`${API_BASE}/deals/${id}/lost`, { method: "PATCH", body: JSON.stringify(payload) })

const apiTodayQueue = () => apiJson(`${API_BASE}/work-queue/today`)
const apiQueueSummary = () => apiJson(`${API_BASE}/work-queue/summary`)
const apiListQueue = (params = {}) => apiJson(`${API_BASE}/work-queue?${new URLSearchParams(params).toString()}`)
const apiQueueDone = (id, payload) => apiJson(`${API_BASE}/work-queue/${id}/done`, { method: "PATCH", body: JSON.stringify(payload) })
const apiQueueSnooze = (id, payload) => apiJson(`${API_BASE}/work-queue/${id}/snooze`, { method: "PATCH", body: JSON.stringify(payload) })
const apiQueueStart = (id) => apiJson(`${API_BASE}/work-queue/${id}/start`, { method: "PATCH" })
const apiQueueCancel = (id, payload) => apiJson(`${API_BASE}/work-queue/${id}/cancel`, { method: "PATCH", body: JSON.stringify(payload) })
const apiCreateQueue = (payload) => apiJson(`${API_BASE}/work-queue`, { method: "POST", body: JSON.stringify(payload) })

const apiMyNotifications = () => apiJson(`${API_BASE}/notifications/my`)
const apiReadAllNotifications = () => apiJson(`${API_BASE}/notifications/my/read-all`, { method: "PATCH" })
const apiReadNotification = (id) => apiJson(`${API_BASE}/notifications/${id}/read`, { method: "PATCH" })

const apiListTemplates = (params = {}) => apiJson(`${API_BASE}/templates?${new URLSearchParams(params).toString()}`)
const apiCreateTemplate = (payload) => apiJson(`${API_BASE}/templates`, { method: "POST", body: JSON.stringify(payload) })
const apiUpdateTemplate = (id, payload) => apiJson(`${API_BASE}/templates/${id}`, { method: "PUT", body: JSON.stringify(payload) })
const apiDeleteTemplate = (id) => apiJson(`${API_BASE}/templates/${id}`, { method: "DELETE" })
const apiUseTemplate = (id, payload) => apiJson(`${API_BASE}/templates/${id}/use`, { method: "POST", body: JSON.stringify(payload) })


const apiAvailableAssignees = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return apiJson(`${API_BASE}/assignments/available-users${qs ? `?${qs}` : ""}`)
}
const apiManualAssign = (payload) => apiJson(`${API_BASE}/assignments/lead/manual`, { method: "POST", body: JSON.stringify(payload) })
const apiAutoAssign = (leadId) => apiJson(`${API_BASE}/assignments/lead/auto`, { method: "POST", body: JSON.stringify({ leadId }) })
const apiBulkAutoAssign = (limit = 50) => apiJson(`${API_BASE}/assignments/lead/bulk-auto`, { method: "POST", body: JSON.stringify({ limit }) })
const apiListAssignmentRules = () => apiJson(`${API_BASE}/assignments/rules`)
const apiCreateAssignmentRule = (payload) => apiJson(`${API_BASE}/assignments/rules`, { method: "POST", body: JSON.stringify(payload) })
const apiUpdateAssignmentRule = (id, payload) => apiJson(`${API_BASE}/assignments/rules/${id}`, { method: "PUT", body: JSON.stringify(payload) })
const apiDeleteAssignmentRule = (id) => apiJson(`${API_BASE}/assignments/rules/${id}`, { method: "DELETE" })

function ColumnPickerModal({ open, onClose, allowed = [], selected = [], onSave }) {
  const [q, setQ] = useState("")
  const [local, setLocal] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setQ(""); setErr(""); setSaving(false); setLocal(selected?.length ? selected : allowed) } }, [open, selected, allowed])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? allowed.filter((c) => String(COLUMN_LABELS[c] || c).toLowerCase().includes(s) || c.toLowerCase().includes(s)) : allowed
  }, [q, allowed])
  const toggle = (column) => {
    setLocal((prev) => prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column])
  }
  const move = (column, direction) => {
    setLocal((prev) => {
      const currentIndex = prev.indexOf(column)
      if (currentIndex < 0) return prev
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= prev.length) return prev
      const next = [...prev]
      ;[next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]]
      return next
    })
  }
  const save = async (cols) => {
    setErr(""); setSaving(true)
    try { await onSave?.(cols); onClose?.() } catch (e) { setErr(e?.message || "Failed to save columns") } finally { setSaving(false) }
  }
  return (
    <ModalShell open={open} onClose={onClose} title="Choose columns" subtitle="Show, hide and arrange lead list columns. Actions stays visible." icon={<FiColumns className="h-5 w-5" />} maxWidthClass="max-w-5xl" footer={<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2"><button className={cn(btn, btnGhost, "px-3 py-2")} disabled={saving} onClick={() => setLocal(allowed)}>Show all</button><button className={cn(btn, btnGhost, "px-3 py-2")} disabled={saving} onClick={() => setLocal(DEFAULT_COLUMNS)}>Default</button></div><div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} disabled={saving} onClick={onClose}>Cancel</button><button className={cn(btn, btnPrimary)} disabled={saving || !local.length} onClick={() => save(local)}>{saving ? "Saving..." : "Apply"}</button></div></div>}>
      {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2"><FiSearch className="h-4 w-4 text-gray-400" /><input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Search columns..." /><span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>{local.length} selected</span></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-7">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
            <p className="text-sm font-bold text-gray-900">Available columns</p>
            <p className="text-xs text-gray-500">Select or deselect columns for the table.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
            {filtered.map((c) => {
              const checked = local.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(c)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition",
                    checked ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-white hover:bg-gray-50"
                  )}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{COLUMN_LABELS[c] || c}</span>
                    <span className="block truncate text-[11px] text-gray-400">{c}</span>
                  </div>
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border", checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-transparent")}>
                    <FiCheck className="h-4 w-4" />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">Selected order</p>
              <p className="mt-0.5 text-xs text-gray-500">Use the arrows to arrange table columns.</p>
            </div>
            <div className="max-h-[430px] space-y-2 overflow-y-auto p-3">
              {local.map((c, index) => (
                <div key={c} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xs font-bold text-gray-700">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{COLUMN_LABELS[c] || c}</p>
                      <p className="truncate text-[11px] text-gray-400">{c}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" onClick={() => move(c, "up")} disabled={index === 0} className="rounded-xl border border-gray-200 bg-white p-2 transition hover:bg-gray-50 disabled:opacity-40" title="Move up" aria-label={`Move ${COLUMN_LABELS[c] || c} up`}>
                      <FiChevronDown className="h-4 w-4 rotate-180 text-gray-700" />
                    </button>
                    <button type="button" onClick={() => move(c, "down")} disabled={index === local.length - 1} className="rounded-xl border border-gray-200 bg-white p-2 transition hover:bg-gray-50 disabled:opacity-40" title="Move down" aria-label={`Move ${COLUMN_LABELS[c] || c} down`}>
                      <FiChevronDown className="h-4 w-4 text-gray-700" />
                    </button>
                    <button type="button" onClick={() => toggle(c)} className="rounded-xl border border-gray-200 bg-white p-2 transition hover:bg-gray-50" title="Remove" aria-label={`Remove ${COLUMN_LABELS[c] || c}`}>
                      <FiX className="h-4 w-4 text-gray-700" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function AddPurchaseTypeModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setName(""); setKey(""); setErr("") } }, [open])
  const submit = async () => {
    setErr("")
    if (!name.trim()) return setErr("Name is required.")
    setLoading(true)
    try { const created = await apiCreatePurchaseType({ name: name.trim(), key: key.trim() || undefined }); onCreated?.(created); onClose?.() } catch (e) { setErr(e?.message || "Failed to create purchase type") } finally { setLoading(false) }
  }
  return <ModalShell open={open} onClose={onClose} title="Add Purchase Type" subtitle="This will show in lead create/edit." icon={<FiPlus className="h-5 w-5" />} maxWidthClass="max-w-xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Creating..." : "Create"}</button></div>}>{err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}<div className="grid gap-4"><Field label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Service" /></Field><Field label="Key (optional)"><input value={key} onChange={(e) => setKey(e.target.value)} className={input} placeholder="service" /></Field></div></ModalShell>
}

function ItemEditor({ items, setItems, showDescription = false }) {
  const add = () => setItems((prev) => [...prev, { productId: "", nameSnapshot: "", description: "", qty: 1, unitPrice: 0, discount: 0 }])
  const update = (idx, key, value) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it))
  const remove = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx))
  const total = items.reduce((sum, it) => sum + Math.max(Number(it.qty || 0) * Number(it.unitPrice || 0) - Number(it.discount || 0), 0), 0)
  return (
    <div className="rounded-2xl border border-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3"><div><p className="text-sm font-bold text-gray-900">Items</p><p className="text-xs text-gray-500">Products/services included for amount calculation.</p></div><button type="button" onClick={add} className={cn(btn, btnGhost, "px-3 py-2")}><FiPlus className="h-4 w-4" />Add item</button></div>
      <div className="space-y-3 p-4">
        {items.length ? items.map((it, idx) => (
          <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4"><Field label="Name"><input value={it.nameSnapshot || ""} onChange={(e) => update(idx, "nameSnapshot", e.target.value)} className={input} placeholder="CRM setup" /></Field></div>
              <div className="md:col-span-2"><Field label="Qty"><input type="number" min="0" value={it.qty} onChange={(e) => update(idx, "qty", e.target.value)} className={input} /></Field></div>
              <div className="md:col-span-2"><Field label="Unit price"><input type="number" min="0" value={it.unitPrice} onChange={(e) => update(idx, "unitPrice", e.target.value)} className={input} /></Field></div>
              <div className="md:col-span-2"><Field label="Discount"><input type="number" min="0" value={it.discount} onChange={(e) => update(idx, "discount", e.target.value)} className={input} /></Field></div>
              <div className="flex items-end md:col-span-2"><button type="button" onClick={() => remove(idx)} className={cn(btn, btnDanger, "w-full")}><FiTrash2 className="h-4 w-4" />Remove</button></div>
              {showDescription ? <div className="md:col-span-12"><Field label="Description"><textarea value={it.description || ""} onChange={(e) => update(idx, "description", e.target.value)} className={cn(input, "min-h-[80px]")} /></Field></div> : null}
            </div>
          </div>
        )) : <EmptyState icon={<FiFileText className="h-5 w-5" />} title="No items added" subtitle="Add items if you need proposal/deal amount calculation." />}
        <div className="flex justify-end"><span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Estimated total: {formatMoney(total)}</span></div>
      </div>
    </div>
  )
}

function UserSelect({ value, onChange, users = [], label: labelText = "User", placeholder = "Use current user", allowEmpty = true, hint = "" }) {
  const safeUsers = Array.isArray(users) ? users : []
  return (
    <Field label={labelText} hint={hint || (!safeUsers.length ? "User list is available for admin/superadmin. Empty means backend will use current logged-in user." : "Select a user instead of typing raw ID.") }>
      <select className={input} value={value || ""} onChange={(e) => onChange?.(e.target.value)}>
        {allowEmpty ? <option value="">{placeholder}</option> : null}
        {safeUsers.map((u) => (
          <option key={u._id || u.id} value={u._id || u.id}>
            {u.name || u.email || u._id} {u.role ? `(${u.role})` : ""}
          </option>
        ))}
      </select>
    </Field>
  )
}

function getTemplatePayloadData(lead = {}) {
  return {
    leadId: getLeadId(lead),
    leadNumber: lead?.leadNumber || "",
    name: lead?.contact?.name || "",
    contactName: lead?.contact?.name || "",
    companyName: lead?.contact?.companyName || "",
    phone: lead?.contact?.phone || "",
    email: lead?.contact?.email || "",
    source: lead?.source || "",
    purchaseType: lead?.purchaseType || "",
    priority: lead?.priority || "",
    leadTemperature: lead?.leadTemperature || "",
    leadScore: lead?.leadScore || "",
    pipelineStage: lead?.pipelineStage || "",
    status: lead?.status || "",
    requirementSummary: lead?.requirement?.summary || "",
    expectedSolution: lead?.requirement?.expectedSolution || "",
    budgetMin: lead?.requirement?.budgetMin || "",
    budgetMax: lead?.requirement?.budgetMax || "",
    expectedValue: lead?.requirement?.expectedValue || "",
    timeline: lead?.requirement?.timeline || "",
    decisionMaker: lead?.requirement?.decisionMaker || "",
    nextAction: lead?.nextAction || "",
    nextFollowUpAt: formatDate(lead?.nextFollowUpAt, true),
    today: formatDate(new Date(), false),
  }
}

function renderTemplateText(text = "", data = {}) {
  return String(text || "").replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const value = getByPath(data, key) ?? data[key]
    return value === undefined || value === null ? "" : String(value)
  })
}

function getTemplateRenderFromResponse(response, fallbackTemplate, data) {
  const subjectRaw =
    response?.subject ||
    response?.data?.subject ||
    response?.template?.subject ||
    response?.rendered?.subject ||
    fallbackTemplate?.subject ||
    ""

  const bodyRaw =
    response?.body ||
    response?.data?.body ||
    response?.template?.body ||
    response?.rendered?.body ||
    fallbackTemplate?.body ||
    ""

  return {
    subject: renderTemplateText(subjectRaw, data),
    body: renderTemplateText(bodyRaw, data),
  }
}

function formatTemplateWithSubject(subject = "", body = "") {
  const cleanSubject = String(subject || "").trim()
  const cleanBody = String(body || "").trim()
  if (cleanSubject && cleanBody) return `Subject: ${cleanSubject}\n\n${cleanBody}`
  return cleanBody || cleanSubject
}

function templateChannelForActivity(type) {
  if (type === "call") return "call_note"
  if (type === "whatsapp") return "whatsapp"
  if (type === "email") return "email"
  if (type === "meeting") return "meeting"
  return "general"
}

function TemplateUseBox({ lead, channel = "general", purpose = "general", label: labelText = "Use template", onApply, append = true, includeSubjectInText = false }) {
  const [templates, setTemplates] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(false)
  const [usingTemplate, setUsingTemplate] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setErr("")
      try {
        const params = {}
        if (channel) params.channel = channel
        if (purpose) params.purpose = purpose
        const data = await apiListTemplates(params)
        const list = normalizeApiList(data).filter((t) => t?.isActive !== false)
        if (!alive) return
        setTemplates(list)
        setSelectedId((prev) => (prev && list.some((t) => (t._id || t.id) === prev) ? prev : (list[0]?._id || list[0]?.id || "")))
      } catch (e) {
        if (!alive) return
        setTemplates([])
        setSelectedId("")
        setErr(e?.message || "Failed to load templates")
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [channel, purpose])

  const selectedTemplate = templates.find((t) => (t._id || t.id) === selectedId)
  const apply = async () => {
    if (!selectedTemplate) return
    setUsingTemplate(true)
    setErr("")
    const data = getTemplatePayloadData(lead)
    try {
      const response = await apiUseTemplate(selectedId, { data, leadId: getLeadId(lead) || undefined })
      const rendered = getTemplateRenderFromResponse(response, selectedTemplate, data)
      const text = includeSubjectInText ? formatTemplateWithSubject(rendered.subject, rendered.body) : rendered.body
      onApply?.(text, { append, template: selectedTemplate, response, rendered })
    } catch (e) {
      const rendered = {
        subject: renderTemplateText(selectedTemplate?.subject || "", data),
        body: renderTemplateText(selectedTemplate?.body || "", data),
      }
      const text = includeSubjectInText ? formatTemplateWithSubject(rendered.subject, rendered.body) : rendered.body
      if (text) onApply?.(text, { append, template: selectedTemplate, response: null, rendered })
      else setErr(e?.message || "Template use failed")
    } finally {
      setUsingTemplate(false)
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">{labelText}</p>
          <p className="text-xs text-gray-500">Select a saved template and insert it into this field.</p>
        </div>
        <span className={cn(chip, "bg-white text-indigo-700 ring-indigo-600/10")}>{channel}{purpose ? ` • ${purpose}` : ""}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className={cn(input, "flex-1")} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={loading || usingTemplate || !templates.length}>
          {loading ? <option>Loading templates...</option> : null}
          {!loading && !templates.length ? <option value="">No template found</option> : null}
          {templates.map((t) => <option key={t._id || t.id} value={t._id || t.id}>{t.name || t.key || "Untitled template"}</option>)}
        </select>
        <button type="button" className={cn(btn, btnSoft, "shrink-0")} onClick={apply} disabled={loading || usingTemplate || !selectedTemplate}>
          {usingTemplate ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiFileText className="h-4 w-4" />}
          Insert template
        </button>
      </div>
      {selectedTemplate ? (
        <div className="mt-2 space-y-1 rounded-xl bg-white/70 px-3 py-2 text-xs text-gray-600">
          {selectedTemplate.subject ? <p className="line-clamp-1 font-semibold text-gray-700">Subject: {selectedTemplate.subject}</p> : null}
          {selectedTemplate.body ? <p className="line-clamp-2">{selectedTemplate.body}</p> : null}
        </div>
      ) : null}
      {err ? <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p> : null}
    </div>
  )
}

function appendTemplateText(current, text) {
  const clean = String(text || "").trim()
  if (!clean) return current || ""
  return current?.trim() ? `${current.trim()}\n\n${clean}` : clean
}

function LeadUpsertModal({ open, onClose, mode = "create", initial, onSaved, users = [], canAssignOwner = true }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", companyName: "", source: "", priority: "medium", leadTemperature: "warm", leadScore: 0, purchaseType: "", tags: "", website: "", industry: "", address: "", assignedTo: "", nextFollowUpAt: "", requirementSummary: "", expectedSolution: "", painPoints: "", budgetMin: "", budgetMax: "", expectedValue: "", timeline: "", decisionMaker: "" })
  const [purchaseTypes, setPurchaseTypes] = useState([])
  const [addPtOpen, setAddPtOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => {
    if (!open) return
    const c = initial || {}
    const r = c.requirement || {}
    setErr("")
    setForm({ name: c?.contact?.name || "", email: c?.contact?.email || "", phone: c?.contact?.phone || "", companyName: c?.contact?.companyName || "", source: c?.source || "", priority: c?.priority || "medium", leadTemperature: c?.leadTemperature || "warm", leadScore: c?.leadScore || 0, purchaseType: c?.purchaseType || "", tags: Array.isArray(c?.tags) ? c.tags.join(", ") : "", website: c?.company?.website || "", industry: c?.company?.industry || "", address: c?.company?.address || "", assignedTo: typeof c?.assignedTo === "string" ? c.assignedTo : c?.assignedTo?._id || "", nextFollowUpAt: formatDateInput(c?.nextFollowUpAt), requirementSummary: r.summary || "", expectedSolution: r.expectedSolution || "", painPoints: Array.isArray(r.painPoints) ? r.painPoints.join(", ") : "", budgetMin: r.budgetMin || "", budgetMax: r.budgetMax || "", expectedValue: r.expectedValue || "", timeline: r.timeline || "", decisionMaker: r.decisionMaker || "" })
    apiListPurchaseTypes().then(setPurchaseTypes).catch(() => setPurchaseTypes([]))
  }, [open, initial])
  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const submit = async () => {
    setErr("")
    if (!form.name.trim()) return setErr("Contact name is required.")
    if (!form.companyName.trim()) return setErr("Company name is required.")
    const payload = { contact: { name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), companyName: form.companyName.trim() }, source: form.source.trim(), priority: form.priority, leadTemperature: form.leadTemperature, leadScore: Number(form.leadScore || 0), purchaseType: form.purchaseType.trim(), tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), company: { website: form.website.trim(), industry: form.industry.trim(), address: form.address.trim() }, requirement: { summary: form.requirementSummary.trim(), expectedSolution: form.expectedSolution.trim(), painPoints: form.painPoints.split(",").map((p) => p.trim()).filter(Boolean), budgetMin: Number(form.budgetMin || 0), budgetMax: Number(form.budgetMax || 0), expectedValue: Number(form.expectedValue || 0), timeline: form.timeline.trim(), decisionMaker: form.decisionMaker.trim() }, ...(form.assignedTo.trim() ? { assignedTo: form.assignedTo.trim() } : {}), ...(form.nextFollowUpAt ? { nextFollowUpAt: new Date(form.nextFollowUpAt).toISOString() } : {}) }
    setLoading(true)
    try { if (mode === "edit") await apiUpdateLead(getLeadId(initial), payload); else await apiCreateLead(payload); onSaved?.(); onClose?.() } catch (e) { setErr(e?.message || "Save failed") } finally { setLoading(false) }
  }
  return (
    <>
      <ModalShell open={open} onClose={onClose} title={mode === "edit" ? "Edit Lead" : "Create Lead"} subtitle="Contact, score, source, discovery and assignment fields" icon={mode === "edit" ? <FiEdit2 className="h-5 w-5" /> : <FiPlus className="h-5 w-5" />} maxWidthClass="max-w-5xl" footer={<div className="flex flex-col justify-end gap-2 sm:flex-row"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : mode === "edit" ? "Update lead" : "Create lead"}</button></div>}>
        {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Contact name *"><input className={input} value={form.name} onChange={update("name")} /></Field><Field label="Company name *"><input className={input} value={form.companyName} onChange={update("companyName")} /></Field><Field label="Email"><input className={input} value={form.email} onChange={update("email")} /></Field><Field label="Phone"><input className={input} value={form.phone} onChange={update("phone")} /></Field>
          <Field label="Priority"><select className={input} value={form.priority} onChange={update("priority")}>{PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field><Field label="Lead temperature"><select className={input} value={form.leadTemperature} onChange={update("leadTemperature")}>{TEMPERATURES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field><Field label="Lead score"><input className={input} type="number" min="0" max="100" value={form.leadScore} onChange={update("leadScore")} /></Field>
          <Field label="Purchase type"><div className="flex gap-2"><select className={cn(input, "flex-1")} value={form.purchaseType} onChange={update("purchaseType")}><option value="">Select purchase type</option>{purchaseTypes.map((pt) => <option key={pt.key || pt._id} value={pt.key || pt.name}>{pt.name || pt.key}</option>)}</select><button type="button" className={cn(btn, btnGhost, "px-3")} onClick={() => setAddPtOpen(true)}><FiPlus className="h-4 w-4" /></button></div></Field>
          <Field label="Source"><input className={input} value={form.source} onChange={update("source")} /></Field><Field label="Next follow-up"><input type="datetime-local" className={input} value={form.nextFollowUpAt} onChange={update("nextFollowUpAt")} /></Field><Field label="Tags"><input className={input} value={form.tags} onChange={update("tags")} /></Field>{canAssignOwner ? <UserSelect label="Assign owner" value={form.assignedTo} users={users} onChange={(val) => setForm((p) => ({ ...p, assignedTo: val }))} placeholder="Use current user" /> : null}
          <div className="md:col-span-2 rounded-2xl border border-gray-100 p-4"><p className="mb-3 text-sm font-bold text-gray-900">Company info</p><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Website"><input className={input} value={form.website} onChange={update("website")} /></Field><Field label="Industry"><input className={input} value={form.industry} onChange={update("industry")} /></Field><div className="md:col-span-2"><Field label="Address"><input className={input} value={form.address} onChange={update("address")} /></Field></div></div></div>
          <div className="md:col-span-2 rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4"><p className="mb-3 text-sm font-bold text-gray-900">Requirement / discovery</p><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="md:col-span-2"><Field label="Requirement summary"><textarea className={cn(input, "min-h-[90px]")} value={form.requirementSummary} onChange={update("requirementSummary")} /></Field></div><div className="md:col-span-2"><Field label="Expected solution"><textarea className={cn(input, "min-h-[80px]")} value={form.expectedSolution} onChange={update("expectedSolution")} /></Field></div><Field label="Pain points"><input className={input} value={form.painPoints} onChange={update("painPoints")} /></Field><Field label="Decision maker"><input className={input} value={form.decisionMaker} onChange={update("decisionMaker")} /></Field><Field label="Budget min"><input className={input} type="number" value={form.budgetMin} onChange={update("budgetMin")} /></Field><Field label="Budget max"><input className={input} type="number" value={form.budgetMax} onChange={update("budgetMax")} /></Field><Field label="Expected value"><input className={input} type="number" value={form.expectedValue} onChange={update("expectedValue")} /></Field><Field label="Timeline"><input className={input} value={form.timeline} onChange={update("timeline")} /></Field></div></div>
        </div>
      </ModalShell>
      <AddPurchaseTypeModal open={addPtOpen} onClose={() => setAddPtOpen(false)} onCreated={(created) => { apiListPurchaseTypes().then(setPurchaseTypes); if (created?.key) setForm((p) => ({ ...p, purchaseType: created.key })) }} />
    </>
  )
}

function NoteModal({ open, onClose, lead, onSaved }) {
  const [form, setForm] = useState({ note: "", type: "general", reason: "" })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setForm({ note: "", type: "general", reason: "" }); setErr("") } }, [open])
  const submit = async () => { setErr(""); if (!form.note.trim()) return setErr("Note is required."); setLoading(true); try { await apiAddLeadNote(getLeadId(lead), form); onSaved?.(); onClose?.() } catch (e) { setErr(e?.message || "Failed") } finally { setLoading(false) } }
  return <ModalShell open={open} onClose={onClose} title="Add note" subtitle={lead?.contact?.name || ""} icon={<FiFileText className="h-5 w-5" />} maxWidthClass="max-w-xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : "Add note"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
    <div className="grid gap-4">
      <Field label="Type"><select className={input} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>{["general", "call", "email", "meeting", "whatsapp", "follow_up", "stage_change", "quick_action", "lost_reason", "won_reason"].map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Reason"><input className={input} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} /></Field>
      <TemplateUseBox lead={lead} channel={form.type === "call" ? "call_note" : ["email", "meeting", "whatsapp"].includes(form.type) ? form.type : "general"} purpose={form.type === "follow_up" ? "follow_up" : "general"} label="Insert note template" onApply={(text) => setForm((p) => ({ ...p, note: appendTemplateText(p.note, text) }))} />
      <Field label="Note *"><textarea className={cn(input, "min-h-[140px]")} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} /></Field>
    </div>
  </ModalShell>
}

function StageProgressController({ lead, onNextStage, onMoveStage, compact = false, selectedStage = "", timeline = null }) {
  const currentStage = String(lead?.pipelineStage || "new")
  const currentIndex = getStageIndex(currentStage)
  const nextStage = getNextPipelineStage(lead)
  const finalStage = isFinalPipelineStage(currentStage)
  const progressStages = ACTIVE_PIPELINE_STAGES
  const selected = selectedStage || nextStage || currentStage

  const StepDot = ({ stage, index }) => {
    const completed = finalStage || index < currentIndex
    const active = stage === currentStage
    const selectedDot = stage === selected && stage !== currentStage
    return (
      <div className="flex min-w-0 flex-1 items-center">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black transition",
              completed
                ? "border-emerald-600 bg-emerald-600 text-white"
                : active
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : selectedDot
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-400"
            )}
          >
            {completed ? <FiCheck className="h-4 w-4" /> : index + 1}
          </div>
          <div className="min-w-0">
            <p className={cn("truncate text-xs font-black", active || selectedDot ? "text-indigo-700" : completed ? "text-emerald-700" : "text-gray-500")}>{STAGE_LABELS[stage] || stage}</p>
            {!compact ? <p className="mt-0.5 hidden text-[11px] font-medium text-gray-400 md:block">{STAGE_REQUIREMENTS[stage]}</p> : null}
          </div>
        </div>
        {index < progressStages.length - 1 ? (
          <div className={cn("mx-1 h-0.5 flex-1 rounded-full", index < currentIndex || finalStage ? "bg-emerald-300" : "bg-gray-200")} />
        ) : null}
      </div>
    )
  }

  const StageDetailCard = ({ stage, index }) => {
    const state = getStageState(stage, lead, selected, timeline)
    const detail = getStageDetailSummary(stage, lead, timeline)
    const current = stage === currentStage
    const isSelected = stage === selected && stage !== currentStage
    const done = state === "Done"
    const required = state === "Required"

    return (
      <div
        className={cn(
          "rounded-2xl border p-3 transition",
          current
            ? "border-indigo-200 bg-indigo-50/70"
            : required
              ? "border-amber-200 bg-amber-50/80"
              : done
                ? "border-emerald-100 bg-emerald-50/60"
                : isSelected
                  ? "border-indigo-100 bg-white"
                  : "border-gray-100 bg-gray-50/60"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={cn("text-xs font-black", current || isSelected ? "text-indigo-700" : done ? "text-emerald-700" : required ? "text-amber-800" : "text-gray-600")}>{index + 1}. {STAGE_LABELS[stage] || stage}</p>
          <span className={cn(chip, "px-2 py-1", current || isSelected ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10" : done ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" : required ? "bg-amber-50 text-amber-800 ring-amber-600/20" : "bg-gray-100 text-gray-600 ring-gray-600/10")}>{state}</span>
        </div>
        <p className="text-sm font-black text-gray-950">{detail.title}</p>
        <p className="mt-1 line-clamp-2 text-xs font-semibold text-gray-600">{detail.text}</p>
        {detail.meta ? <p className="mt-2 truncate text-[11px] font-bold text-gray-400">{detail.meta}</p> : null}
      </div>
    )
  }

  return (
    <div className={cn("rounded-2xl border border-gray-200 bg-white", compact ? "p-4" : "p-5")}> 
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-950">Stage flow</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {nextStage ? `${STAGE_LABELS[currentStage] || currentStage} → ${STAGE_LABELS[nextStage] || nextStage}` : finalStage ? "Pipeline closed" : "No next stage available"}
          </p>
        </div>
        {!compact ? (
          <div className="flex flex-wrap gap-2">
            <button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onMoveStage?.(lead)}>
              <FiUnlock className="h-4 w-4" /> Manual jump
            </button>
            <button className={cn(btn, btnPrimary, "px-3 py-2")} disabled={!nextStage || finalStage} onClick={() => onNextStage?.(lead)}>
              <FiArrowRight className="h-4 w-4" />
              {nextStage ? `Next: ${STAGE_LABELS[nextStage] || nextStage}` : finalStage ? "Final stage" : "No next stage"}
            </button>
          </div>
        ) : null}
      </div>

      <div className={cn("mt-4", compact ? "px-1" : "")}> 
        <div className="flex w-full items-start">
          {progressStages.map((stage, index) => <StepDot key={stage} stage={stage} index={index} />)}
        </div>
      </div>

      {compact ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {progressStages.map((stage, index) => <StageDetailCard key={stage} stage={stage} index={index} />)}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-600">
          <Badge value={`Current: ${STAGE_LABELS[currentStage] || currentStage}`} />
          {nextStage ? <Badge value={`Next: ${STAGE_LABELS[nextStage] || nextStage}`} /> : <Badge value={finalStage ? "Pipeline closed" : "Last active stage"} />}
          <span className="text-gray-400">Default flow moves one step. Use manual jump only for exception cases.</span>
        </div>
      ) : null}
    </div>
  )
}

function StageModal({ open, onClose, lead, onSaved, targetStage = "", lockStage = false, mode = "manual", onOpenRequirement, onOpenProposal, refreshToken = 0 }) {
  const nextStage = targetStage || getNextPipelineStage(lead)
  const initialStage = lockStage && nextStage ? nextStage : lead?.pipelineStage || "qualified"
  const [form, setForm] = useState({ pipelineStage: initialStage, status: "", reason: "", note: "", nextFollowUpAt: "" })
  const [unlockedJump, setUnlockedJump] = useState(false)
  const currentStage = lead?.pipelineStage || "new"
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [stageGate, setStageGate] = useState({ checking: false, timeline: null, fullLead: null })

  useEffect(() => {
    if (open) {
      const safeTarget = lockStage && nextStage ? nextStage : lead?.pipelineStage || "qualified"
      setErr("")
      setUnlockedJump(false)
      setForm({
        pipelineStage: safeTarget,
        status: getSuggestedStatusForStage(safeTarget, lead?.status || ""),
        reason: lockStage && nextStage ? `Completed ${STAGE_LABELS[lead?.pipelineStage || "new"] || lead?.pipelineStage || "new"} stage and moved to ${STAGE_LABELS[nextStage] || nextStage}.` : "",
        note: "",
        nextFollowUpAt: "",
      })
    }
  }, [open, lead, lockStage, nextStage])

  useEffect(() => {
    if (!open || !lead) return
    const selected = String((lockStage && nextStage ? nextStage : lead?.pipelineStage) || "")
    const shouldCheckProposal = ["proposal", "negotiation"].includes(selected) || ["proposal", "negotiation"].includes(String(nextStage || ""))
    let ignore = false
    setStageGate((p) => ({ ...p, checking: true }))
    Promise.all([
      apiGetLead(getLeadId(lead)).catch(() => null),
      shouldCheckProposal ? apiGetLeadTimeline(getLeadId(lead)).catch(() => null) : Promise.resolve(null),
    ])
      .then(([leadData, timelineData]) => {
        if (ignore) return
        setStageGate({
          checking: false,
          fullLead: leadData?.lead || leadData?.data || leadData || null,
          timeline: timelineData?.timeline || timelineData || null,
        })
      })
      .catch(() => { if (!ignore) setStageGate({ checking: false, timeline: null, fullLead: null }) })
    return () => { ignore = true }
  }, [open, lead, lockStage, nextStage, refreshToken])

  const isStageLocked = lockStage && !unlockedJump
  const currentIndex = PIPELINE_STAGES.indexOf(String(currentStage || "new"))
  const selectedIndex = PIPELINE_STAGES.indexOf(String(form.pipelineStage || ""))
  const jumpCount = currentIndex >= 0 && selectedIndex >= 0 ? Math.abs(selectedIndex - currentIndex) : 0
  const isJumpingMultipleStages = unlockedJump && jumpCount > 1

  const handleToggleUnlock = (checked) => {
    setUnlockedJump(checked)
    setForm((p) => ({
      ...p,
      reason: checked
        ? `Exceptional stage jump from ${STAGE_LABELS[currentStage] || currentStage} to ${STAGE_LABELS[p.pipelineStage] || p.pipelineStage}. Lead progress changed faster than the normal flow.`
        : nextStage
          ? `Completed ${STAGE_LABELS[currentStage] || currentStage} stage and moved to ${STAGE_LABELS[nextStage] || nextStage}.`
          : p.reason,
    }))
  }

  const handleStageChange = (value) => {
    setForm((p) => ({
      ...p,
      pipelineStage: value,
      status: getSuggestedStatusForStage(value, p.status),
      reason: unlockedJump
        ? `Exceptional stage jump from ${STAGE_LABELS[currentStage] || currentStage} to ${STAGE_LABELS[value] || value}. Lead progress changed faster than the normal flow.`
        : p.reason,
    }))
  }

  const submit = async () => {
    setErr("")
    if (!form.pipelineStage) return setErr("Stage is required.")
    if (isStageLocked && !nextStage) return setErr("This lead has no next stage available.")
    if (unlockedJump && form.pipelineStage === currentStage) return setErr("Select a different stage to update this lead.")
    if (stageBlocked) return setErr(stageBlockedText)
    if (!form.reason.trim()) return setErr("Reason is required.")
    setLoading(true)
    try {
      await apiUpdateLeadStage(getLeadId(lead), {
        pipelineStage: form.pipelineStage,
        ...(form.status ? { status: form.status } : {}),
        reason: form.reason.trim(),
        note: form.note.trim(),
        ...(form.nextFollowUpAt ? { nextFollowUpAt: new Date(form.nextFollowUpAt).toISOString() } : {}),
      })
      const closeAfterSave = await onSaved?.({ pipelineStage: form.pipelineStage, lead })
      if (closeAfterSave !== false) onClose?.()
    } catch (e) {
      setErr(e?.message || "Stage update failed")
    } finally {
      setLoading(false)
    }
  }

  const title = mode === "next" ? (unlockedJump ? "Jump stage" : "Move to next stage") : "Update stage"
  const subtitle = mode === "next" && nextStage ? `${STAGE_LABELS[currentStage] || currentStage} → ${STAGE_LABELS[nextStage] || nextStage}` : lead?.contact?.name || ""
  const selectedStage = String(form.pipelineStage || "")
  const gateLead = stageGate.fullLead || lead
  const requirementReady = hasRequirementDetails(gateLead)
  const requirementStarted = hasAnyRequirementDetails(gateLead)
  const proposals = Array.isArray(stageGate.timeline?.proposals) ? stageGate.timeline.proposals : []
  const latestProposal = proposals[0] || null
  const proposalReady = hasProposalWork(gateLead, stageGate.timeline)
  const needsRequirementBeforeMove = selectedStage === "discovery" && !requirementReady
  const needsProposalBeforeMove = selectedStage === "proposal" && !proposalReady
  const needsProposalBeforeNegotiation = currentStage === "proposal" && selectedStage === "negotiation" && !proposalReady
  const missingRequirements = getMissingRequirementLabels(gateLead)
  const stageBlocked = needsRequirementBeforeMove || needsProposalBeforeMove || needsProposalBeforeNegotiation
  const stageBlockedText = needsRequirementBeforeMove
    ? `Before moving to Discovery, fill: ${missingRequirements.join(", ")}.`
    : "Before continuing this stage flow, create the proposal from this lead so the backend can save proposal history and sync the stage properly."
  const showRequirementWork = selectedStage === "discovery"
  const showProposalWork = selectedStage === "proposal"

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<FiArrowRight className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button>
          <button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading || stageGate.checking || stageBlocked || (isStageLocked && !nextStage)}>
            {loading ? "Saving..." : stageGate.checking ? "Checking..." : stageBlocked ? "Complete required work first" : mode === "next" ? (unlockedJump ? "Update stage" : "Complete & move next") : "Move stage"}
          </button>
        </div>
      }
    >
      {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 rounded-xl bg-gray-100 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Current</p>
              <p className="truncate text-sm font-black text-gray-800">{STAGE_LABELS[currentStage] || currentStage}</p>
            </div>
            <FiArrowRight className="h-5 w-5 shrink-0 text-gray-300" />
            <div className="min-w-0 rounded-xl bg-indigo-50 px-3 py-2 ring-1 ring-indigo-100">
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Moving to</p>
              <p className="truncate text-sm font-black text-indigo-700">{STAGE_LABELS[form.pipelineStage] || form.pipelineStage || "No next stage"}</p>
            </div>
          </div>

          {lockStage ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="text-sm font-bold text-gray-700">Manual stage</span>
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 rounded border-gray-300 accent-indigo-600"
                checked={unlockedJump}
                onChange={(e) => handleToggleUnlock(e.target.checked)}
              />
            </label>
          ) : (
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">Manual update</span>
          )}
        </div>

        {!isStageLocked ? (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <Field label="Choose stage">
              <select className={input} value={form.pipelineStage} onChange={(e) => handleStageChange(e.target.value)}>
                {PIPELINE_STAGES.filter((x) => !["negotiation", "won"].includes(x)).map((x) => <option key={x} value={x}>{STAGE_LABELS[x] || x}</option>)}
              </select>
            </Field>
          </div>
        ) : null}
      </div>

      {isJumpingMultipleStages ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Multi-stage jump selected. Write a clear reason so the A-Z history explains why stages were skipped.</span>
        </div>
      ) : null}

      {showRequirementWork ? (
        <div className={cn("mt-3 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between", requirementReady ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70")}>
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm", requirementReady ? "text-emerald-700" : "text-amber-700")}>
              {requirementReady ? <FiCheckCircle className="h-5 w-5" /> : <FiTarget className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-black", requirementReady ? "text-emerald-950" : "text-amber-950")}>{requirementReady ? "Requirement saved" : requirementStarted ? "Requirement needs completion" : "Requirement not added"}</p>
              <p className={cn("mt-0.5 text-xs font-semibold", requirementReady ? "text-emerald-700" : "text-amber-700")}>{requirementReady ? "Review or edit the saved discovery details before moving." : `${missingRequirements.length} required ${missingRequirements.length === 1 ? "field" : "fields"} remaining.`}</p>
            </div>
          </div>
          <button type="button" className={cn(btn, requirementReady || requirementStarted ? btnGhost : btnPrimary, "shrink-0 px-4 py-2")} onClick={() => onOpenRequirement?.(gateLead)}>
            <FiTarget className="h-4 w-4" /> {requirementReady || requirementStarted ? "Edit Requirement" : "Complete Requirement"}
          </button>
        </div>
      ) : null}

      {showProposalWork ? (
        <div className={cn("mt-3 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between", proposalReady ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70")}>
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm", proposalReady ? "text-emerald-700" : "text-amber-700")}>
              {proposalReady ? <FiCheckCircle className="h-5 w-5" /> : <FiFileText className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-black", proposalReady ? "text-emerald-950" : "text-amber-950")}>{proposalReady ? "Proposal saved" : "Proposal not created"}</p>
              <p className={cn("mt-0.5 text-xs font-semibold", proposalReady ? "text-emerald-700" : "text-amber-700")}>{proposalReady ? `${latestProposal?.proposalNo || latestProposal?.title || "Proposal"} · ${latestProposal?.status || "draft"}` : "Create and save the proposal before moving."}</p>
            </div>
          </div>
          <button type="button" className={cn(btn, proposalReady ? btnGhost : btnPrimary, "shrink-0 px-4 py-2")} onClick={() => onOpenProposal?.(proposalReady && latestProposal ? { ...gateLead, _editingProposal: latestProposal } : gateLead)}>
            <FiFileText className="h-4 w-4" /> {proposalReady ? "Edit Proposal" : "Create Proposal"}
          </button>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Status">
          <select className={input} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="">Keep current</option>
            {LEAD_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Next follow-up">
          <input className={input} type="datetime-local" value={form.nextFollowUpAt} onChange={(e) => setForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))} />
        </Field>

        <div className="md:col-span-2">
          <Field label="Reason *" hint="Saved in the A-Z timeline/history.">
            <input className={input} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Extra note">
            <textarea className={cn(input, "min-h-[90px]")} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
          </Field>
        </div>

      </div>
    </ModalShell>
  )
}

function RequirementModal({ open, onClose, lead, onSaved }) {
  const r = lead?.requirement || {}
  const decisionMakerOptions = ["Owner", "CEO / Founder", "Manager", "Accounts Head", "Procurement Officer", "IT Head", "Admin", "Unknown"]
  const [form, setForm] = useState({ summary: "", painPoints: "", expectedSolution: "", budgetMin: "", budgetMax: "", expectedValue: "", timeline: "", decisionMaker: "", note: "" })
  const [decisionMakerOption, setDecisionMakerOption] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})
  useEffect(() => {
    if (!open) return
    const savedDecisionMaker = String(r.decisionMaker || "").trim()
    setErr("")
    setFieldErrors({})
    setDecisionMakerOption(savedDecisionMaker ? (decisionMakerOptions.includes(savedDecisionMaker) ? savedDecisionMaker : "Other") : "")
    setForm({ summary: r.summary || "", painPoints: Array.isArray(r.painPoints) ? r.painPoints.join(", ") : "", expectedSolution: r.expectedSolution || "", budgetMin: r.budgetMin || "", budgetMax: r.budgetMax || "", expectedValue: r.expectedValue || "", timeline: r.timeline || "", decisionMaker: savedDecisionMaker, note: "" })
  }, [open, lead])

  const validate = (values = form) => {
    const errors = {}
    if (!values.summary.trim()) errors.summary = "Add a short requirement summary."
    if (!values.expectedSolution.trim()) errors.expectedSolution = "Describe the expected solution."
    if (!values.timeline.trim()) errors.timeline = "Add the expected timeline."
    if (!values.decisionMaker.trim()) errors.decisionMaker = "Add the decision maker."
    return errors
  }

  const updateField = (key, value) => {
    const next = { ...form, [key]: value }
    setForm(next)
    if (fieldErrors[key]) {
      setFieldErrors(validate(next))
    }
  }

  const validateField = (key) => {
    const errors = validate(form)
    setFieldErrors((prev) => ({ ...prev, [key]: errors[key] }))
  }

  const invalidInput = "border-rose-300 bg-rose-50/40 focus-visible:ring-rose-400/40"
  const InlineError = ({ message }) => message ? <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-rose-600"><FiAlertCircle className="h-3.5 w-3.5 shrink-0" />{message}</p> : null
  const OptionalLabel = ({ children }) => <>{children} <span className="font-medium text-gray-400">(optional)</span></>

  const submit = async () => {
    setErr("")
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    setLoading(true)
    try {
      const data = await apiUpdateRequirement(getLeadId(lead), { summary: form.summary.trim(), painPoints: form.painPoints.split(",").map((p) => p.trim()).filter(Boolean), expectedSolution: form.expectedSolution.trim(), budgetMin: Number(form.budgetMin || 0), budgetMax: Number(form.budgetMax || 0), expectedValue: Number(form.expectedValue || 0), timeline: form.timeline.trim(), decisionMaker: form.decisionMaker.trim(), note: form.note.trim() })
      onSaved?.(data?.lead || data?.data?.lead || data)
      onClose?.()
    } catch (e) {
      setErr(e?.message || "Requirement update failed")
    } finally {
      setLoading(false)
    }
  }
  return (
    <ModalShell open={open} onClose={onClose} title="Requirement / Discovery" subtitle={lead?.contact?.name || ""} icon={<FiTarget className="h-5 w-5" />} maxWidthClass="max-w-3xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : "Save requirement"}</button></div>}>
      {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Requirement summary *">
            <textarea className={cn(input, "min-h-[100px]", fieldErrors.summary && invalidInput)} value={form.summary} onChange={(e) => updateField("summary", e.target.value)} onBlur={() => validateField("summary")} />
            <InlineError message={fieldErrors.summary} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Expected solution *">
            <textarea className={cn(input, "min-h-[90px]", fieldErrors.expectedSolution && invalidInput)} value={form.expectedSolution} onChange={(e) => updateField("expectedSolution", e.target.value)} onBlur={() => validateField("expectedSolution")} />
            <InlineError message={fieldErrors.expectedSolution} />
          </Field>
        </div>
        <Field label={<OptionalLabel>Pain points</OptionalLabel>}>
          <input className={input} value={form.painPoints} onChange={(e) => updateField("painPoints", e.target.value)} />
        </Field>
        <Field label="Decision maker *">
          <select
            className={cn(input, fieldErrors.decisionMaker && invalidInput)}
            value={decisionMakerOption}
            onChange={(e) => {
              const value = e.target.value
              setDecisionMakerOption(value)
              updateField("decisionMaker", value === "Other" ? "" : value)
            }}
            onBlur={() => validateField("decisionMaker")}
          >
            <option value="">Select decision maker</option>
            {decisionMakerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            <option value="Other">Other</option>
          </select>
          {decisionMakerOption === "Other" ? (
            <input
              className={cn(input, "mt-2", fieldErrors.decisionMaker && invalidInput)}
              value={form.decisionMaker}
              onChange={(e) => updateField("decisionMaker", e.target.value)}
              onBlur={() => validateField("decisionMaker")}
              placeholder="Type decision maker"
            />
          ) : null}
          <InlineError message={fieldErrors.decisionMaker} />
        </Field>

        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 md:col-span-2">
          <div className="mb-3">
            <p className="text-sm font-bold text-gray-900"><OptionalLabel>Budget or expected value</OptionalLabel></p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label={<OptionalLabel>Budget min</OptionalLabel>}>
              <input type="number" min="0" className={input} value={form.budgetMin} onChange={(e) => updateField("budgetMin", e.target.value)} />
            </Field>
            <Field label={<OptionalLabel>Budget max</OptionalLabel>}>
              <input type="number" min="0" className={input} value={form.budgetMax} onChange={(e) => updateField("budgetMax", e.target.value)} />
            </Field>
            <Field label={<OptionalLabel>Expected value</OptionalLabel>}>
              <input type="number" min="0" className={input} value={form.expectedValue} onChange={(e) => updateField("expectedValue", e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="md:col-span-2">
          <Field label="Timeline *">
            <input className={cn(input, fieldErrors.timeline && invalidInput)} value={form.timeline} onChange={(e) => updateField("timeline", e.target.value)} onBlur={() => validateField("timeline")} placeholder="Example: Within 30 days" />
            <InlineError message={fieldErrors.timeline} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={<OptionalLabel>Note</OptionalLabel>}>
            <textarea className={cn(input, "min-h-[80px]")} value={form.note} onChange={(e) => updateField("note", e.target.value)} />
          </Field>
        </div>
      </div>
    </ModalShell>
  )
}

function FollowUpModal({ open, onClose, lead, onSaved }) {
  const [form, setForm] = useState({ nextFollowUpAt: "", note: "", nextAction: "" })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setErr(""); setForm({ nextFollowUpAt: formatDateInput(lead?.nextFollowUpAt), note: "", nextAction: lead?.nextAction || "Follow up with this lead" }) } }, [open, lead])
  const submit = async () => { setErr(""); if (!form.nextFollowUpAt) return setErr("Follow-up date is required."); setLoading(true); try { await apiSetFollowUp(getLeadId(lead), { nextFollowUpAt: new Date(form.nextFollowUpAt).toISOString(), note: form.note.trim(), nextAction: form.nextAction.trim() }); onSaved?.(); onClose?.() } catch (e) { setErr(e?.message || "Follow-up failed") } finally { setLoading(false) } }
  return <ModalShell open={open} onClose={onClose} title="Set follow-up" subtitle={lead?.contact?.name || ""} icon={<FiCalendar className="h-5 w-5" />} maxWidthClass="max-w-xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : "Save follow-up"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
    <div className="grid gap-4">
      <Field label="Date & time *"><input type="datetime-local" className={input} value={form.nextFollowUpAt} onChange={(e) => setForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))} /></Field>
      <TemplateUseBox lead={lead} channel="general" purpose="follow_up" label="Insert follow-up template" onApply={(text) => setForm((p) => ({ ...p, note: appendTemplateText(p.note, text) }))} />
      <Field label="Next action"><input className={input} value={form.nextAction} onChange={(e) => setForm((p) => ({ ...p, nextAction: e.target.value }))} /></Field>
      <Field label="Note"><textarea className={cn(input, "min-h-[100px]")} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} /></Field>
    </div>
  </ModalShell>
}

function ActivityModal({ open, onClose, lead, onSaved, users = [] }) {
  const [form, setForm] = useState({ type: "call", status: "pending", priority: "medium", title: "", body: "", scheduledAt: "", outcome: "", nextAction: "", nextActionDate: "", quickActionKey: "", activityResult: "", assignedTo: "" })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setErr(""); setForm({ type: "call", status: "pending", priority: lead?.priority || "medium", title: "", body: "", scheduledAt: "", outcome: "", nextAction: "", nextActionDate: "", quickActionKey: "", activityResult: "", assignedTo: typeof lead?.assignedTo === "string" ? lead.assignedTo : lead?.assignedTo?._id || "" }) } }, [open, lead])
  const submit = async () => { setLoading(true); setErr(""); try { await apiCreateActivity({ leadId: getLeadId(lead), ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null, nextActionDate: form.nextActionDate ? new Date(form.nextActionDate).toISOString() : null, assignedTo: form.assignedTo || undefined }); onSaved?.(); onClose?.() } catch (e) { setErr(e?.message || "Activity create failed") } finally { setLoading(false) } }
  return <ModalShell open={open} onClose={onClose} title="Create activity" subtitle={lead?.contact?.name || ""} icon={<FiActivity className="h-5 w-5" />} maxWidthClass="max-w-3xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Creating..." : "Create activity"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Type"><select className={input} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>{ACTIVITY_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Status"><select className={input} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>{ACTIVITY_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Priority"><select className={input} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Result"><select className={input} value={form.activityResult} onChange={(e) => setForm((p) => ({ ...p, activityResult: e.target.value }))}>{ACTIVITY_RESULTS.map((x) => <option key={x} value={x}>{x || "none"}</option>)}</select></Field>
      <Field label="Title"><input className={input} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></Field>
      <Field label="Scheduled at"><input type="datetime-local" className={input} value={form.scheduledAt} onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))} /></Field>
      <Field label="Next action date"><input type="datetime-local" className={input} value={form.nextActionDate} onChange={(e) => setForm((p) => ({ ...p, nextActionDate: e.target.value }))} /></Field>
      <UserSelect label="Assign activity to" value={form.assignedTo} users={users} onChange={(val) => setForm((p) => ({ ...p, assignedTo: val }))} placeholder="Use current user" />
      <div className="md:col-span-2"><TemplateUseBox lead={lead} channel={templateChannelForActivity(form.type)} purpose={form.type === "task_followup" ? "follow_up" : "general"} label="Insert activity template" onApply={(text, meta) => setForm((p) => ({ ...p, title: p.title || meta?.rendered?.subject || p.title, body: appendTemplateText(p.body, text) }))} /></div>
      <div className="md:col-span-2"><Field label="Outcome"><input className={input} value={form.outcome} onChange={(e) => setForm((p) => ({ ...p, outcome: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><Field label="Body"><textarea className={cn(input, "min-h-[100px]")} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><Field label="Next action"><textarea className={cn(input, "min-h-[80px]")} value={form.nextAction} onChange={(e) => setForm((p) => ({ ...p, nextAction: e.target.value }))} /></Field></div>
    </div>
  </ModalShell>
}

function ProposalModal({ open, onClose, lead, onSaved, users = [] }) {
  const editingProposal = lead?._editingProposal || null
  const [form, setForm] = useState({ title: "", currency: "BDT", validTill: "", terms: "", notes: "", ownerId: "" })
  const [items, setItems] = useState([{ nameSnapshot: "", description: "", qty: 1, unitPrice: 0, discount: 0 }])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setErr(""); setForm({ title: editingProposal?.title || (lead?.contact?.companyName ? `${lead.contact.companyName} Proposal` : ""), currency: editingProposal?.currency || "BDT", validTill: formatDateInput(editingProposal?.validTill, "date"), terms: editingProposal?.terms || "", notes: editingProposal?.notes || "", ownerId: editingProposal?.ownerId?._id || editingProposal?.ownerId || "" }); setItems(Array.isArray(editingProposal?.items) && editingProposal.items.length ? editingProposal.items.map((item) => ({ nameSnapshot: item.nameSnapshot || "", description: item.description || "", qty: item.qty || 1, unitPrice: item.unitPrice || 0, discount: item.discount || 0 })) : [{ nameSnapshot: lead?.purchaseType || "", description: "", qty: 1, unitPrice: lead?.requirement?.expectedValue || 0, discount: 0 }]) } }, [open, lead, editingProposal])
  const submit = async () => { setErr(""); if (!form.title.trim()) return setErr("Title is required."); setLoading(true); try { const payload = { leadId: getLeadId(lead), customerId: lead?.customerId?._id || lead?.customerId || null, title: form.title.trim(), currency: form.currency.trim() || "BDT", validTill: form.validTill ? new Date(form.validTill).toISOString() : null, terms: form.terms.trim(), notes: form.notes.trim(), ownerId: form.ownerId.trim() || undefined, items }; const data = editingProposal?._id ? await apiUpdateProposal(editingProposal._id, payload) : await apiCreateProposal(payload); onSaved?.(data?.lead || data?.data?.lead || data, data?.proposal || data?.data?.proposal); onClose?.() } catch (e) { setErr(e?.message || "Proposal save failed") } finally { setLoading(false) } }
  return <ModalShell open={open} onClose={onClose} title={editingProposal ? "Edit proposal / quotation" : "Create proposal / quotation"} subtitle={lead?.contact?.name || ""} icon={<FiFileText className="h-5 w-5" />} maxWidthClass="max-w-5xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : editingProposal ? "Save changes" : "Create proposal"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Title *"><input className={input} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></Field>
      <Field label="Currency"><input className={input} value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} /></Field>
      <Field label="Valid till"><input type="date" className={input} value={form.validTill} onChange={(e) => setForm((p) => ({ ...p, validTill: e.target.value }))} /></Field>
      <UserSelect label="Proposal owner" value={form.ownerId} users={users} onChange={(val) => setForm((p) => ({ ...p, ownerId: val }))} placeholder="Current logged-in user" />
      <div className="md:col-span-2"><TemplateUseBox lead={lead} channel="proposal_note" purpose="proposal_sent" label="Insert proposal template" includeSubjectInText onApply={(text) => setForm((p) => ({ ...p, notes: appendTemplateText(p.notes, text) }))} /></div>
      <div className="md:col-span-2"><Field label="Terms"><textarea className={cn(input, "min-h-[80px]")} value={form.terms} onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><Field label="Notes"><textarea className={cn(input, "min-h-[80px]")} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><ItemEditor items={items} setItems={setItems} showDescription /></div>
    </div>
  </ModalShell>
}

function DealModal({ open, onClose, lead, onSaved, users = [] }) {
  const proposal = lead?._dealProposal || null
  const [form, setForm] = useState({ title: "", currency: "BDT", probability: 60, expectedCloseDate: "", ownerId: "", notes: "", nextDealAction: "", nextDealActionAt: "", stuckReason: "" })
  const [items, setItems] = useState([{ nameSnapshot: "", qty: 1, unitPrice: 0, discount: 0 }])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setErr(""); setForm({ title: lead?.contact?.companyName ? `${lead.contact.companyName} Deal` : proposal?.title ? `${proposal.title} Deal` : "", currency: proposal?.currency || "BDT", probability: 60, expectedCloseDate: "", ownerId: "", notes: proposal?.notes || "", nextDealAction: "Negotiate with the client", nextDealActionAt: "", stuckReason: "" }); setItems(Array.isArray(proposal?.items) && proposal.items.length ? proposal.items.map((item) => ({ nameSnapshot: item.nameSnapshot || "", qty: item.qty || 1, unitPrice: item.unitPrice || 0, discount: item.discount || 0 })) : [{ nameSnapshot: lead?.purchaseType || "", qty: 1, unitPrice: proposal?.grandTotal || lead?.requirement?.expectedValue || 0, discount: 0 }]) } }, [open, lead, proposal])
  const submit = async () => { setErr(""); if (!proposal?._id) return setErr("Send or accept a proposal before creating a deal."); if (!form.title.trim()) return setErr("Title is required."); setLoading(true); try { await apiCreateDealFromProposal(proposal._id, { leadId: getLeadId(lead), title: form.title.trim(), stage: "negotiation", currency: form.currency.trim() || "BDT", items, probability: Number(form.probability || 60), expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString() : null, ownerId: form.ownerId.trim() || undefined, notes: form.notes.trim(), nextDealAction: form.nextDealAction.trim(), nextDealActionAt: form.nextDealActionAt ? new Date(form.nextDealActionAt).toISOString() : null, stuckReason: form.stuckReason.trim(), requirementSnapshot: { summary: lead?.requirement?.summary || "", budgetMin: lead?.requirement?.budgetMin || 0, budgetMax: lead?.requirement?.budgetMax || 0, expectedValue: lead?.requirement?.expectedValue || 0, timeline: lead?.requirement?.timeline || "", decisionMaker: lead?.requirement?.decisionMaker || "" } }); onSaved?.(); onClose?.() } catch (e) { setErr(e?.message || "Deal create failed") } finally { setLoading(false) } }
  return <ModalShell open={open} onClose={onClose} title="Create deal" subtitle={lead?.contact?.name || ""} icon={<FiBriefcase className="h-5 w-5" />} maxWidthClass="max-w-5xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Creating..." : "Create deal"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
    <div className={cn("mb-4 rounded-xl border p-3 text-sm font-semibold", proposal ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>{proposal ? `Creating from ${proposal.proposalNo || proposal.title} (${proposal.status}). Negotiation will continue inside this deal.` : "Send or accept a proposal before creating the deal."}</div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Source proposal"><input className={input} value={proposal?.proposalNo || proposal?.title || "No eligible proposal"} disabled readOnly /></Field>
      <Field label="Title *"><input className={input} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></Field>
      <Field label="Stage"><input className={input} value="Negotiation" disabled readOnly /></Field>
      <Field label="Currency"><input className={input} value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} /></Field>
      <Field label="Probability"><input type="number" min="0" max="100" className={input} value={form.probability} onChange={(e) => setForm((p) => ({ ...p, probability: e.target.value }))} /></Field>
      <Field label="Expected close date"><input type="date" className={input} value={form.expectedCloseDate} onChange={(e) => setForm((p) => ({ ...p, expectedCloseDate: e.target.value }))} /></Field>
      <Field label="Proposal status"><input className={input} value={proposal?.status || "—"} disabled readOnly /></Field>
      <UserSelect label="Deal owner" value={form.ownerId} users={users} onChange={(val) => setForm((p) => ({ ...p, ownerId: val }))} placeholder="Current logged-in user" />
      <div className="md:col-span-2"><TemplateUseBox lead={lead} channel="proposal_note" purpose="general" label="Insert deal template" includeSubjectInText onApply={(text) => setForm((p) => ({ ...p, notes: appendTemplateText(p.notes, text) }))} /></div>
      <Field label="Next deal action"><input className={input} value={form.nextDealAction} onChange={(e) => setForm((p) => ({ ...p, nextDealAction: e.target.value }))} /></Field>
      <Field label="Next action at"><input type="datetime-local" className={input} value={form.nextDealActionAt} onChange={(e) => setForm((p) => ({ ...p, nextDealActionAt: e.target.value }))} /></Field>
      <div className="md:col-span-2"><Field label="Stuck reason"><input className={input} value={form.stuckReason} onChange={(e) => setForm((p) => ({ ...p, stuckReason: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><Field label="Notes"><textarea className={cn(input, "min-h-[90px]")} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><ItemEditor items={items} setItems={setItems} /></div>
    </div>
  </ModalShell>
}

function DealUpdateModal({ open, onClose, deal, onSaved, users = [] }) {
  const [form, setForm] = useState({ title: "", stage: "negotiation", currency: "BDT", probability: 60, expectedCloseDate: "", ownerId: "", notes: "", nextDealAction: "", nextDealActionAt: "", stuckReason: "" })
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open || !deal) return
    setErr("")
    setForm({
      title: deal.title || "",
      stage: deal.stage || "negotiation",
      currency: deal.currency || "BDT",
      probability: deal.probability ?? 60,
      expectedCloseDate: formatDateInput(deal.expectedCloseDate, "date"),
      ownerId: deal.ownerId?._id || deal.ownerId || "",
      notes: deal.notes || "",
      nextDealAction: deal.nextDealAction || "",
      nextDealActionAt: formatDateInput(deal.nextDealActionAt),
      stuckReason: deal.stuckReason || "",
    })
    setItems(Array.isArray(deal.items) ? deal.items.map((item) => ({ nameSnapshot: item.nameSnapshot || "", qty: item.qty || 1, unitPrice: item.unitPrice || 0, discount: item.discount || 0 })) : [])
  }, [open, deal])

  const submit = async () => {
    setErr("")
    if (!form.title.trim()) return setErr("Title is required.")
    setLoading(true)
    try {
      await apiUpdateDeal(deal._id, {
        title: form.title.trim(),
        stage: form.stage,
        currency: form.currency.trim() || "BDT",
        probability: Number(form.probability || 0),
        expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString() : null,
        ownerId: form.ownerId || undefined,
        notes: form.notes.trim(),
        nextDealAction: form.nextDealAction.trim(),
        nextDealActionAt: form.nextDealActionAt ? new Date(form.nextDealActionAt).toISOString() : null,
        stuckReason: form.stuckReason.trim(),
        items,
      })
      await onSaved?.()
      onClose?.()
    } catch (e) {
      setErr(e?.message || "Deal update failed")
    } finally {
      setLoading(false)
    }
  }

  return <ModalShell open={open} onClose={onClose} title="Update deal" subtitle={deal?.dealNo || deal?.title || ""} icon={<FiBriefcase className="h-5 w-5" />} maxWidthClass="max-w-5xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : "Save deal"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Title *"><input className={input} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></Field>
      <Field label="Stage"><select className={input} value={form.stage} onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}>{["new", "qualified", "proposal", "negotiation"].map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage] || stage}</option>)}</select></Field>
      <Field label="Currency"><input className={input} value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} /></Field>
      <Field label="Probability"><input type="number" min="0" max="100" className={input} value={form.probability} onChange={(e) => setForm((p) => ({ ...p, probability: e.target.value }))} /></Field>
      <Field label="Expected close date"><input type="date" className={input} value={form.expectedCloseDate} onChange={(e) => setForm((p) => ({ ...p, expectedCloseDate: e.target.value }))} /></Field>
      <UserSelect label="Deal owner" value={form.ownerId} users={users} onChange={(value) => setForm((p) => ({ ...p, ownerId: value }))} />
      <Field label="Next deal action"><input className={input} value={form.nextDealAction} onChange={(e) => setForm((p) => ({ ...p, nextDealAction: e.target.value }))} /></Field>
      <Field label="Next action at"><input type="datetime-local" className={input} value={form.nextDealActionAt} onChange={(e) => setForm((p) => ({ ...p, nextDealActionAt: e.target.value }))} /></Field>
      <div className="md:col-span-2"><Field label="Stuck reason (optional)"><input className={input} value={form.stuckReason} onChange={(e) => setForm((p) => ({ ...p, stuckReason: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><Field label="Notes (optional)"><textarea className={cn(input, "min-h-[90px]")} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></Field></div>
      <div className="md:col-span-2"><ItemEditor items={items} setItems={setItems} /></div>
    </div>
  </ModalShell>
}

function RecordDetailsModal({ open, onClose, record, type }) {
  const isProposal = type === "proposal"
  const details = isProposal
    ? [["Proposal no", record?.proposalNo], ["Status", record?.status], ["Amount", record ? formatMoney(record.grandTotal, record.currency) : ""], ["Valid till", formatDate(record?.validTill)], ["Sent at", formatDate(record?.sentAt, true)], ["Terms", record?.terms], ["Notes", record?.notes]]
    : [["Deal no", record?.dealNo], ["Stage", record?.stage], ["Amount", record ? formatMoney(record.grandTotal, record.currency) : ""], ["Probability", record?.probability !== undefined ? `${record.probability}%` : ""], ["Health", record?.dealHealth], ["Expected close", formatDate(record?.expectedCloseDate)], ["Next action", record?.nextDealAction], ["Next action at", formatDate(record?.nextDealActionAt, true)], ["Notes", record?.notes]]

  return <ModalShell open={open} onClose={onClose} title={isProposal ? "Proposal details" : "Deal details"} subtitle={record?.proposalNo || record?.dealNo || record?.title || ""} icon={isProposal ? <FiFileText className="h-5 w-5" /> : <FiBriefcase className="h-5 w-5" />} maxWidthClass="max-w-3xl" footer={<div className="flex justify-end"><button className={cn(btn, btnPrimary)} onClick={onClose}>Close</button></div>}>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="md:col-span-2"><DetailRow label="Title" value={record?.title} /></div>
      {details.map(([labelText, value]) => <DetailRow key={labelText} label={labelText} value={value} />)}
    </div>
  </ModalShell>
}

function ReasonModal({ open, onClose, title, subtitle, icon, actionLabel, danger = false, onSubmit }) {
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setReason(""); setNote(""); setErr("") } }, [open])
  const submit = async () => { setErr(""); if (!reason.trim()) return setErr("Reason is required."); setLoading(true); try { await onSubmit?.({ reason: reason.trim(), note: note.trim() }); onClose?.() } catch (e) { setErr(e?.message || "Action failed") } finally { setLoading(false) } }
  return <ModalShell open={open} onClose={onClose} title={title} subtitle={subtitle} icon={icon} maxWidthClass="max-w-xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, danger ? "bg-rose-600 text-white hover:bg-rose-700" : btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : actionLabel}</button></div>}>{err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}<div className="grid gap-4"><Field label="Reason *"><input className={input} value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Field label="Extra note"><textarea className={cn(input, "min-h-[120px]")} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div></ModalShell>
}

function ConfirmDeleteModal({ open, leadName, loading, onClose, onConfirm }) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!open) return
    setPassword("")
    setShowPassword(false)
    setError("")
  }, [open])
  if (!open) return null
  const confirm = async () => {
    setError("")
    try {
      await onConfirm?.(password)
    } catch (err) {
      setError(err?.message || "Delete failed")
    }
  }
  return <ModalShell open={open} onClose={onClose} title={`Delete ${leadName || "lead"}?`} subtitle="" icon={<FiAlertTriangle className="h-5 w-5" />} maxWidthClass="max-w-md" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, "bg-rose-600 text-white hover:bg-rose-700")} onClick={confirm} disabled={loading || password.length < 6}>{loading ? "Deleting..." : "Delete"}</button></div>}>
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-900"><FiLock className="h-4 w-4 text-indigo-600" />Admin password</div>
      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">{error}</p> : null}
      <div className="relative mt-3">
        <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError("") }} placeholder="Admin password" autoComplete="current-password" className={cn(input, "pr-11")} />
        <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}</button>
      </div>
    </div>
  </ModalShell>
}

function QuickActionModal({ open, onClose, lead, onSaved }) {
  const [form, setForm] = useState({ action: "call_done", note: "", outcome: "", nextAction: "", nextActionDate: "" })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  useEffect(() => { if (open) { setErr(""); setForm({ action: "call_done", note: "", outcome: "", nextAction: lead?.nextAction || "", nextActionDate: "" }) } }, [open, lead])
  const submit = async () => { setErr(""); setLoading(true); try { await apiQuickAction({ leadId: getLeadId(lead), ...form, nextActionDate: form.nextActionDate ? new Date(form.nextActionDate).toISOString() : null }); onSaved?.(); onClose?.() } catch (e) { setErr(e?.message || "Quick action failed") } finally { setLoading(false) } }
  return <ModalShell open={open} onClose={onClose} title="Quick action" subtitle={lead?.contact?.name || ""} icon={<FiZap className="h-5 w-5" />} maxWidthClass="max-w-3xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading}>{loading ? "Saving..." : "Run action"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}
    <div className="grid gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{QUICK_ACTIONS.map(([key, text, Icon]) => {
        return <button key={key} type="button" className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", form.action === key ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-100 bg-white text-gray-800 hover:bg-gray-50")} onClick={() => setForm((p) => ({ ...p, action: key }))}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-bold">{text}</span>
        </button>
      })}</div>
      <Field label="Note"><textarea className={cn(input, "min-h-[90px]")} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} /></Field>
      <Field label="Outcome"><input className={input} value={form.outcome} onChange={(e) => setForm((p) => ({ ...p, outcome: e.target.value }))} /></Field>
      <Field label="Next action"><input className={input} value={form.nextAction} onChange={(e) => setForm((p) => ({ ...p, nextAction: e.target.value }))} /></Field>
      <Field label="Next action date"><input type="datetime-local" className={input} value={form.nextActionDate} onChange={(e) => setForm((p) => ({ ...p, nextActionDate: e.target.value }))} /></Field>
    </div>
  </ModalShell>
}

function AssignLeadModal({ open, onClose, lead, onSaved }) {
  const [users, setUsers] = useState([])
  const [primaryOwner, setPrimaryOwner] = useState("")
  const [selectedUsers, setSelectedUsers] = useState([])
  const [lockOwner, setLockOwner] = useState(true)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setErr("")
    setLockOwner(true)
    Promise.all([
      apiAvailableAssignees({ role: "marketing_team" }),
      apiGetLead(getLeadId(lead)).catch(() => lead),
    ])
      .then(([usersData, leadData]) => {
        const freshLead = leadData?.lead || leadData?.data || leadData || lead
        const ownerId = typeof freshLead?.assignedTo === "string" ? freshLead.assignedTo : freshLead?.assignedTo?._id || ""
        const accessIds = (freshLead?.allowedUsers || []).map((user) => String(user?._id || user))
        setUsers(normalizeApiList(usersData))
        setPrimaryOwner(ownerId)
        setSelectedUsers(Array.from(new Set([ownerId, ...accessIds].filter(Boolean))))
        setLockOwner(Boolean(freshLead?.ownerLocked ?? true))
      })
      .catch(() => setUsers([]))
  }, [open, lead])

  const toggleUser = (userId) => setSelectedUsers((previous) => previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId])
  const assignedTo = primaryOwner
  const setAssignedTo = (userId) => {
    setPrimaryOwner(userId)
    if (userId) setSelectedUsers((previous) => previous.includes(userId) ? previous : [...previous, userId])
  }
  const selectedUser = users.find((user) => String(user._id || user.id) === String(primaryOwner))

  const submit = async () => {
    setErr("")
    if (!selectedUsers.length) return setErr("Select at least one marketing team member.")
    if (!primaryOwner || !selectedUsers.includes(primaryOwner)) return setErr("Choose one selected member as the primary owner.")
    setLoading(true)
    try {
      await apiManualAssign({ leadId: getLeadId(lead), assignedTo: primaryOwner, lockOwner })
      await apiUpdateLeadAccess(getLeadId(lead), { allowedUserIds: selectedUsers.filter((id) => id !== primaryOwner), lockOwner })
      onSaved?.()
      onClose?.()
    } catch (e) {
      setErr(e?.message || "Assign failed")
    } finally {
      setLoading(false)
    }
  }

  return <ModalShell open={open} onClose={onClose} title="Assign marketing person" subtitle={lead?.contact?.name || "Choose who will handle this lead"} icon={<FiUserCheck className="h-5 w-5" />} maxWidthClass="max-w-2xl" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className={cn(btn, btnGhost)} onClick={onClose} disabled={loading}>Cancel</button><button className={cn(btn, btnPrimary)} onClick={submit} disabled={loading || !assignedTo}>{loading ? "Assigning..." : "Assign lead"}</button></div>}>
    {err ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : null}

    <div className="grid gap-4">
      <Field label="Marketing team member">
        <select className={input} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
          <option value="">Select marketing person</option>
          {users.map((u) => <option key={u._id || u.id} value={u._id || u.id}>{u.name || u.email} {u.currentOpenLeadCount !== undefined ? `— open ${u.currentOpenLeadCount || 0}` : ""}</option>)}
        </select>
      </Field>

      {selectedUser ? <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-black text-indigo-700 shadow-sm">{initials(selectedUser.name || selectedUser.email)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{selectedUser.name || "Marketing user"}</p>
            <p className="truncate text-xs text-gray-500">{selectedUser.email || "—"}</p>
          </div>
          <Badge value={selectedUser.workStatus || "available"} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-3"><p className="font-semibold text-gray-500">Role</p><p className="mt-1 font-bold text-gray-900">{selectedUser.role || "marketing_team"}</p></div>
          <div className="rounded-xl bg-white p-3"><p className="font-semibold text-gray-500">Open leads</p><p className="mt-1 font-bold text-gray-900">{selectedUser.currentOpenLeadCount || 0}</p></div>
          <div className="rounded-xl bg-white p-3"><p className="font-semibold text-gray-500">Pending queue</p><p className="mt-1 font-bold text-gray-900">{selectedUser.currentPendingWorkQueueCount || 0}</p></div>
        </div>
      </div> : null}

      <div>
        <p className="mb-2 text-sm font-bold text-gray-900">Additional team access</p>
        <div className="grid max-h-[260px] gap-2 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-2">
          {users.map((user) => {
            const userId = String(user._id || user.id)
            const selected = selectedUsers.includes(userId)
            return <button key={userId} type="button" onClick={() => toggleUser(userId)} className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left transition", selected ? "border-indigo-200 bg-indigo-50" : "border-gray-100 bg-white hover:bg-gray-50")}>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border", selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-transparent")}><FiCheck className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-gray-900">{user.name || user.email}</span><span className="block truncate text-xs text-gray-500">{primaryOwner === userId ? "Primary owner" : user.email || "Marketing team"}</span></span>
            </button>
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">Selected members can open and work on this lead. Choose the primary owner above.</p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-700">
        <input type="checkbox" className="mt-1" checked={lockOwner} onChange={(e) => setLockOwner(e.target.checked)} />
        <span><span className="block font-bold text-gray-900">Lock this lead to selected person</span><span className="mt-1 block text-xs text-gray-500">Recommended for manual assignment, so the lead does not move to another owner accidentally.</span></span>
      </label>

      {!users.length ? <EmptyState icon={<FiUserCheck className="h-5 w-5" />} title="No available marketing team users" subtitle="Only active, available users with marketing_team role are shown here." /> : null}
    </div>
  </ModalShell>
}

function StageWorkGuide({ lead, onAction }) {
  const stage = String(lead?.pipelineStage || "new")
  const requirementReady = hasRequirementDetails(lead)
  const proposalInfo = getProposalShortcutInfo(lead)
  const proposalCount = getProposalCount(lead)
  const guidance = getGuidedNextAction(stage)

  if (!guidance && !["qualified", "discovery", "proposal"].includes(stage)) return null

  const Icon = guidance?.icon || FiTarget
  let title = "Stage work"
  let text = "Keep this lead moving with the next required action."
  let actionType = guidance?.type || "activity"
  let actionLabel = guidance?.label || "Create activity"
  let stateLabel = "Ready"

  if (stage === "qualified") {
    title = "Prepare discovery"
    text = "Qualified lead is ready for requirement collection. Move next, then fill requirement details."
    actionType = "nextStage"
    actionLabel = "Move to Discovery"
    stateLabel = "Qualification done"
  }

  if (stage === "discovery") {
    title = requirementReady ? "Requirement captured" : "Requirement needed"
    text = requirementReady ? "Requirement exists. You can review it or move to proposal when ready." : "Discovery stage should capture client requirement, budget, timeline and decision maker."
    actionType = "requirement"
    actionLabel = requirementReady ? "Review Requirement" : "Fill Requirement"
    stateLabel = requirementReady ? "Completed" : "Required"
  }

  if (stage === "proposal") {
    title = proposalCount ? "Proposal work" : "Proposal needed"
    text = proposalInfo.helper || "Proposal stage should use the proposal modal so amount, items, valid date and notes stay linked with this lead."
    actionType = proposalInfo.action || "proposal"
    actionLabel = proposalInfo.label || (proposalCount ? "Manage Proposals" : "Create Proposal")
    stateLabel = proposalCount ? `${proposalCount} proposal` : "Required"
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-700 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-gray-950">{title}</p>
              <Badge value={stateLabel} />
            </div>
            <p className="mt-1 text-sm font-medium text-gray-600">{text}</p>
          </div>
        </div>
        <button className={cn(btn, btnPrimary, "shrink-0 px-3 py-2")} disabled={stage === "proposal" && proposalInfo.disabled} onClick={() => onAction?.(actionType, lead)}>
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

function RequirementOverview({ lead, onAction }) {
  const r = lead?.requirement || {}
  const ready = hasRequirementDetails(lead)
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-gray-950">Requirement / Discovery</p>
          <p className="text-xs font-semibold text-gray-500">Client need, budget and decision info</p>
        </div>
        <button className={cn(btn, ready ? btnGhost : btnPrimary, "px-3 py-2")} onClick={() => onAction?.("requirement", lead)}>
          {ready ? "Edit" : "Add"}
        </button>
      </div>
      {ready ? (
        <div className="grid gap-3 md:grid-cols-2">
          <DetailRow label="Summary" value={r.summary} />
          <DetailRow label="Expected solution" value={r.expectedSolution} />
          <DetailRow label="Budget" value={`${formatMoney(r.budgetMin || 0)} - ${formatMoney(r.budgetMax || 0)}`} />
          <DetailRow label="Expected value" value={formatMoney(r.expectedValue || 0)} />
          <DetailRow label="Timeline" value={r.timeline} />
          <DetailRow label="Decision maker" value={r.decisionMaker} />
          <div className="md:col-span-2"><DetailRow label="Pain points" value={Array.isArray(r.painPoints) && r.painPoints.length ? r.painPoints.join(", ") : "—"} /></div>
        </div>
      ) : (
        <EmptyState icon={<FiTarget className="h-5 w-5" />} title="No requirement captured yet" subtitle="When the lead reaches Discovery, add requirement details from here." />
      )}
    </div>
  )
}

function LeadNotesOverview({ lead, onAction }) {
  const notes = getLatestLeadNotes(lead, 5)
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-gray-950">Latest Notes</p>
          <p className="text-xs font-semibold text-gray-500">Stage reason, activity notes and manual notes</p>
        </div>
        <button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onAction?.("note", lead)}>Add Note</button>
      </div>
      {notes.length ? (
        <div className="space-y-2">
          {notes.map((note, index) => (
            <div key={note._id || `${note.createdAt || "note"}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <Badge value={note.type || "note"} />
                <span className="text-xs font-semibold text-gray-400">{formatDate(note.createdAt, true)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-800">{note.note || note.reason || "—"}</p>
              {note.oldStage || note.newStage ? <p className="mt-1 text-xs font-semibold text-gray-500">{note.oldStage || "—"} → {note.newStage || "—"}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<FiFileText className="h-5 w-5" />} title="No notes yet" subtitle="Add notes or update stages to build the lead history." />
      )}
    </div>
  )
}

function LeadFullViewModal({ open, onClose, leadId, refreshTick, onAction, initialTab = "overview", isMarketing = false }) {
  const [lead, setLead] = useState(null)
  const [timeline, setTimeline] = useState({ logs: [], activities: [], proposals: [], deals: [], queueItems: [] })
  const [tab, setTab] = useState(initialTab || "overview")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [reasonModal, setReasonModal] = useState({ open: false })
  const [recordView, setRecordView] = useState({ open: false, type: "", record: null })
  const [recordEdit, setRecordEdit] = useState({ type: "", record: null })
  const load = useCallback(async () => {
    if (!open || !leadId) return
    setLoading(true); setErr("")
    try { const [a, b] = await Promise.all([apiGetLead(leadId), apiGetLeadTimeline(leadId)]); setLead(a?.lead || a?.data || a); setTimeline(b?.timeline || b || {}) } catch (e) { setErr(e?.message || "Failed to load lead details") } finally { setLoading(false) }
  }, [open, leadId])
  useEffect(() => { if (open) setTab(initialTab || "overview") }, [open, initialTab, leadId])
  useEffect(() => { load() }, [load, refreshTick])
  const logs = timeline.logs || []
  const activities = timeline.activities || []
  const proposals = timeline.proposals || []
  const deals = timeline.deals || []
  const queueItems = timeline.queueItems || []
  const showSalesTabs = getStageIndex(lead?.pipelineStage) >= getStageIndex("discovery")
  const tabs = [
    ["overview", "Overview", FiInfo],
    ["timeline", "Timeline", FiClock],
    ...(!isMarketing ? [["activities", "Activities", FiActivity]] : []),
    ...(showSalesTabs ? [["proposals", "Proposals", FiFileText], ["deals", "Deals", FiBriefcase]] : []),
    ["queue", "Queue", FiZap],
    ["notes", "Notes", FiFileText],
  ]
  useEffect(() => {
    if (!lead) return
    if (!tabs.some(([key]) => key === tab)) setTab("overview")
  }, [lead, tab, isMarketing, showSalesTabs])
  const openReasonModal = (config) => setReasonModal({ open: true, ...config })
  const closeReasonModal = () => setReasonModal({ open: false })
  return <><ModalShell open={open} onClose={onClose} title="Lead A-Z History" subtitle={lead?.contact?.name || "Full timeline, activities, proposals, deals and work queue"} icon={<FiEye className="h-5 w-5" />} maxWidthClass="max-w-6xl" footer={<div className="flex flex-wrap justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={load}><FiRefreshCcw className="h-4 w-4" />Refresh</button>{lead ? (() => { const proposalInfo = getProposalShortcutInfo(lead, timeline); const eligibleProposal = (timeline.proposals || []).find((proposal) => ["sent", "accepted"].includes(proposal.status) && !proposal.dealId); return <><button className={cn(btn, btnPrimary)} disabled={!getNextPipelineStage(lead)} onClick={() => onAction?.("nextStage", lead)}><FiArrowRight />Next Stage</button><button className={cn(btn, btnSoft)} onClick={() => onAction?.("quick", lead)}><FiZap />Quick action</button>{proposalInfo.show ? <button className={cn(btn, proposalInfo.action === "proposal" ? btnPrimary : btnGhost)} disabled={proposalInfo.disabled} onClick={() => proposalInfo.action === "manageProposal" ? setTab("proposals") : onAction?.(proposalInfo.action, lead)}><FiFileText />{proposalInfo.label}</button> : null}<button className={cn(btn, btnGhost)} disabled={!eligibleProposal} title={eligibleProposal ? "Create deal from proposal" : "Send or accept a proposal first"} onClick={() => onAction?.("deal", lead)}><FiBriefcase />Create Deal</button></> })() : null}</div>}>
    {loading ? <div className="flex justify-center p-10"><FiLoader className="h-6 w-6 animate-spin text-indigo-600" /></div> : err ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div> : lead ? <>
      <div className="mb-4 flex flex-wrap gap-2">{tabs.map(([k, name, Icon]) => <button key={k} className={cn(btn, tab === k ? btnPrimary : btnGhost, "px-3 py-2")} onClick={() => setTab(k)}><Icon className="h-4 w-4" />{name}</button>)}</div>
      {tab === "overview" && (
        <div className="space-y-4">
          <StageProgressController lead={lead} onNextStage={(item) => onAction?.("nextStage", item)} onMoveStage={(item) => onAction?.("stage", item)} />
          <StageWorkGuide lead={lead} onAction={onAction} />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <DetailRow label="Lead no" value={lead.leadNumber} />
            <DetailRow label="Company" value={lead.contact?.companyName} />
            <DetailRow label="Contact" value={lead.contact?.name} />
            <DetailRow label="Phone" value={lead.contact?.phone} />
            <DetailRow label="Email" value={lead.contact?.email} />
            <DetailRow label="Stage" value={<Badge value={lead.pipelineStage} />} />
            <DetailRow label="Status" value={<Badge value={lead.status} />} />
            <DetailRow label="Queue" value={<Badge value={lead.workQueuePriority} />} />
            <DetailRow label="Score" value={lead.workQueueScore || lead.leadScore || 0} />
            <DetailRow label="Next action" value={lead.nextAction} />
            <DetailRow label="Next action at" value={formatDate(lead.nextActionAt, true)} />
            <DetailRow label="Overdue" value={<Badge value={lead.isOverdue ? "yes" : "no"} />} />
          </div>

          <RequirementOverview lead={lead} onAction={onAction} />
        </div>
      )}
      {tab === "timeline" && <div className="space-y-3">{[...logs, ...activities, ...proposals, ...deals, ...queueItems].sort((a,b)=>new Date(b.createdAt||b.sentAt||0)-new Date(a.createdAt||a.sentAt||0)).map((x, i) => <TimelineCard key={`${x._id || i}`} item={x} />)}{!logs.length && !activities.length && !proposals.length && !deals.length && !queueItems.length ? <EmptyState icon={<FiClock />} title="No history yet" /> : null}</div>}
      {!isMarketing && tab === "activities" && <RecordList items={activities} type="activity" onComplete={async (id) => { await apiCompleteActivity(id, { outcome: "Completed from UI" }); await load(); onAction?.("refresh") }} onCancel={async (id) => { await apiCancelActivity(id, { reason: "Cancelled from UI" }); await load(); onAction?.("refresh") }} />}
      {showSalesTabs && tab === "proposals" && <RecordList items={proposals} type="proposal" onView={(record) => setRecordView({ open: true, type: "proposal", record })} onEdit={(record) => setRecordEdit({ type: "proposal", record })} onSend={async (id) => { await apiSendProposal(id); await load(); onAction?.("refresh") }} onAccept={async (id) => { await apiAcceptProposal(id); await load(); onAction?.("refresh") }} onReject={(id) => openReasonModal({ title: "Reject proposal", subtitle: lead?.contact?.name || "Add a clear reason before rejecting.", icon: <FiXCircle className="h-5 w-5" />, actionLabel: "Reject proposal", danger: true, onSubmit: async ({ reason, note }) => { await apiRejectProposal(id, { rejectReason: reason, note }); await load(); onAction?.("refresh") } })} />}
      {showSalesTabs && tab === "deals" && <RecordList items={deals} type="deal" onView={(record) => setRecordView({ open: true, type: "deal", record })} onEdit={(record) => setRecordEdit({ type: "deal", record })} onWon={(id) => openReasonModal({ title: "Mark deal as won", subtitle: "Winning the deal will automatically convert this lead to a customer.", icon: <FiCheckCircle className="h-5 w-5" />, actionLabel: "Win deal & convert", onSubmit: async ({ reason, note }) => { const data = await apiDealWon(id, { reason, note }); await load(); onAction?.("dealWon", data) } })} onLost={(id) => openReasonModal({ title: "Mark deal as lost", subtitle: lead?.contact?.name || "Add a clear loss reason.", icon: <FiXCircle className="h-5 w-5" />, actionLabel: "Mark lost", danger: true, onSubmit: async ({ reason, note }) => { await apiDealLost(id, { reason, note }); await load(); onAction?.("refresh") } })} />}
      {tab === "queue" && <RecordList items={queueItems} type="queue" onDone={async (id) => { await apiQueueDone(id, { result: "Done from lead view" }); await load(); onAction?.("refresh") }} />}
      {tab === "notes" && <LeadNotesOverview lead={lead} onAction={onAction} />}
    </> : <EmptyState icon={<FiEye className="h-5 w-5" />} title="No lead selected" />}
  </ModalShell>
  <ReasonModal open={reasonModal.open} onClose={closeReasonModal} title={reasonModal.title} subtitle={reasonModal.subtitle} icon={reasonModal.icon || <FiInfo className="h-5 w-5" />} actionLabel={reasonModal.actionLabel || "Submit"} danger={reasonModal.danger} onSubmit={reasonModal.onSubmit} />
  <RecordDetailsModal open={recordView.open} onClose={() => setRecordView({ open: false, type: "", record: null })} record={recordView.record} type={recordView.type} />
  <ProposalModal open={recordEdit.type === "proposal"} onClose={() => setRecordEdit({ type: "", record: null })} lead={lead && recordEdit.record ? { ...lead, _editingProposal: recordEdit.record } : lead} onSaved={async () => { await load(); onAction?.("refresh") }} />
  <DealUpdateModal open={recordEdit.type === "deal"} onClose={() => setRecordEdit({ type: "", record: null })} deal={recordEdit.record} onSaved={async () => { await load(); onAction?.("refresh") }} />
</>
}

function DetailRow({ label: labelText, value }) { return <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{labelText}</p><div className="mt-1 break-words text-sm font-semibold text-gray-900">{value || "—"}</div></div> }
function TimelineCard({ item }) { const title = item?.message || item?.title || item?.type || item?.status || item?.stage || item?.proposalNo || item?.dealNo || "Timeline item"; return <div className="relative pl-7"><span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-indigo-50" /><div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-bold text-gray-900">{title}</p><p className="text-xs text-gray-500">{item?.createdBy?.name || item?.assignedTo?.name || "System"} • {formatDate(item?.createdAt || item?.scheduledAt || item?.sentAt, true)}</p></div>{item?.status || item?.stage || item?.priority ? <Badge value={item.status || item.stage || item.priority} /> : null}</div>{item?.body || item?.description || item?.result ? <p className="mt-2 text-sm text-gray-600">{item.body || item.description || item.result}</p> : null}</div></div> }
function RecordList({ items = [], type, onComplete, onCancel, onSend, onAccept, onReject, onWon, onLost, onDone, onView, onEdit }) {
  if (!items.length) return <EmptyState icon={<FiInfo className="h-5 w-5" />} title={`No ${type} records`} />
  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{items.map((it) => {
    const proposalEditable = type === "proposal" && ["draft", "sent"].includes(it.status)
    const dealEditable = type === "deal" && !["won", "lost"].includes(it.stage)
    return <div key={it._id} className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold text-gray-900">{it.title || it.proposalNo || it.dealNo || it.type || it.source}</p><p className="text-xs text-gray-500">{formatDate(it.createdAt || it.scheduledAt || it.followupDueAt, true)}</p></div><Badge value={it.status || it.stage || it.priority || it.dealHealth} /></div>
      {it.grandTotal !== undefined ? <div className="mt-3"><span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>{formatMoney(it.grandTotal, it.currency)}</span></div> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {["proposal", "deal"].includes(type) ? <button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onView?.(it)}><FiEye className="h-4 w-4" />View</button> : null}
        {proposalEditable || dealEditable ? <button className={cn(btn, btnSoft, "px-3 py-2")} onClick={() => onEdit?.(it)}><FiEdit2 className="h-4 w-4" />Edit</button> : null}
        {type === "activity" ? <><button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onComplete?.(it._id)}>Complete</button><button className={cn(btn, btnDanger, "px-3 py-2")} onClick={() => onCancel?.(it._id)}>Cancel</button></> : null}
        {type === "proposal" ? <><button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onSend?.(it._id)}>Send</button><button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onAccept?.(it._id)}>Accept</button><button className={cn(btn, btnDanger, "px-3 py-2")} onClick={() => onReject?.(it._id)}>Reject</button></> : null}
        {type === "deal" && !["won", "lost"].includes(it.stage) ? <><button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => onWon?.(it._id)}>Won</button><button className={cn(btn, btnDanger, "px-3 py-2")} onClick={() => onLost?.(it._id)}>Lost</button></> : null}
        {type === "queue" ? <button className={cn(btn, btnPrimary, "px-3 py-2")} onClick={() => onDone?.(it._id)}>Done</button> : null}
      </div>
    </div>
  })}</div>
}

function RowActionsMenu({ lead, onAction, busy, converting, canConvert, canAdminister }) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, transformOrigin: "top right" })
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const converted = isConvertedLead(lead)

  const updateMenuPosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 288
    const estimatedHeight = Math.min(560, window.innerHeight - 24)
    const gap = 8
    const spaceBelow = window.innerHeight - rect.bottom
    const shouldOpenUp = spaceBelow < 360
    const top = shouldOpenUp ? Math.max(12, rect.top - estimatedHeight - gap) : Math.min(rect.bottom + gap, window.innerHeight - 12)
    const left = Math.min(Math.max(12, rect.right - menuWidth), Math.max(12, window.innerWidth - menuWidth - 12))
    setMenuStyle({ top, left, transformOrigin: shouldOpenUp ? "bottom right" : "top right" })
  }, [])

  const toggleMenu = () => {
    if (!open) updateMenuPosition()
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    const closeOnOutside = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const reposition = () => updateMenuPosition()
    document.addEventListener("mousedown", closeOnOutside)
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open, updateMenuPosition])

  const [menuLead, setMenuLead] = useState(null)
  const [menuTimeline, setMenuTimeline] = useState(null)
  const [checkingProposal, setCheckingProposal] = useState(false)

  useEffect(() => {
    if (!open || !lead) return
    let ignore = false
    const currentStage = String(lead?.pipelineStage || "new")
    const shouldHydrate = getStageIndex(currentStage) >= getStageIndex("discovery")
    setMenuLead(null)
    setMenuTimeline(null)
    if (!shouldHydrate) {
      setCheckingProposal(false)
      return
    }
    setCheckingProposal(true)
    Promise.all([
      apiGetLead(getLeadId(lead)).catch(() => null),
      apiGetLeadTimeline(getLeadId(lead)).catch(() => null),
    ])
      .then(([leadData, timelineData]) => {
        if (ignore) return
        setMenuLead(leadData?.lead || leadData?.data || leadData || null)
        setMenuTimeline(timelineData?.timeline || timelineData || null)
      })
      .finally(() => { if (!ignore) setCheckingProposal(false) })
    return () => { ignore = true }
  }, [open, lead])

  const hydratedLead = menuLead || lead
  const proposalInfo = checkingProposal
    ? { show: true, disabled: true, action: "proposal", label: "Checking proposal...", helper: "Loading requirement and proposal status." }
    : getProposalShortcutInfo(hydratedLead, menuTimeline)
  const eligibleProposal = Array.isArray(menuTimeline?.proposals)
    ? menuTimeline.proposals.find((proposal) => ["sent", "accepted"].includes(proposal.status) && !proposal.dealId)
    : null
  const activeDeal = Array.isArray(menuTimeline?.deals)
    ? menuTimeline.deals.find((deal) => !["won", "lost"].includes(deal.stage))
    : null
  const isNegotiation = String(hydratedLead?.pipelineStage || "") === "negotiation"
  const items = [["view", "View A-Z history", FiEye], ["quick", "Quick action", FiZap], ...(canAdminister ? [["assign", "Assign lead", FiUserCheck]] : []), ["edit", "Edit lead", FiEdit2], ["note", "Add note", FiFileText], ["nextStage", "Next stage", FiArrowRight], ["stage", "Manual stage", FiSliders], ["requirement", "Requirement", FiTarget], ["activity", "Create activity", FiActivity], ["followup", "Set follow-up", FiCalendar], ["contacted", "Mark contacted", FiPhoneCall], ...(proposalInfo.show ? [[proposalInfo.action, proposalInfo.label, FiFileText, proposalInfo.disabled, proposalInfo.helper]] : []), ["deal", "Create deal", FiBriefcase, checkingProposal || !eligibleProposal, checkingProposal ? "Checking proposals..." : "Send or accept a proposal first."], ...(isNegotiation ? [["dealWon", "Mark deal as won", FiCheckCircle, checkingProposal || !activeDeal, checkingProposal ? "Checking linked deal..." : activeDeal ? "This will convert the lead to a customer automatically." : "No active linked deal found."]] : []), ["lost", "Mark lost", FiXCircle]]

  const menu = open && typeof document !== "undefined" ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.14 }}
        style={{ top: menuStyle.top, left: menuStyle.left, transformOrigin: menuStyle.transformOrigin }}
        className="fixed z-[9999] w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)]"
      >
        <div className="max-h-[min(70vh,560px)] overflow-y-auto p-2">
          {items.map(([key, text, Icon, forceDisabled, helper]) => {
            const disabled = Boolean(forceDisabled) || (key === "convert" && (!canConvert || converted || converting)) || (key === "contacted" && busy) || (key === "won" && lead?.pipelineStage === "won") || (key === "lost" && lead?.pipelineStage === "lost") || (key === "nextStage" && !getNextPipelineStage(lead))
            return <button key={key} disabled={disabled} className={cn("flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50", key === "proposal" ? "bg-indigo-50/60 text-indigo-800" : key === "dealWon" ? "bg-emerald-50 text-emerald-800" : key === "manageProposal" ? "bg-gray-50 text-gray-900" : "text-gray-800")} onClick={() => { setOpen(false); onAction(key, key === "dealWon" ? { lead: hydratedLead, deal: activeDeal } : ["proposal", "manageProposal", "requirement", "deal", "nextStage", "stage"].includes(key) ? hydratedLead : lead) }}>{key === "contacted" && busy ? <FiLoader className="mt-0.5 h-4 w-4 animate-spin" /> : key === "convert" && converting ? <FiLoader className="mt-0.5 h-4 w-4 animate-spin" /> : <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />}<span><span className="block text-sm font-semibold">{text}</span>{helper ? <span className="mt-0.5 block text-xs font-medium text-gray-500">{helper}</span> : null}</span></button>
          })}
          {canAdminister ? <>
            <div className="my-1 border-t border-gray-100" />
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => { setOpen(false); onAction("delete", lead) }}><FiTrash2 className="h-4 w-4" />Delete lead</button>
          </> : null}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null

  return <div ref={ref} className="relative flex items-center justify-end gap-2"><button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30" onClick={() => onAction("view", lead)}><FiEye className="h-4 w-4" />View</button><button ref={buttonRef} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30" onClick={toggleMenu} aria-label="More lead actions" aria-haspopup="menu" aria-expanded={open}><FiMoreVertical className="h-4 w-4" /></button>{menu}</div>
}

function WorkQueuePanel({ open, onClose, onToast, onChanged }) {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [snooze, setSnooze] = useState({ id: "", date: "" })
  const load = async () => { setLoading(true); try { const [a, b] = await Promise.all([apiTodayQueue(), apiQueueSummary()]); setItems(a?.items || []); setSummary(a?.summary || b?.summary || {}) } catch (e) { onToast?.("error", e.message) } finally { setLoading(false) } }
  useEffect(() => { if (open) load() }, [open])
  const done = async (id) => { await apiQueueDone(id, { result: "Completed from work queue" }); onToast?.("success", "Queue item completed."); await load(); onChanged?.() }
  const start = async (id) => { await apiQueueStart(id); await load() }
  const runSnooze = async () => { if (!snooze.id || !snooze.date) return; await apiQueueSnooze(snooze.id, { snoozedUntil: new Date(snooze.date).toISOString(), reason: "Snoozed from UI" }); setSnooze({ id: "", date: "" }); await load(); onChanged?.() }
  return <ModalShell open={open} onClose={onClose} title="Today’s Work Queue" subtitle="Priority based daily work for marketing/sales team" icon={<FiZap className="h-5 w-5" />} maxWidthClass="max-w-6xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={load}><FiRefreshCcw />Refresh</button></div>}>
    {summary ? <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">{Object.entries(summary).map(([k, v]) => <div key={k} className="rounded-2xl border border-gray-100 bg-gray-50 p-3"><p className="text-xs font-bold uppercase text-gray-500">{k}</p><p className="mt-1 text-2xl font-black text-gray-900">{v}</p></div>)}</div> : null}
    {loading ? <div className="flex justify-center p-8"><FiLoader className="animate-spin" /></div> : items.length ? <div className="space-y-3">{items.map((it) => <div key={it._id} className="rounded-2xl border border-gray-100 bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold text-gray-900">{it.title}</p><p className="text-sm text-gray-500">{it.description || it.leadId?.contact?.companyName || "—"}</p><p className="mt-1 text-xs text-gray-400">Due: {formatDate(it.dueAt, true)}</p></div><div className="flex flex-wrap gap-2"><Badge value={it.priority} /><Badge value={it.status} /><Badge value={it.source} /></div></div><div className="mt-3 flex flex-wrap gap-2"><button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => start(it._id)}>Start</button><button className={cn(btn, btnPrimary, "px-3 py-2")} onClick={() => done(it._id)}>Done</button><button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => setSnooze({ id: it._id, date: formatDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000)) })}>Snooze</button><button className={cn(btn, btnDanger, "px-3 py-2")} onClick={async () => { await apiQueueCancel(it._id, { reason: "Cancelled from UI" }); await load() }}>Cancel</button></div></div>)}</div> : <EmptyState icon={<FiZap />} title="No work queue items for today" />}
    {snooze.id ? <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><div className="grid gap-3 md:grid-cols-[1fr_auto]"><input type="datetime-local" className={input} value={snooze.date} onChange={(e) => setSnooze((p) => ({ ...p, date: e.target.value }))} /><button className={cn(btn, btnPrimary)} onClick={runSnooze}>Confirm snooze</button></div></div> : null}
  </ModalShell>
}


function TemplatesPanel({ open, onClose, onToast }) {
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({ name: "", key: "", channel: "general", purpose: "general", subject: "", body: "" })
  const [saving, setSaving] = useState(false)
  const [copyingId, setCopyingId] = useState("")

  const load = async () => {
    try {
      const d = await apiListTemplates()
      setTemplates(normalizeApiList(d))
    } catch (e) {
      onToast?.("error", e.message)
    }
  }

  useEffect(() => { if (open) load() }, [open])

  const create = async () => {
    if (!form.name.trim()) return onToast?.("error", "Template name is required.")
    if (!form.body.trim()) return onToast?.("error", "Template body is required.")
    setSaving(true)
    try {
      await apiCreateTemplate({ ...form, variables: [] })
      onToast?.("success", "Template created.")
      setForm({ name: "", key: "", channel: "general", purpose: "general", subject: "", body: "" })
      await load()
    } catch (e) {
      onToast?.("error", e.message)
    } finally {
      setSaving(false)
    }
  }

  const copyTemplate = async (template) => {
    const id = template?._id || template?.id
    if (!id) return
    setCopyingId(id)
    try {
      const response = await apiUseTemplate(id, { data: {} })
      const rendered = getTemplateRenderFromResponse(response, template, {})
      await navigator.clipboard?.writeText(formatTemplateWithSubject(rendered.subject, rendered.body))
      onToast?.("success", rendered.subject ? "Template subject and body copied." : "Template body copied.")
      await load()
    } catch (e) {
      onToast?.("error", e?.message || "Failed to copy template.")
    } finally {
      setCopyingId("")
    }
  }

  return <ModalShell open={open} onClose={onClose} title="Message Templates" subtitle="" icon={<FiFileText className="h-5 w-5" />} maxWidthClass="max-w-5xl">
    <div className="mb-5 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-bold text-gray-900">Create template</p>
        <span className={cn(chip, "bg-white text-indigo-700 ring-indigo-600/10")}>Variables: {"{{name}}"}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name"><input className={input} value={form.name} onChange={(e)=>setForm(p=>({...p,name:e.target.value}))} placeholder="Follow-up message" /></Field>
        <Field label="Key"><input className={input} value={form.key} onChange={(e)=>setForm(p=>({...p,key:e.target.value}))} placeholder="auto generated from name" /></Field>
        <Field label="Channel"><select className={input} value={form.channel} onChange={(e)=>setForm(p=>({...p,channel:e.target.value}))}>{TEMPLATE_CHANNELS.map(x=><option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></Field>
        <Field label="Purpose"><select className={input} value={form.purpose} onChange={(e)=>setForm(p=>({...p,purpose:e.target.value}))}>{TEMPLATE_PURPOSES.map(x=><option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}</select></Field>
        <div className="md:col-span-2"><Field label="Subject / Title"><input className={input} value={form.subject} onChange={(e)=>setForm(p=>({...p,subject:e.target.value}))} placeholder="Optional" /></Field></div>
        <div className="md:col-span-2"><Field label="Body *"><textarea className={cn(input,"min-h-[120px]")} value={form.body} onChange={(e)=>setForm(p=>({...p,body:e.target.value}))} placeholder="Write template body..." /></Field></div>
      </div>
      <div className="mt-3 flex justify-end"><button className={cn(btn, btnPrimary)} onClick={create} disabled={saving}>{saving ? "Creating..." : "Create template"}</button></div>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      {templates.map((t)=> {
        const id = t._id || t.id
        return <div key={id} className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold text-gray-900">{t.name}</p>
              <p className="text-xs text-gray-500">{String(t.channel || "general").replaceAll("_", " ")} • {String(t.purpose || "general").replaceAll("_", " ")} • used {t.usageCount || 0}</p>
            </div>
            <Badge value={t.isActive ? "active" : "inactive"} />
          </div>
          {t.subject ? <p className="mt-3 line-clamp-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">Subject: {t.subject}</p> : null}
          <p className="mt-3 line-clamp-3 text-sm text-gray-600">{t.body}</p>
          <div className="mt-3 flex gap-2">
            <button className={cn(btn, btnGhost, "px-3 py-2")} onClick={() => copyTemplate(t)} disabled={copyingId === id}>{copyingId === id ? "Copying..." : t.subject ? "Copy subject + body" : "Copy body"}</button>
            <button className={cn(btn, btnDanger, "px-3 py-2")} onClick={async()=>{await apiDeleteTemplate(id); await load()}}>Delete</button>
          </div>
        </div>
      })}
    </div>
    {!templates.length ? <EmptyState icon={<FiFileText className="h-5 w-5" />} title="No templates yet" subtitle="Create one template and reuse it inside notes, activity, proposal and follow-up forms." /> : null}
  </ModalShell>
}

function AssignmentPanel({ open, onClose, onToast }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiAvailableAssignees({ role: "marketing_team" })
      setUsers(normalizeApiList(data))
    } catch (e) {
      onToast?.("error", e.message)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) load() }, [open])

  return <ModalShell open={open} onClose={onClose} title="Lead Assignment" subtitle="" icon={<FiUserCheck className="h-5 w-5" />} maxWidthClass="max-w-4xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={load} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button><button className={cn(btn, btnPrimary)} onClick={onClose}>Done</button></div>}>

    {loading ? <div className="flex justify-center p-8"><FiLoader className="h-5 w-5 animate-spin text-gray-500" /></div> : users.length ? <div className="grid gap-3 md:grid-cols-2">
      {users.map((u) => <div key={u._id || u.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700">{initials(u.name || u.email)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-gray-900">{u.name || "Marketing user"}</p>
            <p className="truncate text-xs text-gray-500">{u.email || "—"}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Badge value={u.role || "marketing_team"} /><Badge value={u.workStatus || "available"} /></div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">Open</p><p className="mt-1 text-lg font-black text-gray-900">{u.currentOpenLeadCount || 0}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">Queue</p><p className="mt-1 text-lg font-black text-gray-900">{u.currentPendingWorkQueueCount || 0}</p></div>
          <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">Limit</p><p className="mt-1 text-lg font-black text-gray-900">{u.dailyLeadLimit || "∞"}</p></div>
        </div>
      </div>)}
    </div> : <EmptyState icon={<FiUserCheck className="h-5 w-5" />} title="No available marketing team users" subtitle="Only active, available marketing_team users can receive leads in this simplified flow." />}
  </ModalShell>
}

function NotificationsPanel({ open, onClose, onToast, onChanged }) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const d = await apiMyNotifications()
      setItems(d?.items || [])
      setUnread(d?.unreadCount || 0)
    } catch (e) {
      onToast?.("error", e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) load() }, [open])

  const markOneRead = async (notification) => {
    if (!notification?._id || notification.isRead) return
    setActionId(notification._id)

    // instant UI update first, then sync with backend
    setItems((prev) => prev.map((item) => item._id === notification._id ? { ...item, isRead: true } : item))
    setUnread((prev) => Math.max(prev - 1, 0))

    try {
      await apiReadNotification(notification._id)
      onToast?.("success", "Alert marked as read.")
      await load()
      await onChanged?.()
    } catch (e) {
      onToast?.("error", e.message || "Failed to update alert.")
      await load()
      await onChanged?.()
    } finally {
      setActionId("")
    }
  }

  const markAllRead = async () => {
    setActionId("all")

    // instant UI update first, then sync with backend
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnread(0)

    try {
      await apiReadAllNotifications()
      onToast?.("success", "All alerts marked as read.")
      await load()
      await onChanged?.()
    } catch (e) {
      onToast?.("error", e.message || "Failed to update alerts.")
      await load()
      await onChanged?.()
    } finally {
      setActionId("")
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Notifications"
      subtitle={`${unread} unread`}
      icon={<FiBell className="h-5 w-5" />}
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex justify-end gap-2">
          <button className={cn(btn, btnGhost)} onClick={load} disabled={loading || Boolean(actionId)}>
            {loading ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiRefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
          <button className={cn(btn, btnPrimary)} onClick={markAllRead} disabled={!items.length || unread === 0 || Boolean(actionId)}>
            {actionId === "all" ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
            Mark all read
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {items.map((n) => (
          <button
            key={n._id}
            className={cn(
              "w-full rounded-2xl border p-4 text-left transition hover:bg-gray-50",
              n.isRead ? "border-gray-100 bg-white" : "border-indigo-100 bg-indigo-50"
            )}
            disabled={actionId === n._id}
            onClick={() => markOneRead(n)}
          >
            <div className="flex justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-gray-900">{n.title}</p>
                  {!n.isRead ? <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span> : null}
                  {actionId === n._id ? <FiLoader className="h-4 w-4 animate-spin text-indigo-600" /> : null}
                </div>
                <p className="mt-1 text-sm text-gray-600">{n.message}</p>
                <p className="mt-1 text-xs text-gray-400">{formatDate(n.createdAt, true)}</p>
              </div>
              <Badge value={n.priority} />
            </div>
          </button>
        ))}
        {!items.length ? <EmptyState icon={<FiBell />} title="No notifications" /> : null}
      </div>
    </ModalShell>
  )
}

export default function AdminLeadsPage({ onConvertedToCustomer }) {
  const PAGE_SIZE = 25
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState({ q: "", status: "", pipelineStage: "", priority: "", leadTemperature: "", workQueuePriority: "", isOverdue: "", nextActionType: "", purchaseType: "", source: "", tag: "", nextFollowUpFrom: "", nextFollowUpTo: "", lastContactedFrom: "", lastContactedTo: "" })
  const [filterDraft, setFilterDraft] = useState(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [allowedCols, setAllowedCols] = useState([])
  const [selectedCols, setSelectedCols] = useState([])
  const [colsOpen, setColsOpen] = useState(false)
  const [modal, setModal] = useState({ type: "", lead: null })
  const [childModal, setChildModal] = useState({ type: "", lead: null })
  const [stageWorkTick, setStageWorkTick] = useState(0)
  const [panel, setPanel] = useState("")
  const [viewLeadId, setViewLeadId] = useState("")
  const [viewInitialTab, setViewInitialTab] = useState("overview")
  const [viewTick, setViewTick] = useState(0)
  const [busyId, setBusyId] = useState("")
  const [convertingId, setConvertingId] = useState("")
  const [deleteState, setDeleteState] = useState({ open: false, lead: null, loading: false })
  const [notifications, setNotifications] = useState(0)
  const [assignees, setAssignees] = useState([])
  const abortRef = useRef(null)
  const role = useMemo(() => {
    const directRole = localStorage.getItem("role")
    if (directRole) return String(directRole).toLowerCase()
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "null")
      return String(storedUser?.role || "").toLowerCase()
    } catch {
      return ""
    }
  }, [])
  const canConvert = ["admin", "superadmin", "marketing_team"].includes(role)
  const canAdminister = ["admin", "superadmin"].includes(role)
  const isMarketing = role === "marketing_team"
  const showToast = (type, message) => {
    const safeMessage = message || "Something went wrong."
    if (type === "error") toast.error(safeMessage)
    else toast.success(safeMessage)
  }
  const fieldsParam = useMemo(() => (selectedCols.length ? selectedCols.join(",") : ""), [selectedCols])
  const buildParams = () => { const out = {}; Object.entries(filters).forEach(([k, v]) => { const s = String(v || "").trim(); if (s) out[k] = s }); return out }
  const fetchViewPrefs = async () => { try { const data = await apiGetViewPref(); const allowed = Array.isArray(data?.allowedColumns) && data.allowedColumns.length ? Array.from(new Set([...data.allowedColumns, ...FALLBACK_ALLOWED_COLUMNS])) : FALLBACK_ALLOWED_COLUMNS; const cols = Array.isArray(data?.columns) && data.columns.length ? data.columns : DEFAULT_COLUMNS; setAllowedCols(allowed); setSelectedCols(cols) } catch { setAllowedCols(FALLBACK_ALLOWED_COLUMNS); setSelectedCols(DEFAULT_COLUMNS) } }
  const fetchLeads = async ({ reset = false } = {}) => { abortRef.current?.abort?.(); const controller = new AbortController(); abortRef.current = controller; reset ? (setLoading(true), setLeads([]), setNextCursor(null), setHasMore(false)) : setLoadingMore(true); setError(""); try { const data = await apiListLeads({ limit: PAGE_SIZE, cursor: reset ? null : nextCursor, params: buildParams(), fields: fieldsParam, signal: controller.signal }); const items = normalizeApiList(data); setLeads((prev) => reset ? items : [...prev, ...items]); setNextCursor(data?.pageInfo?.nextCursor || null); setHasMore(Boolean(data?.pageInfo?.hasNextPage)) } catch (e) { if (e.name !== "AbortError") setError(e.message || "Failed to load leads") } finally { setLoading(false); setLoadingMore(false) } }
  const fetchAssignees = async () => {
    if (!canAdminister) {
      setAssignees([])
      return
    }
    try {
      const data = await apiAvailableAssignees({ role: "marketing_team" })
      setAssignees(Array.isArray(data?.users) ? data.users : normalizeApiList(data))
    } catch {
      setAssignees([])
    }
  }
  const refreshProductivity = async () => { try { const n = await apiMyNotifications(); setNotifications(n?.unreadCount || 0) } catch {} }
  const refreshAll = async () => { await Promise.all([fetchLeads({ reset: true }), refreshProductivity(), fetchAssignees()]); setViewTick((t) => t + 1) }
  useEffect(() => { fetchViewPrefs(); refreshProductivity(); fetchAssignees() }, [])
  useEffect(() => { fetchLeads({ reset: true }) }, [filters, fieldsParam])
  const saveColumns = async (cols) => { const safe = cols.length ? cols : DEFAULT_COLUMNS; await apiSaveViewPref(safe); setSelectedCols(safe) }
  const getFreshLeadForAction = async (lead) => {
    if (!lead || !getLeadId(lead)) return lead
    try {
      const data = await apiGetLead(getLeadId(lead))
      return data?.lead || data?.data || data || lead
    } catch {
      return lead
    }
  }
  const action = async (type, lead) => {
    if (type === "dealWon") return setModal({ type: "dealWon", lead: lead?.lead, deal: lead?.deal })
    if (type === "view" || type === "manageProposal") { setViewInitialTab(type === "manageProposal" ? "proposals" : "overview"); return setViewLeadId(getLeadId(lead)) }
    if (["requirement", "proposal", "deal", "stage", "nextStage"].includes(type)) {
      const freshLead = await getFreshLeadForAction(lead)
      if (type === "proposal" && !hasRequirementDetails(freshLead)) {
        showToast("error", "Complete requirement first, then create proposal.")
        return setModal({ type: "requirement", lead: freshLead })
      }
      if (type === "deal") {
        const timelineData = await apiGetLeadTimeline(getLeadId(freshLead)).catch(() => null)
        const timeline = timelineData?.timeline || timelineData || {}
        const proposals = Array.isArray(timeline?.proposals) ? timeline.proposals : []
        const eligibleProposal = proposals.find((proposal) => ["sent", "accepted"].includes(proposal.status) && !proposal.dealId)
        if (!eligibleProposal) {
          showToast("error", "Send or accept a proposal before creating the deal.")
          setViewInitialTab("proposals")
          return setViewLeadId(getLeadId(freshLead))
        }
        return setModal({ type, lead: { ...freshLead, _dealProposal: eligibleProposal } })
      }
      return setModal({ type, lead: freshLead })
    }
    if (["create", "edit", "note", "followup", "activity", "quick"].includes(type)) return setModal({ type, lead })
    if (type === "assign" && canAdminister) return setModal({ type, lead })
    if (type === "delete" && canAdminister) return setDeleteState({ open: true, lead, loading: false })
    if (type === "won") return setModal({ type: "leadWon", lead })
    if (type === "lost") return setModal({ type: "leadLost", lead })
    if (type === "contacted") { setBusyId(getLeadId(lead)); try { await apiMarkContacted(getLeadId(lead), { note: "Marked contacted from list" }); showToast("success", "Lead marked contacted."); await refreshAll() } catch (e) { showToast("error", e.message) } finally { setBusyId("") } }
    if (type === "convert") { setConvertingId(getLeadId(lead)); try { const data = await apiConvertLead(getLeadId(lead)); showToast("success", "Lead converted to customer."); onConvertedToCustomer?.(data?.customer || data); await refreshAll() } catch (e) { showToast("error", e.message) } finally { setConvertingId("") } }
    if (type === "refresh") return refreshAll()
    if (type === "dealWon") {
      showToast("success", "Deal won. Lead converted to customer automatically.")
      onConvertedToCustomer?.(lead?.customer || lead)
      return refreshAll()
    }
  }
  const updateOpenStageLead = (updatedLead) => {
    if (!updatedLead || !getLeadId(updatedLead)) return
    setModal((p) => {
      if (!["stage", "nextStage"].includes(p.type)) return p
      if (getLeadId(p.lead) !== getLeadId(updatedLead)) return p
      return { ...p, lead: { ...(p.lead || {}), ...updatedLead } }
    })
    setChildModal((p) => p.lead && getLeadId(p.lead) === getLeadId(updatedLead) ? { ...p, lead: { ...(p.lead || {}), ...updatedLead } } : p)
    setStageWorkTick((t) => t + 1)
  }
  const handleChildRequirementSaved = async (updatedLead) => {
    showToast("success", "Requirement completed. You can continue the stage flow now.")
    updateOpenStageLead(updatedLead)
    setChildModal({ type: "", lead: null })
    await refreshAll()
  }
  const handleChildProposalSaved = async (updatedLead) => {
    showToast("success", "Proposal created. You can continue the stage flow now.")
    if (updatedLead && getLeadId(updatedLead)) updateOpenStageLead(updatedLead)
    setStageWorkTick((t) => t + 1)
    setChildModal({ type: "", lead: null })
    await refreshAll()
  }
    const confirmDelete = async (password) => { const lead = deleteState.lead; setDeleteState((p) => ({ ...p, loading: true })); try { await apiDeleteLead(getLeadId(lead), password); showToast("success", "Lead deleted."); setDeleteState({ open: false, lead: null, loading: false }); await refreshAll() } catch (e) { setDeleteState((p) => ({ ...p, loading: false })); throw e } }
  const handleStageSaved = async ({ pipelineStage } = {}) => {
    showToast("success", pipelineStage ? `Lead moved to ${STAGE_LABELS[pipelineStage] || pipelineStage}.` : "Stage updated.")
    await refreshAll()
    return true
  }
  const exportExcel = () => { const rows = leads.map((lead) => { const row = {}; selectedCols.forEach((c) => row[COLUMN_LABELS[c] || c] = Array.isArray(getByPath(lead, c)) ? getByPath(lead, c).join(", ") : getByPath(lead, c) ?? ""); return row }); const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Leads"); XLSX.writeFile(wb, `businesshub-leads-${Date.now()}.xlsx`) }
  const renderCell = (lead, col) => { const v = getByPath(lead, col); if (["status", "pipelineStage", "priority", "leadTemperature", "workQueuePriority", "nextActionType"].includes(col)) return <Badge value={v} />; if (["isOverdue"].includes(col)) return <Badge value={v ? "yes" : "no"} />; if (String(col).toLowerCase().includes("at") || ["createdAt", "updatedAt", "convertedAt"].includes(col)) return formatDate(v, true); if (col === "tags") return Array.isArray(v) ? v.join(", ") : v || "—"; if (typeof v === "object" && v?._id) return v.name || v._id; return v === undefined || v === null || v === "" ? "—" : String(v) }
  const stageTabs = [{ value: "", label: "All Leads" }, ...PIPELINE_STAGES.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] || stage }))]
  const filterLabels = {
    status: "Status",
    pipelineStage: "Stage",
    priority: "Priority",
    leadTemperature: "Temp",
    workQueuePriority: "Queue",
    isOverdue: "Overdue",
    nextActionType: "Action",
    purchaseType: "Purchase",
    source: "Source",
    tag: "Tag",
    nextFollowUpFrom: "FU from",
    nextFollowUpTo: "FU to",
    lastContactedFrom: "LC from",
    lastContactedTo: "LC to",
  }
  const filterChipValue = (key, value) => {
    const v = String(value || "").trim()
    if (!v) return ""
    if (key === "pipelineStage") return STAGE_LABELS[v] || v
    if (key === "isOverdue") return v === "true" ? "Yes" : v === "false" ? "No" : v
    if (["nextFollowUpFrom", "nextFollowUpTo", "lastContactedFrom", "lastContactedTo"].includes(key)) return formatDate(v)
    return v.replace(/_/g, " ")
  }
  const activeFilterEntries = Object.entries(filters)
    .filter(([k, v]) => !["q", "pipelineStage"].includes(k) && String(v || "").trim())
    .map(([key, value]) => ({ key, label: filterLabels[key] || key, value: filterChipValue(key, value) }))
  const activeFilterCount = activeFilterEntries.length
  const clearOnlyFilters = () => {
    setFilters((p) => Object.fromEntries(Object.keys(p).map((k) => [k, ["q", "pipelineStage"].includes(k) ? p[k] : ""])))
  }
  const clearAllSearchAndFilters = () => {
    setFilters(Object.fromEntries(Object.keys(filters).map((k) => [k, ""])))
  }
  return <div className={shell}>
    <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                <FiTarget className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">Leads</h1>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
            <div className="flex flex-wrap gap-2">
              <button className={cn(btn, btnGhost, "h-11 px-3")} onClick={() => setPanel("notifications")}>
                <FiBell />
                Alerts
                {notifications ? <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white">{notifications}</span> : null}
              </button>
              <button className={cn(btn, btnGhost, "h-11 px-3")} onClick={() => setPanel("queue")}><FiZap />Queue</button>
              <button className={cn(btn, btnGhost, "h-11 px-3")} onClick={() => setPanel("templates")}><FiFileText />Templates</button>
              {canAdminister ? <button className={cn(btn, btnGhost, "h-11 px-3")} onClick={() => setPanel("assignment")}><FiUserCheck />Marketing team</button> : null}
            </div>
            <button className={cn(btn, btnPrimary, "h-11 shrink-0 px-5")} onClick={() => setModal({ type: "create", lead: null })}>
              <FiPlus />New Lead
            </button>
          </div>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="w-full xl:flex-1">
              <div className="flex min-h-[50px] w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-1.5 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]">
                <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
                {activeFilterEntries.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    title="Remove filter"
                    className={cn(chip, "max-w-[210px] bg-indigo-50 text-indigo-700 ring-indigo-600/10 hover:bg-indigo-100")}
                    onClick={() => setFilters((p) => ({ ...p, [f.key]: "" }))}
                  >
                    <span className="truncate"><span className="text-indigo-500">{f.label}:</span> {String(f.value)}</span>
                    <FiX className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
                <input
                  value={filters.q}
                  onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                  placeholder={activeFilterCount ? "Search with selected filters..." : "Search leads, company, phone, email..."}
                  className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-2 text-sm font-medium outline-none placeholder:text-gray-400"
                />
                <button
                  type="button"
                  className={cn("inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition", activeFilterCount ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100")}
                  onClick={() => { setFilterDraft(filters); setFiltersOpen(true) }}
                >
                  <FiFilter className="h-4 w-4" />Filters
                  {activeFilterCount ? <span className="rounded-full bg-white/20 px-1.5 text-xs">{activeFilterCount}</span> : null}
                </button>
                {(filters.q || activeFilterCount) ? (
                  <button
                    type="button"
                    title="Clear search and filters"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    onClick={clearAllSearchAndFilters}
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {activeFilterCount ? <button className={cn(btn, btnGhost, "px-3")} onClick={clearOnlyFilters}>Clear chips</button> : null}
              <button className={cn(btn, btnGhost)} onClick={() => setColsOpen(true)}><FiColumns />Columns</button>
              <button className={cn(btn, btnGhost)} onClick={exportExcel}><SiMicrosoftexcel className="text-emerald-600" />Export</button>
              <button className={cn(btn, btnGhost)} onClick={refreshAll}><FiRefreshCcw />Refresh</button>
            </div>
          </div>
        </div>
      </div>
      <div className="mb-5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Lead pipeline stages">
          {stageTabs.map((stage) => {
            const active = filters.pipelineStage === stage.value
            return (
              <button
                key={stage.value || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "rounded-xl px-4 py-2.5 text-sm font-bold transition",
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                )}
                onClick={() => setFilters((p) => ({ ...p, pipelineStage: stage.value }))}
              >
                {stage.label}
              </button>
            )
          })}
        </div>
      </div>
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,0.45)]">
        <div className="h-[520px] overflow-auto bg-white [scrollbar-gutter:stable] lg:h-[600px] xl:h-[650px]">
          <table className="w-full min-w-[1200px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-20">
              <tr>
                {selectedCols.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap border-b border-gray-200 bg-gray-50 px-6 py-4 text-left text-xs font-black uppercase tracking-[0.06em] text-gray-600"
                  >
                    {COLUMN_LABELS[col] || col}
                  </th>
                ))}
                <th className="sticky right-0 z-30 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-6 py-4 text-right text-xs font-black uppercase tracking-[0.06em] text-gray-600 shadow-[-12px_0_20px_-20px_rgba(15,23,42,0.35)]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={selectedCols.length + 1} className="bg-white p-10 text-center">
                    <FiLoader className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : leads.length ? (
                leads.map((lead) => (
                  <tr
                    key={getLeadId(lead)}
                    className="group"
                  >
                    {selectedCols.map((col) => (
                      <td
                        key={col}
                        className={cn(
                          "max-w-[260px] whitespace-nowrap bg-white px-6 py-2.5 text-[15px] font-medium text-gray-900 transition-colors duration-150 group-hover:bg-indigo-50/50",
                          lead.isOverdue ? "bg-rose-50/50" : ""
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2" title={typeof getByPath(lead, col) === "string" ? getByPath(lead, col) : undefined}>
                          <div className="truncate">{renderCell(lead, col)}</div>
                        </div>
                      </td>
                    ))}
                    <td className={cn(
                      "sticky right-0 z-10 bg-white px-6 py-2 text-right transition-colors duration-150 group-hover:bg-indigo-50/50",
                      lead.isOverdue ? "bg-rose-50/50" : "",
                      "shadow-[-14px_0_24px_-22px_rgba(15,23,42,0.45)]"
                    )}>
                      <RowActionsMenu
                        lead={lead}
                        onAction={action}
                        busy={busyId === getLeadId(lead)}
                        converting={convertingId === getLeadId(lead)}
                        canConvert={canConvert}
                        canAdminister={canAdminister}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={selectedCols.length + 1} className="bg-white p-8">
                    <EmptyState
                      icon={<FiGrid className="h-5 w-5" />}
                      title="No leads found"
                      subtitle="Create a new lead or adjust filters."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">{leads.length} {leads.length === 1 ? "lead" : "leads"} loaded</p>
            <p className="mt-0.5 text-xs font-medium text-gray-500">Newest leads appear first.</p>
          </div>
          <button
            type="button"
            className={cn(
              btn,
              hasMore
                ? "bg-indigo-600 px-6 text-white shadow-sm hover:bg-indigo-700"
                : "cursor-not-allowed border border-gray-200 bg-gray-100 px-6 text-gray-400",
              "min-w-[150px] rounded-xl"
            )}
            disabled={!hasMore || loadingMore || loading}
            onClick={() => hasMore && fetchLeads({ reset: false })}
            title={hasMore ? "Load more leads" : "No more leads available"}
          >
            {loadingMore ? <FiLoader className="h-4 w-4 animate-spin" /> : null}
            {loadingMore ? "Loading..." : hasMore ? "Load more" : "All leads loaded"}
          </button>
        </div>
      </div>
    </div>
    <ModalShell open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Lead Filters" subtitle="Filter by lead, queue and follow-up fields" icon={<FiFilter className="h-5 w-5" />} maxWidthClass="max-w-4xl" footer={<div className="flex justify-end gap-2"><button className={cn(btn, btnGhost)} onClick={() => { const empty = Object.fromEntries(Object.keys(filters).map((k)=>[k,"" ])); setFilterDraft(empty); setFilters(empty); setFiltersOpen(false) }}>Clear all</button><button className={cn(btn, btnPrimary)} onClick={() => { setFilters(filterDraft); setFiltersOpen(false) }}>Apply filters</button></div>}><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Status"><select className={input} value={filterDraft.status} onChange={(e) => setFilterDraft((p) => ({ ...p, status: e.target.value }))}><option value="">All</option>{LEAD_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Pipeline stage"><select className={input} value={filterDraft.pipelineStage} onChange={(e) => setFilterDraft((p) => ({ ...p, pipelineStage: e.target.value }))}><option value="">All</option>{PIPELINE_STAGES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Priority"><select className={input} value={filterDraft.priority} onChange={(e) => setFilterDraft((p) => ({ ...p, priority: e.target.value }))}><option value="">All</option>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Temperature"><select className={input} value={filterDraft.leadTemperature} onChange={(e) => setFilterDraft((p) => ({ ...p, leadTemperature: e.target.value }))}><option value="">All</option>{TEMPERATURES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Queue priority"><select className={input} value={filterDraft.workQueuePriority} onChange={(e) => setFilterDraft((p) => ({ ...p, workQueuePriority: e.target.value }))}><option value="">All</option>{WORK_PRIORITIES.map((x)=><option key={x}>{x}</option>)}</select></Field><Field label="Overdue"><select className={input} value={filterDraft.isOverdue} onChange={(e) => setFilterDraft((p) => ({ ...p, isOverdue: e.target.value }))}><option value="">All</option><option value="true">Overdue</option><option value="false">Not overdue</option></select></Field><Field label="Next action type"><input className={input} value={filterDraft.nextActionType} onChange={(e)=>setFilterDraft(p=>({...p,nextActionType:e.target.value}))}/></Field><Field label="Purchase type"><input className={input} value={filterDraft.purchaseType} onChange={(e) => setFilterDraft((p) => ({ ...p, purchaseType: e.target.value }))} /></Field><Field label="Source"><input className={input} value={filterDraft.source} onChange={(e) => setFilterDraft((p) => ({ ...p, source: e.target.value }))} /></Field><Field label="Tag"><input className={input} value={filterDraft.tag} onChange={(e) => setFilterDraft((p) => ({ ...p, tag: e.target.value }))} /></Field><Field label="Next follow-up from"><input type="date" className={input} value={filterDraft.nextFollowUpFrom} onChange={(e) => setFilterDraft((p) => ({ ...p, nextFollowUpFrom: e.target.value }))} /></Field><Field label="Next follow-up to"><input type="date" className={input} value={filterDraft.nextFollowUpTo} onChange={(e) => setFilterDraft((p) => ({ ...p, nextFollowUpTo: e.target.value }))} /></Field><Field label="Last contacted from"><input type="date" className={input} value={filterDraft.lastContactedFrom} onChange={(e) => setFilterDraft((p) => ({ ...p, lastContactedFrom: e.target.value }))} /></Field><Field label="Last contacted to"><input type="date" className={input} value={filterDraft.lastContactedTo} onChange={(e) => setFilterDraft((p) => ({ ...p, lastContactedTo: e.target.value }))} /></Field></div></ModalShell>
    <ColumnPickerModal open={colsOpen} onClose={() => setColsOpen(false)} allowed={allowedCols} selected={selectedCols} onSave={saveColumns} />
    <LeadFullViewModal open={Boolean(viewLeadId)} onClose={() => setViewLeadId("")} leadId={viewLeadId} initialTab={viewInitialTab} refreshTick={viewTick} isMarketing={isMarketing} onAction={(type, lead) => type === "refresh" ? refreshAll() : action(type, lead)} />
    <LeadUpsertModal open={modal.type === "create"} onClose={() => setModal({ type: "", lead: null })} mode="create" users={assignees} canAssignOwner={canAdminister} onSaved={async () => { showToast("success", "Lead created."); await refreshAll() }} />
    <LeadUpsertModal open={modal.type === "edit"} onClose={() => setModal({ type: "", lead: null })} mode="edit" initial={modal.lead} users={assignees} canAssignOwner={canAdminister} onSaved={async () => { showToast("success", "Lead updated."); await refreshAll() }} />
    <NoteModal open={modal.type === "note"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} onSaved={async () => { showToast("success", "Note added."); await refreshAll() }} />
    <StageModal open={modal.type === "stage"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} onSaved={handleStageSaved} refreshToken={stageWorkTick} onOpenRequirement={(lead) => setChildModal({ type: "requirement", lead })} onOpenProposal={(lead) => setChildModal({ type: "proposal", lead })} />
    <StageModal open={modal.type === "nextStage"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} mode="next" lockStage targetStage={getNextPipelineStage(modal.lead)} onSaved={handleStageSaved} refreshToken={stageWorkTick} onOpenRequirement={(lead) => setChildModal({ type: "requirement", lead })} onOpenProposal={(lead) => setChildModal({ type: "proposal", lead })} />
    <RequirementModal open={modal.type === "requirement"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} onSaved={async () => { showToast("success", "Requirement updated."); await refreshAll() }} />
    <RequirementModal open={childModal.type === "requirement"} onClose={() => setChildModal({ type: "", lead: null })} lead={childModal.lead} onSaved={handleChildRequirementSaved} />
    <FollowUpModal open={modal.type === "followup"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} onSaved={async () => { showToast("success", "Follow-up saved."); await refreshAll() }} />
    <ActivityModal open={modal.type === "activity"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} users={assignees} onSaved={async () => { showToast("success", "Activity created."); await refreshAll() }} />
    <ProposalModal open={modal.type === "proposal"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} users={assignees} onSaved={async () => { showToast("success", "Proposal created."); await refreshAll() }} />
    <ProposalModal open={childModal.type === "proposal"} onClose={() => setChildModal({ type: "", lead: null })} lead={childModal.lead} users={assignees} onSaved={handleChildProposalSaved} />
    <DealModal open={modal.type === "deal"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} users={assignees} onSaved={async () => { showToast("success", "Deal created. Continue negotiation inside the deal."); await refreshAll() }} />
    <QuickActionModal open={modal.type === "quick"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} onSaved={async () => { showToast("success", "Quick action saved."); await refreshAll() }} />
    {canAdminister ? <AssignLeadModal open={modal.type === "assign"} onClose={() => setModal({ type: "", lead: null })} lead={modal.lead} onSaved={async () => { showToast("success", "Lead assigned."); await refreshAll() }} /> : null}
    <ReasonModal open={modal.type === "leadWon"} onClose={() => setModal({ type: "", lead: null })} title="Mark lead won" subtitle={modal.lead?.contact?.name || ""} icon={<FiCheckCircle className="h-5 w-5" />} actionLabel="Mark won" onSubmit={async (payload) => { await apiLeadWon(getLeadId(modal.lead), payload); showToast("success", "Lead marked as won."); await refreshAll() }} />
    <ReasonModal open={modal.type === "dealWon"} onClose={() => setModal({ type: "", lead: null, deal: null })} title="Mark deal as won" subtitle="The lead will be converted to a customer automatically." icon={<FiCheckCircle className="h-5 w-5" />} actionLabel="Win deal & convert" onSubmit={async (payload) => { const data = await apiDealWon(modal.deal?._id, payload); showToast("success", "Deal won. Lead converted to customer automatically."); onConvertedToCustomer?.(data?.customer || data); setModal({ type: "", lead: null, deal: null }); await refreshAll() }} />
    <ReasonModal open={modal.type === "leadLost"} onClose={() => setModal({ type: "", lead: null })} title="Mark lead lost" subtitle={modal.lead?.contact?.name || ""} icon={<FiXCircle className="h-5 w-5" />} actionLabel="Mark lost" danger onSubmit={async (payload) => { await apiLeadLost(getLeadId(modal.lead), payload); showToast("success", "Lead marked as lost."); await refreshAll() }} />
    {canAdminister ? <ConfirmDeleteModal open={deleteState.open} leadName={deleteState.lead?.contact?.name || ""} loading={deleteState.loading} onClose={() => setDeleteState({ open: false, lead: null, loading: false })} onConfirm={confirmDelete} /> : null}
    <WorkQueuePanel open={panel === "queue"} onClose={() => setPanel("")} onToast={showToast} onChanged={refreshAll} />
    <TemplatesPanel open={panel === "templates"} onClose={() => setPanel("")} onToast={showToast} />
    {canAdminister ? <AssignmentPanel open={panel === "assignment"} onClose={() => setPanel("")} onToast={showToast} onChanged={refreshAll} /> : null}
    <NotificationsPanel open={panel === "notifications"} onClose={() => setPanel("")} onToast={showToast} onChanged={refreshProductivity} />
  </div>
}
