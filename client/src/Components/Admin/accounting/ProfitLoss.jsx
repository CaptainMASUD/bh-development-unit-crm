"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiBarChart2, FiChevronDown, FiChevronRight, FiDownload, FiPrinter, FiRefreshCcw, FiTrendingUp } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_38px_-28px_rgba(15,23,42,.52)]"
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
const input = "h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

const today = () => new Date().toISOString().slice(0, 10)
const yearStart = () => `${new Date().getFullYear()}-01-01`
const headers = () => { const token = localStorage.getItem("token"); return { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
const request = async (path) => { const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: headers() }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.error || "Unable to load report"); return data }
const number = (value) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = (value) => `${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
const dateText = (value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
const comparisonKeys = (value) => value === "both" ? ["priorPeriod", "priorYear"] : value === "prior_period" ? ["priorPeriod"] : value === "prior_year" ? ["priorYear"] : []
const labels = { priorPeriod: "Prior Period", priorYear: "Prior Year" }

function variance(current, previous) {
  const prior = Number(previous || 0)
  return prior ? ((Number(current || 0) - prior) / Math.abs(prior)) * 100 : null
}

function SummaryCard({ label, value, detail, tone }) {
  const tones = { indigo: "bg-indigo-50 text-indigo-700", emerald: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", violet: "bg-violet-50 text-violet-700" }
  return <article className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-gray-400">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-gray-950">{number(value)}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><FiTrendingUp /></span></div><p className="mt-2 text-xs font-bold text-gray-500">{detail}</p></article>
}

export default function ProfitLoss() {
  const [from, setFrom] = useState(yearStart())
  const [to, setTo] = useState(today())
  const [basis, setBasis] = useState("accrual")
  const [comparison, setComparison] = useState("prior_period")
  const [data, setData] = useState({ groups: [], summary: {}, periods: {}, comparisons: {} })
  const [collapsed, setCollapsed] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const columns = useMemo(() => comparisonKeys(comparison), [comparison])

  const load = useCallback(async () => {
    if (!from || !to || from > to) return setError("Select a valid report period.")
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({ from, to, basis, comparison })
      setData(await request(`/accounting/profit-loss?${params}`))
    } catch (loadError) { setError(loadError.message); toast.error(loadError.message) } finally { setLoading(false) }
  }, [basis, comparison, from, to])

  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer) }, [load])

  const toggleGroup = (key) => setCollapsed((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const openLedger = (accountId) => {
    const root = window.location.pathname.startsWith("/employee/") ? "/employee" : "/admin"
    const params = new URLSearchParams({ account: accountId, from, to })
    window.location.assign(`${root}/accounting/general-ledger?${params}`)
  }

  const calculatedRows = (groupKey) => {
    const definitions = {
      income: [["Total Income", "revenue"]],
      cogs: [["Gross Profit", "grossProfit"]],
      operating_expenses: [["Net Operating Income", "netOperatingIncome"]],
      other_expenses: [["Net Profit", "netProfit"]],
    }
    return definitions[groupKey] || []
  }

  const exportCsv = () => {
    const rows = [["Profit & Loss Statement"], [data.company?.legalName || "Company"], [`${from} to ${to}`], [], ["Account", "This Period", ...columns.flatMap((key) => [labels[key], "Variance %"]), "% of Income"]]
    for (const group of data.groups || []) {
      rows.push([group.label, group.totals?.current, ...columns.flatMap((key) => [group.totals?.[key], variance(group.totals?.current, group.totals?.[key])]), ""])
      for (const row of group.rows || []) rows.push([`${row.account?.code} - ${row.account?.name}`, row.amount, ...columns.flatMap((key) => [row.comparison?.[key], row.variancePercent?.[key]]), row.percentOfIncome])
      for (const [label, key] of calculatedRows(group.key)) rows.push([label, data.summary?.[key], ...columns.flatMap((column) => [data.comparisons?.[column]?.[key], variance(data.summary?.[key], data.comparisons?.[column]?.[key])]), key === "netProfit" ? data.summary?.netMargin : ""])
    }
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `profit-loss-${from}-${to}-${basis}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  return <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8 print:bg-white print:p-0"><Toaster position="top-right" />
    <section className={`${card} mb-6 p-5 print:border-0 print:shadow-none`}><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiBarChart2 className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Financial performance</p><h1 className="text-2xl font-black text-gray-950">Profit &amp; Loss Statement</h1><p className="mt-1 text-sm font-semibold text-gray-500">{data.company?.legalName || "Company"} · amounts in {data.company?.currency || "company currency"}</p></div></div><div className="flex flex-wrap gap-2 print:hidden"><button className={`${button} border border-gray-200 bg-white`} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} />Refresh</button><button className={`${button} border border-gray-200 bg-white`} onClick={exportCsv}><FiDownload />CSV</button><button className={`${button} bg-indigo-600 text-white`} onClick={() => window.print()}><FiPrinter />Print / PDF</button></div></div>
      <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 xl:grid-cols-4 print:hidden"><label className="text-xs font-black uppercase text-gray-500">From<input className={`${input} mt-1 w-full`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-xs font-black uppercase text-gray-500">To<input className={`${input} mt-1 w-full`} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label className="text-xs font-black uppercase text-gray-500">Accounting Basis<select className={`${input} mt-1 w-full`} value={basis} onChange={(event) => setBasis(event.target.value)}><option value="accrual">Accrual</option><option value="cash">Cash</option></select></label><label className="text-xs font-black uppercase text-gray-500">Comparison<select className={`${input} mt-1 w-full`} value={comparison} onChange={(event) => setComparison(event.target.value)}><option value="none">No Comparison</option><option value="prior_period">Prior Period</option><option value="prior_year">Prior Year Same Period</option><option value="both">Prior Period &amp; Prior Year</option></select></label></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-500"><span>{dateText(data.periods?.current?.from || from)} – {dateText(data.periods?.current?.to || to)}</span><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase text-indigo-700">{data.basis || basis} basis</span></div></section>

    {error ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total Income" value={data.summary?.revenue} detail="100% income baseline" tone="emerald" /><SummaryCard label="Gross Profit" value={data.summary?.grossProfit} detail={`${percent(data.summary?.revenue ? data.summary.grossProfit / data.summary.revenue * 100 : 0)} gross margin`} tone="indigo" /><SummaryCard label="Operating Income" value={data.summary?.netOperatingIncome} detail="After operating expenses" tone="amber" /><SummaryCard label="Net Profit" value={data.summary?.netProfit} detail={`${percent(data.summary?.netMargin)} net margin`} tone="violet" /></div>

    <section className={`${card} overflow-hidden print:border-0 print:shadow-none`}><div className="overflow-x-auto"><table className="min-w-full text-left"><thead className="border-b border-gray-200 bg-gray-50 text-xs font-black uppercase tracking-[.1em] text-gray-500"><tr><th className="min-w-[280px] px-5 py-4">Account</th><th className="px-5 py-4 text-right">This Period</th>{columns.map((key) => <th key={key} className="px-5 py-4 text-right"><span className="block">{labels[key]}</span><span className="font-semibold normal-case tracking-normal text-gray-400">{data.periods?.[key] ? `${dateText(data.periods[key].from)} – ${dateText(data.periods[key].to)}` : ""}</span></th>)}{columns.map((key) => <th key={`${key}-variance`} className="px-5 py-4 text-right">Variance</th>)}<th className="px-5 py-4 text-right">% Income</th></tr></thead><tbody className="divide-y divide-gray-100">
      {(data.groups || []).map((group) => <GroupBlock key={group.key} group={group} collapsed={collapsed.has(group.key)} columns={columns} onToggle={() => toggleGroup(group.key)} onOpenLedger={openLedger} summary={data.summary} comparisons={data.comparisons} />)}
    </tbody></table></div>{loading ? <div className="h-1 animate-pulse bg-indigo-500" /> : null}</section>
    <p className="mt-4 text-xs font-semibold text-gray-500 print:mt-8">{data.basisDescription || "Live from the General Ledger."}</p>
  </div>
}

