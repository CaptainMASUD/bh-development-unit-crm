// ===============================
// ✅ controllers/user.controller.js (FULL UPDATED)
// ✅ Existing user controller + Department/Position/PermissionGroup
// ✅ NEW: Employee profile fields: employeeId, phone, address, job type, salary type
// ✅ NEW: Auto SalaryProfile create/update during employee create/update
// ✅ NEW: Position default salary can auto-fill employee salary
// ✅ NEW: Admin can override salary when creating/updating employee
// ✅ Admin/Superadmin must confirm THEIR OWN password before deleting ANY user
//     Body: { password: "YOUR_PASSWORD" }
// ===============================

import User from "../models/user.model.js";
import Department from "../models/department.model.js";
import Position from "../models/position.model.js";
import PermissionGroup from "../models/permissionGroup.model.js";
import SalaryProfile from "../models/salaryProfile.model.js";
import { uploadCloudinary, deleteCloudinary } from "../utils/cloudinary.js";

/* =========================
   ROLE HELPERS
========================= */
const isSuperAdmin = (req) => req.user?.role === "superadmin";
const isAdminOrSuperAdmin = (req) =>
  ["admin", "superadmin"].includes(req.user?.role);

const denyIfTargetIsSuperAdmin = (targetUser, req, res) => {
  if (targetUser?.role === "superadmin" && !isSuperAdmin(req)) {
    res
      .status(403)
      .json({ message: "Only super admin can manage super admin accounts." });
    return true;
  }
  return false;
};

/* =========================
   PASSWORD CONFIRMATION
========================= */
const requireRequesterPassword = async (req, res) => {
  try {
    const password = String(req.body?.password || "");

    if (!password) {
      res
        .status(400)
        .json({ message: "Password is required to delete this user." });
      return false;
    }

    const requester = await User.findById(req.user?._id).select("+password");

    if (!requester) {
      res.status(401).json({ message: "Unauthorized." });
      return false;
    }

    const ok = await requester.comparePassword(password);

    if (!ok) {
      res.status(401).json({ message: "Password is incorrect." });
      return false;
    }

    return true;
  } catch (err) {
    res.status(500).json({
      message: "Password verification failed.",
      error: err.message,
    });
    return false;
  }
};

/* =========================
   OPTIMIZATION HELPERS
========================= */
const LIST_PROJECTION =
  "_id name email role employeeId phone alternatePhone gender dateOfBirth address emergencyContact joiningDate leavingDate employmentType salaryType employeeStatus isActive avatarUrl department position permissionGroup teamRole dailyLeadLimit isAvailableForAssignment workStatus managerId createdAt updatedAt";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseLimit = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const handleMongoDuplicateKey = (err) => {
  if (err?.code === 11000) {
    const key = Object.keys(err.keyPattern || {})[0] || "field";
    return { message: `Duplicate ${key}. This ${key} already exists.` };
  }
  return null;
};

const escapeRegex = (str) =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchFilter = (qRaw) => {
  const q = String(qRaw || "").trim();
  if (!q) return null;

  const safe = escapeRegex(q);
  const isEmailish = q.includes("@");
  const rx = isEmailish ? new RegExp(safe, "i") : new RegExp(`^${safe}`, "i");

  return {
    $or: [
      { name: rx },
      { email: rx },
      { employeeId: new RegExp(safe, "i") },
      { phone: new RegExp(safe, "i") },
    ],
  };
};

const clean = (value) => String(value ?? "").trim();

const normalizeOptionalObjectId = (value) => {
  const cleanValue = clean(value);
  return cleanValue ? cleanValue : null;
};

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const normalizeDate = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeEmploymentType = (value) => {
  const raw = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return undefined;

  const map = {
    fulltime: "full_time",
    full_time: "full_time",
    parttime: "part_time",
    part_time: "part_time",
    half_time: "part_time",
    halftime: "part_time",
    intern: "intern",
    internship: "intern",
    contract: "contract",
    contractual: "contract",
  };

  return map[raw] || raw;
};

const normalizeSalaryType = (value) => {
  const raw = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return undefined;

  const map = {
    fixed: "fixed",
    monthly: "fixed",
    salary: "fixed",
    hourly: "hourly",
    per_hour: "hourly",
    commission: "commission",
    commision: "commission",
  };

  return map[raw] || raw;
};

const normalizeGender = (value) => {
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  if (["male", "female", "other"].includes(raw)) return raw;
  return "";
};

const normalizeEmployeeStatus = (value) => {
  const raw = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return undefined;
  if (["active", "probation", "on_leave", "resigned", "terminated"].includes(raw)) {
    return raw;
  }
  return undefined;
};

