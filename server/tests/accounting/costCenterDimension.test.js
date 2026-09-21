import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import CostCenter from "../../models/accounting/costCenter.model.js";
import AccountingDimension from "../../models/accounting/accountingDimension.model.js";
import AccountingDimensionValue from "../../models/accounting/accountingDimensionValue.model.js";
import JournalEntry from "../../models/accounting/journalEntry.model.js";
import Expense from "../../models/accounting/expense.model.js";
import Account from "../../models/account.model.js";
import AccountingPeriod from "../../models/accountingPeriod.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import FiscalYear from "../../models/fiscalYear.model.js";
import VoucherType from "../../models/voucherType.model.js";
import VoucherSequence from "../../models/voucherSequence.model.js";
import Branch from "../../models/branch.model.js";
import Department from "../../models/department.model.js";

import {
  resolveTenantId,
  ensureSystemDimensions,
  validateCostCenterHierarchy,
  getCostCenterTree,
  validatePostingDimensions,
} from "../../services/accounting/accountingDimension.service.js";

import {
  createPostedJournal,
  createReversalJournal,
} from "../../services/accounting/accountingPosting.service.js";

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

function mockSettings(t) {
  t.mock.method(AccountingSettings, "findOne", () => mockQuery(null));
  t.mock.method(AccountingSettings, "exists", () => Promise.resolve(false));
  t.mock.method(Account, "distinct", () => mockQuery([]));
  t.mock.method(VoucherSequence, "findOneAndUpdate", () => mockQuery({ value: 1 }));
}

// --------------------------------------------------------------------------
// 1. CostCenter Model Schema & Index Invariants
// --------------------------------------------------------------------------
test("1. CostCenter schema defines required hierarchical and multi-tenant fields", () => {
  const schema = CostCenter.schema;
  assert.ok(schema.path("code"), "CostCenter must have code");
  assert.ok(schema.path("name"), "CostCenter must have name");
  assert.ok(schema.path("isGroup"), "CostCenter must have isGroup flag");
  assert.ok(schema.path("isActive"), "CostCenter must have isActive flag");
  assert.ok(schema.path("parentCostCenter"), "CostCenter must have parentCostCenter reference");
  assert.ok(schema.path("tenantId"), "CostCenter must have tenantId reference");
  assert.ok(schema.path("description"), "CostCenter must have description");

  // Verify compound unique index on tenantId + code
  const indexes = schema.indexes();
  const hasTenantCodeIndex = indexes.some(
    ([fields, options]) => fields.tenantId === 1 && fields.code === 1 && options?.unique
  );
  assert.ok(hasTenantCodeIndex, "CostCenter must have unique compound index on { tenantId: 1, code: 1 }");
});

// --------------------------------------------------------------------------
// 2. Cost Center Hierarchy & Cycle Detection
// --------------------------------------------------------------------------
test("2. validateCostCenterHierarchy rejects self-referencing parent", async () => {
  const selfId = fakeId();
  const tenantId = fakeId();
  await assert.rejects(
    () => validateCostCenterHierarchy({
      costCenterId: selfId,
      parentCostCenterId: selfId,
      tenantId,
    }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /cannot be its own parent/i);
      return true;
    }
  );
});

test("3. validateCostCenterHierarchy rejects non-existent parent", async (t) => {
  t.mock.method(CostCenter, "findOne", () => mockQuery(null));

  const tenantId = fakeId();
  const parentId = fakeId();
  await assert.rejects(
    () => validateCostCenterHierarchy({
      costCenterId: fakeId(),
      parentCostCenterId: parentId,
      tenantId,
    }),
    (err) => {
      assert.strictEqual(err.statusCode, 404);
      assert.match(err.message, /Parent cost center not found/i);
      return true;
    }
  );
});

