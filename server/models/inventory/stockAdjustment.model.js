import mongoose from "mongoose";
import { roundMoney, roundQuantity } from "./productStock.model.js";

const ADJUSTMENT_TYPES = [
  "physical_count",
  "cycle_count",
  "damage",
  "loss",
  "found",
  "expiry",
  "quality_control",
  "data_correction",
  "opening_correction",
  "other",
];

const ADJUSTMENT_MODES = ["count", "delta"];
const ADJUSTMENT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "rejected",
  "cancelled",
  "reversed",
];

const stockAdjustmentLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
      index: true,
    },
    systemQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    countedQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    varianceQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    varianceValue: {
      type: Number,
      default: 0,
    },
    stockVersion: {
      type: Number,
      min: 0,
      default: 0,
    },
    lotNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    serialNumbers: {
      type: [String],
      default: [],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  { _id: true }
);

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    adjustmentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: ADJUSTMENT_TYPES,
      default: "physical_count",
      index: true,
    },
    adjustmentMode: {
      type: String,
      enum: ADJUSTMENT_MODES,
      default: "count",
    },
    status: {
      type: String,
      enum: ADJUSTMENT_STATUSES,
      default: "draft",
      index: true,
    },
    reference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 160,
      default: "",
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
    lines: {
      type: [stockAdjustmentLineSchema],
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length > 0 && lines.length <= 500,
        message: "An adjustment must contain between 1 and 500 lines.",
      },
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    locations: [{ type: mongoose.Schema.Types.ObjectId, ref: "WarehouseLocation" }],
    lineCount: { type: Number, min: 0, default: 0 },
    increaseQuantity: { type: Number, min: 0, default: 0 },
    decreaseQuantity: { type: Number, min: 0, default: 0 },
    netQuantity: { type: Number, default: 0 },
    increaseValue: { type: Number, min: 0, default: 0 },
    decreaseValue: { type: Number, min: 0, default: 0 },
    netValue: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: "" },
    postedAt: { type: Date, default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    movement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
      index: true,
    },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, trim: true, maxlength: 1000, default: "" },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversalMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: true,
  }
);

stockAdjustmentSchema.index({ adjustmentNo: 1 }, { unique: true });
stockAdjustmentSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } },
  }
);
stockAdjustmentSchema.index({ warehouse: 1, status: 1, adjustmentDate: -1, _id: -1 });
stockAdjustmentSchema.index({ adjustmentType: 1, status: 1, adjustmentDate: -1, _id: -1 });
stockAdjustmentSchema.index({ products: 1, adjustmentDate: -1, _id: -1 });
stockAdjustmentSchema.index({ locations: 1, adjustmentDate: -1, _id: -1 });
stockAdjustmentSchema.index({ createdBy: 1, adjustmentDate: -1, _id: -1 });
stockAdjustmentSchema.index(
  { movement: 1 },
  { unique: true, partialFilterExpression: { movement: { $type: "objectId" } } }
);
stockAdjustmentSchema.index({ reference: 1, adjustmentDate: -1 });

const clean = (value) => String(value ?? "").trim();
const idKey = (value) => String(value || "");

const uniqueValues = (values = []) => {
  const seen = new Set();
  return values.filter(Boolean).filter((value) => {
    const key = idKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSerialNumbers = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value).toUpperCase()).filter(Boolean))];

