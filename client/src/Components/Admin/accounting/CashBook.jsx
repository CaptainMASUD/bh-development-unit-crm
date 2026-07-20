"use client"
/* eslint-disable react/prop-types -- internal report components receive server-defined accounting shapes */

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiArrowDownLeft, FiArrowUpRight, FiBookOpen, FiDownload, FiEye, FiPrinter, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-slate-100 bg-white shadow-[0_16px_40px_-30px_rgba(15,23,42,.5)]"
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
const input = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const headers = () => { const token = localStorage.getItem("token"); return { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
const api = async (path) => { const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: headers() }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || data.error || "Request failed"); return data }
const amount = (value) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateText = (value) => value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "-"
const pretty = (value) => String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
const dateInput = (date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}` }
const today = () => dateInput(new Date())
const monthStart = () => { const date = new Date(); date.setDate(1); return dateInput(date) }
const signedBalance = (value) => `${amount(Math.abs(Number(value || 0)))} ${Number(value || 0) >= 0 ? "Dr" : "Cr"}`

function Metric({ label, value, detail, tone = "indigo", icon }) {
  const tones = { indigo: "bg-indigo-50 text-indigo-700", emerald: "bg-emerald-50 text-emerald-700", rose: "bg-rose-50 text-rose-700", sky: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700" }
  return <article className={`${card} p-5`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</span></div><p className="mt-2 text-xs font-bold text-slate-500">{detail}</p></article>
}

export default function CashBook() {
  const [scope, setScope] = useState("all")
  const [account, setAccount] = useState("")
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [voucherType, setVoucherType] = useState("all")
  const [q, setQ] = useState("")
  const [data, setData] = useState({ accounts: [], selectedAccounts: [], rows: [], summary: {} })
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    if (scope === "account" && !account) return
    if (!from || !to || from > to) return toast.error("Select a valid date range.")
    setLoading(true)
    try {
      const params = new URLSearchParams({ scope, from, to, limit: "3000" }); if (scope === "account") params.set("account", account); if (voucherType !== "all") params.set("voucherType", voucherType); if (q.trim()) params.set("q", q.trim())
      setData(await api(`/accounting/cash-book?${params}`))
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [account, from, q, scope, to, voucherType])
  useEffect(() => { const timer = setTimeout(load, 220); return () => clearTimeout(timer) }, [load])

  const accounts = useMemo(() => data.accounts || [], [data.accounts])
  const activeAccount = useMemo(() => accounts.find((item) => String(item.ledger?._id) === account), [account, accounts])
  const setPreset = (preset) => {
    const end = new Date(); const start = new Date(end)
    if (preset === "today") start.setHours(0, 0, 0, 0)
    if (preset === "week") start.setDate(end.getDate() - ((end.getDay() + 6) % 7))
    if (preset === "month") start.setDate(1)
    if (preset === "quarter") start.setMonth(Math.floor(end.getMonth() / 3) * 3, 1)
    setFrom(dateInput(start)); setTo(dateInput(end))
  }
  const changeScope = (value) => { setScope(value); if (value !== "account") setAccount("") }
  const selectAccount = (value) => { setAccount(value); if (value) setScope("account"); else setScope("all") }
  const openVoucher = async (id) => { try { setDetail((await api(`/accounting/journals/${id}`)).journalEntry) } catch (error) { toast.error(error.message) } }
  const exportCsv = () => {
    const rows = [["Cash Book"], [`${from} to ${to}`], [], ["Date", "Voucher No.", "Voucher Type", "Account", "Particulars", "Cash In", "Cash Out", "Bank In", "Bank Out", "Balance"], [from, "OB", "Opening", "", "Opening Balance", "", "", "", "", signedBalance(data.openingBalance)], ...(data.rows || []).map((row) => [dateText(row.date), row.entryNo, pretty(row.voucherType), row.accounts?.map((item) => item.name).join(" / "), row.particulars || row.reference, row.cashIn, row.cashOut, row.bankIn, row.bankOut, signedBalance(row.balance)]), [to, "CB", "Closing", "", "Closing Balance", "", "", "", "", signedBalance(data.closingBalance)]]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `cash-book-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  const summary = data.summary || {}

  return <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8 print:bg-white print:p-0"><Toaster position="top-right" />
    <header className={`${card} mb-6 p-5 sm:p-6 print:border-0 print:shadow-none`}><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiBookOpen className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Treasury movement report</p><h1 className="text-2xl font-black text-slate-950">Cash Book</h1><p className="mt-1 text-sm font-semibold text-slate-500">Every posted cash and bank movement with opening, running, and closing balances.</p></div></div><div className="flex flex-wrap gap-2 print:hidden"><button className={`${button} border border-slate-200 bg-white`} onClick={load}><FiRefreshCcw className={loading ? "animate-spin" : ""} />Refresh</button><button className={`${button} border border-slate-200 bg-white`} onClick={exportCsv}><FiDownload />Excel / CSV</button><button className={`${button} bg-indigo-600 text-white`} onClick={() => window.print()}><FiPrinter />Print / PDF</button></div></div>
      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 xl:grid-cols-6 print:hidden"><select className={`${input} w-full`} value={scope} onChange={(event) => changeScope(event.target.value)}><option value="all">All Cash &amp; Bank</option><option value="cash">Cash Only</option><option value="bank">Bank Only</option>{account ? <option value="account">Specific Account</option> : null}</select><select className={`${input} w-full xl:col-span-2`} value={account} onChange={(event) => selectAccount(event.target.value)}><option value="">All treasury accounts</option>{accounts.map((item) => <option key={`${item.kind}-${item.ledger?._id}`} value={item.ledger?._id}>{item.kind === "cash" ? "Cash" : "Bank"} - {item.name} ({item.ledger?.code})</option>)}</select><input className={`${input} w-full`} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input className={`${input} w-full`} type="date" value={to} onChange={(event) => setTo(event.target.value)} /><select className={`${input} w-full`} value={voucherType} onChange={(event) => setVoucherType(event.target.value)}><option value="all">All vouchers</option>{["receipt", "payment", "contra", "journal", "opening", "sales", "purchase", "payroll", "tax", "adjustment"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select><div className="relative xl:col-span-2"><FiSearch className="absolute left-3 top-3.5 text-slate-400" /><input className={`${input} w-full pl-10`} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Voucher or particulars" /></div><div className="flex flex-wrap gap-2 xl:col-span-4">{[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["quarter", "This Quarter"]].map(([value, label]) => <button key={value} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => setPreset(value)}>{label}</button>)}</div></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-500"><span>{dateText(from)} - {dateText(to)}</span><span>{activeAccount ? `${activeAccount.name} (${activeAccount.ledger?.code})` : scope === "cash" ? "All cash accounts" : scope === "bank" ? "All bank accounts" : "Combined cash and bank"}</span></div></header>

    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Total Cash In" value={amount(summary.cashIn)} detail="Cash account debits" tone="emerald" icon={<FiArrowDownLeft />} /><Metric label="Total Cash Out" value={amount(summary.cashOut)} detail="Cash account credits" tone="rose" icon={<FiArrowUpRight />} /><Metric label="Total Bank In" value={amount(summary.bankIn)} detail="Bank account debits" tone="sky" icon={<FiArrowDownLeft />} /><Metric label="Total Bank Out" value={amount(summary.bankOut)} detail="Bank account credits" tone="amber" icon={<FiArrowUpRight />} /><Metric label="Net Movement" value={signedBalance(summary.netMovement)} detail={`Closing ${signedBalance(data.closingBalance)}`} icon={<FiBookOpen />} /></div>

    {(data.selectedAccounts || []).length > 1 ? <section className={`${card} mb-6 p-4 print:hidden`}><p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Account closing balances</p><div className="flex flex-wrap gap-2">{data.selectedAccounts.map((item) => <button key={item.ledger?._id} onClick={() => selectAccount(item.ledger?._id)} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"><span className="block font-black text-slate-900">{item.name}</span>{signedBalance(item.closingBalance)}</button>)}</div></section> : null}

    <section className={`${card} overflow-hidden print:border-0 print:shadow-none`}><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-xs font-black uppercase tracking-[.08em] text-slate-500"><tr><th className="px-4 py-4 text-left">Date</th><th className="px-4 py-4 text-left">Voucher No.</th><th className="px-4 py-4 text-left">Particulars</th><th className="px-4 py-4 text-right">Cash In</th><th className="px-4 py-4 text-right">Cash Out</th><th className="px-4 py-4 text-right">Bank In</th><th className="px-4 py-4 text-right">Bank Out</th><th className="px-4 py-4 text-right">Balance</th><th className="px-4 py-4 print:hidden" /></tr></thead><tbody className="divide-y divide-slate-100"><tr className="bg-indigo-50/70"><td className="px-4 py-4 font-bold">{dateText(from)}</td><td className="px-4 py-4 font-black">OB</td><td className="px-4 py-4 font-black" colSpan="5">Opening Balance</td><td className="px-4 py-4 text-right font-black text-indigo-700">{signedBalance(data.openingBalance)}</td><td className="print:hidden" /></tr>{(data.rows || []).map((row) => <tr key={row.journalEntryId} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-3 font-bold">{dateText(row.date)}</td><td className="px-4 py-3"><button className="font-black text-indigo-700 hover:underline" onClick={() => openVoucher(row.journalEntryId)}>{row.entryNo || "-"}</button><span className="mt-0.5 block text-xs font-bold text-slate-400">{pretty(row.voucherType)}</span></td><td className="max-w-sm px-4 py-3"><p className="font-bold text-slate-800">{row.particulars || row.reference || "-"}</p><p className="mt-0.5 text-xs font-semibold text-slate-400">{row.accounts?.map((item) => `${item.kind === "cash" ? "Cash" : "Bank"}: ${item.name}`).join(" / ")}</p></td>{[row.cashIn, row.cashOut, row.bankIn, row.bankOut].map((value, index) => <td key={index} className="px-4 py-3 text-right font-black">{value ? amount(value) : "-"}</td>)}<td className="whitespace-nowrap px-4 py-3 text-right font-black">{signedBalance(row.balance)}</td><td className="px-4 py-3 print:hidden"><button className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700" onClick={() => openVoucher(row.journalEntryId)} title="Open source voucher"><FiEye /></button></td></tr>)}{!(data.rows || []).length ? <tr><td colSpan="9" className="px-5 py-14 text-center font-bold text-slate-400">No posted cash or bank movements match this selection.</td></tr> : null}<tr className="border-t-2 border-slate-900 bg-slate-50"><td className="px-4 py-4 font-bold">{dateText(to)}</td><td className="px-4 py-4 font-black">CB</td><td className="px-4 py-4 font-black">Closing Balance</td>{[summary.cashIn, summary.cashOut, summary.bankIn, summary.bankOut].map((value, index) => <td key={index} className="px-4 py-4 text-right font-black">{amount(value)}</td>)}<td className="px-4 py-4 text-right font-black">{signedBalance(data.closingBalance)}</td><td className="print:hidden" /></tr></tbody></table></div>{data.pageInfo?.hasNextPage ? <p className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800">The report reached 3,000 vouchers. Narrow the date range for a complete export.</p> : null}</section>
    <p className="mt-4 text-xs font-semibold text-slate-500">{data.basis || "Derived from posted treasury voucher lines."}</p>
    {detail ? <VoucherModal detail={detail} onClose={() => setDetail(null)} /> : null}
  </div>
}

function VoucherModal({ detail, onClose }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`${card} max-h-[92vh] w-full max-w-4xl overflow-auto p-5 sm:p-6`}><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-indigo-600">{pretty(detail.voucherType)} voucher</p><h2 className="text-xl font-black">{detail.entryNo}</h2><p className="text-sm font-semibold text-slate-500">{dateText(detail.date)} - {detail.memo || detail.reference || "No particulars"}</p></div><button className="rounded-xl p-2 hover:bg-slate-100" onClick={onClose}><FiX /></button></div><div className="overflow-x-auto rounded-xl border border-slate-100"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead><tbody className="divide-y divide-slate-100">{detail.lines?.map((line) => <tr key={line._id}><td className="px-4 py-3 font-black">{line.account?.code} - {line.account?.name}</td><td className="px-4 py-3">{line.description || "-"}</td><td className="px-4 py-3 text-right font-black">{line.debit ? amount(line.debit) : "-"}</td><td className="px-4 py-3 text-right font-black">{line.credit ? amount(line.credit) : "-"}</td></tr>)}</tbody></table></div></section></div> }
