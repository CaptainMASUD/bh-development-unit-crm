/* eslint-disable react/prop-types, react-refresh/only-export-components -- route page exports tested helpers */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { FiDownload, FiEdit2, FiPause, FiPlay, FiSend, FiX } from "react-icons/fi"
import { hasPermission } from "../../Auth/permissions"
import { InventoryButton, InventoryPageHeader, InventoryPageShell } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 10
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-gray-50"

function clean(value) { return String(value ?? "").trim() }

export function getWarehouseCheckSummary(rows = [], activity = {}) {
  return {
    activeWarehouses: rows.filter((row) => row.status !== "paused").length,
    waitingPaused: Number(activity.waiting || 0) + rows.filter((row) => row.status === "paused").length,
    processing: Number(activity.processing || 0),
    completed: Number(activity.completed || 0),
  }
}

export function buildWarehouseCheckPayload(form = {}) {
  return { frequencyDays: Number(clean(form.frequencyDays)), inspectionMode: clean(form.inspectionMode).toLowerCase() }
}

export function paginateWarehouseChecks(rows = [], requestedPage = 1, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, rows.length)
  return { page, totalPages, start, end, rows: rows.slice(start, end) }
}

function modeLabel(mode) { return mode === "item_by_item" ? "Item by Item" : "Full Warehouse" }
function statusLabel(status) { return status === "waiting" ? "Active" : clean(status).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-US", { timeZone: "UTC" }) }

export function getWarehouseCheckCsvRows(rows = []) {
  return [
    ["Warehouse", "Checking Mode", "Frequency", "Next Check Date", "Cycle", "Status"],
    ...rows.map((row) => [row.warehouse?.name || "—", modeLabel(row.inspectionMode), `Every ${row.frequencyDays} days`, formatDate(row.nextInspectionDate), row.cycleNumber || 1, statusLabel(row.status)]),
  ]
}

function getStoredUser() { try { const stored = JSON.parse(localStorage.getItem("user") || "null"); return stored?.user || stored } catch { return null } }
function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) { const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Request failed"); return data }

function downloadCsv(rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
  const csv = `\uFEFF${getWarehouseCheckCsvRows(rows).map((row) => row.map(escape).join(",")).join("\n")}`
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a"); link.href = url; link.download = `warehouse-checks-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url)
}

function SummaryCard({ label, value, tone }) {
  const tones = { slate: "text-gray-950", amber: "text-amber-600", blue: "text-blue-600", emerald: "text-emerald-600" }
  return <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_30px_-28px_rgba(15,23,42,.55)] sm:p-5"><p className="text-xs font-semibold text-gray-600">{label}</p><p className={`mt-2 text-2xl font-black ${tones[tone]}`}>{value}</p></article>
}

