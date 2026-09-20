"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BankIcon,
  Cancel01Icon,
  Edit02Icon,
  FloppyDiskIcon,
  NoteEditIcon,
  RefreshIcon,
  Search01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { hasPermission } from "../../Auth/permissions"
import {
  cleanId,
  currentUserFromStorage,
  formatDate,
  formatMoney,
  lcDisplayNo,
  lcJson,
  lcRequest,
  loadLCReferenceData,
  pretty,
  relationLabel,
  toDateInput,
  todayInput,
} from "./commercialLCApi"

const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,.25)]"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:bg-gray-50 disabled:text-gray-500"
const button = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50"
const primary = "bg-indigo-600 text-white hover:bg-indigo-700"
const ghost = "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
const danger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"

const blankForm = () => ({
  purchaseOrder: "",
  lcType: "sight",
  amount: "",
  currency: "USD",
  exchangeRate: "1",
  marginPercent: "0",
  marginAmount: "0",
  applicationDate: todayInput(),
  expiryDate: "",
  latestShipmentDate: "",
  incoterm: "",
  portOfLoading: "",
  portOfDischarge: "",
  countryOfOrigin: "",
  beneficiaryBankName: "",
  beneficiaryBankSwift: "",
  issuingBank: "",
  bankAccount: "",
  usanceDays: "0",
  insurancePolicyNo: "",
  notes: "",
})

const blankAction = () => ({ open: false, type: "", item: null, form: {}, saving: false })

