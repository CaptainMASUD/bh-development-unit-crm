/* eslint-disable react/prop-types, react-refresh/only-export-components -- route page exports tested data helpers */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { FiActivity, FiAlertCircle, FiArchive, FiDatabase, FiDownload, FiEdit2, FiEye, FiMoreHorizontal, FiPlus, FiSliders, FiTrash2, FiX } from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { InventoryButton, InventoryPageHeader, InventoryPageShell, InventorySearchToolbar } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 10
const WAREHOUSE_MANAGE_PERMISSION = PERMISSIONS?.INVENTORY_WAREHOUSE_MANAGE || "inventory-warehouse:manage"
const WAREHOUSE_DELETE_PERMISSION = PERMISSIONS?.INVENTORY_WAREHOUSE_DELETE || "inventory-warehouse:delete"
const emptyForm = { code: "", name: "", physicalLocation: "", manager: "", branch: "", stockValue: 0, status: "active" }
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"

function clean(value) { return String(value ?? "").trim() }
function relationId(value) { return clean(value?._id || value) }

export function formatWarehouseLocation(address = {}) {
  if (typeof address === "string") return clean(address) || "—"
  return [address.addressLine1, address.addressLine2, address.area, address.city, address.state, address.postalCode, address.country].map(clean).filter(Boolean).join(", ") || "—"
}

export function buildWarehousePayload(form = {}, options = {}) {
  const payload = {
    code: clean(form.code).toUpperCase(),
    name: clean(form.name),
    manager: clean(form.manager) || null,
    branch: clean(form.branch),
    status: clean(form.status || "active").toLowerCase(),
  }
  const physicalLocation = clean(form.physicalLocation)
  if (!options.editing || physicalLocation !== clean(options.originalPhysicalLocation)) {
    payload.address = { addressLine1: physicalLocation }
  }
  return payload
}

export function filterWarehouses(warehouses = [], filters = {}) {
  const query = clean(filters.query).toLowerCase()
  const status = clean(filters.status || "all").toLowerCase()
  return warehouses.filter((warehouse) => {
    const matchesStatus = status === "all" ? warehouse.status !== "archived" : warehouse.status === status
    const values = [warehouse.code, warehouse.name, formatWarehouseLocation(warehouse.address), warehouse.manager?.name, warehouse.manager?.email]
    const matchesQuery = !query || values.some((value) => clean(value).toLowerCase().includes(query))
    return matchesStatus && matchesQuery
  })
}

export function getWarehouseSummary(warehouses = [], filteredResults = warehouses.length) {
  const current = warehouses.filter((warehouse) => warehouse.status !== "archived")
  return {
    totalRecords: current.length,
    needsAttention: current.filter((warehouse) => warehouse.status === "inactive").length,
    totalValue: Math.round(current.reduce((sum, warehouse) => sum + Number(warehouse.stockValue || 0), 0) * 100) / 100,
    filteredResults,
  }
}

export function paginateWarehouses(warehouses = [], requestedPage = 1, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(warehouses.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, warehouses.length)
  return { page, totalPages, start, end, rows: warehouses.slice(start, end) }
}

function getStoredUser() { try { const stored = JSON.parse(localStorage.getItem("user") || "null"); return stored?.user || stored } catch { return null } }
function requestHeaders() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...requestHeaders(), ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || "Request failed")
  return data
}

async function fetchWarehouseSet(status = "") {
  const records = []
  const cursors = new Set()
  let cursor = ""
  do {
    const params = new URLSearchParams({ limit: "100" })
    if (status) params.set("status", status)
    if (cursor) params.set("cursor", cursor)
    const data = await api(`/inventory/warehouses?${params.toString()}`)
    records.push(...(data.warehouses || []))
    const next = data.hasMore ? clean(data.nextCursor) : ""
    if (!next || cursors.has(next)) break
    cursors.add(next)
    cursor = next
  } while (cursor)
  return records
}

