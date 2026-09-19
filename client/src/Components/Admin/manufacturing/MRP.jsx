"use client"

import { useCallback, useEffect, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiPlay, FiRefreshCcw, FiZap } from "react-icons/fi"
import {
  ManufacturingButton,
  ManufacturingField,
  ManufacturingModal,
  ManufacturingPageHeader,
  ManufacturingPageLayout,
  ManufacturingPagination,
  ManufacturingStatusBadge,
  ManufacturingTable,
  ManufacturingToolbar,
  RelationSelect,
  formatDate,
  formatNumber,
  manufacturingApi,
} from "./ManufacturingPageLayout"

export default function MRP() {
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [runOpen, setRunOpen] = useState(false)
  const [productionPlanId, setProductionPlanId] = useState("")
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (search.trim()) params.set("q", search.trim())
      if (status) params.set("status", status)
      const data = await manufacturingApi(`/manufacturing/mrp?${params}`)
      setRows(data?.data || [])
      setPagination(data?.pagination || { page, pages: 1, total: data?.data?.length || 0 })
    } catch (error) { toast.error(error.message || "Failed to load MRP runs") } finally { setLoading(false) }
  }, [page, search, status])

  useEffect(() => { const timer = setTimeout(load, 220); return () => clearTimeout(timer) }, [load])
  useEffect(() => setPage(1), [search, status])

  const runMrp = async () => {
    if (!productionPlanId) return toast.error("Select an approved production plan")
    setRunning(true)
    try {
      await manufacturingApi("/manufacturing/mrp/run", { method: "POST", body: JSON.stringify({ productionPlanId }) })
      toast.success("MRP completed")
      setRunOpen(false)
      setProductionPlanId("")
      await load()
    } catch (error) { toast.error(error.message || "MRP run failed") } finally { setRunning(false) }
  }

  return <ManufacturingPageLayout>
    <Toaster position="top-right" />
    <ManufacturingPageHeader title="Material Requirements Planning" subtitle="Calculate gross requirements, available stock, incoming supply, net shortages, and recommended purchase/production quantities." icon={<FiZap />} actions={<><ManufacturingButton onClick={load} icon={<FiRefreshCcw className={loading ? "animate-spin" : ""} />}>Refresh</ManufacturingButton><ManufacturingButton variant="primary" onClick={() => setRunOpen(true)} icon={<FiPlay />}>Run MRP</ManufacturingButton></>} />
    <ManufacturingToolbar search={search} setSearch={setSearch} placeholder="Search MRP runs..." status={status} setStatus={setStatus} statusOptions={["running", "completed", "failed", "cancelled"]} />
    <ManufacturingTable loading={loading} rows={rows} columns={[
      { key: "runNumber", label: "Run No." },
      { key: "productionPlan", label: "Production Plan", render: (row) => row.productionPlan?.planNumber || row.productionPlan?.name || row.productionPlan?._id || "—" },
      { key: "runAt", label: "Run At", render: (row) => formatDate(row.runAt, true) },
      { key: "requirements", label: "Requirements", render: (row) => `${row.requirements?.length || 0} materials` },
      { key: "shortages", label: "Net Requirement", render: (row) => formatNumber((row.requirements || []).reduce((sum, item) => sum + Number(item.netRequirement || 0), 0)) },
      { key: "warnings", label: "Warnings", render: (row) => formatNumber(row.warnings?.length || 0) },
      { key: "status", label: "Status", render: (row) => <ManufacturingStatusBadge status={row.status} /> },
    ]} />
    <ManufacturingPagination page={pagination.page || page} pages={pagination.pages || 1} total={pagination.total || 0} onPage={setPage} />
    <ManufacturingModal open={runOpen} title="Run Material Requirements Planning" subtitle="Select the production plan that MRP should calculate." icon={<FiZap />} onClose={() => setRunOpen(false)} maxWidth="max-w-xl" footer={<div className="flex justify-end gap-2"><ManufacturingButton onClick={() => setRunOpen(false)}>Cancel</ManufacturingButton><ManufacturingButton variant="primary" onClick={runMrp} disabled={running}>{running ? "Running..." : "Run MRP"}</ManufacturingButton></div>}>
      <ManufacturingField title="Production Plan"><RelationSelect value={productionPlanId} onChange={setProductionPlanId} endpoint="/manufacturing/plans?limit=100&status=approved" labelKey={(item) => `${item.planNumber || "Plan"}${item.name ? ` · ${item.name}` : ""}`} placeholder="Select approved production plan" /></ManufacturingField>
    </ManufacturingModal>
  </ManufacturingPageLayout>
}
