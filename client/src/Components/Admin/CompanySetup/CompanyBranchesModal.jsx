"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PropTypes from "prop-types"
import toast from "react-hot-toast"
import { FiCheckCircle, FiEdit2, FiMapPin, FiPlus, FiRefreshCcw, FiSearch, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const emptyForm = { name: "", code: "", email: "", phone: "", address: { line1: "", city: "", state: "", postalCode: "", country: "Bangladesh" }, isActive: true }
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15"

async function request(path, options = {}) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "Request failed")
  return data
}

export default function CompanyBranchesModal({ company, role, onClose, onChanged }) {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const companyId = company?._id || company?.id
  const readOnly = role === "superadmin"

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (status !== "all") params.set("status", status)
      const data = await request(`/companies/${companyId}/branches?${params}`)
      setBranches(data.branches || [])
    } catch (error) { toast.error(error.message) } finally { setLoading(false) }
  }, [companyId, query, status])

  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer) }, [load])

  const startCreate = () => { setEditing("new"); setForm(emptyForm) }
  const startEdit = (branch) => { setEditing(branch); setForm({ ...emptyForm, ...branch, address: { ...emptyForm.address, ...(branch.address || {}) } }) }
  const save = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.code.trim()) return toast.error("Branch name and code are required")
    setSaving(true)
    try {
      const id = editing === "new" ? "" : editing?._id
      await request(`/companies/${companyId}/branches${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(form) })
      toast.success(id ? "Branch updated" : "Branch created")
      setEditing(null); await load(); onChanged?.()
    } catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }
  const makeDefault = async (branch) => {
    try {
      await request(`/companies/${companyId}/branches/${branch._id}/default`, { method: "PATCH", body: "{}" })
      toast.success("Default branch updated"); await load(); onChanged?.()
    } catch (error) { toast.error(error.message) }
  }

  const stats = useMemo(() => ({ active: branches.filter((item) => item.isActive !== false).length, inactive: branches.filter((item) => item.isActive === false).length }), [branches])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-gray-50 shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-100 bg-white p-5">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Company locations</p><h2 className="mt-1 text-xl font-black text-gray-950">{company?.name} Branches</h2><p className="mt-1 text-sm font-semibold text-gray-500">{readOnly ? "Read-only branch visibility for Super Admin" : "Manage company branches and choose the default operating location"}</p></div>
          <button onClick={onClose} className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-600 hover:bg-gray-50"><FiX /></button>
        </header>
        <div className="grid gap-4 border-b border-gray-100 bg-white p-4 sm:grid-cols-[1fr_180px_auto]">
          <label className="relative"><FiSearch className="absolute left-3 top-3.5 text-gray-400" /><input className={`${input} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search branch, code, or city" /></label>
          <select className={input} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <div className="flex gap-2"><button onClick={load} className="rounded-xl border border-gray-200 bg-white px-4 font-bold text-gray-700"><FiRefreshCcw className={loading ? "animate-spin" : ""} /></button>{!readOnly && <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white"><FiPlus /> Add Branch</button>}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid grid-cols-3 gap-3"><div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs font-bold text-gray-500">Total</p><p className="mt-1 text-2xl font-black">{branches.length}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-700">Active</p><p className="mt-1 text-2xl font-black text-emerald-900">{stats.active}</p></div><div className="rounded-2xl bg-gray-100 p-4"><p className="text-xs font-bold text-gray-600">Inactive</p><p className="mt-1 text-2xl font-black text-gray-900">{stats.inactive}</p></div></div>
          {editing && !readOnly && <form onSubmit={save} className="mb-5 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"><h3 className="mb-4 font-black text-gray-950">{editing === "new" ? "Create branch" : "Update branch"}</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"><input className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Branch name" /><input className={input} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="Branch code" /><input className={input} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" /><input className={input} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" /><input className={input} value={form.address.line1} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, line1: e.target.value } }))} placeholder="Address" /><input className={input} value={form.address.city} onChange={(e) => setForm((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))} placeholder="City" /><select className={input} value={String(form.isActive)} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === "true" }))}><option value="true">Active</option><option value="false">Inactive</option></select><div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white">{saving ? "Saving..." : "Save"}</button><button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-gray-200 px-4 font-bold">Cancel</button></div></div></form>}
          <div className="space-y-3">{branches.map((branch) => <article key={branch._id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${branch.isDefault ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}><FiMapPin /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-gray-950">{branch.name}</h3>{branch.isMain && <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700">MAIN</span>}{branch.isDefault && <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">DEFAULT</span>}</div><p className="mt-1 text-xs font-semibold text-gray-500">{branch.code} · {[branch.address?.line1, branch.address?.city, branch.address?.country].filter(Boolean).join(", ") || "Address not configured"}</p></div></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${branch.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{branch.isActive !== false ? "Active" : "Inactive"}</span>{!readOnly && <><button onClick={() => startEdit(branch)} className="rounded-xl border border-gray-200 p-2.5 text-gray-600"><FiEdit2 /></button>{!branch.isDefault && branch.isActive !== false && <button onClick={() => makeDefault(branch)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-700"><FiCheckCircle /> Set Default</button>}</>}</div></article>)}{!loading && !branches.length && <div className="rounded-2xl bg-white p-10 text-center text-sm font-bold text-gray-500">No branches match the current filters.</div>}</div>
        </div>
      </div>
    </div>
  )
}

CompanyBranchesModal.propTypes = {
  company: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    name: PropTypes.string,
  }).isRequired,
  role: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onChanged: PropTypes.func,
}
