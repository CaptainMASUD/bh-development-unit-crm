import mongoose from "mongoose";

export const GOODS_RECEIPT_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "posted",
  "reversed",
  "cancelled",
];

export const GOODS_RECEIPT_EDITABLE_STATUSES = ["draft"];
export const QUALITY_STATUSES = [
  "pending",
  "accepted",
  "partially_accepted",
  "rejected",
];

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

const goodsReceiptLineSchema = new mongoose.Schema(
  {
    purchaseOrderLine: {
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
    orderedQuantity: { type: Number, min: 0, default: 0 },
    previouslyReceivedQuantity: { type: Number, min: 0, default: 0 },
    receivedQuantity: { type: Number, required: true, min: 0.000001 },
    acceptedQuantity: { type: Number, min: 0, default: 0 },
    quarantineQuantity: { type: Number, min: 0, default: 0 },
    rejectedQuantity: { type: Number, min: 0, default: 0 },
    returnedQuantity: { type: Number, min: 0, default: 0 },
    returnedAvailableQuantity: { type: Number, min: 0, default: 0 },
    returnedQuarantineQuantity: { type: Number, min: 0, default: 0 },
    unitCost: { type: Number, min: 0, default: 0 },
    acceptedLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    quarantineLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
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
        message: "A goods-receipt line cannot contain more than 5,000 serial numbers.",
      },
    },
    manufactureDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    qualityStatus: {
      type: String,
      enum: QUALITY_STATUSES,
      default: "pending",
    },
    inspectionNotes: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },
    lineValue: { type: Number, min: 0, default: 0 },
  },
  { _id: true, id: false }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    receiptNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },
    receiptDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
    },
    commercialLC: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommercialLC",
      default: null,
      index: true,
    },
    importShipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImportShipment",
      default: null,
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
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    supplierDeliveryNote: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    supplierInvoiceNo: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    vehicleNo: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
      default: "",
    },
    receivedByName: {
      type: String,
      trim: true,
      maxlength: 140,
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
      type: [goodsReceiptLineSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0 && items.length <= 500,
        message: "A goods receipt requires 1 to 500 lines.",
      },
    },
    lineCount: { type: Number, min: 0, default: 0 },
    totalReceivedQuantity: { type: Number, min: 0, default: 0 },
    totalAcceptedQuantity: { type: Number, min: 0, default: 0 },
    totalQuarantineQuantity: { type: Number, min: 0, default: 0 },
    totalRejectedQuantity: { type: Number, min: 0, default: 0 },
    totalReturnedQuantity: { type: Number, min: 0, default: 0 },
    totalAcceptedValue: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: GOODS_RECEIPT_STATUSES,
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

goodsReceiptSchema.index({ purchaseOrder: 1, status: 1, receiptDate: -1, _id: -1 });
goodsReceiptSchema.index({ commercialLC: 1, importShipment: 1, status: 1, receiptDate: -1 });
goodsReceiptSchema.index({ supplier: 1, status: 1, receiptDate: -1, _id: -1 });
goodsReceiptSchema.index({ warehouse: 1, status: 1, receiptDate: -1, _id: -1 });
goodsReceiptSchema.index({ status: 1, receiptDate: -1, _id: -1 });
goodsReceiptSchema.index({ "lines.product": 1, status: 1, receiptDate: -1 });
goodsReceiptSchema.index({ updatedAt: -1, _id: -1 });
goodsReceiptSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } }
);

