/* eslint-disable react/prop-types, react-refresh/only-export-components -- local components and tested permission helpers coexist */
import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowDownRight,
  FiArrowUpRight,
  FiEye,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi"
import { hasPermission } from "../../Auth/permissions"
import {
  InventoryButton,
  InventoryEmptyState,
  InventoryField,
  InventoryModal,
  InventoryPageHeader,
  InventoryPageShell,
  InventorySearchToolbar,
  InventoryStatCard,
  InventoryStatGrid,
  InventoryStatusBadge,
  InventoryTableCard,
  cx,
  inventoryStyles,
} from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const VIEW_PERMISSION = "inventory-adjustment:view"
const MANAGE_PERMISSION = "inventory-adjustment:manage"
const COST_VIEW_PERMISSION = "inventory-report:cost-view"

const emptyForm = {
  productId: "",
  warehouseId: "",
  newUnitCost: "",
  reason: "",
}

function getStoredUser() {
  if (typeof localStorage === "undefined") return null
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "null")
    return stored?.user || stored
  } catch {
    return null
  }
}

function hasAccess(user, permission) {
  const role = String(user?.role || "").toLowerCase()
  return (
    role === "admin" ||
    role === "superadmin" ||
    (user?.permissions || []).includes("*") ||
    (user?.permissions || []).includes(permission) ||
    hasPermission(user, permission)
  )
}

export function getRevaluationAccess(rawUser) {
  const user = rawUser?.user || rawUser
  return {
    canView: hasAccess(user, VIEW_PERMISSION),
    canManage: hasAccess(user, MANAGE_PERMISSION),
    canViewCost: hasAccess(user, COST_VIEW_PERMISSION),
  }
}