test("4. validateCostCenterHierarchy rejects cross-tenant parent", async (t) => {
  const tenantA = fakeId();
  const parentId = fakeId();

  // Query searches for { _id: parentId, tenantId: tenantA }. Since it's in tenantB, findOne returns null.
  t.mock.method(CostCenter, "findOne", () => mockQuery(null));

  await assert.rejects(
    () => validateCostCenterHierarchy({
      costCenterId: fakeId(),
      parentCostCenterId: parentId,
      tenantId: tenantA,
    }),
    (err) => {
      assert.strictEqual(err.statusCode, 404);
      assert.match(err.message, /Parent cost center not found or belongs to another company/i);
      return true;
    }
  );
});

test("5. validateCostCenterHierarchy rejects circular parent references (A -> B -> A)", async (t) => {
  const nodeA = fakeId();
  const nodeB = fakeId();
  const tenantId = fakeId();

  // Node B's parent is Node A. Now setting Node A's parent to Node B.
  t.mock.method(CostCenter, "findOne", () => mockQuery({
    _id: nodeB,
    name: "Node B",
    tenantId,
    parentCostCenter: nodeA,
  }));

  await assert.rejects(
    () => validateCostCenterHierarchy({
      costCenterId: nodeA,
      parentCostCenterId: nodeB,
      tenantId,
    }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Cyclic cost center hierarchy detected/i);
      return true;
    }
  );
});

test("6. getCostCenterTree builds nested tree hierarchy with children", async (t) => {
  const rootId = fakeId();
  const child1Id = fakeId();
  const child2Id = fakeId();
  const subChildId = fakeId();
  const tenantId = fakeId();

  const flatList = [
    { _id: rootId, code: "100", name: "Operations", isGroup: true, parentCostCenter: null },
    { _id: child1Id, code: "110", name: "Plant A", isGroup: true, parentCostCenter: rootId },
    { _id: subChildId, code: "111", name: "Milling Line", isGroup: false, parentCostCenter: child1Id },
    { _id: child2Id, code: "120", name: "Warehouse HQ", isGroup: false, parentCostCenter: rootId },
  ];

  t.mock.method(CostCenter, "find", () => mockQuery(flatList));

  const tree = await getCostCenterTree({ tenantId });
  assert.strictEqual(tree.length, 1, "Should have 1 top-level root");
  assert.strictEqual(tree[0].code, "100");
  assert.strictEqual(tree[0].children.length, 2, "Root should have 2 children");
  assert.strictEqual(tree[0].children[0].children.length, 1, "Plant A should have 1 sub-child");
  assert.strictEqual(tree[0].children[0].children[0].code, "111");
});

// --------------------------------------------------------------------------
// 3. AccountingDimension Model & System Dimensions
// --------------------------------------------------------------------------
test("7. AccountingDimension schema defines type, applicability, and validation rules", () => {
  const schema = AccountingDimension.schema;
  assert.ok(schema.path("name"), "AccountingDimension must have name");
  assert.ok(schema.path("code"), "AccountingDimension must have code");
  assert.ok(schema.path("sourceType"), "AccountingDimension must have sourceType");
  assert.ok(schema.path("isSystem"), "AccountingDimension must have isSystem");
  assert.ok(schema.path("isRequired"), "AccountingDimension must have isRequired");
  assert.ok(schema.path("applicableAccountTypes"), "AccountingDimension must have applicableAccountTypes");

  const sources = schema.path("sourceType").enumValues;
  assert.ok(sources.includes("cost_center"), "Must include cost_center source");
  assert.ok(sources.includes("custom_values"), "Must include custom_values source");
});

test("8. ensureSystemDimensions bootstraps all 4 core system dimensions idempotently", async (t) => {
  let created = [];
  t.mock.method(AccountingDimension, "find", () => mockQuery(created));
  t.mock.method(AccountingDimension, "insertMany", (docs) => {
    created = [...docs];
    return Promise.resolve(docs);
  });

  const tenantId = fakeId();
  await ensureSystemDimensions({ tenantId });

  assert.strictEqual(created.length, 4, "Should create cost_center, branch, department, and project");
  const codes = created.map((d) => d.code);
  assert.ok(codes.includes("cost_center"));
  assert.ok(codes.includes("branch"));
  assert.ok(codes.includes("department"));
  assert.ok(codes.includes("project"));
});

