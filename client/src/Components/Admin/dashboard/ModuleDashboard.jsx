"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PropTypes from "prop-types"
import { motion } from "framer-motion"
import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiArrowUpRight,
  FiBarChart2,
  FiBriefcase,
  FiBox,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDatabase,
  FiDollarSign,
  FiRefreshCcw,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { MODULES } from "../../Navigation/moduleConfig"
import { hasPermission } from "../../Auth/permissions"

const API_BASE = `${import.meta.env.VITE_API_URL}/api`
const CARD = "rounded-2xl border border-gray-100 bg-white shadow-[0_10px_28px_-16px_rgba(0,0,0,0.22)]"
const SOFT = "rounded-2xl border border-gray-100 bg-white shadow-[0_14px_42px_-24px_rgba(0,0,0,0.28)]"
const CHART_COLORS = ["#6366F1", "#F59E0B", "#22C55E", "#0EA5E9", "#EF4444", "#8B5CF6"]

const MODULE_PRESENTATION = {
  crm: {
    eyebrow: "Customer operations",
    title: "CRM Dashboard",
    description: "Customers, leads, follow-ups, tasks, and sales activity overview.",
    actions: ["Leads", "Clients", "Deals", "CRM Analytics", "Workflow Setup"],
  },
  accounting: {
    eyebrow: "Financial operations",
    title: "Accounting Dashboard",
    description: "Revenue, receivables, payables, cash collection, and finance controls.",
    actions: ["Cash Book", "Accounts Receivable", "Accounts Payable", "Voucher", "Profit & Loss", "General Ledger", "Journal Entries", "Accounting Setup", "Bank Transactions", "Expenses", "Setup"],
  },
  payroll: {
    eyebrow: "People operations",
    title: "HR & Payroll Dashboard",
    description: "Payroll status, workforce costs, attendance, leave, and employee operations.",
    actions: ["Payroll Manager", "My Payroll", "Employee", "Employee Management", "Attendance", "My Attendance", "Leave Requests", "My Leave"],
  },
  administration: {
    eyebrow: "System administration",
    title: "Administration Dashboard",
    description: "Users, access control, system governance, and authorized workspaces.",
    actions: ["Users", "Access Control", "Profile Settings", "Workflow Procedure", "About"],
  },
  inventory: {
    eyebrow: "Stock operations",
    title: "Inventory Dashboard",
    description: "Products, available stock, inventory value, replenishment alerts, and recent movements.",
    actions: ["Product Management", "Warehouse Management", "Stock Control"],
  },
  supplier: {
    eyebrow: "Procurement network",
    title: "Supplier Dashboard",
    description: "Supplier onboarding, approval status, preferred partners, and product sourcing relationships.",
    actions: ["Suppliers", "Supplier Products"],
  },
}

function authHeaders() {
  const token = localStorage.getItem("token")
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

async function request(path, signal) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
    credentials: "include",
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.message || "Unable to load dashboard data")
  return data
}

const numeric = (value) => Number(value || 0)
const number = (value) => new Intl.NumberFormat().format(numeric(value))
const money = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric(value))
const shortMoney = (value) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(numeric(value))
const getRows = (value) => value?.rows || value?.items || value?.data || []
const displayName = (value, fallback = "Record") =>
  value?.contact?.name || value?.employee?.name || value?.customer?.name || value?.businessName || value?.tradingName || value?.vendorName || value?.name || value?.companyName || value?.leadNumber || fallback

