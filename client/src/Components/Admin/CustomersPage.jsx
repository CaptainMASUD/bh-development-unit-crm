// CustomerPage.jsx
"use client"

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useId,
  useCallback,
} from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import {
  FiUsers,
  FiSearch,
  FiPlus,
  FiEye,
  FiX,
  FiEdit2,
  FiTrash2,
  FiRefreshCcw,
  FiUserCheck,
  FiChevronDown,
  FiCheck,
  FiAlertCircle,
  FiFilter,
  FiColumns,
  FiEyeOff,
  FiLock,
} from "react-icons/fi"
import { AlertTriangle, Loader2, Trash2, BriefcaseBusiness } from "lucide-react"

import CustomerDetails from "./CustomerDetails"
import CustomerTable from "./CustomerTable"
import CustomerHead from "./CustomerHead"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/* =========================
   UI TOKENS (BLUE THEME)
========================= */

const card = "rounded-2xl border border-gray-100 bg-white shadow-sm"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
const chip =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

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

/* =========================
   SMALL HELPERS
========================= */

function normalizeAssignedToArray(assignedTo) {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo
  return [assignedTo]
}

function normalizeStatus(s) {
  return String(s || "").trim().toLowerCase()
}

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidthClass = "max-w-3xl",
}) {
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
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="text-sm text-gray-600 truncate">{subtitle}</p>
                  ) : null}
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

            <div className="p-4 sm:p-5 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">
              {children}
            </div>

            {footer ? (
              <div className="p-4 sm:p-5 border-t border-gray-100 bg-white sticky bottom-0 z-20">
                {footer}
              </div>
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
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
    </div>
  )
}

/* =========================
   MULTI SELECT (PORTAL + NEVER OFFSCREEN)
========================= */

