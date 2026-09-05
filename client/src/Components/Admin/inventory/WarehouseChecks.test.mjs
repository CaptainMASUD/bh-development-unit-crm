import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadPage(t) {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/WarehouseChecks.jsx")
}

test("summary counts enabled warehouses separately from inspection activity", async (t) => {
  const page = await loadPage(t)
  const rows = [
    { status: "waiting" },
    { status: "paused" },
    { status: "processing" },
    { status: "completed" },
  ]

  assert.deepEqual(page.getWarehouseCheckSummary(rows, { waiting: 2, processing: 3, completed: 4 }), {
    activeWarehouses: 3,
    waitingPaused: 3,
    processing: 3,
    completed: 4,
  })
})

test("schedule edit payload normalizes checking mode and frequency", async (t) => {
  const page = await loadPage(t)

  assert.deepEqual(page.buildWarehouseCheckPayload({ frequencyDays: " 30 ", inspectionMode: "FULL_WAREHOUSE" }), {
    frequencyDays: 30,
    inspectionMode: "full_warehouse",
  })
})

test("schedule pagination clamps the selected page", async (t) => {
  const page = await loadPage(t)
  const rows = Array.from({ length: 12 }, (_, index) => ({ _id: String(index + 1) }))

  assert.deepEqual(page.paginateWarehouseChecks(rows, 9, 5), {
    page: 3,
    totalPages: 3,
    start: 10,
    end: 12,
    rows: rows.slice(10),
  })
})

test("CSV rows expose the schedule fields shown in the table", async (t) => {
  const page = await loadPage(t)
  const rows = [{ warehouse: { name: "Central" }, inspectionMode: "full_warehouse", frequencyDays: 365, nextInspectionDate: "2026-09-16", cycleNumber: 1, status: "waiting" }]

  assert.deepEqual(page.getWarehouseCheckCsvRows(rows), [
    ["Warehouse", "Checking Mode", "Frequency", "Next Check Date", "Cycle", "Status"],
    ["Central", "Full Warehouse", "Every 365 days", "9/16/2026", 1, "Active"],
  ])
})