const normalizeAddress = (value) => {
  if (value === undefined) return undefined;

  if (typeof value === "string") {
    return {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Bangladesh",
      fullAddress: clean(value),
    };
  }

  if (!value || typeof value !== "object") {
    return {
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Bangladesh",
      fullAddress: "",
    };
  }

  return {
    line1: clean(value.line1),
    line2: clean(value.line2),
    city: clean(value.city),
    state: clean(value.state),
    postalCode: clean(value.postalCode),
    country: clean(value.country || "Bangladesh"),
    fullAddress: clean(value.fullAddress),
  };
};

const normalizeEmergencyContact = (value) => {
  if (value === undefined) return undefined;

  if (!value || typeof value !== "object") {
    return { name: "", phone: "", relation: "", address: "" };
  }

  return {
    name: clean(value.name),
    phone: clean(value.phone),
    relation: clean(value.relation),
    address: clean(value.address),
  };
};

const buildEmployeeProfilePayload = (body = {}, { isCreate = false } = {}) => {
  const payload = {};

  if (body.employeeId !== undefined || body.employeeCode !== undefined) {
    const employeeId = clean(body.employeeId ?? body.employeeCode).toUpperCase();
    payload.employeeId = employeeId || undefined;
  }

  if (body.phone !== undefined) payload.phone = clean(body.phone);
  if (body.alternatePhone !== undefined) payload.alternatePhone = clean(body.alternatePhone);

  if (body.gender !== undefined) payload.gender = normalizeGender(body.gender);

  if (body.dateOfBirth !== undefined) {
    payload.dateOfBirth = normalizeDate(body.dateOfBirth);
  }

  const address = normalizeAddress(body.address);
  if (address !== undefined) payload.address = address;

  const emergencyContact = normalizeEmergencyContact(body.emergencyContact);
  if (emergencyContact !== undefined) payload.emergencyContact = emergencyContact;

  if (body.joiningDate !== undefined || isCreate) {
    const joiningDate = normalizeDate(body.joiningDate);
    payload.joiningDate = joiningDate === undefined ? new Date() : joiningDate;
  }

  if (body.leavingDate !== undefined) {
    payload.leavingDate = normalizeDate(body.leavingDate);
  }

  if (body.employmentType !== undefined || body.jobType !== undefined || isCreate) {
    const employmentType = normalizeEmploymentType(
      body.employmentType ?? body.jobType ?? "full_time"
    );

    payload.employmentType = employmentType || "full_time";
  }

  if (body.salaryType !== undefined || isCreate) {
    const salaryType = normalizeSalaryType(body.salaryType ?? "fixed");
    payload.salaryType = salaryType || "fixed";
  }

  if (body.employeeStatus !== undefined) {
    const employeeStatus = normalizeEmployeeStatus(body.employeeStatus);
    if (employeeStatus) payload.employeeStatus = employeeStatus;
  } else if (isCreate) {
    payload.employeeStatus = "active";
  }

  return payload;
};

/* =========================
   POPULATE HELPERS
========================= */
const USER_POPULATE = [
  { path: "department", select: "name isActive" },
  {
    path: "position",
    select:
      "title department isActive defaultSalaryEnabled defaultSalaryType defaultCurrency defaultBasicSalary defaultWorkingDaysPerMonth defaultWorkingHoursPerDay defaultComponents defaultRules",
  },
  { path: "permissionGroup", select: "name permissions isActive" },
  { path: "managerId", select: "name email role employeeId phone isActive avatarUrl" },
];

const populateUserQuery = (query) => query.populate(USER_POPULATE);

const validateEmployeeAccessRefs = async ({
  department,
  position,
  permissionGroup,
}) => {
  const departmentId = department || null;
  const positionId = position || null;
  const permissionGroupId = permissionGroup || null;

  if (departmentId) {
    const dep = await Department.exists({ _id: departmentId });
    if (!dep) return { ok: false, message: "Department not found." };
  }

  if (positionId) {
    const pos = await Position.findById(positionId).select("department").lean();

    if (!pos) return { ok: false, message: "Position not found." };

    if (departmentId && String(pos.department) !== String(departmentId)) {
      return {
        ok: false,
        message: "Selected position does not belong to the selected department.",
      };
    }
  }

  if (permissionGroupId) {
    const group = await PermissionGroup.exists({ _id: permissionGroupId });
    if (!group) return { ok: false, message: "Permission group not found." };
  }

  return { ok: true };
};

/* =========================
   SALARY PROFILE HELPERS
========================= */
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

/**
 * Your SalaryProfile model previously used monthly/daily/hourly.
 * Employee User.salaryType uses fixed/hourly/commission for business meaning.
 * This keeps SalaryProfile compatible until you update SalaryProfile to support commission directly.
 */
