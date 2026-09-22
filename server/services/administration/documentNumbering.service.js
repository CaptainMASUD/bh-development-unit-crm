import { getDocumentNumberType } from "../../config/documentNumberTypes.js";
import DocumentNumberRule from "../../models/administration/documentNumberRule.model.js";
import DocumentNumberCounter from "../../models/administration/documentNumberCounter.model.js";
import DocumentNumberClaim from "../../models/administration/documentNumberClaim.model.js";
import Company from "../../models/company.model.js";
import mongoose from "mongoose";
import { DOCUMENT_NUMBER_TYPES } from "../../config/documentNumberTypes.js";
import { runMongoTransaction, sessionOptions, withSession } from "../../utils/mongoTransaction.js";
import { writeAudit } from "../../utils/audit.js";

const TOKENS = new Set(["PREFIX", "DATE", "ITEM", "CATEGORY", "SERIAL"]);
const EDITABLE_FIELDS = new Set(["mode", "prefix", "pattern", "resetPolicy", "serialWidth"]);
const RESET_POLICIES = new Set(["none", "daily", "monthly", "calendar_year", "fiscal_year"]);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  return error;
}

function requiredType(typeKey) {
  const type = getDocumentNumberType(typeKey);
  if (!type) throw httpError(`Unknown document number type: ${typeKey}`, 404);
  return type;
}

function parsePattern(pattern) {
  if (typeof pattern !== "string" || !pattern || pattern.length > 120) {
    throw httpError("Pattern length must be between 1 and 120 characters");
  }
  const tokens = [];
  const braces = /\{([^{}]+)\}/g;
  let match;
  while ((match = braces.exec(pattern))) {
    if (!TOKENS.has(match[1])) throw httpError(`Unknown pattern token {${match[1]}}`);
    tokens.push(match[1]);
  }
  if (pattern.replace(braces, "").includes("{") || pattern.replace(braces, "").includes("}")) {
    throw httpError("Malformed pattern token");
  }
  if (/[\x00-\x1f\x7f]/.test(pattern)) throw httpError("Pattern contains a control character");
  return tokens;
}

function normalizedCode(value, name) {
  const result = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(result)) throw httpError(`${name} must be an alphanumeric code`);
  return result;
}

