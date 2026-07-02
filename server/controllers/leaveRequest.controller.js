import mongoose from "mongoose";
import LeaveRequest from "../models/leaveRequest.model.js";
import User from "../models/user.model.js";
import Attendance from "../models/attendance.model.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const clean = (value) => String(value ?? "").trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const normalizeDateOnly = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const dayKey = (date) => {
  const d = normalizeDateOnly(date);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const countDaysInclusive = (startDate, endDate) => {
  const ms = endDate.getTime() - startDate.getTime();
  return Math.floor(ms / 86400000) + 1;
};

const eachDateInclusive = (startDate, endDate) => {
  const dates = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const populateLeave = (query) =>
  query.populate([
    { path: "employee", select: "name email employeeId avatarUrl department position leaveEntitlement leaveTemplate leavePolicy", populate: [
      { path: "department", select: "name" },
      { path: "position", select: "title" },
      { path: "leaveTemplate", select: "name year paidDays unpaidDays unpaidCharge isActive" },
    ] },
    { path: "department", select: "name" },
    { path: "position", select: "title" },
    { path: "requestedBy", select: "name email role" },
    { path: "reviewedBy", select: "name email role" },
  ]);

const loadActiveEmployee = async (employeeId) => {
  if (!isValidObjectId(employeeId)) return null;
  return User.findOne({ _id: employeeId, role: "employee", isActive: true })
    .select("name email role isActive department position leaveEntitlement leaveTemplate leavePolicy")
    .lean();
};

const getApprovedUsedDays = async ({ employeeId, year, leaveType, exceptId = null }) => {
  const match = {
    employee: new mongoose.Types.ObjectId(String(employeeId)),
    year,
    leaveType,
    status: "approved",
  };
  if (exceptId) match._id = { $ne: new mongoose.Types.ObjectId(String(exceptId)) };

  const rows = await LeaveRequest.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$totalDays" } } },
  ]);
  return Number(rows?.[0]?.total || 0);
};

const assertLeaveEntitlement = async ({ employee, year, leaveType, totalDays, exceptId }) => {
  const entitlement = employee.leaveEntitlement || {};
  const entitlementYear = Number(entitlement.year || year);
  const allowedDays = leaveType === "paid"
    ? Number(entitlement.paidDays || 0)
    : Number(entitlement.unpaidDays || 0);
  const label = leaveType === "paid" ? "paid" : "unpaid";

  if (entitlementYear !== year) {
    return { ok: false, message: `No ${label} leave entitlement is set for ${year}.` };
  }

  const used = await getApprovedUsedDays({ employeeId: employee._id, year, leaveType, exceptId });
  const remaining = allowedDays - used;
  if (totalDays > remaining) {
    return { ok: false, message: `${label} leave exceeds remaining balance. Remaining ${label} leave: ${Math.max(0, remaining)} day(s).` };
  }
  return { ok: true };
};

const buildLeavePayload = ({ body, employee, requesterId }) => {
  const leaveType = clean(body.leaveType || "paid").toLowerCase();
  if (!["paid", "unpaid"].includes(leaveType)) {
    return { ok: false, status: 400, message: "Leave type must be paid or unpaid." };
  }

  const startDate = normalizeDateOnly(body.startDate);
  const endDate = normalizeDateOnly(body.endDate);
  if (!startDate || !endDate) return { ok: false, status: 400, message: "Start date and end date are required." };
  if (endDate.getTime() < startDate.getTime()) return { ok: false, status: 400, message: "End date cannot be before start date." };

  const totalDays = countDaysInclusive(startDate, endDate);
  const reason = clean(body.reason);
  if (!reason) return { ok: false, status: 400, message: "Reason is required." };

  return {
    ok: true,
    payload: {
      employee: employee._id,
      department: employee.department || null,
      position: employee.position || null,
      leaveType,
      startDate,
      endDate,
      year: startDate.getFullYear(),
      totalDays,
      reason,
      requestedBy: requesterId,
    },
  };
};

const applyLeaveAttendance = async ({ leave, reviewerId }) => {
  const employee = await User.findById(leave.employee).select("department position").lean();
  const dates = eachDateInclusive(leave.startDate, leave.endDate);
  const status = leave.leaveType === "paid" ? "paid_leave" : "unpaid_leave";
  const note = `Approved ${leave.leaveType} leave request: ${leave.reason}`;

  for (const workDate of dates) {
    let attendance = await Attendance.findOne({ employee: leave.employee, dayKey: dayKey(workDate) });
    if (!attendance) {
      attendance = new Attendance({
        employee: leave.employee,
        workDate,
        createdBy: reviewerId,
      });
    }
    attendance.department = employee?.department || leave.department || null;
    attendance.position = employee?.position || leave.position || null;
    attendance.workDate = workDate;
    attendance.status = status;
    attendance.source = "manual";
    attendance.note = note;
    attendance.updatedBy = reviewerId;
    await attendance.save();
  }
};

