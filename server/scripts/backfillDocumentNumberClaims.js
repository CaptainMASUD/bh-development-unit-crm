import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { DOCUMENT_NUMBER_TYPES } from "../config/documentNumberTypes.js";
import DocumentNumberClaim from "../models/administration/documentNumberClaim.model.js";
import DocumentNumberCounter from "../models/administration/documentNumberCounter.model.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Only confidently recognized serials may advance a counter. All other historical
// identifiers are still claimed; the online allocator also checks business rows.
export function recognizedCounterPosition(type, rawValue, context = {}) {
  const value = String(rawValue || "").trim().toUpperCase();
  let match;
  if (type.partitionBy === "category" && type.pattern === "{CATEGORY}{SERIAL}") {
    const categoryCode = String(context.categoryCode || "").trim().toUpperCase();
    if (!categoryCode || !value.startsWith(categoryCode)) return null;
    const suffix = value.slice(categoryCode.length);
    if (/^[0-9]+$/.test(suffix)) return { bucket: "all", partition: categoryCode, value: Number(suffix) };
    return null;
  }
  const prefix = escapeRegex(type.prefix);
  if (type.legacyFormatter === "sales_month") {
    match = new RegExp(`^${prefix}-(\\d{6})-(\\d+)$`).exec(value);
    if (match) return { bucket: match[1], partition: "all", value: Number(match[2]) };
  } else if (["purchase_year", "manufacturing_year", "accounting_fiscal"].includes(type.legacyFormatter)) {
    match = new RegExp(`^${prefix}-(\\d{4})-(\\d+)$`).exec(value);
    if (match) return { bucket: type.resetPolicy === "none" ? "all" : match[1], partition: "all", value: Number(match[2]) };
  } else if (type.pattern === "{PREFIX}-{DATE}-{SERIAL}") {
    match = new RegExp(`^${prefix}-(\\d{8})-(\\d+)$`).exec(value);
    if (match) {
      const bucket = { daily: match[1], monthly: match[1].slice(0, 6), calendar_year: match[1].slice(0, 4), none: "all" }[type.resetPolicy];
      if (bucket) return { bucket, partition: "all", value: Number(match[2]) };
    }
  }
  return null;
}

export function buildBackfillPlan({ tenantId, type, records = [], claims = [] }) {
  const seenRecords = new Map();
  const existingClaims = new Map(claims.map((claim) => [String(claim.value || "").toUpperCase(), claim]));
  const claimsToInsert = [];
  const claimsToLink = [];
  const duplicates = [];
  const seeds = new Map();
  for (const record of records) {
    const value = String(record[type.field] || "").trim().toUpperCase();
    if (!value) continue;
    const recordId = String(record._id);
    const firstId = seenRecords.get(value);
    if (firstId && firstId !== recordId) {
      duplicates.push({ value, recordIds: [firstId, recordId], reason: "duplicate business identifier" });
      continue;
    }
    seenRecords.set(value, recordId);
    const claim = existingClaims.get(value);
    if (claim?.recordId && String(claim.recordId) !== recordId) {
      duplicates.push({ value, recordIds: [String(claim.recordId), recordId], reason: "claim belongs to another record" });
      continue;
    }
    if (!claim) claimsToInsert.push({ tenantId, typeKey: type.key, value, recordId: record._id, source: "historical-backfill", ruleRevision: 1 });
    else if (!claim.recordId) claimsToLink.push({ value, recordId: record._id });
    const position = recognizedCounterPosition(type, value, { categoryCode: record.category?.code });
    if (position && Number.isSafeInteger(position.value) && position.value > 0) {
      const seedKey = `${position.bucket}:${position.partition}`;
      seeds.set(seedKey, { ...position, value: Math.max(seeds.get(seedKey)?.value || 0, position.value) });
    }
  }
  return { typeKey: type.key, scanned: records.length, claimsToInsert, claimsToLink, duplicates, counterSeeds: [...seeds.values()] };
}

export function matchingHistoricalTypes(types, value) {
  const number = String(value || "").trim().toUpperCase();
  return types.filter((type) => number.startsWith(`${type.prefix}-`));
}

