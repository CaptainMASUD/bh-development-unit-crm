import assert from "node:assert/strict"
import test from "node:test"

import * as controller from "../../controllers/inventory/inventoryOperations.controller.js"

test("stock request create data retains approved business fields", () => {
  assert.equal(typeof controller.buildStockRequestCreateData, "function")
  const departmentId = "64b000000000000000000001"
  assert.deepEqual(controller.buildStockRequestCreateData({
    body: { product: "p1", requestedQuantity: "10", department: departmentId, notes: "Internal use", requiredDate: "2026-08-26" },
    requester: "u1",
    fallbackDepartment: "d0",
    actor: "admin1",
    reference: "SRQ-ST1-1",
  }), {
    requestReference: "SRQ-ST1-1", product: "p1", requestedQuantity: 10, requester: "u1", department: departmentId, notes: "Internal use", requiredDate: new Date("2026-08-26T00:00:00.000Z"), createdBy: "admin1", updatedBy: "admin1",
  })
})

test("stock request rows expose product-wide available stock", () => {
  assert.equal(typeof controller.attachStockRequestAvailability, "function")
  const rows = [
    { _id: "r1", product: { _id: "p1", name: "Ball Pen" } },
    { _id: "r2", product: { _id: "p2", name: "Paper" } },
  ]
  const stocks = [
    { product: "p1", availableQuantity: 30, status: "active" },
    { product: "p1", availableQuantity: 20, status: "active" },
    { product: "p2", availableQuantity: 99, status: "inactive" },
  ]
  assert.deepEqual(controller.attachStockRequestAvailability(rows, stocks), [
    { _id: "r1", product: { _id: "p1", name: "Ball Pen" }, availableQuantity: 50 },
    { _id: "r2", product: { _id: "p2", name: "Paper" }, availableQuantity: 0 },
  ])
})

test("stock request update data only changes editable pending-request fields", () => {
  assert.equal(typeof controller.buildStockRequestUpdateData, "function")
  const departmentId = "64b000000000000000000001"
  assert.deepEqual(controller.buildStockRequestUpdateData({ product: "p2", requester: "u2", department: departmentId, requestedQuantity: "4", notes: "Revised purpose", requiredDate: "2026-09-01", status: "issued" }, "admin1"), {
    product: "p2", requester: "u2", department: departmentId, requestedQuantity: 4, notes: "Revised purpose", requiredDate: new Date("2026-09-01T00:00:00.000Z"), updatedBy: "admin1",
  })
})
