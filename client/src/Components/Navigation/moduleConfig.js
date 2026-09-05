import { hasPermission } from "../Auth/permissions"

export const MODULES = {
  crm: {
    id: "crm",
    name: "CRM",
    description: "Customers, leads, deals, workflows, and CRM reporting.",
    permissions: ["dashboard:view", "customers:view", "leads:view", "deals:view", "tasks:view", "reports:view"],
    adminSections: ["Dashboard", "CRM Analytics", "Clients", "Leads", "Deals", "Workflow Setup", "Report"],
    employeeSections: ["Dashboard", "CRM Analytics", "Clients", "Leads", "Deals"],
  },
  accounting: {
    id: "accounting",
    name: "Accounting",
    description: "Finance operations, accounting setup, ledgers, reports, and banking.",
    permissions: ["finance:view", "finance:manage", "expenses:view", "expenses:manage", "bank-setup:view", "bank-setup:manage"],
    adminSections: ["Dashboard", "Accounting Setup", "Accounts Receivable", "Accounts Payable", "Cash Management", "Voucher", "Bank Reconciliation", "Journal Entries", "Reports", "Profit & Loss", "Cash Flow Statement", "Expenses", "Bank Transactions", "Money Transfer", "Setup"],
    employeeSections: ["Dashboard", "Accounting Setup", "Accounts Receivable", "Accounts Payable", "Cash Management", "Voucher", "Bank Reconciliation", "Journal Entries", "Reports", "Profit & Loss", "Cash Flow Statement", "Expenses", "Bank Transactions", "Money Transfer", "Setup"],
    subcategories: {
      Setup: ["Expense Setup", "Bank Setup"],
      Reports: ["Cash Book", "General Ledger", "Balance Sheet", "Trial Balance"],
    },
  },
  inventory: {
    id: "inventory",
    name: "Inventory Management",
    description: "Products, categories, brands, stock operations, warehouses, and inventory reporting.",
    permissions: [
      "inventory-product:view",
      "inventory-product:manage",
      "inventory-product:delete",
      "inventory-category:view",
      "inventory-category:manage",
      "inventory-category:delete",
      "inventory-brand:view",
      "inventory-brand:manage",
      "inventory-brand:delete",
      "inventory-unit:view",
      "inventory-unit:manage",
      "inventory-unit:delete",
      "inventory-warehouse:view",
      "inventory-warehouse:manage",
      "inventory-warehouse:delete",
      "inventory-location:view",
      "inventory-location:manage",
      "inventory-location:delete",
      "inventory-stock:view",
      "inventory-stock:manage",
      "inventory-stock:delete",
      "inventory-movement:view",
      "inventory-movement:manage",
      "inventory-movement:post",
      "inventory-movement:reverse",
      "inventory-movement:delete",
      "inventory-adjustment:view",
      "inventory-adjustment:manage",
      "inventory-adjustment:approve",
      "inventory-adjustment:post",
      "inventory-adjustment:reverse",
      "inventory-adjustment:delete",
      "inventory-transfer:view",
      "inventory-transfer:manage",
      "inventory-transfer:approve",
      "inventory-transfer:dispatch",
      "inventory-transfer:receive",
      "inventory-transfer:reverse",
      "inventory-transfer:delete",
      "inventory-report:view",
    ],
    adminSections: ["Dashboard", "Inventory Items", "Item Profiles", "Product Management", "Warehouse Management", "Inventory Operations", "Quality Management", "Batch, Serial & Expiry", "Consumption History", "Inventory Valuation", "Inventory Loss Analysis", "Inventory Reports"],
    employeeSections: ["Dashboard", "Inventory Items", "Item Profiles", "Product Management", "Warehouse Management", "Inventory Operations", "Quality Management", "Batch, Serial & Expiry", "Consumption History", "Inventory Valuation", "Inventory Loss Analysis", "Inventory Reports"],
    sectionAliases: { Dashboard: "Inventory Dashboard" },
    subcategories: {
      "Product Management": ["Products", "Categories", "Units of Measure"],
      "Warehouse Management": ["Warehouses", "Scheduled Warehouse Checks", "Locations / Bins / Shelves"],
      "Inventory Operations": ["Stock Requests", "Stock Issues", "Stock Transfers", "Stock Adjustments", "Stock Report"],
      "Quality Management": ["Quality Inspection", "Stock Inspection"],
      "Batch, Serial & Expiry": ["Batches / Lots", "Serial Numbers", "Expiry Management", "Low Stock Requests"],
    },
  },
  supplier: {
    id: "supplier",
    name: "Supplier",
    description: "Supplier onboarding, approvals, commercial profiles, and product sourcing links.",
    permissions: ["supplier:view", "supplier:manage", "supplier:approve", "supplier:delete"],
    adminSections: ["Dashboard", "Suppliers", "Supplier Products"],
    employeeSections: ["Dashboard", "Suppliers", "Supplier Products"],
  },
  purchase: {
    id: "purchase",
    name: "Purchase",
    description: "Purchase orders, goods receipts, supplier returns, approvals, and procurement controls.",
    permissions: [
      "purchase-order:view", "purchase-order:manage", "purchase-order:approve", "purchase-order:delete",
      "goods-receipt:view", "goods-receipt:manage", "goods-receipt:approve", "goods-receipt:post", "goods-receipt:reverse", "goods-receipt:delete",
      "purchase-return:view", "purchase-return:manage", "purchase-return:approve", "purchase-return:post", "purchase-return:reverse", "purchase-return:delete",
    ],
    adminSections: ["Dashboard", "Quick Purchase", "Purchase Operations", "Purchase Order Management", "Price Analysis", "Purchase Reports"],
    employeeSections: ["Dashboard", "Quick Purchase", "Purchase Operations", "Purchase Order Management", "Price Analysis", "Purchase Reports"],
    subcategories: {
      "Purchase Operations": ["Purchase Requests", "Purchase Analysis", "Purchase Issues", "Purchase Dues", "Purchase Return"],
      "Purchase Order Management": ["Purchase Orders", "PO Print / PDF"],
    },
  },
  sales: {
    id: "sales",
    name: "Sales",
    description: "Quotations, customer orders, deliveries, invoices, receipts, returns, and sales reporting.",
    permissions: ["sales-quotation:view", "sales-order:view", "sales-delivery:view", "sales-invoice:view", "sales-return:view", "sales-report:view"],
    dashboardPermission: "sales-report:view",
    adminSections: ["Dashboard", "Sales Quotations", "Sales Orders", "Deliveries", "Sales Invoices", "Sales Returns", "Sales Reports"],
    employeeSections: ["Dashboard", "Sales Quotations", "Sales Orders", "Deliveries", "Sales Invoices", "Sales Returns", "Sales Reports"],
  },
  payroll: {
    id: "payroll",
    name: "HR Payroll",
    description: "Employees, attendance, salary, payroll, loans, leave, roster, and tax.",
    permissions: ["employees:view", "attendance:view", "salary:view", "payroll:view", "loans:view", "leaves:view", "roster:view", "tax.view"],
    adminSections: ["Payroll Manager", "Employee", "Attendance", "Salary", "Employee Loans", "Leave Requests", "Setup"],
    employeeSections: ["My Payroll", "My Attendance", "My Roster", "My Loans", "My Leave", "Employee Management", "Attendance Management", "Salary Management", "Payroll Management", "Tax Setup", "Tax Report", "Loan Management", "Leave Management", "Roster Management"],
    subcategories: { Setup: ["Roster / Shift Setup", "Leave Setup", "Tax Setup"] },
  },
  administration: {
    id: "administration",
    name: "Administration",
    description: "Users, access control, profile, workflow guidance, and system information.",
    permissions: ["users:view", "users:manage", "access-control:view", "access-control:manage", "profile:view", "workflow:view", "branch:view", "branch:manage"],
    adminSections: ["Dashboard", "Company Setup", "Users", "Access Control", "Profile Settings"],
    employeeSections: ["Dashboard", "Profile Settings", "Access Control", "Workflow Procedure"],
  },
}

