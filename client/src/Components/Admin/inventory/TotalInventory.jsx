/* eslint-disable react/prop-types, react-refresh/only-export-components -- route page uses local presentational components and exports a tested payload helper */
"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import toast, { Toaster } from "react-hot-toast"
import {
  FiActivity,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDatabase,
  FiDownload,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiMapPin,
  FiMoreHorizontal,
  FiPlus,
  FiRefreshCw,
  FiSliders,
  FiTrash2,
  FiX,
} from "react-icons/fi"
import { hasPermission, PERMISSIONS } from "../../Auth/permissions"
import { InventoryButton, InventoryPageHeader, InventoryPageShell, InventorySearchToolbar } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const PAGE_SIZE = 10

const emptySummary = {
  productCount: 0,
  stockRows: 0,
  inventoryValue: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
}

const emptyCreateForm = {
  product: "",
  warehouse: "",
  location: "",
  quantity: "",
  stockPrice: "",
  idempotencyKey: "",
}

const emptySettingsForm = {
  reorderLevel: "0",
  minimumStock: "0",
  maximumStock: "0",
  status: "active",
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"

function clean(value) {
  return String(value ?? "").trim()
}

function normalizeId(value) {
  return clean(value?._id || value)
}

export function buildOpeningStockPayload(form = {}) {
  return {
    product: clean(form.product),
    warehouse: clean(form.warehouse),
    location: clean(form.location) || null,
    quantity: Number(form.quantity),
    stockPrice: Number(form.stockPrice),
    idempotencyKey: clean(form.idempotencyKey),
  }
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })
}

function formatMoney(value) {
  return `৳${formatNumber(value, 2)}`
}

function pretty(value) {
  return clean(value || "-")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function initials(value) {
  const words = clean(value).split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "IT").toUpperCase()
}

function relationLabel(item, fallback = "-") {
  if (!item) return fallback
  const name = item.name || item.label || fallback
  const code = item.code || item.sku || ""
  return `${name}${code ? ` (${code})` : ""}`
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
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
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

function downloadCsv(filename, rows) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`
  const content = rows.map((row) => row.map(escape).join(",")).join("\n")
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function Modal({ open, title, subtitle, onClose, children, footer, width = "max-w-3xl" }) {
  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose, open])

  if (!open || typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <button className="fixed inset-0 cursor-default" type="button" aria-label="Close modal" onClick={onClose} />
      <section className={`relative my-auto w-full ${width} overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl`} role="dialog" aria-modal="true">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-black text-gray-950">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <FiX className="h-5 w-5" />
          </button>
        </header>
        <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? <footer className="border-t border-gray-100 px-5 py-4 sm:px-6">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  )
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-gray-600">
        {label}{required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  )
}

function StatusBadge({ status }) {
  const active = status === "active" || status === "completed" || status === "accepted"
  const pending = ["waiting", "processing", "pending"].includes(status)
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${
      active
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : pending
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-gray-200 bg-gray-50 text-gray-600"
    }`}>
      {pretty(status)}
    </span>
  )
}

function ProductAvatar({ product }) {
  return product?.imageUrl ? (
    <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-xl border border-gray-200 object-cover" />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-xs font-black text-indigo-600">
      {initials(product?.name)}
    </div>
  )
}

function SummaryCard({ label, value, note, icon: Icon, tone }) {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    cyan: "bg-cyan-50 text-cyan-600",
    blue: "bg-blue-50 text-blue-600",
  }
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-gray-950">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[tone]}`}><Icon className="h-5 w-5" /></span>
      </div>
      <span className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600">↗ {note}</span>
    </article>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" className={`${buttonClass} px-3 py-2`} onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <FiChevronLeft /> Previous
      </button>
      <span className="flex h-9 min-w-9 items-center justify-center rounded-xl border border-indigo-500 bg-indigo-50 px-3 text-sm font-black text-indigo-700">{page}</span>
      <button type="button" className={`${buttonClass} px-3 py-2`} onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Next <FiChevronRight />
      </button>
    </div>
  )
}

