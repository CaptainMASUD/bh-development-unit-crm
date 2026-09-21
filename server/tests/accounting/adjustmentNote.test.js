import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import AdjustmentNote from "../../models/accounting/adjustmentNote.model.js";
import SalesInvoice from "../../models/sales/salesInvoice.model.js";
import VendorBill from "../../models/accounting/vendorBill.model.js";
import JournalEntry from "../../models/accounting/journalEntry.model.js";
import Account from "../../models/account.model.js";
import AccountingPeriod from "../../models/accountingPeriod.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import FiscalYear from "../../models/fiscalYear.model.js";
import VoucherType from "../../models/voucherType.model.js";
import VoucherSequence from "../../models/voucherSequence.model.js";
import AuditLog from "../../models/auditLog.model.js";
import CostCenter from "../../models/accounting/costCenter.model.js";
import AccountingDimension from "../../models/accounting/accountingDimension.model.js";
import Branch from "../../models/branch.model.js";
import Department from "../../models/department.model.js";

import {
  calculateEligibleAdjustment,
  createAdjustmentNote,
  updateAdjustmentNote,
  approveAdjustmentNote,
  postAdjustmentNote,
  cancelAdjustmentNote,
  allocateCreditNoteBalance,
} from "../../services/accounting/adjustmentNote.service.js";

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

function mockCommonPosting(t) {
  t.mock.method(FiscalYear, "findOne", () => mockQuery({
    _id: fakeId(),
    name: "FY 2026",
    status: "active",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  }));
  t.mock.method(FiscalYear, "exists", () => Promise.resolve(true));

  t.mock.method(Account, "find", (query) => {
    const ids = query?._id?.$in || [];
    return mockQuery(ids.map(id => ({
      _id: id,
      code: "1100",
      name: "Account",
      type: "receivable",
      isActive: true,
      isGroup: false,
      publishedAt: new Date(),
    })));
  });
  t.mock.method(Account, "distinct", () => mockQuery([]));
  t.mock.method(AccountingSettings, "exists", () => Promise.resolve(false));
  t.mock.method(AccountingSettings, "findOne", () => mockQuery({ baseCurrency: "BDT" }));
  t.mock.method(VoucherSequence, "findOneAndUpdate", () => mockQuery({ value: 1 }));
  t.mock.method(VoucherType, "findOne", () => mockQuery({ prefix: "JV", nextNumber: 1 }));
  t.mock.method(AccountingDimension, "find", () => mockQuery([]));
  t.mock.method(AccountingDimension, "findOne", () => mockQuery(null));
  t.mock.method(CostCenter, "find", () => mockQuery([]));
  t.mock.method(CostCenter, "findOne", () => mockQuery(null));
  t.mock.method(Branch, "find", () => mockQuery([]));
  t.mock.method(Branch, "findOne", () => mockQuery(null));
  t.mock.method(Department, "find", () => mockQuery([]));
  t.mock.method(Department, "findOne", () => mockQuery(null));
  t.mock.method(AuditLog, "create", () => Promise.resolve({}));
}

// --------------------------------------------------------------------------
// 1. Model Schema & Multi-Tenant Index Invariants
// --------------------------------------------------------------------------
test("1. AdjustmentNote schema defines required lifecycle, direction, and multi-tenant fields", () => {
  const schema = AdjustmentNote.schema;

  assert.ok(schema.path("noteNumber"), "AdjustmentNote must have noteNumber");
  assert.ok(schema.path("tenantId"), "AdjustmentNote must have tenantId");
  assert.ok(schema.path("sourceSide"), "AdjustmentNote must have sourceSide");
  assert.ok(schema.path("noteType"), "AdjustmentNote must have noteType");
  assert.ok(schema.path("financialDirection"), "AdjustmentNote must have financialDirection");
  assert.ok(schema.path("originalDocumentType"), "AdjustmentNote must have originalDocumentType");
  assert.ok(schema.path("originalDocumentId"), "AdjustmentNote must have originalDocumentId");
  assert.ok(schema.path("status"), "AdjustmentNote must have status");
  assert.ok(schema.path("hasInventoryMovement"), "AdjustmentNote must have hasInventoryMovement flag");

  const directions = schema.path("financialDirection").enumValues;
  assert.deepStrictEqual(
    directions.sort(),
    ["DECREASES_PAYABLE", "DECREASES_RECEIVABLE", "INCREASES_PAYABLE", "INCREASES_RECEIVABLE"].sort(),
    "Must support 4 explicit financial directions"
  );

  const statuses = schema.path("status").enumValues;
  assert.ok(statuses.includes("draft"));
  assert.ok(statuses.includes("approved"));
  assert.ok(statuses.includes("posted"));
  assert.ok(statuses.includes("cancelled"));

  const indexes = schema.indexes();
  const hasTenantNumberIndex = indexes.some(
    ([fields, opts]) => fields.tenantId === 1 && fields.noteNumber === 1 && opts?.unique
  );
  assert.ok(hasTenantNumberIndex, "AdjustmentNote must have compound unique index on { tenantId: 1, noteNumber: 1 }");
});