function StatusBadge({ status }) {
  const styles = { waiting: "border-emerald-200 bg-emerald-50 text-emerald-700", processing: "border-blue-200 bg-blue-50 text-blue-700", paused: "border-amber-200 bg-amber-50 text-amber-700", completed: "border-violet-200 bg-violet-50 text-violet-700" }
  return <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${styles[status] || styles.waiting}`}>{statusLabel(status)}</span>
}

function Modal({ open, onClose, children }) {
  useEffect(() => { if (!open) return undefined; const before = document.body.style.overflow; document.body.style.overflow = "hidden"; const escape = (event) => event.key === "Escape" && onClose(); window.addEventListener("keydown", escape); return () => { document.body.style.overflow = before; window.removeEventListener("keydown", escape) } }, [onClose, open])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto"><button type="button" aria-label="Close modal" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} /><div className="relative flex min-h-full items-center justify-center p-4"><div role="dialog" aria-modal="true" className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl">{children}</div></div></div>, document.body)
}

function EditScheduleModal({ state, form, setForm, onClose, onSubmit }) {
  return <Modal open={state.open} onClose={onClose}><form onSubmit={onSubmit}><header className="flex items-start justify-between border-b border-gray-200 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-black text-gray-950">Edit Warehouse Schedule</h2><p className="mt-1 text-sm font-medium text-gray-500">{state.item?.warehouse?.name || "Warehouse checking cycle"}</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100" aria-label="Close"><FiX /></button></header><div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><label className="text-sm font-bold text-gray-600">Checking Mode<select className={`${inputClass} mt-2`} value={form.inspectionMode} onChange={(event) => setForm((previous) => ({ ...previous, inspectionMode: event.target.value }))}><option value="full_warehouse">Full Warehouse</option><option value="item_by_item">Item by Item</option></select></label><label className="text-sm font-bold text-gray-600">Frequency (days)<input className={`${inputClass} mt-2`} type="number" min="1" required value={form.frequencyDays} onChange={(event) => setForm((previous) => ({ ...previous, frequencyDays: event.target.value }))} /></label>{state.error ? <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{state.error}</div> : null}</div><footer className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 sm:px-6"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={onClose} disabled={state.saving}>Cancel</button><button type="submit" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} disabled={state.saving}>{state.saving ? "Saving..." : "Save Changes"}</button></footer></form></Modal>
}

export default function WarehouseChecks() {
  const [rows, setRows] = useState([]), [queue, setQueue] = useState([]), [activity, setActivity] = useState({}), [loading, setLoading] = useState(true), [error, setError] = useState("")
  const [page, setPage] = useState(1), [sending, setSending] = useState(false), [busyId, setBusyId] = useState("")
  const [modal, setModal] = useState({ open: false, item: null, saving: false, error: "" })
  const [form, setForm] = useState({ inspectionMode: "full_warehouse", frequencyDays: 365 })
  const user = useMemo(getStoredUser, [])
  const canManage = hasPermission(user, "inventory-warehouse:manage") || hasPermission(user, "inventory-stock:manage") || hasPermission(user, "inventory-movement:manage")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { const data = await api("/inventory/operations/warehouse-checks"); setRows(data.items || []); setQueue(data.queue || []); setActivity(data.activity || {}) }
    catch (requestError) { setError(requestError.message || "Unable to load warehouse checks") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  const summary = useMemo(() => getWarehouseCheckSummary(rows, activity), [activity, rows])
  const pagination = useMemo(() => paginateWarehouseChecks(rows, page), [page, rows])
  useEffect(() => { if (pagination.page !== page) setPage(pagination.page) }, [page, pagination.page])

  const openEdit = (item) => { setForm({ inspectionMode: item.inspectionMode || "full_warehouse", frequencyDays: item.frequencyDays || 365 }); setModal({ open: true, item, saving: false, error: "" }) }
  const closeEdit = useCallback(() => { if (!modal.saving) setModal({ open: false, item: null, saving: false, error: "" }) }, [modal.saving])
  const saveSchedule = async (event) => { event.preventDefault(); const payload = buildWarehouseCheckPayload(form); if (!Number.isFinite(payload.frequencyDays) || payload.frequencyDays < 1) { setModal((previous) => ({ ...previous, error: "Frequency must be at least one day." })); return } setModal((previous) => ({ ...previous, saving: true, error: "" })); try { await api(`/inventory/operations/warehouse-checks/${modal.item._id}`, { method: "PATCH", body: JSON.stringify(payload) }); toast.success("Warehouse schedule updated"); setModal({ open: false, item: null, saving: false, error: "" }); await load() } catch (requestError) { setModal((previous) => ({ ...previous, saving: false, error: requestError.message })) } }
  const toggleSchedule = async (item) => { const next = item.status === "paused" ? "waiting" : "paused"; setBusyId(item._id); try { await api(`/inventory/operations/warehouse-checks/${item._id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); toast.success(next === "paused" ? "Warehouse schedule paused" : "Warehouse schedule resumed and queued"); await load() } catch (requestError) { toast.error(requestError.message) } finally { setBusyId("") } }
  const sendNext = async () => { setSending(true); try { const data = await api("/inventory/operations/warehouse-checks/send-next", { method: "POST" }); toast.success(`${data.inspection?.product?.name || "Next item"} sent to Stock Inspection`); await load() } catch (requestError) { toast.error(requestError.message) } finally { setSending(false) } }

  return <InventoryPageShell>
    <Toaster position="top-right" toastOptions={{ duration: 2800, style: { borderRadius: "14px", fontWeight: 700 } }} />
    <InventoryPageHeader title="Scheduled Warehouse Checks" description="Every active warehouse is included automatically. Its next check date is calculated only after all items in the current warehouse cycle are completed." actions={<><InventoryButton type="button" icon={FiDownload} onClick={() => downloadCsv(rows)} disabled={!rows.length}>Export CSV</InventoryButton>{canManage ? <InventoryButton type="button" variant="primary" icon={FiSend} onClick={sendNext} disabled={sending}>{sending ? "Sending..." : "Send Item Now"}</InventoryButton> : null}</>} />
    {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div> : null}
    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Active Warehouses" value={summary.activeWarehouses} tone="slate" /><SummaryCard label="Waiting / Paused" value={summary.waitingPaused} tone="amber" /><SummaryCard label="Processing" value={summary.processing} tone="blue" /><SummaryCard label="Completed" value={summary.completed} tone="emerald" /></section>
    <section className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]"><header className="border-b border-gray-200 px-4 py-3 sm:px-5"><h2 className="text-sm font-black text-gray-950">Warehouse Checking Schedules</h2><p className="mt-1 text-xs font-medium text-gray-500">Frequency is measured in days. Pause withdraws the current queue from Stock Inspection; resume sends it back automatically.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-gray-50/90 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr>{["Warehouse", "Checking Mode", "Frequency", "Next Check Date", "Cycle", "Status"].map((label) => <th key={label} className="px-4 py-3 sm:px-5">{label}</th>)}<th className="px-4 py-3 text-right sm:px-5">Action</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? Array.from({ length: 2 }, (_, index) => <tr key={index} className="animate-pulse">{Array.from({ length: 7 }, (_, cell) => <td key={cell} className="px-5 py-5"><div className="h-4 w-20 rounded bg-gray-200" /></td>)}</tr>) : pagination.rows.length ? pagination.rows.map((item) => <ScheduleRow key={item._id} item={item} canManage={canManage} busy={busyId === item._id} onEdit={() => openEdit(item)} onToggle={() => toggleSchedule(item)} />) : <tr><td colSpan={7} className="px-5 py-14 text-center text-sm font-semibold text-gray-500">No active warehouse schedules found.</td></tr>}</tbody></table></div><footer className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-xs font-medium text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p>Showing {rows.length ? pagination.start + 1 : 0}-{pagination.end} of {rows.length} records</p><div className="flex items-center gap-2"><button className="rounded-xl border border-gray-200 px-3 py-2 font-bold disabled:opacity-40" type="button" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-indigo-500 px-3 font-black text-indigo-700">{pagination.page}</span><button className="rounded-xl border border-gray-200 px-3 py-2 font-bold disabled:opacity-40" type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>Next</button></div></footer></section>
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]"><header className="border-b border-gray-200 px-4 py-3 sm:px-5"><h2 className="text-sm font-black text-gray-950">Warehouse Check Queue</h2><p className="mt-1 text-xs font-medium text-gray-500">Paused items are removed from Stock Inspection until their warehouse schedule is resumed.</p></header>{queue.length ? <QueueTable queue={queue} /> : <div className="flex min-h-36 items-center justify-center px-5 py-10 text-center text-sm font-medium text-gray-500">There are no active warehouse check items.</div>}</section>
    <EditScheduleModal state={modal} form={form} setForm={setForm} onClose={closeEdit} onSubmit={saveSchedule} />
  </InventoryPageShell>
}

