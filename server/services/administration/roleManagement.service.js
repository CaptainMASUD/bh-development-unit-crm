import mongoose from "mongoose";
import AccessRole from "../../models/accessRole.model.js";
import Department from "../../models/department.model.js";
import PermissionGroup, { PERMISSION_KEYS } from "../../models/permissionGroup.model.js";
import User from "../../models/user.model.js";
import {
  ROLE_MATRIX_CATALOG,
  matrixToPermissions,
  permissionsToMatrix,
} from "../../config/roleMatrixCatalog.js";
import { writeAudit } from "../../utils/audit.js";

const clean = (val) => String(val ?? "").trim();

const isSystemRoleName = (name) => {
  const norm = clean(name).toLowerCase();
  return ["superadmin", "admin", "employee"].includes(norm);
};

export async function listRoles({ tenantId, search, departmentId, moduleId }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  const query = { tenantId };

  if (departmentId && mongoose.isValidObjectId(departmentId)) {
    query.department = new mongoose.Types.ObjectId(departmentId);
  }

  if (moduleId && clean(moduleId)) {
    query.modules = clean(moduleId).toLowerCase();
  }

  if (search && clean(search)) {
    const escaped = clean(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    query.$or = [{ name: regex }, { description: regex }];
  }

  const [customRoles, departments, totalEmployees] = await Promise.all([
    AccessRole.find(query)
      .populate("department", "name code")
      .populate("permissionGroup", "name permissions isActive")
      .sort({ nameLower: 1 })
      .lean(),
    Department.find({ tenantId, isActive: true }).select("_id name code").lean(),
    User.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), accessRole: { $ne: null } } },
      { $group: { _id: "$accessRole", count: { $sum: 1 } } },
    ]),
  ]);

  const employeeCountByRole = new Map(
    totalEmployees.map((item) => [String(item._id), item.count])
  );

  const enrichedCustomRoles = customRoles.map((role) => ({
    ...role,
    isSystem: false,
    employeeCount: employeeCountByRole.get(String(role._id)) || 0,
    permissionCount: (role.permissions || []).length,
    moduleCount: (role.modules || []).length,
  }));

  // Built-in system roles
  const systemRoles = [
    {
      _id: "system:admin",
      name: "Admin",
      description: "Built-in Administrator role with full operational and system permissions.",
      department: null,
      modules: ROLE_MATRIX_CATALOG.map((m) => m.moduleId),
      permissions: PERMISSION_KEYS,
      permissionCount: PERMISSION_KEYS.length,
      moduleCount: ROLE_MATRIX_CATALOG.length,
      isSystem: true,
      isActive: true,
      employeeCount: await User.countDocuments({ tenantId, role: "admin", isActive: true }),
    },
    {
      _id: "system:employee",
      name: "Employee",
      description: "Standard built-in Employee role. Specific feature accessibility is controlled via custom assigned roles.",
      department: null,
      modules: [],
      permissions: [],
      permissionCount: 0,
      moduleCount: 0,
      isSystem: true,
      isActive: true,
      employeeCount: await User.countDocuments({
        tenantId,
        role: "employee",
        accessRole: null,
        isActive: true,
      }),
    },
  ];

  // Filter system roles if departmentId or search is active
  const filteredSystemRoles = systemRoles.filter((role) => {
    if (departmentId) return false;
    if (moduleId && !role.modules.includes(clean(moduleId).toLowerCase())) return false;
    if (search && clean(search)) {
      const q = clean(search).toLowerCase();
      return role.name.toLowerCase().includes(q) || role.description.toLowerCase().includes(q);
    }
    return true;
  });

  const allRoles = [...filteredSystemRoles, ...enrichedCustomRoles];

  const coveredDeptIds = new Set(
    customRoles.map((r) => r.department?._id && String(r.department._id)).filter(Boolean)
  );

  const stats = {
    totalRoles: allRoles.length,
    customRoles: enrichedCustomRoles.length,
    activeRoles: allRoles.filter((r) => r.isActive !== false).length,
    departmentsCovered: coveredDeptIds.size,
    totalDepartments: departments.length,
  };

  return {
    roles: allRoles,
    stats,
  };
}

