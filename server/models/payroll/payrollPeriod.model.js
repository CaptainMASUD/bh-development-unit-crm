import mongoose from "mongoose";

const payrollPeriodSchema = new mongoose.Schema(
  {
    periodKey: {
      type: String,
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

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["open", "processing", "approved", "paid", "locked"],
      default: "open",
      index: true,
    },

    totalEmployees: {
      type: Number,
      default: 0,
    },

    totalGross: {
      type: Number,
      default: 0,
    },

    totalNet: {
      type: Number,
      default: 0,
    },

    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lockedAt: {
      type: Date,
      default: null,
    },

    lockReason: {
      type: String,
      trim: true,
      default: "",
    },

    unlockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    unlockedAt: {
      type: Date,
      default: null,
    },

    unlockReason: {
      type: String,
      trim: true,
      default: "",
    },

    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        performedAt: { type: Date, default: Date.now },
        previousStatus: { type: String, default: "" },
        newStatus: { type: String, default: "" },
        reason: { type: String, default: "" },
        note: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

payrollPeriodSchema.index({ year: 1, month: 1 });
payrollPeriodSchema.index({ status: 1, year: 1, month: 1 });

payrollPeriodSchema.pre("validate", function (next) {
  if (this.year && this.month) {
    this.periodKey = `${this.year}-${String(this.month).padStart(2, "0")}`;
  }
  next();
});

export default mongoose.model("PayrollPeriod", payrollPeriodSchema);
