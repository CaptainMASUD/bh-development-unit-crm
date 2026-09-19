import assert from "node:assert/strict";
import test from "node:test";

import app from "../../app.js";
import {
  ERP_MODULES,
  ERP_MODULE_DEPENDENCIES,
  permissionModule,
} from "../../config/erpModules.js";
import { PERMISSION_KEYS } from "../../models/administration/permissionGroup.model.js";

const manufacturingPermissions = [
  "manufacturing-bom:approve", "manufacturing-bom:delete", "manufacturing-bom:manage", "manufacturing-bom:view",
  "manufacturing-cost:manage", "manufacturing-cost:view",
  "manufacturing-machine:delete", "manufacturing-machine:manage", "manufacturing-machine:view",
  "manufacturing-maintenance:manage", "manufacturing-maintenance:view",
  "manufacturing-material:manage", "manufacturing-material:post", "manufacturing-material:view",
  "manufacturing-mrp:manage", "manufacturing-mrp:view",
  "manufacturing-order:delete", "manufacturing-order:manage", "manufacturing-order:release", "manufacturing-order:view",
  "manufacturing-plan:approve", "manufacturing-plan:delete", "manufacturing-plan:manage", "manufacturing-plan:view",
  "manufacturing-production:manage", "manufacturing-production:post", "manufacturing-production:view",
  "manufacturing-quality:approve", "manufacturing-quality:manage", "manufacturing-quality:view",
  "manufacturing-report:view",
  "manufacturing-rework:delete", "manufacturing-rework:manage", "manufacturing-rework:view",
  "manufacturing-routing:delete", "manufacturing-routing:manage", "manufacturing-routing:view",
  "manufacturing-schedule:delete", "manufacturing-schedule:manage", "manufacturing-schedule:view",
  "manufacturing-scrap:delete", "manufacturing-scrap:manage", "manufacturing-scrap:view",
  "manufacturing-subcontract:delete", "manufacturing-subcontract:manage", "manufacturing-subcontract:view",
  "manufacturing-wip:view",
  "manufacturing-work-center:delete", "manufacturing-work-center:manage", "manufacturing-work-center:view",
  "manufacturing-work-order:execute", "manufacturing-work-order:manage", "manufacturing-work-order:view",
];

test("manufacturing API is mounted behind authentication", async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/manufacturing/bom`);

    assert.equal(response.status, 401);
  } finally {
    server.close();
  }
});

test("manufacturing is registered with permission and dependency metadata", () => {
  const module = ERP_MODULES.find((item) => item.id === "manufacturing");

  assert.ok(module);
  assert.equal(module.code, "MANUFACTURING");
  assert.equal(permissionModule("manufacturing-bom:view"), "manufacturing");
  assert.deepEqual(ERP_MODULE_DEPENDENCIES.manufacturing, [
    "inventory",
    "purchase",
    "accounting",
  ]);
});

test("every Manufacturing route permission can be assigned to a permission group", () => {
  for (const permission of manufacturingPermissions) {
    assert.ok(PERMISSION_KEYS.includes(permission), permission);
    assert.equal(permissionModule(permission), "manufacturing");
  }
});