const mapEmployeeSalaryTypeToProfileType = (salaryType) => {
  if (salaryType === "hourly") return "hourly";
  return "monthly";
};

const buildSalaryProfileInputFromRequest = (body = {}, employee = null) => {
  const input =
    body.salaryProfile && typeof body.salaryProfile === "object"
      ? { ...body.salaryProfile }
      : {};

  const rootSalaryType = normalizeSalaryType(body.salaryType ?? employee?.salaryType);

  if (rootSalaryType && input.salaryType === undefined) {
    input.salaryType = mapEmployeeSalaryTypeToProfileType(rootSalaryType);
  }

  if (body.basicSalary !== undefined && input.basicSalary === undefined) {
    input.basicSalary = body.basicSalary;
  }

  if (body.workingDaysPerMonth !== undefined && input.workingDaysPerMonth === undefined) {
    input.workingDaysPerMonth = body.workingDaysPerMonth;
  }

  if (body.workingHoursPerDay !== undefined && input.workingHoursPerDay === undefined) {
    input.workingHoursPerDay = body.workingHoursPerDay;
  }

  if (body.currency !== undefined && input.currency === undefined) {
    input.currency = body.currency;
  }

  return input;
};

const buildEmployeeSalaryProfilePayload = async ({
  employee,
  salaryProfileInput,
  createSalaryProfile,
}) => {
  if (createSalaryProfile === false) {
    return { ok: true, payload: null };
  }

  const input =
    salaryProfileInput && typeof salaryProfileInput === "object"
      ? salaryProfileInput
      : {};

  const hasCustomSalaryInput = Object.keys(input).length > 0;

  let positionDefault = null;

  if (employee.position) {
    positionDefault = await Position.findById(employee.position).lean();
  }

  const hasPositionDefault =
    positionDefault?.defaultSalaryEnabled === true &&
    Number(positionDefault?.defaultBasicSalary || 0) > 0;

  if (!hasCustomSalaryInput && !hasPositionDefault) {
    return { ok: true, payload: null };
  }

  const basicSalary =
    input.basicSalary !== undefined
      ? roundMoney(input.basicSalary)
      : roundMoney(positionDefault?.defaultBasicSalary || 0);

  if (basicSalary <= 0) {
    return {
      ok: false,
      message: "Basic salary is required to create salary profile.",
    };
  }

  const payload = {
    employee: employee._id,
    department: employee.department || null,
    position: employee.position || null,

    salaryType:
      input.salaryType || positionDefault?.defaultSalaryType || "monthly",

    currency: String(input.currency || positionDefault?.defaultCurrency || "BDT")
      .trim()
      .toUpperCase(),

    basicSalary,

    workingDaysPerMonth:
      input.workingDaysPerMonth !== undefined
        ? Number(input.workingDaysPerMonth)
        : Number(positionDefault?.defaultWorkingDaysPerMonth || 26),

    workingHoursPerDay:
      input.workingHoursPerDay !== undefined
        ? Number(input.workingHoursPerDay)
        : Number(positionDefault?.defaultWorkingHoursPerDay || 8),

    components: Array.isArray(input.components)
      ? normalizeSalaryComponents(input.components)
      : normalizeSalaryComponents(positionDefault?.defaultComponents || []),

    rules:
      input.rules !== undefined ? input.rules || {} : positionDefault?.defaultRules || {},

    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),

    isActive: true,

    note:
      input.note !== undefined
        ? clean(input.note)
        : hasCustomSalaryInput
        ? "Salary profile created during employee creation."
        : "Salary profile created from position default.",
  };

  return { ok: true, payload };
};

const createOrReplaceActiveSalaryProfile = async ({
  employee,
  salaryProfileInput,
  createSalaryProfile,
  requesterId,
}) => {
  const built = await buildEmployeeSalaryProfilePayload({
    employee,
    salaryProfileInput,
    createSalaryProfile,
  });

  if (!built.ok) return built;

  if (!built.payload) {
    return { ok: true, salaryProfile: null };
  }

  await SalaryProfile.updateMany(
    { employee: employee._id, isActive: true },
    {
      $set: {
        isActive: false,
        effectiveTo: built.payload.effectiveFrom || new Date(),
        updatedBy: requesterId || null,
      },
    }
  );

  const salaryProfile = await SalaryProfile.create({
    ...built.payload,
    createdBy: requesterId || null,
    updatedBy: requesterId || null,
  });

  return { ok: true, salaryProfile };
};

