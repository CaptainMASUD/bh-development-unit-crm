import mongoose from "mongoose";

const inventoryRevaluationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    revaluationNo: {
      type: String,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    revaluationDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    costingMethod: {
      type: String,
      default: "weighted_average",
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    oldUnitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    newUnitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    oldInventoryValue: {
      type: Number,
      required: true,
      min: 0,
    },
    newInventoryValue: {
      type: Number,
      required: true,
      min: 0,
    },
    valueDifference: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "draft",
      index: true,
    },
    journalEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      default: null,
    },
    gainLossAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    assetAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    postedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

inventoryRevaluationSchema.index(
  { tenantId: 1, revaluationNo: 1 },
  { unique: true }
);
inventoryRevaluationSchema.index({
  tenantId: 1,
  product: 1,
  warehouse: 1,
  revaluationDate: -1,
});

export default mongoose.model("InventoryRevaluation", inventoryRevaluationSchema);
