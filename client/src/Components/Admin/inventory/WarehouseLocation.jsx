/* eslint-disable react/prop-types, react-refresh/only-export-components -- route page exports tested helpers */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { FiActivity, FiDatabase, FiDownload, FiEdit2, FiEye, FiSliders, FiTrash2, FiX } from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { InventoryButton, InventoryPageHeader, InventoryPageShell, InventorySearchToolbar } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 10
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-gray-50"
const emptyForm = { warehouse: "", name: "", code: "", locationType: "bin", parent: "", barcode: "", capacityQuantity: 0, sortOrder: 0, status: "active", isReceivable: false, isPickable: true, isDispatchable: false, isQuarantine: false }

function clean(value) { return String(value ?? "").trim() }
function relationId(value) { return clean(value?._id || value) }
function number(value) { return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 6 }) }

export function getWarehouseLocationSummary(rows = [], filteredResults = rows.length) {
  return {
    totalRecords: rows.length,
    needsAttention: rows.filter((row) => row.availabilityStatus !== "available").length,
    totalQuantity: Math.round(rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0) * 1e6) / 1e6,
    filteredResults,
  }
}

export function buildWarehouseLocationTabs(warehouses = [], rows = []) {
  return [{ id: "all", name: "All Warehouses", count: rows.length }, ...warehouses.map((warehouse) => ({ id: relationId(warehouse), name: warehouse.name || warehouse.code || "Warehouse", count: rows.filter((row) => relationId(row.warehouse) === relationId(warehouse)).length }))]
}

export function filterWarehouseLocations(rows = [], filters = {}) {
  const query = clean(filters.query).toLowerCase(), warehouse = clean(filters.warehouse || "all"), status = clean(filters.status || "all")
  return rows.filter((row) => {
    if (warehouse !== "all" && relationId(row.warehouse) !== warehouse) return false
    if (status !== "all" && row.availabilityStatus !== status) return false
    const values = [row.warehouse?.name, row.warehouse?.code, row.name, row.code, row.zone, row.rack, row.shelf, row.currentProduct?.name, row.currentProduct?.sku]
    return !query || values.some((value) => clean(value).toLowerCase().includes(query))
  })
}

export function paginateWarehouseLocations(rows = [], requestedPage = 1, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)), page = Math.min(Math.max(1, requestedPage), totalPages), start = (page - 1) * pageSize, end = Math.min(start + pageSize, rows.length)
  return { page, totalPages, start, end, rows: rows.slice(start, end) }
}

function getStoredUser() { try { const stored = JSON.parse(localStorage.getItem("user") || "null"); return stored?.user || stored } catch { return null } }
function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) { const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.error || "Request failed"); return data }

