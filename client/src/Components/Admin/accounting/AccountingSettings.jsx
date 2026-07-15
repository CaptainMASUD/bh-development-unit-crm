"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiRefreshCcw, FiSave, FiSettings } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"
const button = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:opacity-60"
const emptyForm = { fiscalYearStartMonth: 7, defaultFiscalYear: "", currency: "BDT", defaultCashAccount: "", defaultBankAccount: "", salesAccount: "", purchaseAccount: "", receivableAccount: "", payableAccount: "", vatAccount: "", voucherPrefix: "JV", voucherNumberLength: 6, voucherReset: "fiscal_year", voucherFormat: "{PREFIX}-{FY}-{NUMBER}" }
const accountFields = [
  ["defaultCashAccount", "Default Cash Account", ["asset"]],
  ["defaultBankAccount", "Default Bank Account", ["asset"]],
  ["salesAccount", "Sales Account", ["revenue"]],
  ["purchaseAccount", "Purchase Account", ["expense"]],
  ["receivableAccount", "Receivable Account", ["asset"]],
  ["payableAccount", "Payable Account", ["liability"]],
  ["vatAccount", "VAT Account", ["asset", "liability"]],
]
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function headers() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
async function api(path, options = {}) { const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...headers(), ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || "Request failed"); return data }
function Field({ label, hint, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-extrabold text-gray-900">{label}</span>{children}{hint ? <span className="mt-1 block text-xs font-semibold text-gray-500">{hint}</span> : null}</label> }
const idOf = (value) => value?._id || value || ""

export default function AccountingSettings() {
  const [form, setForm] = useState(emptyForm)
  const [accounts, setAccounts] = useState([])
  const [fiscalYears, setFiscalYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const load = async () => {
    setLoading(true)
    try {
      const [settingsData, accountData, fiscalYearData] = await Promise.all([api("/accounting/settings"), api("/accounting/accounts?limit=200"), api("/accounting/fiscal-years")])
      const settings = settingsData.settings || {}
      setAccounts(accountData.accounts || [])
      setFiscalYears(fiscalYearData.fiscalYears || [])
      setForm({ ...emptyForm, ...settings, defaultFiscalYear: idOf(settings.defaultFiscalYear), ...Object.fromEntries(accountFields.map(([key]) => [key, idOf(settings[key])])) })
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const preview = useMemo(() => form.voucherFormat.replaceAll("{PREFIX}", form.voucherPrefix || "JV").replaceAll("{FY}", "2026-27").replaceAll("{YYYY}", "2026").replaceAll("{MM}", "07").replaceAll("{NUMBER}", String(1).padStart(Number(form.voucherNumberLength || 6), "0")), [form])
  const submit = async (event) => {
    event.preventDefault(); setSaving(true)
    try { await api("/accounting/settings", { method: "PUT", body: JSON.stringify({ ...form, fiscalYearStartMonth: Number(form.fiscalYearStartMonth), voucherNumberLength: Number(form.voucherNumberLength) }) }); toast.success("Accounting settings saved") }
    catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }
  return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-6 sm:px-6 lg:px-8"><Toaster position="top-right" />
    <div className={`${card} mb-6 p-5`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiSettings className="h-6 w-6" /></div><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Accounting Setup</p><h1 className="text-2xl font-black text-gray-950">Accounting Settings</h1><p className="mt-1 text-sm font-semibold text-gray-500">Company defaults used by accounting transactions and voucher numbers.</p></div></div><button className={`${button} border border-gray-200 bg-white text-gray-700`} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} /> Refresh</button></div></div>
    <form onSubmit={submit} className="space-y-6">
      <section className={`${card} p-5`}><h2 className="text-base font-black text-gray-950">Company accounting defaults</h2><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Default Fiscal Year"><select className={input} value={form.defaultFiscalYear} onChange={(e) => setForm((p) => ({ ...p, defaultFiscalYear: e.target.value }))}><option value="">Not configured</option>{fiscalYears.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field><Field label="Fiscal Year Starts"><select className={input} value={form.fiscalYearStartMonth} onChange={(e) => setForm((p) => ({ ...p, fiscalYearStartMonth: e.target.value }))}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></Field><Field label="Base Currency"><input className={input} value={form.currency} maxLength={3} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} required /></Field></div></section>
      <section className={`${card} p-5`}><h2 className="text-base font-black text-gray-950">Default ledger accounts</h2><p className="mt-1 text-sm font-semibold text-gray-500">These accounts are selected automatically by connected accounting workflows.</p><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{accountFields.map(([key, label, types]) => <Field key={key} label={label}><select className={input} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}><option value="">Not configured</option>{accounts.filter((account) => types.includes(account.type)).map((account) => <option key={account._id} value={account._id}>{account.code} — {account.name}</option>)}</select></Field>)}</div></section>
      <section className={`${card} p-5`}><h2 className="text-base font-black text-gray-950">Voucher numbering</h2><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Prefix"><input className={input} value={form.voucherPrefix} onChange={(e) => setForm((p) => ({ ...p, voucherPrefix: e.target.value.toUpperCase() }))} required /></Field><Field label="Number Length"><input className={input} type="number" min="3" max="12" value={form.voucherNumberLength} onChange={(e) => setForm((p) => ({ ...p, voucherNumberLength: e.target.value }))} /></Field><Field label="Reset Sequence"><select className={input} value={form.voucherReset} onChange={(e) => setForm((p) => ({ ...p, voucherReset: e.target.value }))}><option value="fiscal_year">Every fiscal year</option><option value="calendar_year">Every calendar year</option><option value="monthly">Every month</option><option value="never">Never</option></select></Field><Field label="Format" hint="Tokens: {PREFIX}, {FY}, {YYYY}, {MM}, {NUMBER}"><input className={input} value={form.voucherFormat} onChange={(e) => setForm((p) => ({ ...p, voucherFormat: e.target.value }))} required /></Field></div><div className="mt-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">Preview: {preview}</div></section>
      <div className="flex justify-end"><button className={`${button} bg-indigo-600 text-white hover:bg-indigo-700`} disabled={saving || loading} type="submit"><FiSave /> {saving ? "Saving..." : "Save Settings"}</button></div>
    </form>
  </div>
}
