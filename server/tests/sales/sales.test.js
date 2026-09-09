import assert from "node:assert/strict";
import test from "node:test";

import { calculateDocument } from "../../services/salesCalculation.service.js";
import { ERP_MODULE_DEPENDENCIES, permissionModule } from "../../config/erpModules.js";

test("sales permissions resolve to the Sales ERP module", () => {
  assert.equal(permissionModule("sales-invoice:post"), "sales");
  assert.equal(permissionModule("sales-return:approve"), "sales");
  assert.deepEqual(ERP_MODULE_DEPENDENCIES.sales, ["crm", "inventory", "accounting"]);
});

test("exclusive VAT is added to the document total", () => {
  const result = calculateDocument([{ productId: "x", name: "Item", quantity: 2, unitPrice: 100, taxRate: 15 }]);
  assert.equal(result.totals.subtotal, 200);
  assert.equal(result.totals.taxTotal, 30);
  assert.equal(result.totals.grandTotal, 230);
});

test("inclusive VAT is extracted without increasing the document total", () => {
  const result = calculateDocument(
    [{ productId: "x", name: "Item", quantity: 1, unitPrice: 115, taxRate: 15 }],
    { taxCalculationMethod: "inclusive" }
  );
  assert.equal(result.totals.taxTotal, 15);
  assert.equal(result.totals.grandTotal, 115);
});

test("discounts are applied before exclusive VAT", () => {
  const result = calculateDocument([{ productId: "x", name: "Item", quantity: 1, unitPrice: 100, discountType: "percentage", discountValue: 10, taxRate: 10 }]);
  assert.equal(result.totals.discountTotal, 10);
  assert.equal(result.totals.taxTotal, 9);
  assert.equal(result.totals.grandTotal, 99);
});
