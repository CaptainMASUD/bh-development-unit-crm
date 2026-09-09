import mongoose from "mongoose";
import User from "../../models/user.model.js";
import SalaryProfile from "../../models/salaryProfile.model.js";
import TaxSlab from "../../models/taxSlab.model.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const USER_POPULATE = [
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
  { path: "permissionGroup", select: "name permissions isActive" },
];

const SALARY_POPULATE = [
  {
    path: "employee",
    select: "name email role isActive department position permissionGroup avatarUrl",
    populate: USER_POPULATE,
  },
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
  { path: "createdBy", select: "name email role" },
  { path: "updatedBy", select: "name email role" },
];

const clean = (value) => String(value ?? "").trim();

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const encodeCursor = (doc) =>
  Buffer.from(
    JSON.stringify({
      isActive: doc.isActive === true,
      effectiveFrom: doc.effectiveFrom ? new Date(doc.effectiveFrom).toISOString() : "",
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
      id: String(doc._id || ""),
    })
  ).toString("base64url");

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (!decoded?.id || !isValidObjectId(decoded.id)) return null;
    const effectiveFrom = decoded.effectiveFrom ? new Date(decoded.effectiveFrom) : new Date(0);
    const createdAt = decoded.createdAt ? new Date(decoded.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime()) || Number.isNaN(effectiveFrom.getTime())) return null;
    return {
      isActive: decoded.isActive === true,
      effectiveFrom,
      createdAt,
      id: new mongoose.Types.ObjectId(decoded.id),
    };
  } catch {
    return null;
  }
};

