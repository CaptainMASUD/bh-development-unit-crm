export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",
  LEADS_VIEW: "leads:view",
  LEADS_MANAGE: "leads:manage",
  DEALS_VIEW: "deals:view",
  DEALS_MANAGE: "deals:manage",
  TASKS_VIEW: "tasks:view",
  TASKS_MANAGE: "tasks:manage",
  REPORTS_VIEW: "reports:view",
  ATTENDANCE_VIEW: "attendance:view",
  ATTENDANCE_MANAGE: "attendance:manage",
  PAYROLL_VIEW: "payroll:view",
  PAYROLL_MANAGE: "payroll:manage",
  LOANS_VIEW: "loans:view",
  LOANS_MANAGE: "loans:manage",
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
    return permissions.includes(String(permission).replace(/:view$/, ":manage"))
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
