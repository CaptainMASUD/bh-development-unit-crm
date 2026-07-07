"use client"

import { useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiLayers, FiRefreshCcw } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const today = () => new Date().toISOString().slice(0, 10)
function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path) { const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: headers() }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || "Request failed"); return data }
function money(value) { return `BDT ${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}` }

export default function BalanceSheet() {
  const [to, setTo] = useState(today())
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const load = async () => { setLoading(true); try { setData(await api(`/accounting/balance-sheet?to=${to}`)) } catch (e) { toast.error(e.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [to])
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiLayers className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting</p><h1 className="text-2xl font-black text-gray-950">Balance Sheet</h1><p className="mt-1 text-sm font-semibold text-gray-500">Assets, liabilities, and equity as of a selected date.</p></div></div>
          <button className={`${btn} ${btnGhost}`} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
        <div className="mt-5 border-t border-gray-100 pt-4"><input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"><Stat title="Assets" value={money(data.totals?.assets)} /><Stat title="Liabilities" value={money(data.totals?.liabilities)} /><Stat title="Equity" value={money(data.totals?.equity)} /></div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><Group title="Assets" rows={data.assets || []} /><Group title="Liabilities" rows={data.liabilities || []} /><Group title="Equity" rows={data.equity || []} /></div>
    </div>
  )
}
function Stat({ title, value }) { return <div className={`${card} p-4`}><p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">{title}</p><p className="mt-2 text-2xl font-black text-gray-950">{value}</p></div> }
function Group({ title, rows }) { return <div className={`${card} p-5`}><h3 className="text-base font-black text-gray-950">{title}</h3><div className="mt-4 divide-y divide-gray-100">{rows.length ? rows.map((r) => <div key={r.account?._id} className="flex justify-between gap-3 py-3"><span className="text-sm font-bold text-gray-600">{r.account?.code} - {r.account?.name}</span><span className="text-sm font-black">{money(r.balance)}</span></div>) : <p className="py-8 text-sm font-bold text-gray-500">No rows</p>}</div></div> }
