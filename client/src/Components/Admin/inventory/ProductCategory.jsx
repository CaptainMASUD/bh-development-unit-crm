/* eslint-disable react/prop-types, react-refresh/only-export-components -- route page exports small tested data helpers */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import {
  FiActivity,
  FiAlertCircle,
  FiArchive,
  FiDatabase,
  FiDownload,
  FiEdit2,
  FiEye,
  FiMoreHorizontal,
  FiPlus,
  FiSliders,
  FiTrash2,
  FiX,
} from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { InventoryButton, InventoryPageHeader, InventoryPageShell, InventorySearchToolbar } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 10
const CATEGORY_MANAGE_PERMISSION = PERMISSIONS?.INVENTORY_CATEGORY_MANAGE || "inventory-category:manage"
const CATEGORY_DELETE_PERMISSION = PERMISSIONS?.INVENTORY_CATEGORY_DELETE || "inventory-category:delete"
const emptyForm = { code: "", name: "", status: "active" }

const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"

function clean(value) {
  return String(value ?? "").trim()
}

export function buildCategoryPayload(form = {}) {
  return {
    code: clean(form.code).toUpperCase(),
    name: clean(form.name),
    status: clean(form.status || "active").toLowerCase(),
  }
}

export function filterCategories(categories = [], filters = {}) {
  const query = clean(filters.query).toLowerCase()
  const status = clean(filters.status || "all").toLowerCase()
  return categories.filter((category) => {
    const matchesStatus = status === "all" ? category.status !== "archived" : category.status === status
    const matchesQuery = !query || [category.code, category.name].some((value) => clean(value).toLowerCase().includes(query))
    return matchesStatus && matchesQuery
  })
}

export function getCategorySummary(categories = [], filteredResults = categories.length) {
  const currentCategories = categories.filter((category) => category.status !== "archived")
  return {
    totalRecords: currentCategories.length,
    needsAttention: currentCategories.filter((category) => category.status === "inactive").length,
    totalVolume: currentCategories.length,
    filteredResults,
  }
}

export function paginateCategories(categories = [], requestedPage = 1, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(categories.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, categories.length)
  return { page, totalPages, start, end, rows: categories.slice(start, end) }
}

function getStoredUser() {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null")
    return stored?.user || stored
  } catch {
    return null
  }
}

function requestHeaders() {
  const token = localStorage.getItem("token")
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...requestHeaders(), ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || "Request failed")
  return data
}

async function fetchCategorySet(status = "") {
  const records = []
  const seenCursors = new Set()
  let cursor = ""
  do {
    const params = new URLSearchParams({ limit: "100" })
    if (status) params.set("status", status)
    if (cursor) params.set("cursor", cursor)
    const data = await api(`/inventory/categories?${params.toString()}`)
    records.push(...(data.categories || []))
    const nextCursor = data.hasMore ? clean(data.nextCursor) : ""
    if (!nextCursor || seenCursors.has(nextCursor)) break
    seenCursors.add(nextCursor)
    cursor = nextCursor
  } while (cursor)
  return records
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function pretty(value) {
  return clean(value || "—").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function downloadCsv(categories) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
  const rows = [["Code", "Category", "Status"], ...categories.map((category) => [category.code, category.name, pretty(category.status)])]
  const csv = `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\n")}`
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `inventory-categories-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function Modal({ open, title, subtitle, onClose, children, footer, width = "max-w-3xl" }) {
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const closeOnEscape = (event) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [onClose, open])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <button type="button" className="fixed inset-0 cursor-default" aria-label="Close modal" onClick={onClose} />
      <section className={`relative my-auto w-full ${width} overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl`} role="dialog" aria-modal="true">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-gray-950">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close"><FiX className="h-5 w-5" /></button>
        </header>
        <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="border-t border-gray-100 px-5 py-4 sm:px-6">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  )
}

function Field({ label, required = false, children }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-gray-600">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>{children}</label>
}

function StatusBadge({ status }) {
  const classes = status === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "inactive"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-gray-200 bg-gray-50 text-gray-600"
  return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${classes}`}>{pretty(status)}</span>
}

function SummaryCard({ label, value, note, icon: Icon, tone }) {
  const tones = { indigo: "bg-indigo-50 text-indigo-600", amber: "bg-amber-50 text-amber-600", cyan: "bg-cyan-50 text-cyan-600", blue: "bg-blue-50 text-blue-600" }
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,.45)]">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold text-gray-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</p></div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
      <span className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600">↗ {note}</span>
    </article>
  )
}

