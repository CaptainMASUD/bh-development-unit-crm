import mongoose from "mongoose";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const journalLineSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    debit: { type: Number, default: 0, min: 0, set: roundMoney },
    credit: { type: Number, default: 0, min: 0, set: roundMoney },
    description: { type: String, trim: true, default: "" },
    contactType: { type: String, enum: ["customer", "vendor", "employee", "other", ""], default: "", index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  },
  { _id: true }
);

const journalEntrySchema = new mongoose.Schema(
  {
    entryNo: { type: String, trim: true, default: "", index: true },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: ["draft", "posted", "void"], default: "draft", index: true },
    sourceType: {
      type: String,
      enum: ["manual", "opening_balance", "fiscal_closing", "invoice", "customer_payment", "vendor_bill", "vendor_payment", "expense", "bank_transfer", "tax", "payroll"],
      default: "manual",
      index: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    reference: { type: String, trim: true, default: "", index: true },
    memo: { type: String, trim: true, default: "" },
    currency: { type: String, trim: true, default: "BDT", index: true },
    lines: { type: [journalLineSchema], validate: [(v) => Array.isArray(v) && v.length >= 2, "At least two journal lines are required."] },
    totalDebit: { type: Number, default: 0, min: 0, set: roundMoney },
    totalCredit: { type: Number, default: 0, min: 0, set: roundMoney },
    postedAt: { type: Date, default: null, index: true },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

journalEntrySchema.index({ entryNo: 1 }, { unique: true, sparse: true });
journalEntrySchema.index({ status: 1, date: -1, _id: -1 });
journalEntrySchema.index({ sourceType: 1, sourceId: 1, status: 1 });
journalEntrySchema.index({ "lines.account": 1, date: -1, _id: -1 });
journalEntrySchema.index({ reference: 1, date: -1 });

journalEntrySchema.pre("validate", function (next) {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of this.lines || []) {
    line.debit = roundMoney(line.debit);
    line.credit = roundMoney(line.credit);
    if (line.debit > 0 && line.credit > 0) return next(new Error("A journal line cannot contain both debit and credit."));
    if (line.debit <= 0 && line.credit <= 0) return next(new Error("Each journal line needs either a debit or credit amount."));
    totalDebit += Number(line.debit || 0);
    totalCredit += Number(line.credit || 0);
  }
  this.totalDebit = roundMoney(totalDebit);
  this.totalCredit = roundMoney(totalCredit);
  if (this.status === "posted" && this.totalDebit !== this.totalCredit) {
    return next(new Error("Posted journal entries must balance total debit and total credit."));
  }
  if (this.status === "posted" && !this.postedAt) this.postedAt = new Date();
  if (!this.entryNo && this.status === "posted") {
    const y = new Date(this.date || Date.now()).getFullYear();
    this.entryNo = `JE-${y}-${Date.now()}-${String(this._id).slice(-4).toUpperCase()}`;
  }
  next();
});

export default mongoose.model("JournalEntry", journalEntrySchema);
