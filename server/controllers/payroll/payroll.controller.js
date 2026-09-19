import mongoose from "mongoose";
import User from "../../models/user.model.js";
import Attendance from "../../models/attendance.model.js";
import SalaryProfile from "../../models/salaryProfile.model.js";
import Payroll from "../../models/payroll.model.js";
import PayrollPeriod from "../../models/payroll/payrollPeriod.model.js";
import PayrollAudit from "../../models/payroll/payrollAudit.model.js";
import SalaryGrade from "../../models/payroll/salaryGrade.model.js";
import BankAccount from "../../models/bankAccount.model.js";
import BankTransaction from "../../models/bankTransaction.model.js";
import JournalEntry from "../../models/journalEntry.model.js";
import {
  applyPayrollLoanRepayments,
  revertPayrollLoanRepayments,
  getEmployeeLoanDeductionsForPayroll,
} from "../../controllers/employeeLoan.controller.js";
import { getEmployeeRosterSummaryForPayroll } from "../../controllers/roster.controller.js";
import { ensureEmployeeAttendanceForRange } from "../../controllers/attendance.controller.js";
import { calculateEmployeeTaxDeduction } from "../../services/tax.service.js";
import {
  createPostedJournal,
  createReversalJournal,
  movementLines,
  resolveAccountingAccount,
} from "../../services/accountingPosting.service.js";
import { runMongoTransaction } from "../../utils/mongoTransaction.js";
import { ZipArchive } from "archiver";
import Company from "../../models/company.model.js";
import {
  generatePayslipPdfBuffer,
  mergePayslipsPdf,
  maskAccountNumber,
  maskMfsNumber,
} from "../../services/payroll/payslipPdf.service.js";
import {
  generatePayrollRegisterExport,
  generateBankDisbursementAdvice,
  generateMfsDisbursementAdvice,
} from "../../services/payroll/payrollExport.service.js";
import { numberToWords } from "../../utils/numberToWords.js";

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
    select: "name email role isActive avatarUrl department position payoutInfo joiningDate leavingDate employeeStatus tenantId employeeId",
    populate: [
      { path: "department", select: "name isActive tenantId" },
      { path: "position", select: "title department isActive" },
    ],
  },
  { path: "department", select: "name isActive tenantId" },
  { path: "position", select: "title department isActive" },
  { path: "salaryProfile", select: "salaryType currency basicSalary workingDaysPerMonth workingHoursPerDay isActive version salaryGrade tenantId" },
  { path: "calculatedBy", select: "name email role" },
  { path: "approvedBy", select: "name email role" },
  { path: "paidBy", select: "name email role" },
  { path: "cancelledBy", select: "name email role" },
  { path: "reversedBy", select: "name email role" },
  { path: "auditTrail.performedBy", select: "name email role" },
  { path: "bankAccount", select: "accountName accountNumber currency accountType", populate: { path: "bank", select: "bankName shortName" } },
  { path: "bankTransaction", select: "reference amount status journalEntry" },
  { path: "accrualJournalEntry", select: "entryNo status date" },
  { path: "paymentJournalEntry", select: "entryNo status date" },
  { path: "reversalJournalEntry", select: "entryNo status date" },
  { path: "reversalAccrualJournalEntry", select: "entryNo status date" },
  { path: "approvalWorkflow.preparedBy", select: "name email role" },
  { path: "approvalWorkflow.submittedBy", select: "name email role" },
  { path: "approvalWorkflow.approvedBy", select: "name email role" },
  { path: "approvalWorkflow.rejectedBy", select: "name email role" },
  { path: "approvalWorkflow.sentBackBy", select: "name email role" },
  { path: "approvalWorkflow.stages.approvedBy", select: "name email role" },
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
    .select("name email role isActive department position leavePolicy taxProfile payoutInfo joiningDate leavingDate employeeStatus tenantId employeeId")
    .lean();
};

const getEffectiveSalaryProfile = async (employeeId, targetDate = new Date()) => {
  const date = new Date(targetDate);
  let profile = await SalaryProfile.findOne({
    employee: employeeId,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }],
  })
    .sort({ effectiveFrom: -1, version: -1, createdAt: -1 })
    .lean();

  if (!profile) {
    profile = await SalaryProfile.findOne({
      employee: employeeId,
      isActive: true,
    }).lean();
  }

  return profile;
};