function GroupBlock({ group, collapsed, columns, onToggle, onOpenLedger, summary, comparisons }) {
  const calculated = group.key === "cogs" ? ["Gross Profit", "grossProfit", false] : group.key === "operating_expenses" ? ["Net Operating Income", "netOperatingIncome", false] : group.key === "other_expenses" ? ["NET PROFIT", "netProfit", true] : null
  return <><GroupRows group={group} collapsed={collapsed} columns={columns} onToggle={onToggle} onOpenLedger={onOpenLedger} />{calculated ? <CalculatedRow label={calculated[0]} current={summary?.[calculated[1]]} comparisons={comparisons} valueKey={calculated[1]} columns={columns} income={summary?.revenue} strong={!calculated[2]} final={calculated[2]} /> : null}</>
}

function GroupRows({ group, collapsed, columns, onToggle, onOpenLedger }) {
  return <><tr className="bg-slate-50/80"><td className="px-5 py-3"><button type="button" className="flex items-center gap-2 font-black uppercase tracking-[.08em] text-gray-900 print:pointer-events-none" onClick={onToggle}>{collapsed ? <FiChevronRight /> : <FiChevronDown />}{group.label}</button></td><td className="px-5 py-3 text-right font-black">{number(group.totals?.current)}</td>{columns.map((key) => <td key={key} className="px-5 py-3 text-right font-black">{number(group.totals?.[key])}</td>)}{columns.map((key) => <td key={`${key}-variance`} className="px-5 py-3 text-right text-xs font-black text-gray-500">{variance(group.totals?.current, group.totals?.[key]) === null ? "–" : percent(variance(group.totals?.current, group.totals?.[key]))}</td>)}<td className="px-5 py-3" /></tr>{!collapsed ? (group.rows || []).map((row) => <tr key={row.account?._id} className="hover:bg-indigo-50/35"><td className="px-5 py-3 pl-12"><button type="button" className="text-left text-sm font-bold text-indigo-700 hover:underline" onClick={() => onOpenLedger(row.account?._id)}>{row.account?.code} - {row.account?.name}</button></td><td className="px-5 py-3 text-right text-sm font-bold">{number(row.amount)}</td>{columns.map((key) => <td key={key} className="px-5 py-3 text-right text-sm font-bold">{number(row.comparison?.[key])}</td>)}{columns.map((key) => <td key={`${key}-variance`} className={`px-5 py-3 text-right text-xs font-black ${Number(row.variancePercent?.[key]) < 0 ? "text-rose-600" : "text-emerald-700"}`}>{row.variancePercent?.[key] === null ? "–" : percent(row.variancePercent?.[key])}</td>)}<td className="px-5 py-3 text-right text-sm font-bold text-gray-500">{percent(row.percentOfIncome)}</td></tr>) : null}</>
}

function CalculatedRow({ label, current, comparisons, valueKey, columns, income, strong, final }) {
  return <tr className={final ? "border-y-2 border-gray-900 bg-indigo-50" : strong ? "bg-white" : ""}><td className={`px-5 py-4 ${final ? "text-base font-black" : "font-black"}`}>{label}</td><td className="px-5 py-4 text-right font-black">{number(current)}</td>{columns.map((key) => <td key={key} className="px-5 py-4 text-right font-black">{number(comparisons?.[key]?.[valueKey])}</td>)}{columns.map((key) => <td key={`${key}-variance`} className="px-5 py-4 text-right text-xs font-black text-gray-500">{variance(current, comparisons?.[key]?.[valueKey]) === null ? "–" : percent(variance(current, comparisons?.[key]?.[valueKey]))}</td>)}<td className="px-5 py-4 text-right font-black">{percent(Number(income) ? Number(current || 0) / Number(income) * 100 : 0)}</td></tr>
}
