"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PropTypes from "prop-types"
import toast, { Toaster } from "react-hot-toast"
import { FiCheckCircle, FiDownload, FiEdit2, FiEdit3, FiEye, FiPlus, FiRefreshCcw, FiRotateCcw, FiSave, FiSend, FiTrash2, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const today = () => new Date().toISOString().slice(0, 10)
const yearStart = () => `${new Date().getFullYear()}-01-01`
const blankLine = () => ({ account: "", debit: "", credit: "", description: "", contactType: "", contactId: "", costCenter: "", project: "", taxCode: "" })
const blankForm = () => ({ date: today(), voucherType: "journal", reference: "", memo: "", currency: "BDT", paymentMode: "", attachment: { name: "", url: "" }, lines: [blankLine(), blankLine()] })

function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) { const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || data?.error || "Request failed"); return data }
function cn(...classes) { return classes.filter(Boolean).join(" ") }
function pretty(value) { return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) }
function dateText(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) }
function amount(value) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"` }
function Badge({ value }) { const key = String(value || "").toLowerCase(); const tone = key === "posted" ? "bg-emerald-50 text-emerald-700" : key === "pending_approval" ? "bg-amber-50 text-amber-800" : key === "reversed" || key === "void" ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-700"; return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-black", tone)}>{pretty(value)}</span> }

