import mongoose from "mongoose";
import TaxSlab from "../models/taxSlab.model.js";
import User from "../models/user.model.js";
import Payroll from "../models/payroll.model.js";

const clean = (value) => String(value ?? "").trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const normalizeTaxProfile = (body = {}) => {
  const method = clean(body.method || "slab").toLowerCase();
  return {
    enabled: body.enabled === true,
    tin: clean(body.tin),
    fiscalYear: clean(body.fiscalYear),
    taxpayerType: clean(body.taxpayerType || "general").toLowerCase(),
    method: ["slab", "percentage", "fixed"].includes(method) ? method : "slab",
    percentage: Math.max(0, Number(body.percentage || 0)),
    fixedAmount: money(body.fixedAmount),
    exemptionAmount: money(body.exemptionAmount),
    investmentAmount: money(body.investmentAmount),
  };
};

const buildSlabPatch = (body = {}, userId = null) => {
  const patch = {};
  if (body.fiscalYear !== undefined) patch.fiscalYear = clean(body.fiscalYear);
  if (body.taxpayerType !== undefined) patch.taxpayerType = clean(body.taxpayerType || "general").toLowerCase();
  if (body.minIncome !== undefined) patch.minIncome = money(body.minIncome);
  if (body.maxIncome !== undefined) patch.maxIncome = body.maxIncome === "" || body.maxIncome === null ? null : money(body.maxIncome);
  if (body.rate !== undefined) patch.rate = Math.max(0, Number(body.rate || 0));
  if (body.fixedAmount !== undefined) patch.fixedAmount = money(body.fixedAmount);
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  patch.updatedBy = userId;
  return patch;
};

export const listTaxSlabs = async (req, res) => {
  try {
    const filter = {};
    if (req.query.fiscalYear) filter.fiscalYear = clean(req.query.fiscalYear);
    if (req.query.taxpayerType) filter.taxpayerType = clean(req.query.taxpayerType).toLowerCase();
    if (req.query.active !== undefined) filter.isActive = String(req.query.active) === "true";
    const slabs = await TaxSlab.find(filter).sort({ fiscalYear: -1, taxpayerType: 1, minIncome: 1 }).lean();
    return res.json({ slabs });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load tax slabs.", error: error.message });
  }
};

export const createTaxSlab = async (req, res) => {
  try {
    const patch = buildSlabPatch(req.body, req.user?._id || null);
    if (!patch.fiscalYear) return res.status(400).json({ message: "Fiscal year is required." });
    if (!patch.taxpayerType) patch.taxpayerType = "general";
    if (patch.minIncome === undefined) return res.status(400).json({ message: "Min income is required." });
    const slab = await TaxSlab.create({ ...patch, isActive: patch.isActive ?? true, createdBy: req.user?._id || null });
    return res.status(201).json({ message: "Tax slab created.", slab });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create tax slab.", error: error.message });
  }
};

export const updateTaxSlab = async (req, res) => {
  try {
    const slab = await TaxSlab.findByIdAndUpdate(req.params.id, buildSlabPatch(req.body, req.user?._id || null), {
      new: true,
      runValidators: true,
    });
    if (!slab) return res.status(404).json({ message: "Tax slab not found." });
    return res.json({ message: "Tax slab updated.", slab });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update tax slab.", error: error.message });
  }
};

export const deleteTaxSlab = async (req, res) => {
  try {
    const slab = await TaxSlab.findByIdAndDelete(req.params.id);
    if (!slab) return res.status(404).json({ message: "Tax slab not found." });
    return res.json({ message: "Tax slab deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete tax slab.", error: error.message });
  }
};

export const listEmployeeTaxProfiles = async (req, res) => {
  try {
    const filter = { role: "employee" };
    if (req.query.q) {
      const rx = new RegExp(clean(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { email: rx }, { employeeId: rx }];
    }
    const employees = await User.find(filter)
      .select("_id name email employeeId department position taxProfile")
      .populate("department", "name")
      .populate("position", "title")
      .sort({ nameLower: 1, createdAt: -1 })
      .limit(Math.min(Number(req.query.limit || 100), 300))
      .lean();
    return res.json({ employees });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load employee tax profiles.", error: error.message });
  }
};

export const updateEmployeeTaxProfile = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.employeeId)) return res.status(400).json({ message: "Valid employee is required." });
    const employee = await User.findOneAndUpdate(
      { _id: req.params.employeeId, role: "employee" },
      { $set: { taxProfile: normalizeTaxProfile(req.body) } },
      { new: true, runValidators: true }
    )
      .select("_id name email employeeId department position taxProfile")
      .populate("department", "name")
      .populate("position", "title")
      .lean();
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    return res.json({ message: "Employee tax profile updated.", employee });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update employee tax profile.", error: error.message });
  }
};

export const getTaxReport = async (req, res) => {
  try {
    const filter = {};
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);
    if (req.query.employee && isValidObjectId(req.query.employee)) filter.employee = req.query.employee;
    if (req.query.fiscalYear) filter["deductions.meta.fiscalYear"] = clean(req.query.fiscalYear);

    const payrolls = await Payroll.find(filter)
      .select("employee department position year month currency grossSalary totalDeductions netPayable deductions")
      .populate("employee", "name email employeeId")
      .populate("department", "name")
      .populate("position", "title")
      .sort({ year: -1, month: -1 })
      .lean();

    const rows = [];
    const employeeMap = new Map();
    for (const payroll of payrolls) {
      const taxItems = (payroll.deductions || []).filter((item) => item.source === "tax");
      const taxDeduction = money(taxItems.reduce((sum, item) => sum + Number(item.amount || 0), 0));
      if (taxDeduction <= 0) continue;
      const fiscalYear = taxItems[0]?.meta?.fiscalYear || "";
      const row = {
        payrollId: payroll._id,
        employee: payroll.employee,
        department: payroll.department,
        position: payroll.position,
        year: payroll.year,
        month: payroll.month,
        fiscalYear,
        currency: payroll.currency,
        grossSalary: payroll.grossSalary,
        taxDeduction,
        netSalary: payroll.netPayable,
      };
      rows.push(row);
      const key = String(payroll.employee?._id || payroll.employee);
      const current = employeeMap.get(key) || { employee: payroll.employee, totalTax: 0, grossSalary: 0, months: 0, currency: payroll.currency };
      current.totalTax = money(current.totalTax + taxDeduction);
      current.grossSalary = money(current.grossSalary + Number(payroll.grossSalary || 0));
      current.months += 1;
      employeeMap.set(key, current);
    }

    return res.json({
      rows,
      employeeSummary: Array.from(employeeMap.values()),
      totals: {
        taxDeduction: money(rows.reduce((sum, item) => sum + item.taxDeduction, 0)),
        grossSalary: money(rows.reduce((sum, item) => sum + Number(item.grossSalary || 0), 0)),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load tax report.", error: error.message });
  }
};
