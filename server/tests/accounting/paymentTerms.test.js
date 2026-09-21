import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import PaymentTerm from "../../models/accounting/paymentTerm.model.js";
import { SalesInvoice } from "../../models/sales/salesInvoice.model.js";
import VendorBill from "../../models/accounting/vendorBill.model.js";
import Customer from "../../models/crm/customer.model.js";
import Supplier from "../../models/supplier/supplier.model.js";
import AccountingSettings from "../../models/accounting/accountingSettings.model.js";

import {
  STANDARD_TERMS_SEED,
  seedDefaultPaymentTerms,
  calculateDueDate,
  validatePaymentTermRules,
  generatePaymentSchedule,
  resolveEffectivePaymentTerm,
  allocatePaymentToSchedule,
  reversePaymentFromSchedule,
  applyAdjustmentToSchedule,
  reverseAdjustmentFromSchedule,
  calculateScheduleAging,
} from "../../services/accounting/paymentTerms.service.js";

const roundMoney = (v) => Math.round(Number(v || 0) * 100) / 100;
const fakeId = () => new mongoose.Types.ObjectId();

function mockQuery(result) {
  const promise = Promise.resolve(result);
  promise.select = () => promise;
  promise.session = () => promise;
  promise.sort = () => promise;
  promise.populate = () => promise;
  promise.lean = () => Promise.resolve(result);
  return promise;
}

// --------------------------------------------------------------------------
// 1. PaymentTerm Model Schema & Index Invariants
// --------------------------------------------------------------------------
test("1. PaymentTerm schema defines rules, tenant isolation, and status fields", () => {
  const schema = PaymentTerm.schema;
  assert.ok(schema.path("code"), "PaymentTerm must have code");
  assert.ok(schema.path("name"), "PaymentTerm must have name");
  assert.ok(schema.path("tenantId"), "PaymentTerm must have tenantId");
  assert.ok(schema.path("rules"), "PaymentTerm must have rules array");
  assert.ok(schema.path("isPredefined"), "PaymentTerm must have isPredefined flag");
  assert.ok(schema.path("isActive"), "PaymentTerm must have isActive flag");

  // Check unique compound index on { tenantId: 1, code: 1 }
  const indexes = schema.indexes();
  const hasTenantCodeIndex = indexes.some(
    ([idx, opts]) => idx.tenantId === 1 && idx.code === 1 && opts?.unique
  );
  assert.ok(hasTenantCodeIndex, "PaymentTerm must define unique compound index on { tenantId, code }");
});

// --------------------------------------------------------------------------
// 2. Predefined Standard Payment Terms Seeding
// --------------------------------------------------------------------------
test("2. seedDefaultPaymentTerms seeds all 8 standard terms idempotently per tenant", async (t) => {
  const tenantId = fakeId();
  const createdTerms = [];

  t.mock.method(PaymentTerm, "bulkWrite", (ops) => {
    createdTerms.push(...ops);
    return Promise.resolve({ upsertedCount: ops.length });
  });

  const terms = await seedDefaultPaymentTerms(tenantId);
  assert.equal(terms.length, 8, "Must return 8 standard predefined terms");
  assert.equal(createdTerms.length, 8, "Must create 8 bulkWrite operations");

  const codes = terms.map((t) => t.code);
  assert.ok(codes.includes("IMMEDIATE"));
  assert.ok(codes.includes("NET7"));
  assert.ok(codes.includes("NET15"));
  assert.ok(codes.includes("NET30"));
  assert.ok(codes.includes("NET45"));
  assert.ok(codes.includes("NET60"));
  assert.ok(codes.includes("EOM"));
  assert.ok(codes.includes("15TH_NEXT_MONTH"));
});