function StatCard({ icon, label, value, detail, tone = "indigo", delay = 0 }) {
  const tones = {
    indigo: ["bg-indigo-50 text-indigo-700 ring-indigo-600/10", "shadow-[0_18px_50px_-30px_rgba(79,70,229,0.40)]"],
    amber: ["bg-amber-50 text-amber-800 ring-amber-600/10", "shadow-[0_18px_50px_-30px_rgba(245,158,11,0.35)]"],
    green: ["bg-green-50 text-green-700 ring-green-600/10", "shadow-[0_18px_50px_-30px_rgba(34,197,94,0.35)]"],
    sky: ["bg-sky-50 text-sky-700 ring-sky-600/10", "shadow-[0_18px_50px_-30px_rgba(14,165,233,0.35)]"],
    rose: ["bg-rose-50 text-rose-700 ring-rose-600/10", "shadow-[0_18px_50px_-30px_rgba(244,63,94,0.35)]"],
    gray: ["bg-gray-100 text-gray-700 ring-gray-600/10", "shadow-[0_18px_50px_-34px_rgba(75,85,99,0.25)]"],
  }
  const [badge, glow] = tones[tone] || tones.indigo
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={`${CARD} ${glow} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-500">{label}</p>
          <p className="mt-1 truncate text-3xl font-extrabold tracking-tight text-gray-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${badge}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs font-medium text-gray-500">{detail}</p>
    </motion.article>
  )
}

StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  detail: PropTypes.string.isRequired,
  tone: PropTypes.string,
  delay: PropTypes.number,
}

function ChartCard({ title, subtitle, icon, children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${SOFT} overflow-hidden`}>
      <div className="flex items-center gap-3 border-b border-gray-100 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10">{icon}</div>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-extrabold tracking-tight text-gray-900">{title}</h3>
          <p className="truncate text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="h-72 p-4">{children}</div>
    </motion.section>
  )
}

ChartCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  icon: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
}

function ChartSkeleton() {
  return <div className="h-full animate-pulse rounded-2xl bg-gray-100" />
}

function PremiumTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      {label ? <p className="mb-1 text-xs font-bold text-gray-500">{label}</p> : null}
      {payload.map((item) => <p key={`${item.name}-${item.value}`} className="text-xs font-extrabold" style={{ color: item.color }}>{item.name}: {number(item.value)}</p>)}
    </div>
  )
}

PremiumTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}

