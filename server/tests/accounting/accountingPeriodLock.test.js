import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import AccountingPeriod from "../../models/accountingPeriod.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";
import FiscalYear from "../../models/fiscalYear.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import BankReconciliation from "../../models/bankReconciliation.model.js";
import AuditLog from "../../models/auditLog.model.js";
import SalesOrder from "../../models/sales/salesOrder.model.js";
import PurchaseOrder from "../../models/purchaseOrder.model.js";
import {
  PERIOD_STATES,
  PERIOD_ERROR_CODES,
  resolveCompanyId,
  parsePostingDate,
  validatePostingDate,
  assertAccountingPeriodOpen,
  assertTransactionMutationAllowed,
  softClosePeriod,
  closePeriod,
  lockPeriod,
  reopenPeriod,
  unlockPeriod,
} from "../../services/accounting/accountingPeriod.service.js";

// Helper for test ObjectId
const fakeId = () => new mongoose.Types.ObjectId();

function mockCommonDependencies(t) {
  t.mock.method(AccountingSettings, "findOne", () => ({
    select: () => ({
      session: () => ({
        lean: () => Promise.resolve(null),
      }),
      lean: () => Promise.resolve(null),
    }),
    session: () => ({
      lean: () => Promise.resolve(null),
    }),
    lean: () => Promise.resolve(null),
  }));
  t.mock.method(FiscalYear, "exists", () => Promise.resolve(true));
  t.mock.method(AccountingPeriod, "updateOne", () => Promise.resolve({ acknowledged: true }));
  t.mock.method(JournalEntry, "countDocuments", () => Promise.resolve(0));
  t.mock.method(JournalEntry, "exists", () => Promise.resolve(null));
  t.mock.method(JournalEntry, "aggregate", () => Promise.resolve([]));
  t.mock.method(AuditLog, "create", () => Promise.resolve({}));
  t.mock.method(AuditLog.prototype, "save", () => Promise.resolve());
}

test("1. AccountingPeriod schema supports extended lifecycle states and audit fields", () => {
  const statusValues = AccountingPeriod.schema.path("status").enumValues;
  assert.ok(statusValues.includes("open"), "should include open");
  assert.ok(statusValues.includes("soft_closed"), "should include soft_closed");
  assert.ok(statusValues.includes("closed"), "should include closed");
  assert.ok(statusValues.includes("locked"), "should include locked");

  assert.ok(AccountingPeriod.schema.path("softClosedAt"), "softClosedAt should exist");
  assert.ok(AccountingPeriod.schema.path("softClosedBy"), "softClosedBy should exist");
  assert.ok(AccountingPeriod.schema.path("softCloseReason"), "softCloseReason should exist");
  assert.ok(AccountingPeriod.schema.path("closeReason"), "closeReason should exist");
  assert.ok(AccountingPeriod.schema.path("lockReason"), "lockReason should exist");
  assert.ok(AccountingPeriod.schema.path("reopenedAt"), "reopenedAt should exist");
  assert.ok(AccountingPeriod.schema.path("reopenedBy"), "reopenedBy should exist");
  assert.ok(AccountingPeriod.schema.path("reopenReason"), "reopenReason should exist");
  assert.ok(AccountingPeriod.schema.path("unlockedAt"), "unlockedAt should exist");
  assert.ok(AccountingPeriod.schema.path("unlockedBy"), "unlockedBy should exist");
  assert.ok(AccountingPeriod.schema.path("unlockReason"), "unlockReason should exist");
  assert.ok(AccountingPeriod.schema.path("overrideLog"), "overrideLog should exist");
});

test("2. Period constants and error codes are exported correctly", () => {
  assert.deepEqual(PERIOD_STATES, {
    OPEN: "open",
    SOFT_CLOSED: "soft_closed",
    CLOSED: "closed",
    LOCKED: "locked",
  });

  assert.equal(PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_SOFT_CLOSED, "ACCOUNTING_PERIOD_SOFT_CLOSED");
  assert.equal(PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_CLOSED, "ACCOUNTING_PERIOD_CLOSED");
  assert.equal(PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_LOCKED, "ACCOUNTING_PERIOD_LOCKED");
  assert.equal(PERIOD_ERROR_CODES.NO_ACCOUNTING_PERIOD, "NO_ACCOUNTING_PERIOD");
  assert.equal(PERIOD_ERROR_CODES.FISCAL_YEAR_CLOSED, "FISCAL_YEAR_CLOSED");
  assert.equal(PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_OVERRIDE_REQUIRED, "ACCOUNTING_PERIOD_OVERRIDE_REQUIRED");
});

