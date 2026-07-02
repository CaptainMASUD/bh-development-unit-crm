import LeaveTemplate from "../models/leaveTemplate.model.js";
import Department from "../models/department.model.js";
import Position from "../models/position.model.js";
import User from "../models/user.model.js";

const clean = (value) => String(value ?? "").trim();
const number = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
};

const normalizeIds = (value) => Array.isArray(value) ? [...new Set(value.filter(Boolean).map(String))] : [];

const buildPayload = async (body, userId) => {
  const name = clean(body.name);
  if (!name) return { ok: false, status: 400, message: "Template name is required." };

  const departments = normalizeIds(body.departments);
  const positions = normalizeIds(body.positions);

  if (departments.length) {
    const count = await Department.countDocuments({ _id: { $in: departments } });
    if (count !== departments.length) return { ok: false, status: 400, message: "One or more departments were not found." };
  }
  if (positions.length) {
    const count = await Position.countDocuments({ _id: { $in: positions } });
    if (count !== positions.length) return { ok: false, status: 400, message: "One or more positions were not found." };
  }

  const unpaidCharge = body.unpaidCharge || {};
  const calculationType = clean(unpaidCharge.calculationType || body.unpaidChargeType || "per_day");

  return {
    ok: true,
    payload: {
      name,
      nameLower: name.toLowerCase(),
      description: clean(body.description),
      year: number(body.year, new Date().getFullYear()),
      paidDays: number(body.paidDays),
      unpaidDays: number(body.unpaidDays),
      unpaidCharge: {
        enabled: unpaidCharge.enabled !== false,
        calculationType: ["per_day", "fixed", "percentage"].includes(calculationType) ? calculationType : "per_day",
        value: number(unpaidCharge.value ?? body.unpaidChargeValue),
        basedOn: ["basicSalary", "grossSalary", "manual"].includes(clean(unpaidCharge.basedOn)) ? clean(unpaidCharge.basedOn) : "basicSalary",
      },
      departments,
      positions,
      isActive: body.isActive !== false,
      updatedBy: userId,
    },
  };
};

const leavePolicyFromTemplate = (template) => ({
  unpaidCharge: {
    enabled: template?.unpaidCharge?.enabled !== false,
    calculationType: template?.unpaidCharge?.calculationType || "per_day",
    value: Number(template?.unpaidCharge?.value || 0),
    basedOn: template?.unpaidCharge?.basedOn || "basicSalary",
  },
});

const buildEmployeeTemplateFilter = (template) => {
  const departments = (template.departments || []).map(String);
  const positions = (template.positions || []).map(String);
  const scoped = [];

  if (positions.length) scoped.push({ position: { $in: positions } });
  if (!positions.length && departments.length) scoped.push({ department: { $in: departments } });

  const filter = { role: "employee", isActive: true };
  if (!scoped.length) return filter;
  return {
    ...filter,
    $or: [
      ...scoped,
      { leaveTemplate: template._id },
    ],
  };
};

const applyTemplateToEmployees = async (template) => {
  if (!template || template.isActive === false) return 0;
  const result = await User.updateMany(
    buildEmployeeTemplateFilter(template),
    {
      $set: {
        leaveTemplate: template._id,
        leaveEntitlement: {
          year: Number(template.year || new Date().getFullYear()),
          paidDays: Number(template.paidDays || 0),
          unpaidDays: Number(template.unpaidDays || 0),
        },
        leavePolicy: leavePolicyFromTemplate(template),
      },
    }
  );
  return result.modifiedCount || result.nModified || 0;
};

const getApplyCounts = async (template) => {
  const filter = buildEmployeeTemplateFilter(template);
  const matchedCount = await User.countDocuments(filter);
  const modifiedCount = await applyTemplateToEmployees(template);
  return { matchedCount, modifiedCount };
};

export const listLeaveTemplates = async (req, res) => {
  try {
    const templates = await LeaveTemplate.find({})
      .populate("departments", "name")
      .populate("positions", "title department")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ templates });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load leave templates.", error: error.message });
  }
};

export const createLeaveTemplate = async (req, res) => {
  try {
    const built = await buildPayload(req.body, req.user?._id || null);
    if (!built.ok) return res.status(built.status).json({ message: built.message });
    const template = await LeaveTemplate.create({ ...built.payload, createdBy: req.user?._id || null });
    const applyResult = await getApplyCounts(template);
    return res.status(201).json({
      message: `Leave template created and applied to ${applyResult.matchedCount} eligible employee(s).`,
      template,
      appliedCount: applyResult.modifiedCount,
      matchedCount: applyResult.matchedCount,
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A leave template with this name already exists." });
    return res.status(500).json({ message: "Failed to create leave template.", error: error.message });
  }
};

export const updateLeaveTemplate = async (req, res) => {
  try {
    const built = await buildPayload(req.body, req.user?._id || null);
    if (!built.ok) return res.status(built.status).json({ message: built.message });
    const template = await LeaveTemplate.findByIdAndUpdate(req.params.id, built.payload, { new: true, runValidators: true });
    if (!template) return res.status(404).json({ message: "Leave template not found." });
    const applyResult = await getApplyCounts(template);
    return res.json({
      message: `Leave template updated and applied to ${applyResult.matchedCount} eligible employee(s).`,
      template,
      appliedCount: applyResult.modifiedCount,
      matchedCount: applyResult.matchedCount,
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A leave template with this name already exists." });
    return res.status(500).json({ message: "Failed to update leave template.", error: error.message });
  }
};

export const applyLeaveTemplate = async (req, res) => {
  try {
    const template = await LeaveTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: "Leave template not found." });
    if (template.isActive === false) {
      return res.status(400).json({ message: "Inactive leave templates cannot be applied." });
    }

    const applyResult = await getApplyCounts(template);
    return res.json({
      message: `Leave template applied to ${applyResult.matchedCount} eligible employee(s).`,
      template,
      appliedCount: applyResult.modifiedCount,
      matchedCount: applyResult.matchedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to apply leave template.", error: error.message });
  }
};

export const deleteLeaveTemplate = async (req, res) => {
  try {
    const used = await User.exists({ leaveTemplate: req.params.id });
    if (used) return res.status(400).json({ message: "This template is assigned to employees." });
    const template = await LeaveTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ message: "Leave template not found." });
    return res.json({ message: "Leave template deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete leave template.", error: error.message });
  }
};
