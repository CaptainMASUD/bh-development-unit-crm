import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

const mappings = [
  ["ConsumptionReport", "InventoryReports"],
  ["LowStockReport", "InventoryReports"],
  ["ExpiryReport", "ExpiryTracking"],
  ["LossAnalysisReport", "InventoryLossAnalysis"],
  ["WarehouseInventory", "StockBalanceReport"],
  ["WarehouseStockReport", "StockBalanceReport"],
]

test("exact legacy duplicates resolve to their themed canonical modules", async (t) => {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  for (const [legacy, canonical] of mappings) {
    const legacyModule = await server.ssrLoadModule(`/src/Components/Admin/inventory/${legacy}.jsx`)
    const canonicalModule = await server.ssrLoadModule(`/src/Components/Admin/inventory/${canonical}.jsx`)
    assert.equal(legacyModule.default, canonicalModule.default, `${legacy} should re-export ${canonical}`)
  }
})
