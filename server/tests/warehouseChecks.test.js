import assert from "node:assert/strict"
import test from "node:test"

import * as operations from "../controllers/inventory/inventoryOperations.controller.js"

test("active warehouses missing a schedule receive a default annual cycle", () => {
  const now = new Date("2026-09-01T00:00:00.000Z")
  const active = [{ _id: "w1" }, { _id: "w2" }]
  const schedules = [{ warehouse: "w1" }]

  assert.equal(typeof operations.buildMissingWarehouseSchedules, "function")
  assert.deepEqual(operations.buildMissingWarehouseSchedules(active, schedules, "u1", now), [{
    warehouse: "w2",
    frequencyDays: 365,
    inspectionMode: "full_warehouse",
    status: "waiting",
    cycleNumber: 1,
    nextInspectionDate: new Date("2027-09-01T00:00:00.000Z"),
    createdBy: "u1",
    updatedBy: "u1",
  }])
})

test("next-item dispatch selects the earliest unpaused schedule", () => {
  const schedules = [
    { _id: "late", status: "waiting", nextInspectionDate: "2026-09-20" },
    { _id: "paused", status: "paused", nextInspectionDate: "2026-09-01" },
    { _id: "early", status: "processing", nextInspectionDate: "2026-09-10" },
  ]

  assert.equal(typeof operations.pickNextWarehouseSchedule, "function")
  assert.equal(operations.pickNextWarehouseSchedule(schedules)._id, "early")
})

test("warehouse cycle completes only when every current stock position was inspected", () => {
  const positions = [
    { product: "p1", location: "l1" },
    { product: "p2", location: null },
  ]
  const partial = [{ product: "p1", location: "l1", status: "completed" }]
  const complete = [...partial, { product: "p2", location: null, status: "completed" }]

  assert.equal(typeof operations.isWarehouseCycleComplete, "function")
  assert.equal(operations.isWarehouseCycleComplete(positions, partial), false)
  assert.equal(operations.isWarehouseCycleComplete(positions, complete), true)
})

test("cycle advancement increments the cycle and schedules from completion time", () => {
  const completedAt = new Date("2026-09-15T00:00:00.000Z")

  assert.equal(typeof operations.advanceWarehouseCheckCycle, "function")
  assert.deepEqual(operations.advanceWarehouseCheckCycle({ frequencyDays: 30, cycleNumber: 2 }, completedAt), {
    status: "waiting",
    cycleNumber: 3,
    lastInspectionDate: completedAt,
    nextInspectionDate: new Date("2026-10-15T00:00:00.000Z"),
    queuedInspections: [],
  })
})