function ScheduleRow({ item, canManage, busy, onEdit, onToggle }) {
  return <tr className="hover:bg-indigo-50/30"><td className="px-4 py-4 text-sm font-bold text-gray-900 sm:px-5">{item.warehouse?.name || "—"}</td><td className="px-4 py-4 text-sm font-medium text-gray-800 sm:px-5">{modeLabel(item.inspectionMode)}</td><td className="px-4 py-4 text-sm font-medium text-gray-800 sm:px-5">Every {item.frequencyDays} days</td><td className="px-4 py-4 text-sm font-medium text-gray-800 sm:px-5">{formatDate(item.nextInspectionDate)}</td><td className="px-4 py-4 text-sm font-medium text-gray-800 sm:px-5">{item.cycleNumber || 1}</td><td className="px-4 py-4 sm:px-5"><StatusBadge status={item.status} /></td><td className="px-4 py-3 sm:px-5"><div className="flex justify-end gap-1">{canManage ? <><button type="button" title="Edit schedule" aria-label={`Edit ${item.warehouse?.name || "warehouse"} schedule`} onClick={onEdit} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><FiEdit2 /></button><button type="button" title={item.status === "paused" ? "Resume schedule" : "Pause schedule"} aria-label={item.status === "paused" ? "Resume schedule" : "Pause schedule"} onClick={onToggle} disabled={busy} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40">{item.status === "paused" ? <FiPlay /> : <FiPause />}</button></> : <span className="text-xs text-gray-400">View only</span>}</div></td></tr>
}

function QueueTable({ queue }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-gray-50/90 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr>{["Item", "Warehouse", "Location", "Quantity", "Status"].map((label) => <th key={label} className="px-5 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{queue.map((item) => <tr key={item._id}><td className="px-5 py-4 text-sm font-bold text-gray-900">{item.product?.name || "—"}<span className="ml-2 text-xs font-medium text-gray-400">{item.product?.sku || ""}</span></td><td className="px-5 py-4 text-sm font-medium text-gray-700">{item.warehouse?.name || "—"}</td><td className="px-5 py-4 text-sm font-medium text-gray-700">{item.location?.name || "Unassigned"}</td><td className="px-5 py-4 text-sm font-medium text-gray-700">{item.previousQuantity ?? 0}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div>
}
