import mongoose from "mongoose";
import User from "../../models/user.model.js";
import Attendance from "../../models/attendance.model.js";
import Shift from "../../models/shift.model.js";
import RosterAssignment from "../../models/rosterAssignment.model.js";
import WeeklyOff from "../../models/weeklyOff.model.js";
import Holiday from "../../models/holiday.model.js";

const clean = (value) => String(value ?? "").trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const requireAdmin = (req, res) => {
  const permissions = req.user?.permissionGroup?.permissions || [];
  const canManage =
    ["admin", "superadmin"].includes(req.user?.role) ||
    (req.user?.permissionGroup?.isActive !== false &&
      (permissions.includes("roster:manage") || permissions.includes("leaves:manage")));
  if (!canManage) {
    res.status(403).json({ message: "You do not have permission to manage roster or leave setup." });
    return false;
  }
  return true;
};

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

const monthRange = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  start.setHours(0, 0, 0, 0);
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

const timeToMinutes = (time) => {
  const [h, m] = String(time || "00:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const diffMinutes = (start, end) => {
  const s = timeToMinutes(start);
  let e = timeToMinutes(end);
  if (e < s) e += 24 * 60;
  return e - s;
};

const employeePopulate = [
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
];

const rosterPopulate = [
  { path: "employee", select: "name email employeeId department position avatarUrl", populate: employeePopulate },
  { path: "shift" },
];

const weeklyOffPopulate = [
  { path: "employee", select: "name email employeeId department position", populate: employeePopulate },
];

const holidayPopulate = [
  { path: "department", select: "name" },
  { path: "employee", select: "name email employeeId" },
];

const loadEmployee = async (employeeId) => {
  if (!isValidObjectId(employeeId)) return null;
  return User.findById(employeeId).select("name email role isActive department position").lean();
};

const validateEmployee = async (employeeId) => {
  const employee = await loadEmployee(employeeId);
  if (!employee) return { ok: false, status: 404, message: "Employee not found." };
  if (employee.role !== "employee") {
    return { ok: false, status: 400, message: "Roster can only be assigned to employee users." };
  }
  return { ok: true, employee };
};

export const getMyRoster = async (req, res) => {
  try {
    const employeeId = req.user?._id;
    const [assignments, weeklyOffs, holidays] = await Promise.all([
      RosterAssignment.find({ employee: employeeId, isActive: true }).populate("shift").sort({ startDate: -1 }).lean(),
      WeeklyOff.find({ isActive: true, $or: [{ scope: "company" }, { employee: employeeId }] }).sort({ createdAt: -1 }).lean(),
      Holiday.find({ isActive: true, $or: [{ appliesTo: "company" }, { employee: employeeId }] }).sort({ holidayDate: 1 }).lean(),
    ]);
    return res.json({ assignments, weeklyOffs, holidays });
  } catch (err) {
    return res.status(500).json({ message: "Server error in getMyRoster.", error: err.message });
  }
};

const buildShiftPayload = (body = {}) => ({
  name: clean(body.name),
  startTime: clean(body.startTime || "09:00"),
  endTime: clean(body.endTime || "18:00"),
  breakMinutes: Number(body.breakMinutes || 0),
  graceMinutes: Number(body.graceMinutes || 0),
  overtimeAfterMinutes: Number(body.overtimeAfterMinutes || 0),
  isActive: body.isActive !== false,
  note: clean(body.note),
});

export const listShifts = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const shifts = await Shift.find({}).sort({ isActive: -1, nameLower: 1 }).lean();
  return res.json({ shifts });
};

export const createShift = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const payload = buildShiftPayload(req.body);
    if (!payload.name) return res.status(400).json({ message: "Shift name is required." });
    const shift = await Shift.create({ ...payload, createdBy: req.user?._id, updatedBy: req.user?._id });
    return res.status(201).json({ message: "Shift created.", shift });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "Shift already exists." });
    return res.status(500).json({ message: "Server error in createShift.", error: err.message });
  }
};

export const updateShift = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const payload = buildShiftPayload(req.body);
    if (!payload.name) return res.status(400).json({ message: "Shift name is required." });
    const shift = await Shift.findByIdAndUpdate(req.params.id, { ...payload, updatedBy: req.user?._id }, { new: true, runValidators: true });
    if (!shift) return res.status(404).json({ message: "Shift not found." });
    return res.json({ message: "Shift updated.", shift });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "Shift already exists." });
    return res.status(500).json({ message: "Server error in updateShift.", error: err.message });
  }
};

