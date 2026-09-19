import mongoose from "mongoose";
import User from "../../models/user.model.js";
import Attendance from "../../models/attendance.model.js";
import SalaryProfile from "../../models/salaryProfile.model.js";
import WeeklyOff from "../../models/weeklyOff.model.js";
import Holiday from "../../models/holiday.model.js";
import PayrollPeriod from "../../models/payroll/payrollPeriod.model.js";

const DEFAULT_LIMIT = 31;
const MAX_LIMIT = 200;

const USER_POPULATE = [
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
  { path: "permissionGroup", select: "name permissions isActive" },
];

const ATTENDANCE_POPULATE = [
  {
    path: "employee",
    select: "name email role isActive department position avatarUrl",
    populate: USER_POPULATE,
  },
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
  { path: "createdBy", select: "name email role" },
  { path: "updatedBy", select: "name email role" },
];

const clean = (value) => String(value ?? "").trim();

const round2 = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const isAdminUser = (req) =>
  ["admin", "superadmin"].includes(String(req.user?.role || "")) ||
  (req.user?.permissionGroup?.isActive !== false && req.user?.permissionGroup?.permissions?.includes?.("attendance:manage"));

const normalizeDateOnly = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const dayKey = (value) => {
  const d = normalizeDateOnly(value);
  return d ? d.toISOString().slice(0, 10) : "";
};

export const checkPeriodLockedForDate = async (date) => {
  if (!date) return { isLocked: false };
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { isLocked: false };
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const period = await PayrollPeriod.findOne({ year, month }).lean();
  if (period?.status === "locked") {
    return {
      isLocked: true,
      message: `Payroll period ${year}-${String(month).padStart(2, "0")} is locked. Attendance cannot be modified.`,
    };
  }
  return { isLocked: false };
};

const getMonthRange = ({ year, month }) => {
  const y = Number(year);
  const m = Number(month);

  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return null;
  }

  const start = new Date(y, m - 1, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(y, m, 1);
  end.setHours(0, 0, 0, 0);

  return { start, end, year: y, month: m };
};

const eachDay = ({ start, end }) => {
  const days = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
};

const populateAttendanceQuery = (query) => query.populate(ATTENDANCE_POPULATE);

const requireAdmin = (req, res) => {
  if (!isAdminUser(req)) {
    res.status(403).json({ message: "Only admin or superadmin can manage attendance." });
    return false;
  }
  return true;
};

const loadEmployee = async (employeeId) => {
  if (!isValidObjectId(employeeId)) return null;

  return User.findById(employeeId)
    .select("name email role isActive department position")
    .lean();
};

const validateEmployeeForAttendance = async (employeeId) => {
  const employee = await loadEmployee(employeeId);

  if (!employee) {
    return { ok: false, status: 404, message: "Employee not found." };
  }

  if (employee.role !== "employee") {
    return {
      ok: false,
      status: 400,
      message: "Attendance can only be added for employee users.",
    };
  }

  if (!employee.isActive) {
    return {
      ok: false,
      status: 400,
      message: "Cannot add attendance for inactive employee.",
    };
  }

  return { ok: true, employee };
};

const buildAttendancePayload = async (req, { isCreate = true } = {}) => {
  const employeeId = clean(req.body.employee || req.body.employeeId);

  if (isCreate && !employeeId) {
    return { ok: false, status: 400, message: "Employee is required." };
  }

  let employee = null;

  if (employeeId) {
    const checked = await validateEmployeeForAttendance(employeeId);
    if (!checked.ok) return checked;
    employee = checked.employee;
  }

  const payload = {};

  if (employee) {
    payload.employee = employee._id;
    payload.department = employee.department || null;
    payload.position = employee.position || null;
  }

  if (req.body.workDate !== undefined || isCreate) {
    const workDate = normalizeDateOnly(req.body.workDate);
    if (!workDate) return { ok: false, status: 400, message: "Invalid workDate." };
    const lockCheck = await checkPeriodLockedForDate(workDate);
    if (lockCheck.isLocked) {
      return { ok: false, status: 403, message: lockCheck.message };
    }
    payload.workDate = workDate;
  }

  if (req.body.status !== undefined || isCreate) {
    payload.status = clean(req.body.status || "present");
  }

  if (req.body.source !== undefined) {
    payload.source = clean(req.body.source || "manual");
  } else if (isCreate) {
    payload.source = "manual";
  }

  if (req.body.checkIn !== undefined) {
    payload.checkIn = req.body.checkIn ? new Date(req.body.checkIn) : null;
  }

  if (req.body.checkOut !== undefined) {
    payload.checkOut = req.body.checkOut ? new Date(req.body.checkOut) : null;
  }

  if (req.body.workMinutes !== undefined) {
    payload.workMinutes = Number(req.body.workMinutes || 0);
  }

  if (req.body.lateMinutes !== undefined) {
    payload.lateMinutes = Number(req.body.lateMinutes || 0);
  }

  if (req.body.overtimeMinutes !== undefined) {
    payload.overtimeMinutes = Number(req.body.overtimeMinutes || 0);
  }

  if (req.body.paidDayValue !== undefined) {
    payload.paidDayValue = round2(req.body.paidDayValue);
  }

  if (req.body.absentDeductionDays !== undefined) {
    payload.absentDeductionDays = round2(req.body.absentDeductionDays);
  }

  if (req.body.unpaidLeaveDeductionDays !== undefined) {
    payload.unpaidLeaveDeductionDays = round2(req.body.unpaidLeaveDeductionDays);
  }

  if (typeof req.body.isLateDeductible === "boolean") {
    payload.isLateDeductible = req.body.isLateDeductible;
  }

  if (typeof req.body.isOvertimeApproved === "boolean") {
    payload.isOvertimeApproved = req.body.isOvertimeApproved;
  }

  if (req.body.note !== undefined) {
    payload.note = clean(req.body.note);
  }

  return { ok: true, payload };
};

