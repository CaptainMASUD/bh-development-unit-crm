"use client"
/* eslint-disable react/prop-types -- local presentation components receive controlled dashboard props */

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiAlertTriangle,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiCheckCircle,
  FiEdit2,
  FiPlus,
  FiRefreshCcw,
  FiSave,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const blank = { name: "", account: "", location: "", custodian: "", currency: "BDT", minimumBalance: "", maximumBalance: "", isActive: true }
const monthStart = () => { const date = new Date(); date.setDate(1); return date.toISOString().slice(0, 10) }
const today = () => new Date().toISOString().slice(0, 10)

function headers() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || "Request failed")
  return data
}

function money(value, currency = "") {
  const amount = Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })
  return currency ? `${amount} ${currency}` : amount
}

function Field({ label, children, hint }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-black text-gray-900">{label}</span>{children}{hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}</label>
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
  }
  return <div className={`${card} flex items-center gap-4 p-5`}><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}><Icon /></div><div><p className="text-xs font-black uppercase tracking-[.12em] text-gray-400">{label}</p><p className="mt-1 text-xl font-black text-gray-950">{value}</p></div></div>
}

export default function CashManagement() {
  const user = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null")
      return stored?.user || stored
    } catch {
      return null
    }
  }, [])
  const canManage = hasPermission(user, PERMISSIONS.FINANCE_MANAGE)
  const [rows, setRows] = useState([])
  const [ledgers, setLedgers] = useState([])
  const [custodians, setCustodians] = useState([])
  const [cashBook, setCashBook] = useState({ rows: [], selectedAccounts: [], summary: {} })
  const [cashFlow, setCashFlow] = useState({ activities: [], totals: {} })
  const [filters, setFilters] = useState({ from: monthStart(), to: today(), currency: "" })
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(blank)
  const [verify, setVerify] = useState({ item: null, balance: "", note: "" })

  const load = async () => {
    setLoading(true)
    try {
      const settings = await api("/accounting/settings")
      const currency = filters.currency || settings.settings?.currency || "BDT"
      const reportParams = new URLSearchParams({ from: filters.from, to: filters.to, currency })
      const [cash, accounts, people, book, flow] = await Promise.all([
        api("/accounting/cash-accounts?type=cash&active=all&limit=200"),
        api("/accounting/accounts?limit=500"),
        api("/accounting/cash-custodians"),
        api(`/accounting/cash-book?scope=all&limit=5000&${reportParams.toString()}`),
        api(`/accounting/cash-flow?${reportParams.toString()}`),
      ])
      setRows(cash.cashAccounts || [])
      setCustodians(people.users || [])
      setCashBook(book)
      setCashFlow(flow)
      if (!filters.currency) setFilters((previous) => ({ ...previous, currency }))
      const linked = new Set((cash.cashAccounts || []).map((item) => String(item.account?._id || item.account)))
      setLedgers((accounts.accounts || []).filter((item) =>
        item.type === "asset" &&
        !item.isGroup &&
        item.isActive !== false &&
        (!linked.has(String(item._id)) || String(modal.item?.account?._id || "") === String(item._id))
      ))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Initial load only; report changes are applied explicitly by the user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const open = (item = null) => {
    setModal({ open: true, item })
    setForm(item ? {
      name: item.name || "",
      account: item.account?._id || "",
      location: item.location || "",
      custodian: item.custodian?._id || "",
      currency: item.currency || "BDT",
      minimumBalance: item.minimumBalance || "",
      maximumBalance: item.maximumBalance || "",
      isActive: item.isActive !== false,
    } : { ...blank, custodian: user?._id || "", currency: filters.currency || "BDT" })
  }

  const save = async (event) => {
    event.preventDefault()
    try {
      await api(modal.item ? `/accounting/cash-accounts/${modal.item._id}` : "/accounting/cash-accounts", {
        method: modal.item ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          minimumBalance: Number(form.minimumBalance || 0),
          maximumBalance: Number(form.maximumBalance || 0),
        }),
      })
      toast.success(modal.item ? "Cash account updated" : "Cash account created")
      setModal({ open: false, item: null })
      await load()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return
    try {
      await api(`/accounting/cash-accounts/${item._id}`, { method: "DELETE" })
      toast.success("Cash account deleted")
      await load()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const confirmCount = async (event) => {
    event.preventDefault()
    try {
      await api(`/accounting/cash-accounts/${verify.item._id}/reconcile`, {
        method: "PATCH",
        body: JSON.stringify({
          balance: Number(verify.balance || 0),
          note: verify.note,
          reconciledAt: new Date().toISOString(),
        }),
      })
      toast.success("Physical cash count verified")
      setVerify({ item: null, balance: "", note: "" })
      await load()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const flowCurrency = cashFlow.currency || filters.currency
  const flowTotals = cashFlow.totals || {}

  return <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
    <Toaster position="top-right" />

    <section className={`${card} mb-6 p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Cash &amp; Bank · Live General Ledger</p><h1 className="text-2xl font-black text-gray-950">Cash Management</h1><p className="mt-1 text-sm font-semibold text-gray-500">System-wide cash position, activity classification, and physical cash controls from posted accounting entries.</p></div>
        <div className="flex gap-2"><button className={`${btn} border border-gray-200 bg-white`} onClick={load}><FiRefreshCcw className={loading ? "animate-spin" : ""} />Refresh</button>{canManage ? <button className={`${btn} bg-indigo-600 text-white`} onClick={() => open()}><FiPlus />New Cash Account</button> : null}</div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_auto]">
        <Field label="From"><input className={input} type="date" value={filters.from} onChange={(event) => setFilters((previous) => ({ ...previous, from: event.target.value }))} /></Field>
        <Field label="To"><input className={input} type="date" value={filters.to} onChange={(event) => setFilters((previous) => ({ ...previous, to: event.target.value }))} /></Field>
        <Field label="Currency"><input className={input} maxLength={3} value={filters.currency} onChange={(event) => setFilters((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} /></Field>
        <button className={`${btn} self-end bg-gray-950 text-white`} onClick={load} disabled={loading}>Apply</button>
      </div>
    </section>

    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={FiArrowDownLeft} label="Cash Inflow" value={money(flowTotals.inflow, flowCurrency)} tone="emerald" />
      <SummaryCard icon={FiArrowUpRight} label="Cash Outflow" value={money(flowTotals.outflow, flowCurrency)} tone="rose" />
      <SummaryCard icon={FiTrendingUp} label="Net Cash Flow" value={money(flowTotals.net, flowCurrency)} tone="indigo" />
      <SummaryCard icon={FiCheckCircle} label="Closing Cash" value={money(flowTotals.closingBalance, flowCurrency)} tone="amber" />
    </section>

    <section className={`${card} mb-6 overflow-hidden`}>
      <div className="border-b border-gray-100 p-5"><h2 className="text-lg font-black">Cash Flow by Activity</h2><p className="mt-1 text-xs font-semibold text-gray-500">Operating, investing, and financing movements; internal cash/bank transfers are excluded.</p></div>
      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {(cashFlow.activities || []).map((activity) => <div key={activity.key} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-black">{activity.name}</h3><span className={`text-sm font-black ${Number(activity.totals?.net || 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(activity.totals?.net, flowCurrency)}</span></div>
          <div className="space-y-2">{(activity.items || []).slice(0, 8).map((item) => <div key={item.account?._id || item.name} className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-bold text-gray-600">{item.account?.code ? `${item.account.code} · ` : ""}{item.name}</span><span className="whitespace-nowrap font-black">{money(item.net, flowCurrency)}</span></div>)}{!activity.items?.length ? <p className="text-xs font-semibold text-gray-400">No activity in this period.</p> : null}</div>
        </div>)}
      </div>
    </section>

    <section className={`${card} mb-6 overflow-hidden`}>
      <div className="border-b border-gray-100 p-5"><h2 className="text-lg font-black">Treasury Position</h2><p className="mt-1 text-xs font-semibold text-gray-500">Every linked cash and bank ledger included in the selected currency.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase text-gray-400"><tr>{["Account", "Type", "Opening", "Closing", "Status"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
        {(cashBook.selectedAccounts || []).map((account) => <tr key={`${account.kind}-${account.treasuryId}`}><td className="px-4 py-3"><p className="text-sm font-black">{account.name}</p><p className="text-xs font-semibold text-gray-500">{account.ledger?.code} · {account.detail}</p></td><td className="px-4 py-3 text-sm font-bold capitalize">{account.kind}</td><td className="px-4 py-3 text-sm font-black">{money(account.openingBalance, account.currency)}</td><td className="px-4 py-3 text-sm font-black text-indigo-700">{money(account.closingBalance, account.currency)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${account.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{account.active ? "Active" : "Inactive"}</span></td></tr>)}
        {!cashBook.selectedAccounts?.length ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm font-bold text-gray-500">No linked treasury accounts for this currency.</td></tr> : null}
      </tbody></table></div>
    </section>

    <section className={`${card} overflow-hidden`}>
      <div className="border-b border-gray-100 p-5"><h2 className="text-lg font-black">Physical Cash Accounts</h2><p className="mt-1 text-xs font-semibold text-gray-500">Custody, thresholds, and physical-count reconciliation.</p></div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-100 text-left"><thead className="bg-gray-50 text-xs font-black uppercase text-gray-400"><tr>{["Cash Account", "GL Account", "Location", "Current Balance", "Threshold", "Last Count", "Status", "Actions"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
        {rows.map((row) => <tr key={row._id} className="hover:bg-gray-50"><td className="px-4 py-3"><p className="text-sm font-black">{row.name}</p><p className="text-xs font-semibold text-gray-500">{row.custodian?.name || "No custodian assigned"}</p></td><td className="px-4 py-3 text-sm font-bold text-indigo-700">{row.account?.code} - {row.account?.name}</td><td className="px-4 py-3 text-sm font-semibold">{row.location || "-"}</td><td className={`px-4 py-3 text-sm font-black ${row.alert ? "text-amber-700" : "text-emerald-700"}`}>{row.alert ? <FiAlertTriangle className="mr-1 inline" /> : null}{money(row.currentBalance, row.currency)}</td><td className="px-4 py-3 text-xs font-bold text-gray-500">Min {money(row.minimumBalance, row.currency)}<br />Max {row.maximumBalance ? money(row.maximumBalance, row.currency) : "No limit"}</td><td className="px-4 py-3 text-xs font-bold">{row.lastReconciledAt ? new Date(row.lastReconciledAt).toLocaleDateString() : "Never"}<br /><span className={row.variance ? "text-rose-600" : "text-gray-400"}>Variance {money(row.variance, row.currency)}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{row.isActive ? "Active" : "Inactive"}</span></td><td className="px-4 py-3">{canManage ? <div className="flex gap-2"><button className={`${btn} border border-gray-200 bg-white px-3`} onClick={() => open(row)}><FiEdit2 /></button><button className={`${btn} border border-emerald-200 bg-white px-3 text-emerald-700`} onClick={() => setVerify({ item: row, balance: row.currentBalance, note: "" })} title="Verify physical count"><FiCheckCircle /></button><button className={`${btn} border border-rose-200 bg-white px-3 text-rose-700`} onClick={() => remove(row)}><FiTrash2 /></button></div> : <span className="text-xs font-bold text-gray-400">View only</span>}</td></tr>)}
        {!rows.length ? <tr><td colSpan={8} className="px-5 py-16 text-center text-sm font-bold text-gray-500">No cash accounts found.</td></tr> : null}
      </tbody></table></div>
    </section>

    {modal.open ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/55 p-4"><div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black">{modal.item ? "Update" : "Create"} Cash Account</h2><button onClick={() => setModal({ open: false, item: null })}><FiX /></button></div><form onSubmit={save}><div className="grid gap-4 p-5 md:grid-cols-2"><Field label="Cash Account Name"><input className={input} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} required /></Field><Field label="Linked GL Account" hint={modal.item ? "Ledger cannot be replaced here." : "Leave empty to create a dedicated Cash ledger."}><select className={input} value={form.account} disabled={Boolean(modal.item)} onChange={(event) => setForm((previous) => ({ ...previous, account: event.target.value }))}><option value="">Auto-create dedicated ledger</option>{ledgers.map((item) => <option key={item._id} value={item._id}>{item.code} - {item.name}</option>)}</select></Field><Field label="Location / Branch"><input className={input} value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} /></Field><Field label="Custodian"><select className={input} value={form.custodian} onChange={(event) => setForm((previous) => ({ ...previous, custodian: event.target.value }))}><option value="">Unassigned</option>{custodians.map((person) => <option key={person._id} value={person._id}>{person.name} · {person.email}</option>)}</select></Field><Field label="Currency"><input className={input} maxLength={3} value={form.currency} disabled={Boolean(modal.item)} onChange={(event) => setForm((previous) => ({ ...previous, currency: event.target.value.toUpperCase() }))} /></Field><Field label="Minimum Balance Alert"><input className={input} type="number" min="0" step=".01" value={form.minimumBalance} onChange={(event) => setForm((previous) => ({ ...previous, minimumBalance: event.target.value }))} /></Field><Field label="Maximum Balance Alert"><input className={input} type="number" min="0" step=".01" value={form.maximumBalance} onChange={(event) => setForm((previous) => ({ ...previous, maximumBalance: event.target.value }))} /></Field><label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.checked }))} />Active</label></div><div className="flex justify-end border-t p-5"><button className={`${btn} bg-indigo-600 text-white`}><FiSave />Save Cash Account</button></div></form></div></div> : null}

    {verify.item ? <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-950/55 p-4"><form className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onSubmit={confirmCount}><h2 className="text-xl font-black">Verify Physical Cash</h2><p className="mt-1 text-sm font-semibold text-gray-500">{verify.item.name} · Book balance {money(verify.item.currentBalance, verify.item.currency)}</p><div className="mt-5 space-y-4"><Field label="Counted Amount"><input className={input} type="number" step=".01" value={verify.balance} onChange={(event) => setVerify((previous) => ({ ...previous, balance: event.target.value }))} required /></Field><Field label="Verification Note"><textarea className={`${input} h-24 py-3`} value={verify.note} onChange={(event) => setVerify((previous) => ({ ...previous, note: event.target.value }))} /></Field></div><div className="mt-5 flex justify-end gap-2"><button type="button" className={`${btn} border border-gray-200`} onClick={() => setVerify({ item: null, balance: "", note: "" })}>Cancel</button><button className={`${btn} bg-emerald-600 text-white`}><FiCheckCircle />Verify</button></div></form></div> : null}
  </div>
}
