"use client"

import {
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
import {
  FiUsers,
  FiSearch,
  FiX,
  FiFilter,
  FiChevronDown,
  FiRefreshCcw,
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiCalendar,
  FiInfo,
  FiBriefcase,
} from "react-icons/fi"
import { Loader2 } from "lucide-react"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const ENDPOINTS = {
  LIST_CUSTOMER_WORKLOAD: `${API_BASE}/workload/customers`, // ✅ new
}

/* =========================
   STYLES
========================= */
const pageBg = "bg-gradient-to-b from-gray-50 via-gray-50 to-white"
const card =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]"
const subtleHover = "transition-colors hover:bg-gray-50/70"

const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
const btnPrimary =
  "bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_12px_30px_-18px_rgba(79,70,229,0.65)]"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"

const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"

const chip =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold ring-1 select-none"
const chipSoft = "bg-white/70 text-gray-800 ring-gray-200"
const chipIndigo = "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
const chipAmber = "bg-amber-50 text-amber-800 ring-amber-600/10"
const chipEmerald = "bg-emerald-50 text-emerald-700 ring-emerald-600/10"
const chipRose = "bg-rose-50 text-rose-700 ring-rose-600/10"
const chipGray = "bg-gray-50 text-gray-800 ring-gray-200"

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

/* =========================
   TOAST
========================= */
function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : "bg-emerald-50 border-emerald-200 text-emerald-700"
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

/* =========================
   MODAL SHELL
========================= */
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
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  {icon}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">{title}</h2>
                  {subtitle ? (
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">
                      {subtitle}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">
                      Adjust what you want to see in the report
                    </p>
                  )}
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

            <div className="p-5 bg-white max-h-[calc(100vh-14rem)] overflow-y-auto">
              {children}
            </div>

            {footer ? (
              <div className="p-5 border-t border-gray-100 bg-white sticky bottom-0">
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
      <label className="block text-sm font-extrabold text-gray-900 mb-1.5">
        {label}
      </label>
      {hint ? (
        <div className="text-xs text-gray-500 font-semibold mb-2 flex items-start gap-2">
          <FiInfo className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
          <span>{hint}</span>
        </div>
      ) : null}
      {children}
    </div>
  )
}

/* =========================
   PREMIUM SWITCH
========================= */
function ToggleSwitch({ checked, onChange, labelOn = "Show", labelOff = "Hide" }) {
  return (
    <button
      type="button"
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex items-center justify-between gap-3",
        "px-3 py-2 rounded-2xl border",
        checked ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-white hover:bg-gray-50",
        "transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
      )}
      aria-pressed={checked}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition",
            checked ? "bg-indigo-600" : "bg-gray-300"
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white transition",
              checked ? "translate-x-5" : "translate-x-1"
            )}
          />
        </span>
        <span className="text-sm font-extrabold text-gray-900">
          {checked ? labelOn : labelOff}
        </span>
      </div>
    </button>
  )
}

/* =========================
   MULTISELECT (Portal + never offscreen)
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
          {selectedCount ? <span className={cn(chip, chipIndigo)}>{selectedCount}</span> : null}
          <FiChevronDown className={cn("w-4 h-4 text-gray-500 transition", open ? "rotate-180" : "")} />
        </span>
      </button>

      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  )
}

/* =========================
   SKELETONS
========================= */
function SkeletonBar({ className = "" }) {
  return <div className={cn("animate-pulse rounded-xl bg-gray-200/80", className)} />
}

