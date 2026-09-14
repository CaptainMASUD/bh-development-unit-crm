import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function createTestServer(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server
}

test("InventoryValuation.jsx loads via Vite SSR without import or syntax errors", async (t) => {
  const server = await createTestServer(t)
  const valuationModule = await server.ssrLoadModule(
    "/src/Components/Admin/inventory/InventoryValuation.jsx"
  )
  assert.equal(typeof valuationModule.default, "function")
})

test("InventoryReports.jsx loads via Vite SSR and exports default hub component", async (t) => {
  const server = await createTestServer(t)
  const reportsModule = await server.ssrLoadModule(
    "/src/Components/Admin/inventory/InventoryReports.jsx"
  )
  assert.equal(typeof reportsModule.default, "function")
  assert.deepEqual(
    reportsModule.getInventoryReportAccess({
      role: "employee",
      permissions: [
        "inventory-report:view",
        "inventory-reconciliation:view",
      ],
    }),
    {
      canViewCost: false,
      canViewGlReconciliation: true,
      canExport: false,
    }
  )
  assert.equal(
    reportsModule.canExportInventoryReport(
      {
        role: "employee",
        permissions: [
          "inventory-report:export",
          "inventory-reconciliation:view",
        ],
      },
      "gl-reconciliation"
    ),
    false,
    "GL export must not expose monetary values without cost-view permission"
  )
})

test("AccountingSettings exposes the inventory revaluation gain/loss account", async (t) => {
  const server = await createTestServer(t)
  const settingsModule = await server.ssrLoadModule(
    "/src/Components/Admin/accounting/AccountingSettings.jsx"
  )
  assert.ok(
    settingsModule.ACCOUNT_FIELDS.some(
      ([key, label]) =>
        key === "inventoryRevaluationAccount" &&
        label === "Inventory Revaluation Gain / Loss"
    )
  )
})

test("InventoryDashboard.jsx loads via Vite SSR with cost view protection", async (t) => {
  const server = await createTestServer(t)
  const dashboardModule = await server.ssrLoadModule(
    "/src/Components/Admin/inventory/InventoryDashboard.jsx"
  )
  assert.equal(typeof dashboardModule.default, "function")
})

test("StockLedgerReport.jsx loads via Vite SSR and exports ledger component", async (t) => {
  const server = await createTestServer(t)
  const ledgerModule = await server.ssrLoadModule(
    "/src/Components/Admin/inventory/StockLedgerReport.jsx"
  )
  assert.equal(typeof ledgerModule.default, "function")
})

test("StockTransfers.jsx and StockMovements.jsx load via Vite SSR cleanly", async (t) => {
  const server = await createTestServer(t)
  const [transfersModule, movementsModule] = await Promise.all([
    server.ssrLoadModule("/src/Components/Admin/inventory/StockTransfers.jsx"),
    server.ssrLoadModule("/src/Components/Admin/inventory/StockMovements.jsx"),
  ])
  assert.equal(typeof transfersModule.default, "function")
  assert.equal(typeof movementsModule.default, "function")
})

test("BatchLots, ExpiryTracking, SerialNumbers load via Vite SSR cleanly", async (t) => {
  const server = await createTestServer(t)
  const [batchModule, expiryModule, serialModule] = await Promise.all([
    server.ssrLoadModule("/src/Components/Admin/inventory/BatchLots.jsx"),
    server.ssrLoadModule("/src/Components/Admin/inventory/ExpiryTracking.jsx"),
    server.ssrLoadModule("/src/Components/Admin/inventory/SerialNumbers.jsx"),
  ])
  assert.equal(typeof batchModule.default, "function")
  assert.equal(typeof expiryModule.default, "function")
  assert.equal(typeof serialModule.default, "function")
})

test("WarehouseLocation CSV export sanitizes spreadsheet formula triggers", async (t) => {
  const server = await createTestServer(t)
  const whModule = await server.ssrLoadModule(
    "/src/Components/Admin/inventory/WarehouseLocation.jsx"
  )
  assert.equal(typeof whModule.default, "function")
  assert.equal(typeof whModule.getWarehouseLocationSummary, "function")

  // Test summary calculations
  const rows = [
    { warehouse: { name: "WH1" }, availabilityStatus: "available" },
    { warehouse: { name: "WH1" }, availabilityStatus: "unavailable" },
    { warehouse: { name: "WH2" }, availabilityStatus: "insufficient" },
  ]
  const summary = whModule.getWarehouseLocationSummary(rows, 3)
  assert.equal(summary.totalRecords, 3)
  assert.equal(summary.needsAttention, 2)
})