function RowActions({ onView, onEdit, onDelete, canManage, canDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" onClick={onView} className="rounded-lg p-2 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600" title="View"><FiEye /></button>
      {canManage ? <button type="button" onClick={onEdit} className="rounded-lg p-2 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600" title="Edit"><FiEdit2 /></button> : null}
      {canDelete ? <button type="button" onClick={onDelete} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600" title="Archive"><FiTrash2 /></button> : null}
      <span className="rounded-lg p-2 text-gray-300"><FiMoreHorizontal /></span>
    </div>
  )
}

export default function InventoryItemsPage() {
  const currentUser = useMemo(getStoredUser, [])
  const canManage = hasPermission(currentUser, PERMISSIONS?.INVENTORY_STOCK_MANAGE || "inventory-stock:manage")
  const canDelete = hasPermission(currentUser, PERMISSIONS?.INVENTORY_STOCK_DELETE || "inventory-stock:delete")

  const [activeTab, setActiveTab] = useState("items")
  const [summary, setSummary] = useState(emptySummary)
  const [items, setItems] = useState([])
  const [itemTotal, setItemTotal] = useState(0)
  const [itemTotalPages, setItemTotalPages] = useState(1)
  const [positions, setPositions] = useState([])
  const [positionTotal, setPositionTotal] = useState(0)
  const [qualityRequests, setQualityRequests] = useState([])
  const [qualityTotal, setQualityTotal] = useState(0)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [hideInactive, setHideInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [createError, setCreateError] = useState("")
  const [previousQuantity, setPreviousQuantity] = useState(0)
  const [warehouseQuantity, setWarehouseQuantity] = useState(0)
  const [detail, setDetail] = useState({ open: false, product: null, positions: [] })
  const [settings, setSettings] = useState({ open: false, stock: null })
  const [settingsForm, setSettingsForm] = useState(emptySettingsForm)

  const categoryMap = useMemo(() => new Map(categories.map((item) => [normalizeId(item), item])), [categories])
  const unitMap = useMemo(() => new Map(units.map((item) => [normalizeId(item), item])), [units])
  const selectedProduct = useMemo(
    () => products.find((item) => normalizeId(item) === createForm.product) || null,
    [createForm.product, products]
  )

  const effectiveStatus = hideInactive ? "active" : status

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(clean(search))
      setPage(1)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    Promise.all([
      api("/inventory/products?status=active&productType=inventory&trackInventory=true&limit=100"),
      api("/inventory/categories/options?limit=200"),
      api("/inventory/units/options?limit=200"),
      api("/inventory/warehouses/options?limit=100"),
    ]).then(([productData, categoryData, unitData, warehouseData]) => {
      setProducts(productData.products || [])
      setCategories(categoryData.categories || [])
      setUnits(unitData.units || [])
      setWarehouses(warehouseData.warehouses || [])
    }).catch((error) => toast.error(error.message || "Failed to load inventory options"))
  }, [refreshKey])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    const listParams = new URLSearchParams({ limit: "100" })
    if (debouncedSearch) {
      params.set("q", debouncedSearch)
      listParams.set("q", debouncedSearch)
    }
    if (effectiveStatus !== "all") {
      params.set("status", effectiveStatus)
      listParams.set("status", effectiveStatus)
    }

    setLoading(true)
    Promise.all([
      api("/inventory/stocks/summary", { signal: controller.signal }),
      api(`/inventory/stocks/items?${params}`, { signal: controller.signal }),
      api(`/inventory/stocks?${listParams}`, { signal: controller.signal }),
      api("/inventory/operations/inspections?status=waiting&limit=100", { signal: controller.signal }),
    ]).then(([summaryData, itemData, positionData, qualityData]) => {
      setSummary({ ...emptySummary, ...(summaryData.summary || {}) })
      setItems(itemData.items || [])
      setItemTotal(itemData.total || 0)
      setItemTotalPages(itemData.totalPages || 1)
      setPositions(positionData.stocks || [])
      setPositionTotal(positionData.count || 0)
      setQualityRequests(qualityData.items || [])
      setQualityTotal(qualityData.total || 0)
    }).catch((error) => {
      if (error.name !== "AbortError") toast.error(error.message || "Failed to load inventory items")
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [debouncedSearch, effectiveStatus, page, refreshKey])

  useEffect(() => {
    if (!createForm.warehouse) {
      setLocations([])
      return
    }
    api(`/inventory/warehouse-locations/options?warehouse=${encodeURIComponent(createForm.warehouse)}&limit=200`)
      .then((data) => setLocations(data.locations || []))
      .catch((error) => toast.error(error.message))
  }, [createForm.warehouse])

  const visibleQuality = useMemo(() => {
    const query = debouncedSearch.toLowerCase()
    if (!query) return qualityRequests
    return qualityRequests.filter((item) => JSON.stringify(item).toLowerCase().includes(query))
  }, [debouncedSearch, qualityRequests])

  const positionPages = Math.max(1, Math.ceil(positionTotal / PAGE_SIZE))
  const qualityPages = Math.max(1, Math.ceil(visibleQuality.length / PAGE_SIZE))
  const visiblePositions = positions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const visibleQualityPage = visibleQuality.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filteredResults = activeTab === "items" ? itemTotal : activeTab === "positions" ? positionTotal : visibleQuality.length
  const totalPages = activeTab === "items" ? itemTotalPages : activeTab === "positions" ? positionPages : qualityPages

  const refresh = () => setRefreshKey((value) => value + 1)

  const openCreate = async (product = null) => {
    const productId = normalizeId(product)
    const found = products.find((item) => normalizeId(item) === productId)
    setCreateForm({
      ...emptyCreateForm,
      product: productId,
      stockPrice: found?.purchasePrice != null ? String(found.purchasePrice) : "",
      idempotencyKey: globalThis.crypto?.randomUUID?.() || `inventory-item-${Date.now()}`,
    })
    setCreateError("")
    setPreviousQuantity(0)
    setWarehouseQuantity(0)
    setLocations([])
    setCreateOpen(true)
    if (productId) await loadProductAvailability(productId)
  }

  const loadProductAvailability = async (productId, warehouseId = "") => {
    if (!productId) return
    try {
      const suffix = warehouseId ? `?warehouse=${encodeURIComponent(warehouseId)}` : ""
      const data = await api(`/inventory/stocks/availability/${productId}${suffix}`)
      if (warehouseId) setWarehouseQuantity(data.totals?.onHandQuantity || 0)
      else setPreviousQuantity(data.totals?.onHandQuantity || 0)
    } catch (error) {
      toast.error(error.message || "Failed to load existing quantity")
    }
  }

  const selectProduct = async (productId) => {
    const product = products.find((item) => normalizeId(item) === productId)
    setCreateForm((previous) => ({
      ...previous,
      product: productId,
      stockPrice: product?.purchasePrice != null ? String(product.purchasePrice) : "",
    }))
    setPreviousQuantity(0)
    setWarehouseQuantity(0)
    if (productId) await loadProductAvailability(productId)
  }

  const selectWarehouse = async (warehouseId) => {
    setCreateForm((previous) => ({ ...previous, warehouse: warehouseId, location: "" }))
    setWarehouseQuantity(0)
    if (createForm.product && warehouseId) await loadProductAvailability(createForm.product, warehouseId)
  }

  const createInventoryItem = async (event) => {
    event.preventDefault()
    setCreateError("")
    const payload = buildOpeningStockPayload(createForm)
    if (!payload.product) return setCreateError("Product name is required.")
    if (!payload.warehouse) return setCreateError("Warehouse is required.")
    if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) return setCreateError("Quantity to add must be greater than zero.")
    if (!Number.isFinite(payload.stockPrice) || payload.stockPrice < 0) return setCreateError("Stock price must be a valid non-negative number.")

    setSaving(true)
    try {
      const data = await api("/inventory/stocks/opening-stock", { method: "POST", body: JSON.stringify(payload) })
      toast.success(data.message || "Opening stock posted")
      setCreateOpen(false)
      setCreateForm(emptyCreateForm)
      refresh()
    } catch (error) {
      setCreateError(error.message || "Failed to create inventory item")
    } finally {
      setSaving(false)
    }
  }

  const openProductDetails = async (product) => {
    try {
      const data = await api(`/inventory/stocks/availability/${normalizeId(product)}`)
      setDetail({ open: true, product: product?.name ? product : data.stocks?.[0]?.product, positions: data.stocks || [] })
    } catch (error) {
      toast.error(error.message || "Failed to load item details")
    }
  }

  const openPositionDetails = (stock) => setDetail({ open: true, product: stock.product, positions: [stock] })

  const openSettings = (stock) => {
    setSettings({ open: true, stock })
    setSettingsForm({
      reorderLevel: String(stock.reorderLevel ?? 0),
      minimumStock: String(stock.minimumStock ?? 0),
      maximumStock: String(stock.maximumStock ?? 0),
      status: stock.status || "active",
    })
  }

  const saveSettings = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await api(`/inventory/stocks/${settings.stock._id}/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          reorderLevel: Number(settingsForm.reorderLevel),
          minimumStock: Number(settingsForm.minimumStock),
          maximumStock: Number(settingsForm.maximumStock),
          status: settingsForm.status,
        }),
      })
      toast.success("Stock settings updated")
      setSettings({ open: false, stock: null })
      refresh()
    } catch (error) {
      toast.error(error.message || "Failed to update stock settings")
    } finally {
      setSaving(false)
    }
  }

  const archivePosition = async (stock) => {
    if (!window.confirm(`Archive ${stock.product?.name || "this stock position"}?`)) return
    try {
      await api(`/inventory/stocks/${stock._id}`, { method: "DELETE" })
      toast.success("Stock position archived")
      refresh()
    } catch (error) {
      toast.error(error.message || "Only zero-balance positions can be archived")
    }
  }

  const archiveProduct = async (product) => {
    if (!window.confirm(`Archive all zero-balance positions for ${product.name}?`)) return
    try {
      const data = await api(`/inventory/stocks/availability/${normalizeId(product)}`)
      if ((data.stocks || []).some((stock) => Number(stock.onHandQuantity || 0) !== 0)) {
        throw new Error("This item still has stock. Reduce every position to zero before archiving it.")
      }
      await Promise.all((data.stocks || []).map((stock) => api(`/inventory/stocks/${stock._id}`, { method: "DELETE" })))
      toast.success("Inventory item archived")
      refresh()
    } catch (error) {
      toast.error(error.message || "Failed to archive inventory item")
    }
  }

  const exportCurrentView = () => {
    if (activeTab === "items") {
      downloadCsv("inventory-items.csv", [
        ["Code", "Product Name", "Total Quantity", "Stock Value", "Status"],
        ...items.map((item) => [item.product?.sku, item.product?.name, item.totalQuantity, item.stockValue, item.status]),
      ])
    } else if (activeTab === "positions") {
      downloadCsv("warehouse-and-bins.csv", [
        ["Code", "Product", "Warehouse", "Bin / Shelf", "On Hand", "Available", "Value", "Status"],
        ...positions.map((stock) => [stock.product?.sku, stock.product?.name, stock.warehouse?.name, stock.location?.name, stock.onHandQuantity, stock.availableQuantity, stock.inventoryValue, stock.status]),
      ])
    } else {
      downloadCsv("pending-quality-requests.csv", [
        ["Reference", "Product", "Warehouse", "Previous Quantity", "Status"],
        ...visibleQuality.map((item) => [item.inspectionReference, item.product?.name, item.warehouse?.name, item.previousQuantity, item.status]),
      ])
    }
  }

  return (
    <InventoryPageShell>
      <Toaster position="top-right" />
      <InventoryPageHeader title="Inventory Items" description="Add stock only from an existing Products template, then assign its quantity, warehouse and bin." actions={canManage ? <InventoryButton type="button" variant="primary" icon={FiPlus} onClick={() => openCreate()}>Add New</InventoryButton> : null}>
        <InventorySearchToolbar value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Search inventory items..." ariaLabel="Search inventory items" onClear={() => { setSearch(""); setPage(1) }} filterCount={status === "all" ? 0 : 1} filterControls={<select className={inputClass} value={status} onChange={(event) => { setStatus(event.target.value); setHideInactive(false); setPage(1) }} aria-label="Filter inventory status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>} utilities={<><InventoryButton type="button" onClick={() => { setHideInactive((value) => !value); setPage(1) }} icon={hideInactive ? FiEye : FiEyeOff}>{hideInactive ? "Show Inactive" : "Hide Inactive"}</InventoryButton><InventoryButton type="button" onClick={exportCurrentView} icon={FiDownload}>Export CSV</InventoryButton><InventoryButton type="button" onClick={refresh} disabled={loading} icon={FiRefreshCw}>{loading ? "Refreshing..." : "Refresh"}</InventoryButton></>} />
      </InventoryPageHeader>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Records" value={formatNumber(summary.productCount, 0)} note="current records" icon={FiDatabase} tone="indigo" />
          <SummaryCard label="Needs Attention" value={formatNumber(summary.lowStockCount, 0)} note={summary.lowStockCount ? "review required" : "all clear"} icon={FiClock} tone="amber" />
          <SummaryCard label="Total Value" value={formatMoney(summary.inventoryValue)} note="current view basis" icon={FiActivity} tone="cyan" />
          <SummaryCard label="Filtered Results" value={formatNumber(filteredResults, 0)} note="matching records" icon={FiSliders} tone="blue" />
        </section>

        <nav className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row">
            {[
              ["items", "Total Quantity", itemTotal],
              ["positions", "Warehouse & Bins", positionTotal],
              ["quality", "Pending Quality Requests", qualityTotal],
            ].map(([key, label, count]) => (
              <button key={key} type="button" onClick={() => { setActiveTab(key); setPage(1) }} className={`flex items-center justify-center gap-3 rounded-xl px-5 py-3 text-sm font-bold transition sm:justify-start ${activeTab === key ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>
                {label}<span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === key ? "bg-white/20 text-white" : key === "quality" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{count}</span>
              </button>
            ))}
          </div>
        </nav>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm font-bold text-gray-400"><FiRefreshCw className="mr-2 animate-spin" /> Loading inventory items...</div>
          ) : activeTab === "items" ? (
            <ItemsTable items={items} canManage={canManage} canDelete={canDelete} onView={openProductDetails} onEdit={openCreate} onDelete={archiveProduct} />
          ) : activeTab === "positions" ? (
            <PositionsTable positions={visiblePositions} canManage={canManage} canDelete={canDelete} onView={openPositionDetails} onEdit={openSettings} onDelete={archivePosition} />
          ) : (
            <QualityTable rows={visibleQualityPage} />
          )}

          <footer className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {filteredResults ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, filteredResults)} of {filteredResults} records</span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </footer>
        </section>
      <CreateInventoryModal
        open={createOpen}
        form={createForm}
        setForm={setCreateForm}
        product={selectedProduct}
        products={products}
        warehouses={warehouses}
        locations={locations}
        category={categoryMap.get(normalizeId(selectedProduct?.category))}
        unit={unitMap.get(normalizeId(selectedProduct?.baseUnit))}
        previousQuantity={previousQuantity}
        warehouseQuantity={warehouseQuantity}
        error={createError}
        saving={saving}
        onProductChange={selectProduct}
        onWarehouseChange={selectWarehouse}
        onClose={() => !saving && setCreateOpen(false)}
        onSubmit={createInventoryItem}
      />

      <DetailModal state={detail} onClose={() => setDetail({ open: false, product: null, positions: [] })} />
      <SettingsModal state={settings} form={settingsForm} setForm={setSettingsForm} saving={saving} onClose={() => !saving && setSettings({ open: false, stock: null })} onSubmit={saveSettings} />
    </InventoryPageShell>
  )
}

