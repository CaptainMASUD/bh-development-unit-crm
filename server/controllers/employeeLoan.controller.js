import mongoose from "mongoose";
import User from "../models/user.model.js";
import EmployeeLoan from "../models/employeeLoan.model.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const clean = (value) => String(value ?? "").trim();

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const isAdminUser = (req) =>
  ["admin", "superadmin"].includes(String(req.user?.role || ""));

const requireAdmin = (req, res) => {
  if (!isAdminUser(req)) {
    res.status(403).json({ message: "Only admin or superadmin can manage employee loans." });
    return false;
  }

  return true;
};

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), MAX_LIMIT);
};

const parseDate = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const parseMonth = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return n;
};

const parseYear = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 2000 || n > 3000) return null;
  return n;
};

const handleDuplicate = (err) => {
  if (err?.code === 11000) {
    return "Duplicate loan number. Please try again.";
  }
  return null;
};

const LOAN_POPULATE = [
  {
    path: "employee",
    select: "name email role employeeId phone isActive avatarUrl department position",
    populate: [
      { path: "department", select: "name isActive" },
      { path: "position", select: "title department isActive" },
    ],
  },
  { path: "department", select: "name isActive" },
  { path: "position", select: "title department isActive" },
  { path: "createdBy", select: "name email role" },
  { path: "updatedBy", select: "name email role" },
  { path: "cancelledBy", select: "name email role" },
  { path: "repayments.createdBy", select: "name email role" },
  { path: "repayments.payroll", select: "payrollKey year month status netPayable paymentDate" },
];

const populateLoanQuery = (query) => query.populate(LOAN_POPULATE);

const loadEmployee = async (employeeId) => {
  if (!isValidObjectId(employeeId)) return null;

  return User.findById(employeeId)
    .select("name email role employeeId isActive department position")
    .lean();
};

const generateLoanNo = async () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");

  const prefix = `EL-${y}${m}${d}`;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const count = await EmployeeLoan.countDocuments({
    createdAt: { $gte: start, $lte: end },
  });

  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
};

const buildLoanFilter = (req) => {
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

  if (req.query.status && ["active", "paid", "cancelled"].includes(String(req.query.status))) {
    filter.status = req.query.status;
  }

  if (req.query.q) {
    const q = clean(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.loanNo = new RegExp(q, "i");
  }

  return filter;
};

const buildStartPeriod = (body = {}, issueDate = new Date()) => {
  const startYear = parseYear(body.startYear) || issueDate.getFullYear();
  const startMonth = parseMonth(body.startMonth) || issueDate.getMonth() + 1;

  return { startYear, startMonth };
};

/* ===============================
   CREATE EMPLOYEE LOAN
   POST /api/employee-loans
================================ */
export const createEmployeeLoan = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const employeeId = clean(req.body.employee || req.body.employeeId);

    if (!employeeId || !isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Valid employee is required." });
    }

    const employee = await loadEmployee(employeeId);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    if (!["employee", "marketing_team"].includes(employee.role)) {
      return res.status(400).json({
        message: "Loan can only be assigned to employee users.",
      });
    }

    if (!employee.isActive) {
      return res.status(400).json({
        message: "Cannot create loan for inactive employee.",
      });
    }

    const loanAmount = roundMoney(req.body.loanAmount);
    const installmentAmount = roundMoney(req.body.installmentAmount);

    if (loanAmount <= 0) {
      return res.status(400).json({ message: "Loan amount must be greater than 0." });
    }

    if (installmentAmount <= 0) {
      return res.status(400).json({ message: "Installment amount must be greater than 0." });
    }

    const issueDate = parseDate(req.body.issueDate, new Date());
    const { startYear, startMonth } = buildStartPeriod(req.body, issueDate);

    const paidAmount = roundMoney(req.body.paidAmount || 0);

    if (paidAmount > loanAmount) {
      return res.status(400).json({
        message: "Paid amount cannot be greater than loan amount.",
      });
    }

    const loan = await EmployeeLoan.create({
      loanNo: req.body.loanNo ? clean(req.body.loanNo).toUpperCase() : await generateLoanNo(),
      employee: employee._id,
      department: employee.department || null,
      position: employee.position || null,
      loanAmount,
      paidAmount,
      remainingAmount: roundMoney(loanAmount - paidAmount),
      installmentAmount,
      issueDate,
      startYear,
      startMonth,
      reason: clean(req.body.reason),
      note: clean(req.body.note),
      status: paidAmount >= loanAmount ? "paid" : "active",
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });

    const full = await populateLoanQuery(EmployeeLoan.findById(loan._id)).lean();

    return res.status(201).json({
      message: "Employee loan created.",
      employeeLoan: full,
    });
  } catch (err) {
    const duplicate = handleDuplicate(err);
    if (duplicate) return res.status(409).json({ message: duplicate });

    return res.status(500).json({
      message: "Server error in createEmployeeLoan.",
      error: err.message,
    });
  }
};

