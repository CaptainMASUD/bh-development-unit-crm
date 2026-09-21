import mongoose from "mongoose";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const journalLineSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    debit: {
      type: Number,
      default: 0,
      min: 0,
      set: roundMoney,
      validate: {
        validator: function (val) {
          if (val > 0 && this.credit > 0) return false;
          return true;
        },
        message: "A journal line cannot contain both debit and credit.",
      },
    },
    credit: { type: Number, default: 0, min: 0, set: roundMoney },
    description: { type: String, trim: true, default: "" },
    contactType: { type: String, enum: ["customer", "vendor", "employee", "other", ""], default: "", index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: "CostCenter", default: null, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    dimensions: { type: Map, of: mongoose.Schema.Types.Mixed, default: () => new Map() },
    taxCode: { type: String, trim: true, uppercase: true, default: "", index: true },
  },
  { _id: true }
);

const journalEntrySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    entryNo: { type: String, trim: true, default: "" },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: ["draft", "pending_approval", "posted", "reversed", "void"], default: "draft", index: true },
    voucherType: {
      type: String,
      enum: ["journal", "payment", "receipt", "contra", "opening", "closing", "sales", "purchase", "payroll", "tax", "adjustment"],
      default: "journal",
      index: true,
    },
    sourceType: {
      type: String,
      enum: [
        "manual",
        "opening_balance",
        "opening_stock",
        "fiscal_closing",
        "invoice",
        "sales_delivery",
        "sales_return",
        "customer_payment",
        "vendor_bill",
        "vendor_payment",
        "purchase_payment",
        "purchase_refund",
        "expense",
        "bank_transfer",
        "tax",
        "payroll",
        "goods_receipt",
        "purchase_return",
        "lc_margin",
        "lc_charge",
        "lc_settlement",
        "landed_cost",
        "inventory_adjustment",
        "inventory_consumption",
        "inventory_loss",
        "inventory_transfer",
        "inventory_revaluation",
      ],
      default: "manual",
      index: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    inventoryMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null, index: true },
    origin: { type: String, enum: ["manual", "system"], default: "manual", index: true },
    fiscalYear: { type: mongoose.Schema.Types.ObjectId, ref: "FiscalYear", default: null, index: true },
    accountingPeriod: { type: mongoose.Schema.Types.ObjectId, ref: "AccountingPeriod", default: null, index: true },
    reference: { type: String, trim: true, default: "", index: true },
    memo: { type: String, trim: true, default: "" },
    currency: { type: String, trim: true, default: "BDT", index: true },
    paymentMode: { type: String, enum: ["", "cash", "bank", "cheque", "online", "mobile_banking", "card", "other"], default: "", index: true },
    treasuryAccountType: { type: String, enum: ["", "cash", "bank"], default: "", index: true },
    cashAccount: { type: mongoose.Schema.Types.ObjectId, ref: "CashAccount", default: null, index: true },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: "BankAccount", default: null, index: true },
    partyType: { type: String, enum: ["", "customer", "supplier", "employee", "other"], default: "", index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    partyName: { type: String, trim: true, default: "" },
    chequeNo: { type: String, trim: true, default: "", index: true },
    chequeDate: { type: Date, default: null },
    chequeStatus: { type: String, enum: ["", "issued", "presented", "cleared", "bounced"], default: "", index: true },
    linkedDocuments: [{ documentType: { type: String, enum: ["invoice", "supplier_bill", "expense"] }, documentId: mongoose.Schema.Types.ObjectId, appliedAmount: { type: Number, min: 0 } }],
    settlementAppliedAt: { type: Date, default: null },
    settlementReversedAt: { type: Date, default: null },
    attachment: {
      name: { type: String, trim: true, default: "" },
      url: { type: String, trim: true, default: "" },
      type: { type: String, trim: true, default: "" },
      size: { type: Number, min: 0, default: 0 },
    },
    lines: {
      type: [journalLineSchema],
      validate: [
        {
          validator: (v) => Array.isArray(v) && v.length >= 2,
          message: "At least two journal lines are required.",
        },
        {
          validator: function (v) {
            if (!["posted", "reversed"].includes(this.status)) return true;
            let debit = 0;
            let credit = 0;
            for (const line of v || []) {
              debit += Number(line.debit || 0);
              credit += Number(line.credit || 0);
            }
            return Math.round(debit * 100) === Math.round(credit * 100);
          },
          message: "Posted journal entries must balance total debit and total credit.",
        },
      ],
    },
    totalDebit: { type: Number, default: 0, min: 0, set: roundMoney },
    totalCredit: { type: Number, default: 0, min: 0, set: roundMoney },
    postedAt: { type: Date, default: null, index: true },
    submittedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    voidedAt: { type: Date, default: null },
    reversalReason: { type: String, trim: true, default: "" },
    voidReason: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null, index: true },
    reversedByEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

journalEntrySchema.index({ entryNo: 1 }, { unique: true, sparse: true });
journalEntrySchema.index({ tenantId: 1, entryNo: 1 }, { unique: true, sparse: true });
journalEntrySchema.index({ tenantId: 1, inventoryMovement: 1 });
journalEntrySchema.index({ tenantId: 1, sourceType: 1, sourceId: 1, status: 1 });
journalEntrySchema.index({ status: 1, date: -1, _id: -1 });
journalEntrySchema.index({ status: 1, "lines.account": 1, date: 1, _id: 1 });
journalEntrySchema.index({ voucherType: 1, status: 1, date: -1, _id: -1 });
journalEntrySchema.index({ sourceType: 1, sourceId: 1, status: 1 });
journalEntrySchema.index({ "lines.account": 1, date: -1, _id: -1 });
journalEntrySchema.index({ reference: 1, date: -1 });
journalEntrySchema.index({ tenantId: 1, "lines.costCenter": 1 });
journalEntrySchema.index({ tenantId: 1, "lines.branch": 1 });
journalEntrySchema.index({ tenantId: 1, "lines.department": 1 });

journalEntrySchema.pre("validate", function () {
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of this.lines || []) {
    line.debit = roundMoney(line.debit);
    line.credit = roundMoney(line.credit);
    if (line.debit > 0 && line.credit > 0) throw new Error("A journal line cannot contain both debit and credit.");
    if (line.debit <= 0 && line.credit <= 0) throw new Error("Each journal line needs either a debit or credit amount.");
    totalDebit += Number(line.debit || 0);
    totalCredit += Number(line.credit || 0);
  }
  this.totalDebit = roundMoney(totalDebit);
  this.totalCredit = roundMoney(totalCredit);
  if (["posted", "reversed"].includes(this.status) && this.totalDebit !== this.totalCredit) {
    throw new Error("Posted journal entries must balance total debit and total credit.");
  }
  if (["posted", "reversed"].includes(this.status) && !this.postedAt) this.postedAt = new Date();
  if (!this.entryNo && ["posted", "reversed"].includes(this.status)) {
    const y = new Date(this.date || Date.now()).getFullYear();
    this.entryNo = `JE-${y}-${Date.now()}-${String(this._id).slice(-4).toUpperCase()}`;
  }
});

export default mongoose.model("JournalEntry", journalEntrySchema);
