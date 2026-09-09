import mongoose from "mongoose";

const COSTING_METHODS = ["weighted_average", "fifo", "standard"];

export const roundQuantity = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000;

export const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;

export const roundGLAmount = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const inventoryValuationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    costingMethod: {
      type: String,
      enum: COSTING_METHODS,
      default: "weighted_average",
    },
    valuationQuantity: {
      type: Number,
      default: 0,
    },
    averageCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    inventoryValue: {
      type: Number,
      default: 0,
    },
    standardCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    provisionalNegativeQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    provisionalNegativeCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastValuationAt: {
      type: Date,
      default: Date.now,
    },
    lastMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    valuationVersion: {
      type: Number,
      min: 0,
      default: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inventoryValuationSchema.index(
  { tenantId: 1, product: 1, warehouse: 1 },
  { unique: true }
);
inventoryValuationSchema.index(
  { tenantId: 1, warehouse: 1, product: 1 }
);
inventoryValuationSchema.index(
  { tenantId: 1, product: 1, lastValuationAt: -1 }
);

export { COSTING_METHODS };
export default mongoose.model("InventoryValuation", inventoryValuationSchema);
