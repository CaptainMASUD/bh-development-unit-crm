import mongoose from "mongoose";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const payrollComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["earning", "deduction"],
      required: true,
    },

    source: {
      type: String,
      enum: [
        "basic_salary",
        "salary_profile",
        "attendance",
        "manual",
        "system",
        "employee_loan",
        "tax",
      ],
      default: "manual",
      index: true,
    },

    calculationType: {
      type: String,
      enum: ["fixed", "percentage", "per_day", "per_hour", "per_minute", "variable"],
      default: "fixed",
    },

    value: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },

    basedOn: {
      type: String,
      enum: ["basicSalary", "grossSalary", "netSalary", "manual"],
      default: "manual",
    },

    amount: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    refModel: {
      type: String,
      enum: ["", "EmployeeLoan"],
      default: "",
    },

    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    meta: {
      type: Object,
      default: {},
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

const salarySnapshotSchema = new mongoose.Schema(
  {
    salaryType: {
      type: String,
      enum: ["monthly", "daily", "hourly"],
      default: "monthly",
    },

    currency: {
      type: String,
      default: "BDT",
      trim: true,
      uppercase: true,
    },

    basicSalary: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    workingDaysPerMonth: {
      type: Number,
      default: 26,
    },

    workingHoursPerDay: {
      type: Number,
      default: 8,
    },

    components: {
      type: Array,
      default: [],
    },

    rules: {
      type: Object,
      default: {},
    },

    taxProfile: {
      type: Object,
      default: {},
    },
  },
  { _id: false }
);

const attendanceSummarySchema = new mongoose.Schema(
  {
    totalRecords: { type: Number, default: 0 },

    presentDays: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    weeklyHolidayDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },

    payableDays: { type: Number, default: 0 },
    absentDeductionDays: { type: Number, default: 0 },
    unpaidLeaveDeductionDays: { type: Number, default: 0 },
    lateDeductibleCount: { type: Number, default: 0 },

    totalWorkMinutes: { type: Number, default: 0 },
    totalLateMinutes: { type: Number, default: 0 },
    totalOvertimeMinutes: { type: Number, default: 0 },
    approvedOvertimeMinutes: { type: Number, default: 0 },
    approvedOvertimeHours: { type: Number, default: 0 },
  },
  { _id: false }
);

const rosterSummarySchema = new mongoose.Schema(
  {
    year: { type: Number, default: 0 },
    month: { type: Number, default: 0 },
    rosteredDays: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    weeklyOffDays: { type: Number, default: 0 },
    holidayDays: { type: Number, default: 0 },
    attendedDays: { type: Number, default: 0 },
    rosterAbsentDays: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    schedule: { type: Array, default: [] },
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    payrollKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },

    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      default: null,
      index: true,
    },

    salaryProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryProfile",
      required: true,
      index: true,
    },

    year: {
      type: Number,
      required: true,
      index: true,
    },

    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },

    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    currency: {
      type: String,
      default: "BDT",
      trim: true,
      uppercase: true,
    },

    salarySnapshot: {
      type: salarySnapshotSchema,
      required: true,
    },

    attendanceSummary: {
      type: attendanceSummarySchema,
      default: () => ({}),
    },

    rosterSummary: {
      type: rosterSummarySchema,
      default: () => ({}),
    },

    earnings: {
      type: [payrollComponentSchema],
      default: [],
    },

    deductions: {
      type: [payrollComponentSchema],
      default: [],
    },

    basicSalary: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    totalEarnings: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    grossSalary: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    totalDeductions: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    taxDeduction: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    taxRemitted: {
      type: Boolean,
      default: false,
      index: true,
    },

    taxRemittedAt: {
      type: Date,
      default: null,
    },

    taxRemittanceRef: {
      type: String,
      trim: true,
      default: "",
    },

    otherDeductions: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    totalDeduction: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    netPayable: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    netSalary: {
      type: Number,
      default: 0,
      set: roundMoney,
    },

    status: {
      type: String,
      enum: ["draft", "calculated", "approved", "paid", "cancelled"],
      default: "calculated",
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "mobile_banking", "cheque", "other", ""],
      default: "",
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    transactionRef: {
      type: String,
      trim: true,
      default: "",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    calculatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

payrollSchema.index({ employee: 1, year: 1, month: 1 }, { unique: true });
payrollSchema.index({ department: 1, year: 1, month: 1 });
payrollSchema.index({ status: 1, year: 1, month: 1 });
payrollSchema.index({ createdAt: -1, _id: -1 });
payrollSchema.index({ employee: 1, year: -1, month: -1, createdAt: -1, _id: -1 });
payrollSchema.index({ department: 1, year: -1, month: -1, createdAt: -1, _id: -1 });
payrollSchema.index({ position: 1, year: -1, month: -1, createdAt: -1, _id: -1 });
payrollSchema.index({ status: 1, year: -1, month: -1, createdAt: -1, _id: -1 });

payrollSchema.methods.recalculateTotals = function () {
  const earningsTotal = this.earnings.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const deductionsTotal = this.deductions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  this.basicSalary = roundMoney(this.salarySnapshot?.basicSalary || this.basicSalary || 0);
  this.totalEarnings = roundMoney(earningsTotal);
  this.grossSalary = roundMoney(earningsTotal);
  this.totalDeductions = roundMoney(deductionsTotal);
  this.taxDeduction = roundMoney(
    this.deductions
      .filter((item) => item.source === "tax")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  this.otherDeductions = roundMoney(deductionsTotal - this.taxDeduction);
  this.totalDeduction = this.totalDeductions;
  this.netPayable = roundMoney(earningsTotal - deductionsTotal);
  this.netSalary = this.netPayable;

  return this;
};

payrollSchema.pre("validate", function (next) {
  if (this.employee && this.year && this.month) {
    this.payrollKey = `${String(this.employee)}-${this.year}-${String(this.month).padStart(2, "0")}`;
  }

  this.currency = String(this.currency || "BDT").trim().toUpperCase();

  this.recalculateTotals();

  next();
});

export default mongoose.model("Payroll", payrollSchema);
