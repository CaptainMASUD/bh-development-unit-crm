export const PERMISSIONS = {
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  DASHBOARD_VIEW: "dashboard:view",
  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",
  LEADS_VIEW: "leads:view",
  LEADS_MANAGE: "leads:manage",
  DEALS_VIEW: "deals:view",
  DEALS_MANAGE: "deals:manage",
  FINANCE_VIEW: "finance:view",
  FINANCE_MANAGE: "finance:manage",
  COST_CENTER_VIEW: "finance:cost-center:view",
  COST_CENTER_MANAGE: "finance:cost-center:manage",
  DIMENSION_VIEW: "finance:dimension:view",
  DIMENSION_MANAGE: "finance:dimension:manage",
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
  INVENTORY_REPORT_EXPORT: "inventory-report:export",
  INVENTORY_REPORT_COST_VIEW: "inventory-report:cost-view",
  INVENTORY_RECONCILIATION_VIEW: "inventory-reconciliation:view",
  SUPPLIER_VIEW: "supplier:view",
  SUPPLIER_MANAGE: "supplier:manage",
  SUPPLIER_APPROVE: "supplier:approve",
  SUPPLIER_DELETE: "supplier:delete",
  PURCHASE_ORDER_VIEW: "purchase-order:view",
  PURCHASE_ORDER_MANAGE: "purchase-order:manage",
  PURCHASE_ORDER_APPROVE: "purchase-order:approve",
  PURCHASE_ORDER_DELETE: "purchase-order:delete",
  GOODS_RECEIPT_VIEW: "goods-receipt:view",
  GOODS_RECEIPT_MANAGE: "goods-receipt:manage",
  GOODS_RECEIPT_APPROVE: "goods-receipt:approve",
  GOODS_RECEIPT_POST: "goods-receipt:post",
  GOODS_RECEIPT_REVERSE: "goods-receipt:reverse",
  GOODS_RECEIPT_DELETE: "goods-receipt:delete",
  PURCHASE_RETURN_VIEW: "purchase-return:view",
  PURCHASE_RETURN_MANAGE: "purchase-return:manage",
  PURCHASE_RETURN_APPROVE: "purchase-return:approve",
  PURCHASE_RETURN_POST: "purchase-return:post",
  PURCHASE_RETURN_REVERSE: "purchase-return:reverse",
  PURCHASE_RETURN_DELETE: "purchase-return:delete",
  COMMERCIAL_LC_VIEW: "commercial-lc:view",
  COMMERCIAL_LC_MANAGE: "commercial-lc:manage",
  COMMERCIAL_LC_APPROVE: "commercial-lc:approve",
  COMMERCIAL_LC_OPEN: "commercial-lc:open",
  COMMERCIAL_LC_AMEND: "commercial-lc:amend",
  COMMERCIAL_LC_SETTLE: "commercial-lc:settle",
  COMMERCIAL_LC_CLOSE: "commercial-lc:close",
  PURCHASE_REQUEST_VIEW: "purchase-request:view",
  PURCHASE_REQUEST_MANAGE: "purchase-request:manage",
  PURCHASE_REQUEST_APPROVE: "purchase-request:approve",
  PURCHASE_ANALYSIS_VIEW: "purchase-analysis:view",
  PURCHASE_ANALYSIS_MANAGE: "purchase-analysis:manage",
  PURCHASE_ISSUE_VIEW: "purchase-issue:view",
  PURCHASE_ISSUE_MANAGE: "purchase-issue:manage",
  PURCHASE_QUALITY_VIEW: "purchase-quality:view",
  PURCHASE_QUALITY_MANAGE: "purchase-quality:manage",
  PURCHASE_DUE_VIEW: "purchase-due:view",
  PURCHASE_DUE_PAY: "purchase-due:pay",
  PRICE_ANALYSIS_VIEW: "price-analysis:view",
  PRICE_ANALYSIS_REVIEW: "price-analysis:review",
  PURCHASE_TYPE_VIEW: "purchase-type:view",
  PURCHASE_TYPE_MANAGE: "purchase-type:manage",
  SALES_QUOTATION_VIEW: "sales-quotation:view",
  SALES_QUOTATION_MANAGE: "sales-quotation:manage",
  SALES_ORDER_VIEW: "sales-order:view",
  SALES_ORDER_MANAGE: "sales-order:manage",
  SALES_ORDER_APPROVE: "sales-order:approve",
  SALES_DELIVERY_VIEW: "sales-delivery:view",
  SALES_DELIVERY_MANAGE: "sales-delivery:manage",
  SALES_DELIVERY_POST: "sales-delivery:post",
  SALES_INVOICE_VIEW: "sales-invoice:view",
  SALES_INVOICE_MANAGE: "sales-invoice:manage",
  SALES_INVOICE_POST: "sales-invoice:post",
  SALES_PAYMENT_MANAGE: "sales-payment:manage",
  SALES_RETURN_VIEW: "sales-return:view",
  SALES_RETURN_MANAGE: "sales-return:manage",
  SALES_RETURN_APPROVE: "sales-return:approve",
  SALES_REPORT_VIEW: "sales-report:view",
  COMPANY_VIEW: "company:view",
  COMPANY_MANAGE: "company:manage",
  BRANCH_VIEW: "branch:view",
  BRANCH_MANAGE: "branch:manage",
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
