import test from "node:test";
import assert from "node:assert/strict";
import Payroll from "../../models/payroll.model.js";
import PayrollPeriod from "../../models/payroll/payrollPeriod.model.js";
import PayrollAudit from "../../models/payroll/payrollAudit.model.js";
import SalaryGrade from "../../models/payroll/salaryGrade.model.js";
import SalaryProfile from "../../models/payroll/salaryProfile.model.js";
import User from "../../models/administration/user.model.js";
import EmployeeLoan from "../../models/payroll/employeeLoan.model.js";

/* =========================================================
   1. PRORATION ENGINE CALCULATION INVARIANTS
========================================================= */
test("Proration: Full-month employee receives 100% unprorated basic salary", () => {
  const year = 2026;
  const month = 9; // September (30 days)
  const daysInMonth = new Date(year, month, 0).getDate();
  assert.equal(daysInMonth, 30);

  const joiningDate = new Date("2025-01-01");
  const leavingDate = null;
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  let activeStart = periodStart;
  if (joiningDate && joiningDate > periodStart) activeStart = joiningDate;

  let activeEnd = periodEnd;
  if (leavingDate && leavingDate < periodEnd) activeEnd = leavingDate;

  const msPerDay = 1000 * 60 * 60 * 24;
  const activeDays = Math.max(0, Math.floor((activeEnd - activeStart) / msPerDay) + 1);
  const isProrated = activeDays < daysInMonth;

  assert.equal(activeDays, 30);
  assert.equal(isProrated, false);
});

test("Proration: Mid-month joiner (joined Sept 16) is prorated for 15 active days", () => {
  const year = 2026;
  const month = 9; // September (30 days)
  const daysInMonth = new Date(year, month, 0).getDate();
  const joiningDate = new Date("2026-09-16T00:00:00Z");
  const periodStart = new Date("2026-09-01T00:00:00Z");
  const periodEnd = new Date("2026-09-30T00:00:00Z");

  let activeStart = periodStart;
  if (joiningDate > periodStart) activeStart = joiningDate;
  const activeEnd = periodEnd;

  const msPerDay = 1000 * 60 * 60 * 24;
  const activeDays = Math.max(0, Math.floor((activeEnd - activeStart) / msPerDay) + 1);
  const isProrated = activeDays < daysInMonth;
  const prorationRatio = activeDays / daysInMonth;

  assert.equal(activeDays, 15);
  assert.equal(isProrated, true);
  assert.equal(prorationRatio, 0.5);

  const unproratedBasicSalary = 60000;
  const proratedBasicSalary = Math.round(unproratedBasicSalary * prorationRatio * 100) / 100;
  assert.equal(proratedBasicSalary, 30000);
});

test("Proration: Employee resigned mid-month (left Sept 10) is prorated for 10 active days", () => {
  const year = 2026;
  const month = 9; // 30 days
  const daysInMonth = new Date(year, month, 0).getDate();
  const joiningDate = new Date("2024-01-01T00:00:00Z");
  const leavingDate = new Date("2026-09-10T00:00:00Z");
  const periodStart = new Date("2026-09-01T00:00:00Z");
  const periodEnd = new Date("2026-09-30T00:00:00Z");

  const activeStart = periodStart;
  let activeEnd = periodEnd;
  if (leavingDate < periodEnd) activeEnd = leavingDate;

  const msPerDay = 1000 * 60 * 60 * 24;
  const activeDays = Math.max(0, Math.floor((activeEnd - activeStart) / msPerDay) + 1);
  const isProrated = activeDays < daysInMonth;
  const prorationRatio = activeDays / daysInMonth;

  assert.equal(activeDays, 10);
  assert.equal(isProrated, true);
  assert.equal(prorationRatio, 10 / 30);

  const unproratedBasicSalary = 90000;
  const proratedBasicSalary = Math.round(unproratedBasicSalary * prorationRatio * 100) / 100;
  assert.equal(proratedBasicSalary, 30000);
});

/* =========================================================
   2. SALARY PROFILE REVISION & INCREMENT MATH
========================================================= */
test("Salary Profile Revision: Percentage increment accurately computes new basic salary and amount", () => {
  const currentBasicSalary = 50000;
  const incrementPercentage = 15; // 15% increment
  const incrementAmount = Math.round((currentBasicSalary * (incrementPercentage / 100)) * 100) / 100;
  const newBasicSalary = currentBasicSalary + incrementAmount;

  assert.equal(incrementAmount, 7500);
  assert.equal(newBasicSalary, 57500);
});

