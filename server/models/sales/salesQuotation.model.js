import mongoose from "mongoose";
import {
  addressSchema,
  quotationLineSchema,
  totalsSchema,
} from "./salesShared.schemas.js";

const { Schema } = mongoose;

const salesQuotationSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    quotationNumber: { type: String, required: true, trim: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", index: true },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: function () {
        return !this.leadId;
      },
    },
    leadContact: {
      name: { type: String, trim: true },
      companyName: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
    },
    contactId: { type: Schema.Types.ObjectId },
    dealId: { type: Schema.Types.ObjectId, ref: "Deal" },
    salespersonId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    currency: { type: String, default: "BDT", uppercase: true, trim: true },
    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "viewed",
        "under_negotiation",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    quotationDate: { type: Date, default: Date.now },
    validUntil: { type: Date },
    lines: {
      type: [quotationLineSchema],
      validate: [(value) => value.length > 0, "At least one line is required."],
    },
    totals: { type: totalsSchema, required: true },
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    paymentTerms: { type: String, trim: true },
    paymentTermsDays: { type: Number, min: 0, max: 3650, default: 0 },
    deliveryTerms: { type: String, trim: true },
    notes: { type: String, trim: true },
    customerConfirmation: {
      method: {
        type: String,
        enum: ["signed_quotation", "purchase_order", "email", "contract", "advance_payment", "verbal", null],
        default: null,
      },
      reference: { type: String, trim: true },
      confirmedByName: { type: String, trim: true },
      confirmedAt: { type: Date },
    },
    convertedOrderId: { type: Schema.Types.ObjectId, ref: "SalesOrder" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

salesQuotationSchema.index(
  { tenantId: 1, quotationNumber: 1 },
  { unique: true }
);
salesQuotationSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
salesQuotationSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
salesQuotationSchema.index({ tenantId: 1, dealId: 1, createdAt: -1 });
salesQuotationSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const SalesQuotation =
  mongoose.models.SalesQuotation ||
  mongoose.model("SalesQuotation", salesQuotationSchema);

export default SalesQuotation;
