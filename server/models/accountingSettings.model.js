import mongoose from "mongoose";

const accountingSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "company", unique: true, immutable: true },
    fiscalYearStartMonth: { type: Number, min: 1, max: 12, default: 7 },
    defaultFiscalYear: { type: mongoose.Schema.Types.ObjectId, ref: "FiscalYear", default: null },
    currency: { type: String, trim: true, uppercase: true, default: "BDT" },
    defaultCashAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    defaultBankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    salesAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    purchaseAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    receivableAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    payableAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    vatAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    voucherPrefix: { type: String, trim: true, uppercase: true, default: "JV" },
    voucherNumberLength: { type: Number, min: 3, max: 12, default: 6 },
    voucherReset: { type: String, enum: ["never", "fiscal_year", "calendar_year", "monthly"], default: "fiscal_year" },
    voucherFormat: { type: String, trim: true, default: "{PREFIX}-{FY}-{NUMBER}" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("AccountingSettings", accountingSettingsSchema);
