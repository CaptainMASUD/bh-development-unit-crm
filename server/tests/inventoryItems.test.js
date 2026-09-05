import assert from "node:assert/strict"
import test from "node:test"

import * as stockController from "../controllers/inventory/productStock.controller.js"

test("opening-stock input becomes an auditable inbound movement command", () => {
  assert.equal(typeof stockController.buildOpeningStockCommand, "function")

  const command = stockController.buildOpeningStockCommand({
    product: "507f1f77bcf86cd799439011",
    warehouse: "507f1f77bcf86cd799439012",
    location: "507f1f77bcf86cd799439013",
    quantity: "12.5",
    stockPrice: "40",
    idempotencyKey: "inventory-item-create-1",
  })

  assert.deepEqual(command, {
    product: "507f1f77bcf86cd799439011",
    warehouse: "507f1f77bcf86cd799439012",
    location: "507f1f77bcf86cd799439013",
    quantity: 12.5,
    stockPrice: 40,
    idempotencyKey: "inventory-item-create-1",
  })
})

test("opening-stock input rejects non-positive quantity", () => {
  assert.equal(typeof stockController.buildOpeningStockCommand, "function")

  assert.throws(
    () => stockController.buildOpeningStockCommand({
      product: "507f1f77bcf86cd799439011",
      warehouse: "507f1f77bcf86cd799439012",
      quantity: 0,
      stockPrice: 40,
    }),
    /quantity to add must be greater than zero/i
  )
})

test("opening-stock command produces a posted inbound movement payload", () => {
  assert.equal(typeof stockController.buildOpeningStockMovement, "function")

  const movement = stockController.buildOpeningStockMovement({
    product: "507f1f77bcf86cd799439011",
    warehouse: "507f1f77bcf86cd799439012",
    location: null,
    quantity: 6,
    stockPrice: 25,
    idempotencyKey: "inventory-item-create-2",
  }, "507f1f77bcf86cd799439014")

  assert.equal(movement.movementType, "opening_stock")
  assert.equal(movement.sourceType, "inventory_item")
  assert.equal(movement.idempotencyKey, "inventory-item-create-2")
  assert.equal(movement.lines.length, 1)
  assert.deepEqual(movement.lines[0], {
    product: "507f1f77bcf86cd799439011",
    effect: "in",
    destinationWarehouse: "507f1f77bcf86cd799439012",
    destinationLocation: null,
    quantity: 6,
    requestedUnitCost: 25,
    note: "Created from Inventory Items",
  })
})
