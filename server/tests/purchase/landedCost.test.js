import test from "node:test";
import assert from "node:assert/strict";

import AccountingSettings from "../../models/accountingSettings.model.js";
import LandedCost, { LANDED_COST_ALLOCATION_BASES, LANDED_COST_STATUSES } from "../../models/landedCost.model.js";
import { SYSTEM_ACCOUNTS } from "../../services/accountingSetup.service.js";

test("landed-cost documents support import allocation and reversal", () => {
  for (const path of ["commercialLC", "purchaseOrder", "goodsReceipts", "allocationBasis", "components", "allocations", "journalEntry", "reversalJournalEntry", "status"]) {
    assert.ok(LandedCost.schema.path(path), `${path} should exist on landed cost`);
  }
  assert.deepEqual(LANDED_COST_ALLOCATION_BASES, ["value", "quantity", "manual"]);
  assert.ok(LANDED_COST_STATUSES.includes("finalized"));
  assert.ok(LANDED_COST_STATUSES.includes("reversed"));
});

test("accounting settings expose LC/import control accounts", () => {
  for (const path of ["lcMarginAccount", "importCostClearingAccount", "importChargesExpenseAccount"]) {
    assert.ok(AccountingSettings.schema.path(path), `${path} should be configurable`);
  }
});

test("system chart provisions LC/import accounts", () => {
  const byCode = new Map(SYSTEM_ACCOUNTS.map((account) => [account.code, account]));
  assert.equal(byCode.get("1320")?.type, "asset");
  assert.equal(byCode.get("1330")?.type, "asset");
  assert.equal(byCode.get("5130")?.type, "expense");
});