function MultiSelectDropdown({
  options = [],
  value = [],
  onChange,
  placeholder = "Select...",
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const reactId = useId()
  const menuId = `msd-menu-${reactId}`

  const selectedSet = useMemo(() => new Set((value || []).map(String)), [value])
  const selectedCount = selectedSet.size

  const toggle = (id) => {
    const sid = String(id)
    const next = new Set(selectedSet)
    if (next.has(sid)) next.delete(sid)
    else next.add(sid)
    onChange?.(Array.from(next))
  }

  const selectedLabels = useMemo(() => {
    if (!options.length) return ""
    const map = new Map(options.map((o) => [String(o.value), o.label]))
    return Array.from(selectedSet)
      .map((id) => map.get(String(id)))
      .filter(Boolean)
      .join(", ")
  }, [options, selectedSet])

  const [menuPos, setMenuPos] = useState({
    left: 0,
    width: 0,
    openUp: false,
    top: 0,
    bottom: 0,
    maxHeight: 260,
  })

  const recomputeMenuPos = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()

    const GAP = 8
    const MAX = 420
    const MIN = 180

    const spaceBelow = window.innerHeight - r.bottom - GAP
    const spaceAbove = r.top - GAP

    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow
    const available = Math.max(0, openUp ? spaceAbove : spaceBelow)
    const capped = Math.min(MAX, available)
    const maxHeight = Math.max(MIN, capped)

    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - r.width))

    setMenuPos({
      left,
      width: r.width,
      openUp,
      top: r.bottom + GAP,
      bottom: window.innerHeight - r.top + GAP,
      maxHeight,
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    recomputeMenuPos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCount, options.length])

  useEffect(() => {
    if (!open) return
    const onResize = () => recomputeMenuPos()
    const onScroll = () => recomputeMenuPos()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onScroll, true)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onScroll, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const onDoc = (e) => {
      if (!open) return
      const btnEl = btnRef.current
      const menuEl = document.getElementById(menuId)
      if (btnEl?.contains(e.target)) return
      if (menuEl?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open, menuId])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const menu = (
    <AnimatePresence>
      {open ? (
        <motion.div
          id={menuId}
          initial={{ opacity: 0, y: menuPos.openUp ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: menuPos.openUp ? -6 : 6 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          style={{
            position: "fixed",
            left: menuPos.left,
            width: menuPos.width,
            top: menuPos.openUp ? undefined : menuPos.top,
            bottom: menuPos.openUp ? menuPos.bottom : undefined,
          }}
          className="z-[9999] rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
          role="listbox"
          aria-multiselectable="true"
        >
          <div
            className="overflow-y-auto p-2"
            style={{ maxHeight: menuPos.maxHeight }}
          >
            {options.length === 0 ? (
              <div className="p-3 text-sm text-gray-600">No options.</div>
            ) : (
              <ul className="space-y-1">
                {options.map((o) => {
                  const checked = selectedSet.has(String(o.value))
                  return (
                    <li key={String(o.value)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => toggle(o.value)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition text-left focus:outline-none",
                          checked
                            ? "bg-indigo-50 border-indigo-200"
                            : "bg-white border-transparent hover:bg-gray-50"
                        )}
                      >
                        <span className="text-sm font-semibold text-gray-800">
                          {o.label}
                        </span>
                        <span
                          className={cn(
                            "w-6 h-6 rounded-lg border flex items-center justify-center",
                            checked
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-gray-200 text-transparent"
                          )}
                          aria-hidden="true"
                        >
                          <FiCheck className="w-4 h-4" />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="p-2 border-t border-gray-100 bg-white flex items-center justify-between">
            <button
              type="button"
              className={cn(
                btn,
                btnGhost,
                "px-3 py-2 text-sm disabled:opacity-60"
              )}
              onClick={() => onChange?.([])}
              disabled={!selectedCount}
            >
              Clear
            </button>
            <button
              type="button"
              className={cn(btn, btnPrimary, "px-3 py-2 text-sm")}
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          input,
          "text-left flex items-center justify-between gap-3 focus:outline-none"
        )}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-expanded={open}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            selectedCount ? "text-gray-900" : "text-gray-500"
          )}
        >
          {selectedCount ? selectedLabels : placeholder}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {selectedCount ? (
            <span
              className={cn(
                chip,
                "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
              )}
            >
              {selectedCount}
            </span>
          ) : null}
          <FiChevronDown
            className={cn(
              "w-4 h-4 text-gray-500 transition",
              open ? "rotate-180" : ""
            )}
          />
        </span>
      </button>

      {typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </div>
  )
}

/* =========================
   API (CUSTOMER VIEW PREFS) ✅ NEW (SERVER-DRIVEN ALLOWED/DEFAULT)
========================= */

const CUSTOMER_VIEW_KEY = "customers.list"
const CUSTOMER_PREF_LOCAL_FALLBACK_KEY = "customers_table_columns_v2"

async function fetchCustomerViewPreference(viewKey, { signal } = {}) {
  const url = `${API_BASE}/customer-view-preferences/${encodeURIComponent(
    String(viewKey)
  )}`
  const res = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  if (res.status === 304) return { notModified: true, etag: res.headers.get("ETag") || "" }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch view preference")
  return {
    notModified: false,
    etag: res.headers.get("ETag") || "",
    payload: data,
  }
}

async function saveCustomerViewPreference(viewKey, columns) {
  const url = `${API_BASE}/customer-view-preferences/${encodeURIComponent(
    String(viewKey)
  )}`
  const res = await fetch(url, {
    method: "PUT",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ columns }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to save view preference")
  return { etag: res.headers.get("ETag") || "", payload: data }
}

/* =========================
   API (CUSTOMERS)
========================= */

async function fetchCustomerDetails(customerId, signal) {
  const res = await fetch(`${API_BASE}/customers/${customerId}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(data?.message || "Failed to fetch customer details")
  return data?.customer || null
}

async function searchEmployeesForAssign({ q = "", limit = 20, signal } = {}) {
  const params = new URLSearchParams()
  params.set("q", String(q || ""))
  params.set("limit", String(limit))

  const res = await fetch(
    `${API_BASE}/customers/employees/search?${params.toString()}`,
    {
      headers: getAuthHeaders(),
      credentials: "include",
      signal,
    }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to search employees")

  const employees = Array.isArray(data?.employees)
    ? data.employees
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.results)
    ? data.results
    : []

  return employees
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
   FILTER MODAL
========================= */

function FilterChip({ children, onRemove }) {
  return (
    <span className={cn(chip, "bg-gray-50 text-gray-800 ring-gray-200")}>
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 p-1 rounded-full hover:bg-black/5 focus:outline-none"
          aria-label="Remove filter"
          title="Remove"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </span>
  )
}

function FiltersModal({
  open,
  onClose,
  engagementTemplates,
  tplLoading,
  draftTemplateId,
  setDraftTemplateId,
  draftYear,
  setDraftYear,
  draftSubIds,
  setDraftSubIds,
  draftSubMatch,
  setDraftSubMatch,
  draftStatus,
  setDraftStatus,
  onApply,
  onClearDraft,
  activeSummary,
}) {
  const selectedTemplate = useMemo(() => {
    const id = String(draftTemplateId || "")
    return engagementTemplates.find((t) => String(t?._id) === id) || null
  }, [engagementTemplates, draftTemplateId])

  const subOptions = useMemo(() => {
    const subs = selectedTemplate?.subEngagements || []
    return subs.map((s) => ({ value: s._id, label: s.text }))
  }, [selectedTemplate])

  useEffect(() => {
    if (!draftTemplateId) {
      if (draftYear) setDraftYear("")
      if (draftSubIds.length) setDraftSubIds([])
      return
    }
    if (!subOptions.length && draftSubIds.length) setDraftSubIds([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTemplateId, selectedTemplate?._id])

  const hasAnyDraft =
    !!String(draftTemplateId || "").trim() ||
    !!String(draftYear || "").trim() ||
    (draftSubIds?.length || 0) > 0 ||
    !!String(draftStatus || "").trim()

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Choose what to show"
      icon={<FiFilter className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearDraft}
              disabled={!hasAnyDraft}
              className={cn(
                btn,
                btnGhost,
                "px-3 py-2 text-sm disabled:opacity-60"
              )}
              title="Clear filters"
            >
              Clear
            </button>
          </div>

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
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center">
                  <FiFilter className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Filters</p>
                  <p className="text-xs text-gray-500">Type + status</p>
                </div>
              </div>

              {hasAnyDraft ? (
                <span
                  className={cn(
                    chip,
                    "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                  )}
                >
                  Selected
                </span>
              ) : (
                <span
                  className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}
                >
                  None
                </span>
              )}
            </div>

            <div className="p-4 space-y-4">
              <Field label="Customer Status">
                <select
                  value={String(draftStatus || "")}
                  onChange={(e) => setDraftStatus(String(e.target.value || ""))}
                  className={input}
                >
                  <option value="">All</option>
                  <option value="pending">pending</option>
                  <option value="in_progress">in_progress</option>
                  <option value="complete">complete</option>
                </select>
              </Field>

              <Field label="Engagement Type">
                <select
                  value={draftTemplateId}
                  onChange={(e) => {
                    const v = String(e.target.value || "")
                    setDraftTemplateId(v)
                    if (!v) {
                      setDraftYear("")
                      setDraftSubIds([])
                      setDraftSubMatch("any")
                    } else {
                      setDraftSubIds([])
                    }
                  }}
                  className={input}
                  disabled={tplLoading}
                >
                  <option value="">{tplLoading ? "Loading..." : "All"}</option>
                  {engagementTemplates.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Sub-engagements"
                hint={
                  !draftTemplateId
                    ? "Select engagement type first"
                    : subOptions.length
                    ? "Pick one or more"
                    : "No sub-engagements"
                }
              >
                <MultiSelectDropdown
                  options={subOptions}
                  value={draftSubIds}
                  onChange={setDraftSubIds}
                  placeholder={
                    !draftTemplateId
                      ? "Select type first"
                      : subOptions.length
                      ? "Select sub-engagement(s)"
                      : "No sub-engagements"
                  }
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Year"
                  hint={!draftTemplateId ? "Select engagement type first" : ""}
                >
                  <input
                    type="number"
                    min="1900"
                    max="2200"
                    value={draftYear}
                    onChange={(e) => setDraftYear(String(e.target.value))}
                    className={input}
                    placeholder="Any"
                    disabled={!draftTemplateId}
                  />
                </Field>

                <Field
                  label="Match"
                  hint={
                    !draftTemplateId || !draftSubIds.length
                      ? "Select sub-engagements to enable"
                      : ""
                  }
                >
                  <select
                    value={draftSubMatch}
                    onChange={(e) =>
                      setDraftSubMatch(
                        e.target.value === "all" ? "all" : "any"
                      )
                    }
                    className={input}
                    disabled={!draftTemplateId || !draftSubIds.length}
                  >
                    <option value="any">Any selected</option>
                    <option value="all">All selected</option>
                  </select>
                </Field>
              </div>

              <p className="text-xs text-gray-500">
                Tip: Filters help you quickly narrow the list.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
                  <FiCheck className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Preview</p>
                  <p className="text-xs text-gray-500">What will be applied</p>
                </div>
              </div>
            </div>

            <div className="p-4">{activeSummary}</div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   COLUMNS MODAL (SERVER-DRIVEN) ✅ UPDATED + ORDER LIST ✅ NEW
========================= */

/**
 * Label map for your allowed columns from backend.
 * If something isn't in the map, we fallback to the raw key.
 */
const CUSTOMER_COLUMN_LABELS = {
  // base
  name: "Customer Name",
  companyName: "Company",
  email: "Email",
  phone: "Phone",
  address: "Address",

  // contact person
  "contactPerson.name": "Contact Name",
  "contactPerson.email": "Contact Email",
  "contactPerson.phone": "Contact Phone",
  "contactPerson.designation": "Contact Designation",

  // statuses
  status: "Status",
  customerType: "Customer Type",
  lifecycleStage: "Lifecycle Stage",
  origin: "Origin",

  // tags + relations
  tags: "Tags",
  leadId: "Lead",
  assignedTo: "Assigned",
  createdBy: "Created By",

  // timestamps
  createdAt: "Created At",
  updatedAt: "Updated At",

  // optional counts
  jobsCount: "Jobs Count",
  tasksCount: "Tasks Count",

  // computed engagement summary
  engagementLatestYear: "Engagement Year",
  engagementLatestTemplateId: "Engagement Template ID",
  engagementLatestTemplateTitle: "Engagement Type",
  engagementLatestSubEngagementIds: "Sub-engagements",

  // client-only
  actions: "Actions",
}

const CLIENT_MANDATORY_COLUMNS = ["name", "actions"]

function uniqueStrings(arr) {
  const out = []
  const seen = new Set()
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = String(v)
    if (!s) continue
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function applyMandatoryColumns(keys, { allowedSet } = {}) {
  const cleaned = uniqueStrings(keys)
  const filtered = allowedSet ? cleaned.filter((k) => allowedSet.has(k) || CLIENT_MANDATORY_COLUMNS.includes(k)) : cleaned

  const withoutMandatory = filtered.filter((k) => !CLIENT_MANDATORY_COLUMNS.includes(k))
  const hasName = filtered.includes("name")
  const hasActions = filtered.includes("actions")

  const next = []
  if (hasName || CLIENT_MANDATORY_COLUMNS.includes("name")) next.push("name")
  next.push(...withoutMandatory)
  if (hasActions || CLIENT_MANDATORY_COLUMNS.includes("actions")) next.push("actions")

  return uniqueStrings(next)
}

function buildColumnsFromAllowed(allowed = []) {
  const arr = Array.isArray(allowed) ? allowed.map(String) : []
  const merged = uniqueStrings([...CLIENT_MANDATORY_COLUMNS, ...arr])
  return merged.map((key) => ({
    key,
    label: CUSTOMER_COLUMN_LABELS[key] || key,
  }))
}

function ColumnsModal({
  open,
  onClose,
  columns,
  selectedKeys,
  setSelectedKeys,
  onReset,
  onSave,
  dirty,
}) {
  const orderedSelected = useMemo(() => uniqueStrings(selectedKeys || []), [selectedKeys])
  const selectedSet = useMemo(() => new Set(orderedSelected.map(String)), [orderedSelected])

  const isLocked = useCallback((k) => CLIENT_MANDATORY_COLUMNS.includes(String(k)), [])

  const toggle = (k) => {
    const key = String(k)
    if (isLocked(key)) return

    setSelectedKeys((prev) => {
      const cur = uniqueStrings(prev || [])
      const set = new Set(cur.map(String))

      if (set.has(key)) {
        const next = cur.filter((x) => String(x) !== key)
        // prevent empty selection (also keep mandatory)
        const safe = applyMandatoryColumns(next)
        if (safe.length === 0) return applyMandatoryColumns(cur)
        return safe
      }

      const next = [...cur, key]
      return applyMandatoryColumns(next)
    })
  }

  const removeFromOrder = (k) => {
    const key = String(k)
    if (isLocked(key)) return
    setSelectedKeys((prev) => {
      const cur = uniqueStrings(prev || [])
      const next = cur.filter((x) => String(x) !== key)
      const safe = applyMandatoryColumns(next)
      if (safe.length === 0) return applyMandatoryColumns(cur)
      return safe
    })
  }

  const move = (k, dir) => {
    const key = String(k)
    if (!key) return
    if (isLocked(key)) return

    setSelectedKeys((prev) => {
      const curRaw = applyMandatoryColumns(prev || [])
      const cur = curRaw.slice()

      const i = cur.findIndex((x) => String(x) === key)
      if (i === -1) return curRaw

      const target = dir === "up" ? i - 1 : i + 1
      if (target < 0 || target >= cur.length) return curRaw

      // don't swap into locked slots (keep name first, actions last)
      if (isLocked(cur[target])) return curRaw

      const next = cur.slice()
      const tmp = next[i]
      next[i] = next[target]
      next[target] = tmp
      return applyMandatoryColumns(next)
    })
  }

  const selectedCount = orderedSelected.length

  const availableColumns = useMemo(() => {
    const cols = Array.isArray(columns) ? columns : []
    const map = new Map(cols.map((c) => [String(c.key), c]))
    const ordered = cols.slice().sort((a, b) => String(a.label).localeCompare(String(b.label)))
    // ensure mandatory columns exist in list
    const ensured = uniqueStrings([...CLIENT_MANDATORY_COLUMNS, ...ordered.map((c) => c.key)]).map((k) => {
      const hit = map.get(String(k))
      return hit || { key: k, label: CUSTOMER_COLUMN_LABELS[String(k)] || String(k) }
    })
    return ensured
  }, [columns])

  const selectedOrderItems = useMemo(() => {
    const map = new Map(availableColumns.map((c) => [String(c.key), c]))
    return orderedSelected.map((k) => map.get(String(k)) || { key: k, label: CUSTOMER_COLUMN_LABELS[String(k)] || String(k) })
  }, [availableColumns, orderedSelected])

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Choose columns"
      subtitle="Show/hide columns in the table"
      icon={<FiColumns className="w-5 h-5" />}
      maxWidthClass="max-w-5xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={onReset} className={cn(btn, btnGhost)} title="Reset to defaults">
              Default
            </button>
            <button
              onClick={() => {
                const all = uniqueStrings(availableColumns.map((c) => c.key))
                setSelectedKeys(applyMandatoryColumns(all))
              }}
              className={cn(btn, btnGhost)}
              title="Show all columns"
            >
              Show all
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className={cn(btn, btnGhost)}>
              Cancel
            </button>
            <button onClick={onSave} className={cn(btn, btnPrimary)}>
              Apply
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Available columns */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Available columns</p>
                <p className="text-xs text-gray-500">Select/deselect columns (required columns are locked)</p>
              </div>
              <span
                className={cn(
                  chip,
                  dirty ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10" : "bg-gray-50 text-gray-700 ring-gray-200"
                )}
              >
                Selected: {selectedCount}
              </span>
            </div>

            <div className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableColumns.map((c) => {
                  const checked = selectedSet.has(String(c.key))
                  const locked = isLocked(c.key)
                  return (
                    <button
                      key={String(c.key)}
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition text-left focus:outline-none",
                        checked ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-100 hover:bg-gray-50",
                        locked ? "opacity-95" : ""
                      )}
                      title={locked ? "This column is required" : checked ? "Click to hide" : "Click to show"}
                    >
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate block">
                          {c.label}
                        </span>
                        {locked ? (
                          <span className="text-[11px] text-gray-500">Required</span>
                        ) : null}
                      </div>

                      <span
                        className={cn(
                          "w-6 h-6 rounded-lg border flex items-center justify-center shrink-0",
                          checked ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-transparent"
                        )}
                        aria-hidden="true"
                      >
                        <FiCheck className="w-4 h-4" />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Selected order */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
              <p className="text-sm font-bold text-gray-900">Selected order</p>
              <p className="text-xs text-gray-500 mt-0.5">Use the arrows to reorder.</p>
            </div>

            <div className="p-3 space-y-2">
              {selectedOrderItems.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-600">
                  No columns selected.
                </div>
              ) : (
                selectedOrderItems.map((c, idx) => {
                  const key = String(c.key)
                  const locked = isLocked(key)

                  return (
                    <div
                      key={key || `sel-${idx}`}
                      className="w-full rounded-2xl border border-gray-100 bg-white p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-xs font-bold text-gray-700 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{c.label}</p>
                          {locked ? (
                            <p className="text-[11px] text-gray-500">Required</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => move(key, "up")}
                          disabled={locked || idx === 0}
                          className={cn(
                            "p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none disabled:opacity-50 disabled:hover:bg-white"
                          )}
                          aria-label="Move up"
                          title="Move up"
                        >
                          <FiChevronDown className="w-4 h-4 text-gray-700 rotate-180" />
                        </button>

                        <button
                          type="button"
                          onClick={() => move(key, "down")}
                          disabled={locked || idx === selectedOrderItems.length - 1}
                          className={cn(
                            "p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none disabled:opacity-50 disabled:hover:bg-white"
                          )}
                          aria-label="Move down"
                          title="Move down"
                        >
                          <FiChevronDown className="w-4 h-4 text-gray-700" />
                        </button>

                        <button
                          type="button"
                          onClick={() => removeFromOrder(key)}
                          disabled={locked}
                          className={cn(
                            "p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none disabled:opacity-50 disabled:hover:bg-white"
                          )}
                          aria-label="Remove"
                          title="Remove"
                        >
                          <FiX className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="mt-3 p-3 rounded-2xl border border-gray-100 bg-gray-50/60 text-xs text-gray-600">
            Tip: “Customer Name” and “Actions” are required, so they always stay visible (CRUD won’t disappear).
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   CUSTOMER UPSERT MODAL
========================= */

function CustomerUpsertModal({ open, onClose, mode = "create", initial, onSaved }) {
  const currentYear = new Date().getFullYear()

  const [form, setForm] = useState({
    name: "",
    companyName: "",
    phone: "",
    email: "",
    address: "",
    status: "in_progress",
    customerType: "new",
    engagementYear: String(currentYear),
    engagementTemplateId: "",
    subEngagementIds: [],
    cpName: "",
    cpPhone: "",
    cpEmail: "",
    cpDesignation: "",
  })

  const [engagementTemplates, setEngagementTemplates] = useState([])
  const [tplLoading, setTplLoading] = useState(false)

  const [detailLoading, setDetailLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const detailAbortRef = useRef(null)

  const selectedTemplate = useMemo(() => {
    const id = String(form.engagementTemplateId || "")
    return engagementTemplates.find((t) => String(t?._id) === id) || null
  }, [engagementTemplates, form.engagementTemplateId])

  const subEngagementOptions = useMemo(() => {
    const subs = selectedTemplate?.subEngagements || []
    return subs.map((s) => ({ value: s._id, label: s.text }))
  }, [selectedTemplate])

  const fetchEngagementTemplates = async ({ includeInactive = false } = {}) => {
    setTplLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "200")
      params.set("sort", "title")
      params.set("active", includeInactive ? "false" : "true")

      const res = await fetch(
        `${API_BASE}/engagement-templates?${params.toString()}`,
        {
          headers: getAuthHeaders(),
          credentials: "include",
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok)
        throw new Error(data?.message || "Failed to load engagement types")
      setEngagementTemplates(Array.isArray(data?.templates) ? data.templates : [])
    } catch {
      setEngagementTemplates([])
    } finally {
      setTplLoading(false)
    }
  }

  const applyCustomerToForm = (c) => {
    const engagementsArr = Array.isArray(c?.engagements) ? c.engagements : []
    const latestEng =
      engagementsArr.length > 0
        ? engagementsArr
            .slice()
            .sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0))[0]
        : null

    setForm({
      name: c?.name || "",
      companyName: c?.companyName || "",
      phone: c?.phone || "",
      email: c?.email || "",
      address: c?.address || "",
      status: c?.status || "in_progress",
      customerType: c?.customerType || "new",
      engagementYear: String(latestEng?.year ?? currentYear),
      engagementTemplateId: String(latestEng?.engagementTemplateId ?? ""),
      subEngagementIds: Array.isArray(latestEng?.subEngagementIds)
        ? latestEng.subEngagementIds.map(String)
        : [],
      cpName: c?.contactPerson?.name || "",
      cpPhone: c?.contactPerson?.phone || "",
      cpEmail: c?.contactPerson?.email || "",
      cpDesignation: c?.contactPerson?.designation || "",
    })
  }

  useEffect(() => {
    if (!open) return

    setError("")
    setDetailLoading(false)

    if (detailAbortRef.current) detailAbortRef.current.abort()
    detailAbortRef.current = new AbortController()

    const includeInactive = mode === "edit"
    fetchEngagementTemplates({ includeInactive })

    if (mode === "edit" && initial?._id) {
      setDetailLoading(true)
      fetchCustomerDetails(initial._id, detailAbortRef.current.signal)
        .then((c) => {
          if (c) applyCustomerToForm(c)
          else applyCustomerToForm(initial || {})
        })
        .catch(() => {
          applyCustomerToForm(initial || {})
        })
        .finally(() => setDetailLoading(false))
    } else {
      applyCustomerToForm(initial || {})
    }

    return () => detailAbortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initial?._id])

  useEffect(() => {
    const subs = selectedTemplate?.subEngagements || []
    if (!form.engagementTemplateId) {
      if (form.subEngagementIds.length)
        setForm((p) => ({ ...p, subEngagementIds: [] }))
      return
    }
    if (!subs.length && form.subEngagementIds.length) {
      setForm((p) => ({ ...p, subEngagementIds: [] }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.engagementTemplateId, selectedTemplate?._id])

  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    if (!form.name.trim()) return setError("Customer name is required.")
    if (!form.cpName.trim()) return setError("Contact person name is required.")

    const hasEngType = !!String(form.engagementTemplateId || "").trim()
    const yearNum = Number(form.engagementYear)
    const hasYear =
      Number.isFinite(yearNum) && String(form.engagementYear || "").trim() !== ""

    if (mode === "create") {
      if (!hasYear) return setError("Engagement year is required.")
      if (!hasEngType) return setError("Engagement type is required.")
    } else {
      if ((hasYear && !hasEngType) || (hasEngType && !hasYear)) {
        return setError("To update engagement, select BOTH Year and Type.")
      }
    }

    setIsSubmitting(true)
    setError("")
    try {
      const basePayload = {
        name: form.name.trim(),
        companyName: form.companyName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim()
          ? form.email.trim().toLowerCase()
          : undefined,
        address: form.address.trim() || "",
        status: form.status || "in_progress",
        customerType: form.customerType || "new",
        contactPerson: {
          name: form.cpName.trim(),
          phone: form.cpPhone.trim() || undefined,
          email: form.cpEmail.trim()
            ? form.cpEmail.trim().toLowerCase()
            : undefined,
          designation: form.cpDesignation.trim() || undefined,
        },
      }

      if (mode === "create") {
        const payload = {
          ...basePayload,
          engagementYear: yearNum,
          engagementTemplateId: String(form.engagementTemplateId),
          subEngagementIds: Array.isArray(form.subEngagementIds)
            ? form.subEngagementIds.map(String)
            : [],
        }

        const res = await fetch(`${API_BASE}/customers`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Save failed")
      } else {
        const res = await fetch(`${API_BASE}/customers/${initial?._id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(basePayload),
          credentials: "include",
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Update failed")

        if (hasYear && hasEngType) {
          const res2 = await fetch(
            `${API_BASE}/customers/${initial?._id}/engagements`,
            {
              method: "PATCH",
              headers: getAuthHeaders(),
              body: JSON.stringify({
                year: yearNum,
                engagementTemplateId: String(form.engagementTemplateId),
                subEngagementIds: Array.isArray(form.subEngagementIds)
                  ? form.subEngagementIds.map(String)
                  : [],
              }),
              credentials: "include",
            }
          )
          const data2 = await res2.json().catch(() => ({}))
          if (!res2.ok)
            throw new Error(data2?.message || "Engagement update failed")
        }
      }

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
      title={mode === "edit" ? "Edit Customer" : "Create Customer"}
      subtitle="Customer details"
      icon={
        mode === "edit" ? (
          <FiEdit2 className="w-5 h-5" />
        ) : (
          <FiPlus className="w-5 h-5" />
        )
      }
      footer={
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            className={cn(btn, btnGhost)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isSubmitting}
            className={cn(btn, btnPrimary, "disabled:opacity-60")}
          >
            {isSubmitting ? "Saving..." : mode === "edit" ? "Update" : "Create"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {detailLoading ? (
        <div className="mb-5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading customer details...
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Customer Name *">
          <input
            value={form.name}
            onChange={update("name")}
            className={input}
            placeholder="Customer name"
          />
        </Field>

        <Field label="Company">
          <input
            value={form.companyName}
            onChange={update("companyName")}
            className={input}
            placeholder="Company name"
          />
        </Field>

        <Field label="Phone">
          <input
            value={form.phone}
            onChange={update("phone")}
            className={input}
            placeholder="01XXXXXXXXX"
          />
        </Field>

        <Field label="Email">
          <input
            value={form.email}
            onChange={update("email")}
            className={input}
            placeholder="email@example.com"
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Address">
            <input
              value={form.address}
              onChange={update("address")}
              className={input}
              placeholder="Street, area, city"
            />
          </Field>
        </div>

        <Field label="Status">
          <select
            value={form.status}
            onChange={update("status")}
            className={input}
          >
            <option value="pending">pending</option>
            <option value="in_progress">in_progress</option>
            <option value="complete">complete</option>
          </select>
        </Field>

        <Field label="Customer Type">
          <select
            value={form.customerType}
            onChange={update("customerType")}
            className={input}
          >
            <option value="new">new</option>
            <option value="recurring">recurring</option>
          </select>
        </Field>

        <Field
          label={mode === "create" ? "Engagement Year *" : "Engagement Year"}
        >
          <input
            type="number"
            min="1900"
            max="2200"
            value={form.engagementYear}
            onChange={update("engagementYear")}
            className={input}
            placeholder="e.g. 2026"
          />
        </Field>

        <Field
          label={mode === "create" ? "Engagement Type *" : "Engagement Type"}
        >
          <select
            value={form.engagementTemplateId}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                engagementTemplateId: e.target.value,
                subEngagementIds: [],
              }))
            }
            className={input}
            disabled={tplLoading}
          >
            <option value="">
              {tplLoading ? "Loading..." : "Select engagement type"}
            </option>
            {engagementTemplates.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>

        {selectedTemplate?.subEngagements?.length ? (
          <div className="md:col-span-2">
            <Field label="Sub-engagements (optional)">
              <MultiSelectDropdown
                options={subEngagementOptions}
                value={form.subEngagementIds}
                onChange={(ids) =>
                  setForm((p) => ({ ...p, subEngagementIds: ids }))
                }
                placeholder="Select sub-engagement(s)"
              />
            </Field>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <div className="mt-2 border-t border-gray-100 pt-4">
            <p className="text-sm font-bold text-gray-900 mb-3">
              Contact Person
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name *">
                <input
                  value={form.cpName}
                  onChange={update("cpName")}
                  className={input}
                  placeholder="Contact person name"
                />
              </Field>

              <Field label="Phone">
                <input
                  value={form.cpPhone}
                  onChange={update("cpPhone")}
                  className={input}
                  placeholder="01XXXXXXXXX"
                />
              </Field>

              <Field label="Email">
                <input
                  value={form.cpEmail}
                  onChange={update("cpEmail")}
                  className={input}
                  placeholder="contact@email.com"
                />
              </Field>

              <Field label="Designation">
                <input
                  value={form.cpDesignation}
                  onChange={update("cpDesignation")}
                  className={input}
                  placeholder="Manager / Owner"
                />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   ASSIGN MODAL
========================= */

function AssignModal({ open, onClose, customer, onAssign }) {
  const [employeeIds, setEmployeeIds] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef(null)

  const cacheRef = useRef(new Map())

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(String(q || "").trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!open) return
    setError("")
    setQ("")
    setDebouncedQ("")
    setResults([])

    const arr = normalizeAssignedToArray(customer?.assignedTo)
    const ids = arr
      .map((x) => (typeof x === "object" ? x?._id : x))
      .filter(Boolean)
      .map(String)
    setEmployeeIds(ids)

    for (const u of arr) {
      if (u && typeof u === "object" && u._id)
        cacheRef.current.set(String(u._id), u)
    }
  }, [open, customer])

  const toggle = (id) => {
    setEmployeeIds((prev) => {
      const s = new Set(prev.map(String))
      const sid = String(id)
      if (s.has(sid)) s.delete(sid)
      else s.add(sid)
      return Array.from(s)
    })
  }

  useEffect(() => {
    if (!open) return

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError("")
    searchEmployeesForAssign({
      q: debouncedQ,
      limit: 30,
      signal: controller.signal,
    })
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : []
        setResults(list)
        for (const u of list) {
          if (u?._id) cacheRef.current.set(String(u._id), u)
        }
      })
      .catch((e) => {
        if (e?.name !== "AbortError") {
          setResults([])
          setError(e?.message || "Failed to load employees.")
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [open, debouncedQ])

  const selectedBadges = useMemo(() => {
    const out = []
    for (const id of employeeIds) {
      const u = cacheRef.current.get(String(id))
      if (u?.name)
        out.push({
          id: String(id),
          label: `${u.name}${u.email ? ` • ${u.email}` : ""}`,
        })
      else out.push({ id: String(id), label: String(id) })
    }
    return out
  }, [employeeIds])

  const submit = async () => {
    setIsSaving(true)
    setError("")
    try {
      await onAssign?.(employeeIds)
      onClose?.()
    } catch (e) {
      setError(e?.message || "Assign failed")
    } finally {
      setIsSaving(false)
    }
  }

  const listTitle = useMemo(
    () => (!debouncedQ ? "Employees" : "Search results"),
    [debouncedQ]
  )
  const resultsHint = useMemo(
    () =>
      !debouncedQ ? "Showing recent employees" : `Matches for “${debouncedQ}”`,
    [debouncedQ]
  )

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Assign Customer"
      subtitle={customer?.name ? `Customer: ${customer.name}` : ""}
      icon={<FiUserCheck className="w-5 h-5" />}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <button
            type="button"
            className={cn(btn, btnGhost)}
            onClick={() => setEmployeeIds([])}
            disabled={isSaving || employeeIds.length === 0}
            title="Clear assignment"
          >
            Clear
          </button>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <button
              onClick={onClose}
              className={cn(btn, btnGhost)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={isSaving}
              className={cn(btn, btnPrimary, "disabled:opacity-60")}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  Select employee(s)
                </p>
                <p className="text-xs text-gray-500">
                  Type a name or email to search
                </p>
              </div>
              <span
                className={cn(
                  chip,
                  "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
                )}
              >
                Selected: {employeeIds.length}
              </span>
            </div>

            <div className="mt-3">
              <div
                className={cn(
                  "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 flex items-center gap-2",
                  "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent"
                )}
              >
                <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search employees…"
                  className={cn(
                    "w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 border-0 outline-none ring-0"
                  )}
                />
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                ) : null}
                {q ? (
                  <button
                    type="button"
                    className="p-1 rounded-lg hover:bg-gray-100 focus:outline-none"
                    onClick={() => setQ("")}
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <FiX className="w-4 h-4 text-gray-600" />
                  </button>
                ) : null}
              </div>
            </div>

            {selectedBadges.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedBadges.slice(0, 6).map((b) => (
                  <span
                    key={b.id}
                    className={cn(
                      chip,
                      "bg-gray-50 text-gray-800 ring-gray-200"
                    )}
                  >
                    <span className="truncate max-w-[16rem]">{b.label}</span>
                    <button
                      type="button"
                      className="p-1 rounded-full hover:bg-black/5 focus:outline-none"
                      aria-label="Remove"
                      title="Remove"
                      onClick={() => toggle(b.id)}
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {selectedBadges.length > 6 ? (
                  <span
                    className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}
                  >
                    +{selectedBadges.length - 6} more
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-500">
                No employees selected.
              </p>
            )}
          </div>

          <div className="px-4 py-2.5 bg-gray-50/80 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">{listTitle}</p>
            <p className="text-xs text-gray-500">{resultsHint}</p>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2 bg-white [scrollbar-gutter:stable]">
          {loading && results.length === 0 ? (
            <div className="p-4 text-sm text-gray-600 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              No employees found.
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((e, idx) => {
                const id = String(e?._id || "")
                const checked = employeeIds.includes(id)
                return (
                  <li key={id || `emp-${idx}`}>
                    <button
                      type="button"
                      onClick={() => toggle(e?._id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition text-left focus:outline-none",
                        checked
                          ? "bg-indigo-50 border-indigo-200"
                          : "bg-white border-gray-100 hover:bg-gray-50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {e?.name || "—"}
                        </p>
                        {e?.email ? (
                          <p className="text-xs text-gray-500 truncate">
                            {e.email}
                          </p>
                        ) : null}
                      </div>

                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg border flex items-center justify-center shrink-0",
                          checked
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-gray-200 text-transparent"
                        )}
                        aria-hidden="true"
                      >
                        <FiCheck className="w-4 h-4" />
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </ModalShell>
  )
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
  requirePassword = false,
}) {
  const closeBtnRef = useRef(null)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState("")

  useEffect(() => {
    if (!open) return
    setPassword("")
    setShowPassword(false)
    setPasswordError("")
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
            {!requirePassword ? <p className="text-sm text-gray-600 mt-1">{description}</p> : null}
            {extra ? <div className="mt-3">{extra}</div> : null}
            {requirePassword ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <FiLock className="h-4 w-4 text-indigo-600" />
                  Admin password
                </div>
                {passwordError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">{passwordError}</p> : null}
                <div className="relative mt-3">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); setPasswordError("") }}
                    placeholder="Admin password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-11 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : null}
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
            disabled={loading || (requirePassword && password.length < 6)}
            onClick={async () => {
              try {
                await onConfirm?.(password)
              } catch (error) {
                if (requirePassword) setPasswordError(error?.message || "Delete failed")
              }
            }}
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
   VIEW CHOICE MODAL
========================= */

function ViewChoiceModal({ open, onClose, customerName, onPick }) {
  if (!open) return null

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Open Customer"
      subtitle={
        customerName
          ? `Choose what to open for: ${customerName}`
          : "Choose what to open"
      }
      icon={<FiEye className="w-5 h-5" />}
      maxWidthClass="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)}>
            Cancel
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick?.("overview")}
          className={cn(
            "w-full rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition p-4 text-left",
            "flex items-center justify-between gap-3"
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">Overview</p>
            <p className="text-xs text-gray-500 mt-0.5">Open the Overview tab</p>
          </div>
          <span
            className={cn(
              chip,
              "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
            )}
          >
            Default
          </span>
        </button>

        <button
          type="button"
          onClick={() => onPick?.("crm")}
          className={cn(
            "w-full rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition p-4 text-left",
            "flex items-center justify-between gap-3"
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">CRM</p>
            <p className="text-xs text-gray-500 mt-0.5">Open the CRM tab</p>
          </div>
          <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>
            Open
          </span>
        </button>
      </div>
    </ModalShell>
  )
}

/* =========================
   JOB UPSERT MODAL
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

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={
        mode === "edit"
          ? "Edit Job"
          : parentJobId
          ? "Create Sub-job"
          : "Create Job"
      }
      subtitle={customer?.name ? `Customer: ${customer.name}` : ""}
      icon={<BriefcaseBusiness className="w-5 h-5" />}
      maxWidthClass="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
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
      }
    >
      {error ? (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Job title *">
            <input
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className={input}
              placeholder="e.g. Audit preparation"
            />
          </Field>
        </div>

        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            className={input}
          >
            <option value="active">active</option>
            <option value="on_hold">on_hold</option>
            <option value="completed">completed</option>
          </select>
        </Field>

        <Field label="Code (optional)">
          <input
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            className={input}
            placeholder="e.g. JOB-001"
          />
        </Field>

        <Field label="Start (optional)">
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
            className={input}
          />
        </Field>

        <Field label="End (optional)">
          <input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
            className={input}
          />
        </Field>

        <div className="md:col-span-2">
          <Field
            label="Assignees (optional)"
            hint={
              assigneeOptions.length
                ? "Pick from the employees already assigned to this customer."
                : "Assign employees to this customer first, then you can pick them here."
            }
          >
            <MultiSelectDropdown
              options={assigneeOptions}
              value={form.assignedTo}
              onChange={(ids) => setForm((p) => ({ ...p, assignedTo: ids }))}
              placeholder={assigneeOptions.length ? "Select employee(s)" : "No assignees yet"}
            />
          </Field>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   MAIN PAGE
========================= */

export default function AdminCustomersPage({
  openCustomerId,
  onCustomerOpened,
  routeCustomerId,
  routeCustomerTab = "overview",
  onNavigateCustomer,
  onBackToCustomers,
}) {
  const PAGE_SIZE = 25

  const [customers, setCustomers] = useState([])

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState("")

  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")

  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerTab, setSelectedCustomerTab] = useState("overview")

  const [showCreate, setShowCreate] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [assignCustomer, setAssignCustomer] = useState(null)

  const [viewChoice, setViewChoice] = useState({ open: false, customer: null })

  const showToast = useCallback((type, message) => {
    const safeMessage = message || "Something went wrong."
    if (type === "error") toast.error(safeMessage)
    else toast.success(safeMessage)
  }, [])

  const abortRef = useRef(null)

  const [deleteModal, setDeleteModal] = useState({ open: false, customerId: "", customerName: "" })
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [engagementTemplates, setEngagementTemplates] = useState([])
  const [tplLoading, setTplLoading] = useState(false)

  const [filterEngagementTemplateId, setFilterEngagementTemplateId] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterSubEngagementIds, setFilterSubEngagementIds] = useState([])
  const [subMatch, setSubMatch] = useState("any")
  const [filterStatus, setFilterStatus] = useState("")

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftTemplateId, setDraftTemplateId] = useState("")
  const [draftYear, setDraftYear] = useState("")
  const [draftSubIds, setDraftSubIds] = useState([])
  const [draftSubMatch, setDraftSubMatch] = useState("any")
  const [draftStatus, setDraftStatus] = useState("")

  const [expandedCustomerId, setExpandedCustomerId] = useState(null)
  const [closingCustomerId, setClosingCustomerId] = useState(null)

  const [jobsByCustomerId, setJobsByCustomerId] = useState({})

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

  // ✅ Column options state (SERVER-DRIVEN)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnsLoading, setColumnsLoading] = useState(true)
  const [allowedColumns, setAllowedColumns] = useState([]) // from backend
  const [columnsCatalog, setColumnsCatalog] = useState([]) // [{key,label}] built from allowedColumns
  const [defaultColumns, setDefaultColumns] = useState([]) // backend default (or allowed fallback)
  const [visibleColumns, setVisibleColumns] = useState([]) // current applied (ORDERED)
  const [draftColumns, setDraftColumns] = useState([]) // modal draft (ORDERED)

  const prefEtagRef = useRef("")
  const prefAbortRef = useRef(null)

  const columnsDefaultCount = defaultColumns.length
  const columnsSelectedCount = draftColumns.length

  const columnsDirty = useMemo(() => {
    const a = uniqueStrings(visibleColumns || []).join("|")
    const b = uniqueStrings(draftColumns || []).join("|")
    return a !== b
  }, [visibleColumns, draftColumns])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 200)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    if (!openCustomerId) return
    setSelectedCustomerId(openCustomerId)
    setSelectedCustomerTab("overview")
    onCustomerOpened?.()
  }, [openCustomerId, onCustomerOpened])

  useEffect(() => {
    if (routeCustomerId) {
      setSelectedCustomerId(routeCustomerId)
      setSelectedCustomerTab(routeCustomerTab === "crm" ? "crm" : "overview")
      return
    }

    if (onNavigateCustomer) {
      setSelectedCustomerId(null)
      setSelectedCustomerTab("overview")
    }
  }, [routeCustomerId, routeCustomerTab, onNavigateCustomer])

  const fetchEngagementTemplates = async () => {
    setTplLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "200")
      params.set("sort", "title")
      params.set("active", "true")

      const res = await fetch(`${API_BASE}/engagement-templates?${params.toString()}`, {
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to load engagement types")
      setEngagementTemplates(Array.isArray(data?.templates) ? data.templates : [])
    } catch {
      setEngagementTemplates([])
    } finally {
      setTplLoading(false)
    }
  }

  const buildFilterParams = () => {
    const params = new URLSearchParams()
    params.set("limit", String(PAGE_SIZE))

    const status = normalizeStatus(filterStatus)
    if (status) params.set("status", status)

    const tplId = String(filterEngagementTemplateId || "").trim()
    const year = String(filterYear || "").trim()
    const subIds = Array.isArray(filterSubEngagementIds)
      ? filterSubEngagementIds.map(String).filter(Boolean)
      : []

    const hasAnyEngFilter = !!tplId || !!year || subIds.length > 0
    if (hasAnyEngFilter && !tplId) {
      throw new Error("Please select an Engagement Type first.")
    }

    if (tplId) params.set("engagementTemplateId", tplId)
    if (year) params.set("engagementYear", year)
    if (subIds.length) params.set("subEngagementIds", subIds.join(","))
    if (tplId && subIds.length) params.set("subMatch", subMatch === "all" ? "all" : "any")

    return params
  }

  const fetchCustomersPage = useCallback(
    async ({ reset = false } = {}) => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (reset) {
        setIsLoading(true)
        setCustomers([])
        setNextCursor(null)
        setHasMore(false)
      } else {
        setIsLoadingMore(true)
      }

      setError("")
      try {
        const params = buildFilterParams()
        if (!reset && nextCursor) params.set("cursor", String(nextCursor))

        const res = await fetch(`${API_BASE}/customers?${params.toString()}`, {
          headers: getAuthHeaders(),
          credentials: "include",
          signal: controller.signal,
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.message || "Failed to fetch customers")

        const items = Array.isArray(data?.customers) ? data.customers : []
        const nc = data?.nextCursor ?? null
        const hm = !!data?.hasMore

        setCustomers((prev) => (reset ? items : [...prev, ...items]))
        setNextCursor(nc)
        setHasMore(hm)
      } catch (e) {
        if (e?.name !== "AbortError") setError(e?.message || "Failed to load customers.")
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [nextCursor, filterEngagementTemplateId, filterYear, subMatch, filterStatus, filterSubEngagementIds]
  )

  // ✅ Load saved columns from SERVER preference (with local fallback)
  useEffect(() => {
    setColumnsLoading(true)

    if (prefAbortRef.current) prefAbortRef.current.abort()
    const controller = new AbortController()
    prefAbortRef.current = controller

    const applyFromPayload = (payload) => {
      const allowed = Array.isArray(payload?.allowedColumns) ? payload.allowedColumns.map(String) : []
      const cols = Array.isArray(payload?.columns) ? payload.columns.map(String) : []

      const allowedSet = new Set(allowed.map(String))
      const cleanedCols = cols.filter((c) => allowedSet.has(String(c)) || CLIENT_MANDATORY_COLUMNS.includes(String(c)))
      const finalCols = applyMandatoryColumns(cleanedCols.length ? cleanedCols : allowed, { allowedSet })

      setAllowedColumns(allowed)
      setColumnsCatalog(buildColumnsFromAllowed(allowed))
      setDefaultColumns(finalCols) // treat as reset target
      setVisibleColumns(finalCols)
      setDraftColumns(finalCols)

      try {
        localStorage.setItem(CUSTOMER_PREF_LOCAL_FALLBACK_KEY, JSON.stringify(finalCols))
      } catch {}
    }

    ;(async () => {
      try {
        // try server first
        const res = await fetchCustomerViewPreference(CUSTOMER_VIEW_KEY, { signal: controller.signal })
        if (!res?.notModified && res?.etag) prefEtagRef.current = res.etag
        if (!res?.notModified && res?.payload) {
          applyFromPayload(res.payload)
          setColumnsLoading(false)
          return
        }

        // if 304 or no payload, still try local fallback
        try {
          const raw = localStorage.getItem(CUSTOMER_PREF_LOCAL_FALLBACK_KEY)
          const parsed = raw ? JSON.parse(raw) : null
          const keys = Array.isArray(parsed) ? parsed.map(String) : []
          if (keys.length) {
            const allowedSet = new Set((allowedColumns || []).map(String))
            const safe = applyMandatoryColumns(keys, { allowedSet })
            setVisibleColumns(safe)
            setDraftColumns(safe)
          }
        } catch {}

        setColumnsLoading(false)
      } catch {
        // server failed → local fallback
        try {
          const raw = localStorage.getItem(CUSTOMER_PREF_LOCAL_FALLBACK_KEY)
          const parsed = raw ? JSON.parse(raw) : null
          const keys = Array.isArray(parsed) ? parsed.map(String) : []
          if (keys.length) {
            const allowedSet = new Set((allowedColumns || []).map(String))
            const safe = applyMandatoryColumns(keys, { allowedSet })
            setVisibleColumns(safe)
            setDraftColumns(safe)
          }
        } catch {}
        setColumnsLoading(false)
      }
    })()

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchCustomersPage({ reset: true })
    fetchEngagementTemplates()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchCustomersPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEngagementTemplateId, filterYear, subMatch, filterStatus, JSON.stringify(filterSubEngagementIds)])

  const filtered = useMemo(() => {
    if (!debounced) return customers

    return customers.filter((c) => {
      const cpName = c?.contactPerson?.name || ""
      const assignedArr = normalizeAssignedToArray(c?.assignedTo)
      const assignedNames = assignedArr
        .map((x) => (typeof x === "object" ? x?.name : ""))
        .filter(Boolean)
        .join(" ")

      const s = `${c?.name || ""} ${c?.companyName || ""} ${c?.phone || ""} ${c?.email || ""} ${cpName} ${assignedNames} ${c?.status || ""}`.toLowerCase()
      return s.includes(debounced)
    })
  }, [customers, debounced])

  const requestDeleteCustomer = (customer) => {
    setDeleteModal({
      open: true,
      customerId: customer?._id || "",
      customerName: customer?.name || "this customer",
    })
  }

  const closeDelete = () => {
    if (deleteLoading) return
    setDeleteModal((p) => ({ ...p, open: false }))
  }

  const confirmDelete = async (password) => {
    if (!deleteModal.customerId) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/customers/${deleteModal.customerId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Delete failed")

      showToast("success", "Customer deleted.")
      setDeleteModal((p) => ({ ...p, open: false }))
      await fetchCustomersPage({ reset: true })
    } finally {
      setDeleteLoading(false)
    }
  }

  const doAssign = async (customerId, employeeIds) => {
    const res = await fetch(`${API_BASE}/customers/${customerId}/assign`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ employeeIds }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || "Assign failed")
    showToast("success", employeeIds.length ? "Assigned successfully." : "Assignment cleared.")
    await fetchCustomersPage({ reset: true })
  }

  const clearFilters = () => {
    setFilterEngagementTemplateId("")
    setFilterYear("")
    setFilterSubEngagementIds([])
    setSubMatch("any")
    setFilterStatus("")
  }

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (String(filterStatus || "").trim()) n += 1
    if (String(filterEngagementTemplateId || "").trim()) n += 1
    if (String(filterYear || "").trim()) n += 1
    if ((filterSubEngagementIds?.length || 0) > 0) n += 1
    return n
  }, [filterStatus, filterEngagementTemplateId, filterYear, filterSubEngagementIds])

  const openFilters = () => {
    setDraftTemplateId(String(filterEngagementTemplateId || ""))
    setDraftYear(String(filterYear || ""))
    setDraftSubIds(Array.isArray(filterSubEngagementIds) ? filterSubEngagementIds.map(String) : [])
    setDraftSubMatch(subMatch === "all" ? "all" : "any")
    setDraftStatus(String(filterStatus || ""))
    setFiltersOpen(true)
  }

  const clearDraft = () => {
    setDraftTemplateId("")
    setDraftYear("")
    setDraftSubIds([])
    setDraftSubMatch("any")
    setDraftStatus("")
  }

  const applyDraft = () => {
    setFilterEngagementTemplateId(String(draftTemplateId || ""))
    setFilterYear(String(draftYear || ""))
    setFilterSubEngagementIds(Array.isArray(draftSubIds) ? draftSubIds.map(String) : [])
    setSubMatch(draftSubMatch === "all" ? "all" : "any")
    setFilterStatus(String(draftStatus || ""))
    setFiltersOpen(false)
  }

  const activeSummary = useMemo(() => {
    const status = String(draftStatus || "").trim()
    const tplId = String(draftTemplateId || "").trim()
    const year = String(draftYear || "").trim()
    const subIds = Array.isArray(draftSubIds) ? draftSubIds : []

    const templateTitle =
      tplId && engagementTemplates.length
        ? engagementTemplates.find((t) => String(t?._id) === tplId)?.title || "Selected type"
        : ""

    const subsLabels = (() => {
      if (!tplId) return []
      const tpl = engagementTemplates.find((t) => String(t?._id) === tplId)
      const subs = Array.isArray(tpl?.subEngagements) ? tpl.subEngagements : []
      const map = new Map(subs.map((s) => [String(s._id), s.text]))
      return subIds.map((id) => map.get(String(id)) || String(id)).filter(Boolean)
    })()

    const hasAny = !!status || !!tplId || !!year || subIds.length > 0

    return (
      <div>
        <p className="text-sm font-bold text-gray-900">Selected</p>
        <p className="text-xs text-gray-500 mt-1">These will be applied.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {!hasAny ? (
            <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>No filters</span>
          ) : null}

          {status ? (
            <FilterChip onRemove={() => setDraftStatus("")}>
              Status: <span className="font-bold">{status}</span>
            </FilterChip>
          ) : null}

          {tplId ? (
            <FilterChip onRemove={() => setDraftTemplateId("")}>
              Type: <span className="font-bold">{templateTitle}</span>
            </FilterChip>
          ) : null}

          {year ? (
            <FilterChip onRemove={() => setDraftYear("")}>
              Year: <span className="font-bold">{year}</span>
            </FilterChip>
          ) : null}

          {subsLabels.length ? (
            <FilterChip onRemove={() => setDraftSubIds([])}>
              Subs: <span className="font-bold">{subsLabels.length}</span>
            </FilterChip>
          ) : null}

          {tplId && subIds.length ? (
            <FilterChip onRemove={() => setDraftSubMatch("any")}>
              Match: <span className="font-bold">{draftSubMatch}</span>
            </FilterChip>
          ) : null}
        </div>
      </div>
    )
  }, [draftStatus, draftTemplateId, draftYear, draftSubIds, draftSubMatch, engagementTemplates])

  const appliedFilterChips = useMemo(() => {
    const chipsArr = []

    const status = String(filterStatus || "").trim()
    if (status) {
      chipsArr.push({
        key: "status",
        label: `Status: ${status}`,
        onRemove: () => setFilterStatus(""),
      })
    }

    const tplId = String(filterEngagementTemplateId || "").trim()
    const year = String(filterYear || "").trim()
    const subIds = Array.isArray(filterSubEngagementIds) ? filterSubEngagementIds.map(String) : []

    const tpl = tplId ? engagementTemplates.find((t) => String(t?._id) === tplId) : null
    const typeLabel = tpl?.title || (tplId ? "Selected type" : "")

    const subsText = (() => {
      if (!tpl || !subIds.length) return ""
      const subs = Array.isArray(tpl?.subEngagements) ? tpl.subEngagements : []
      const map = new Map(subs.map((s) => [String(s._id), s.text]))
      const labels = subIds.map((id) => map.get(String(id)) || String(id)).filter(Boolean)
      if (!labels.length) return ""
      if (labels.length <= 2) return labels.join(", ")
      return `${labels[0]}, ${labels[1]} +${labels.length - 2}`
    })()

    if (tplId) {
      chipsArr.push({
        key: "type",
        label: `Type: ${typeLabel}`,
        onRemove: () => {
          setFilterEngagementTemplateId("")
          setFilterYear("")
          setFilterSubEngagementIds([])
          setSubMatch("any")
        },
      })
    }

    if (year) {
      chipsArr.push({
        key: "year",
        label: `Year: ${year}`,
        onRemove: () => setFilterYear(""),
      })
    }

    if (subIds.length) {
      chipsArr.push({
        key: "subs",
        label: subsText ? `Subs: ${subsText}` : `Subs: ${subIds.length}`,
        onRemove: () => {
          setFilterSubEngagementIds([])
          setSubMatch("any")
        },
      })
    }

    if (tplId && subIds.length) {
      chipsArr.push({
        key: "match",
        label: `Match: ${subMatch === "all" ? "all" : "any"}`,
        onRemove: () => setSubMatch("any"),
      })
    }

    return chipsArr
  }, [filterStatus, filterEngagementTemplateId, filterYear, filterSubEngagementIds, subMatch, engagementTemplates])

  const hasAppliedFilters =
    !!String(filterStatus || "").trim() ||
    !!String(filterEngagementTemplateId || "").trim() ||
    !!String(filterYear || "").trim() ||
    (filterSubEngagementIds?.length || 0) > 0

  const openCustomerWithTab = (customerId, tabKey) => {
    const nextTab = tabKey === "crm" ? "crm" : "overview"
    if (onNavigateCustomer) {
      onNavigateCustomer(customerId, nextTab)
      return
    }
    setSelectedCustomerTab(nextTab)
    setSelectedCustomerId(customerId)
  }

  const loadJobsForCustomer = async (customerId) => {
    const cid = String(customerId || "")
    if (!cid) return
    setJobsByCustomerId((p) => ({ ...p, [cid]: { ...(p[cid] || {}), loading: true, error: "" } }))
    try {
      const data = await fetchCustomerJobs(cid)
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
      setJobsByCustomerId((p) => ({
        ...p,
        [cid]: { ...(p[cid] || {}), loading: false, error: e?.message || "Failed to load jobs." },
      }))
    }
  }

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

      const has = jobsByCustomerId[cid]?.jobsTree || jobsByCustomerId[cid]?.loading
      if (!has) loadJobsForCustomer(cid)
    },
    [expandedCustomerId, jobsByCustomerId]
  )

  const openCreateRootJob = (customer) => {
    setJobUpsert({ open: true, customer, mode: "create", initialJob: null, parentJobId: null })
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
    setJobUpsert({ open: true, customer, mode: "edit", initialJob: job, parentJobId: null })
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
      await deleteCustomerJob(String(customer._id), String(job._id), { force: !!jobDelete.force })
      showToast("success", "Job deleted.")
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
        showToast("error", e?.message || "Cannot delete job.")
      } else {
        showToast("error", e?.message || "Delete failed")
      }
    } finally {
      setJobDeleteLoading(false)
    }
  }

  // ✅ Column options handlers (SERVER-DRIVEN)
  const openColumns = () => {
    const allowedSet = new Set((allowedColumns || []).map(String))
    const base = visibleColumns.length ? visibleColumns : defaultColumns
    const safe = applyMandatoryColumns(base, { allowedSet })
    setDraftColumns(safe)
    setColumnsOpen(true)
  }

  const resetColumns = () => {
    const allowedSet = new Set((allowedColumns || []).map(String))
    const base = defaultColumns.length ? defaultColumns : allowedColumns
    setDraftColumns(applyMandatoryColumns(base, { allowedSet }))
  }

  const saveColumns = async () => {
    const allowedSet = new Set((allowedColumns || []).map(String))
    const cleaned = applyMandatoryColumns(draftColumns || [], { allowedSet })
    const finalKeys = cleaned.length ? cleaned : applyMandatoryColumns(defaultColumns.length ? defaultColumns : allowedColumns, { allowedSet })

    setVisibleColumns(finalKeys)
    setColumnsOpen(false)

    // local fallback
    try {
      localStorage.setItem(CUSTOMER_PREF_LOCAL_FALLBACK_KEY, JSON.stringify(finalKeys))
    } catch {}

    // server save (NOTE: backend may not know "actions"; we still send it, but UI is protected either way)
    try {
      await saveCustomerViewPreference(CUSTOMER_VIEW_KEY, finalKeys)
      showToast("success", "Columns saved.")
    } catch (e) {
      // still keep local applied columns
      showToast("error", e?.message || "Saved locally, but server save failed.")
    }
  }

  if (selectedCustomerId) {
    return (
      <CustomerDetails
        customerId={selectedCustomerId}
        initialTab={selectedCustomerTab}
        onTabChange={(tabKey) => {
          if (onNavigateCustomer) onNavigateCustomer(selectedCustomerId, tabKey)
        }}
        onBack={() => {
          if (onBackToCustomers) {
            onBackToCustomers()
            return
          }
          setSelectedCustomerId(null)
          setSelectedCustomerTab("overview")
          fetchCustomersPage({ reset: true })
        }}
      />
    )
  }

  const showingCount = debounced ? filtered.length : customers.length
  const disableLoadMore = !!debounced || isLoadingMore || isLoading || !hasMore

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete customer?"
        description={`This will permanently delete "${deleteModal.customerName}". This cannot be undone.`}
        confirmText="Delete"
        loading={deleteLoading}
        onClose={closeDelete}
        onConfirm={confirmDelete}
        requirePassword
      />

      <ConfirmDeleteModal
        open={jobDelete.open}
        title="Delete job?"
        description={jobDelete?.job?.title ? `This will delete "${jobDelete.job.title}".` : "This will delete this job."}
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
                    <span className="font-semibold"> (Tasks: {jobDelete.blockInfo.tasksCount})</span>
                  ) : null}
                </p>
              </div>
            ) : null}

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!jobDelete.force}
                onChange={(e) => setJobDelete((p) => ({ ...p, force: !!e.target.checked }))}
              />
              <span className="text-sm text-gray-700">
                Force delete (also deletes tasks under this job){" "}
                <span className="text-rose-600 font-semibold">— use carefully</span>
              </span>
            </label>
          </div>
        }
      />

      <AnimatePresence>
        {viewChoice.open ? (
          <ViewChoiceModal
            open={viewChoice.open}
            customerName={viewChoice.customer?.name || ""}
            onClose={() => setViewChoice({ open: false, customer: null })}
            onPick={(tabKey) => {
              const id = viewChoice.customer?._id
              setViewChoice({ open: false, customer: null })
              if (id) openCustomerWithTab(id, tabKey)
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {filtersOpen ? (
          <FiltersModal
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            engagementTemplates={engagementTemplates}
            tplLoading={tplLoading}
            draftTemplateId={draftTemplateId}
            setDraftTemplateId={setDraftTemplateId}
            draftYear={draftYear}
            setDraftYear={setDraftYear}
            draftSubIds={draftSubIds}
            setDraftSubIds={setDraftSubIds}
            draftSubMatch={draftSubMatch}
            setDraftSubMatch={setDraftSubMatch}
            draftStatus={draftStatus}
            setDraftStatus={setDraftStatus}
            onApply={applyDraft}
            onClearDraft={clearDraft}
            activeSummary={activeSummary}
          />
        ) : null}
      </AnimatePresence>

      {/* ✅ Columns modal (SERVER-DRIVEN + ORDER LIST) */}
      <AnimatePresence>
        {columnsOpen ? (
          <ColumnsModal
            open={columnsOpen}
            onClose={() => setColumnsOpen(false)}
            columns={columnsCatalog.length ? columnsCatalog : buildColumnsFromAllowed(allowedColumns)}
            selectedKeys={draftColumns}
            setSelectedKeys={setDraftColumns}
            onReset={resetColumns}
            onSave={saveColumns}
            dirty={columnsDirty}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {jobUpsert.open ? (
          <JobUpsertModal
            open={jobUpsert.open}
            customer={jobUpsert.customer}
            mode={jobUpsert.mode}
            initialJob={jobUpsert.initialJob}
            parentJobId={jobUpsert.parentJobId}
            onClose={() =>
              setJobUpsert({ open: false, customer: null, mode: "create", initialJob: null, parentJobId: null })
            }
            onSaved={() => {
              const cid = String(jobUpsert.customer?._id || "")
              if (cid) loadJobsForCustomer(cid)
              showToast("success", jobUpsert.mode === "edit" ? "Job updated." : "Job created.")
            }}
          />
        ) : null}
      </AnimatePresence>

      <CustomerHead
        customersLength={customers.length}
        isLoading={isLoading}
        onRefresh={() => fetchCustomersPage({ reset: true })}
        onCreate={() => setShowCreate(true)}
        appliedFilterChips={appliedFilterChips}
        openFilters={openFilters}
        activeFilterCount={activeFilterCount}
        hasAppliedFilters={hasAppliedFilters}
        clearFilters={clearFilters}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        debounced={debounced}
        showingCount={showingCount}
        // ✅ NEW props for Column options button
        onOpenColumns={openColumns}
        columnsSelectedCount={visibleColumns.length}
        columnsDefaultCount={columnsDefaultCount}
        columnsLoading={columnsLoading}
        columnsDirty={false}
      />

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      <CustomerTable
        customers={customers}
        filtered={filtered}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        debounced={debounced}
        hasMore={hasMore}
        disableLoadMore={disableLoadMore}
        expandedCustomerId={expandedCustomerId}
        closingCustomerId={closingCustomerId}
        jobsByCustomerId={jobsByCustomerId}
        onToggleRow={toggleRowDropdown}
        onRefreshJobs={loadJobsForCustomer}
        onCreateRootJob={(customer) => setJobUpsert({ open: true, customer, mode: "create", initialJob: null, parentJobId: null })}
        onCreateSubJob={(customer, parentJob) =>
          setJobUpsert({
            open: true,
            customer,
            mode: "create",
            initialJob: null,
            parentJobId: String(parentJob?._id || ""),
          })
        }
        onEditJob={(customer, job) => setJobUpsert({ open: true, customer, mode: "edit", initialJob: job, parentJobId: null })}
        onDeleteJob={(customer, job) => setJobDelete({ open: true, customer, job, force: false, blockInfo: null })}
        onGoToCustomerCRM={(customerId) => openCustomerWithTab(String(customerId), "crm")}
        onViewCustomer={(customer) => setViewChoice({ open: true, customer })}
        onEditCustomer={(customer) => setEditCustomer(customer)}
        onAssignCustomer={(customer) => setAssignCustomer(customer)}
        onDeleteCustomer={(customer) => requestDeleteCustomer(customer)}
        onRefreshList={() => fetchCustomersPage({ reset: true })}
        onLoadMore={() => fetchCustomersPage({ reset: false })}
        onToast={showToast}
        // ✅ Table uses these keys to show/hide columns (ORDER MATTERS)
        visibleColumns={visibleColumns}
      />

      <AnimatePresence>
        {showCreate && (
          <CustomerUpsertModal
            open={showCreate}
            mode="create"
            onClose={() => setShowCreate(false)}
            onSaved={() => fetchCustomersPage({ reset: true })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!!editCustomer && (
          <CustomerUpsertModal
            open={!!editCustomer}
            mode="edit"
            initial={editCustomer}
            onClose={() => setEditCustomer(null)}
            onSaved={() => fetchCustomersPage({ reset: true })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!!assignCustomer && (
          <AssignModal
            open={!!assignCustomer}
            customer={assignCustomer}
            onClose={() => setAssignCustomer(null)}
            onAssign={(employeeIds) => doAssign(assignCustomer._id, employeeIds)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
