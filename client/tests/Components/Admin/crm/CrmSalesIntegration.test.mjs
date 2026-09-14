import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function createViteServer(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server
}

test("Sales routes resolve correctly for admin and employee roles", async (t) => {
  const server = await createViteServer(t)
  const moduleConfig = await server.ssrLoadModule("/src/Components/Navigation/moduleConfig.js")

  assert.equal(moduleConfig.getModuleBasePath("admin", "sales"), "/admin/sales")
  assert.equal(moduleConfig.getModuleBasePath("employee", "sales"), "/employee/sales")
  assert.equal(moduleConfig.getModuleBasePath("superadmin", "sales"), "/admin/sales")

  // Sales quotation subroute
  const adminQuotationRoute = `${moduleConfig.getModuleBasePath("admin", "sales")}/sales-quotations`
  const employeeQuotationRoute = `${moduleConfig.getModuleBasePath("employee", "sales")}/sales-quotations`

  assert.equal(adminQuotationRoute, "/admin/sales/sales-quotations")
  assert.equal(employeeQuotationRoute, "/employee/sales/sales-quotations")

  // Sales order subroute
  const adminOrderRoute = `${moduleConfig.getModuleBasePath("admin", "sales")}/sales-orders`
  const employeeOrderRoute = `${moduleConfig.getModuleBasePath("employee", "sales")}/sales-orders`

  assert.equal(adminOrderRoute, "/admin/sales/sales-orders")
  assert.equal(employeeOrderRoute, "/employee/sales/sales-orders")
})

test("Sales quotation and sales permissions are defined and enforced properly", async (t) => {
  const server = await createViteServer(t)
  const permissions = await server.ssrLoadModule("/src/Components/Auth/permissions.js")

  assert.equal(permissions.PERMISSIONS.SALES_QUOTATION_VIEW, "sales-quotation:view")
  assert.equal(permissions.PERMISSIONS.SALES_QUOTATION_MANAGE, "sales-quotation:manage")
  assert.equal(permissions.PERMISSIONS.SALES_ORDER_VIEW, "sales-order:view")
  assert.equal(permissions.PERMISSIONS.SALES_ORDER_MANAGE, "sales-order:manage")

  // Admin has permission automatically
  assert.equal(permissions.hasPermission({ role: "admin" }, permissions.PERMISSIONS.SALES_QUOTATION_MANAGE), true)
  assert.equal(permissions.hasPermission({ role: "superadmin" }, permissions.PERMISSIONS.SALES_QUOTATION_MANAGE), true)

  // Employee without permission
  assert.equal(permissions.hasPermission({ role: "employee", permissionGroup: { permissions: ["leads:view"] } }, permissions.PERMISSIONS.SALES_QUOTATION_MANAGE), false)

  // Employee with quotation permission
  assert.equal(permissions.hasPermission({ role: "employee", permissionGroup: { permissions: ["sales-quotation:manage"] } }, permissions.PERMISSIONS.SALES_QUOTATION_MANAGE), true)
})

test("AdminLeadPage, AdminDealsPage, and SalesPage load cleanly via Vite SSR", async (t) => {
  const server = await createViteServer(t)

  const leadPageModule = await server.ssrLoadModule("/src/Components/Admin/crm/AdminLeadPage.jsx")
  assert.ok(leadPageModule.default, "AdminLeadPage exports a default component")

  const dealsPageModule = await server.ssrLoadModule("/src/Components/Admin/crm/AdminDealsPage.jsx")
  assert.ok(dealsPageModule.default, "AdminDealsPage exports a default component")

  const salesPageModule = await server.ssrLoadModule("/src/Components/Admin/sales/SalesPage.jsx")
  assert.ok(salesPageModule.default, "SalesPage exports a default component")
})
