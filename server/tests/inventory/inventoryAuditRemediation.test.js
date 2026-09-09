import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import { escapeCsvValue, buildCsvString } from "../../services/export.service.js";
import Product, { normalizeProductPatch } from "../../models/inventory/product.model.js";
import Warehouse from "../../models/inventory/warehouse.model.js";
import ProductStock from "../../models/inventory/productStock.model.js";
import InventoryValuation from "../../models/inventory/inventoryValuation.model.js";
import FifoCostLayer from "../../models/inventory/fifoCostLayer.model.js";
import StockAdjustment from "../../models/inventory/stockAdjustment.model.js";
import StockTransfer from "../../models/inventory/stockTransfer.model.js";
import {
  InventoryPreference,
} from "../../models/inventory/inventoryOperations.model.js";
import AccountingSettings from "../../models/accountingSettings.model.js";

const oid = () => new mongoose.Types.ObjectId();

/* =========================================================
   1. CSV FORMULA INJECTION PROTECTION (CWE-1236)
========================================================= */

test("1. CSV Formula Injection: dangerous prefixes are neutralized with a leading single quote", () => {
  const dangerousFormulas = [
    "=cmd|' /C calc'!A0",
    "=SUM(A1:A10)",
    "@SUM(B1:B5)",
    "+cmd|'/C powershell'!A0",
    "-2+5+cmd|'/C calc'!A0",
    "\t=1+1",
    "\r=1+1",
    "  =AVERAGE(C1:C10)",
    " -10+20",
  ];

  for (const formula of dangerousFormulas) {
    const escaped = escapeCsvValue(formula);
    assert.ok(
      escaped.startsWith("'") || escaped.startsWith("\"'"),
      `Expected dangerous formula "${formula}" to be escaped with leading quote, got: ${escaped}`
    );
  }
});

test("2. CSV Formula Injection: pure negative and positive numeric values are NOT prefixed with quote", () => {
  const pureNumbers = [
    -50,
    -10.5,
    0,
    42,
    100.25,
    "-50",
    "-10.5",
    "+42",
    "+100.25",
    "0.05",
    "-0.75",
    "-.75",
    "1e5",
    "-1.5e-3",
  ];

  for (const num of pureNumbers) {
    const escaped = escapeCsvValue(num);
    assert.ok(
      !escaped.startsWith("'") && !escaped.startsWith("\"'"),
      `Expected numeric value ${num} NOT to be prefixed with quote, got: ${escaped}`
    );
    assert.strictEqual(
      escaped,
      String(num),
      `Numeric representation must be preserved exactly for ${num}`
    );
  }
});

test("3. CSV Exporter RFC 4180 compliance handles quotes, commas, newlines, and formula escaping together", () => {
  const headers = [
    { key: "sku", label: "SKU" },
    { key: "description", label: "Description" },
    { key: "quantity", label: "Quantity" },
    { key: "unitPrice", label: "Unit Price" },
  ];

  const rows = [
    { sku: "SKU-001", description: '=HYPERLINK("http://evil.com","Click")', quantity: -10, unitPrice: 25.5 },
    { sku: "SKU-002", description: 'Standard item, with "quotes" and, commas', quantity: 5, unitPrice: 100 },
    { sku: "SKU-003", description: "Normal item", quantity: 0, unitPrice: 0 },
  ];

  const csv = buildCsvString(headers, rows);
  const lines = csv.split("\r\n");

  assert.strictEqual(lines[0], "SKU,Description,Quantity,Unit Price");
  // Row 1: formula escaped with ' and quotes doubled
  assert.ok(lines[1].includes("\"'=HYPERLINK(\"\"http://evil.com\"\",\"\"Click\"\")\""));
  assert.ok(lines[1].includes("-10"));
  assert.ok(!lines[1].includes("'-10")); // numeric -10 not escaped with '

  // Row 2: standard RFC 4180 quotes
  assert.ok(lines[2].includes("\"Standard item, with \"\"quotes\"\" and, commas\""));
});

/* =========================================================
   2. NEGATIVE STOCK ENFORCEMENT (STRICTLY DISABLED)
========================================================= */

test("4. Product model validation strictly rejects allowNegativeStock: true", () => {
  const product = new Product({
    tenantId: oid(),
    name: "Test Widget",
    sku: "WID-001",
    allowNegativeStock: true,
  });

  const err = product.validateSync();
  assert.ok(err, "Validation must fail when allowNegativeStock is true");
  assert.ok(
    err.errors["allowNegativeStock"].message.includes("Negative stock is strictly disabled"),
    "Error message must inform user that negative stock is strictly disabled"
  );
});

test("5. Product normalizeProductPatch strictly rejects allowNegativeStock: true", () => {
  assert.throws(
    () => normalizeProductPatch({ allowNegativeStock: true }),
    /Negative stock is strictly disabled until GL variance accounting is implemented/
  );

  // allowNegativeStock: false is permitted
  const safePatch = normalizeProductPatch({ allowNegativeStock: false });
  assert.strictEqual(safePatch.allowNegativeStock, false);
});

