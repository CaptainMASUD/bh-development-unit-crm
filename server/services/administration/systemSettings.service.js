import SystemSettings from "../../models/systemSettings.model.js";
import Company from "../../models/company.model.js";
import { writeAudit } from "../../utils/audit.js";
import { runMongoTransaction, sessionOptions, withSession } from "../../utils/mongoTransaction.js";

export const SYSTEM_DEFAULTS = Object.freeze({
  schemaVersion: 1,
  revision: 1,
  tablePageSize: 20,
  defaultDateFormat: "DD-MM-YYYY",
  defaultTimeFormat: "24-hour",
  defaultCurrency: "BDT",
  currencyDecimalPlaces: 2,
  numberDecimalPlaces: 2,
  defaultSortOrder: "newest_first",
  defaultFileUploadLimitMb: 10,
  allowedFileTypes: ["PDF", "JPG", "PNG", "XLSX", "DOCX"],
  auditStorageLimit: 100000,
  auditRetentionMode: "warn_only",
});

const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode });
};

const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
export function deriveTenantSystemDefaults(company = {}) {
  const currency = String(company.settings?.currency || "").trim().toUpperCase();
  const dateFormat = String(company.settings?.dateFormat || "").trim();
  return {
    ...SYSTEM_DEFAULTS,
    defaultCurrency: /^[A-Z]{3}$/.test(currency) ? currency : SYSTEM_DEFAULTS.defaultCurrency,
    defaultDateFormat: ["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"].includes(dateFormat) ? dateFormat : SYSTEM_DEFAULTS.defaultDateFormat,
  };
}
const choice = (value, allowed, label) => {
  const selected = String(value ?? "").trim();
  if (!allowed.includes(selected)) fail(`${label} must be one of: ${allowed.join(", ")}.`);
  return selected;
};