function managerLabel(manager) {
  if (!manager) return "—"
  return manager.name || manager.fullName || manager.employeeName || manager.email || "—"
}

function formatMoney(value) {
  return `৳${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function downloadCsv(warehouses) {
  const escape = (value) => {
    if (value === null || value === undefined) return '""'
    if (typeof value === "number") return String(value)
    const str = String(value)
    const isPureNumber = /^[+-]?\d+(?:\.\d+)?$/.test(str.trim())
    const neutralized = (!isPureNumber && /^[=+\-@]/.test(str)) ? `'${str}` : str
    return `"${neutralized.replace(/"/g, '""')}"`
  }
  const rows = [["Code", "Warehouse", "Location", "Responsible Person", "Stock Value", "Status"], ...warehouses.map((warehouse) => [warehouse.code, warehouse.name, formatWarehouseLocation(warehouse.address), managerLabel(warehouse.manager), warehouse.stockValue || 0, warehouse.status])]
  const csv = `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\n")}`
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `warehouses-${new Date().toISOString().slice(0, 10)}.csv`
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
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape) }
  }, [onClose, open])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"><button type="button" className="fixed inset-0 cursor-default" aria-label="Close modal" onClick={onClose} /><section className={`relative my-auto w-full ${width} overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl`} role="dialog" aria-modal="true"><header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-black text-gray-950">{title}</h2>{subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}</div><button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close"><FiX className="h-5 w-5" /></button></header><div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>{footer ? <footer className="border-t border-gray-100 px-5 py-4 sm:px-6">{footer}</footer> : null}</section></div>, document.body)
}

function Field({ label, required = false, children }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-gray-600">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>{children}</label> }
function StatusBadge({ status }) { const classes = status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "archived" ? "border-gray-200 bg-gray-50 text-gray-600" : "border-amber-200 bg-amber-50 text-amber-700"; return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${classes}`}>{clean(status).replace(/\b\w/g, (letter) => letter.toUpperCase())}</span> }
function SummaryCard({ label, value, note, icon: Icon, tone }) { const tones = { indigo: "bg-indigo-50 text-indigo-600", amber: "bg-amber-50 text-amber-600", cyan: "bg-cyan-50 text-cyan-600", blue: "bg-blue-50 text-blue-600" }; return <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,.45)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-gray-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span></div><span className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600">↗ {note}</span></article> }
function Detail({ label, value }) { return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 text-sm font-bold text-gray-900">{value || "—"}</div></div> }
function ActionButton({ label, onClick, children, danger = false }) { return <button type="button" onClick={onClick} className={`rounded-lg p-2 transition ${danger ? "text-gray-400 hover:bg-rose-50 hover:text-rose-600" : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"}`} title={label} aria-label={label}>{children}</button> }

function WarehouseFormModal({ state, form, setForm, managers, error, saving, onClose, onSubmit }) {
  const editing = Boolean(state.item)
  return <Modal open={state.open} onClose={onClose} title={editing ? "Update Warehouse" : "Create Warehouse"} subtitle="Fields are designed from the Inventory & Purchase business workflow." footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={onClose} disabled={saving}>Cancel</button><button type="submit" form="warehouse-form" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} disabled={saving}>{saving ? "Saving..." : editing ? "Update Record" : "Create Record"}</button></div>}>
    {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
    <form id="warehouse-form" onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <Field label="Warehouse Code" required><input className={inputClass} value={form.code} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))} placeholder="Enter warehouse code" maxLength={50} required autoFocus /></Field>
      <Field label="Warehouse Name" required><input className={inputClass} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Enter warehouse name" maxLength={160} required /></Field>
      <Field label="Physical Location" required><input className={inputClass} value={form.physicalLocation} onChange={(event) => setForm((previous) => ({ ...previous, physicalLocation: event.target.value }))} placeholder="Enter physical location" maxLength={500} required /></Field>
      <Field label="Warehouse Manager (Optional)"><select className={inputClass} value={form.manager} onChange={(event) => setForm((previous) => ({ ...previous, manager: event.target.value }))}><option value="">Select Warehouse Manager (Optional)</option>{managers.map((manager) => <option key={manager._id} value={manager._id}>{managerLabel(manager)}</option>)}</select></Field>
      <Field label="Current Stock Value"><input className={inputClass} value={formatMoney(form.stockValue)} disabled aria-label="Current Stock Value" /></Field>
      <Field label="Status" required><select className={inputClass} value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))} required><option value="">Select Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
    </form>
  </Modal>
}