function EmptyRows({ columns, message }) {
  return <tr><td colSpan={columns} className="px-6 py-20 text-center text-sm font-semibold text-gray-400">{message}</td></tr>
}

function ItemsTable({ items, canManage, canDelete, onView, onEdit, onDelete }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 text-left text-[11px] font-black uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-4">Image</th><th className="px-4 py-4">Code</th><th className="px-4 py-4">Product Name</th><th className="px-4 py-4">Total Quantity</th><th className="px-4 py-4">Stock Value</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => <tr key={item.product?._id} className="text-sm text-gray-700 transition hover:bg-gray-50/70"><td className="px-4 py-3"><ProductAvatar product={item.product} /></td><td className="px-4 py-3 font-semibold">{item.product?.sku || "-"}</td><td className="px-4 py-3 font-semibold">{item.product?.name || "-"}</td><td className="px-4 py-3 font-semibold tabular-nums">{formatNumber(item.totalQuantity)}</td><td className="px-4 py-3 font-black text-gray-900">{formatMoney(item.stockValue)}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="px-4 py-3"><RowActions onView={() => onView(item.product)} onEdit={() => onEdit(item.product)} onDelete={() => onDelete(item.product)} canManage={canManage} canDelete={canDelete} /></td></tr>)}
            {!items.length ? <EmptyRows columns={7} message="No inventory items match the current filters." /> : null}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 md:hidden">{items.map((item) => <article key={item.product?._id} className="rounded-2xl border border-gray-200 p-4"><div className="flex items-center gap-3"><ProductAvatar product={item.product} /><div className="min-w-0 flex-1"><h3 className="truncate font-black text-gray-900">{item.product?.name}</h3><p className="text-xs font-semibold text-gray-400">{item.product?.sku}</p></div><StatusBadge status={item.status} /></div><div className="mt-4 grid grid-cols-2 gap-3"><Metric label="Total Quantity" value={formatNumber(item.totalQuantity)} /><Metric label="Stock Value" value={formatMoney(item.stockValue)} /></div><div className="mt-3 border-t border-gray-100 pt-2"><RowActions onView={() => onView(item.product)} onEdit={() => onEdit(item.product)} onDelete={() => onDelete(item.product)} canManage={canManage} canDelete={canDelete} /></div></article>)}</div>
    </>
  )
}