async function fetchAll(path, key) {
  const rows = [], seen = new Set(); let cursor = ""
  do {
    const separator = path.includes("?") ? "&" : "?", requestPath = `${path}${separator}limit=150${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
    const data = await api(requestPath); rows.push(...(data[key] || []))
    const next = data.hasMore ? clean(data.nextCursor) : ""; if (!next || seen.has(next)) break; seen.add(next); cursor = next
  } while (cursor)
  return rows
}

function downloadCsv(rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
  const data = [["Warehouse", "Location Code", "Zone", "Rack", "Shelf", "Current Product", "Quantity", "Status"], ...rows.map((row) => [row.warehouse?.name, row.code, row.zone, row.rack, row.shelf, row.currentProduct?.name || "—", row.quantity, statusLabel(row.availabilityStatus)])]
  const url = URL.createObjectURL(new Blob([`\uFEFF${data.map((row) => row.map(escape).join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a"); link.href = url; link.download = `warehouse-locations-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
}

function statusLabel(status) { return clean(status || "unavailable").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function StatusBadge({ status }) {
  const styles = { available: "border-emerald-200 bg-emerald-50 text-emerald-700", insufficient: "border-amber-200 bg-amber-50 text-amber-700", unavailable: "border-rose-200 bg-rose-50 text-rose-700" }
  return <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${styles[status] || styles.unavailable}`}>{statusLabel(status)}</span>
}

function SummaryCard({ label, value, note, icon: Icon, tone }) {
  const tones = { indigo: "bg-indigo-50 text-indigo-600", amber: "bg-amber-50 text-amber-600", cyan: "bg-cyan-50 text-cyan-600", blue: "bg-blue-50 text-blue-600" }
  return <article className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_30px_-28px_rgba(15,23,42,.55)]"><span className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon /></span><p className="text-xs font-semibold text-gray-600">{label}</p><p className="mt-2 text-2xl font-black text-gray-950">{value}</p><span className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">↗ {note}</span></article>
}

function Modal({ open, title, subtitle, onClose, children, footer, width = "max-w-3xl" }) {
  useEffect(() => { if (!open) return undefined; const before = document.body.style.overflow; document.body.style.overflow = "hidden"; const escape = (event) => event.key === "Escape" && onClose(); window.addEventListener("keydown", escape); return () => { document.body.style.overflow = before; window.removeEventListener("keydown", escape) } }, [onClose, open])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto"><button type="button" aria-label="Close modal" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} /><div className="relative flex min-h-full items-center justify-center p-4"><div role="dialog" aria-modal="true" className={`relative w-full ${width} overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl`}><header className="flex items-start justify-between border-b border-gray-200 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-black text-gray-950">{title}</h2>{subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}</div><button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100" aria-label="Close"><FiX /></button></header><div className="max-h-[70vh] overflow-y-auto p-5 sm:p-6">{children}</div>{footer ? <footer className="border-t border-gray-200 px-5 py-4 sm:px-6">{footer}</footer> : null}</div></div></div>, document.body)
}

function Field({ label, children }) { return <label className="text-sm font-bold text-gray-600">{label}<span className="mt-2 block">{children}</span></label> }
function Detail({ label, value }) { return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 text-sm font-bold text-gray-800">{value || "—"}</div></div> }

export default function WarehouseLocationSetup() {
  const [locations, setLocations] = useState([]), [warehouses, setWarehouses] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("")
  const [query, setQuery] = useState(""), [warehouse, setWarehouse] = useState("all"), [status, setStatus] = useState("all"), [page, setPage] = useState(1)
  const [details, setDetails] = useState(null), [modal, setModal] = useState({ open: false, item: null, saving: false, error: "" }), [form, setForm] = useState(emptyForm), [parents, setParents] = useState([])
  const user = useMemo(getStoredUser, []), canManage = hasPermission(user, PERMISSIONS.INVENTORY_LOCATION_MANAGE), canDelete = hasPermission(user, PERMISSIONS.INVENTORY_LOCATION_DELETE)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [locationRows, warehouseRows] = await Promise.all([fetchAll("/inventory/warehouse-locations", "locations"), fetchAll("/inventory/warehouses", "warehouses")])
      setLocations(locationRows); setWarehouses(warehouseRows.filter((item) => item.status === "active"))
    } catch (requestError) { setError(requestError.message || "Unable to load warehouse locations") } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => filterWarehouseLocations(locations, { query, warehouse, status }), [locations, query, status, warehouse])
  const summary = useMemo(() => getWarehouseLocationSummary(locations, filtered.length), [filtered.length, locations])
  const tabs = useMemo(() => buildWarehouseLocationTabs(warehouses, locations), [locations, warehouses])
  const pagination = useMemo(() => paginateWarehouseLocations(filtered, page), [filtered, page])
  useEffect(() => { setPage(1) }, [query, status, warehouse])
  useEffect(() => { if (pagination.page !== page) setPage(pagination.page) }, [page, pagination.page])

  const loadParents = async (warehouseId, excludeId = "") => { if (!warehouseId) return setParents([]); try { const data = await api(`/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(warehouseId)}&limit=200`); setParents((data.locations || []).filter((item) => item._id !== excludeId)) } catch { setParents([]) } }
  const openEdit = async (row) => {
    try {
      const data = await api(`/inventory/warehouse-locations/${row._id}`), item = data.location
      const next = { warehouse: relationId(item.warehouse), name: item.name || "", code: item.code || "", locationType: item.locationType || "bin", parent: relationId(item.parent), barcode: item.barcode || "", capacityQuantity: item.capacityQuantity || 0, sortOrder: item.sortOrder || 0, status: item.status || "active", isReceivable: Boolean(item.isReceivable), isPickable: Boolean(item.isPickable), isDispatchable: Boolean(item.isDispatchable), isQuarantine: Boolean(item.isQuarantine) }
      setForm(next); setModal({ open: true, item: row, saving: false, error: "" }); await loadParents(next.warehouse, row._id)
    } catch (requestError) { toast.error(requestError.message) }
  }
  const closeEdit = useCallback(() => { if (!modal.saving) setModal({ open: false, item: null, saving: false, error: "" }) }, [modal.saving])
  const save = async (event) => {
    event.preventDefault(); const payload = { ...form, code: clean(form.code).toUpperCase(), name: clean(form.name), parent: form.parent || null, capacityQuantity: Number(form.capacityQuantity || 0), sortOrder: Number(form.sortOrder || 0) }
    setModal((previous) => ({ ...previous, saving: true, error: "" }))
    try { await api(`/inventory/warehouse-locations/${modal.item._id}`, { method: "PATCH", body: JSON.stringify(payload) }); toast.success("Warehouse location updated"); setModal({ open: false, item: null, saving: false, error: "" }); await load() }
    catch (requestError) { setModal((previous) => ({ ...previous, saving: false, error: requestError.message })) }
  }
  const archive = async (row) => {
    if (!window.confirm(`Archive "${row.name}"? Locations containing stock or child locations cannot be archived.`)) return
    try { await api(`/inventory/warehouse-locations/${row._id}`, { method: "DELETE" }); toast.success("Warehouse location archived"); await load() } catch (requestError) { toast.error(requestError.message) }
  }

  return <InventoryPageShell>
    <Toaster position="top-right" toastOptions={{ duration: 2700, style: { borderRadius: "14px", fontWeight: 700 } }} />
    <InventoryPageHeader title="Locations / Bins / Shelves" description="Track warehouse bins and automatically identify unavailable or insufficient product locations.">
      <InventorySearchToolbar value={query} onChange={setQuery} placeholder="Search locations / bins / shelves..." ariaLabel="Search locations" onClear={() => setQuery("")} filterCount={status === "all" ? 0 : 1} filterControls={<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter location status"><option value="all">All statuses</option><option value="available">Available</option><option value="insufficient">Insufficient</option><option value="unavailable">Unavailable</option></select>} utilities={<InventoryButton type="button" icon={FiDownload} onClick={() => downloadCsv(filtered)} disabled={!filtered.length}>Export CSV</InventoryButton>} />
    </InventoryPageHeader>
    {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total Records" value={summary.totalRecords} note="current records" icon={FiDatabase} tone="indigo" /><SummaryCard label="Needs Attention" value={summary.needsAttention} note={summary.needsAttention ? "review locations" : "all clear"} icon={FiActivity} tone="amber" /><SummaryCard label="Total Quantity / Volume" value={number(summary.totalQuantity)} note="current view basis" icon={FiActivity} tone="cyan" /><SummaryCard label="Filtered Results" value={summary.filteredResults} note="all records" icon={FiSliders} tone="blue" /></section>
    <nav className="mb-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_12px_30px_-28px_rgba(15,23,42,.55)]"><div className="flex min-w-max gap-2">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setWarehouse(tab.id)} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${warehouse === tab.id ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>{tab.name}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${warehouse === tab.id ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span></button>)}</div></nav>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left"><thead className="border-b border-gray-200 bg-gray-50/90 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr>{["Warehouse", "Location Code", "Zone", "Rack", "Shelf", "Current Product", "Qty", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? Array.from({ length: 3 }, (_, index) => <tr key={index} className="animate-pulse">{Array.from({ length: 9 }, (_, cell) => <td key={cell} className="px-4 py-5"><div className="h-4 w-20 rounded bg-gray-200" /></td>)}</tr>) : pagination.rows.length ? pagination.rows.map((row) => <tr key={row._id} className="hover:bg-indigo-50/30"><td className="px-4 py-4 text-sm font-medium text-gray-800">{row.warehouse?.name || "—"}</td><td className="px-4 py-4 text-sm font-medium text-gray-800">{row.code || "—"}</td><td className="px-4 py-4 text-sm font-medium text-gray-700">{row.zone || "—"}</td><td className="px-4 py-4 text-sm font-medium text-gray-700">{row.rack || "—"}</td><td className="px-4 py-4 text-sm font-medium text-gray-700">{row.shelf || "—"}</td><td className="px-4 py-4 text-sm font-medium text-gray-800">{row.currentProduct?.name || "—"}{row.productCount > 1 ? <span className="ml-1 text-xs text-gray-400">({row.productCount})</span> : null}</td><td className="px-4 py-4 text-sm font-medium text-gray-800">{number(row.quantity)}</td><td className="px-4 py-4"><StatusBadge status={row.availabilityStatus} /></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button type="button" aria-label={`View ${row.code}`} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-indigo-600" onClick={() => setDetails(row)}><FiEye /></button>{canManage ? <button type="button" aria-label={`Edit ${row.code}`} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-indigo-600" onClick={() => openEdit(row)}><FiEdit2 /></button> : null}{canDelete ? <button type="button" aria-label={`Archive ${row.code}`} className="rounded-lg p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => archive(row)}><FiTrash2 /></button> : null}</div></td></tr>) : <tr><td colSpan={9} className="px-5 py-16 text-center text-sm font-semibold text-gray-500">No warehouse locations match the current filters.</td></tr>}</tbody></table></div>
      <footer className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-xs font-medium text-gray-500 sm:flex-row sm:items-center sm:justify-between"><p>Showing {filtered.length ? pagination.start + 1 : 0}-{pagination.end} of {filtered.length} records</p><div className="flex gap-2"><button type="button" className="rounded-xl border border-gray-200 px-3 py-2 font-bold disabled:opacity-40" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-indigo-500 px-3 font-black text-indigo-700">{pagination.page}</span><button type="button" className="rounded-xl border border-gray-200 px-3 py-2 font-bold disabled:opacity-40" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>Next</button></div></footer>
    </section>
    <Modal open={Boolean(details)} onClose={() => setDetails(null)} title="Location Details" subtitle={details ? `${details.warehouse?.name || "Warehouse"} · ${details.code}` : ""} width="max-w-2xl" footer={<div className="flex justify-end"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800`} onClick={() => setDetails(null)}>Close</button></div>}>{details ? <div className="grid gap-3 sm:grid-cols-2"><Detail label="Location" value={details.name} /><Detail label="Code" value={details.code} /><Detail label="Zone / Rack / Shelf" value={`${details.zone || "—"} / ${details.rack || "—"} / ${details.shelf || "—"}`} /><Detail label="Current Product" value={details.currentProduct?.name} /><Detail label="Quantity" value={number(details.quantity)} /><Detail label="Availability" value={<StatusBadge status={details.availabilityStatus} />} /></div> : null}</Modal>
    <EditModal state={modal} form={form} setForm={setForm} warehouses={warehouses} parents={parents} onWarehouseChange={async (value) => { setForm((previous) => ({ ...previous, warehouse: value, parent: "" })); await loadParents(value, modal.item?._id) }} onClose={closeEdit} onSubmit={save} />
  </InventoryPageShell>
}

function EditModal({ state, form, setForm, warehouses, parents, onWarehouseChange, onClose, onSubmit }) {
  return <Modal open={state.open} onClose={onClose} title="Edit Location" subtitle={state.item?.code || ""} footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800`} onClick={onClose} disabled={state.saving}>Cancel</button><button type="submit" form="location-edit-form" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white`} disabled={state.saving}>{state.saving ? "Saving..." : "Save Changes"}</button></div>}><form id="location-edit-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2"><Field label="Warehouse"><select className={inputClass} value={form.warehouse} onChange={(event) => onWarehouseChange(event.target.value)} required>{warehouses.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field><Field label="Parent Location"><select className={inputClass} value={form.parent} onChange={(event) => setForm((previous) => ({ ...previous, parent: event.target.value }))}><option value="">Root location</option>{parents.map((item) => <option key={item._id} value={item._id}>{item.code} · {item.name}</option>)}</select></Field><Field label="Location Name"><input className={inputClass} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} required /></Field><Field label="Location Code"><input className={inputClass} value={form.code} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))} required /></Field><Field label="Type"><select className={inputClass} value={form.locationType} onChange={(event) => setForm((previous) => ({ ...previous, locationType: event.target.value }))}>{["zone", "aisle", "rack", "shelf", "bin", "receiving", "dispatch", "returns", "quarantine", "damaged", "other"].map((type) => <option key={type} value={type}>{statusLabel(type)}</option>)}</select></Field><Field label="Status"><select className={inputClass} value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field><Field label="Capacity Quantity"><input className={inputClass} type="number" min="0" value={form.capacityQuantity} onChange={(event) => setForm((previous) => ({ ...previous, capacityQuantity: event.target.value }))} /></Field><Field label="Sort Order"><input className={inputClass} type="number" min="0" value={form.sortOrder} onChange={(event) => setForm((previous) => ({ ...previous, sortOrder: event.target.value }))} /></Field><Field label="Barcode"><input className={inputClass} value={form.barcode} onChange={(event) => setForm((previous) => ({ ...previous, barcode: event.target.value }))} /></Field><div className="grid grid-cols-2 gap-2 sm:col-span-2">{[["isReceivable", "Receivable"], ["isPickable", "Pickable"], ["isDispatchable", "Dispatchable"], ["isQuarantine", "Quarantine"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700"><input type="checkbox" checked={Boolean(form[key])} onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.checked }))} />{label}</label>)}</div>{state.error ? <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div> : null}</form></Modal>
}
