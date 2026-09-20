import test from "node:test";
import assert from "node:assert/strict";

import PurchaseOrder, { IMPORT_STATUSES, TRADE_TYPES } from "../../models/purchaseOrder.model.js";
import GoodsReceipt from "../../models/goodsReceipt.model.js";
import CommercialLC, { LC_STATUSES } from "../../models/commercialLC.model.js";
import ImportShipment, { IMPORT_SHIPMENT_STATUSES } from "../../models/importShipment.model.js";
import ImportDocument, { IMPORT_DOCUMENT_TYPES } from "../../models/importDocument.model.js";
import { PERMISSION_KEYS } from "../../models/permissionGroup.model.js";
import { permissionModule } from "../../config/erpModules.js";

test("purchase orders keep purchase type separate from local/import trade type", () => {
  assert.deepEqual(TRADE_TYPES, ["local", "import"]);
  assert.ok(IMPORT_STATUSES.includes("lc_pending"));
  assert.ok(IMPORT_STATUSES.includes("settled"));
  assert.ok(PurchaseOrder.schema.path("purchaseType"));
  assert.ok(PurchaseOrder.schema.path("tradeType"));
  assert.ok(PurchaseOrder.schema.path("importStatus"));
});

test("Commercial LC and import shipment lifecycle models are available", () => {
  for (const path of ["purchaseOrder", "supplier", "issuingBank", "bankAccount", "lcNumber", "amount", "currency", "marginAmount", "charges", "settlements", "status"]) {
    assert.ok(CommercialLC.schema.path(path), `${path} should exist on Commercial LC`);
  }
  assert.ok(LC_STATUSES.includes("opened"));
  assert.ok(LC_STATUSES.includes("goods_received"));
  assert.ok(LC_STATUSES.includes("settled"));
  assert.ok(IMPORT_SHIPMENT_STATUSES.includes("customs_clearance"));
  assert.ok(ImportShipment.schema.path("goodsReceipts"));
  assert.ok(IMPORT_DOCUMENT_TYPES.includes("bill_of_lading"));
  assert.ok(ImportDocument.schema.path("commercialLC"));
});

test("goods receipts can trace imported stock back to its LC and shipment", () => {
  assert.ok(GoodsReceipt.schema.path("commercialLC"));
  assert.ok(GoodsReceipt.schema.path("importShipment"));
});

test("Commercial LC permissions belong to the Purchase ERP module", () => {
  for (const permission of [
    "commercial-lc:view",
    "commercial-lc:manage",
    "commercial-lc:approve",
    "commercial-lc:open",
    "commercial-lc:amend",
    "commercial-lc:settle",
    "commercial-lc:close",
  ]) {
    assert.ok(PERMISSION_KEYS.includes(permission), `${permission} should be registered`);
    assert.equal(permissionModule(permission), "purchase");
  }
});
