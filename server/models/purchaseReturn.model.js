import mongoose from "mongoose";

export const PURCHASE_RETURN_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "posted",
  "reversed",
  "cancelled",
];

export const PURCHASE_RETURN_EDITABLE_STATUSES = ["draft"];
export const PURCHASE_RETURN_REASONS = [
  "damaged",
  "quality_failure",
  "wrong_item",
  "excess_quantity",
  "expired",
  "supplier_recall",
  "other",
];
export const RETURN_STOCK_BUCKETS = ["available", "quarantine"];

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const roundQuantity = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) /
  1_000_000;
const clean = (value) => String(value ?? "").trim();

const snapshotSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
  },
  { _id: false, id: false }
);

const purchaseReturnLineSchema = new mongoose.Schema(
  {
    purchaseOrderLine: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    goodsReceiptLine: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    purchaseUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryUnit",
      default: null,
    },
    productSnapshot: {
      type: snapshotSchema,
      default: () => ({}),
    },
    unitSnapshot: {
      type: snapshotSchema,
      default: () => ({}),
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    stockBucket: {
      type: String,
      enum: RETURN_STOCK_BUCKETS,
      default: "available",
    },
    returnQuantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    previouslyReturnedQuantity: { type: Number, min: 0, default: 0 },
    returnableQuantity: { type: Number, min: 0, default: 0 },
    unitCost: { type: Number, min: 0, default: 0 },
    reasonCode: {
      type: String,
      enum: PURCHASE_RETURN_REASONS,
      required: true,
    },
    reasonDetails: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
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
      validate: {
        validator: (items) => items.length <= 5000,
        message: "A purchase-return line cannot contain more than 5,000 serial numbers.",
      },
    },
    lineValue: { type: Number, min: 0, default: 0 },
  },
  { _id: true, id: false }
);

const purchaseReturnSchema = new mongoose.Schema(
  {
    returnNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },
    returnDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    supplierSnapshot: {
      type: snapshotSchema,
      default: () => ({}),
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
    },
    goodsReceipt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoodsReceipt",
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    supplierReturnAuthorization: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },
    lines: {
      type: [purchaseReturnLineSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0 && items.length <= 500,
        message: "A purchase return requires 1 to 500 lines.",
      },
    },
    lineCount: { type: Number, min: 0, default: 0 },
    totalReturnQuantity: { type: Number, min: 0, default: 0 },
    totalReturnValue: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: PURCHASE_RETURN_STATUSES,
      default: "draft",
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
    movement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
      index: true,
    },
    reversalMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null, index: true },
    reversalJournalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    postedAt: { type: Date, default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversalReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    versionKey: "__v",
    optimisticConcurrency: true,
    minimize: true,
  }
);

purchaseReturnSchema.index({ goodsReceipt: 1, status: 1, returnDate: -1, _id: -1 });
purchaseReturnSchema.index({ purchaseOrder: 1, status: 1, returnDate: -1, _id: -1 });
purchaseReturnSchema.index({ supplier: 1, status: 1, returnDate: -1, _id: -1 });
purchaseReturnSchema.index({ warehouse: 1, status: 1, returnDate: -1, _id: -1 });
purchaseReturnSchema.index({ status: 1, returnDate: -1, _id: -1 });
purchaseReturnSchema.index({ "lines.product": 1, status: 1, returnDate: -1 });
purchaseReturnSchema.index({ updatedAt: -1, _id: -1 });
purchaseReturnSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } }
);

purchaseReturnSchema.pre("validate", function (next) {
  this.returnNo = clean(this.returnNo).toUpperCase();
  this.supplierReturnAuthorization = clean(
    this.supplierReturnAuthorization
  ).toUpperCase();
  this.currency = clean(this.currency || "BDT").toUpperCase();
  this.status = clean(this.status || "draft").toLowerCase();
  this.idempotencyKey = clean(this.idempotencyKey);
  this.notes = clean(this.notes);
  this.reversalReason = clean(this.reversalReason);
  this.cancellationReason = clean(this.cancellationReason);

  for (const line of this.lines || []) {
    line.stockBucket = clean(line.stockBucket || "available").toLowerCase();
    line.returnQuantity = roundQuantity(line.returnQuantity);
    line.previouslyReturnedQuantity = roundQuantity(
      line.previouslyReturnedQuantity
    );
    line.returnableQuantity = roundQuantity(line.returnableQuantity);
    line.unitCost = roundMoney(line.unitCost);
    line.reasonCode = clean(line.reasonCode).toLowerCase();
    line.reasonDetails = clean(line.reasonDetails);
    line.lotNumber = clean(line.lotNumber).toUpperCase();
    line.serialNumbers = [
      ...new Set(
        (line.serialNumbers || [])
          .map((value) => clean(value).toUpperCase())
          .filter(Boolean)
      ),
    ];
    line.lineValue = roundMoney(line.returnQuantity * line.unitCost);

    if (line.returnQuantity > line.returnableQuantity) {
      line.invalidate(
        "returnQuantity",
        "Return quantity cannot exceed the currently returnable quantity."
      );
    }
  }

  this.lineCount = this.lines?.length || 0;
  this.totalReturnQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.returnQuantity || 0), 0)
  );
  this.totalReturnValue = roundMoney(
    (this.lines || []).reduce((sum, line) => sum + Number(line.lineValue || 0), 0)
  );

  next();
});

export { roundMoney, roundQuantity };
export default mongoose.model("PurchaseReturn", purchaseReturnSchema);
