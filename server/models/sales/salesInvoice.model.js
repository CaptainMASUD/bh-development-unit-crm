import mongoose from "mongoose";
import {
  addressSchema,
  invoiceLineSchema,
  totalsSchema,
} from "./salesShared.schemas.js";

const { Schema } = mongoose;

const paymentAllocationSchema = new Schema(
  {
    paymentId: { type: Schema.Types.ObjectId },
    idempotencyKey: { type: String, trim: true, default: "" },
    reference: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "card", "mobile_banking", "gateway", "other"],
      default: "bank_transfer",
    },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cashAccount: { type: Schema.Types.ObjectId, ref: "CashAccount", default: null },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount", default: null },
    journalEntry: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
  },
  { _id: true }
);

const salesInvoiceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    dealId: { type: Schema.Types.ObjectId, ref: "Deal" },
    deliveryNoteIds: [{ type: Schema.Types.ObjectId, ref: "DeliveryNote" }],
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    salespersonId: { type: Schema.Types.ObjectId, ref: "User" },
    currency: { type: String, default: "BDT", uppercase: true, trim: true },
    status: {
      type: String,
      enum: [
        "draft",
        "posted",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "void",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    lines: {
      type: [invoiceLineSchema],
      validate: [(value) => value.length > 0, "At least one line is required."],
    },
    totals: { type: totalsSchema, required: true },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    creditedAmount: { type: Number, default: 0, min: 0 },
    refundDue: { type: Number, default: 0, min: 0 },
    paymentAllocations: [paymentAllocationSchema],
    billingAddress: addressSchema,
    paymentTerms: { type: String, trim: true },
    paymentTermsDays: { type: Number, min: 0, max: 3650, default: 0 },
    notes: { type: String, trim: true },
    accountingPosting: {
      status: {
        type: String,
        enum: ["not_posted", "posted", "pending_integration", "failed", "reversed"],
        default: "not_posted",
      },
      journalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
      reversalJournalEntryId: { type: Schema.Types.ObjectId, ref: "JournalEntry", default: null },
      message: { type: String, trim: true },
      cogsAmount: { type: Number, min: 0, default: 0 },
      postedAt: { type: Date },
      reversedAt: { type: Date },
    },
    sentAt: { type: Date },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    voidReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

salesInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
salesInvoiceSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
salesInvoiceSchema.index({ tenantId: 1, salesOrderId: 1, createdAt: -1 });
salesInvoiceSchema.index({ tenantId: 1, status: 1, dueDate: 1 });

export const SalesInvoice =
  mongoose.models.SalesInvoice ||
  mongoose.model("SalesInvoice", salesInvoiceSchema);

export default SalesInvoice;