export const deleteShift = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const used = await RosterAssignment.exists({ shift: req.params.id });
  if (used) return res.status(400).json({ message: "This shift is used in roster assignments. Deactivate it instead." });
  const shift = await Shift.findByIdAndDelete(req.params.id);
  if (!shift) return res.status(404).json({ message: "Shift not found." });
  return res.json({ message: "Shift deleted." });
};

const buildAssignmentPayload = async (req, { isCreate = false } = {}) => {
  const employeeId = clean(req.body.employee || req.body.employeeId);
  if (isCreate && !employeeId) return { ok: false, status: 400, message: "Employee is required." };

  const payload = {};
  if (employeeId) {
    const checked = await validateEmployee(employeeId);
    if (!checked.ok) return checked;
    payload.employee = checked.employee._id;
  }

  if (req.body.shift !== undefined || isCreate) {
    if (!isValidObjectId(req.body.shift)) return { ok: false, status: 400, message: "Shift is required." };
    const shift = await Shift.exists({ _id: req.body.shift });
    if (!shift) return { ok: false, status: 404, message: "Shift not found." };
    payload.shift = req.body.shift;
  }

  if (req.body.rosterType !== undefined || isCreate) payload.rosterType = clean(req.body.rosterType || "weekly");
  if (req.body.startDate !== undefined || isCreate) {
    payload.startDate = normalizeDateOnly(req.body.startDate);
    if (!payload.startDate) return { ok: false, status: 400, message: "Invalid start date." };
  }
  if (req.body.endDate !== undefined) payload.endDate = req.body.endDate ? normalizeDateOnly(req.body.endDate) : null;
  if (Array.isArray(req.body.weekdays)) payload.weekdays = req.body.weekdays.map(Number);
  if (Array.isArray(req.body.monthDays)) payload.monthDays = req.body.monthDays.map(Number);
  if (typeof req.body.isActive === "boolean") payload.isActive = req.body.isActive;
  if (req.body.note !== undefined) payload.note = clean(req.body.note);

  return { ok: true, payload };
};

export const listRosterAssignments = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const filter = {};
  if (req.query.employee && isValidObjectId(req.query.employee)) filter.employee = req.query.employee;
  if (req.query.shift && isValidObjectId(req.query.shift)) filter.shift = req.query.shift;
  if (req.query.active === "true") filter.isActive = true;
  if (req.query.active === "false") filter.isActive = false;
  const assignments = await RosterAssignment.find(filter).populate(rosterPopulate).sort({ startDate: -1, createdAt: -1 }).lean();
  return res.json({ rosterAssignments: assignments });
};

export const createRosterAssignment = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const built = await buildAssignmentPayload(req, { isCreate: true });
    if (!built.ok) return res.status(built.status).json({ message: built.message });
    const rosterAssignment = await RosterAssignment.create({ ...built.payload, createdBy: req.user?._id, updatedBy: req.user?._id });
    const full = await RosterAssignment.findById(rosterAssignment._id).populate(rosterPopulate).lean();
    return res.status(201).json({ message: "Roster assigned.", rosterAssignment: full });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createRosterAssignment.", error: err.message });
  }
};

export const updateRosterAssignment = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const built = await buildAssignmentPayload(req);
    if (!built.ok) return res.status(built.status).json({ message: built.message });
    const rosterAssignment = await RosterAssignment.findByIdAndUpdate(req.params.id, { ...built.payload, updatedBy: req.user?._id }, { new: true, runValidators: true }).populate(rosterPopulate);
    if (!rosterAssignment) return res.status(404).json({ message: "Roster assignment not found." });
    return res.json({ message: "Roster assignment updated.", rosterAssignment });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateRosterAssignment.", error: err.message });
  }
};

export const deleteRosterAssignment = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const item = await RosterAssignment.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Roster assignment not found." });
  return res.json({ message: "Roster assignment deleted." });
};

export const listWeeklyOffs = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const weeklyOffs = await WeeklyOff.find({}).populate(weeklyOffPopulate).sort({ isActive: -1, createdAt: -1 }).lean();
  return res.json({ weeklyOffs });
};

