import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import SystemSettings from "../../models/administration/systemSettings.model.js";
import {
  SYSTEM_DEFAULTS,
  resolveConfiguredPageSize,
  validateSystemSettingsInput,
} from "../../services/administration/systemSettings.service.js";

test("System Settings schema allows exactly one settings document per tenant", () => {
  const uniqueTenantIndex = SystemSettings.schema.indexes().find(
    ([fields, options]) => fields.tenantId === 1 && options.unique === true
  );

  assert.ok(uniqueTenantIndex, "tenantId must have a unique index");
});

test("system defaults are safe and explicit", () => {
  assert.deepEqual(SYSTEM_DEFAULTS, {
    schemaVersion: 1,
    revision: 1,
    tablePageSize: 20,
    auditStorageLimit: 100000,
    auditRetentionMode: "warn_only",
  });
});

test("settings validation rejects unsafe values and unknown retention behavior", () => {
  assert.throws(
    () => validateSystemSettingsInput({ tablePageSize: 9 }),
    /between 10 and 200/i
  );
  assert.throws(
    () => validateSystemSettingsInput({ auditStorageLimit: 999 }),
    /between 1,000 and 10,000,000/i
  );
  assert.throws(
    () => validateSystemSettingsInput({ auditRetentionMode: "delete_immediately" }),
    /warn_only or archive_then_purge/i
  );
});

test("settings validation normalizes valid numeric input", () => {
  assert.deepEqual(
    validateSystemSettingsInput({
      tablePageSize: "50",
      auditStorageLimit: "250000",
      auditRetentionMode: "archive_then_purge",
    }),
    {
      tablePageSize: 50,
      auditStorageLimit: 250000,
      auditRetentionMode: "archive_then_purge",
    }
  );
});

test("configured page size respects explicit requests and endpoint maximums", () => {
  assert.equal(resolveConfiguredPageSize({ configured: 50, requested: undefined, endpointMax: 100 }), 50);
  assert.equal(resolveConfiguredPageSize({ configured: 50, requested: 25, endpointMax: 100 }), 25);
  assert.equal(resolveConfiguredPageSize({ configured: 50, requested: 500, endpointMax: 100 }), 100);
  assert.equal(resolveConfiguredPageSize({ configured: 50, requested: -2, endpointMax: 100 }), 50);
});

test("model validation enforces bounds even when the service is bypassed", () => {
  const settings = new SystemSettings({
    tenantId: new mongoose.Types.ObjectId(),
    tablePageSize: 201,
    auditStorageLimit: 500,
  });
  const validation = settings.validateSync();

  assert.match(validation.errors.tablePageSize.message, /maximum allowed value/i);
  assert.match(validation.errors.auditStorageLimit.message, /minimum allowed value/i);
});
