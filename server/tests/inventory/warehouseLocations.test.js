import assert from "node:assert/strict"
import test from "node:test"

import * as controller from "../../controllers/inventory/warehouseLocation.controller.js"

test("location rows aggregate quantity and expose one assigned product", () => {
  assert.equal(typeof controller.attachWarehouseLocationStockDetails, "function")
  const locations = [{ _id: "l1", status: "active", name: "A-01" }]
  const stock = [{ location: "l1", onHandQuantity: 40, availableQuantity: 40, minimumStock: 10, status: "active", product: { _id: "p1", name: "Ball Pen", sku: "ST1" } }]

  assert.deepEqual(controller.attachWarehouseLocationStockDetails(locations, stock), [{
    _id: "l1",
    status: "active",
    name: "A-01",
    zone: "—",
    rack: "—",
    shelf: "—",
    quantity: 40,
    currentProduct: { _id: "p1", name: "Ball Pen", sku: "ST1" },
    productCount: 1,
    availabilityStatus: "available",
  }])
})

test("location becomes insufficient when an assigned product reaches minimum stock", () => {
  assert.equal(typeof controller.attachWarehouseLocationStockDetails, "function")
  const locations = [{ _id: "l1", status: "active" }]
  const stock = [{ location: "l1", onHandQuantity: 5, availableQuantity: 5, minimumStock: 5, status: "active", product: { _id: "p1", name: "Tea", sku: "FI1" } }]

  assert.equal(controller.attachWarehouseLocationStockDetails(locations, stock)[0].availabilityStatus, "insufficient")
})

test("inactive or empty locations are unavailable", () => {
  assert.equal(typeof controller.attachWarehouseLocationStockDetails, "function")
  const rows = controller.attachWarehouseLocationStockDetails([{ _id: "l1", status: "inactive" }, { _id: "l2", status: "active" }], [])

  assert.deepEqual(rows.map((row) => row.availabilityStatus), ["unavailable", "unavailable"])
})

test("shared bins expose a multiple-products label and summed quantity", () => {
  assert.equal(typeof controller.attachWarehouseLocationStockDetails, "function")
  const locations = [{ _id: "l1", status: "active" }]
  const stock = [
    { location: "l1", onHandQuantity: 10, availableQuantity: 10, minimumStock: 2, status: "active", product: { _id: "p1", name: "Pen" } },
    { location: "l1", onHandQuantity: 8, availableQuantity: 8, minimumStock: 2, status: "active", product: { _id: "p2", name: "Paper" } },
  ]

  assert.deepEqual(controller.attachWarehouseLocationStockDetails(locations, stock)[0], {
    _id: "l1",
    status: "active",
    zone: "—",
    rack: "—",
    shelf: "—",
    quantity: 18,
    currentProduct: { _id: null, name: "Multiple Products", sku: "" },
    productCount: 2,
    availabilityStatus: "available",
  })
})
