import assert from "node:assert/strict";
import test from "node:test";

import { ERP_MODULES, permissionModule, permissionsForModules } from "../../config/erpModules.js";
import { PERMISSION_KEYS } from "../../models/administration/permissionGroup.model.js";

test("phase-one Administration permissions are valid Administration-module permissions", () => {
  const keys = [
    "administration-dashboard:view",
    "system-settings:view",
    "system-settings:manage",
  ];

  for (const key of keys) {
    assert.equal(PERMISSION_KEYS.includes(key), true, `${key} must be assignable`);
    assert.equal(permissionModule(key), "administration", `${key} must be tenant-module scoped`);
  }

  assert.deepEqual(permissionsForModules(keys, ["administration"]), keys);
  assert.deepEqual(permissionsForModules(keys, ["crm"]), keys);
});

test("Administration module advertises every phase-one permission prefix", () => {
  const administration = ERP_MODULES.find((module) => module.id === "administration");

  assert.ok(administration);
  assert.equal(administration.permissionPrefixes.includes("administration-dashboard"), true);
  assert.equal(administration.permissionPrefixes.includes("system-settings"), true);
});
