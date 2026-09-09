import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadUnitPage(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/InventoryUnit.jsx")
}

test("unit form maps Short Name to the required code and symbol fields", async (t) => {
  const unitPage = await loadUnitPage(t)

  assert.equal(typeof unitPage.buildUnitPayload, "function")
  assert.deepEqual(
    unitPage.buildUnitPayload({
      name: "  Kilogram  ",
      shortName: " kg ",
      unitType: "WEIGHT",
      allowDecimal: "true",
      status: "ACTIVE",
    }),
    {
      name: "Kilogram",
      code: "KG",
      symbol: "KG",
      unitType: "weight",
      allowDecimal: true,
      decimalPlaces: 2,
      status: "active",
    }
  )
})

test("unit summary counts inactive records as needing attention", async (t) => {
  const unitPage = await loadUnitPage(t)
  const units = [
    { _id: "1", status: "active" },
    { _id: "2", status: "inactive" },
    { _id: "3", status: "archived" },
  ]

  assert.deepEqual(unitPage.getUnitSummary(units, 1), {
    totalRecords: 2,
    needsAttention: 1,
    totalVolume: 2,
    filteredResults: 1,
  })
})

test("unit filters match name or Short Name together with status", async (t) => {
  const unitPage = await loadUnitPage(t)
  const units = [
    { _id: "1", name: "Meter", symbol: "MT", code: "MTR", status: "active" },
    { _id: "2", name: "Kilogram", symbol: "KG", code: "KGM", status: "inactive" },
  ]

  assert.deepEqual(
    unitPage.filterUnits(units, { query: "kg", status: "inactive" }).map((unit) => unit._id),
    ["2"]
  )
})

test("the default unit view excludes archived records", async (t) => {
  const unitPage = await loadUnitPage(t)
  const units = [
    { _id: "1", name: "Meter", symbol: "MT", status: "active" },
    { _id: "2", name: "Old unit", symbol: "OLD", status: "archived" },
  ]

  assert.deepEqual(
    unitPage.filterUnits(units, { query: "", status: "all" }).map((unit) => unit._id),
    ["1"]
  )
})

test("unit pagination clamps an out-of-range page", async (t) => {
  const unitPage = await loadUnitPage(t)
  const units = Array.from({ length: 11 }, (_, index) => ({ _id: String(index + 1) }))

  assert.deepEqual(unitPage.paginateUnits(units, 8, 5), {
    page: 3,
    totalPages: 3,
    start: 10,
    end: 11,
    rows: units.slice(10, 11),
  })
})
