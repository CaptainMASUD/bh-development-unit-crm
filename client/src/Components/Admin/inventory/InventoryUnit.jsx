/* eslint-disable react/prop-types, react-refresh/only-export-components -- route page exports small tested data helpers */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import {
  FiActivity,
  FiAlertCircle,
  FiArchive,
  FiDatabase,
  FiDownload,
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiPlus,
  FiSliders,
  FiTrash2,
  FiX,
} from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { InventoryButton, InventoryPageHeader, InventoryPageShell, InventorySearchToolbar } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 10
const UNIT_MANAGE_PERMISSION = PERMISSIONS?.INVENTORY_UNIT_MANAGE || "inventory-unit:manage"
const UNIT_DELETE_PERMISSION = PERMISSIONS?.INVENTORY_UNIT_DELETE || "inventory-unit:delete"

const UNIT_TYPES = [
  ["count", "Count"],
  ["weight", "Weight"],
  ["volume", "Volume"],
  ["length", "Length"],
  ["area", "Area"],
  ["time", "Time"],
  ["other", "Other"],
]

const emptyForm = { name: "", shortName: "", code: "", unitType: "", allowDecimal: "", status: "" }
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"

function clean(value) {
  return String(value ?? "").trim()
}

export function buildUnitPayload(form = {}) {
  const shortName = clean(form.shortName).toUpperCase()
  const allowDecimal = form.allowDecimal === true || String(form.allowDecimal).toLowerCase() === "true"
  const payload = {
    name: clean(form.name),
    symbol: shortName,
    unitType: clean(form.unitType || "count").toLowerCase(),
    allowDecimal,
    decimalPlaces: allowDecimal ? 2 : 0,
    status: clean(form.status || "active").toLowerCase(),
  }
  if (clean(form.code)) payload.code = clean(form.code).toUpperCase()
  return payload
}

export function filterUnits(units = [], filters = {}) {
  const query = clean(filters.query).toLowerCase()
  const status = clean(filters.status || "all").toLowerCase()
  return units.filter((unit) => {
    const matchesStatus = status === "all" ? unit.status !== "archived" : unit.status === status
    const matchesQuery = !query || [unit.name, unit.symbol, unit.code].some((value) => clean(value).toLowerCase().includes(query))
    return matchesStatus && matchesQuery
  })
}

export function getUnitSummary(units = [], filteredResults = units.length) {
  const currentUnits = units.filter((unit) => unit.status !== "archived")
  return {
    totalRecords: currentUnits.length,
    needsAttention: currentUnits.filter((unit) => unit.status === "inactive").length,
    totalVolume: currentUnits.length,
    filteredResults,
  }
}

export function paginateUnits(units = [], requestedPage = 1, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(units.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, units.length)
  return { page, totalPages, start, end, rows: units.slice(start, end) }
}

function getStoredUser() {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null")
    return stored?.user || stored
  } catch {
    return null
  }
}

function requestHeaders() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...requestHeaders(), ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || "Request failed")
  return data
}

async function fetchUnitSet(status = "") {
  const records = []
  const seenCursors = new Set()
  let cursor = ""
  do {
    const params = new URLSearchParams({ limit: "100" })
    if (status) params.set("status", status)
    if (cursor) params.set("cursor", cursor)
    const data = await api(`/inventory/units?${params.toString()}`)
    records.push(...(data.units || []))
    const nextCursor = data.hasMore ? clean(data.nextCursor) : ""
    if (!nextCursor || seenCursors.has(nextCursor)) break
    seenCursors.add(nextCursor)
    cursor = nextCursor
  } while (cursor)
  return records
}

function pretty(value) {
  return clean(value || "—").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function downloadCsv(units) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
  const rows = [
    ["Unit Name", "Short Name", "Type", "Allow Decimal", "Status"],
    ...units.map((unit) => [unit.name, unit.symbol || unit.code, pretty(unit.unitType), unit.allowDecimal ? "Yes" : "No", pretty(unit.status)]),
  ]
  const csv = `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\n")}`
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `units-of-measure-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function Modal({ open, title, subtitle, onClose, children, footer, width = "max-w-3xl" }) {
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const closeOnEscape = (event) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [onClose, open])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <button type="button" className="fixed inset-0 cursor-default" aria-label="Close modal" onClick={onClose} />
      <section className={`relative my-auto w-full ${width} overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl`} role="dialog" aria-modal="true">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
          <div><h2 className="text-lg font-black text-gray-950">{title}</h2>{subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}</div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close"><FiX className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="border-t border-gray-100 px-5 py-4 sm:px-6">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  )
}

function Field({ label, required = false, children }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-gray-600">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>{children}</label>
}

function StatusBadge({ status }) {
  const classes = status === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "inactive"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-gray-200 bg-gray-50 text-gray-600"
  return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${classes}`}>{pretty(status)}</span>
}