function CategoryFormModal({ state, form, setForm, error, saving, onClose, onSubmit }) {
  const editing = Boolean(state.item)
  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={editing ? "Update Category" : "Create Category"}
      subtitle="Fields are designed from the Inventory & Purchase business workflow."
      footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={onClose} disabled={saving}>Cancel</button><button type="submit" form="category-form" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} disabled={saving}>{saving ? "Saving..." : editing ? "Update Record" : "Create Record"}</button></div>}
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
      <form id="category-form" onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
        <Field label="Code (leave blank for automatic numbering)"><input className={inputClass} value={form.code} onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))} placeholder="Enter code for Manual mode" maxLength={40} autoFocus /></Field>
        <Field label="Category Name" required><input className={inputClass} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Enter category name" maxLength={120} required /></Field>
        <Field label="Status" required><select className={inputClass} value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))} required><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
      </form>
    </Modal>
  )
}

function Detail({ label, value }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 text-sm font-bold text-gray-900">{value || "—"}</div></div>
}

function CategoryDetailsModal({ category, onClose, onEdit, canManage }) {
  return (
    <Modal
      open={Boolean(category)}
      onClose={onClose}
      title="Category Details"
      subtitle="Inventory category record"
      width="max-w-xl"
      footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={onClose}>Close</button>{category && canManage && category.status !== "archived" ? <button type="button" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} onClick={() => onEdit(category)}><FiEdit2 /> Edit</button> : null}</div>}
    >
      {category ? <div className="grid gap-4 sm:grid-cols-2"><Detail label="Code" value={category.code} /><Detail label="Category" value={category.name} /><Detail label="Status" value={<StatusBadge status={category.status} />} /><Detail label="Last Updated" value={formatDate(category.updatedAt)} /></div> : null}
    </Modal>
  )
}

function ActionButton({ label, onClick, children, danger = false }) {
  return <button type="button" onClick={onClick} className={`rounded-lg p-2 transition ${danger ? "text-gray-400 hover:bg-rose-50 hover:text-rose-600" : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"}`} title={label} aria-label={label}>{children}</button>
}

