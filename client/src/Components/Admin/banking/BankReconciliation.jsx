"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiCheckCircle, FiRefreshCcw, FiSave } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"
const emptyForm = { bankAccount: "", statementDate: new Date().toISOString().slice(0, 10), statementBalance: "", status: "draft", notes: "" }

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
function Badge({ value }) {
  const key = String(value || "").toLowerCase()
  const style = key === "reconciled" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" : key === "void" ? "bg-rose-50 text-rose-700 ring-rose-600/10" : "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", style)}>{pretty(value)}</span>
}

export default function BankReconciliation() {
  const [accounts, setAccounts] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("all")
  const [bankAccount, setBankAccount] = useState("all")
  const [form, setForm] = useState(emptyForm)
  const accountOptions = useMemo(() => accounts.map((item) => [item._id, `${item.accountName} - ${item.accountNumber}`, item.currency || "BDT"]), [accounts])

  const loadAccounts = async () => {
    const data = await api("/banks/accounts?limit=150&status=active")
    setAccounts(data.accounts || [])
  }

  const loadRows = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "75" })
      if (status !== "all") params.set("status", status)
      if (bankAccount !== "all") params.set("bankAccount", bankAccount)
      const data = await api(`/banking/reconciliations?${params.toString()}`)
      setRows(data.reconciliations || [])
    } catch (error) {
      toast.error(error.message || "Failed to load reconciliations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts().catch((error) => toast.error(error.message)) }, [])
  useEffect(() => { loadRows() }, [status, bankAccount])

  const save = async (event) => {
    event.preventDefault()
    try {
      await api("/banking/reconciliations", { method: "POST", body: JSON.stringify({ ...form, statementBalance: Number(form.statementBalance || 0) }) })
      toast.success("Reconciliation saved")
      setForm(emptyForm)
      loadRows()
    } catch (error) {
      toast.error(error.message || "Save failed")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiCheckCircle className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Banking</p><h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Bank Reconciliation</h1><p className="mt-1 text-sm font-semibold text-gray-500">Compare statement balance with book balance and lock matched checkpoints.</p></div></div>
          <button className={`${btn} ${btnGhost}`} onClick={loadRows} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
          <select className={input} value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}><option value="all">All Accounts</option>{accountOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Status</option><option value="draft">Draft</option><option value="reconciled">Reconciled</option><option value="void">Void</option></select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form className={`${card} p-5`} onSubmit={save}>
          <h2 className="mb-4 text-lg font-extrabold text-gray-900">New Reconciliation</h2>
          <div className="grid gap-4">
            <Field title="Bank Account" required><select className={input} value={form.bankAccount} onChange={(e) => setForm((p) => ({ ...p, bankAccount: e.target.value }))} required><option value="">Select Account</option>{accountOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>
            <Field title="Statement Date" required><input className={input} type="date" value={form.statementDate} onChange={(e) => setForm((p) => ({ ...p, statementDate: e.target.value }))} required /></Field>
            <Field title="Statement Balance" required><input className={input} type="number" step="0.01" value={form.statementBalance} onChange={(e) => setForm((p) => ({ ...p, statementBalance: e.target.value }))} required /></Field>
            <Field title="Status" required><select className={input} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} required><option value="draft">Draft</option><option value="reconciled">Reconciled</option></select></Field>
            <Field title="Notes"><textarea className={cn(input, "h-24 resize-none py-3")} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
            <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave /> Save Reconciliation</button>
          </div>
        </form>

        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Date", "Account", "Statement", "Book", "Difference", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => <tr key={row._id} className="hover:bg-gray-50/70"><td className="px-5 py-4 text-sm font-bold">{new Date(row.statementDate).toLocaleDateString()}</td><td className="px-5 py-4"><div className="text-sm font-black">{row.bankAccount?.accountName || "-"}</div><div className="text-xs font-semibold text-gray-500">{row.bankAccount?.bank?.shortName || ""} {row.bankAccount?.accountNumber || ""}</div></td><td className="px-5 py-4 text-sm font-black">{money(row.statementBalance, row.bankAccount?.currency || "BDT")}</td><td className="px-5 py-4 text-sm font-black">{money(row.bookBalance, row.bankAccount?.currency || "BDT")}</td><td className={cn("px-5 py-4 text-sm font-black", Number(row.difference || 0) === 0 ? "text-emerald-700" : "text-rose-700")}>{money(row.difference, row.bankAccount?.currency || "BDT")}</td><td className="px-5 py-4"><Badge value={row.status} /></td></tr>)}
              {!rows.length ? <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No reconciliations found.</td></tr> : null}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  )
}
