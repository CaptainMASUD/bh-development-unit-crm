"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiCheckCircle, FiCreditCard, FiEdit2, FiPlus, FiRefreshCcw, FiSave, FiSearch, FiSlash, FiTrash2, FiX } from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const label = "mb-1.5 block text-sm font-extrabold text-gray-900"

const KINDS = ["deposit", "withdrawal", "opening_balance", "adjustment", "bank_charge", "interest"]
const emptyForm = { bankAccount: "", counterpartLedgerAccount: "", kind: "deposit", direction: "in", amount: "", transactionDate: new Date().toISOString().slice(0, 10), reference: "", description: "", status: "posted" }

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

function cn(...classes) { return classes.filter(Boolean).join(" ") }
function pretty(value) { return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }
function money(value, currency = "BDT") { return `${currency} ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}` }
function RequiredMark() { return <span className="ml-1 text-rose-500">*</span> }
function Field({ title, children, required = false, hint }) {
  return <label className="block"><span className={label}>{title}{required ? <RequiredMark /> : null}</span>{children}{hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}</label>
}
function Badge({ value }) {
  const key = String(value || "").toLowerCase()
  const style = key === "posted" || key === "in" || key === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" : key === "out" || key === "void" ? "bg-rose-50 text-rose-700 ring-rose-600/10" : "bg-indigo-50 text-indigo-700 ring-indigo-600/10"
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1", style)}>{pretty(value)}</span>
}