function tenantDate(date, timezone = "UTC") {
  const input = date instanceof Date ? date : new Date(date ?? Date.now());
  if (Number.isNaN(input.valueOf())) throw httpError("Invalid document date");
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(input);
    const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${map.year}${map.month}${map.day}`;
  } catch {
    throw httpError("Invalid company timezone");
  }
}

export function validateRulePatch({ typeKey, input = {}, baseRule } = {}) {
  const type = requiredType(typeKey);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw httpError("Rule update must be an object");
  for (const field of Object.keys(input)) {
    if (!EDITABLE_FIELDS.has(field)) throw httpError(`Unknown rule field: ${field}`);
  }
  const rule = {
    mode: type.mode, prefix: type.prefix, pattern: type.pattern,
    resetPolicy: type.resetPolicy, serialWidth: type.serialWidth,
    maxLength: type.maxLength, contextTokens: type.contextTokens,
    ...baseRule, ...input,
  };
  if (!["auto", "manual"].includes(rule.mode)) throw httpError("Mode must be Auto or Manual");
  rule.prefix = normalizedCode(rule.prefix, "Prefix");
  if (rule.prefix.length > 24) throw httpError("Prefix exceeds maximum length");
  if (!RESET_POLICIES.has(rule.resetPolicy)) throw httpError("Invalid reset policy");
  if (!Number.isInteger(rule.serialWidth) || rule.serialWidth < 1 || rule.serialWidth > 12) {
    throw httpError("Serial width must be an integer from 1 to 12");
  }
  const tokens = parsePattern(rule.pattern);
  if (rule.mode === "auto" && !tokens.includes("SERIAL")) throw httpError("Automatic pattern must contain {SERIAL}");
  if (tokens.filter((token) => token === "SERIAL").length !== 1) throw httpError("Pattern must contain exactly one {SERIAL} token");
  for (const token of ["ITEM", "CATEGORY"]) {
    if (tokens.includes(token) && !type.contextTokens.includes(token)) throw httpError(`{${token}} is not supported for ${typeKey}`);
  }
  const literalLength = rule.pattern.replace(/\{[^{}]+\}/g, "").length;
  const upperBound = literalLength + tokens.reduce((sum, token) => sum + ({
    PREFIX: rule.prefix.length, DATE: 8, ITEM: 24, CATEGORY: 24, SERIAL: rule.serialWidth,
  })[token], 0);
  if (upperBound > type.maxLength) throw httpError(`Pattern may exceed field length ${type.maxLength}`);
  return rule;
}

export function renderDocumentNumber({ rule, serial, context = {}, date = new Date(), timezone = "UTC" } = {}) {
  if (!rule) throw httpError("Numbering rule is required");
  const tokens = parsePattern(rule.pattern);
  if (!Number.isSafeInteger(serial) || serial < 1) throw httpError("Serial must be a positive integer");
  const parts = {
    PREFIX: normalizedCode(rule.prefix, "Prefix"),
    SERIAL: String(serial).padStart(rule.serialWidth || 1, "0"),
  };
  if (tokens.includes("DATE")) parts.DATE = tenantDate(date, timezone);
  if (tokens.includes("ITEM")) parts.ITEM = normalizedCode(context.itemCode, "Item");
  if (tokens.includes("CATEGORY")) parts.CATEGORY = normalizedCode(context.categoryCode, "Category");
  const value = rule.pattern.replace(/\{([^{}]+)\}/g, (_, token) => parts[token]);
  if (rule.maxLength && value.length > rule.maxLength) throw httpError(`Document number exceeds field length ${rule.maxLength}`);
  return value;
}

export async function getEffectiveRule({ tenantId, typeKey, session } = {}) {
  const type = requiredType(typeKey);
  if (!tenantId) throw httpError("Verified tenant is required");
  const query = DocumentNumberRule.findOne({ tenantId, typeKey });
  if (session) query.session(session);
  const stored = await query.lean();
  return {
    ...validateRulePatch({ typeKey, input: stored ? {
      mode: stored.mode, prefix: stored.prefix, pattern: stored.pattern,
      resetPolicy: stored.resetPolicy, serialWidth: stored.serialWidth,
    } : {} }),
    typeKey, revision: stored?.revision ?? 0,
    customPattern: stored?.customPattern ?? false,
    legacyFormatter: stored?.customPattern ? "" : type.legacyFormatter,
  };
}

export async function previewDocumentNumber({ tenantId, typeKey, patch = {}, context = {}, serial = 1, date = new Date(), timezone = "UTC", currentRule } = {}) {
  const baseRule = currentRule || (Object.keys(patch).length ? undefined : await getEffectiveRule({ tenantId, typeKey }));
  const rule = validateRulePatch({ typeKey, input: patch, baseRule });
  const legacyFormatter = baseRule?.legacyFormatter || (!baseRule && getDocumentNumberType(typeKey).legacyFormatter);
  const useLegacy = legacyFormatter && (!Object.hasOwn(patch, "pattern") || patch.pattern === (baseRule?.pattern ?? getDocumentNumberType(typeKey).pattern));
  return { value: useLegacy ? legacyValue({ rule: { ...rule, legacyFormatter }, serial, date, timezone, context }) : renderDocumentNumber({ rule, serial, context, date, timezone }), isPreview: true };
}

export async function listDocumentNumberRules({ tenantId }) {
  if (!tenantId) throw httpError("Verified tenant is required", 403);
  const stored = await DocumentNumberRule.find({ tenantId }).lean();
  const byKey = new Map(stored.map((rule) => [rule.typeKey, rule]));
  return DOCUMENT_NUMBER_TYPES.map((type) => {
    const saved = byKey.get(type.key);
    return {
      typeKey: type.key, module: type.module, label: type.label,
      contextTokens: type.contextTokens,
      mode: saved?.mode ?? type.mode,
      prefix: saved?.prefix ?? type.prefix,
      pattern: saved?.pattern ?? type.pattern,
      resetPolicy: saved?.resetPolicy ?? type.resetPolicy,
      serialWidth: saved?.serialWidth ?? type.serialWidth,
      revision: saved?.revision ?? 0,
    };
  });
}

export async function updateDocumentNumberRule({ tenantId, typeKey, input, expectedRevision, actorId, reqMeta = {} }) {
  const type = requiredType(typeKey);
  if (!tenantId) throw httpError("Verified tenant is required", 403);
  if (!actorId) throw httpError("Authenticated administrator is required", 401);
  const revision = Number(expectedRevision);
  if (!Number.isInteger(revision) || revision < 0) throw httpError("A valid rule revision is required");
  return runMongoTransaction(async (session) => {
    const before = await withSession(DocumentNumberRule.findOne({ tenantId, typeKey }), session).lean();
    if ((before?.revision ?? 0) !== revision) throw httpError("Rule changed in another session. Reload and try again.", 409);
    const validated = validateRulePatch({ typeKey, input, baseRule: before || undefined });
    const values = {
      tenantId, typeKey, mode: validated.mode, prefix: validated.prefix,
      pattern: validated.pattern, resetPolicy: validated.resetPolicy,
      serialWidth: validated.serialWidth, updatedBy: actorId,
      customPattern: Boolean(before?.customPattern || (Object.hasOwn(input, "pattern") && input.pattern !== (before?.pattern ?? type.pattern))),
      revision: revision + 1,
    };
    let saved;
    if (revision === 0) {
      try {
        [saved] = await DocumentNumberRule.create([values], sessionOptions(session));
      } catch (error) {
        if (isDuplicate(error)) throw httpError("Rule changed in another session. Reload and try again.", 409);
        throw error;
      }
    } else {
      saved = await DocumentNumberRule.findOneAndUpdate(
        { tenantId, typeKey, revision },
        { $set: values },
        { new: true, runValidators: true, ...sessionOptions(session) },
      );
    }
    if (!saved) throw httpError("Rule changed in another session. Reload and try again.", 409);
    await writeAudit({
      session, tenantId, actorId, action: "update", entityType: "DocumentNumberRule",
      entityId: saved._id, before, after: saved.toObject(), meta: reqMeta,
    }, { strict: true });
    return { ...saved.toObject(), label: type.label, module: type.module };
  });
}

function periodBucket(rule, date, timezone, context) {
  if (rule.resetPolicy === "none") return "all";
  const day = tenantDate(date, timezone);
  if (rule.resetPolicy === "daily") return day;
  if (rule.resetPolicy === "monthly") return day.slice(0, 6);
  if (rule.resetPolicy === "calendar_year") return day.slice(0, 4);
  if (context.fiscalYearName) return String(context.fiscalYearName);
  const fiscalStartMonth = Number(context.fiscalStartMonth || 7);
  if (!Number.isInteger(fiscalStartMonth) || fiscalStartMonth < 1 || fiscalStartMonth > 12) throw httpError("Invalid fiscal start month");
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(4, 6));
  return String(month >= fiscalStartMonth ? year : year - 1);
}

function legacyValue({ rule, serial, date, timezone, context }) {
  const day = tenantDate(date, timezone);
  const padded = String(serial).padStart(rule.serialWidth, "0");
  if (rule.legacyFormatter === "sales_month") return `${rule.prefix}-${day.slice(0, 6)}-${padded}`;
  if (rule.legacyFormatter === "purchase_year") return `${rule.prefix}-${day.slice(0, 4)}-${padded}`;
  if (rule.legacyFormatter === "manufacturing_year") return `${rule.prefix}-${day.slice(0, 4)}-${padded}`;
  if (rule.legacyFormatter === "accounting_fiscal") return `${rule.prefix}-${periodBucket(rule, date, timezone, context)}-${padded}`;
  return renderDocumentNumber({ rule, serial, date, timezone, context });
}

export function buildSerialMatcher({ rule, date, timezone, context = {} }) {
  const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const marker = "__DOCUMENT_SERIAL__";
  const day = tenantDate(date, timezone);
  let template;
  if (rule.legacyFormatter === "sales_month") template = `${rule.prefix}-${day.slice(0, 6)}-${marker}`;
  else if (rule.legacyFormatter === "purchase_year" || rule.legacyFormatter === "manufacturing_year") template = `${rule.prefix}-${day.slice(0, 4)}-${marker}`;
  else if (rule.legacyFormatter === "accounting_fiscal") template = `${rule.prefix}-${periodBucket(rule, date, timezone, context)}-${marker}`;
  else {
    const parts = {
      PREFIX: normalizedCode(rule.prefix, "Prefix"), DATE: day, SERIAL: marker,
      ITEM: () => normalizedCode(context.itemCode, "Item"),
      CATEGORY: () => normalizedCode(context.categoryCode, "Category"),
    };
    template = rule.pattern.replace(/\{([^{}]+)\}/g, (_, token) => typeof parts[token] === "function" ? parts[token]() : parts[token]);
  }
  const pieces = template.split(marker);
  if (pieces.length !== 2) throw httpError("Pattern must contain exactly one {SERIAL} token");
  return { prefix: pieces[0], expression: new RegExp(`^${escape(pieces[0])}([0-9]+)${escape(pieces[1])}$`, "i") };
}

function isDuplicate(error) {
  return error?.code === 11000;
}

async function existsInBusinessRecords({ type, tenantId, value, session }) {
  const model = mongoose.models[type.model];
  if (!model?.schema?.path(type.field)) return false;
  const filter = { [type.field]: value };
  if (model.schema.path("tenantId")) filter.tenantId = tenantId;
  const query = model.findOne(filter).select("_id");
  if (session) query.session(session);
  return Boolean(await query.lean());
}

async function seedLegacyCounter({ type, tenantId, bucket, partition, rule, date, timezone, context, session }) {
  const model = mongoose.models[type.model];
  if (!model?.schema?.path(type.field)) return;
  const { prefix, expression } = buildSerialMatcher({ rule, date, timezone, context });
  const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = { [type.field]: prefix ? new RegExp(`^${escape(prefix)}`, "i") : { $type: "string" } };
  if (model.schema.path("tenantId")) filter.tenantId = tenantId;
  const query = model.find(filter).select(type.field);
  if (session) query.session(session);
  const records = await query.lean();
  const highest = records.reduce((max, record) => {
    const value = Number(expression.exec(String(record[type.field] || ""))?.[1]);
    return Number.isSafeInteger(value) ? Math.max(max, value) : max;
  }, 0);
  if (highest) {
    await DocumentNumberCounter.updateOne(
      { tenantId, typeKey: type.key, bucket, partition },
      { $max: { value: highest } },
      { session: session || undefined },
    );
  }
}

export async function assignDocumentNumber({
  tenantId, typeKey, providedValue, context = {}, date = new Date(), timezone,
  session, idempotencyKey = "", source = "",
} = {}) {
  const type = requiredType(typeKey);
  if (!tenantId) throw httpError("Verified tenant is required");
  if (!timezone) {
    const company = await Company.findById(tenantId).select("settings.timezone").lean();
    timezone = company?.settings?.timezone || "UTC";
  }
  const rule = await getEffectiveRule({ tenantId, typeKey, session });
  if (idempotencyKey) {
    const previous = await DocumentNumberClaim.findOne({ tenantId, typeKey, idempotencyKey }).session(session || null).lean();
    if (previous) {
      if (providedValue && normalizedCode(providedValue, type.label) !== previous.value) {
        throw httpError("Idempotency key was already used with a different number", 409);
      }
      return { value: previous.value, ruleRevision: previous.ruleRevision, existingRecordId: previous.recordId };
    }
  }
  const hasValue = providedValue !== undefined && providedValue !== null && String(providedValue).trim() !== "";
  if (rule.mode === "auto" && hasValue) throw httpError(`${type.label} is automatically assigned; do not submit a number`);
  if (rule.mode === "manual" && !hasValue) throw httpError(`${type.label} is required in Manual mode`);
  const createClaim = async (value) => {
    const docs = await DocumentNumberClaim.create([{
      tenantId, typeKey, value, source,
      idempotencyKey: idempotencyKey || "", ruleRevision: rule.revision || 1,
    }], session ? { session } : undefined);
    return { value: docs[0].value, ruleRevision: rule.revision || 1 };
  };
  if (rule.mode === "manual") {
    const value = normalizedCode(providedValue, type.label);
    if (value.length > type.maxLength) throw httpError(`${type.label} exceeds field length ${type.maxLength}`);
    if (await existsInBusinessRecords({ type, tenantId, value, session })) throw httpError(`${type.label} already exists`, 409);
    try { return await createClaim(value); }
    catch (error) { if (isDuplicate(error)) throw httpError(`${type.label} already exists`, 409); throw error; }
  }
  const partition = type.partitionBy === "category" ? normalizedCode(context.categoryCode, "Category") : "all";
  const bucket = periodBucket(rule, date, timezone, context);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const counter = await DocumentNumberCounter.findOneAndUpdate(
      { tenantId, typeKey, bucket, partition },
      { $inc: { value: 1 }, $setOnInsert: { tenantId, typeKey, bucket, partition } },
      { upsert: true, new: true, session: session || undefined, setDefaultsOnInsert: true },
    );
    const value = legacyValue({ rule, serial: counter.value, context, date, timezone });
    if (value.length > type.maxLength) throw httpError(`${type.label} exceeds field length ${type.maxLength}`);
    if (await existsInBusinessRecords({ type, tenantId, value, session })) {
      if (attempt === 0) await seedLegacyCounter({ type, tenantId, bucket, partition, rule, date, timezone, context, session });
      continue;
    }
    try { return await createClaim(value); }
    catch (error) {
      if (!isDuplicate(error)) throw error;
      if (idempotencyKey) {
        const previous = await DocumentNumberClaim.findOne({ tenantId, typeKey, idempotencyKey }).session(session || null).lean();
        if (previous) return { value: previous.value, ruleRevision: previous.ruleRevision, existingRecordId: previous.recordId };
      }
    }
  }
  throw httpError(`Could not allocate a unique ${type.label} after 10 attempts`, 409);
}

export async function finalizeDocumentNumberClaim({ tenantId, typeKey, value, recordId, session } = {}) {
  requiredType(typeKey);
  if (!tenantId || !recordId) throw httpError("Tenant and record are required to finalize a number");
  const claim = await DocumentNumberClaim.findOneAndUpdate(
    { tenantId, typeKey, value: normalizedCode(value, "Document number"), recordId: null },
    { $set: { recordId } },
    { new: true, session: session || undefined },
  );
  if (!claim) throw httpError("Document number claim not found or already finalized", 409);
  return claim;
}