function Icon({ icon, className = "h-4 w-4" }) {
  return <HugeiconsIcon icon={icon} className={className} strokeWidth={1.8} />
}
function cn(...values) { return values.filter(Boolean).join(" ") }
function Field({ label, required, hint, children }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-sm font-bold text-gray-800">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>{children}{hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}</label>
}
function StatusBadge({ value }) {
  const tone = {
    draft: "bg-gray-100 text-gray-700",
    application_submitted: "bg-amber-50 text-amber-700",
    opened: "bg-indigo-50 text-indigo-700",
    documents_received: "bg-sky-50 text-sky-700",
    customs_clearance: "bg-violet-50 text-violet-700",
    goods_received: "bg-teal-50 text-teal-700",
    settlement_pending: "bg-orange-50 text-orange-700",
    settled: "bg-emerald-50 text-emerald-700",
    closed: "bg-gray-900 text-white",
    cancelled: "bg-rose-50 text-rose-700",
  }[value] || "bg-gray-100 text-gray-700"
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-black", tone)}>{pretty(value)}</span>
}
function Modal({ open, title, subtitle, icon, onClose, children, footer, max = "max-w-5xl" }) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const key = (event) => event.key === "Escape" && onClose?.()
    window.addEventListener("keydown", key)
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", key) }
  }, [open, onClose])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="fixed inset-0 z-[100] overflow-y-auto"><div className="flex min-h-full items-start justify-center p-3 sm:items-center sm:p-6"><button aria-label="Close" className="fixed inset-0 bg-gray-950/45 backdrop-blur-sm" onClick={onClose} /><motion.section initial={{ opacity: 0, y: 16, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cn("relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl", max)}><header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white">{icon}</span><div className="min-w-0"><h2 className="truncate text-lg font-black text-gray-950">{title}</h2>{subtitle ? <p className="truncate text-sm font-semibold text-gray-500">{subtitle}</p> : null}</div></div><button className="rounded-xl p-2 text-gray-500 hover:bg-gray-100" onClick={onClose}><Icon icon={Cancel01Icon} className="h-5 w-5" /></button></header><div className="max-h-[calc(100vh-12rem)] overflow-y-auto bg-gray-50/60 p-4 sm:p-5">{children}</div>{footer ? <footer className="sticky bottom-0 z-20 border-t border-gray-100 bg-white p-4 sm:p-5">{footer}</footer> : null}</motion.section></div></div>, document.body)
}
function Metric({ label, value, detail }) {
  return <article className={cn(card, "p-4 sm:p-5")}><p className="text-xs font-black uppercase tracking-[.12em] text-gray-400">{label}</p><p className="mt-2 truncate text-2xl font-black text-gray-950">{value}</p><p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p></article>
}
function Info({ label, value }) { return <div><p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-1 text-sm font-bold text-gray-900">{value ?? "—"}</div></div> }

export default function CommercialLC() {
  const user = useMemo(currentUserFromStorage, [])
  const canManage = hasPermission(user, "commercial-lc:manage")
  const canOpen = hasPermission(user, "commercial-lc:open")
  const canAmend = hasPermission(user, "commercial-lc:amend")
  const canSettle = hasPermission(user, "commercial-lc:settle")
  const canClose = hasPermission(user, "commercial-lc:close")

  const [meta, setMeta] = useState({ statuses: [], lcTypes: ["sight", "usance", "deferred", "revolving", "other"], chargeTypes: [] })
  const [summary, setSummary] = useState({})
  const [rows, setRows] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [banks, setBanks] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [vendorBills, setVendorBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(25)
  const [formModal, setFormModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState(null)
  const [action, setAction] = useState(blankAction)

  const activeImportOrders = useMemo(() => purchaseOrders.filter((item) => item.tradeType === "import" && ["approved", "partially_received", "received"].includes(item.status)), [purchaseOrders])
  const accountsForBank = useMemo(() => bankAccounts.filter((account) => !form.issuingBank || cleanId(account.bank) === form.issuingBank), [bankAccounts, form.issuingBank])

  const load = useCallback(async (targetPage = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(targetPage) })
      if (query.trim()) params.set("q", query.trim())
      if (status !== "all") params.set("status", status)
      const [list, stats, refs] = await Promise.all([
        lcRequest(`/purchase/commercial-lcs?${params}`),
        lcRequest("/purchase/commercial-lcs/summary"),
        loadLCReferenceData(),
      ])
      setRows(list.commercialLCs || [])
      setTotal(Number(list.total) || 0)
      setTotalPages(Number(list.totalPages) || 1)
      setPage(Number(list.page) || targetPage)
      setSummary(stats.summary || {})
      setMeta((current) => ({ ...current, ...(refs.lcMeta || {}) }))
      setPurchaseOrders(refs.purchaseOrders || [])
      setBanks(refs.banks || [])
      setBankAccounts(refs.bankAccounts || [])
      setVendorBills(refs.vendorBills || [])
      if (refs.failures?.length) toast.error("Some LC reference options could not be loaded.")
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [limit, query, status])

  useEffect(() => { const timer = setTimeout(() => load(page), 180); return () => clearTimeout(timer) }, [load, page])

  const openCreate = (order = null) => {
    const next = blankForm()
    if (order) Object.assign(next, { purchaseOrder: order._id, amount: String(order.grandTotal || ""), currency: order.currency || "USD", exchangeRate: String(order.exchangeRate || 1), incoterm: order.incoterm || "" })
    setForm(next); setFormModal({ open: true, item: null })
  }
  const openEdit = (item) => {
    setForm({
      purchaseOrder: cleanId(item.purchaseOrder), lcType: item.lcType || "sight", amount: String(item.amount || ""), currency: item.currency || "USD", exchangeRate: String(item.exchangeRate || 1), marginPercent: String(item.marginPercent || 0), marginAmount: String(item.marginAmount || 0), applicationDate: toDateInput(item.applicationDate) || todayInput(), expiryDate: toDateInput(item.expiryDate), latestShipmentDate: toDateInput(item.latestShipmentDate), incoterm: item.incoterm || "", portOfLoading: item.portOfLoading || "", portOfDischarge: item.portOfDischarge || "", countryOfOrigin: item.countryOfOrigin || "", beneficiaryBankName: item.beneficiaryBankName || "", beneficiaryBankSwift: item.beneficiaryBankSwift || "", issuingBank: cleanId(item.issuingBank), bankAccount: cleanId(item.bankAccount), usanceDays: String(item.usanceDays || 0), insurancePolicyNo: item.insurancePolicyNo || "", notes: item.notes || "",
    }); setFormModal({ open: true, item })
  }
  const selectOrder = (id) => {
    const order = activeImportOrders.find((item) => item._id === id)
    setForm((current) => ({ ...current, purchaseOrder: id, amount: order ? String(order.grandTotal || "") : current.amount, currency: order?.currency || current.currency, exchangeRate: order ? String(order.exchangeRate || 1) : current.exchangeRate, incoterm: order?.incoterm || current.incoterm }))
  }
  const save = async (event) => {
    event.preventDefault()
    if (!form.purchaseOrder) return toast.error("Select an approved import purchase order.")
    if (Number(form.amount) <= 0) return toast.error("LC amount must be greater than zero.")
    setSaving(true)
    try {
      const body = { ...form, amount: Number(form.amount), exchangeRate: Number(form.exchangeRate || 1), marginPercent: Number(form.marginPercent || 0), marginAmount: Number(form.marginAmount || 0), usanceDays: Number(form.usanceDays || 0), expiryDate: form.expiryDate || null, latestShipmentDate: form.latestShipmentDate || null, issuingBank: form.issuingBank || null, bankAccount: form.bankAccount || null }
      const item = formModal.item
      const data = await lcRequest(item ? `/purchase/commercial-lcs/${item._id}` : "/purchase/commercial-lcs", lcJson(item ? "PATCH" : "POST", body))
      toast.success(data.message || "Commercial LC saved.")
      setFormModal({ open: false, item: null }); await load()
    } catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }
  const view = async (item) => {
    try { const data = await lcRequest(`/purchase/commercial-lcs/${item._id}`); setDetails(data.commercialLC) } catch (error) { toast.error(error.message) }
  }
  const simpleAction = async (item, type) => {
    try {
      const routes = { submit: ["submit", {}], close: ["close", {}] }
      const [route, body] = routes[type]
      const data = await lcRequest(`/purchase/commercial-lcs/${item._id}/${route}`, lcJson("POST", body))
      toast.success(data.message); setDetails(data.commercialLC || null); await load()
    } catch (error) { toast.error(error.message) }
  }
  const openAction = (item, type) => {
    const initial = {
      open: { lcNumber: item.lcNumber || "", issuingBank: cleanId(item.issuingBank), bankAccount: cleanId(item.bankAccount), openedDate: todayInput(), expiryDate: toDateInput(item.expiryDate), latestShipmentDate: toDateInput(item.latestShipmentDate), marginPercent: String(item.marginPercent || 0), marginAmount: String(item.marginAmount || 0) },
      amend: { amount: String(item.amount || ""), expiryDate: toDateInput(item.expiryDate), latestShipmentDate: toDateInput(item.latestShipmentDate), amendmentDate: todayInput(), reason: "", bankReference: "" },
      charge: { chargeType: meta.chargeTypes?.[0] || "bank_commission", amount: "", currency: item.currency || "BDT", exchangeRate: String(item.exchangeRate || 1), capitalize: true, bankAccount: cleanId(item.bankAccount), reference: "", description: "", chargedAt: todayInput() },
      settle: { vendorBill: "", bankAccount: cleanId(item.bankAccount), amount: String(item.outstandingAmount || item.amount || ""), currency: item.currency || "USD", settledAt: todayInput(), reference: "", note: "" },
      cancel: { reason: "" },
    }[type] || {}
    setAction({ open: true, type, item, form: initial, saving: false })
  }
  const executeAction = async () => {
    const { item, type, form: values } = action
    setAction((current) => ({ ...current, saving: true }))
    try {
      const route = { open: "open", amend: "amend", charge: "charges", settle: "settle", cancel: "cancel" }[type]
      const body = { ...values }
      for (const key of ["amount", "exchangeRate", "marginPercent", "marginAmount"]) if (body[key] !== undefined && body[key] !== "") body[key] = Number(body[key])
      const data = await lcRequest(`/purchase/commercial-lcs/${item._id}/${route}`, lcJson("POST", body))
      toast.success(data.message || "Commercial LC updated.")
      setAction(blankAction()); if (data.commercialLC) setDetails(data.commercialLC); await load()
    } catch (error) { toast.error(error.message); setAction((current) => ({ ...current, saving: false })) }
  }

  const actionTitle = { open: "Open Commercial LC", amend: "Amend Commercial LC", charge: "Record LC / Import Charge", settle: "Settle Commercial LC", cancel: "Cancel Commercial LC" }[action.type]
  const actionAccounts = bankAccounts.filter((account) => !action.form.issuingBank || cleanId(account.bank) === action.form.issuingBank)

  return <div className="min-h-screen bg-gray-50 p-1 sm:p-4 lg:p-6"><Toaster position="top-right" />
    <section className={cn(card, "mb-5 p-5 sm:p-6")}><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Icon icon={BankIcon} className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-indigo-600">Import finance</p><h1 className="text-2xl font-black tracking-tight text-gray-950">Commercial LC</h1><p className="mt-1 text-sm font-semibold text-gray-500">Control import LCs from approved purchase order through bank settlement and closure.</p></div></div><div className="flex flex-wrap gap-2"><button className={cn(button, ghost)} onClick={load} disabled={loading}><Icon icon={RefreshIcon} className={cn("h-4 w-4", loading && "animate-spin")} />Refresh</button>{canManage ? <button className={cn(button, primary)} onClick={() => openCreate()}><Icon icon={Add01Icon} />New LC</button> : null}</div></div></section>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Commercial LCs" value={summary.count || 0} detail={`${summary.opened || 0} currently opened`} /><Metric label="Import Exposure" value={formatMoney(summary.amount || 0, "BDT")} detail="Base-currency LC value" /><Metric label="LC Margin" value={formatMoney(summary.margin || 0, "BDT")} detail="Restricted / margin amount" /><Metric label="Import Charges" value={formatMoney(summary.charges || 0, "BDT")} detail={`${summary.settled || 0} settled or closed`} /></div>

    <section className={cn(card, "mb-4 p-3 sm:p-4")}><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Icon icon={Search01Icon} className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" /><input className={cn(input, "pl-10")} placeholder="Search application or LC number..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><select className={cn(input, "lg:w-60")} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All LC statuses</option>{(meta.statuses || []).map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></div></section>

    <section className={cn(card, "overflow-hidden")}><div className="hidden overflow-x-auto md:block"><table className="min-w-[1100px] w-full"><thead className="bg-gray-50 text-left text-xs font-black uppercase tracking-wide text-gray-400"><tr><th className="px-5 py-3">LC / Application</th><th className="px-4 py-3">PO & Supplier</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Expiry</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? <tr><td colSpan="7" className="px-5 py-14 text-center font-bold text-gray-500">Loading Commercial LCs...</td></tr> : rows.length ? rows.map((item) => <tr key={item._id} className="hover:bg-indigo-50/30"><td className="px-5 py-4"><p className="font-black text-gray-950">{lcDisplayNo(item)}</p><p className="mt-1 text-xs font-semibold text-gray-500">{item.applicationNo}</p></td><td className="px-4 py-4"><p className="font-bold text-gray-900">{item.purchaseOrder?.orderNo || "—"}</p><p className="text-xs font-semibold text-gray-500">{relationLabel(item.supplier)}</p></td><td className="px-4 py-4 text-sm font-bold text-gray-700">{pretty(item.lcType)}</td><td className="px-4 py-4"><StatusBadge value={item.status} /></td><td className="px-4 py-4"><p className="font-black text-gray-950">{formatMoney(item.amount, item.currency)}</p><p className="text-xs font-semibold text-gray-500">Outstanding {formatMoney(item.outstandingAmount, item.currency)}</p></td><td className="px-4 py-4 text-sm font-bold text-gray-700">{formatDate(item.expiryDate)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1.5"><button className={cn(button, ghost, "h-9 px-3")} onClick={() => view(item)}><Icon icon={ViewIcon} />View</button>{canManage && ["draft", "application_submitted"].includes(item.status) ? <button className={cn(button, ghost, "h-9 px-3")} onClick={() => openEdit(item)}><Icon icon={Edit02Icon} /></button> : null}</div></td></tr>) : <tr><td colSpan="7" className="px-5 py-16 text-center"><Icon icon={NoteEditIcon} className="mx-auto h-7 w-7 text-gray-300" /><p className="mt-3 font-black text-gray-900">No Commercial LCs found</p><p className="mt-1 text-sm font-semibold text-gray-500">Create one from an approved import purchase order.</p></td></tr>}</tbody></table></div>
    <div className="divide-y divide-gray-100 md:hidden">{rows.map((item) => <article key={item._id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-gray-950">{lcDisplayNo(item)}</p><p className="mt-1 text-xs font-semibold text-gray-500">{item.purchaseOrder?.orderNo} · {relationLabel(item.supplier)}</p></div><StatusBadge value={item.status} /></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="font-black text-gray-950">{formatMoney(item.amount, item.currency)}</p><p className="text-xs font-semibold text-gray-500">Expires {formatDate(item.expiryDate)}</p></div><button className={cn(button, ghost, "h-9 px-3")} onClick={() => view(item)}><Icon icon={ViewIcon} />View</button></div></article>)}</div>
    {totalPages > 1 ? (
      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-5 py-3 text-xs font-semibold text-gray-600">
        <p>Page {page} of {totalPages} ({total} Commercial LCs)</p>
        <div className="flex gap-2">
          <button type="button" className={cn(button, ghost, "h-8 px-3 text-xs")} disabled={page <= 1 || loading} onClick={() => load(page - 1)}><Icon icon={ArrowLeft01Icon} />Previous</button>
          <button type="button" className={cn(button, ghost, "h-8 px-3 text-xs")} disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>Next<Icon icon={ArrowRight01Icon} /></button>
        </div>
      </div>
    ) : null}
    </section>

    <Modal open={formModal.open} onClose={() => setFormModal({ open: false, item: null })} title={formModal.item ? "Update LC draft" : "Create Commercial LC"} subtitle={formModal.item?.applicationNo || "Approved import purchase order"} icon={<Icon icon={formModal.item ? Edit02Icon : Add01Icon} className="h-5 w-5" />} max="max-w-6xl" footer={<div className="flex justify-end gap-2"><button className={cn(button, ghost)} onClick={() => setFormModal({ open: false, item: null })}>Cancel</button><button className={cn(button, primary)} form="commercial-lc-form" type="submit" disabled={saving}><Icon icon={saving ? RefreshIcon : FloppyDiskIcon} className={cn("h-4 w-4", saving && "animate-spin")} />{saving ? "Saving" : "Save LC"}</button></div>}>
      <form id="commercial-lc-form" onSubmit={save} className="space-y-4"><div className={cn(card, "p-4")}><h3 className="font-black text-gray-950">Purchase & commercial terms</h3><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Import Purchase Order" required><select className={input} value={form.purchaseOrder} disabled={Boolean(formModal.item)} onChange={(e) => selectOrder(e.target.value)}><option value="">Select approved import PO</option>{activeImportOrders.map((order) => <option key={order._id} value={order._id}>{order.orderNo} · {relationLabel(order.supplier)} · {formatMoney(order.grandTotal, order.currency)}</option>)}</select></Field><Field label="LC Type"><select className={input} value={form.lcType} onChange={(e) => setForm((x) => ({ ...x, lcType: e.target.value }))}>{(meta.lcTypes || []).map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></Field><Field label="LC Amount" required><input className={input} type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((x) => ({ ...x, amount: e.target.value }))} /></Field><Field label="Currency"><input className={input} value={form.currency} maxLength="12" onChange={(e) => setForm((x) => ({ ...x, currency: e.target.value.toUpperCase() }))} /></Field><Field label="Exchange Rate"><input className={input} type="number" min="0.000001" step="0.000001" value={form.exchangeRate} onChange={(e) => setForm((x) => ({ ...x, exchangeRate: e.target.value }))} /></Field><Field label="Incoterm"><input className={input} value={form.incoterm} onChange={(e) => setForm((x) => ({ ...x, incoterm: e.target.value.toUpperCase() }))} /></Field><Field label="Application Date"><input className={input} type="date" value={form.applicationDate} onChange={(e) => setForm((x) => ({ ...x, applicationDate: e.target.value }))} /></Field><Field label="Usance Days"><input className={input} type="number" min="0" value={form.usanceDays} onChange={(e) => setForm((x) => ({ ...x, usanceDays: e.target.value }))} /></Field></div></div>
      <div className={cn(card, "p-4")}><h3 className="font-black text-gray-950">Banking, shipment & margin setup</h3><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Issuing Bank"><select className={input} value={form.issuingBank} onChange={(e) => setForm((x) => ({ ...x, issuingBank: e.target.value, bankAccount: "" }))}><option value="">Select bank</option>{banks.map((bank) => <option key={bank._id} value={bank._id}>{relationLabel(bank)}</option>)}</select></Field><Field label="Bank Account"><select className={input} value={form.bankAccount} onChange={(e) => setForm((x) => ({ ...x, bankAccount: e.target.value }))}><option value="">Select account</option>{accountsForBank.map((account) => <option key={account._id} value={account._id}>{relationLabel(account)}</option>)}</select></Field><Field label="Margin %"><input className={input} type="number" min="0" max="100" step="0.01" value={form.marginPercent} onChange={(e) => setForm((x) => ({ ...x, marginPercent: e.target.value }))} /></Field><Field label="Margin Amount"><input className={input} type="number" min="0" step="0.01" value={form.marginAmount} onChange={(e) => setForm((x) => ({ ...x, marginAmount: e.target.value }))} /></Field><Field label="LC Expiry"><input className={input} type="date" value={form.expiryDate} onChange={(e) => setForm((x) => ({ ...x, expiryDate: e.target.value }))} /></Field><Field label="Latest Shipment"><input className={input} type="date" value={form.latestShipmentDate} onChange={(e) => setForm((x) => ({ ...x, latestShipmentDate: e.target.value }))} /></Field><Field label="Port of Loading"><input className={input} value={form.portOfLoading} onChange={(e) => setForm((x) => ({ ...x, portOfLoading: e.target.value }))} /></Field><Field label="Port of Discharge"><input className={input} value={form.portOfDischarge} onChange={(e) => setForm((x) => ({ ...x, portOfDischarge: e.target.value }))} /></Field><Field label="Country of Origin"><input className={input} value={form.countryOfOrigin} onChange={(e) => setForm((x) => ({ ...x, countryOfOrigin: e.target.value }))} /></Field><Field label="Beneficiary Bank"><input className={input} value={form.beneficiaryBankName} onChange={(e) => setForm((x) => ({ ...x, beneficiaryBankName: e.target.value }))} /></Field><Field label="Beneficiary SWIFT"><input className={input} value={form.beneficiaryBankSwift} onChange={(e) => setForm((x) => ({ ...x, beneficiaryBankSwift: e.target.value.toUpperCase() }))} /></Field><Field label="Insurance Policy"><input className={input} value={form.insurancePolicyNo} onChange={(e) => setForm((x) => ({ ...x, insurancePolicyNo: e.target.value }))} /></Field><Field label="Notes" className="md:col-span-2"><textarea className={cn(input, "h-24 py-3")} value={form.notes} onChange={(e) => setForm((x) => ({ ...x, notes: e.target.value }))} /></Field></div></div></form>
    </Modal>

    <Modal open={Boolean(details)} onClose={() => setDetails(null)} title={lcDisplayNo(details)} subtitle={details?.applicationNo} icon={<Icon icon={BankIcon} className="h-5 w-5" />} max="max-w-6xl" footer={details ? <div className="flex flex-wrap justify-end gap-2">{canManage && details.status === "draft" ? <><button className={cn(button, ghost)} onClick={() => { setDetails(null); openEdit(details) }}><Icon icon={Edit02Icon} />Edit</button><button className={cn(button, primary)} onClick={() => simpleAction(details, "submit")}><Icon icon={Tick02Icon} />Submit Application</button></> : null}{canOpen && details.status === "application_submitted" ? <button className={cn(button, primary)} onClick={() => openAction(details, "open")}>Open LC</button> : null}{canAmend && ["opened", "documents_received", "customs_clearance", "goods_received", "settlement_pending"].includes(details.status) ? <button className={cn(button, ghost)} onClick={() => openAction(details, "amend")}>Amend</button> : null}{canManage && !["draft", "cancelled", "closed"].includes(details.status) ? <button className={cn(button, ghost)} onClick={() => openAction(details, "charge")}>Add Charge</button> : null}{canSettle && ["opened", "documents_received", "customs_clearance", "goods_received", "settlement_pending"].includes(details.status) ? <button className={cn(button, primary)} onClick={() => openAction(details, "settle")}>Settle</button> : null}{canClose && details.status === "settled" ? <button className={cn(button, primary)} onClick={() => simpleAction(details, "close")}>Close LC</button> : null}{canManage && ["draft", "application_submitted", "opened"].includes(details.status) ? <button className={cn(button, danger)} onClick={() => openAction(details, "cancel")}>Cancel</button> : null}</div> : null}>
      {details ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Status" value={<StatusBadge value={details.status} />} detail={details.lcType ? `${pretty(details.lcType)} LC` : "LC workflow"} /><Metric label="LC Amount" value={formatMoney(details.amount, details.currency)} detail={`Base ${formatMoney(details.baseCurrencyAmount, "BDT")}`} /><Metric label="Outstanding" value={formatMoney(details.outstandingAmount, details.currency)} detail={`Settled ${formatMoney(details.settledAmount, details.currency)}`} /><Metric label="Charges" value={formatMoney(details.totalCharges, "BDT")} detail={`Capitalized ${formatMoney(details.capitalizableCharges, "BDT")}`} /></div><section className={cn(card, "p-4 sm:p-5")}><h3 className="font-black text-gray-950">LC overview</h3><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label="Purchase Order" value={details.purchaseOrder?.orderNo} /><Info label="Supplier" value={relationLabel(details.supplier)} /><Info label="Issuing Bank" value={relationLabel(details.issuingBank)} /><Info label="Bank Account" value={relationLabel(details.bankAccount)} /><Info label="Opening Date" value={formatDate(details.openedDate)} /><Info label="Expiry Date" value={formatDate(details.expiryDate)} /><Info label="Latest Shipment" value={formatDate(details.latestShipmentDate)} /><Info label="Incoterm" value={details.incoterm || "—"} /><Info label="Port of Loading" value={details.portOfLoading || "—"} /><Info label="Port of Discharge" value={details.portOfDischarge || "—"} /><Info label="Origin" value={details.countryOfOrigin || "—"} /><Info label="Margin" value={`${details.marginPercent || 0}% · ${formatMoney(details.marginAmount, details.currency)}`} /></div></section><div className="grid gap-4 lg:grid-cols-2"><section className={cn(card, "p-4")}><h3 className="font-black text-gray-950">Amendments</h3><div className="mt-3 space-y-2">{details.amendments?.length ? details.amendments.slice().reverse().map((item) => <div key={item._id} className="rounded-xl bg-gray-50 p-3"><div className="flex justify-between gap-3"><p className="font-bold">Amendment #{item.amendmentNo}</p><span className="text-xs font-semibold text-gray-500">{formatDate(item.amendmentDate)}</span></div><p className="mt-1 text-xs font-semibold text-gray-500">{item.reason || "No reason recorded"}</p><p className="mt-2 text-sm font-black text-gray-900">{formatMoney(item.previousAmount, details.currency)} → {formatMoney(item.revisedAmount, details.currency)}</p></div>) : <p className="text-sm font-semibold text-gray-500">No amendments.</p>}</div></section><section className={cn(card, "p-4")}><h3 className="font-black text-gray-950">Charges & settlements</h3><div className="mt-3 space-y-2">{details.charges?.slice(-4).reverse().map((item) => <div key={item._id} className="flex justify-between gap-3 rounded-xl bg-gray-50 p-3"><div><p className="font-bold">{pretty(item.chargeType)}</p><p className="text-xs font-semibold text-gray-500">{item.reference || item.description || "Posted charge"}</p></div><p className="font-black">{formatMoney(item.amount, item.currency)}</p></div>)}{details.settlements?.slice(-4).reverse().map((item) => <div key={item._id} className="flex justify-between gap-3 rounded-xl bg-emerald-50 p-3"><div><p className="font-bold text-emerald-900">Settlement</p><p className="text-xs font-semibold text-emerald-700">{formatDate(item.settledAt)} · {item.reference || "Bank settlement"}</p></div><p className="font-black text-emerald-900">{formatMoney(item.amount, item.currency)}</p></div>)}{!details.charges?.length && !details.settlements?.length ? <p className="text-sm font-semibold text-gray-500">No financial activity recorded yet.</p> : null}</div></section></div></div> : null}
    </Modal>

    <Modal open={action.open} onClose={() => !action.saving && setAction(blankAction())} title={actionTitle || "LC action"} subtitle={lcDisplayNo(action.item)} icon={<Icon icon={action.type === "cancel" ? Alert02Icon : BankIcon} className="h-5 w-5" />} footer={<div className="flex justify-end gap-2"><button className={cn(button, ghost)} onClick={() => setAction(blankAction())} disabled={action.saving}>Cancel</button><button className={cn(button, action.type === "cancel" ? danger : primary)} onClick={executeAction} disabled={action.saving}><Icon icon={action.saving ? RefreshIcon : Tick02Icon} className={cn("h-4 w-4", action.saving && "animate-spin")} />Confirm</button></div>}>
      <div className="grid gap-4 sm:grid-cols-2">{action.type === "open" ? <><Field label="LC Number" required><input className={input} value={action.form.lcNumber || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, lcNumber: e.target.value.toUpperCase() } }))} /></Field><Field label="Issuing Bank" required><select className={input} value={action.form.issuingBank || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, issuingBank: e.target.value, bankAccount: "" } }))}><option value="">Select bank</option>{banks.map((bank) => <option key={bank._id} value={bank._id}>{relationLabel(bank)}</option>)}</select></Field><Field label="Bank Account" required><select className={input} value={action.form.bankAccount || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, bankAccount: e.target.value } }))}><option value="">Select account</option>{actionAccounts.map((account) => <option key={account._id} value={account._id}>{relationLabel(account)}</option>)}</select></Field><Field label="Opening Date"><input className={input} type="date" value={action.form.openedDate || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, openedDate: e.target.value } }))} /></Field><Field label="Expiry Date"><input className={input} type="date" value={action.form.expiryDate || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, expiryDate: e.target.value } }))} /></Field><Field label="Latest Shipment"><input className={input} type="date" value={action.form.latestShipmentDate || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, latestShipmentDate: e.target.value } }))} /></Field><Field label="Margin %"><input className={input} type="number" min="0" max="100" value={action.form.marginPercent || "0"} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, marginPercent: e.target.value } }))} /></Field><Field label="Margin Amount"><input className={input} type="number" min="0" value={action.form.marginAmount || "0"} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, marginAmount: e.target.value } }))} /></Field></> : null}
      {action.type === "amend" ? <><Field label="Revised Amount"><input className={input} type="number" min="0.01" value={action.form.amount || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, amount: e.target.value } }))} /></Field><Field label="Amendment Date"><input className={input} type="date" value={action.form.amendmentDate || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, amendmentDate: e.target.value } }))} /></Field><Field label="Revised Expiry"><input className={input} type="date" value={action.form.expiryDate || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, expiryDate: e.target.value } }))} /></Field><Field label="Revised Shipment Date"><input className={input} type="date" value={action.form.latestShipmentDate || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, latestShipmentDate: e.target.value } }))} /></Field><Field label="Bank Reference"><input className={input} value={action.form.bankReference || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, bankReference: e.target.value } }))} /></Field><Field label="Reason" required><input className={input} value={action.form.reason || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, reason: e.target.value } }))} /></Field></> : null}
      {action.type === "charge" ? <><Field label="Charge Type"><select className={input} value={action.form.chargeType || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, chargeType: e.target.value } }))}>{(meta.chargeTypes || []).map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></Field><Field label="Amount" required><input className={input} type="number" min="0.01" value={action.form.amount || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, amount: e.target.value } }))} /></Field><Field label="Currency"><input className={input} value={action.form.currency || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, currency: e.target.value.toUpperCase() } }))} /></Field><Field label="Exchange Rate"><input className={input} type="number" min="0.000001" value={action.form.exchangeRate || "1"} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, exchangeRate: e.target.value } }))} /></Field><Field label="Bank Account"><select className={input} value={action.form.bankAccount || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, bankAccount: e.target.value } }))}><option value="">Use LC account</option>{bankAccounts.map((account) => <option key={account._id} value={account._id}>{relationLabel(account)}</option>)}</select></Field><Field label="Reference"><input className={input} value={action.form.reference || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, reference: e.target.value } }))} /></Field><Field label="Description"><input className={input} value={action.form.description || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, description: e.target.value } }))} /></Field><label className="flex h-11 items-center gap-2 self-end rounded-xl border border-gray-200 px-3 text-sm font-bold"><input type="checkbox" checked={action.form.capitalize !== false} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, capitalize: e.target.checked } }))} />Capitalize into import cost</label></> : null}
      {action.type === "settle" ? <><Field label="Supplier Bill" required><select className={input} value={action.form.vendorBill || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, vendorBill: e.target.value } }))}><option value="">Select posted supplier bill</option>{vendorBills.map((bill) => <option key={bill._id} value={bill._id}>{bill.billNo || bill.supplierInvoiceNo || "Vendor Bill"} · {bill.vendorName || relationLabel(bill.supplier)} · {formatMoney(bill.total || bill.dueTotal, bill.currency || action.item?.currency)}</option>)}</select></Field><Field label="Bank Account" required><select className={input} value={action.form.bankAccount || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, bankAccount: e.target.value } }))}><option value="">Select bank account</option>{bankAccounts.map((account) => <option key={account._id} value={account._id}>{relationLabel(account)}</option>)}</select></Field><Field label="Settlement Amount"><input className={input} type="number" min="0.01" value={action.form.amount || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, amount: e.target.value } }))} /></Field><Field label="Settlement Date"><input className={input} type="date" value={action.form.settledAt || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, settledAt: e.target.value } }))} /></Field><Field label="Reference"><input className={input} value={action.form.reference || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, reference: e.target.value } }))} /></Field><Field label="Note"><input className={input} value={action.form.note || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, note: e.target.value } }))} /></Field></> : null}
      {action.type === "cancel" ? <div className="sm:col-span-2"><Field label="Cancellation Reason" required><textarea className={cn(input, "h-28 py-3")} value={action.form.reason || ""} onChange={(e) => setAction((x) => ({ ...x, form: { ...x.form, reason: e.target.value } }))} /></Field><div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><Icon icon={Alert02Icon} className="mt-0.5 h-4 w-4" />LCs with posted margin, charges or settlements cannot be cancelled until those financial postings are reversed.</div></div> : null}</div>
    </Modal>
  </div>
}
