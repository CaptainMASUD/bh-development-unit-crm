import mongoose from "mongoose";

const { Schema } = mongoose;

export const addressSchema = new Schema(
  {
    attention: { type: String, trim: true },
    phone: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: "Bangladesh" },
  },
  { _id: false }
);

export const totalsSchema = new Schema(
  {
    subtotal: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    shippingCharge: { type: Number, default: 0, min: 0 },
    adjustment: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    taxCalculationMethod: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },
  },
  { _id: false }
);

export const quotationLineSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: { type: Schema.Types.ObjectId },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    uomId: { type: Schema.Types.ObjectId, ref: "InventoryUnit" },
    sku: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    discountValue: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    lineSubtotal: { type: Number, default: 0 },
    lineDiscount: { type: Number, default: 0 },
    lineTax: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: true }
);

export const orderLineSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: { type: Schema.Types.ObjectId },
    warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse" },
    uomId: { type: Schema.Types.ObjectId, ref: "InventoryUnit" },
    sku: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    orderedQty: { type: Number, required: true, min: 0.000001 },
    reservedQty: { type: Number, default: 0, min: 0 },
    dispatchedQty: { type: Number, default: 0, min: 0 },
    deliveredQty: { type: Number, default: 0, min: 0 },
    invoicedQty: { type: Number, default: 0, min: 0 },
    returnedQty: { type: Number, default: 0, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    discountValue: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    lineSubtotal: { type: Number, default: 0 },
    lineDiscount: { type: Number, default: 0 },
    lineTax: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: true }
);

export const invoiceLineSchema = new Schema(
  {
    orderLineId: { type: Schema.Types.ObjectId },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: { type: Schema.Types.ObjectId },
    uomId: { type: Schema.Types.ObjectId, ref: "InventoryUnit" },
    sku: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    discountValue: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    lineSubtotal: { type: Number, default: 0 },
    lineDiscount: { type: Number, default: 0 },
    lineTax: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: true }
);
