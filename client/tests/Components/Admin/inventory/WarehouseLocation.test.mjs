import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadPage(t) {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/WarehouseLocation.jsx")
}

const locations = [
  { _id: "1", warehouse: { _id: "w1", name: "Central Warehouse" }, code: "A-01", name: "Rack 1", zone: "A", rack: "01", shelf: "", currentProduct: { name: "Ball Pen" }, quantity: 40, availabilityStatus: "available", status: "active" },
  { _id: "2", warehouse: { _id: "w1", name: "Central Warehouse" }, code: "A-02", name: "Shelf 12", zone: "A", rack: "02", shelf: "12", currentProduct: { name: "Tissue Paper" }, quantity: 18, availabilityStatus: "insufficient", status: "active" },
  { _id: "3", warehouse: { _id: "w2", name: "Sub-Ware 1" }, code: "B-01", name: "Bin 1", quantity: 0, availabilityStatus: "unavailable", status: "inactive" },
]

test("location summary totals quantity and attention statuses", async (t) => {
  const page = await loadPage(t)
  assert.equal(typeof page.getWarehouseLocationSummary, "function")
  assert.deepEqual(page.getWarehouseLocationSummary(locations, 2), { totalRecords: 3, needsAttention: 2, totalQuantity: 58, filteredResults: 2 })
})

test("warehouse tabs retain zero-count active warehouses", async (t) => {
  const page = await loadPage(t)
  const warehouses = [{ _id: "w1", name: "Central Warehouse" }, { _id: "w2", name: "Sub-Ware 1" }, { _id: "w3", name: "Overflow" }]
  assert.equal(typeof page.buildWarehouseLocationTabs, "function")
  assert.deepEqual(page.buildWarehouseLocationTabs(warehouses, locations), [
    { id: "all", name: "All Warehouses", count: 3 },
    { id: "w1", name: "Central Warehouse", count: 2 },
    { id: "w2", name: "Sub-Ware 1", count: 1 },
    { id: "w3", name: "Overflow", count: 0 },
  ])
})

test("location filters combine warehouse, derived status, and product search", async (t) => {
  const page = await loadPage(t)
  assert.equal(typeof page.filterWarehouseLocations, "function")
  assert.deepEqual(page.filterWarehouseLocations(locations, { warehouse: "w1", status: "insufficient", query: "tissue" }).map((row) => row._id), ["2"])
})

test("location pagination clamps an out-of-range page", async (t) => {
  const page = await loadPage(t)
  const rows = Array.from({ length: 12 }, (_, index) => ({ _id: String(index + 1) }))
  assert.equal(typeof page.paginateWarehouseLocations, "function")
  assert.deepEqual(page.paginateWarehouseLocations(rows, 8, 5), { page: 3, totalPages: 3, start: 10, end: 12, rows: rows.slice(10) })
})
