"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiDownload, FiLayers, FiPlus, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnSoft = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10 hover:bg-indigo-100"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"

function headers() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || data?.error || "Request failed")
  return data
}

function pretty(value) {
  return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function Badge({ value }) {
  const key = String(value || "").toLowerCase()
  const styles = {
    asset: "bg-sky-50 text-sky-700 ring-sky-600/10",
    liability: "bg-amber-50 text-amber-700 ring-amber-600/10",
    equity: "bg-violet-50 text-violet-700 ring-violet-600/10",
    revenue: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    expense: "bg-rose-50 text-rose-700 ring-rose-600/10",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
    inactive: "bg-gray-100 text-gray-700 ring-gray-600/10",
  }
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", styles[key] || "bg-gray-100 text-gray-700 ring-gray-600/10")}>{pretty(value)}</span>
}

function Field({ title, children }) {
  return <label className="block"><span className={label}>{title}</span>{children}</label>
}

function exportCsv(rows) {
  if (!rows.length) return toast.error("No rows to export")
  const csv = [
    "code,name,type,normalBalance,status",
    ...rows.map((r) => [r.code, r.name, r.type, r.normalBalance, r.isActive ? "active" : "inactive"].map((v) => JSON.stringify(v ?? "")).join(",")),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "chart-of-accounts.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [type, setType] = useState("all")
  const [form, setForm] = useState({ code: "", name: "", type: "asset" })

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "200", active: "all" })
      if (type !== "all") params.set("type", type)
      if (q.trim()) params.set("q", q.trim())
      const data = await api(`/accounting/accounts?${params.toString()}`)
      setAccounts(data.accounts || [])
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadAccounts, 250)
    return () => clearTimeout(timer)
  }, [q, type])

  const activeFilters = useMemo(() => [type !== "all" ? ["Type", pretty(type), () => setType("all")] : null, q ? ["Search", q, () => setQ("")] : null].filter(Boolean), [type, q])

  const bootstrap = async () => {
    try {
      await api("/accounting/accounts/bootstrap", { method: "POST", body: JSON.stringify({}) })
      toast.success("Default chart created")
      loadAccounts()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const createAccount = async (event) => {
    event.preventDefault()
    try {
      await api("/accounting/accounts", { method: "POST", body: JSON.stringify(form) })
      toast.success("Account created")
      setForm({ code: "", name: "", type: "asset" })
      loadAccounts()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><FiLayers className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting</p>
              <h1 className="text-2xl font-black tracking-tight text-gray-950">Chart of Accounts</h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">Assets, liabilities, equity, revenue, and expense accounts.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={cn(btn, btnSoft)} onClick={bootstrap} type="button"><FiRefreshCcw /> Bootstrap</button>
            <button className={cn(btn, btnGhost)} onClick={() => exportCsv(accounts)} type="button"><FiDownload /> Export</button>
            <button className={cn(btn, btnGhost)} onClick={loadAccounts} disabled={loading} type="button"><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <FiSearch className="absolute left-3 top-3.5 text-gray-400" />
            <input className={cn(input, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code or account name" />
          </div>
          <select className={input} value={type} onChange={(e) => setType(e.target.value)}>
            {["all", "asset", "liability", "equity", "revenue", "expense"].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
          </select>
        </div>
        {activeFilters.length ? <div className="mt-3 flex flex-wrap gap-2">{activeFilters.map(([name, value, clear]) => <button key={name} className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10" onClick={clear} type="button"><span>{name}: {value}</span><FiX /></button>)}</div> : null}
      </div>

      <form onSubmit={createAccount} className={`${card} mb-6 p-5`}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr_1fr_auto]">
          <Field title="Code"><input className={input} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required /></Field>
          <Field title="Name"><input className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></Field>
          <Field title="Type"><select className={input} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>{["asset", "liability", "equity", "revenue", "expense"].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></Field>
          <div className="flex items-end"><button className={cn(btn, btnPrimary, "h-11")} type="submit"><FiPlus /> Add</button></div>
        </div>
      </form>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Code", "Account", "Type", "Normal", "System", "Status"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((row) => (
                <tr key={row._id} className="hover:bg-gray-50/60">
                  <td className="px-5 py-4 text-sm font-black text-gray-950">{row.code}</td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-800">{row.name}</td>
                  <td className="px-5 py-4"><Badge value={row.type} /></td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-600">{pretty(row.normalBalance)}</td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-600">{row.isSystem ? "Yes" : "No"}</td>
                  <td className="px-5 py-4"><Badge value={row.isActive ? "active" : "inactive"} /></td>
                </tr>
              ))}
              {!accounts.length ? <tr><td colSpan={6} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No accounts found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
