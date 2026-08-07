"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, CircleDollarSign, PackageCheck, Percent, RefreshCcw, TrendingUp, WalletCards } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import toast, { Toaster } from "react-hot-toast"
import { formatMoney, pretty, salesRequest } from "./salesApi"

const card = "rounded-2xl border border-slate-100 bg-white shadow-[0_16px_45px_-30px_rgba(15,23,42,.35)]"

export default function SalesReports() {
  const now = new Date()
  const [from, setFrom] = useState(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(now.toISOString().slice(0, 10))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to })
      const payload = await salesRequest(`/sales/reports/summary?${params}`)
      setData(payload.data)
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const lifecycle = useMemo(() => [
    ...(data?.quotations || []).map((item) => ({ name: `Quote: ${pretty(item._id)}`, count: item.count, value: item.value })),
    ...(data?.orders || []).map((item) => ({ name: `Order: ${pretty(item._id)}`, count: item.count, value: item.value })),
  ].slice(0, 12), [data])
  const summary = data?.summary || {}
  const metrics = [
    ["Invoiced", formatMoney(summary.invoiced), "Customer invoices in period", CircleDollarSign, "text-indigo-700 bg-indigo-50"],
    ["Collected", formatMoney(summary.paid), "Payments allocated", WalletCards, "text-emerald-700 bg-emerald-50"],
    ["Receivable", formatMoney(summary.due), "Outstanding balance", TrendingUp, "text-amber-700 bg-amber-50"],
    ["Net sales", formatMoney(summary.netSales), "Sales excluding output tax", BarChart3, "text-sky-700 bg-sky-50"],
    ["Gross profit", formatMoney(summary.grossProfit), `${Number(summary.grossMarginPercent || 0).toFixed(2)}% gross margin`, PackageCheck, "text-violet-700 bg-violet-50"],
    ["VAT / Tax", formatMoney(summary.tax), "Output tax recognized", Percent, "text-rose-700 bg-rose-50"],
  ]

  return <div className="min-h-full bg-[#f7f8fc] p-1 md:p-3">
    <Toaster position="top-right" />
    <header className={`${card} flex flex-col justify-between gap-5 overflow-hidden p-6 md:flex-row md:items-center md:p-8`}>
      <div><p className="text-xs font-black uppercase tracking-[.2em] text-indigo-600">Revenue intelligence</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Sales Reports</h1><p className="mt-2 text-sm text-slate-500">Analyze invoice performance, collections, receivables, COGS, gross profit, and document lifecycle.</p></div>
      <div className="flex flex-wrap items-end gap-3"><label><span className="mb-1 block text-xs font-bold text-slate-500">From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold" /></label><label><span className="mb-1 block text-xs font-bold text-slate-500">To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold" /></label><button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"><RefreshCcw size={16} /> Refresh</button></div>
    </header>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, detail, Icon, tone]) => <article key={label} className={`${card} p-5`}><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{loading ? "—" : value}</p></div><div className={`rounded-2xl p-3 ${tone}`}><Icon size={20} /></div></div><p className="mt-3 text-xs font-medium text-slate-400">{detail}</p></article>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <section className={`${card} p-5`}><h2 className="text-lg font-black text-slate-900">Document pipeline</h2><p className="text-sm text-slate-500">Quotation and order value by status</p><div className="mt-5 h-80">{loading ? <div className="h-full animate-pulse rounded-2xl bg-slate-100" /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={lifecycle}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={70} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value, name) => name === "value" ? formatMoney(value) : value} /><Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}</div></section>
      <section className={`${card} overflow-hidden`}><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-black text-slate-900">Top customers</h2><p className="text-sm text-slate-500">Ranked by invoiced value</p></div><div className="divide-y divide-slate-100">{(data?.topCustomers || []).map((item, index) => <div key={item._id} className="flex items-center justify-between gap-4 p-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-xs font-black text-indigo-700">{index + 1}</span><div><p className="font-extrabold text-slate-800">{item.customer?.companyName || item.customer?.name || "Customer"}</p><p className="text-xs text-slate-400">Due {formatMoney(item.due)}</p></div></div><p className="font-black text-slate-900">{formatMoney(item.invoiced)}</p></div>)}{!loading && !data?.topCustomers?.length ? <p className="p-8 text-center text-sm text-slate-500">No posted sales data for this period.</p> : null}</div></section>
    </div>
  </div>
}
