import mongoose from "mongoose";
import SalaryGrade from "../../models/payroll/salaryGrade.model.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const clean = (val) => String(val ?? "").trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const roundMoney = (v) => Math.round(Number(v || 0) * 100) / 100;

const requireAdmin = (req, res) => {
  const isAdm =
    ["admin", "superadmin"].includes(String(req.user?.role || "")) ||
    (req.user?.permissionGroup?.isActive !== false &&
      req.user?.permissionGroup?.permissions?.includes?.("payroll:manage"));
  if (!isAdm) {
    res.status(403).json({ message: "Only administrators can manage salary grades." });
    return false;
  }
  return true;
};

export const listSalaryGrades = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active !== undefined && req.query.active !== "") {
      filter.isActive = req.query.active === "true" || req.query.active === true;
    }
    if (req.query.search) {
      const regex = new RegExp(clean(req.query.search), "i");
      filter.$or = [{ name: regex }, { code: regex }, { description: regex }];
    }

    const limit = Math.min(Math.max(Number(req.query.limit || DEFAULT_LIMIT), 1), MAX_LIMIT);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      SalaryGrade.find(filter)
        .sort({ isActive: -1, code: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SalaryGrade.countDocuments(filter),
    ]);

    return res.json({
      salaryGrades: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in listSalaryGrades.", error: err.message });
  }
};

export const getSalaryGradeById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary grade ID." });
    }
    const grade = await SalaryGrade.findById(req.params.id).lean();
    if (!grade) {
      return res.status(404).json({ message: "Salary grade not found." });
    }
    return res.json({ salaryGrade: grade });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getSalaryGradeById.", error: err.message });
  }
};

export const createSalaryGrade = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const name = clean(req.body.name);
    const code = clean(req.body.code).toUpperCase();
    if (!name || !code) {
      return res.status(400).json({ message: "Name and Code are required." });
    }

    const existing = await SalaryGrade.findOne({ code });
    if (existing) {
      return res.status(409).json({ message: `Salary grade code '${code}' already exists.` });
    }

    const components = Array.isArray(req.body.components)
      ? req.body.components.map((c) => ({
          name: clean(c.name),
          type: ["earning", "deduction"].includes(clean(c.type)) ? clean(c.type) : "earning",
          calculationType: [
            "fixed",
            "percentage",
            "per_day",
            "per_hour",
            "per_minute",
            "variable",
          ].includes(clean(c.calculationType))
            ? clean(c.calculationType)
            : "percentage",
          value: roundMoney(c.value),
          basedOn: ["basicSalary", "grossSalary", "netSalary", "manual"].includes(clean(c.basedOn))
            ? clean(c.basedOn)
            : "basicSalary",
          isRecurring: typeof c.isRecurring === "boolean" ? c.isRecurring : true,
          isTaxable: typeof c.isTaxable === "boolean" ? c.isTaxable : false,
          isActive: typeof c.isActive === "boolean" ? c.isActive : true,
          note: clean(c.note),
        }))
      : [];

    const grade = await SalaryGrade.create({
      name,
      code,
      description: clean(req.body.description),
      currency: clean(req.body.currency || "BDT").toUpperCase(),
      minBasicSalary: roundMoney(req.body.minBasicSalary),
      maxBasicSalary: roundMoney(req.body.maxBasicSalary),
      defaultBasicSalary: roundMoney(req.body.defaultBasicSalary),
      components,
      rules: typeof req.body.rules === "object" && req.body.rules !== null ? req.body.rules : {},
      isActive: req.body.isActive !== false,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    return res.status(201).json({ message: "Salary grade created successfully.", salaryGrade: grade });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createSalaryGrade.", error: err.message });
  }
};

export const updateSalaryGrade = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary grade ID." });
    }

    const grade = await SalaryGrade.findById(req.params.id);
    if (!grade) {
      return res.status(404).json({ message: "Salary grade not found." });
    }

    if (req.body.code) {
      const code = clean(req.body.code).toUpperCase();
      const existing = await SalaryGrade.findOne({ code, _id: { $ne: grade._id } });
      if (existing) {
        return res.status(409).json({ message: `Salary grade code '${code}' already in use.` });
      }
      grade.code = code;
    }

    if (req.body.name) grade.name = clean(req.body.name);
    if (req.body.description !== undefined) grade.description = clean(req.body.description);
    if (req.body.currency) grade.currency = clean(req.body.currency).toUpperCase();
    if (req.body.minBasicSalary !== undefined) grade.minBasicSalary = roundMoney(req.body.minBasicSalary);
    if (req.body.maxBasicSalary !== undefined) grade.maxBasicSalary = roundMoney(req.body.maxBasicSalary);
    if (req.body.defaultBasicSalary !== undefined) grade.defaultBasicSalary = roundMoney(req.body.defaultBasicSalary);
    if (typeof req.body.isActive === "boolean") grade.isActive = req.body.isActive;
    if (typeof req.body.rules === "object" && req.body.rules !== null) grade.rules = req.body.rules;

    if (Array.isArray(req.body.components)) {
      grade.components = req.body.components.map((c) => ({
        name: clean(c.name),
        type: ["earning", "deduction"].includes(clean(c.type)) ? clean(c.type) : "earning",
        calculationType: [
          "fixed",
          "percentage",
          "per_day",
          "per_hour",
          "per_minute",
          "variable",
        ].includes(clean(c.calculationType))
          ? clean(c.calculationType)
          : "percentage",
        value: roundMoney(c.value),
        basedOn: ["basicSalary", "grossSalary", "netSalary", "manual"].includes(clean(c.basedOn))
          ? clean(c.basedOn)
          : "basicSalary",
        isRecurring: typeof c.isRecurring === "boolean" ? c.isRecurring : true,
        isTaxable: typeof c.isTaxable === "boolean" ? c.isTaxable : false,
        isActive: typeof c.isActive === "boolean" ? c.isActive : true,
        note: clean(c.note),
      }));
    }

    grade.updatedBy = req.user?._id || null;
    await grade.save();

    return res.json({ message: "Salary grade updated successfully.", salaryGrade: grade });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateSalaryGrade.", error: err.message });
  }
};

export const deleteSalaryGrade = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary grade ID." });
    }

    const grade = await SalaryGrade.findById(req.params.id);
    if (!grade) {
      return res.status(404).json({ message: "Salary grade not found." });
    }

    await grade.deleteOne();
    return res.json({ message: "Salary grade deleted successfully." });
  } catch (err) {
    return res.status(500).json({ message: "Server error in deleteSalaryGrade.", error: err.message });
  }
};
