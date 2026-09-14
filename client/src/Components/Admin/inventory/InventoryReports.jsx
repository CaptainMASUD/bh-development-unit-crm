/* eslint-disable react/prop-types, react-refresh/only-export-components -- report helpers are exported for permission-contract tests */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import toast, { Toaster } from "react-hot-toast"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowDataTransferHorizontalIcon,
  Clock01Icon,
  Download01Icon,
  FileChartColumnIcon,
  FilterIcon,
  HourglassIcon,
  Layers01Icon,
  Package01Icon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { hasPermission } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const COST_VIEW_PERMISSION = "inventory-report:cost-view"
const RECONCILIATION_PERMISSION = "inventory-reconciliation:view"
const EXPORT_PERMISSION = "inventory-report:export"

const CARD =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"
const PANEL =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_42px_-24px_rgba(0,0,0,0.28)]"
const BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
const PRIMARY_BUTTON =
  "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
const GHOST_BUTTON =
  "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
const INPUT =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:bg-gray-50"

function cn(...classes) {
  return classes.filter(Boolean).join(" ")
}

function numeric(value) {
  return Number(value || 0)
}

function number(value, digits = 2) {
  return numeric(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })
}

function money(value, canViewCost = true) {
  if (!canViewCost || value === null || value === undefined) return "—"
  return `BDT ${numeric(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function pretty(value) {
  return String(value || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getInventoryReportAccess(rawUser) {
  const user = rawUser?.user || rawUser
  const role = String(user?.role || "").toLowerCase()
  const privileged = role === "admin" || role === "superadmin"
  const permissions = user?.permissions || []
  const wildcard = permissions.includes("*")
  const allowed = (permission) =>
    privileged || wildcard || permissions.includes(permission) || hasPermission(user, permission)
  return {
    canViewCost: allowed(COST_VIEW_PERMISSION),
    canViewGlReconciliation: allowed(RECONCILIATION_PERMISSION),
    canExport: allowed(EXPORT_PERMISSION),
  }
}

export function canExportInventoryReport(user, reportType) {
  const access = getInventoryReportAccess(user)
  if (!access.canExport) return false
  if (reportType === "gl-reconciliation") {
    return access.canViewGlReconciliation && access.canViewCost
  }
  return true
}

async function api(path) {
  const token = localStorage.getItem("token")
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Unable to complete inventory report request."
    )
  }
  return data
}

function Icon({
  icon,
  className = "h-4 w-4",
  strokeWidth = 1.8,
  ...props
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      className={className}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}

function Skeleton({ className = "" }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gray-100",
        className
      )}
    />
  )
}

const REPORT_TABS = [
  {
    id: "gl-reconciliation",
    label: "GL Reconciliation",
    icon: Tick02Icon,
    description: "Compare subledger valuation with General Ledger Account 1300 balance.",
    permission: RECONCILIATION_PERMISSION,
    exportType: "gl-reconciliation",
  },
  {
    id: "current-stock",
    label: "Current Stock",
    icon: Package01Icon,
    description: "On-hand, available, reserved, and quarantine inventory levels.",
    exportType: "warehouse-stock",
  },
  {
    id: "low-stock",
    label: "Low Stock Alerts",
    icon: Alert02Icon,
    description: "Shortages, reorder thresholds, and zero-stock positions.",
    exportType: "low-stock",
  },
  {
    id: "aging",
    label: "Stock Aging",
    icon: Clock01Icon,
    description: "Inventory aging analysis across 30, 60, 90, 180, and 365+ day buckets.",
    exportType: "aging",
  },
  {
    id: "slow-moving",
    label: "Slow Moving",
    icon: HourglassIcon,
    description: "Low velocity and dormant inventory positions.",
    exportType: "slow-moving",
  },
  {
    id: "batch-expiry",
    label: "Batch & Expiry",
    icon: Layers01Icon,
    description: "Lot tracking, shelf life, and expiration risk monitoring.",
    exportType: "batch-expiry",
  },
  {
    id: "transfers",
    label: "Stock Transfers",
    icon: ArrowDataTransferHorizontalIcon,
    description: "Inter-warehouse transfers, in-transit stock, and shortage closures.",
    exportType: "transfers",
  },
]

export default function InventoryReports() {
  const [currentUser, setCurrentUser] = useState(null)
  const [activeTab, setActiveTab] = useState("gl-reconciliation")
  const [warehouses, setWarehouses] = useState([])
  const [selectedWarehouse, setSelectedWarehouse] = useState("all")
  const [asOfDate, setAsOfDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")

  // Report Data States
  const [glData, setGlData] = useState(null)
  const [stockData, setStockData] = useState({ rows: [], count: 0 })
  const [lowStockData, setLowStockData] = useState({ rows: [], count: 0 })
  const [agingData, setAgingData] = useState({ rows: [], summary: {} })
  const [slowData, setSlowData] = useState({ rows: [], count: 0 })
  const [batchData, setBatchData] = useState({ items: [], count: 0 })
  const [transfersData, setTransfersData] = useState({ rows: [], count: 0 })

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user")
      if (raw) setCurrentUser(JSON.parse(raw))
    } catch {
      setCurrentUser(null)
    }
  }, [])

  const reportAccess = useMemo(
    () => getInventoryReportAccess(currentUser),
    [currentUser]
  )
  const { canViewCost, canViewGlReconciliation } = reportAccess
  const canExportActiveReport = canExportInventoryReport(currentUser, activeTab)

  // Load warehouse options
  useEffect(() => {
    let mounted = true
    async function loadWh() {
      try {
        const res = await api("/inventory/warehouses?limit=200")
        if (mounted) setWarehouses(res.warehouses || [])
      } catch {
        // Soft fail
      }
    }
    loadWh()
    return () => {
      mounted = false
    }
  }, [])

  // If user cannot view GL reconciliation, switch default tab
  useEffect(() => {
    if (currentUser && !canViewGlReconciliation && activeTab === "gl-reconciliation") {
      setActiveTab("current-stock")
    }
  }, [currentUser, canViewGlReconciliation, activeTab])

  // Data fetching per active report tab
  const loadReport = useCallback(
    async ({ showToast = false } = {}) => {
      setLoading(true)
      setError("")
      try {
        const whParam =
          selectedWarehouse !== "all"
            ? `&warehouse=${selectedWarehouse}`
            : ""
        const dateParam = asOfDate ? `&asOfDate=${asOfDate}` : ""

        if (activeTab === "gl-reconciliation") {
          if (!canViewGlReconciliation) {
            setLoading(false)
            return
          }
          const res = await api(
            `/inventory/reports/gl-reconciliation?${dateParam.slice(1)}`
          )
          setGlData(res)
        } else if (activeTab === "current-stock") {
          const res = await api(
            `/inventory/reports/current-stock?limit=100${whParam}`
          )
          setStockData({
            rows: res.stocks || res.rows || [],
            count: res.count || 0,
          })
        } else if (activeTab === "low-stock") {
          const res = await api(
            `/inventory/reports/low-stock?limit=100${whParam}`
          )
          setLowStockData({
            rows: res.rows || res.items || [],
            count: res.count || 0,
          })
        } else if (activeTab === "aging") {
          const res = await api(
            `/inventory/reports/aging?${whParam.slice(1)}${dateParam}`
          )
          setAgingData(res || { rows: [], summary: {} })
        } else if (activeTab === "slow-moving") {
          const res = await api(
            `/inventory/reports/slow-moving?limit=100${whParam}`
          )
          setSlowData(res || { rows: [], count: 0 })
        } else if (activeTab === "batch-expiry") {
          const res = await api(
            `/inventory/reports/batch-expiry?limit=100${whParam}`
          )
          setBatchData({
            items: res.rows || res.items || [],
            count: res.count || 0,
          })
        } else if (activeTab === "transfers") {
          const res = await api(
            `/inventory/reports/transfers?limit=100${whParam}`
          )
          setTransfersData({
            rows: res.transfers || res.rows || [],
            count: res.count || 0,
          })
        }

        if (showToast) {
          toast.success("Report data refreshed")
        }
      } catch (err) {
        const msg = err.message || "Failed to load report data."
        setError(msg)
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    },
    [activeTab, selectedWarehouse, asOfDate, canViewGlReconciliation]
  )

  useEffect(() => {
    loadReport()
  }, [loadReport])

  // Export CSV handler
  const handleExportCsv = async () => {
    if (!canExportActiveReport) {
      toast.error("You do not have permission to export this report.")
      return
    }
    setExporting(true)
    try {
      const currentTab = REPORT_TABS.find((t) => t.id === activeTab)
      const exportType = currentTab?.exportType || activeTab
      const token = localStorage.getItem("token")
      const whParam =
        selectedWarehouse !== "all" ? `&warehouse=${selectedWarehouse}` : ""
      const dateParam = asOfDate ? `&asOfDate=${asOfDate}` : ""

      const res = await fetch(
        `${API_BASE}/inventory/reports/export/${exportType}?format=csv${whParam}${dateParam}`,
        {
          credentials: "include",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        }
      )

      if (!res.ok) {
        throw new Error("CSV export failed. Verify your reporting permissions.")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `inventory-report-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Report CSV downloaded")
    } catch (err) {
      toast.error(err.message || "Failed to export CSV.")
    } finally {
      setExporting(false)
    }
  }

  const activeTabMeta =
    REPORT_TABS.find((t) => t.id === activeTab) || REPORT_TABS[0]

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6 lg:p-8">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2600,
          style: {
            borderRadius: "14px",
            fontWeight: 700,
          },
        }}
      />

      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Header */}
        <header className={cn(PANEL, "p-5 sm:p-6")}>
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 blur-md" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm">
                  <Icon icon={FileChartColumnIcon} className="h-6 w-6" />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
                    Inventory Reports Hub
                  </h1>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-600/10">
                    Audit & Operational Insights
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  {activeTabMeta.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
              {canExportActiveReport ? (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting || loading}
                  className={cn(BUTTON, GHOST_BUTTON)}
                  title="Download active report as CSV"
                >
                  <Icon
                    icon={Download01Icon}
                    className={cn("h-4 w-4", exporting ? "animate-pulse" : "")}
                  />
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => loadReport({ showToast: true })}
                disabled={loading}
                className={cn(BUTTON, PRIMARY_BUTTON)}
              >
                <Icon
                  icon={RefreshIcon}
                  className={cn("h-4 w-4", loading ? "animate-spin" : "")}
                />
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className={cn(CARD, "p-1.5")}>
          <div className="flex flex-wrap gap-1">
            {REPORT_TABS.map((tab) => {
              if (
                tab.id === "gl-reconciliation" &&
                !canViewGlReconciliation
              ) {
                return null
              }
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition sm:text-sm",
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <Icon icon={tab.icon} className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Filters Bar */}
        <section className={cn(PANEL, "p-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-gray-500">
              <Icon icon={FilterIcon} className="h-4 w-4 text-indigo-600" />
              Filters
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab !== "gl-reconciliation" ? (
                <div>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className={cn(INPUT, "py-1.5 text-xs")}
                  >
                    <option value="all">All Warehouses</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {(activeTab === "gl-reconciliation" ||
                activeTab === "aging") ? (
                <div>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className={cn(INPUT, "py-1.5 text-xs")}
                    title="As-Of Date"
                  />
                </div>
              ) : null}

              {(selectedWarehouse !== "all" || asOfDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWarehouse("all")
                    setAsOfDate("")
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Error Alert */}
        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <Icon icon={Alert02Icon} className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Failed to load report</p>
              <p className="mt-0.5 text-sm font-medium text-rose-600">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-rose-500 hover:bg-rose-100"
            >
              ×
            </button>
          </div>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: GL RECONCILIATION REPORT                                     */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "gl-reconciliation" ? (
          <div className="space-y-6">
            {/* Reconciliation KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className={cn(CARD, "p-5")}>
                <p className="text-xs font-black uppercase text-gray-400">
                  Subledger Valuation
                </p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {loading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    money(glData?.subledgerValue, canViewCost)
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Total inventory value from stock positions
                </p>
              </div>

              <div className={cn(CARD, "p-5")}>
                <p className="text-xs font-black uppercase text-gray-400">
                  GL Control Account Balance
                </p>
                <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                  {loading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    money(glData?.glBalance, canViewCost)
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Account {glData?.inventoryControlAccount?.code || "1300"} ({glData?.inventoryControlAccount?.name || "Inventory"})
                </p>
              </div>

              <div className={cn(CARD, "p-5")}>
                <p className="text-xs font-black uppercase text-gray-400">
                  Reconciliation Difference
                </p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-black tabular-nums",
                    glData?.isReconciled ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {loading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    money(glData?.difference, canViewCost)
                  )}
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Subledger minus GL Balance
                </p>
              </div>

              <div className={cn(CARD, "p-5")}>
                <p className="text-xs font-black uppercase text-gray-400">
                  Reconciliation Status
                </p>
                <div className="mt-2">
                  {loading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : glData?.isReconciled ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700 ring-1 ring-emerald-600/20">
                      <Icon icon={Tick02Icon} className="h-4 w-4" />
                      RECONCILED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-black text-rose-700 ring-1 ring-rose-600/20">
                      <Icon icon={Alert02Icon} className="h-4 w-4" />
                      DISCREPANCY
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs font-semibold text-gray-500">
                  As of: {formatDate(glData?.asOfDate || asOfDate || new Date())}
                </p>
              </div>
            </div>

            {/* Reconciliation Diagnostics */}
            <div className="space-y-4">
              <h3 className="text-base font-black text-gray-900">
                Traceable Audit Diagnostics
              </h3>

              {/* Unposted Movements */}
              <div className={cn(PANEL, "overflow-hidden")}>
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 p-4">
                  <div>
                    <h4 className="font-extrabold text-gray-900">
                      Unposted Movements Awaiting GL Posting
                    </h4>
                    <p className="text-xs text-gray-500">
                      Movements with accounting status pending or error
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-black text-gray-700">
                    {glData?.diagnostics?.unpostedMovementsCount || 0}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-black uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5">Movement No</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5 text-right">Quantity</th>
                        <th className="px-4 py-2.5 text-right">Value</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(glData?.diagnostics?.unpostedMovements || []).length ? (
                        glData.diagnostics.unpostedMovements.map((m) => (
                          <tr key={m._id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-bold text-gray-900">
                              {m.movementNo}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">
                              {formatDate(m.movementDate)}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-gray-700">
                              {pretty(m.movementType)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                              {number(m.totalQuantity)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                              {money(m.totalValue, canViewCost)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                {pretty(m.accountingStatus)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-xs font-semibold text-gray-400">
                            No unposted movements detected.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Direct Manual GL Entries */}
              <div className={cn(PANEL, "overflow-hidden")}>
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 p-4">
                  <div>
                    <h4 className="font-extrabold text-gray-900">
                      Direct Manual GL Entries On Inventory Account
                    </h4>
                    <p className="text-xs text-gray-500">
                      Journal entries hitting Account 1300 without a linking stock movement
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-black text-gray-700">
                    {glData?.diagnostics?.manualGlEntriesCount || 0}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-black uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-2.5">Entry No</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Voucher Type</th>
                        <th className="px-4 py-2.5">Memo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(glData?.diagnostics?.manualGlEntries || []).length ? (
                        glData.diagnostics.manualGlEntries.map((e) => (
                          <tr key={e._id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-bold text-gray-900">
                              {e.entryNo}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">
                              {formatDate(e.date)}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-gray-700">
                              {pretty(e.voucherType)}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">
                              {e.memo || "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-xs font-semibold text-gray-400">
                            No manual journal entries on inventory account.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: CURRENT STOCK REPORT                                        */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "current-stock" ? (
          <section className={cn(PANEL, "overflow-hidden")}>
            <div className="border-b border-gray-100 p-4">
              <h3 className="font-black text-gray-900">Current Stock Balances</h3>
              <p className="text-xs text-gray-500">
                Live availability and reserved quantities by product and warehouse
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3 text-right">On Hand</th>
                    <th className="px-5 py-3 text-right">Available</th>
                    <th className="px-5 py-3 text-right">Reserved</th>
                    <th className="px-5 py-3 text-right">Quarantine</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                      </tr>
                    ))
                  ) : stockData.rows.length ? (
                    stockData.rows.map((row, i) => (
                      <tr key={row._id || i} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <p className="font-extrabold text-gray-900">{row.product?.name || "—"}</p>
                          <p className="text-xs text-gray-400">SKU: {row.product?.sku || "—"}</p>
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-800">
                          {row.warehouse?.name || "—"}
                        </td>
                        <td className="px-5 py-4 text-right font-black tabular-nums">
                          {number(row.onHandQuantity)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-emerald-600 tabular-nums">
                          {number(row.availableQuantity)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-violet-600 tabular-nums">
                          {number(row.reservedQuantity)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-rose-600 tabular-nums">
                          {number(row.quarantineQuantity)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-gray-400">
                        No stock records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: LOW STOCK ALERTS                                            */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "low-stock" ? (
          <section className={cn(PANEL, "overflow-hidden")}>
            <div className="border-b border-gray-100 p-4">
              <h3 className="font-black text-gray-900">Low Stock Positions</h3>
              <p className="text-xs text-gray-500">
                Products currently below minimum threshold or zero-stock
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3 text-right">Available</th>
                    <th className="px-5 py-3 text-right">Reorder Level</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="mx-auto h-6 w-20" /></td>
                      </tr>
                    ))
                  ) : lowStockData.rows.length ? (
                    lowStockData.rows.map((row, i) => {
                      const avail = numeric(row.availableQuantity)
                      const reorder = numeric(row.product?.reorderLevel)
                      return (
                        <tr key={row._id || i} className="hover:bg-gray-50">
                          <td className="px-5 py-4">
                            <p className="font-extrabold text-gray-900">{row.product?.name || "—"}</p>
                            <p className="text-xs text-gray-400">SKU: {row.product?.sku || "—"}</p>
                          </td>
                          <td className="px-5 py-4 font-bold text-gray-800">
                            {row.warehouse?.name || "—"}
                          </td>
                          <td className="px-5 py-4 text-right font-black text-rose-600 tabular-nums">
                            {number(avail)}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-gray-600 tabular-nums">
                            {number(reorder)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {avail <= 0 ? (
                              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-200">
                                Out of Stock
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                                Low Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm font-semibold text-gray-400">
                        No low stock shortages. All inventory levels healthy.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: STOCK AGING REPORT                                          */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "aging" ? (
          <section className={cn(PANEL, "overflow-hidden")}>
            <div className="border-b border-gray-100 p-4">
              <h3 className="font-black text-gray-900">Stock Aging Breakdown</h3>
              <p className="text-xs text-gray-500">
                Quantity and value distributed by receipt age buckets
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Warehouse</th>
                    <th className="px-4 py-3 text-right">Total Qty</th>
                    <th className="px-4 py-3 text-right">0-30 Days</th>
                    <th className="px-4 py-3 text-right">31-60 Days</th>
                    <th className="px-4 py-3 text-right">61-90 Days</th>
                    <th className="px-4 py-3 text-right">91-180 Days</th>
                    <th className="px-4 py-3 text-right">181-365 Days</th>
                    <th className="px-4 py-3 text-right">365+ Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                      </tr>
                    ))
                  ) : (agingData.rows || []).length ? (
                    agingData.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {r.product?.name || "—"}
                          <span className="block text-[10px] text-gray-400">SKU: {r.product?.sku}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-semibold">{r.warehouse?.name || "—"}</td>
                        <td className="px-4 py-3 text-right font-black tabular-nums">{number(r.totalQuantity)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">{number(r.bucket0_30?.quantity)}</td>
                        <td className="px-4 py-3 text-right font-bold text-cyan-600 tabular-nums">{number(r.bucket31_60?.quantity)}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600 tabular-nums">{number(r.bucket61_90?.quantity)}</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-600 tabular-nums">{number(r.bucket91_180?.quantity)}</td>
                        <td className="px-4 py-3 text-right font-bold text-orange-600 tabular-nums">{number(r.bucket181_365?.quantity)}</td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600 tabular-nums">{number(r.bucket365Plus?.quantity)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm font-semibold text-gray-400">
                        No aging records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 5: SLOW MOVING INVENTORY                                       */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "slow-moving" ? (
          <section className={cn(PANEL, "overflow-hidden")}>
            <div className="border-b border-gray-100 p-4">
              <h3 className="font-black text-gray-900">Slow & Non-Moving Stock</h3>
              <p className="text-xs text-gray-500">
                Positions with low or zero consumption over standard operational intervals
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3 text-right">On Hand</th>
                    <th className="px-5 py-3 text-right">Days Inactive</th>
                    <th className="px-5 py-3 text-center">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="mx-auto h-6 w-20" /></td>
                      </tr>
                    ))
                  ) : (slowData.rows || []).length ? (
                    slowData.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-4 font-bold text-gray-900">
                          {row.product?.name || "—"}
                          <span className="block text-xs text-gray-400">SKU: {row.product?.sku}</span>
                        </td>
                        <td className="px-5 py-4 text-gray-700 font-semibold">{row.warehouse?.name || "—"}</td>
                        <td className="px-5 py-4 text-right font-black tabular-nums">{number(row.onHandQuantity)}</td>
                        <td className="px-5 py-4 text-right font-bold text-amber-700 tabular-nums">{row.daysInactive ?? "—"} days</td>
                        <td className="px-5 py-4 text-center">
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700 ring-1 ring-orange-200">
                            {pretty(row.classification || "Slow-Moving")}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm font-semibold text-gray-400">
                        No slow-moving inventory detected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 6: BATCH & EXPIRY REPORT                                       */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "batch-expiry" ? (
          <section className={cn(PANEL, "overflow-hidden")}>
            <div className="border-b border-gray-100 p-4">
              <h3 className="font-black text-gray-900">Batch & Expiry Monitoring</h3>
              <p className="text-xs text-gray-500">
                Traceable batch numbers, expiration dates, and shelf-life status
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Batch / Lot No</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Warehouse</th>
                    <th className="px-5 py-3 text-right">Quantity</th>
                    <th className="px-5 py-3">Expiry Date</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-16" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-5 py-4"><Skeleton className="mx-auto h-6 w-20" /></td>
                      </tr>
                    ))
                  ) : batchData.items.length ? (
                    batchData.items.map((row, i) => (
                      <tr key={row._id || i} className="hover:bg-gray-50">
                        <td className="px-5 py-4 font-mono font-black text-indigo-700">
                          {row.batchNo || row.lotNo || "—"}
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-900">
                          {row.product?.name || "—"}
                        </td>
                        <td className="px-5 py-4 text-gray-700 font-semibold">{row.warehouse?.name || "—"}</td>
                        <td className="px-5 py-4 text-right font-black tabular-nums">{number(row.quantity)}</td>
                        <td className="px-5 py-4 text-gray-700 font-semibold">{formatDate(row.expiryDate)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            {pretty(row.status || "Active")}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-gray-400">
                        No batch tracking records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 7: STOCK TRANSFERS REPORT                                      */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "transfers" ? (
          <section className={cn(PANEL, "overflow-hidden")}>
            <div className="border-b border-gray-100 p-4">
              <h3 className="font-black text-gray-900">Stock Transfer Activity</h3>
              <p className="text-xs text-gray-500">
                Inter-warehouse movements, dispatched shipments, and receipt completions
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Transfer No</th>
                    <th className="px-5 py-3">Origin</th>
                    <th className="px-5 py-3">Destination</th>
                    <th className="px-5 py-3 text-right">Items</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-5 py-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-5 py-4"><Skeleton className="ml-auto h-4 w-12" /></td>
                        <td className="px-5 py-4"><Skeleton className="mx-auto h-6 w-20" /></td>
                        <td className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                      </tr>
                    ))
                  ) : transfersData.rows.length ? (
                    transfersData.rows.map((row, i) => (
                      <tr key={row._id || i} className="hover:bg-gray-50">
                        <td className="px-5 py-4 font-mono font-black text-gray-900">
                          {row.transferNo}
                        </td>
                        <td className="px-5 py-4 text-gray-700 font-semibold">
                          {row.sourceWarehouse?.name || "—"}
                        </td>
                        <td className="px-5 py-4 text-gray-700 font-semibold">
                          {row.destinationWarehouse?.name || "—"}
                        </td>
                        <td className="px-5 py-4 text-right font-black tabular-nums">
                          {number(row.lines?.length || 0, 0)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">
                            {pretty(row.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {formatDate(row.transferDate || row.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-gray-400">
                        No stock transfers recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
