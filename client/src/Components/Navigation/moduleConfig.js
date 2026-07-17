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
    adminSections: ["Finance", "Accounting Setup", "Cash Management", "Bank Management", "Payment Voucher", "Receive Voucher", "Contra Voucher", "Bank Reconciliation", "Journal Entries", "General Ledger", "Trial Balance", "Balance Sheet", "Cash Flow Statement", "Expenses", "Bank Transactions", "Money Transfer", "Setup"],
    employeeSections: ["Finance", "Accounting Setup", "Cash Management", "Bank Management", "Payment Voucher", "Receive Voucher", "Contra Voucher", "Bank Reconciliation", "Journal Entries", "General Ledger", "Trial Balance", "Balance Sheet", "Cash Flow Statement", "Expenses", "Bank Transactions", "Money Transfer"],
    subcategories: { Setup: ["Expense Setup", "Bank Setup"] },
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
      return {
        Dashboard: {
          ...first,
          icon: sections?.Dashboard?.icon || first.icon,
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
