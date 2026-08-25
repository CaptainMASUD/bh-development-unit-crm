import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    bank: { type: mongoose.Schema.Types.ObjectId, ref: "Bank", required: true, index: true },
    ledgerAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    accountName: { type: String, required: true, trim: true },
    accountNameLower: { type: String, trim: true, default: "", index: true },
    accountNumber: { type: String, required: true, trim: true, index: true },
    accountType: {
      type: String,
      enum: ["current", "savings", "fixed_deposit", "loan", "credit_card", "mobile_banking", "other"],
      required: true,
      index: true,
    },
    openingBalance: { type: Number, required: true, min: 0, default: 0 },
    openingBalanceDate: { type: Date, default: null },
    openingJournalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null, index: true },
    signatories: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastReconciledBalance: { type: Number, default: 0 },
    lastReconciledAt: { type: Date, default: null, index: true },
    branchName: { type: String, trim: true, default: "" },
    routingNumber: { type: String, trim: true, default: "", index: true },
    swiftCode: { type: String, trim: true, uppercase: true, default: "", index: true },
    currency: { type: String, trim: true, uppercase: true, default: "BDT", index: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive", "closed"], required: true, default: "active", index: true },
    paymentVersion: { type: Number, min: 0, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

bankAccountSchema.index({ bank: 1, accountNumber: 1 }, { unique: true });
bankAccountSchema.index({ bank: 1, status: 1, accountNameLower: 1, _id: 1 });
bankAccountSchema.index({ status: 1, accountType: 1, accountNameLower: 1, _id: 1 });
bankAccountSchema.index({ ledgerAccount: 1 }, { unique: true, sparse: true });
bankAccountSchema.index(
  { accountName: "text", accountNumber: "text", branchName: "text", routingNumber: "text", swiftCode: "text" },
  { default_language: "none" }
);

bankAccountSchema.pre("validate", function (next) {
  this.accountName = String(this.accountName || "").trim();
  this.accountNameLower = this.accountName.toLowerCase();
  this.accountNumber = String(this.accountNumber || "").trim();
  this.branchName = String(this.branchName || "").trim();
  this.routingNumber = String(this.routingNumber || "").trim();
  this.swiftCode = String(this.swiftCode || "").trim().toUpperCase();
  this.currency = String(this.currency || "").trim().toUpperCase() || "BDT";
  this.description = String(this.description || "").trim();
  next();
});

bankAccountSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = update.$set || update;
  if (patch.accountName !== undefined) {
    patch.accountName = String(patch.accountName || "").trim();
    patch.accountNameLower = patch.accountName.toLowerCase();
  }
  if (patch.accountNumber !== undefined) patch.accountNumber = String(patch.accountNumber || "").trim();
  if (patch.branchName !== undefined) patch.branchName = String(patch.branchName || "").trim();
  if (patch.routingNumber !== undefined) patch.routingNumber = String(patch.routingNumber || "").trim();
  if (patch.swiftCode !== undefined) patch.swiftCode = String(patch.swiftCode || "").trim().toUpperCase();
  if (patch.currency !== undefined) patch.currency = String(patch.currency || "").trim().toUpperCase() || "BDT";
  if (patch.description !== undefined) patch.description = String(patch.description || "").trim();
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export default mongoose.model("BankAccount", bankAccountSchema);
