import mongoose from "mongoose";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const bankReconciliationSchema = new mongoose.Schema(
  {
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    statementDate: { type: Date, required: true, index: true },
    statementBalance: { type: Number, required: true, set: money },
    bookBalance: { type: Number, required: true, set: money },
    difference: { type: Number, required: true, set: money },
    status: { type: String, enum: ["draft", "reconciled", "void"], default: "draft", index: true },
    notes: { type: String, trim: true, default: "" },
    transactionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "BankTransaction" }],
    reconciledAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

bankReconciliationSchema.index({ bankAccount: 1, statementDate: -1, _id: -1 });
bankReconciliationSchema.index({ status: 1, statementDate: -1, _id: -1 });

bankReconciliationSchema.pre("validate", function (next) {
  this.notes = String(this.notes || "").trim();
  if (this.status === "reconciled" && !this.reconciledAt) this.reconciledAt = new Date();
  next();
});

export default mongoose.model("BankReconciliation", bankReconciliationSchema);
