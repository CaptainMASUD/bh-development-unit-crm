import mongoose from "mongoose";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const loanRepaymentSchema = new mongoose.Schema(
  {
    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
      index: true,
    },

    year: {
      type: Number,
      default: null,
      index: true,
    },

    month: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
      set: roundMoney,
    },

    method: {
      type: String,
      enum: ["payroll", "manual"],
      default: "manual",
      index: true,
    },

    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: true }
);

const employeeLoanSchema = new mongoose.Schema(
  {
    loanNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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

    loanAmount: {
      type: Number,
      required: true,
      min: 1,
      set: roundMoney,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
    },

    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
      index: true,
    },

    installmentAmount: {
      type: Number,
      required: true,
      min: 1,
      set: roundMoney,
    },

    issueDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    startYear: {
      type: Number,
      required: true,
      index: true,
    },

    startMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },

    reason: {
      type: String,
      trim: true,
      default: "",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "paid", "cancelled"],
      default: "active",
      index: true,
    },

    repayments: {
      type: [loanRepaymentSchema],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

/* ===============================
   Indexes
================================ */
employeeLoanSchema.index({ employee: 1, status: 1, createdAt: -1 });
employeeLoanSchema.index({ employee: 1, startYear: 1, startMonth: 1, status: 1 });
employeeLoanSchema.index({ department: 1, status: 1, createdAt: -1 });
employeeLoanSchema.index({ position: 1, status: 1, createdAt: -1 });
employeeLoanSchema.index({ status: 1, remainingAmount: 1 });
employeeLoanSchema.index({ employee: 1, createdAt: -1, _id: -1 });
employeeLoanSchema.index({ status: 1, createdAt: -1, _id: -1 });
employeeLoanSchema.index({ department: 1, createdAt: -1, _id: -1 });
employeeLoanSchema.index({ position: 1, createdAt: -1, _id: -1 });

/* ===============================
   Validation / normalization
================================ */
employeeLoanSchema.pre("validate", function (next) {
  this.loanNo = String(this.loanNo || "").trim().toUpperCase();

  this.loanAmount = roundMoney(this.loanAmount);
  this.paidAmount = roundMoney(this.paidAmount);
  this.installmentAmount = roundMoney(this.installmentAmount);

  if (this.loanAmount <= 0) {
    return next(new Error("Loan amount must be greater than 0."));
  }

  if (this.installmentAmount <= 0) {
    return next(new Error("Installment amount must be greater than 0."));
  }

  if (this.paidAmount > this.loanAmount) {
    return next(new Error("Paid amount cannot be greater than loan amount."));
  }

  this.remainingAmount = roundMoney(this.loanAmount - this.paidAmount);

  if (this.remainingAmount <= 0 && this.status !== "cancelled") {
    this.status = "paid";
    this.remainingAmount = 0;
  }

  next();
});

/* ===============================
   Helpers
================================ */
employeeLoanSchema.methods.addRepayment = function ({
  amount,
  method = "manual",
  payroll = null,
  year = null,
  month = null,
  paymentDate = new Date(),
  transactionRef = "",
  note = "",
  createdBy = null,
}) {
  const repaymentAmount = roundMoney(amount);

  if (repaymentAmount <= 0) {
    throw new Error("Repayment amount must be greater than 0.");
  }

  if (this.status === "cancelled") {
    throw new Error("Cancelled loan cannot receive repayments.");
  }

  if (this.remainingAmount <= 0) {
    throw new Error("Loan is already paid.");
  }

  const finalAmount = Math.min(repaymentAmount, Number(this.remainingAmount || 0));

  this.repayments.push({
    payroll,
    year,
    month,
    amount: finalAmount,
    method,
    paymentDate,
    transactionRef,
    note,
    createdBy,
  });

  this.paidAmount = roundMoney(Number(this.paidAmount || 0) + finalAmount);
  this.remainingAmount = roundMoney(Number(this.loanAmount || 0) - Number(this.paidAmount || 0));

  if (this.remainingAmount <= 0) {
    this.remainingAmount = 0;
    this.status = "paid";
  }

  return this;
};

export default mongoose.model("EmployeeLoan", employeeLoanSchema);
