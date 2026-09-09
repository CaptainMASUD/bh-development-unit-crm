/* eslint-disable react/prop-types, react-refresh/only-export-components -- route page exports tested data helpers */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import { FiActivity, FiArchive, FiChevronLeft, FiChevronRight, FiDatabase, FiDownload, FiEdit2, FiEye, FiImage, FiMoreHorizontal, FiPlus, FiSliders, FiTrash2, FiUpload, FiX } from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { InventoryButton, InventoryPageHeader, InventoryPageShell, InventorySearchToolbar } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 10
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const PRODUCT_MANAGE_PERMISSION = PERMISSIONS?.INVENTORY_PRODUCT_MANAGE || "inventory-product:manage"
const PRODUCT_DELETE_PERMISSION = PERMISSIONS?.INVENTORY_PRODUCT_DELETE || "inventory-product:delete"
const TRACKING_OPTIONS = [["none", "None"], ["batch", "Batch"], ["serial", "Serial Number"], ["expiry", "Expiry"], ["batch_expiry", "Batch + Expiry"]]
const COSTING_METHODS = [["weighted_average", "Weighted Average"], ["fifo", "FIFO (First-In, First-Out)"], ["standard", "Standard Cost"]]
const emptyForm = { category: "", name: "", sku: "", barcode: "", baseUnit: "", purchaseUnit: "", salesUnit: "", minimumStock: "", generalOrderQuantity: "", maximumStock: "", reorderLevel: "", costingMethod: "weighted_average", standardCost: "", trackingType: "none", status: "active", imageUrl: "" }
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"

function clean(value) { return String(value ?? "").trim() }
function relationId(value) { return clean(value?._id || value) }
function numberValue(value) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }

export function buildProductPayload(form = {}) {
  const payload = { category: clean(form.category), name: clean(form.name), baseUnit: clean(form.baseUnit), minimumStock: numberValue(form.minimumStock), generalOrderQuantity: numberValue(form.generalOrderQuantity), maximumStock: numberValue(form.maximumStock), trackingType: clean(form.trackingType || "none").toLowerCase(), status: clean(form.status || "active").toLowerCase(), imageUrl: clean(form.imageUrl), productType: "inventory", trackInventory: true }
  if (clean(form.sku)) payload.sku = clean(form.sku).toUpperCase()
  if (clean(form.barcode)) payload.barcode = clean(form.barcode).toUpperCase()
  if (form.costingMethod) payload.costingMethod = clean(form.costingMethod).toLowerCase()
  if (form.standardCost !== undefined && form.standardCost !== "" && form.standardCost !== null) {
    payload.standardCost = numberValue(form.standardCost)
  }
  if (form.reorderLevel !== undefined && form.reorderLevel !== "" && form.reorderLevel !== null) {
    payload.reorderLevel = numberValue(form.reorderLevel)
  }
  if (clean(form.purchaseUnit)) payload.purchaseUnit = clean(form.purchaseUnit)
  if (clean(form.salesUnit)) payload.salesUnit = clean(form.salesUnit)
  if (Array.isArray(form.uomConversions) && form.uomConversions.length > 0) {
    payload.uomConversions = form.uomConversions.filter((c) => clean(c.unit) && Number(c.conversionFactor) > 0).map((c) => ({
      unit: clean(c.unit),
      conversionFactor: Number(c.conversionFactor),
    }))
  }
  return payload
}

export function filterProducts(products = [], filters = {}) {
  const query = clean(filters.query).toLowerCase()
  const category = clean(filters.category || "all")
  const unit = clean(filters.unit || "all")
  const tracking = clean(filters.tracking || "all").toLowerCase()
  const status = clean(filters.status || "all").toLowerCase()
  return products.filter((product) => {
    const matchesStatus = status === "all" ? product.status !== "archived" : product.status === status
    const matchesQuery = !query || [product.sku, product.name].some((value) => clean(value).toLowerCase().includes(query))
    return matchesStatus && matchesQuery && (category === "all" || relationId(product.category) === category) && (unit === "all" || relationId(product.baseUnit) === unit) && (tracking === "all" || clean(product.trackingType).toLowerCase() === tracking)
  })
}

export function getProductSummary(products = [], filteredResults = products.length) {
  const current = products.filter((product) => product.status !== "archived")
  return { totalTemplates: current.length, activeTemplates: current.filter((product) => product.status === "active").length, filteredResults }
}

