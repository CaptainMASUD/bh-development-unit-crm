"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiRefreshCcw, FiSave, FiSearch, FiShuffle } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"
const emptyForm = { fromAccount: "", toAccount: "", amount: "", transferDate: new Date().toISOString().slice(0, 10), reference: "", description: "" }

function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || data?.error || "Request failed")
  return data
}
function cn(...classes) { return classes.filter(Boolean).join(" ") }
function pretty(value) { return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }
function money(value, currency = "BDT") { return `${currency} ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}` }
function Field({ title, children, required = false }) { return <label className="block"><span className={label}>{title}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>{children}</label> }
function Badge({ value }) { return <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10">{pretty(value)}</span> }

export default function MoneyTransfer() {
  const [accounts, setAccounts] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [form, setForm] = useState(emptyForm)
  const accountOptions = useMemo(() => accounts.map((item) => [item._id, `${item.accountName} - ${item.accountNumber}`, item.currency || "BDT"]), [accounts])

  const loadAccounts = async () => {
    const data = await api("/banks/accounts?limit=150&status=active")
    setAccounts((data.accounts || []).filter((item) => item.ledgerAccount))
  }

  const loadRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (q.trim()) params.set("q", q.trim())
      const data = await api(`/banking/transfers?${params.toString()}`)
      setRows(data.transactions || [])
    } catch (error) {
      toast.error(error.message || "Failed to load transfers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts().catch((error) => toast.error(error.message)) }, [])
  useEffect(() => { const timer = setTimeout(loadRows, 250); return () => clearTimeout(timer) }, [q])

  const save = async (event) => {
    event.preventDefault()
    try {
      await api("/banking/transfers", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount || 0) }) })
      toast.success("Money transfer posted")
      setForm(emptyForm)
      loadRows()
    } catch (error) {
      toast.error(error.message || "Transfer failed")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiShuffle className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Banking + Accounting</p><h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Money Transfer</h1><p className="mt-1 text-sm font-semibold text-gray-500">Move money between connected bank accounts and post one balanced accounting journal.</p></div></div>
          <button className={`${btn} ${btnGhost}`} onClick={loadRows} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
        <div className="mt-5 relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transfer reference or description..." /></div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <form className={`${card} p-5`} onSubmit={save}>
          <h2 className="mb-4 text-lg font-extrabold text-gray-900">New Transfer</h2>
          <div className="grid gap-4">
            <Field title="From Account" required><select className={input} value={form.fromAccount} onChange={(e) => setForm((p) => ({ ...p, fromAccount: e.target.value }))} required><option value="">Select Account</option>{accountOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>
            <Field title="To Account" required><select className={input} value={form.toAccount} onChange={(e) => setForm((p) => ({ ...p, toAccount: e.target.value }))} required><option value="">Select Account</option>{accountOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>
            <Field title="Amount" required><input className={input} type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></Field>
            <Field title="Transfer Date" required><input className={input} type="date" value={form.transferDate} onChange={(e) => setForm((p) => ({ ...p, transferDate: e.target.value }))} required /></Field>
            <Field title="Reference"><input className={input} value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} /></Field>
            <Field title="Description"><textarea className={cn(input, "h-24 resize-none py-3")} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></Field>
            <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave /> Post Transfer</button>
          </div>
        </form>

        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Date", "From", "To", "Amount", "Reference", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => <tr key={row._id} className="hover:bg-gray-50/70"><td className="px-5 py-4 text-sm font-bold">{new Date(row.transactionDate).toLocaleDateString()}</td><td className="px-5 py-4 text-sm font-black">{row.bankAccount?.accountName || "-"}</td><td className="px-5 py-4 text-sm font-black">{row.counterpartyAccount?.accountName || "-"}</td><td className="px-5 py-4 text-sm font-black text-rose-700">{money(row.amount, row.bankAccount?.currency || "BDT")}</td><td className="px-5 py-4 text-sm font-semibold text-gray-600">{row.reference || "-"}</td><td className="px-5 py-4"><Badge value={row.status} /></td></tr>)}
              {!rows.length ? <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No transfers found.</td></tr> : null}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  )
}
