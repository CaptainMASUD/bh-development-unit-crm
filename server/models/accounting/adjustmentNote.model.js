import mongoose from "mongoose";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const adjustmentNoteLineSchema = new mongoose.Schema(
  {
    sourceLineId: { type: mongoose.Schema.Types.ObjectId, default: null },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    productName: { type: String, trim: true, default: "" },
    sku: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0, set: roundMoney },
    adjustmentAmount: { type: Number, required: true, min: 0, set: roundMoney },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    totalAmount: { type: Number, required: true, min: 0, set: roundMoney },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: "CostCenter", default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    project: { type: mongoose.Schema.Types.ObjectId, default: null },
    dimensions: { type: Map, of: mongoose.Schema.Types.Mixed, default: () => new Map() },
    restock: { type: Boolean, default: false },
  },
  { _id: true }
);

const adjustmentNoteSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    noteNumber: { type: String, required: true, trim: true },
    noteType: {
      type: String,
      enum: ["credit_note", "debit_note"],
      required: true,
      index: true,
    },
    sourceSide: {
      type: String,
      enum: ["sales", "purchase"],
      required: true,
      index: true,
    },
    financialDirection: {
      type: String,
      enum: [
        "DECREASES_RECEIVABLE",
        "INCREASES_RECEIVABLE",
        "DECREASES_PAYABLE",
        "INCREASES_PAYABLE",
      ],
      required: true,
      index: true,
    },
    originalDocumentType: {
      type: String,
      enum: ["SalesInvoice", "VendorBill"],
      required: true,
      index: true,
    },
    originalDocumentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    originalDocumentNumber: { type: String, trim: true, default: "" },
    partyType: {
      type: String,
      enum: ["customer", "supplier"],
      required: true,
      index: true,
    },
    partyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    partyName: { type: String, trim: true, default: "" },
    postingDate: { type: Date, required: true, index: true },
    reasonCode: {
      type: String,
      enum: [
        "sales_return",
        "purchase_return",
        "price_correction",
        "overbilling",
        "underbilling",
        "discount",
        "damaged_goods",
        "service_adjustment",
        "tax_correction",
        "other",
      ],
      default: "other",
    },
    reason: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["draft", "approved", "posted", "cancelled"],
      default: "draft",
      index: true,
    },
    lines: { type: [adjustmentNoteLineSchema], default: [] },
    totals: {
      subtotal: { type: Number, default: 0, min: 0, set: roundMoney },
      taxTotal: { type: Number, default: 0, min: 0, set: roundMoney },
      grandTotal: { type: Number, default: 0, min: 0, set: roundMoney },
    },
    allocatedAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    remainingCredit: { type: Number, default: 0, min: 0, set: roundMoney },
    hasInventoryMovement: { type: Boolean, default: false },
    inventoryMovementId: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
    salesReturnId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesReturn", default: null },
    purchaseReturnId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseReturn", default: null },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null, index: true },
    reversalJournalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    cancellationReason: { type: String, trim: true, default: "" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    costCenter: { type: mongoose.Schema.Types.ObjectId, ref: "CostCenter", default: null },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    project: { type: mongoose.Schema.Types.ObjectId, default: null },
    dimensions: { type: Map, of: mongoose.Schema.Types.Mixed, default: () => new Map() },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    postedAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

adjustmentNoteSchema.index({ tenantId: 1, noteNumber: 1 }, { unique: true });
adjustmentNoteSchema.index({ tenantId: 1, originalDocumentId: 1, status: 1 });
adjustmentNoteSchema.index({ tenantId: 1, partyId: 1, postingDate: -1 });
adjustmentNoteSchema.index({ tenantId: 1, noteType: 1, status: 1 });
adjustmentNoteSchema.index({ tenantId: 1, sourceSide: 1, status: 1 });
adjustmentNoteSchema.index({ tenantId: 1, postingDate: -1 });

export const AdjustmentNote =
  mongoose.models.AdjustmentNote ||
  mongoose.model("AdjustmentNote", adjustmentNoteSchema);

export default AdjustmentNote;