export function buildCategoryTabs(categories = [], products = []) {
  const current = products.filter((product) => product.status !== "archived")
  const counts = new Map()
  current.forEach((product) => { const id = relationId(product.category); if (id) counts.set(id, (counts.get(id) || 0) + 1) })
  return [{ id: "all", name: "All Categories", count: current.length }, ...categories.map((category) => ({ id: String(category._id), name: category.name, count: counts.get(String(category._id)) || 0 }))]
}

export function previewProductCode(category, products = []) {
  const prefix = clean(category?.code).toUpperCase()
  if (!prefix) return ""
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const expression = new RegExp(`^${escaped}(\\d+)$`, "i")
  const categoryId = relationId(category)
  const highest = products.reduce((maximum, product) => {
    if (relationId(product.category) !== categoryId) return maximum
    const match = clean(product.sku).match(expression)
    return match ? Math.max(maximum, Number(match[1]) || 0) : maximum
  }, 0)
  return `${prefix}${highest + 1}`
}

export function paginateProducts(products = [], requestedPage = 1, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, products.length)
  return { page, totalPages, start, end, rows: products.slice(start, end) }
}

function getStoredUser() { try { const stored = JSON.parse(localStorage.getItem("user") || "null"); return stored?.user || stored } catch { return null } }
function requestHeaders() { const token = localStorage.getItem("token"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } }

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { ...requestHeaders(), ...(options.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || "Request failed")
  return data
}

async function fetchProductSet(status = "") {
  const records = []
  const seenCursors = new Set()
  let cursor = ""
  do {
    const params = new URLSearchParams({ limit: "100" })
    if (status) params.set("status", status)
    if (cursor) params.set("cursor", cursor)
    const data = await api(`/inventory/products?${params.toString()}`)
    records.push(...(data.products || []))
    const nextCursor = data.hasMore ? clean(data.nextCursor) : ""
    if (!nextCursor || seenCursors.has(nextCursor)) break
    seenCursors.add(nextCursor)
    cursor = nextCursor
  } while (cursor)
  return records
}

async function uploadProductImage(file) {
  const target = await api("/upload/presign", { method: "POST", body: JSON.stringify({ scope: "product", fileName: file.name, fileType: file.type }) })
  const response = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
  if (!response.ok) throw new Error("Product image upload failed.")
  return target.url
}

function pretty(value) { return clean(value || "—").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) }
function initials(name) { return clean(name).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PI" }

function downloadCsv(products, categoryMap, unitMap) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
  const rows = [["Product Code", "Product Name", "Category", "Unit", "Minimum Stock", "General Order Qty", "Maximum Stock", "Tracking", "Status"], ...products.map((product) => {
    const category = categoryMap.get(relationId(product.category))
    const unit = unitMap.get(relationId(product.baseUnit))
    return [product.sku, product.name, category?.name || "", unit?.symbol || unit?.code || "", product.minimumStock, product.generalOrderQuantity, Number(product.maximumStock) > 0 ? product.maximumStock : "No limit", pretty(product.trackingType), pretty(product.status)]
  })]
  const csv = `\uFEFF${rows.map((row) => row.map(escape).join(",")).join("\n")}`
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `products-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url)
}

function Modal({ open, title, subtitle, onClose, children, footer, width = "max-w-3xl" }) {
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const closeOnEscape = (event) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape) }
  }, [onClose, open])
  if (!open || typeof document === "undefined") return null
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"><button type="button" className="fixed inset-0 cursor-default" aria-label="Close modal" onClick={onClose} /><section className={`relative my-auto w-full ${width} overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl`} role="dialog" aria-modal="true"><header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6"><div><h2 className="text-lg font-black text-gray-950">{title}</h2>{subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}</div><button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close"><FiX className="h-5 w-5" /></button></header><div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>{footer ? <footer className="border-t border-gray-100 px-5 py-4 sm:px-6">{footer}</footer> : null}</section></div>, document.body)
}

function Field({ label, required = false, children }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-gray-600">{label}{required ? <span className="ml-1 text-rose-500">*</span> : null}</span>{children}</label> }
function StatusBadge({ status }) { const classes = status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "archived" ? "border-gray-200 bg-gray-50 text-gray-600" : "border-amber-200 bg-amber-50 text-amber-700"; return <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${classes}`}>{pretty(status)}</span> }
function SummaryCard({ label, value, note, icon: Icon, tone }) { const tones = { indigo: "bg-indigo-50 text-indigo-600", cyan: "bg-cyan-50 text-cyan-600", blue: "bg-blue-50 text-blue-600" }; return <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,.45)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-gray-500">{label}</p><p className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span></div><span className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600">↗ {note}</span></article> }
function ProductImage({ product, large = false }) { const size = large ? "h-20 w-20" : "h-9 w-9"; return product.imageUrl ? <img src={product.imageUrl} alt="" className={`${size} rounded-xl border border-gray-200 object-cover`} /> : <span className={`flex ${size} items-center justify-center rounded-xl border border-gray-200 bg-white text-xs font-black text-indigo-600`}>{initials(product.name)}</span> }
function Detail({ label, value }) { return <div className="rounded-xl border border-gray-100 bg-gray-50 p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-2 text-sm font-bold text-gray-900">{value || "—"}</div></div> }
function ActionButton({ label, onClick, children, danger = false }) { return <button type="button" onClick={onClick} className={`rounded-lg p-2 transition ${danger ? "text-gray-400 hover:bg-rose-50 hover:text-rose-600" : "text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"}`} title={label} aria-label={label}>{children}</button> }

