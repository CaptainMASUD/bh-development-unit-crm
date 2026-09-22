import assert from "node:assert/strict";
import test from "node:test";
import { applyBackfillPlans, buildBackfillPlan, matchingHistoricalTypes, recognizedCounterPosition } from "../../scripts/backfillDocumentNumberClaims.js";
import { getDocumentNumberType } from "../../config/documentNumberTypes.js";
import DocumentNumberClaim from "../../models/administration/documentNumberClaim.model.js";
import DocumentNumberCounter from "../../models/administration/documentNumberCounter.model.js";

const tenantId = "000000000000000000000001";
const records = [
  { _id: "000000000000000000000011", sku: "ST1", category: { code: "ST" } },
  { _id: "000000000000000000000012", sku: "ST2", category: { code: "ST" } },
];

test("backfill dry-run planning neither renumbers records nor hides duplicates", () => {
  const before = JSON.stringify(records);
  const plan = buildBackfillPlan({ tenantId, type: getDocumentNumberType("inventory.product"), records, claims: [] });
  assert.equal(JSON.stringify(records), before);
  assert.equal(plan.scanned, 2);
  assert.equal(plan.claimsToInsert.length, 2);
  assert.deepEqual(plan.duplicates, []);
  assert.deepEqual(plan.counterSeeds, [{ bucket: "all", partition: "ST", value: 2 }]);

  const duplicate = buildBackfillPlan({ tenantId, type: getDocumentNumberType("inventory.product"), records: [...records, { _id: "000000000000000000000013", sku: "ST1" }], claims: [] });
  assert.equal(duplicate.duplicates.length, 1);
  assert.equal(duplicate.claimsToInsert.length, 2);
});

test("backfill recognizes previously claimed records and rejects mismatched claims", () => {
  const type = getDocumentNumberType("inventory.product");
  const existing = [{ value: "ST1", recordId: records[0]._id }];
  const plan = buildBackfillPlan({ tenantId, type, records, claims: existing });
  assert.deepEqual(plan.claimsToInsert.map((claim) => claim.value), ["ST2"]);
  assert.deepEqual(plan.claimsToLink, []);
  const unlinked = buildBackfillPlan({ tenantId, type, records, claims: [{ value: "ST1", recordId: null }] });
  assert.deepEqual(unlinked.claimsToLink.map((claim) => claim.value), ["ST1"]);
  const conflict = buildBackfillPlan({ tenantId, type, records, claims: [{ value: "ST1", recordId: records[1]._id }] });
  assert.equal(conflict.duplicates.length, 1);
});

test("legacy format seeds only recognizable serials; irregular codes remain claims", () => {
  const type = getDocumentNumberType("sales.order");
  assert.deepEqual(recognizedCounterPosition(type, "SO-202609-000123"), { bucket: "202609", partition: "all", value: 123 });
  assert.equal(recognizedCounterPosition(type, "OLD-ORDER-X"), null);
  assert.deepEqual(recognizedCounterPosition(getDocumentNumberType("inventory.product"), "ST21", { categoryCode: "ST2" }), { bucket: "all", partition: "ST2", value: 1 });
  assert.equal(recognizedCounterPosition(getDocumentNumberType("inventory.product"), "ST21"), null);
});

test("shared journal fields are classified once and ambiguous manual numbers are not guessed", () => {
  const types = [getDocumentNumberType("accounting.journal"), getDocumentNumberType("accounting.voucher")];
  assert.deepEqual(matchingHistoricalTypes(types, "JV-2026-000001").map((type) => type.key), ["accounting.journal"]);
  assert.deepEqual(matchingHistoricalTypes(types, "PV-2026-000001").map((type) => type.key), ["accounting.voucher"]);
  assert.deepEqual(matchingHistoricalTypes(types, "OLD-MANUAL-9"), []);
});

test("apply uses idempotent upserts and refuses a duplicate dry-run", async () => {
  const originalClaims = DocumentNumberClaim.bulkWrite;
  const originalCounter = DocumentNumberCounter.updateOne;
  const writes = [];
  DocumentNumberClaim.bulkWrite = async (operations) => { writes.push(...operations); };
  DocumentNumberCounter.updateOne = async (...args) => { writes.push(args); };
  try {
    const plan = buildBackfillPlan({ tenantId, type: getDocumentNumberType("inventory.product"), records, claims: [] });
    await applyBackfillPlans({ tenantId, plans: [plan], unresolved: [] });
    assert.equal(writes.length, 3);
    assert.ok(writes.slice(0, 2).every((operation) => operation.updateOne.upsert));
    await assert.rejects(applyBackfillPlans({ tenantId, plans: [{ ...plan, duplicates: [{ value: "ST1" }] }], unresolved: [] }), /unsafe/i);
  } finally {
    DocumentNumberClaim.bulkWrite = originalClaims;
    DocumentNumberCounter.updateOne = originalCounter;
  }
});
