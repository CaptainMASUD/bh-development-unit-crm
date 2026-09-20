import mongoose from "mongoose";

export const LC_STATUSES = [
  "draft",
  "application_submitted",
  "opened",
  "documents_received",
  "customs_clearance",
  "goods_received",
  "settlement_pending",
  "settled",
  "closed",
  "cancelled",
];

export const LC_TYPES = ["sight", "usance", "deferred", "revolving", "other"];
export const LC_CHARGE_TYPES = [
  "opening_charge",
  "swift_charge",
  "bank_commission",
  "amendment_charge",
  "document_handling",
  "insurance",
  "freight",
  "customs_duty",
  "vat_tax",
  "port_charge",
  "cnf_charge",
  "transport",
  "other",
];

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const clean = (value) => String(value ?? "").trim();

const amendmentSchema = new mongoose.Schema(
  {
    amendmentNo: { type: Number, min: 1, required: true },
    amendmentDate: { type: Date, default: Date.now },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    previousAmount: { type: Number, min: 0, default: 0, set: money },
    revisedAmount: { type: Number, min: 0, default: 0, set: money },
    previousExpiryDate: { type: Date, default: null },
    revisedExpiryDate: { type: Date, default: null },
    previousShipmentDate: { type: Date, default: null },
    revisedShipmentDate: { type: Date, default: null },
    bankReference: { type: String, trim: true, maxlength: 160, default: "" },
    amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

const chargeSchema = new mongoose.Schema(
  {
    chargeType: { type: String, enum: LC_CHARGE_TYPES, required: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    amount: { type: Number, required: true, min: 0.01, set: money },
    currency: { type: String, trim: true, uppercase: true, default: "BDT" },
    exchangeRate: { type: Number, min: 0.000001, default: 1 },
    baseAmount: { type: Number, min: 0, default: 0, set: money },
    capitalize: { type: Boolean, default: true },
    chargedAt: { type: Date, default: Date.now },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", default: null },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    bankTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "BankTransaction", default: null },
    reference: { type: String, trim: true, maxlength: 160, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

const settlementSchema = new mongoose.Schema(
  {
    vendorBill: { type: mongoose.Schema.Types.ObjectId, ref: "VendorBill", required: true },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", required: true },
    amount: { type: Number, required: true, min: 0.01, set: money },
    currency: { type: String, trim: true, uppercase: true, default: "BDT" },
    settledAt: { type: Date, default: Date.now },
    reference: { type: String, trim: true, maxlength: 160, default: "" },
    note: { type: String, trim: true, maxlength: 1000, default: "" },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    bankTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "BankTransaction", default: null },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

const commercialLCSchema = new mongoose.Schema(
  {
    applicationNo: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    lcNumber: { type: String, trim: true, uppercase: true, maxlength: 120, default: "" },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    issuingBank: { type: mongoose.Schema.Types.ObjectId, ref: "Bank", default: null, index: true },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", default: null, index: true },
    beneficiaryBankName: { type: String, trim: true, maxlength: 180, default: "" },
    beneficiaryBankSwift: { type: String, trim: true, uppercase: true, maxlength: 40, default: "" },
    lcType: { type: String, enum: LC_TYPES, default: "sight", index: true },
    amount: { type: Number, required: true, min: 0.01, set: money },
    currency: { type: String, trim: true, uppercase: true, maxlength: 12, default: "USD", index: true },
    exchangeRate: { type: Number, min: 0.000001, default: 1 },
    baseCurrencyAmount: { type: Number, min: 0, default: 0, set: money },
    marginPercent: { type: Number, min: 0, max: 100, default: 0 },
    marginAmount: { type: Number, min: 0, default: 0, set: money },
    marginBaseAmount: { type: Number, min: 0, default: 0, set: money },
    marginJournalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    marginBankTransaction: { type: mongoose.Schema.Types.ObjectId, ref: "BankTransaction", default: null },
    applicationDate: { type: Date, default: Date.now, index: true },
    openedDate: { type: Date, default: null, index: true },
    expiryDate: { type: Date, default: null, index: true },
    latestShipmentDate: { type: Date, default: null, index: true },
    usanceDays: { type: Number, min: 0, max: 3650, default: 0 },
    incoterm: { type: String, trim: true, uppercase: true, maxlength: 30, default: "" },
    portOfLoading: { type: String, trim: true, maxlength: 180, default: "" },
    portOfDischarge: { type: String, trim: true, maxlength: 180, default: "" },
    countryOfOrigin: { type: String, trim: true, maxlength: 120, default: "" },
    insurancePolicyNo: { type: String, trim: true, maxlength: 160, default: "" },
    status: { type: String, enum: LC_STATUSES, default: "draft", index: true },
    amendments: { type: [amendmentSchema], default: [] },
    charges: { type: [chargeSchema], default: [] },
    settlements: { type: [settlementSchema], default: [] },
    totalCharges: { type: Number, min: 0, default: 0, set: money },
    capitalizableCharges: { type: Number, min: 0, default: 0, set: money },
    settledAmount: { type: Number, min: 0, default: 0, set: money },
    outstandingAmount: { type: Number, min: 0, default: 0, set: money },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    settledAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, trim: true, maxlength: 1000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

commercialLCSchema.index({ applicationNo: 1 }, { unique: true });
commercialLCSchema.index(
  { lcNumber: 1 },
  { unique: true, partialFilterExpression: { lcNumber: { $type: "string", $gt: "" } } }
);
commercialLCSchema.index({ purchaseOrder: 1, status: 1, applicationDate: -1 });
commercialLCSchema.index({ supplier: 1, status: 1, expiryDate: 1 });
commercialLCSchema.index({ status: 1, expiryDate: 1, _id: -1 });

commercialLCSchema.pre("validate", function () {
  this.applicationNo = clean(this.applicationNo).toUpperCase();
  this.lcNumber = clean(this.lcNumber).toUpperCase();
  this.currency = clean(this.currency || "USD").toUpperCase();
  this.lcType = clean(this.lcType || "sight").toLowerCase();
  this.incoterm = clean(this.incoterm).toUpperCase();
  this.beneficiaryBankSwift = clean(this.beneficiaryBankSwift).toUpperCase();
  this.status = clean(this.status || "draft").toLowerCase();
  this.amount = money(this.amount);
  this.exchangeRate = Number(this.exchangeRate || 1);
  this.baseCurrencyAmount = money(this.amount * this.exchangeRate);
  this.marginPercent = Number(this.marginPercent || 0);
  if (!this.marginAmount && this.marginPercent > 0) {
    this.marginAmount = money(this.amount * (this.marginPercent / 100));
  }
  this.marginAmount = money(this.marginAmount);
  this.marginBaseAmount = money(this.marginAmount * this.exchangeRate);
  for (const charge of this.charges || []) {
    charge.currency = clean(charge.currency || this.currency).toUpperCase();
    charge.exchangeRate = Number(charge.exchangeRate || this.exchangeRate || 1);
    charge.baseAmount = money(charge.amount * charge.exchangeRate);
  }
  for (const settlement of this.settlements || []) {
    settlement.currency = clean(settlement.currency || this.currency).toUpperCase();
  }
  this.totalCharges = money((this.charges || []).reduce((sum, item) => sum + Number(item.baseAmount || 0), 0));
  this.capitalizableCharges = money((this.charges || []).filter((item) => item.capitalize !== false).reduce((sum, item) => sum + Number(item.baseAmount || 0), 0));
  this.settledAmount = money((this.settlements || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
  this.outstandingAmount = money(Math.max(this.amount - this.settledAmount, 0));
  if (this.expiryDate && this.openedDate && new Date(this.expiryDate) < new Date(this.openedDate)) {
    this.invalidate("expiryDate", "LC expiry date cannot be before the opening date.");
  }
  if (this.latestShipmentDate && this.expiryDate && new Date(this.latestShipmentDate) > new Date(this.expiryDate)) {
    this.invalidate("latestShipmentDate", "Latest shipment date cannot be after LC expiry date.");
  }
});

export default mongoose.model("CommercialLC", commercialLCSchema);
