"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, Edit02Icon, Package01Icon, RefreshIcon, Tick02Icon } from "@hugeicons/core-free-icons"
import { hasPermission } from "../../Auth/permissions"
import { currentUserFromStorage, formatDate, lcDisplayNo, lcJson, lcRequest, pretty, relationLabel, toDateInput } from "./commercialLCApi"

const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,.25)]"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
const button = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:opacity-50"
const primary = "bg-indigo-600 text-white hover:bg-indigo-700"
const ghost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const SHIPMENT_TRANSITIONS = {
  planned: ["booked", "shipped", "cancelled"], booked: ["shipped", "cancelled"], shipped: ["in_transit", "arrived", "documents_received", "cancelled"],
  in_transit: ["arrived", "documents_received", "cancelled"], arrived: ["documents_received", "customs_clearance", "customs_cleared"],
  documents_received: ["customs_clearance", "customs_cleared"], customs_clearance: ["customs_cleared"], customs_cleared: ["delivered"], delivered: ["closed"], closed: [], cancelled: [],
}
const blank = () => ({ shipmentNo: "", shipmentMode: "sea", carrierName: "", vesselName: "", voyageNo: "", billOfLadingNo: "", airwayBillNo: "", bookingReference: "", portOfLoading: "", portOfDischarge: "", finalDestination: "", etd: "", eta: "", actualDepartureAt: "", actualArrivalAt: "", customsEntryNo: "", customsClearedAt: "", cnfAgentName: "", status: "planned", notes: "", containersText: "" })
function Icon({ icon, className = "h-4 w-4" }) { return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} /> }
function cn(...x) { return x.filter(Boolean).join(" ") }
function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-800">{label}</span>{children}</label> }
function Badge({ value }) { return <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700">{pretty(value)}</span> }
function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => { if (!open) return undefined; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous } }, [open])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto"><div className="flex min-h-full items-start justify-center p-4 sm:items-center"><button className="fixed inset-0 bg-gray-950/45 backdrop-blur-sm" onClick={onClose} /><section className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-5"><h2 className="text-lg font-black text-gray-950">{title}</h2><button className="rounded-xl p-2 hover:bg-gray-100" onClick={onClose}><Icon icon={Cancel01Icon} className="h-5 w-5" /></button></header><div className="max-h-[calc(100vh-12rem)] overflow-y-auto bg-gray-50 p-4 sm:p-5">{children}</div>{footer ? <footer className="border-t border-gray-100 p-4 sm:p-5">{footer}</footer> : null}</section></div></div>, document.body)
}
function containersFromText(value) { return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [containerNo = "", sealNo = "", containerType = ""] = line.split("|").map((x) => x.trim()); return { containerNo, sealNo, containerType } }) }
function containersToText(items = []) { return items.map((x) => [x.containerNo, x.sealNo, x.containerType].filter(Boolean).join(" | ")).join("\n") }

