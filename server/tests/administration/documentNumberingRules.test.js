import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSerialMatcher,
  renderDocumentNumber,
  validateRulePatch,
  previewDocumentNumber,
} from "../../services/administration/documentNumbering.service.js";
import DocumentNumberRule from "../../models/administration/documentNumberRule.model.js";
import DocumentNumberCounter from "../../models/administration/documentNumberCounter.model.js";
import DocumentNumberClaim from "../../models/administration/documentNumberClaim.model.js";

test("pattern rendering uses tenant date and padded serial", () => {
  assert.equal(renderDocumentNumber({
    rule: { prefix: "SR", pattern: "{PREFIX}-{DATE}-{ITEM}-{SERIAL}", serialWidth: 4 },
    serial: 7,
    context: { itemCode: "PEN" },
    date: new Date("2026-09-21T18:00:00Z"),
    timezone: "Asia/Dhaka",
  }), "SR-20260922-PEN-0007");
});

test("rule validation rejects unknown types, unsafe tokens, missing serials and unsupported context", () => {
  assert.throws(() => validateRulePatch({ typeKey: "missing.type", input: { mode: "auto" } }), /Unknown/i);
  assert.throws(() => validateRulePatch({ typeKey: "inventory.product", input: { mode: "auto", pattern: "{PREFIX}" } }), /SERIAL/);
  assert.throws(() => validateRulePatch({ typeKey: "inventory.product", input: { mode: "auto", pattern: "{PREFIX}-{EVAL}-{SERIAL}" } }), /token/i);
  assert.throws(() => validateRulePatch({ typeKey: "sales.order", input: { mode: "auto", pattern: "{CATEGORY}-{SERIAL}" } }), /CATEGORY/);
  assert.throws(() => validateRulePatch({ typeKey: "inventory.product", input: { prefix: "A\nB" } }), /prefix/i);
  assert.throws(() => validateRulePatch({ typeKey: "inventory.product", input: { pattern: "{SERIAL}-{SERIAL}" } }), /exactly one/i);
});

test("legacy collision scan recognizes a serial in the middle of a custom pattern", () => {
  const matcher = buildSerialMatcher({
    rule: { prefix: "SO", pattern: "{PREFIX}-{SERIAL}-{DATE}", serialWidth: 4 },
    date: new Date("2026-09-22T00:00:00Z"), timezone: "UTC",
  });
  assert.equal(matcher.expression.exec("SO-0027-20260922")?.[1], "0027");
  assert.equal(matcher.expression.test("SO-0027-20260923"), false);
});

test("manual mode keeps an editable pattern but cannot store a malformed prefix or excessive output", () => {
  assert.equal(validateRulePatch({ typeKey: "inventory.product", input: { mode: "manual" } }).mode, "manual");
  assert.throws(() => validateRulePatch({ typeKey: "inventory.product", input: { pattern: `${"X".repeat(90)}{SERIAL}` } }), /length/i);
});

test("preview does not reserve a number", async () => {
  const result = await previewDocumentNumber({
    tenantId: "000000000000000000000001",
    typeKey: "inventory.product",
    patch: { prefix: "PC", pattern: "{CATEGORY}{SERIAL}" },
    context: { categoryCode: "ST" },
    serial: 4,
  });
  assert.equal(result.value, "ST4");
  assert.equal(result.isPreview, true);
});

test("preview preserves legacy format until a tenant edits its pattern", async () => {
  const currentRule = {
    mode: "auto", prefix: "PPO", pattern: "{PREFIX}-{DATE}-{SERIAL}",
    resetPolicy: "calendar_year", serialWidth: 4, legacyFormatter: "purchase_year",
  };
  const args = { tenantId: "000000000000000000000001", typeKey: "purchase.order", currentRule, serial: 7, date: new Date("2026-09-22T00:00:00Z") };
  assert.equal((await previewDocumentNumber({ ...args, patch: { pattern: currentRule.pattern } })).value, "PPO-2026-0007");
  assert.equal((await previewDocumentNumber({ ...args, patch: { pattern: "{PREFIX}-{SERIAL}" } })).value, "PPO-0007");
});

test("numbering persistence enforces tenant-scoped unique rules, counters and claims", () => {
  for (const [model, key] of [
    [DocumentNumberRule, { tenantId: 1, typeKey: 1 }],
    [DocumentNumberCounter, { tenantId: 1, typeKey: 1, bucket: 1, partition: 1 }],
    [DocumentNumberClaim, { tenantId: 1, typeKey: 1, value: 1 }],
  ]) {
    assert.ok(model.schema.indexes().some(([fields, options]) => options.unique && JSON.stringify(fields) === JSON.stringify(key)));
  }
});