test("3. parsePostingDate and validatePostingDate validate input dates", async (t) => {
  mockCommonDependencies(t);

  const valid = parsePostingDate("2026-03-15");
  assert.ok(valid instanceof Date);
  assert.equal(valid.getUTCFullYear(), 2026);

  await assert.rejects(
    () => validatePostingDate({ date: "not-a-date" }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED);
      return true;
    }
  );
  await assert.rejects(
    () => validatePostingDate({ date: null }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.POSTING_DATE_NOT_ALLOWED);
      return true;
    }
  );
});

test("4. resolveCompanyId handles null, strings, and ObjectId instances", () => {
  const oid = fakeId();
  assert.equal(resolveCompanyId(null), null);
  assert.equal(resolveCompanyId(undefined), null);
  assert.equal(resolveCompanyId(""), null);
  assert.equal(String(resolveCompanyId(oid)), String(oid));
  assert.equal(String(resolveCompanyId(String(oid))), String(oid));
});

test("5. assertAccountingPeriodOpen allows postings in OPEN period", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  const mockPeriod = { _id: fakeId(), status: "open", fiscalYear: mockFy._id };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(mockPeriod),
  }));

  const result = await assertAccountingPeriodOpen({ date: "2026-03-15" });
  assert.equal(result.period.status, "open");
  assert.equal(result.fiscalYear.status, "open");
});

test("6. assertAccountingPeriodOpen rejects when no period exists", async (t) => {
  mockCommonDependencies(t);
  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve({ _id: fakeId(), status: "open" }),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(null),
  }));

  await assert.rejects(
    () => assertAccountingPeriodOpen({ date: "2026-03-15" }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.NO_ACCOUNTING_PERIOD);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test("7. assertAccountingPeriodOpen rejects when Fiscal Year is closed", async (t) => {
  mockCommonDependencies(t);
  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve({ _id: fakeId(), status: "closed", name: "FY 2025-2026" }),
  }));

  await assert.rejects(
    () => assertAccountingPeriodOpen({ date: "2026-03-15" }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.FISCAL_YEAR_CLOSED);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test("8. assertAccountingPeriodOpen blocks SOFT_CLOSED without override reason", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  const mockPeriod = { _id: fakeId(), periodKey: "2026-03", status: "soft_closed", fiscalYear: mockFy._id };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(mockPeriod),
  }));

  await assert.rejects(
    () => assertAccountingPeriodOpen({
      date: "2026-03-15",
      user: { role: "admin", permissions: ["finance:manage"] },
      overrideReason: "",
    }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_OVERRIDE_REQUIRED);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test("9. assertAccountingPeriodOpen blocks SOFT_CLOSED for unauthorized users even with reason", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  const mockPeriod = { _id: fakeId(), periodKey: "2026-03", status: "soft_closed", fiscalYear: mockFy._id };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(mockPeriod),
  }));

  await assert.rejects(
    () => assertAccountingPeriodOpen({
      date: "2026-03-15",
      user: { role: "staff", permissions: ["sales:create"] },
      overrideReason: "Emergency late entry",
    }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_SOFT_CLOSED);
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});

test("10. assertAccountingPeriodOpen permits SOFT_CLOSED with authorized user & override reason", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  let updateCalled = false;
  const mockPeriod = {
    _id: fakeId(),
    periodKey: "2026-03",
    status: "soft_closed",
    fiscalYear: mockFy._id,
    overrideLog: [],
  };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(mockPeriod),
  }));
  t.mock.method(AccountingPeriod, "updateOne", () => {
    updateCalled = true;
    return Promise.resolve({ acknowledged: true });
  });

  const userId = fakeId();
  const result = await assertAccountingPeriodOpen({
    date: "2026-03-15",
    user: { _id: userId, role: "admin", permissions: ["finance:manage"] },
    overrideReason: "Approved late audit adjustment",
  });

  assert.equal(result.period.status, "soft_closed");
  assert.equal(result.overridden, true);
  assert.equal(result.overrideReason, "Approved late audit adjustment");
  assert.equal(updateCalled, true);
});

test("11. assertAccountingPeriodOpen blocks CLOSED periods, allows when allowClosedPeriod=true", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  const mockPeriod = { _id: fakeId(), periodKey: "2026-03", status: "closed", fiscalYear: mockFy._id };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(mockPeriod),
  }));

  // Normal attempt blocked
  await assert.rejects(
    () => assertAccountingPeriodOpen({ date: "2026-03-15" }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_CLOSED);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );

  // System year-end closing attempt permitted
  const res = await assertAccountingPeriodOpen({
    date: "2026-03-15",
    allowClosedPeriod: true,
  });
  assert.equal(res.period.status, "closed");
});