const calculateSalaryAttendanceImpact = ({ salaryProfile, summary }) => {
  if (!salaryProfile) {
    return {
      hasSalaryProfile: false,
      message: "Active salary profile not found.",
    };
  }

  const basicSalary = Number(salaryProfile.basicSalary || 0);
  const workingDays = Number(salaryProfile.workingDaysPerMonth || 26);
  const workingHours = Number(salaryProfile.workingHoursPerDay || 8);

  const perDayRate = workingDays > 0 ? basicSalary / workingDays : 0;
  const perHourRate = workingHours > 0 ? perDayRate / workingHours : 0;

  const rules = salaryProfile.rules || {};

  let absentDeduction = 0;
  let unpaidLeaveDeduction = 0;
  let lateDeduction = 0;
  let overtimeEarning = 0;

  if (rules.absentDeduction?.enabled !== false) {
    const rule = rules.absentDeduction || {};
    const type = rule.calculationType || "per_day";

    if (type === "per_day") absentDeduction = summary.absentDeductionDays * perDayRate;
    else if (type === "fixed") absentDeduction = summary.absentDeductionDays * Number(rule.value || 0);
    else if (type === "percentage") absentDeduction = summary.absentDeductionDays * ((basicSalary * Number(rule.value || 0)) / 100);
  }

  if (rules.unpaidLeaveDeduction?.enabled !== false) {
    const rule = rules.unpaidLeaveDeduction || {};
    const type = rule.calculationType || "per_day";

    if (type === "per_day") unpaidLeaveDeduction = summary.unpaidLeaveDeductionDays * perDayRate;
    else if (type === "fixed") unpaidLeaveDeduction = summary.unpaidLeaveDeductionDays * Number(rule.value || 0);
    else if (type === "percentage") unpaidLeaveDeduction = summary.unpaidLeaveDeductionDays * ((basicSalary * Number(rule.value || 0)) / 100);
  }

  if (rules.lateDeduction?.enabled) {
    const rule = rules.lateDeduction || {};
    const type = rule.calculationType || "fixed";

    if (type === "fixed") lateDeduction = summary.lateDeductibleCount * Number(rule.value || 0);
    else if (type === "per_minute") lateDeduction = summary.totalLateMinutes * Number(rule.value || 0);
    else if (type === "percentage") lateDeduction = summary.lateDeductibleCount * ((basicSalary * Number(rule.value || 0)) / 100);
  }

  if (rules.overtime?.enabled) {
    const rule = rules.overtime || {};
    const type = rule.calculationType || "per_hour";
    const overtimeHours = summary.approvedOvertimeHours;

    if (type === "per_hour") overtimeEarning = overtimeHours * Number(rule.value || 0);
    else if (type === "fixed") overtimeEarning = overtimeHours * Number(rule.value || 0);
    else if (type === "percentage") overtimeEarning = overtimeHours * perHourRate * (Number(rule.value || 0) / 100);
  }

  const totalAttendanceDeduction = round2(absentDeduction + unpaidLeaveDeduction + lateDeduction);
  const totalAttendanceEarning = round2(overtimeEarning);

  return {
    hasSalaryProfile: true,
    salaryProfileId: salaryProfile._id,
    basicSalary: round2(basicSalary),
    workingDaysPerMonth: workingDays,
    workingHoursPerDay: workingHours,
    perDayRate: round2(perDayRate),
    perHourRate: round2(perHourRate),
    absentDeduction: round2(absentDeduction),
    unpaidLeaveDeduction: round2(unpaidLeaveDeduction),
    lateDeduction: round2(lateDeduction),
    overtimeEarning: round2(overtimeEarning),
    totalAttendanceDeduction,
    totalAttendanceEarning,
    netAttendanceImpact: round2(totalAttendanceEarning - totalAttendanceDeduction),
  };
};

