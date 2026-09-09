/* eslint-disable react/prop-types -- local dashboard metric component has a fixed internal contract */
import { useCallback, useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowDataTransferHorizontalIcon, DashboardSquare01Icon, Package01Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { InventoryButton, InventoryPageHeader, InventoryPageShell } from "./InventoryUI"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const COST_VIEW_PERMISSION = "inventory-report:cost-view"
function canUserViewCost() {
  try {
    const raw = localStorage.getItem("user")
    if (!raw) return false
    const user = JSON.parse(raw)
    const role = String(user?.role || "").toLowerCase()
    if (role === "admin" || role === "superadmin") return true
    const permissions = Array.isArray(user?.permissions) ? user.permissions : []
    return permissions.includes("*") || permissions.includes(COST_VIEW_PERMISSION)
  } catch {
    return false
  }
}

const number = (value, digits = 2) => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits })
const money = (value) => {
  if (!canUserViewCost() || value === null || value === undefined) return "—"
  return `BDT ${number(value)}`
}
const pretty = (value) => String(value || "-").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())

async function api(path) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "Unable to load inventory data.")
  return data
}

const Card = ({ label, value, detail, tone = "indigo" }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(15,23,42,.55)]">
    <div className={`mb-4 h-1.5 w-10 rounded-full bg-${tone}-500`} />
    <p className="text-xs font-black uppercase tracking-wider text-gray-400">{label}</p>
    <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
    <p className="mt-1 text-xs font-semibold text-gray-500">{detail}</p>
  </div>
)

export default function InventoryDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [valuation, setValuation] = useState([])
  const [operations, setOperations] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [summary, values, workflow] = await Promise.all([api("/inventory/reports/dashboard"), api("/inventory/reports/valuation?groupBy=warehouse&limit=8"), api("/inventory/operations/overview")])
      setDashboard(summary); setValuation(values.rows || []); setOperations(workflow)
    } catch (requestError) { setError(requestError.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const stock = dashboard?.stock || {}
  const maxValue = Math.max(...valuation.map((row) => Number(row.inventoryValue || 0)), 1)
  return (
    <InventoryPageShell>
      <div className="space-y-5">
        <InventoryPageHeader
          title="Inventory command center"
          description="Live quantity, value, availability, replenishment, transfers and movement activity."
          actions={<InventoryButton onClick={load} disabled={loading}><HugeiconsIcon icon={RefreshIcon} size={18} className={loading ? "animate-spin" : ""} />Refresh</InventoryButton>}
        />
        {error && <div className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700"><HugeiconsIcon icon={Alert02Icon} size={18} />{error}</div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Inventory Quantity" value={number(stock.onHandQuantity)} detail={`${number(stock.availableQuantity)} available`} />
          <Card label="Inventory Value" value={money(stock.inventoryValue)} detail="Weighted current valuation" tone="emerald" />
          <Card label="Active Products" value={number(dashboard?.activeProducts, 0)} detail={`${number(dashboard?.activeWarehouses, 0)} active warehouses`} tone="sky" />
          <Card label="Low Stock" value={number(dashboard?.lowStockPositions, 0)} detail={`${number(stock.zeroPositions, 0)} zero-stock positions`} tone="amber" />
          <Card label="Reserved" value={number(stock.reservedQuantity)} detail="Committed stock" tone="violet" />
          <Card label="Quarantine" value={number(stock.quarantineQuantity)} detail="Excluded from availability" tone="rose" />
          <Card label="Pending Transfers" value={number(dashboard?.transfers?.awaitingApproval, 0)} detail={`${number(dashboard?.transfers?.approved, 0)} approved`} tone="orange" />
          <Card label="In Transit" value={number(dashboard?.transfers?.inTransit, 0)} detail={`${number(stock.incomingQuantity)} incoming`} tone="cyan" />
          <Card label="Pending Requests" value={number(operations.pendingRequests, 0)} detail={`${number(operations.approvedRequests, 0)} approved / waiting`} tone="amber" />
          <Card label="Near Expiry" value={number(operations.nearExpiry, 0)} detail={`${number(operations.pendingInspections, 0)} inspections waiting`} tone="rose" />
          <Card label="Pending Inventory" value={number(operations.pendingInventory, 0)} detail="Awaiting warehouse and bin" tone="sky" />
          <Card label="Inventory Loss" value={money(operations.currentLossValue)} detail={`${number(operations.consumption30Days)} consumed in 30 days`} tone="orange" />
        </div>
        <div className="grid gap-5 xl:grid-cols-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 xl:col-span-2"><div className="mb-5 flex items-center gap-3"><HugeiconsIcon icon={DashboardSquare01Icon} size={20} className="text-indigo-600" /><div><h2 className="font-black text-gray-900">Warehouse value distribution</h2><p className="text-xs font-semibold text-gray-400">Current weighted inventory value</p></div></div><div className="space-y-4">{valuation.length ? valuation.map((row) => <div key={row._id}><div className="mb-1.5 flex justify-between gap-3 text-xs font-bold"><span className="truncate text-gray-700">{row.entity?.name || row.entity?.code || "Unassigned"}</span><span className="text-gray-900">{money(row.inventoryValue)}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-cyan-400" style={{ width: `${Math.max(3, Number(row.inventoryValue || 0) / maxValue * 100)}%` }} /></div></div>) : <p className="py-10 text-center text-sm font-semibold text-gray-400">No warehouse inventory yet.</p>}</div></section>
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white xl:col-span-3"><div className="flex items-center gap-3 border-b border-gray-100 p-5"><HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={20} className="text-indigo-600" /><div><h2 className="font-black text-gray-900">Recent stock movements</h2><p className="text-xs font-semibold text-gray-400">Permanent posted inventory activity</p></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Type</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-right">Value</th></tr></thead><tbody>{dashboard?.recentMovements?.length ? dashboard.recentMovements.map((movement) => <tr key={movement._id} className="border-t border-gray-100"><td className="px-5 py-3"><p className="font-black text-gray-800">{movement.movementNo}</p><p className="text-xs text-gray-400">{new Date(movement.movementDate).toLocaleDateString()}</p></td><td className="px-5 py-3 font-semibold text-gray-600">{pretty(movement.movementType)}</td><td className="px-5 py-3 text-right font-black">{number(movement.totalQuantity)}</td><td className="px-5 py-3 text-right font-black">{money(movement.totalValue)}</td></tr>) : <tr><td colSpan="4" className="px-5 py-12 text-center text-gray-400"><HugeiconsIcon icon={Package01Icon} size={28} className="mx-auto mb-2" />No posted movements found.</td></tr>}</tbody></table></div></section>
        </div>
      </div>
    </InventoryPageShell>
  )
}