const salaryCursorFilter = (cursor) => {
  if (!cursor) return {};
  return {
    $or: [
      { isActive: { $lt: cursor.isActive } },
      { isActive: cursor.isActive, effectiveFrom: { $lt: cursor.effectiveFrom } },
      { isActive: cursor.isActive, effectiveFrom: cursor.effectiveFrom, createdAt: { $lt: cursor.createdAt } },
      { isActive: cursor.isActive, effectiveFrom: cursor.effectiveFrom, createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
};

const parseBooleanQuery = (value) => {
  if (value === undefined || value === null || value === "all") return null;
  if (String(value) === "true") return true;
  if (String(value) === "false") return false;
  return null;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const handleDuplicate = (err) => {
  if (err?.code === 11000) {
    return "This employee already has an active salary profile. Deactivate the old one first.";
  }
  return null;
};

const normalizeComponent = (item = {}) => {
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

const normalizeComponents = (components = []) => {
  if (!Array.isArray(components)) return [];

  return components
    .map(normalizeComponent)
    .filter((item) => item.name && ["earning", "deduction"].includes(item.type));
};

const populateSalaryQuery = (query) => query.populate(SALARY_POPULATE);

const normalizeTaxProfile = (profile = {}) => {
  const method = clean(profile.method || "slab").toLowerCase();
  const rawMode = clean(profile.mode || profile.taxMode || "auto").toLowerCase();
  const mode = ["auto", "override", "disabled"].includes(rawMode) ? rawMode : "auto";
  const normalizedMethod = mode === "override" && ["percentage", "fixed"].includes(method) ? method : "slab";
  return {
    mode,
    enabled: mode !== "disabled",
    tin: clean(profile.tin),
    fiscalYear: clean(profile.fiscalYear),
    fiscalYearStartMonth: Math.min(Math.max(Number(profile.fiscalYearStartMonth || 1), 1), 12),
    taxpayerType: clean(profile.taxpayerType || "general").toLowerCase(),
    method: normalizedMethod,
    percentage: normalizedMethod === "percentage" ? Math.max(0, Number(profile.percentage || 0)) : 0,
    fixedAmount: normalizedMethod === "fixed" ? roundMoney(profile.fixedAmount) : 0,
    exemptionAmount: roundMoney(profile.exemptionAmount),
    investmentAmount: roundMoney(profile.investmentAmount),
  };
};

const applyDefaultTaxProfileFromActiveSlab = async (profile) => {
  if (!profile || profile.taxProfile?.mode === "disabled" || profile.taxProfile?.mode === "override") return profile;
  const slab = await TaxSlab.findOne({ isActive: { $ne: false } }).sort({ fiscalYear: -1, taxpayerType: 1, minIncome: 1 }).lean();
  if (!slab) return profile;
  profile.taxProfile = {
    ...(profile.taxProfile || {}),
    mode: "auto",
    enabled: true,
    fiscalYear: slab.fiscalYear,
    taxpayerType: slab.taxpayerType || "general",
    method: "slab",
  };
  await profile.save();
  await User.findByIdAndUpdate(profile.employee, {
    $set: {
      "taxProfile.mode": "auto",
      "taxProfile.enabled": true,
      "taxProfile.fiscalYear": slab.fiscalYear,
      "taxProfile.taxpayerType": slab.taxpayerType || "general",
      "taxProfile.method": "slab",
    },
  });
  return profile;
};

const buildProfilePayload = async (req, { isCreate = false } = {}) => {
  const employeeId = clean(req.body.employee || req.body.employeeId);

  if (isCreate && !employeeId) {
    return { ok: false, status: 400, message: "Employee is required." };
  }

  let employee = null;

  if (employeeId) {
    if (!isValidObjectId(employeeId)) {
      return { ok: false, status: 400, message: "Invalid employee ID." };
    }

    employee = await User.findById(employeeId)
      .select("name email role isActive department position")
      .lean();

    if (!employee) {
      return { ok: false, status: 404, message: "Employee not found." };
    }

    if (employee.role !== "employee") {
      return {
        ok: false,
        status: 400,
        message: "Salary profile can only be assigned to employee users.",
      };
    }
  }

  const payload = {};

  if (employeeId) payload.employee = employeeId;

  if (employee) {
    payload.department = employee.department || null;
    payload.position = employee.position || null;
  }

  if (req.body.salaryType !== undefined) payload.salaryType = clean(req.body.salaryType);
  if (req.body.currency !== undefined) payload.currency = clean(req.body.currency || "BDT").toUpperCase();

  if (req.body.basicSalary !== undefined) {
    payload.basicSalary = roundMoney(req.body.basicSalary);
  } else if (isCreate) {
    return { ok: false, status: 400, message: "Basic salary is required." };
  }

  if (req.body.workingDaysPerMonth !== undefined) {
    payload.workingDaysPerMonth = Number(req.body.workingDaysPerMonth);
  }

  if (req.body.workingHoursPerDay !== undefined) {
    payload.workingHoursPerDay = Number(req.body.workingHoursPerDay);
  }

  if (Array.isArray(req.body.components)) {
    payload.components = normalizeComponents(req.body.components);
  }

  if (req.body.rules !== undefined) {
    payload.rules = req.body.rules || {};
  }

  if (req.body.taxProfile !== undefined) {
    payload.taxProfile = normalizeTaxProfile(req.body.taxProfile || {});
  }

  if (req.body.effectiveFrom !== undefined) {
    payload.effectiveFrom = new Date(req.body.effectiveFrom);
  } else if (isCreate) {
    payload.effectiveFrom = new Date();
  }

  if (req.body.effectiveTo !== undefined) {
    payload.effectiveTo = req.body.effectiveTo ? new Date(req.body.effectiveTo) : null;
  }

  if (typeof req.body.isActive === "boolean") {
    payload.isActive = req.body.isActive;
  } else if (isCreate) {
    payload.isActive = true;
  }

  if (req.body.note !== undefined) payload.note = clean(req.body.note);

  return { ok: true, payload };
};

/* ===============================
   CREATE SALARY PROFILE
================================ */
export const createSalaryProfile = async (req, res) => {
  try {
    const built = await buildProfilePayload(req, { isCreate: true });
    if (!built.ok) {
      return res.status(built.status).json({ message: built.message });
    }

    const { payload } = built;

    if (payload.isActive) {
      await SalaryProfile.updateMany(
        { employee: payload.employee, isActive: true },
        {
          $set: {
            isActive: false,
            effectiveTo: payload.effectiveFrom || new Date(),
            updatedBy: req.user?._id || null,
          },
        }
      );
    }

    const profile = await SalaryProfile.create({
      ...payload,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });
    await applyDefaultTaxProfileFromActiveSlab(profile);

    const full = await populateSalaryQuery(SalaryProfile.findById(profile._id)).lean();

    return res.status(201).json({
      message: "Salary profile created.",
      salaryProfile: full,
      preview: profile.getFixedMonthlyPreview(),
    });
  } catch (err) {
    const duplicate = handleDuplicate(err);
    if (duplicate) return res.status(409).json({ message: duplicate });

    return res.status(500).json({
      message: "Server error in createSalaryProfile.",
      error: err.message,
    });
  }
};

/* ===============================
   LIST SALARY PROFILES
   GET /api/salary-profiles?employee=&department=&position=&active=true&limit=20&page=1
================================ */
export const listSalaryProfiles = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const page = Math.max(Number(req.query.page || 1), 1);
    const cursor = decodeCursor(req.query.cursor);
    const skip = cursor ? 0 : (page - 1) * limit;

    const filter = { ...salaryCursorFilter(cursor) };

    if (req.query.employee && isValidObjectId(req.query.employee)) {
      filter.employee = req.query.employee;
    }

    if (req.query.department && isValidObjectId(req.query.department)) {
      filter.department = req.query.department;
    }

    if (req.query.position && isValidObjectId(req.query.position)) {
      filter.position = req.query.position;
    }

    const active = parseBooleanQuery(req.query.active);
    if (active !== null) filter.isActive = active;

    const [rawItems, total] = await Promise.all([
      populateSalaryQuery(
        SalaryProfile.find(filter)
          .sort({ isActive: -1, effectiveFrom: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit + 1)
      ).lean(),
      cursor ? Promise.resolve(null) : SalaryProfile.countDocuments(filter),
    ]);

    const hasNextPage = rawItems.length > limit;
    const items = hasNextPage ? rawItems.slice(0, limit) : rawItems;
    const nextCursor = hasNextPage && items.length ? encodeCursor(items[items.length - 1]) : null;

    return res.json({
      count: items.length,
      total: total ?? null,
      page,
      limit,
      totalPages: total === null ? null : Math.ceil(total / limit),
      pageInfo: { page, limit, hasNextPage, nextCursor },
      salaryProfiles: items,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in listSalaryProfiles.",
      error: err.message,
    });
  }
};

/* ===============================
   GET ONE SALARY PROFILE
================================ */
export const getSalaryProfileById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary profile ID." });
    }

    const profile = await populateSalaryQuery(SalaryProfile.findById(req.params.id)).lean();

    if (!profile) {
      return res.status(404).json({ message: "Salary profile not found." });
    }

    return res.json({ salaryProfile: profile });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getSalaryProfileById.",
      error: err.message,
    });
  }
};

