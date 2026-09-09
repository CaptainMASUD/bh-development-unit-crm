import mongoose from "mongoose";
import {
  addressSchema,
  orderLineSchema,
  totalsSchema,
} from "./salesShared.schemas.js";

const { Schema } = mongoose;

const salesOrderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    orderNumber: { type: String, required: true, trim: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", index: true },
    quotationId: { type: Schema.Types.ObjectId, ref: "SalesQuotation" },
    dealId: { type: Schema.Types.ObjectId, ref: "Deal" },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    contactId: { type: Schema.Types.ObjectId },
    salespersonId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    currency: { type: String, default: "BDT", uppercase: true, trim: true },
    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "approved",
        "confirmed",
        "partially_fulfilled",
        "fulfilled",
        "cancelled",
        "closed",
      ],
      default: "draft",
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: [
        "not_started",
        "reserved",
        "partially_dispatched",
        "dispatched",
        "partially_delivered",
        "delivered",
      ],
      default: "not_started",
    },
    invoiceStatus: {
      type: String,
      enum: ["not_invoiced", "partially_invoiced", "fully_invoiced"],
      default: "not_invoiced",
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid", "overdue"],
      default: "unpaid",
    },
    orderDate: { type: Date, default: Date.now },
    promisedDeliveryDate: { type: Date },
    lines: {
      type: [orderLineSchema],
      validate: [(value) => value.length > 0, "At least one line is required."],
    },
    totals: { type: totalsSchema, required: true },
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    paymentTerms: { type: String, trim: true },
    paymentTermsDays: { type: Number, min: 0, max: 3650, default: 0 },
    deliveryTerms: { type: String, trim: true },
    customerReference: { type: String, trim: true },
    notes: { type: String, trim: true },
    approval: {
      requestedAt: { type: Date },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
      approvedAt: { type: Date },
      approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
      rejectedAt: { type: Date },
      rejectedBy: { type: Schema.Types.ObjectId, ref: "User" },
      rejectionReason: { type: String, trim: true },
    },
    confirmation: {
      confirmedAt: { type: Date },
      confirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    inventoryReservation: {
      status: {
        type: String,
        enum: ["not_requested", "reserved", "partial", "failed", "pending_integration", "released"],
        default: "not_requested",
      },
      reservationId: { type: String, trim: true },
      message: { type: String, trim: true },
      reservedAt: { type: Date },
    },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

salesOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
salesOrderSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
salesOrderSchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });
salesOrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
salesOrderSchema.index({ tenantId: 1, warehouseId: 1, status: 1 });

export const SalesOrder =
  mongoose.models.SalesOrder ||
  mongoose.model("SalesOrder", salesOrderSchema);

export default SalesOrder;