const getActiveSalaryProfile = (employeeId) => getEffectiveSalaryProfile(employeeId, new Date());

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
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const unproratedBasic = roundMoney(salaryProfile.basicSalary || 0);

  let isProrated = false;
  let prorationRatio = 1;
  let prorationReason = "";
  let activeDays = totalDaysInMonth;
  let joiningDate = employee.joiningDate ? new Date(employee.joiningDate) : null;
  let leavingDate = employee.leavingDate ? new Date(employee.leavingDate) : null;

  const isJoiner = Boolean(joiningDate && joiningDate > periodStart && joiningDate <= periodEnd);
  const isLeaver = Boolean(leavingDate && leavingDate >= periodStart && leavingDate < periodEnd);

  if (isJoiner || isLeaver) {
    const startDay = isJoiner ? joiningDate.getDate() : 1;
    const endDay = isLeaver ? leavingDate.getDate() : totalDaysInMonth;
    activeDays = Math.max(0, endDay - startDay + 1);

    if (activeDays < totalDaysInMonth) {
      isProrated = true;
      prorationRatio = Number((activeDays / totalDaysInMonth).toFixed(4));
      prorationReason = isJoiner && isLeaver ? "both" : isJoiner ? "new_joiner" : "resigned";
    }
  }

  const basicSalary = isProrated ? roundMoney(unproratedBasic * prorationRatio) : unproratedBasic;
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
    isProrated,
    prorationReason,
    joiningDate,
    leavingDate,
    activeDays,
    totalDaysInMonth,
    prorationRatio,
    unproratedBasicSalary: unproratedBasic,
  };

  const basicNote = isProrated
    ? `Prorated basic salary for ${activeDays}/${totalDaysInMonth} days (${prorationReason.replace(/_/g, " ")}).`
    : "Basic salary from active salary profile.";

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
      note: basicNote,
    }),
  ];

  const deductions = [];

  let runningGross = basicSalary;
  let taxableGross = basicSalary;

  const activeComponents = Array.isArray(salaryProfile.components)
    ? salaryProfile.components.filter((item) => item.isActive !== false)
    : [];

  for (const component of activeComponents.filter((item) => item.type === "earning")) {
    let amount = calculateComponentAmount(component, {
      basicSalary,
      grossSalary: runningGross,
    });

    if (isProrated && component.calculationType === "fixed") {
      amount = roundMoney(amount * prorationRatio);
    }

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
          note: isProrated && component.calculationType === "fixed"
            ? `${component.note || ""} (Prorated ${activeDays}/${totalDaysInMonth} days)`.trim()
            : component.note || "",
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

  const payoutSnapshot = {
    preferredPayoutMethod: employee.payoutInfo?.preferredPayoutMethod || "cash",
    bankName: employee.payoutInfo?.bankName || "",
    branchName: employee.payoutInfo?.branchName || "",
    accountHolderName: employee.payoutInfo?.accountHolderName || "",
    accountNumber: employee.payoutInfo?.accountNumber || "",
    routingNumber: employee.payoutInfo?.routingNumber || "",
    mfsProvider: employee.payoutInfo?.mfsProvider || "",
    mfsNumber: employee.payoutInfo?.mfsNumber || "",
  };

  return {
    payrollKey: `${String(employee._id)}-${year}-${String(month).padStart(2, "0")}`,
    tenantId: employee.tenantId || salaryProfile.tenantId || null,
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
    payoutSnapshot,
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

const checkPeriodLocked = async (year, month) => {
  const period = await PayrollPeriod.findOne({ year: Number(year), month: Number(month) }).lean();
  return period?.status === "locked";
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

  if (await checkPeriodLocked(range.year, range.month)) {
    return {
      ok: false,
      status: 403,
      message: `Payroll period ${range.year}-${String(range.month).padStart(2, "0")} is locked. Recalculation is prohibited.`,
    };
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

  const salaryProfile = await getEffectiveSalaryProfile(employeeId, range.end);
  if (!salaryProfile) {
    return {
      ok: false,
      status: 404,
      message: "Active or effective salary profile not found for this employee.",
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

  if (existing) {
    if (
      existing.approvalWorkflow?.isWorkflowEnabled &&
      ["submitted", "in_review"].includes(existing.approvalWorkflow?.status)
    ) {
      return {
        ok: false,
        status: 400,
        message: "Payroll is currently under approval review. It must be sent back before it can be recalculated.",
      };
    }

    if (existing.status === "paid") {
      return {
        ok: false,
        status: 400,
        message: "Paid payroll cannot be directly recalculated. An authorized reversal must be executed first to protect accounting integrity.",
      };
    }

    if (existing.status === "approved") {
      if (!force) {
        return {
          ok: false,
          status: 400,
          message: "Payroll is already approved. Use force=true to recalculate, which will safely void the existing accrual journal entry.",
        };
      }

      if (existing.accrualJournalEntry) {
        await JournalEntry.updateOne(
          { _id: existing.accrualJournalEntry, status: "posted" },
          {
            $set: {
              status: "void",
              voidedAt: new Date(),
              voidReason: "Voided due to authorized payroll force recalculation",
              voidedBy: requesterId,
            },
          }
        );
        accountingCache.flushAll();
        existing.accrualJournalEntry = null;
      }
    }
  }

  let payroll;

  if (existing) {
    const prevStatus = existing.status;
    if (!Array.isArray(existing.auditTrail)) existing.auditTrail = [];
    existing.auditTrail.push({
      action: "recalculated",
      performedBy: requesterId,
      performedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: "calculated",
      reason: note || "Recalculation executed",
      note: `Gross: ${payload.grossSalary}, Net: ${payload.netPayable}`,
    });

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
      isReversed: false,
      reversedBy: null,
      reversedAt: null,
      reversalReason: "",
    });

    if (existing.approvalWorkflow) {
      existing.approvalWorkflow.preparedBy = requesterId;
      if (["sent_back", "rejected"].includes(existing.approvalWorkflow.status)) {
        existing.approvalWorkflow.status = "draft";
      }
    }

    await existing.save();
    payroll = existing;
  } else {
    payload.calculatedBy = requesterId;
    payload.approvalWorkflow = {
      isWorkflowEnabled: false,
      enforceMakerChecker: true,
      status: "draft",
      preparedBy: requesterId,
      cycle: 1,
    };
    payload.auditTrail = [
      {
        action: "calculated",
        performedBy: requesterId,
        performedAt: new Date(),
        previousStatus: "new",
        newStatus: "calculated",
        reason: note || "Initial calculation",
        note: `Gross: ${payload.grossSalary}, Net: ${payload.netPayable}`,
      },
    ];
    payroll = await Payroll.create(payload);
  }

  await PayrollAudit.create({
    payroll: payroll._id,
    payrollKey: payroll.payrollKey,
    employee: payroll.employee,
    year: payroll.year,
    month: payroll.month,
    action: existing ? "recalculated" : "calculated",
    performedBy: requesterId,
    performedAt: new Date(),
    previousStatus: existing ? existing.status : "new",
    newStatus: "calculated",
    reason: note || "",
    details: {
      basicSalary: payroll.basicSalary,
      totalEarnings: payroll.totalEarnings,
      totalDeductions: payroll.totalDeductions,
      netPayable: payroll.netPayable,
      isProrated: payroll.salarySnapshot?.isProrated || false,
    },
  }).catch(() => {});

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

    const salaryProfile = await getEffectiveSalaryProfile(employeeId, range.end);
    if (!salaryProfile) {
      return res.status(404).json({ message: "Active or effective salary profile not found." });
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

    if (await checkPeriodLocked(range.year, range.month)) {
      return res.status(403).json({
        message: `Payroll period ${range.year}-${String(range.month).padStart(2, "0")} is locked. Bulk calculations are prohibited.`,
      });
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
      if (await checkPeriodLocked(payroll.year, payroll.month)) {
        throw Object.assign(new Error(`Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked. Approvals are prohibited.`), { statusCode: 403 });
      }
      if (payroll.status === "paid") throw Object.assign(new Error("Paid payroll cannot be approved again."), { statusCode: 400 });
      if (payroll.status === "cancelled") throw Object.assign(new Error("Cancelled payroll cannot be approved."), { statusCode: 400 });
      if (payroll.status === "reversed") throw Object.assign(new Error("Reversed payroll cannot be directly approved. Recalculate it first."), { statusCode: 400 });

      await ensurePayrollAccrual({ payroll, userId: req.user?._id || null, session });
      const prevStatus = payroll.status;
      payroll.status = "approved";
      payroll.approvedBy = req.user?._id || null;
      payroll.approvedAt = new Date();

      if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
      payroll.auditTrail.push({
        action: "approved",
        performedBy: req.user?._id || null,
        performedAt: new Date(),
        previousStatus: prevStatus,
        newStatus: "approved",
        reason: clean(req.body.reason) || "Payroll approved",
      });

      await payroll.save({ session });
    });

    await PayrollAudit.create({
      payroll: payroll._id,
      payrollKey: payroll.payrollKey,
      employee: payroll.employee,
      year: payroll.year,
      month: payroll.month,
      action: "approved",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: "calculated",
      newStatus: "approved",
      reason: clean(req.body.reason) || "",
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
    let paymentJournal;
    const paymentMethod = clean(req.body.paymentMethod || "cash");
    const paymentDate = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) return res.status(400).json({ message: "Valid payment date is required." });

    await runMongoTransaction(async (session) => {
      payroll = await Payroll.findById(req.params.id).session(session);
      if (!payroll) throw Object.assign(new Error("Payroll not found."), { statusCode: 404 });
      if (await checkPeriodLocked(payroll.year, payroll.month)) {
        throw Object.assign(new Error(`Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked. Payments are prohibited.`), { statusCode: 403 });
      }
      if (payroll.status === "cancelled") throw Object.assign(new Error("Cancelled payroll cannot be paid."), { statusCode: 400 });
      if (payroll.status === "paid") throw Object.assign(new Error("Payroll is already paid."), { statusCode: 400 });
      if (payroll.status === "reversed") throw Object.assign(new Error("Reversed payroll cannot be directly paid. Recalculate it first."), { statusCode: 400 });

      if (payroll.approvalWorkflow?.isWorkflowEnabled) {
        if (payroll.approvalWorkflow.status !== "approved" || payroll.status !== "approved") {
          throw Object.assign(
            new Error("Payroll must be fully approved through the approval workflow before payment can be recorded."),
            { statusCode: 400 }
          );
        }
        if (payroll.approvalWorkflow.enforceMakerChecker) {
          const reqUserId = String(req.user?._id || "");
          const prepId = String(payroll.approvalWorkflow.preparedBy || payroll.calculatedBy || "");
          const subId = String(payroll.approvalWorkflow.submittedBy || "");
          if (reqUserId && (reqUserId === prepId || reqUserId === subId)) {
            throw Object.assign(
              new Error("Maker-checker violation: Preparer cannot authorize payout/disbursement for their own payroll."),
              { statusCode: 403 }
            );
          }
        }
      }

      const resolvedPaymentMethod = clean(req.body.paymentMethod || payroll.paymentMethod || "cash");
      const amount = roundMoney(payroll.netPayable || payroll.netSalary);
      if (amount <= 0) throw Object.assign(new Error("Net payroll amount must be greater than zero."), { statusCode: 400 });

      await ensurePayrollAccrual({ payroll, userId: req.user?._id || null, session });
      const payableAccount = await resolveAccountingAccount("payrollPayableAccount", "2200", session);
      let bankTransaction = null;
      const useBank = ["bank", "mobile_banking", "cheque"].includes(resolvedPaymentMethod) || Boolean(req.body.bankAccount);

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

      const prevStatus = payroll.status;
      payroll.status = "paid";
      payroll.paymentMethod = resolvedPaymentMethod;
      payroll.paymentDate = paymentDate;
      payroll.transactionRef = clean(req.body.transactionRef) || paymentJournal.entryNo;
      payroll.paymentJournalEntry = paymentJournal._id;
      payroll.paidBy = req.user?._id || null;
      payroll.paidAt = new Date();
      if (!payroll.approvedAt) {
        payroll.approvedBy = req.user?._id || null;
        payroll.approvedAt = new Date();
      }

      if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
      payroll.auditTrail.push({
        action: "paid",
        performedBy: req.user?._id || null,
        performedAt: new Date(),
        previousStatus: prevStatus,
        newStatus: "paid",
        reason: clean(req.body.reason) || `Paid via ${resolvedPaymentMethod}`,
        note: `Amount: ${amount}, Journal: ${paymentJournal.entryNo}`,
      });

      await payroll.save({ session });
    });

    await applyPayrollLoanRepayments({
      payroll,
      requesterId: req.user?._id || null,
    });

    await PayrollAudit.create({
      payroll: payroll._id,
      payrollKey: payroll.payrollKey,
      employee: payroll.employee,
      year: payroll.year,
      month: payroll.month,
      action: "paid",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: "approved",
      newStatus: "paid",
      reason: clean(req.body.reason) || "",
      details: {
        paymentMethod: payroll.paymentMethod,
        paymentDate,
        amount: roundMoney(payroll.netPayable || payroll.netSalary),
        paymentJournal: payroll.paymentJournalEntry,
      },
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
   REVERSE PAID PAYROLL
================================ */
export const reversePayroll = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const reversalReason = clean(req.body.reason || req.body.reversalReason);
    if (!reversalReason) {
      return res.status(400).json({ message: "Reversal reason is required for financial compliance." });
    }

    const reversalDate = req.body.reversalDate ? new Date(req.body.reversalDate) : new Date();
    if (Number.isNaN(reversalDate.getTime())) {
      return res.status(400).json({ message: "Valid reversal date is required." });
    }

    let payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    if (payroll.status !== "paid") {
      return res.status(400).json({
        message: `Only paid payroll can be reversed. Current status is '${payroll.status}'.`,
      });
    }

    if (await checkPeriodLocked(payroll.year, payroll.month)) {
      return res.status(403).json({
        message: `Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked. Reversal is prohibited until period is unlocked.`,
      });
    }

    let reversalJournal = null;
    let reversalAccrualJournal = null;

    await runMongoTransaction(async (session) => {
      payroll = await Payroll.findById(payroll._id).session(session);

      // 1. Reverse Payment Journal
      if (payroll.paymentJournalEntry) {
        reversalJournal = await createReversalJournal({
          originalJournalId: payroll.paymentJournalEntry,
          date: reversalDate,
          reason: `Payroll reversal: ${reversalReason}`,
          userId: req.user?._id || null,
          session,
        });
      }

      // 2. Void Bank Transaction
      if (payroll.bankTransaction) {
        await BankTransaction.updateOne(
          { _id: payroll.bankTransaction },
          {
            $set: {
              status: "void",
              description: `Voided due to payroll reversal: ${reversalReason}`,
              updatedBy: req.user?._id || null,
            },
          },
          { session }
        );
      }

      // 3. Reverse Accrual Journal
      if (payroll.accrualJournalEntry) {
        reversalAccrualJournal = await createReversalJournal({
          originalJournalId: payroll.accrualJournalEntry,
          date: reversalDate,
          reason: `Payroll accrual reversal: ${reversalReason}`,
          userId: req.user?._id || null,
          session,
        });
      }

      // 4. Update Payroll Status and Reversal Metadata
      const prevStatus = payroll.status;
      payroll.status = "reversed";
      payroll.isReversed = true;
      payroll.reversedBy = req.user?._id || null;
      payroll.reversedAt = new Date();
      payroll.reversalReason = reversalReason;
      if (reversalJournal) payroll.reversalJournalEntry = reversalJournal._id;
      if (reversalAccrualJournal) payroll.reversalAccrualJournalEntry = reversalAccrualJournal._id;

      if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
      payroll.auditTrail.push({
        action: "reversal_executed",
        performedBy: req.user?._id || null,
        performedAt: new Date(),
        previousStatus: prevStatus,
        newStatus: "reversed",
        reason: reversalReason,
        note: `Reversal journals created: Payment Entry ${reversalJournal?.entryNo || "none"}, Accrual Entry ${reversalAccrualJournal?.entryNo || "none"}`,
      });

      await payroll.save({ session });

      // 5. Revert Employee Loan Repayments
      await revertPayrollLoanRepayments({
        payroll,
        requesterId: req.user?._id || null,
        session,
      });
    });

    accountingCache.flushAll();

    // 6. Log to PayrollAudit collection
    await PayrollAudit.create({
      payroll: payroll._id,
      payrollKey: payroll.payrollKey,
      employee: payroll.employee,
      year: payroll.year,
      month: payroll.month,
      action: "reversal_executed",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: "paid",
      newStatus: "reversed",
      reason: reversalReason,
      details: {
        reversalJournal: reversalJournal?._id || null,
        reversalJournalNo: reversalJournal?.entryNo || null,
        reversalAccrualJournal: reversalAccrualJournal?._id || null,
        reversalAccrualJournalNo: reversalAccrualJournal?.entryNo || null,
      },
    });

    const full = await populatePayrollQuery(Payroll.findById(payroll._id)).lean();

    return res.json({
      message: "Payroll payout successfully reversed with accounting and loan adjustments.",
      payroll: full,
      reversalJournal,
      reversalAccrualJournal,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: "Server error in reversePayroll.",
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

    if (await checkPeriodLocked(payroll.year, payroll.month)) {
      return res.status(403).json({
        message: `Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked. Cancellation is prohibited.`,
      });
    }

    if (payroll.status === "paid") {
      return res.status(400).json({ message: "Paid payroll cannot be cancelled. Use the reversal workflow instead." });
    }

    const prevStatus = payroll.status;
    payroll.status = "cancelled";
    payroll.cancelledBy = req.user?._id || null;
    payroll.cancelledAt = new Date();
    payroll.cancelReason = clean(req.body.reason || req.body.cancelReason);

    if (!Array.isArray(payroll.auditTrail)) payroll.auditTrail = [];
    payroll.auditTrail.push({
      action: "cancelled",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: "cancelled",
      reason: payroll.cancelReason,
    });

    await payroll.save();

    if (payroll.accrualJournalEntry) {
      await JournalEntry.updateOne(
        { _id: payroll.accrualJournalEntry, status: "posted" },
        { $set: { status: "void", voidedAt: new Date(), voidReason: payroll.cancelReason || "Payroll cancelled", voidedBy: req.user?._id || null } }
      );
      accountingCache.flushAll();
    }

    await PayrollAudit.create({
      payroll: payroll._id,
      payrollKey: payroll.payrollKey,
      employee: payroll.employee,
      year: payroll.year,
      month: payroll.month,
      action: "cancelled",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: "cancelled",
      reason: payroll.cancelReason,
    });

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

    if (await checkPeriodLocked(payroll.year, payroll.month)) {
      return res.status(403).json({
        message: `Payroll period ${payroll.year}-${String(payroll.month).padStart(2, "0")} is locked. Deletion is prohibited.`,
      });
    }

    if (
      payroll.approvalWorkflow?.isWorkflowEnabled &&
      ["submitted", "in_review"].includes(payroll.approvalWorkflow?.status)
    ) {
      return res.status(400).json({
        message: "Payroll is currently under approval review. It must be sent back before it can be deleted.",
      });
    }

    if (["approved", "paid"].includes(payroll.status)) {
      return res.status(400).json({
        message: "Approved or paid payroll cannot be deleted. Cancel it instead if needed.",
      });
    }

    await PayrollAudit.create({
      payroll: payroll._id,
      payrollKey: payroll.payrollKey,
      employee: payroll.employee,
      year: payroll.year,
      month: payroll.month,
      action: "deleted",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: payroll.status,
      newStatus: "deleted",
      reason: clean(req.body.reason) || "Payroll deleted",
    });

    await payroll.deleteOne();

    return res.json({ message: "Payroll deleted." });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in deletePayroll.",
      error: err.message,
    });
  }
};

/* ===============================
   LIST PAYROLL PERIODS
================================ */
export const listPayrollPeriods = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const periods = await PayrollPeriod.find({ year })
      .populate("lockedBy", "name email role")
      .populate("unlockedBy", "name email role")
      .sort({ month: -1 })
      .lean();

    const payrollAggregates = await Payroll.aggregate([
      { $match: { year } },
      {
        $group: {
          _id: "$month",
          count: { $sum: 1 },
          totalGross: { $sum: "$grossSalary" },
          totalNet: { $sum: "$netPayable" },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          calculatedCount: {
            $sum: { $cond: [{ $eq: ["$status", "calculated"] }, 1, 0] },
          },
          reversedCount: {
            $sum: { $cond: [{ $eq: ["$status", "reversed"] }, 1, 0] },
          },
        },
      },
    ]);

    const aggMap = new Map(payrollAggregates.map((a) => [a._id, a]));

    const months = Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
      const existing = periods.find((p) => p.month === m);
      const agg = aggMap.get(m) || { count: 0, totalGross: 0, totalNet: 0, paidCount: 0, approvedCount: 0, calculatedCount: 0, reversedCount: 0 };
      const range = getMonthRange({ year, month: m });
      return {
        _id: existing?._id || null,
        periodKey: `${year}-${String(m).padStart(2, "0")}`,
        year,
        month: m,
        startDate: existing?.startDate || range.start,
        endDate: existing?.endDate || range.end,
        status: existing?.status || "open",
        isLocked: existing?.status === "locked",
        lockedAt: existing?.lockedAt || null,
        lockedBy: existing?.lockedBy || null,
        lockReason: existing?.lockReason || "",
        unlockedAt: existing?.unlockedAt || null,
        unlockedBy: existing?.unlockedBy || null,
        unlockReason: existing?.unlockReason || "",
        stats: {
          totalEmployees: agg.count,
          totalGross: roundMoney(agg.totalGross),
          totalNet: roundMoney(agg.totalNet),
          paidCount: agg.paidCount,
          approvedCount: agg.approvedCount,
          calculatedCount: agg.calculatedCount,
          reversedCount: agg.reversedCount,
        },
      };
    });

    return res.json({
      year,
      periods: months,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in listPayrollPeriods.",
      error: err.message,
    });
  }
};

/* ===============================
   GET PAYROLL PERIOD STATUS
================================ */
export const getPayrollPeriodStatus = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const range = getMonthRange({ year, month });
    if (!range) {
      return res.status(400).json({ message: "Valid year and month are required." });
    }

    const period = await PayrollPeriod.findOne({ year, month })
      .populate("lockedBy", "name email role")
      .populate("unlockedBy", "name email role")
      .populate("auditTrail.performedBy", "name email role")
      .lean();

    const payrollStats = await Payroll.aggregate([
      { $match: { year, month } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalGross: { $sum: "$grossSalary" },
          totalNet: { $sum: "$netPayable" },
        },
      },
    ]);

    const counts = {
      calculated: 0,
      approved: 0,
      paid: 0,
      reversed: 0,
      cancelled: 0,
      total: 0,
      totalGross: 0,
      totalNet: 0,
    };

    for (const stat of payrollStats) {
      counts[stat._id] = stat.count;
      counts.total += stat.count;
      counts.totalGross += stat.totalGross || 0;
      counts.totalNet += stat.totalNet || 0;
    }
    counts.totalGross = roundMoney(counts.totalGross);
    counts.totalNet = roundMoney(counts.totalNet);

    return res.json({
      year,
      month,
      periodKey: `${year}-${String(month).padStart(2, "0")}`,
      startDate: period?.startDate || range.start,
      endDate: period?.endDate || range.end,
      status: period?.status || "open",
      isLocked: period?.status === "locked",
      period,
      stats: counts,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getPayrollPeriodStatus.",
      error: err.message,
    });
  }
};

