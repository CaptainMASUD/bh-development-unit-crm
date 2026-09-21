import SystemSettings from "../../models/systemSettings.model.js";
import { writeAudit } from "../../utils/audit.js";
import { runMongoTransaction, sessionOptions, withSession } from "../../utils/mongoTransaction.js";

export const SYSTEM_DEFAULTS = Object.freeze({
  schemaVersion: 1,
  revision: 1,
  tablePageSize: 20,
  auditStorageLimit: 100000,
  auditRetentionMode: "warn_only",
});

const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode });
};

const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

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

  const settings = await SystemSettings.findOneAndUpdate(
    { tenantId },
    {
      $setOnInsert: {
        tenantId,
        ...SYSTEM_DEFAULTS,
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

  return settings;
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