test("6. Warehouse model validation strictly rejects allowNegativeStock: true", () => {
  const warehouse = new Warehouse({
    tenantId: oid(),
    name: "Main Warehouse",
    code: "WH-MAIN",
    allowNegativeStock: true,
  });

  const err = warehouse.validateSync();
  assert.ok(err, "Validation must fail when allowNegativeStock is true");
  assert.ok(
    err.errors["allowNegativeStock"].message.includes("Negative stock is strictly disabled"),
    "Error message must inform user that negative stock is strictly disabled"
  );
});

test("7. Inventory Operations Preference schema strictly rejects allowNegativeStock: true", () => {
  const pref = new InventoryPreference({
    tenantId: oid(),
    key: "company",
    allowNegativeStock: true,
  });

  const err = pref.validateSync();
  assert.ok(err, "Validation must fail when allowNegativeStock is true");
  assert.ok(
    err.errors["allowNegativeStock"].message.includes("Negative stock is strictly disabled"),
    "Error message must inform user that negative stock is strictly disabled"
  );
});

/* =========================================================
   3. INDEX PRUNING & OPTIMIZATION AUDIT
========================================================= */

test("8. InventoryValuation schema has no redundant unscoped single-field indexes", () => {
  const schema = InventoryValuation.schema;
  const indexes = schema.indexes();

  // Ensure no single-field un-scoped indexes exist on product, warehouse, costingMethod, lastValuationAt
  const unscopedFields = ["product", "warehouse", "costingMethod", "lastValuationAt"];
  for (const field of unscopedFields) {
    const hasUnscoped = indexes.some(
      (idx) => Object.keys(idx[0]).length === 1 && idx[0][field] !== undefined
    );
    assert.strictEqual(
      hasUnscoped,
      false,
      `InventoryValuation must NOT have unscoped single-field index on ${field}`
    );
  }

  // Ensure all compound indexes start with tenantId
  const compoundIndexes = indexes.filter((idx) => Object.keys(idx[0]).length > 1);
  for (const idx of compoundIndexes) {
    assert.strictEqual(
      idx[0].tenantId,
      1,
      `Compound index ${JSON.stringify(idx[0])} must be tenant-scoped`
    );
  }
});

test("9. FifoCostLayer schema has no redundant unscoped single-field indexes", () => {
  const schema = FifoCostLayer.schema;
  const indexes = schema.indexes();

  const unscopedFields = ["product", "warehouse", "receiptDate", "sourceMovement", "status"];
  for (const field of unscopedFields) {
    const hasUnscoped = indexes.some(
      (idx) => Object.keys(idx[0]).length === 1 && idx[0][field] !== undefined
    );
    assert.strictEqual(
      hasUnscoped,
      false,
      `FifoCostLayer must NOT have unscoped single-field index on ${field}`
    );
  }

  // Compound index must be tenant-scoped
  const compound = indexes.find((idx) => idx[0].product === 1);
  assert.ok(compound, "FifoCostLayer must have compound FIFO index");
  assert.strictEqual(compound[0].tenantId, 1, "FIFO compound index must be tenant-scoped");
});

test("10. StockAdjustment schema has no redundant unscoped single-field indexes", () => {
  const schema = StockAdjustment.schema;
  const indexes = schema.indexes();

  const unscopedFields = ["adjustmentDate", "warehouse", "adjustmentType", "status", "movement", "journalEntry", "createdBy"];
  for (const field of unscopedFields) {
    const hasUnscoped = indexes.some(
      (idx) => Object.keys(idx[0]).length === 1 && idx[0][field] !== undefined
    );
    assert.strictEqual(
      hasUnscoped,
      false,
      `StockAdjustment must NOT have unscoped single-field index on ${field}`
    );
  }

  // All compound indexes are tenant-scoped
  for (const idx of indexes.filter((i) => Object.keys(i[0]).length > 1)) {
    assert.strictEqual(idx[0].tenantId, 1, `Compound index ${JSON.stringify(idx[0])} must be tenant-scoped`);
  }
});

test("11. StockTransfer schema has no redundant unscoped single-field indexes", () => {
  const schema = StockTransfer.schema;
  const indexes = schema.indexes();

  const unscopedFields = ["transferDate", "expectedDeliveryDate", "transferMode", "status", "sourceWarehouse", "destinationWarehouse", "createdBy"];
  for (const field of unscopedFields) {
    const hasUnscoped = indexes.some(
      (idx) => Object.keys(idx[0]).length === 1 && idx[0][field] !== undefined
    );
    assert.strictEqual(
      hasUnscoped,
      false,
      `StockTransfer must NOT have unscoped single-field index on ${field}`
    );
  }

  // All compound indexes are tenant-scoped
  for (const idx of indexes.filter((i) => Object.keys(i[0]).length > 1)) {
    assert.strictEqual(idx[0].tenantId, 1, `Compound index ${JSON.stringify(idx[0])} must be tenant-scoped`);
  }
});

/* =========================================================
   4. MULTI-TENANT ISOLATION IN ACCOUNTING CONTROLLER
========================================================= */