/* =========================
   CURSOR HELPERS
========================= */
const encodeCursor = (doc) => {
  if (!doc?._id || !doc?.createdAt) return null;

  const payload = {
    ts: new Date(doc.createdAt).toISOString(),
    id: String(doc._id),
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;

  try {
    const raw = Buffer.from(String(cursor), "base64url").toString("utf8");
    const obj = JSON.parse(raw);

    if (!obj?.ts || !obj?.id) return null;

    const ts = new Date(obj.ts);
    if (Number.isNaN(ts.getTime())) return null;

    return { ts, id: obj.id };
  } catch {
    return null;
  }
};

const buildCursorFilter = ({ cursorObj, sort }) => {
  if (!cursorObj) return null;

  const { ts, id } = cursorObj;

  if (sort === "newest") {
    return {
      $or: [
        { createdAt: { $lt: ts } },
        { createdAt: ts, _id: { $lt: id } },
      ],
    };
  }

  return {
    $or: [
      { createdAt: { $gt: ts } },
      { createdAt: ts, _id: { $gt: id } },
    ],
  };
};

const parseSort = (v) =>
  String(v || "newest") === "oldest" ? "oldest" : "newest";

const listUsersByRole = async (req, res, role, responseKey) => {
  try {
    const limit = parseLimit(req.query.limit);
    const sort = parseSort(req.query.sort);
    const active = String(req.query.active ?? "all");
    const cursorObj = decodeCursor(req.query.cursor);

    const filter = { role };

    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;

    if (req.query.department) filter.department = req.query.department;
    if (req.query.position) filter.position = req.query.position;
    if (req.query.employmentType) filter.employmentType = normalizeEmploymentType(req.query.employmentType);
    if (req.query.salaryType) filter.salaryType = normalizeSalaryType(req.query.salaryType);
    if (req.query.employeeStatus) filter.employeeStatus = normalizeEmployeeStatus(req.query.employeeStatus);

    const searchFilter = buildSearchFilter(req.query.q);
    if (searchFilter) Object.assign(filter, searchFilter);

    const cursorFilter = buildCursorFilter({ cursorObj, sort });
    if (cursorFilter) Object.assign(filter, cursorFilter);

    const sortSpec =
      sort === "newest"
        ? { createdAt: -1, _id: -1 }
        : { createdAt: 1, _id: 1 };

    const rows = await populateUserQuery(User.find(filter))
      .select(LIST_PROJECTION)
      .sort(sortSpec)
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

    return res.status(200).json({
      count: items.length,
      [responseKey]: items,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    return res.status(500).json({
      message: `Server error in list ${role}.`,
      error: err.message,
    });
  }
};

/* =========================
   AVATAR HELPERS
========================= */
const requireImageFile = (req, res) => {
  if (!req.file?.buffer) {
    res
      .status(400)
      .json({ message: "Avatar image file is required (field: avatar)." });
    return false;
  }

  if (!req.file.mimetype?.startsWith("image/")) {
    res.status(400).json({ message: "Only image files are allowed." });
    return false;
  }

  return true;
};

const uploadAvatarAndReplace = async (userDoc, fileBuffer) => {
  const uploaded = await uploadCloudinary(fileBuffer);

  if (!uploaded?.secure_url || !uploaded?.public_id) return null;

  const oldPublicId = userDoc.avatarPublicId;

  userDoc.avatarUrl = uploaded.secure_url;
  userDoc.avatarPublicId = uploaded.public_id;

  await userDoc.save();

  if (oldPublicId && oldPublicId !== uploaded.public_id) {
    await deleteCloudinary(oldPublicId);
  }

  return uploaded;
};

/* =========================
   ADMIN: EMPLOYEES
========================= */
export const createEmployee = async (req, res) => {
  let createdEmployeeId = null;

  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password ?? "");

    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    const department = normalizeOptionalObjectId(req.body.department);
    const position = normalizeOptionalObjectId(req.body.position);
    const permissionGroup = normalizeOptionalObjectId(req.body.permissionGroup);
    const managerId = normalizeOptionalObjectId(req.body.managerId);

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const refsOk = await validateEmployeeAccessRefs({
      department,
      position,
      permissionGroup,
    });

    if (!refsOk.ok) {
      return res.status(400).json({ message: refsOk.message });
    }

    const employeeProfile = buildEmployeeProfilePayload(req.body, {
      isCreate: true,
    });

    const employee = await User.create({
      name,
      email,
      password,
      role: "employee",
      isActive,
      department,
      position,
      permissionGroup,
      managerId,
      ...employeeProfile,

      dailyLeadLimit: Number(req.body.dailyLeadLimit || 0),

      isAvailableForAssignment:
        typeof req.body.isAvailableForAssignment === "boolean"
          ? req.body.isAvailableForAssignment
          : true,

      workStatus: req.body.workStatus || "available",
      teamRole: req.body.teamRole || "",
    });

    createdEmployeeId = employee._id;

    const salaryProfileInput = buildSalaryProfileInputFromRequest(req.body, employee);

    const salaryResult = await createOrReplaceActiveSalaryProfile({
      employee,
      salaryProfileInput,
      createSalaryProfile: req.body.createSalaryProfile,
      requesterId: req.user?._id || null,
    });

    if (!salaryResult.ok) {
      await User.findByIdAndDelete(createdEmployeeId);
      return res.status(400).json({ message: salaryResult.message });
    }

    const safe = await populateUserQuery(User.findById(employee._id))
      .select(LIST_PROJECTION)
      .lean();

    const salaryProfile = salaryResult.salaryProfile
      ? await SalaryProfile.findById(salaryResult.salaryProfile._id).lean()
      : null;

    return res.status(201).json({
      message: "Employee created.",
      employee: safe,
      salaryProfile,
    });
  } catch (err) {
    if (createdEmployeeId) {
      try {
        await SalaryProfile.deleteMany({ employee: createdEmployeeId });
        await User.findByIdAndDelete(createdEmployeeId);
      } catch {}
    }

    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createEmployee.",
      error: err.message,
    });
  }
};

