import mongoose from "mongoose";

const fiscalYearSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    periodFrequency: { type: String, enum: ["monthly", "quarterly"], default: "monthly" },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    isActive: { type: Boolean, default: true, index: true },
    note: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

fiscalYearSchema.index({ startDate: 1, endDate: 1 }, { unique: true });

export default mongoose.model("FiscalYear", fiscalYearSchema);