function SummaryCard({ label, value, note, icon: Icon, tone }) {
  const tones = { indigo: "bg-indigo-50 text-indigo-600", amber: "bg-amber-50 text-amber-600", cyan: "bg-cyan-50 text-cyan-600", blue: "bg-blue-50 text-blue-600" }
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,.45)]">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold text-gray-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</p></div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
      <span className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600">↗ {note}</span>
    </article>
  )
}

function UnitFormModal({ state, form, setForm, error, saving, onClose, onSubmit }) {
  const editing = Boolean(state.item)
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? "Update Units of Measure" : "Create Units of Measure"}
      subtitle="Fields are designed from the Inventory & Purchase business workflow."
      footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={onClose} disabled={saving}>Cancel</button><button type="submit" form="unit-form" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} disabled={saving}>{saving ? "Saving..." : editing ? "Update Record" : "Create Record"}</button></div>}
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <form id="unit-form" onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
        <Field label="Unit Name" required><input className={inputClass} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Enter unit name" maxLength={100} required autoFocus /></Field>
        <Field label="Short Name" required><input className={inputClass} value={form.shortName} onChange={(event) => setForm((previous) => ({ ...previous, shortName: event.target.value.toUpperCase() }))} placeholder="Enter short name" maxLength={20} required /></Field>
        <Field label="Unit Code"><input className={inputClass} value={form.code || ""} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))} placeholder="Generated in Auto mode; enter a code in Manual mode" maxLength={50} disabled={Boolean(state.item)} /></Field>
        <Field label="Type" required><select className={inputClass} value={form.unitType} onChange={(event) => setForm((previous) => ({ ...previous, unitType: event.target.value }))} required><option value="">Select Type</option>{UNIT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Allow Decimal" required><select className={inputClass} value={form.allowDecimal} onChange={(event) => setForm((previous) => ({ ...previous, allowDecimal: event.target.value }))} required><option value="">Select Allow Decimal</option><option value="true">Yes</option><option value="false">No</option></select></Field>
        <Field label="Status" required><select className={inputClass} value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))} required><option value="">Select Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
      </form>
    </Modal>
  )
}

function Detail({ label, value }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 text-sm font-bold text-gray-900">{value || "—"}</div></div>
}

function UnitDetailsModal({ unit, onClose, onEdit, canManage }) {
  return (
    <Modal
      open={Boolean(unit)}
      onClose={onClose}
      title="Unit Details"
      subtitle="Inventory unit of measure"
      width="max-w-2xl"
      footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={onClose}>Close</button>{unit && canManage && unit.status !== "archived" ? <button type="button" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} onClick={() => onEdit(unit)}><FiEdit2 /> Edit</button> : null}</div>}
    >
      {unit ? <div className="grid gap-4 sm:grid-cols-2"><Detail label="Unit Name" value={unit.name} /><Detail label="Short Name" value={unit.symbol || unit.code} /><Detail label="Type" value={pretty(unit.unitType)} /><Detail label="Allow Decimal" value={unit.allowDecimal ? "Yes — 2 places" : "No"} /><Detail label="Status" value={<StatusBadge status={unit.status} />} /><Detail label="Last Updated" value={formatDate(unit.updatedAt)} /></div> : null}
    </Modal>
  )
}

function ActionButton({ label, onClick, children, danger = false }) {
  return <button type="button" onClick={onClick} className={`rounded-lg p-2 transition ${danger ? "text-gray-400 hover:bg-rose-50 hover:text-rose-600" : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"}`} title={label} aria-label={label}>{children}</button>
}

