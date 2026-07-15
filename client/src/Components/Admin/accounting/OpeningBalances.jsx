"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiArchive, FiPlus, FiSave, FiTrash2 } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const button = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
const today = () => new Date().toISOString().slice(0, 10)
const newLine = () => ({ account: "", debit: "", credit: "", description: "Opening balance" })
function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) { const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Request failed"); return data }
const money = (value) => Math.round(Number(value || 0) * 100) / 100

export default function OpeningBalances() {
  const [accounts, setAccounts] = useState([])
  const [date, setDate] = useState(today())
  const [memo, setMemo] = useState("Company opening balances")
  const [lines, setLines] = useState([newLine(), newLine()])
  const [posting, setPosting] = useState(false)
  useEffect(() => { api("/accounting/accounts?limit=200").then((data) => setAccounts(data.accounts || [])).catch((error) => toast.error(error.message)) }, [])
  const totals = useMemo(() => { const debit = money(lines.reduce((sum, line) => sum + Number(line.debit || 0), 0)); const credit = money(lines.reduce((sum, line) => sum + Number(line.credit || 0), 0)); return { debit, credit, difference: money(debit - credit) } }, [lines])
  const update = (index, field, value) => setLines((current) => current.map((line, i) => i === index ? { ...line, [field]: value, ...(field === "debit" && Number(value) > 0 ? { credit: "" } : {}), ...(field === "credit" && Number(value) > 0 ? { debit: "" } : {}) } : line))
  const submit = async (event) => {
    event.preventDefault()
    if (totals.difference !== 0 || totals.debit <= 0) return toast.error("Total debit and total credit must be equal and greater than zero")
    setPosting(true)
    try {
      await api("/accounting/opening-balances", { method: "POST", body: JSON.stringify({ date, memo, lines: lines.map((line) => ({ ...line, debit: Number(line.debit || 0), credit: Number(line.credit || 0) })) }) })
      toast.success("Opening balances posted")
      setLines([newLine(), newLine()])
    } catch (error) { toast.error(error.message) } finally { setPosting(false) }
  }
  return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8"><Toaster position="top-right" />
    <div className={`${card} mb-6 p-5`}><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiArchive className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting Setup</p><h1 className="text-2xl font-black text-gray-950">Opening Balance</h1><p className="mt-1 text-sm font-semibold text-gray-500">Enter the company’s starting debit and credit balances. Posting is allowed only when both totals match.</p></div></div></div>
    <form onSubmit={submit} className={`${card} overflow-hidden`}><div className="grid grid-cols-1 gap-4 border-b border-gray-100 p-5 md:grid-cols-[220px_1fr]"><label><span className="mb-1.5 block text-sm font-extrabold">Opening Date</span><input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label><label><span className="mb-1.5 block text-sm font-extrabold">Memo</span><input className={input} value={memo} onChange={(e) => setMemo(e.target.value)} /></label></div>
      <div className="overflow-x-auto"><table className="min-w-[900px] w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Description</th><th className="w-40 px-5 py-3 text-right">Debit</th><th className="w-40 px-5 py-3 text-right">Credit</th><th className="w-20 px-5 py-3"></th></tr></thead><tbody className="divide-y divide-gray-100">{lines.map((line, index) => <tr key={index}><td className="px-5 py-3"><select className={input} value={line.account} onChange={(e) => update(index, "account", e.target.value)} required><option value="">Select account</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.code} — {account.name}</option>)}</select></td><td className="px-5 py-3"><input className={input} value={line.description} onChange={(e) => update(index, "description", e.target.value)} /></td><td className="px-5 py-3"><input className={`${input} text-right`} min="0" step="0.01" type="number" value={line.debit} onChange={(e) => update(index, "debit", e.target.value)} /></td><td className="px-5 py-3"><input className={`${input} text-right`} min="0" step="0.01" type="number" value={line.credit} onChange={(e) => update(index, "credit", e.target.value)} /></td><td className="px-5 py-3"><button className="rounded-xl p-3 text-rose-600 hover:bg-rose-50 disabled:opacity-30" type="button" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><FiTrash2 /></button></td></tr>)}</tbody><tfoot className="bg-gray-50"><tr><td colSpan="2" className="px-5 py-4"><button className={`${button} border border-gray-200 bg-white text-gray-700`} type="button" onClick={() => setLines((current) => [...current, newLine()])}><FiPlus /> Add Line</button></td><td className="px-5 py-4 text-right text-base font-black">{totals.debit.toLocaleString()}</td><td className="px-5 py-4 text-right text-base font-black">{totals.credit.toLocaleString()}</td><td /></tr></tfoot></table></div>
      <div className="flex flex-col gap-3 border-t border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div className={`rounded-xl px-4 py-2 text-sm font-black ${totals.difference === 0 && totals.debit > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{totals.difference === 0 && totals.debit > 0 ? "Balanced and ready to post" : `Difference: ${Math.abs(totals.difference).toLocaleString()} ${totals.difference > 0 ? "credit required" : "debit required"}`}</div><button className={`${button} bg-indigo-600 text-white`} type="submit" disabled={posting || totals.difference !== 0 || totals.debit <= 0}><FiSave /> {posting ? "Posting..." : "Post Opening Balance"}</button></div>
    </form>
  </div>
}