export default function ProductCategorySetup() {
  const currentUser = useMemo(getStoredUser, [])
  const canManage = hasPermission(currentUser, CATEGORY_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, CATEGORY_DELETE_PERMISSION)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [formState, setFormState] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState(null)
  const [confirmState, setConfirmState] = useState({ open: false, item: null, saving: false, error: "" })

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try {
      const [current, archived] = await Promise.all([fetchCategorySet(), fetchCategorySet("archived")])
      const unique = new Map([...current, ...archived].map((category) => [String(category._id), category]))
      setCategories([...unique.values()])
    } catch (error) {
      toast.error(error.message || "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])
  useEffect(() => { setPage(1) }, [query, status])

  const filteredCategories = useMemo(() => filterCategories(categories, { query, status }), [categories, query, status])
  const pagination = useMemo(() => paginateCategories(filteredCategories, page, PAGE_SIZE), [filteredCategories, page])
  const summary = useMemo(() => getCategorySummary(categories, filteredCategories.length), [categories, filteredCategories.length])

  const closeForm = useCallback(() => {
    if (saving) return
    setFormState({ open: false, item: null })
    setForm(emptyForm)
    setFormError("")
  }, [saving])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError("")
    setFormState({ open: true, item: null })
  }

  const openEdit = (category) => {
    setDetails(null)
    setForm({ code: category.code || "", name: category.name || "", status: category.status || "active" })
    setFormError("")
    setFormState({ open: true, item: category })
  }

  const saveCategory = async (event) => {
    event.preventDefault()
    const payload = buildCategoryPayload(form)
    if (!payload.name) return setFormError("Category name is required.")
    if (!["active", "inactive"].includes(payload.status)) return setFormError("Select a valid status.")
    setSaving(true)
    setFormError("")
    try {
      await api(formState.item?._id ? `/inventory/categories/${formState.item._id}` : "/inventory/categories", {
        method: formState.item?._id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      })
      toast.success(formState.item ? "Category updated" : "Category created")
      setFormState({ open: false, item: null })
      setForm(emptyForm)
      setQuery("")
      setStatus("all")
      setPage(1)
      await loadCategories()
    } catch (error) {
      setFormError(error.message || "Failed to save category.")
    } finally {
      setSaving(false)
    }
  }

  const closeConfirm = useCallback(() => {
    if (confirmState.saving) return
    setConfirmState({ open: false, item: null, saving: false, error: "" })
  }, [confirmState.saving])

  const confirmCategoryAction = async () => {
    const category = confirmState.item
    if (!category?._id) return
    setConfirmState((previous) => ({ ...previous, saving: true, error: "" }))
    try {
      if (category.status === "archived") {
        await api(`/inventory/categories/${category._id}/restore`, { method: "PATCH" })
        toast.success("Category restored as inactive")
        setStatus("inactive")
      } else {
        await api(`/inventory/categories/${category._id}`, { method: "DELETE" })
        toast.success("Category archived")
      }
      setConfirmState({ open: false, item: null, saving: false, error: "" })
      await loadCategories()
    } catch (error) {
      setConfirmState((previous) => ({ ...previous, saving: false, error: error.message || "Action failed" }))
    }
  }

  const showingStart = filteredCategories.length ? pagination.start + 1 : 0

  return (
    <InventoryPageShell>
      <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
      <InventoryPageHeader title="Categories" description="Create inventory categories and maintain their category code." actions={canManage ? <InventoryButton type="button" variant="primary" icon={FiPlus} onClick={openCreate}>Add New</InventoryButton> : null}>
        <InventorySearchToolbar value={query} onChange={setQuery} placeholder="Search categories..." ariaLabel="Search categories" onClear={() => setQuery("")} filterCount={status === "all" ? 0 : 1} filterControls={<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter category status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select>} utilities={<InventoryButton type="button" icon={FiDownload} onClick={() => downloadCsv(filteredCategories)} disabled={!filteredCategories.length}>Export CSV</InventoryButton>} />
      </InventoryPageHeader>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Records" value={summary.totalRecords} note="current records" icon={FiDatabase} tone="indigo" />
        <SummaryCard label="Needs Attention" value={summary.needsAttention} note={summary.needsAttention ? "inactive records" : "all clear"} icon={FiAlertCircle} tone="amber" />
        <SummaryCard label="Total Quantity / Volume" value={summary.totalVolume} note="current view basis" icon={FiActivity} tone="cyan" />
        <SummaryCard label="Filtered Results" value={summary.filteredResults} note={status === "archived" ? "archived records" : "matching records"} icon={FiSliders} tone="blue" />
      </section>

      {!canManage ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">You have view-only category access. Management actions are hidden.</div> : null}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 sm:px-5">Code</th><th className="px-4 py-3 sm:px-5">Category</th><th className="px-4 py-3 sm:px-5">Status</th><th className="px-4 py-3 text-right sm:px-5">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="animate-pulse"><td className="px-5 py-5"><div className="h-4 w-16 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="h-4 w-40 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="h-6 w-16 rounded bg-gray-200" /></td><td className="px-5 py-5"><div className="ml-auto h-7 w-28 rounded bg-gray-200" /></td></tr>) : pagination.rows.length ? pagination.rows.map((category) => (
                <tr key={category._id} className="transition hover:bg-indigo-50/30">
                  <td className="px-4 py-4 text-sm font-semibold text-gray-700 sm:px-5">{category.code}</td><td className="px-4 py-4 text-sm font-semibold text-gray-800 sm:px-5">{category.name}</td><td className="px-4 py-4 sm:px-5"><StatusBadge status={category.status} /></td>
                  <td className="px-4 py-3 sm:px-5"><div className="flex items-center justify-end gap-1"><ActionButton label="View" onClick={() => setDetails(category)}><FiEye /></ActionButton>{canManage && category.status !== "archived" ? <ActionButton label="Edit" onClick={() => openEdit(category)}><FiEdit2 /></ActionButton> : null}{canDelete ? <ActionButton label={category.status === "archived" ? "Restore" : "Archive"} danger={category.status !== "archived"} onClick={() => setConfirmState({ open: true, item: category, saving: false, error: "" })}>{category.status === "archived" ? <FiArchive /> : <FiTrash2 />}</ActionButton> : null}<span className="rounded-lg p-2 text-gray-300"><FiMoreHorizontal /></span></div></td>
                </tr>
              )) : <tr><td colSpan={4} className="px-5 py-16 text-center"><p className="text-sm font-bold text-gray-900">No categories found</p><p className="mt-1 text-sm text-gray-500">Create a category or adjust the current filters.</p></td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs font-medium text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p>Showing {showingStart}-{pagination.end} of {filteredCategories.length} records</p>
          <div className="flex items-center justify-end gap-2"><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-indigo-500 bg-indigo-50 px-3 font-black text-indigo-700">{pagination.page}</span><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>Next</button></div>
        </footer>
      </section>

      <CategoryFormModal state={formState} form={form} setForm={setForm} error={formError} saving={saving} onClose={closeForm} onSubmit={saveCategory} />
      <CategoryDetailsModal category={details} onClose={() => setDetails(null)} onEdit={openEdit} canManage={canManage} />
      <Modal
        open={confirmState.open}
        onClose={closeConfirm}
        title={confirmState.item?.status === "archived" ? "Restore Category" : "Archive Category"}
        subtitle={confirmState.item?.name || ""}
        width="max-w-lg"
        footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={closeConfirm} disabled={confirmState.saving}>Cancel</button><button type="button" className={`${buttonClass} ${confirmState.item?.status === "archived" ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700" : "border-rose-600 bg-rose-600 text-white hover:bg-rose-700"}`} onClick={confirmCategoryAction} disabled={confirmState.saving}>{confirmState.saving ? "Processing..." : confirmState.item?.status === "archived" ? "Restore" : "Archive"}</button></div>}
      >
        {confirmState.error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{confirmState.error}</div> : null}
        <p className="text-sm font-medium leading-6 text-gray-700">{confirmState.item?.status === "archived" ? "This category will return as inactive so it can be reviewed before activation." : "This category will be archived. Existing product relationships remain protected by the server’s inventory rules."}</p>
      </Modal>
    </InventoryPageShell>
  )
}
