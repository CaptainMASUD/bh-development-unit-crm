"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PropTypes from "prop-types"
import toast, { Toaster } from "react-hot-toast"
import { FiBookOpen, FiCheck, FiChevronDown, FiDownload, FiEye, FiPrinter, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const monthStart = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const today = () => new Date().toISOString().slice(0, 10)

function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path) { const res = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: headers() }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || data?.error || "Request failed"); return data }
function cn(...classes) { return classes.filter(Boolean).join(" ") }
function pretty(value) { return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) }
function dateText(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) }
function amount(value) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"` }

export default function GeneralLedger() {
  const initial = new URLSearchParams(window.location.search)
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(() => (initial.get("account") || "").split(",").filter(Boolean))
  const [consolidated, setConsolidated] = useState(() => (initial.get("account") || "").includes(","))
  const [accountSearch, setAccountSearch] = useState("")
  const [from, setFrom] = useState(initial.get("from") || monthStart())
  const [to, setTo] = useState(initial.get("to") || today())
  const [voucherType, setVoucherType] = useState("all")
  const [contactType, setContactType] = useState("all")
  const [costCenters, setCostCenters] = useState([])
  const [costCenter, setCostCenter] = useState("all")
  const [q, setQ] = useState("")
  const [data, setData] = useState({ rows: [], accounts: [], totals: {} })
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    Promise.all([
      api("/accounting/accounts?limit=500&active=all"),
      api("/accounting/cost-centers?active=true").catch(() => ({ costCenters: [] }))
    ]).then(([result, ccResult]) => {
      setAccounts((result.accounts || []).filter((account) => !account.isGroup))
      setCostCenters((ccResult.costCenters || []).filter((cc) => !cc.isGroup))
    }).catch((error) => toast.error(error.message))
  }, [])

  const load = useCallback(async () => {
    if (!selected.length) { setData({ rows: [], accounts: [], totals: {} }); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ accounts: selected.join(","), from, to, limit: "2000" })
      if (voucherType !== "all") params.set("voucherType", voucherType)
      if (contactType !== "all") params.set("contactType", contactType)
      if (costCenter !== "all") params.set("costCenter", costCenter)
      if (q.trim()) params.set("q", q.trim())
      setData(await api(`/accounting/general-ledger?${params.toString()}`))
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [contactType, costCenter, from, q, selected, to, voucherType])

  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer) }, [load])

  const visibleAccounts = useMemo(() => accounts.filter((account) => !accountSearch.trim() || `${account.code} ${account.name} ${account.type}`.toLowerCase().includes(accountSearch.toLowerCase())), [accountSearch, accounts])
  const toggleAccount = (id) => setSelected((current) => consolidated ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id])
  const toggleMode = () => { setConsolidated((value) => !value); setSelected((current) => current.slice(0, 1)) }

  const exportCsv = () => {
    if (!data.rows?.length) return toast.error("No ledger rows to export.")
    const rows = [["Date", "Voucher No", "Voucher Type", "Account", "Description", "Cost Center", "Debit", "Credit", "Balance"], ...data.rows.map((row) => [dateText(row.date), row.entryNo, pretty(row.voucherType), `${row.account?.code} - ${row.account?.name}`, row.description, row.costCenter?.name || "-", row.debit, row.credit, `${row.balance} ${row.balanceSide}`])]
    const blob = new Blob([rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `general-ledger-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  const openDetail = async (id) => {
    try { setDetail((await api(`/accounting/journals/${id}`)).journalEntry) } catch (error) { toast.error(error.message) }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-6 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <Toaster position="top-right" />
      <section className={`${card} mb-6 p-5 print:border-0 print:shadow-none`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiBookOpen className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting source of truth</p><h1 className="text-2xl font-black text-gray-950">General Ledger</h1><p className="mt-1 text-sm font-semibold text-gray-500">Live posted-voucher history with opening and running balances.</p></div></div>
          <div className="flex flex-wrap gap-2 print:hidden"><button className={cn(btn, btnGhost)} onClick={load} disabled={!selected.length || loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button><button className={cn(btn, btnGhost)} onClick={exportCsv}><FiDownload /> Excel / CSV</button><button className={cn(btn, btnPrimary)} onClick={() => window.print()}><FiPrinter /> Print / PDF</button></div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 lg:grid-cols-4 xl:grid-cols-8 print:hidden">
          <details className="relative lg:col-span-2 xl:col-span-2"><summary className={`${input} flex cursor-pointer list-none items-center justify-between`}><span>{selected.length ? `${selected.length} account${selected.length === 1 ? "" : "s"} selected` : "Select ledger account"}</span><FiChevronDown /></summary><div className="absolute z-30 mt-2 max-h-80 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl"><input className={cn(input, "mb-2")} value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Search Chart of Accounts" /><div className="max-h-56 space-y-1 overflow-y-auto">{visibleAccounts.map((account) => <button type="button" key={account._id} onClick={() => toggleAccount(account._id)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-indigo-50", selected.includes(account._id) && "bg-indigo-50 text-indigo-700")}><span className={cn("flex h-5 w-5 items-center justify-center rounded border", selected.includes(account._id) ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300")}>{selected.includes(account._id) ? <FiCheck /> : null}</span><span>{account.code} - {account.name}</span></button>)}</div></div></details>
          <button type="button" className={cn(btn, consolidated ? btnPrimary : btnGhost)} onClick={toggleMode}>{consolidated ? "Consolidated On" : "Single Account"}</button>
          <input className={input} type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
          <input className={input} type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
          <div className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Voucher or narration" /></div>
          <select className={input} value={voucherType} onChange={(event) => setVoucherType(event.target.value)}><option value="all">All Voucher Types</option>{["journal", "payment", "receipt", "contra", "opening", "closing", "sales", "purchase", "payroll", "tax", "adjustment"].map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select>
          <select className={input} value={costCenter} onChange={(event) => setCostCenter(event.target.value)}><option value="all">All Cost Centers</option>{costCenters.map((cc) => <option key={cc._id} value={cc._id}>{cc.code} - {cc.name}</option>)}</select>
          <select className={input} value={contactType} onChange={(event) => setContactType(event.target.value)}><option value="all">All Parties</option><option value="customer">Customers</option><option value="vendor">Suppliers</option><option value="employee">Employees</option><option value="other">Other</option></select>
        </div>
        {selected.length ? <div className="mt-4 flex flex-wrap gap-2 print:hidden">{selected.map((id) => { const account = accounts.find((item) => item._id === id); return <button key={id} type="button" onClick={() => setSelected((current) => current.filter((item) => item !== id))} className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">{account?.code} {account?.name}<FiX /></button> })}</div> : null}
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[['Opening Balance', `${amount(data.openingBalance?.amount)} ${data.openingBalance?.side || ''}`], ['Period Debit', amount(data.totals?.debit)], ['Period Credit', amount(data.totals?.credit)], ['Closing Balance', `${amount(data.closingBalance?.amount)} ${data.closingBalance?.side || ''}`]].map(([label, value]) => <article key={label} className={`${card} p-4`}><p className="text-xs font-black uppercase tracking-[0.12em] text-gray-400">{label}</p><p className="mt-2 text-xl font-black text-gray-950">{value}</p></article>)}
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.11em] text-gray-400"><tr>{["Date", "Voucher", "Type", "Account", "Description", "Cost Center", "Debit", "Credit", "Balance", ""].map((heading) => <th key={heading || "action"} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
          {selected.length ? <tr className="bg-indigo-50/60"><td className="px-4 py-3 text-sm font-black" colSpan={6}>Opening balance as of {dateText(from)}</td><td className="px-4 py-3" /><td className="px-4 py-3" /><td className="px-4 py-3 text-sm font-black text-indigo-700">{amount(data.openingBalance?.amount)} {data.openingBalance?.side}</td><td /></tr> : null}
          {(data.rows || []).map((row) => <tr key={`${row.journalEntryId}-${row._id}`} className="hover:bg-gray-50"><td className="whitespace-nowrap px-4 py-3 text-sm font-bold">{dateText(row.date)}</td><td className="px-4 py-3 text-sm font-black text-indigo-700">{row.entryNo || "-"}</td><td className="px-4 py-3 text-sm font-bold">{pretty(row.voucherType || row.sourceType)}</td><td className="px-4 py-3 text-sm font-bold">{row.account?.code} - {row.account?.name}</td><td className="max-w-xs px-4 py-3 text-sm font-semibold text-gray-600">{row.description || row.reference || "-"}</td><td className="px-4 py-3 text-xs font-bold text-gray-600">{row.costCenter?.code ? `${row.costCenter.code} - ${row.costCenter.name}` : "-"}</td><td className="px-4 py-3 text-right text-sm font-black">{row.debit ? amount(row.debit) : "-"}</td><td className="px-4 py-3 text-right text-sm font-black">{row.credit ? amount(row.credit) : "-"}</td><td className="whitespace-nowrap px-4 py-3 text-right text-sm font-black">{amount(row.balance)} {row.balanceSide}</td><td className="px-4 py-3 print:hidden"><button className={cn(btn, btnGhost, "px-3")} onClick={() => openDetail(row.journalEntryId)} title="Open source voucher"><FiEye /></button></td></tr>)}
          {!data.rows?.length ? <tr><td colSpan={10} className="px-5 py-16 text-center text-sm font-bold text-gray-500">{selected.length ? "No posted voucher lines match these filters." : "Select a leaf account to view its General Ledger."}</td></tr> : null}
        </tbody></table></div>
        {data.pageInfo?.hasNextPage ? <p className="border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800">The report reached 2,000 vouchers. Narrow the date range for a complete export.</p> : null}
      </section>

      {detail ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-gray-100 p-5"><div><p className="text-xs font-black uppercase tracking-widest text-indigo-600">{pretty(detail.voucherType)} voucher</p><h2 className="text-xl font-black">{detail.entryNo || "Draft Journal"}</h2><p className="text-sm font-semibold text-gray-500">{dateText(detail.date)} · {detail.memo || detail.reference || "No narration"}</p></div><button className={cn(btn, btnGhost, "px-3")} onClick={() => setDetail(null)}><FiX /></button></div><div className="p-5"><div className="mb-4 grid gap-3 sm:grid-cols-3"><Info label="Status" value={pretty(detail.status)} /><Info label="Prepared By" value={detail.createdBy?.name || "System"} /><Info label="Reference" value={detail.reference || "-"} /></div><div className="overflow-x-auto rounded-xl border border-gray-100"><table className="min-w-full divide-y divide-gray-100"><thead className="bg-gray-50 text-xs font-black uppercase text-gray-400"><tr><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead><tbody className="divide-y divide-gray-100">{detail.lines?.map((line) => <tr key={line._id}><td className="px-4 py-3 text-sm font-black">{line.account?.code} - {line.account?.name}</td><td className="px-4 py-3 text-sm font-semibold text-gray-600">{line.description || "-"}</td><td className="px-4 py-3 text-right text-sm font-black">{line.debit ? amount(line.debit) : "-"}</td><td className="px-4 py-3 text-right text-sm font-black">{line.credit ? amount(line.credit) : "-"}</td></tr>)}</tbody></table></div></div></div></div> : null}
    </div>
  )
}

function Info({ label, value }) { return <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-black uppercase text-gray-400">{label}</p><p className="mt-1 text-sm font-black text-gray-800">{value}</p></div> }
Info.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node.isRequired }