/* ===============================
   LIST EMPLOYEE LOANS
   GET /api/employee-loans
================================ */
export const listEmployeeLoans = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const limit = parseLimit(req.query.limit);
    const page = Math.max(Number(req.query.page || 1), 1);
    const skip = (page - 1) * limit;

    const filter = buildLoanFilter(req);

    const [items, total] = await Promise.all([
      populateLoanQuery(
        EmployeeLoan.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
      ).lean(),
      EmployeeLoan.countDocuments(filter),
    ]);

    return res.json({
      count: items.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      employeeLoans: items,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in listEmployeeLoans.",
      error: err.message,
    });
  }
};

/* ===============================
   GET ONE EMPLOYEE LOAN
   GET /api/employee-loans/:id
================================ */
export const getEmployeeLoanById = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid loan ID." });
    }

    const loan = await populateLoanQuery(EmployeeLoan.findById(req.params.id)).lean();

    if (!loan) {
      return res.status(404).json({ message: "Employee loan not found." });
    }

    return res.json({ employeeLoan: loan });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeeLoanById.",
      error: err.message,
    });
  }
};

/* ===============================
   GET LOANS BY EMPLOYEE
   GET /api/employee-loans/employee/:employeeId
================================ */
export const getEmployeeLoansByEmployee = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const employeeId = req.params.employeeId;

    if (!isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID." });
    }

    const filter = { employee: employeeId };

    if (req.query.status && ["active", "paid", "cancelled"].includes(String(req.query.status))) {
      filter.status = req.query.status;
    }

    const loans = await populateLoanQuery(
      EmployeeLoan.find(filter).sort({ createdAt: -1, _id: -1 })
    ).lean();

    return res.json({
      count: loans.length,
      employeeLoans: loans,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeeLoansByEmployee.",
      error: err.message,
    });
  }
};

/* ===============================
   UPDATE EMPLOYEE LOAN
   PATCH /api/employee-loans/:id
================================ */
export const updateEmployeeLoan = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid loan ID." });
    }

    const loan = await EmployeeLoan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: "Employee loan not found." });
    }

    if (loan.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled loan cannot be updated." });
    }

    if (req.body.installmentAmount !== undefined) {
      const installmentAmount = roundMoney(req.body.installmentAmount);

      if (installmentAmount <= 0) {
        return res.status(400).json({
          message: "Installment amount must be greater than 0.",
        });
      }

      loan.installmentAmount = installmentAmount;
    }

    if (req.body.loanAmount !== undefined) {
      const loanAmount = roundMoney(req.body.loanAmount);

      if (loanAmount <= 0) {
        return res.status(400).json({ message: "Loan amount must be greater than 0." });
      }

      if (loanAmount < Number(loan.paidAmount || 0)) {
        return res.status(400).json({
          message: "Loan amount cannot be lower than already paid amount.",
        });
      }

      loan.loanAmount = loanAmount;
    }

    if (req.body.issueDate !== undefined) {
      loan.issueDate = parseDate(req.body.issueDate, loan.issueDate);
    }

    if (req.body.startYear !== undefined) {
      const startYear = parseYear(req.body.startYear);
      if (!startYear) return res.status(400).json({ message: "Invalid start year." });
      loan.startYear = startYear;
    }

    if (req.body.startMonth !== undefined) {
      const startMonth = parseMonth(req.body.startMonth);
      if (!startMonth) return res.status(400).json({ message: "Invalid start month." });
      loan.startMonth = startMonth;
    }

    if (req.body.reason !== undefined) loan.reason = clean(req.body.reason);
    if (req.body.note !== undefined) loan.note = clean(req.body.note);

    loan.updatedBy = req.user?._id || null;

    await loan.save();

    const full = await populateLoanQuery(EmployeeLoan.findById(loan._id)).lean();

    return res.json({
      message: "Employee loan updated.",
      employeeLoan: full,
    });
  } catch (err) {
    const duplicate = handleDuplicate(err);
    if (duplicate) return res.status(409).json({ message: duplicate });

    return res.status(500).json({
      message: "Server error in updateEmployeeLoan.",
      error: err.message,
    });
  }
};