export default function BankTransactions() {
  const currentUser = useMemo(() => { try { const stored = JSON.parse(localStorage.getItem("user") || "null"); return stored?.user || stored } catch { return null } }, [])
  const canManage = hasPermission(currentUser, PERMISSIONS.FINANCE_MANAGE)
  const [accounts, setAccounts] = useState([])
  const [ledgerAccounts, setLedgerAccounts] = useState([])
  const [rows, setRows] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [kind, setKind] = useState("all")
  const [bankAccount, setBankAccount] = useState("all")
  const [modal, setModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)

  const accountOptions = useMemo(() => accounts.map((item) => [item._id, `${item.accountName} - ${item.accountNumber}`]), [accounts])

  const loadAccounts = async () => {
    const [bankData, ledgerData] = await Promise.all([
      api("/banking/accounts"),
      api("/accounting/accounts?limit=200"),
    ])
    setAccounts((bankData.accounts || []).filter((item) => item.ledgerAccount))
    setLedgerAccounts((ledgerData.accounts || []).filter((item) => !item.isGroup && item.isActive !== false))
  }

  const loadRows = async ({ append = false, cursor = "" } = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (q.trim()) params.set("q", q.trim())
      if (status !== "all") params.set("status", status)
      if (kind !== "all") params.set("kind", kind)
      if (bankAccount !== "all") params.set("bankAccount", bankAccount)
      if (cursor) params.set("cursor", cursor)
      const data = await api(`/banking/transactions?${params.toString()}`)
      setRows((prev) => append ? [...prev, ...(data.transactions || [])] : data.transactions || [])
      setNextCursor(data.nextCursor || null)
    } catch (error) {
      toast.error(error.message || "Failed to load transactions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts().catch((error) => toast.error(error.message)) }, [])
  useEffect(() => {
    const timer = setTimeout(() => loadRows(), 250)
    return () => clearTimeout(timer)
  }, [q, status, kind, bankAccount])

  const openModal = (item = null) => {
    setModal({ open: true, item })
    setForm(item ? {
      bankAccount: item.bankAccount?._id || "",
      counterpartLedgerAccount: item.counterpartLedgerAccount?._id || "",
      kind: item.kind || "deposit",
      direction: item.direction || "in",
      amount: item.amount || "",
      transactionDate: item.transactionDate ? new Date(item.transactionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      reference: item.reference || "",
      description: item.description || "",
      status: item.status || "posted",
    } : { ...emptyForm, bankAccount: accounts[0]?._id || "" })
  }

  const save = async (event) => {
    event.preventDefault()
    try {
      await api(modal.item?._id ? `/banking/transactions/${modal.item._id}` : "/banking/transactions", {
        method: modal.item?._id ? "PATCH" : "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount || 0) }),
      })
      toast.success(modal.item ? "Transaction updated" : "Transaction created")
      setModal({ open: false, item: null })
      loadRows()
    } catch (error) {
      toast.error(error.message || "Save failed")
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete transaction ${item.reference || item._id}?`)) return
    try {
      await api(`/banking/transactions/${item._id}`, { method: "DELETE" })
      toast.success("Transaction deleted")
      loadRows()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  const voidTransaction = async (item) => {
    const reason = window.prompt("Reason for voiding this posted transaction:", "Entry correction")
    if (reason === null) return
    try {
      await api(`/banking/transactions/${item._id}/void`, { method: "PATCH", body: JSON.stringify({ reason }) })
      toast.success("Transaction and journal voided")
      loadRows()
    } catch (error) {
      toast.error(error.message || "Void failed")
    }
  }

  const postDraft = async (item) => {
    try {
      await api(`/banking/transactions/${item._id}/post`, { method: "PATCH", body: JSON.stringify({}) })
      toast.success("Transaction posted to accounting")
      loadRows()
    } catch (error) {
      toast.error(error.message || "Posting failed")
    }
  }

  const chips = [
    q ? ["Search", q, () => setQ("")] : null,
    status !== "all" ? ["Status", pretty(status), () => setStatus("all")] : null,
    kind !== "all" ? ["Kind", pretty(kind), () => setKind("all")] : null,
    bankAccount !== "all" ? ["Account", accountOptions.find(([id]) => id === bankAccount)?.[1] || "Selected", () => setBankAccount("all")] : null,
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiCreditCard className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Banking</p><h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Bank Transactions</h1><p className="mt-1 text-sm font-semibold text-gray-500">Optimized bank ledger with deposits, withdrawals, charges, and adjustments.</p></div></div>
          <div className="flex flex-wrap gap-2"><button className={`${btn} ${btnGhost}`} onClick={() => loadRows()} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button>{canManage ? <button className={`${btn} ${btnPrimary}`} onClick={() => openModal()}><FiPlus /> Add Transaction</button> : null}</div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_220px_240px]">
          <div className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={cn(input, "pl-10")} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference or description..." /></div>
          <select className={input} value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">All Kinds</option>{KINDS.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select>
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Status</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="void">Void</option></select>
          <select className={input} value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}><option value="all">All Accounts</option>{accountOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        </div>
        {chips.length ? <div className="mt-3 flex flex-wrap gap-2">{chips.map(([name, value, clear]) => <button key={name} type="button" onClick={clear} className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-600/10"><span><span className="text-indigo-500">{name}:</span> {value}</span><FiX /></button>)}</div> : null}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-left">
            <thead className="bg-gray-50 text-xs font-black uppercase tracking-[0.12em] text-gray-400"><tr>{["Date", "Account", "Kind", "Direction", "Amount", "Reference", "Journal", "Reconciled", "Actions"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => <tr key={row._id} className="hover:bg-gray-50/70">
                <td className="px-5 py-4 text-sm font-bold text-gray-700">{new Date(row.transactionDate).toLocaleDateString()}</td>
                <td className="px-5 py-4"><div className="text-sm font-black text-gray-900">{row.bankAccount?.accountName || "-"}</div><div className="text-xs font-semibold text-gray-500">{row.bankAccount?.bank?.shortName || ""} {row.bankAccount?.accountNumber || ""}</div></td>
                <td className="px-5 py-4"><Badge value={row.kind} /></td>
                <td className="px-5 py-4"><Badge value={row.direction} /></td>
                <td className={cn("px-5 py-4 text-sm font-black", row.direction === "in" ? "text-emerald-700" : "text-rose-700")}>{money(row.amount, row.bankAccount?.currency || "BDT")}</td>
                <td className="px-5 py-4 text-sm font-semibold text-gray-600">{row.reference || "-"}</td>
                <td className="px-5 py-4">{row.journalEntry ? <div><span className="text-xs font-black text-indigo-700">{row.journalEntry.entryNo}</span><div className="mt-1"><Badge value={row.journalEntry.status} /></div></div> : <span className="text-xs font-bold text-amber-700">Not posted</span>}</td>
                <td className="px-5 py-4"><Badge value={row.reconciled ? "reconciled" : "open"} /></td>
                <td className="px-5 py-4">{canManage ? <div className="flex gap-2"><button className={`${btn} ${btnGhost} px-3`} disabled={row.reconciled || Boolean(row.journalEntry)} onClick={() => openModal(row)} title={row.journalEntry ? "Posted entries are immutable" : "Edit"}><FiEdit2 /></button>{row.status === "draft" ? <button className={`${btn} ${btnPrimary} px-3`} onClick={() => postDraft(row)} title="Post to accounting"><FiCheckCircle /></button> : null}{row.status === "posted" && !row.reconciled ? <button className={`${btn} ${btnDanger} px-3`} onClick={() => voidTransaction(row)} title="Void transaction and journal"><FiSlash /></button> : row.status !== "draft" ? <button className={`${btn} ${btnDanger} px-3`} disabled={row.reconciled || Boolean(row.journalEntry)} onClick={() => remove(row)}><FiTrash2 /></button> : <button className={`${btn} ${btnDanger} px-3`} onClick={() => remove(row)}><FiTrash2 /></button>}</div> : <span className="text-xs font-bold text-gray-400">View only</span>}</td>
              </tr>)}
              {!rows.length ? <tr><td colSpan={9} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No bank transactions found.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {nextCursor ? <div className="border-t border-gray-100 p-4 text-center"><button className={`${btn} ${btnGhost}`} disabled={loading} onClick={() => loadRows({ append: true, cursor: nextCursor })}>Load More</button></div> : null}
      </div>

      {canManage && modal.open ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5"><div><h2 className="text-lg font-extrabold text-gray-900">{modal.item ? "Update Transaction" : "Add Transaction"}</h2><p className="text-sm font-semibold text-gray-500">Fields marked with * are required.</p></div><button className="rounded-xl p-2 hover:bg-gray-100" onClick={() => setModal({ open: false, item: null })}><FiX /></button></div>
        <form onSubmit={save}><div className="grid gap-4 p-5 md:grid-cols-2">
          <Field title="Bank Account" required><select className={input} value={form.bankAccount} onChange={(e) => setForm((p) => ({ ...p, bankAccount: e.target.value }))} required><option value="">Select Account</option>{accountOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></Field>
          <Field title="Offset Accounting Ledger" required={form.status === "posted"} hint="The other side of the balanced journal entry."><select className={input} value={form.counterpartLedgerAccount} onChange={(e) => setForm((p) => ({ ...p, counterpartLedgerAccount: e.target.value }))} required={form.status === "posted" && !["opening_balance", "bank_charge", "interest"].includes(form.kind)}><option value="">Select Ledger</option>{ledgerAccounts.map((item) => <option key={item._id} value={item._id}>{item.code} - {item.name}</option>)}</select></Field>
          <Field title="Kind" required><select className={input} value={form.kind} onChange={(e) => setForm((p) => ({ ...p, kind: e.target.value, direction: ["deposit", "opening_balance", "interest"].includes(e.target.value) ? "in" : "out" }))} required>{KINDS.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></Field>
          <Field title="Direction" required><select className={input} value={form.direction} onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))} required><option value="in">In</option><option value="out">Out</option></select></Field>
          <Field title="Amount" required><input className={input} type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required /></Field>
          <Field title="Transaction Date" required><input className={input} type="date" value={form.transactionDate} onChange={(e) => setForm((p) => ({ ...p, transactionDate: e.target.value }))} required /></Field>
          <Field title="Status" required><select className={input} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} required><option value="draft">Draft</option><option value="posted">Posted</option></select></Field>
          <Field title="Reference"><input className={input} value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} /></Field>
          <Field title="Description"><textarea className={cn(input, "h-24 resize-none py-3")} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></Field>
        </div><div className="flex justify-end gap-2 border-t border-gray-100 p-5"><button className={`${btn} ${btnGhost}`} type="button" onClick={() => setModal({ open: false, item: null })}>Cancel</button><button className={`${btn} ${btnPrimary}`} type="submit"><FiSave />Save Transaction</button></div></form>
      </div></div> : null}
    </div>
  )
}
