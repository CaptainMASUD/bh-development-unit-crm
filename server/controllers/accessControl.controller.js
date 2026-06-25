import Department from "../models/department.model.js";
import Position from "../models/position.model.js";
import PermissionGroup, { PERMISSION_KEYS } from "../models/permissionGroup.model.js";

const clean = (value) => String(value ?? "").trim();

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const duplicateMessage = (err, fallback) => {
  if (err?.code === 11000) return fallback;
  return null;
};

const normalizeSalaryComponent = (item = {}) => {
  return {
    name: clean(item.name),
    type: clean(item.type),
    calculationType: clean(item.calculationType || "fixed"),
    value: roundMoney(item.value),
    basedOn: clean(item.basedOn || "basicSalary"),
    isRecurring: typeof item.isRecurring === "boolean" ? item.isRecurring : true,
    isTaxable: typeof item.isTaxable === "boolean" ? item.isTaxable : false,
    isActive: typeof item.isActive === "boolean" ? item.isActive : true,
    note: clean(item.note),
  };
};

const normalizeSalaryComponents = (components = []) => {
  if (!Array.isArray(components)) return [];

  return components
    .map(normalizeSalaryComponent)
    .filter((item) => item.name && ["earning", "deduction"].includes(item.type));
};

const buildPositionPatch = (body = {}, { isCreate = false } = {}) => {
  const patch = {};

  if (body.title !== undefined || isCreate) {
    patch.title = clean(body.title);
    if (!patch.title) return { ok: false, message: "Position title is required." };
  }

  if (body.department !== undefined || isCreate) {
    patch.department = clean(body.department);
    if (!patch.department) return { ok: false, message: "Department is required." };
  }

  if (body.description !== undefined) patch.description = clean(body.description);
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;

  // Optional default salary setup
  if (typeof body.defaultSalaryEnabled === "boolean") {
    patch.defaultSalaryEnabled = body.defaultSalaryEnabled;
  }

  if (body.defaultSalaryType !== undefined) {
    patch.defaultSalaryType = clean(body.defaultSalaryType || "monthly");
  }

  if (body.defaultCurrency !== undefined) {
    patch.defaultCurrency = clean(body.defaultCurrency || "BDT").toUpperCase();
  }

  if (body.defaultBasicSalary !== undefined) {
    patch.defaultBasicSalary = roundMoney(body.defaultBasicSalary);
    if (patch.defaultBasicSalary > 0 && body.defaultSalaryEnabled === undefined) {
      patch.defaultSalaryEnabled = true;
    }
  }

  if (body.defaultWorkingDaysPerMonth !== undefined) {
    patch.defaultWorkingDaysPerMonth = Number(body.defaultWorkingDaysPerMonth);
  }

  if (body.defaultWorkingHoursPerDay !== undefined) {
    patch.defaultWorkingHoursPerDay = Number(body.defaultWorkingHoursPerDay);
  }

  if (Array.isArray(body.defaultComponents)) {
    patch.defaultComponents = normalizeSalaryComponents(body.defaultComponents);
  }

  if (body.defaultRules !== undefined) {
    patch.defaultRules = body.defaultRules || {};
  }

  return { ok: true, patch };
};

/* ===============================
   PERMISSION CATALOG
================================ */
export const getPermissionCatalog = async (req, res) => {
  return res.json({
    permissions: PERMISSION_KEYS.map((key) => {
      const [module, action] = key.split(":");
      return { key, module, action, label: `${module} ${action}` };
    }),
  });
};

/* ===============================
   DEPARTMENTS
================================ */
export const listDepartments = async (req, res) => {
  const departments = await Department.find({}).sort({ nameLower: 1 }).lean();
  return res.json({ departments });
};

export const createDepartment = async (req, res) => {
  try {
    const name = clean(req.body.name);
    if (!name) return res.status(400).json({ message: "Department name is required." });

    const department = await Department.create({
      name,
      description: clean(req.body.description),
      isActive: req.body.isActive ?? true,
      createdBy: req.user?._id || null,
    });

    return res.status(201).json({ message: "Department created.", department });
  } catch (err) {
    const duplicate = duplicateMessage(err, "Department already exists.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: err.message || "Department create failed." });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const patch = {};

    if (req.body.name !== undefined) {
      patch.name = clean(req.body.name);
      if (!patch.name) return res.status(400).json({ message: "Department name cannot be empty." });
    }

    if (req.body.description !== undefined) patch.description = clean(req.body.description);
    if (typeof req.body.isActive === "boolean") patch.isActive = req.body.isActive;

    const department = await Department.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });

    if (!department) return res.status(404).json({ message: "Department not found." });

    return res.json({ message: "Department updated.", department });
  } catch (err) {
    const duplicate = duplicateMessage(err, "Department already exists.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: err.message || "Department update failed." });
  }
};