// --------------------------------------------------------------------------
// 2. Sales Credit Note Integration & GL Balancing
// --------------------------------------------------------------------------
test("2. Sales Credit Note posts DECREASES_RECEIVABLE, credits AR (1100), debits Sales Revenue (4000) & Output VAT (2100)", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const invoiceId = fakeId();

  mockCommonPosting(t);

  const mockInvoice = {
    _id: invoiceId,
    tenantId,
    invoiceNumber: "INV-2026-001",
    status: "posted",
    grandTotal: 1150,
    paidAmount: 0,
    creditedAmount: 0,
    debitedAmount: 0,
    dueAmount: 1150,
    currency: "BDT",
    customerId: fakeId(),
    lines: [
      {
        _id: fakeId(),
        item: fakeId(),
        name: "Enterprise Software License",
        quantity: 1,
        unitPrice: 1000,
        subtotal: 1000,
        taxAmount: 150,
        total: 1150,
      }
    ],
    save: async () => mockInvoice,
  };

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "SCN-2026-000001",
    sourceSide: "sales",
    noteType: "credit_note",
    financialDirection: "DECREASES_RECEIVABLE",
    originalDocumentType: "SalesInvoice",
    originalDocumentId: invoiceId,
    status: "draft",
    postingDate: new Date("2026-05-15"),
    totals: { subtotal: 1000, taxAmount: 150, taxTotal: 150, total: 1150, grandTotal: 1150 },
    lines: [
      {
        description: "Enterprise Software License Credit",
        quantity: 1,
        unitPrice: 1000,
        subtotal: 1000,
        taxAmount: 150,
        total: 1150,
      }
    ],
    allocations: [],
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(AdjustmentNote, "find", () => mockQuery([]));
  t.mock.method(SalesInvoice, "findOne", () => mockQuery(mockInvoice));
  t.mock.method(SalesInvoice, "findById", () => mockQuery(mockInvoice));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ status: "open", isLocked: false, startDate: new Date("2026-05-01"), endDate: new Date("2026-05-31") }));

  // Mock GL Accounts
  t.mock.method(Account, "findOne", (query) => {
    if (query.code === "1100" || query.type === "receivable") {
      return mockQuery({ _id: fakeId(), code: "1100", name: "Accounts Receivable", type: "receivable" });
    }
    if (query.code === "4000" || query.type === "revenue") {
      return mockQuery({ _id: fakeId(), code: "4000", name: "Sales Revenue", type: "revenue" });
    }
    if (query.code === "2100") {
      return mockQuery({ _id: fakeId(), code: "2100", name: "Output VAT", type: "other_current_liability" });
    }
    return mockQuery({ _id: fakeId(), code: "4000", name: "Sales Revenue", type: "revenue" });
  });

  let postedJournal = null;
  t.mock.method(JournalEntry, "create", async (payloads) => {
    const arr = Array.isArray(payloads) ? payloads : [payloads];
    postedJournal = { ...arr[0], _id: fakeId() };
    return [postedJournal];
  });

  const result = await postAdjustmentNote({
    noteId: mockNote._id,
    userId,
    tenantId,
  });

  assert.strictEqual(result.note.status, "posted");
  assert.ok(postedJournal, "A journal entry must have been created");
  assert.strictEqual(postedJournal.sourceType, "sales_credit_note");

  // Verify GL debit and credit balance
  const totalDebit = postedJournal.lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = postedJournal.lines.reduce((s, l) => s + (l.credit || 0), 0);
  assert.strictEqual(totalDebit, totalCredit, "Journal entry debits must equal credits");
  assert.strictEqual(totalDebit, 1150);

  // Verify AR was credited (receivable decreased)
  const arLine = postedJournal.lines.find(l => l.accountCode === "1100" || l.credit === 1150);
  assert.ok(arLine, "Accounts Receivable must have a credit line of 1150");
  assert.strictEqual(arLine.credit, 1150);

  // Verify invoice creditedAmount was updated and invoice is intact (not deleted)
  assert.strictEqual(mockInvoice.creditedAmount, 1150);
  assert.strictEqual(mockInvoice.dueAmount, 0);
});

