import assert from "node:assert/strict";
import test from "node:test";

import "../../config/tenant.plugin.js";
import {
  calculateDuePaymentSettlement,
  validatePriceAnalysisDecision,
  normalizeReportRows,
} from "../../controllers/purchase/purchaseWorkflow.controller.js";

// ---------------------------------------------------------------------------
// 1. Purchase Due Payment / Settlement Tests
// ---------------------------------------------------------------------------
test("calculateDuePaymentSettlement correctly processes a partial payment", () => {
  const due = {
    originalNetAmount: 10000,
    currentPaidAmount: 2000,
    remainingDue: 8000,
    status: "partial",
  };

  const settlement = calculateDuePaymentSettlement(due, 3000);

  assert.equal(settlement.amount, 3000);
  assert.equal(settlement.previousRemaining, 8000);
  assert.equal(settlement.nextRemaining, 5000);
  assert.equal(settlement.previousPaid, 2000);
  assert.equal(settlement.nextPaid, 5000);
  assert.equal(settlement.nextStatus, "partial");
  assert.equal(settlement.isFullSettlement, false);
});

test("calculateDuePaymentSettlement correctly processes a full final settlement", () => {
  const due = {
    originalNetAmount: 5000,
    currentPaidAmount: 3000,
    remainingDue: 2000,
    status: "partial",
  };

  const settlement = calculateDuePaymentSettlement(due, 2000);

  assert.equal(settlement.amount, 2000);
  assert.equal(settlement.nextRemaining, 0);
  assert.equal(settlement.nextPaid, 5000);
  assert.equal(settlement.nextStatus, "paid");
  assert.equal(settlement.isFullSettlement, true);
});

test("calculateDuePaymentSettlement rejects overpayment exceeding remaining due", () => {
  const due = {
    originalNetAmount: 1000,
    currentPaidAmount: 400,
    remainingDue: 600,
    status: "partial",
  };

  assert.throws(
    () => calculateDuePaymentSettlement(due, 600.01),
    /Payment amount cannot exceed the remaining due/i
  );
  assert.throws(
    () => calculateDuePaymentSettlement(due, 1500),
    /Payment amount cannot exceed the remaining due/i
  );
});

test("calculateDuePaymentSettlement rejects zero, negative, or non-finite payments", () => {
  const due = { remainingDue: 500, currentPaidAmount: 0, status: "outstanding" };

  assert.throws(() => calculateDuePaymentSettlement(due, 0), /must be greater than zero/i);
  assert.throws(() => calculateDuePaymentSettlement(due, -100), /must be greater than zero/i);
  assert.throws(() => calculateDuePaymentSettlement(due, "invalid"), /must be greater than zero/i);
});

test("calculateDuePaymentSettlement rejects payment against already paid or cancelled dues", () => {
  assert.throws(
    () => calculateDuePaymentSettlement({ remainingDue: 0, currentPaidAmount: 500, status: "paid" }, 100),
    /already fully paid or cancelled/i
  );
  assert.throws(
    () => calculateDuePaymentSettlement({ remainingDue: 500, currentPaidAmount: 0, status: "cancelled" }, 100),
    /already fully paid or cancelled/i
  );
});

// ---------------------------------------------------------------------------
// 2. Price Analysis Review Decision Tests
// ---------------------------------------------------------------------------
test("validatePriceAnalysisDecision accepts valid canonical review decisions", () => {
  assert.equal(validatePriceAnalysisDecision("accepted_no_update"), "accepted_no_update");
  assert.equal(validatePriceAnalysisDecision("catalogue_updated"), "catalogue_updated");
  assert.equal(validatePriceAnalysisDecision("rejected"), "rejected");
  assert.equal(validatePriceAnalysisDecision("  catalogue_updated  "), "catalogue_updated");
});

test("validatePriceAnalysisDecision rejects invalid, arbitrary or empty decisions", () => {
  assert.throws(
    () => validatePriceAnalysisDecision("approved"),
    /Select a valid review decision/i
  );
  assert.throws(
    () => validatePriceAnalysisDecision(""),
    /Select a valid review decision/i
  );
  assert.throws(
    () => validatePriceAnalysisDecision("closed"),
    /Select a valid review decision/i
  );
  assert.throws(
    () => validatePriceAnalysisDecision(null),
    /Select a valid review decision/i
  );
});

// ---------------------------------------------------------------------------
// 3. Purchase Reports Normalization Tests
// ---------------------------------------------------------------------------
test("normalizeReportRows transforms raw aggregation into canonical human-readable structures", () => {
  const monthlyRaw = [
    { _id: "2026-01", amount: 15000.5, orders: 4 },
    { _id: "2026-02", amount: 25000.25, orders: 6 },
  ];

  const suppliersRaw = [
    {
      _id: "sup-001",
      amount: 30000.75,
      orders: 7,
      supplierDoc: { businessName: "Acme Industrial Raw", code: "SUP-01" },
    },
    {
      _id: "sup-002",
      amount: 10000,
      orders: 3,
      supplierDoc: { businessName: "Global Imports Ltd", code: "SUP-02" },
    },
  ];

  const productsRaw = [
    {
      _id: "prod-001",
      quantity: 500,
      amount: 25000,
      productDoc: { name: "Steel Rods 12mm", sku: "ROD-12" },
    },
  ];

  const paymentRaw = [
    { _id: "paid", amount: 25000, paid: 25000, due: 0, orders: 6 },
    { _id: "partial", amount: 15000.75, paid: 5000, due: 10000.75, orders: 4 },
  ];

  const result = normalizeReportRows({ monthlyRaw, suppliersRaw, productsRaw, paymentRaw });

  // Monthly
  assert.deepEqual(result.monthly, [
    { month: "2026-01", amount: 15000.5, orders: 4 },
    { month: "2026-02", amount: 25000.25, orders: 6 },
  ]);

  // Suppliers (properly mapped without raw _id field)
  assert.deepEqual(result.suppliers, [
    {
      supplierId: "sup-001",
      supplierName: "Acme Industrial Raw",
      supplierCode: "SUP-01",
      amount: 30000.75,
      orders: 7,
    },
    {
      supplierId: "sup-002",
      supplierName: "Global Imports Ltd",
      supplierCode: "SUP-02",
      amount: 10000,
      orders: 3,
    },
  ]);

  // Products
  assert.deepEqual(result.products, [
    {
      productId: "prod-001",
      productName: "Steel Rods 12mm",
      sku: "ROD-12",
      quantity: 500,
      amount: 25000,
    },
  ]);

  // Payment Breakdown
  assert.deepEqual(result.payment, [
    { paymentStatus: "paid", amount: 25000, paid: 25000, due: 0, orders: 6 },
    { paymentStatus: "partial", amount: 15000.75, paid: 5000, due: 10000.75, orders: 4 },
  ]);

  // Summary KPIs
  assert.equal(result.summary.totalSpend, 40000.75);
  assert.equal(result.summary.totalOrders, 10);
  assert.equal(result.summary.totalPaid, 30000);
  assert.equal(result.summary.totalDue, 10000.75);
});

test("normalizeReportRows handles empty datasets gracefully with zeroed KPIs", () => {
  const result = normalizeReportRows({});
  assert.deepEqual(result.monthly, []);
  assert.deepEqual(result.suppliers, []);
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.payment, []);
  assert.deepEqual(result.summary, {
    totalSpend: 0,
    totalOrders: 0,
    totalPaid: 0,
    totalDue: 0,
  });
});