export function formatRevaluationMoney(value, canViewCost = true) {
  if (!canViewCost || value === null || value === undefined) return "—"
  return `BDT ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function validateRevaluationForm(form) {
  if (!form.productId) return "Select a product."
  if (!form.warehouseId) return "Select a warehouse."
  if (
    form.newUnitCost === "" ||
    !Number.isFinite(Number(form.newUnitCost)) ||
    Number(form.newUnitCost) < 0
  ) {
    return "Enter a non-negative new unit cost."
  }
  if (!String(form.reason || "").trim()) return "Enter a reason for the revaluation."
  return ""
}

async function api(path, options = {}) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Inventory revaluation request failed.")
  }
  return data
}

function formatDate(value, withTime = false) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date)
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })
}

function pretty(value) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function relationLabel(value, fallback) {
  if (!value) return fallback
  if (typeof value === "string") return fallback
  return value.name || value.code || fallback
}

function CostNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <FiShield className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-bold">Cost values are protected</p>
        <p className="mt-0.5 text-xs font-medium text-amber-800">
          Unit costs and value changes require Inventory Report Cost View permission.
        </p>
      </div>
    </div>
  )
}

export default function InventoryRevaluations() {
  const user = useMemo(getStoredUser, [])
  const access = useMemo(() => getRevaluationAccess(user), [user])
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [filters, setFilters] = useState({ q: "", product: "all", warehouse: "all" })
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [details, setDetails] = useState({ open: false, loading: false, item: null })

  const loadOptions = useCallback(async () => {
    if (!access.canView) return
    try {
      const [productData, warehouseData] = await Promise.all([
        api("/inventory/products?status=active&productType=inventory&trackInventory=true&limit=200"),
        api("/inventory/warehouses/options?limit=200"),
      ])
      setProducts(productData.products || [])
      setWarehouses(warehouseData.warehouses || [])
    } catch (error) {
      toast.error(error.message || "Failed to load revaluation options.")
    }
  }, [access.canView])

  const loadItems = useCallback(async () => {
    if (!access.canView) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const query = new URLSearchParams({ page: String(page), limit: "30" })
      if (filters.product !== "all") query.set("product", filters.product)
      if (filters.warehouse !== "all") query.set("warehouse", filters.warehouse)
      const data = await api(`/inventory/revaluations?${query}`)
      setItems(data.data || [])
      setPagination(data.pagination || { page, pages: 1, total: 0 })
    } catch (error) {
      setItems([])
      toast.error(error.message || "Failed to load inventory revaluations.")
    } finally {
      setLoading(false)
    }
  }, [access.canView, filters.product, filters.warehouse, page])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const visibleItems = useMemo(() => {
    const query = filters.q.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) =>
      [
        item.revaluationNo,
        item.reason,
        item.product?.name,
        item.product?.sku,
        item.warehouse?.name,
        item.warehouse?.code,
        item.journalEntry?.entryNo,
      ].some((value) => String(value || "").toLowerCase().includes(query))
    )
  }, [filters.q, items])

  const summary = useMemo(() => {
    return items.reduce(
      (result, item) => {
        const difference = Number(item.valueDifference || 0)
        result.posted += item.status === "posted" ? 1 : 0
        result.writeUps += difference > 0 ? 1 : 0
        result.writeDowns += difference < 0 ? 1 : 0
        result.netDifference += difference
        return result
      },
      { posted: 0, writeUps: 0, writeDowns: 0, netDifference: 0 }
    )
  }, [items])

  const activeFilters = [
    ...(filters.product !== "all"
      ? [{ key: "product", label: "Product", value: products.find((item) => item._id === filters.product)?.name || "Selected" }]
      : []),
    ...(filters.warehouse !== "all"
      ? [{ key: "warehouse", label: "Warehouse", value: warehouses.find((item) => item._id === filters.warehouse)?.name || "Selected" }]
      : []),
  ]

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }))
    if (key !== "q") setPage(1)
  }

  const openCreate = () => {
    setForm({
      ...emptyForm,
      productId: filters.product !== "all" ? filters.product : "",
      warehouseId: filters.warehouse !== "all" ? filters.warehouse : "",
    })
    setFormError("")
    setFormOpen(true)
  }

  const submit = async (event) => {
    event.preventDefault()
    const error = validateRevaluationForm(form)
    if (error) {
      setFormError(error)
      return
    }
    setSaving(true)
    setFormError("")
    try {
      const data = await api("/inventory/revaluations", {
        method: "POST",
        body: JSON.stringify({
          productId: form.productId,
          warehouseId: form.warehouseId,
          newUnitCost: Number(form.newUnitCost),
          reason: form.reason.trim(),
        }),
      })
      toast.success(data.message || "Inventory revaluation posted.")
      setFormOpen(false)
      setForm(emptyForm)
      setPage(1)
      await loadItems()
    } catch (requestError) {
      setFormError(requestError.message || "Failed to post inventory revaluation.")
    } finally {
      setSaving(false)
    }
  }

  const openDetails = async (item) => {
    setDetails({ open: true, loading: true, item })
    try {
      const data = await api(`/inventory/revaluations/${item._id}`)
      setDetails({ open: true, loading: false, item: data.data || item })
    } catch (error) {
      setDetails({ open: true, loading: false, item })
      toast.error(error.message || "Failed to load revaluation details.")
    }
  }

  if (!access.canView) {
    return (
      <InventoryPageShell>
        <InventoryEmptyState
          icon={FiShield}
          title="Inventory revaluations are restricted"
          description="You need View Stock Adjustments permission to access this page."
        />
      </InventoryPageShell>
    )
  }

  return (
    <InventoryPageShell>
      <Toaster position="top-right" />
      <InventoryPageHeader
        icon={FiActivity}
        title="Inventory Revaluations"
        description="Post controlled inventory cost changes with an automatic General Ledger journal."
        actions={
          <>
            <InventoryButton icon={FiRefreshCw} onClick={loadItems} disabled={loading}>
              {loading ? "Refreshing" : "Refresh"}
            </InventoryButton>
            {access.canManage ? (
              <InventoryButton variant="primary" icon={FiPlus} onClick={openCreate}>
                New Revaluation
              </InventoryButton>
            ) : null}
          </>
        }
      />

      {!access.canViewCost ? <div className="mb-5"><CostNotice /></div> : null}

      <InventoryStatGrid>
        <InventoryStatCard label="Total Revaluations" value={pagination.total} detail="All matching records" icon={FiFileText} />
        <InventoryStatCard label="Posted on Page" value={summary.posted} detail="Journal-backed revaluations" icon={FiActivity} tone="emerald" />
        <InventoryStatCard label="Write-ups / Downs" value={`${summary.writeUps} / ${summary.writeDowns}`} detail="Current page direction" icon={FiArrowUpRight} tone="sky" />
        <InventoryStatCard label="Net Value Change" value={formatRevaluationMoney(summary.netDifference, access.canViewCost)} detail="Current page total" icon={FiArrowDownRight} tone={summary.netDifference < 0 ? "rose" : "indigo"} />
      </InventoryStatGrid>

      <div className={cx(inventoryStyles.card, "mb-5 p-4")}>
        <InventorySearchToolbar
          value={filters.q}
          onChange={(value) => updateFilter("q", value)}
          placeholder="Search number, product, warehouse, reason, or journal..."
          ariaLabel="Search inventory revaluations"
          filters={activeFilters}
          onRemoveFilter={(key) => updateFilter(key, "all")}
          onClear={() => {
            setFilters({ q: "", product: "all", warehouse: "all" })
            setPage(1)
          }}
          filterControls={
            <>
              <InventoryField label="Product">
                <select className={inventoryStyles.input} value={filters.product} onChange={(event) => updateFilter("product", event.target.value)}>
                  <option value="all">All products</option>
                  {products.map((product) => <option key={product._id} value={product._id}>{product.name} ({product.sku || "No SKU"})</option>)}
                </select>
              </InventoryField>
              <InventoryField label="Warehouse">
                <select className={inventoryStyles.input} value={filters.warehouse} onChange={(event) => updateFilter("warehouse", event.target.value)}>
                  <option value="all">All warehouses</option>
                  {warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>)}
                </select>
              </InventoryField>
            </>
          }
          filterCount={activeFilters.length}
          utilities={<p className="text-sm font-semibold text-gray-500">Showing {visibleItems.length} of {pagination.total}</p>}
        />
      </div>

      <RevaluationTable items={visibleItems} loading={loading} canViewCost={access.canViewCost} onView={openDetails} />

      {pagination.pages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-500">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <InventoryButton disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</InventoryButton>
            <InventoryButton disabled={page >= pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Next</InventoryButton>
          </div>
        </div>
      ) : null}

      <RevaluationFormModal open={formOpen} form={form} setForm={setForm} products={products} warehouses={warehouses} error={formError} saving={saving} onClose={() => !saving && setFormOpen(false)} onSubmit={submit} />
      <RevaluationDetails state={details} canViewCost={access.canViewCost} onClose={() => setDetails({ open: false, loading: false, item: null })} />
    </InventoryPageShell>
  )
}

function RevaluationTable({ items, loading, canViewCost, onView }) {
  return (
    <InventoryTableCard>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1180px]">
          <thead><tr>{["Revaluation", "Date", "Product", "Warehouse", "Quantity", "Old Unit Cost", "New Unit Cost", "Value Difference", "Journal", "Status", ""].map((label) => <th key={label || "action"} className={cx(inventoryStyles.headCell, !label && "text-right")}>{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item._id} className="group">
                <td className={inventoryStyles.cell}><p className="font-black text-indigo-700">{item.revaluationNo}</p><p className="mt-1 max-w-[220px] truncate text-xs text-gray-500">{item.reason}</p></td>
                <td className={inventoryStyles.cell}>{formatDate(item.revaluationDate)}</td>
                <td className={inventoryStyles.cell}><p className="font-bold">{relationLabel(item.product, "Unknown product")}</p><p className="text-xs text-gray-500">{item.product?.sku || "—"}</p></td>
                <td className={inventoryStyles.cell}><p className="font-bold">{relationLabel(item.warehouse, "Unknown warehouse")}</p><p className="text-xs text-gray-500">{item.warehouse?.code || "—"}</p></td>
                <td className={cx(inventoryStyles.cell, "tabular-nums")}>{formatQuantity(item.quantity)}</td>
                <td className={cx(inventoryStyles.cell, "tabular-nums")}>{formatRevaluationMoney(item.oldUnitCost, canViewCost)}</td>
                <td className={cx(inventoryStyles.cell, "tabular-nums")}>{formatRevaluationMoney(item.newUnitCost, canViewCost)}</td>
                <td className={cx(inventoryStyles.cell, "font-black tabular-nums", canViewCost && Number(item.valueDifference) > 0 ? "text-emerald-700" : canViewCost && Number(item.valueDifference) < 0 ? "text-rose-700" : "")}>{formatRevaluationMoney(item.valueDifference, canViewCost)}</td>
                <td className={inventoryStyles.cell}>{item.journalEntry?.entryNo || "—"}</td>
                <td className={inventoryStyles.cell}><InventoryStatusBadge value={item.status}>{pretty(item.status)}</InventoryStatusBadge></td>
                <td className={cx(inventoryStyles.cell, "text-right")}><InventoryButton icon={FiEye} onClick={() => onView(item)}>View</InventoryButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-gray-100 lg:hidden">
        {items.map((item) => (
          <article key={item._id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-black text-indigo-700">{item.revaluationNo}</p><p className="mt-1 text-xs font-semibold text-gray-500">{formatDate(item.revaluationDate)}</p></div><InventoryStatusBadge value={item.status}>{pretty(item.status)}</InventoryStatusBadge></div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-gray-50 p-3 text-sm"><Detail label="Product" value={relationLabel(item.product, "Unknown")} /><Detail label="Warehouse" value={relationLabel(item.warehouse, "Unknown")} /><Detail label="Quantity" value={formatQuantity(item.quantity)} /><Detail label="Value Change" value={formatRevaluationMoney(item.valueDifference, canViewCost)} /></div>
            <InventoryButton className="mt-3 w-full" icon={FiEye} onClick={() => onView(item)}>View details</InventoryButton>
          </article>
        ))}
      </div>
      {!items.length ? <div className="p-5"><InventoryEmptyState icon={FiActivity} title={loading ? "Loading revaluations..." : "No revaluations found"} description={loading ? "Fetching posted inventory cost changes." : "Newly posted inventory revaluations will appear here."} /></div> : null}
    </InventoryTableCard>
  )
}

function RevaluationFormModal({ open, form, setForm, products, warehouses, error, saving, onClose, onSubmit }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <InventoryModal open={open} onClose={onClose} title="Post Inventory Revaluation" subtitle="This posts immediately and creates a balanced GL journal." icon={FiActivity} maxWidthClass="max-w-2xl" footer={<div className="flex justify-end gap-2"><InventoryButton type="button" onClick={onClose} disabled={saving}>Cancel</InventoryButton><InventoryButton type="submit" form="inventory-revaluation-form" variant="primary" disabled={saving}>{saving ? "Posting..." : "Post Revaluation"}</InventoryButton></div>}>
      <form id="inventory-revaluation-form" className="space-y-5" onSubmit={onSubmit}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-3"><FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Financial posting</p><p className="mt-1 text-xs font-medium">The selected stock position must have positive quantity. The new unit cost updates inventory valuation and posts the difference to the configured revaluation gain/loss account.</p></div></div></div>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <InventoryField label="Product"><select className={inventoryStyles.input} value={form.productId} onChange={(event) => update("productId", event.target.value)} required><option value="">Select product</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name} ({product.sku || "No SKU"})</option>)}</select></InventoryField>
          <InventoryField label="Warehouse"><select className={inventoryStyles.input} value={form.warehouseId} onChange={(event) => update("warehouseId", event.target.value)} required><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name} ({warehouse.code || "No code"})</option>)}</select></InventoryField>
        </div>
        <InventoryField label="New Unit Cost" hint="Use 0 or a positive amount. The current cost remains masked unless separately permitted."><input className={inventoryStyles.input} type="number" min="0" step="0.01" value={form.newUnitCost} onChange={(event) => update("newUnitCost", event.target.value)} placeholder="0.00" required /></InventoryField>
        <InventoryField label="Reason"><textarea className={cx(inventoryStyles.input, "min-h-28 resize-y")} value={form.reason} onChange={(event) => update("reason", event.target.value)} placeholder="Explain the business reason and supporting reference..." required /></InventoryField>
      </form>
    </InventoryModal>
  )
}

function RevaluationDetails({ state, canViewCost, onClose }) {
  const item = state.item
  return (
    <InventoryModal open={state.open} onClose={onClose} title={item?.revaluationNo || "Revaluation Details"} subtitle="Posted valuation and accounting audit trail" icon={FiFileText} maxWidthClass="max-w-3xl" footer={<div className="flex justify-end"><InventoryButton onClick={onClose}>Close</InventoryButton></div>}>
      {state.loading ? <p className="py-10 text-center text-sm font-semibold text-gray-500">Loading revaluation details...</p> : item ? <div className="space-y-5">{!canViewCost ? <CostNotice /> : null}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Product" value={`${relationLabel(item.product, "Unknown product")}${item.product?.sku ? ` (${item.product.sku})` : ""}`} /><Detail label="Warehouse" value={`${relationLabel(item.warehouse, "Unknown warehouse")}${item.warehouse?.code ? ` (${item.warehouse.code})` : ""}`} /><Detail label="Posted" value={formatDate(item.postedAt || item.revaluationDate, true)} /><Detail label="Costing Method" value={pretty(item.costingMethod)} /><Detail label="Quantity" value={formatQuantity(item.quantity)} /><Detail label="Status" value={<InventoryStatusBadge value={item.status}>{pretty(item.status)}</InventoryStatusBadge>} /><Detail label="Old Unit Cost" value={formatRevaluationMoney(item.oldUnitCost, canViewCost)} /><Detail label="New Unit Cost" value={formatRevaluationMoney(item.newUnitCost, canViewCost)} /><Detail label="Value Difference" value={formatRevaluationMoney(item.valueDifference, canViewCost)} /><Detail label="Old Inventory Value" value={formatRevaluationMoney(item.oldInventoryValue, canViewCost)} /><Detail label="New Inventory Value" value={formatRevaluationMoney(item.newInventoryValue, canViewCost)} /><Detail label="Journal Entry" value={item.journalEntry?.entryNo || "—"} /></div><div className="rounded-2xl border border-gray-100 bg-gray-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-gray-500">Reason</p><p className="mt-2 text-sm font-semibold text-gray-800">{item.reason || "—"}</p></div></div> : null}
    </InventoryModal>
  )
}

function Detail({ label, value }) {
  return <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p><div className="mt-1 break-words text-sm font-bold text-gray-900">{value ?? "—"}</div></div>
}
