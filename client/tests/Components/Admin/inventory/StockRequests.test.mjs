import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadPage(t) {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/StockRequests.jsx")
}

const requests = [
  { _id: "1", requestReference: "SR-1", requestDate: "2026-08-17", requester: { _id: "u1", name: "Rifat" }, department: { _id: "d1", name: "Maintenance" }, product: { _id: "p1", name: "Ball Pen", sku: "ST1" }, requestedQuantity: 10, availableQuantity: 50, requiredDate: "2026-08-26", status: "issued" },
  { _id: "2", requestReference: "SR-2", requestDate: "2026-08-18", requester: { _id: "u2", name: "Imran" }, department: { _id: "d2", name: "Administration" }, product: { _id: "p2", name: "A4 Paper", sku: "ST2" }, requestedQuantity: 1, availableQuantity: 20, requiredDate: "2026-08-20", status: "pending" },
  { _id: "3", requestReference: "SR-3", requestDate: "2026-08-18", requester: { _id: "u1", name: "Rifat" }, department: { _id: "d1", name: "Maintenance" }, product: { _id: "p1", name: "Ball Pen", sku: "ST1" }, requestedQuantity: 4, availableQuantity: 50, requiredDate: "2026-08-21", status: "rejected" },
]

test("stock request form maps the approved modal fields to the API payload", async (t) => {
  const page = await loadPage(t)
  assert.equal(typeof page.buildStockRequestPayload, "function")
  assert.deepEqual(page.buildStockRequestPayload({ department: "d1", requester: "u1", product: "p1", requestedQuantity: "10", purpose: "Internal use", requiredDate: "2026-08-26" }), {
    department: "d1", requester: "u1", product: "p1", requestedQuantity: 10, notes: "Internal use", requiredDate: "2026-08-26",
  })
  assert.equal(page.buildStockRequestPayload({ requestReference: " sr-manual-7 " }).requestReference, "SR-MANUAL-7")
})

test("stock request dashboard summarizes completed history separately from pending approvals", async (t) => {
  const page = await loadPage(t)
  assert.equal(typeof page.getStockRequestSummary, "function")
  assert.deepEqual(page.getStockRequestSummary(requests, 2), { totalRecords: 2, needsAttention: 1, totalQuantity: 14, filteredResults: 2, pendingCount: 1 })
})

test("stock request filters combine status and search across reference, requester, department, and product", async (t) => {
  const page = await loadPage(t)
  assert.equal(typeof page.filterStockRequests, "function")
  assert.deepEqual(page.filterStockRequests(requests, { status: "issued", query: "rifat" }).map((row) => row._id), ["1"])
  assert.deepEqual(page.filterStockRequests(requests, { status: "all", query: "administration" }).map((row) => row._id), ["2"])
})

test("stock request pagination clamps an out-of-range page", async (t) => {
  const page = await loadPage(t)
  const rows = Array.from({ length: 12 }, (_, index) => ({ _id: String(index + 1) }))
  assert.equal(typeof page.paginateStockRequests, "function")
  assert.deepEqual(page.paginateStockRequests(rows, 8, 5), { page: 3, totalPages: 3, start: 10, end: 12, rows: rows.slice(10) })
})