export const createWeeklyOff = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const payload = {
      name: clean(req.body.name),
      scope: clean(req.body.scope || "company"),
      employee: req.body.employee || null,
      offType: clean(req.body.offType || "fixed"),
      fixedDays: Array.isArray(req.body.fixedDays) ? req.body.fixedDays.map(Number) : [],
      customDates: Array.isArray(req.body.customDates) ? req.body.customDates : [],
      rotationStartDate: req.body.rotationStartDate || null,
      rotationCycleDays: Number(req.body.rotationCycleDays || 7),
      rotationOffDays: Array.isArray(req.body.rotationOffDays) ? req.body.rotationOffDays.map(Number) : [],
      paid: req.body.paid !== false,
      isActive: req.body.isActive !== false,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    };
    if (payload.scope === "employee" && !payload.employee) return res.status(400).json({ message: "Employee is required for employee weekly off." });
    const weeklyOff = await WeeklyOff.create(payload);
    const full = await WeeklyOff.findById(weeklyOff._id).populate(weeklyOffPopulate).lean();
    return res.status(201).json({ message: "Weekly off setup created.", weeklyOff: full });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createWeeklyOff.", error: err.message });
  }
};

export const updateWeeklyOff = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const patch = { ...req.body, updatedBy: req.user?._id };
    const weeklyOff = await WeeklyOff.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true }).populate(weeklyOffPopulate);
    if (!weeklyOff) return res.status(404).json({ message: "Weekly off setup not found." });
    return res.json({ message: "Weekly off setup updated.", weeklyOff });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateWeeklyOff.", error: err.message });
  }
};

export const deleteWeeklyOff = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const item = await WeeklyOff.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Weekly off setup not found." });
  return res.json({ message: "Weekly off setup deleted." });
};

export const listHolidays = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const filter = {};
  if (req.query.year) {
    const start = new Date(Number(req.query.year), 0, 1);
    const end = new Date(Number(req.query.year) + 1, 0, 1);
    filter.holidayDate = { $gte: start, $lt: end };
  }
  const holidays = await Holiday.find(filter).populate(holidayPopulate).sort({ holidayDate: 1 }).lean();
  return res.json({ holidays });
};

export const createHoliday = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const dates = Array.isArray(req.body.holidayDates)
      ? req.body.holidayDates
      : Array.isArray(req.body.dates)
        ? req.body.dates
        : [req.body.holidayDate];
    const cleanDates = [...new Set(dates.map((date) => clean(date)).filter(Boolean))];

    if (!cleanDates.length) return res.status(400).json({ message: "At least one holiday date is required." });

    const payloads = cleanDates.map((holidayDate) => ({
      name: clean(req.body.name),
      holidayDate,
      holidayType: clean(req.body.holidayType || "paid"),
      appliesTo: clean(req.body.appliesTo || "company"),
      department: req.body.appliesTo === "department" ? req.body.department || null : null,
      employee: req.body.appliesTo === "employee" ? req.body.employee || null : null,
      isActive: req.body.isActive !== false,
      note: clean(req.body.note),
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    }));

    const holidays = await Holiday.insertMany(payloads, { ordered: false });
    const full = await Holiday.find({ _id: { $in: holidays.map((item) => item._id) } }).populate(holidayPopulate).sort({ holidayDate: 1 }).lean();
    return res.status(201).json({
      message: full.length === 1 ? "Holiday created." : `${full.length} holidays created.`,
      holiday: full[0] || null,
      holidays: full,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error in createHoliday.", error: err.message });
  }
};

export const updateHoliday = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const holiday = await Holiday.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user?._id }, { new: true, runValidators: true }).populate(holidayPopulate);
    if (!holiday) return res.status(404).json({ message: "Holiday not found." });
    return res.json({ message: "Holiday updated.", holiday });
  } catch (err) {
    return res.status(500).json({ message: "Server error in updateHoliday.", error: err.message });
  }
};

export const deleteHoliday = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const holiday = await Holiday.findByIdAndDelete(req.params.id);
  if (!holiday) return res.status(404).json({ message: "Holiday not found." });
  return res.json({ message: "Holiday deleted." });
};