export async function getRoleDetail({ tenantId, id }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  if (!id) {
    throw Object.assign(new Error("Role ID is required."), { statusCode: 400 });
  }

  if (String(id).startsWith("system:")) {
    const isSysAdmin = id === "system:admin";
    const modules = isSysAdmin ? ROLE_MATRIX_CATALOG.map((m) => m.moduleId) : [];
    const permissions = isSysAdmin ? PERMISSION_KEYS : [];
    const accessMatrix = permissionsToMatrix(permissions, modules);

    return {
      _id: id,
      name: isSysAdmin ? "Admin" : "Employee",
      description: isSysAdmin
        ? "Built-in Administrator role with full operational and system permissions."
        : "Standard built-in Employee role.",
      department: null,
      modules,
      permissions,
      accessMatrix,
      isSystem: true,
      isActive: true,
      employeeCount: await User.countDocuments({
        tenantId,
        role: isSysAdmin ? "admin" : "employee",
      }),
    };
  }

  if (!mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error("Invalid role ID."), { statusCode: 400 });
  }

  const role = await AccessRole.findOne({ _id: id, tenantId })
    .populate("department", "name code description head")
    .populate("permissionGroup", "name permissions isActive")
    .lean();

  if (!role) {
    throw Object.assign(new Error("Role not found."), { statusCode: 404 });
  }

  const employeeCount = await User.countDocuments({ tenantId, accessRole: role._id });

  let accessMatrix = role.accessMatrix || [];
  if (!accessMatrix || accessMatrix.length === 0) {
    accessMatrix = permissionsToMatrix(role.permissions || [], role.modules || []);
  }

  return {
    ...role,
    employeeCount,
    accessMatrix,
  };
}

export async function createRole({ tenantId, actorId, input = {}, reqMeta = {} }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  const name = clean(input.name);
  if (!name) {
    throw Object.assign(new Error("Role name is required."), { statusCode: 400 });
  }

  if (isSystemRoleName(name)) {
    throw Object.assign(
      new Error("Admin, Superadmin, and Employee are protected system role names."),
      { statusCode: 400 }
    );
  }

  let department = null;
  if (input.department && clean(input.department)) {
    if (!mongoose.isValidObjectId(input.department)) {
      throw Object.assign(new Error("Invalid department ID."), { statusCode: 400 });
    }
    const deptExists = await Department.exists({
      _id: input.department,
      tenantId,
      isActive: true,
    });
    if (!deptExists) {
      throw Object.assign(new Error("Selected department does not exist or is inactive."), {
        statusCode: 400,
      });
    }
    department = new mongoose.Types.ObjectId(input.department);
  }

  const modules = Array.isArray(input.modules)
    ? [...new Set(input.modules.map((m) => clean(m).toLowerCase()).filter(Boolean))]
    : [];

  const rawMatrix = Array.isArray(input.accessMatrix) ? input.accessMatrix : [];
  const matrixPermissions = matrixToPermissions(rawMatrix);
  const extraPermissions = Array.isArray(input.permissions)
    ? input.permissions.map(clean).filter(Boolean)
    : [];
  const allPermissions = [...new Set([...matrixPermissions, ...extraPermissions])];

  // Create dedicated permission group for this custom role
  const permissionGroup = await PermissionGroup.create({
    name: `${name} (${tenantId.toString().slice(-4)})`,
    description: `Permissions for role ${name}`,
    permissions: allPermissions,
    tenantId,
    isActive: input.isActive !== false,
    createdBy: actorId || null,
  });

  const role = await AccessRole.create({
    name,
    description: clean(input.description),
    tenantId,
    department,
    modules,
    accessMatrix: rawMatrix,
    permissions: allPermissions,
    permissionGroup: permissionGroup._id,
    isActive: input.isActive !== false,
    isSystem: false,
    createdBy: actorId || null,
  });

  const populated = await AccessRole.findById(role._id)
    .populate("department", "name code")
    .populate("permissionGroup", "name permissions isActive")
    .lean();

  await writeAudit({
    tenantId,
    actorId,
    action: "create",
    module: "administration",
    entityType: "AccessRole",
    entityId: role._id,
    recordIdentifier: role.name,
    after: populated,
    meta: reqMeta,
  });

  return populated;
}

