import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "esbuild"

async function loadModuleConfig() {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "bh-module-config-"))
  const outputFile = path.join(outputDirectory, "moduleConfig.mjs")

  await build({
    entryPoints: [fileURLToPath(new URL("./moduleConfig.js", import.meta.url))],
    outfile: outputFile,
    bundle: true,
    format: "esm",
    platform: "node",
  })

  return {
    config: await import(`${pathToFileURL(outputFile).href}?${Date.now()}`),
    cleanup: () => rm(outputDirectory, { recursive: true, force: true }),
  }
}

test("Inventory exposes the approved sidebar hierarchy in order", async (t) => {
  const { config, cleanup } = await loadModuleConfig()
  t.after(cleanup)

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