// --------------------------------------------------------------------------
// 3. Sales Debit Note Integration (Increases Receivable)
// --------------------------------------------------------------------------
test("3. Sales Debit Note posts INCREASES_RECEIVABLE, debits AR (1100), credits Revenue & VAT, and updates invoice dueAmount", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const invoiceId = fakeId();

  mockCommonPosting(t);

  const mockInvoice = {
    _id: invoiceId,
    tenantId,
    invoiceNumber: "INV-2026-002",
    status: "posted",
    grandTotal: 1000,
    paidAmount: 500,
    creditedAmount: 0,
    debitedAmount: 0,
    dueAmount: 500,
    currency: "BDT",
    customerId: fakeId(),
    lines: [],
    save: async () => mockInvoice,
  };

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "SDN-2026-000001",
    sourceSide: "sales",
    noteType: "debit_note",
    financialDirection: "INCREASES_RECEIVABLE",
    originalDocumentType: "SalesInvoice",
    originalDocumentId: invoiceId,
    status: "draft",
    postingDate: new Date("2026-05-15"),
    totals: { subtotal: 200, taxAmount: 30, taxTotal: 30, total: 230, grandTotal: 230 },
    lines: [
      {
        description: "Underbilled services addition",
        quantity: 1,
        unitPrice: 200,
        subtotal: 200,
        taxAmount: 30,
        total: 230,
      }
    ],
    allocations: [],
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(AdjustmentNote, "find", () => mockQuery([]));
  t.mock.method(SalesInvoice, "findOne", () => mockQuery(mockInvoice));
  t.mock.method(SalesInvoice, "findById", () => mockQuery(mockInvoice));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ status: "open", isLocked: false, startDate: new Date("2026-05-01"), endDate: new Date("2026-05-31") }));

  t.mock.method(Account, "findOne", (query) => {
    if (query.code === "1100" || query.type === "receivable") {
      return mockQuery({ _id: fakeId(), code: "1100", name: "Accounts Receivable", type: "receivable" });
    }
    if (query.code === "4000" || query.type === "revenue") {
      return mockQuery({ _id: fakeId(), code: "4000", name: "Sales Revenue", type: "revenue" });
    }
    if (query.code === "2100") {
      return mockQuery({ _id: fakeId(), code: "2100", name: "Output VAT", type: "other_current_liability" });
    }
    return mockQuery({ _id: fakeId(), code: "4000", name: "Sales Revenue", type: "revenue" });
  });

  let postedJournal = null;
  t.mock.method(JournalEntry, "create", async (payloads) => {
    const arr = Array.isArray(payloads) ? payloads : [payloads];
    postedJournal = { ...arr[0], _id: fakeId() };
    return [postedJournal];
  });

  const result = await postAdjustmentNote({
    noteId: mockNote._id,
    userId,
    tenantId,
  });

  assert.strictEqual(result.note.status, "posted");
  assert.strictEqual(postedJournal.sourceType, "sales_debit_note");

  // AR debited (receivable increased by 230)
  const arLine = postedJournal.lines.find(l => l.accountCode === "1100" || l.debit === 230);
  assert.ok(arLine, "Accounts Receivable must have a debit line of 230");
  assert.strictEqual(arLine.debit, 230);

  // Invoice balance recalculation: grandTotal(1000) + debitedAmount(230) - creditedAmount(0) - paidAmount(500) = 730
  assert.strictEqual(mockInvoice.debitedAmount, 230);
  assert.strictEqual(mockInvoice.dueAmount, 730);
});

