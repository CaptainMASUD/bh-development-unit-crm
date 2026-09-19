"use client"

import { useEffect, useMemo, useState } from "react"
import {
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiEdit3,
  FiEye,
  FiFilter,
  FiMoreVertical,
  FiPlus,
  FiRefreshCcw,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi"

export const API_BASE = `${import.meta.env.VITE_API_URL}/api`
export const PAGE_SIZE = 20

export const shell = "min-h-full bg-[#f6f7fb]"
export const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
export const buttonBase = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
export const buttonPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
export const buttonGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
export const buttonDanger = "bg-rose-600 text-white hover:bg-rose-700"
export const buttonSoft = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 hover:bg-indigo-100"
export const inputClass = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
export const textareaClass = "min-h-28 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
export const labelClass = "mb-1.5 block text-sm font-extrabold text-gray-900"

export function authHeaders() {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function manufacturingApi(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
    credentials: "include",
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || "Request failed")
  return data
}

export function getId(value) {
  return value?._id || value || ""
}

export function pretty(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatDate(value, withTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-US", withTime
    ? { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "2-digit" })
}

export function formatNumber(value, maximumFractionDigits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return "0"
  return number.toLocaleString("en-BD", { maximumFractionDigits })
}

export function formatMoney(value, currency = "BDT") {
  return `${currency} ${formatNumber(value, 2)}`
}

export function displayName(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback
  if (typeof value !== "object") return String(value)
  return value.name || value.title || value.productName || value.code || value.sku || value.number || value.email || value._id || fallback
}

export function readPath(object, path) {
  if (typeof path === "function") return path(object)
  return String(path || "").split(".").filter(Boolean).reduce((current, key) => current?.[key], object)
}

export function extractItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  const candidates = ["products", "warehouses", "suppliers", "employees", "users", "items", "records", "orders", "plans"]
  for (const key of candidates) if (Array.isArray(payload?.[key])) return payload[key]
  return []
}

export function ManufacturingPageLayout({ children, className = "" }) {
  return <div className={`${shell} -m-5 min-h-[calc(100vh)] p-4 sm:p-5 ${className}`}>{children}</div>
}

