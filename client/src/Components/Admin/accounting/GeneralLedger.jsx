"use client"

import { useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiBookOpen, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const today = () => new Date().toISOString().slice(0, 10)

function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path) { const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: headers() }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || "Request failed"); return data }
function cn(...classes) { return classes.filter(Boolean).join(" ") }
function pretty(value) { return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) }
function dateText(value) { if (!value) return "-"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) }
function money(value, currency = "BDT") { return `${currency || "BDT"} ${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}` }
function Field({ title, children }) { return <label className="block"><span className={label}>{title}</span>{children}</label> }

export default function GeneralLedger() {
  const [accounts, setAccounts] = useState([])
  const [entries, setEntries] = useState([])
  const [account, setAccount] = useState("")
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => { api("/accounting/accounts?limit=200").then((d) => setAccounts(d.accounts || [])).catch((e) => toast.error(e.message)) }, [])

  const load = async () => {
    if (!account) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ account, from, to, limit: "75" })
      const data = await api(`/accounting/general-ledger?${params.toString()}`)
      setEntries(data.entries || [])
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [account, from, to])

  const rows = entries.flatMap((entry) => (entry.lines || []).map((line) => ({ entry, line }))).filter(({ entry, line }) => !q.trim() || `${entry.entryNo} ${entry.memo} ${line.account?.name}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiBookOpen className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting</p><h1 className="text-2xl font-black text-gray-950">General Ledger</h1><p className="mt-1 text-sm font-semibold text-gray-500">Account-level ledger drilldown from posted journal lines.</p></div></div>
          <button className={cn(btn, btnGhost)} onClick={load} disabled={!account || loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <Field title="Account"><select className={input} value={account} onChange={(e) => setAccount(e.target.value)}><option value="">Select account</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}</select></Field>
          <Field title="From"><input className={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field title="To"><input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field title="Search"><div className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ledger" /></div></Field>
        </div>
        {(account || q) ? <div className="mt-3 flex flex-wrap gap-2">{account ? <button className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10" onClick={() => setAccount("")}>Account selected <FiX /></button> : null}{q ? <button className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10" onClick={() => setQ("")}>Search: {q}<FiX /></button> : null}</div> : null}
      </div>
      <div className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Date", "Entry", "Source", "Account", "Debit", "Credit", "Memo"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map(({ entry, line }) => <tr key={`${entry._id}-${line._id}`}><td className="px-5 py-4 text-sm font-bold">{dateText(entry.date)}</td><td className="px-5 py-4 text-sm font-black">{entry.entryNo || "-"}</td><td className="px-5 py-4 text-sm font-bold">{pretty(entry.sourceType)}</td><td className="px-5 py-4 text-sm font-bold">{line.account?.code} - {line.account?.name}</td><td className="px-5 py-4 text-sm font-black">{money(line.debit, entry.currency)}</td><td className="px-5 py-4 text-sm font-black">{money(line.credit, entry.currency)}</td><td className="px-5 py-4 text-sm font-semibold text-gray-600">{entry.memo || line.description || "-"}</td></tr>)}{!rows.length ? <tr><td colSpan={7} className="px-5 py-16 text-center text-sm font-bold text-gray-500">Select an account to view ledger rows.</td></tr> : null}</tbody></table></div></div>
    </div>
  )
}
