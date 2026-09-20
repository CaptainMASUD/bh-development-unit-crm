import assert from "node:assert/strict"
import test from "node:test"
import { createServer } from "vite"

async function loadPage(t) {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  return server.ssrLoadModule("/src/Components/Admin/purchase/QuickPurchase.jsx")
}

test("quick-purchase totals apply discount and derive the due amount", async (t) => {
  const page = await loadPage(t)
  assert.deepEqual(page.calculateQuickPurchaseTotals({ quantity: "2", unitPrice: "125.5", discountPercent: "10", paidAmount: "100", paymentPlan: "partial_payment" }), {
    grossAmount: 251,
    discountAmount: 25.1,
    netAmount: 225.9,
    paidAmount: 100,
    dueAmount: 125.9,
  })
})

test("quick-purchase payload uses the backend canonical fields and idempotency key", async (t) => {
  const page = await loadPage(t)
  assert.deepEqual(page.buildQuickPurchasePayload({
    supplier: "supplier-1",
    product: "product-1",
    quantity: "3",
    unitPrice: "20",
    discountPercent: "5",
    paymentPlan: "full_payment",
    paidAmount: "0",
    paymentAccountType: "cash",
    cashAccount: "cash-1",
    bankAccount: "",
    bankCheckNumber: "",
    paymentDeadline: "",
    idempotencyKey: "quick-purchase-123",
  }), {
    supplier: "supplier-1",
    product: "product-1",
    quantity: 3,
    unitPrice: 20,
    discountPercent: 5,
    paymentPlan: "full_payment",
    paidAmount: 57,
    paymentAccountType: "cash",
    cashAccount: "cash-1",
    bankAccount: null,
    bankCheckNumber: "",
    paymentDeadline: null,
    idempotencyKey: "quick-purchase-123",
  })
})

test("quick-purchase row normalization uses purchaseReference, netAmount, paidAmount, and dueAmount", async (t) => {
  const page = await loadPage(t)
  assert.deepEqual(page.normalizeQuickPurchaseRow({ purchaseReference: "QP-1", netAmount: 75, paidAmount: 25, dueAmount: 50 }), {
    purchaseReference: "QP-1",
    netAmount: 75,
    paidAmount: 25,
    dueAmount: 50,
  })
})
