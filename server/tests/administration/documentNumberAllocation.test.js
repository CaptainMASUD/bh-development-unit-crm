import assert from "node:assert/strict";
import test from "node:test";
import DocumentNumberRule from "../../models/administration/documentNumberRule.model.js";
import DocumentNumberCounter from "../../models/administration/documentNumberCounter.model.js";
import DocumentNumberClaim from "../../models/administration/documentNumberClaim.model.js";
import Product from "../../models/inventory/product.model.js";
import { assignDocumentNumber } from "../../services/administration/documentNumbering.service.js";

test("central allocator scopes counters, rejects conflicting manual values, and supports retries", async () => {
  const previous = {
    ruleFind: DocumentNumberRule.findOne,
    counterUpdate: DocumentNumberCounter.findOneAndUpdate,
    claimFind: DocumentNumberClaim.findOne,
    claimCreate: DocumentNumberClaim.create,
  };
  const rules = new Map();
  const counters = new Map();
  const claims = new Map();
  DocumentNumberRule.findOne = ({ tenantId, typeKey }) => ({
    session() { return this; },
    async lean() { return rules.get(`${tenantId}:${typeKey}`) || null; },
  });
  DocumentNumberCounter.findOneAndUpdate = async ({ tenantId, typeKey, bucket, partition }) => {
    const key = `${tenantId}:${typeKey}:${bucket}:${partition}`;
    const value = (counters.get(key) || 0) + 1;
    counters.set(key, value);
    return { value };
  };
  DocumentNumberClaim.findOne = ({ tenantId, typeKey, idempotencyKey }) => ({
    session() { return this; },
    async lean() { return [...claims.values()].find((claim) => claim.tenantId === tenantId && claim.typeKey === typeKey && claim.idempotencyKey === idempotencyKey) || null; },
  });
  DocumentNumberClaim.create = async ([record]) => {
    const key = `${record.tenantId}:${record.typeKey}:${record.value}`;
    if (claims.has(key)) throw Object.assign(new Error("duplicate"), { code: 11000 });
    claims.set(key, record);
    return [record];
  };
  try {
    const date = new Date("2026-09-22T00:00:00Z");
    const a = await assignDocumentNumber({ tenantId: "a", typeKey: "sales.order", date, timezone: "UTC", idempotencyKey: "create-1" });
    assert.equal(a.value, "SO-202609-000001");
    const retry = await assignDocumentNumber({ tenantId: "a", typeKey: "sales.order", date, timezone: "UTC", idempotencyKey: "create-1" });
    assert.equal(retry.value, a.value);
    const b = await assignDocumentNumber({ tenantId: "b", typeKey: "sales.order", date, timezone: "UTC" });
    assert.equal(b.value, a.value);
    assert.equal(claims.size, 2);
    await assert.rejects(assignDocumentNumber({ tenantId: "a", typeKey: "sales.order", date, timezone: "UTC", providedValue: "SO-X" }), /automatically assigned/);
    rules.set("a:inventory.category", { mode: "manual", prefix: "CAT", pattern: "{PREFIX}-{DATE}-{SERIAL}", resetPolicy: "none", serialWidth: 4, revision: 1 });
    const manual = await assignDocumentNumber({ tenantId: "a", typeKey: "inventory.category", timezone: "UTC", providedValue: "ST" });
    assert.equal(manual.value, "ST");
    await assert.rejects(assignDocumentNumber({ tenantId: "a", typeKey: "inventory.category", timezone: "UTC", providedValue: "ST" }), (error) => error.statusCode === 409);
    await assert.rejects(assignDocumentNumber({ tenantId: "a", typeKey: "inventory.category", timezone: "UTC" }), /required in Manual mode/);
  } finally {
    DocumentNumberRule.findOne = previous.ruleFind;
    DocumentNumberCounter.findOneAndUpdate = previous.counterUpdate;
    DocumentNumberClaim.findOne = previous.claimFind;
    DocumentNumberClaim.create = previous.claimCreate;
  }
});

test("legacy product codes seed the counter before new allocation", async () => {
  const original = {
    ruleFind: DocumentNumberRule.findOne,
    counterUpdate: DocumentNumberCounter.findOneAndUpdate,
    counterSeed: DocumentNumberCounter.updateOne,
    claimCreate: DocumentNumberClaim.create,
    productFind: Product.find,
    productFindOne: Product.findOne,
  };
  let value = 0;
  DocumentNumberRule.findOne = () => ({ async lean() { return null; } });
  DocumentNumberCounter.findOneAndUpdate = async () => ({ value: ++value });
  DocumentNumberCounter.updateOne = async (_filter, update) => { value = Math.max(value, update.$max.value); };
  DocumentNumberClaim.create = async ([doc]) => [doc];
  Product.findOne = ({ sku }) => ({ select() { return this; }, async lean() { return sku === "ST1" ? { _id: "old" } : null; } });
  Product.find = () => ({ select() { return this; }, async lean() { return Array.from({ length: 12 }, (_, index) => ({ sku: `ST${index + 1}` })); } });
  try {
    const allocated = await assignDocumentNumber({ tenantId: "000000000000000000000001", typeKey: "inventory.product", context: { categoryCode: "ST" }, timezone: "UTC" });
    assert.equal(allocated.value, "ST13");
  } finally {
    DocumentNumberRule.findOne = original.ruleFind;
    DocumentNumberCounter.findOneAndUpdate = original.counterUpdate;
    DocumentNumberCounter.updateOne = original.counterSeed;
    DocumentNumberClaim.create = original.claimCreate;
    Product.find = original.productFind;
    Product.findOne = original.productFindOne;
  }
});