export const listLeaveRequests = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = parseLimit(req.query.limit);
    const filter = {};

    if (req.query.status) filter.status = clean(req.query.status);
    if (req.query.leaveType) filter.leaveType = clean(req.query.leaveType);
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.employee && isValidObjectId(req.query.employee)) filter.employee = req.query.employee;

    const [items, total] = await Promise.all([
      populateLeave(LeaveRequest.find(filter))
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LeaveRequest.countDocuments(filter),
    ]);

    return res.json({ leaveRequests: items, pageInfo: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load leave requests.", error: error.message });
  }
};

export const getMyLeaveRequests = async (req, res) => {
  try {
    const year = Number(req.query.year || new Date().getFullYear());
    const items = await populateLeave(
      LeaveRequest.find({ employee: req.user._id, ...(year ? { year } : {}) })
    )
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();

    const user = await User.findById(req.user._id)
      .select("leaveEntitlement leaveTemplate leavePolicy department position")
      .populate([
        { path: "leaveTemplate", select: "name description year paidDays unpaidDays unpaidCharge isActive departments positions" },
        { path: "department", select: "name" },
        { path: "position", select: "title" },
      ])
      .lean();
    const [paidUsed, unpaidUsed] = await Promise.all([
      getApprovedUsedDays({ employeeId: req.user._id, year, leaveType: "paid" }),
      getApprovedUsedDays({ employeeId: req.user._id, year, leaveType: "unpaid" }),
    ]);

    return res.json({
      leaveRequests: items,
      balance: {
        year,
        entitlement: user?.leaveEntitlement || { year, paidDays: 0, unpaidDays: 0 },
        template: user?.leaveTemplate || null,
        leavePolicy: user?.leavePolicy || null,
        department: user?.department || null,
        position: user?.position || null,
        paidUsed,
        unpaidUsed,
        paidRemaining: Math.max(0, Number(user?.leaveEntitlement?.paidDays || 0) - paidUsed),
        unpaidRemaining: Math.max(0, Number(user?.leaveEntitlement?.unpaidDays || 0) - unpaidUsed),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load your leaves.", error: error.message });
  }
};

export const createMyLeaveRequest = async (req, res) => {
  try {
    const employee = await loadActiveEmployee(req.user._id);
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    const built = buildLeavePayload({ body: req.body, employee, requesterId: req.user._id });
    if (!built.ok) return res.status(built.status).json({ message: built.message });

    const entitlement = await assertLeaveEntitlement({
      employee,
      year: built.payload.year,
      leaveType: built.payload.leaveType,
      totalDays: built.payload.totalDays,
    });
    if (!entitlement.ok) return res.status(400).json({ message: entitlement.message });

    const leaveRequest = await LeaveRequest.create(built.payload);
    const populated = await populateLeave(LeaveRequest.findById(leaveRequest._id)).lean();
    return res.status(201).json({ message: "Leave request submitted.", leaveRequest: populated });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit leave request.", error: error.message });
  }
};

export const reviewLeaveRequest = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Leave request not found." });
    if (leave.status !== "pending") return res.status(400).json({ message: "Only pending leave requests can be reviewed." });

    const status = clean(req.body.status).toLowerCase();
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected." });
    }

    const employee = await loadActiveEmployee(leave.employee);
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    if (status === "approved") {
      const entitlement = await assertLeaveEntitlement({
        employee,
        year: leave.year,
        leaveType: leave.leaveType,
        totalDays: leave.totalDays,
        exceptId: leave._id,
      });
      if (!entitlement.ok) return res.status(400).json({ message: entitlement.message });
    }

    leave.status = status;
    leave.adminNote = clean(req.body.adminNote);
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    if (status === "approved") {
      await applyLeaveAttendance({ leave, reviewerId: req.user._id });
    }

    const populated = await populateLeave(LeaveRequest.findById(leave._id)).lean();
    return res.json({ message: `Leave request ${status}.`, leaveRequest: populated });
  } catch (error) {
    return res.status(500).json({ message: "Failed to review leave request.", error: error.message });
  }
};

export const cancelMyLeaveRequest = async (req, res) => {
  try {
    const leave = await LeaveRequest.findOne({ _id: req.params.id, employee: req.user._id });
    if (!leave) return res.status(404).json({ message: "Leave request not found." });
    if (leave.status !== "pending") return res.status(400).json({ message: "Only pending requests can be cancelled." });
    leave.status = "cancelled";
    await leave.save();
    return res.json({ message: "Leave request cancelled.", leaveRequest: leave });
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel leave request.", error: error.message });
  }
};