export const getEmployees = async (req, res) => {
  return listUsersByRole(req, res, "employee", "employees");
};

export const getEmployeeById = async (req, res) => {
  try {
    const employee = await populateUserQuery(
      User.findOne({
        _id: req.params.id,
        role: { $in: ["employee", "marketing_team"] },
      })
    )
      .select(LIST_PROJECTION)
      .lean();

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const salaryProfile = await SalaryProfile.findOne({
      employee: employee._id,
      isActive: true,
    }).lean();

    return res.status(200).json({ employee, salaryProfile });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeeById.",
      error: err.message,
    });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { name, email, password, isActive } = req.body;

    const wantsPassword = password !== undefined && String(password).length > 0;

    const employee = wantsPassword
      ? await User.findOne({
          _id: req.params.id,
          role: { $in: ["employee", "marketing_team"] },
        }).select("+password")
      : await User.findOne({
          _id: req.params.id,
          role: { $in: ["employee", "marketing_team"] },
        });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    if (email !== undefined) {
      const e = clean(email).toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      employee.email = e;
    }

    if (name !== undefined) {
      const n = clean(name);
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      employee.name = n;
    }

    if (typeof isActive === "boolean") employee.isActive = isActive;
    if (wantsPassword) employee.password = String(password);

    const nextDepartment =
      req.body.department !== undefined
        ? normalizeOptionalObjectId(req.body.department)
        : employee.department;

    const nextPosition =
      req.body.position !== undefined
        ? normalizeOptionalObjectId(req.body.position)
        : employee.position;

    const nextPermissionGroup =
      req.body.permissionGroup !== undefined
        ? normalizeOptionalObjectId(req.body.permissionGroup)
        : employee.permissionGroup;

    const refsOk = await validateEmployeeAccessRefs({
      department: nextDepartment,
      position: nextPosition,
      permissionGroup: nextPermissionGroup,
    });

    if (!refsOk.ok) {
      return res.status(400).json({ message: refsOk.message });
    }

    if (req.body.department !== undefined) employee.department = nextDepartment;
    if (req.body.position !== undefined) employee.position = nextPosition;
    if (req.body.permissionGroup !== undefined) {
      employee.permissionGroup = nextPermissionGroup;
    }

    if (req.body.managerId !== undefined) {
      employee.managerId = normalizeOptionalObjectId(req.body.managerId);
    }

    const employeeProfile = buildEmployeeProfilePayload(req.body, {
      isCreate: false,
    });

    Object.assign(employee, employeeProfile);

    if (req.body.dailyLeadLimit !== undefined) {
      employee.dailyLeadLimit = Number(req.body.dailyLeadLimit || 0);
    }

    if (typeof req.body.isAvailableForAssignment === "boolean") {
      employee.isAvailableForAssignment = req.body.isAvailableForAssignment;
    }

    if (req.body.workStatus !== undefined) {
      employee.workStatus = req.body.workStatus || "available";
    }

    if (req.body.teamRole !== undefined) {
      employee.teamRole = req.body.teamRole || "";
    }

    if (employee.role === "marketing_team") {
      employee.role = "employee";
    }

    await employee.save();

    let salaryProfile = null;

    if (
      req.body.salaryProfile !== undefined ||
      req.body.createSalaryProfile === true ||
      req.body.basicSalary !== undefined ||
      req.body.salaryType !== undefined ||
      req.body.currency !== undefined
    ) {
      const salaryProfileInput = buildSalaryProfileInputFromRequest(req.body, employee);

      const salaryResult = await createOrReplaceActiveSalaryProfile({
        employee,
        salaryProfileInput,
        createSalaryProfile: req.body.createSalaryProfile,
        requesterId: req.user?._id || null,
      });

      if (!salaryResult.ok) {
        return res.status(400).json({ message: salaryResult.message });
      }

      if (salaryResult.salaryProfile) {
        salaryProfile = await SalaryProfile.findById(
          salaryResult.salaryProfile._id
        ).lean();
      }
    } else {
      salaryProfile = await SalaryProfile.findOne({
        employee: employee._id,
        isActive: true,
      }).lean();
    }

    const safe = await populateUserQuery(User.findById(employee._id))
      .select(LIST_PROJECTION)
      .lean();

    return res.status(200).json({
      message: "Employee updated.",
      employee: safe,
      salaryProfile,
    });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateEmployee.",
      error: err.message,
    });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    const employee = await User.findOne({
      _id: req.params.id,
      role: { $in: ["employee", "marketing_team"] },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    if (employee.avatarPublicId) {
      await deleteCloudinary(employee.avatarPublicId);
    }

    await SalaryProfile.deleteMany({ employee: employee._id });
    await employee.deleteOne();

    return res.status(200).json({ message: "Employee deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteEmployee.",
      error: err.message,
    });
  }
};