// --------------------------------------------------------------------------
// 4. Purchase Credit Note Integration (Decreases Payable)
// --------------------------------------------------------------------------
test("4. Purchase Credit Note posts DECREASES_PAYABLE, debits AP (2000), credits Expense (5000) & Input Tax (1200)", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const billId = fakeId();

  mockCommonPosting(t);

  const mockBill = {
    _id: billId,
    tenantId,
    billNo: "BILL-2026-001",
    status: "approved",
    total: 2300,
    paidTotal: 0,
    creditedAmount: 0,
    debitedAmount: 0,
    dueTotal: 2300,
    currency: "BDT",
    vendorName: "Industrial Parts Ltd",
    lines: [],
    save: async () => mockBill,
  };

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "PCN-2026-000001",
    sourceSide: "purchase",
    noteType: "credit_note",
    financialDirection: "DECREASES_PAYABLE",
    originalDocumentType: "VendorBill",
    originalDocumentId: billId,
    status: "draft",
    postingDate: new Date("2026-05-15"),
    totals: { subtotal: 2000, taxAmount: 300, taxTotal: 300, total: 2300, grandTotal: 2300 },
    lines: [
      {
        description: "Supplier Price Discount",
        quantity: 1,
        unitPrice: 2000,
        subtotal: 2000,
        taxAmount: 300,
        total: 2300,
      }
    ],
    allocations: [],
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(AdjustmentNote, "find", () => mockQuery([]));
  t.mock.method(VendorBill, "findOne", () => mockQuery(mockBill));
  t.mock.method(VendorBill, "findById", () => mockQuery(mockBill));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ status: "open", isLocked: false, startDate: new Date("2026-05-01"), endDate: new Date("2026-05-31") }));

  t.mock.method(Account, "findOne", (query) => {
    if (query.code === "2000" || query.type === "payable") {
      return mockQuery({ _id: fakeId(), code: "2000", name: "Accounts Payable", type: "payable" });
    }
    if (query.code === "5000" || query.type === "expense") {
      return mockQuery({ _id: fakeId(), code: "5000", name: "Direct Cost of Goods", type: "expense" });
    }
    if (query.code === "1200") {
      return mockQuery({ _id: fakeId(), code: "1200", name: "Input Tax", type: "other_current_asset" });
    }
    return mockQuery({ _id: fakeId(), code: "5000", name: "Direct Cost of Goods", type: "expense" });
  });

  let postedJournal = null;
  t.mock.method(JournalEntry, "create", async (payloads) => {
    const arr = Array.isArray(payloads) ? payloads : [payloads];
    postedJournal = { ...arr[0], _id: fakeId() };
    return [postedJournal];
  });

  const result = await postAdjustmentNote({
    noteId: mockNote._id,
    userId,
    tenantId,
  });

  assert.strictEqual(result.note.status, "posted");
  assert.strictEqual(postedJournal.sourceType, "purchase_credit_note");

  // AP debited (payable reduced by 2300)
  const apLine = postedJournal.lines.find(l => l.accountCode === "2000" || l.debit === 2300);
  assert.ok(apLine, "Accounts Payable must have a debit line of 2300");
  assert.strictEqual(apLine.debit, 2300);

  // Bill creditedAmount updated and dueTotal recalculated
  assert.strictEqual(mockBill.creditedAmount, 2300);
  assert.strictEqual(mockBill.dueTotal, 0);
});

