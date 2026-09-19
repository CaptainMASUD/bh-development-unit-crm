"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiActivity, FiAlertTriangle, FiCheckCircle, FiCpu, FiPackage, FiRefreshCcw, FiTool } from "react-icons/fi"
import {
  ManufacturingButton,
  ManufacturingPageHeader,
  ManufacturingPageLayout,
  ManufacturingStatCard,
  ManufacturingStatusBadge,
  card,
  formatMoney,
  formatNumber,
  manufacturingApi,
  pretty,
} from "./ManufacturingPageLayout"

function statusCount(items, name) {
  return Number(items?.find((item) => item?._id === name)?.count || 0)
}

function total(items, key = "count") {
  return (items || []).reduce((sum, item) => sum + Number(item?.[key] || 0), 0)
}

export default function ManufacturingDashboard() {
  const [data, setData] = useState({ orders: [], work: {}, scrap: {}, quality: [], machines: [] })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const response = await manufacturingApi("/manufacturing/dashboard")
      setData(response?.data || {})
    } catch (error) {
      toast.error(error.message || "Failed to load Manufacturing dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const orderCount = total(data.orders)
    const plannedQuantity = total(data.orders, "quantity")
    const completedQuantity = total(data.orders, "completed")
    const completedOrders = statusCount(data.orders, "completed")
    const inProgress = statusCount(data.orders, "in_progress") + statusCount(data.orders, "released")
    const failedQuality = Number(data.quality?.find((item) => item?._id === "fail")?.failed || 0)
    const totalInspected = total(data.quality, "passed") + total(data.quality, "failed")
    const machineCount = total(data.machines)
    const unavailableMachines = statusCount(data.machines, "maintenance") + statusCount(data.machines, "breakdown")
    const completionRate = plannedQuantity > 0 ? Math.min(100, (completedQuantity / plannedQuantity) * 100) : 0
    const qualityRate = totalInspected > 0 ? Math.max(0, ((totalInspected - failedQuality) / totalInspected) * 100) : 100
    return { orderCount, plannedQuantity, completedQuantity, completedOrders, inProgress, machineCount, unavailableMachines, completionRate, qualityRate }
  }, [data])

  return (
    <ManufacturingPageLayout>
      <Toaster position="top-right" />
      <ManufacturingPageHeader
        title="Manufacturing Dashboard"
        subtitle="A central production overview for orders, output, quality, scrap, machine health, labor, and downtime."
        icon={<FiActivity />}
        actions={<ManufacturingButton onClick={load} icon={<FiRefreshCcw className={loading ? "animate-spin" : ""} />}>Refresh</ManufacturingButton>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ManufacturingStatCard label="Manufacturing Orders" value={formatNumber(stats.orderCount)} hint={`${formatNumber(stats.inProgress)} active / released`} icon={<FiPackage />} />
        <ManufacturingStatCard label="Output Completed" value={formatNumber(stats.completedQuantity)} hint={`${formatNumber(stats.completionRate)}% of planned output`} icon={<FiCheckCircle />} tone="emerald" />
        <ManufacturingStatCard label="Machine Availability" value={formatNumber(stats.machineCount - stats.unavailableMachines)} hint={`${formatNumber(stats.unavailableMachines)} maintenance / breakdown`} icon={<FiCpu />} tone="sky" />
        <ManufacturingStatCard label="Scrap Recovery" value={formatMoney(data.scrap?.recoveryValue || 0)} hint={`${formatNumber(data.scrap?.quantity || 0)} scrap quantity`} icon={<FiTool />} tone="amber" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={`${card} p-4 sm:p-5`}>
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-gray-950">Production health</p><p className="mt-1 text-xs font-semibold text-gray-500">Live aggregate indicators from Manufacturing operations.</p></div><ManufacturingStatusBadge status={stats.inProgress ? "in_progress" : "planned"} /></div>
          <div className="mt-5 space-y-5">
            <div><div className="mb-2 flex items-center justify-between text-xs font-extrabold text-gray-600"><span>Production completion</span><span>{formatNumber(stats.completionRate)}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${stats.completionRate}%` }} /></div></div>
            <div><div className="mb-2 flex items-center justify-between text-xs font-extrabold text-gray-600"><span>Quality pass rate</span><span>{formatNumber(stats.qualityRate)}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.qualityRate}%` }} /></div></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f8fafc] p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Labor Time</p><p className="mt-2 text-lg font-black text-gray-950">{formatNumber((data.work?.laborMinutes || 0) / 60)}h</p></div>
              <div className="rounded-2xl bg-[#f8fafc] p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Machine Time</p><p className="mt-2 text-lg font-black text-gray-950">{formatNumber((data.work?.machineMinutes || 0) / 60)}h</p></div>
              <div className="rounded-2xl bg-[#f8fafc] p-4"><p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Downtime</p><p className="mt-2 text-lg font-black text-rose-700">{formatNumber((data.work?.downtimeMinutes || 0) / 60)}h</p></div>
            </div>
          </div>
        </section>

        <section className={`${card} p-4 sm:p-5`}>
          <div><p className="text-sm font-black text-gray-950">Machine status</p><p className="mt-1 text-xs font-semibold text-gray-500">Current machine-state distribution.</p></div>
          <div className="mt-4 space-y-2.5">{(data.machines || []).length ? data.machines.map((item) => <div key={item._id || "unknown"} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-[#f8fafc] px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 ring-1 ring-gray-100"><FiCpu /></div><div><p className="text-sm font-extrabold text-gray-900">{pretty(item._id || "unknown")}</p><p className="text-xs font-semibold text-gray-500">Machine state</p></div></div><span className="text-lg font-black text-gray-950">{formatNumber(item.count)}</span></div>) : <div className="py-10 text-center text-sm font-semibold text-gray-500">No machine data available.</div>}</div>
        </section>
      </div>

      <section className={`${card} mt-4 overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:p-5"><div><p className="text-sm font-black text-gray-950">Order status overview</p><p className="mt-1 text-xs font-semibold text-gray-500">Quantity and completion by Manufacturing Order status.</p></div>{stats.unavailableMachines ? <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-700"><FiAlertTriangle /> {stats.unavailableMachines} machine issue{stats.unavailableMachines === 1 ? "" : "s"}</div> : null}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-black uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Status</th><th className="px-5 py-3">Orders</th><th className="px-5 py-3">Planned Qty</th><th className="px-5 py-3">Completed Qty</th><th className="px-5 py-3">Progress</th></tr></thead><tbody className="divide-y divide-gray-100">{loading ? Array.from({ length: 4 }, (_, i) => <tr key={i} className="animate-pulse">{Array.from({ length: 5 }, (_, j) => <td key={j} className="px-5 py-5"><div className="h-4 w-20 rounded bg-gray-200" /></td>)}</tr>) : (data.orders || []).map((item) => { const percent = Number(item.quantity || 0) ? Math.min(100, Number(item.completed || 0) / Number(item.quantity || 1) * 100) : 0; return <tr key={item._id || "unknown"} className="hover:bg-indigo-50/30"><td className="px-5 py-4"><ManufacturingStatusBadge status={item._id || "planned"} /></td><td className="px-5 py-4 text-sm font-bold text-gray-800">{formatNumber(item.count)}</td><td className="px-5 py-4 text-sm font-bold text-gray-800">{formatNumber(item.quantity)}</td><td className="px-5 py-4 text-sm font-bold text-gray-800">{formatNumber(item.completed)}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} /></div><span className="text-xs font-extrabold text-gray-600">{formatNumber(percent)}%</span></div></td></tr> })}</tbody></table></div>
      </section>
    </ManufacturingPageLayout>
  )
}