export default function InventoryUnitSetup() {
  const currentUser = useMemo(getStoredUser, [])
  const canManage = hasPermission(currentUser, UNIT_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, UNIT_DELETE_PERMISSION)
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [formState, setFormState] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState(null)
  const [confirmState, setConfirmState] = useState({ open: false, item: null, saving: false, error: "" })

  const loadUnits = useCallback(async () => {
    setLoading(true)
    try {
      const [current, archived] = await Promise.all([fetchUnitSet(), fetchUnitSet("archived")])
      const unique = new Map([...current, ...archived].map((unit) => [String(unit._id), unit]))
      setUnits([...unique.values()])
    } catch (error) {
      toast.error(error.message || "Failed to load units of measure")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUnits() }, [loadUnits])
  useEffect(() => { setPage(1) }, [query, status])

  const filteredUnits = useMemo(() => filterUnits(units, { query, status }), [units, query, status])
  const pagination = useMemo(() => paginateUnits(filteredUnits, page, PAGE_SIZE), [filteredUnits, page])
  const summary = useMemo(() => getUnitSummary(units, filteredUnits.length), [units, filteredUnits.length])

  const closeForm = useCallback(() => {
    if (saving) return
    setFormState({ open: false, item: null })
    setForm(emptyForm)
    setFormError("")
  }, [saving])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError("")
    setFormState({ open: true, item: null })
  }

  const openEdit = (unit) => {
    setDetails(null)
    setForm({
      name: unit.name || "",
      shortName: unit.symbol || unit.code || "",
      code: unit.code || "",
      unitType: unit.unitType || "",
      allowDecimal: String(Boolean(unit.allowDecimal)),
      status: unit.status || "",
    })
    setFormError("")
    setFormState({ open: true, item: unit })
  }

  const saveUnit = async (event) => {
    event.preventDefault()
    if (!clean(form.name)) return setFormError("Unit name is required.")
    if (!clean(form.shortName)) return setFormError("Short name is required.")
    if (!UNIT_TYPES.some(([value]) => value === form.unitType)) return setFormError("Select a valid unit type.")
    if (!['true', 'false'].includes(String(form.allowDecimal))) return setFormError("Select whether decimal quantities are allowed.")
    if (!['active', 'inactive'].includes(form.status)) return setFormError("Select a valid status.")
    const payload = buildUnitPayload(form)
    setSaving(true)
    setFormError("")
    try {
      await api(formState.item?._id ? `/inventory/units/${formState.item._id}` : "/inventory/units", {
        method: formState.item?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })
      toast.success(formState.item ? "Unit updated" : "Unit created")
      setFormState({ open: false, item: null })
      setForm(emptyForm)
      setQuery("")
      setStatus("all")
      setPage(1)
      await loadUnits()
    } catch (error) {
      setFormError(error.message || "Failed to save unit.")
    } finally {
      setSaving(false)
    }
  }

  const closeConfirm = useCallback(() => {
    if (confirmState.saving) return
    setConfirmState({ open: false, item: null, saving: false, error: "" })
  }, [confirmState.saving])

  const confirmUnitAction = async () => {
    const unit = confirmState.item
    if (!unit?._id) return
    setConfirmState((previous) => ({ ...previous, saving: true, error: "" }))
    try {
      if (unit.status === "archived") {
        await api(`/inventory/units/${unit._id}/restore`, { method: "PATCH" })
        toast.success("Unit restored as inactive")
        setStatus("inactive")
      } else {
        await api(`/inventory/units/${unit._id}`, { method: "DELETE" })
        toast.success("Unit archived")
      }
      setConfirmState({ open: false, item: null, saving: false, error: "" })
      await loadUnits()
    } catch (error) {
      setConfirmState((previous) => ({ ...previous, saving: false, error: error.message || "Action failed" }))
    }
  }

  const showingStart = filteredUnits.length ? pagination.start + 1 : 0

  return (
    <InventoryPageShell>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
      <InventoryPageHeader title="Units of Measure" description="Define the measurement units used in inventory and purchasing." actions={canManage ? <InventoryButton type="button" variant="primary" icon={FiPlus} onClick={openCreate}>Add New</InventoryButton> : null}>
        <InventorySearchToolbar value={query} onChange={setQuery} placeholder="Search units of measure..." ariaLabel="Search units of measure" onClear={() => setQuery("")} filterCount={status === "all" ? 0 : 1} filterControls={<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter unit status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select>} utilities={<InventoryButton type="button" icon={FiDownload} onClick={() => downloadCsv(filteredUnits)} disabled={!filteredUnits.length}>Export CSV</InventoryButton>} />
      </InventoryPageHeader>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Records" value={summary.totalRecords} note="current records" icon={FiDatabase} tone="indigo" />
        <SummaryCard label="Needs Attention" value={summary.needsAttention} note={summary.needsAttention ? "inactive records" : "all clear"} icon={FiAlertCircle} tone="amber" />
        <SummaryCard label="Total Quantity / Volume" value={summary.totalVolume} note="current view basis" icon={FiActivity} tone="cyan" />
        <SummaryCard label="Filtered Results" value={summary.filteredResults} note={status === "archived" ? "archived records" : "matching records"} icon={FiSliders} tone="blue" />
      </section>

      {!canManage ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">You have view-only unit access. Management actions are hidden.</div> : null}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 sm:px-5">Unit Name</th><th className="px-4 py-3 sm:px-5">Short Name</th><th className="px-4 py-3 sm:px-5">Type</th><th className="px-4 py-3 sm:px-5">Allow Decimal</th><th className="px-4 py-3 sm:px-5">Status</th><th className="px-4 py-3 text-right sm:px-5">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="animate-pulse"><td className="px-5 py-5"><div className="h-4 w-32 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="h-4 w-16 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="h-4 w-20 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="h-4 w-10 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="h-6 w-16 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="ml-auto h-7 w-28 rounded bg-gray-200" /></td></tr>) : pagination.rows.length ? pagination.rows.map((unit) => (
                <tr key={unit._id} className="transition hover:bg-indigo-50/30">
                  <td className="px-4 py-4 text-sm font-semibold text-gray-800 sm:px-5">{unit.name}</td><td className="px-4 py-4 text-sm font-semibold text-gray-700 sm:px-5">{unit.symbol || unit.code}</td><td className="px-4 py-4 text-sm font-medium text-gray-700 sm:px-5">{pretty(unit.unitType)}</td><td className="px-4 py-4 text-sm font-medium text-gray-700 sm:px-5">{unit.allowDecimal ? "Yes" : "No"}</td><td className="px-4 py-4 sm:px-5"><StatusBadge status={unit.status} /></td>
                  <td className="px-4 py-3 sm:px-5"><div className="flex items-center justify-end gap-1"><ActionButton label="View" onClick={() => setDetails(unit)}><FiEye /></ActionButton>{canManage && unit.status !== "archived" ? <ActionButton label="Edit" onClick={() => openEdit(unit)}><FiEdit2 /></ActionButton> : null}{canDelete ? <ActionButton label={unit.status === "archived" ? "Restore" : "Archive"} danger={unit.status !== "archived"} onClick={() => setConfirmState({ open: true, item: unit, saving: false, error: "" })}>{unit.status === "archived" ? <FiArchive /> : <FiTrash2 />}</ActionButton> : null}<span className="rounded-lg p-2 text-gray-300"><FiMoreHorizontal /></span></div></td>
                </tr>
              )) : <tr><td colSpan={6} className="px-5 py-16 text-center"><p className="text-sm font-bold text-gray-900">No units of measure found</p><p className="mt-1 text-sm text-gray-500">Create a unit or adjust the current filters.</p></td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs font-medium text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p>Showing {showingStart}-{pagination.end} of {filteredUnits.length} records</p><div className="flex items-center justify-end gap-2"><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-indigo-500 bg-indigo-50 px-3 font-black text-indigo-700">{pagination.page}</span><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>Next</button></div></footer>
      </section>

      <UnitFormModal state={formState} form={form} setForm={setForm} error={formError} saving={saving} onClose={closeForm} onSubmit={saveUnit} />
      <UnitDetailsModal unit={details} onClose={() => setDetails(null)} onEdit={openEdit} canManage={canManage} />
      <Modal
        open={confirmState.open}
        onClose={closeConfirm}
        title={confirmState.item?.status === "archived" ? "Restore Unit" : "Archive Unit"}
        subtitle={confirmState.item?.name || ""}
        width="max-w-lg"
        footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={closeConfirm} disabled={confirmState.saving}>Cancel</button><button type="button" className={`${buttonClass} ${confirmState.item?.status === "archived" ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700" : "border-rose-600 bg-rose-600 text-white hover:bg-rose-700"}`} onClick={confirmUnitAction} disabled={confirmState.saving}>{confirmState.saving ? "Processing..." : confirmState.item?.status === "archived" ? "Restore" : "Archive"}</button></div>}
      >
        {confirmState.error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{confirmState.error}</div> : null}
        <p className="text-sm font-medium leading-6 text-gray-700">{confirmState.item?.status === "archived" ? "This unit will return as inactive so it can be reviewed before activation." : "This unit will be archived. Units assigned to active products remain protected by the server’s inventory rules."}</p>
      </Modal>
    </InventoryPageShell>
  )
}