/* =========================
   ADMIN: MARKETING TEAM
   NOTE: Kept for backward compatibility.
   New system should create marketing users as:
   role: employee + department: marketing
========================= */
export const createMarketingTeam = async (req, res) => {
  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password ?? "");

    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const marketing = await User.create({
      name,
      email,
      password,
      role: "marketing_team",
      isActive,
    });

    const safe = await User.findById(marketing._id)
      .select(LIST_PROJECTION)
      .lean();

    return res
      .status(201)
      .json({ message: "Marketing team user created.", marketing: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createMarketingTeam.",
      error: err.message,
    });
  }
};

export const getMarketingTeam = async (req, res) => {
  return listUsersByRole(req, res, "marketing_team", "marketing");
};

export const getMarketingTeamById = async (req, res) => {
  try {
    const marketing = await User.findOne({
      _id: req.params.id,
      role: "marketing_team",
    })
      .select(LIST_PROJECTION)
      .lean();

    if (!marketing) {
      return res
        .status(404)
        .json({ message: "Marketing team user not found." });
    }

    return res.status(200).json({ marketing });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getMarketingTeamById.",
      error: err.message,
    });
  }
};

export const updateMarketingTeam = async (req, res) => {
  try {
    const { name, email, password, isActive } = req.body;

    const wantsPassword = password !== undefined && String(password).length > 0;

    const marketing = wantsPassword
      ? await User.findOne({
          _id: req.params.id,
          role: "marketing_team",
        }).select("+password")
      : await User.findOne({
          _id: req.params.id,
          role: "marketing_team",
        });

    if (!marketing) {
      return res
        .status(404)
        .json({ message: "Marketing team user not found." });
    }

    if (email !== undefined) {
      const e = clean(email).toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      marketing.email = e;
    }

    if (name !== undefined) {
      const n = clean(name);
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      marketing.name = n;
    }

    if (typeof isActive === "boolean") marketing.isActive = isActive;
    if (wantsPassword) marketing.password = String(password);

    await marketing.save();

    const safe = await User.findById(marketing._id)
      .select(LIST_PROJECTION)
      .lean();

    return res
      .status(200)
      .json({ message: "Marketing team user updated.", marketing: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateMarketingTeam.",
      error: err.message,
    });
  }
};

export const deleteMarketingTeam = async (req, res) => {
  try {
    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    const marketing = await User.findOne({
      _id: req.params.id,
      role: "marketing_team",
    });

    if (!marketing) {
      return res
        .status(404)
        .json({ message: "Marketing team user not found." });
    }

    if (marketing.avatarPublicId) {
      await deleteCloudinary(marketing.avatarPublicId);
    }

    await SalaryProfile.deleteMany({ employee: marketing._id });
    await marketing.deleteOne();

    return res.status(200).json({ message: "Marketing team user deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteMarketingTeam.",
      error: err.message,
    });
  }
};

/* =========================
   ADMIN: ADMINS
========================= */
export const createAdmin = async (req, res) => {
  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password ?? "");

    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: "admin",
      isActive,
    });

    const safe = await User.findById(admin._id)
      .select(LIST_PROJECTION)
      .lean();

    return res.status(201).json({ message: "Admin created.", admin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createAdmin.",
      error: err.message,
    });
  }
};

export const getAdmins = async (req, res) => {
  return listUsersByRole(req, res, "admin", "admins");
};

