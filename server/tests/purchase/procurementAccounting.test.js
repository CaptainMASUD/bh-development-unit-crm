import test from "node:test";
import assert from "node:assert/strict";

import AccountingSettings from "../../models/accountingSettings.model.js";
import GoodsReceipt from "../../models/goodsReceipt.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import PurchaseReturn from "../../models/purchaseReturn.model.js";
import StockAdjustment from "../../models/inventory/stockAdjustment.model.js";
import VendorBill from "../../models/vendorBill.model.js";
import { SYSTEM_ACCOUNTS } from "../../services/accountingSetup.service.js";
import { voucherTypeForSource } from "../../services/accountingPosting.service.js";

test("procurement control and variance accounts are provisioned", () => {
  const byCode = new Map(SYSTEM_ACCOUNTS.map((account) => [account.code, account]));
  assert.equal(byCode.get("1300")?.controlType, "inventory");
  assert.equal(byCode.get("2050")?.type, "liability");
  assert.equal(byCode.get("5030")?.type, "expense");
  assert.equal(byCode.get("5040")?.type, "expense");
});

test("accounting settings expose procurement control accounts", () => {
  for (const path of [
    "inventoryClearingAccount",
    "purchasePriceVarianceAccount",
    "inventoryAdjustmentAccount",
  ]) {
    assert.ok(AccountingSettings.schema.path(path), `${path} should be configurable`);
  }
});

test("inventory procurement documents retain immutable journal links", () => {
  for (const model of [GoodsReceipt, PurchaseReturn, StockAdjustment]) {
    assert.ok(model.schema.path("journalEntry"));
    assert.ok(model.schema.path("reversalJournalEntry"));
  }
  const sourceTypes = JournalEntry.schema.path("sourceType").enumValues;
  assert.ok(sourceTypes.includes("goods_receipt"));
  assert.ok(sourceTypes.includes("purchase_return"));
  assert.ok(sourceTypes.includes("inventory_adjustment"));
  assert.equal(voucherTypeForSource("goods_receipt"), "purchase");
  assert.equal(voucherTypeForSource("purchase_return"), "purchase");
});

test("vendor bills support supplier invoice and receipt matching", () => {
  for (const path of [
    "supplier",
    "supplierInvoiceNo",
    "purchaseOrder",
    "goodsReceipts",
    "matchStatus",
    "matchSummary.amountVariance",
  ]) {
    assert.ok(VendorBill.schema.path(path), `${path} should exist on supplier bills`);
  }
});