test("12. assertAccountingPeriodOpen strictly blocks LOCKED periods unconditionally", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  const mockPeriod = { _id: fakeId(), periodKey: "2026-03", status: "locked", fiscalYear: mockFy._id };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(mockPeriod),
  }));

  // Even with superadmin, overrideReason, and allowClosedPeriod, locked is inviolable
  await assert.rejects(
    () => assertAccountingPeriodOpen({
      date: "2026-03-15",
      user: { role: "superadmin", permissions: ["*"] },
      overrideReason: "Bypass attempt",
      allowClosedPeriod: true,
    }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_LOCKED);
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test("13. assertTransactionMutationAllowed guards updates, voids, and deletes against locked/closed periods", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  const lockedPeriod = { _id: fakeId(), periodKey: "2026-01", status: "locked", fiscalYear: mockFy._id };
  const openPeriod = { _id: fakeId(), periodKey: "2026-03", status: "open", fiscalYear: mockFy._id };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));

  // Deleting in a locked period fails
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(lockedPeriod),
  }));
  await assert.rejects(
    () => assertTransactionMutationAllowed({
      transactionDate: "2026-01-15",
      action: "delete",
    }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_LOCKED);
      return true;
    }
  );

  // Moving transaction date from open period to locked period fails
  let callCount = 0;
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => {
      callCount += 1;
      return Promise.resolve(callCount === 1 ? openPeriod : lockedPeriod);
    },
  }));
  await assert.rejects(
    () => assertTransactionMutationAllowed({
      transactionDate: "2026-03-15", // open
      newDate: "2026-01-15",         // locked
      action: "modify",
    }),
    (err) => {
      assert.equal(err.code, PERIOD_ERROR_CODES.ACCOUNTING_PERIOD_LOCKED);
      return true;
    }
  );
});

test("14. Lifecycle transitions: softClose, close, lock, reopen, unlock", async (t) => {
  mockCommonDependencies(t);
  const userId = fakeId();
  const periodDoc = {
    _id: fakeId(),
    periodKey: "2026-03",
    status: "open",
    companyId: null,
    overrideLog: [],
    toObject: function() { return { ...this }; },
    save: function() { return Promise.resolve(this); },
  };

  t.mock.method(AccountingPeriod, "findOne", () => periodDoc);

  // Soft close
  await softClosePeriod({
    periodKey: "2026-03",
    user: { _id: userId },
    reason: "Month-end close preparation",
  });
  assert.equal(periodDoc.status, "soft_closed");
  assert.equal(periodDoc.softCloseReason, "Month-end close preparation");
  assert.ok(periodDoc.softClosedAt instanceof Date);

  // Close
  await closePeriod({
    periodKey: "2026-03",
    user: { _id: userId },
    reason: "Final reconciliations complete",
  });
  assert.equal(periodDoc.status, "closed");
  assert.equal(periodDoc.closeReason, "Final reconciliations complete");
  assert.ok(periodDoc.closedAt instanceof Date);

  // Reopen from closed
  await reopenPeriod({
    periodKey: "2026-03",
    user: { _id: userId },
    reason: "Correction needed",
  });
  assert.equal(periodDoc.status, "open");
  assert.equal(periodDoc.reopenReason, "Correction needed");
  assert.ok(periodDoc.reopenedAt instanceof Date);

  // Lock
  await lockPeriod({
    periodKey: "2026-03",
    user: { _id: userId },
    reason: "Statutory audit locked",
  });
  assert.equal(periodDoc.status, "locked");
  assert.equal(periodDoc.lockReason, "Statutory audit locked");
  assert.ok(periodDoc.lockedAt instanceof Date);

  // Unlock
  await unlockPeriod({
    periodKey: "2026-03",
    user: { _id: userId, role: "admin" },
    reason: "Auditor requested adjustment",
  });
  assert.equal(periodDoc.status, "open");
  assert.equal(periodDoc.unlockReason, "Auditor requested adjustment");
  assert.ok(periodDoc.unlockedAt instanceof Date);
});

test("15. Reversals: Reversing locked transaction into OPEN period is permitted", async (t) => {
  mockCommonDependencies(t);
  const mockFy = { _id: fakeId(), status: "open" };
  const openPeriod = { _id: fakeId(), status: "open", fiscalYear: mockFy._id };

  t.mock.method(FiscalYear, "findOne", () => ({
    lean: () => Promise.resolve(mockFy),
  }));
  t.mock.method(AccountingPeriod, "findOne", () => ({
    lean: () => Promise.resolve(openPeriod),
  }));

  // Target reversal date is today (open period)
  const result = await assertAccountingPeriodOpen({
    date: new Date(),
  });
  assert.equal(result.period.status, "open");
});

test("16. Non-financial operational records (Sales Orders & Purchase Orders) are not blocked", () => {
  // Operational models do not have period/lock paths and do not invoke accounting posting on creation
  assert.equal(SalesOrder.schema.path("accountingPeriod"), undefined);
  assert.equal(SalesOrder.schema.path("isPeriodLocked"), undefined);
  assert.equal(PurchaseOrder.schema.path("accountingPeriod"), undefined);
  assert.equal(PurchaseOrder.schema.path("isPeriodLocked"), undefined);
});