/* ===============================
   CREATE / UPSERT ATTENDANCE
================================ */
export const markAttendance = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const built = await buildAttendancePayload(req, { isCreate: true });
    if (!built.ok) return res.status(built.status).json({ message: built.message });

    const payload = built.payload;

    const existing = await Attendance.findOne({
      employee: payload.employee,
      workDate: payload.workDate,
    });

    let attendance;

    if (existing) {
      Object.assign(existing, {
        ...payload,
        updatedBy: req.user?._id || null,
      });

      await existing.save();
      attendance = existing;
    } else {
      attendance = await Attendance.create({
        ...payload,
        createdBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      });
    }

    const full = await populateAttendanceQuery(Attendance.findById(attendance._id)).lean();

    return res.status(existing ? 200 : 201).json({
      message: existing ? "Attendance updated." : "Attendance marked.",
      attendance: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in markAttendance.",
      error: err.message,
    });
  }
};

/* ===============================
   BULK MANUAL ATTENDANCE
================================ */
export const bulkMarkAttendance = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const rows = Array.isArray(req.body.items) ? req.body.items : [];
    if (!rows.length) {
      return res.status(400).json({ message: "items array is required." });
    }

    const results = [];

    for (const row of rows) {
      const fakeReq = { ...req, body: row };
      const built = await buildAttendancePayload(fakeReq, { isCreate: true });

      if (!built.ok) {
        results.push({
          success: false,
          employee: row.employee || row.employeeId || null,
          message: built.message,
        });
        continue;
      }

      try {
        const payload = built.payload;

        const attendance = await Attendance.findOneAndUpdate(
          {
            employee: payload.employee,
            workDate: payload.workDate,
          },
          {
            $set: {
              ...payload,
              updatedBy: req.user?._id || null,
            },
            $setOnInsert: {
              createdBy: req.user?._id || null,
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
          }
        );

        results.push({
          success: true,
          attendanceId: attendance._id,
          employee: attendance.employee,
          workDate: attendance.workDate,
          status: attendance.status,
        });
      } catch (err) {
        results.push({
          success: false,
          employee: row.employee || row.employeeId || null,
          message: err.message,
        });
      }
    }

    return res.json({
      message: "Bulk attendance processed.",
      total: results.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in bulkMarkAttendance.",
      error: err.message,
    });
  }
};

/* ===============================
   LIST ATTENDANCE
================================ */
export const listAttendance = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const limit = parseLimit(req.query.limit);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.employee && isValidObjectId(req.query.employee)) {
      filter.employee = req.query.employee;
    }

    if (req.query.department && isValidObjectId(req.query.department)) {
      filter.department = req.query.department;
    }

    if (req.query.position && isValidObjectId(req.query.position)) {
      filter.position = req.query.position;
    }

    if (req.query.status) {
      filter.status = clean(req.query.status);
    }

    if (req.query.year) {
      filter.year = Number(req.query.year);
    }

    if (req.query.month) {
      filter.month = Number(req.query.month);
    }

    if (req.query.from || req.query.to) {
      filter.workDate = {};
      if (req.query.from) {
        const from = normalizeDateOnly(req.query.from);
        if (from) filter.workDate.$gte = from;
      }
      if (req.query.to) {
        const to = normalizeDateOnly(req.query.to);
        if (to) {
          to.setDate(to.getDate() + 1);
          filter.workDate.$lt = to;
        }
      }
    }

    const [items, total] = await Promise.all([
      populateAttendanceQuery(
        Attendance.find(filter)
          .sort({ workDate: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
      ).lean(),
      Attendance.countDocuments(filter),
    ]);

    return res.json({
      count: items.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      attendance: items,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in listAttendance.",
      error: err.message,
    });
  }
};

/* ===============================
   GET ONE ATTENDANCE
================================ */
export const getAttendanceById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid attendance ID." });
    }

    const attendance = await populateAttendanceQuery(
      Attendance.findById(req.params.id)
    ).lean();

    if (!attendance) {
      return res.status(404).json({ message: "Attendance not found." });
    }

    const isOwner = String(attendance.employee?._id || attendance.employee) === String(req.user?._id);

    if (!isAdminUser(req) && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this attendance." });
    }

    return res.json({ attendance });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getAttendanceById.",
      error: err.message,
    });
  }
};