function PositionsTable({ positions, canManage, canDelete, onView, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="bg-gray-50 text-left text-[11px] font-black uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-4">Product</th><th className="px-4 py-4">Warehouse</th><th className="px-4 py-4">Bin / Shelf</th><th className="px-4 py-4">On Hand</th><th className="px-4 py-4">Available</th><th className="px-4 py-4">Stock Value</th><th className="px-4 py-4">Status</th><th className="px-4 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{positions.map((stock) => <tr key={stock._id} className="text-sm text-gray-700 hover:bg-gray-50/70"><td className="px-4 py-3"><div className="flex items-center gap-3"><ProductAvatar product={stock.product} /><div><p className="font-bold text-gray-900">{stock.product?.name}</p><p className="text-xs text-gray-400">{stock.product?.sku}</p></div></div></td><td className="px-4 py-3 font-semibold">{relationLabel(stock.warehouse)}</td><td className="px-4 py-3">{relationLabel(stock.location, "Warehouse level")}</td><td className="px-4 py-3 font-bold">{formatNumber(stock.onHandQuantity)}</td><td className="px-4 py-3 font-bold">{formatNumber(stock.availableQuantity)}</td><td className="px-4 py-3 font-black">{formatMoney(stock.inventoryValue)}</td><td className="px-4 py-3"><StatusBadge status={stock.status} /></td><td className="px-4 py-3"><RowActions onView={() => onView(stock)} onEdit={() => onEdit(stock)} onDelete={() => onDelete(stock)} canManage={canManage} canDelete={canDelete} /></td></tr>)}{!positions.length ? <EmptyRows columns={8} message="No warehouse positions match the current filters." /> : null}</tbody></table></div>
  )
}

