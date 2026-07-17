import mongoose from "mongoose";

const cashAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, trim: true, default: "", index: true },
    type: { type: String, enum: ["cash", "bank", "mobile_banking", "card", "other"], default: "bank", index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    currency: { type: String, trim: true, default: "BDT", index: true },
    institution: { type: String, trim: true, default: "" },
    accountNo: { type: String, trim: true, default: "" },
    openingBalance: { type: Number, default: 0 },
    location: { type: String, trim: true, default: "" },
    custodian: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    minimumBalance: { type: Number, min: 0, default: 0 },
    maximumBalance: { type: Number, min: 0, default: 0 },
    lastReconciledAt: { type: Date, default: null },
    lastReconciledBalance: { type: Number, default: 0 },
    lastVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastVerificationNote: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

cashAccountSchema.index({ type: 1, isActive: 1, nameLower: 1, _id: 1 });
cashAccountSchema.index({ account: 1 }, { unique: true });

cashAccountSchema.pre("validate", function (next) {
  this.name = String(this.name || "").trim();
  this.nameLower = this.name.toLowerCase();
  this.location = String(this.location || "").trim();
  this.lastVerificationNote = String(this.lastVerificationNote || "").trim();
  if (this.maximumBalance > 0 && this.minimumBalance > this.maximumBalance) {
    return next(new Error("Maximum cash balance must be greater than the minimum balance."));
  }
  next();
});

export default mongoose.model("CashAccount", cashAccountSchema);
