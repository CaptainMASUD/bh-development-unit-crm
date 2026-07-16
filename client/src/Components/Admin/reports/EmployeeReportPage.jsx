"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  FiSearch,
  FiX,
  FiFilter,
  FiRefreshCcw,
  FiLoader,
  FiAlertCircle,
  FiCheck,
  FiEye,
  FiChevronDown,
  FiTrendingUp,
  FiClock,
  FiList,
  FiActivity,
  FiAward,
  FiChevronUp,
  FiClipboard,
  FiColumns,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi"
import { SiMicrosoftexcel } from "react-icons/si"
import { FaFilePdf } from "react-icons/fa"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`

const shell = "min-h-screen bg-gradient-to-b from-gray-50 to-white"
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
const subtleHover = "transition-colors hover:bg-gray-50/70"
const btn =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
const btnPrimary = "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
const btnGhost = "border border-gray-200 bg-white hover:bg-gray-50"
const input =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:border-transparent"
const chip = "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1"

// tighter table paddings
const thCls = "px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
const thClsR = "px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider"
const tdCls = "px-6 py-3 align-middle"
const tdNum = "px-6 py-3 align-middle text-right text-sm text-gray-700"
const tdNumBold = "px-6 py-3 align-middle text-right text-sm font-extrabold text-gray-900"

const searchWrap =
  [
    "rounded-2xl border border-gray-200 bg-white",
    "px-3 py-1 sm:px-3.5 sm:py-1",
    "min-h-[40px] sm:min-h-[42px]",
    "flex items-center gap-2 flex-wrap",
    "transition shadow-none",
    "focus-within:border-indigo-300",
    "focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
  ].join(" ")

const searchInput =
  [
    "flex-1 min-w-[10rem] bg-transparent",
    "text-sm text-gray-900 placeholder:text-gray-400",
    "border-0 outline-none ring-0 shadow-none appearance-none",
    "h-8 sm:h-9",
    "focus:outline-none focus:ring-0 focus:shadow-none",
  ].join(" ")

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

function safeNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function minsToHours(mins) {
  const m = safeNum(mins)
  const h = m / 60
  return Math.round(h * 10) / 10
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  const a = parts[0]?.[0] || ""
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : ""
  return (a + b).toUpperCase()
}

function ratingTone(label = "") {
  const v = String(label || "").toLowerCase()
  if (v === "outstanding") return "green"
  if (v === "better") return "indigo"
  if (v === "good") return "amber"
  return "gray"
}

function ratingLabelPretty(label = "") {
  const v = String(label || "").toLowerCase()
  if (!v) return "—"
  return v.charAt(0).toUpperCase() + v.slice(1)
}

function statusTone(status = "") {
  const s = String(status || "").toLowerCase()
  if (s === "done") return "green"
  if (s === "in_progress") return "indigo"
  if (s === "pending") return "amber"
  return "gray"
}

function statusPretty(status = "") {
  const s = String(status || "").toLowerCase()
  if (s === "in_progress") return "In progress"
  if (s === "pending") return "Pending"
  if (s === "done") return "Done"
  return "—"
}

function rangeLabelPretty(range = "") {
  const r = String(range || "")
  if (r === "this_month") return "This month"
  if (r === "last_month") return "Last month"
  if (r === "this_week") return "This week"
  if (r === "last_6_months") return "Last 6 months"
  if (r === "last_1_year") return "Last 1 year"
  return "—"
}

function activeLabelPretty(v = "all") {
  if (String(v) === "true") return "Active only"
  if (String(v) === "false") return "Inactive only"
  return "All"
}

function sortLabelPretty(v = "newest") {
  if (String(v) === "oldest") return "Oldest"
  return "Newest"
}

/* ---------------------- Columns (updated backend) ---------------------- */
const EMP_VIEW_KEY = "employeeReport.list"

// ✅ labels for ALL backend columns
const COLUMN_LABELS = {
  employee: "Employee",
  active: "Active",
  assigned: "Assigned",
  pending: "Pending",
  in_progress: "In prog",
  done: "Done",
  range_done: "Range done",
  hours: "Hours",
  avg_min: "Avg min",
  rating: "Rating",
  actions: "Actions", // backend may include; UI still has fixed actions button
}

// alignment per column
const COLUMN_META = {
  employee: { align: "left" },
  active: { align: "left" },
  assigned: { align: "right" },
  pending: { align: "right" },
  in_progress: { align: "right" },
  done: { align: "right" },
  range_done: { align: "right" },
  hours: { align: "right" },
  avg_min: { align: "right" },
  rating: { align: "right" },
  actions: { align: "right" },
}

function prettyColLabel(key) {
  return COLUMN_LABELS[key] || String(key || "")
}

function normalizeCols(cols = [], allowed = []) {
  const allowedSet = new Set(allowed || [])
  const out = []
  for (const c of cols || []) {
    const v = String(c || "").trim()
    if (!v) continue
    if (!allowedSet.has(v)) continue
    out.push(v)
  }
  return [...new Set(out)]
}

async function apiGetEmployeeReportViewPreference({ key, etag } = {}) {
  const headers = getAuthHeaders()
  if (etag) headers["If-None-Match"] = etag

  const res = await fetch(`${API_BASE}/view-preferences/employee-report/${encodeURIComponent(key)}`, {
    headers,
    credentials: "include",
  })

  if (res.status === 304) return { notModified: true }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load view preference")
  return { ...data, etag: res.headers.get("ETag") || null }
}

async function apiSaveEmployeeReportViewPreference({ key, columns } = {}) {
  const res = await fetch(`${API_BASE}/view-preferences/employee-report/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ columns }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to save view preference")
  return { ...data, etag: res.headers.get("ETag") || null }
}

/* ---------------------- UI helpers ---------------------- */
function SkeletonRow({ cols = 6 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className={tdCls}>
          <div className={cn("h-4 rounded bg-gray-200", i === 0 ? "w-56" : "w-16 ml-auto")} />
          {i === 0 ? <div className="h-3 w-32 bg-gray-200 rounded mt-2" /> : null}
        </td>
      ))}
    </tr>
  )
}