const assignmentMatchesDate = (assignment, date) => {
  if (!assignment?.shift) return false;
  const d = normalizeDateOnly(date);
  const start = normalizeDateOnly(assignment.startDate);
  const end = assignment.endDate ? normalizeDateOnly(assignment.endDate) : null;
  if (d < start || (end && d > end)) return false;
  if (assignment.rosterType === "daily") return true;
  if (assignment.rosterType === "weekly") return (assignment.weekdays || []).includes(d.getDay());
  if (assignment.rosterType === "monthly") return (assignment.monthDays || []).includes(d.getDate());
  return false;
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

export const calculateRosterAttendance = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const employeeId = clean(req.body.employee || req.body.employeeId);
  const workDate = normalizeDateOnly(req.body.workDate);
  if (!employeeId || !workDate) return res.status(400).json({ message: "Employee and workDate are required." });

  const checked = await validateEmployee(employeeId);
  if (!checked.ok) return res.status(checked.status).json({ message: checked.message });

  const assignments = await RosterAssignment.find({ employee: employeeId, isActive: true }).populate("shift").lean();
  const assignment = assignments.find((item) => assignmentMatchesDate(item, workDate));
  if (!assignment?.shift) return res.status(404).json({ message: "No shift roster found for this date." });

  const shift = assignment.shift;
  const checkIn = clean(req.body.checkIn);
  const checkOut = clean(req.body.checkOut);
  const scheduledMinutes = Math.max(0, diffMinutes(shift.startTime, shift.endTime) - Number(shift.breakMinutes || 0));
  const workMinutes = checkIn && checkOut ? Math.max(0, diffMinutes(checkIn, checkOut) - Number(shift.breakMinutes || 0)) : 0;
  const lateMinutes = checkIn ? Math.max(0, timeToMinutes(checkIn) - (timeToMinutes(shift.startTime) + Number(shift.graceMinutes || 0))) : 0;
  const earlyLeaveMinutes = checkOut ? Math.max(0, timeToMinutes(shift.endTime) - timeToMinutes(checkOut)) : 0;
  const overtimeMinutes = checkOut ? Math.max(0, timeToMinutes(checkOut) - timeToMinutes(shift.endTime) - Number(shift.overtimeAfterMinutes || 0)) : 0;
  const status = !checkIn && !checkOut ? "absent" : lateMinutes > 0 ? "late" : "present";

  return res.json({
    shift,
    scheduledMinutes,
    workMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    status,
    payrollIntegration: {
      lateDeduction: lateMinutes > 0,
      absentDeduction: status === "absent",
      overtimePayment: overtimeMinutes > 0,
      unpaidLeaveDeduction: status === "unpaid_leave",
    },
  });
};

export const getMonthlyRosterReport = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const range = monthRange(req.query.year || new Date().getFullYear(), req.query.month || new Date().getMonth() + 1);
  if (!range) return res.status(400).json({ message: "Invalid year or month." });

  const employeeFilter = { role: "employee" };
  if (req.query.employee && isValidObjectId(req.query.employee)) employeeFilter._id = req.query.employee;
  const employees = await User.find(employeeFilter).select("name email employeeId department position avatarUrl").populate(employeePopulate).sort({ name: 1 }).lean();
  const employeeIds = employees.map((e) => e._id);

  const [assignments, weeklyOffs, holidays, attendance] = await Promise.all([
    RosterAssignment.find({ employee: { $in: employeeIds }, isActive: true, startDate: { $lt: range.end }, $or: [{ endDate: null }, { endDate: { $gte: range.start } }] }).populate("shift").lean(),
    WeeklyOff.find({ isActive: true, $or: [{ scope: "company" }, { employee: { $in: employeeIds } }] }).lean(),
    Holiday.find({ isActive: true, holidayDate: { $gte: range.start, $lt: range.end } }).lean(),
    Attendance.find({ employee: { $in: employeeIds }, workDate: { $gte: range.start, $lt: range.end } }).lean(),
  ]);

  const attendanceMap = new Map(attendance.map((item) => [`${item.employee}-${item.dayKey}`, item]));
  const days = eachDay(range);

  const rows = employees.map((employee) => {
    const employeeAssignments = assignments.filter((item) => String(item.employee) === String(employee._id));
    const schedule = days.map((date) => {
      const roster = employeeAssignments.find((item) => assignmentMatchesDate(item, date));
      const off = weeklyOffs.find((item) => weeklyOffMatchesDate(item, employee._id, date));
      const holiday = holidays.find((item) => holidayMatchesEmployee(item, employee, date));
      const att = attendanceMap.get(`${employee._id}-${dayKey(date)}`) || null;
      return {
        date: dayKey(date),
        shift: roster?.shift || null,
        weeklyOff: off || null,
        holiday: holiday || null,
        expectedStatus: holiday ? "holiday" : off ? "weekly_holiday" : roster?.shift ? "working_day" : "unassigned",
        attendance: att,
      };
    });

    const workingDays = schedule.filter((item) => item.expectedStatus === "working_day").length;
    const attendedDays = schedule.filter((item) => item.attendance && ["present", "late", "half_day"].includes(item.attendance.status)).length;
    const lateDays = schedule.filter((item) => item.attendance?.status === "late").length;
    const absentDays = schedule.filter((item) => item.expectedStatus === "working_day" && (!item.attendance || item.attendance.status === "absent")).length;

    return { employee, workingDays, attendedDays, lateDays, absentDays, schedule };
  });

  return res.json({
    year: range.year,
    month: range.month,
    rows,
    summary: {
      employees: rows.length,
      workingDays: rows.reduce((sum, row) => sum + row.workingDays, 0),
      attendedDays: rows.reduce((sum, row) => sum + row.attendedDays, 0),
      lateDays: rows.reduce((sum, row) => sum + row.lateDays, 0),
      absentDays: rows.reduce((sum, row) => sum + row.absentDays, 0),
    },
  });
};