export const deleteDepartment = async (req, res) => {
  const used = await Position.exists({ department: req.params.id });

  if (used) {
    return res.status(400).json({
      message: "Delete or move positions under this department first.",
    });
  }

  const department = await Department.findByIdAndDelete(req.params.id);
  if (!department) return res.status(404).json({ message: "Department not found." });

  return res.json({ message: "Department deleted." });
};

/* ===============================
   POSITIONS + DEFAULT SALARY
================================ */
export const listPositions = async (req, res) => {
  const filter = {};
  if (req.query.department) filter.department = req.query.department;

  const positions = await Position.find(filter)
    .populate("department", "name")
    .sort({ titleLower: 1 })
    .lean();

  return res.json({ positions });
};

export const createPosition = async (req, res) => {
  try {
    const built = buildPositionPatch(req.body, { isCreate: true });
    if (!built.ok) return res.status(400).json({ message: built.message });

    const { patch } = built;

    const departmentExists = await Department.exists({ _id: patch.department });
    if (!departmentExists) return res.status(404).json({ message: "Department not found." });

    const position = await Position.create({
      ...patch,
      createdBy: req.user?._id || null,
    });

    const populated = await Position.findById(position._id)
      .populate("department", "name")
      .lean();

    return res.status(201).json({ message: "Position created.", position: populated });
  } catch (err) {
    const duplicate = duplicateMessage(err, "Position already exists in this department.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: err.message || "Position create failed." });
  }
};

export const updatePosition = async (req, res) => {
  try {
    const built = buildPositionPatch(req.body, { isCreate: false });
    if (!built.ok) return res.status(400).json({ message: built.message });

    const { patch } = built;

    if (patch.department !== undefined) {
      const departmentExists = await Department.exists({ _id: patch.department });
      if (!departmentExists) return res.status(404).json({ message: "Department not found." });
    }

    const position = await Position.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    }).populate("department", "name");

    if (!position) return res.status(404).json({ message: "Position not found." });

    return res.json({ message: "Position updated.", position });
  } catch (err) {
    const duplicate = duplicateMessage(err, "Position already exists in this department.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: err.message || "Position update failed." });
  }
};

export const deletePosition = async (req, res) => {
  const position = await Position.findByIdAndDelete(req.params.id);
  if (!position) return res.status(404).json({ message: "Position not found." });

  return res.json({ message: "Position deleted." });
};

/* ===============================
   PERMISSION GROUPS
================================ */
export const listPermissionGroups = async (req, res) => {
  const permissionGroups = await PermissionGroup.find({})
    .sort({ nameLower: 1 })
    .lean();

  return res.json({ permissionGroups });
};

export const createPermissionGroup = async (req, res) => {
  try {
    const name = clean(req.body.name);
    if (!name) return res.status(400).json({ message: "Permission group name is required." });

    const permissionGroup = await PermissionGroup.create({
      name,
      description: clean(req.body.description),
      permissions: req.body.permissions || [],
      isActive: req.body.isActive ?? true,
      createdBy: req.user?._id || null,
    });

    return res.status(201).json({ message: "Permission group created.", permissionGroup });
  } catch (err) {
    const duplicate = duplicateMessage(err, "Permission group already exists.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: err.message || "Permission group create failed." });
  }
};

export const updatePermissionGroup = async (req, res) => {
  try {
    const patch = {};

    if (req.body.name !== undefined) {
      patch.name = clean(req.body.name);
      if (!patch.name) return res.status(400).json({ message: "Permission group name cannot be empty." });
    }

    if (req.body.description !== undefined) patch.description = clean(req.body.description);
    if (Array.isArray(req.body.permissions)) patch.permissions = req.body.permissions;
    if (typeof req.body.isActive === "boolean") patch.isActive = req.body.isActive;

    const permissionGroup = await PermissionGroup.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });

    if (!permissionGroup) return res.status(404).json({ message: "Permission group not found." });

    return res.json({ message: "Permission group updated.", permissionGroup });
  } catch (err) {
    const duplicate = duplicateMessage(err, "Permission group already exists.");
    if (duplicate) return res.status(409).json({ message: duplicate });
    return res.status(500).json({ message: err.message || "Permission group update failed." });
  }
};

export const deletePermissionGroup = async (req, res) => {
  const permissionGroup = await PermissionGroup.findByIdAndDelete(req.params.id);
  if (!permissionGroup) return res.status(404).json({ message: "Permission group not found." });

  return res.json({ message: "Permission group deleted." });
};