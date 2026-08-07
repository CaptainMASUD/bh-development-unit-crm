import mongoose from "mongoose";
import User from "../models/user.model.js";
import Attendance from "../models/attendance.model.js";
import SalaryProfile from "../models/salaryProfile.model.js";
import Payroll from "../models/payroll.model.js";
import BankAccount from "../models/bankAccount.model.js";
import BankTransaction from "../models/bankTransaction.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import {
  applyPayrollLoanRepayments,
  getEmployeeLoanDeductionsForPayroll,
} from "./employeeLoan.controller.js";
import { getEmployeeRosterSummaryForPayroll } from "./roster.controller.js";
import { ensureEmployeeAttendanceForRange } from "./attendance.controller.js";
import { calculateEmployeeTaxDeduction } from "../services/tax.service.js";
import { createPostedJournal, movementLines, resolveAccountingAccount } from "../services/accountingPosting.service.js";
import { accountingCache } from "../utils/cache.js";
import { runMongoTransaction } from "../utils/mongoTransaction.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const clean = (value) => String(value ?? "").trim();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const isAdminUser = (req) =>
  ["admin", "superadmin"].includes(String(req.user?.role || "")) ||
  (req.user?.permissionGroup?.isActive !== false && req.user?.permissionGroup?.permissions?.includes?.("payroll:manage"));

const requireAdmin = (req, res) => {
  if (!isAdminUser(req)) {
    res.status(403).json({ message: "Only admin or superadmin can manage payroll." });
    return false;
  }

  return true;
};

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const encodeCursor = (doc) =>
  Buffer.from(
    JSON.stringify({
      year: Number(doc.year || 0),
      month: Number(doc.month || 0),
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
      id: String(doc._id || ""),
    })
  ).toString("base64url");

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (!decoded?.id || !isValidObjectId(decoded.id)) return null;
    const createdAt = decoded.createdAt ? new Date(decoded.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
    return {
      year: Number(decoded.year || 0),
      month: Number(decoded.month || 0),
      createdAt,
      id: new mongoose.Types.ObjectId(decoded.id),
    };
  } catch {
    return null;
  }
};

