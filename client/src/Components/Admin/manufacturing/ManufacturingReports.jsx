"use client"

import { useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { FiBarChart2, FiRefreshCcw } from "react-icons/fi"
import {
  ManufacturingButton,
  ManufacturingPageHeader,
  ManufacturingPageLayout,
  ManufacturingStatusBadge,
  ManufacturingTable,
  card,
  displayName,
  formatDate,
  formatMoney,
  formatNumber,
  inputClass,
  manufacturingApi,
} from "./ManufacturingPageLayout"

const REPORTS = {
  production: { label: "Production Summary", path: "/manufacturing/reports/production-summary" },
  materials: { label: "Material Consumption", path: "/manufacturing/reports/material-consumption" },
  efficiency: { label: "Efficiency", path: "/manufacturing/reports/efficiency" },
  scrap: { label: "Scrap", path: "/manufacturing/reports/scrap" },
}

function columnsFor(report) {
  if (report === "materials") return [
    { key: "issueNumber", label: "Issue No." }, { key: "manufacturingOrder", label: "MO", render: (row) => row.manufacturingOrder?.moNumber || displayName(row.manufacturingOrder) }, { key: "issueDate", label: "Date", render: (row) => formatDate(row.issueDate) }, { key: "lines", label: "Materials", render: (row) => `${row.lines?.length || 0} items` }, { key: "status", label: "Status", render: (row) => <ManufacturingStatusBadge status={row.status} /> },
  ]
  if (report === "efficiency") return [
    { key: "_id", label: "Work Center" }, { key: "planned", label: "Planned", render: (row) => formatNumber(row.planned) }, { key: "completed", label: "Completed", render: (row) => formatNumber(row.completed) }, { key: "laborMinutes", label: "Labor", render: (row) => `${formatNumber((row.laborMinutes || 0) / 60)}h` }, { key: "machineMinutes", label: "Machine", render: (row) => `${formatNumber((row.machineMinutes || 0) / 60)}h` }, { key: "downtimeMinutes", label: "Downtime", render: (row) => `${formatNumber((row.downtimeMinutes || 0) / 60)}h` },
  ]
  if (report === "scrap") return [
    { key: "scrapNumber", label: "Scrap No." }, { key: "product", label: "Product", render: (row) => displayName(row.product) }, { key: "quantity", label: "Quantity", render: (row) => formatNumber(row.quantity) }, { key: "reason", label: "Reason" }, { key: "recoveryValue", label: "Recovery", render: (row) => formatMoney(row.recoveryValue) }, { key: "status", label: "Status", render: (row) => <ManufacturingStatusBadge status={row.status} /> },
  ]
  return [
    { key: "moNumber", label: "MO No." }, { key: "product", label: "Product", render: (row) => displayName(row.product) }, { key: "quantity", label: "Planned", render: (row) => formatNumber(row.quantity) }, { key: "completedQuantity", label: "Completed", render: (row) => formatNumber(row.completedQuantity) }, { key: "rejectedQuantity", label: "Rejected", render: (row) => formatNumber(row.rejectedQuantity) }, { key: "actualCost", label: "Actual Cost", render: (row) => formatMoney(row.actualCost) }, { key: "status", label: "Status", render: (row) => <ManufacturingStatusBadge status={row.status} /> },
  ]
}

export default function ManufacturingReports() {
  const [report, setReport] = useState("production")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (report === "production" && from) params.set("from", from)
      if (report === "production" && to) params.set("to", to)
      const suffix = params.toString() ? `?${params}` : ""
      const data = await manufacturingApi(`${REPORTS[report].path}${suffix}`)
      setRows(Array.isArray(data?.data) ? data.data : [])
    } catch (error) { toast.error(error.message || "Failed to load Manufacturing report") } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [report])
  const columns = useMemo(() => columnsFor(report), [report])

  return <ManufacturingPageLayout>
    <Toaster position="top-right" />
    <ManufacturingPageHeader title="Manufacturing Reports" subtitle="Operational reports for production, material consumption, work-center efficiency, scrap, cost, and traceability analysis." icon={<FiBarChart2 />} actions={<ManufacturingButton onClick={load} icon={<FiRefreshCcw className={loading ? "animate-spin" : ""} />}>Refresh</ManufacturingButton>} />
    <div className={`${card} mb-4 p-3 sm:p-4`}><div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto] md:items-end"><label><span className="mb-1.5 block text-sm font-extrabold text-gray-900">Report</span><select className={inputClass} value={report} onChange={(event) => setReport(event.target.value)}>{Object.entries(REPORTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-extrabold text-gray-900">From</span><input type="date" className={inputClass} value={from} onChange={(event) => setFrom(event.target.value)} disabled={report !== "production"} /></label><label><span className="mb-1.5 block text-sm font-extrabold text-gray-900">To</span><input type="date" className={inputClass} value={to} onChange={(event) => setTo(event.target.value)} disabled={report !== "production"} /></label><ManufacturingButton variant="primary" onClick={load}>Apply</ManufacturingButton></div></div>
    <ManufacturingTable loading={loading} rows={rows} columns={columns} emptyTitle="No report data" emptyText="No records match the current report filters." />
  </ManufacturingPageLayout>
}