export const getEmployeeRosterSummaryForPayroll = async ({ employee, employeeId, year, month }) => {
  const range = monthRange(year, month);
  if (!range) return null;

  const targetEmployee =
    employee ||
    (await User.findById(employeeId)
      .select("name email employeeId department position avatarUrl")
      .populate(employeePopulate)
      .lean());

  if (!targetEmployee) return null;

  const [assignments, weeklyOffs, holidays, attendance] = await Promise.all([
    RosterAssignment.find({
      employee: targetEmployee._id,
      isActive: true,
      startDate: { $lt: range.end },
      $or: [{ endDate: null }, { endDate: { $gte: range.start } }],
    })
      .populate("shift")
      .lean(),
    WeeklyOff.find({
      isActive: true,
      $or: [{ scope: "company" }, { employee: targetEmployee._id }],
    }).lean(),
    Holiday.find({
      isActive: true,
      holidayDate: { $gte: range.start, $lt: range.end },
    }).lean(),
    Attendance.find({
      employee: targetEmployee._id,
      workDate: { $gte: range.start, $lt: range.end },
    }).lean(),
  ]);

  const attendanceMap = new Map(attendance.map((item) => [`${item.employee}-${dayKey(item.workDate)}`, item]));
  const days = eachDay(range);

  const schedule = days.map((date) => {
    const roster = assignments.find((item) => assignmentMatchesDate(item, date));
    const off = weeklyOffs.find((item) => weeklyOffMatchesDate(item, targetEmployee._id, date));
    const holiday = holidays.find((item) => holidayMatchesEmployee(item, targetEmployee, date));
    const att = attendanceMap.get(`${targetEmployee._id}-${dayKey(date)}`) || null;
    return {
      date: dayKey(date),
      shift: roster?.shift
        ? {
            _id: roster.shift._id,
            name: roster.shift.name,
            startTime: roster.shift.startTime,
            endTime: roster.shift.endTime,
            graceMinutes: roster.shift.graceMinutes,
          }
        : null,
      expectedStatus: holiday ? "holiday" : off ? "weekly_holiday" : roster?.shift ? "working_day" : "unassigned",
      attendanceStatus: att?.status || "",
      lateMinutes: Number(att?.lateMinutes || 0),
      overtimeMinutes: Number(att?.overtimeMinutes || 0),
    };
  });

  const workingDays = schedule.filter((item) => item.expectedStatus === "working_day").length;
  const rosteredDays = schedule.filter((item) => item.shift).length;
  const weeklyOffDays = schedule.filter((item) => item.expectedStatus === "weekly_holiday").length;
  const holidayDays = schedule.filter((item) => item.expectedStatus === "holiday").length;
  const attendedDays = schedule.filter((item) => ["present", "late", "half_day"].includes(item.attendanceStatus)).length;
  const rosterAbsentDays = schedule.filter(
    (item) => item.expectedStatus === "working_day" && (!item.attendanceStatus || item.attendanceStatus === "absent")
  ).length;
  const lateDays = schedule.filter((item) => item.attendanceStatus === "late").length;

  return {
    year: range.year,
    month: range.month,
    rosteredDays,
    workingDays,
    weeklyOffDays,
    holidayDays,
    attendedDays,
    rosterAbsentDays,
    lateDays,
    schedule,
  };
};
