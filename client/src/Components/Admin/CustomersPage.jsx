"use client"

import { useEffect, useMemo, useRef, useState, useLayoutEffect, useId } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
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
} from "react-icons/fi"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import CustomerDetails from "./CustomerDetails"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]"
const subtleHover = "transition-colors hover:bg-gray-50/60"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"
const btnPrimary =
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.65)]"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white hover:bg-rose-50"
const iconBtn =
  "p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none"
const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
const chip =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

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

function normalizeAssignedToArray(assignedTo) {
  if (!assignedTo) return []
  if (Array.isArray(assignedTo)) return assignedTo
  return [assignedTo]
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase()
  const cls =
    s === "complete"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : s === "in_progress"
      ? "bg-sky-50 text-sky-700 ring-sky-600/10"
      : s === "pending"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
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
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-black/5 focus:outline-none"
            aria-label="Close toast"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
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
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition focus:outline-none"
                aria-label="Close"
              >
                <FiX className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="p-6 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">
              {children}
            </div>

            {footer ? (
              <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0">
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
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">{label}</label>
      {children}
      {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
    </div>
  )
}

/* =========================
   MULTI SELECT (PORTAL + HEIGHT FIX — NEVER OFFSCREEN)
   - renders menu in document.body
   - fixed positioning + high z-index
   - flips upward if not enough space below
   - dynamically caps list height to available viewport space
========================= */

function MultiSelectDropdown({ options = [], value = [], onChange, placeholder = "Select..." }) {
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

    // open upward if below is tight AND above gives more space
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow

    const available = Math.max(0, openUp ? spaceAbove : spaceBelow)
    const capped = Math.min(MAX, available)
    const maxHeight = Math.max(MIN, capped)

    // keep within viewport horizontally
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
    // capture scroll from modal container too
    window.addEventListener("scroll", onScroll, true)

    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onScroll, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // close on outside click (works with portal)
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

  // close on escape
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
            style={{
              maxHeight: menuPos.maxHeight,
            }}
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
                        onClick={() => toggle(o.value)}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition text-left focus:outline-none",
                          checked
                            ? "bg-indigo-50 border-indigo-200"
                            : "bg-white border-transparent hover:bg-gray-50"
                        )}
                      >
                        <span className="text-sm font-semibold text-gray-800">{o.label}</span>
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
              className={cn(btn, btnGhost, "px-3 py-2 text-sm disabled:opacity-60")}
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
        className={cn(input, "text-left flex items-center justify-between gap-3 focus:outline-none")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("min-w-0 truncate", selectedCount ? "text-gray-900" : "text-gray-500")}>
          {selectedCount ? selectedLabels : placeholder}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {selectedCount ? (
            <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
              {selectedCount}
            </span>
          ) : null}
          <FiChevronDown className={cn("w-4 h-4 text-gray-500 transition", open ? "rotate-180" : "")} />
        </span>
      </button>

      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  )
}