/* ===============================
   GET ACTIVE PROFILE BY EMPLOYEE
================================ */
export const getActiveSalaryProfileByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    if (!isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID." });
    }

    const profile = await populateSalaryQuery(
      SalaryProfile.findOne({ employee: employeeId, isActive: true })
    ).lean();

    if (!profile) {
      return res.status(404).json({ message: "Active salary profile not found." });
    }

    return res.json({ salaryProfile: profile });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getActiveSalaryProfileByEmployee.",
      error: err.message,
    });
  }
};

/* ===============================
   UPDATE SALARY PROFILE
================================ */
export const updateSalaryProfile = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary profile ID." });
    }

    const profile = await SalaryProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: "Salary profile not found." });
    }

    const built = await buildProfilePayload(req, { isCreate: false });
    if (!built.ok) {
      return res.status(built.status).json({ message: built.message });
    }

    const { payload } = built;

    Object.assign(profile, {
      ...payload,
      updatedBy: req.user?._id || null,
    });

    if (payload.isActive === true) {
      await SalaryProfile.updateMany(
        { employee: profile.employee, _id: { $ne: profile._id }, isActive: true },
        {
          $set: {
            isActive: false,
            effectiveTo: profile.effectiveFrom || new Date(),
            updatedBy: req.user?._id || null,
          },
        }
      );
    }

    await profile.save();

    const full = await populateSalaryQuery(SalaryProfile.findById(profile._id)).lean();

    return res.json({
      message: "Salary profile updated.",
      salaryProfile: full,
      preview: profile.getFixedMonthlyPreview(),
    });
  } catch (err) {
    const duplicate = handleDuplicate(err);
    if (duplicate) return res.status(409).json({ message: duplicate });

    return res.status(500).json({
      message: "Server error in updateSalaryProfile.",
      error: err.message,
    });
  }
};

/* ===============================
   DEACTIVATE SALARY PROFILE
================================ */
export const deactivateSalaryProfile = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary profile ID." });
    }

    const profile = await SalaryProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: "Salary profile not found." });
    }

    profile.isActive = false;
    profile.effectiveTo = req.body.effectiveTo ? new Date(req.body.effectiveTo) : new Date();
    profile.updatedBy = req.user?._id || null;

    await profile.save();

    const full = await populateSalaryQuery(SalaryProfile.findById(profile._id)).lean();

    return res.json({
      message: "Salary profile deactivated.",
      salaryProfile: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deactivateSalaryProfile.",
      error: err.message,
    });
  }
};

/* ===============================
   DELETE SALARY PROFILE
================================ */
export const deleteSalaryProfile = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary profile ID." });
    }

    const profile = await SalaryProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: "Salary profile not found." });
    }

    if (profile.isActive) {
      return res.status(400).json({
        message: "Active salary profile cannot be deleted. Deactivate it first.",
      });
    }

    await profile.deleteOne();

    return res.json({ message: "Salary profile deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteSalaryProfile.",
      error: err.message,
    });
  }
};

/* ===============================
   PREVIEW SALARY PROFILE
================================ */
export const previewSalaryProfile = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid salary profile ID." });
    }

    const profile = await SalaryProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: "Salary profile not found." });
    }

    return res.json({
      salaryProfileId: profile._id,
      preview: profile.getFixedMonthlyPreview(),
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in previewSalaryProfile.",
      error: err.message,
    });
  }
};
