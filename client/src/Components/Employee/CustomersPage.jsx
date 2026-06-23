"use client"

import { useEffect, useMemo, useRef, useState, useLayoutEffect, useId } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  FiUsers,
  FiSearch,
  FiDatabase,
  FiEye,
  FiX,
  FiPlus,
  FiFilter,
  FiChevronDown,
  FiCheck,
} from "react-icons/fi"
import CustomerDetails from "./CustomerDetails"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

/** Premium shadow + hover */
const premiumCard =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-14px_rgba(0,0,0,0.35)] hover:shadow-[0_16px_46px_-18px_rgba(0,0,0,0.45)] transition-all"

const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

const chip =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none"

const btnPrimary =
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.65)]"

const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"

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
  if (Array.isArray(data?.customers)) {
    return { items: data.customers, count: Number(data.count ?? data.customers.length) }
  }
  if (Array.isArray(data)) return { items: data, count: data.length }
  return { items: [], count: 0 }
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
      ? "bg-green-100 text-green-800 ring-1 ring-green-600/10"
      : s === "in_progress"
      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-600/10"
      : "bg-gray-100 text-gray-700 ring-1 ring-gray-600/10"

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || "—"}
    </span>
  )
}

/* =========================
   MODAL SHELL (same as admin)
========================= */

function ModalShell({ open, onClose, title, subtitle, icon, children, footer, maxWidthClass = "max-w-3xl" }) {
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

            <div className="p-6 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">{children}</div>

            {footer ? (
              <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0">{footer}</div>
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
   MULTI SELECT (portal + never offscreen)
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
          <div className="overflow-y-auto p-2" style={{ maxHeight: menuPos.maxHeight }}>
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
                          checked ? "bg-indigo-50 border-indigo-200" : "bg-white border-transparent hover:bg-gray-50"
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
            <button type="button" className={cn(btn, btnPrimary, "px-3 py-2 text-sm")} onClick={() => setOpen(false)}>
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
          {selectedCount ? <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>{selectedCount}</span> : null}
          <FiChevronDown className={cn("w-4 h-4 text-gray-500 transition", open ? "rotate-180" : "")} />
        </span>
      </button>

      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  )
}

/* =========================
   FILTER UI (chips + modal)
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
      subtitle="Engagement filters (server-side)"
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
                <span className={cn(chip, "bg-indigo-50 text-indigo-700 ring-indigo-600/10")}>Active in draft</span>
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
                <p className="text-xs text-gray-600">Tip: Click the filter icon in the search bar to open this panel.</p>
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
   MAIN PAGE
========================= */

export default function CustomersPage({
  routeCustomerId,
  onNavigateCustomer,
  onBackToCustomers,
}) {
  const PAGE_SIZE = 200 // you can change

  const [customers, setCustomers] = useState([])
  const [count, setCount] = useState(0)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")

  const [selectedCustomerId, setSelectedCustomerId] = useState(null)

  useEffect(() => {
    if (routeCustomerId) {
      setSelectedCustomerId(routeCustomerId)
      return
    }
    if (onNavigateCustomer) setSelectedCustomerId(null)
  }, [routeCustomerId, onNavigateCustomer])

  // engagement filters (applied)
  const [engagementTemplates, setEngagementTemplates] = useState([])
  const [tplLoading, setTplLoading] = useState(false)

  const [filterEngagementTemplateId, setFilterEngagementTemplateId] = useState("")
  const [filterYear, setFilterYear] = useState("")
  const [filterSubEngagementIds, setFilterSubEngagementIds] = useState([])
  const [subMatch, setSubMatch] = useState("any") // any | all

  // draft filters (modal)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [draftTemplateId, setDraftTemplateId] = useState("")
  const [draftYear, setDraftYear] = useState("")
  const [draftSubIds, setDraftSubIds] = useState([])
  const [draftSubMatch, setDraftSubMatch] = useState("any")

  const abortRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim().toLowerCase()), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  const fetchEngagementTemplates = async () => {
    setTplLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("limit", "200")
      params.set("sort", "title")
      params.set("active", "true")

      const res = await fetch(`${API_BASE}/engagement-templates?${params.toString()}`, {
        headers: getAuthHeaders(),
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

  const fetchCustomers = async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError("")
    try {
      const params = buildFilterParams()

      const res = await fetch(`${API_BASE}/customers?${params.toString()}`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Failed to fetch customers")

      const normalized = normalizeListResponse(data)
      setCustomers(normalized.items)
      setCount(normalized.count)
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load customers.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
    fetchEngagementTemplates()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEngagementTemplateId, filterYear, subMatch, JSON.stringify(filterSubEngagementIds)])

  const filtered = useMemo(() => {
    // keep your existing client search over loaded results
    if (!debounced) return customers
    return customers.filter((c) => {
      const cpName = c?.contactPerson?.name || ""
      const assignedArr = normalizeAssignedToArray(c?.assignedTo)
      const assignedNames = assignedArr.map((x) => (typeof x === "object" ? x?.name : "")).filter(Boolean).join(" ")
      const s = `${c?.name || ""} ${c?.companyName || ""} ${c?.phone || ""} ${cpName} ${assignedNames} ${c?.status || ""}`.toLowerCase()
      return s.includes(debounced)
    })
  }, [customers, debounced])

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
          if (onBackToCustomers) {
            onBackToCustomers()
            return
          }
          setSelectedCustomerId(null)
          fetchCustomers()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
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

      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={`${premiumCard} p-6`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <FiUsers className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Customers</h1>
                <p className="text-sm text-gray-500">List • View details (same page)</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl ring-1 ring-indigo-600/10 bg-indigo-50 text-indigo-700">
                <FiDatabase className="w-4 h-4" />
                <span className="font-extrabold">{filtered.length}</span>
                <span className="text-sm">{filtered.length === 1 ? "customer" : "customers"}</span>
                {debounced && <span className="text-sm text-indigo-600">(filtered)</span>}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* SEARCH BAR with FILTER ICON + APPLIED CHIPS */}
      <div className="mb-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="w-full lg:flex-1">
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
              onClick={() => document.getElementById("customers-search-input")?.focus?.()}
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
                placeholder={appliedFilterChips.length ? "Search…" : "Search customer, company, phone, contact…"}
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
              <p className="text-xs text-gray-500">Searching within loaded customers.</p>
            ) : (
              <p className="text-xs text-gray-500">Tip: Click the filter icon to open the filtering panel.</p>
            )}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-900">{filtered.length}</span> {debounced ? "result(s)" : `of ${count}`}
        </div>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">{error}</div>}

      <div className={`${premiumCard} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/60">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">No.</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Company</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Phone</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              <AnimatePresence>
                {isLoading && customers.length === 0 ? (
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
                  filtered.map((c, index) => (
                    <motion.tr
                      key={c?._id || `cust-${index}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">{index + 1}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{c?.name || "Unnamed"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c?.companyName || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c?.phone || "—"}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={c?.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            if (onNavigateCustomer) onNavigateCustomer(c._id)
                            else setSelectedCustomerId(c._id)
                          }}
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
                      {debounced ? "No customers match your search." : "No customers found."}
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

          {!debounced && !isLoading && customers.length > 0 && (
            <button
              onClick={fetchCustomers}
              className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-[0.99] transition"
            >
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
