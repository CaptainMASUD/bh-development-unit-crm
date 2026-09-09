import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const inventoryDir = fileURLToPath(new URL("../../../../src/Components/Admin/inventory", import.meta.url))
const sections = fs.readFileSync(path.resolve(inventoryDir, "../sections.jsx"), "utf8")
const css = fs.readFileSync(path.join(inventoryDir, "inventory-theme.css"), "utf8")

test("all current inventory page entries are covered by the shared theme system", () => {
  const pages = fs.readdirSync(inventoryDir).filter((name) => name.endsWith(".jsx") && name !== "InventoryUI.jsx")
  assert.equal(pages.length, 35)

  const routed = [
    "InventoryDashboard", "TotalInventory", "ItemProfiles", "Products", "ProductCategories",
    "InventoryUnits", "Warehouses", "WarehouseChecks", "WarehouseLocations", "StockRequests",
    "StockIssues", "StockTransfers", "StockAdjustments", "StockBalanceReport", "PurchaseQualityInspections",
    "StockInspection", "BatchLots", "SerialNumbers", "ExpiryTracking", "LowStock", "ConsumptionHistory",
    "InventoryValuation", "InventoryLossAnalysis", "InventoryReports",
  ]
  for (const component of routed) assert.match(sections, new RegExp(`withInventoryTheme\\(<${component} \\/>\\)`))

  for (const legacy of ["ConsumptionReport", "LowStockReport", "ExpiryReport", "LossAnalysisReport", "WarehouseInventory", "WarehouseStockReport"]) {
    assert.match(fs.readFileSync(path.join(inventoryDir, `${legacy}.jsx`), "utf8"), /^export \{ default \} from /)
  }
})

test("compatibility styles cover page headers, controls, tables, modals, and responsive layout", () => {
  for (const marker of [
    "data-inventory-page-header", "input:not", "bg-blue-600", "table thead", "table tbody tr:hover",
    "role=\"dialog\"", "max-width: 1500px", "@media (max-width: 640px)",
  ]) assert.ok(css.includes(marker), `Missing scoped Inventory theme marker: ${marker}`)
})