// --------------------------------------------------------------------------
// 3. Calendar Math with Month-End Clamping
// --------------------------------------------------------------------------
test("3. calculateDueDate handles month-end clamping and calendar date rules deterministically", () => {
  // EOM on Jan 15 -> Jan 31
  const jan15 = new Date(2026, 0, 15);
  const janEOM = calculateDueDate({ dueRule: "END_OF_MONTH", baseDate: jan15 });
  assert.equal(janEOM.getMonth(), 0);
  assert.equal(janEOM.getDate(), 31);

  // EOM on Feb 5 (leap year check: 2024 is leap, 2026 is non-leap = 28)
  const feb5_2026 = new Date(2026, 1, 5);
  const febEOM = calculateDueDate({ dueRule: "END_OF_MONTH", baseDate: feb5_2026 });
  assert.equal(febEOM.getMonth(), 1);
  assert.equal(febEOM.getDate(), 28);

  // 15th of next month from Jan 31 -> Feb 15
  const jan31 = new Date(2026, 0, 31);
  const nextMonth15 = calculateDueDate({ dueRule: "FIXED_DAY_NEXT_MONTH", fixedDay: 15, baseDate: jan31 });
  assert.equal(nextMonth15.getMonth(), 1);
  assert.equal(nextMonth15.getDate(), 15);

  // 31st of next month from Jan 15 into Feb -> clamps to Feb 28!
  const clampedFeb = calculateDueDate({ dueRule: "FIXED_DAY_NEXT_MONTH", fixedDay: 31, baseDate: jan15 });
  assert.equal(clampedFeb.getMonth(), 1);
  assert.equal(clampedFeb.getDate(), 28, "Must clamp 31st of February to 28th");

  // Net 30 days
  const net30 = calculateDueDate({ dueRule: "DAYS_AFTER_INVOICE", days: 30, baseDate: jan15 });
  const diffDays = Math.round((net30.getTime() - jan15.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(diffDays, 30);
});

// --------------------------------------------------------------------------
// 4. Custom Rule Validation
// --------------------------------------------------------------------------
test("4. validatePaymentTermRules validates 100% percentage check and remaining balance", () => {
  // Valid: 50% + 50% = 100%
  assert.doesNotThrow(() => {
    validatePaymentTermRules([
      { sequence: 1, calculationType: "PERCENTAGE", value: 50, dueRule: "IMMEDIATE" },
      { sequence: 2, calculationType: "PERCENTAGE", value: 50, dueRule: "DAYS_AFTER_INVOICE", days: 30 },
    ]);
  });

  // Valid: 30% advance + remaining balance
  assert.doesNotThrow(() => {
    validatePaymentTermRules([
      { sequence: 1, calculationType: "PERCENTAGE", value: 30, dueRule: "IMMEDIATE" },
      { sequence: 2, calculationType: "REMAINING_BALANCE", dueRule: "DAYS_AFTER_DELIVERY", days: 15 },
    ]);
  });

  // Invalid: sum is only 80%
  assert.throws(
    () => {
      validatePaymentTermRules([
        { sequence: 1, calculationType: "PERCENTAGE", value: 40, dueRule: "IMMEDIATE" },
        { sequence: 2, calculationType: "PERCENTAGE", value: 40, dueRule: "DAYS_AFTER_INVOICE", days: 30 },
      ]);
    },
    /100%/,
    "Should reject rules summing to 80%"
  );

  // Invalid: empty rules
  assert.throws(() => validatePaymentTermRules([]), /At least one payment term rule is required/);
});

// --------------------------------------------------------------------------
// 5. Schedule Generation & Rounding Absorption
// --------------------------------------------------------------------------
test("5. generatePaymentSchedule absorbs rounding differences into the final installment", () => {
  // 3 installments of 33.333...% of 100,000
  const rules = [
    { sequence: 1, calculationType: "PERCENTAGE", value: 33.33, dueRule: "IMMEDIATE" },
    { sequence: 2, calculationType: "PERCENTAGE", value: 33.33, dueRule: "DAYS_AFTER_INVOICE", days: 30 },
    { sequence: 3, calculationType: "REMAINING_BALANCE", dueRule: "DAYS_AFTER_INVOICE", days: 60 },
  ];

  const totalAmount = 100000;
  const baseDate = new Date("2026-03-01T00:00:00.000Z");

  const { schedule, finalDueDate } = generatePaymentSchedule({
    rules,
    totalAmount,
    baseDate,
  });

  assert.equal(schedule.length, 3);
  assert.equal(schedule[0].originalAmount, 33330);
  assert.equal(schedule[1].originalAmount, 33330);
  // Remaining balance absorbs exact difference: 100,000 - 33,330 - 33,330 = 33,340
  assert.equal(schedule[2].originalAmount, 33340);

  const sum = roundMoney(
    schedule.reduce((acc, line) => acc + line.originalAmount, 0)
  );
  assert.equal(sum, totalAmount, "Sum of schedule lines must equal totalAmount exactly");
  assert.ok(finalDueDate >= schedule[2].dueDate, "finalDueDate must be the latest installment dueDate");
});

// --------------------------------------------------------------------------
// 6. Payment Allocation: FIFO & Explicit Installment Selection
// --------------------------------------------------------------------------
test("6. allocatePaymentToSchedule allocates payments using FIFO and updates line statuses", () => {
  const schedule = [
    { sequence: 1, originalAmount: 3000, paidAmount: 0, outstandingAmount: 3000, status: "PENDING", dueDate: new Date(2026, 0, 10) },
    { sequence: 2, originalAmount: 7000, paidAmount: 0, outstandingAmount: 7000, status: "PENDING", dueDate: new Date(2026, 1, 10) },
  ];

  // Pay 4,000: should fully pay #1 (3,000) and partially pay #2 (1,000)
  const { schedule: updated, allocatedAmount, unallocatedAmount } = allocatePaymentToSchedule(
    schedule,
    { paymentAmount: 4000 }
  );

  assert.equal(allocatedAmount, 4000);
  assert.equal(unallocatedAmount, 0);

  assert.equal(updated[0].paidAmount, 3000);
  assert.equal(updated[0].outstandingAmount, 0);
  assert.equal(updated[0].status, "PAID");

  assert.equal(updated[1].paidAmount, 1000);
  assert.equal(updated[1].outstandingAmount, 6000);
  assert.equal(updated[1].status, "PARTIALLY_PAID");
});

test("6b. allocatePaymentToSchedule supports explicit installment sequence targeting", () => {
  const schedule = [
    { sequence: 1, originalAmount: 5000, paidAmount: 0, outstandingAmount: 5000, status: "PENDING", dueDate: new Date(2026, 0, 10) },
    { sequence: 2, originalAmount: 5000, paidAmount: 0, outstandingAmount: 5000, status: "PENDING", dueDate: new Date(2026, 1, 10) },
  ];

  // Specifically target sequence #2 with 2,000
  const { schedule: updated } = allocatePaymentToSchedule(schedule, {
    paymentAmount: 2000,
    installmentSequence: 2,
  });

  assert.equal(updated[0].paidAmount, 0);
  assert.equal(updated[0].outstandingAmount, 5000);
  assert.equal(updated[0].status, "PENDING");

  assert.equal(updated[1].paidAmount, 2000);
  assert.equal(updated[1].outstandingAmount, 3000);
  assert.equal(updated[1].status, "PARTIALLY_PAID");
});

// --------------------------------------------------------------------------
// 7. Payment Reversal: LIFO from Paid Installments
// --------------------------------------------------------------------------
test("7. reversePaymentFromSchedule reverses payments in LIFO order and restores line status", () => {
  const schedule = [
    { sequence: 1, originalAmount: 3000, paidAmount: 3000, outstandingAmount: 0, status: "PAID", dueDate: new Date(2026, 0, 10) },
    { sequence: 2, originalAmount: 7000, paidAmount: 1000, outstandingAmount: 6000, status: "PARTIALLY_PAID", dueDate: new Date(2026, 1, 10) },
  ];

  // Reverse 2,000: reverses 1,000 from #2 (back to 0 paid, 7000 outstanding) and 1,000 from #1 (back to 2000 paid, 1000 outstanding)
  const { schedule: updated, reversedAmount } = reversePaymentFromSchedule(schedule, { paymentAmount: 2000 });

  assert.equal(reversedAmount, 2000);

  assert.equal(updated[1].paidAmount, 0);
  assert.equal(updated[1].outstandingAmount, 7000);
  assert.equal(updated[1].status, "PENDING");

  assert.equal(updated[0].paidAmount, 2000);
  assert.equal(updated[0].outstandingAmount, 1000);
  assert.equal(updated[0].status, "PARTIALLY_PAID");
});

// --------------------------------------------------------------------------
// 8. Credit Note Adjustment: LIFO Reduction on Unpaid Installments
// --------------------------------------------------------------------------
test("8. applyAdjustmentToSchedule reduces latest unpaid installments first on Credit Note", () => {
  const schedule = [
    { sequence: 1, originalAmount: 5000, paidAmount: 5000, creditedAmount: 0, outstandingAmount: 0, status: "PAID", dueDate: new Date(2026, 0, 10) },
    { sequence: 2, originalAmount: 3000, paidAmount: 0, creditedAmount: 0, outstandingAmount: 3000, status: "PENDING", dueDate: new Date(2026, 1, 10) },
    { sequence: 3, originalAmount: 2000, paidAmount: 0, creditedAmount: 0, outstandingAmount: 2000, status: "PENDING", dueDate: new Date(2026, 2, 10) },
  ];

  // Credit Note of 2,500: should reduce #3 first (2,000 -> 0) and #2 next (3,000 -> 2,500)
  const { schedule: updated, appliedAdjustment } = applyAdjustmentToSchedule(schedule, {
    adjustmentType: "credit",
    amount: 2500,
  });

  assert.equal(appliedAdjustment, 2500);

  // Line #3 was reduced by 2,000 -> cancelled/0 outstanding
  assert.equal(updated[2].creditedAmount, 2000);
  assert.equal(updated[2].outstandingAmount, 0);
  assert.equal(updated[2].status, "CANCELLED");

  // Line #2 was reduced by 500 -> 2,500 outstanding
  assert.equal(updated[1].creditedAmount, 500);
  assert.equal(updated[1].outstandingAmount, 2500);
  assert.equal(updated[1].status, "PENDING");

  // Line #1 was untouched
  assert.equal(updated[0].paidAmount, 5000);
  assert.equal(updated[0].outstandingAmount, 0);
  assert.equal(updated[0].status, "PAID");
});

// --------------------------------------------------------------------------
// 9. Debit Note Adjustment: Appends Scheduled Obligation
// --------------------------------------------------------------------------
test("9. applyAdjustmentToSchedule appends debit installment obligation for Debit Note", () => {
  const schedule = [
    { sequence: 1, originalAmount: 10000, paidAmount: 10000, creditedAmount: 0, debitedAmount: 0, outstandingAmount: 0, status: "PAID", dueDate: new Date(2026, 0, 10) },
  ];

  // Debit Note of 2,000: increases customer/supplier obligation
  const { schedule: updated, appliedAdjustment } = applyAdjustmentToSchedule(schedule, {
    adjustmentType: "debit",
    amount: 2000,
  });

  assert.equal(appliedAdjustment, 2000);
  assert.equal(updated.length, 2);
  assert.equal(updated[1].sequence, 2);
  assert.equal(updated[1].originalAmount, 2000);
  assert.equal(updated[1].outstandingAmount, 2000);
  assert.equal(updated[1].status, "PENDING");
});

// --------------------------------------------------------------------------
// 10. Adjustment Cancellation / Reversal
// --------------------------------------------------------------------------
test("10. reverseAdjustmentFromSchedule restores credited installments on Credit Note cancellation", () => {
  const schedule = [
    { sequence: 1, originalAmount: 5000, paidAmount: 0, creditedAmount: 0, outstandingAmount: 5000, status: "PENDING" },
    { sequence: 2, originalAmount: 5000, paidAmount: 0, creditedAmount: 2000, outstandingAmount: 3000, status: "PENDING" },
  ];

  // Reversing 2,000 credit note
  const { schedule: updated, reversedAdjustment } = reverseAdjustmentFromSchedule(schedule, {
    adjustmentType: "credit",
    amount: 2000,
  });

  assert.equal(reversedAdjustment, 2000);
  assert.equal(updated[1].creditedAmount, 0);
  assert.equal(updated[1].outstandingAmount, 5000);
  assert.equal(updated[1].status, "PENDING");
});

// --------------------------------------------------------------------------
// 11. Schedule-Line Level Aging Calculation
// --------------------------------------------------------------------------
test("11. calculateScheduleAging distributes multi-installment invoices accurately across aging buckets", () => {
  const asOf = new Date("2026-06-01T00:00:00.000Z");

  const schedule = [
    // Overdue by 100 days (> 90)
    { sequence: 1, outstandingAmount: 10000, dueDate: new Date("2026-02-21T00:00:00.000Z"), status: "PENDING" },
    // Overdue by 45 days (31-60)
    { sequence: 2, outstandingAmount: 20000, dueDate: new Date("2026-04-17T00:00:00.000Z"), status: "PENDING" },
    // Current (due in future)
    { sequence: 3, outstandingAmount: 30000, dueDate: new Date("2026-07-01T00:00:00.000Z"), status: "PENDING" },
    // Already paid line (should be skipped)
    { sequence: 4, outstandingAmount: 0, dueDate: new Date("2026-01-01T00:00:00.000Z"), status: "PAID" },
  ];

  const aging = calculateScheduleAging(schedule, asOf);

  assert.equal(aging.days90plus, 10000);
  assert.equal(aging.days31to60, 20000);
  assert.equal(aging.current, 30000);
  assert.equal(aging.days1to30, 0);
  assert.equal(aging.days61to90, 0);
  assert.equal(aging.total, 60000);
});

// --------------------------------------------------------------------------
// 12. Resolution Hierarchy: Transaction > Customer/Supplier > Company > Fallback
// --------------------------------------------------------------------------
test("12. resolveEffectivePaymentTerm follows strict inheritance priority", async (t) => {
  const tenantId = fakeId();
  const txTerm = { _id: fakeId(), name: "Tx Net 60", code: "NET_60", rules: [{ value: 100 }] };
  const custTerm = { _id: fakeId(), name: "Customer Net 15", code: "NET_15", rules: [{ value: 100 }] };
  const companyTerm = { _id: fakeId(), name: "Company Net 30", code: "NET_30", rules: [{ value: 100 }] };

  // 1. Transaction-level term overrides everything
  t.mock.method(PaymentTerm, "findOne", () => mockQuery(txTerm));
  const res1 = await resolveEffectivePaymentTerm({
    paymentTermId: txTerm._id,
    customerId: fakeId(),
    partyType: "customer",
    tenantId,
  });
  assert.equal(res1.paymentTerm._id, txTerm._id);

  // 2. Customer default is used when no transaction-level term provided
  t.mock.method(PaymentTerm, "findOne", () => mockQuery(custTerm));
  t.mock.method(Customer, "findById", () => mockQuery({ defaultPaymentTerm: custTerm._id }));
  const res2 = await resolveEffectivePaymentTerm({
    customerId: fakeId(),
    partyType: "customer",
    tenantId,
  });
  assert.equal(res2.paymentTerm._id, custTerm._id);

  // 3. Fallback to standard Net 30 when none configured
  t.mock.method(Customer, "findById", () => mockQuery({ defaultPaymentTerm: null }));
  t.mock.method(AccountingSettings, "findOne", () => mockQuery({ defaultSalesPaymentTerm: null }));
  t.mock.method(PaymentTerm, "findOne", () => mockQuery(null));
  t.mock.method(PaymentTerm, "create", () => Promise.resolve(companyTerm));

  const res3 = await resolveEffectivePaymentTerm({
    tenantId,
    partyType: "customer",
  });
  assert.ok(res3.paymentTerm, "Must resolve a fallback payment term");
});