export async function updateRole({ tenantId, actorId, id, input = {}, reqMeta = {} }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  if (!id || String(id).startsWith("system:")) {
    throw Object.assign(new Error("Built-in system roles cannot be modified."), {
      statusCode: 403,
    });
  }

  if (!mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error("Invalid role ID."), { statusCode: 400 });
  }

  const role = await AccessRole.findOne({ _id: id, tenantId });
  if (!role) {
    throw Object.assign(new Error("Role not found."), { statusCode: 404 });
  }

  const patch = {};

  if (input.name !== undefined) {
    const name = clean(input.name);
    if (!name) {
      throw Object.assign(new Error("Role name cannot be empty."), { statusCode: 400 });
    }
    if (isSystemRoleName(name)) {
      throw Object.assign(
        new Error("Admin, Superadmin, and Employee are protected system role names."),
        { statusCode: 400 }
      );
    }
    patch.name = name;
  }

  if (input.description !== undefined) {
    patch.description = clean(input.description);
  }

  if (input.department !== undefined) {
    if (!input.department || !clean(input.department)) {
      patch.department = null;
    } else {
      if (!mongoose.isValidObjectId(input.department)) {
        throw Object.assign(new Error("Invalid department ID."), { statusCode: 400 });
      }
      const deptExists = await Department.exists({
        _id: input.department,
        tenantId,
        isActive: true,
      });
      if (!deptExists) {
        throw Object.assign(new Error("Selected department does not exist or is inactive."), {
          statusCode: 400,
        });
      }
      patch.department = new mongoose.Types.ObjectId(input.department);
    }
  }

  if (Array.isArray(input.modules)) {
    patch.modules = [...new Set(input.modules.map((m) => clean(m).toLowerCase()).filter(Boolean))];
  }

  if (Array.isArray(input.accessMatrix)) {
    patch.accessMatrix = input.accessMatrix;
    const computedPermissions = matrixToPermissions(input.accessMatrix);
    const extra = Array.isArray(input.permissions)
      ? input.permissions.map(clean).filter(Boolean)
      : [];
    patch.permissions = [...new Set([...computedPermissions, ...extra])];
  } else if (Array.isArray(input.permissions)) {
    patch.permissions = [...new Set(input.permissions.map(clean).filter(Boolean))];
  }

  if (typeof input.isActive === "boolean") {
    patch.isActive = input.isActive;
  }

  const beforeState = role.toObject();

  Object.assign(role, patch);
  await role.save();

  // Synchronize permissions to linked PermissionGroup and active assigned employees
  if (role.permissionGroup && patch.permissions) {
    await PermissionGroup.findByIdAndUpdate(role.permissionGroup, {
      $set: {
        permissions: role.permissions,
        isActive: role.isActive,
      },
    });

    // Make sure all users assigned this role have this permission group
    await User.updateMany(
      { tenantId, accessRole: role._id },
      { $set: { permissionGroup: role.permissionGroup } }
    );
  }

  const updated = await AccessRole.findById(role._id)
    .populate("department", "name code")
    .populate("permissionGroup", "name permissions isActive")
    .lean();

  await writeAudit({
    tenantId,
    actorId,
    action: "update",
    module: "administration",
    entityType: "AccessRole",
    entityId: role._id,
    recordIdentifier: role.name,
    before: beforeState,
    after: updated,
    meta: reqMeta,
  });

  return updated;
}

export async function deleteRole({ tenantId, actorId, id, password, reqMeta = {} }) {
  if (!tenantId) {
    throw Object.assign(new Error("A verified tenant is required."), { statusCode: 403 });
  }

  if (!id || String(id).startsWith("system:")) {
    throw Object.assign(new Error("Built-in system roles cannot be deleted."), {
      statusCode: 403,
    });
  }

  if (!mongoose.isValidObjectId(id)) {
    throw Object.assign(new Error("Invalid role ID."), { statusCode: 400 });
  }

  // Require user password for destructive deletion
  const cleanPass = clean(password);
  if (!cleanPass) {
    throw Object.assign(new Error("Password is required to delete this role."), {
      statusCode: 400,
    });
  }

  const actorUser = await User.findById(actorId).select("+password");
  if (!actorUser) {
    throw Object.assign(new Error("Unauthorized."), { statusCode: 401 });
  }

  const ok = await actorUser.comparePassword(cleanPass);
  if (!ok) {
    throw Object.assign(new Error("Password is incorrect."), { statusCode: 401 });
  }

  // Block deletion if role is currently assigned to one or more employees
  const assignedCount = await User.countDocuments({ tenantId, accessRole: id });
  if (assignedCount > 0) {
    throw Object.assign(
      new Error(
        `This role is assigned to ${assignedCount} employee(s). Please reassign them before deleting.`
      ),
      { statusCode: 400 }
    );
  }

  const role = await AccessRole.findOneAndDelete({ _id: id, tenantId });
  if (!role) {
    throw Object.assign(new Error("Role not found."), { statusCode: 404 });
  }

  // Clean up dedicated permission group
  if (role.permissionGroup) {
    await PermissionGroup.findByIdAndDelete(role.permissionGroup);
  }

  await writeAudit({
    tenantId,
    actorId,
    action: "delete",
    module: "administration",
    entityType: "AccessRole",
    entityId: role._id,
    recordIdentifier: role.name,
    before: role.toObject(),
    meta: reqMeta,
  });

  return { success: true, message: `Role "${role.name}" was successfully deleted.` };
}

export function getRoleMatrixCatalog() {
  return ROLE_MATRIX_CATALOG;
}
