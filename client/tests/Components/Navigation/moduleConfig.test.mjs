import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadModuleConfig(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Navigation/moduleConfig.js")
}

test("Inventory exposes the approved sidebar hierarchy in order", async (t) => {
  const config = await loadModuleConfig(t)

  assert.deepEqual(config.MODULES.inventory.adminSections, [
    "Dashboard",
    "Inventory Items",
    "Item Profiles",
    "Product Management",
    "Warehouse Management",
    "Inventory Operations",
    "Quality Management",
    "Batch, Serial & Expiry",
    "Consumption History",
    "Inventory Valuation",
    "Inventory Loss Analysis",
    "Inventory Reports",
  ])

  assert.deepEqual(config.MODULES.inventory.employeeSections, config.MODULES.inventory.adminSections)
  assert.deepEqual(config.MODULES.inventory.subcategories, {
    "Product Management": ["Products", "Categories", "Units of Measure"],
    "Warehouse Management": ["Warehouses", "Scheduled Warehouse Checks", "Locations / Bins / Shelves"],
    "Inventory Operations": ["Stock Requests", "Stock Issues", "Stock Transfers", "Stock Adjustments", "Inventory Revaluations", "Stock Report"],
    "Quality Management": ["Quality Inspection", "Stock Inspection"],
    "Batch, Serial & Expiry": ["Batches / Lots", "Serial Numbers", "Expiry Management", "Low Stock Requests"],
  })
})

test("Manufacturing exposes the approved module and sidebar hierarchy", async (t) => {
  const config = await loadModuleConfig(t)

  assert.equal(config.MODULES.manufacturing.name, "Manufacturing")
  assert.deepEqual(config.MODULES.manufacturing.adminSections, [
    "Dashboard",
    "Planning",
    "Production",
    "Engineering",
    "Quality",
    "Maintenance",
    "Outsourcing",
    "Costing",
    "Reports",
  ])
  assert.deepEqual(config.MODULES.manufacturing.employeeSections, config.MODULES.manufacturing.adminSections)
  assert.deepEqual(config.MODULES.manufacturing.subcategories, {
    Planning: ["Production Plans", "MRP", "Production Schedule", "Capacity Planning"],
    Production: ["Manufacturing Orders", "Work Orders", "Material Issues", "Production Entries", "Shop Floor", "Work In Progress"],
    Engineering: ["Bill of Materials", "Routings", "Work Centers", "Machines"],
    Quality: ["Quality Inspections", "Non-Conformance", "Rework Orders", "Scrap & Wastage"],
    Maintenance: ["Maintenance Plans", "Maintenance Orders"],
    Outsourcing: ["Subcontracting"],
    Costing: ["Manufacturing Costing"],
    Reports: ["Manufacturing Reports"],
  })
})

test("Manufacturing is displayed as an Operations module card", async (t) => {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  const page = await server.ssrLoadModule("/src/Components/MainPage/MianPage.jsx")
  const manufacturing = page.moduleCards.find((item) => item.id === "manufacturing")

  assert.ok(manufacturing)
  assert.equal(manufacturing.name, "Manufacturing")
  assert.equal(manufacturing.category, "Operations")
  assert.equal(manufacturing.route, "/admin/manufacturing")
})

test("Manufacturing sidebar groups resolve to real Admin page components", async (t) => {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  const config = await server.ssrLoadModule("/src/Components/Navigation/moduleConfig.js")
  const registry = await server.ssrLoadModule("/src/Components/Admin/sections.jsx")
  const built = config.buildModuleSections(registry.sections, "manufacturing", "admin")

  assert.deepEqual(Object.keys(built), config.MODULES.manufacturing.adminSections)
  for (const [section, subcategories] of Object.entries(config.MODULES.manufacturing.subcategories)) {
    assert.deepEqual(Object.keys(built[section].subcategories), subcategories)
    assert.deepEqual(Object.keys(built[section].subcategoryPermissions), subcategories)
  }
})

