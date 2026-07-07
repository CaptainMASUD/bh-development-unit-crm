"use client"

import { useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiArchive, FiSave } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"
const today = () => new Date().toISOString().slice(0, 10)
function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) { const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.message || "Request failed"); return data }
function Field({ title, children, hint }) { return <label className="block"><span className={label}>{title}</span>{children}{hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}</label> }

export default function OpeningBalances() {
  const [accounts, setAccounts] = useState([])
  const [form, setForm] = useState({ date: today(), account: "", side: "debit", amount: "", memo: "" })
  useEffect(() => { api("/accounting/accounts?limit=200").then((d) => setAccounts(d.accounts || [])).catch((e) => toast.error(e.message)) }, [])
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api("/accounting/opening-balances", { method: "POST", body: JSON.stringify({ date: form.date, memo: form.memo, lines: [{ account: form.account, debit: form.side === "debit" ? Number(form.amount || 0) : 0, credit: form.side === "credit" ? Number(form.amount || 0) : 0 }] }) })
      toast.success("Opening balance posted")
      setForm({ date: today(), account: "", side: "debit", amount: "", memo: "" })
    } catch (error) { toast.error(error.message) }
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5`}>
        <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiArchive className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting</p><h1 className="text-2xl font-black text-gray-950">Opening Balances</h1><p className="mt-1 text-sm font-semibold text-gray-500">Post initial balances with automatic opening balance equity.</p></div></div>
      </div>
      <form onSubmit={submit} className={`${card} p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Field title="Date"><input className={input} type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></Field>
          <Field title="Account"><select className={input} value={form.account} onChange={(e) => setForm((p) => ({ ...p, account: e.target.value }))} required><option value="">Select account</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.code} - {a.name}</option>)}</select></Field>
          <Field title="Side"><select className={input} value={form.side} onChange={(e) => setForm((p) => ({ ...p, side: e.target.value }))}><option value="debit">Debit</option><option value="credit">Credit</option></select></Field>
          <Field title="Amount"><input className={input} type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></Field>
          <div className="flex items-end"><button className={`${btn} ${btnPrimary} h-11 w-full`} type="submit"><FiSave /> Post</button></div>
        </div>
        <div className="mt-4"><Field title="Memo" hint="Opening balance equity is added automatically if the entry needs balancing."><input className={input} value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))} placeholder="Opening balances" /></Field></div>
      </form>
    </div>
  )
}