const payrollCursorFilter = (cursor) => {
  if (!cursor) return {};
  return {
    $or: [
      { year: { $lt: cursor.year } },
      { year: cursor.year, month: { $lt: cursor.month } },
      { year: cursor.year, month: cursor.month, createdAt: { $lt: cursor.createdAt } },
      { year: cursor.year, month: cursor.month, createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
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

  return { year: y, month: m, start, end };
};

const PAYROLL_POPULATE = [
  {
    path: "employee",
    select: "name email role isActive avatarUrl department position",
    populate: [
      { path: "department", select: "name isActive" },
      { path: "position", select: "title department isActive" },
    ],
  },
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
  { path: "salaryProfile", select: "salaryType currency basicSalary workingDaysPerMonth workingHoursPerDay isActive" },
  { path: "calculatedBy", select: "name email role" },
  { path: "approvedBy", select: "name email role" },
  { path: "paidBy", select: "name email role" },
  { path: "cancelledBy", select: "name email role" },
  { path: "bankAccount", select: "accountName accountNumber currency accountType", populate: { path: "bank", select: "bankName shortName" } },
  { path: "bankTransaction", select: "reference amount status journalEntry" },
  { path: "accrualJournalEntry", select: "entryNo status date" },
  { path: "paymentJournalEntry", select: "entryNo status date" },
];

const populatePayrollQuery = (query) => query.populate(PAYROLL_POPULATE);

const ensurePayrollAccrual = async ({ payroll, userId, session }) => {
  if (payroll.accrualJournalEntry) return payroll.accrualJournalEntry;
  const expenseAccount = await resolveAccountingAccount("payrollExpenseAccount", "5100");
  const payableAccount = await resolveAccountingAccount("payrollPayableAccount", "2200");
  const amount = roundMoney(payroll.grossSalary || payroll.netPayable || payroll.netSalary);
  if (amount <= 0) throw Object.assign(new Error("Payroll amount must be greater than zero before approval."), { statusCode: 400 });
  const journal = await createPostedJournal({
    date: payroll.periodEnd || new Date(payroll.year, payroll.month, 0),
    sourceType: "payroll",
    sourceId: payroll._id,
    reference: payroll.payrollKey || `PAYROLL-${payroll.year}-${payroll.month}`,
    memo: `Payroll accrual for ${payroll.year}-${String(payroll.month).padStart(2, "0")}`,
    currency: payroll.currency,
    userId,
    session,
    lines: [
      { account: expenseAccount._id, debit: amount, credit: 0, description: "Payroll expense", contactType: "employee", contactId: payroll.employee },
      { account: payableAccount._id, debit: 0, credit: amount, description: "Payroll payable", contactType: "employee", contactId: payroll.employee },
    ],
  });
  payroll.accrualJournalEntry = journal._id;
  return journal._id;
};

const loadEmployee = async (employeeId) => {
  if (!isValidObjectId(employeeId)) return null;

  return User.findById(employeeId)
    .select("name email role isActive department position leavePolicy taxProfile")
    .lean();
};

const getActiveSalaryProfile = async (employeeId) => {
  return SalaryProfile.findOne({
    employee: employeeId,
    isActive: true,
  }).lean();
};

const summarizeAttendance = (records = []) => {
  const summary = {
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

  summary.payableDays = roundMoney(summary.payableDays);
  summary.absentDeductionDays = roundMoney(summary.absentDeductionDays);
  summary.unpaidLeaveDeductionDays = roundMoney(summary.unpaidLeaveDeductionDays);
  summary.approvedOvertimeHours = roundMoney(summary.approvedOvertimeMinutes / 60);

  return summary;
};

const resolveBaseAmount = ({ basedOn, basicSalary, grossSalary, netSalary }) => {
  if (basedOn === "basicSalary") return Number(basicSalary || 0);
  if (basedOn === "grossSalary") return Number(grossSalary || 0);
  if (basedOn === "netSalary") return Number(netSalary || grossSalary || 0);
  return Number(basicSalary || 0);
};

const calculateComponentAmount = (component = {}, context = {}) => {
  const calculationType = clean(component.calculationType || "fixed");
  const value = Number(component.value ?? component.amount ?? 0);
  const quantity = Number(component.quantity || 1);

  if (component.amount !== undefined && calculationType === "variable") {
    return roundMoney(component.amount);
  }

  if (calculationType === "fixed") {
    return roundMoney(value * quantity);
  }

  if (calculationType === "percentage") {
    const base = resolveBaseAmount({
      basedOn: component.basedOn || "basicSalary",
      basicSalary: context.basicSalary,
      grossSalary: context.grossSalary,
      netSalary: context.netSalary,
    });

    return roundMoney((base * value) / 100);
  }

  if (calculationType === "per_day") {
    return roundMoney(value * quantity);
  }

  if (calculationType === "per_hour") {
    return roundMoney(value * quantity);
  }

  if (calculationType === "per_minute") {
    return roundMoney(value * quantity);
  }

  return roundMoney(value);
};

const makePayrollComponent = ({
  name,
  type,
  source,
  calculationType = "fixed",
  value = 0,
  quantity = 1,
  basedOn = "manual",
  amount = 0,
  note = "",
  refModel = "",
  refId = null,
  meta = {},
}) => ({
  name,
  type,
  source,
  calculationType,
  value: roundMoney(value),
  quantity: Number(quantity || 1),
  basedOn,
  amount: roundMoney(amount),
  refModel,
  refId,
  meta,
  note,
});

const normalizeManualComponent = (item = {}, type) => {
  const calculationType = clean(item.calculationType || "fixed");
  const value = Number(item.value ?? item.amount ?? 0);
  const quantity = Number(item.quantity || 1);

  return {
    name: clean(item.name || (type === "earning" ? "Manual Earning" : "Manual Deduction")),
    type,
    source: "manual",
    calculationType,
    value,
    quantity,
    basedOn: clean(item.basedOn || "manual"),
    amount: item.amount !== undefined ? roundMoney(item.amount) : undefined,
    isTaxable: item.isTaxable === true,
    note: clean(item.note),
  };
};

const calculateAttendanceMoney = ({ employee, salaryProfile, summary, grossSalary }) => {
  const basicSalary = Number(salaryProfile.basicSalary || 0);
  const workingDays = Number(salaryProfile.workingDaysPerMonth || 26);
  const workingHours = Number(salaryProfile.workingHoursPerDay || 8);

  const perDayRate = workingDays > 0 ? basicSalary / workingDays : 0;
  const perHourRate = workingHours > 0 ? perDayRate / workingHours : 0;

  const rules = salaryProfile.rules || {};

  const earnings = [];
  const deductions = [];

  if (rules.overtime?.enabled) {
    const rule = rules.overtime || {};
    const type = rule.calculationType || "per_hour";
    const overtimeHours = Number(summary.approvedOvertimeHours || 0);
    let amount = 0;

    if (type === "per_hour") {
      amount = overtimeHours * Number(rule.value || 0);
    } else if (type === "fixed") {
      amount = overtimeHours * Number(rule.value || 0);
    } else if (type === "percentage") {
      amount = overtimeHours * perHourRate * (Number(rule.value || 0) / 100);
    }

    if (amount > 0) {
      earnings.push(
        makePayrollComponent({
          name: "Overtime",
          type: "earning",
          source: "attendance",
          calculationType: type,
          value: Number(rule.value || 0),
          quantity: overtimeHours,
          basedOn: rule.basedOn || "basicSalary",
          amount,
          note: "Approved overtime from attendance.",
        })
      );
    }
  }

  if (rules.absentDeduction?.enabled !== false) {
    const rule = rules.absentDeduction || {};
    const type = rule.calculationType || "per_day";
    const days = Number(summary.absentDeductionDays || 0);
    let amount = 0;

    if (type === "per_day") {
      amount = days * perDayRate;
    } else if (type === "fixed") {
      amount = days * Number(rule.value || 0);
    } else if (type === "percentage") {
      const base = resolveBaseAmount({
        basedOn: rule.basedOn || "basicSalary",
        basicSalary,
        grossSalary,
      });
      amount = days * ((base * Number(rule.value || 0)) / 100);
    }

    if (amount > 0) {
      deductions.push(
        makePayrollComponent({
          name: "Absent Deduction",
          type: "deduction",
          source: "attendance",
          calculationType: type,
          value: Number(rule.value || 0),
          quantity: days,
          basedOn: rule.basedOn || "basicSalary",
          amount,
          note: "Absent deduction from attendance.",
        })
      );
    }
  }

  if (rules.unpaidLeaveDeduction?.enabled !== false) {
    const rule = employee?.leavePolicy?.unpaidCharge || rules.unpaidLeaveDeduction || {};
    const type = rule.calculationType || "per_day";
    const days = Number(summary.unpaidLeaveDeductionDays || 0);
    let amount = 0;

    if (type === "per_day") {
      amount = days * perDayRate;
    } else if (type === "fixed") {
      amount = days * Number(rule.value || 0);
    } else if (type === "percentage") {
      const base = resolveBaseAmount({
        basedOn: rule.basedOn || "basicSalary",
        basicSalary,
        grossSalary,
      });
      amount = days * ((base * Number(rule.value || 0)) / 100);
    }

    if (amount > 0) {
      deductions.push(
        makePayrollComponent({
          name: "Unpaid Leave Deduction",
          type: "deduction",
          source: "attendance",
          calculationType: type,
          value: Number(rule.value || 0),
          quantity: days,
          basedOn: rule.basedOn || "basicSalary",
          amount,
          note: "Unpaid leave deduction from attendance.",
        })
      );
    }
  }

  if (rules.lateDeduction?.enabled) {
    const rule = rules.lateDeduction || {};
    const type = rule.calculationType || "fixed";
    const lateCount = Number(summary.lateDeductibleCount || 0);
    const lateMinutes = Number(summary.totalLateMinutes || 0);
    let amount = 0;
    let quantity = lateCount;

    if (type === "fixed") {
      amount = lateCount * Number(rule.value || 0);
    } else if (type === "per_minute") {
      quantity = lateMinutes;
      amount = lateMinutes * Number(rule.value || 0);
    } else if (type === "percentage") {
      const base = resolveBaseAmount({
        basedOn: rule.basedOn || "basicSalary",
        basicSalary,
        grossSalary,
      });
      amount = lateCount * ((base * Number(rule.value || 0)) / 100);
    }

    if (amount > 0) {
      deductions.push(
        makePayrollComponent({
          name: "Late Deduction",
          type: "deduction",
          source: "attendance",
          calculationType: type,
          value: Number(rule.value || 0),
          quantity,
          basedOn: rule.basedOn || "basicSalary",
          amount,
          note: "Late deduction from attendance.",
        })
      );
    }
  }

  return { earnings, deductions };
};

const buildPayrollPayload = async ({
  employee,
  salaryProfile,
  attendanceRecords,
  year,
  month,
  periodStart,
  periodEnd,
  manualEarnings = [],
  manualDeductions = [],
  note = "",
  requesterId = null,
}) => {
  const basicSalary = roundMoney(salaryProfile.basicSalary || 0);
  const currency = String(salaryProfile.currency || "BDT").toUpperCase();

  const attendanceSummary = summarizeAttendance(attendanceRecords);
  const rosterSummary =
    (await getEmployeeRosterSummaryForPayroll({
      employee,
      year,
      month,
    })) || {};

  const salarySnapshot = {
    salaryType: salaryProfile.salaryType || "monthly",
    currency,
    basicSalary,
    workingDaysPerMonth: Number(salaryProfile.workingDaysPerMonth || 26),
    workingHoursPerDay: Number(salaryProfile.workingHoursPerDay || 8),
    components: salaryProfile.components || [],
    rules: salaryProfile.rules || {},
    taxProfile: salaryProfile.taxProfile || {},
  };

  const earnings = [
    makePayrollComponent({
      name: "Basic Salary",
      type: "earning",
      source: "basic_salary",
      calculationType: "fixed",
      value: basicSalary,
      quantity: 1,
      basedOn: "manual",
      amount: basicSalary,
      note: "Basic salary from active salary profile.",
    }),
  ];

  const deductions = [];

  let runningGross = basicSalary;
  let taxableGross = basicSalary;

  const activeComponents = Array.isArray(salaryProfile.components)
    ? salaryProfile.components.filter((item) => item.isActive !== false)
    : [];

  for (const component of activeComponents.filter((item) => item.type === "earning")) {
    const amount = calculateComponentAmount(component, {
      basicSalary,
      grossSalary: runningGross,
    });

    if (amount > 0) {
      earnings.push(
        makePayrollComponent({
          name: component.name,
          type: "earning",
          source: "salary_profile",
          calculationType: component.calculationType || "fixed",
          value: component.value || 0,
          quantity: 1,
          basedOn: component.basedOn || "basicSalary",
          amount,
          meta: { isTaxable: component.isTaxable === true },
          note: component.note || "",
        })
      );

      runningGross += amount;
      if (component.isTaxable === true) taxableGross += amount;
    }
  }

  const attendanceMoney = calculateAttendanceMoney({
    employee,
    salaryProfile,
    summary: attendanceSummary,
    grossSalary: runningGross,
  });

  for (const item of attendanceMoney.earnings) {
    earnings.push(item);
    runningGross += Number(item.amount || 0);
    taxableGross += Number(item.amount || 0);
  }

  for (const item of manualEarnings.map((x) => normalizeManualComponent(x, "earning"))) {
    const amount =
      item.amount !== undefined
        ? item.amount
        : calculateComponentAmount(item, {
            basicSalary,
            grossSalary: runningGross,
          });

    if (amount > 0) {
      earnings.push(
        makePayrollComponent({
          ...item,
          meta: { isTaxable: item.isTaxable === true },
          amount,
        })
      );

      runningGross += amount;
      if (item.isTaxable === true) taxableGross += amount;
    }
  }

  for (const component of activeComponents.filter((item) => item.type === "deduction")) {
    const amount = calculateComponentAmount(component, {
      basicSalary,
      grossSalary: runningGross,
    });

    if (amount > 0) {
      deductions.push(
        makePayrollComponent({
          name: component.name,
          type: "deduction",
          source: "salary_profile",
          calculationType: component.calculationType || "fixed",
          value: component.value || 0,
          quantity: 1,
          basedOn: component.basedOn || "basicSalary",
          amount,
          note: component.note || "",
        })
      );
    }
  }

  deductions.push(...attendanceMoney.deductions);

  const loanDeductions = await getEmployeeLoanDeductionsForPayroll({
    employeeId: employee._id,
    year,
    month,
  });

  deductions.push(...loanDeductions);

  const taxResult = await calculateEmployeeTaxDeduction({
    employee,
    salaryProfile,
    grossSalary: runningGross,
    taxableGrossSalary: taxableGross,
    year,
    month,
  });
  if (taxResult.component) {
    deductions.push(makePayrollComponent(taxResult.component));
  }

  for (const item of manualDeductions.map((x) => normalizeManualComponent(x, "deduction"))) {
    const amount =
      item.amount !== undefined
        ? item.amount
        : calculateComponentAmount(item, {
            basicSalary,
            grossSalary: runningGross,
          });

    if (amount > 0) {
      deductions.push(
        makePayrollComponent({
          ...item,
          amount,
        })
      );
    }
  }

  return {
    payrollKey: `${String(employee._id)}-${year}-${String(month).padStart(2, "0")}`,
    employee: employee._id,
    department: employee.department || salaryProfile.department || null,
    position: employee.position || salaryProfile.position || null,
    salaryProfile: salaryProfile._id,
    year,
    month,
    periodStart,
    periodEnd,
    currency,
    salarySnapshot,
    attendanceSummary,
    rosterSummary,
    earnings,
    deductions,
    basicSalary,
    status: "calculated",
    note: clean(note),
    calculatedBy: requesterId,
  };
};

const calculateAndSavePayroll = async ({
  employeeId,
  year,
  month,
  manualEarnings = [],
  manualDeductions = [],
  note = "",
  requesterId = null,
  force = false,
}) => {
  const range = getMonthRange({ year, month });
  if (!range) {
    return { ok: false, status: 400, message: "Valid year and month are required." };
  }

  const employee = await loadEmployee(employeeId);
  if (!employee) {
    return { ok: false, status: 404, message: "Employee not found." };
  }

  if (employee.role !== "employee") {
    return {
      ok: false,
      status: 400,
      message: "Payroll can only be generated for employee users.",
    };
  }

  if (!employee.isActive) {
    return {
      ok: false,
      status: 400,
      message: "Cannot generate payroll for inactive employee.",
    };
  }

  const salaryProfile = await getActiveSalaryProfile(employeeId);
  if (!salaryProfile) {
    return {
      ok: false,
      status: 404,
      message: "Active salary profile not found for this employee.",
    };
  }

  await ensureEmployeeAttendanceForRange({
    employee,
    start: range.start,
    end: range.end,
    createdBy: requesterId,
  });

  const attendanceRecords = await Attendance.find({
    employee: employeeId,
    workDate: { $gte: range.start, $lt: range.end },
  })
    .sort({ workDate: 1 })
    .lean();

  const payload = await buildPayrollPayload({
    employee,
    salaryProfile,
    attendanceRecords,
    year: range.year,
    month: range.month,
    periodStart: range.start,
    periodEnd: range.end,
    manualEarnings,
    manualDeductions,
    note,
    requesterId,
  });

  const existing = await Payroll.findOne({
    employee: employeeId,
    year: range.year,
    month: range.month,
  });

  if (existing && ["approved", "paid"].includes(existing.status) && !force) {
    return {
      ok: false,
      status: 400,
      message: "Payroll is already approved/paid. Use force=true to recalculate.",
    };
  }

  let payroll;

  if (existing) {
    Object.assign(existing, {
      ...payload,
      approvedBy: null,
      approvedAt: null,
      paidBy: null,
      paidAt: null,
      paymentDate: null,
      paymentMethod: "",
      transactionRef: "",
      cancelledBy: null,
      cancelledAt: null,
      cancelReason: "",
    });

    await existing.save();
    payroll = existing;
  } else {
    payroll = await Payroll.create(payload);
  }

  const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

  return { ok: true, payroll: full };
};

/* ===============================
   PREVIEW PAYROLL WITHOUT SAVE
================================ */
export const previewPayroll = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const employeeId = clean(req.body.employee || req.body.employeeId);

    if (!isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Valid employee is required." });
    }

    const range = getMonthRange({
      year: req.body.year,
      month: req.body.month,
    });

    if (!range) {
      return res.status(400).json({ message: "Valid year and month are required." });
    }

    const employee = await loadEmployee(employeeId);
    if (!employee) return res.status(404).json({ message: "Employee not found." });

    const salaryProfile = await getActiveSalaryProfile(employeeId);
    if (!salaryProfile) {
      return res.status(404).json({ message: "Active salary profile not found." });
    }

    await ensureEmployeeAttendanceForRange({
      employee,
      start: range.start,
      end: range.end,
      createdBy: req.user?._id || null,
    });

    const attendanceRecords = await Attendance.find({
      employee: employeeId,
      workDate: { $gte: range.start, $lt: range.end },
    })
      .sort({ workDate: 1 })
      .lean();

    const payload = await buildPayrollPayload({
      employee,
      salaryProfile,
      attendanceRecords,
      year: range.year,
      month: range.month,
      periodStart: range.start,
      periodEnd: range.end,
      manualEarnings: Array.isArray(req.body.manualEarnings) ? req.body.manualEarnings : [],
      manualDeductions: Array.isArray(req.body.manualDeductions) ? req.body.manualDeductions : [],
      note: req.body.note,
      requesterId: req.user?._id || null,
    });

    const payroll = new Payroll(payload);
    payroll.recalculateTotals();

    return res.json({
      message: "Payroll preview generated.",
      payroll,
      attendanceRecords,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in previewPayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   CALCULATE SINGLE PAYROLL
================================ */
export const calculatePayroll = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const employeeId = clean(req.body.employee || req.body.employeeId);

    if (!isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Valid employee is required." });
    }

    const result = await calculateAndSavePayroll({
      employeeId,
      year: req.body.year,
      month: req.body.month,
      manualEarnings: Array.isArray(req.body.manualEarnings) ? req.body.manualEarnings : [],
      manualDeductions: Array.isArray(req.body.manualDeductions) ? req.body.manualDeductions : [],
      note: req.body.note,
      requesterId: req.user?._id || null,
      force: req.body.force === true,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(200).json({
      message: "Payroll calculated.",
      payroll: result.payroll,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in calculatePayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   BULK CALCULATE PAYROLL
================================ */
export const calculateBulkPayroll = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const range = getMonthRange({
      year: req.body.year,
      month: req.body.month,
    });

    if (!range) {
      return res.status(400).json({ message: "Valid year and month are required." });
    }

    const filter = {
      role: "employee",
      isActive: true,
    };

    if (Array.isArray(req.body.employeeIds) && req.body.employeeIds.length) {
      filter._id = {
        $in: req.body.employeeIds.filter(isValidObjectId),
      };
    }

    if (req.body.department && isValidObjectId(req.body.department)) {
      filter.department = req.body.department;
    }

    if (req.body.position && isValidObjectId(req.body.position)) {
      filter.position = req.body.position;
    }

    const employees = await User.find(filter)
      .select("_id name email role isActive department position")
      .lean();

    const results = [];

    for (const employee of employees) {
      const result = await calculateAndSavePayroll({
        employeeId: employee._id,
        year: range.year,
        month: range.month,
        manualEarnings: [],
        manualDeductions: [],
        note: req.body.note,
        requesterId: req.user?._id || null,
        force: req.body.force === true,
      });

      results.push({
        employee: employee._id,
        name: employee.name,
        email: employee.email,
        success: result.ok,
        message: result.ok ? "Payroll calculated." : result.message,
        payrollId: result.payroll?._id || null,
      });
    }

    return res.json({
      message: "Bulk payroll calculation completed.",
      total: results.length,
      success: results.filter((item) => item.success).length,
      failed: results.filter((item) => !item.success).length,
      results,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in calculateBulkPayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   LIST PAYROLLS
================================ */
export const listPayrolls = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const limit = parseLimit(req.query.limit);
    const page = Math.max(Number(req.query.page || 1), 1);
    const cursor = decodeCursor(req.query.cursor);
    const skip = cursor ? 0 : (page - 1) * limit;

    const filter = { ...payrollCursorFilter(cursor) };

    if (req.query.employee && isValidObjectId(req.query.employee)) {
      filter.employee = req.query.employee;
    }

    if (req.query.department && isValidObjectId(req.query.department)) {
      filter.department = req.query.department;
    }

    if (req.query.position && isValidObjectId(req.query.position)) {
      filter.position = req.query.position;
    }

    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);
    if (req.query.status) filter.status = clean(req.query.status);

    const [rawPayrolls, total] = await Promise.all([
      populatePayrollQuery(
        Payroll.find(filter)
          .sort({ year: -1, month: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit + 1)
      ).lean(),
      cursor ? Promise.resolve(null) : Payroll.countDocuments(filter),
    ]);

    const hasNextPage = rawPayrolls.length > limit;
    const payrolls = hasNextPage ? rawPayrolls.slice(0, limit) : rawPayrolls;
    const nextCursor = hasNextPage && payrolls.length ? encodeCursor(payrolls[payrolls.length - 1]) : null;

    return res.json({
      count: payrolls.length,
      total: total ?? null,
      page,
      limit,
      totalPages: total === null ? null : Math.ceil(total / limit),
      pageInfo: { page, limit, hasNextPage, nextCursor },
      payrolls,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in listPayrolls.",
      error: err.message,
    });
  }
};

/* ===============================
   GET ONE PAYROLL
================================ */
export const getPayrollById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await populatePayrollQuery(Payroll.findById(req.params.id)).lean();

    if (!payroll) {
      return res.status(404).json({ message: "Payroll not found." });
    }

    const isOwner = String(payroll.employee?._id || payroll.employee) === String(req.user?._id);

    if (!isAdminUser(req) && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this payroll." });
    }

    return res.json({ payroll });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getPayrollById.",
      error: err.message,
    });
  }
};

/* ===============================
   MY PAYROLLS
================================ */
export const getMyPayrolls = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const page = Math.max(Number(req.query.page || 1), 1);
    const cursor = decodeCursor(req.query.cursor);
    const skip = cursor ? 0 : (page - 1) * limit;

    const filter = {
      employee: req.user?._id,
      ...payrollCursorFilter(cursor),
    };

    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);

    const [rawPayrolls, total] = await Promise.all([
      populatePayrollQuery(
        Payroll.find(filter)
          .sort({ year: -1, month: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit + 1)
      ).lean(),
      cursor ? Promise.resolve(null) : Payroll.countDocuments(filter),
    ]);

    const hasNextPage = rawPayrolls.length > limit;
    const payrolls = hasNextPage ? rawPayrolls.slice(0, limit) : rawPayrolls;
    const nextCursor = hasNextPage && payrolls.length ? encodeCursor(payrolls[payrolls.length - 1]) : null;

    return res.json({
      count: payrolls.length,
      total: total ?? null,
      page,
      limit,
      totalPages: total === null ? null : Math.ceil(total / limit),
      pageInfo: { page, limit, hasNextPage, nextCursor },
      payrolls,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getMyPayrolls.",
      error: err.message,
    });
  }
};

/* ===============================
   EMPLOYEE PAYROLLS
================================ */
export const getEmployeePayrolls = async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    if (!isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID." });
    }

    const isOwner = String(employeeId) === String(req.user?._id);

    if (!isAdminUser(req) && !isOwner) {
      return res.status(403).json({ message: "Not authorized to view this payroll." });
    }

    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const filter = { employee: employeeId, ...payrollCursorFilter(cursor) };

    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);

    const rawPayrolls = await populatePayrollQuery(
      Payroll.find(filter).sort({ year: -1, month: -1, createdAt: -1, _id: -1 })
        .limit(limit + 1)
    ).lean();

    const hasNextPage = rawPayrolls.length > limit;
    const payrolls = hasNextPage ? rawPayrolls.slice(0, limit) : rawPayrolls;
    const nextCursor = hasNextPage && payrolls.length ? encodeCursor(payrolls[payrolls.length - 1]) : null;

    return res.json({
      count: payrolls.length,
      pageInfo: { limit, hasNextPage, nextCursor },
      payrolls,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeePayrolls.",
      error: err.message,
    });
  }
};

/* ===============================
   APPROVE PAYROLL
================================ */
export const approvePayroll = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    let payroll;
    await runMongoTransaction(async (session) => {
      payroll = await Payroll.findById(req.params.id).session(session);
      if (!payroll) throw Object.assign(new Error("Payroll not found."), { statusCode: 404 });
      if (payroll.status === "paid") throw Object.assign(new Error("Paid payroll cannot be approved again."), { statusCode: 400 });
      if (payroll.status === "cancelled") throw Object.assign(new Error("Cancelled payroll cannot be approved."), { statusCode: 400 });
      await ensurePayrollAccrual({ payroll, userId: req.user?._id || null, session });
      payroll.status = "approved";
      payroll.approvedBy = req.user?._id || null;
      payroll.approvedAt = new Date();
      await payroll.save({ session });
    });

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: "Payroll approved and accrued to accounting.",
      payroll: full,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: "Server error in approvePayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   MARK PAYROLL PAID
================================ */
export const markPayrollPaid = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    let payroll;
    await runMongoTransaction(async (session) => {
      payroll = await Payroll.findById(req.params.id).session(session);
      if (!payroll) throw Object.assign(new Error("Payroll not found."), { statusCode: 404 });
      if (payroll.status === "cancelled") throw Object.assign(new Error("Cancelled payroll cannot be paid."), { statusCode: 400 });
      if (payroll.status === "paid") throw Object.assign(new Error("Payroll is already paid."), { statusCode: 400 });

      const paymentMethod = clean(req.body.paymentMethod || payroll.paymentMethod || "cash");
      const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
      if (Number.isNaN(paymentDate.getTime())) throw Object.assign(new Error("Valid payment date is required."), { statusCode: 400 });
      const amount = roundMoney(payroll.netPayable || payroll.netSalary);
      if (amount <= 0) throw Object.assign(new Error("Net payroll amount must be greater than zero."), { statusCode: 400 });

      await ensurePayrollAccrual({ payroll, userId: req.user?._id || null, session });
      const payableAccount = await resolveAccountingAccount("payrollPayableAccount", "2200", session);
      let paymentJournal;
      let bankTransaction = null;
      const useBank = ["bank", "mobile_banking", "cheque"].includes(paymentMethod) || Boolean(req.body.bankAccount);

      if (useBank) {
        const bankAccount = await BankAccount.findOne({ _id: req.body.bankAccount, status: "active" })
          .populate("ledgerAccount", "code name type currency isActive isGroup publishedAt")
          .session(session)
          .lean();
        if (!bankAccount?.ledgerAccount?._id) throw Object.assign(new Error("Select an active bank account connected to accounting."), { statusCode: 400 });
        if (String(bankAccount.currency || "").toUpperCase() !== String(payroll.currency || "").toUpperCase()) {
          throw Object.assign(new Error("Payroll and bank account currencies must match."), { statusCode: 409 });
        }
        bankTransaction = new BankTransaction({
          bankAccount: bankAccount._id,
          kind: "withdrawal",
          direction: "out",
          amount,
          transactionDate: paymentDate,
          reference: clean(req.body.transactionRef) || payroll.payrollKey,
          description: `Payroll payment for ${payroll.year}-${String(payroll.month).padStart(2, "0")}`,
          status: "posted",
          sourceType: "payroll",
          sourceId: payroll._id,
          counterpartLedgerAccount: payableAccount._id,
          createdBy: req.user?._id || null,
          updatedBy: req.user?._id || null,
        });
        paymentJournal = await createPostedJournal({
          date: paymentDate,
          sourceType: "payroll",
          sourceId: payroll._id,
          reference: bankTransaction.reference,
          memo: bankTransaction.description,
          currency: payroll.currency,
          userId: req.user?._id || null,
          session,
          lines: movementLines({ bankLedger: bankAccount.ledgerAccount, counterpartLedger: payableAccount, direction: "out", amount, description: bankTransaction.description }),
        });
        bankTransaction.journalEntry = paymentJournal._id;
        await bankTransaction.save({ session });
        payroll.bankAccount = bankAccount._id;
        payroll.bankTransaction = bankTransaction._id;
      } else {
        const cashAccount = await resolveAccountingAccount("defaultCashAccount", "1000", session);
        paymentJournal = await createPostedJournal({
          date: paymentDate,
          sourceType: "payroll",
          sourceId: payroll._id,
          reference: clean(req.body.transactionRef) || payroll.payrollKey,
          memo: `Cash payroll payment for ${payroll.year}-${String(payroll.month).padStart(2, "0")}`,
          currency: payroll.currency,
          userId: req.user?._id || null,
          session,
          lines: [
            { account: payableAccount._id, debit: amount, credit: 0, description: "Payroll payable settled", contactType: "employee", contactId: payroll.employee },
            { account: cashAccount._id, debit: 0, credit: amount, description: "Cash payroll payment", contactType: "employee", contactId: payroll.employee },
          ],
        });
        payroll.bankAccount = null;
        payroll.bankTransaction = null;
      }

      payroll.status = "paid";
      payroll.paymentMethod = paymentMethod;
      payroll.paymentDate = paymentDate;
      payroll.transactionRef = clean(req.body.transactionRef) || paymentJournal.entryNo;
      payroll.paymentJournalEntry = paymentJournal._id;
      payroll.paidBy = req.user?._id || null;
      payroll.paidAt = new Date();
      if (!payroll.approvedAt) {
        payroll.approvedBy = req.user?._id || null;
        payroll.approvedAt = new Date();
      }
      await payroll.save({ session });
    });

    await applyPayrollLoanRepayments({
      payroll,
      requesterId: req.user?._id || null,
    });

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: "Payroll paid and posted to banking and accounting.",
      payroll: full,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: "Server error in markPayrollPaid.",
      error: err.message,
    });
  }
};

/* ===============================
   CANCEL PAYROLL
================================ */
export const cancelPayroll = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    if (payroll.status === "paid") {
      return res.status(400).json({ message: "Paid payroll cannot be cancelled." });
    }

    payroll.status = "cancelled";
    payroll.cancelledBy = req.user?._id || null;
    payroll.cancelledAt = new Date();
    payroll.cancelReason = clean(req.body.reason || req.body.cancelReason);

    await payroll.save();

    if (payroll.accrualJournalEntry) {
      await JournalEntry.updateOne(
        { _id: payroll.accrualJournalEntry, status: "posted" },
        { $set: { status: "void", voidedAt: new Date(), voidReason: payroll.cancelReason || "Payroll cancelled", voidedBy: req.user?._id || null } }
      );
      accountingCache.flushAll();
    }

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: "Payroll cancelled.",
      payroll: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in cancelPayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   DELETE PAYROLL
================================ */
export const deletePayroll = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    if (["approved", "paid"].includes(payroll.status)) {
      return res.status(400).json({
        message: "Approved or paid payroll cannot be deleted. Cancel it instead if needed.",
      });
    }

    await payroll.deleteOne();

    return res.json({ message: "Payroll deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deletePayroll.",
      error: err.message,
    });
  }
};