export const getAdminById = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: "admin" })
      .select(LIST_PROJECTION)
      .lean();

    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    return res.status(200).json({ admin });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getAdminById.",
      error: err.message,
    });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const { name, email, password, isActive } = req.body;
    const wantsPassword = password !== undefined && String(password).length > 0;

    const target = wantsPassword
      ? await User.findById(req.params.id).select("+password")
      : await User.findById(req.params.id);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    if (target.role !== "admin") {
      return res
        .status(400)
        .json({ message: "This endpoint can update only admin accounts." });
    }

    if (email !== undefined) {
      const e = clean(email).toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      target.email = e;
    }

    if (name !== undefined) {
      const n = clean(name);
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      target.name = n;
    }

    if (typeof isActive === "boolean") target.isActive = isActive;
    if (wantsPassword) target.password = String(password);

    await target.save();

    const safe = await User.findById(target._id)
      .select(LIST_PROJECTION)
      .lean();

    return res.status(200).json({ message: "Admin updated.", admin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateAdmin.",
      error: err.message,
    });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    if (String(req.user?._id) === String(req.params.id)) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account." });
    }

    const target = await User.findById(req.params.id);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    if (target.role !== "admin") {
      return res
        .status(400)
        .json({ message: "This endpoint can delete only admin accounts." });
    }

    if (target.avatarPublicId) {
      await deleteCloudinary(target.avatarPublicId);
    }

    await target.deleteOne();

    return res.status(200).json({ message: "Admin deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteAdmin.",
      error: err.message,
    });
  }
};

/* =========================
   SUPERADMIN: SUPERADMINS
========================= */
export const createSuperAdmin = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can create super admins." });
    }

    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password ?? "");

    const isActive =
      typeof req.body.isActive === "boolean" ? req.body.isActive : true;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, password are required." });
    }

    const superadmin = await User.create({
      name,
      email,
      password,
      role: "superadmin",
      isActive,
    });

    const safe = await User.findById(superadmin._id)
      .select(LIST_PROJECTION)
      .lean();

    return res
      .status(201)
      .json({ message: "Super admin created.", superadmin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in createSuperAdmin.",
      error: err.message,
    });
  }
};

export const getSuperAdmins = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can view super admins." });
    }

    return listUsersByRole(req, res, "superadmin", "superadmins");
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getSuperAdmins.",
      error: err.message,
    });
  }
};

export const getSuperAdminById = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can view super admins." });
    }

    const superadmin = await User.findOne({
      _id: req.params.id,
      role: "superadmin",
    })
      .select(LIST_PROJECTION)
      .lean();

    if (!superadmin) {
      return res.status(404).json({ message: "Super admin not found." });
    }

    return res.status(200).json({ superadmin });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getSuperAdminById.",
      error: err.message,
    });
  }
};

export const updateSuperAdmin = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can update super admins." });
    }

    const { name, email, password, isActive } = req.body;
    const wantsPassword = password !== undefined && String(password).length > 0;

    const superadmin = wantsPassword
      ? await User.findOne({
          _id: req.params.id,
          role: "superadmin",
        }).select("+password")
      : await User.findOne({
          _id: req.params.id,
          role: "superadmin",
        });

    if (!superadmin) {
      return res.status(404).json({ message: "Super admin not found." });
    }

    if (email !== undefined) {
      const e = clean(email).toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      superadmin.email = e;
    }

    if (name !== undefined) {
      const n = clean(name);
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      superadmin.name = n;
    }

    if (typeof isActive === "boolean") superadmin.isActive = isActive;
    if (wantsPassword) superadmin.password = String(password);

    await superadmin.save();

    const safe = await User.findById(superadmin._id)
      .select(LIST_PROJECTION)
      .lean();

    return res
      .status(200)
      .json({ message: "Super admin updated.", superadmin: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateSuperAdmin.",
      error: err.message,
    });
  }
};

export const deleteSuperAdmin = async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res
        .status(403)
        .json({ message: "Only super admin can delete super admins." });
    }

    const ok = await requireRequesterPassword(req, res);
    if (!ok) return;

    if (String(req.user?._id) === String(req.params.id)) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own super admin account." });
    }

    const superadmin = await User.findOne({
      _id: req.params.id,
      role: "superadmin",
    });

    if (!superadmin) {
      return res.status(404).json({ message: "Super admin not found." });
    }

    if (superadmin.avatarPublicId) {
      await deleteCloudinary(superadmin.avatarPublicId);
    }

    await superadmin.deleteOne();

    return res.status(200).json({ message: "Super admin deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteSuperAdmin.",
      error: err.message,
    });
  }
};

/* =========================
   GET ME / UPDATE ME
========================= */
export const getMe = async (req, res) => {
  try {
    const user = await populateUserQuery(User.findById(req.user._id))
      .select(LIST_PROJECTION)
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({ user });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getMe.",
      error: err.message,
    });
  }
};