export default function ModuleDashboard({ moduleId, moduleSections = {}, currentUser, onNavigateSection }) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const presentation = MODULE_PRESENTATION[moduleId] || MODULE_PRESENTATION.crm
  const module = MODULES[moduleId]
  const canViewFinance = hasPermission(currentUser, "finance:view")
  const canViewExpenses = hasPermission(currentUser, "expenses:view")
  const canViewPayroll = hasPermission(currentUser, "payroll:view")
  const canViewInventoryReport = hasPermission(currentUser, "inventory-report:view")
  const canViewSupplier = hasPermission(currentUser, "supplier:view")

  const load = useCallback(async (signal) => {
    setLoading(true)
    setError("")
    try {
      if (moduleId === "crm") {
        const sources = [
          hasPermission(currentUser, "dashboard:view") ? ["dashboard", request("/dashboard?days=7&limit=8", signal)] : null,
          hasPermission(currentUser, "leads:view") ? ["leads", request("/leads?limit=8&includeSummary=true&sort=priority", signal)] : null,
        ].filter(Boolean)
        const results = await Promise.allSettled(sources.map(([, promise]) => promise))
        const nextData = {}
        const failures = []
        results.forEach((result, index) => {
          const key = sources[index][0]
          if (result.status === "fulfilled") nextData[key] = result.value || {}
          else if (result.reason?.name !== "AbortError") failures.push(result.reason?.message || `Failed to load ${key}`)
        })
        setData(nextData)
        if (failures.length) setError(failures.join(" "))
      } else if (moduleId === "accounting") {
        const query = new URLSearchParams({ from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) })
        const sources = canViewFinance ? [
          ["profit", request(`/accounting/profit-loss?${query}`, signal)],
          ["receivables", request(`/accounting/receivables?${query}&limit=8`, signal)],
          ["payables", request(`/accounting/payables?${query}&limit=8`, signal)],
        ] : canViewExpenses ? [
          ["payables", request(`/accounting/payables?${query}&limit=8`, signal)],
        ] : []
        const results = await Promise.allSettled(sources.map(([, promise]) => promise))
        const nextData = {}
        const failures = []
        results.forEach((result, index) => {
          const key = sources[index][0]
          if (result.status === "fulfilled") nextData[key] = result.value || {}
          else if (result.reason?.name !== "AbortError") failures.push(result.reason?.message || `Failed to load ${key}`)
        })
        setData(nextData)
        if (failures.length) setError(failures.join(" "))
      } else if (moduleId === "payroll") {
        if (canViewPayroll) {
          const now = new Date()
          const payroll = await request(`/payroll?limit=50&year=${now.getFullYear()}&month=${now.getMonth() + 1}`, signal)
          setData({ payroll })
        } else {
          setData({})
        }
      } else if (moduleId === "inventory") {
        if (canViewInventoryReport) {
          const inventory = await request("/inventory/reports/dashboard", signal)
          setData({ inventory })
        } else {
          setData({})
        }
      } else if (moduleId === "supplier") {
        if (canViewSupplier) {
          const [supplierSummary, suppliers] = await Promise.all([
            request("/suppliers/summary", signal),
            request("/suppliers?limit=6", signal),
          ])
          setData({ supplierSummary, suppliers })
        } else {
          setData({})
        }
      } else {
        const dashboard = hasPermission(currentUser, "dashboard:view")
          ? await request("/dashboard?days=7&limit=5", signal)
          : {}
        setData({ dashboard })
      }
    } catch (loadError) {
      if (loadError?.name !== "AbortError") setError(loadError?.message || "Dashboard data could not be loaded")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [canViewExpenses, canViewFinance, canViewInventoryReport, canViewPayroll, canViewSupplier, currentUser, moduleId])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const cards = useMemo(() => {
    if (moduleId === "crm") {
      const customer = data.dashboard?.customerStats || {}
      const lead = data.leads?.summary || {}
      return [
        { label: "Customers", value: number(customer.total), detail: `${number(customer.inProgress)} currently in progress`, icon: <FiUsers />, tone: "indigo" },
        { label: "Total leads", value: number(lead.total), detail: `${number(lead.active)} active opportunities`, icon: <FiTarget />, tone: "sky" },
        { label: "Follow-ups today", value: number(lead.followUpsToday), detail: "Scheduled lead follow-ups", icon: <FiClock />, tone: "amber" },
        { label: "Overdue leads", value: number(lead.overdue), detail: "Require immediate attention", icon: <FiAlertCircle />, tone: "rose" },
      ]
    }
    if (moduleId === "accounting") {
      const profit = data.profit?.summary || {}
      const receivables = data.receivables?.summary || {}
      const payables = data.payables?.summary || {}
      if (!canViewFinance && canViewExpenses) {
        return [
          { label: "Payable", value: money(payables.payableAmount), detail: "Pending and approved expenses", icon: <FiCreditCard />, tone: "amber" },
          { label: "Pending", value: money(payables.pendingAmount), detail: `${number(payables.pendingCount)} expense records`, icon: <FiClock />, tone: "sky" },
          { label: "Approved", value: money(payables.approvedAmount), detail: `${number(payables.approvedCount)} approved liabilities`, icon: <FiCheckCircle />, tone: "green" },
          { label: "Paid", value: money(payables.paidAmount), detail: `${number(payables.paidCount)} completed payments`, icon: <FiActivity />, tone: "indigo" },
        ]
      }
      return [
        { label: "Revenue", value: money(profit.revenue), detail: "Current year recognized revenue", icon: <FiTrendingUp />, tone: "green" },
        { label: "Receivable", value: money(receivables.receivableAmount), detail: `${money(receivables.overdueAmount)} overdue`, icon: <FiDollarSign />, tone: "sky" },
        { label: "Payable", value: money(payables.payableAmount), detail: `${money(payables.dueIn30)} due in the next 30 days`, icon: <FiCreditCard />, tone: "amber" },
        { label: "Cash collected", value: money(profit.cashCollected), detail: `${number(profit.dealCount)} completed deals`, icon: <FiCheckCircle />, tone: "indigo" },
      ]
    }
    if (moduleId === "payroll") {
      if (!canViewPayroll) {
        return [
          { label: "Authorized features", value: number(Math.max(0, Object.keys(moduleSections).length - 1)), detail: "Available HR and payroll features", icon: <FiShield />, tone: "indigo" },
          { label: "Payroll access", value: "Restricted", detail: "Payroll totals require payroll view permission", icon: <FiCreditCard />, tone: "amber" },
          { label: "Account status", value: currentUser?.isActive ? "Active" : "Restricted", detail: currentUser?.role || "User", icon: <FiActivity />, tone: currentUser?.isActive ? "green" : "rose" },
          { label: "Module", value: "HR", detail: "Use the permitted features in the sidebar", icon: <FiUsers />, tone: "sky" },
        ]
      }
      const rows = data.payroll?.payrolls || []
      const paid = rows.filter((item) => item.status === "paid")
      const pending = rows.filter((item) => ["draft", "calculated", "approved"].includes(item.status))
      return [
        { label: "Payroll records", value: number(data.payroll?.total ?? rows.length), detail: "Records in the selected month", icon: <FiBriefcase />, tone: "sky" },
        { label: "Net payroll", value: money(rows.reduce((sum, item) => sum + numeric(item.netPayable), 0)), detail: "Total calculated net payable", icon: <FiDollarSign />, tone: "indigo" },
        { label: "Paid", value: number(paid.length), detail: `${money(paid.reduce((sum, item) => sum + numeric(item.netPayable), 0))} disbursed`, icon: <FiCheckCircle />, tone: "green" },
        { label: "Pending action", value: number(pending.length), detail: "Draft, calculated, or approved", icon: <FiClock />, tone: "amber" },
      ]
    }
    if (moduleId === "inventory") {
      if (!canViewInventoryReport) {
        return [
          { label: "Authorized features", value: number(Math.max(0, Object.keys(moduleSections).length - 1)), detail: "Available inventory workspaces", icon: <FiShield />, tone: "indigo" },
          { label: "Stock reporting", value: "Restricted", detail: "Inventory totals require report access", icon: <FiBarChart2 />, tone: "amber" },
          { label: "Account status", value: currentUser?.isActive ? "Active" : "Restricted", detail: currentUser?.role || "User", icon: <FiActivity />, tone: currentUser?.isActive ? "green" : "rose" },
          { label: "Module", value: "Inventory", detail: "Use the permitted features in the sidebar", icon: <FiBox />, tone: "sky" },
        ]
      }
      const inventory = data.inventory || {}
      const stock = inventory.stock || {}
      return [
        { label: "Active products", value: number(inventory.activeProducts), detail: `${number(stock.stockPositions)} warehouse stock positions`, icon: <FiBox />, tone: "indigo" },
        { label: "Available stock", value: number(stock.availableQuantity), detail: `${number(stock.reservedQuantity)} units reserved`, icon: <FiCheckCircle />, tone: "green" },
        { label: "Inventory value", value: money(stock.inventoryValue), detail: `Across ${number(inventory.activeWarehouses)} active warehouses`, icon: <FiDollarSign />, tone: "sky" },
        { label: "Low stock", value: number(inventory.lowStockPositions), detail: `${number(stock.negativePositions)} negative stock positions`, icon: <FiAlertCircle />, tone: inventory.lowStockPositions ? "rose" : "amber" },
      ]
    }
    if (moduleId === "supplier") {
      if (!canViewSupplier) {
        return [
          { label: "Authorized features", value: number(Math.max(0, Object.keys(moduleSections).length - 1)), detail: "Available supplier workspaces", icon: <FiShield />, tone: "indigo" },
          { label: "Supplier reporting", value: "Restricted", detail: "Supplier totals require supplier view permission", icon: <FiBarChart2 />, tone: "amber" },
          { label: "Account status", value: currentUser?.isActive ? "Active" : "Restricted", detail: currentUser?.role || "User", icon: <FiActivity />, tone: currentUser?.isActive ? "green" : "rose" },
          { label: "Module", value: "Supplier", detail: "Use the permitted features in the sidebar", icon: <FiBriefcase />, tone: "sky" },
        ]
      }
      const summary = data.supplierSummary?.summary || {}
      return [
        { label: "Suppliers", value: number(summary.supplierCount), detail: `${number(summary.activeCount)} active suppliers`, icon: <FiUsers />, tone: "indigo" },
        { label: "Pending approval", value: number(summary.pendingApprovalCount), detail: `${number(summary.draftCount)} draft supplier records`, icon: <FiClock />, tone: summary.pendingApprovalCount ? "amber" : "green" },
        { label: "Preferred suppliers", value: number(summary.preferredCount), detail: "Preferred procurement partners", icon: <FiCheckCircle />, tone: "green" },
        { label: "Average rating", value: numeric(summary.averageRating).toFixed(1), detail: `${number(summary.onHoldCount)} currently on hold`, icon: <FiTrendingUp />, tone: "sky" },
      ]
    }
    return [
      { label: "Authorized features", value: number(Math.max(0, Object.keys(moduleSections).length - 1)), detail: "Available in this module", icon: <FiShield />, tone: "indigo" },
      { label: "Employees", value: number(data.dashboard?.employeesCount), detail: "Active employee accounts", icon: <FiUsers />, tone: "sky" },
      { label: "Administrators", value: number(numeric(data.dashboard?.adminsCount) + numeric(data.dashboard?.superAdminsCount)), detail: "Active privileged accounts", icon: <FiShield />, tone: "gray" },
      { label: "Account status", value: currentUser?.isActive ? "Active" : "Restricted", detail: currentUser?.role || "User", icon: <FiActivity />, tone: currentUser?.isActive ? "green" : "rose" },
    ]
  }, [canViewExpenses, canViewFinance, canViewInventoryReport, canViewPayroll, canViewSupplier, currentUser, data, moduleId, moduleSections])

  const chartModel = useMemo(() => {
    if (moduleId === "crm") {
      const customer = data.dashboard?.customerStats || {}
      return {
        pieTitle: "Customer Status",
        pieSubtitle: "Pending / in progress / completed",
        pie: data.dashboard?.customerStatusChart?.length ? data.dashboard.customerStatusChart : [
          { name: "Pending", value: numeric(customer.pending) },
          { name: "In Progress", value: numeric(customer.inProgress) },
          { name: "Complete", value: numeric(customer.complete) },
          { name: "Other", value: numeric(customer.other) },
        ],
        barTitle: "Task Status",
        barSubtitle: "Pending / in progress / completed",
        bar: data.dashboard?.taskStatusChart || [],
        lineTitle: "New Customers",
        lineSubtitle: "Last 7 days trend",
        line: data.dashboard?.newCustomersTrend || [],
      }
    }
    if (moduleId === "accounting") {
      const profit = data.profit?.summary || {}
      const receivables = data.receivables?.summary || {}
      const payables = data.payables?.summary || {}
      const exposure = getRows(data.receivables).slice(0, 7).map((row, index) => ({
        name: String(displayName(row, `Account ${index + 1}`)).slice(0, 12),
        value: numeric(row.outstandingAmount ?? row.receivableAmount ?? row.amount ?? row.balance),
      }))
      return {
        pieTitle: "Financial Position",
        pieSubtitle: "Receivable / payable / collected cash",
        pie: [
          { name: "Receivable", value: numeric(receivables.receivableAmount) },
          { name: "Payable", value: numeric(payables.payableAmount) },
          { name: "Collected", value: numeric(profit.cashCollected) },
        ],
        barTitle: "Performance",
        barSubtitle: "Revenue, expense, and cash overview",
        bar: [
          { name: "Revenue", value: numeric(profit.revenue) },
          { name: "Expenses", value: numeric(profit.expenses ?? profit.totalExpenses ?? payables.payableAmount) },
          { name: "Cash", value: numeric(profit.cashCollected) },
        ],
        lineTitle: "Receivable Exposure",
        lineSubtitle: "Highest open customer balances",
        line: exposure.length ? exposure : [{ name: "Current", value: numeric(receivables.receivableAmount) }],
      }
    }
    if (moduleId === "payroll") {
      const rows = data.payroll?.payrolls || []
      const statuses = ["draft", "calculated", "approved", "paid", "cancelled"].map((status) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: rows.filter((row) => row.status === status).length,
      }))
      return {
        pieTitle: "Payroll Status",
        pieSubtitle: "Current processing distribution",
        pie: statuses,
        barTitle: "Payroll Value",
        barSubtitle: "Gross, deductions, and net payable",
        bar: [
          { name: "Gross", value: rows.reduce((sum, row) => sum + numeric(row.grossSalary), 0) },
          { name: "Deductions", value: rows.reduce((sum, row) => sum + numeric(row.totalDeductions), 0) },
          { name: "Net", value: rows.reduce((sum, row) => sum + numeric(row.netPayable), 0) },
        ],
        lineTitle: "Employee Payroll",
        lineSubtitle: "Latest net payable records",
        line: rows.slice(0, 8).map((row, index) => ({ name: String(displayName(row, `Employee ${index + 1}`)).split(" ")[0], value: numeric(row.netPayable) })),
      }
    }
    if (moduleId === "inventory") {
      const inventory = data.inventory || {}
      const stock = inventory.stock || {}
      const transfers = inventory.transfers || {}
      const movements = inventory.movementEffects || []
      return {
        pieTitle: "Stock Availability",
        pieSubtitle: "Available, reserved, and quarantine quantities",
        pie: [
          { name: "Available", value: numeric(stock.availableQuantity) },
          { name: "Reserved", value: numeric(stock.reservedQuantity) },
          { name: "Quarantine", value: numeric(stock.quarantineQuantity) },
        ],
        barTitle: "Movement Effects",
        barSubtitle: "Posted inventory movement quantities in the last 30 days",
        bar: movements.length
          ? movements.map((item) => ({ name: item._id === "in" ? "Stock In" : item._id === "out" ? "Stock Out" : item._id || "Movement", value: numeric(item.quantity) }))
          : [{ name: "Stock In", value: 0 }, { name: "Stock Out", value: 0 }],
        lineTitle: "Transfer Pipeline",
        lineSubtitle: "Transfers awaiting action and in transit",
        line: [
          { name: "Awaiting", value: numeric(transfers.awaitingApproval) },
          { name: "Approved", value: numeric(transfers.approved) },
          { name: "In Transit", value: numeric(transfers.inTransit) },
        ],
      }
    }
    if (moduleId === "supplier") {
      const summary = data.supplierSummary?.summary || {}
      return {
        pieTitle: "Supplier Status",
        pieSubtitle: "Active, pending, draft, and on-hold suppliers",
        pie: [
          { name: "Active", value: numeric(summary.activeCount) },
          { name: "Pending", value: numeric(summary.pendingApprovalCount) },
          { name: "Draft", value: numeric(summary.draftCount) },
          { name: "On Hold", value: numeric(summary.onHoldCount) },
        ],
        barTitle: "Supplier Portfolio",
        barSubtitle: "Total, preferred, inactive, and archived records",
        bar: [
          { name: "Total", value: numeric(summary.supplierCount) },
          { name: "Preferred", value: numeric(summary.preferredCount) },
          { name: "Inactive", value: numeric(summary.inactiveCount) },
          { name: "Archived", value: numeric(summary.archivedCount) },
        ],
        lineTitle: "Onboarding Pipeline",
        lineSubtitle: "Supplier records progressing toward activation",
        line: [
          { name: "Draft", value: numeric(summary.draftCount) },
          { name: "Pending", value: numeric(summary.pendingApprovalCount) },
          { name: "Active", value: numeric(summary.activeCount) },
        ],
      }
    }
    const employees = numeric(data.dashboard?.employeesCount)
    const admins = numeric(data.dashboard?.adminsCount)
    const superAdmins = numeric(data.dashboard?.superAdminsCount)
    const featureCount = Math.max(0, Object.keys(moduleSections).length - 1)
    return {
      pieTitle: "User Roles",
      pieSubtitle: "Active account distribution",
      pie: [{ name: "Employees", value: employees }, { name: "Admins", value: admins }, { name: "Super Admins", value: superAdmins }],
      barTitle: "Administration Scope",
      barSubtitle: "Authorized features and users",
      bar: [{ name: "Features", value: featureCount }, { name: "Employees", value: employees }, { name: "Admins", value: admins + superAdmins }],
      lineTitle: "Governance Readiness",
      lineSubtitle: "Current access and account indicators",
      line: [{ name: "Access", value: featureCount }, { name: "Employees", value: employees }, { name: "Admins", value: admins + superAdmins }],
    }
  }, [data, moduleId, moduleSections])

  const actions = presentation.actions.filter((name) => moduleSections[name])
  const recentItems = useMemo(() => {
    if (moduleId === "crm") return (data.leads?.items || []).slice(0, 6).map((item) => ({ ...item, title: displayName(item, "Lead"), subtitle: item.pipelineStage || item.status || "New", alert: item.isOverdue }))
    if (moduleId === "accounting") return [...getRows(data.receivables), ...getRows(data.payables)].slice(0, 6).map((item, index) => ({ ...item, title: displayName(item, `Finance record ${index + 1}`), subtitle: item.status || item.type || "Open", amount: item.outstandingAmount ?? item.amount ?? item.balance }))
    if (moduleId === "payroll") return (data.payroll?.payrolls || []).slice(0, 6).map((item) => ({ ...item, title: displayName(item, "Employee payroll"), subtitle: item.status || "Draft", amount: item.netPayable }))
    if (moduleId === "inventory") return (data.inventory?.recentMovements || []).slice(0, 6).map((item, index) => ({ ...item, title: item.movementNo || item.reference || `Movement ${index + 1}`, subtitle: String(item.movementType || "Stock movement").replace(/_/g, " "), amount: item.totalValue }))
    if (moduleId === "supplier") return (data.suppliers?.suppliers || []).slice(0, 6).map((item, index) => ({ ...item, title: displayName(item, `Supplier ${index + 1}`), subtitle: `${String(item.status || "draft").replace(/_/g, " ")}${item.supplierType ? ` · ${String(item.supplierType).replace(/_/g, " ")}` : ""}` }))
    return actions.slice(0, 6).map((name) => ({ title: name, subtitle: "Authorized workspace" }))
  }, [actions, data, moduleId])

  return (
    <div className="min-h-full bg-gray-50 p-1 sm:p-4 lg:p-6">
      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`${SOFT} mb-6 p-5 sm:p-6`}>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/25 blur-lg" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm"><FiActivity className="h-6 w-6" /></div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{presentation.title}</h1>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-600/10">{presentation.eyebrow}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{presentation.description}</p>
            </div>
          </div>
          <button type="button" onClick={() => load()} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60 lg:self-auto">
            <FiRefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </motion.header>

      {error ? <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700"><FiAlertCircle className="mt-0.5 h-5 w-5" /><span className="text-sm font-semibold">{error}. Showing the information available to your role.</span></div> : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !Object.keys(data).length
          ? Array.from({ length: 4 }).map((_, index) => <div key={index} className={`${CARD} h-40 animate-pulse bg-gray-100`} />)
          : cards.map((card, index) => <StatCard key={card.label} {...card} delay={index * 0.05} />)}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title={chartModel.pieTitle} subtitle={chartModel.pieSubtitle} icon={<FiDatabase className="h-5 w-5" />}>
          {loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip content={<PremiumTooltip />} /><Legend iconType="circle" iconSize={8} /><Pie data={chartModel.pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">{chartModel.pie.map((item, index) => <Cell key={`${item.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie></PieChart></ResponsiveContainer>}
        </ChartCard>
        <ChartCard title={chartModel.barTitle} subtitle={chartModel.barSubtitle} icon={<FiBarChart2 className="h-5 w-5" />}>
          {loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={chartModel.bar} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={shortMoney} axisLine={false} tickLine={false} /><Tooltip content={<PremiumTooltip />} /><Bar dataKey="value" name="Value" radius={[9, 9, 0, 0]}>{chartModel.bar.map((item, index) => <Cell key={`${item.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>}
        </ChartCard>
        <ChartCard title={chartModel.lineTitle} subtitle={chartModel.lineSubtitle} icon={<FiTrendingUp className="h-5 w-5" />}>
          {loading ? <ChartSkeleton /> : <ResponsiveContainer width="100%" height="100%"><LineChart data={chartModel.line} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}><CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickFormatter={shortMoney} axisLine={false} tickLine={false} /><Tooltip content={<PremiumTooltip />} /><Line type="monotone" dataKey="value" name="Value" stroke="#6366F1" strokeWidth={3} dot={{ r: 3, fill: "#6366F1", strokeWidth: 0 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer>}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className={`${SOFT} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-600/10"><FiClock className="h-5 w-5" /></div><div><h3 className="text-lg font-extrabold tracking-tight text-gray-900">Recent Activity</h3><p className="text-sm text-gray-500">Latest important {module?.name?.toLowerCase()} records</p></div></div>
            {actions[0] ? <button type="button" onClick={() => onNavigateSection(actions[0])} className="hidden items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:inline-flex">View all <FiArrowUpRight /></button> : null}
          </div>
          <div className="h-[390px] space-y-3 overflow-y-auto bg-gray-50 p-4">
            {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className={`${CARD} h-20 animate-pulse bg-gray-100`} />) : recentItems.length ? recentItems.map((item, index) => (
              <button key={item._id || item.title || index} type="button" onClick={() => actions[0] && onNavigateSection(actions[0])} className={`${CARD} flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-gray-50`}>
                <span className="min-w-0"><span className="block truncate text-sm font-extrabold text-gray-900">{item.title}</span><span className="mt-1 block truncate text-xs font-medium capitalize text-gray-500">{item.subtitle}</span></span>
                {item.alert ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700 ring-1 ring-rose-600/10">OVERDUE</span> : item.amount != null ? <span className="shrink-0 text-xs font-extrabold text-indigo-700">{money(item.amount)}</span> : <FiArrowRight className="shrink-0 text-gray-400" />}
              </button>
            )) : <div className={`${CARD} p-8 text-center`}><FiCheckCircle className="mx-auto h-7 w-7 text-emerald-500" /><p className="mt-3 text-sm font-bold text-gray-900">No recent items</p><p className="mt-1 text-xs text-gray-500">New module activity will appear here.</p></div>}
          </div>
        </section>

        <section className={`${SOFT} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-gray-100 p-5"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10"><FiActivity className="h-5 w-5" /></div><div><h3 className="text-lg font-extrabold tracking-tight text-gray-900">Module Workspaces</h3><p className="text-sm text-gray-500">Shortcuts allowed by your permissions</p></div></div>
          <div className="grid h-[390px] content-start gap-3 overflow-y-auto bg-gray-50 p-4 sm:grid-cols-2">
            {actions.map((name) => (
              <button key={name} type="button" onClick={() => onNavigateSection(name)} className={`${CARD} group flex min-h-24 items-center justify-between gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg`}>
                <span><span className="block text-sm font-extrabold text-gray-900">{name}</span><span className="mt-1 block text-xs font-medium text-gray-500">Open authorized feature</span></span><FiArrowRight className="shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-indigo-600" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

ModuleDashboard.propTypes = {
  moduleId: PropTypes.oneOf(["crm", "accounting", "inventory", "supplier", "payroll", "administration"]).isRequired,
  moduleSections: PropTypes.object,
  currentUser: PropTypes.shape({ isActive: PropTypes.bool, role: PropTypes.string }),
  onNavigateSection: PropTypes.func.isRequired,
}
