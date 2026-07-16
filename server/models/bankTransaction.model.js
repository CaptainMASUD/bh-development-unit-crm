import mongoose from "mongoose";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const bankTransactionSchema = new mongoose.Schema(
  {
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    kind: {
      type: String,
      enum: ["deposit", "withdrawal", "transfer_in", "transfer_out", "adjustment", "opening_balance", "bank_charge", "interest"],
      required: true,
      index: true,
    },
    direction: { type: String, enum: ["in", "out"], required: true, index: true },
    amount: { type: Number, required: true, min: 0.01, set: money },
    transactionDate: { type: Date, required: true, default: Date.now, index: true },
    reference: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["draft", "posted", "void"], default: "posted", index: true },
    reconciled: { type: Boolean, default: false, index: true },
    reconciledAt: { type: Date, default: null, index: true },
    reconciliation: { type: mongoose.Schema.Types.ObjectId, ref: "BankReconciliation", default: null, index: true },
    transferGroupId: { type: String, trim: true, default: "", index: true },
    counterpartyAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", default: null, index: true },
    counterpartLedgerAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null, index: true },
    sourceType: {
      type: String,
      enum: ["manual", "money_transfer", "opening_balance", "reconciliation_adjustment", "payroll", "vendor_payment", "customer_payment", "expense"],
      default: "manual",
      index: true,
    },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null, index: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

bankTransactionSchema.index({ bankAccount: 1, transactionDate: -1, _id: -1 });
bankTransactionSchema.index({ status: 1, transactionDate: -1, _id: -1 });
bankTransactionSchema.index({ reconciled: 1, bankAccount: 1, transactionDate: -1, _id: -1 });
bankTransactionSchema.index({ sourceType: 1, transferGroupId: 1, transactionDate: -1 });
bankTransactionSchema.index({ reference: 1, transactionDate: -1 });
bankTransactionSchema.index(
  { reference: "text", description: "text" },
  { default_language: "none" }
);

bankTransactionSchema.pre("validate", function (next) {
  this.reference = String(this.reference || "").trim();
  this.description = String(this.description || "").trim();
  if (!this.direction) {
    this.direction = ["deposit", "transfer_in", "opening_balance", "interest"].includes(this.kind) ? "in" : "out";
  }
  next();
});

export default mongoose.model("BankTransaction", bankTransactionSchema);
