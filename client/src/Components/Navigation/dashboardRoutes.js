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

  // Add alias routes for Departments & Positions
  if (routes[`${basePath}/departments`]) {
    routes[`${basePath}/departments-positions`] = routes[`${basePath}/departments`]
    routes[`${basePath}/departments-and-positions`] = routes[`${basePath}/departments`]
  }

  return { routes, reverse }
}

export function matchDashboardRoute(pathname, basePath, routeMap) {
  const cleanPath = pathname.replace(/\/+$/, "") || "/"
  if (routeMap.routes[cleanPath]) return routeMap.routes[cleanPath]

  if (cleanPath === `${basePath}/departments-positions` || cleanPath === `${basePath}/departments-and-positions`) {
    if (routeMap.routes[`${basePath}/departments`]) return routeMap.routes[`${basePath}/departments`]
    if (routeMap.routes[`${basePath}/departments-and-positions`]) return routeMap.routes[`${basePath}/departments-and-positions`]
  }

  const segments = cleanPath.slice(basePath.length).split("/").filter(Boolean)
  if (basePath.startsWith("/admin") && segments[0] === "clients" && segments[1]) {
    return {
      section: "Clients",
      subcategory: "Clients",
      customerId: segments[1],
      customerTab: segments[2] === "crm" ? "crm" : "overview",
    }
  }
  if (basePath.startsWith("/admin") && segments[0] === "client-tasks" && segments[1]) {
    return {
      section: "Clients",
      subcategory: "Client Tasks",
      customerId: segments[1],
    }
  }
  if (basePath.startsWith("/employee") && ["customers", "clients"].includes(segments[0]) && segments[1]) {
    return {
      section: "Clients",
      subcategory: "",
      customerId: segments[1],
      customerTab: "overview",
    }
  }

  return routeMap.routes[basePath] || Object.values(routeMap.routes || {})[0] || { section: "", subcategory: "" }
}