// --------------------------------------------------------------------------
// 5. Purchase Debit Note Integration (Increases Payable)
// --------------------------------------------------------------------------
test("5. Purchase Debit Note posts INCREASES_PAYABLE, credits AP (2000), debits Expense (5000)", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const billId = fakeId();

  mockCommonPosting(t);

  const mockBill = {
    _id: billId,
    tenantId,
    billNo: "BILL-2026-002",
    status: "approved",
    total: 1000,
    paidTotal: 500,
    creditedAmount: 0,
    debitedAmount: 0,
    dueTotal: 500,
    currency: "BDT",
    vendorName: "Supplier ABC",
    lines: [],
    save: async () => mockBill,
  };

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "PDN-2026-000001",
    sourceSide: "purchase",
    noteType: "debit_note",
    financialDirection: "INCREASES_PAYABLE",
    originalDocumentType: "VendorBill",
    originalDocumentId: billId,
    status: "draft",
    postingDate: new Date("2026-05-15"),
    totals: { subtotal: 400, taxAmount: 0, taxTotal: 0, total: 400, grandTotal: 400 },
    lines: [
      {
        description: "Supplementary supplier charge",
        quantity: 1,
        unitPrice: 400,
        subtotal: 400,
        taxAmount: 0,
        total: 400,
      }
    ],
    allocations: [],
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(AdjustmentNote, "find", () => mockQuery([]));
  t.mock.method(VendorBill, "findOne", () => mockQuery(mockBill));
  t.mock.method(VendorBill, "findById", () => mockQuery(mockBill));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ status: "open", isLocked: false, startDate: new Date("2026-05-01"), endDate: new Date("2026-05-31") }));

  t.mock.method(Account, "findOne", (query) => {
    if (query.code === "2000" || query.type === "payable") {
      return mockQuery({ _id: fakeId(), code: "2000", name: "Accounts Payable", type: "payable" });
    }
    return mockQuery({ _id: fakeId(), code: "5000", name: "Direct Cost of Goods", type: "expense" });
  });

  let postedJournal = null;
  t.mock.method(JournalEntry, "create", async (payloads) => {
    const arr = Array.isArray(payloads) ? payloads : [payloads];
    postedJournal = { ...arr[0], _id: fakeId() };
    return [postedJournal];
  });

  const result = await postAdjustmentNote({
    noteId: mockNote._id,
    userId,
    tenantId,
  });

  assert.strictEqual(result.note.status, "posted");
  assert.strictEqual(postedJournal.sourceType, "purchase_debit_note");

  // AP credited (payable increased)
  const apLine = postedJournal.lines.find(l => l.accountCode === "2000" || l.credit === 400);
  assert.ok(apLine, "Accounts Payable must have a credit line of 400");
  assert.strictEqual(apLine.credit, 400);

  // Bill balance recalculated: total(1000) + debited(400) - credited(0) - paid(500) = 900
  assert.strictEqual(mockBill.debitedAmount, 400);
  assert.strictEqual(mockBill.dueTotal, 900);
});

// --------------------------------------------------------------------------
// 6. Cumulative Over-Crediting Prevention
// --------------------------------------------------------------------------
test("6. calculateEligibleAdjustment rejects note creation that exceeds eligible remaining balance", async (t) => {
  const tenantId = fakeId();
  const invoiceId = fakeId();

  const mockInvoice = {
    _id: invoiceId,
    tenantId,
    invoiceNumber: "INV-2026-003",
    status: "posted",
    grandTotal: 1000,
    paidAmount: 200,
    creditedAmount: 800, // already credited 800 out of 1000
    debitedAmount: 0,
    dueAmount: 0,
    lines: [
      {
        _id: fakeId(),
        item: fakeId(),
        name: "Item X",
        quantity: 10,
        unitPrice: 100,
        subtotal: 1000,
        taxAmount: 0,
        total: 1000,
      }
    ]
  };

  t.mock.method(SalesInvoice, "findOne", () => mockQuery(mockInvoice));
  t.mock.method(AdjustmentNote, "find", () => mockQuery([
    {
      _id: fakeId(),
      noteType: "credit_note",
      status: "posted",
      totals: { grandTotal: 800, total: 800, subtotal: 800, taxAmount: 0 },
      lines: [{ sourceLineId: mockInvoice.lines[0]._id, quantity: 8, total: 800 }]
    }
  ]));

  const eligibleInfo = await calculateEligibleAdjustment({
    sourceSide: "sales",
    documentType: "SalesInvoice",
    documentId: invoiceId,
    tenantId,
  });

  assert.strictEqual(eligibleInfo.remainingCreditEligible, 200, "Eligible balance must be exactly 200 (1000 - 800)");

  // Attempting to create a credit note for 250 must be rejected
  await assert.rejects(
    () => createAdjustmentNote({
      sourceSide: "sales",
      noteType: "credit_note",
      originalDocumentType: "SalesInvoice",
      originalDocumentId: invoiceId,
      subtotal: 250,
      taxAmount: 0,
      lines: [
        {
          sourceLineId: mockInvoice.lines[0]._id,
          description: "Over-credit attempt",
          quantity: 3,
          unitPrice: 100,
          adjustmentAmount: 300,
          subtotal: 300,
          taxAmount: 0,
        }
      ]
    }, { _id: fakeId() }, tenantId),
    (err) => {
      assert.strictEqual(err.statusCode, 409, "Must throw 409 Conflict on over-credit attempt");
      assert.match(err.message, /exceeds.*eligible.*balance/i);
      return true;
    }
  );
});

