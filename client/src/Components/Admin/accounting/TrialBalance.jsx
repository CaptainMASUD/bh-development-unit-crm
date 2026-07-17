"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import toast, { Toaster } from "react-hot-toast"
import { FiAlertCircle, FiCheckCircle, FiDownload, FiGrid, FiPrinter, FiRefreshCcw, FiSearch } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const yearStart = () => `${new Date().getFullYear()}-01-01`
const today = () => new Date().toISOString().slice(0, 10)

function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path) { const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: headers() }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || data?.error || "Request failed"); return data }
function cn(...classes) { return classes.filter(Boolean).join(" ") }
function pretty(value) { return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) }
function amount(value) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"` }

export default function TrialBalance() {
  const navigate = useNavigate()
  const location = useLocation()
  const [from, setFrom] = useState(yearStart())
  const [asOf, setAsOf] = useState(today())
  const [includeZero, setIncludeZero] = useState(false)
  const [q, setQ] = useState("")
  const [data, setData] = useState({ rows: [], groups: [], totals: {} })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { const params = new URLSearchParams({ from, asOf, includeZero: String(includeZero) }); setData(await api(`/accounting/trial-balance?${params.toString()}`)) } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [asOf, from, includeZero])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => (data.groups || []).map((group) => ({ ...group, rows: group.rows.filter((row) => !q.trim() || `${row.account?.code} ${row.account?.name} ${row.account?.type}`.toLowerCase().includes(q.toLowerCase())) })).filter((group) => group.rows.length), [data.groups, q])
  const openLedger = (accountId) => {
    const path = location.pathname.replace(/\/trial-balance(?:\/.*)?$/, "/general-ledger")
    navigate(`${path}?account=${accountId}&from=${from}&to=${asOf}`)
  }
  const exportCsv = () => {
    if (!data.rows?.length) return toast.error("No Trial Balance rows to export.")
    const rows = [["Account Code", "Account Name", "Type", "Opening Debit", "Opening Credit", "Period Debit", "Period Credit", "Closing Debit", "Closing Credit"], ...data.rows.map((row) => [row.account?.code, row.account?.name, row.account?.type, row.openingDebit, row.openingCredit, row.periodDebit, row.periodCredit, row.closingDebit, row.closingCredit])]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `trial-balance-${asOf}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-6 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <Toaster position="top-right" />
      <section className={`${card} mb-6 p-5 print:border-0 print:shadow-none`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiGrid className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting control report</p><h1 className="text-2xl font-black text-gray-950">Trial Balance</h1><p className="mt-1 text-sm font-semibold text-gray-500">Opening, period movement, and closing proof from posted vouchers.</p></div></div><div className="flex flex-wrap gap-2 print:hidden"><button className={cn(btn, btnGhost)} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button><button className={cn(btn, btnGhost)} onClick={exportCsv}><FiDownload /> Excel / CSV</button><button className={cn(btn, btnPrimary)} onClick={() => window.print()}><FiPrinter /> Print / PDF</button></div></div>
        <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-[1fr_1fr_1.4fr_auto] print:hidden"><label><span className="mb-1.5 block text-sm font-black">Period Start</span><input className={input} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><span className="mb-1.5 block text-sm font-black">As-of Date</span><input className={input} type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label><label><span className="mb-1.5 block text-sm font-black">Search</span><div className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Account code, name, or type" /></div></label><label className="flex items-end"><button type="button" className={cn(btn, includeZero ? btnPrimary : btnGhost, "h-11")} onClick={() => setIncludeZero((value) => !value)}>{includeZero ? "Showing Zero Balances" : "Hide Zero Balances"}</button></label></div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3"><article className={`${card} p-5`}><p className="text-xs font-black uppercase tracking-widest text-gray-400">Closing Debits</p><p className="mt-2 text-2xl font-black">{amount(data.totals?.closingDebit)}</p></article><article className={`${card} p-5`}><p className="text-xs font-black uppercase tracking-widest text-gray-400">Closing Credits</p><p className="mt-2 text-2xl font-black">{amount(data.totals?.closingCredit)}</p></article><article className={cn(card, "p-5", data.isBalanced ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}><div className="flex items-center gap-3">{data.isBalanced ? <FiCheckCircle className="h-7 w-7 text-emerald-600" /> : <FiAlertCircle className="h-7 w-7 text-rose-600" />}<div><p className="text-xs font-black uppercase tracking-widest text-gray-500">Validation</p><p className={cn("mt-1 text-xl font-black", data.isBalanced ? "text-emerald-700" : "text-rose-700")}>{data.isBalanced ? "Books Balanced" : `Difference ${amount(data.difference)}`}</p></div></div></article></div>

      <section className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-[11px] font-black uppercase tracking-[0.08em] text-gray-400"><tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Opening Dr</th><th className="px-4 py-3 text-right">Opening Cr</th><th className="px-4 py-3 text-right">Period Dr</th><th className="px-4 py-3 text-right">Period Cr</th><th className="px-4 py-3 text-right">Closing Dr</th><th className="px-4 py-3 text-right">Closing Cr</th></tr></thead><tbody className="divide-y divide-gray-100">
        {groups.flatMap((group) => [<tr key={`${group.type}-header`} className="bg-indigo-50/70"><td colSpan={8} className="px-4 py-3 text-sm font-black uppercase tracking-widest text-indigo-700">{pretty(group.type)}</td></tr>, ...group.rows.map((row) => <tr key={row.account?._id} className="cursor-pointer hover:bg-gray-50" onClick={() => openLedger(row.account?._id)}><td className="px-4 py-3 text-sm font-black text-indigo-700">{row.account?.code} - {row.account?.name}</td><td className="px-4 py-3 text-sm font-bold text-gray-500">{pretty(row.account?.type)}</td>{["openingDebit", "openingCredit", "periodDebit", "periodCredit", "closingDebit", "closingCredit"].map((field) => <td key={field} className="px-4 py-3 text-right text-sm font-black">{row[field] ? amount(row[field]) : "-"}</td>)}</tr>), <tr key={`${group.type}-total`} className="bg-gray-50 font-black"><td colSpan={2} className="px-4 py-3 text-sm">{pretty(group.type)} subtotal</td>{["openingDebit", "openingCredit", "periodDebit", "periodCredit", "closingDebit", "closingCredit"].map((field) => <td key={field} className="px-4 py-3 text-right text-sm">{amount(group.totals?.[field])}</td>)}</tr>])}
        {groups.length ? <tr className="bg-gray-950 text-white"><td colSpan={2} className="px-4 py-4 text-sm font-black uppercase tracking-widest">Grand Total</td>{["openingDebit", "openingCredit", "periodDebit", "periodCredit", "closingDebit", "closingCredit"].map((field) => <td key={field} className="px-4 py-4 text-right text-sm font-black">{amount(data.totals?.[field])}</td>)}</tr> : <tr><td colSpan={8} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No Trial Balance rows match the selected period.</td></tr>}
      </tbody></table></div><p className="border-t border-gray-100 px-5 py-3 text-xs font-semibold text-gray-500">Click any account to drill down into its General Ledger.</p></section>
    </div>
  )
}
