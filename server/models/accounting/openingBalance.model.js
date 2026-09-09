import mongoose from "mongoose";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const partySplitSchema = new mongoose.Schema(
  {
    partyType: { type: String, enum: ["customer", "supplier", "other"], required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    partyName: { type: String, trim: true, default: "" },
    debit: { type: Number, min: 0, default: 0, set: roundMoney },
    credit: { type: Number, min: 0, default: 0, set: roundMoney },
  },
  { _id: true }
);

const openingBalanceLineSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    debit: { type: Number, min: 0, default: 0, set: roundMoney },
    credit: { type: Number, min: 0, default: 0, set: roundMoney },
    description: { type: String, trim: true, default: "Opening balance" },
    partySplits: { type: [partySplitSchema], default: [] },
  },
  { _id: true }
);

const openingBalanceSchema = new mongoose.Schema(
  {
    fiscalYear: { type: mongoose.Schema.Types.ObjectId, ref: "FiscalYear", required: true },
    date: { type: Date, required: true, index: true },
    referenceType: { type: String, enum: ["manual", "carried_forward"], default: "manual" },
    reference: { type: String, trim: true, default: "" },
    memo: { type: String, trim: true, default: "Opening balances" },
    currency: { type: String, trim: true, uppercase: true, default: "BDT" },
    status: { type: String, enum: ["draft", "posted"], default: "draft", index: true },
    lines: { type: [openingBalanceLineSchema], default: [] },
    totalDebit: { type: Number, min: 0, default: 0, set: roundMoney },
    totalCredit: { type: Number, min: 0, default: 0, set: roundMoney },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    postedAt: { type: Date, default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

openingBalanceSchema.index({ fiscalYear: 1 }, { unique: true });
openingBalanceSchema.pre("validate", function (next) {
  this.totalDebit = roundMoney((this.lines || []).reduce((sum, line) => sum + Number(line.debit || 0), 0));
  this.totalCredit = roundMoney((this.lines || []).reduce((sum, line) => sum + Number(line.credit || 0), 0));
  next();
});

export default mongoose.model("OpeningBalance", openingBalanceSchema);
