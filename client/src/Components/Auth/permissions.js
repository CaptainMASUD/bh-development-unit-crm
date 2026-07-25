export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",
  LEADS_VIEW: "leads:view",
  LEADS_MANAGE: "leads:manage",
  DEALS_VIEW: "deals:view",
  DEALS_MANAGE: "deals:manage",
  FINANCE_VIEW: "finance:view",
  FINANCE_MANAGE: "finance:manage",
  TASKS_VIEW: "tasks:view",
  TASKS_MANAGE: "tasks:manage",
  REPORTS_VIEW: "reports:view",
  ATTENDANCE_VIEW: "attendance:view",
  ATTENDANCE_MANAGE: "attendance:manage",
  PAYROLL_VIEW: "payroll:view",
  PAYROLL_MANAGE: "payroll:manage",
  TAX_VIEW: "tax.view",
  TAX_CREATE: "tax.create",
  TAX_UPDATE: "tax.update",
  TAX_DELETE: "tax.delete",
  TAX_ASSIGN_EMPLOYEE: "tax.assign_employee",
  TAX_REPORT: "tax.report",
  EXPENSES_VIEW: "expenses:view",
  EXPENSES_MANAGE: "expenses:manage",
  EXPENSE_SETUP_VIEW: "expense-setup:view",
  EXPENSE_SETUP_MANAGE: "expense-setup:manage",
  BANK_SETUP_VIEW: "bank-setup:view",
  BANK_SETUP_MANAGE: "bank-setup:manage",
  LOANS_VIEW: "loans:view",
  LOANS_MANAGE: "loans:manage",
  LEAVES_VIEW: "leaves:view",
  LEAVES_MANAGE: "leaves:manage",
  ROSTER_VIEW: "roster:view",
  ROSTER_MANAGE: "roster:manage",
  EMPLOYEES_VIEW: "employees:view",
  EMPLOYEES_MANAGE: "employees:manage",
  SALARY_VIEW: "salary:view",
  SALARY_MANAGE: "salary:manage",
  NOTIFICATIONS_VIEW: "notifications:view",
  NOTIFICATIONS_MANAGE: "notifications:manage",
  ACCESS_CONTROL_VIEW: "access-control:view",
  ACCESS_CONTROL_MANAGE: "access-control:manage",
  WORKFLOW_VIEW: "workflow:view",
  PROFILE_VIEW: "profile:view",
  INVENTORY_PRODUCT_VIEW: "inventory-product:view",
  INVENTORY_PRODUCT_MANAGE: "inventory-product:manage",
  INVENTORY_PRODUCT_DELETE: "inventory-product:delete",
  INVENTORY_CATEGORY_VIEW: "inventory-category:view",
  INVENTORY_CATEGORY_MANAGE: "inventory-category:manage",
  INVENTORY_CATEGORY_DELETE: "inventory-category:delete",
  INVENTORY_BRAND_VIEW: "inventory-brand:view",
  INVENTORY_BRAND_MANAGE: "inventory-brand:manage",
  INVENTORY_BRAND_DELETE: "inventory-brand:delete",
  INVENTORY_UNIT_VIEW: "inventory-unit:view",
  INVENTORY_UNIT_MANAGE: "inventory-unit:manage",
  INVENTORY_UNIT_DELETE: "inventory-unit:delete",
  INVENTORY_WAREHOUSE_VIEW: "inventory-warehouse:view",
  INVENTORY_WAREHOUSE_MANAGE: "inventory-warehouse:manage",
  INVENTORY_WAREHOUSE_DELETE: "inventory-warehouse:delete",
  INVENTORY_LOCATION_VIEW: "inventory-location:view",
  INVENTORY_LOCATION_MANAGE: "inventory-location:manage",
  INVENTORY_LOCATION_DELETE: "inventory-location:delete",
  INVENTORY_STOCK_VIEW: "inventory-stock:view",
  INVENTORY_STOCK_MANAGE: "inventory-stock:manage",
  INVENTORY_STOCK_DELETE: "inventory-stock:delete",
  INVENTORY_MOVEMENT_VIEW: "inventory-movement:view",
  INVENTORY_MOVEMENT_MANAGE: "inventory-movement:manage",
  INVENTORY_MOVEMENT_POST: "inventory-movement:post",
  INVENTORY_MOVEMENT_REVERSE: "inventory-movement:reverse",
  INVENTORY_MOVEMENT_DELETE: "inventory-movement:delete",
  INVENTORY_ADJUSTMENT_VIEW: "inventory-adjustment:view",
  INVENTORY_ADJUSTMENT_MANAGE: "inventory-adjustment:manage",
  INVENTORY_ADJUSTMENT_APPROVE: "inventory-adjustment:approve",
  INVENTORY_ADJUSTMENT_POST: "inventory-adjustment:post",
  INVENTORY_ADJUSTMENT_REVERSE: "inventory-adjustment:reverse",
  INVENTORY_ADJUSTMENT_DELETE: "inventory-adjustment:delete",
  INVENTORY_TRANSFER_VIEW: "inventory-transfer:view",
  INVENTORY_TRANSFER_MANAGE: "inventory-transfer:manage",
  INVENTORY_TRANSFER_APPROVE: "inventory-transfer:approve",
  INVENTORY_TRANSFER_DISPATCH: "inventory-transfer:dispatch",
  INVENTORY_TRANSFER_RECEIVE: "inventory-transfer:receive",
  INVENTORY_TRANSFER_REVERSE: "inventory-transfer:reverse",
  INVENTORY_TRANSFER_DELETE: "inventory-transfer:delete",
  INVENTORY_REPORT_VIEW: "inventory-report:view",
  SUPPLIER_VIEW: "supplier:view",
  SUPPLIER_MANAGE: "supplier:manage",
  SUPPLIER_APPROVE: "supplier:approve",
  SUPPLIER_DELETE: "supplier:delete",
}

export function getUserPermissions(user) {
  if (user?.permissionGroup?.isActive === false) return []
  return Array.isArray(user?.permissionGroup?.permissions)
    ? user.permissionGroup.permissions
    : []
}

export function hasPermission(user, permission) {
  if (!permission) return true
  if (["admin", "superadmin"].includes(user?.role)) return true
  const permissions = getUserPermissions(user)
  if (permissions.includes(permission)) return true
  if (String(permission).endsWith(":view")) {
    const moduleName = String(permission).replace(/:view$/, "")
    return permissions.some((item) => {
      const [itemModule, itemAction] = String(item).split(":")
      return itemModule === moduleName && itemAction && itemAction !== "view"
    })
  }
  if (String(permission).endsWith(".view")) {
    const moduleName = String(permission).replace(/\.view$/, "")
    return permissions.some((item) => {
      const [itemModule, itemAction] = String(item).split(".")
      return itemModule === moduleName && ["create", "update", "delete", "assign_employee", "report", "manage"].includes(itemAction)
    })
  }
  return false
}

export function filterSectionsByPermission(sections, user) {
  const next = {}

  Object.entries(sections || {}).forEach(([name, config]) => {
    const sectionAllowed = hasPermission(user, config?.permission)
    const subcategories = config?.subcategories

    if (subcategories) {
      const allowedSubcategories = {}
      Object.entries(subcategories).forEach(([subName, view]) => {
        const permission =
          config?.subcategoryPermissions?.[subName] || config?.permission
        if (hasPermission(user, permission)) allowedSubcategories[subName] = view
      })

      if (Object.keys(allowedSubcategories).length) {
        next[name] = { ...config, subcategories: allowedSubcategories }
      }
      return
    }

    if (sectionAllowed) next[name] = config
  })

  return next
}
