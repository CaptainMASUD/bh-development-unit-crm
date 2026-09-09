import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadInventoryItems(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/inventory/TotalInventory.jsx")
}

test("create form produces the opening-stock API payload", async (t) => {
  const inventoryItems = await loadInventoryItems(t)
  assert.equal(typeof inventoryItems.buildOpeningStockPayload, "function")

  assert.deepEqual(
    inventoryItems.buildOpeningStockPayload({
      product: "product-1",
      warehouse: "warehouse-1",
      location: "bin-1",
      quantity: "8",
      stockPrice: "125.50",
      idempotencyKey: "request-1",
    }),
    {
      product: "product-1",
      warehouse: "warehouse-1",
      location: "bin-1",
      quantity: 8,
      stockPrice: 125.5,
      idempotencyKey: "request-1",
    }
  )
})