/* ===============================
   LOCK PAYROLL PERIOD
================================ */
export const lockPayrollPeriod = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const range = getMonthRange({ year, month });
    if (!range) {
      return res.status(400).json({ message: "Valid year and month are required." });
    }

    const lockReason = clean(req.body.reason || req.body.lockReason) || "Period locked by administrator";

    let period = await PayrollPeriod.findOne({ year, month });
    if (!period) {
      period = new PayrollPeriod({
        periodKey: `${year}-${String(month).padStart(2, "0")}`,
        year,
        month,
        startDate: range.start,
        endDate: range.end,
        status: "open",
      });
    }

    if (period.status === "locked") {
      return res.status(400).json({ message: "Period is already locked." });
    }

    const totals = await Payroll.aggregate([
      { $match: { year, month } },
      {
        $group: {
          _id: null,
          totalEmployees: { $sum: 1 },
          totalGross: { $sum: "$grossSalary" },
          totalNet: { $sum: "$netPayable" },
        },
      },
    ]);

    const prevStatus = period.status;
    period.status = "locked";
    period.lockedBy = req.user?._id || null;
    period.lockedAt = new Date();
    period.lockReason = lockReason;
    if (totals.length > 0) {
      period.totalEmployees = totals[0].totalEmployees || 0;
      period.totalGross = roundMoney(totals[0].totalGross);
      period.totalNet = roundMoney(totals[0].totalNet);
    }

    if (!Array.isArray(period.auditTrail)) period.auditTrail = [];
    period.auditTrail.push({
      action: "locked",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: "locked",
      reason: lockReason,
    });

    await period.save();

    await PayrollAudit.create({
      year,
      month,
      payrollKey: period.periodKey,
      action: "period_locked",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: "locked",
      reason: lockReason,
      details: {
        totalEmployees: period.totalEmployees,
        totalGross: period.totalGross,
        totalNet: period.totalNet,
      },
    });

    const populated = await PayrollPeriod.findById(period._id)
      .populate("lockedBy", "name email role")
      .lean();

    return res.json({
      message: `Payroll period ${period.periodKey} has been locked successfully.`,
      period: populated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in lockPayrollPeriod.",
      error: err.message,
    });
  }
};