export function ManufacturingPageHeader({ eyebrow = "Manufacturing", title, subtitle, icon, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        {icon ? <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">{icon}</div> : null}
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">{eyebrow}</p>
          <h1 className="mt-1 text-xl font-black tracking-[-0.025em] text-gray-950 sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function ManufacturingButton({ children, variant = "ghost", icon, className = "", ...props }) {
  const styles = variant === "primary" ? buttonPrimary : variant === "danger" ? buttonDanger : variant === "soft" ? buttonSoft : buttonGhost
  return <button type="button" className={`${buttonBase} ${styles} ${className}`} {...props}>{icon}{children}</button>
}

export function ManufacturingStatCard({ label, value, hint, icon, tone = "indigo" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
    violet: "bg-violet-50 text-violet-700",
  }
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-[-0.03em] text-gray-950">{value}</p>
          {hint ? <p className="mt-1 text-xs font-semibold text-gray-500">{hint}</p> : null}
        </div>
        {icon ? <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tones[tone] || tones.indigo}`}>{icon}</div> : null}
      </div>
    </div>
  )
}

export function ManufacturingStatusBadge({ status }) {
  const normalized = String(status || "draft").toLowerCase()
  const style = {
    draft: "bg-gray-100 text-gray-700 ring-gray-600/10",
    inactive: "bg-gray-100 text-gray-700 ring-gray-600/10",
    pending: "bg-amber-50 text-amber-700 ring-amber-600/10",
    planned: "bg-sky-50 text-sky-700 ring-sky-600/10",
    scheduled: "bg-sky-50 text-sky-700 ring-sky-600/10",
    running: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    available: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    released: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    ready: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
    posted: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    pass: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    passed: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    fail: "bg-rose-50 text-rose-700 ring-rose-600/10",
    failed: "bg-rose-50 text-rose-700 ring-rose-600/10",
    rejected: "bg-rose-50 text-rose-700 ring-rose-600/10",
    breakdown: "bg-rose-50 text-rose-700 ring-rose-600/10",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-600/10",
    hold: "bg-amber-50 text-amber-700 ring-amber-600/10",
    quality_hold: "bg-amber-50 text-amber-700 ring-amber-600/10",
    paused: "bg-amber-50 text-amber-700 ring-amber-600/10",
    maintenance: "bg-violet-50 text-violet-700 ring-violet-600/10",
    obsolete: "bg-slate-100 text-slate-700 ring-slate-600/10",
    closed: "bg-slate-100 text-slate-700 ring-slate-600/10",
  }[normalized] || "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${style}`}>{pretty(normalized)}</span>
}

export function ManufacturingToolbar({ search, setSearch, placeholder = "Search...", status, setStatus, statusOptions = [], utilities }) {
  return (
    <div className={`${card} mb-4 p-3 sm:p-4`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10">
            <FiSearch className="h-4 w-4 shrink-0 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder:text-gray-400" />
            {search ? <button type="button" onClick={() => setSearch("")} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><FiX /></button> : null}
          </div>
          {statusOptions.length ? (
            <label className="relative min-w-[180px]">
              <FiFilter className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputClass} pl-9`}>
                <option value="">All statuses</option>
                {statusOptions.map((option) => <option key={option} value={option}>{pretty(option)}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {utilities ? <div className="flex flex-wrap items-center gap-2">{utilities}</div> : null}
      </div>
    </div>
  )
}

export function ManufacturingTable({ columns, rows, loading, emptyTitle = "No records found", emptyText = "Create a record or adjust your filters.", actions }) {
  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-black uppercase tracking-wide text-gray-500">
            <tr>{columns.map((column) => <th key={column.key || column.label} className="px-4 py-3 sm:px-5">{column.label}</th>)}{actions ? <th className="px-4 py-3 text-right sm:px-5">Actions</th> : null}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? Array.from({ length: 5 }, (_, row) => <tr key={row} className="animate-pulse">{columns.map((column) => <td key={column.key || column.label} className="px-5 py-5"><div className="h-4 w-24 rounded bg-gray-200" /></td>)}{actions ? <td className="px-5 py-5"><div className="ml-auto h-8 w-24 rounded bg-gray-200" /></td> : null}</tr>) : rows.length ? rows.map((row) => <tr key={row._id || JSON.stringify(row)} className="transition hover:bg-indigo-50/30">{columns.map((column) => {
              const value = column.render ? column.render(row) : readPath(row, column.key)
              return <td key={column.key || column.label} className={`px-4 py-4 text-sm font-semibold text-gray-700 sm:px-5 ${column.className || ""}`}>{value ?? "—"}</td>
            })}{actions ? <td className="px-4 py-3 sm:px-5">{actions(row)}</td> : null}</tr>) : <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-5 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500"><FiAlertTriangle /></div><p className="mt-3 text-sm font-extrabold text-gray-900">{emptyTitle}</p><p className="mt-1 text-sm font-semibold text-gray-500">{emptyText}</p></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ManufacturingPagination({ page, pages, total, onPage }) {
  if (!pages || pages <= 1) return total ? <p className="mt-3 text-xs font-bold text-gray-500">{formatNumber(total)} record{total === 1 ? "" : "s"}</p> : null
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-gray-500">Page {page} of {pages} · {formatNumber(total)} records</p>
      <div className="flex items-center gap-2">
        <ManufacturingButton onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} icon={<FiChevronLeft />}>Previous</ManufacturingButton>
        <ManufacturingButton onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>Next <FiChevronRight /></ManufacturingButton>
      </div>
    </div>
  )
}

export function ManufacturingModal({ open, title, subtitle, icon, children, footer, onClose, maxWidth = "max-w-4xl" }) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event) => event.key === "Escape" && onClose?.()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:p-6">
          <button aria-label="Close" type="button" className="fixed inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />
          <div className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_30px_80px_-35px_rgba(0,0,0,0.75)] ${maxWidth}`}>
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">{icon}</div>
                <div className="min-w-0"><h2 className="truncate text-base font-extrabold text-gray-900 sm:text-lg">{title}</h2>{subtitle ? <p className="truncate text-sm font-semibold text-gray-500">{subtitle}</p> : null}</div>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 transition hover:bg-gray-100" type="button"><FiX className="h-5 w-5 text-gray-700" /></button>
            </div>
            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto bg-white p-4 sm:p-5">{children}</div>
            {footer ? <div className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ManufacturingField({ title, hint, children, className = "" }) {
  return <label className={`block ${className}`}><span className={labelClass}>{title}</span>{children}{hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}</label>
}

export function ManufacturingActionButton({ label, onClick, danger = false, disabled = false, children }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition disabled:opacity-50 ${danger ? "text-rose-600 hover:bg-rose-50" : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-700"}`}>{children}</button>
}

export function DefaultRowActions({ onView, onEdit, onDelete, extra }) {
  return <div className="flex items-center justify-end gap-1"><ManufacturingActionButton label="View" onClick={onView}><FiEye /></ManufacturingActionButton>{onEdit ? <ManufacturingActionButton label="Edit" onClick={onEdit}><FiEdit3 /></ManufacturingActionButton> : null}{extra}{onDelete ? <ManufacturingActionButton label="Delete" danger onClick={onDelete}><FiTrash2 /></ManufacturingActionButton> : null}<span className="rounded-lg p-2 text-gray-300"><FiMoreVertical /></span></div>
}

export function RelationSelect({ value, onChange, endpoint, placeholder = "Select", labelKey, disabled = false }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])

  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    setLoading(true)
    manufacturingApi(endpoint, { signal: controller.signal })
      .then((data) => { if (alive) setItems(extractItems(data)) })
      .catch((error) => { if (alive && error?.name !== "AbortError") setItems([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; controller.abort() }
  }, [endpoint])

  const options = useMemo(() => items.map((item) => ({ id: getId(item), label: typeof labelKey === "function" ? labelKey(item) : labelKey ? readPath(item, labelKey) : displayName(item) })).filter((item) => item.id), [items, labelKey])
  return <select value={getId(value)} onChange={(event) => onChange(event.target.value)} disabled={disabled || loading} className={inputClass}><option value="">{loading ? "Loading..." : placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label || option.id}</option>)}</select>
}

export const ManufacturingIcons = { FiPlus, FiRefreshCcw, FiEye, FiEdit3, FiTrash2 }
