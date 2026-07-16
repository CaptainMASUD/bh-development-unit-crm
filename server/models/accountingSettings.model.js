import mongoose from "mongoose";

const numberingRuleSchema = new mongoose.Schema(
  {
    prefix: { type: String, trim: true, uppercase: true, default: "" },
    digitLength: { type: Number, min: 3, max: 12, default: 6 },
    reset: { type: String, enum: ["never", "fiscal_year", "calendar_year", "monthly"], default: "fiscal_year" },
    format: { type: String, trim: true, default: "{PREFIX}-{FY}-{NUMBER}" },
  },
  { _id: false }
);

const accountingSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "company", unique: true, immutable: true },
    legalName: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    taxId: { type: String, trim: true, default: "" },
    vatRegistrationNumber: { type: String, trim: true, default: "" },
    fiscalYearStartMonth: { type: Number, min: 1, max: 12, default: 7 },
    fiscalYearStartDay: { type: Number, min: 1, max: 31, default: 1 },
    defaultFiscalYear: { type: mongoose.Schema.Types.ObjectId, ref: "FiscalYear", default: null },
    currency: { type: String, trim: true, uppercase: true, default: "BDT" },
    multiCurrencyEnabled: { type: Boolean, default: false },
    accountingMethod: { type: String, enum: ["accrual", "cash"], default: "accrual" },
    roundingPrecision: { type: Number, min: 0, max: 6, default: 2 },
    defaultCashAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    defaultBankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    salesAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    purchaseAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    receivableAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    payableAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    retainedEarningsAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    exchangeGainAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    exchangeLossAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    roundingAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    vatPayableAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    vatReceivableAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    vatAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null }, // legacy compatibility
    voucherPrefix: { type: String, trim: true, uppercase: true, default: "JV" },
    voucherNumberLength: { type: Number, min: 3, max: 12, default: 6 },
    voucherReset: { type: String, enum: ["never", "fiscal_year", "calendar_year", "monthly"], default: "fiscal_year" },
    voucherFormat: { type: String, trim: true, default: "{PREFIX}-{FY}-{NUMBER}" },
    numberingRules: {
      journal: { type: numberingRuleSchema, default: () => ({ prefix: "JV" }) },
      invoice: { type: numberingRuleSchema, default: () => ({ prefix: "INV" }) },
      voucher: { type: numberingRuleSchema, default: () => ({ prefix: "PV" }) },
      bill: { type: numberingRuleSchema, default: () => ({ prefix: "BILL" }) },
    },
    approvalEnabled: { type: Boolean, default: false },
    journalApprovalThreshold: { type: Number, min: 0, default: 0 },
    lockDate: { type: Date, default: null, index: true },
    periodCloseRequireReconciliation: { type: Boolean, default: false },
    defaultTaxScheme: { type: String, trim: true, default: "" },
    taxCalculationMethod: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },
    coaPublishedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("AccountingSettings", accountingSettingsSchema);
