"use client"

import { useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiDownload, FiEdit3, FiRefreshCcw, FiSave, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"
const today = () => new Date().toISOString().slice(0, 10)

function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) { const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || data?.error || "Request failed"); return data }
function cn(...classes) { return classes.filter(Boolean).join(" ") }
function pretty(value) { return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) }
function dateText(value) { if (!value) return "-"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) }
function money(value, currency = "BDT") { return `${currency || "BDT"} ${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}` }
function Badge({ value }) { const key = String(value || "").toLowerCase(); const cls = key === "posted" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" : key === "void" ? "bg-rose-50 text-rose-700 ring-rose-600/10" : "bg-gray-100 text-gray-700 ring-gray-600/10"; return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", cls)}>{pretty(value)}</span> }
function Field({ title, children }) { return <label className="block"><span className={label}>{title}</span>{children}</label> }

export default function JournalEntries() {
  const [journals, setJournals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [form, setForm] = useState({ date: today(), memo: "", debitAccount: "", creditAccount: "", amount: "" })

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "75" })
      if (status !== "all") params.set("status", status)
      const data = await api(`/accounting/journals?${params.toString()}`)
      setJournals(data.journalEntries || [])
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }

  const loadAccounts = async () => {
    try { const data = await api("/accounting/accounts?limit=200"); setAccounts(data.accounts || []) } catch (error) { toast.error(error.message) }
  }

  useEffect(() => { load(); loadAccounts() }, [status])
  const visible = journals.filter((j) => !q.trim() || `${j.entryNo} ${j.memo} ${j.reference} ${j.sourceType}`.toLowerCase().includes(q.toLowerCase()))

  const post = async (event) => {
    event.preventDefault()
    try {
      await api("/accounting/journals", { method: "POST", body: JSON.stringify({ date: form.date, memo: form.memo, lines: [{ account: form.debitAccount, debit: Number(form.amount || 0), credit: 0 }, { account: form.creditAccount, debit: 0, credit: Number(form.amount || 0) }] }) })
      toast.success("Journal posted")
      setForm({ date: today(), memo: "", debitAccount: "", creditAccount: "", amount: "" })
      load()
    } catch (error) { toast.error(error.message) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiEdit3 className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting</p><h1 className="text-2xl font-black text-gray-950">Journal Entries</h1><p className="mt-1 text-sm font-semibold text-gray-500">Post balanced debit and credit entries.</p></div></div>
          <div className="flex flex-wrap gap-2"><button className={cn(btn, btnGhost)} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button><button className={cn(btn, btnGhost)} onClick={() => toast.success("Use browser table copy for now")}><FiDownload /> Export</button></div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 lg:grid-cols-[1fr_220px]">
          <div className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search journal number, memo, source" /></div>
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>{["all", "draft", "posted", "void"].map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select>
        </div>
        {(q || status !== "all") ? <div className="mt-3 flex flex-wrap gap-2">{q ? <button className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10" onClick={() => setQ("")}>Search: {q}<FiX /></button> : null}{status !== "all" ? <button className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10" onClick={() => setStatus("all")}>Status: {pretty(status)}<FiX /></button> : null}</div> : null}
      </div>

      <form onSubmit={post} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Field title="Date"><input className={input} type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></Field>
          <Field title="Debit Account"><AccountSelect accounts={accounts} value={form.debitAccount} onChange={(v) => setForm((p) => ({ ...p, debitAccount: v }))} /></Field>
          <Field title="Credit Account"><AccountSelect accounts={accounts} value={form.creditAccount} onChange={(v) => setForm((p) => ({ ...p, creditAccount: v }))} /></Field>
          <Field title="Amount"><input className={input} type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></Field>
          <div className="flex items-end"><button className={cn(btn, btnPrimary, "h-11 w-full")} type="submit"><FiSave /> Post</button></div>
        </div>
      </form>

      <div className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Entry", "Date", "Source", "Memo", "Debit", "Credit", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{visible.map((row) => <tr key={row._id}><td className="px-5 py-4 text-sm font-black">{row.entryNo || "-"}</td><td className="px-5 py-4 text-sm font-bold">{dateText(row.date)}</td><td className="px-5 py-4 text-sm font-bold">{pretty(row.sourceType)}</td><td className="px-5 py-4 text-sm font-semibold text-gray-600">{row.memo || row.reference || "-"}</td><td className="px-5 py-4 text-sm font-black">{money(row.totalDebit, row.currency)}</td><td className="px-5 py-4 text-sm font-black">{money(row.totalCredit, row.currency)}</td><td className="px-5 py-4"><Badge value={row.status} /></td></tr>)}{!visible.length ? <tr><td colSpan={7} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No journal entries found.</td></tr> : null}</tbody></table></div></div>
    </div>
  )
}

function AccountSelect({ accounts, value, onChange }) {
  return <select className={input} value={value} onChange={(e) => onChange(e.target.value)} required><option value="">Select account</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}</select>
}
