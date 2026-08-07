import mongoose from "mongoose";

const lineSchema = new mongoose.Schema({
  orderLineId: { type: mongoose.Schema.Types.ObjectId, required: true },
  invoiceLineId: { type: mongoose.Schema.Types.ObjectId, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  unitPrice: { type: Number, required: true, min: 0 },
  netAmount: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, min: 0, default: 0 },
  condition: { type: String, enum: ["resalable", "damaged", "defective", "expired", "other"], default: "resalable" },
  restock: { type: Boolean, default: true },
  reason: { type: String, trim: true, required: true },
}, { _id: true });

const salesReturnSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
  returnNumber: { type: String, required: true, trim: true },
  salesOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder", required: true, index: true },
  salesInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesInvoice", required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
  status: { type: String, enum: ["draft", "pending_approval", "posted", "rejected", "cancelled"], default: "draft", index: true },
  returnDate: { type: Date, default: Date.now, index: true },
  currency: { type: String, trim: true, uppercase: true, default: "BDT" },
  lines: { type: [lineSchema], validate: [(value) => Array.isArray(value) && value.length > 0, "At least one return line is required."] },
  netAmount: { type: Number, min: 0, default: 0 },
  taxAmount: { type: Number, min: 0, default: 0 },
  totalAmount: { type: Number, min: 0, default: 0 },
  inventoryValue: { type: Number, min: 0, default: 0 },
  reason: { type: String, trim: true, required: true },
  inventoryMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
  creditJournal: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
  refundDue: { type: Number, min: 0, default: 0 },
  refundedAmount: { type: Number, min: 0, default: 0 },
  refundJournal: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
  refundedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  postedAt: { type: Date, default: null },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  rejectedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  rejectionReason: { type: String, trim: true, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, optimisticConcurrency: true });

salesReturnSchema.index({ tenantId: 1, returnNumber: 1 }, { unique: true });
salesReturnSchema.index({ tenantId: 1, status: 1, returnDate: -1 });
salesReturnSchema.index({ tenantId: 1, customerId: 1, returnDate: -1 });

export const SalesReturn = mongoose.models.SalesReturn || mongoose.model("SalesReturn", salesReturnSchema);