export default function ImportShipments() {
  const user = useMemo(currentUserFromStorage, [])
  const canManage = hasPermission(user, "commercial-lc:manage")
  const [lcs, setLcs] = useState([])
  const [selectedLC, setSelectedLC] = useState("")
  const [statuses, setStatuses] = useState([])
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(25)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [moving, setMoving] = useState("")

  const selected = useMemo(() => lcs.find((x) => x._id === selectedLC), [lcs, selectedLC])
  const loadBase = useCallback(async () => {
    try {
      const [lcData, meta] = await Promise.all([lcRequest("/purchase/commercial-lcs?limit=100"), lcRequest("/purchase/commercial-lcs/import-meta")])
      const active = (lcData.commercialLCs || []).filter((lc) => !["draft", "application_submitted", "cancelled"].includes(lc.status))
      setLcs(active); setStatuses(meta.shipmentStatuses || [])
      setSelectedLC((current) => current || active[0]?._id || "")
    } catch (error) { toast.error(error.message) }
  }, [])
  const loadRows = useCallback(async (targetPage = 1) => {
    if (!selectedLC) { setRows([]); setLoading(false); return }
    setLoading(true)
    try {
      const data = await lcRequest(`/purchase/commercial-lcs/${selectedLC}/shipments?page=${targetPage}&limit=${limit}`)
      setRows(data.shipments || [])
      setTotal(Number(data.total) || 0)
      setTotalPages(Number(data.totalPages) || 1)
      setPage(Number(data.page) || targetPage)
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [selectedLC, limit])
  useEffect(() => { loadBase() }, [loadBase])
  useEffect(() => { loadRows() }, [loadRows])

  const openCreate = () => { setForm(blank()); setModal({ open: true, item: null }) }
  const openEdit = (item) => { setForm({ shipmentMode: item.shipmentMode || "sea", carrierName: item.carrierName || "", vesselName: item.vesselName || "", voyageNo: item.voyageNo || "", billOfLadingNo: item.billOfLadingNo || "", airwayBillNo: item.airwayBillNo || "", bookingReference: item.bookingReference || "", portOfLoading: item.portOfLoading || "", portOfDischarge: item.portOfDischarge || "", finalDestination: item.finalDestination || "", etd: toDateInput(item.etd), eta: toDateInput(item.eta), actualDepartureAt: toDateInput(item.actualDepartureAt), actualArrivalAt: toDateInput(item.actualArrivalAt), customsEntryNo: item.customsEntryNo || "", customsClearedAt: toDateInput(item.customsClearedAt), cnfAgentName: item.cnfAgentName || "", status: item.status || "planned", notes: item.notes || "", containersText: containersToText(item.containers) }); setModal({ open: true, item }) }
  const save = async (event) => {
    event.preventDefault(); if (!selectedLC) return toast.error("Select a Commercial LC."); setSaving(true)
    try {
      const payload = { ...form, containers: containersFromText(form.containersText) }; delete payload.containersText; if (!payload.shipmentNo?.trim()) delete payload.shipmentNo
      const data = await lcRequest(modal.item ? `/purchase/commercial-lcs/shipments/${modal.item._id}` : `/purchase/commercial-lcs/${selectedLC}/shipments`, lcJson(modal.item ? "PATCH" : "POST", payload))
      toast.success(data.message); setModal({ open: false, item: null }); await loadRows()
    } catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }
  const move = async (item, status) => {
    setMoving(item._id)
    try { const data = await lcRequest(`/purchase/commercial-lcs/shipments/${item._id}/status`, lcJson("POST", { status })); toast.success(data.message); await Promise.all([loadRows(), loadBase()]) } catch (error) { toast.error(error.message) } finally { setMoving("") }
  }

  return <div className="min-h-screen bg-gray-50 p-1 sm:p-4 lg:p-6"><Toaster position="top-right" />
    <section className={cn(card, "mb-5 p-5 sm:p-6")}><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Icon icon={Package01Icon} className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-indigo-600">Import logistics</p><h1 className="text-2xl font-black text-gray-950">Import Shipments</h1><p className="mt-1 text-sm font-semibold text-gray-500">Track booking, transit, arrival, customs/C&amp;F and delivery against each LC.</p></div></div><div className="flex flex-wrap gap-2"><button className={cn(button, ghost)} onClick={loadRows}><Icon icon={RefreshIcon} />Refresh</button>{canManage && selectedLC ? <button className={cn(button, primary)} onClick={openCreate}><Icon icon={Add01Icon} />New Shipment</button> : null}</div></div><div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"><Field label="Commercial LC"><select className={input} value={selectedLC} onChange={(e) => setSelectedLC(e.target.value)}><option value="">Select active LC</option>{lcs.map((lc) => <option key={lc._id} value={lc._id}>{lcDisplayNo(lc)} · {lc.purchaseOrder?.orderNo || "PO"} · {relationLabel(lc.supplier)}</option>)}</select></Field>{selected ? <div className="self-end rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">{pretty(selected.status)} · {selected.purchaseOrder?.orderNo}</div> : null}</div></section>

    <section className={cn(card, "overflow-hidden")}><div className="overflow-x-auto"><table className="min-w-[1050px] w-full"><thead className="bg-gray-50 text-left text-xs font-black uppercase text-gray-400"><tr><th className="px-5 py-3">Shipment</th><th className="px-4 py-3">Carrier / Vessel</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">ETD / ETA</th><th className="px-4 py-3">BL / AWB</th><th className="px-4 py-3">Customs / C&amp;F</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="7" className="py-14 text-center font-bold text-gray-500">Loading shipments...</td></tr> : rows.length ? rows.map((item) => <tr key={item._id} className="hover:bg-indigo-50/30"><td className="px-5 py-4"><p className="font-black text-gray-950">{item.shipmentNo}</p><div className="mt-1"><Badge value={item.status} /></div></td><td className="px-4 py-4"><p className="font-bold text-gray-900">{item.carrierName || item.vesselName || "—"}</p><p className="text-xs font-semibold text-gray-500">{pretty(item.shipmentMode)}{item.voyageNo ? ` · ${item.voyageNo}` : ""}</p></td><td className="px-4 py-4 text-sm font-bold text-gray-700">{item.portOfLoading || "—"}<span className="mx-2 text-gray-300">→</span>{item.portOfDischarge || item.finalDestination || "—"}</td><td className="px-4 py-4 text-sm font-bold text-gray-700"><p>{formatDate(item.etd)}</p><p className="text-xs text-gray-500">ETA {formatDate(item.eta)}</p></td><td className="px-4 py-4 text-sm font-bold text-gray-700">{item.billOfLadingNo || item.airwayBillNo || "—"}</td><td className="px-4 py-4"><p className="text-sm font-bold text-gray-900">{item.customsEntryNo || "No entry yet"}</p><p className="text-xs font-semibold text-gray-500">{item.cnfAgentName || "C&F not assigned"}</p></td><td className="px-5 py-4"><div className="flex justify-end gap-2">{canManage && !["closed", "cancelled"].includes(item.status) ? <button className={cn(button, ghost, "h-9 px-3")} onClick={() => openEdit(item)}><Icon icon={Edit02Icon} />Edit</button> : null}{canManage && (SHIPMENT_TRANSITIONS[item.status] || []).length ? <select className={cn(input, "h-9 w-44 py-0 text-xs")} value="" disabled={moving === item._id} onChange={(e) => e.target.value && move(item, e.target.value)}><option value="">Move status...</option>{SHIPMENT_TRANSITIONS[item.status].map((next) => <option key={next} value={next}>{pretty(next)}</option>)}</select> : null}</div></td></tr>) : <tr><td colSpan="7" className="py-16 text-center"><Icon icon={Package01Icon} className="mx-auto h-7 w-7 text-gray-300" /><p className="mt-3 font-black text-gray-900">No shipments for this LC</p><p className="mt-1 text-sm font-semibold text-gray-500">Open an LC first, then create the import shipment.</p></td></tr>}</tbody></table></div>
    {totalPages > 1 ? (
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-xs font-semibold text-gray-600">
        <p>Page {page} of {totalPages} ({total} shipments)</p>
        <div className="flex gap-2">
          <button type="button" className={cn(button, ghost, "h-8 px-3 text-xs")} disabled={page <= 1 || loading} onClick={() => loadRows(page - 1)}><Icon icon={ArrowLeft01Icon} />Previous</button>
          <button type="button" className={cn(button, ghost, "h-8 px-3 text-xs")} disabled={page >= totalPages || loading} onClick={() => loadRows(page + 1)}>Next<Icon icon={ArrowRight01Icon} /></button>
        </div>
      </div>
    ) : null}
    </section>

    <Modal open={modal.open} onClose={() => setModal({ open: false, item: null })} title={modal.item ? `Edit ${modal.item.shipmentNo}` : "Create Import Shipment"} footer={<div className="flex justify-end gap-2"><button className={cn(button, ghost)} onClick={() => setModal({ open: false, item: null })}>Cancel</button><button className={cn(button, primary)} form="shipment-form" type="submit" disabled={saving}><Icon icon={saving ? RefreshIcon : Tick02Icon} className={cn(saving && "animate-spin")} />{saving ? "Saving" : "Save Shipment"}</button></div>}>
      <form id="shipment-form" onSubmit={save} className="space-y-4"><section className={cn(card, "p-4")}><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{!modal.item ? <Field label="Shipment No. (blank for Auto)"><input className={input} value={form.shipmentNo} onChange={(e) => setForm((x) => ({ ...x, shipmentNo: e.target.value.toUpperCase() }))} placeholder="Enter a number in Manual mode" /></Field> : null}<Field label="Shipment Mode"><select className={input} value={form.shipmentMode} onChange={(e) => setForm((x) => ({ ...x, shipmentMode: e.target.value }))}>{["sea", "air", "road", "rail", "courier", "other"].map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field><Field label="Carrier"><input className={input} value={form.carrierName} onChange={(e) => setForm((x) => ({ ...x, carrierName: e.target.value }))} /></Field><Field label="Vessel"><input className={input} value={form.vesselName} onChange={(e) => setForm((x) => ({ ...x, vesselName: e.target.value }))} /></Field><Field label="Voyage No"><input className={input} value={form.voyageNo} onChange={(e) => setForm((x) => ({ ...x, voyageNo: e.target.value }))} /></Field><Field label="Bill of Lading"><input className={input} value={form.billOfLadingNo} onChange={(e) => setForm((x) => ({ ...x, billOfLadingNo: e.target.value.toUpperCase() }))} /></Field><Field label="Airway Bill"><input className={input} value={form.airwayBillNo} onChange={(e) => setForm((x) => ({ ...x, airwayBillNo: e.target.value.toUpperCase() }))} /></Field><Field label="Booking Reference"><input className={input} value={form.bookingReference} onChange={(e) => setForm((x) => ({ ...x, bookingReference: e.target.value }))} /></Field>{!modal.item ? <Field label="Initial Status"><select className={input} value={form.status} onChange={(e) => setForm((x) => ({ ...x, status: e.target.value }))}>{statuses.map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></Field> : null}</div></section><section className={cn(card, "p-4")}><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Field label="Port of Loading"><input className={input} value={form.portOfLoading} onChange={(e) => setForm((x) => ({ ...x, portOfLoading: e.target.value }))} /></Field><Field label="Port of Discharge"><input className={input} value={form.portOfDischarge} onChange={(e) => setForm((x) => ({ ...x, portOfDischarge: e.target.value }))} /></Field><Field label="Final Destination"><input className={input} value={form.finalDestination} onChange={(e) => setForm((x) => ({ ...x, finalDestination: e.target.value }))} /></Field><Field label="C&F Agent"><input className={input} value={form.cnfAgentName} onChange={(e) => setForm((x) => ({ ...x, cnfAgentName: e.target.value }))} /></Field><Field label="ETD"><input className={input} type="date" value={form.etd} onChange={(e) => setForm((x) => ({ ...x, etd: e.target.value }))} /></Field><Field label="ETA"><input className={input} type="date" value={form.eta} onChange={(e) => setForm((x) => ({ ...x, eta: e.target.value }))} /></Field><Field label="Actual Departure"><input className={input} type="date" value={form.actualDepartureAt} onChange={(e) => setForm((x) => ({ ...x, actualDepartureAt: e.target.value }))} /></Field><Field label="Actual Arrival"><input className={input} type="date" value={form.actualArrivalAt} onChange={(e) => setForm((x) => ({ ...x, actualArrivalAt: e.target.value }))} /></Field><Field label="Customs Entry No"><input className={input} value={form.customsEntryNo} onChange={(e) => setForm((x) => ({ ...x, customsEntryNo: e.target.value.toUpperCase() }))} /></Field><Field label="Customs Cleared"><input className={input} type="date" value={form.customsClearedAt} onChange={(e) => setForm((x) => ({ ...x, customsClearedAt: e.target.value }))} /></Field></div></section><section className={cn(card, "p-4")}><div className="grid gap-4 md:grid-cols-2"><Field label="Containers" hint="One per line: CONTAINER NO | SEAL NO | TYPE"><textarea className={cn(input, "h-28 py-3")} value={form.containersText} onChange={(e) => setForm((x) => ({ ...x, containersText: e.target.value }))} /></Field><Field label="Notes"><textarea className={cn(input, "h-28 py-3")} value={form.notes} onChange={(e) => setForm((x) => ({ ...x, notes: e.target.value }))} /></Field></div></section></form>
    </Modal>
  </div>
}