export const MODULE_IDS = Object.keys(MODULES)

export const isKnownModule = (value) => MODULE_IDS.includes(String(value || "").toLowerCase())

function hasCurrentSubscriptionAccess(user) {
  if (user?.role === "superadmin") return true
  if (user?.subscription?.allowed === false) return false
  const companyStatus = String(user?.company?.status || "active").toLowerCase()
  if (!["active", "trial"].includes(companyStatus)) return false
  const start = user?.company?.subscription?.startDate ? new Date(user.company.subscription.startDate) : null
  const end = user?.company?.subscription?.endDate ? new Date(user.company.subscription.endDate) : null
  if (start && !Number.isNaN(start.getTime()) && Date.now() < start.getTime()) return false
  if (end && !Number.isNaN(end.getTime())) {
    end.setUTCHours(23, 59, 59, 999)
    if (Date.now() > end.getTime()) return false
  }
  return true
}

export function getModuleBasePath(role, moduleId) {
  const normalizedRole = ["admin", "superadmin"].includes(String(role || "").toLowerCase()) ? "admin" : "employee"
  return `/${normalizedRole}/${moduleId}`
}

export function canAccessModule(user, moduleId) {
  const module = MODULES[moduleId]
  if (!module || !user?.isActive) return false
  if (user.role === "superadmin") return moduleId === "administration"
  if (!hasCurrentSubscriptionAccess(user)) return false
  // Missing entitlements in a stale/local session must fail closed. A fresh
  // login or /users/me response always supplies the authoritative list.
  const companyModules = new Set([
    ...(Array.isArray(user.enabledModules) ? user.enabledModules : []),
    "administration",
  ])
  if (!companyModules.has(moduleId)) return false
  if (user.role === "admin") return true
  if (moduleId === "administration") return module.permissions.some((permission) => hasPermission(user, permission))
  return module.permissions.some((permission) => hasPermission(user, permission))
}

