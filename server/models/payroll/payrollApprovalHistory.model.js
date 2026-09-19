import mongoose from "mongoose";

const payrollApprovalHistorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    payroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      required: true,
      index: true,
    },
    payrollPeriod: {
      year: { type: Number, index: true },
      month: { type: Number, index: true },
    },
    cycle: {
      type: Number,
      default: 1,
    },
    stageId: {
      type: String,
      default: "",
    },
    stageName: {
      type: String,
      default: "",
    },
    sequence: {
      type: Number,
      default: 1,
    },
    action: {
      type: String,
      enum: ["submitted", "approved", "rejected", "sent_back", "resubmitted", "cancelled"],
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorRole: {
      type: String,
      default: "",
    },
    actorPermission: {
      type: String,
      default: "",
    },
    previousState: {
      type: String,
      default: "",
    },
    resultingState: {
      type: String,
      default: "",
    },
    comments: {
      type: String,
      trim: true,
      default: "",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

payrollApprovalHistorySchema.index({ payroll: 1, createdAt: 1 });
payrollApprovalHistorySchema.index({ tenantId: 1, createdAt: -1 });

// Immutability safeguards: Prevent accidental modifications or deletion of approval history
payrollApprovalHistorySchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete"],
  function (next) {
    next(new Error("Payroll approval history records are immutable and cannot be updated or deleted."));
  }
);

export default mongoose.models.PayrollApprovalHistory ||
  mongoose.model("PayrollApprovalHistory", payrollApprovalHistorySchema);