// --------------------------------------------------------------------------
// 4. validatePostingDimensions Rules
// --------------------------------------------------------------------------
test("9. validatePostingDimensions allows backward compatible unassigned lines", async (t) => {
  const tenantId = fakeId();
  t.mock.method(AccountingDimension, "find", () => mockQuery([]));
  t.mock.method(Account, "find", () => mockQuery([]));

  const accountId = fakeId();
  const lines = [
    { account: accountId, debit: 500, credit: 0, description: "Office supplies" },
    { account: accountId, debit: 0, credit: 500, description: "Cash paid" },
  ];

  const validated = await validatePostingDimensions({ lines, tenantId });
  assert.strictEqual(validated.length, 2);
  assert.strictEqual(validated[0].costCenter, null);
  assert.strictEqual(validated[0].branch, null);
});

test("10. validatePostingDimensions blocks posting to a group cost center (leaf-only rule)", async (t) => {
  const groupCostCenterId = fakeId();
  const tenantId = fakeId();

  t.mock.method(AccountingDimension, "find", () => mockQuery([]));
  t.mock.method(Account, "find", () => mockQuery([]));
  t.mock.method(CostCenter, "find", () => mockQuery([
    { _id: groupCostCenterId, code: "CC-GRP", name: "Corporate Overhead", isGroup: true, isActive: true, tenantId },
  ]));

  const lines = [
    { account: fakeId(), debit: 100, credit: 0, costCenter: groupCostCenterId },
  ];

  await assert.rejects(
    () => validatePostingDimensions({ lines, tenantId }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Cannot post directly to group cost center/);
      return true;
    }
  );
});

test("11. validatePostingDimensions blocks cost center belonging to a different tenant", async (t) => {
  const foreignCostCenterId = fakeId();
  const tenantA = fakeId();
  const tenantB = fakeId();

  t.mock.method(AccountingDimension, "find", () => mockQuery([]));
  t.mock.method(Account, "find", () => mockQuery([]));
  t.mock.method(CostCenter, "find", () => mockQuery([
    { _id: foreignCostCenterId, code: "CC-B", name: "Branch B", isGroup: false, isActive: true, tenantId: tenantB },
  ]));

  const lines = [
    { account: fakeId(), debit: 250, credit: 0, costCenter: foreignCostCenterId },
  ];

  await assert.rejects(
    () => validatePostingDimensions({ lines, tenantId: tenantA }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Cost center not found or belongs to another company/);
      return true;
    }
  );
});

test("12. validatePostingDimensions enforces mandatory dimension when configured", async (t) => {
  const tenantId = fakeId();
  const expenseAccountId = fakeId();

  t.mock.method(AccountingDimension, "find", () => mockQuery([
    {
      _id: fakeId(),
      code: "cost_center",
      name: "Cost Center",
      isRequired: true,
      applicableAccountTypes: ["expense"],
      isActive: true,
    },
  ]));

  t.mock.method(Account, "find", () => mockQuery([
    { _id: expenseAccountId, code: "5000", name: "General Expense", type: "expense" },
  ]));

  const lines = [
    { account: expenseAccountId, debit: 400, credit: 0, description: "Missing cost center" },
  ];

  await assert.rejects(
    () => validatePostingDimensions({ lines, tenantId }),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, "ACCOUNTING_DIMENSION_REQUIRED");
      assert.match(err.message, /Dimension 'Cost Center' is required/);
      return true;
    }
  );
});

