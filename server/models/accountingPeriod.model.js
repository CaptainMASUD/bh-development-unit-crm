import mongoose from "mongoose";

const accountingPeriodSchema = new mongoose.Schema(
  {
    periodKey: { type: String, required: true, trim: true, index: true },
    fiscalYear: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ["open", "closed", "locked"], default: "open", index: true },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

accountingPeriodSchema.index({ periodKey: 1 }, { unique: true });
accountingPeriodSchema.index({ status: 1, startDate: -1, _id: -1 });
accountingPeriodSchema.index({ startDate: 1, endDate: 1, status: 1 });

export default mongoose.model("AccountingPeriod", accountingPeriodSchema);
