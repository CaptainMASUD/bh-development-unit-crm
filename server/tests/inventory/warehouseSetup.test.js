import assert from "node:assert/strict"
import test from "node:test"

import { attachWarehouseStockValues } from "../../controllers/inventory/warehouse.controller.js"

test("warehouse list records receive their aggregated stock value", () => {
  const warehouses = [{ _id: "w1", name: "Central" }, { _id: "w2", name: "Sub-Ware" }]
  const summaries = [{ _id: "w1", stockValue: 2200.125 }]

  assert.deepEqual(attachWarehouseStockValues(warehouses, summaries), [
    { _id: "w1", name: "Central", stockValue: 2200.13 },
    { _id: "w2", name: "Sub-Ware", stockValue: 0 },
  ])
})