export default function WarehouseSetup() {
  const currentUser = useMemo(getStoredUser, [])
  const canManage = hasPermission(currentUser, WAREHOUSE_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, WAREHOUSE_DELETE_PERMISSION)
  const [warehouses, setWarehouses] = useState([])
  const [branches, setBranches] = useState([])
  const [managers, setManagers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [formState, setFormState] = useState({ open: false, item: null, originalPhysicalLocation: "" })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState(null)
  const [confirmState, setConfirmState] = useState({ open: false, item: null, saving: false, error: "" })

  const loadWarehouses = useCallback(async () => {
    setLoading(true)
    try {
      const [current, archived, options] = await Promise.all([fetchWarehouseSet(), fetchWarehouseSet("archived"), api("/inventory/warehouses/form-options")])
      const unique = new Map([...current, ...archived].map((warehouse) => [String(warehouse._id), warehouse]))
      setWarehouses([...unique.values()]); setBranches(options.branches || []); setManagers(options.managers || [])
    } catch (error) { toast.error(error.message || "Failed to load warehouses") } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadWarehouses() }, [loadWarehouses])
  useEffect(() => { setPage(1) }, [query, status])
  const filtered = useMemo(() => filterWarehouses(warehouses, { query, status }), [warehouses, query, status])
  const pagination = useMemo(() => paginateWarehouses(filtered, page, PAGE_SIZE), [filtered, page])
  const summary = useMemo(() => getWarehouseSummary(warehouses, filtered.length), [warehouses, filtered.length])
  const defaultBranchId = relationId(branches.find((branch) => branch.isDefault) || branches.find((branch) => branch.isMain) || branches[0])

  const closeForm = useCallback(() => { if (saving) return; setFormState({ open: false, item: null, originalPhysicalLocation: "" }); setForm(emptyForm); setFormError("") }, [saving])
  const openCreate = () => {
    if (!defaultBranchId) return toast.error("Create an active company branch before adding a warehouse.")
    setForm({ ...emptyForm, branch: defaultBranchId }); setFormError(""); setFormState({ open: true, item: null, originalPhysicalLocation: "" })
  }
  const openEdit = (warehouse) => {
    if (warehouse.status === "archived") return toast.error("Restore the archived warehouse before editing it.")
    const physicalLocation = formatWarehouseLocation(warehouse.address)
    setDetails(null)
    setForm({ code: warehouse.code || "", name: warehouse.name || "", physicalLocation: physicalLocation === "—" ? "" : physicalLocation, manager: relationId(warehouse.manager), branch: relationId(warehouse.branch) || defaultBranchId, stockValue: Number(warehouse.stockValue || 0), status: warehouse.status || "active" })
    setFormError(""); setFormState({ open: true, item: warehouse, originalPhysicalLocation: physicalLocation === "—" ? "" : physicalLocation })
  }

  const saveWarehouse = async (event) => {
    event.preventDefault()
    const payload = buildWarehousePayload(form, { editing: Boolean(formState.item), originalPhysicalLocation: formState.originalPhysicalLocation })
    if (!payload.code) return setFormError("Warehouse code is required.")
    if (!payload.name) return setFormError("Warehouse name is required.")
    if (!clean(form.physicalLocation)) return setFormError("Physical location is required.")
    if (!payload.branch) return setFormError("An active company branch is required.")
    if (!payload.status) return setFormError("Select a status.")
    setSaving(true); setFormError("")
    try {
      await api(formState.item?._id ? `/inventory/warehouses/${formState.item._id}` : "/inventory/warehouses", { method: formState.item?._id ? "PATCH" : "POST", body: JSON.stringify(payload) })
      toast.success(formState.item ? "Warehouse updated" : "Warehouse created")
      setFormState({ open: false, item: null, originalPhysicalLocation: "" }); setForm(emptyForm); setQuery(""); setStatus("all"); setPage(1)
      await loadWarehouses()
    } catch (error) { setFormError(error.message || "Failed to save warehouse.") } finally { setSaving(false) }
  }

  const closeConfirm = useCallback(() => { if (confirmState.saving) return; setConfirmState({ open: false, item: null, saving: false, error: "" }) }, [confirmState.saving])
  const confirmWarehouseAction = async () => {
    const warehouse = confirmState.item
    if (!warehouse?._id) return
    setConfirmState((previous) => ({ ...previous, saving: true, error: "" }))
    try {
      if (warehouse.status === "archived") { await api(`/inventory/warehouses/${warehouse._id}/restore`, { method: "PATCH" }); toast.success("Warehouse restored as inactive"); setStatus("inactive") }
      else { await api(`/inventory/warehouses/${warehouse._id}`, { method: "DELETE" }); toast.success("Warehouse archived") }
      setConfirmState({ open: false, item: null, saving: false, error: "" }); await loadWarehouses()
    } catch (error) { setConfirmState((previous) => ({ ...previous, saving: false, error: error.message || "Action failed" })) }
  }

  const showingStart = filtered.length ? pagination.start + 1 : 0
  return <InventoryPageShell>
    <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
    <InventoryPageHeader title="Warehouses" description="Manage company stores and monitor warehouse-wise stock value and capacity." actions={canManage ? <InventoryButton type="button" variant="primary" icon={FiPlus} onClick={openCreate}>Add New</InventoryButton> : null}>
      <InventorySearchToolbar value={query} onChange={setQuery} placeholder="Search warehouses..." ariaLabel="Search warehouses" onClear={() => setQuery("")} filterCount={status === "all" ? 0 : 1} filterControls={<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter warehouse status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select>} utilities={<InventoryButton type="button" icon={FiDownload} onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>Export CSV</InventoryButton>} />
    </InventoryPageHeader>
    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total Records" value={summary.totalRecords} note="current records" icon={FiDatabase} tone="indigo" /><SummaryCard label="Needs Attention" value={summary.needsAttention} note={summary.needsAttention ? "inactive records" : "all clear"} icon={FiAlertCircle} tone="amber" /><SummaryCard label="Total Value" value={formatMoney(summary.totalValue)} note="current view basis" icon={FiActivity} tone="cyan" /><SummaryCard label="Filtered Results" value={summary.filteredResults} note={status === "archived" ? "archived records" : "all records"} icon={FiSliders} tone="blue" /></section>
    {!canManage ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">You have view-only warehouse access. Management actions are hidden.</div> : null}
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr>{["Code", "Warehouse", "Location", "Responsible Person", "Stock Value", "Status"].map((label) => <th key={label} className="px-4 py-3 sm:px-5">{label}</th>)}<th className="px-4 py-3 text-right sm:px-5">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? Array.from({ length: 4 }, (_, index) => <tr key={index} className="animate-pulse">{Array.from({ length: 7 }, (_, cell) => <td key={cell} className="px-5 py-5"><div className="h-4 w-20 rounded bg-gray-200" /></td>)}</tr>) : pagination.rows.length ? pagination.rows.map((warehouse) => <tr key={warehouse._id} className="transition hover:bg-indigo-50/30"><td className="px-4 py-4 text-sm font-semibold text-gray-700 sm:px-5">{warehouse.code}</td><td className="px-4 py-4 text-sm font-semibold text-gray-800 sm:px-5">{warehouse.name}</td><td className="px-4 py-4 text-sm font-medium text-gray-700 sm:px-5">{formatWarehouseLocation(warehouse.address)}</td><td className="px-4 py-4 text-sm font-medium text-gray-700 sm:px-5">{managerLabel(warehouse.manager)}</td><td className="px-4 py-4 text-sm font-bold text-gray-800 sm:px-5">{formatMoney(warehouse.stockValue)}</td><td className="px-4 py-4 sm:px-5"><StatusBadge status={warehouse.status} /></td><td className="px-4 py-3 sm:px-5"><div className="flex items-center justify-end gap-1"><ActionButton label="View" onClick={() => setDetails(warehouse)}><FiEye /></ActionButton>{canManage && warehouse.status !== "archived" ? <ActionButton label="Edit" onClick={() => openEdit(warehouse)}><FiEdit2 /></ActionButton> : null}{canDelete ? <ActionButton label={warehouse.status === "archived" ? "Restore" : "Archive"} danger={warehouse.status !== "archived"} onClick={() => setConfirmState({ open: true, item: warehouse, saving: false, error: "" })}>{warehouse.status === "archived" ? <FiArchive /> : <FiTrash2 />}</ActionButton> : null}<span className="rounded-lg p-2 text-gray-300"><FiMoreHorizontal /></span></div></td></tr>) : <tr><td colSpan={7} className="px-5 py-16 text-center"><p className="text-sm font-bold text-gray-900">No warehouses found</p><p className="mt-1 text-sm text-gray-500">Create a warehouse or adjust the current filters.</p></td></tr>}</tbody></table></div>
      <footer className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs font-medium text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p>Showing {showingStart}-{pagination.end} of {filtered.length} records</p><div className="flex items-center justify-end gap-2"><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-indigo-500 bg-indigo-50 px-3 font-black text-indigo-700">{pagination.page}</span><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>Next</button></div></footer>
    </section>
    <WarehouseFormModal state={formState} form={form} setForm={setForm} managers={managers} error={formError} saving={saving} onClose={closeForm} onSubmit={saveWarehouse} />
    <Modal open={Boolean(details)} onClose={() => setDetails(null)} title="Warehouse Details" subtitle="Company store and stock-value record" width="max-w-2xl" footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={() => setDetails(null)}>Close</button>{details && canManage && details.status !== "archived" ? <button type="button" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} onClick={() => openEdit(details)}><FiEdit2 /> Edit</button> : null}</div>}>{details ? <div className="grid gap-4 sm:grid-cols-2"><Detail label="Code" value={details.code} /><Detail label="Warehouse" value={details.name} /><Detail label="Physical Location" value={formatWarehouseLocation(details.address)} /><Detail label="Responsible Person" value={managerLabel(details.manager)} /><Detail label="Current Stock Value" value={formatMoney(details.stockValue)} /><Detail label="Status" value={<StatusBadge status={details.status} />} /><Detail label="Branch" value={details.branch?.name || details.branch?.code || "—"} /><Detail label="Last Updated" value={formatDate(details.updatedAt)} /></div> : null}</Modal>
    <Modal open={confirmState.open} onClose={closeConfirm} title={confirmState.item?.status === "archived" ? "Restore Warehouse" : "Archive Warehouse"} subtitle={confirmState.item?.name || ""} width="max-w-lg" footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={closeConfirm} disabled={confirmState.saving}>Cancel</button><button type="button" className={`${buttonClass} ${confirmState.item?.status === "archived" ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700" : "border-rose-600 bg-rose-600 text-white hover:bg-rose-700"}`} onClick={confirmWarehouseAction} disabled={confirmState.saving}>{confirmState.saving ? "Processing..." : confirmState.item?.status === "archived" ? "Restore" : "Archive"}</button></div>}>{confirmState.error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{confirmState.error}</div> : null}<p className="text-sm font-medium leading-6 text-gray-700">{confirmState.item?.status === "archived" ? "This warehouse will return as inactive so it can be reviewed before activation." : "The server will archive this warehouse only when no protected stock or location relationships prevent it."}</p></Modal>
  </InventoryPageShell>
}