goodsReceiptSchema.pre("validate", function (next) {
  this.receiptNo = clean(this.receiptNo).toUpperCase();
  this.supplierDeliveryNote = clean(this.supplierDeliveryNote).toUpperCase();
  this.supplierInvoiceNo = clean(this.supplierInvoiceNo).toUpperCase();
  this.vehicleNo = clean(this.vehicleNo).toUpperCase();
  this.receivedByName = clean(this.receivedByName);
  this.currency = clean(this.currency || "BDT").toUpperCase();
  this.status = clean(this.status || "draft").toLowerCase();
  this.idempotencyKey = clean(this.idempotencyKey);
  this.notes = clean(this.notes);
  this.reversalReason = clean(this.reversalReason);
  this.cancellationReason = clean(this.cancellationReason);

  for (const line of this.lines || []) {
    line.orderedQuantity = roundQuantity(line.orderedQuantity);
    line.previouslyReceivedQuantity = roundQuantity(line.previouslyReceivedQuantity);
    line.receivedQuantity = roundQuantity(line.receivedQuantity);
    line.acceptedQuantity = roundQuantity(line.acceptedQuantity);
    line.quarantineQuantity = roundQuantity(line.quarantineQuantity);
    line.rejectedQuantity = roundQuantity(line.rejectedQuantity);
    line.returnedQuantity = roundQuantity(line.returnedQuantity);
    line.returnedAvailableQuantity = roundQuantity(line.returnedAvailableQuantity);
    line.returnedQuarantineQuantity = roundQuantity(line.returnedQuarantineQuantity);
    line.returnedQuantity = roundQuantity(
      Number(line.returnedAvailableQuantity || 0) +
        Number(line.returnedQuarantineQuantity || 0)
    );
    line.unitCost = roundMoney(line.unitCost);
    line.lotNumber = clean(line.lotNumber).toUpperCase();
    line.serialNumbers = [
      ...new Set(
        (line.serialNumbers || [])
          .map((value) => clean(value).toUpperCase())
          .filter(Boolean)
      ),
    ];
    line.inspectionNotes = clean(line.inspectionNotes);
    line.qualityStatus = clean(line.qualityStatus || "pending").toLowerCase();
    line.lineValue = roundMoney(
      (Number(line.acceptedQuantity || 0) +
        Number(line.quarantineQuantity || 0)) *
        Number(line.unitCost || 0)
    );

    const allocated = roundQuantity(
      Number(line.acceptedQuantity || 0) +
        Number(line.quarantineQuantity || 0) +
        Number(line.rejectedQuantity || 0)
    );
    if (allocated !== roundQuantity(line.receivedQuantity)) {
      line.invalidate(
        "receivedQuantity",
        "Accepted, quarantine, and rejected quantities must equal received quantity."
      );
    }
    if (line.returnedAvailableQuantity > line.acceptedQuantity) {
      line.invalidate(
        "returnedAvailableQuantity",
        "Returned available quantity cannot exceed accepted quantity."
      );
    }
    if (line.returnedQuarantineQuantity > line.quarantineQuantity) {
      line.invalidate(
        "returnedQuarantineQuantity",
        "Returned quarantine quantity cannot exceed quarantine quantity."
      );
    }
    if (line.returnedQuantity > line.acceptedQuantity + line.quarantineQuantity) {
      line.invalidate(
        "returnedQuantity",
        "Returned quantity cannot exceed accepted plus quarantine quantity."
      );
    }
    if (
      line.expiryDate &&
      line.manufactureDate &&
      new Date(line.expiryDate) < new Date(line.manufactureDate)
    ) {
      line.invalidate(
        "expiryDate",
        "Expiry date cannot be before manufacture date."
      );
    }

    if (line.rejectedQuantity >= line.receivedQuantity) {
      line.qualityStatus = "rejected";
    } else if (line.rejectedQuantity > 0 || line.quarantineQuantity > 0) {
      line.qualityStatus = "partially_accepted";
    } else if (line.acceptedQuantity >= line.receivedQuantity) {
      line.qualityStatus = "accepted";
    }
  }

  this.lineCount = this.lines?.length || 0;
  this.totalReceivedQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0)
  );
  this.totalAcceptedQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.acceptedQuantity || 0), 0)
  );
  this.totalQuarantineQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.quarantineQuantity || 0), 0)
  );
  this.totalRejectedQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.rejectedQuantity || 0), 0)
  );
  this.totalReturnedQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.returnedQuantity || 0), 0)
  );
  this.totalAcceptedValue = roundMoney(
    (this.lines || []).reduce((sum, line) => sum + Number(line.lineValue || 0), 0)
  );

  next();
});

export { roundMoney, roundQuantity };
export default mongoose.model("GoodsReceipt", goodsReceiptSchema);