function QualityTable({ rows }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead className="bg-gray-50 text-left text-[11px] font-black uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-4">Reference</th><th className="px-4 py-4">Product</th><th className="px-4 py-4">Warehouse</th><th className="px-4 py-4">Bin / Shelf</th><th className="px-4 py-4">Previous Quantity</th><th className="px-4 py-4">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{rows.map((item) => <tr key={item._id} className="text-sm text-gray-700 hover:bg-gray-50/70"><td className="px-4 py-3 font-black text-indigo-600">{item.inspectionReference}</td><td className="px-4 py-3 font-semibold">{item.product?.name || "-"}</td><td className="px-4 py-3">{relationLabel(item.warehouse)}</td><td className="px-4 py-3">{relationLabel(item.location, "Warehouse level")}</td><td className="px-4 py-3 font-bold">{formatNumber(item.previousQuantity)}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td></tr>)}{!rows.length ? <EmptyRows columns={6} message="No pending quality requests." /> : null}</tbody></table></div>
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-gray-50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 font-black text-gray-900">{value}</p></div>
}

function CreateInventoryModal({ open, form, setForm, product, products, warehouses, locations, category, unit, previousQuantity, warehouseQuantity, error, saving, onProductChange, onWarehouseChange, onClose, onSubmit }) {
  return (
    <Modal open={open} onClose={onClose} title="Create Inventory Item" subtitle="Fields are designed from the Inventory & Purchase business workflow." width="max-w-3xl" footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} disabled={saving} className={`${buttonClass} border-gray-200 bg-white text-gray-800`}>Cancel</button><button type="submit" form="create-inventory-item" disabled={saving} className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}>{saving ? <FiRefreshCw className="animate-spin" /> : <FiCheckCircle />}{saving ? "Creating..." : "Create Record"}</button></div>}>
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
      <form id="create-inventory-item" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <Field label="Product Name" required><select className={inputClass} value={form.product} onChange={(event) => onProductChange(event.target.value)} required><option value="">Select Product Name</option>{products.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></Field>
        <Field label="Product Code"><input className={inputClass} value={product?.sku || ""} disabled /></Field>
        <Field label="Category"><input className={inputClass} value={relationLabel(category, "Not assigned")} disabled /></Field>
        <Field label="Unit"><input className={inputClass} value={relationLabel(unit, "Not assigned")} disabled /></Field>
        <Field label="Tracking"><input className={inputClass} value={product ? pretty(product.trackingType || "none") : ""} disabled /></Field>
        <Field label="Previous Total Quantity"><input className={inputClass} value={formatNumber(previousQuantity)} disabled /></Field>
        <Field label="Quantity to Add" required><input className={inputClass} type="number" min="0.000001" step="0.000001" value={form.quantity} onChange={(event) => setForm((previous) => ({ ...previous, quantity: event.target.value }))} placeholder="Enter quantity to add" required /></Field>
        <Field label="Stock Price" required><input className={inputClass} type="number" min="0" step="0.01" value={form.stockPrice} onChange={(event) => setForm((previous) => ({ ...previous, stockPrice: event.target.value }))} placeholder="Enter stock price" required /></Field>
        <Field label="Warehouse" required><select className={inputClass} value={form.warehouse} onChange={(event) => onWarehouseChange(event.target.value)} required><option value="">Select Warehouse</option>{warehouses.map((item) => <option key={item._id} value={item._id}>{relationLabel(item)}</option>)}</select></Field>
        <Field label="Existing Warehouse Quantity"><input className={inputClass} value={formatNumber(warehouseQuantity)} disabled /></Field>
        <Field label="Bin / Shelf"><select className={inputClass} value={form.location} onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))} disabled={!form.warehouse}><option value="">Warehouse level</option>{locations.map((item) => <option key={item._id} value={item._id}>{relationLabel(item)}</option>)}</select></Field>
      </form>
    </Modal>
  )
}

