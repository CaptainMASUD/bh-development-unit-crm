import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadProductPage(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/Product.jsx")
}

test("compact product form produces the product API payload", async (t) => {
  const page = await loadProductPage(t)

  assert.equal(typeof page.buildProductPayload, "function")
  assert.deepEqual(
    page.buildProductPayload({
      category: " category-1 ",
      name: "  LED Bulb  ",
      baseUnit: " unit-1 ",
      minimumStock: "10",
      generalOrderQuantity: "20",
      maximumStock: "50",
      trackingType: "BATCH",
      status: "ACTIVE",
      imageUrl: " https://cdn.example.com/led.webp ",
    }),
    {
      category: "category-1",
      name: "LED Bulb",
      baseUnit: "unit-1",
      minimumStock: 10,
      generalOrderQuantity: 20,
      maximumStock: 50,
      trackingType: "batch",
      status: "active",
      imageUrl: "https://cdn.example.com/led.webp",
      productType: "inventory",
      trackInventory: true,
    }
  )
})

test("product summary excludes archived templates and counts active templates", async (t) => {
  const page = await loadProductPage(t)
  const products = [
    { _id: "1", status: "active" },
    { _id: "2", status: "inactive" },
    { _id: "3", status: "archived" },
  ]

  assert.deepEqual(page.getProductSummary(products, 1), {
    totalTemplates: 2,
    activeTemplates: 1,
    filteredResults: 1,
  })
})

test("product filters combine category, unit, tracking, and search", async (t) => {
  const page = await loadProductPage(t)
  const products = [
    { _id: "1", sku: "EC1", name: "LED Bulb", category: "c1", baseUnit: "u1", trackingType: "batch", status: "active" },
    { _id: "2", sku: "ST1", name: "Ball Pen", category: "c2", baseUnit: "u2", trackingType: "none", status: "active" },
  ]

  assert.deepEqual(
    page.filterProducts(products, {
      query: "led",
      category: "c1",
      unit: "u1",
      tracking: "batch",
      status: "all",
    }).map((product) => product._id),
    ["1"]
  )
})

test("default product view excludes archived templates", async (t) => {
  const page = await loadProductPage(t)
  const products = [
    { _id: "1", name: "Current", status: "active" },
    { _id: "2", name: "Old", status: "archived" },
  ]

  assert.deepEqual(
    page.filterProducts(products, {
      query: "",
      category: "all",
      unit: "all",
      tracking: "all",
      status: "all",
    }).map((product) => product._id),
    ["1"]
  )
})

test("category tabs include zero-count categories and an all total", async (t) => {
  const page = await loadProductPage(t)
  const categories = [
    { _id: "c1", name: "Electronics" },
    { _id: "c2", name: "Stationery" },
  ]
  const products = [
    { _id: "1", category: "c1", status: "active" },
    { _id: "2", category: "c1", status: "active" },
  ]

  assert.deepEqual(page.buildCategoryTabs(categories, products), [
    { id: "all", name: "All Categories", count: 2 },
    { id: "c1", name: "Electronics", count: 2 },
    { id: "c2", name: "Stationery", count: 0 },
  ])
})

test("product code preview uses the selected category prefix", async (t) => {
  const page = await loadProductPage(t)
  const category = { _id: "c1", code: "EC" }
  const products = [
    { _id: "1", category: "c1", sku: "EC2" },
    { _id: "2", category: "c1", sku: "EC10" },
    { _id: "3", category: "c2", sku: "EC30" },
  ]

  assert.equal(page.previewProductCode(category, products), "EC11")
})

test("product pagination clamps an out-of-range page", async (t) => {
  const page = await loadProductPage(t)
  const products = Array.from({ length: 21 }, (_, index) => ({ _id: String(index + 1) }))

  assert.deepEqual(page.paginateProducts(products, 8, 10), {
    page: 3,
    totalPages: 3,
    start: 20,
    end: 21,
    rows: products.slice(20, 21),
  })
})
