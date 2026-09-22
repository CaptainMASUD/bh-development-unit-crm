import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import AccessRole from "../../models/accessRole.model.js";
import Department from "../../models/department.model.js";
import PermissionGroup from "../../models/permissionGroup.model.js";
import User from "../../models/user.model.js";
import {
  matrixToPermissions,
  permissionsToMatrix,
  ROLE_MATRIX_CATALOG,
} from "../../config/roleMatrixCatalog.js";
import {
  createRole,
  deleteRole,
  getRoleDetail,
  getRoleMatrixCatalog,
  listRoles,
  updateRole,
} from "../../services/administration/roleManagement.service.js";

test("matrixToPermissions converts accessibility matrix to canonical permission keys", () => {
  const matrix = [
    {
      submodule: "manufacturing-bom",
      view: true,
      create: true,
      edit: true,
      delete: true,
      approve: true,
    },
    {
      submodule: "inventory-products",
      view: true,
      create: false,
      edit: false,
      delete: false,
      approve: false,
    },
  ];

  const permissions = matrixToPermissions(matrix);

  assert.ok(permissions.includes("manufacturing-bom:view"));
  assert.ok(permissions.includes("manufacturing-bom:manage"));
  assert.ok(permissions.includes("manufacturing-bom:delete"));
  assert.ok(permissions.includes("manufacturing-bom:approve"));
  assert.ok(permissions.includes("inventory-product:view"));
  assert.equal(permissions.includes("inventory-product:delete"), false);
});

test("permissionsToMatrix reconstitutes matrix from permission list", () => {
  const permissions = [
    "manufacturing-bom:view",
    "manufacturing-bom:manage",
    "manufacturing-bom:delete",
    "manufacturing-bom:approve",
  ];

  const matrix = permissionsToMatrix(permissions, ["manufacturing"]);
  const bomRow = matrix.find((r) => r.submodule === "manufacturing-bom");

  assert.ok(bomRow);
  assert.equal(bomRow.view, true);
  assert.equal(bomRow.create, true);
  assert.equal(bomRow.edit, true);
  assert.equal(bomRow.delete, true);
  assert.equal(bomRow.approve, true);
  assert.equal(bomRow.all, true);
});

test("createRole creates custom role with department and syncs permission group", async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const departmentId = new mongoose.Types.ObjectId();

  const originalDeptExists = Department.exists;
  const originalGroupCreate = PermissionGroup.create;
  const originalRoleCreate = AccessRole.create;
  const originalRoleFindById = AccessRole.findById;
  const originalAuditLogCreate = mongoose.model("AuditLog").create;

  let createdGroup = null;
  let createdRole = null;

  mongoose.model("AuditLog").create = async () => ({});
  Department.exists = async () => true;
  PermissionGroup.create = async (payload) => {
    createdGroup = { _id: new mongoose.Types.ObjectId(), ...payload };
    return createdGroup;
  };

  AccessRole.create = async (payload) => {
    createdRole = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      toObject() {
        return this;
      },
    };
    return createdRole;
  };

  AccessRole.findById = (id) => ({
    populate() {
      return {
        populate() {
          return {
            async lean() {
              return {
                ...createdRole,
                department: { _id: departmentId, name: "IT", code: "IT" },
                permissionGroup: createdGroup,
              };
            },
          };
        },
      };
    },
  });

  t.after(() => {
    Department.exists = originalDeptExists;
    PermissionGroup.create = originalGroupCreate;
    AccessRole.create = originalRoleCreate;
    AccessRole.findById = originalRoleFindById;
    mongoose.model("AuditLog").create = originalAuditLogCreate;
  });

  const role = await createRole({
    tenantId,
    actorId,
    input: {
      name: "IT Manager",
      department: departmentId.toString(),
      description: "Manages IT operations and manufacturing setup",
      modules: ["manufacturing"],
      accessMatrix: [
        {
          submodule: "manufacturing-bom",
          view: true,
          create: true,
          edit: true,
          delete: false,
          approve: false,
        },
      ],
    },
  });

  assert.equal(role.name, "IT Manager");
  assert.equal(role.department.name, "IT");
  assert.deepEqual(role.modules, ["manufacturing"]);
  assert.ok(createdGroup);
  assert.ok(createdGroup.permissions.includes("manufacturing-bom:view"));
  assert.ok(createdGroup.permissions.includes("manufacturing-bom:manage"));
});

test("createRole rejects protected system role names", async () => {
  const tenantId = new mongoose.Types.ObjectId();
  await assert.rejects(
    async () => createRole({ tenantId, input: { name: "admin" } }),
    /protected system role/i
  );
  await assert.rejects(
    async () => createRole({ tenantId, input: { name: "Employee" } }),
    /protected system role/i
  );
});

test("deleteRole blocks deletion when assigned to employees or when password fails", async (t) => {
  const tenantId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const roleId = new mongoose.Types.ObjectId();

  const originalUserFindById = User.findById;
  const originalUserCount = User.countDocuments;

  User.findById = (id) => ({
    select() {
      return {
        async comparePassword(p) {
          return p === "correct-secret";
        },
      };
    },
  });

  User.countDocuments = async (q) => {
    if (q.accessRole) return 2; // 2 employees currently assigned
    return 0;
  };

  t.after(() => {
    User.findById = originalUserFindById;
    User.countDocuments = originalUserCount;
  });

  // Password missing
  await assert.rejects(
    async () => deleteRole({ tenantId, actorId, id: roleId, password: "" }),
    /password is required/i
  );

  // Wrong password
  await assert.rejects(
    async () => deleteRole({ tenantId, actorId, id: roleId, password: "wrong" }),
    /password is incorrect/i
  );

  // Assigned to employees
  await assert.rejects(
    async () => deleteRole({ tenantId, actorId, id: roleId, password: "correct-secret" }),
    /assigned to 2 employee/i
  );
});

test("getRoleMatrixCatalog returns full modules and submodules structure", () => {
  const catalog = getRoleMatrixCatalog();
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length >= 8);

  const mfg = catalog.find((c) => c.moduleId === "manufacturing");
  assert.ok(mfg);
  assert.ok(mfg.submodules.length > 5);

  const bom = mfg.submodules.find((s) => s.key === "manufacturing-bom");
  assert.ok(bom);
  assert.equal(bom.route, "/manufacturing/bom");
  assert.equal(bom.actions.view, "manufacturing-bom:view");
  assert.equal(bom.actions.approve, "manufacturing-bom:approve");
});
