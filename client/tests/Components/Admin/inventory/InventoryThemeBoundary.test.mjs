import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const source = fs.readFileSync(new URL("../../../../src/Components/Admin/sections.jsx", import.meta.url), "utf8")

test("admin sections scope the shared theme to every inventory route", () => {
  assert.match(source, /import \{ InventoryThemeBoundary \} from "\.\/inventory\/InventoryUI"/)
  assert.match(source, /const withInventoryTheme = \(component\) => \(/)

  const routedComponents = [
    "InventoryDashboard", "TotalInventory", "ItemProfiles", "Products", "ProductCategories",
    "InventoryUnits", "Warehouses", "WarehouseChecks", "WarehouseLocations", "StockRequests",
    "StockIssues", "StockTransfers", "StockAdjustments", "StockBalanceReport",
    "PurchaseQualityInspections", "StockInspection", "BatchLots", "SerialNumbers", "ExpiryTracking",
    "LowStock", "ConsumptionHistory", "InventoryValuation", "InventoryLossAnalysis", "InventoryReports",
  ]

  for (const component of routedComponents) {
    assert.match(source, new RegExp(`withInventoryTheme\\(<${component} \\/>\\)`), `${component} must be theme-scoped`)
  }

  assert.doesNotMatch(source, /Leads:[\s\S]{0,120}withInventoryTheme/)
  assert.doesNotMatch(source, /Suppliers:[\s\S]{0,120}withInventoryTheme/)
})