/* ===============================
   UNLOCK PAYROLL PERIOD
================================ */
export const unlockPayrollPeriod = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const range = getMonthRange({ year, month });
    if (!range) {
      return res.status(400).json({ message: "Valid year and month are required." });
    }

    const unlockReason = clean(req.body.reason || req.body.unlockReason);
    if (!unlockReason) {
      return res.status(400).json({
        message: "A justification reason is required to unlock a closed payroll period.",
      });
    }

    let period = await PayrollPeriod.findOne({ year, month });
    if (!period || period.status !== "locked") {
      return res.status(400).json({ message: "Period is not locked." });
    }

    const prevStatus = period.status;
    period.status = "open";
    period.unlockedBy = req.user?._id || null;
    period.unlockedAt = new Date();
    period.unlockReason = unlockReason;

    if (!Array.isArray(period.auditTrail)) period.auditTrail = [];
    period.auditTrail.push({
      action: "unlocked",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: "open",
      reason: unlockReason,
    });

    await period.save();

    await PayrollAudit.create({
      year,
      month,
      payrollKey: period.periodKey,
      action: "period_unlocked",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: prevStatus,
      newStatus: "open",
      reason: unlockReason,
    });

    const populated = await PayrollPeriod.findById(period._id)
      .populate("unlockedBy", "name email role")
      .lean();

    return res.json({
      message: `Payroll period ${period.periodKey} has been unlocked.`,
      period: populated,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in unlockPayrollPeriod.",
      error: err.message,
    });
  }
};