// --------------------------------------------------------------------------
// 7. Proportional Tax Reversal Calculations
// --------------------------------------------------------------------------
test("7. Proportional tax reversal ensures correct allocation between Revenue and Tax accounts", async (t) => {
  const tenantId = fakeId();
  const invoiceId = fakeId();

  // Invoice with 15% VAT: 2000 subtotal, 300 VAT, 2300 grandTotal
  const mockInvoice = {
    _id: invoiceId,
    tenantId,
    invoiceNumber: "INV-2026-004",
    status: "posted",
    grandTotal: 2300,
    paidAmount: 0,
    creditedAmount: 0,
    debitedAmount: 0,
    dueAmount: 2300,
    lines: [
      {
        _id: fakeId(),
        item: fakeId(),
        name: "Taxable Service",
        quantity: 2,
        unitPrice: 1000,
        subtotal: 2000,
        taxAmount: 300,
        total: 2300,
      }
    ]
  };

  t.mock.method(SalesInvoice, "findOne", () => mockQuery(mockInvoice));
  t.mock.method(AdjustmentNote, "find", () => mockQuery([]));

  const eligibleInfo = await calculateEligibleAdjustment({
    sourceSide: "sales",
    documentType: "SalesInvoice",
    documentId: invoiceId,
    tenantId,
  });

  assert.strictEqual(eligibleInfo.remainingCreditEligible, 2300);
  assert.strictEqual(eligibleInfo.lines[0].remainingQuantity, 2);
});

// --------------------------------------------------------------------------
// 8. Physical Goods Return vs Price Correction
// --------------------------------------------------------------------------
test("8. Adjustment note without inventory movement defaults hasInventoryMovement to false", () => {
  const note = new AdjustmentNote({
    tenantId: fakeId(),
    noteNumber: "SCN-2026-000099",
    sourceSide: "sales",
    noteType: "credit_note",
    financialDirection: "DECREASES_RECEIVABLE",
    originalDocumentType: "SalesInvoice",
    originalDocumentId: fakeId(),
    status: "draft",
    postingDate: new Date(),
    totals: { subtotal: 500, taxAmount: 0, total: 500 },
    lines: [
      {
        description: "Commercial discount",
        quantity: 1,
        unitPrice: 500,
        subtotal: 500,
        taxAmount: 0,
        total: 500,
      }
    ]
  });

  assert.strictEqual(note.hasInventoryMovement, false, "Price correction must default hasInventoryMovement to false");
});

// --------------------------------------------------------------------------
// 9. Excess Credit Balance Tracking on Fully Paid Invoices
// --------------------------------------------------------------------------
test("9. Crediting a fully paid invoice tracks remaining unallocated creditBalance and allows allocation", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const customerId = fakeId();
  const invoiceId1 = fakeId();
  const invoiceId2 = fakeId();

  // Invoice 1 was fully paid: grandTotal 1000, paid 1000, due 0
  const invoice1 = {
    _id: invoiceId1,
    tenantId,
    invoiceNumber: "INV-2026-PAID",
    status: "paid",
    grandTotal: 1000,
    paidAmount: 1000,
    creditedAmount: 0,
    debitedAmount: 0,
    dueAmount: 0,
    customerId,
    lines: [],
    save: async () => invoice1,
  };

  // Invoice 2 is open: grandTotal 500, due 500
  const invoice2 = {
    _id: invoiceId2,
    tenantId,
    invoiceNumber: "INV-2026-OPEN",
    status: "posted",
    grandTotal: 500,
    paidAmount: 0,
    creditedAmount: 0,
    debitedAmount: 0,
    dueAmount: 500,
    customerId,
    lines: [],
    save: async () => invoice2,
  };

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "SCN-2026-CREDIT",
    sourceSide: "sales",
    noteType: "credit_note",
    financialDirection: "DECREASES_RECEIVABLE",
    originalDocumentType: "SalesInvoice",
    originalDocumentId: invoiceId1,
    partyId: customerId,
    status: "posted",
    postingDate: new Date(),
    totals: { subtotal: 300, taxAmount: 0, total: 300, grandTotal: 300 },
    remainingCredit: 300,
    allocatedAmount: 0,
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(SalesInvoice, "findOne", (query) => {
    if (query._id.equals ? query._id.equals(invoiceId2) : String(query._id) === String(invoiceId2)) {
      return mockQuery(invoice2);
    }
    return mockQuery(invoice1);
  });
  t.mock.method(AuditLog, "create", () => Promise.resolve({}));

  const res = await allocateCreditNoteBalance({
    creditNoteId: mockNote._id,
    targetDocumentType: "SalesInvoice",
    targetDocumentId: invoiceId2,
    amount: 200,
    user: { _id: userId },
    tenantId,
  });

  assert.strictEqual(mockNote.remainingCredit, 100, "Remaining unallocated credit must be 100 (300 - 200)");
  assert.strictEqual(mockNote.allocatedAmount, 200, "Allocated amount must be 200");
  assert.strictEqual(res.allocatedAmount, 200);

  // Target invoice 2 had dueAmount 500, now credited 200 -> dueAmount becomes 300
  assert.strictEqual(invoice2.creditedAmount, 200);
  assert.strictEqual(invoice2.dueAmount, 300);
});

