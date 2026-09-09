import mongoose from "mongoose";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const statementLineSchema = new mongoose.Schema(
  {
    statementDate: { type: Date, required: true },
    description: { type: String, trim: true, default: "" },
    reference: { type: String, trim: true, default: "" },
    direction: { type: String, enum: ["in", "out"], required: true },
    amount: { type: Number, required: true, min: 0.01, set: money },
    matchedJournalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    matchMethod: { type: String, enum: ["", "auto", "manual", "created"], default: "" },
    matchedAt: { type: Date, default: null },
  },
  { _id: true }
);

const bankReconciliationSchema = new mongoose.Schema(
  {
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    statementDate: { type: Date, required: true, index: true },
    statementBalance: { type: Number, required: true, set: money },
    bookBalance: { type: Number, required: true, set: money },
    difference: { type: Number, required: true, set: money },
    status: { type: String, enum: ["draft", "in_progress", "completed", "reconciled", "void"], default: "in_progress", index: true },
    notes: { type: String, trim: true, default: "" },
    statementLines: { type: [statementLineSchema], default: [] },
    adjustedBankBalance: { type: Number, default: 0, set: money },
    adjustedBookBalance: { type: Number, default: 0, set: money },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null, index: true },
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
  if (["reconciled", "completed"].includes(this.status) && !this.reconciledAt) this.reconciledAt = new Date();
  next();
});

export default mongoose.model("BankReconciliation", bankReconciliationSchema);