// --------------------------------------------------------------------------
// 5. Journal Posting & Reversal Engine Integration
// --------------------------------------------------------------------------
test("13. createPostedJournal propagates cost center and dimensions into saved journal lines", async (t) => {
  mockSettings(t);
  const ccId = fakeId();
  const branchId = fakeId();
  const deptId = fakeId();
  const accountA = fakeId();
  const accountB = fakeId();
  const periodId = fakeId();
  const fyId = fakeId();
  const tenantId = fakeId();

  t.mock.method(FiscalYear, "exists", () => Promise.resolve(true));
  t.mock.method(AccountingPeriod, "exists", () => Promise.resolve(true));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ _id: periodId, fiscalYearRef: fyId, status: "open" }));
  t.mock.method(FiscalYear, "findOne", () => mockQuery({ _id: fyId, status: "open" }));
  t.mock.method(VoucherType, "findOne", () => mockQuery({ numberingRule: "journal" }));

  t.mock.method(Account, "find", () => mockQuery([
    { _id: accountA, code: "5000", name: "Expense", type: "expense", isActive: true, isGroup: false },
    { _id: accountB, code: "1000", name: "Cash", type: "asset", isActive: true, isGroup: false },
  ]));
  t.mock.method(CostCenter, "find", () => mockQuery([
    { _id: ccId, code: "CC-101", name: "Marketing Dept", isGroup: false, isActive: true, tenantId },
  ]));
  t.mock.method(Branch, "find", () => mockQuery([
    { _id: branchId, code: "BR-01", name: "HQ Branch", isActive: true, tenantId },
  ]));
  t.mock.method(Department, "find", () => mockQuery([
    { _id: deptId, name: "Marketing", isActive: true, tenantId },
  ]));
  t.mock.method(AccountingDimension, "find", () => mockQuery([]));

  let savedEntry = null;
  t.mock.method(JournalEntry, "create", (docs) => {
    const result = (Array.isArray(docs) ? docs : [docs]).map((d) => ({
      ...d,
      _id: fakeId(),
    }));
    savedEntry = result[0];
    return Promise.resolve(result);
  });

  await createPostedJournal({
    tenantId,
    date: new Date(),
    lines: [
      { account: accountA, debit: 1500, credit: 0, costCenter: ccId, branch: branchId, department: deptId },
      { account: accountB, debit: 0, credit: 1500 },
    ],
    sourceType: "manual",
    memo: "Marketing campaign payment",
    allowClosedPeriod: true,
  });

  assert.ok(savedEntry, "Journal entry should have been saved");
  assert.strictEqual(savedEntry.lines[0].costCenter.toString(), ccId.toString());
  assert.strictEqual(savedEntry.lines[0].branch.toString(), branchId.toString());
  assert.strictEqual(savedEntry.lines[0].department.toString(), deptId.toString());
  assert.strictEqual(savedEntry.lines[1].costCenter, null);
});