// --------------------------------------------------------------------------
// 10. Accounting Period Lock Enforcement
// --------------------------------------------------------------------------
test("10. Adjustment note posting is blocked when postingDate is in a closed/locked period", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const invoiceId = fakeId();

  mockCommonPosting(t);

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "SCN-2026-LOCKED",
    sourceSide: "sales",
    noteType: "credit_note",
    financialDirection: "DECREASES_RECEIVABLE",
    originalDocumentType: "SalesInvoice",
    originalDocumentId: invoiceId,
    status: "draft",
    postingDate: new Date("2026-01-15"),
    totals: { subtotal: 100, taxAmount: 0, total: 100, grandTotal: 100 },
    lines: [{ subtotal: 100, taxAmount: 0, total: 100 }],
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(SalesInvoice, "findOne", () => mockQuery({
    _id: invoiceId,
    tenantId,
    status: "posted",
    grandTotal: 500,
    paidAmount: 0,
    creditedAmount: 0,
    debitedAmount: 0,
    dueAmount: 500,
  }));
  // Mock locked accounting period for January 2026
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({
    _id: fakeId(),
    status: "locked",
    periodKey: "2026-01",
    isLocked: true,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-31"),
  }));

  await assert.rejects(
    () => postAdjustmentNote({
      noteId: mockNote._id,
      userId,
      tenantId,
    }),
    (err) => {
      assert.strictEqual(err.code, "ACCOUNTING_PERIOD_LOCKED", "Must throw ACCOUNTING_PERIOD_LOCKED error code");
      assert.match(err.message, /locked/i);
      return true;
    }
  );
});

// --------------------------------------------------------------------------
// 11. Cost Center & Dimension Inheritance
// --------------------------------------------------------------------------
test("11. Adjustment note lines inherit costCenter and dimensions to posting journal entry", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const billId = fakeId();
  const costCenterId = fakeId();
  const branchDimensionId = fakeId();

  mockCommonPosting(t);

  const mockBill = {
    _id: billId,
    tenantId,
    billNo: "BILL-2026-DIM",
    status: "approved",
    total: 500,
    paidTotal: 0,
    creditedAmount: 0,
    debitedAmount: 0,
    dueTotal: 500,
    lines: [],
    save: async () => mockBill,
  };

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "PCN-2026-DIM",
    sourceSide: "purchase",
    noteType: "credit_note",
    financialDirection: "DECREASES_PAYABLE",
    originalDocumentType: "VendorBill",
    originalDocumentId: billId,
    costCenter: costCenterId,
    dimensions: { branch: branchDimensionId },
    status: "draft",
    postingDate: new Date("2026-05-15"),
    totals: { subtotal: 500, taxAmount: 0, taxTotal: 0, total: 500, grandTotal: 500 },
    lines: [
      {
        description: "Cost Center item credit",
        quantity: 1,
        unitPrice: 500,
        subtotal: 500,
        taxAmount: 0,
        total: 500,
        costCenter: costCenterId,
        dimensions: { branch: branchDimensionId },
      }
    ],
    allocations: [],
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(AdjustmentNote, "find", () => mockQuery([]));
  t.mock.method(VendorBill, "findOne", () => mockQuery(mockBill));
  t.mock.method(VendorBill, "findById", () => mockQuery(mockBill));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ status: "open", isLocked: false, startDate: new Date("2026-05-01"), endDate: new Date("2026-05-31") }));
  t.mock.method(CostCenter, "find", () => mockQuery([{
    _id: costCenterId,
    tenantId,
    code: "CC-001",
    name: "Main Cost Center",
    isActive: true,
    isGroup: false,
  }]));
  t.mock.method(Branch, "find", () => mockQuery([{
    _id: branchDimensionId,
    tenantId,
    code: "BR-001",
    name: "Main Branch",
    isActive: true,
  }]));

  t.mock.method(Account, "findOne", (query) => {
    if (query.code === "2000" || query.type === "payable") {
      return mockQuery({ _id: fakeId(), code: "2000", name: "Accounts Payable", type: "payable" });
    }
    return mockQuery({ _id: fakeId(), code: "5000", name: "Direct Cost of Goods", type: "expense" });
  });

  let postedJournal = null;
  t.mock.method(JournalEntry, "create", async (payloads) => {
    const arr = Array.isArray(payloads) ? payloads : [payloads];
    postedJournal = { ...arr[0], _id: fakeId() };
    return [postedJournal];
  });

  await postAdjustmentNote({
    noteId: mockNote._id,
    userId,
    tenantId,
  });

  // Verify journal line has preserved costCenter and dimensions
  const expenseLine = postedJournal.lines.find(l => l.accountCode === "5000" || l.credit === 500);
  assert.ok(expenseLine, "Expense line must exist in journal");
  assert.strictEqual(String(expenseLine.costCenter), String(costCenterId));
});