function CustomerRowSkeleton() {
  return (
    <div className="p-4 sm:p-5">
      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 w-full">
            <div className="flex items-center gap-3">
              <SkeletonBar className="w-11 h-11 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <SkeletonBar className="h-4 w-56" />
                <SkeletonBar className="h-3 w-72 mt-2" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SkeletonBar className="h-7 w-20 rounded-full" />
              <SkeletonBar className="h-7 w-28 rounded-full" />
              <SkeletonBar className="h-7 w-24 rounded-full" />
              <SkeletonBar className="h-7 w-32 rounded-full" />
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
            <SkeletonBar className="h-8 w-14 rounded-full" />
            <SkeletonBar className="h-8 w-16 rounded-full" />
            <SkeletonBar className="h-8 w-12 rounded-full" />
            <SkeletonBar className="h-8 w-14 rounded-full" />
            <SkeletonBar className="h-8 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

function CustomerListSkeleton({ rows = 7 }) {
  return (
    <div className="divide-y divide-gray-100">
      {[...Array(rows)].map((_, i) => (
        <CustomerRowSkeleton key={i} />
      ))}
    </div>
  )
}

/* =========================
   UTIL
========================= */
function formatDateTime(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

function statusPill(status) {
  const s = String(status || "pending")
  if (s === "done") return chipEmerald
  if (s === "in_progress") return chipIndigo
  if (s === "pending") return chipAmber
  return chipGray
}

function statusLabel(status) {
  const s = String(status || "pending")
  if (s === "done") return "Done"
  if (s === "in_progress") return "In progress"
  if (s === "pending") return "Pending"
  return "Unknown"
}

function statusDot(status) {
  const s = String(status || "pending")
  if (s === "done") return "bg-emerald-500"
  if (s === "in_progress") return "bg-indigo-500"
  if (s === "pending") return "bg-amber-500"
  return "bg-gray-400"
}

function toISOFromDatetimeLocal(v) {
  if (!v) return ""
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString()
}

function isOverdueTask(task) {
  if (!task?.dueAt) return false
  if (String(task?.status) === "done") return false
  const due = new Date(task.dueAt).getTime()
  if (!Number.isFinite(due)) return false
  return due < Date.now()
}

function isDueSoonTask(task, days = 3) {
  if (!task?.dueAt) return false
  if (String(task?.status) === "done") return false
  const due = new Date(task.dueAt).getTime()
  if (!Number.isFinite(due)) return false
  const now = Date.now()
  return due >= now && due <= now + days * 24 * 60 * 60 * 1000
}

function initials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim()
  if (!s) return "?"
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  const one = parts[0]
  if (one.includes("@")) return one.slice(0, 2).toUpperCase()
  return one.slice(0, 2).toUpperCase()
}

function ShortCountBadge({ code, value, title, className }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-extrabold ring-1 select-none whitespace-nowrap",
        className
      )}
    >
      <span className="opacity-80">{code}</span>
      <span className="text-gray-900">{Number(value || 0)}</span>
    </span>
  )
}

function Avatar({ url, label, className = "" }) {
  const fallback = initials(label)
  return (
    <div
      className={cn(
        "w-11 h-11 rounded-2xl overflow-hidden ring-1 ring-indigo-600/10 bg-indigo-50 shrink-0",
        className
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label || "Avatar"} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-indigo-700 font-extrabold">
          {fallback}
        </div>
      )}
    </div>
  )
}

