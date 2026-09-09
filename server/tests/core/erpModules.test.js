import assert from "node:assert/strict";
import test from "node:test";

import {
  ERP_MODULE_IDS,
  LEGACY_ENABLED_MODULE_IDS,
  normalizeModuleIds,
  permissionModule,
  permissionsForModules,
  unknownModuleIds,
} from "../../config/erpModules.js";
import { PERMISSION_KEYS } from "../../models/permissionGroup.model.js";
import { requireModule } from "../../middleware/auth.middleware.js";

test("every catalog permission belongs to a registered module", () => {
  for (const permission of PERMISSION_KEYS) {
    assert.ok(ERP_MODULE_IDS.includes(permissionModule(permission)), permission);
  }
});

test("module normalization is explicit, unique, and keeps Administration", () => {
  assert.deepEqual(normalizeModuleIds(["PURCHASE", "purchase", "unknown"]), ["purchase", "administration"]);
  assert.deepEqual(unknownModuleIds(["purchase", "FUTURE"]), ["future"]);
});

test("legacy defaults are a fixed compatibility snapshot", () => {
  assert.deepEqual(normalizeModuleIds(undefined, { legacyDefault: true }), [...LEGACY_ENABLED_MODULE_IDS]);
  assert.notStrictEqual(LEGACY_ENABLED_MODULE_IDS, ERP_MODULE_IDS);
});

test("permission catalogs exclude disabled modules", () => {
  const catalog = permissionsForModules(PERMISSION_KEYS, ["purchase"]);
  assert.ok(catalog.includes("purchase-order:view"));
  assert.ok(catalog.includes("company:view"));
  assert.ok(!catalog.includes("inventory-product:view"));
  assert.ok(!catalog.includes("customers:view"));
});

test("module middleware blocks disabled tenant routes", () => {
  const req = { user: { role: "admin" }, tenantId: "tenant-1", enabledModules: ["administration"] };
  let response;
  const res = {
    status(status) { response = { status }; return this; },
    json(body) { response.body = body; return this; },
  };
  let nextCalled = false;
  requireModule("purchase")(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "MODULE_NOT_ENABLED");
});

test("module middleware allows an enabled tenant route", () => {
  const req = { user: { role: "employee" }, tenantId: "tenant-1", enabledModules: ["purchase", "administration"] };
  let nextCalled = false;
  requireModule("purchase")(req, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("platform Super Admin can enter Administration but not tenant operations", () => {
  const req = { user: { role: "superadmin" }, tenantId: null, enabledModules: null };
  let administrationAllowed = false;
  requireModule("administration")(req, {}, () => { administrationAllowed = true; });
  assert.equal(administrationAllowed, true);

  let response;
  const res = {
    status(status) { response = { status }; return this; },
    json(body) { response.body = body; return this; },
  };
  requireModule("purchase")(req, res, () => assert.fail("tenant operation should not be allowed"));
  assert.equal(response.status, 403);
  assert.match(response.body.message, /tenant operational data/i);
});