export function buildModuleSections(sections, moduleId, role = "admin") {
  const module = MODULES[moduleId]
  if (!module) return {}
  const normalizedRole = String(role).toLowerCase()
  const employee = normalizedRole === "employee"
  const order = normalizedRole === "superadmin" && moduleId === "administration"
    ? ["Dashboard", "Company Setup", "Users", "Profile Settings"]
    : employee ? module.employeeSections : module.adminSections
  const result = {}

  for (const name of order) {
    const sourceName = module.sectionAliases?.[name] || name
    const config = sections?.[sourceName]
    if (!config) continue
    if (name === "Dashboard" && module.dashboardPermission) {
      result[name] = { ...config, permission: module.dashboardPermission }
      continue
    }
    const allowedSubcategories = module.subcategories?.[name]
    if (allowedSubcategories && config.subcategories) {
      const subcategories = Object.fromEntries(
        allowedSubcategories.filter((item) => config.subcategories[item]).map((item) => [item, config.subcategories[item]])
      )
      if (!Object.keys(subcategories).length) continue
      const subcategoryPermissions = Object.fromEntries(
        allowedSubcategories.filter((item) => config.subcategoryPermissions?.[item]).map((item) => [item, config.subcategoryPermissions[item]])
      )
      result[name] = { ...config, subcategories, subcategoryPermissions }
    } else {
      result[name] = config
    }
  }
  if (!result.Dashboard) {
    const first = Object.values(result)[0]
    if (first) {
      const dashboard = sections?.Dashboard
      return {
        Dashboard: {
          icon: dashboard?.icon || first.icon,
          component: dashboard?.component || first.component,
          ...(dashboard?.permission ? { permission: dashboard.permission } : {}),
        },
        ...result,
      }
    }
  }
  return result
}

export function findModuleForSection(sectionName, role = "admin") {
  const employee = String(role).toLowerCase() === "employee"
  return MODULE_IDS.find((id) => (employee ? MODULES[id].employeeSections : MODULES[id].adminSections).includes(sectionName)) || ""
}