async function fetchCustomerDetails(customerId, signal) {
  const res = await fetch(`${API_BASE}/customers/${customerId}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to fetch customer details")
  return data?.customer || null
}

/* =========================
   FILTER MODAL (RE-ORDERED)
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
    (draftSubIds?.length || 0) > 0

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Keep the search height same — filters open here"
      icon={<FiFilter className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearDraft}
              disabled={!hasAnyDraft}
              className={cn(btn, btnGhost, "px-3 py-2 text-sm disabled:opacity-60")}
              title="Clear draft filters"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className={cn(btn, btnGhost)}>
              Cancel
            </button>
            <button onClick={onApply} className={cn(btn, btnPrimary)}>
              Apply filters
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
                  <p className="text-sm font-extrabold text-gray-900">Engagement filters</p>
                  <p className="text-xs text-gray-500">Server-side filtering</p>
                </div>
              </div>

              {hasAnyDraft ? (
                <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                  Active in draft
                </span>
              ) : (
                <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>None</span>
              )}
            </div>

            <div className="p-4 space-y-4">
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
                  <option value="">{tplLoading ? "Loading..." : "All types"}</option>
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
                    : "This engagement type has no sub-engagements"
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
                <Field label="Year" hint={!draftTemplateId ? "Select engagement type first" : ""}>
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
                  label="Sub match"
                  hint={!draftTemplateId || !draftSubIds.length ? "Select sub-engagements to enable" : ""}
                >
                  <select
                    value={draftSubMatch}
                    onChange={(e) => setDraftSubMatch(e.target.value === "all" ? "all" : "any")}
                    className={input}
                    disabled={!draftTemplateId || !draftSubIds.length}
                  >
                    <option value="any">Any selected</option>
                    <option value="all">All selected</option>
                  </select>
                </Field>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-xs text-gray-600">
                  Tip: Click the filter icon in the search bar to open this panel.
                </p>
              </div>
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
                  <p className="text-sm font-extrabold text-gray-900">Preview</p>
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
   CUSTOMER UPSERT / ASSIGN / CONFIRM
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

  const applyCustomerToForm = (c) => {
    const engagementsArr = Array.isArray(c?.engagements) ? c.engagements : []
    const latestEng =
      engagementsArr.length > 0
        ? engagementsArr.slice().sort((a, b) => Number(b?.year || 0) - Number(a?.year || 0))[0]
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
      if (form.subEngagementIds.length) setForm((p) => ({ ...p, subEngagementIds: [] }))
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
    const hasYear = Number.isFinite(yearNum) && String(form.engagementYear || "").trim() !== ""

    if (hasEngType && !hasYear) return setError("Engagement year is required when selecting an engagement type.")
    if (hasYear && !hasEngType) return setError("Engagement type is required when selecting an engagement year.")

    setIsSubmitting(true)
    setError("")
    try {
      const basePayload = {
        name: form.name.trim(),
        companyName: form.companyName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() ? form.email.trim().toLowerCase() : undefined,
        address: form.address.trim() || "",
        status: form.status || "in_progress",
        customerType: form.customerType || "new",
        contactPerson: {
          name: form.cpName.trim(),
          phone: form.cpPhone.trim() || undefined,
          email: form.cpEmail.trim() ? form.cpEmail.trim().toLowerCase() : undefined,
          designation: form.cpDesignation.trim() || undefined,
        },
      }

      if (mode === "create") {
        const payload = { ...basePayload }
        if (hasYear && hasEngType) {
          payload.engagementYear = yearNum
          payload.engagementTemplateId = String(form.engagementTemplateId)
          payload.subEngagementIds = Array.isArray(form.subEngagementIds)
            ? form.subEngagementIds.map(String)
            : []
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
          const res2 = await fetch(`${API_BASE}/customers/${initial?._id}/engagements`, {
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
          })
          const data2 = await res2.json().catch(() => ({}))
          if (!res2.ok) throw new Error(data2?.message || "Engagement update failed")
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
      subtitle="Customer + engagement + contact person"
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
          <input value={form.name} onChange={update("name")} className={input} placeholder="Customer name" />
        </Field>

        <Field label="Company">
          <input value={form.companyName} onChange={update("companyName")} className={input} placeholder="Company name" />
        </Field>

        <Field label="Phone">
          <input value={form.phone} onChange={update("phone")} className={input} placeholder="01XXXXXXXXX" />
        </Field>

        <Field label="Email">
          <input value={form.email} onChange={update("email")} className={input} placeholder="email@example.com" />
        </Field>

        <div className="md:col-span-2">
          <Field label="Address">
            <input value={form.address} onChange={update("address")} className={input} placeholder="Street, area, city" />
          </Field>
        </div>

        <Field label="Status">
          <select value={form.status} onChange={update("status")} className={input}>
            <option value="pending">pending</option>
            <option value="in_progress">in_progress</option>
            <option value="complete">complete</option>
          </select>
        </Field>

        <Field label="Customer Type">
          <select value={form.customerType} onChange={update("customerType")} className={input}>
            <option value="new">new</option>
            <option value="returning">returning</option>
          </select>
        </Field>

        <Field label="Engagement Year">
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

        <Field label="Engagement Type">
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
            <option value="">{tplLoading ? "Loading..." : "Select engagement type (optional)"}</option>
            {engagementTemplates.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title}
              </option>
            ))}
          </select>

          {selectedTemplate ? (
            <p className="mt-1 text-xs text-gray-500">
              {Array.isArray(selectedTemplate.subEngagements) && selectedTemplate.subEngagements.length
                ? "This type has sub-engagements."
                : "This type has no sub-engagements."}
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500">
              Choose a type (single title) or a type that contains sub-engagements.
            </p>
          )}
        </Field>

        {selectedTemplate?.subEngagements?.length ? (
          <div className="md:col-span-2">
            <Field label="Sub-engagements (optional)">
              <MultiSelectDropdown
                options={subEngagementOptions}
                value={form.subEngagementIds}
                onChange={(ids) => setForm((p) => ({ ...p, subEngagementIds: ids }))}
                placeholder="Select sub-engagement(s)"
              />
            </Field>
          </div>
        ) : null}

        <div className="md:col-span-2">
          <div className="mt-2 border-t border-gray-100 pt-4">
            <p className="text-sm font-extrabold text-gray-900 mb-3">Contact Person</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name *">
                <input value={form.cpName} onChange={update("cpName")} className={input} placeholder="Contact person name" />
              </Field>

              <Field label="Phone">
                <input value={form.cpPhone} onChange={update("cpPhone")} className={input} placeholder="01XXXXXXXXX" />
              </Field>

              <Field label="Email">
                <input value={form.cpEmail} onChange={update("cpEmail")} className={input} placeholder="contact@email.com" />
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

function AssignModal({ open, onClose, customer, employees, onAssign }) {
  const [employeeIds, setEmployeeIds] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    const arr = normalizeAssignedToArray(customer?.assignedTo)
    const ids = arr
      .map((x) => (typeof x === "object" ? x?._id : x))
      .filter(Boolean)
      .map(String)
    setEmployeeIds(ids)
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

  const submit = async () => {
    if (!employeeIds.length) return setError("Please select at least one employee.")
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

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Assign Customer"
      subtitle={customer?.name ? `Customer: ${customer.name}` : ""}
      icon={<FiUserCheck className="w-5 h-5" />}
      footer={
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)}>
            Cancel
          </button>
          <button onClick={submit} disabled={isSaving} className={cn(btn, btnPrimary, "disabled:opacity-60")}>
            {isSaving ? "Assigning..." : "Assign"}
          </button>
        </div>
      }
    >
      {error && <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Select employee(s)</p>
          <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Selected: {employeeIds.length}</span>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-2 max-h-[360px] overflow-y-auto">
          {employees.length === 0 ? (
            <div className="p-3 text-sm text-gray-600">No employees found.</div>
          ) : (
            <ul className="space-y-2">
              {employees.map((e) => {
                const checked = employeeIds.includes(String(e._id))
                return (
                  <li key={e._id}>
                    <button
                      type="button"
                      onClick={() => toggle(e._id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 p-3 rounded-2xl border transition text-left focus:outline-none",
                        checked ? "bg-white border-indigo-200" : "bg-white border-gray-100 hover:bg-gray-50"
                      )}
                    >
                      <div>
                        <p className="text-sm font-extrabold text-gray-900">{e.name}</p>
                        <p className="text-xs text-gray-500">{e.email}</p>
                      </div>

                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg border flex items-center justify-center",
                          checked ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-transparent"
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(btn, btnGhost, "px-3 py-2 text-sm")}
            onClick={() => setEmployeeIds(employees.map((e) => String(e._id)))}
            disabled={!employees.length}
          >
            Select all
          </button>
          <button
            type="button"
            className={cn(btn, btnGhost, "px-3 py-2 text-sm")}
            onClick={() => setEmployeeIds([])}
            disabled={!employeeIds.length}
          >
            Clear
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function StatusSelect({ value, onChange, disabled }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value || "pending"}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={cn(
          "appearance-none pr-10 pl-3 py-2 rounded-xl text-sm font-semibold border",
          "border-gray-200 bg-white",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
          disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"
        )}
      >
        <option value="pending">pending</option>
        <option value="in_progress">in_progress</option>
        <option value="complete">complete</option>
      </select>
      <FiChevronDown className="absolute right-3 w-4 h-4 text-gray-500 pointer-events-none" />
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
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onClose?.()} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
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
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-sm font-semibold disabled:opacity-60 focus:outline-none"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================
   MAIN (UNCHANGED)
========================= */

export default function AdminCustomersPage({ openCustomerId, onCustomerOpened }) {
  const PAGE_SIZE = 25

  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState("")

  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")

  const [selectedCustomerId, setSelectedCustomerId] = useState(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [assignCustomer, setAssignCustomer] = useState(null)

  const [savingStatusId, setSavingStatusId] = useState(null)

  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = (type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }

  const abortRef = useRef(null)

  const [deleteModal, setDeleteModal] = useState({ open: false, customerId: "", customerName: "" })
  const [deleteLoading, setDeleteLoading] = useState(false)

  // engagement filters (server-side) — ACTIVE (applied)
  const [engagementTemplates, setEngagementTemplates] = useState([])
  const [tplLoading, setTplLoading] = useState(false)

  const [filterEngagementTemplateId, setFilterEngagementTemplateId] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterSubEngagementIds, setFilterSubEngagementIds] = useState([])
  const [subMatch, setSubMatch] = useState("any") // any | all

  // Filter modal + DRAFT states
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftTemplateId, setDraftTemplateId] = useState("")
  const [draftYear, setDraftYear] = useState("")
  const [draftSubIds, setDraftSubIds] = useState([])
  const [draftSubMatch, setDraftSubMatch] = useState("any")

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    if (!openCustomerId) return
    setSelectedCustomerId(openCustomerId)
    onCustomerOpened?.()
  }, [openCustomerId, onCustomerOpened])

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/employees`, {
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to fetch employees")
      setEmployees(Array.isArray(data?.employees) ? data.employees : [])
    } catch {
      setEmployees([])
    }
  }

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

    const tplId = String(filterEngagementTemplateId || "").trim()
    const year = String(filterYear || "").trim()
    const subIds = Array.isArray(filterSubEngagementIds) ? filterSubEngagementIds.map(String).filter(Boolean) : []

    const hasAnyEngFilter = !!tplId || !!year || subIds.length > 0
    if (hasAnyEngFilter && !tplId) {
      throw new Error("Select Engagement Type first to apply engagement filters.")
    }

    if (tplId) params.set("engagementTemplateId", tplId)
    if (year) params.set("engagementYear", year)
    if (subIds.length) params.set("subEngagementIds", subIds.join(","))
    if (tplId && subIds.length) params.set("subMatch", subMatch === "all" ? "all" : "any")

    return params
  }

  const fetchCustomersPage = async ({ reset = false } = {}) => {
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
  }

  useEffect(() => {
    fetchCustomersPage({ reset: true })
    fetchEmployees()
    fetchEngagementTemplates()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchCustomersPage({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEngagementTemplateId, filterYear, subMatch, JSON.stringify(filterSubEngagementIds)])

  const filtered = useMemo(() => {
    if (!debounced) return customers

    return customers.filter((c) => {
      const cpName = c?.contactPerson?.name || ""
      const assignedArr = normalizeAssignedToArray(c?.assignedTo)
      const assignedNames = assignedArr
        .map((x) => (typeof x === "object" ? x?.name : ""))
        .filter(Boolean)
        .join(" ")

      const s = `${c?.name || ""} ${c?.companyName || ""} ${c?.phone || ""} ${c?.email || ""} ${cpName} ${assignedNames} ${
        c?.status || ""
      }`.toLowerCase()

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

  const confirmDelete = async () => {
    if (!deleteModal.customerId) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/customers/${deleteModal.customerId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Delete failed")

      showToast("success", "Customer deleted.")
      setDeleteModal((p) => ({ ...p, open: false }))
      await fetchCustomersPage({ reset: true })
    } catch (e) {
      showToast("error", e?.message || "Delete failed")
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
    showToast("success", "Assigned successfully.")
    await fetchCustomersPage({ reset: true })
  }

  const doStatusUpdateInline = async (customerId, newStatus) => {
    setSavingStatusId(customerId)
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Status update failed")

      setCustomers((prev) => prev.map((c) => (c._id === customerId ? { ...c, status: newStatus } : c)))
      showToast("success", "Status updated.")
    } catch (e) {
      showToast("error", e?.message || "Status update failed")
    } finally {
      setSavingStatusId(null)
    }
  }

  const clearFilters = () => {
    setFilterEngagementTemplateId("")
    setFilterYear("")
    setFilterSubEngagementIds([])
    setSubMatch("any")
  }

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (String(filterEngagementTemplateId || "").trim()) n += 1
    if (String(filterYear || "").trim()) n += 1
    if ((filterSubEngagementIds?.length || 0) > 0) n += 1
    return n
  }, [filterEngagementTemplateId, filterYear, filterSubEngagementIds])

  const openFilters = () => {
    setDraftTemplateId(String(filterEngagementTemplateId || ""))
    setDraftYear(String(filterYear || ""))
    setDraftSubIds(Array.isArray(filterSubEngagementIds) ? filterSubEngagementIds.map(String) : [])
    setDraftSubMatch(subMatch === "all" ? "all" : "any")
    setFiltersOpen(true)
  }

  const clearDraft = () => {
    setDraftTemplateId("")
    setDraftYear("")
    setDraftSubIds([])
    setDraftSubMatch("any")
  }

  const applyDraft = () => {
    setFilterEngagementTemplateId(String(draftTemplateId || ""))
    setFilterYear(String(draftYear || ""))
    setFilterSubEngagementIds(Array.isArray(draftSubIds) ? draftSubIds.map(String) : [])
    setSubMatch(draftSubMatch === "all" ? "all" : "any")
    setFiltersOpen(false)
  }

  const activeSummary = useMemo(() => {
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

    const hasAny = !!tplId || !!year || subIds.length > 0

    return (
      <div>
        <p className="text-sm font-extrabold text-gray-900">Draft selection</p>
        <p className="text-xs text-gray-500 mt-1">These will be applied to the server request.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {!hasAny ? (
            <span className={cn(chip, "bg-gray-50 text-gray-700 ring-gray-200")}>No filters selected</span>
          ) : null}

          {tplId ? (
            <FilterChip onRemove={() => setDraftTemplateId("")}>
              Type: <span className="font-extrabold">{templateTitle}</span>
            </FilterChip>
          ) : null}

          {year ? (
            <FilterChip onRemove={() => setDraftYear("")}>
              Year: <span className="font-extrabold">{year}</span>
            </FilterChip>
          ) : null}

          {subsLabels.length ? (
            <FilterChip onRemove={() => setDraftSubIds([])}>
              Subs: <span className="font-extrabold">{subsLabels.length}</span>
            </FilterChip>
          ) : null}

          {tplId && subIds.length ? (
            <FilterChip onRemove={() => setDraftSubMatch("any")}>
              Match: <span className="font-extrabold">{draftSubMatch}</span>
            </FilterChip>
          ) : null}
        </div>
      </div>
    )
  }, [draftTemplateId, draftYear, draftSubIds, draftSubMatch, engagementTemplates])

  const appliedFilterChips = useMemo(() => {
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

    const chips = []

    if (tplId) {
      chips.push({
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
      chips.push({
        key: "year",
        label: `Year: ${year}`,
        onRemove: () => setFilterYear(""),
      })
    }

    if (subIds.length) {
      chips.push({
        key: "subs",
        label: subsText ? `Subs: ${subsText}` : `Subs: ${subIds.length}`,
        onRemove: () => {
          setFilterSubEngagementIds([])
          setSubMatch("any")
        },
      })
    }

    if (tplId && subIds.length) {
      chips.push({
        key: "match",
        label: `Match: ${subMatch === "all" ? "all" : "any"}`,
        onRemove: () => setSubMatch("any"),
      })
    }

    return chips
  }, [filterEngagementTemplateId, filterYear, filterSubEngagementIds, subMatch, engagementTemplates])

  const hasAppliedFilters =
    !!String(filterEngagementTemplateId || "").trim() ||
    !!String(filterYear || "").trim() ||
    (filterSubEngagementIds?.length || 0) > 0

  if (selectedCustomerId) {
    return (
      <CustomerDetails
        customerId={selectedCustomerId}
        onBack={() => {
          setSelectedCustomerId(null)
          fetchCustomersPage({ reset: true })
          fetchEmployees()
        }}
      />
    )
  }

  const showingCount = debounced ? filtered.length : customers.length
  const disableLoadMore = !!debounced || isLoadingMore || isLoading || !hasMore

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

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete customer?"
        description={`This will permanently delete "${deleteModal.customerName}". This cannot be undone.`}
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
            onApply={applyDraft}
            onClearDraft={clearDraft}
            activeSummary={activeSummary}
          />
        ) : null}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={cn(card, "p-6")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                  <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                    <FiUsers className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Customers</h1>
                  <p className="text-sm text-gray-500">Fast list • Cursor pagination • Minimal data</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600/60" />
                  Loaded: {customers.length}
                </span>

                <button
                  onClick={() => {
                    fetchCustomersPage({ reset: true })
                    fetchEmployees()
                  }}
                  className={cn(btn, btnGhost)}
                  title="Refresh"
                >
                  <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                  Refresh
                </button>

                <button onClick={() => setShowCreate(true)} className={cn(btn, btnPrimary)}>
                  <FiPlus className="w-4 h-4" />
                  Create
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="w-full lg:w-1/2">
                <div
                  className={cn(
                    "w-full h-12 rounded-2xl border border-gray-200 bg-white",
                    "px-3 flex items-center gap-2",
                    "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent"
                  )}
                >
                  <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />

                  <div
                    className={cn(
                      "flex-1 min-w-0 flex items-center gap-2",
                      "overflow-x-auto",
                      "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    )}
                    onClick={() => {
                      const el = document.getElementById("customers-search-input")
                      el?.focus?.()
                    }}
                  >
                    {appliedFilterChips.map((c) => (
                      <span
                        key={c.key}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-2",
                          "px-2.5 py-1 rounded-full border",
                          "bg-indigo-50 border-indigo-100 text-indigo-700",
                          "text-xs font-extrabold"
                        )}
                      >
                        <span className="truncate max-w-[220px]">{c.label}</span>
                        <button
                          type="button"
                          className="p-0.5 rounded-full hover:bg-indigo-100/80 focus:outline-none"
                          title="Remove"
                          aria-label="Remove filter"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            c.onRemove?.()
                          }}
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}

                    <input
                      id="customers-search-input"
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={
                        appliedFilterChips.length
                          ? "Search…"
                          : "Search customer, company, phone, contact, assigned, status…"
                      }
                      className={cn(
                        "flex-1 min-w-[10rem] bg-transparent",
                        "text-sm text-gray-900 placeholder:text-gray-400",
                        "border-0 outline-none ring-0 shadow-none",
                        "focus:outline-none focus:ring-0 focus:shadow-none focus:border-0",
                        "appearance-none"
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={openFilters}
                    className={cn(
                      "relative shrink-0",
                      "h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                      "flex items-center justify-center focus:outline-none"
                    )}
                    aria-label="Open filters"
                    title="Filters"
                  >
                    <FiFilter className="w-4 h-4 text-gray-700" />
                    {activeFilterCount ? (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </button>

                  {hasAppliedFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className={cn(
                        "shrink-0 h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                        "flex items-center justify-center focus:outline-none"
                      )}
                      aria-label="Clear applied filters"
                      title="Clear applied filters"
                    >
                      <FiX className="w-4 h-4 text-gray-700" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {debounced ? (
                    <p className="text-xs text-gray-500">
                      Searching within loaded customers (for full DB search, add backend search later).
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Tip: Click the filter icon to open the filtering panel.</p>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Showing <span className="font-extrabold text-gray-900">{showingCount}</span>{" "}
                {debounced ? "result(s)" : "customer(s)"}
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
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">No.</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Assigned</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {isLoading && customers.length === 0 ? (
                  [...Array(8)].map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {[...Array(5)].map((__, i) => (
                        <td key={i} className="px-6 py-4">
                          <div className="h-4 w-full max-w-[12rem] bg-gray-200 rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length > 0 ? (
                  filtered.map((c, index) => {
                    const assignedArr = normalizeAssignedToArray(c?.assignedTo)
                    const assignedNames = assignedArr
                      .map((x) => (typeof x === "object" ? x?.name : String(x || "")))
                      .filter(Boolean)

                    const assignedDisplay = assignedNames.length ? assignedNames.join(", ") : "—"
                    const busy = savingStatusId === c._id

                    return (
                      <motion.tr
                        key={c?._id || `cust-${index}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={subtleHover}
                        onClick={() => setSelectedCustomerId(c._id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedCustomerId(c._id)
                        }}
                      >
                        <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>

                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{c?.name || "Unnamed"}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {c?.companyName ? `Company: ${c.companyName}` : "Company: —"} •{" "}
                            {c?.contactPerson?.name ? `Contact: ${c.contactPerson.name}` : "Contact: —"}
                          </p>
                        </td>

                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <StatusSelect
                              value={c?.status}
                              disabled={busy}
                              onChange={(v) => doStatusUpdateInline(c._id, v)}
                            />
                            <div className="hidden xl:block">
                              <StatusBadge status={c?.status} />
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">{assignedDisplay}</td>

                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedCustomerId(c._id)}
                              className={cn(btn, btnPrimary, "px-3.5 py-2")}
                            >
                              <FiEye className="w-4 h-4" />
                              View
                            </button>

                            <button onClick={() => setEditCustomer(c)} className={iconBtn} title="Edit" aria-label="Edit">
                              <FiEdit2 className="w-4 h-4 text-gray-700" />
                            </button>

                            <button
                              onClick={() => setAssignCustomer(c)}
                              className={iconBtn}
                              title={employees.length ? "Assign" : "No employees loaded"}
                              aria-label="Assign"
                              disabled={employees.length === 0}
                            >
                              <FiUserCheck className="w-4 h-4 text-gray-700" />
                            </button>

                            <button
                              onClick={() => requestDeleteCustomer(c)}
                              className={cn(iconBtn, btnDanger)}
                              title="Delete"
                              aria-label="Delete"
                            >
                              <FiTrash2 className="w-4 h-4 text-rose-600" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {debounced ? "No customers match your search." : "No customers found."}
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center p-4 text-sm text-gray-600 border-t border-gray-100 bg-white">
          <span>
            Loaded: <span className="font-bold text-gray-900">{customers.length}</span>
            {debounced ? (
              <>
                {" "}
                • Showing: <span className="font-bold text-gray-900">{filtered.length}</span>
              </>
            ) : null}
          </span>

          <div className="flex items-center gap-2">
            <button onClick={() => fetchCustomersPage({ reset: true })} className={cn(btn, btnGhost, "px-4 py-2")}>
              Refresh list
            </button>

            <button
              onClick={() => fetchCustomersPage({ reset: false })}
              disabled={disableLoadMore}
              className={cn(btn, btnPrimary, "px-4 py-2 disabled:opacity-60")}
              title={debounced ? "Clear search to load more" : hasMore ? "Load next page" : "No more customers"}
            >
              {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {debounced ? "Clear search to load more" : hasMore ? "Load more" : "No more"}
            </button>
          </div>
        </div>
      </div>

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
            employees={employees}
            onClose={() => setAssignCustomer(null)}
            onAssign={(employeeIds) => doAssign(assignCustomer._id, employeeIds)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
