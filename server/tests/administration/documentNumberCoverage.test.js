import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../../app.js";
import { DOCUMENT_NUMBER_TYPES } from "../../config/documentNumberTypes.js";

test("every registered number targets a loaded persisted model field", () => {
  const keys = new Set();
  for (const type of DOCUMENT_NUMBER_TYPES) {
    assert.ok(!keys.has(type.key), `duplicate number type ${type.key}`);
    keys.add(type.key);
    assert.ok(mongoose.models[type.model], `missing model for ${type.key}: ${type.model}`);
    assert.ok(mongoose.models[type.model].schema.path(type.field), `missing field for ${type.key}: ${type.model}.${type.field}`);
  }
});

test("registered active producers route through central allocation or a central adapter", () => {
  const adapter = /assignDocumentNumber|nextSalesNumber|nextAccountingNumber|nextManufacturingNumber|nextImportDocumentNumber|\ballocate\(/;
  for (const type of DOCUMENT_NUMBER_TYPES) {
    const sources = type.producers.filter((path) => path.startsWith("controllers/") || path.startsWith("services/"));
    assert.ok(sources.length, `no active producer for ${type.key}`);
    for (const path of sources) {
      if (type.key === "administration.branch" && path === "services/shared/tenant.service.js") continue; // Reserved MAIN branch during legacy bootstrap.
      const source = readFileSync(resolve(".", path), "utf8");
      assert.match(source, adapter, `number source bypasses central allocation: ${type.key} in ${path}`);
    }
  }
});

test("a saved numbered record links its central claim for audit", async () => {
  const product = mongoose.models.Product;
  const claim = mongoose.models.DocumentNumberClaim;
  const hook = product.schema.s.hooks._posts.get("save").find((entry) => entry.fn.name === "linkNumberClaimToRecord");
  assert.ok(hook);
  const original = claim.collection.updateOne;
  let call;
  claim.collection.updateOne = async (...args) => { call = args; };
  try {
    await hook.fn.call({
      constructor: { modelName: "Product" }, tenantId: "tenant", sku: "st12", _id: "record", $session: () => null,
    });
    assert.deepEqual(call[0], { tenantId: "tenant", typeKey: "inventory.product", value: "ST12", recordId: null });
    assert.deepEqual(call[1], { $set: { recordId: "record" } });
  } finally {
    claim.collection.updateOne = original;
  }
});