test("Payroll exposes Departments and Positions directly in sidebar and excludes them from Setup", async (t) => {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  const config = await server.ssrLoadModule("/src/Components/Navigation/moduleConfig.js")
  const registry = await server.ssrLoadModule("/src/Components/Admin/sections.jsx")
  const built = config.buildModuleSections(registry.sections, "payroll", "admin")

  assert.deepEqual(config.MODULES.payroll.adminSections, [
    "Payroll Manager",
    "Employee",
    "Departments",
    "Positions",
    "Attendance",
    "Salary",
    "Employee Loans",
    "Leave Requests",
    "Setup",
  ])

  // Verify Departments & Positions are in built top-level sections
  assert.ok(built.Departments, "Departments should be a top-level section")
  assert.ok(built.Positions, "Positions should be a top-level section")

  // Verify Setup subcategories do NOT include Departments or Positions
  assert.deepEqual(config.MODULES.payroll.subcategories.Setup, [
    "Roster / Shift Setup",
    "Leave Setup",
    "Tax Setup",
  ])
  assert.deepEqual(Object.keys(built.Setup.subcategories), [
    "Roster / Shift Setup",
    "Leave Setup",
    "Tax Setup",
  ])

  // Verify routing for Departments, Positions, and Setup options
  const routes = await server.ssrLoadModule("/src/Components/Navigation/dashboardRoutes.js")
  const routeMap = routes.buildDashboardRouteMap("/admin/payroll", built)

  // Direct sidebar routes
  assert.equal(routeMap.reverse["Departments::"], "/admin/payroll/departments")
  assert.equal(routeMap.reverse["Positions::"], "/admin/payroll/positions")
  assert.equal(routeMap.reverse["Setup::Roster / Shift Setup"], "/admin/payroll/setup/roster-shift-setup")
  assert.equal(routeMap.reverse["Setup::Leave Setup"], "/admin/payroll/setup/leave-setup")
  assert.equal(routeMap.reverse["Setup::Tax Setup"], "/admin/payroll/setup/tax-setup")

  // URL matching
  assert.deepEqual(routes.matchDashboardRoute("/admin/payroll/departments", "/admin/payroll", routeMap), {
    section: "Departments",
    subcategory: "",
  })
  assert.deepEqual(routes.matchDashboardRoute("/admin/payroll/positions", "/admin/payroll", routeMap), {
    section: "Positions",
    subcategory: "",
  })
  assert.deepEqual(routes.matchDashboardRoute("/admin/payroll/setup/roster-shift-setup", "/admin/payroll", routeMap), {
    section: "Setup",
    subcategory: "Roster / Shift Setup",
  })
  assert.deepEqual(routes.matchDashboardRoute("/admin/payroll/departments-positions", "/admin/payroll", routeMap), {
    section: "Departments",
    subcategory: "",
  })
  assert.deepEqual(routes.matchDashboardRoute("/admin/payroll/departments-and-positions", "/admin/payroll", routeMap), {
    section: "Departments",
    subcategory: "",
  })
})

test("Administration exposes the approved feature order", async (t) => {
  const config = await loadModuleConfig(t)

  assert.deepEqual(config.MODULES.administration.adminSections, [
    "Dashboard",
    "Company Details",
    "System Defaults",
    "Document Numbering",
    "Audit Trail",
    "Role Management",
    "Departments",
    "Employee Access Control",
    "Add Employee",
    "Employee Account Control",
    "System Security Settings",
  ])
})

test("Administration resolves all approved sections and identifies real Phase 1 pages", async (t) => {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  const config = await server.ssrLoadModule("/src/Components/Navigation/moduleConfig.js")
  const registry = await server.ssrLoadModule("/src/Components/Admin/sections.jsx")
  const built = config.buildModuleSections(registry.sections, "administration", "admin")

  assert.deepEqual(Object.keys(built), config.MODULES.administration.adminSections)
  assert.equal(built.Dashboard.permission, "administration-dashboard:view")
  assert.equal(built["Company Details"].permission, "company:view")
  assert.equal(built["System Defaults"].permission, "system-settings:view")
  assert.equal(built.Dashboard.comingSoon, undefined)
  assert.equal(built["Company Details"].comingSoon, undefined)
  assert.equal(built["System Defaults"].comingSoon, undefined)

  for (const name of config.MODULES.administration.adminSections.slice(3)) {
    assert.equal(built[name].comingSoon, true, `${name} must be an honest upcoming feature`)
    assert.ok(built[name].component)
  }
})

