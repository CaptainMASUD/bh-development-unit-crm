import test from "node:test";
import assert from "node:assert/strict";

import JournalEntry from "../../models/journalEntry.model.js";
import BankTransaction from "../../models/bankTransaction.model.js";
import { voucherTypeForSource } from "../../services/accountingPosting.service.js";
import * as procurementAccounting from "../../services/procurementAccounting.service.js";

test("accounting source enums include Commercial LC and landed cost", () => {
  const journalSources = JournalEntry.schema.path("sourceType").enumValues;
  for (const source of ["lc_margin", "lc_charge", "lc_settlement", "landed_cost"]) {
    assert.ok(journalSources.includes(source), `${source} should be a journal source`);
  }
  const bankSources = BankTransaction.schema.path("sourceType").enumValues;
  for (const source of ["lc_margin", "lc_charge", "lc_settlement"]) {
    assert.ok(bankSources.includes(source), `${source} should be a bank source`);
  }
});

test("LC accounting source types resolve to expected vouchers", () => {
  assert.equal(voucherTypeForSource("lc_margin"), "contra");
  assert.equal(voucherTypeForSource("lc_charge"), "payment");
  assert.equal(voucherTypeForSource("lc_settlement"), "payment");
  assert.equal(voucherTypeForSource("landed_cost"), "purchase");
});

test("procurement accounting re-exports import accounting entry points", () => {
  assert.equal(typeof procurementAccounting.postLCMarginAccounting, "function");
  assert.equal(typeof procurementAccounting.postLCChargeAccounting, "function");
  assert.equal(typeof procurementAccounting.postLCSettlementAccounting, "function");
  assert.equal(typeof procurementAccounting.postLandedCostAccounting, "function");
});