/* ===============================
   UPDATE ATTENDANCE
================================ */
export const updateAttendance = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid attendance ID." });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance not found." });
    }

    const lockCheck = await checkPeriodLockedForDate(attendance.workDate);
    if (lockCheck.isLocked) {
      return res.status(403).json({ message: lockCheck.message });
    }

    const built = await buildAttendancePayload(req, { isCreate: false });
    if (!built.ok) return res.status(built.status).json({ message: built.message });

    Object.assign(attendance, {
      ...built.payload,
      updatedBy: req.user?._id || null,
    });

    await attendance.save();

    const full = await populateAttendanceQuery(Attendance.findById(attendance._id)).lean();

    return res.json({
      message: "Attendance updated.",
      attendance: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in updateAttendance.",
      error: err.message,
    });
  }
};

/* ===============================
   DELETE ATTENDANCE
================================ */
export const deleteAttendance = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid attendance ID." });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance not found." });
    }

    const lockCheck = await checkPeriodLockedForDate(attendance.workDate);
    if (lockCheck.isLocked) {
      return res.status(403).json({ message: lockCheck.message });
    }

    await attendance.deleteOne();

    return res.json({ message: "Attendance deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deleteAttendance.",
      error: err.message,
    });
  }
};

/* ===============================
   EMPLOYEE MONTHLY SUMMARY
================================ */
export const getEmployeeMonthlyAttendanceSummary = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user?._id;

    if (!isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID." });
    }

    const isOwner = String(employeeId) === String(req.user?._id);
    if (!isAdminUser(req) && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this summary." });
    }

    const range = getMonthRange({
      year: req.query.year,
      month: req.query.month,
    });

    if (!range) {
      return res.status(400).json({ message: "Valid year and month are required." });
    }

    const employee = await loadEmployee(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    await ensureEmployeeAttendanceForRange({
      employee,
      start: range.start,
      end: range.end,
      createdBy: req.user?._id || null,
    });

    const records = await Attendance.find({
      employee: employeeId,
      workDate: { $gte: range.start, $lt: range.end },
    })
      .sort({ workDate: 1 })
      .lean();

    const summary = {
      year: range.year,
      month: range.month,
      totalRecords: records.length,

      presentDays: 0,
      lateDays: 0,
      halfDays: 0,
      absentDays: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      weeklyHolidayDays: 0,
      holidayDays: 0,

      payableDays: 0,
      absentDeductionDays: 0,
      unpaidLeaveDeductionDays: 0,
      lateDeductibleCount: 0,

      totalWorkMinutes: 0,
      totalLateMinutes: 0,
      totalOvertimeMinutes: 0,
      approvedOvertimeMinutes: 0,
      approvedOvertimeHours: 0,
    };

    for (const item of records) {
      if (item.status === "present") summary.presentDays += 1;
      if (item.status === "late") summary.lateDays += 1;
      if (item.status === "half_day") summary.halfDays += 1;
      if (item.status === "absent") summary.absentDays += 1;
      if (item.status === "paid_leave") summary.paidLeaveDays += 1;
      if (item.status === "unpaid_leave") summary.unpaidLeaveDays += 1;
      if (item.status === "weekly_holiday") summary.weeklyHolidayDays += 1;
      if (item.status === "holiday") summary.holidayDays += 1;

      summary.payableDays += Number(item.paidDayValue || 0);
      summary.absentDeductionDays += Number(item.absentDeductionDays || 0);
      summary.unpaidLeaveDeductionDays += Number(item.unpaidLeaveDeductionDays || 0);

      if (item.isLateDeductible) summary.lateDeductibleCount += 1;

      summary.totalWorkMinutes += Number(item.workMinutes || 0);
      summary.totalLateMinutes += Number(item.lateMinutes || 0);
      summary.totalOvertimeMinutes += Number(item.overtimeMinutes || 0);

      if (item.isOvertimeApproved) {
        summary.approvedOvertimeMinutes += Number(item.overtimeMinutes || 0);
      }
    }

    summary.payableDays = round2(summary.payableDays);
    summary.absentDeductionDays = round2(summary.absentDeductionDays);
    summary.unpaidLeaveDeductionDays = round2(summary.unpaidLeaveDeductionDays);
    summary.approvedOvertimeHours = round2(summary.approvedOvertimeMinutes / 60);

    const salaryProfile = await SalaryProfile.findOne({
      employee: employeeId,
      isActive: true,
    }).lean();

    const salaryImpact = calculateSalaryAttendanceImpact({
      salaryProfile,
      summary,
    });

    return res.json({
      employee,
      summary,
      salaryImpact,
      records,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeeMonthlyAttendanceSummary.",
      error: err.message,
    });
  }
};

