import assert from "node:assert/strict";
import test from "node:test";

import "../../config/tenant.plugin.js";
import {
  buildIssueFilter,
  normalizeQuickPurchaseIssue,
  prepareQuickPurchaseDraft,
} from "../../controllers/purchase/purchaseWorkflow.controller.js";
import { PurchaseDue, PurchaseIssue, PurchasePayment } from "../../models/purchaseWorkflow.model.js";
import PurchaseOrder from "../../models/purchaseOrder.model.js";
import { PendingInventory } from "../../models/inventory/inventoryOperations.model.js";

test("quick-purchase list filtering excludes industrial purchases", () => {
  assert.deepEqual(buildIssueFilter({ purchaseType: "quick_purchase" }), {
    purchaseType: "quick_purchase",
  });
  assert.deepEqual(
    buildIssueFilter({ purchaseType: "quick_purchase", status: "completed" }),
    { purchaseType: "quick_purchase", status: "completed" }
  );
});

test("quick-purchase draft calculates discount, payment, and due amounts", () => {
  assert.deepEqual(
    prepareQuickPurchaseDraft({
      quantity: "2",
      unitPrice: "125.50",
      discountPercent: "10",
      paymentPlan: "partial_payment",
      paidAmount: "100",
    }),
    {
      quantity: 2,
      unitPrice: 125.5,
      discountPercent: 10,
      grossAmount: 251,
      discountAmount: 25.1,
      netAmount: 225.9,
      paymentPlan: "partial_payment",
      paidAmount: 100,
      dueAmount: 125.9,
    }
  );
});

test("quick-purchase full payment uses the calculated net amount", () => {
  const draft = prepareQuickPurchaseDraft({
    quantity: 3,
    unitPrice: 20,
    discountPercent: 5,
    paymentPlan: "full_payment",
    paidAmount: 1,
  });
  assert.equal(draft.netAmount, 57);
  assert.equal(draft.paidAmount, 57);
  assert.equal(draft.dueAmount, 0);
});

test("quick-purchase partial payment rejects zero and overpayment", () => {
  assert.throws(
    () => prepareQuickPurchaseDraft({ quantity: 1, unitPrice: 50, paymentPlan: "partial_payment", paidAmount: 0 }),
    /greater than zero and less than the net amount/i
  );
  assert.throws(
    () => prepareQuickPurchaseDraft({ quantity: 1, unitPrice: 50, paymentPlan: "partial_payment", paidAmount: 50 }),
    /greater than zero and less than the net amount/i
  );
});

test("quick purchase rejects the industrial inspection payment plan", () => {
  assert.throws(
    () => prepareQuickPurchaseDraft({ quantity: 1, unitPrice: 50, paymentPlan: "after_quality_inspection" }),
    /valid payment plan/i
  );
});

test("quick-purchase response exposes one canonical monetary contract", () => {
  assert.deepEqual(
    normalizeQuickPurchaseIssue({
      _id: "issue-1",
      purchaseReference: "QP-1001",
      purchaseType: "quick_purchase",
      netAmount: 225.9,
      paidAmount: 100,
      dueAmount: 125.9,
      due: { currentPaidAmount: 150, remainingDue: 75.9 },
    }),
    {
      _id: "issue-1",
      purchaseReference: "QP-1001",
      purchaseType: "quick_purchase",
      netAmount: 225.9,
      paidAmount: 150,
      dueAmount: 75.9,
      due: { currentPaidAmount: 150, remainingDue: 75.9 },
    }
  );
});

test("quick-purchase persistence chain is tenant scoped", () => {
  for (const model of [PurchaseIssue, PurchaseDue, PurchasePayment, PurchaseOrder, PendingInventory]) {
    assert.ok(model.schema.path("tenantId"), `${model.modelName} must be tenant scoped`);
  }
});