test("14. createReversalJournal faithfully preserves cost center and dimensions on opposite lines", async (t) => {
  mockSettings(t);
  const ccId = fakeId();
  const branchId = fakeId();
  const deptId = fakeId();
  const originalEntryId = fakeId();
  const accountA = fakeId();
  const accountB = fakeId();
  const periodId = fakeId();
  const fyId = fakeId();
  const tenantId = fakeId();

  const originalJournal = {
    _id: originalEntryId,
    entryNo: "JV-2026-0001",
    date: new Date(),
    status: "posted",
    currency: "BDT",
    voucherType: "journal",
    tenantId,
    totalDebit: 800,
    totalCredit: 800,
    lines: [
      {
        account: accountA,
        debit: 800,
        credit: 0,
        description: "Ad spend",
        costCenter: ccId,
        branch: branchId,
        department: deptId,
        dimensions: new Map([["region", "North"]]),
      },
      {
        account: accountB,
        debit: 0,
        credit: 800,
        description: "Cash out",
        costCenter: null,
      },
    ],
  };

  originalJournal.save = () => Promise.resolve();

  t.mock.method(FiscalYear, "exists", () => Promise.resolve(true));
  t.mock.method(AccountingPeriod, "exists", () => Promise.resolve(true));
  t.mock.method(JournalEntry, "findById", () => mockQuery(originalJournal));
  t.mock.method(AccountingPeriod, "findOne", () => mockQuery({ _id: periodId, fiscalYearRef: fyId, status: "open" }));
  t.mock.method(FiscalYear, "findOne", () => mockQuery({ _id: fyId, status: "open" }));
  t.mock.method(VoucherType, "findOne", () => mockQuery({ numberingRule: "journal" }));

  t.mock.method(Account, "find", () => mockQuery([
    { _id: accountA, code: "5000", name: "Expense", type: "expense", isActive: true, isGroup: false },
    { _id: accountB, code: "1000", name: "Cash", type: "asset", isActive: true, isGroup: false },
  ]));
  t.mock.method(CostCenter, "find", () => mockQuery([
    { _id: ccId, code: "CC-101", name: "Marketing", isGroup: false, isActive: true, tenantId },
  ]));
  t.mock.method(Branch, "find", () => mockQuery([
    { _id: branchId, code: "BR-01", name: "HQ Branch", isActive: true, tenantId },
  ]));
  t.mock.method(Department, "find", () => mockQuery([
    { _id: deptId, name: "Marketing", isActive: true, tenantId },
  ]));
  t.mock.method(AccountingDimension, "find", () => mockQuery([]));

  let savedReversal = null;
  t.mock.method(JournalEntry, "create", (docs) => {
    const result = (Array.isArray(docs) ? docs : [docs]).map((d) => ({
      ...d,
      _id: fakeId(),
      save: () => Promise.resolve(),
    }));
    savedReversal = result[0];
    return Promise.resolve(result);
  });
  t.mock.method(JournalEntry, "updateOne", () => Promise.resolve({ acknowledged: true }));

  await createReversalJournal({
    originalJournalId: originalEntryId,
    reason: "Wrong campaign allocation",
    allowClosedPeriod: true,
  });

  assert.ok(savedReversal, "Reversal entry should be saved");
  // Original line 0 (debit: 800) becomes credit: 800 in reversal
  assert.strictEqual(savedReversal.lines[0].credit, 800);
  assert.strictEqual(savedReversal.lines[0].costCenter.toString(), ccId.toString());
  assert.strictEqual(savedReversal.lines[0].branch.toString(), branchId.toString());
  assert.strictEqual(savedReversal.lines[0].department.toString(), deptId.toString());
});

// --------------------------------------------------------------------------
// 6. Cross-Module Model Extension Verification
// --------------------------------------------------------------------------
test("15. Expense model schema has costCenter, department, and dimensions fields", () => {
  const schema = Expense.schema;
  assert.ok(schema.path("costCenter"), "Expense must have costCenter field");
  assert.ok(schema.path("department"), "Expense must have department field");
  assert.ok(schema.path("dimensions"), "Expense must have dimensions field");
});

test("16. JournalEntry model schema has lines.costCenter, branch, department, and dimensions", () => {
  const schema = JournalEntry.schema;
  assert.ok(schema.path("lines.costCenter"), "JournalEntry lines must have costCenter");
  assert.ok(schema.path("lines.branch"), "JournalEntry lines must have branch");
  assert.ok(schema.path("lines.department"), "JournalEntry lines must have department");
  assert.ok(schema.path("lines.dimensions"), "JournalEntry lines must have dimensions");

  // Check compound indexes
  const indexes = schema.indexes();
  const hasCostCenterIndex = indexes.some(([fields]) => fields.tenantId === 1 && fields["lines.costCenter"] === 1);
  const hasBranchIndex = indexes.some(([fields]) => fields.tenantId === 1 && fields["lines.branch"] === 1);
  assert.ok(hasCostCenterIndex, "JournalEntry must index tenantId + lines.costCenter");
  assert.ok(hasBranchIndex, "JournalEntry must index tenantId + lines.branch");
});
