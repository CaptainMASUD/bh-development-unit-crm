"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiEdit2, FiLayers, FiPlus, FiRefreshCcw, FiSave, FiTrash2, FiX } from "react-icons/fi"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const card = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)]"
const btn = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
const btnPrimary = "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const btnGhost = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const btnDanger = "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
const input = "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10"

const emptyForm = { name: "", parent: "", description: "", isActive: true }

function headers() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) }, credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || "Request failed")
  return data
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-gray-800">{label}</span>{children}</label>
}

export default function ExpenseSetup() {
  const [categories, setCategories] = useState([])
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return categories
    return categories.filter((item) => [item.name, item.parent?.name, item.description].some((value) => String(value || "").toLowerCase().includes(term)))
  }, [categories, q])

  const load = async () => {
    setLoading(true)
    try {
      const data = await api("/expenses/categories")
      setCategories(data.categories || [])
    } catch (error) {
      toast.error(error.message || "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openModal = (item = null) => {
    setModal({ open: true, item })
    setForm(item ? { name: item.name || "", parent: item.parent?._id || item.parent || "", description: item.description || "", isActive: item.isActive !== false } : emptyForm)
  }

  const save = async (event) => {
    event.preventDefault()
    try {
      await api(modal.item?._id ? `/expenses/categories/${modal.item._id}` : "/expenses/categories", {
        method: modal.item?._id ? "PATCH" : "POST",
        body: JSON.stringify(form),
      })
      toast.success(modal.item ? "Category updated" : "Category created")
      setModal({ open: false, item: null })
      await load()
    } catch (error) {
      toast.error(error.message || "Save failed")
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return
    try {
      await api(`/expenses/categories/${item._id}`, { method: "DELETE" })
      toast.success("Category deleted")
      await load()
    } catch (error) {
      toast.error(error.message || "Delete failed")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7fb] p-4 sm:p-6 lg:p-8">
      <Toaster position="top-right" />
      <div className={`${card} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white"><FiLayers /></div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Expense Setup</h1>
              <p className="mt-1 text-sm font-semibold text-gray-500">Create categories and subcategories for company expenses.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`${btn} ${btnGhost}`} onClick={load} disabled={loading}><FiRefreshCcw className={loading ? "animate-spin" : ""} />Refresh</button>
            <button className={`${btn} ${btnPrimary}`} onClick={() => openModal()}><FiPlus />Add Category</button>
          </div>
        </div>
        <div className="mt-5">
          <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories..." />
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="max-h-[540px] overflow-auto">
          <table className="min-w-full text-left">
            <thead className="sticky top-0 bg-gray-50 text-xs font-black uppercase text-gray-500">
              <tr><th className="px-5 py-3">Category</th><th className="px-5 py-3">Parent</th><th className="px-5 py-3">Description</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <tr key={item._id} className="bg-white hover:bg-gray-50/70">
                  <td className="px-5 py-4 text-sm font-black text-gray-900">{item.name}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">{item.parent?.name || "-"}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-gray-600">{item.description || "-"}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${item.isActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{item.isActive !== false ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-4"><div className="flex justify-end gap-2"><button className={`${btn} ${btnGhost} px-3`} onClick={() => openModal(item)}><FiEdit2 /></button><button className={`${btn} ${btnDanger} px-3`} onClick={() => remove(item)}><FiTrash2 /></button></div></td>
                </tr>
              ))}
              {!filtered.length ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm font-bold text-gray-500">No expense categories found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div><h2 className="text-lg font-extrabold text-gray-900">{modal.item ? "Update Category" : "Add Category"}</h2><p className="text-sm font-semibold text-gray-500">Use parent category for nested expense types.</p></div>
              <button className="rounded-xl p-2 hover:bg-gray-100" onClick={() => setModal({ open: false, item: null })}><FiX /></button>
            </div>
            <form onSubmit={save}>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Category Name"><input className={input} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></Field>
                <Field label="Parent Category"><select className={input} value={form.parent} onChange={(e) => setForm((p) => ({ ...p, parent: e.target.value }))}><option value="">No parent</option>{categories.filter((item) => item._id !== modal.item?._id).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field>
                <Field label="Description"><input className={input} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></Field>
                <label className="flex items-center gap-2 pt-8 text-sm font-bold text-gray-700"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 p-5">
                <button className={`${btn} ${btnGhost}`} type="button" onClick={() => setModal({ open: false, item: null })}>Cancel</button>
                <button className={`${btn} ${btnPrimary}`} type="submit"><FiSave />Save Category</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
