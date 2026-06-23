const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export function buildDashboardRouteMap(basePath, sections) {
  const routes = {}
  const reverse = {}

  Object.entries(sections || {}).forEach(([sectionName, config]) => {
    const sectionSlug = sectionName === "Dashboard" ? "" : slugify(sectionName)
    const sectionPath = sectionSlug ? `${basePath}/${sectionSlug}` : basePath
    routes[sectionPath] = { section: sectionName, subcategory: "" }
    reverse[`${sectionName}::`] = sectionPath

    Object.keys(config?.subcategories || {}).forEach((subcategory) => {
      const path = `${basePath}/${sectionSlug}/${slugify(subcategory)}`
      routes[path] = { section: sectionName, subcategory }
      reverse[`${sectionName}::${subcategory}`] = path
    })
  })

  return { routes, reverse }
}

export function matchDashboardRoute(pathname, basePath, routeMap) {
  const cleanPath = pathname.replace(/\/+$/, "") || "/"
  if (routeMap.routes[cleanPath]) return routeMap.routes[cleanPath]

  const segments = cleanPath.slice(basePath.length).split("/").filter(Boolean)
  if (basePath === "/admin" && segments[0] === "clients" && segments[1]) {
    return {
      section: "Clients",
      subcategory: "Clients",
      customerId: segments[1],
      customerTab: segments[2] === "crm" ? "crm" : "overview",
    }
  }
  if (basePath === "/admin" && segments[0] === "client-tasks" && segments[1]) {
    return {
      section: "Clients",
      subcategory: "Client Tasks",
      customerId: segments[1],
    }
  }
  if (basePath === "/employee" && segments[0] === "customers" && segments[1]) {
    return {
      section: "Customers",
      subcategory: "",
      customerId: segments[1],
      customerTab: "overview",
    }
  }

  return routeMap.routes[basePath] || { section: "Dashboard", subcategory: "" }
}
