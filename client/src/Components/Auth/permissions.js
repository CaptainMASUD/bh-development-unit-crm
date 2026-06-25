export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",
  CUSTOMERS_VIEW: "customers:view",
  CUSTOMERS_MANAGE: "customers:manage",
  LEADS_VIEW: "leads:view",
  LEADS_MANAGE: "leads:manage",
  DEALS_VIEW: "deals:view",
  DEALS_MANAGE: "deals:manage",
  REPORTS_VIEW: "reports:view",
  WORKFLOW_VIEW: "workflow:view",
  PROFILE_VIEW: "profile:view",
}

export function getUserPermissions(user) {
  return Array.isArray(user?.permissionGroup?.permissions)
    ? user.permissionGroup.permissions
    : []
}

export function hasPermission(user, permission) {
  if (!permission) return true
  if (["admin", "superadmin"].includes(user?.role)) return true
  return getUserPermissions(user).includes(permission)
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