/* =========================
   FILTER MODAL (Customer-first)
========================= */
function FiltersModal({
  open,
  onClose,

  taskStatus,
  setTaskStatus,

  includeEmptyEmployees,
  setIncludeEmptyEmployees,

  windowDays,
  setWindowDays,

  completedFrom,
  setCompletedFrom,
  completedTo,
  setCompletedTo,

  selectedEmployeeIds,
  setSelectedEmployeeIds,
  employeeOptions,

  includeTasks,
  setIncludeTasks,

  taskLimit,
  setTaskLimit,

  onClear,
  onApply,
}) {
  const activeCount =
    (selectedEmployeeIds?.length || 0) +
    (taskStatus !== "all" ? 1 : 0) +
    (includeEmptyEmployees === false ? 1 : 0) +
    (String(windowDays || "").trim() ? 1 : 0) +
    (String(completedFrom || "").trim() ? 1 : 0) +
    (String(completedTo || "").trim() ? 1 : 0) +
    (includeTasks ? 1 : 0)

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Customer-first workload filters"
      icon={<FiFilter className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClear}
            disabled={!activeCount}
            className={cn(btn, btnGhost, "px-3 py-2 text-sm disabled:opacity-60")}
          >
            Clear all
          </button>
          <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <Field label="Employees" hint="Choose one or more employees. Leave empty to include everyone.">
              <MultiSelectDropdown
                options={employeeOptions}
                value={selectedEmployeeIds}
                onChange={setSelectedEmployeeIds}
                placeholder="All employees"
              />
              <p className="mt-2 text-[11px] text-gray-500 font-semibold">
                Note: backend can filter only 1 employeeId directly. If you select multiple, we filter in UI.
              </p>
            </Field>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <Field label="Task status" hint="Filter tasks by their current status.">
              <select
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value)}
                className={input}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </Field>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-4">
            <Field
              label="Time window (due soon window)"
              hint="Used for dueSoon calculations. If blank, default stays 7."
            >
              <input
                type="number"
                min={1}
                max={365}
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                className={input}
                placeholder="e.g. 7"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Completed from" hint="Optional start date/time for completed tasks.">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={completedFrom}
                    onChange={(e) => setCompletedFrom(e.target.value)}
                    className={cn(input, "pl-9")}
                  />
                </div>
              </Field>

              <Field label="Completed to" hint="Optional end date/time for completed tasks.">
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={completedTo}
                    onChange={(e) => setCompletedTo(e.target.value)}
                    className={cn(input, "pl-9")}
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-gray-900">
                  Show employees with 0 tasks
                </p>
                <p className="text-xs text-gray-500 font-semibold mt-1">
                  Turn this off if you only want employees that currently have tasks.
                </p>
              </div>
              <ToggleSwitch
                checked={includeEmptyEmployees}
                onChange={(v) => setIncludeEmptyEmployees(!!v)}
                labelOn="Show"
                labelOff="Hide"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-gray-900">
                  Include tasks in response
                </p>
                <p className="text-xs text-gray-500 font-semibold mt-1">
                  Turn off for lighter payload (counts only). Turn on to show task lists in UI.
                </p>
              </div>
              <ToggleSwitch
                checked={includeTasks}
                onChange={(v) => setIncludeTasks(!!v)}
                labelOn="On"
                labelOff="Off"
              />
            </div>

            <div className="mt-4">
              <Field label="Task limit per employee" hint="Only applies if include tasks is on.">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={taskLimit}
                  onChange={(e) => setTaskLimit(e.target.value)}
                  className={input}
                  placeholder="e.g. 10"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-sm font-extrabold text-gray-900 mb-3">Preview</p>

            <div className="flex flex-wrap gap-2">
              <span className={cn(chip, chipSoft)}>
                Status:{" "}
                <b className="text-gray-900">
                  {taskStatus === "all" ? "All" : statusLabel(taskStatus)}
                </b>
              </span>

              <span className={cn(chip, chipSoft)}>
                Empty employees:{" "}
                <b className="text-gray-900">{includeEmptyEmployees ? "Shown" : "Hidden"}</b>
              </span>

              <span className={cn(chip, chipSoft)}>
                Window:{" "}
                <b className="text-gray-900">
                  {String(windowDays || "").trim() ? `${windowDays} days` : "Default"}
                </b>
              </span>

              <span className={cn(chip, chipSoft)}>
                Tasks payload: <b className="text-gray-900">{includeTasks ? "Included" : "Off"}</b>
              </span>

              {selectedEmployeeIds?.length ? (
                <span className={cn(chip, chipIndigo)}>
                  Employees selected:{" "}
                  <b className="text-gray-900">{selectedEmployeeIds.length}</b>
                </span>
              ) : (
                <span className={cn(chip, chipSoft)}>
                  Employees: <b className="text-gray-900">All</b>
                </span>
              )}

              {completedFrom ? (
                <span className={cn(chip, chipSoft)}>
                  Completed from: <b className="text-gray-900">Set</b>
                </span>
              ) : null}
              {completedTo ? (
                <span className={cn(chip, chipSoft)}>
                  Completed to: <b className="text-gray-900">Set</b>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* =========================
   API (Customer-first + cursor pagination)
========================= */
async function fetchCustomerWorkloadPage({
  cursor,
  limit = 20,
  sort = "newest",
  q,

  employeeId,
  taskStatus = "all",
  includeEmptyEmployees = true,
  windowDays,
  completedFrom,
  completedTo,

  includeTasks = true,
  taskLimit = 10,

  signal,
}) {
  const qs = new URLSearchParams()

  qs.set("limit", String(limit))
  qs.set("sort", String(sort || "newest"))

  if (cursor) qs.set("cursor", String(cursor))
  if (q) qs.set("q", String(q))

  qs.set("taskStatus", String(taskStatus || "all"))
  qs.set("includeEmptyEmployees", includeEmptyEmployees ? "true" : "false")

  const wd = String(windowDays || "").trim()
  if (wd) qs.set("windowDays", wd)

  if (employeeId) qs.set("employeeId", String(employeeId))

  if (completedFrom) {
    const iso = toISOFromDatetimeLocal(completedFrom)
    if (iso) qs.set("completedFrom", iso)
  }
  if (completedTo) {
    const iso = toISOFromDatetimeLocal(completedTo)
    if (iso) qs.set("completedTo", iso)
  }

  qs.set("includeTasks", includeTasks ? "true" : "false")
  if (includeTasks) qs.set("taskLimit", String(taskLimit || 10))

  const res = await fetch(`${ENDPOINTS.LIST_CUSTOMER_WORKLOAD}?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load workload")

  return {
    customers: Array.isArray(data?.customers) ? data.customers : [],
    hasMore: !!data?.hasMore,
    nextCursor: data?.nextCursor || null,
  }
}

/* =========================
   MAIN — Customer-first Workload Report
========================= */
export default function EmployeeWorkloadReportPage() {
  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = useCallback((type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(
      () => setToast({ open: false, type: "success", message: "" }),
      2200
    )
  }, [])
  const closeToast = () => setToast({ open: false, type: "success", message: "" })

  // search (customer search -> backend q)
  const [searchTerm, setSearchTerm] = useState("")
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim()), 280)
    return () => clearTimeout(t)
  }, [searchTerm])

  // applied filters
  const [taskStatus, setTaskStatus] = useState("all")
  const [includeEmptyEmployees, setIncludeEmptyEmployees] = useState(true)
  const [windowDays, setWindowDays] = useState("7")
  const [completedFrom, setCompletedFrom] = useState("")
  const [completedTo, setCompletedTo] = useState("")
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])

  const [includeTasks, setIncludeTasks] = useState(true)
  const [taskLimit, setTaskLimit] = useState("10")

  // pagination
  const [sort, setSort] = useState("newest")
  const [limit, setLimit] = useState(20)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  // modal draft
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dTaskStatus, setDTaskStatus] = useState("all")
  const [dIncludeEmpty, setDIncludeEmpty] = useState(true)
  const [dWindowDays, setDWindowDays] = useState("7")
  const [dFrom, setDFrom] = useState("")
  const [dTo, setDTo] = useState("")
  const [dEmpIds, setDEmpIds] = useState([])
  const [dIncludeTasks, setDIncludeTasks] = useState(true)
  const [dTaskLimit, setDTaskLimit] = useState("10")

  const openFilters = () => {
    setDTaskStatus(taskStatus)
    setDIncludeEmpty(includeEmptyEmployees)
    setDWindowDays(String(windowDays || ""))
    setDFrom(String(completedFrom || ""))
    setDTo(String(completedTo || ""))
    setDEmpIds(Array.isArray(selectedEmployeeIds) ? selectedEmployeeIds.slice() : [])
    setDIncludeTasks(!!includeTasks)
    setDTaskLimit(String(taskLimit || "10"))
    setFiltersOpen(true)
  }

  const clearDraft = () => {
    setDTaskStatus("all")
    setDIncludeEmpty(true)
    setDWindowDays("7")
    setDFrom("")
    setDTo("")
    setDEmpIds([])
    setDIncludeTasks(true)
    setDTaskLimit("10")
  }

  const applyDraft = () => {
    setTaskStatus(dTaskStatus)
    setIncludeEmptyEmployees(!!dIncludeEmpty)
    setWindowDays(String(dWindowDays || "7"))
    setCompletedFrom(String(dFrom || ""))
    setCompletedTo(String(dTo || ""))
    setSelectedEmployeeIds(Array.isArray(dEmpIds) ? dEmpIds.slice() : [])
    setIncludeTasks(!!dIncludeTasks)
    setTaskLimit(String(dTaskLimit || "10"))
    setFiltersOpen(false)
  }

  const clearApplied = () => {
    setTaskStatus("all")
    setIncludeEmptyEmployees(true)
    setWindowDays("7")
    setCompletedFrom("")
    setCompletedTo("")
    setSelectedEmployeeIds([])
    setIncludeTasks(true)
    setTaskLimit("10")
  }

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (taskStatus !== "all") n += 1
    if (includeEmptyEmployees === false) n += 1
    if (String(windowDays || "").trim() && String(windowDays || "").trim() !== "7") n += 1
    if (completedFrom) n += 1
    if (completedTo) n += 1
    if ((selectedEmployeeIds?.length || 0) > 0) n += 1
    if (!includeTasks) n += 1
    return n
  }, [taskStatus, includeEmptyEmployees, windowDays, completedFrom, completedTo, selectedEmployeeIds, includeTasks])

  const hasAppliedFilters = activeFilterCount > 0

  // data
  const [rows, setRows] = useState([]) // customers rows
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const abortRef = useRef(null)

  // expand states
  const [openCustomerIds, setOpenCustomerIds] = useState(() => new Set())
  const [openEmployeeKeys, setOpenEmployeeKeys] = useState(() => new Set()) // `${customerId}:${employeeId}`

  const toggleCustomer = (customerId) => {
    const id = String(customerId)
    setOpenCustomerIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleEmployee = (customerId, employeeId) => {
    const key = `${String(customerId)}:${String(employeeId)}`
    setOpenEmployeeKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const resetAndLoad = async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError("")
    try {
      // backend supports only one employeeId filter at a time
      const backendEmployeeId =
        selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : null

      const first = await fetchCustomerWorkloadPage({
        cursor: null,
        limit,
        sort,
        q: debounced || "",

        employeeId: backendEmployeeId,
        taskStatus,
        includeEmptyEmployees,
        windowDays,
        completedFrom: completedFrom || "",
        completedTo: completedTo || "",

        includeTasks,
        taskLimit: Number(taskLimit || 10),

        signal: controller.signal,
      })

      setRows(first.customers || [])
      setHasMore(!!first.hasMore)
      setCursor(first.nextCursor || null)

      setOpenCustomerIds(new Set())
      setOpenEmployeeKeys(new Set())
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load report.")
    } finally {
      setIsLoading(false)
      setHasLoadedOnce(true)
    }
  }

  const loadMore = async () => {
    if (!hasMore || !cursor || isLoading || isLoadingMore) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoadingMore(true)
    setError("")
    try {
      const backendEmployeeId =
        selectedEmployeeIds.length === 1 ? selectedEmployeeIds[0] : null

      const next = await fetchCustomerWorkloadPage({
        cursor,
        limit,
        sort,
        q: debounced || "",

        employeeId: backendEmployeeId,
        taskStatus,
        includeEmptyEmployees,
        windowDays,
        completedFrom: completedFrom || "",
        completedTo: completedTo || "",

        includeTasks,
        taskLimit: Number(taskLimit || 10),

        signal: controller.signal,
      })

      setRows((prev) => {
        const seen = new Set(prev.map((x) => String(x?.customer?.customerId)))
        const add = (next.customers || []).filter((x) => !seen.has(String(x?.customer?.customerId)))
        return prev.concat(add)
      })

      setHasMore(!!next.hasMore)
      setCursor(next.nextCursor || null)
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load more.")
    } finally {
      setIsLoadingMore(false)
      setHasLoadedOnce(true)
    }
  }

  useEffect(() => {
    resetAndLoad()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // reload when filters/search change
  useEffect(() => {
    resetAndLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debounced,
    sort,
    limit,
    taskStatus,
    includeEmptyEmployees,
    windowDays,
    completedFrom,
    completedTo,
    includeTasks,
    taskLimit,
    JSON.stringify(selectedEmployeeIds),
  ])

  const refreshAll = async () => {
    await resetAndLoad()
    showToast("success", "Refreshed.")
  }

  // Build employeeOptions from loaded rows (best effort)
  const employeeOptions = useMemo(() => {
    const list = []
    for (const r of rows || []) {
      const employees = Array.isArray(r?.employees) ? r.employees : []
      for (const eEntry of employees) {
        const e = eEntry?.employee
        if (!e?._id) continue
        list.push({
          value: String(e._id),
          label: `${e.name || "—"}${e.email ? ` (${e.email})` : ""}`,
        })
      }
    }
    const seen = new Set()
    const out = []
    for (const o of list) {
      if (seen.has(o.value)) continue
      seen.add(o.value)
      out.push(o)
    }
    return out
  }, [rows])

  // If user selects multiple employees, filter in UI
  const filteredRows = useMemo(() => {
    let list = Array.isArray(rows) ? rows.slice() : []

    if (selectedEmployeeIds.length > 1) {
      const set = new Set(selectedEmployeeIds.map(String))
      list = list
        .map((row) => {
          const employees = Array.isArray(row?.employees) ? row.employees : []
          const filteredEmployees = employees.filter((x) => set.has(String(x?.employee?._id)))
          return { ...row, employees: filteredEmployees }
        })
        .filter((row) => (row?.employees?.length || 0) > 0)
    }

    return list
  }, [rows, selectedEmployeeIds])

  const computedSummary = useMemo(() => {
    const customersCount = filteredRows.length
    let pending = 0
    let in_progress = 0
    let done = 0
    let overdue = 0

    for (const r of filteredRows) {
      const t = r?.totals || {}
      pending += Number(t.pending || 0)
      in_progress += Number(t.in_progress || 0)
      done += Number(t.done || 0)
      overdue += Number(t.overdue || 0)
    }

    return { customersCount, pending, in_progress, done, overdue }
  }, [filteredRows])

  const appliedChips = useMemo(() => {
    const chips = []

    if (taskStatus !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusLabel(taskStatus)}`,
        onRemove: () => setTaskStatus("all"),
      })
    }

    if (includeEmptyEmployees === false) {
      chips.push({
        key: "emptyEmp",
        label: "Hide employees with 0 tasks",
        onRemove: () => setIncludeEmptyEmployees(true),
      })
    }

    if (String(windowDays || "").trim() && String(windowDays || "").trim() !== "7") {
      chips.push({
        key: "window",
        label: `Window ${windowDays}d`,
        onRemove: () => setWindowDays("7"),
      })
    }

    if (completedFrom)
      chips.push({
        key: "from",
        label: "Completed: from set",
        onRemove: () => setCompletedFrom(""),
      })
    if (completedTo)
      chips.push({
        key: "to",
        label: "Completed: to set",
        onRemove: () => setCompletedTo(""),
      })

    if ((selectedEmployeeIds?.length || 0) > 0) {
      chips.push({
        key: "emp",
        label:
          selectedEmployeeIds.length === 1
            ? "1 employee selected"
            : `${selectedEmployeeIds.length} employees selected`,
        onRemove: () => setSelectedEmployeeIds([]),
      })
    }

    if (!includeTasks) {
      chips.push({
        key: "noTasks",
        label: "Tasks payload off",
        onRemove: () => setIncludeTasks(true),
      })
    }

    return chips
  }, [
    taskStatus,
    includeEmptyEmployees,
    windowDays,
    completedFrom,
    completedTo,
    selectedEmployeeIds,
    includeTasks,
  ])

  const showSkeleton = isLoading || !hasLoadedOnce

  return (
    <div className={cn("min-h-screen p-4 sm:p-6 lg:p-8", pageBg)}>
      <AnimatePresence>
        <Toast
          open={toast.open}
          type={toast.type}
          message={toast.message}
          onClose={closeToast}
        />
      </AnimatePresence>

      <AnimatePresence>
        {filtersOpen ? (
          <FiltersModal
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            taskStatus={dTaskStatus}
            setTaskStatus={setDTaskStatus}
            includeEmptyEmployees={dIncludeEmpty}
            setIncludeEmptyEmployees={setDIncludeEmpty}
            windowDays={dWindowDays}
            setWindowDays={setDWindowDays}
            completedFrom={dFrom}
            setCompletedFrom={setDFrom}
            completedTo={dTo}
            setCompletedTo={setDTo}
            selectedEmployeeIds={dEmpIds}
            setSelectedEmployeeIds={setDEmpIds}
            employeeOptions={employeeOptions}
            includeTasks={dIncludeTasks}
            setIncludeTasks={setDIncludeTasks}
            taskLimit={dTaskLimit}
            setTaskLimit={setDTaskLimit}
            onClear={clearDraft}
            onApply={applyDraft}
          />
        ) : null}
      </AnimatePresence>

      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className={cn(card, "p-6")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg" />
                  <div className="relative bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                    <FiBriefcase className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                    Workload Report
                  </h1>
                  <p className="text-sm text-gray-500 font-semibold">
                    Customer-first view • employees with avatars • optimized paging
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={refreshAll}
                  className={cn(btn, btnGhost)}
                  title="Refresh"
                  disabled={isLoading}
                >
                  <FiRefreshCcw className={cn("w-4 h-4", isLoading ? "animate-spin" : "")} />
                  Refresh
                </button>

                <div className="rounded-2xl border border-gray-100 bg-white px-3 py-2 shadow-sm flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-extrabold">Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="text-sm font-extrabold text-gray-900 bg-transparent outline-none"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SEARCH BAR */}
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
                    onClick={() => document.getElementById("workload-search")?.focus?.()}
                  >
                    {appliedChips.map((c) => (
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
                      id="workload-search"
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={appliedChips.length ? "Search customer…" : "Search customer name, company, email…"}
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
                      onClick={clearApplied}
                      className={cn(
                        "shrink-0 h-9 w-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                        "flex items-center justify-center focus:outline-none"
                      )}
                      aria-label="Clear applied filters"
                      title="Clear filters"
                    >
                      <FiX className="w-4 h-4 text-gray-700" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-gray-500 font-semibold">
                    Search is backend-powered (q) — pagination stays stable.
                  </p>
                </div>
              </div>

              <div className="w-full lg:w-auto">
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className={cn(chip, chipAmber)}>
                      Pending <b>{computedSummary.pending}</b>
                    </span>
                    <span className={cn(chip, chipIndigo)}>
                      In progress <b>{computedSummary.in_progress}</b>
                    </span>
                    <span className={cn(chip, chipEmerald)}>
                      Done <b>{computedSummary.done}</b>
                    </span>
                    <span className={cn(chip, chipRose)}>
                      Overdue <b>{computedSummary.overdue}</b>
                    </span>
                    <span className={cn(chip, chipGray)}>
                      Customers <b>{computedSummary.customersCount}</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                <FiAlertCircle className="w-5 h-5 mt-0.5" />
                <span className="text-sm font-semibold">{error}</span>
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* LIST */}
      <div className={cn(card, "overflow-hidden")}>
        <div className="max-h-[72vh] overflow-y-auto">
          {showSkeleton ? (
            <CustomerListSkeleton rows={7} />
          ) : (
            <div className="divide-y divide-gray-100">
              <AnimatePresence>
                {filteredRows.length ? (
                  filteredRows.map((row) => {
                    const customer = row?.customer || {}
                    const cid = String(customer?.customerId || "")
                    const isOpen = openCustomerIds.has(cid)

                    const totals = row?.totals || {}
                    const pending = Number(totals.pending ?? 0)
                    const in_progress = Number(totals.in_progress ?? 0)
                    const done = Number(totals.done ?? 0)
                    const overdue = Number(totals.overdue ?? 0)
                    const dueSoon = Number(totals.dueSoon ?? 0)
                    const totalTasks = Number(totals.total ?? 0)

                    const employees = Array.isArray(row?.employees) ? row.employees : []
                    const employeesCount = employees.length

                    const lastTouch = (() => {
                      if (!includeTasks) return null
                      let max = 0
                      for (const eEntry of employees) {
                        const tasks = Array.isArray(eEntry?.tasks) ? eEntry.tasks : []
                        for (const t of tasks) {
                          const a = t?.completedAt ? new Date(t.completedAt).getTime() : NaN
                          const b = t?.createdAt ? new Date(t.createdAt).getTime() : NaN
                          const c = t?.dueAt ? new Date(t.dueAt).getTime() : NaN
                          const m = Math.max(
                            Number.isFinite(a) ? a : 0,
                            Number.isFinite(b) ? b : 0,
                            Number.isFinite(c) ? c : 0
                          )
                          if (m > max) max = m
                        }
                      }
                      return max ? new Date(max).toISOString() : null
                    })()

                    return (
                      <motion.div
                        key={cid}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn("p-4 sm:p-5", subtleHover)}
                      >
                        <button
                          type="button"
                          onClick={() => toggleCustomer(cid)}
                          className={cn(
                            "w-full text-left rounded-2xl border border-gray-100 bg-white",
                            "px-4 py-4",
                            "hover:bg-gray-50/70 transition",
                            "focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          )}
                          aria-expanded={isOpen}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 flex items-center justify-center font-extrabold shrink-0">
                                  {initials(customer?.companyName || customer?.name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-base font-extrabold text-gray-900 truncate">
                                    {customer?.name || "Customer"}
                                    {customer?.companyName ? (
                                      <span className="text-gray-500"> • {customer.companyName}</span>
                                    ) : null}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {customer?.email || "—"}
                                    {customer?.phone ? ` • ${customer.phone}` : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className={cn(chip, chipGray)}>
                                  <FiUsers className="w-3.5 h-3.5" /> Employees <b>{employeesCount}</b>
                                </span>
                                <span className={cn(chip, chipGray)}>
                                  Tasks <b>{totalTasks}</b>
                                </span>
                                {lastTouch ? (
                                  <span className={cn(chip, chipGray)}>
                                    <FiClock className="w-3.5 h-3.5" />
                                    {formatDateTime(lastTouch)}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                              <ShortCountBadge code="P" value={pending} title="Pending" className={cn(chipAmber)} />
                              <ShortCountBadge code="IP" value={in_progress} title="In progress" className={cn(chipIndigo)} />
                              <ShortCountBadge code="D" value={done} title="Done" className={cn(chipEmerald)} />
                              <ShortCountBadge code="OD" value={overdue} title="Overdue" className={cn(chipRose)} />
                              <ShortCountBadge code="S" value={dueSoon} title="Due soon" className={cn(chipGray)} />
                              <FiChevronDown className={cn("w-5 h-5 text-gray-500 transition", isOpen ? "rotate-180" : "")} />
                            </div>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isOpen ? (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
                                {(employees || []).length ? (
                                  <div className="space-y-3">
                                    {employees.map((eEntry) => {
                                      const emp = eEntry?.employee || {}
                                      const empId = String(emp?._id || "")
                                      const eKey = `${cid}:${empId}`
                                      const eOpen = openEmployeeKeys.has(eKey)

                                      const counts = eEntry?.counts || {}
                                      const p = Number(counts.pending || 0)
                                      const ip = Number(counts.in_progress || 0)
                                      const d = Number(counts.done || 0)
                                      const od = Number(counts.overdue || 0)
                                      const ds = Number(counts.dueSoon || 0)
                                      const total = Number(counts.total || 0)

                                      const tasks = includeTasks && Array.isArray(eEntry?.tasks) ? eEntry.tasks : []

                                      return (
                                        <div
                                          key={eKey}
                                          className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_16px_40px_-30px_rgba(0,0,0,0.55)]"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => toggleEmployee(cid, empId)}
                                            className={cn(
                                              "w-full text-left",
                                              "px-4 py-4",
                                              "flex items-start justify-between gap-3",
                                              "hover:bg-gray-50/70 transition focus:outline-none"
                                            )}
                                            aria-expanded={eOpen}
                                          >
                                            <div className="flex items-start gap-3 min-w-0">
                                              <div className="w-1.5 self-stretch rounded-full bg-indigo-600/80" aria-hidden="true" />
                                              <Avatar url={emp?.avatarUrl} label={emp?.name || emp?.email} />

                                              <div className="min-w-0">
                                                <p className="text-sm sm:text-base font-extrabold text-gray-900 truncate">
                                                  {emp?.name || "—"}
                                                  {emp?.isActive === false ? (
                                                    <span className="ml-2 text-[11px] font-extrabold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                                      Inactive
                                                    </span>
                                                  ) : null}
                                                </p>
                                                <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">
                                                  {emp?.email || "—"}
                                                </p>
                                                <p className="mt-1 text-[11px] text-gray-400 font-semibold truncate">
                                                  P=Pending • IP=In progress • D=Done • OD=Overdue • S=Due soon • T=Total
                                                </p>
                                              </div>
                                            </div>

                                            <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                                              <ShortCountBadge code="P" value={p} title="Pending" className={cn(chipAmber)} />
                                              <ShortCountBadge code="IP" value={ip} title="In progress" className={cn(chipIndigo)} />
                                              <ShortCountBadge code="D" value={d} title="Done" className={cn(chipEmerald)} />
                                              <ShortCountBadge code="OD" value={od} title="Overdue" className={cn(chipRose)} />
                                              <ShortCountBadge code="S" value={ds} title="Due soon" className={cn(chipGray)} />
                                              <ShortCountBadge code="T" value={total} title="Total tasks" className={cn(chipGray)} />
                                              <FiChevronDown className={cn("w-4 h-4 text-gray-500 transition", eOpen ? "rotate-180" : "")} />
                                            </div>
                                          </button>

                                          <AnimatePresence>
                                            {eOpen ? (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                              >
                                                <div className="px-4 pb-4">
                                                  {!includeTasks ? (
                                                    <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600 text-center font-semibold">
                                                      Tasks payload is disabled. Turn it on in Filters to view task lists.
                                                    </div>
                                                  ) : tasks.length ? (
                                                    <div className="mt-2 space-y-2">
                                                      {tasks.map((t) => {
                                                        const overdueNow = isOverdueTask(t)
                                                        const dueSoonNow = isDueSoonTask(t, 3)
                                                        const doneNow = String(t?.status) === "done"

                                                        return (
                                                          <div
                                                            key={String(t?._id)}
                                                            className={cn(
                                                              "rounded-2xl border bg-white p-3 sm:p-4",
                                                              overdueNow ? "border-rose-200 ring-1 ring-rose-600/10" : "border-gray-100",
                                                              "shadow-[0_10px_30px_-24px_rgba(0,0,0,0.5)]"
                                                            )}
                                                          >
                                                            <div className="flex items-start gap-3">
                                                              <span className={cn("mt-1.5 w-2.5 h-2.5 rounded-full shrink-0", statusDot(t?.status))} />
                                                              <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold bg-indigo-600 text-white">
                                                                    Task
                                                                  </span>
                                                                  <p className="text-sm sm:text-[15px] font-extrabold text-gray-900 truncate">
                                                                    {t?.title || "Task"}
                                                                  </p>
                                                                </div>

                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                  <span className={cn(chip, statusPill(t?.status))}>
                                                                    {statusLabel(t?.status)}
                                                                  </span>

                                                                  {t?.dueAt ? (
                                                                    <span className={cn(chip, chipGray)}>
                                                                      <FiCalendar className="w-3.5 h-3.5" />
                                                                      {formatDateTime(t?.dueAt)}
                                                                    </span>
                                                                  ) : (
                                                                    <span className={cn(chip, chipGray)} title="No due date">
                                                                      <FiCalendar className="w-3.5 h-3.5" />
                                                                      No due date
                                                                    </span>
                                                                  )}

                                                                  {!doneNow && overdueNow ? (
                                                                    <span className={cn(chip, chipRose)} title="This task is overdue">
                                                                      Overdue
                                                                    </span>
                                                                  ) : null}

                                                                  {!doneNow && !overdueNow && dueSoonNow ? (
                                                                    <span className={cn(chip, chipAmber)} title="Due soon (within 3 days)">
                                                                      Due soon
                                                                    </span>
                                                                  ) : null}

                                                                  {t?.completedAt ? (
                                                                    <span className={cn(chip, chipEmerald)}>
                                                                      Completed {formatDateTime(t.completedAt)}
                                                                    </span>
                                                                  ) : null}
                                                                </div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        )
                                                      })}
                                                    </div>
                                                  ) : (
                                                    <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500 text-center font-semibold">
                                                      No tasks for this employee (with current filters)
                                                    </div>
                                                  )}
                                                </div>
                                              </motion.div>
                                            ) : null}
                                          </AnimatePresence>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-500 text-center font-semibold">
                                    No assigned employees for this customer
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 text-center">
                    <p className="text-sm font-extrabold text-gray-900">No customers found</p>
                    <p className="text-xs text-gray-500 font-semibold mt-1">
                      Try clearing filters or changing search.
                    </p>
                    {hasAppliedFilters ? (
                      <button onClick={clearApplied} className={cn(btn, btnGhost, "mt-4")}>
                        Clear filters
                      </button>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-gray-600">
            Showing <b className="text-gray-900">{filteredRows.length}</b> customers
            {hasMore ? <span className="text-gray-400"> • more available</span> : null}
          </span>

          <div className="flex items-center gap-2">
            {hasMore ? (
              <button
                onClick={loadMore}
                className={cn(btn, btnGhost, "px-4 py-2")}
                disabled={isLoadingMore || isLoading}
              >
                {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Load more
              </button>
            ) : null}

            <button
              onClick={refreshAll}
              className={cn(btn, btnPrimary, "px-4 py-2")}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