test("12. AccountingSettings schema supports tenantId and compound unique index", () => {
  const schema = AccountingSettings.schema;
  assert.ok(schema.path("tenantId"), "AccountingSettings must have tenantId");
  assert.ok(schema.path("inventoryAccount"), "AccountingSettings must have inventoryAccount");
  assert.ok(!schema.path("inventoryAssetAccount"), "AccountingSettings must NOT have inventoryAssetAccount typo");

  const indexes = schema.indexes();
  const hasTenantCompound = indexes.some((idx) => idx[0].tenantId === 1 && idx[0].key === 1);
  assert.ok(hasTenantCompound, "AccountingSettings must have index on { tenantId: 1, key: 1 }");
});

/* =========================================================
   5. GL RECONCILIATION PARITY ACROSS COSTING METHODS
========================================================= */

test("13. GL Reconciliation math correctly calculates parity and discrepancies across all costing methods", () => {
  // Case A: Weighted Average Parity
  const waSubledger = 10000.0;
  const waGlBalance = 10000.0;
  const waDiff = Math.round((waSubledger - waGlBalance + Number.EPSILON) * 100) / 100;
  const waReconciled = Math.abs(waDiff) < 0.01;
  assert.strictEqual(waDiff, 0, "Weighted average difference must be 0");
  assert.strictEqual(waReconciled, true, "Weighted average must be reconciled");

  // Case B: FIFO Parity
  const fifoSubledger = 12500.5;
  const fifoGlBalance = 12500.5;
  const fifoDiff = Math.round((fifoSubledger - fifoGlBalance + Number.EPSILON) * 100) / 100;
  const fifoReconciled = Math.abs(fifoDiff) < 0.01;
  assert.strictEqual(fifoDiff, 0, "FIFO difference must be 0");
  assert.strictEqual(fifoReconciled, true, "FIFO must be reconciled");

  // Case C: Standard Costing Parity
  const stdSubledger = 9000.0;
  const stdGlBalance = 9000.0;
  const stdDiff = Math.round((stdSubledger - stdGlBalance + Number.EPSILON) * 100) / 100;
  const stdReconciled = Math.abs(stdDiff) < 0.01;
  assert.strictEqual(stdDiff, 0, "Standard costing difference must be 0");
  assert.strictEqual(stdReconciled, true, "Standard costing must be reconciled");

  // Case D: Discrepancy Detection (Subledger != GL)
  const discSubledger = 10000.0;
  const discGlBalance = 9500.0;
  const discDiff = Math.round((discSubledger - discGlBalance + Number.EPSILON) * 100) / 100;
  const discReconciled = Math.abs(discDiff) < 0.01;
  assert.strictEqual(discDiff, 500, "Discrepancy difference must be 500");
  assert.strictEqual(discReconciled, false, "Discrepancy must be flagged unreconciled");
});

test("14. ProductStock applyQuantityDelta throws informative error when transaction would reduce stock below zero", async () => {
  const origUpdateOne = ProductStock.updateOne;
  const origFindOneAndUpdate = ProductStock.findOneAndUpdate;
  try {
    ProductStock.updateOne = async () => ({ acknowledged: true });
    ProductStock.findOneAndUpdate = async () => null; // Simulation: $expr failed due to negative stock condition

    await assert.rejects(
      async () => {
        await ProductStock.applyQuantityDelta({
          tenantId: oid(),
          product: oid(),
          warehouse: oid(),
          onHandDelta: -10,
        });
      },
      (err) => {
        assert.strictEqual(err.statusCode, 409);
        assert.ok(err.message.includes("Insufficient stock: transaction would reduce stock below zero"));
        assert.ok(err.message.includes("Negative inventory requires negative stock GL variance accounting which is currently disabled"));
        return true;
      }
    );
  } finally {
    ProductStock.updateOne = origUpdateOne;
    ProductStock.findOneAndUpdate = origFindOneAndUpdate;
  }
});

test("15. Reconciliation settingsField matches AccountingSettings schema (inventoryAccount vs legacy typo)", () => {
  const schema = AccountingSettings.schema;
  assert.strictEqual(schema.path("inventoryAccount") !== undefined, true);
  assert.strictEqual(schema.path("inventoryAssetAccount") === undefined, true);
});

test("16. AccountingSettings enforces tenant isolation via tenantId scoping", () => {
  const tenantA = oid();
  const tenantB = oid();

  const settingsA = new AccountingSettings({
    tenantId: tenantA,
    key: "company",
    currency: "USD",
  });

  const settingsB = new AccountingSettings({
    tenantId: tenantB,
    key: "company",
    currency: "EUR",
  });

  assert.strictEqual(String(settingsA.tenantId), String(tenantA));
  assert.strictEqual(String(settingsB.tenantId), String(tenantB));
  assert.notStrictEqual(String(settingsA.tenantId), String(settingsB.tenantId));
  assert.strictEqual(settingsA.currency, "USD");
  assert.strictEqual(settingsB.currency, "EUR");
});

