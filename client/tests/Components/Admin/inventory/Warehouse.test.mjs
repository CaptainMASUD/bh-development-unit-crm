import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadWarehousePage(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/Warehouse.jsx")
}

test("compact warehouse form produces the create API payload", async (t) => {
  const page = await loadWarehousePage(t)

  assert.equal(typeof page.buildWarehousePayload, "function")
  assert.deepEqual(
    page.buildWarehousePayload({
      code: " sw1 ",
      name: " Sub-Ware 1 ",
      physicalLocation: " Mughda, Dhaka ",
      manager: " manager-1 ",
      branch: " branch-1 ",
      status: "ACTIVE",
    }),
    {
      code: "SW1",
      name: "Sub-Ware 1",
      address: { addressLine1: "Mughda, Dhaka" },
      manager: "manager-1",
      branch: "branch-1",
      status: "active",
    }
  )
})

test("unchanged legacy address is omitted from an edit payload", async (t) => {
  const page = await loadWarehousePage(t)

  assert.deepEqual(
    page.buildWarehousePayload(
      { code: "CW", name: "Central", physicalLocation: "Dhaka, Bangladesh", manager: "", branch: "b1", status: "active" },
      { originalPhysicalLocation: "Dhaka, Bangladesh", editing: true }
    ),
    { code: "CW", name: "Central", manager: null, branch: "b1", status: "active" }
  )
})

test("warehouse filters combine search and status while excluding archived by default", async (t) => {
  const page = await loadWarehousePage(t)
  const warehouses = [
    { _id: "1", code: "CW", name: "Central Warehouse", address: { city: "Dhaka" }, manager: { name: "Masud" }, status: "active" },
    { _id: "2", code: "SW", name: "Sub-Ware", address: { city: "Mughda" }, manager: { name: "Imran" }, status: "inactive" },
    { _id: "3", code: "OLD", name: "Old Warehouse", status: "archived" },
  ]

  assert.deepEqual(page.filterWarehouses(warehouses, { query: "imran", status: "inactive" }).map((item) => item._id), ["2"])
  assert.deepEqual(page.filterWarehouses(warehouses, { query: "", status: "all" }).map((item) => item._id), ["1", "2"])
})

test("warehouse summary totals server-derived stock value", async (t) => {
  const page = await loadWarehousePage(t)
  const warehouses = [
    { _id: "1", stockValue: 2200, status: "active" },
    { _id: "2", stockValue: 0, status: "inactive" },
    { _id: "3", stockValue: 500, status: "archived" },
  ]

  assert.deepEqual(page.getWarehouseSummary(warehouses, 1), {
    totalRecords: 2,
    needsAttention: 1,
    totalValue: 2200,
    filteredResults: 1,
  })
})

test("warehouse pagination clamps an out-of-range page", async (t) => {
  const page = await loadWarehousePage(t)
  const warehouses = Array.from({ length: 12 }, (_, index) => ({ _id: String(index + 1) }))

  assert.deepEqual(page.paginateWarehouses(warehouses, 9, 5), {
    page: 3,
    totalPages: 3,
    start: 10,
    end: 12,
    rows: warehouses.slice(10, 12),
  })
})
