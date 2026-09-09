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
    "Inventory Operations": ["Stock Requests", "Stock Issues", "Stock Transfers", "Stock Adjustments", "Stock Report"],
    "Quality Management": ["Quality Inspection", "Stock Inspection"],
    "Batch, Serial & Expiry": ["Batches / Lots", "Serial Numbers", "Expiry Management", "Low Stock Requests"],
  })
})