/* ===============================
   CANCEL EMPLOYEE LOAN
   PATCH /api/employee-loans/:id/cancel
================================ */
export const cancelEmployeeLoan = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid loan ID." });
    }

    const loan = await EmployeeLoan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: "Employee loan not found." });
    }

    if (loan.status === "paid") {
      return res.status(400).json({ message: "Paid loan cannot be cancelled." });
    }

    loan.status = "cancelled";
    loan.cancelReason = clean(req.body.cancelReason || req.body.reason);
    loan.cancelledBy = req.user?._id || null;
    loan.cancelledAt = new Date();
    loan.updatedBy = req.user?._id || null;

    await loan.save();

    const full = await populateLoanQuery(EmployeeLoan.findById(loan._id)).lean();

    return res.json({
      message: "Employee loan cancelled.",
      employeeLoan: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in cancelEmployeeLoan.",
      error: err.message,
    });
  }
};

/* ===============================
   MANUAL PAYMENT
   POST /api/employee-loans/:id/manual-payment
================================ */
export const addManualLoanPayment = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid loan ID." });
    }

    const loan = await EmployeeLoan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: "Employee loan not found." });
    }

    const amount = roundMoney(req.body.amount);

    if (amount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than 0." });
    }

    loan.addRepayment({
      amount,
      method: "manual",
      paymentDate: parseDate(req.body.paymentDate, new Date()),
      transactionRef: clean(req.body.transactionRef),
      note: clean(req.body.note),
      createdBy: req.user?._id || null,
    });

    loan.updatedBy = req.user?._id || null;

    await loan.save();

    const full = await populateLoanQuery(EmployeeLoan.findById(loan._id)).lean();

    return res.json({
      message: "Manual loan payment added.",
      employeeLoan: full,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in addManualLoanPayment.",
      error: err.message,
    });
  }
};

/* ===============================
   EMPLOYEE SELF VIEW
   GET /api/employee-loans/me
================================ */
export const getMyEmployeeLoans = async (req, res) => {
  try {
    const loans = await populateLoanQuery(
      EmployeeLoan.find({ employee: req.user?._id })
        .sort({ createdAt: -1, _id: -1 })
    ).lean();

    return res.json({
      count: loans.length,
      employeeLoans: loans,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getMyEmployeeLoans.",
      error: err.message,
    });
  }
};

/* ===============================
   PAYROLL HELPERS
   Used by payroll.controller.js
================================ */
export const getEmployeeLoanDeductionsForPayroll = async ({ employeeId, year, month }) => {
  const y = Number(year);
  const m = Number(month);

  const loans = await EmployeeLoan.find({
    employee: employeeId,
    status: "active",
    remainingAmount: { $gt: 0 },
    $or: [
      { startYear: { $lt: y } },
      { startYear: y, startMonth: { $lte: m } },
    ],
  })
    .sort({ issueDate: 1, createdAt: 1 })
    .lean();

  return loans
    .map((loan) => {
      const amount = roundMoney(
        Math.min(Number(loan.installmentAmount || 0), Number(loan.remainingAmount || 0))
      );

      if (amount <= 0) return null;

      return {
        name: `Employee Loan Deduction - ${loan.loanNo}`,
        type: "deduction",
        source: "employee_loan",
        calculationType: "fixed",
        value: amount,
        quantity: 1,
        basedOn: "manual",
        amount,
        note: `Auto deduction for employee loan ${loan.loanNo}`,
        refModel: "EmployeeLoan",
        refId: loan._id,
        meta: {
          loanNo: loan.loanNo,
          loanAmount: loan.loanAmount,
          remainingBeforeDeduction: loan.remainingAmount,
        },
      };
    })
    .filter(Boolean);
};

export const applyPayrollLoanRepayments = async ({ payroll, requesterId = null }) => {
  if (!payroll || payroll.status !== "paid") return;

  const loanDeductions = (payroll.deductions || []).filter(
    (item) => item.source === "employee_loan" && item.refId
  );

  for (const item of loanDeductions) {
    const loan = await EmployeeLoan.findById(item.refId);

    if (!loan || loan.status !== "active") continue;

    const alreadyApplied = loan.repayments.some(
      (repayment) => String(repayment.payroll || "") === String(payroll._id)
    );

    if (alreadyApplied) continue;

    loan.addRepayment({
      amount: item.amount,
      method: "payroll",
      payroll: payroll._id,
      year: payroll.year,
      month: payroll.month,
      paymentDate: payroll.paymentDate || payroll.paidAt || new Date(),
      transactionRef: payroll.transactionRef || "",
      note: `Deducted from payroll ${payroll.payrollKey}`,
      createdBy: requesterId,
    });

    loan.updatedBy = requesterId || null;

    await loan.save();
  }
};