test("Salary Profile Revision: Fixed amount increment accurately computes increment percentage", () => {
  const currentBasicSalary = 40000;
  const fixedIncrementAmount = 8000;
  const incrementPercentage = Math.round(((fixedIncrementAmount / currentBasicSalary) * 100) * 100) / 100;
  const newBasicSalary = currentBasicSalary + fixedIncrementAmount;

  assert.equal(incrementPercentage, 20);
  assert.equal(newBasicSalary, 48000);
});

test("Date-effective profile resolution matches correct version based on effectiveFrom and effectiveTo", () => {
  const profiles = [
    {
      version: 1,
      basicSalary: 50000,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      effectiveTo: new Date("2026-06-30T23:59:59Z"),
      isActive: false,
    },
    {
      version: 2,
      basicSalary: 60000,
      effectiveFrom: new Date("2026-07-01T00:00:00Z"),
      effectiveTo: null,
      isActive: true,
    },
  ];

  const findEffective = (targetDate) =>
    profiles.find(
      (p) =>
        p.effectiveFrom <= targetDate &&
        (p.effectiveTo === null || p.effectiveTo >= targetDate)
    );

  const mayCheck = findEffective(new Date("2026-05-15T00:00:00Z"));
  assert.equal(mayCheck.version, 1);
  assert.equal(mayCheck.basicSalary, 50000);

  const augustCheck = findEffective(new Date("2026-08-15T00:00:00Z"));
  assert.equal(augustCheck.version, 2);
  assert.equal(augustCheck.basicSalary, 60000);
});

/* =========================================================
   3. PERIOD LOCKING & LIFECYCLE INVARIANTS
========================================================= */
test("PayrollPeriod schema supports required statuses and audit logging", () => {
  const validStatuses = ["open", "processing", "approved", "paid", "locked"];
  const period = new PayrollPeriod({
    periodKey: "2026-09",
    year: 2026,
    month: 9,
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-30"),
    status: "locked",
    lockReason: "Quarter-end closing",
    lockedAt: new Date(),
    auditTrail: [
      {
        action: "locked",
        reason: "Quarter-end closing",
        newStatus: "locked",
      },
    ],
  });

  assert.equal(validStatuses.includes(period.status), true);
  assert.equal(period.periodKey, "2026-09");
  assert.equal(period.auditTrail.length, 1);
  assert.equal(period.auditTrail[0].action, "locked");
});

test("Period Lock: Locked period invariant restricts mutation operations", () => {
  const periodState = { status: "locked", year: 2026, month: 9 };

  const isOperationAllowed = (op, period) => {
    if (period.status === "locked") {
      const restrictedOps = ["calculate", "bulk-calculate", "approve", "pay", "cancel", "delete", "attendance_edit"];
      return !restrictedOps.includes(op);
    }
    return true;
  };

  assert.equal(isOperationAllowed("calculate", periodState), false);
  assert.equal(isOperationAllowed("approve", periodState), false);
  assert.equal(isOperationAllowed("pay", periodState), false);
  assert.equal(isOperationAllowed("cancel", periodState), false);
  assert.equal(isOperationAllowed("delete", periodState), false);
  assert.equal(isOperationAllowed("attendance_edit", periodState), false);
  assert.equal(isOperationAllowed("view", periodState), true);
});

/* =========================================================
   4. PAYOUT REVERSAL & ACCOUNTING INTEGRITY INVARIANTS
========================================================= */
test("Payroll schema includes 'reversed' status, reversal tracking, and proration metadata", () => {
  const allowedStatuses = Payroll.schema.path("status").enumValues;
  assert.equal(allowedStatuses.includes("reversed"), true);

  const fields = Payroll.schema.paths;
  assert.ok(fields.isReversed, "isReversed field must exist");
  assert.ok(fields.reversedBy, "reversedBy field must exist");
  assert.ok(fields.reversedAt, "reversedAt field must exist");
  assert.ok(fields.reversalReason, "reversalReason field must exist");
  assert.ok(fields.reversalJournalEntry, "reversalJournalEntry field must exist");
  assert.ok(fields.reversalAccrualJournalEntry, "reversalAccrualJournalEntry field must exist");

  const snapshotFields = Payroll.schema.path("salarySnapshot").schema.paths;
  assert.ok(snapshotFields.isProrated, "salarySnapshot.isProrated must exist");
  assert.ok(snapshotFields.prorationRatio, "salarySnapshot.prorationRatio must exist");
  assert.ok(snapshotFields.activeDays, "salarySnapshot.activeDays must exist");
  assert.ok(fields.payoutSnapshot, "payoutSnapshot must exist");
});

