import mongoose from "mongoose";

const payrollAuditSchema = new mongoose.Schema(
  {
    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
      index: true,
    },

    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    payrollKey: {
      type: String,
      default: "",
      index: true,
    },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      index: true,
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    performedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    previousStatus: {
      type: String,
      default: "",
    },

    newStatus: {
      type: String,
      default: "",
    },

    reason: {
      type: String,
      default: "",
      trim: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

payrollAuditSchema.index({ action: 1, performedAt: -1 });
payrollAuditSchema.index({ tenantId: 1, performedAt: -1 });
payrollAuditSchema.index({ employee: 1, year: 1, month: 1, performedAt: -1 });
payrollAuditSchema.index({ year: 1, month: 1, action: 1 });

export default mongoose.model("PayrollAudit", payrollAuditSchema);
