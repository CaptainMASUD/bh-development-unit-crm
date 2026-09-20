import assert from "node:assert/strict";
import test from "node:test";

import "../../config/tenant.plugin.js";
import {
  assertEligibleAnalysisRequest,
  prepareIndustrialIssueDraft,
  prepareQualityResult,
} from "../../controllers/purchase/purchaseWorkflow.controller.js";
import { movementLinesFromReceipt } from "../../controllers/purchase/goodsReceipt.controller.js";
import { PurchaseAnalysis, PurchaseIssue, PurchaseQualityInspection } from "../../models/purchaseWorkflow.model.js";
import { isFinalizedPurchaseIssue } from "../../services/purchaseExecution.service.js";

test("analysis creation accepts an approved unanalysed request and rejects invalid or duplicate requests", () => {
  assert.equal(assertEligibleAnalysisRequest({ status: "approved", analysis: null }).status, "approved");
  assert.throws(() => assertEligibleAnalysisRequest({ status: "pending", analysis: null }), /approved Purchase Request/i);
  assert.throws(() => assertEligibleAnalysisRequest({ status: "approved", analysis: "analysis-1" }), /already has an Analysis/i);
});

test("industrial issue draft preserves completed analysis lineage and canonical totals", () => {
  const draft = prepareIndustrialIssueDraft({
    _id: "analysis-1",
    status: "completed",
    request: { _id: "request-1", requestReference: "PRQ-1" },
    product: "product-1",
    selectedSupplier: "supplier-1",
    selectedSupplierProduct: "supplier-product-1",
    finalQuantity: 5,
    purchaseUnitPrice: 120,
    catalogueUnitPrice: 125,
    discountPercent: 10,
  }, { paymentPlan: "full_due", note: "Approved recommendation" });
  assert.deepEqual(draft, {
    purchaseType: "industrial_purchase",
    request: "request-1",
    analysis: "analysis-1",
    sourceRequestReference: "PRQ-1",
    product: "product-1",
    supplier: "supplier-1",
    supplierProduct: "supplier-product-1",
    quantity: 5,
    unitPrice: 120,
    catalogueUnitPrice: 125,
    discountPercent: 10,
    paymentPlan: "full_due",
    paidAmount: 0,
    note: "Approved recommendation",
  });
});

test("industrial issue rejects analysis that is not completed", () => {
  assert.throws(
    () => prepareIndustrialIssueDraft({ status: "pending" }, {}),
    /completed purchase analysis/i
  );
});

test("completed issue with a linked PO is recognized as finalized for idempotent re-finalization", () => {
  assert.equal(isFinalizedPurchaseIssue({ status: "completed", purchaseOrder: "po-1" }), true);
  assert.equal(isFinalizedPurchaseIssue({ status: "ready", purchaseOrder: null }), false);
});

test("quality result validates and derives pass, partial, reject, and quarantine outcomes", () => {
  assert.equal(prepareQualityResult({ receivedQuantity: 10, inspectedQuantity: 10, acceptedQuantity: 10 }).status, "passed");
  assert.equal(prepareQualityResult({ receivedQuantity: 10, inspectedQuantity: 10, acceptedQuantity: 7, rejectedQuantity: 3 }).status, "partially_accepted");
  assert.equal(prepareQualityResult({ receivedQuantity: 10, inspectedQuantity: 10, rejectedQuantity: 10 }).status, "rejected");
  assert.equal(prepareQualityResult({ receivedQuantity: 10, inspectedQuantity: 10, acceptedQuantity: 6, quarantineQuantity: 4 }).status, "partially_accepted");
});

test("quality result rejects impossible quantities", () => {
  assert.throws(
    () => prepareQualityResult({ receivedQuantity: 10, inspectedQuantity: 11, acceptedQuantity: 11 }),
    /cannot exceed received/i
  );
  assert.throws(
    () => prepareQualityResult({ receivedQuantity: 10, inspectedQuantity: 8, acceptedQuantity: 7, rejectedQuantity: 2 }),
    /cannot exceed inspected/i
  );
  assert.throws(
    () => prepareQualityResult({ receivedQuantity: 10, inspectedQuantity: 10, acceptedQuantity: -1, rejectedQuantity: 11 }),
    /non-negative/i
  );
});

test("GRN inventory mapping adds accepted and quarantine stock but never rejected stock", () => {
  const lines = movementLinesFromReceipt({
    receiptNo: "GRN-1",
    warehouse: "warehouse-1",
    lines: [{
      product: "product-1",
      unitCost: 25,
      acceptedQuantity: 6,
      quarantineQuantity: 3,
      rejectedQuantity: 1,
      acceptedLocation: "available-bin",
      quarantineLocation: "quarantine-bin",
    }],
  });
  assert.deepEqual(lines.map(({ effect, quantity }) => ({ effect, quantity })), [
    { effect: "in", quantity: 6 },
    { effect: "in_quarantine", quantity: 3 },
  ]);
});

test("Part 1 workflow schemas retain tenant scope and GRN quality lineage", () => {
  for (const model of [PurchaseAnalysis, PurchaseIssue, PurchaseQualityInspection]) {
    assert.ok(model.schema.path("tenantId"), `${model.modelName} must be tenant scoped`);
  }
  for (const path of ["goodsReceipt", "goodsReceiptLine", "warehouse", "inspectedQuantity", "quarantineQuantity", "startedAt", "note"]) {
    assert.ok(PurchaseQualityInspection.schema.path(path), `PurchaseQualityInspection.${path} must exist`);
  }
  assert.ok(PurchaseIssue.schema.path("note"), "PurchaseIssue.note must preserve issue notes");
});
