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

test("Manage Proposals keeps its requested tab while a different lead is still loaded", async (t) => {
  const server = await createViteServer(t)
  const { resolveLeadDetailTab } = await server.ssrLoadModule("/src/Components/Admin/crm/AdminLeadPage.jsx")

  assert.equal(typeof resolveLeadDetailTab, "function")
  assert.equal(
    resolveLeadDetailTab("proposals", { _id: "previous-lead", pipelineStage: "new" }, "target-lead", ["overview", "timeline"]),
    "proposals",
  )
  assert.equal(
    resolveLeadDetailTab("proposals", { _id: "target-lead", pipelineStage: "proposal" }, "target-lead", ["overview", "proposals"]),
    "proposals",
  )
  assert.equal(
    resolveLeadDetailTab("proposals", { _id: "target-lead", pipelineStage: "new" }, "target-lead", ["overview", "timeline"]),
    "overview",
  )
})

test("getQuotationActionItem enforces strict stage and requirement workflow rules", async (t) => {
  const server = await createViteServer(t)
  const { getQuotationActionItem } = await server.ssrLoadModule("/src/Components/Admin/crm/AdminLeadPage.jsx")

  // 1. Stage new or qualified -> disabled with discovery requirement
  const newLead = { pipelineStage: "new" }
  const [newKey, newLabel, , newDisabled, newHelper] = getQuotationActionItem(newLead)
  assert.equal(newKey, "salesQuotation")
  assert.equal(newLabel, "Create Quotation")
  assert.equal(newDisabled, true)
  assert.equal(newHelper, "Complete discovery before creating quotations.")

  const qualifiedLead = { pipelineStage: "qualified" }
  const [, , , qualDisabled, qualHelper] = getQuotationActionItem(qualifiedLead)
  assert.equal(qualDisabled, true)
  assert.equal(qualHelper, "Complete discovery before creating quotations.")

  // 2. Stage discovery without requirements -> disabled
  const discIncomplete = {
    pipelineStage: "discovery",
    requirement: { expectedValue: 1000 } // missing clientRequirement, painPoints, expectedSolution
  }
  const [discKey, discLabel, , discDisabled, discHelper] = getQuotationActionItem(discIncomplete)
  assert.equal(discKey, "salesQuotation")
  assert.equal(discLabel, "Create Quotation")
  assert.equal(discDisabled, true)
  assert.equal(discHelper, "Fill requirements first to unlock quotation.")

  // 3. Stage discovery with complete requirements -> enabled
  const discComplete = {
    pipelineStage: "discovery",
    requirement: {
      summary: "Accounting and Sales ERP",
      expectedSolution: "Automated invoice and inventory",
      timeline: "Immediate",
      decisionMaker: "Managing Director"
    }
  }
  const [discCompKey, discCompLabel, , discCompDisabled, discCompHelper] = getQuotationActionItem(discComplete)
  assert.equal(discCompKey, "salesQuotation")
  assert.equal(discCompLabel, "Create Quotation")
  assert.equal(discCompDisabled, false)
  assert.equal(discCompHelper, "Create sales quotation in Sales module")

  // 4. Stage proposal with 0 quotations -> enabled Create Quotation
  const propNoQuote = {
    pipelineStage: "proposal",
    proposalCount: 0
  }
  const [pKey, pLabel, , pDisabled, pHelper] = getQuotationActionItem(propNoQuote, { proposals: [], quotations: [] })
  assert.equal(pKey, "salesQuotation")
  assert.equal(pLabel, "Create Quotation")
  assert.equal(pDisabled, false)
  assert.equal(pHelper, "Create sales quotation in Sales module")

  // 5. Stage proposal with >= 1 quotation -> Manage Quotations
  const propWithQuote = {
    pipelineStage: "proposal",
    proposalCount: 1
  }
  const [mKey, mLabel, , mDisabled, mHelper] = getQuotationActionItem(propWithQuote, { quotations: [{ _id: "q1" }] })
  assert.equal(mKey, "manageProposal")
  assert.equal(mLabel, "Manage Quotations")
  assert.equal(mDisabled, false)
  assert.equal(mHelper, "View linked quotations and proposals in Proposals tab")

  // 6. Stage negotiation with >= 1 quotation -> Manage Quotations
  const negWithQuote = {
    pipelineStage: "negotiation",
    proposalCount: 1
  }
  const [nKey, nLabel, , nDisabled] = getQuotationActionItem(negWithQuote, { quotations: [{ _id: "q1" }] })
  assert.equal(nKey, "manageProposal")
  assert.equal(nLabel, "Manage Quotations")
  assert.equal(nDisabled, false)

  // 7. Stage won -> Manage Quotations
  const wonLead = { pipelineStage: "won" }
  const [wKey, wLabel, , wDisabled] = getQuotationActionItem(wonLead)
  assert.equal(wKey, "manageProposal")
  assert.equal(wLabel, "Manage Quotations")
  assert.equal(wDisabled, false)

  // 8. Stage lost -> disabled
  const lostLead = { pipelineStage: "lost" }
  const [lKey, lLabel, , lDisabled, lHelper] = getQuotationActionItem(lostLead)
  assert.equal(lKey, "salesQuotation")
  assert.equal(lLabel, "Create Quotation")
  assert.equal(lDisabled, true)
  assert.equal(lHelper, "Lead is closed as lost.")

  // 9. Permission denied when canManageSalesQuotation = false
  const [deniedKey, , , deniedDisabled, deniedHelper] = getQuotationActionItem(
    discComplete,
    null,
    false,
    false,
    "Requires sales-quotation:manage permission."
  )
  assert.equal(deniedKey, "salesQuotation")
  assert.equal(deniedDisabled, true)
  assert.equal(deniedHelper, "Requires sales-quotation:manage permission.")
})
