import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadCategoryPage(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/ProductCategory.jsx")
}

test("create form produces the category API payload", async (t) => {
  const categoryPage = await loadCategoryPage(t)

  assert.equal(typeof categoryPage.buildCategoryPayload, "function")
  assert.deepEqual(
    categoryPage.buildCategoryPayload({
      code: "  st  ",
      name: "  Stationery  ",
      status: "active",
    }),
    {
      code: "ST",
      name: "Stationery",
      status: "active",
    }
  )
})

test("summary counts inactive categories as needing attention", async (t) => {
  const categoryPage = await loadCategoryPage(t)
  const categories = [
    { _id: "1", status: "active" },
    { _id: "2", status: "inactive" },
    { _id: "3", status: "active" },
  ]

  assert.deepEqual(categoryPage.getCategorySummary(categories, 2), {
    totalRecords: 3,
    needsAttention: 1,
    totalVolume: 3,
    filteredResults: 2,
  })
})

test("category filters match code or name and status", async (t) => {
  const categoryPage = await loadCategoryPage(t)
  const categories = [
    { _id: "1", code: "ST", name: "Stationery", status: "active" },
    { _id: "2", code: "SA", name: "Sanitation", status: "inactive" },
    { _id: "3", code: "EL", name: "Electronics", status: "active" },
  ]

  assert.deepEqual(
    categoryPage
      .filterCategories(categories, { query: "sa", status: "inactive" })
      .map((category) => category._id),
    ["2"]
  )
})

test("the default category view excludes archived records", async (t) => {
  const categoryPage = await loadCategoryPage(t)
  const categories = [
    { _id: "1", code: "ST", name: "Stationery", status: "active" },
    { _id: "2", code: "OLD", name: "Old supplies", status: "archived" },
  ]

  assert.deepEqual(
    categoryPage
      .filterCategories(categories, { query: "", status: "all" })
      .map((category) => category._id),
    ["1"]
  )
})

test("pagination clamps an out-of-range page to the last available page", async (t) => {
  const categoryPage = await loadCategoryPage(t)
  const categories = Array.from({ length: 12 }, (_, index) => ({ _id: String(index + 1) }))

  assert.deepEqual(categoryPage.paginateCategories(categories, 4, 5), {
    page: 3,
    totalPages: 3,
    start: 10,
    end: 12,
    rows: categories.slice(10, 12),
  })
})
