import mongoose from "mongoose";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

export const PAYMENT_TERM_TYPES = [
  "IMMEDIATE",
  "NET_DAYS",
  "END_OF_MONTH",
  "FIXED_DAY_NEXT_MONTH",
  "INSTALLMENT",
  "MILESTONE",
  "CUSTOM",
];

export const CALCULATION_TYPES = ["PERCENTAGE", "FIXED_AMOUNT", "REMAINING_BALANCE"];

export const DUE_RULES = [
  "IMMEDIATE",
  "DAYS_AFTER_INVOICE",
  "DAYS_AFTER_BILL",
  "DAYS_AFTER_DELIVERY",
  "END_OF_MONTH",
  "FIXED_DAY_NEXT_MONTH",
  "FIXED_DATE",
  "MILESTONE",
];

export const MILESTONE_TYPES = [
  "advance",
  "delivery",
  "approval",
  "go_live",
  "completion",
  "custom",
];

export const SCHEDULE_STATUSES = [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "PENDING_TRIGGER",
  "CANCELLED",
];

export const paymentTermRuleSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true, default: "" },
    calculationType: {
      type: String,
      enum: CALCULATION_TYPES,
      default: "PERCENTAGE",
      required: true,
    },
    value: { type: Number, min: 0, default: 0, set: roundMoney },
    dueRule: {
      type: String,
      enum: DUE_RULES,
      default: "DAYS_AFTER_INVOICE",
      required: true,
    },
    days: { type: Number, min: 0, max: 3650, default: 0 },
    fixedDate: { type: Date, default: null },
    fixedDay: { type: Number, min: 1, max: 31, default: null },
    milestoneType: {
      type: String,
      enum: MILESTONE_TYPES,
      default: "custom",
    },
    milestoneName: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

export const paymentScheduleLineSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true, default: "" },
    dueDate: { type: Date, default: null },
    originalAmount: { type: Number, required: true, min: 0, set: roundMoney },
    paidAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    creditedAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    debitedAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    adjustedAmount: { type: Number, default: 0, set: roundMoney },
    outstandingAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    status: {
      type: String,
      enum: SCHEDULE_STATUSES,
      default: "PENDING",
    },
    sourceRule: { type: mongoose.Schema.Types.Mixed, default: null },
    milestoneType: { type: String, trim: true, default: "" },
    milestoneCompleted: { type: Boolean, default: false },
    milestoneCompletedAt: { type: Date, default: null },
  },
  { _id: true }
);

const paymentTermSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 60,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    termType: {
      type: String,
      enum: PAYMENT_TERM_TYPES,
      required: true,
      default: "NET_DAYS",
      index: true,
    },
    applicableTo: {
      type: String,
      enum: ["all", "sales", "purchase"],
      default: "all",
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isPredefined: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    rules: {
      type: [paymentTermRuleSchema],
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
  },
  { timestamps: true }
);

paymentTermSchema.index({ tenantId: 1, code: 1 }, { unique: true });
paymentTermSchema.index({ tenantId: 1, isActive: 1, applicableTo: 1 });

export const PaymentTerm =
  mongoose.models.PaymentTerm || mongoose.model("PaymentTerm", paymentTermSchema);

export default PaymentTerm;