export default function JournalEntries() {
  const [journals, setJournals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [voucherTypes, setVoucherTypes] = useState([])
  const [settings, setSettings] = useState({})
  const [costCenters, setCostCenters] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [voucherType, setVoucherType] = useState("all")
  const [from, setFrom] = useState(yearStart())
  const [to, setTo] = useState(today())
  const [editor, setEditor] = useState({ open: false, id: null })
  const [form, setForm] = useState(blankForm)
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "75", from, to })
      if (status !== "all") params.set("status", status)
      if (voucherType !== "all") params.set("voucherType", voucherType)
      if (q.trim()) params.set("q", q.trim())
      setJournals((await api(`/accounting/journals?${params.toString()}`)).journalEntries || [])
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [from, q, status, to, voucherType])

  useEffect(() => {
    Promise.all([
      api("/accounting/accounts?limit=500"),
      api("/accounting/voucher-types"),
      api("/accounting/settings"),
      api("/accounting/cost-centers?active=true").catch(() => ({ costCenters: [] }))
    ]).then(([accountData, voucherData, settingsData, ccData]) => {
      setAccounts((accountData.accounts || []).filter((account) => !account.isGroup && account.isActive !== false))
      setVoucherTypes(voucherData.voucherTypes || [])
      setSettings(settingsData.settings || {})
      setCostCenters((ccData?.costCenters || []).filter((cc) => !cc.isGroup && cc.isActive !== false))
    }).catch((error) => toast.error(error.message))
  }, [])
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer) }, [load])

  const totals = useMemo(() => {
    const debit = form.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)
    const credit = form.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0)
    return { debit, credit, difference: Math.round((debit - credit) * 100) / 100 }
  }, [form.lines])

  const openNew = () => { setForm(blankForm()); setEditor({ open: true, id: null }) }
  const openEdit = (journal) => {
    setForm({ date: new Date(journal.date).toISOString().slice(0, 10), voucherType: journal.voucherType || "journal", reference: journal.reference || "", memo: journal.memo || "", currency: journal.currency || "BDT", paymentMode: journal.paymentMode || "", attachment: journal.attachment || { name: "", url: "" }, lines: (journal.lines || []).map((line) => ({ account: line.account?._id || line.account || "", debit: line.debit || "", credit: line.credit || "", description: line.description || "", contactType: line.contactType || "", contactId: line.contactId || "", costCenter: line.costCenter?._id || line.costCenter || "", project: line.project || "", taxCode: line.taxCode || "" })) })
    setEditor({ open: true, id: journal._id })
  }
  const updateLine = (index, patch) => setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }))
  const removeLine = (index) => setForm((current) => ({ ...current, lines: current.lines.length <= 2 ? current.lines : current.lines.filter((_, lineIndex) => lineIndex !== index) }))
  const selectVoucherType = (value) => {
    const bank = settings.defaultBankAccount?._id || settings.defaultBankAccount || ""
    const cash = settings.defaultCashAccount?._id || settings.defaultCashAccount || ""
    setForm((current) => {
      const lines = current.lines.length >= 2 ? current.lines.map((line) => ({ ...line })) : [blankLine(), blankLine()]
      if (value === "payment") lines[1] = { ...lines[1], account: bank || cash, description: lines[1].description || "Cash / bank payment" }
      if (value === "receipt") lines[0] = { ...lines[0], account: bank || cash, description: lines[0].description || "Cash / bank receipt" }
      if (value === "contra") { lines[0] = { ...lines[0], account: cash, description: lines[0].description || "Transfer received" }; lines[1] = { ...lines[1], account: bank, description: lines[1].description || "Transfer paid" } }
      return { ...current, voucherType: value, lines }
    })
  }

  const save = async (desiredStatus) => {
    if (form.lines.length < 2 || totals.debit <= 0 || totals.difference !== 0) return toast.error("Debit and credit totals must be equal and greater than zero.")
    if (form.lines.some((line) => !line.account || (!Number(line.debit || 0) && !Number(line.credit || 0)) || (Number(line.debit || 0) && Number(line.credit || 0)))) return toast.error("Each line needs an account and either a debit or credit amount.")
    setSaving(true)
    try {
      const payload = { ...form, status: desiredStatus, sourceType: "manual", lines: form.lines.map((line) => ({ ...line, debit: Number(line.debit || 0), credit: Number(line.credit || 0) })) }
      if (editor.id) {
        await api(`/accounting/journals/${editor.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        if (desiredStatus === "posted") await api(`/accounting/journals/${editor.id}/submit`, { method: "PATCH", body: "{}" })
      } else await api("/accounting/journals", { method: "POST", body: JSON.stringify(payload) })
      toast.success(desiredStatus === "draft" ? "Draft journal saved" : "Journal submitted")
      setEditor({ open: false, id: null }); setForm(blankForm()); load()
    } catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }

  const runAction = async (path, message, body = {}) => {
    try { await api(path, { method: "PATCH", body: JSON.stringify(body) }); toast.success(message); load() } catch (error) { toast.error(error.message) }
  }
  const reverse = async (journal) => {
    const reason = window.prompt(`Reason for reversing ${journal.entryNo}:`, "Correction entry")
    if (reason === null) return
    const date = window.prompt("Reversal date (YYYY-MM-DD):", today())
    if (!date) return
    try { await api(`/accounting/journals/${journal._id}/reverse`, { method: "POST", body: JSON.stringify({ reason, date }) }); toast.success("Reversal journal posted"); load() } catch (error) { toast.error(error.message) }
  }
  const openDetail = async (id) => { try { setDetail((await api(`/accounting/journals/${id}`)).journalEntry) } catch (error) { toast.error(error.message) } }
  const exportCsv = () => {
    if (!journals.length) return toast.error("No journals to export.")
    const rows = [["Voucher No", "Date", "Voucher Type", "Narration", "Reference", "Debit", "Credit", "Status", "Prepared By", "Approved By"], ...journals.map((row) => [row.entryNo, dateText(row.date), pretty(row.voucherType), row.memo, row.reference, row.totalDebit, row.totalCredit, pretty(row.status), row.createdBy?.name, row.approvedBy?.name])]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "journal-vouchers.csv"; link.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <section className={`${card} mb-6 p-5`}><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiEdit3 className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Unified voucher engine</p><h1 className="text-2xl font-black text-gray-950">Journal Entries</h1><p className="mt-1 text-sm font-semibold text-gray-500">Draft, approve, post, and reverse balanced accounting vouchers.</p></div></div><div className="flex flex-wrap gap-2"><button className={cn(btn, btnGhost)} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button><button className={cn(btn, btnGhost)} onClick={exportCsv}><FiDownload /> Export</button><button className={cn(btn, btnPrimary)} onClick={openNew}><FiPlus /> New Journal</button></div></div>
        <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 lg:grid-cols-5"><input className={input} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search voucher, reference, narration" /><select className={input} value={status} onChange={(event) => setStatus(event.target.value)}>{["all", "draft", "pending_approval", "posted", "reversed", "void"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select><select className={input} value={voucherType} onChange={(event) => setVoucherType(event.target.value)}><option value="all">All Voucher Types</option>{voucherTypes.map((value) => <option key={value.key} value={value.key}>{value.code} - {value.name}</option>)}</select><input className={input} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input className={input} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
      </section>

      <section className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.1em] text-gray-400"><tr>{["Voucher", "Date", "Type", "Narration", "Prepared / Approved", "Amount", "Status", "Actions"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{journals.map((row) => <tr key={row._id} className="hover:bg-gray-50"><td className="px-4 py-3 text-sm font-black text-indigo-700">{row.entryNo || "Draft"}</td><td className="px-4 py-3 text-sm font-bold">{dateText(row.date)}</td><td className="px-4 py-3 text-sm font-bold">{pretty(row.voucherType || row.sourceType)}</td><td className="max-w-xs px-4 py-3"><p className="truncate text-sm font-bold">{row.memo || "-"}</p><p className="text-xs font-semibold text-gray-400">{row.reference || "No reference"}</p></td><td className="px-4 py-3 text-xs font-bold text-gray-600"><p>{row.createdBy?.name || (row.origin === "system" ? "System" : "-")}</p><p className="text-emerald-700">{row.approvedBy?.name ? `Approved: ${row.approvedBy.name}` : ""}</p></td><td className="px-4 py-3 text-right text-sm font-black">{amount(row.totalDebit)}</td><td className="px-4 py-3"><Badge value={row.status} /></td><td className="px-4 py-3"><div className="flex gap-2"><button className={cn(btn, btnGhost, "px-3")} onClick={() => openDetail(row._id)} title="View voucher"><FiEye /></button>{row.status === "draft" ? <><button className={cn(btn, btnGhost, "px-3")} onClick={() => openEdit(row)} title="Edit draft"><FiEdit2 /></button><button className={cn(btn, btnPrimary, "px-3")} onClick={() => runAction(`/accounting/journals/${row._id}/submit`, "Journal submitted")} title="Submit"><FiSend /></button></> : null}{row.status === "pending_approval" ? <button className={cn(btn, btnPrimary, "px-3")} onClick={() => runAction(`/accounting/journals/${row._id}/approve`, "Journal approved and posted")} title="Approve"><FiCheckCircle /></button> : null}{row.status === "posted" && row.origin === "manual" ? <button className={cn(btn, btnDanger, "px-3")} onClick={() => reverse(row)} title="Reverse"><FiRotateCcw /></button> : null}</div></td></tr>)}{!journals.length ? <tr><td colSpan={8} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No journal vouchers match the selected filters.</td></tr> : null}</tbody></table></div></section>

      {editor.open ? <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-950/55 p-4 backdrop-blur-sm"><div className="mx-auto my-4 w-full max-w-7xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-gray-100 p-5"><div><p className="text-xs font-black uppercase tracking-widest text-indigo-600">{editor.id ? "Edit draft" : "New voucher"}</p><h2 className="text-xl font-black">Journal Entry</h2><p className="text-sm font-semibold text-gray-500">Posted entries are immutable; corrections use linked reversals.</p></div><button className={cn(btn, btnGhost, "px-3")} onClick={() => setEditor({ open: false, id: null })}><FiX /></button></div>
        <div className="grid gap-4 p-5 md:grid-cols-3 xl:grid-cols-6"><Field label="Date"><input className={input} type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></Field><Field label="Voucher Type"><select className={input} value={form.voucherType} onChange={(event) => selectVoucherType(event.target.value)}>{voucherTypes.map((value) => <option key={value.key} value={value.key}>{value.code} - {value.name}</option>)}</select></Field><Field label="Reference"><input className={input} value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></Field><Field label="Currency"><input className={input} value={form.currency} maxLength={3} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></Field><Field label="Payment Mode"><select className={input} value={form.paymentMode} onChange={(event) => setForm((current) => ({ ...current, paymentMode: event.target.value }))}><option value="">Not applicable</option>{["cash", "bank", "cheque", "online", "mobile_banking", "card", "other"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></Field><Field label="Attachment URL"><input className={input} value={form.attachment?.url || ""} onChange={(event) => setForm((current) => ({ ...current, attachment: { ...current.attachment, url: event.target.value } }))} /></Field><label className="md:col-span-3 xl:col-span-6"><span className="mb-1.5 block text-sm font-black">Narration</span><textarea className={cn(input, "h-20 py-3")} value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} placeholder="Explain the business purpose of this entry" /></label></div>
        <div className="px-5 pb-5"><div className="overflow-x-auto rounded-2xl border border-gray-200"><table className="min-w-[1100px] w-full divide-y divide-gray-100"><thead className="bg-gray-50 text-xs font-black uppercase text-gray-400"><tr><th className="px-3 py-3 text-left">Account</th><th className="px-3 py-3 text-left">Description</th><th className="px-3 py-3 text-left">Cost Center</th><th className="px-3 py-3 text-left">Party Type</th><th className="px-3 py-3 text-left">Tax Code</th><th className="px-3 py-3 text-right">Debit</th><th className="px-3 py-3 text-right">Credit</th><th /></tr></thead><tbody className="divide-y divide-gray-100">{form.lines.map((line, index) => <tr key={index}><td className="p-2"><select className={input} value={line.account} onChange={(event) => updateLine(index, { account: event.target.value })}><option value="">Select leaf account</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.code} - {account.name}</option>)}</select></td><td className="p-2"><input className={input} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} /></td><td className="p-2"><select className={input} value={line.costCenter} onChange={(event) => updateLine(index, { costCenter: event.target.value })}><option value="">None</option>{costCenters.map((cc) => <option key={cc._id} value={cc._id}>{cc.code} - {cc.name}</option>)}</select></td><td className="p-2"><select className={input} value={line.contactType} onChange={(event) => updateLine(index, { contactType: event.target.value })}><option value="">None</option><option value="customer">Customer</option><option value="vendor">Supplier</option><option value="employee">Employee</option><option value="other">Other</option></select></td><td className="p-2"><input className={input} value={line.taxCode} onChange={(event) => updateLine(index, { taxCode: event.target.value.toUpperCase() })} /></td><td className="p-2"><input className={`${input} text-right`} type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(index, { debit: event.target.value, ...(Number(event.target.value) ? { credit: "" } : {}) })} /></td><td className="p-2"><input className={`${input} text-right`} type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(index, { credit: event.target.value, ...(Number(event.target.value) ? { debit: "" } : {}) })} /></td><td className="p-2"><button className={cn(btn, btnDanger, "px-3")} disabled={form.lines.length <= 2} onClick={() => removeLine(index)}><FiTrash2 /></button></td></tr>)}</tbody><tfoot className="bg-gray-50"><tr><td className="p-3" colSpan={5}><button className={cn(btn, btnGhost)} onClick={() => setForm((current) => ({ ...current, lines: [...current.lines, blankLine()] }))}><FiPlus /> Add Line</button></td><td className="p-3 text-right text-sm font-black">{amount(totals.debit)}</td><td className="p-3 text-right text-sm font-black">{amount(totals.credit)}</td><td /></tr></tfoot></table></div>
          <div className={cn("mt-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between", totals.difference === 0 && totals.debit > 0 ? "bg-emerald-50" : "bg-rose-50")}><div><p className="text-xs font-black uppercase tracking-widest text-gray-500">Live validation</p><p className={cn("text-lg font-black", totals.difference === 0 && totals.debit > 0 ? "text-emerald-700" : "text-rose-700")}>Difference: {amount(Math.abs(totals.difference))} {totals.difference === 0 && totals.debit > 0 ? "· Balanced" : "· Must be zero"}</p></div><div className="flex flex-wrap gap-2"><button className={cn(btn, btnGhost)} disabled={saving} onClick={() => save("draft")}><FiSave /> Save Draft</button><button className={cn(btn, btnPrimary)} disabled={saving || totals.difference !== 0 || totals.debit <= 0} onClick={() => save("posted")}><FiSend /> Submit / Post</button></div></div>
        </div></div></div> : null}

      {detail ? <VoucherDetail journal={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}

function Field({ label, children }) { return <label><span className="mb-1.5 block text-sm font-black">{label}</span>{children}</label> }
function VoucherDetail({ journal, onClose }) { return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-gray-100 p-5"><div><p className="text-xs font-black uppercase tracking-widest text-indigo-600">{pretty(journal.voucherType)} voucher</p><h2 className="text-xl font-black">{journal.entryNo || "Draft"}</h2><p className="text-sm font-semibold text-gray-500">{dateText(journal.date)} · {journal.memo || "No narration"}</p></div><button className={cn(btn, btnGhost, "px-3")} onClick={onClose}><FiX /></button></div><div className="grid gap-3 p-5 sm:grid-cols-4"><Meta label="Status" value={pretty(journal.status)} /><Meta label="Prepared By" value={journal.createdBy?.name || "System"} /><Meta label="Approved By" value={journal.approvedBy?.name || "-"} /><Meta label="Reference" value={journal.reference || "-"} /></div><div className="px-5 pb-5"><div className="overflow-x-auto rounded-xl border border-gray-100"><table className="min-w-full divide-y divide-gray-100"><thead className="bg-gray-50 text-xs font-black uppercase text-gray-400"><tr><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Cost Center</th><th className="px-4 py-3 text-left">Party</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead><tbody className="divide-y divide-gray-100">{journal.lines?.map((line) => <tr key={line._id}><td className="px-4 py-3 text-sm font-black">{line.account?.code} - {line.account?.name}</td><td className="px-4 py-3 text-sm font-semibold text-gray-600">{line.description || "-"}</td><td className="px-4 py-3 text-xs font-bold text-gray-600">{line.costCenter?.code ? `${line.costCenter.code} - ${line.costCenter.name}` : "-"}</td><td className="px-4 py-3 text-sm font-semibold">{pretty(line.contactType)}</td><td className="px-4 py-3 text-right text-sm font-black">{line.debit ? amount(line.debit) : "-"}</td><td className="px-4 py-3 text-right text-sm font-black">{line.credit ? amount(line.credit) : "-"}</td></tr>)}</tbody><tfoot className="bg-gray-950 text-white"><tr><td colSpan={4} className="px-4 py-3 text-sm font-black">Total</td><td className="px-4 py-3 text-right text-sm font-black">{amount(journal.totalDebit)}</td><td className="px-4 py-3 text-right text-sm font-black">{amount(journal.totalCredit)}</td></tr></tfoot></table></div>{journal.reversalOf || journal.reversedByEntry ? <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">Audit link: {journal.reversalOf ? `Reversal of ${journal.reversalOf.entryNo}` : `Reversed by ${journal.reversedByEntry?.entryNo}`}. {journal.reversalReason || ""}</div> : null}</div></div></div> }
function Meta({ label, value }) { return <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-black uppercase text-gray-400">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div> }
Badge.propTypes = { value: PropTypes.string.isRequired }
Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired }
VoucherDetail.propTypes = { journal: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired }
Meta.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node.isRequired }
