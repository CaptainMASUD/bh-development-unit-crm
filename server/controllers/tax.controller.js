import mongoose from "mongoose";
import TaxSlab from "../models/taxSlab.model.js";
import User from "../models/user.model.js";
import Payroll from "../models/payroll.model.js";
import SalaryProfile from "../models/salaryProfile.model.js";

const clean = (value) => String(value ?? "").trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const normalizeTaxProfile = (body = {}) => {
  const method = clean(body.method || "slab").toLowerCase();
  const rawMode = clean(body.mode || body.taxMode || "auto").toLowerCase();
  const mode = ["auto", "override", "disabled"].includes(rawMode) ? rawMode : "auto";
  const enabled = mode === "disabled" ? false : true;
  const normalizedMethod = mode === "override" && ["percentage", "fixed"].includes(method) ? method : "slab";
  return {
    mode,
    enabled,
    tin: clean(body.tin),
    fiscalYear: clean(body.fiscalYear),
    fiscalYearStartMonth: Math.min(Math.max(Number(body.fiscalYearStartMonth || 1), 1), 12),
    taxpayerType: clean(body.taxpayerType || "general").toLowerCase(),
    method: normalizedMethod,
    percentage: normalizedMethod === "percentage" ? Math.max(0, Number(body.percentage || 0)) : 0,
    fixedAmount: normalizedMethod === "fixed" ? money(body.fixedAmount) : 0,
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

const assertNoOverlappingSlab = async ({ fiscalYear, taxpayerType, minIncome, maxIncome, excludeId = null }) => {
  const min = Number(minIncome || 0);
  const max = maxIncome === null || maxIncome === undefined ? Number.POSITIVE_INFINITY : Number(maxIncome);
  const filter = {
    fiscalYear: clean(fiscalYear),
    taxpayerType: clean(taxpayerType || "general").toLowerCase(),
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await TaxSlab.find(filter).select("minIncome maxIncome").lean();
  const overlap = existing.find((slab) => {
    const existingMin = Number(slab.minIncome || 0);
    const existingMax = slab.maxIncome === null || slab.maxIncome === undefined ? Number.POSITIVE_INFINITY : Number(slab.maxIncome);
    return min < existingMax && existingMin < max;
  });

  return !overlap;
};

const autoAssignSlabTaxToSalaryEmployees = async ({ fiscalYear, taxpayerType, userId = null }) => {
  const employeeIds = await SalaryProfile.distinct("employee", { isActive: true });
  if (!employeeIds.length) return { matched: 0, modified: 0 };

  const profileResult = await SalaryProfile.updateMany(
    {
      employee: { $in: employeeIds },
      isActive: true,
      $or: [
        { "taxProfile.mode": { $exists: false } },
        { "taxProfile.mode": "auto" },
        { "taxProfile.enabled": { $ne: true }, "taxProfile.mode": { $ne: "disabled" } },
      ],
    },
    {
      $set: {
        "taxProfile.mode": "auto",
        "taxProfile.enabled": true,
        "taxProfile.fiscalYear": clean(fiscalYear),
        "taxProfile.taxpayerType": clean(taxpayerType || "general").toLowerCase(),
        "taxProfile.method": "slab",
        updatedBy: userId,
      },
    }
  );

  const employeeResult = await User.updateMany(
    {
      _id: { $in: employeeIds },
      role: "employee",
      isActive: { $ne: false },
      $or: [
        { "taxProfile.mode": { $exists: false } },
        { "taxProfile.mode": "auto" },
        { "taxProfile.enabled": { $ne: true }, "taxProfile.mode": { $ne: "disabled" } },
      ],
    },
    {
      $set: {
        "taxProfile.mode": "auto",
        "taxProfile.enabled": true,
        "taxProfile.fiscalYear": clean(fiscalYear),
        "taxProfile.taxpayerType": clean(taxpayerType || "general").toLowerCase(),
        "taxProfile.method": "slab",
      },
    }
  );

  return {
    matched: profileResult.matchedCount || profileResult.n || 0,
    modified: profileResult.modifiedCount || profileResult.nModified || 0,
    employeeMatched: employeeResult.matchedCount || employeeResult.n || 0,
    employeeModified: employeeResult.modifiedCount || employeeResult.nModified || 0,
  };
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
    const noOverlap = await assertNoOverlappingSlab({
      fiscalYear: patch.fiscalYear,
      taxpayerType: patch.taxpayerType,
      minIncome: patch.minIncome,
      maxIncome: patch.maxIncome,
    });
    if (!noOverlap) return res.status(409).json({ message: "This tax slab overlaps an existing slab for the same fiscal year and taxpayer type." });
    const slab = await TaxSlab.create({ ...patch, isActive: patch.isActive ?? true, createdBy: req.user?._id || null });
    const autoAssigned = slab.isActive !== false
      ? await autoAssignSlabTaxToSalaryEmployees({
          fiscalYear: slab.fiscalYear,
          taxpayerType: slab.taxpayerType,
          userId: req.user?._id || null,
        })
      : { matched: 0, modified: 0 };
    return res.status(201).json({ message: "Tax slab created.", slab, autoAssigned });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create tax slab.", error: error.message });
  }
};

export const updateTaxSlab = async (req, res) => {
  try {
    const existing = await TaxSlab.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: "Tax slab not found." });
    const patch = buildSlabPatch(req.body, req.user?._id || null);
    const candidate = { ...existing, ...patch };
    const noOverlap = await assertNoOverlappingSlab({
      fiscalYear: candidate.fiscalYear,
      taxpayerType: candidate.taxpayerType,
      minIncome: candidate.minIncome,
      maxIncome: candidate.maxIncome,
      excludeId: req.params.id,
    });
    if (!noOverlap) return res.status(409).json({ message: "This tax slab overlaps an existing slab for the same fiscal year and taxpayer type." });
    const slab = await TaxSlab.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });
    if (!slab) return res.status(404).json({ message: "Tax slab not found." });
    const autoAssigned = slab.isActive !== false
      ? await autoAssignSlabTaxToSalaryEmployees({
          fiscalYear: slab.fiscalYear,
          taxpayerType: slab.taxpayerType,
          userId: req.user?._id || null,
        })
      : { matched: 0, modified: 0 };
    return res.json({ message: "Tax slab updated.", slab, autoAssigned });
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
    const salaryProfiles = await SalaryProfile.find({
      employee: { $in: employees.map((employee) => employee._id) },
      isActive: true,
    })
      .select("employee salaryType currency basicSalary workingDaysPerMonth workingHoursPerDay taxProfile isActive")
      .lean();
    const salaryMap = new Map(salaryProfiles.map((profile) => [String(profile.employee), profile]));
    return res.json({
      employees: employees.map((employee) => {
        const salaryProfile = salaryMap.get(String(employee._id)) || null;
        return {
          ...employee,
          taxProfile: salaryProfile?.taxProfile || employee.taxProfile || { mode: "auto", enabled: true, method: "slab" },
          employeeTaxProfile: employee.taxProfile,
          salaryProfile,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load employee tax profiles.", error: error.message });
  }
};

export const updateEmployeeTaxProfile = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.employeeId)) return res.status(400).json({ message: "Valid employee is required." });
    const taxProfile = normalizeTaxProfile(req.body);
    const employee = await User.findOneAndUpdate(
      { _id: req.params.employeeId, role: "employee" },
      { $set: { taxProfile } },
      { new: true, runValidators: true }
    )
      .select("_id name email employeeId department position taxProfile")
      .populate("department", "name")
      .populate("position", "title")
      .lean();
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    const salaryProfile = await SalaryProfile.findOneAndUpdate(
      { employee: employee._id, isActive: true },
      { $set: { taxProfile, updatedBy: req.user?._id || null } },
      { new: true, runValidators: true }
    ).lean();
    return res.json({ message: "Employee tax profile updated.", employee: { ...employee, salaryProfile } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update employee tax profile.", error: error.message });
  }
};

export const getTaxReport = async (req, res) => {
  try {
    const payrollFilter = {};
    const fiscalYearFilter = clean(req.query.fiscalYear);
    if (req.query.year) payrollFilter.year = Number(req.query.year);
    if (req.query.month) payrollFilter.month = Number(req.query.month);
    if (req.query.employee && isValidObjectId(req.query.employee)) payrollFilter.employee = req.query.employee;

    const salaryProfileFilter = { isActive: true };
    if (req.query.employee && isValidObjectId(req.query.employee)) salaryProfileFilter.employee = req.query.employee;

    const salaryProfiles = await SalaryProfile.find(salaryProfileFilter)
      .select("employee department position salaryType currency basicSalary workingDaysPerMonth workingHoursPerDay taxProfile")
      .populate("employee", "name email employeeId taxProfile isActive")
      .populate("department", "name")
      .populate("position", "title")
      .lean();

    const payrolls = await Payroll.find(payrollFilter)
      .select("employee department position year month currency grossSalary totalDeductions netPayable deductions taxRemitted taxRemittedAt taxRemittanceRef")
      .populate("employee", "name email employeeId taxProfile")
      .populate("department", "name")
      .populate("position", "title")
      .sort({ year: -1, month: -1 })
      .lean();

    const rows = [];
    const employeeMap = new Map();

    for (const profile of salaryProfiles) {
      if (!profile.employee || profile.employee.isActive === false) continue;
      const effectiveTaxProfile = profile.taxProfile || profile.employee.taxProfile || {};
      const profileFiscalYear = clean(effectiveTaxProfile.fiscalYear || fiscalYearFilter);
      if (fiscalYearFilter && profileFiscalYear && profileFiscalYear !== fiscalYearFilter) continue;
      const key = String(profile.employee._id || profile.employee);
      employeeMap.set(key, {
        employee: profile.employee,
        department: profile.department,
        position: profile.position,
        salaryProfile: {
          _id: profile._id,
          salaryType: profile.salaryType,
          currency: profile.currency,
          basicSalary: profile.basicSalary,
          workingDaysPerMonth: profile.workingDaysPerMonth,
          workingHoursPerDay: profile.workingHoursPerDay,
        },
        taxProfile: {
          ...(profile.employee.taxProfile || {}),
          ...(profile.taxProfile || {}),
          mode: profile.taxProfile?.mode || profile.employee.taxProfile?.mode || "auto",
          enabled: (profile.taxProfile?.mode || profile.employee.taxProfile?.mode) === "disabled" ? false : true,
          method: (profile.taxProfile?.mode || profile.employee.taxProfile?.mode) === "override" ? (profile.taxProfile?.method || profile.employee.taxProfile?.method || "slab") : "slab",
        },
        totalTax: 0,
        grossSalary: 0,
        taxableIncome: 0,
        yearlyTax: 0,
        remainingTax: 0,
        netSalary: 0,
        months: 0,
        currency: profile.currency || "BDT",
      });
    }

    for (const payroll of payrolls) {
      const taxItems = (payroll.deductions || []).filter((item) => item.source === "tax");
      const taxDeduction = money(taxItems.reduce((sum, item) => sum + Number(item.amount || 0), 0));
      const fiscalYear = clean(taxItems[0]?.meta?.fiscalYear || payroll.employee?.taxProfile?.fiscalYear || payroll.year);
      if (fiscalYearFilter && fiscalYear !== fiscalYearFilter) continue;
      const taxMeta = taxItems[0]?.meta || {};
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
        taxableIncome: money(taxMeta.taxableIncome || taxMeta.taxableMonthlyIncome || 0),
        yearlyTax: money(taxMeta.yearlyTax || 0),
        taxPaidYtd: money(taxMeta.taxPaidYtd || 0),
        remainingTax: money(taxMeta.remainingTax || 0),
        taxDeduction,
        netSalary: payroll.netPayable,
        remittanceStatus: payroll.taxRemitted ? "remitted" : taxDeduction > 0 ? "pending" : "not_applicable",
        taxRemitted: payroll.taxRemitted === true,
        taxRemittedAt: payroll.taxRemittedAt || null,
        taxRemittanceRef: payroll.taxRemittanceRef || "",
      };
      rows.push(row);
      const key = String(payroll.employee?._id || payroll.employee);
      const current = employeeMap.get(key) || { employee: payroll.employee, totalTax: 0, grossSalary: 0, taxableIncome: 0, yearlyTax: 0, remainingTax: 0, netSalary: 0, months: 0, currency: payroll.currency };
      current.totalTax = money(current.totalTax + taxDeduction);
      current.grossSalary = money(current.grossSalary + Number(payroll.grossSalary || 0));
      current.taxableIncome = Math.max(Number(current.taxableIncome || 0), Number(taxMeta.taxableIncome || 0));
      current.yearlyTax = Math.max(Number(current.yearlyTax || 0), Number(taxMeta.yearlyTax || 0));
      current.remainingTax = taxMeta.remainingTax !== undefined ? money(taxMeta.remainingTax) : current.remainingTax;
      current.netSalary = money(current.netSalary + Number(payroll.netPayable || 0));
      current.months += 1;
      employeeMap.set(key, current);
    }

    const employeeSummary = Array.from(employeeMap.values()).sort((a, b) =>
      String(a.employee?.name || "").localeCompare(String(b.employee?.name || ""))
    );

    return res.json({
      rows,
      employeeSummary,
      totals: {
        taxDeduction: money(rows.reduce((sum, item) => sum + item.taxDeduction, 0)),
        grossSalary: money(rows.reduce((sum, item) => sum + Number(item.grossSalary || 0), 0)),
        taxableIncome: money(employeeSummary.reduce((sum, item) => sum + Number(item.taxableIncome || 0), 0)),
        yearlyTax: money(employeeSummary.reduce((sum, item) => sum + Number(item.yearlyTax || 0), 0)),
        remainingTax: money(employeeSummary.reduce((sum, item) => sum + Number(item.remainingTax || 0), 0)),
        netSalary: money(rows.reduce((sum, item) => sum + Number(item.netSalary || 0), 0)),
        salaryProfileEmployees: employeeSummary.length,
        taxEnabledEmployees: employeeSummary.filter((item) => item.taxProfile?.mode !== "disabled").length,
        remittedTax: money(rows.filter((item) => item.taxRemitted).reduce((sum, item) => sum + Number(item.taxDeduction || 0), 0)),
        pendingRemittance: money(rows.filter((item) => !item.taxRemitted).reduce((sum, item) => sum + Number(item.taxDeduction || 0), 0)),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load tax report.", error: error.message });
  }
};

export const markTaxRemittance = async (req, res) => {
  try {
    const payrollIds = Array.isArray(req.body.payrollIds) ? req.body.payrollIds.filter(isValidObjectId) : [];
    if (!payrollIds.length) return res.status(400).json({ message: "Select at least one payroll record." });

    const remitted = req.body.remitted !== false;
    const result = await Payroll.updateMany(
      { _id: { $in: payrollIds }, taxDeduction: { $gt: 0 } },
      {
        $set: {
          taxRemitted: remitted,
          taxRemittedAt: remitted ? req.body.taxRemittedAt ? new Date(req.body.taxRemittedAt) : new Date() : null,
          taxRemittanceRef: remitted ? clean(req.body.taxRemittanceRef) : "",
        },
      }
    );

    return res.json({
      message: remitted ? "Tax remittance marked." : "Tax remittance cleared.",
      matched: result.matchedCount || result.n || 0,
      modified: result.modifiedCount || result.nModified || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update tax remittance.", error: error.message });
  }
};