const adjustmentNumber = (doc) => {
  const date = new Date(doc.adjustmentDate || Date.now());
  const datePart = [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("");
  return `SA-${datePart}-${String(doc._id).slice(-10).toUpperCase()}`;
};

stockAdjustmentSchema.pre("validate", function (next) {
  this.adjustmentDate = this.adjustmentDate || new Date();
  this.adjustmentNo = clean(this.adjustmentNo || adjustmentNumber(this)).toUpperCase();
  this.adjustmentType = clean(this.adjustmentType || "physical_count").toLowerCase();
  this.adjustmentMode = clean(this.adjustmentMode || "count").toLowerCase();
  this.status = clean(this.status || "draft").toLowerCase();
  this.reference = clean(this.reference).toUpperCase();
  this.idempotencyKey = clean(this.idempotencyKey);
  this.currency = clean(this.currency || "BDT").toUpperCase();
  this.reason = clean(this.reason);
  this.notes = clean(this.notes);
  this.rejectionReason = clean(this.rejectionReason);
  this.cancellationReason = clean(this.cancellationReason);

  const duplicateKeys = new Set();
  let increaseQuantity = 0;
  let decreaseQuantity = 0;
  let increaseValue = 0;
  let decreaseValue = 0;

  for (const line of this.lines || []) {
    line.systemQuantity = roundQuantity(line.systemQuantity);
    line.countedQuantity = roundQuantity(line.countedQuantity);
    line.varianceQuantity = roundQuantity(line.varianceQuantity);
    line.unitCost = roundMoney(line.unitCost);
    line.lotNumber = clean(line.lotNumber).toUpperCase();
    line.serialNumbers = normalizeSerialNumbers(line.serialNumbers);
    line.note = clean(line.note);

    if (this.adjustmentMode === "count") {
      line.varianceQuantity = roundQuantity(line.countedQuantity - line.systemQuantity);
    } else {
      line.countedQuantity = roundQuantity(line.systemQuantity + line.varianceQuantity);
    }
    line.varianceValue = roundMoney(line.varianceQuantity * line.unitCost);

    const key = `${idKey(line.product)}:${line.location ? idKey(line.location) : "none"}`;
    if (duplicateKeys.has(key)) {
      this.invalidate("lines", "A product and location can appear only once in an adjustment.");
    }
    duplicateKeys.add(key);

    if (line.varianceQuantity > 0) {
      increaseQuantity += line.varianceQuantity;
      increaseValue += line.varianceValue;
    } else if (line.varianceQuantity < 0) {
      decreaseQuantity += Math.abs(line.varianceQuantity);
      decreaseValue += Math.abs(line.varianceValue);
    }
  }

  this.products = uniqueValues((this.lines || []).map((line) => line.product));
  this.locations = uniqueValues((this.lines || []).map((line) => line.location));
  this.lineCount = this.lines?.length || 0;
  this.increaseQuantity = roundQuantity(increaseQuantity);
  this.decreaseQuantity = roundQuantity(decreaseQuantity);
  this.netQuantity = roundQuantity(increaseQuantity - decreaseQuantity);
  this.increaseValue = roundMoney(increaseValue);
  this.decreaseValue = roundMoney(decreaseValue);
  this.netValue = roundMoney(increaseValue - decreaseValue);

  if (this.status === "posted" && (!this.movement || !this.postedAt)) {
    this.invalidate("movement", "A posted adjustment requires its posted stock movement.");
  }
  if (this.status === "reversed" && !this.reversalMovement) {
    this.invalidate("reversalMovement", "A reversed adjustment requires its reversal movement.");
  }

  next();
});

stockAdjustmentSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = update.$set || update;
  if (patch.adjustmentNo !== undefined) patch.adjustmentNo = clean(patch.adjustmentNo).toUpperCase();
  if (patch.adjustmentType !== undefined) patch.adjustmentType = clean(patch.adjustmentType).toLowerCase();
  if (patch.adjustmentMode !== undefined) patch.adjustmentMode = clean(patch.adjustmentMode).toLowerCase();
  if (patch.status !== undefined) patch.status = clean(patch.status).toLowerCase();
  if (patch.reference !== undefined) patch.reference = clean(patch.reference).toUpperCase();
  if (patch.idempotencyKey !== undefined) patch.idempotencyKey = clean(patch.idempotencyKey);
  if (patch.currency !== undefined) patch.currency = clean(patch.currency || "BDT").toUpperCase();
  if (patch.reason !== undefined) patch.reason = clean(patch.reason);
  if (patch.notes !== undefined) patch.notes = clean(patch.notes);
  if (patch.rejectionReason !== undefined) patch.rejectionReason = clean(patch.rejectionReason);
  if (patch.cancellationReason !== undefined) patch.cancellationReason = clean(patch.cancellationReason);
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export { ADJUSTMENT_TYPES, ADJUSTMENT_MODES, ADJUSTMENT_STATUSES };
export default mongoose.model("StockAdjustment", stockAdjustmentSchema);