const boundedInteger = (value, { field, min, max, label }) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${label || field} must be between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`);
  }
  return number;
};

export function validateSystemSettingsInput(input = {}) {
  const result = {};

  if (has(input, "tablePageSize")) {
    result.tablePageSize = boundedInteger(input.tablePageSize, {
      field: "tablePageSize",
      label: "Maximum rows per table",
      min: 10,
      max: 200,
    });
  }

  if (has(input, "defaultDateFormat")) result.defaultDateFormat = choice(input.defaultDateFormat, ["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"], "Default date format");
  if (has(input, "defaultTimeFormat")) result.defaultTimeFormat = choice(input.defaultTimeFormat, ["12-hour", "24-hour"], "Default time format");
  if (has(input, "defaultCurrency")) {
    const currency = String(input.defaultCurrency ?? "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) fail("Default currency must be a three-letter ISO code.");
    result.defaultCurrency = currency;
  }
  for (const [field, label] of [["currencyDecimalPlaces", "Currency decimal places"], ["numberDecimalPlaces", "Number decimal places"]]) {
    if (has(input, field)) result[field] = boundedInteger(input[field], { field, label, min: 0, max: 6 });
  }
  if (has(input, "defaultSortOrder")) result.defaultSortOrder = choice(input.defaultSortOrder, ["newest_first", "oldest_first"], "Default sort order");
  if (has(input, "defaultFileUploadLimitMb")) result.defaultFileUploadLimitMb = boundedInteger(input.defaultFileUploadLimitMb, { field: "defaultFileUploadLimitMb", label: "Default file upload limit (MB)", min: 1, max: 100 });
  if (has(input, "allowedFileTypes")) {
    if (!Array.isArray(input.allowedFileTypes)) fail("Allowed file types must be an array.");
    const values = input.allowedFileTypes.map((value) => String(value ?? "").trim().toUpperCase());
    if (!values.length || new Set(values).size !== values.length || values.some((value) => !["PDF", "JPG", "PNG", "XLSX", "DOCX"].includes(value))) fail("Allowed file types must be a non-empty unique selection of PDF, JPG, PNG, XLSX, or DOCX.");
    result.allowedFileTypes = values;
  }

  if (has(input, "auditStorageLimit")) {
    result.auditStorageLimit = boundedInteger(input.auditStorageLimit, {
      field: "auditStorageLimit",
      label: "Audit Trail Storage Limit",
      min: 1000,
      max: 10000000,
    });
  }

  if (has(input, "auditRetentionMode")) {
    const mode = String(input.auditRetentionMode || "").trim().toLowerCase();
    if (!["warn_only", "archive_then_purge"].includes(mode)) {
      fail("Audit retention mode must be warn_only or archive_then_purge.");
    }
    result.auditRetentionMode = mode;
  }

  if (!Object.keys(result).length) fail("At least one system setting is required.");
  return result;
}

export function resolveConfiguredPageSize({ configured, requested, endpointMax = 100 }) {
  const safeMaximum = Math.max(1, Number(endpointMax) || 100);
  const configuredValue = Number(configured);
  const fallback = Number.isInteger(configuredValue) && configuredValue > 0
    ? configuredValue
    : SYSTEM_DEFAULTS.tablePageSize;
  const requestedValue = Number(requested);
  const selected = Number.isInteger(requestedValue) && requestedValue > 0
    ? requestedValue
    : fallback;
  return Math.min(safeMaximum, Math.max(1, selected));
}

export async function getSystemSettings({ tenantId, session = null }) {
  if (!tenantId) fail("A verified tenant is required.", 403);
  const company = await withSession(Company.findById(tenantId), session).lean();
  const tenantDefaults = deriveTenantSystemDefaults(company || {});

  const settings = await SystemSettings.findOneAndUpdate(
    { tenantId },
    {
      $setOnInsert: {
        tenantId,
        ...tenantDefaults,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
      ...sessionOptions(session),
    }
  ).lean();

  return { ...tenantDefaults, ...settings };
}

export async function updateSystemSettings({
  tenantId,
  actorId,
  input,
  reqMeta = {},
  expectedVersion,
}) {
  if (!tenantId) fail("A verified tenant is required.", 403);
  if (!actorId) fail("An authenticated administrator is required.", 401);
  const values = validateSystemSettingsInput(input);
  const revision = Number(expectedVersion);
  if (!Number.isInteger(revision) || revision < 1) {
    fail("A valid settings revision is required.", 400);
  }

  return runMongoTransaction(async (session) => {
    const before = await withSession(SystemSettings.findOne({ tenantId }), session).lean();
    if (!before) {
      await getSystemSettings({ tenantId, session });
    }

    const settings = await SystemSettings.findOneAndUpdate(
      { tenantId, revision },
      {
        $set: { ...values, updatedBy: actorId },
        $inc: { revision: 1 },
      },
      {
        new: true,
        runValidators: true,
        ...sessionOptions(session),
      }
    );

    if (!settings) {
      fail("System settings changed in another session. Reload and try again.", 409);
    }

    if (values.defaultCurrency || values.defaultDateFormat) {
      const company = await withSession(Company.findById(tenantId), session).lean();
      if (!company) fail("Company not found.", 404);
      const set = {};
      if (values.defaultCurrency && values.defaultCurrency !== company.settings?.currency) set["settings.currency"] = values.defaultCurrency;
      if (values.defaultDateFormat && values.defaultDateFormat !== company.settings?.dateFormat) set["settings.dateFormat"] = values.defaultDateFormat;
      if (Object.keys(set).length) {
        await Company.updateOne({ _id: tenantId }, { $set: set }, sessionOptions(session));
        await writeAudit({
          session, tenantId, actorId, action: "update", entityType: "Company", entityId: tenantId,
          before: { settings: { currency: company.settings?.currency, dateFormat: company.settings?.dateFormat } },
          after: { settings: { currency: values.defaultCurrency || company.settings?.currency, dateFormat: values.defaultDateFormat || company.settings?.dateFormat } },
          meta: reqMeta,
        }, { strict: true });
      }
    }

    await writeAudit(
      {
        session,
        tenantId,
        actorId,
        action: "update",
        entityType: "SystemSettings",
        entityId: settings._id,
        before,
        after: settings.toObject(),
        meta: reqMeta,
      },
      { strict: true }
    );

    return settings.toObject();
  });
}

export async function resolveTablePageSize({ tenantId, requestedLimit, endpointMax = 100 }) {
  const settings = await getSystemSettings({ tenantId });
  return resolveConfiguredPageSize({
    configured: settings.tablePageSize,
    requested: requestedLimit,
    endpointMax,
  });
}