export const updateMe = async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (name !== undefined) {
      const n = clean(name);
      if (!n) return res.status(400).json({ message: "Name cannot be empty." });
      user.name = n;
    }

    if (email !== undefined) {
      const e = clean(email).toLowerCase();
      if (!e) return res.status(400).json({ message: "Email cannot be empty." });
      user.email = e;
    }

    // Users can update only basic contact/profile fields for themselves.
    const selfProfile = buildEmployeeProfilePayload(
      {
        phone: req.body.phone,
        alternatePhone: req.body.alternatePhone,
        address: req.body.address,
        emergencyContact: req.body.emergencyContact,
      },
      { isCreate: false }
    );

    Object.assign(user, selfProfile);

    const wantsPasswordChange =
      newPassword !== undefined && String(newPassword).length > 0;

    if (wantsPasswordChange) {
      if (!currentPassword) {
        return res.status(400).json({
          message: "currentPassword is required to change password.",
        });
      }

      const ok = await user.comparePassword(String(currentPassword));

      if (!ok) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect." });
      }

      if (String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ message: "New password must be at least 6 characters." });
      }

      user.password = String(newPassword);
    }

    await user.save();

    const safe = await populateUserQuery(User.findById(user._id))
      .select(LIST_PROJECTION)
      .lean();

    return res.status(200).json({ message: "Profile updated.", user: safe });
  } catch (err) {
    const dup = handleMongoDuplicateKey(err);
    if (dup) return res.status(409).json(dup);

    return res.status(500).json({
      message: "Server error in updateMe.",
      error: err.message,
    });
  }
};

/* =========================
   AVATAR ENDPOINTS
========================= */
export const updateMyAvatar = async (req, res) => {
  try {
    if (!requireImageFile(req, res)) return;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const uploaded = await uploadAvatarAndReplace(user, req.file.buffer);

    if (!uploaded) {
      return res.status(500).json({ message: "Failed to upload avatar." });
    }

    const safe = await populateUserQuery(User.findById(user._id))
      .select(LIST_PROJECTION)
      .lean();

    return res.status(200).json({ message: "Avatar updated.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateMyAvatar.",
      error: err.message,
    });
  }
};

export const deleteMyAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.avatarPublicId) {
      await deleteCloudinary(user.avatarPublicId);
    }

    user.avatarUrl = "";
    user.avatarPublicId = "";

    await user.save();

    const safe = await populateUserQuery(User.findById(user._id))
      .select(LIST_PROJECTION)
      .lean();

    return res.status(200).json({ message: "Avatar removed.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteMyAvatar.",
      error: err.message,
    });
  }
};

export const adminUpdateUserAvatar = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    if (!requireImageFile(req, res)) return;

    const target = await User.findById(req.params.id);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    const uploaded = await uploadAvatarAndReplace(target, req.file.buffer);

    if (!uploaded) {
      return res.status(500).json({ message: "Failed to upload avatar." });
    }

    const safe = await populateUserQuery(User.findById(target._id))
      .select(LIST_PROJECTION)
      .lean();

    return res.status(200).json({ message: "Avatar updated.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in adminUpdateUserAvatar.",
      error: err.message,
    });
  }
};

export const adminDeleteUserAvatar = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({ message: "Not authorized." });
    }

    const target = await User.findById(req.params.id);

    if (!target) {
      return res.status(404).json({ message: "User not found." });
    }

    if (denyIfTargetIsSuperAdmin(target, req, res)) return;

    if (target.avatarPublicId) {
      await deleteCloudinary(target.avatarPublicId);
    }

    target.avatarUrl = "";
    target.avatarPublicId = "";

    await target.save();

    const safe = await populateUserQuery(User.findById(target._id))
      .select(LIST_PROJECTION)
      .lean();

    return res.status(200).json({ message: "Avatar removed.", user: safe });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in adminDeleteUserAvatar.",
      error: err.message,
    });
  }
};

/* =========================
   SEARCH MARKETING USERS
   NOTE: kept for old CRM flow.
========================= */
export const searchMarketingUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(Number(req.query.limit || 25), 50);

    const filter = {
      isActive: true,
      $or: [{ role: "marketing_team" }, { role: "employee", teamRole: "marketing" }],
    };

    if (q) {
      filter.nameLower = {
        $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      };
    }

    const users = await User.find(filter)
      .select("name email role employeeId phone teamRole department position employmentType salaryType")
      .populate([
        { path: "department", select: "name" },
        { path: "position", select: "title" },
      ])
      .sort({ nameLower: 1, _id: -1 })
      .limit(limit)
      .lean();

    return res.json({ users });
  } catch (e) {
    return res.status(500).json({ message: e.message || "User search failed" });
  }
};