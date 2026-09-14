import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadRevaluations(t) {
  const server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: "custom",
  })
  t.after(() => server.close())
  return server.ssrLoadModule(
    "/src/Components/Admin/inventory/InventoryRevaluations.jsx"
  )
}

test("revaluation access separates view, manage, and cost visibility", async (t) => {
  const module = await loadRevaluations(t)

  assert.deepEqual(
    module.getRevaluationAccess({
      role: "employee",
      permissions: ["inventory-adjustment:view"],
    }),
    { canView: true, canManage: false, canViewCost: false }
  )
  assert.deepEqual(
    module.getRevaluationAccess({
      role: "employee",
      permissions: [
        "inventory-adjustment:view",
        "inventory-adjustment:manage",
        "inventory-report:cost-view",
      ],
    }),
    { canView: true, canManage: true, canViewCost: true }
  )
})

test("revaluation monetary values are masked without cost-view permission", async (t) => {
  const module = await loadRevaluations(t)

  assert.equal(module.formatRevaluationMoney(1250.5, false), "—")
  assert.equal(module.formatRevaluationMoney(1250.5, true), "BDT 1,250.50")
})

test("revaluation form validation requires its posting inputs", async (t) => {
  const module = await loadRevaluations(t)

  assert.equal(
    module.validateRevaluationForm({
      productId: "",
      warehouseId: "warehouse-1",
      newUnitCost: "12",
      reason: "Annual standard cost update",
    }),
    "Select a product."
  )
  assert.equal(
    module.validateRevaluationForm({
      productId: "product-1",
      warehouseId: "warehouse-1",
      newUnitCost: "-1",
      reason: "Annual standard cost update",
    }),
    "Enter a non-negative new unit cost."
  )
  assert.equal(
    module.validateRevaluationForm({
      productId: "product-1",
      warehouseId: "warehouse-1",
      newUnitCost: "12",
      reason: "Annual standard cost update",
    }),
    ""
  )
})