const weeklyOffMatchesDate = (off, employeeId, date) => {
  if (!off?.isActive) return false;
  if (off.scope === "employee" && String(off.employee?._id || off.employee) !== String(employeeId)) return false;
  const d = normalizeDateOnly(date);
  if (off.offType === "fixed") return (off.fixedDays || []).includes(d.getDay());
  if (off.offType === "custom") return (off.customDates || []).some((item) => dayKey(item.date) === dayKey(d));
  if (off.offType === "rotating" && off.rotationStartDate) {
    const start = normalizeDateOnly(off.rotationStartDate);
    const diff = Math.floor((d - start) / 86400000);
    const cycle = Number(off.rotationCycleDays || 7);
    const pos = ((diff % cycle) + cycle) % cycle;
    return (off.rotationOffDays || []).includes(pos);
  }
  return false;
};

const holidayMatchesEmployee = (holiday, employee, date) => {
  if (!holiday?.isActive || dayKey(holiday.holidayDate) !== dayKey(date)) return false;
  if (holiday.appliesTo === "company") return true;
  if (holiday.appliesTo === "department") return String(holiday.department?._id || holiday.department) === String(employee.department?._id || employee.department);
  if (holiday.appliesTo === "employee") return String(holiday.employee?._id || holiday.employee) === String(employee._id);
  return false;
};

export const ensureEmployeeAttendanceForRange = async ({ employee, employeeId, start, end, createdBy = null }) => {
  const targetEmployee = employee || (await loadEmployee(employeeId));
  if (!targetEmployee || targetEmployee.role !== "employee" || targetEmployee.isActive === false) {
    return { created: 0 };
  }

  const rangeStart = normalizeDateOnly(start);
  const rangeEnd = normalizeDateOnly(end);
  if (!rangeStart || !rangeEnd || rangeEnd <= rangeStart) return { created: 0 };

  const today = normalizeDateOnly(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const effectiveEnd = rangeEnd > tomorrow ? tomorrow : rangeEnd;
  if (effectiveEnd <= rangeStart) return { created: 0 };

  const [existingRecords, weeklyOffs, holidays] = await Promise.all([
    Attendance.find({
      employee: targetEmployee._id,
      workDate: { $gte: rangeStart, $lt: effectiveEnd },
    })
      .select("dayKey workDate")
      .lean(),
    WeeklyOff.find({
      isActive: true,
      $or: [{ scope: "company" }, { employee: targetEmployee._id }],
    }).lean(),
    Holiday.find({
      isActive: true,
      holidayDate: { $gte: rangeStart, $lt: effectiveEnd },
    }).lean(),
  ]);

  const existingKeys = new Set(existingRecords.map((item) => item.dayKey || dayKey(item.workDate)));
  const docs = [];

  for (const date of eachDay({ start: rangeStart, end: effectiveEnd })) {
    const key = dayKey(date);
    if (existingKeys.has(key)) continue;

    const holiday = holidays.find((item) => holidayMatchesEmployee(item, targetEmployee, date));
    const weeklyOff = weeklyOffs.find((item) => weeklyOffMatchesDate(item, targetEmployee._id, date));
    const status = holiday
      ? holiday.holidayType === "unpaid"
        ? "unpaid_leave"
        : "holiday"
      : weeklyOff
        ? weeklyOff.paid === false
          ? "unpaid_leave"
          : "weekly_holiday"
        : "absent";

    docs.push({
      employee: targetEmployee._id,
      department: targetEmployee.department || null,
      position: targetEmployee.position || null,
      workDate: date,
      status,
      source: "manual",
      note: holiday
        ? `Auto marked from holiday setup: ${holiday.name || "Holiday"}`
        : weeklyOff
          ? `Auto marked from weekly off setup: ${weeklyOff.name || "Weekly off"}`
          : "Auto marked absent because no attendance or approved leave was recorded.",
      createdBy,
      updatedBy: createdBy,
    });
  }

  if (!docs.length) return { created: 0 };

  try {
    const inserted = await Attendance.insertMany(docs, { ordered: false });
    return { created: inserted.length };
  } catch (error) {
    if (error?.code === 11000 || error?.writeErrors?.length) {
      return { created: Math.max(0, docs.length - (error.writeErrors?.length || 0)) };
    }
    throw error;
  }
};