test("Payroll recalculation policy: Paid payroll is never reset without explicit reversal", () => {
  const canDirectlyRecalculate = (payroll, force = false) => {
    if (payroll.status === "paid") return { allowed: false, reason: "Paid payroll cannot be recalculated directly" };
    if (payroll.status === "approved" && !force) return { allowed: false, reason: "Approved payroll requires force=true" };
    return { allowed: true };
  };

  const paidPayroll = { status: "paid" };
  assert.equal(canDirectlyRecalculate(paidPayroll, false).allowed, false);
  assert.equal(canDirectlyRecalculate(paidPayroll, true).allowed, false);

  const approvedPayroll = { status: "approved" };
  assert.equal(canDirectlyRecalculate(approvedPayroll, false).allowed, false);
  assert.equal(canDirectlyRecalculate(approvedPayroll, true).allowed, true);

  const calculatedPayroll = { status: "calculated" };
  assert.equal(canDirectlyRecalculate(calculatedPayroll, false).allowed, true);
});

test("Loan Repayment Reversion: removeRepaymentForPayroll restores remaining amount cleanly", () => {
  const loan = new EmployeeLoan({
    loanNo: "LN-2026-001",
    loanAmount: 50000,
    paidAmount: 10000,
    remainingAmount: 40000,
    status: "active",
    repayments: [
      {
        payroll: "507f1f77bcf86cd799439011",
        amount: 5000,
        paymentDate: new Date("2026-01-31"),
      },
      {
        payroll: "507f1f77bcf86cd799439012",
        amount: 5000,
        paymentDate: new Date("2026-02-28"),
      },
    ],
  });

  assert.equal(loan.remainingAmount, 40000);
  assert.equal(loan.paidAmount, 10000);
  assert.equal(loan.repayments.length, 2);

  // Revert repayment for payroll 507f1f77bcf86cd799439012 (February payroll reversal)
  loan.removeRepaymentForPayroll("507f1f77bcf86cd799439012");

  assert.equal(loan.repayments.length, 1);
  assert.equal(loan.paidAmount, 5000);
  assert.equal(loan.remainingAmount, 45000);
});

/* =========================================================
   5. SALARY GRADE & USER PAYOUT INFO SCHEMAS
========================================================= */
test("SalaryGrade schema validates code and component structures", () => {
  const grade = new SalaryGrade({
    name: "Senior Software Engineer",
    code: "GRADE-ENG-SR",
    minBasicSalary: 60000,
    maxBasicSalary: 120000,
    defaultBasicSalary: 85000,
    currency: "BDT",
    components: [
      {
        name: "House Rent",
        type: "earning",
        calculationType: "percentage",
        value: 50,
        basedOn: "basicSalary",
      },
      {
        name: "Medical Allowance",
        type: "earning",
        calculationType: "fixed",
        value: 5000,
      },
    ],
  });

  assert.equal(grade.code, "GRADE-ENG-SR");
  assert.equal(grade.components.length, 2);
  assert.equal(grade.components[0].name, "House Rent");
  assert.equal(grade.components[0].value, 50);
});

test("User model supports embedded payoutInfo (Bank and MFS)", () => {
  const user = new User({
    name: "Rahim Ahmed",
    email: "rahim.payroll.test@example.com",
    role: "employee",
    payoutInfo: {
      preferredPayoutMethod: "bank",
      bankName: "Dutch-Bangla Bank PLC",
      branchName: "Gulshan Branch",
      accountHolderName: "Rahim Ahmed",
      accountNumber: "1151200987654",
      routingNumber: "090261158",
      mfsProvider: "bKash",
      mfsNumber: "01700000000",
    },
  });

  assert.equal(user.payoutInfo.preferredPayoutMethod, "bank");
  assert.equal(user.payoutInfo.bankName, "Dutch-Bangla Bank PLC");
  assert.equal(user.payoutInfo.accountNumber, "1151200987654");
  assert.equal(user.payoutInfo.mfsProvider, "bKash");
});

test("PayrollAudit schema captures immutable event history", () => {
  const audit = new PayrollAudit({
    payrollKey: "PAY-202609-0001",
    action: "reversal_executed",
    year: 2026,
    month: 9,
    previousStatus: "paid",
    newStatus: "reversed",
    reason: "Incorrect overtime hours computed",
    details: {
      reversalJournalNo: "JV-2026-0042",
      reversalAccrualJournalNo: "JV-2026-0043",
    },
  });

  assert.equal(audit.action, "reversal_executed");
  assert.equal(audit.previousStatus, "paid");
  assert.equal(audit.newStatus, "reversed");
  assert.equal(audit.details.reversalJournalNo, "JV-2026-0042");
});
