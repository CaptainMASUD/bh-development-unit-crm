import mongoose from "mongoose";

const fifoCostLayerSchema = new mongoose.Schema(
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
    receiptDate: {
      type: Date,
      default: Date.now,
    },
    sourceMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    sourceType: {
      type: String,
      enum: [
        "goods_receipt",
        "opening_stock",
        "stock_adjustment_in",
        "transfer_in",
        "production_receipt",
        "customer_return",
        "manual",
      ],
      default: "goods_receipt",
    },
    sourceDocument: {
      type: String,
      default: "",
    },
    originalQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["open", "exhausted"],
      default: "open",
    },
    layerSequence: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

fifoCostLayerSchema.index({
  tenantId: 1,
  product: 1,
  warehouse: 1,
  status: 1,
  receiptDate: 1,
  _id: 1,
});
fifoCostLayerSchema.index({ tenantId: 1, sourceMovement: 1 });

export default mongoose.model("FifoCostLayer", fifoCostLayerSchema);
