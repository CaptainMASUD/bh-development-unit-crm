import mongoose from "mongoose";

const roundMoney = (value) => {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
};

const taxSlabSchema = new mongoose.Schema(
  {
    fiscalYear: { type: String, required: true, trim: true, index: true },
    taxpayerType: { type: String, required: true, trim: true, default: "general", index: true },
    minIncome: { type: Number, required: true, min: 0, set: roundMoney },
    maxIncome: { type: Number, default: null, min: 0, set: (v) => (v === null || v === "" ? null : roundMoney(v)) },
    rate: { type: Number, default: 0, min: 0 },
    fixedAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

taxSlabSchema.index({ fiscalYear: 1, taxpayerType: 1, minIncome: 1 });

taxSlabSchema.pre("validate", function (next) {
  this.fiscalYear = String(this.fiscalYear || "").trim();
  this.taxpayerType = String(this.taxpayerType || "general").trim().toLowerCase();
  if (this.maxIncome !== null && Number(this.maxIncome) <= Number(this.minIncome || 0)) {
    this.invalidate("maxIncome", "Max income must be greater than min income.");
  }
  next();
});

export default mongoose.model("TaxSlab", taxSlabSchema);