function DetailModal({ state, onClose }) {
  const totalQuantity = state.positions.reduce((sum, item) => sum + Number(item.onHandQuantity || 0), 0)
  const value = state.positions.reduce((sum, item) => sum + Number(item.inventoryValue || 0), 0)
  return <Modal open={state.open} onClose={onClose} title={state.product?.name || "Inventory item"} subtitle={`${state.product?.sku || ""} · Inventory positions`} width="max-w-4xl"><div className="grid gap-3 sm:grid-cols-3"><Metric label="Total Quantity" value={formatNumber(totalQuantity)} /><Metric label="Stock Value" value={formatMoney(value)} /><Metric label="Positions" value={state.positions.length} /></div><div className="mt-5 space-y-3">{state.positions.map((stock) => <div key={stock._id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><FiMapPin /></span><div><p className="font-black text-gray-900">{relationLabel(stock.warehouse)}</p><p className="text-sm text-gray-500">{relationLabel(stock.location, "Warehouse level")}</p></div></div><div className="flex gap-6"><Metric label="On Hand" value={formatNumber(stock.onHandQuantity)} /><Metric label="Value" value={formatMoney(stock.inventoryValue)} /></div></div>)}</div></Modal>
}

function SettingsModal({ state, form, setForm, saving, onClose, onSubmit }) {
  return <Modal open={state.open} onClose={onClose} title="Stock Position Settings" subtitle={`${state.stock?.product?.name || "Product"} · ${state.stock?.warehouse?.name || "Warehouse"}`} width="max-w-2xl" footer={<div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={`${buttonClass} border-gray-200 bg-white text-gray-800`}>Cancel</button><button type="submit" form="stock-settings-form" disabled={saving} className={`${buttonClass} border-indigo-600 bg-indigo-600 text-white`}>{saving ? "Saving..." : "Save Changes"}</button></div>}><form id="stock-settings-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2"><Field label="Reorder Level"><input className={inputClass} type="number" min="0" value={form.reorderLevel} onChange={(event) => setForm((previous) => ({ ...previous, reorderLevel: event.target.value }))} /></Field><Field label="Minimum Stock"><input className={inputClass} type="number" min="0" value={form.minimumStock} onChange={(event) => setForm((previous) => ({ ...previous, minimumStock: event.target.value }))} /></Field><Field label="Maximum Stock"><input className={inputClass} type="number" min="0" value={form.maximumStock} onChange={(event) => setForm((previous) => ({ ...previous, maximumStock: event.target.value }))} /></Field><Field label="Status"><select className={inputClass} value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field></form></Modal>
}