/* ===============================
   GET AUDIT LOGS
================================ */
export const getPayrollAuditLogs = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const limit = parseLimit(req.query.limit);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.payrollId && isValidObjectId(req.query.payrollId)) {
      filter.payroll = req.query.payrollId;
    }
    if (req.query.employee && isValidObjectId(req.query.employee)) {
      filter.employee = req.query.employee;
    }
    if (req.query.year) {
      filter.year = Number(req.query.year);
    }
    if (req.query.month) {
      filter.month = Number(req.query.month);
    }
    if (req.query.action) {
      filter.action = req.query.action;
    }

    const [total, logs] = await Promise.all([
      PayrollAudit.countDocuments(filter),
      PayrollAudit.find(filter)
        .sort({ performedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate("employee", "name email role department position")
        .populate("performedBy", "name email role")
        .lean(),
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      logs,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getPayrollAuditLogs.",
      error: err.message,
    });
  }
};

export const getPayrollAuditHistory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await Payroll.findById(req.params.id)
      .select("auditTrail payrollKey employee year month")
      .populate("auditTrail.performedBy", "name email role")
      .lean();

    if (!payroll) return res.status(404).json({ message: "Payroll not found." });

    const auditLogs = await PayrollAudit.find({ payroll: payroll._id })
      .sort({ performedAt: -1 })
      .populate("performedBy", "name email role")
      .lean();

    return res.json({
      payrollId: payroll._id,
      payrollKey: payroll.payrollKey,
      embeddedAuditTrail: payroll.auditTrail || [],
      auditLogs,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getPayrollAuditHistory.",
      error: err.message,
    });
  }
};