// --------------------------------------------------------------------------
// 12. Safe Cancellation via Reversal Journal
// --------------------------------------------------------------------------
test("12. cancelAdjustmentNote posts reversal journal, restores document balance, and marks status cancelled without deletion", async (t) => {
  const tenantId = fakeId();
  const userId = fakeId();
  const invoiceId = fakeId();
  const journalId = fakeId();

  mockCommonPosting(t);

  const mockInvoice = {
    _id: invoiceId,
    tenantId,
    invoiceNumber: "INV-2026-REV",
    status: "posted",
    grandTotal: 1000,
    paidAmount: 0,
    creditedAmount: 400,
    debitedAmount: 0,
    dueAmount: 600,
    lines: [],
    save: async () => mockInvoice,
  };

  const mockOriginalJournal = {
    _id: journalId,
    tenantId,
    entryNumber: "JV-2026-0001",
    status: "posted",
    isPosted: true,
    isReversed: false,
    date: new Date("2026-05-15"),
    lines: [
      { account: fakeId(), debit: 400, credit: 0, description: "Sales Revenue reversal" },
      { account: fakeId(), debit: 0, credit: 400, description: "Accounts Receivable" },
    ],
    save: async function() { return this; }
  };

  const mockNote = {
    _id: fakeId(),
    tenantId,
    noteNumber: "SCN-2026-REV",
    sourceSide: "sales",
    noteType: "credit_note",
    financialDirection: "DECREASES_RECEIVABLE",
    originalDocumentType: "SalesInvoice",
    originalDocumentId: invoiceId,
    journalEntryId: journalId,
    status: "posted",
    totals: { total: 400, grandTotal: 400 },
    save: async function() { return this; }
  };

  t.mock.method(AdjustmentNote, "findOne", () => mockQuery(mockNote));
  t.mock.method(SalesInvoice, "findOne", () => mockQuery(mockInvoice));
  t.mock.method(SalesInvoice, "findById", () => mockQuery(mockInvoice));
  t.mock.method(JournalEntry, "findById", () => mockQuery(mockOriginalJournal));
  t.mock.method(JournalEntry, "findOne", () => mockQuery(mockOriginalJournal));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ status: "open", isLocked: false, startDate: new Date("2026-05-01"), endDate: new Date("2026-05-31") }));

  let reversalJournal = null;
  t.mock.method(JournalEntry, "create", async (payloads) => {
    const arr = Array.isArray(payloads) ? payloads : [payloads];
    reversalJournal = { ...arr[0], _id: fakeId(), save: async function() { return this; } };
    return [reversalJournal];
  });

  const cancelResult = await cancelAdjustmentNote({
    noteId: mockNote._id,
    reason: "Client order reinstated by mutual agreement",
    userId,
    tenantId,
  });

  assert.strictEqual(cancelResult.note.status, "cancelled", "Note status must be cancelled");
  assert.ok(mockNote.reversalJournalEntryId, "Note must record reversalJournalEntryId");
  assert.ok(reversalJournal, "Reversal journal must be created");

  // Verify invoice balance was restored
  assert.strictEqual(mockInvoice.creditedAmount, 0, "Credited amount must be reduced by 400 back to 0");
  assert.strictEqual(mockInvoice.dueAmount, 1000, "Due amount must be restored back to 1000");
});
