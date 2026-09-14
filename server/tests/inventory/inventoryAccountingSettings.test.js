import assert from "node:assert/strict";
import test from "node:test";

import {
  SETTINGS_ACCOUNT_FIELDS,
  matchesSettingsAccountPurpose,
} from "../../controllers/accounting/accounting.controller.js";

const emptyLinks = {
  bankLedgerIds: new Set(),
  cashLedgerIds: new Set(),
  loanLedgerIds: new Set(),
};

test("accounting settings publishes the inventory revaluation account", () => {
  assert.ok(SETTINGS_ACCOUNT_FIELDS.includes("inventoryRevaluationAccount"));
});

test("inventory revaluation settings accept the dedicated postable expense account", () => {
  assert.equal(
    matchesSettingsAccountPurpose(
      "inventoryRevaluationAccount",
      {
        _id: "account-5090",
        code: "5090",
        name: "Inventory Revaluation Gain or Loss",
        type: "expense",
        subType: "Direct Expense",
        isGroup: false,
        isActive: true,
      },
      emptyLinks
    ),
    true
  );
  assert.equal(
    matchesSettingsAccountPurpose(
      "inventoryRevaluationAccount",
      {
        _id: "account-1300",
        code: "1300",
        name: "Inventory",
        type: "asset",
        isGroup: false,
        isActive: true,
      },
      emptyLinks
    ),
    false
  );
});