/* =========================================================================
   PHASE 3 — PAYSLIPS & DISBURSEMENT OPERATIONS
========================================================================= */

const resolveCompanyBranding = async (req, payroll = null) => {
  if (req.company && req.company.name) return req.company;

  const tenantId = req.tenantId || payroll?.tenantId || payroll?.employee?.tenantId || req.user?.tenantId;
  if (tenantId && isValidObjectId(tenantId)) {
    try {
      const found = await Company.findById(tenantId).lean();
      if (found) return found;
    } catch {
      // ignore and fallback
    }
  }

  return {
    name: "Organization Payslip",
    legalName: "",
    address: {},
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
    settings: { currency: payroll?.currency || "BDT" },
  };
};

const assertPayrollTenant = (req, payroll) => {
  if (req.user?.role === "superadmin") return true;
  const userTenant = req.tenantId || req.user?.tenantId;
  const payrollTenant = payroll?.tenantId || payroll?.employee?.tenantId;

  if (userTenant && payrollTenant && String(userTenant) !== String(payrollTenant)) {
    return false;
  }
  return true;
};

/* ===============================
   GET PAYSLIP (JSON)
================================ */
export const getPayslip = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await populatePayrollQuery(Payroll.findById(req.params.id)).lean();
    if (!payroll) {
      return res.status(404).json({ message: "Payroll record not found." });
    }

    if (!assertPayrollTenant(req, payroll)) {
      return res.status(403).json({ message: "Access denied: payroll belongs to another organization." });
    }

    const isOwner = String(payroll.employee?._id || payroll.employee) === String(req.user?._id);
    const canManage = isAdminUser(req);

    if (!isOwner && !canManage) {
      return res.status(403).json({ message: "Not authorized to view this payslip." });
    }

    const company = await resolveCompanyBranding(req, payroll);
    const payout = { ...(payroll.payoutSnapshot || {}) };

    // Payout details are masked in standard payslip view
    const maskedPayout = {
      preferredPayoutMethod: payout.preferredPayoutMethod || payroll.paymentMethod || "cash",
      bankName: payout.bankName || "",
      branchName: payout.branchName || "",
      accountHolderName: payout.accountHolderName || "",
      accountNumber: maskAccountNumber(payout.accountNumber),
      routingNumber: payout.routingNumber ? "****" : "",
      mfsProvider: payout.mfsProvider || "",
      mfsNumber: maskMfsNumber(payout.mfsNumber),
    };

    const netAmount = Number(payroll.netPayable ?? payroll.netSalary ?? 0);
    const currency = String(payroll.currency || company?.settings?.currency || "BDT").toUpperCase();
    const netInWords = numberToWords(netAmount, currency);

    return res.json({
      payslip: {
        _id: payroll._id,
        payrollKey: payroll.payrollKey,
        year: payroll.year,
        month: payroll.month,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        currency,
        status: payroll.status,
        isReversed: payroll.status === "reversed" || Boolean(payroll.isReversed),
        reversedAt: payroll.reversedAt || null,
        reversalReason: payroll.reversalReason || "",
        paymentDate: payroll.paymentDate,
        paymentMethod: payroll.paymentMethod,
        employee: {
          _id: payroll.employee?._id,
          name: payroll.employee?.name,
          email: payroll.employee?.email,
          employeeId: payroll.employee?.employeeId,
          department: payroll.department?.name || payroll.employee?.department?.name || "General",
          position: payroll.position?.title || payroll.employee?.position?.title || "Staff Member",
          joiningDate: payroll.employee?.joiningDate,
          avatarUrl: payroll.employee?.avatarUrl,
        },
        salarySnapshot: payroll.salarySnapshot || {},
        attendanceSummary: payroll.attendanceSummary || {},
        earnings: payroll.earnings || [],
        deductions: payroll.deductions || [],
        basicSalary: payroll.basicSalary || 0,
        totalEarnings: payroll.totalEarnings || payroll.grossSalary || 0,
        grossSalary: payroll.grossSalary || 0,
        totalDeductions: payroll.totalDeductions || payroll.totalDeduction || 0,
        taxDeduction: payroll.taxDeduction || 0,
        netPayable: netAmount,
        netSalaryInWords: netInWords,
        payoutSnapshot: maskedPayout,
        company: {
          name: company?.name || company?.legalName || "Organization",
          address: company?.address || {},
          phone: company?.phone || "",
          email: company?.email || "",
          website: company?.website || "",
          logoUrl: company?.logoUrl || "",
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getPayslip.",
      error: err.message,
    });
  }
};

