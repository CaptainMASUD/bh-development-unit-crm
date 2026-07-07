"use client"

import { useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiCheckCircle, FiGrid, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

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
function money(value) { return `BDT ${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}` }
function Badge({ value }) { return <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10">{pretty(value)}</span> }
function Field({ title, children }) { return <label className="block"><span className={label}>{title}</span>{children}</label> }
function Stat({ title, value }) { return <div className={`${card} p-4`}><p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">{title}</p><p className="mt-2 text-2xl font-black text-gray-950">{value}</p></div> }

export default function TrialBalance() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [q, setQ] = useState("")
  const [data, setData] = useState({ rows: [], totals: {} })
  const [loading, setLoading] = useState(false)
  const load = async () => {
    setLoading(true)
    try { const params = new URLSearchParams({ from, to }); setData(await api(`/accounting/trial-balance?${params.toString()}`)) } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [from, to])
  const rows = (data.rows || []).filter((r) => !q.trim() || `${r.account?.code} ${r.account?.name} ${r.account?.type}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiGrid className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting</p><h1 className="text-2xl font-black text-gray-950">Trial Balance</h1><p className="mt-1 text-sm font-semibold text-gray-500">Debit and credit proof from posted journals.</p></div></div>
          <button className={cn(btn, btnGhost)} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 lg:grid-cols-[1fr_1fr_1.5fr]">
          <Field title="From"><input className={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field title="To"><input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field title="Search"><div className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account" /></div></Field>
        </div>
        {q ? <button className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10" onClick={() => setQ("")}>Search: {q}<FiX /></button> : null}
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"><Stat title="Debits" value={money(data.totals?.debit)} /><Stat title="Credits" value={money(data.totals?.credit)} /><Stat title="Balanced" value={data.isBalanced ? "Yes" : "No"} /></div>
      <div className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Account", "Type", "Debit", "Credit", "Balance"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((r) => <tr key={r.account?._id}><td className="px-5 py-4 text-sm font-black">{r.account?.code} - {r.account?.name}</td><td className="px-5 py-4"><Badge value={r.account?.type} /></td><td className="px-5 py-4 text-sm font-black">{money(r.debit)}</td><td className="px-5 py-4 text-sm font-black">{money(r.credit)}</td><td className="px-5 py-4 text-sm font-black">{money(r.balance)}</td></tr>)}{!rows.length ? <tr><td colSpan={5} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No trial balance rows.</td></tr> : null}</tbody></table></div></div>
    </div>
  )
}
