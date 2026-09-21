import mongoose from "mongoose";

const accountingPeriodSchema = new mongoose.Schema(
  {
    periodKey: { type: String, required: true, trim: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },
    fiscalYearRef: { type: mongoose.Schema.Types.ObjectId, ref: "FiscalYear", default: null, index: true },
    periodType: { type: String, enum: ["monthly", "quarterly", "custom"], default: "monthly" },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ["open", "soft_closed", "closed", "locked"], default: "open", index: true },
    softClosedAt: { type: Date, default: null },
    softClosedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    softCloseReason: { type: String, trim: true, default: "" },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closeReason: { type: String, trim: true, default: "" },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lockReason: { type: String, trim: true, default: "" },
    reopenedAt: { type: Date, default: null },
    reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reopenReason: { type: String, trim: true, default: "" },
    unlockedAt: { type: Date, default: null },
    unlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    unlockReason: { type: String, trim: true, default: "" },
    overrideLog: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        userName: { type: String, trim: true, default: "" },
        reason: { type: String, trim: true, default: "" },
        postingDate: { type: Date, default: null },
        action: { type: String, trim: true, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

accountingPeriodSchema.index({ periodKey: 1 }, { unique: true });
accountingPeriodSchema.index({ status: 1, startDate: -1, _id: -1 });
accountingPeriodSchema.index({ startDate: 1, endDate: 1, status: 1 });

export default mongoose.model("AccountingPeriod", accountingPeriodSchema);