function ProductFormModal({ state, form, setForm, products, categories, units, imagePreview, setImageFile, setImagePreview, error, saving, onClose, onSubmit }) {
  const editing = Boolean(state.item)
  const selectedCategory = categories.find((category) => String(category._id) === form.category)
  const code = editing ? state.item?.sku : previewProductCode(selectedCategory, products)
  const chooseImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Choose a PNG, JPG, or WEBP image.")
    if (file.size > MAX_IMAGE_SIZE) return toast.error("Product image must be 5 MB or smaller.")
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview)
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }
  return <Modal open={state.open} onClose={onClose} title={editing ? "Update Product" : "Create Product"} subtitle="Fields are designed from the Inventory & Purchase business workflow." footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={onClose} disabled={saving}>Cancel</button><button type="submit" form="product-form" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} disabled={saving}>{saving ? "Saving..." : editing ? "Update Record" : "Create Record"}</button></div>}>
    {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
    <form id="product-form" onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><span className="mb-2 block text-sm font-bold text-gray-600">Product Image</span><div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-3">{imagePreview || form.imageUrl ? <img src={imagePreview || form.imageUrl} alt="Product preview" className="h-16 w-16 rounded-xl border border-gray-200 bg-white object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-gray-200 bg-white text-base font-black text-indigo-600">PI</span>}<div className="min-w-0 flex-1"><p className="text-sm font-bold text-gray-700">Upload Product Image</p><p className="mt-1 text-xs text-gray-400">PNG, JPG or WEBP • maximum 5 MB</p><label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 transition hover:bg-gray-50"><FiUpload /> Choose image<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /></label></div></div></div>
      <Field label="Category" required><select className={inputClass} value={form.category} onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value }))} required autoFocus><option value="">Select Category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></Field>
      <Field label="Product Code"><input className={inputClass} value={code || ""} placeholder={form.category ? "Generated when saved" : "Select a category first"} disabled /></Field>
      <Field label="Product Name" required><input className={inputClass} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Enter product name" maxLength={160} required /></Field>
      <Field label="Barcode (Optional)"><input className={inputClass} value={form.barcode || ""} onChange={(event) => setForm((previous) => ({ ...previous, barcode: event.target.value.toUpperCase() }))} placeholder="Enter barcode" maxLength={120} /></Field>
      <Field label="Base Unit" required><select className={inputClass} value={form.baseUnit} onChange={(event) => setForm((previous) => ({ ...previous, baseUnit: event.target.value }))} required><option value="">Select Unit</option>{units.map((unit) => <option key={unit._id} value={unit._id}>{unit.name || unit.unitName} ({unit.symbol || unit.code})</option>)}</select></Field>
      <Field label="Purchase Unit (Optional)"><select className={inputClass} value={form.purchaseUnit || ""} onChange={(event) => setForm((previous) => ({ ...previous, purchaseUnit: event.target.value }))}><option value="">Same as Base Unit</option>{units.map((unit) => <option key={unit._id} value={unit._id}>{unit.name || unit.unitName} ({unit.symbol || unit.code})</option>)}</select></Field>
      <Field label="Sales Unit (Optional)"><select className={inputClass} value={form.salesUnit || ""} onChange={(event) => setForm((previous) => ({ ...previous, salesUnit: event.target.value }))}><option value="">Same as Base Unit</option>{units.map((unit) => <option key={unit._id} value={unit._id}>{unit.name || unit.unitName} ({unit.symbol || unit.code})</option>)}</select></Field>
      <Field label="Costing Method"><select className={inputClass} value={form.costingMethod || "weighted_average"} onChange={(event) => setForm((previous) => ({ ...previous, costingMethod: event.target.value }))}>{COSTING_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {form.costingMethod === "standard" ? (
        <Field label="Standard Cost (BDT)"><input className={inputClass} type="number" min="0" step="0.01" value={form.standardCost || ""} onChange={(event) => setForm((previous) => ({ ...previous, standardCost: event.target.value }))} placeholder="Enter standard unit cost" /></Field>
      ) : null}
      <Field label="Reorder Level"><input className={inputClass} type="number" min="0" step="0.01" value={form.reorderLevel || ""} onChange={(event) => setForm((previous) => ({ ...previous, reorderLevel: event.target.value }))} placeholder="Enter reorder alert level" /></Field>
      <Field label="Minimum Stock"><input className={inputClass} type="number" min="0" step="0.01" value={form.minimumStock} onChange={(event) => setForm((previous) => ({ ...previous, minimumStock: event.target.value }))} placeholder="Enter minimum stock" /></Field>
      <Field label="General Item Order Quantity"><input className={inputClass} type="number" min="0" step="0.01" value={form.generalOrderQuantity} onChange={(event) => setForm((previous) => ({ ...previous, generalOrderQuantity: event.target.value }))} placeholder="Enter general item order quantity" /></Field>
      <Field label="Maximum Stock (Optional)"><input className={inputClass} type="number" min="0" step="0.01" value={form.maximumStock} onChange={(event) => setForm((previous) => ({ ...previous, maximumStock: event.target.value }))} placeholder="Enter maximum stock (optional)" /></Field>
      <Field label="Tracking"><select className={inputClass} value={form.trackingType} onChange={(event) => setForm((previous) => ({ ...previous, trackingType: event.target.value }))}>{TRACKING_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Status" required><select className={inputClass} value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))} required><option value="active">Active</option><option value="inactive">Inactive</option><option value="discontinued">Discontinued</option></select></Field>
    </form>
  </Modal>
}

export default function ProductSetup() {
  const currentUser = useMemo(getStoredUser, [])
  const canManage = hasPermission(currentUser, PRODUCT_MANAGE_PERMISSION)
  const canDelete = hasPermission(currentUser, PRODUCT_DELETE_PERMISSION)
  const categoryScroller = useRef(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [unit, setUnit] = useState("all")
  const [tracking, setTracking] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [formState, setFormState] = useState({ open: false, item: null })
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState("")
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState(null)
  const [confirmState, setConfirmState] = useState({ open: false, item: null, saving: false, error: "" })
  const categoryMap = useMemo(() => new Map(categories.map((item) => [String(item._id), item])), [categories])
  const unitMap = useMemo(() => new Map(units.map((item) => [String(item._id), item])), [units])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const [current, archived, categoryData, unitData] = await Promise.all([fetchProductSet(), fetchProductSet("archived"), api("/inventory/categories/options?limit=200"), api("/inventory/units/options?limit=200")])
      const unique = new Map([...current, ...archived].map((product) => [String(product._id), product]))
      setProducts([...unique.values()]); setCategories(categoryData.categories || []); setUnits(unitData.units || unitData.inventoryUnits || unitData.data || [])
    } catch (error) { toast.error(error.message || "Failed to load products") } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])
  useEffect(() => { setPage(1) }, [query, category, unit, tracking, status])
  const filters = useMemo(() => ({ query, category, unit, tracking, status }), [query, category, unit, tracking, status])
  const filteredProducts = useMemo(() => filterProducts(products, filters), [products, filters])
  const pagination = useMemo(() => paginateProducts(filteredProducts, page, PAGE_SIZE), [filteredProducts, page])
  const summary = useMemo(() => getProductSummary(products, filteredProducts.length), [products, filteredProducts.length])
  const categoryTabs = useMemo(() => buildCategoryTabs(categories, products), [categories, products])

  const resetImage = useCallback(() => { if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); setImageFile(null); setImagePreview("") }, [imagePreview])
  const closeForm = useCallback(() => { if (saving) return; resetImage(); setFormState({ open: false, item: null }); setForm(emptyForm); setFormError("") }, [resetImage, saving])
  const openCreate = () => { resetImage(); setForm(emptyForm); setFormError(""); setFormState({ open: true, item: null }) }

  const openEdit = async (product) => {
    if (product.status === "archived") return toast.error("Restore the archived product before editing it.")
    resetImage(); setDetails(null); setFormError("")
    try {
      const data = await api(`/inventory/products/${product._id}`)
      const item = data.product
      setForm({
        category: relationId(item.category),
        name: item.name || "",
        sku: item.sku || "",
        barcode: item.barcode || "",
        baseUnit: relationId(item.baseUnit),
        purchaseUnit: relationId(item.purchaseUnit),
        salesUnit: relationId(item.salesUnit),
        minimumStock: String(item.minimumStock ?? ""),
        generalOrderQuantity: String(item.generalOrderQuantity ?? ""),
        maximumStock: Number(item.maximumStock) > 0 ? String(item.maximumStock) : "",
        reorderLevel: String(item.reorderLevel ?? ""),
        costingMethod: item.costingMethod || "weighted_average",
        standardCost: String(item.standardCost ?? ""),
        trackingType: item.trackingType || "none",
        status: item.status || "active",
        imageUrl: item.imageUrl || "",
      })
      setFormState({ open: true, item })
    } catch (error) { toast.error(error.message || "Failed to load product") }
  }

  const saveProduct = async (event) => {
    event.preventDefault()
    let payload = buildProductPayload(form)
    if (!payload.category) return setFormError("Select a category.")
    if (!payload.name) return setFormError("Product name is required.")
    if (!payload.baseUnit) return setFormError("Select a unit.")
    if (payload.maximumStock > 0 && payload.minimumStock > payload.maximumStock) return setFormError("Maximum stock must be greater than or equal to minimum stock.")
    setSaving(true); setFormError("")
    try {
      if (imageFile) payload = { ...payload, imageUrl: await uploadProductImage(imageFile) }
      await api(formState.item?._id ? `/inventory/products/${formState.item._id}` : "/inventory/products", { method: formState.item?._id ? "PATCH" : "POST", body: JSON.stringify(payload) })
      toast.success(formState.item ? "Product updated" : "Product created")
      resetImage(); setFormState({ open: false, item: null }); setForm(emptyForm); setQuery(""); setCategory("all"); setUnit("all"); setTracking("all"); setStatus("all"); setPage(1)
      await loadProducts()
    } catch (error) { setFormError(error.message || "Failed to save product.") } finally { setSaving(false) }
  }

  const closeConfirm = useCallback(() => { if (confirmState.saving) return; setConfirmState({ open: false, item: null, saving: false, error: "" }) }, [confirmState.saving])
  const confirmProductAction = async () => {
    const product = confirmState.item
    if (!product?._id) return
    setConfirmState((previous) => ({ ...previous, saving: true, error: "" }))
    try {
      if (product.status === "archived") { await api(`/inventory/products/${product._id}/restore`, { method: "PATCH" }); toast.success("Product restored as inactive"); setStatus("inactive") }
      else { await api(`/inventory/products/${product._id}`, { method: "DELETE" }); toast.success("Product archived") }
      setConfirmState({ open: false, item: null, saving: false, error: "" }); await loadProducts()
    } catch (error) { setConfirmState((previous) => ({ ...previous, saving: false, error: error.message || "Action failed" })) }
  }

  const showingStart = filteredProducts.length ? pagination.start + 1 : 0
  return <InventoryPageShell>
    <Toaster position="top-right" toastOptions={{ duration: 2600, style: { borderRadius: "14px", fontWeight: 700 } }} />
    <InventoryPageHeader title="Products" description="Create reusable product templates with category-based product codes and tracking controls." actions={canManage ? <InventoryButton type="button" variant="primary" icon={FiPlus} onClick={openCreate}>Add New</InventoryButton> : null}>
      <InventorySearchToolbar
        value={query}
        onChange={(value) => setQuery(value)}
        placeholder="Search products..."
        ariaLabel="Search products"
        onClear={() => setQuery("")}
        filterCount={[category, unit, tracking, status].filter((value) => value !== "all").length}
        filterControls={<><select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><select className={inputClass} value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="Filter by unit"><option value="all">All units</option>{units.map((item) => <option key={item._id} value={item._id}>{item.symbol || item.code || item.name}</option>)}</select><select className={inputClass} value={tracking} onChange={(event) => setTracking(event.target.value)} aria-label="Filter by tracking"><option value="all">All tracking types</option>{TRACKING_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter product status">{["all", "active", "inactive", "discontinued", "archived"].map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : pretty(value)}</option>)}</select></>}
        utilities={<InventoryButton type="button" icon={FiDownload} onClick={() => downloadCsv(filteredProducts, categoryMap, unitMap)} disabled={!filteredProducts.length}>Export CSV</InventoryButton>}
      />
    </InventoryPageHeader>

    <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><SummaryCard label="Total Templates" value={summary.totalTemplates} note="current records" icon={FiDatabase} tone="indigo" /><SummaryCard label="Active Templates" value={summary.activeTemplates} note="current view basis" icon={FiActivity} tone="cyan" /><SummaryCard label="Filtered Results" value={summary.filteredResults} note={status === "archived" ? "archived records" : "all records"} icon={FiSliders} tone="blue" /></section>

    <section className="mb-4 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]"><button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50" onClick={() => categoryScroller.current?.scrollBy({ left: -280, behavior: "smooth" })} aria-label="Previous categories"><FiChevronLeft /></button><div ref={categoryScroller} className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{categoryTabs.map((tab) => <button key={tab.id} type="button" onClick={() => setCategory(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${category === tab.id ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>{tab.name}<span className={`rounded-full px-2 py-0.5 text-xs ${category === tab.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span></button>)}</div><button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50" onClick={() => categoryScroller.current?.scrollBy({ left: 280, behavior: "smooth" })} aria-label="Next categories"><FiChevronRight /></button></section>

    {!canManage ? <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">You have view-only product access. Management actions are hidden.</div> : null}

    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_40px_-32px_rgba(15,23,42,.5)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[1420px] text-left"><thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr>{["Image", "Product Code", "Product Name", "Category", "Unit", "Minimum Stock", "General Order Qty", "Maximum Stock", "Tracking", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} className="animate-pulse">{Array.from({ length: 11 }, (_, cell) => <td key={cell} className="px-4 py-5"><div className="h-4 w-16 rounded bg-gray-200" /></td>)}</tr>) : pagination.rows.length ? pagination.rows.map((product) => {
        const categoryRecord = categoryMap.get(relationId(product.category)); const unitRecord = unitMap.get(relationId(product.baseUnit))
        return <tr key={product._id} className="transition hover:bg-indigo-50/30"><td className="px-4 py-3"><ProductImage product={product} /></td><td className="px-4 py-4 text-sm font-semibold text-gray-700">{product.sku}</td><td className="px-4 py-4 text-sm font-semibold text-gray-800">{product.name}</td><td className="px-4 py-4 text-sm font-medium text-gray-700">{categoryRecord?.name || "—"}</td><td className="px-4 py-4 text-sm font-medium text-gray-700">{unitRecord?.symbol || unitRecord?.code || "—"}</td><td className="px-4 py-4 text-sm text-gray-700">{product.minimumStock ?? 0}</td><td className="px-4 py-4 text-sm text-gray-700">{product.generalOrderQuantity ?? 0}</td><td className="px-4 py-4 text-sm text-gray-700">{Number(product.maximumStock) > 0 ? product.maximumStock : <span className="text-gray-400">No limit</span>}</td><td className="px-4 py-4 text-sm text-gray-700">{pretty(product.trackingType)}</td><td className="px-4 py-4"><StatusBadge status={product.status} /></td><td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><ActionButton label="View" onClick={() => setDetails(product)}><FiEye /></ActionButton>{canManage && product.status !== "archived" ? <ActionButton label="Edit" onClick={() => openEdit(product)}><FiEdit2 /></ActionButton> : null}{canDelete ? <ActionButton label={product.status === "archived" ? "Restore" : "Archive"} danger={product.status !== "archived"} onClick={() => setConfirmState({ open: true, item: product, saving: false, error: "" })}>{product.status === "archived" ? <FiArchive /> : <FiTrash2 />}</ActionButton> : null}<span className="rounded-lg p-2 text-gray-300"><FiMoreHorizontal /></span></div></td></tr>
      }) : <tr><td colSpan={11} className="px-5 py-16 text-center"><FiImage className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 text-sm font-bold text-gray-900">No products found</p><p className="mt-1 text-sm text-gray-500">Create a product or adjust the current filters.</p></td></tr>}</tbody></table></div>
      <footer className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 text-xs font-medium text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p>Showing {showingStart}-{pagination.end} of {filteredProducts.length} records</p><div className="flex items-center justify-end gap-2"><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button><span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-indigo-500 bg-indigo-50 px-3 font-black text-indigo-700">{pagination.page}</span><button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40" onClick={() => setPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>Next</button></div></footer>
    </section>

    <ProductFormModal state={formState} form={form} setForm={setForm} products={products} categories={categories} units={units} imagePreview={imagePreview} setImageFile={setImageFile} setImagePreview={setImagePreview} error={formError} saving={saving} onClose={closeForm} onSubmit={saveProduct} />
    <Modal open={Boolean(details)} onClose={() => setDetails(null)} title="Product Details" subtitle="Reusable inventory product template" width="max-w-2xl" footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={() => setDetails(null)}>Close</button>{details && canManage && details.status !== "archived" ? <button type="button" className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`} onClick={() => openEdit(details)}><FiEdit2 /> Edit</button> : null}</div>}>{details ? <div><div className="mb-5 flex items-center gap-4"><ProductImage product={details} large /><div><p className="text-lg font-black text-gray-950">{details.name}</p><p className="text-sm font-semibold text-gray-500">{details.sku}</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Detail label="Category" value={categoryMap.get(relationId(details.category))?.name} /><Detail label="Unit" value={unitMap.get(relationId(details.baseUnit))?.symbol || unitMap.get(relationId(details.baseUnit))?.name} /><Detail label="Costing Method" value={pretty(details.costingMethod || "weighted_average")} /><Detail label="Standard Cost" value={details.costingMethod === "standard" ? `BDT ${details.standardCost ?? 0}` : "—"} /><Detail label="Barcode" value={details.barcode || "—"} /><Detail label="Reorder Level" value={String(details.reorderLevel ?? 0)} /><Detail label="Minimum Stock" value={String(details.minimumStock ?? 0)} /><Detail label="General Order Quantity" value={String(details.generalOrderQuantity ?? 0)} /><Detail label="Maximum Stock" value={Number(details.maximumStock) > 0 ? String(details.maximumStock) : "No limit"} /><Detail label="Tracking" value={pretty(details.trackingType)} /><Detail label="Status" value={<StatusBadge status={details.status} />} /><Detail label="Last Updated" value={formatDate(details.updatedAt)} /></div></div> : null}</Modal>
    <Modal open={confirmState.open} onClose={closeConfirm} title={confirmState.item?.status === "archived" ? "Restore Product" : "Archive Product"} subtitle={confirmState.item?.name || ""} width="max-w-lg" footer={<div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} border-gray-200 bg-white text-gray-800 hover:bg-gray-50`} onClick={closeConfirm} disabled={confirmState.saving}>Cancel</button><button type="button" className={`${buttonClass} ${confirmState.item?.status === "archived" ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700" : "border-rose-600 bg-rose-600 text-white hover:bg-rose-700"}`} onClick={confirmProductAction} disabled={confirmState.saving}>{confirmState.saving ? "Processing..." : confirmState.item?.status === "archived" ? "Restore" : "Archive"}</button></div>}>{confirmState.error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{confirmState.error}</div> : null}<p className="text-sm font-medium leading-6 text-gray-700">{confirmState.item?.status === "archived" ? "This product will return as inactive so it can be reviewed before activation." : "This product template will be archived. Existing inventory records remain protected by the server’s inventory rules."}</p></Modal>
  </InventoryPageShell>
}
