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
    adminSections: ["Dashboard", "Accounting Setup", "Accounts Receivable", "Accounts Payable", "Cash Management", "Voucher", "Bank Reconciliation", "Journal Entries", "General Ledger", "Cash Book", "Profit & Loss", "Trial Balance", "Balance Sheet", "Cash Flow Statement", "Expenses", "Bank Transactions", "Money Transfer", "Setup"],
    employeeSections: ["Dashboard", "Accounting Setup", "Accounts Receivable", "Accounts Payable", "Cash Management", "Voucher", "Bank Reconciliation", "Journal Entries", "General Ledger", "Cash Book", "Profit & Loss", "Trial Balance", "Balance Sheet", "Cash Flow Statement", "Expenses", "Bank Transactions", "Money Transfer", "Setup"],
    subcategories: {
      Setup: ["Expense Setup", "Bank Setup"],
    },
  },
  inventory: {
    id: "inventory",
    name: "Inventory",
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
    adminSections: ["Dashboard", "Product Management", "Warehouse Management", "Stock Control"],
    employeeSections: ["Dashboard", "Product Management", "Warehouse Management", "Stock Control"],
    subcategories: {
      "Product Management": ["Products", "Categories", "Brands", "Units"],
      "Warehouse Management": ["Warehouses", "Locations"],
      "Stock Control": ["Stock Overview", "Stock Movements", "Stock Adjustments", "Stock Transfers"],
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
    permissions: ["access-control:view", "access-control:manage", "profile:view", "workflow:view"],
    adminSections: ["Profile Settings", "Users", "Access Control", "About"],
    employeeSections: ["Profile Settings", "Access Control", "Workflow Procedure", "About"],
  },
}

export const MODULE_IDS = Object.keys(MODULES)

export const isKnownModule = (value) => MODULE_IDS.includes(String(value || "").toLowerCase())

export function getModuleBasePath(role, moduleId) {
  const normalizedRole = ["admin", "superadmin"].includes(String(role || "").toLowerCase()) ? "admin" : "employee"
  return `/${normalizedRole}/${moduleId}`
}

export function canAccessModule(user, moduleId) {
  const module = MODULES[moduleId]
  if (!module || !user?.isActive) return false
  if (["admin", "superadmin"].includes(user.role)) return true
  if (moduleId === "administration") return module.permissions.some((permission) => hasPermission(user, permission))
  return module.permissions.some((permission) => hasPermission(user, permission))
}

export function buildModuleSections(sections, moduleId, role = "admin") {
  const module = MODULES[moduleId]
  if (!module) return {}
  const employee = String(role).toLowerCase() === "employee"
  const order = employee ? module.employeeSections : module.adminSections
  const result = {}

  for (const name of order) {
    const config = sections?.[name]
    if (!config) continue
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