export async function collectBackfillPlans({ tenantId, types = DOCUMENT_NUMBER_TYPES }) {
  if (!mongoose.isValidObjectId(tenantId)) throw new Error("A valid --tenant-id is required.");
  const plans = [];
  const unresolved = [];
  for (const type of types) {
    const model = mongoose.models[type.model];
    if (!model?.schema.path(type.field)) {
      unresolved.push({ typeKey: type.key, model: type.model, field: type.field });
      continue;
    }
    const query = model.find({ tenantId, [type.field]: { $type: "string", $ne: "" } })
      .select(`_id ${type.field}${type.partitionBy === "category" ? " category" : ""}`);
    if (type.partitionBy === "category") query.populate("category", "code");
    const allRecords = await query.lean();
    const sharedTypes = types.filter((candidate) => candidate.model === type.model && candidate.field === type.field);
    const records = sharedTypes.length === 1 ? allRecords : allRecords.filter((record) => {
      const matches = matchingHistoricalTypes(sharedTypes, record[type.field]);
      return matches.length === 1 && matches[0].key === type.key;
    });
    if (sharedTypes.length > 1 && sharedTypes[0].key === type.key) {
      const ambiguous = allRecords.filter((record) => matchingHistoricalTypes(sharedTypes, record[type.field]).length !== 1);
      if (ambiguous.length) unresolved.push({ typeKey: sharedTypes.map((item) => item.key).join("/"), reason: "ambiguous historical identifier", count: ambiguous.length });
    }
    const claims = await DocumentNumberClaim.find({ tenantId, typeKey: type.key }).select("value recordId").lean();
    plans.push(buildBackfillPlan({ tenantId, type, records, claims }));
  }
  return { tenantId, plans, unresolved };
}

export async function applyBackfillPlans({ tenantId, plans, unresolved }) {
  if (unresolved.length || plans.some((plan) => plan.duplicates.length)) {
    throw new Error("Backfill is unsafe: resolve unknown models and duplicate identifiers before --apply.");
  }
  for (const plan of plans) {
    if (plan.claimsToInsert.length) {
      await DocumentNumberClaim.bulkWrite(plan.claimsToInsert.map((claim) => ({
        updateOne: {
          filter: { tenantId, typeKey: claim.typeKey, value: claim.value },
          update: { $setOnInsert: claim }, upsert: true,
        },
      })), { ordered: false });
    }
    for (const claim of plan.claimsToLink) {
      await DocumentNumberClaim.updateOne(
        { tenantId, typeKey: plan.typeKey, value: claim.value, recordId: null },
        { $set: { recordId: claim.recordId } },
      );
    }
    for (const seed of plan.counterSeeds) {
      await DocumentNumberCounter.updateOne(
        { tenantId, typeKey: plan.typeKey, bucket: seed.bucket, partition: seed.partition },
        { $max: { value: seed.value }, $setOnInsert: { tenantId, typeKey: plan.typeKey, bucket: seed.bucket, partition: seed.partition } },
        { upsert: true },
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => !["--apply", "--dry-run", "--tenant-id"].includes(argument) && argument !== args[args.indexOf("--tenant-id") + 1])) {
    throw new Error("Usage: node scripts/backfillDocumentNumberClaims.js [--dry-run|--apply] --tenant-id <company-id>");
  }
  const tenantId = args[args.indexOf("--tenant-id") + 1];
  const apply = args.includes("--apply");
  if (apply && args.includes("--dry-run")) throw new Error("Choose either --apply or --dry-run.");
  if (!mongoose.isValidObjectId(tenantId)) throw new Error("A valid --tenant-id is required.");
  await import("dotenv/config");
  await import("../app.js"); // Registers the same models and tenant plugin as the API.
  const { default: connectDB } = await import("../db/index.js");
  await connectDB();
  try {
    const result = await collectBackfillPlans({ tenantId });
    const report = {
      mode: apply ? "apply" : "dry-run", tenantId,
      types: result.plans.map(({ typeKey, scanned, claimsToInsert, claimsToLink, duplicates, counterSeeds }) => ({
        typeKey, scanned, claimsToInsert: claimsToInsert.length, claimsToLink: claimsToLink.length, duplicates, counterSeeds,
      })), unresolved: result.unresolved,
    };
    if (apply) await applyBackfillPlans(result);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (result.unresolved.length || result.plans.some((plan) => plan.duplicates.length)) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