function TableLoadingOverlay({ show }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-20 bg-white/55 backdrop-blur-[2px] flex items-center justify-center"
        >
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FiLoader className="w-4 h-4 animate-spin" />
            Loading employees…
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function Toast({ open, type = "success", message, onClose }) {
  if (!open) return null
  const styles =
    type === "error" ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-green-50 border-green-200 text-green-700"
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
            className="p-1 rounded-lg hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
            aria-label="Close"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function ModalShell({ open, onClose, title, subtitle, icon, children, footer, maxWidthClass = "max-w-5xl" }) {
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
                className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
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

function RangeSelect({ value, onChange }) {
  const items = [
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
    { key: "this_week", label: "This week" },
    { key: "last_6_months", label: "Last 6 months" },
    { key: "last_1_year", label: "Last 1 year" },
  ]

  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange?.(e.target.value)} className={cn(input, "pr-10")}>
        {items.map((x) => (
          <option key={x.key} value={x.key}>
            {x.label}
          </option>
        ))}
      </select>
      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
    </div>
  )
}

/* ---------------------- API ---------------------- */
async function apiListEmployees({ limit = 25, cursor, q, active = "all", sort = "newest", signal } = {}) {
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  qs.set("sort", String(sort || "newest"))
  if (cursor) qs.set("cursor", String(cursor))
  if (q) qs.set("q", String(q))
  if (active) qs.set("active", String(active))

  const res = await fetch(`${API_BASE}/users/employees?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load employees")

  const items = Array.isArray(data?.employees) ? data.employees : Array.isArray(data?.items) ? data.items : []
  return { items, hasMore: Boolean(data?.hasMore), nextCursor: data?.nextCursor ?? null }
}

async function apiGetEmployeePerformance({
  employeeId,
  range,
  from,
  to,
  includeInProgressList = false,
  includeTasks = false,
  tasksLimit = 60,
  signal,
} = {}) {
  const qs = new URLSearchParams()
  if (range) qs.set("range", String(range))
  if (from && to) {
    qs.set("from", String(from))
    qs.set("to", String(to))
  }
  if (includeInProgressList) qs.set("includeInProgressList", "true")
  if (includeTasks) qs.set("includeTasks", "true")
  if (includeTasks && tasksLimit) qs.set("tasksLimit", String(tasksLimit))

  const res = await fetch(`${API_BASE}/employeeReport/${encodeURIComponent(employeeId)}/performance?${qs.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
    signal,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Failed to load performance")
  return data
}

/* ---------------------- UI pieces ---------------------- */
function StatCard({ label, value, sub, icon }) {
  return (
    <div className={cn("rounded-2xl border border-gray-100 bg-gray-50/60 p-4")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        {icon ? <span className="text-gray-500">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-600">{sub}</p> : null}
    </div>
  )
}

function Badge({ tone = "gray", children }) {
  const cls =
    tone === "green"
      ? "bg-green-50 text-green-700 ring-green-600/10"
      : tone === "indigo"
      ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
      : tone === "amber"
      ? "bg-amber-50 text-amber-800 ring-amber-600/10"
      : tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-600/10"
      : "bg-gray-50 text-gray-700 ring-gray-200"
  return <span className={cn(chip, cls)}>{children}</span>
}

function MiniKpi({ label, value, tone = "gray" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl border border-gray-100 bg-gray-50/60">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  )
}

function FilterChip({ label, onRemove, tone = "indigo" }) {
  return (
    <span
      className={cn(
        chip,
        tone === "indigo" ? "bg-indigo-50 text-indigo-700 ring-indigo-600/10" : "bg-gray-50 text-gray-700 ring-gray-200"
      )}
    >
      <span className="truncate max-w-[11rem]">{label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 rounded-lg hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
          aria-label="Remove filter"
          title="Remove"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </span>
  )
}

function TasksToggle({ open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
        "text-xs font-bold text-gray-800",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
      )}
      title={open ? "Hide tasks" : "View tasks"}
      aria-label={open ? "Hide tasks" : "View tasks"}
    >
      <FiClipboard className="w-3.5 h-3.5 text-gray-600" />
      {open ? "Hide" : "Tasks"}
      {open ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
    </button>
  )
}

/* ---------------------- Export respects selected columns ---------------------- */
function colValueForExport(colKey, r) {
  if (colKey === "employee") return r.employeeName || ""
  if (colKey === "active") return r.isActive ? "Active" : "Inactive"
  if (colKey === "assigned") return safeNum(r?.taskSummary?.totalAssigned)
  if (colKey === "pending") return safeNum(r?.taskSummary?.pending)
  if (colKey === "in_progress") return safeNum(r?.taskSummary?.in_progress)
  if (colKey === "done") return safeNum(r?.taskSummary?.done)
  if (colKey === "range_done") return safeNum(r?.totals?.tasksDone)
  if (colKey === "hours") return minsToHours(r?.totals?.totalMinutes)
  if (colKey === "avg_min") return safeNum(r?.totals?.avgMinutes)
  if (colKey === "rating") return r?.performance?.label ? ratingLabelPretty(r.performance.label) : ""
  return ""
}

function exportEmployeesToExcel(rows, rangeLabel, visibleCols = []) {
  const cols =
    Array.isArray(visibleCols) && visibleCols.length
      ? visibleCols
      : ["employee", "assigned", "pending", "in_progress", "done", "rating"]
  const exportCols = cols.filter((c) => c !== "actions") // ignore "actions" in file

  const data = rows.map((r) => {
    const out = {}
    for (const c of exportCols) out[prettyColLabel(c)] = colValueForExport(c, r)
    return out
  })

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Employee Report")
  const fileName = `employee_report_${rangeLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)
}

function exportEmployeesToPdf(rows, rangeLabel, visibleCols = []) {
  const cols =
    Array.isArray(visibleCols) && visibleCols.length
      ? visibleCols
      : ["employee", "assigned", "pending", "in_progress", "done", "rating"]
  const exportCols = cols.filter((c) => c !== "actions")

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const title = "Employee Performance Report"
  const subtitle = `Range: ${rangeLabelPretty(rangeLabel)} • Generated: ${new Date().toLocaleString()}`

  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(title, 40, 36)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(subtitle, 40, 54)

  const head = [exportCols.map((c) => prettyColLabel(c))]
  const body = rows.map((r) => exportCols.map((c) => String(colValueForExport(c, r) ?? "")))

  autoTable(doc, {
    head,
    body,
    startY: 70,
    margin: { left: 40, right: 40 },
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, overflow: "linebreak", valign: "middle" },
    headStyles: { fontStyle: "bold" },
  })

  const fileName = `employee_report_${rangeLabel}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}

/* ---------------------- Tasks dropdown under row ---------------------- */
function EmployeeTaskDropdown({ employeeId, range, open, cacheKey, getCachedTasks, setCachedTasks, colSpan = 6 }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [tasks, setTasks] = useState([])
  const abortRef = useRef(null)

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort?.()
      abortRef.current = null
      setLoading(false)
      setError("")
      return
    }

    const cached = getCachedTasks?.(cacheKey)
    if (Array.isArray(cached)) {
      setTasks(cached)
      setLoading(false)
      setError("")
      return
    }

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError("")

    ;(async () => {
      try {
        const d = await apiGetEmployeePerformance({
          employeeId,
          range,
          includeTasks: true,
          tasksLimit: 80,
          includeInProgressList: false,
          signal: controller.signal,
        })
        const list = Array.isArray(d?.tasks) ? d.tasks : []
        setTasks(list)
        setCachedTasks?.(cacheKey, list)
      } catch (e) {
        if (e?.name !== "AbortError") setError(e?.message || "Failed to load tasks.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [open, employeeId, range, cacheKey, getCachedTasks, setCachedTasks])

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.tr
          key={`drop-${cacheKey}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-gray-50/40"
        >
          <td colSpan={colSpan} className="px-6 pb-4 pt-2">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="rounded-2xl border border-gray-100 bg-white shadow-[0_10px_25px_-22px_rgba(0,0,0,0.35)] overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiClipboard className="w-4 h-4 text-gray-500" />
                  <p className="text-sm font-extrabold text-gray-900">Tasks</p>
                </div>
                <Badge tone="indigo">{tasks.length}</Badge>
              </div>

              {error ? (
                <div className="p-3 text-sm text-rose-700 bg-rose-50 border-t border-rose-200 flex items-start gap-2">
                  <FiAlertCircle className="w-5 h-5 mt-0.5" />
                  <span className="font-semibold">{error}</span>
                </div>
              ) : null}

              {loading ? (
                <div className="p-5 flex items-center justify-center text-gray-600">
                  <FiLoader className="w-5 h-5 animate-spin mr-2" /> Loading tasks...
                </div>
              ) : tasks.length ? (
                <div className="divide-y divide-gray-100">
                  {tasks.map((t, idx) => {
                    const tone = statusTone(t.status)
                    const subtitles = Array.isArray(t.subtitles) ? t.subtitles : []
                    const customer = t.companyName || t.customerName || "—"
                    return (
                      <div key={`${t.title || "task"}-${idx}`} className="px-4 py-3 hover:bg-gray-50/70 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  tone === "green"
                                    ? "bg-green-500"
                                    : tone === "indigo"
                                    ? "bg-indigo-500"
                                    : tone === "amber"
                                    ? "bg-amber-500"
                                    : "bg-gray-400"
                                )}
                              />
                              <p className="text-sm font-extrabold text-gray-900 truncate">{t.title || "—"}</p>
                              <Badge tone={tone}>{statusPretty(t.status)}</Badge>
                              {t.dueAt ? <Badge tone="gray">Due {formatDate(t.dueAt)}</Badge> : null}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 truncate">{customer}</p>
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <Badge tone="indigo">{subtitles.length} subtitles</Badge>
                            <Badge tone="gray">{formatDate(t.updatedAt || t.createdAt)}</Badge>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {subtitles.slice(0, 10).map((s, sidx) => (
                            <div
                              key={`${s.text}-${sidx}`}
                              className="rounded-2xl border border-gray-100 bg-gray-50/60 px-3 py-2"
                            >
                              <p className="text-sm font-semibold text-gray-900">{s.text || "—"}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-600">Files: {safeNum(s.filesCount)}</span>
                                <span className="text-xs text-gray-600">Notes: {safeNum(s.notesCount)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-5 text-center text-gray-600">No tasks assigned.</div>
              )}
            </motion.div>
          </td>
        </motion.tr>
      ) : null}
    </AnimatePresence>
  )
}

/* ---------------------- Details modal (range lives here) ---------------------- */
function EmployeeDetailsModal({ open, onClose, employee, range, onRangeChange }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState(null)
  const [tasksOpen, setTasksOpen] = useState(true)
  const abortRef = useRef(null)

  const employeeId = employee?.employeeId

  const fetchDetails = async () => {
    if (!employeeId) return
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError("")
    try {
      const d = await apiGetEmployeePerformance({
        employeeId,
        range,
        includeInProgressList: true,
        includeTasks: true,
        tasksLimit: 120,
        signal: controller.signal,
      })
      setData(d)
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load details")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setTasksOpen(true)
    setError("")
    fetchDetails()
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employeeId, range])

  const totals = data?.totals || {}
  const taskCounts = data?.taskCounts || {}
  const perf = data?.performance || {}
  const tone = ratingTone(perf?.label)
  const tasks = Array.isArray(data?.tasks) ? data.tasks : []

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={employee?.employeeName || "Employee Report"}
      subtitle={employee?.email || ""}
      icon={<FiEye className="w-5 h-5" />}
      maxWidthClass="max-w-6xl"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="w-full sm:w-72">
            <RangeSelect value={range} onChange={onRangeChange} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={fetchDetails} className={cn(btn, btnGhost)} disabled={loading}>
              <FiRefreshCcw className={cn("w-4 h-4", loading ? "animate-spin" : "")} />
              Refresh
            </button>
            <button onClick={onClose} className={cn(btn, btnPrimary)}>
              Close
            </button>
          </div>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
          <FiAlertCircle className="w-5 h-5 mt-0.5" />
          <span className="font-semibold">{error}</span>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="py-10 flex items-center justify-center text-gray-600">
          <FiLoader className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : null}

      {data ? (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <FiLoader className="w-4 h-4 animate-spin" /> Updating…
            </div>
          ) : null}

          <div className={cn(card, "p-4 sm:p-5")}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center border",
                    "bg-gray-50 border-gray-100"
                  )}
                >
                  <FiAward className="w-6 h-6 text-gray-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base sm:text-lg font-extrabold text-gray-900 truncate">
                      Performance: {perf?.label ? ratingLabelPretty(perf.label) : "—"}
                    </p>
                    {perf?.label ? <Badge tone={tone}>{safeNum(perf.score)}/100</Badge> : <Badge>—</Badge>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Date range: <span className="font-semibold text-gray-800">{formatDate(data?.range?.from)}</span> →{" "}
                    <span className="font-semibold text-gray-800">{formatDate(data?.range?.to)}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
                <MiniKpi label="Assigned" value={safeNum(taskCounts.totalAssigned)} tone="indigo" />
                <MiniKpi label="Pending" value={safeNum(taskCounts.pending)} tone="amber" />
                <MiniKpi label="In progress" value={safeNum(taskCounts.inProgress)} tone="indigo" />
                <MiniKpi label="Done" value={safeNum(taskCounts.done)} tone="green" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Tasks done"
              value={safeNum(totals.tasksDone)}
              sub="Completed in selected range"
              icon={<FiTrendingUp className="w-4 h-4" />}
            />
            <StatCard
              label="Total hours"
              value={minsToHours(totals.totalMinutes)}
              sub={`${safeNum(totals.totalMinutes)} minutes`}
              icon={<FiClock className="w-4 h-4" />}
            />
            <StatCard
              label="Avg minutes/task"
              value={safeNum(totals.avgMinutes)}
              sub="Average effort"
              icon={<FiActivity className="w-4 h-4" />}
            />
            <StatCard
              label="Last completed"
              value={totals.lastCompletedAt ? formatDate(totals.lastCompletedAt) : "—"}
              sub="Latest finished task"
              icon={<FiList className="w-4 h-4" />}
            />
          </div>

          <div className={cn(card, "overflow-hidden")}>
            <button
              type="button"
              onClick={() => setTasksOpen((v) => !v)}
              className="w-full px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <FiClipboard className="w-4 h-4 text-gray-600" />
                <p className="text-sm font-bold text-gray-900">Assigned tasks</p>
                <Badge tone="indigo">{tasks.length}</Badge>
              </div>
              {tasksOpen ? (
                <FiChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <FiChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            <AnimatePresence initial={false}>
              {tasksOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  {tasks.length ? (
                    <div className="divide-y divide-gray-100">
                      {tasks.map((t, idx) => {
                        const tone = statusTone(t.status)
                        const subtitles = Array.isArray(t.subtitles) ? t.subtitles : []
                        return (
                          <div key={`${t.title || "task"}-${idx}`} className="px-4 py-3 hover:bg-gray-50/70 transition">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={cn(
                                      "w-2 h-2 rounded-full",
                                      tone === "green"
                                        ? "bg-green-500"
                                        : tone === "indigo"
                                        ? "bg-indigo-500"
                                        : tone === "amber"
                                        ? "bg-amber-500"
                                        : "bg-gray-400"
                                    )}
                                  />
                                  <p className="text-sm font-extrabold text-gray-900 truncate">{t.title || "—"}</p>
                                  <Badge tone={tone}>{statusPretty(t.status)}</Badge>
                                  {t.dueAt ? <Badge tone="gray">Due {formatDate(t.dueAt)}</Badge> : null}
                                </div>
                                <p className="text-xs text-gray-500 mt-1 truncate">{t.companyName || t.customerName || "—"}</p>
                              </div>

                              <div className="flex items-center gap-2 justify-end">
                                <Badge tone="indigo">{subtitles.length} subtitles</Badge>
                                <Badge tone="gray">{formatDate(t.updatedAt || t.createdAt)}</Badge>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {subtitles.slice(0, 10).map((s, sidx) => (
                                <div
                                  key={`${s.text}-${sidx}`}
                                  className="rounded-2xl border border-gray-100 bg-gray-50/60 px-3 py-2"
                                >
                                  <p className="text-sm font-semibold text-gray-900">{s.text || "—"}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-gray-600">Files: {safeNum(s.filesCount)}</span>
                                    <span className="text-xs text-gray-600">Notes: {safeNum(s.notesCount)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center text-gray-500">No tasks assigned.</div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className={cn(card, "overflow-hidden")}>
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">In progress now</p>
              <Badge tone="amber">{safeNum(data?.inProgressNow?.count)}</Badge>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white/90 backdrop-blur border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Task</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Started
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.inProgressNow?.tasks || []).map((t, idx) => (
                    <tr key={`${t.title || "t"}-${idx}`} className={subtleHover}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{t.title || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{t.companyName || t.customerName || "—"}</p>
                        <p className="text-xs text-gray-500">
                          {t.customerName && t.companyName ? t.customerName : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.startedAt ? formatDate(t.startedAt) : "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.dueAt ? formatDate(t.dueAt) : "—"}</td>
                    </tr>
                  ))}
                  {(data?.inProgressNow?.tasks || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                        No in-progress tasks right now.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </ModalShell>
  )
}

/* ---------------------- Columns modal (uses allowedColumns + defaultColumns from backend) ---------------------- */
function ColumnsModal({
  open,
  onClose,
  allowedColumns = [],
  defaultColumns = [],
  selectedColumns = [],
  onApply,
  onResetDefault,
  onShowAll,
  saving = false,
}) {
  const [draft, setDraft] = useState([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) return
    setDraft(Array.isArray(selectedColumns) ? selectedColumns : [])
    setSearch("")
  }, [open, selectedColumns])

  const allowed = useMemo(() => [...new Set(Array.isArray(allowedColumns) ? allowedColumns : [])], [allowedColumns])

  const normalizedDraft = useMemo(() => normalizeCols(draft, allowed), [draft, allowed])
  const selectedSet = useMemo(() => new Set(normalizedDraft), [normalizedDraft])

  const filteredAvailable = useMemo(() => {
    const q = String(search || "").trim().toLowerCase()
    const items = allowed
    if (!q) return items
    return items.filter((c) => prettyColLabel(c).toLowerCase().includes(q) || String(c).toLowerCase().includes(q))
  }, [allowed, search])

  const toggle = (key) => {
    setDraft((prev) => {
      const cur = Array.isArray(prev) ? prev : []
      const set = new Set(cur)
      if (set.has(key)) return cur.filter((x) => x !== key)
      return [...cur, key]
    })
  }

  const move = (idx, dir) => {
    setDraft((prev) => {
      const cur = Array.isArray(prev) ? [...prev] : []
      const next = idx + dir
      if (idx < 0 || idx >= cur.length) return cur
      if (next < 0 || next >= cur.length) return cur
      const t = cur[idx]
      cur[idx] = cur[next]
      cur[next] = t
      return cur
    })
  }

  const remove = (idx) => setDraft((prev) => (Array.isArray(prev) ? prev.filter((_, i) => i !== idx) : []))

  const footer = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onResetDefault?.()}
          className={cn(btn, btnGhost, "px-4 py-2")}
        >
          Default
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onShowAll?.()}
          className={cn(btn, btnGhost, "px-4 py-2")}
        >
          Show all
        </button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" disabled={saving} onClick={onClose} className={cn(btn, btnGhost, "px-4 py-2")}>
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onApply?.(normalizedDraft)}
          className={cn(btn, btnPrimary, "px-5 py-2 disabled:opacity-60")}
        >
          {saving ? <FiLoader className="w-4 h-4 animate-spin" /> : null}
          Apply
        </button>
      </div>
    </div>
  )

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Choose columns"
      subtitle="Select what you want to see in the table"
      icon={<FiColumns className="w-5 h-5" />}
      maxWidthClass="max-w-5xl"
      footer={footer}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-extrabold text-gray-900">Available columns</p>
            <div className="w-56">
              <div className={cn("flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2")}>
                <FiSearch className="w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredAvailable.map((c) => {
              const checked = selectedSet.has(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggle(c)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                    checked ? "border-indigo-200 bg-indigo-50/40" : "border-gray-200 bg-white hover:bg-gray-50"
                  )}
                >
                  <span
                    className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center shrink-0",
                      checked ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300"
                    )}
                  >
                    {checked ? <FiCheck className="w-3.5 h-3.5 text-white" /> : null}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{prettyColLabel(c)}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Selected: <span className="font-bold text-gray-800">{normalizedDraft.length}</span> / {allowed.length}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="mb-3">
            <p className="text-sm font-extrabold text-gray-900">Selected order</p>
            <p className="text-xs text-gray-500 mt-1">Use arrows to reorder.</p>
          </div>

          <div className="space-y-2">
            {normalizedDraft.length ? (
              normalizedDraft.map((c, idx) => (
                <div
                  key={`${c}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-extrabold text-gray-700 shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-bold text-gray-900 truncate">{prettyColLabel(c)}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      className="w-10 h-10 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center"
                      title="Move up"
                      aria-label="Move up"
                      disabled={idx === 0}
                    >
                      <FiArrowUp className={cn("w-4 h-4", idx === 0 ? "text-gray-300" : "text-gray-700")} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      className="w-10 h-10 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center"
                      title="Move down"
                      aria-label="Move down"
                      disabled={idx === normalizedDraft.length - 1}
                    >
                      <FiArrowDown
                        className={cn("w-4 h-4", idx === normalizedDraft.length - 1 ? "text-gray-300" : "text-gray-700")}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="w-10 h-10 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center"
                      title="Remove"
                      aria-label="Remove"
                    >
                      <FiX className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-6 text-center text-sm text-gray-600">
                No columns selected. Pick from the left.
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Default:{" "}
            <span className="font-semibold text-gray-700">
              {(defaultColumns || []).map((c) => prettyColLabel(c)).join(", ") || "—"}
            </span>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* ---------------------- Filters modal (UPDATED: removed Search input) ---------------------- */
function FiltersModal({ open, onClose, draftRange, setDraftRange, draftFilters, setDraftFilters, onApply }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle="Narrow down your employee list"
      icon={<FiFilter className="w-5 h-5" />}
      maxWidthClass="max-w-4xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className={cn(btn, btnGhost)}>
            Cancel
          </button>
          <button onClick={onApply} className={cn(btn, btnPrimary)}>
            Apply
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Range</p>
          <RangeSelect value={draftRange} onChange={setDraftRange} />
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Active</p>
          <div className="relative">
            <select
              value={draftFilters.active}
              onChange={(e) => setDraftFilters((p) => ({ ...p, active: e.target.value }))}
              className={cn(input, "pr-10")}
            >
              <option value="all">All</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
            <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>

        <div className="md:col-span-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sort</p>
          <div className="relative">
            <select
              value={draftFilters.sort}
              onChange={(e) => setDraftFilters((p) => ({ ...p, sort: e.target.value }))}
              className={cn(input, "pr-10")}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* ---------------------- Page ---------------------- */
export default function AdminEmployeeReportPage() {
  const PAGE_SIZE = 25

  const [range, setRange] = useState("this_month")
  const [filters, setFilters] = useState({ q: "", active: "all", sort: "newest" })

  const [draftOpen, setDraftOpen] = useState(false)
  const [draftRange, setDraftRange] = useState("this_month")
  const [draftFilters, setDraftFilters] = useState({ q: "", active: "all", sort: "newest" })

  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const [toast, setToast] = useState({ open: false, type: "success", message: "" })
  const showToast = (type, message) => {
    setToast({ open: true, type, message })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast({ open: false, type: "success", message: "" }), 2200)
  }

  const abortRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [openRowId, setOpenRowId] = useState(null)

  const tasksCacheRef = useRef(new Map())
  const cacheKeyFor = (employeeId, r) => `${String(employeeId || "")}::${String(r || "")}`
  const getCachedTasks = (key) => tasksCacheRef.current.get(key)
  const setCachedTasks = (key, tasks) => tasksCacheRef.current.set(key, tasks)

  const [exportOpen, setExportOpen] = useState(false)
  const exportWrapRef = useRef(null)

  // columns preference (updated backend)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnsSaving, setColumnsSaving] = useState(false)
  const [colPrefEtag, setColPrefEtag] = useState(null)
  const [allowedColumns, setAllowedColumns] = useState([])
  const [defaultColumns, setDefaultColumns] = useState([])
  const [selectedColumns, setSelectedColumns] = useState([])

  const visibleCols = useMemo(() => {
    // backend may include "actions"; UI already has a fixed Actions column button,
    // so we exclude it from the selectable list to avoid duplication.
    const allowedNoActions = (allowedColumns || []).filter((c) => c !== "actions")
    const clean = normalizeCols(selectedColumns, allowedNoActions)

    // make sure employee is always visible
    const withEmployee = clean.includes("employee") ? clean : ["employee", ...clean]
    return [...new Set(withEmployee)]
  }, [allowedColumns, selectedColumns])

  const tableColSpan = useMemo(() => visibleCols.length + 1, [visibleCols.length]) // + fixed Actions column

  const loadColumnsPref = async () => {
    try {
      const res = await apiGetEmployeeReportViewPreference({ key: EMP_VIEW_KEY, etag: colPrefEtag })
      if (res?.notModified) return
      if (res?.etag) setColPrefEtag(res.etag)

      const allowed = Array.isArray(res?.allowedColumns) ? res.allowedColumns : []
      const defaults = Array.isArray(res?.defaultColumns) ? res.defaultColumns : []
      const cols = Array.isArray(res?.columns) ? res.columns : []

      setAllowedColumns(allowed)
      setDefaultColumns(defaults)
      setSelectedColumns(cols)
    } catch (e) {
      showToast("error", e?.message || "Failed to load column settings.")
    }
  }

  useEffect(() => {
    loadColumnsPref()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onDoc = (e) => {
      if (!exportOpen) return
      if (!exportWrapRef.current) return
      if (!exportWrapRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [exportOpen])

  const saveColumns = async (cols) => {
    setColumnsSaving(true)
    try {
      const res = await apiSaveEmployeeReportViewPreference({ key: EMP_VIEW_KEY, columns: cols })
      if (res?.etag) setColPrefEtag(res.etag)
      setAllowedColumns(Array.isArray(res?.allowedColumns) ? res.allowedColumns : allowedColumns)
      setDefaultColumns(Array.isArray(res?.defaultColumns) ? res.defaultColumns : defaultColumns)
      setSelectedColumns(Array.isArray(res?.columns) ? res.columns : cols)
      showToast("success", "Columns updated.")
      setColumnsOpen(false)
    } catch (e) {
      showToast("error", e?.message || "Failed to save columns.")
    } finally {
      setColumnsSaving(false)
    }
  }

  const resetColumnsToDefault = async () => {
    // backend: empty array means reset
    await saveColumns([])
  }

  const showAllColumns = async () => {
    // show everything the backend allows (except actions, because UI already has Actions)
    const allowedNoActions = (allowedColumns || []).filter((c) => c !== "actions")
    await saveColumns(allowedNoActions)
  }

  const appliedFilterCount = useMemo(() => {
    return Object.entries({ range, ...filters } || {})
      .filter(([k, v]) => {
        if (k === "q") return false
        if (k === "range") return String(v) !== "this_month"
        if (k === "active") return String(v) !== "all"
        if (k === "sort") return String(v) !== "newest"
        return String(v || "").trim() && String(v) !== "all" && String(v) !== ""
      })
      .length
  }, [filters, range])

  const appliedChips = useMemo(() => {
    const chips = []
    if (String(range) !== "this_month") chips.push({ key: "range", label: `Range: ${rangeLabelPretty(range)}` })
    if (String(filters.active) !== "all")
      chips.push({ key: "active", label: `Active: ${activeLabelPretty(filters.active)}` })
    if (String(filters.sort) !== "newest") chips.push({ key: "sort", label: `Sort: ${sortLabelPretty(filters.sort)}` })
    return chips
  }, [filters.active, filters.sort, range])

  const fetchPage = async ({ reset = false, soft = false } = {}) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError("")
    if (reset) {
      setOpenRowId(null)
      if (soft && rows.length) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
        setRows([])
      }
      setNextCursor(null)
      setHasMore(false)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const list = await apiListEmployees({
        limit: PAGE_SIZE,
        cursor: reset ? null : nextCursor,
        q: filters.q,
        active: filters.active,
        sort: filters.sort,
        signal: controller.signal,
      })

      const employees = list.items || []

      const perfResults = await Promise.all(
        employees.map(async (emp) => {
          try {
            const perf = await apiGetEmployeePerformance({
              employeeId: emp._id,
              range,
              includeInProgressList: false,
              includeTasks: false,
              signal: controller.signal,
            })

            return {
              employeeId: emp._id,
              employeeName: emp.name || "—",
              email: emp.email || "",
              isActive: Boolean(emp.isActive),
              avatarUrl: emp.avatarUrl || "",
              totals: perf?.totals || { tasksDone: 0, totalMinutes: 0, avgMinutes: 0, lastCompletedAt: null },
              taskSummary: perf?.taskCounts
                ? {
                    totalAssigned: perf.taskCounts.totalAssigned ?? 0,
                    pending: perf.taskCounts.pending ?? 0,
                    in_progress: perf.taskCounts.inProgress ?? 0,
                    done: perf.taskCounts.done ?? 0,
                  }
                : { totalAssigned: 0, pending: 0, in_progress: 0, done: 0 },
              performance: perf?.performance || null,
              range: perf?.range || null,
            }
          } catch {
            return {
              employeeId: emp._id,
              employeeName: emp.name || "—",
              email: emp.email || "",
              isActive: Boolean(emp.isActive),
              avatarUrl: emp.avatarUrl || "",
              totals: { tasksDone: 0, totalMinutes: 0, avgMinutes: 0, lastCompletedAt: null },
              taskSummary: { totalAssigned: 0, pending: 0, in_progress: 0, done: 0 },
              performance: null,
              range: null,
            }
          }
        })
      )

      setRows((prev) => (reset ? perfResults : [...prev, ...perfResults]))
      setNextCursor(list.nextCursor)
      setHasMore(Boolean(list.hasMore))
    } catch (e) {
      if (e?.name !== "AbortError") setError(e?.message || "Failed to load employee report.")
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchPage({ reset: true, soft: false })
    return () => abortRef.current?.abort?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchPage({ reset: true, soft: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, JSON.stringify(filters)])

  const disableLoadMore = isLoadingMore || isLoading || isRefreshing || !hasMore

  const exportExcel = () => {
    if (!rows.length) return showToast("error", "No data to export.")
    try {
      exportEmployeesToExcel(rows, range, visibleCols)
      showToast("success", "Excel exported.")
    } catch (e) {
      showToast("error", e?.message || "Export failed.")
    }
  }

  const exportPdf = () => {
    if (!rows.length) return showToast("error", "No data to export.")
    try {
      exportEmployeesToPdf(rows, range, visibleCols)
      showToast("success", "PDF exported.")
    } catch (e) {
      showToast("error", e?.message || "PDF export failed.")
    }
  }

  const openFilters = () => {
    setDraftRange(range)
    // keep q in draft (so Apply keeps search state), but UI input removed from modal
    setDraftFilters(filters)
    setDraftOpen(true)
  }

  const applyFilters = () => {
    setOpenRowId(null)
    setRange(draftRange)
    setFilters(draftFilters)
    setDraftOpen(false)
  }

  const removeChip = (key) => {
    setOpenRowId(null)
    if (key === "range") return setRange("this_month")
    if (key === "active") return setFilters((p) => ({ ...p, active: "all" }))
    if (key === "sort") return setFilters((p) => ({ ...p, sort: "newest" }))
  }

  const toggleRow = (employeeId) => {
    setOpenRowId((cur) => (String(cur || "") === String(employeeId || "") ? null : employeeId))
  }

  const renderCell = (colKey, r, perfTone) => {
    if (colKey === "employee") {
      const isOpen = String(openRowId || "") === String(r.employeeId || "")
      return (
        <td className={tdCls}>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => toggleRow(r.employeeId)}
              className={cn(
                "flex items-center gap-3 min-w-0 text-left",
                "rounded-xl hover:bg-gray-50/70 transition px-2 py-1 -mx-2"
              )}
              title="Toggle tasks"
            >
              <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                {r.avatarUrl ? (
                  <img src={r.avatarUrl} alt={r.employeeName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-extrabold text-indigo-700">{initials(r.employeeName)}</span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-extrabold text-gray-900 truncate">{r.employeeName}</p>
                </div>
                <p className="text-xs text-gray-500 truncate">{r.email}</p>
              </div>
            </button>

            <TasksToggle open={isOpen} onClick={() => toggleRow(r.employeeId)} />
          </div>
        </td>
      )
    }

    if (colKey === "active") {
      return <td className={tdCls}>{r.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
    }

    if (colKey === "assigned") return <td className={tdNumBold}>{safeNum(r?.taskSummary?.totalAssigned)}</td>
    if (colKey === "pending") return <td className={tdNum}>{safeNum(r?.taskSummary?.pending)}</td>
    if (colKey === "in_progress") return <td className={tdNum}>{safeNum(r?.taskSummary?.in_progress)}</td>
    if (colKey === "done") return <td className={tdNum}>{safeNum(r?.taskSummary?.done)}</td>

    if (colKey === "range_done") return <td className={tdNumBold}>{safeNum(r?.totals?.tasksDone)}</td>
    if (colKey === "hours") return <td className={tdNum}>{minsToHours(r?.totals?.totalMinutes)}</td>
    if (colKey === "avg_min") return <td className={tdNum}>{safeNum(r?.totals?.avgMinutes)}</td>

    if (colKey === "rating") {
      const perf = r?.performance || {}
      return (
        <td className={cn(tdCls, "text-right")}>
          {perf?.label ? (
            <div className="inline-flex items-center justify-end gap-2">
              <Badge tone={perfTone}>{ratingLabelPretty(perf.label)}</Badge>
              <span className="text-xs font-bold text-gray-600">{safeNum(perf.score)}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-500">—</span>
          )}
        </td>
      )
    }

    return <td className={tdCls}>—</td>
  }

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
        {!!selected ? (
          <EmployeeDetailsModal
            open={!!selected}
            employee={selected}
            range={range}
            onRangeChange={(v) => setRange(v)}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </AnimatePresence>

      <FiltersModal
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        draftRange={draftRange}
        setDraftRange={setDraftRange}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        onApply={applyFilters}
      />

      <ColumnsModal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        allowedColumns={(allowedColumns || []).filter((c) => c !== "actions")}
        defaultColumns={(defaultColumns || []).filter((c) => c !== "actions")}
        selectedColumns={(selectedColumns || []).filter((c) => c !== "actions")}
        saving={columnsSaving}
        onApply={(cols) => saveColumns(cols)}
        onResetDefault={resetColumnsToDefault}
        onShowAll={showAllColumns}
      />

      <div className="p-4 sm:p-6 lg:p-8 print:hidden">
        <div className={cn(card, "p-5 sm:p-6 mb-6")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm">
                  <FiFilter className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Employee Report</h1>
                  <p className="text-sm text-gray-500">Tasks, hours, and performance</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setColumnsOpen(true)}
                  className={cn(btn, btnGhost)}
                  title="Choose columns"
                >
                  <FiColumns className="w-4 h-4" />
                  Columns
                </button>

                <div className="relative" ref={exportWrapRef}>
                  <button
                    type="button"
                    onClick={() => setExportOpen((v) => !v)}
                    disabled={isLoading || isRefreshing || rows.length === 0}
                    className={cn(btn, btnPrimary, "disabled:opacity-60")}
                    title="Export"
                  >
                    Export
                    <FiChevronDown className={cn("w-4 h-4", exportOpen ? "rotate-180 transition" : "transition")} />
                  </button>

                  <AnimatePresence>
                    {exportOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.99 }}
                        transition={{ duration: 0.14 }}
                        className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white shadow-[0_20px_45px_-25px_rgba(0,0,0,0.55)] overflow-hidden z-30"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setExportOpen(false)
                            exportPdf()
                          }}
                          className="w-full px-3.5 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <FaFilePdf className="w-4 h-4 text-rose-600" />
                            Export PDF
                          </span>
                          <span className="text-xs text-gray-500">.pdf</span>
                        </button>

                        <div className="h-px bg-gray-100" />

                        <button
                          type="button"
                          onClick={() => {
                            setExportOpen(false)
                            exportExcel()
                          }}
                          className="w-full px-3.5 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <SiMicrosoftexcel className="w-4 h-4 text-emerald-600" />
                            Export Excel
                          </span>
                          <span className="text-xs text-gray-500">.xlsx</span>
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => fetchPage({ reset: true, soft: true })}
                  className={cn(btn, btnGhost)}
                  title="Refresh"
                  disabled={isLoading || isRefreshing}
                >
                  <FiRefreshCcw className={cn("w-4 h-4", isLoading || isRefreshing ? "animate-spin" : "")} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="w-full lg:max-w-xl">
                <div className={searchWrap}>
                  <FiSearch className="w-4 h-4 text-gray-400 shrink-0" />

                  {appliedChips.map((c) => (
                    <FilterChip key={c.key} label={c.label} onRemove={() => removeChip(c.key)} />
                  ))}

                  <input
                    type="search"
                    value={filters.q}
                    onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                    placeholder="Search by name or email…"
                    className={searchInput}
                  />

                  <button
                    type="button"
                    onClick={openFilters}
                    className={cn(
                      "relative shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                      "flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                    )}
                    aria-label="Open filters"
                    title="Filters"
                  >
                    <FiFilter className="w-4 h-4 text-gray-700" />
                    {appliedFilterCount ? (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {appliedFilterCount}
                      </span>
                    ) : null}
                  </button>

                  {(filters.q || appliedFilterCount) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenRowId(null)
                        setFilters({ q: "", active: "all", sort: "newest" })
                        setRange("this_month")
                      }}
                      className={cn(
                        "shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition",
                        "flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                      )}
                      aria-label="Clear"
                      title="Clear"
                    >
                      <FiX className="w-4 h-4 text-gray-700" />
                    </button>
                  ) : null}
                </div>

                <p className="mt-2 text-xs text-gray-500">Tip: Click an employee to open tasks. Use “View” for full details.</p>
              </div>

              <div className="text-sm text-gray-600">
                Showing <span className="font-bold text-gray-900">{rows.length}</span> employee(s)
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
            <FiAlertCircle className="w-5 h-5 mt-0.5" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        ) : null}

        <div className={cn(card, "overflow-hidden")}>
          <div className="relative">
            <TableLoadingOverlay show={isRefreshing} />

            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
                  <tr>
                    <th className={thCls}>No.</th>
                    {visibleCols.map((c) => {
                      const meta = COLUMN_META[c] || {}
                      const isRight = meta.align === "right"
                      return (
                        <th key={c} className={isRight ? thClsR : thCls}>
                          {prettyColLabel(c)}
                        </th>
                      )
                    })}
                    <th className={thClsR}>Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence>
                    {isLoading && rows.length === 0 ? (
                      <>
                        {Array.from({ length: 8 }).map((_, idx) => (
                          <SkeletonRow key={`sk-${idx}`} cols={tableColSpan + 1 /* +No */} />
                        ))}
                      </>
                    ) : rows.length > 0 ? (
                      rows.map((r, index) => {
                        const perf = r?.performance || {}
                        const perfTone = ratingTone(perf?.label)
                        const isOpen = String(openRowId || "") === String(r.employeeId || "")
                        const ck = cacheKeyFor(r.employeeId, range)

                        return (
                          <Fragment key={`frag-${r.employeeId}`}>
                            <motion.tr
                              key={`row-${r.employeeId}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className={cn(subtleHover, isOpen ? "bg-indigo-50/30" : "")}
                            >
                              <td className={cn(tdCls, "text-sm text-gray-500")}>{index + 1}</td>

                              {visibleCols.map((c) => (
                                <Fragment key={`${r.employeeId}-${c}`}>{renderCell(c, r, perfTone)}</Fragment>
                              ))}

                              <td className={cn(tdCls, "text-right")}>
                                <button
                                  onClick={() => setSelected(r)}
                                  className={cn(btn, btnPrimary, "px-3 py-2")}
                                  title="View details"
                                >
                                  <FiEye className="w-4 h-4" />
                                  View
                                </button>
                              </td>
                            </motion.tr>

                            <EmployeeTaskDropdown
                              employeeId={r.employeeId}
                              range={range}
                              open={isOpen}
                              cacheKey={ck}
                              getCachedTasks={getCachedTasks}
                              setCachedTasks={setCachedTasks}
                              colSpan={tableColSpan + 1 /* +No */}
                            />
                          </Fragment>
                        )
                      })
                    ) : (
                      <tr key="empty">
                        <td colSpan={tableColSpan + 1} className="px-6 py-12 text-center text-gray-500">
                          No employees found.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center p-4 text-sm text-gray-600 border-t border-gray-100 bg-white">
            <span>
              Loaded: <span className="font-bold text-gray-900">{rows.length}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPage({ reset: true, soft: true })}
                className={cn(btn, btnGhost, "px-4 py-2")}
                disabled={isLoading || isRefreshing}
              >
                Refresh list
              </button>

              <button
                onClick={() => fetchPage({ reset: false })}
                disabled={disableLoadMore}
                className={cn(btn, btnPrimary, "px-4 py-2 disabled:opacity-60")}
                title={hasMore ? "Load next page" : "No more employees"}
              >
                {isLoadingMore ? <FiLoader className="w-4 h-4 animate-spin" /> : null}
                {hasMore ? "Load more" : "No more"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
