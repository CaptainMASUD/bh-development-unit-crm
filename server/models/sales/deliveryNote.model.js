import mongoose from "mongoose";
import { addressSchema } from "./salesShared.schemas.js";

const { Schema } = mongoose;

const deliveryLineSchema = new Schema(
  {
    orderLineId: { type: Schema.Types.ObjectId, required: true },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: { type: Schema.Types.ObjectId },
    sku: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    batchId: { type: Schema.Types.ObjectId },
    serialNumbers: [{ type: String, trim: true }],
  },
  { _id: true }
);

const deliveryNoteSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    deliveryNumber: { type: String, required: true, trim: true },
    salesOrderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
    },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    dealId: { type: Schema.Types.ObjectId, ref: "Deal" },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "picking",
        "picked",
        "packing",
        "packed",
        "ready_for_dispatch",
        "dispatched",
        "in_transit",
        "delivered",
        "partially_delivered",
        "failed",
        "returned",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    lines: {
      type: [deliveryLineSchema],
      validate: [(value) => value.length > 0, "At least one line is required."],
    },
    deliveryAddress: addressSchema,
    deliveryMethod: {
      type: String,
      enum: ["company_vehicle", "courier", "third_party_transport", "customer_pickup"],
      default: "company_vehicle",
    },
    courierName: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    vehicleNumber: { type: String, trim: true },
    driverName: { type: String, trim: true },
    driverPhone: { type: String, trim: true },
    scheduledDate: { type: Date },
    dispatchedAt: { type: Date },
    deliveredAt: { type: Date },
    inventoryPosting: {
      status: {
        type: String,
        enum: ["not_posted", "posted", "pending_integration", "failed"],
        default: "not_posted",
      },
      stockMovementId: { type: Schema.Types.ObjectId, ref: "StockMovement", default: null },
      message: { type: String, trim: true },
      postedAt: { type: Date },
    },
    orderDeliveryPosted: { type: Boolean, default: false },
    proofOfDelivery: {
      receiverName: { type: String, trim: true },
      receiverPhone: { type: String, trim: true },
      receivedAt: { type: Date },
      signatureUrl: { type: String, trim: true },
      photoUrl: { type: String, trim: true },
      otpVerified: { type: Boolean, default: false },
      note: { type: String, trim: true },
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

deliveryNoteSchema.index(
  { tenantId: 1, deliveryNumber: 1 },
  { unique: true }
);
deliveryNoteSchema.index({ tenantId: 1, salesOrderId: 1, createdAt: -1 });
deliveryNoteSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const DeliveryNote =
  mongoose.models.DeliveryNote ||
  mongoose.model("DeliveryNote", deliveryNoteSchema);

export default DeliveryNote;