/* ===============================
   DOWNLOAD PAYSLIP PDF
================================ */
export const downloadPayslipPdf = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid payroll ID." });
    }

    const payroll = await populatePayrollQuery(Payroll.findById(req.params.id)).lean();
    if (!payroll) {
      return res.status(404).json({ message: "Payroll record not found." });
    }

    if (!assertPayrollTenant(req, payroll)) {
      return res.status(403).json({ message: "Access denied: payroll belongs to another organization." });
    }

    const isOwner = String(payroll.employee?._id || payroll.employee) === String(req.user?._id);
    const canManage = isAdminUser(req);

    if (!isOwner && !canManage) {
      return res.status(403).json({ message: "Not authorized to download this payslip." });
    }

    const company = await resolveCompanyBranding(req, payroll);
    const pdfBytes = await generatePayslipPdfBuffer(payroll, company);

    // Audit log
    const userTenant = req.tenantId || req.user?.tenantId || payroll.tenantId || null;
    await PayrollAudit.create({
      payroll: payroll._id,
      payrollKey: payroll.payrollKey,
      employee: payroll.employee?._id || payroll.employee,
      tenantId: userTenant,
      year: payroll.year,
      month: payroll.month,
      action: "payslip_download_pdf",
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      previousStatus: payroll.status,
      newStatus: payroll.status,
      reason: "Payslip PDF downloaded",
      details: { isOwner, isReversed: payroll.status === "reversed" || Boolean(payroll.isReversed) },
    }).catch(() => {});

    const disposition = req.query.download === "1" ? "attachment" : "inline";
    const filename = `payslip-${payroll.payrollKey || payroll._id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBytes.length);
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    return res.status(500).json({
      message: "Server error in downloadPayslipPdf.",
      error: err.message,
    });
  }
};

/* ===============================
   BULK DOWNLOAD PAYSLIPS (ZIP / COMBINED PDF)
================================ */
export const bulkDownloadPayslips = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { payrollIds, format = "zip" } = req.body || {};
    const MAX_BULK_PAYSLIP_COUNT = 100;

    if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
      return res.status(400).json({ message: "payrollIds must be a non-empty array." });
    }

    if (payrollIds.length > MAX_BULK_PAYSLIP_COUNT) {
      return res.status(400).json({
        message: `Maximum ${MAX_BULK_PAYSLIP_COUNT} payslips can be exported in a single bulk operation.`,
      });
    }

    for (const id of payrollIds) {
      if (!isValidObjectId(id)) {
        return res.status(400).json({ message: `Invalid payroll ID: ${id}` });
      }
    }

    const payrolls = await populatePayrollQuery(Payroll.find({ _id: { $in: payrollIds } })).lean();
    if (payrolls.length === 0) {
      return res.status(404).json({ message: "No payroll records found for the provided IDs." });
    }

    // Cross-tenant verification
    for (const p of payrolls) {
      if (!assertPayrollTenant(req, p)) {
        return res.status(403).json({
          message: "Access denied: one or more payroll records belong to another organization.",
        });
      }
    }

    const company = await resolveCompanyBranding(req, payrolls[0]);
    const userTenant = req.tenantId || req.user?.tenantId || payrolls[0].tenantId || null;

    // Audit log
    await PayrollAudit.create({
      action: "payslip_bulk_download",
      tenantId: userTenant,
      year: payrolls[0].year,
      month: payrolls[0].month,
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      reason: `Bulk payslip export (${format.toUpperCase()})`,
      details: { format, count: payrolls.length },
    }).catch(() => {});

    if (format === "pdf") {
      const pdfBuffers = [];
      for (const p of payrolls) {
        const buf = await generatePayslipPdfBuffer(p, company);
        pdfBuffers.push(buf);
      }
      const mergedBytes = await mergePayslipsPdf(pdfBuffers);
      const filename = `combined-payslips-${payrolls[0].year}-${String(payrolls[0].month).padStart(2, "0")}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", mergedBytes.length);
      return res.send(Buffer.from(mergedBytes));
    }

    // Default: ZIP archive (memory-safe streaming)
    const zipFilename = `payslips-${payrolls[0].year}-${String(payrolls[0].month).padStart(2, "0")}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", (err) => {
      if (!res.headersSent) res.status(500).send({ error: err.message });
    });
    archive.pipe(res);

    for (const p of payrolls) {
      const pdfBytes = await generatePayslipPdfBuffer(p, company);
      const empName = String(p.employee?.name || "employee").replace(/[^a-zA-Z0-9_-]/g, "_");
      const ref = p.payrollKey || String(p._id);
      archive.append(Buffer.from(pdfBytes), { name: `payslip-${empName}-${ref}.pdf` });
    }

    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Server error in bulkDownloadPayslips.",
        error: err.message,
      });
    }
  }
};

/* ===============================
   EXPORT PAYROLL REGISTER (XLSX / CSV)
================================ */
export const exportPayrollRegister = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const format = String(req.query.format || "xlsx").toLowerCase();

    if (!year || !month) {
      return res.status(400).json({ message: "Year and month are required for register export." });
    }

    const filter = { year, month };
    const userTenant = req.tenantId || req.user?.tenantId;
    if (userTenant) {
      filter.$or = [{ tenantId: userTenant }, { tenantId: null }];
    }

    if (req.query.department && isValidObjectId(req.query.department)) {
      filter.department = req.query.department;
    }
    if (req.query.position && isValidObjectId(req.query.position)) {
      filter.position = req.query.position;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const payrolls = await populatePayrollQuery(
      Payroll.find(filter).sort({ "employee.name": 1, createdAt: 1 })
    ).lean();

    // Verify tenant isolation
    const safePayrolls = payrolls.filter((p) => assertPayrollTenant(req, p));

    // Audit log (never put bank accounts in details!)
    await PayrollAudit.create({
      action: "payroll_register_export",
      tenantId: userTenant,
      year,
      month,
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      reason: "Payroll Register Export",
      details: { format, count: safePayrolls.length },
    }).catch(() => {});

    const periodLabel = `${year}-${String(month).padStart(2, "0")}`;
    const result = generatePayrollRegisterExport({
      payrolls: safePayrolls,
      format,
      periodLabel,
    });

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.data);
  } catch (err) {
    return res.status(500).json({
      message: "Server error in exportPayrollRegister.",
      error: err.message,
    });
  }
};

/* ===============================
   EXPORT DISBURSEMENT ADVICE (BANK / MFS)
================================ */
export const exportDisbursementAdvice = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const rawType = String(req.query.type || req.query.payoutMethod || "bank").toLowerCase();
    const type = rawType.includes("mfs") || rawType.includes("mobile") ? "mfs" : "bank";
    const format = String(req.query.format || "xlsx").toLowerCase();

    if (!year || !month) {
      return res.status(400).json({ message: "Year and month are required for disbursement advice export." });
    }

    const filter = { year, month };
    const userTenant = req.tenantId || req.user?.tenantId;
    if (userTenant) {
      filter.$or = [{ tenantId: userTenant }, { tenantId: null }];
    }

    // Only non-cancelled / non-reversed records for active disbursement advice
    filter.status = { $nin: ["cancelled", "reversed"] };

    const payrolls = await populatePayrollQuery(
      Payroll.find(filter).sort({ "employee.name": 1, createdAt: 1 })
    ).lean();

    const safePayrolls = payrolls.filter((p) => assertPayrollTenant(req, p));
    const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

    // Audit log (NO account numbers in metadata!)
    await PayrollAudit.create({
      action: type === "mfs" ? "mfs_advice_export" : "bank_advice_export",
      tenantId: userTenant,
      year,
      month,
      performedBy: req.user?._id || null,
      performedAt: new Date(),
      reason: `${type.toUpperCase()} Disbursement Advice Export`,
      details: { format, type, count: safePayrolls.length },
    }).catch(() => {});

    let result;
    if (type === "mfs") {
      result = generateMfsDisbursementAdvice({ payrolls: safePayrolls, format, periodLabel });
    } else {
      result = generateBankDisbursementAdvice({ payrolls: safePayrolls, format, periodLabel });
    }

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return res.send(result.data);
  } catch (err) {
    return res.status(500).json({
      message: "Server error in exportDisbursementAdvice.",
      error: err.message,
    });
  }
};

export {
  checkPeriodLocked,
  ensurePayrollAccrual,
  populatePayrollQuery,
  assertPayrollTenant,
  PAYROLL_POPULATE,
  requireAdmin,
  isValidObjectId,
  clean,
  roundMoney,
};

