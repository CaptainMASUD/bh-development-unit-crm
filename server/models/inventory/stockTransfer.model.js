import mongoose from "mongoose";
import { roundMoney, roundQuantity } from "./productStock.model.js";

const TRANSFER_MODES = ["direct", "two_step"];
const TRANSFER_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "dispatched",
  "in_transit",
  "partially_received",
  "received",
  "closed",
  "closed_short",
  "rejected",
  "cancelled",
  "reversed",
];

const transferLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    requestedQuantity: { type: Number, required: true, min: 0.000001 },
    approvedQuantity: { type: Number, min: 0, default: 0 },
    dispatchedQuantity: { type: Number, min: 0, default: 0 },
    receivedQuantity: { type: Number, min: 0, default: 0 },
    shortQuantity: { type: Number, min: 0, default: 0 },
    remainingQuantity: { type: Number, min: 0, default: 0 },
    unitCost: { type: Number, min: 0, default: 0 },
    lineValue: { type: Number, min: 0, default: 0 },
    lotNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    serialNumbers: { type: [String], default: [] },
    receivedSerialNumbers: { type: [String], default: [] },
    manufactureDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    note: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { _id: true }
);

const receiptSchema = new mongoose.Schema(
  {
    movement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      required: true,
    },
    idempotencyKey: { type: String, trim: true, maxlength: 180, required: true },
    totalQuantity: { type: Number, min: 0, default: 0 },
    receivedAt: { type: Date, required: true, default: Date.now },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

const stockTransferSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    transferNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    transferDate: { type: Date, required: true, default: Date.now },
    expectedDeliveryDate: { type: Date, default: null },
    transferMode: {
      type: String,
      enum: TRANSFER_MODES,
      default: "two_step",
    },
    status: {
      type: String,
      enum: TRANSFER_STATUSES,
      default: "draft",
    },
    sourceWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    destinationWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },
    reference: { type: String, trim: true, uppercase: true, maxlength: 160, default: "" },
    externalReference: { type: String, trim: true, maxlength: 160, default: "" },
    clientRequestId: { type: String, trim: true, maxlength: 180, default: "" },
    currency: { type: String, trim: true, uppercase: true, maxlength: 12, default: "BDT" },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    lines: {
      type: [transferLineSchema],
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length > 0 && lines.length <= 500,
        message: "A stock transfer must contain between 1 and 500 lines.",
      },
    },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    lineCount: { type: Number, min: 0, default: 0 },
    totalRequestedQuantity: { type: Number, min: 0, default: 0 },
    totalApprovedQuantity: { type: Number, min: 0, default: 0 },
    totalDispatchedQuantity: { type: Number, min: 0, default: 0 },
    totalReceivedQuantity: { type: Number, min: 0, default: 0 },
    totalShortQuantity: { type: Number, min: 0, default: 0 },
    totalValue: { type: Number, min: 0, default: 0 },

    directMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    dispatchMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    receipts: { type: [receiptSchema], default: [] },
    closeMovement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockMovement",
      default: null,
    },
    reversalMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: "StockMovement" }],

    submittedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: "" },
    dispatchedAt: { type: Date, default: null },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    receivedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closeReason: { type: String, trim: true, maxlength: 1000, default: "" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, trim: true, maxlength: 1000, default: "" },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversalReason: { type: String, trim: true, maxlength: 1000, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: true,
  }
);

stockTransferSchema.index({ tenantId: 1, transferNo: 1 }, { unique: true });
stockTransferSchema.index(
  { tenantId: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientRequestId: { $type: "string", $gt: "" } },
  }
);
stockTransferSchema.index({ tenantId: 1, status: 1, transferDate: -1, _id: -1 });
stockTransferSchema.index({ tenantId: 1, transferMode: 1, status: 1, transferDate: -1, _id: -1 });
stockTransferSchema.index({ tenantId: 1, sourceWarehouse: 1, status: 1, transferDate: -1, _id: -1 });
stockTransferSchema.index({ tenantId: 1, destinationWarehouse: 1, status: 1, transferDate: -1, _id: -1 });
stockTransferSchema.index({ tenantId: 1, products: 1, transferDate: -1, _id: -1 });
stockTransferSchema.index({ tenantId: 1, reference: 1, transferDate: -1 });
stockTransferSchema.index({ tenantId: 1, expectedDeliveryDate: 1, status: 1 });
stockTransferSchema.index({ tenantId: 1, createdBy: 1, transferDate: -1, _id: -1 });
stockTransferSchema.index({ tenantId: 1, transferDate: -1, _id: -1 });

const clean = (value) => String(value ?? "").trim();
const idKey = (value) => String(value || "");

const uniqueStrings = (values = []) => {
  const seen = new Set();
  const result = [];
  for (const raw of Array.isArray(values) ? values : []) {
    const value = clean(raw).toUpperCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
};

const uniqueObjectIds = (values = []) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter(Boolean).filter((value) => {
    const key = idKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeLine = (line) => {
  line.requestedQuantity = roundQuantity(line.requestedQuantity);
  line.approvedQuantity = roundQuantity(line.approvedQuantity);
  line.dispatchedQuantity = roundQuantity(line.dispatchedQuantity);
  line.receivedQuantity = roundQuantity(line.receivedQuantity);
  line.shortQuantity = roundQuantity(line.shortQuantity);
  line.remainingQuantity = roundQuantity(
    Math.max(Number(line.dispatchedQuantity || 0) - Number(line.receivedQuantity || 0) - Number(line.shortQuantity || 0), 0)
  );
  line.unitCost = roundMoney(line.unitCost);
  line.lineValue = roundMoney(Number(line.approvedQuantity || 0) * Number(line.unitCost || 0));
  line.lotNumber = clean(line.lotNumber).toUpperCase();
  line.serialNumbers = uniqueStrings(line.serialNumbers);
  line.receivedSerialNumbers = uniqueStrings(line.receivedSerialNumbers);
  line.note = clean(line.note);
  return line;
};

stockTransferSchema.pre("validate", function (next) {
  this.transferDate = this.transferDate || new Date();
  this.transferNo = clean(this.transferNo).toUpperCase();
  this.transferMode = clean(this.transferMode || "two_step").toLowerCase();
  this.status = clean(this.status || "draft").toLowerCase();
  this.reference = clean(this.reference).toUpperCase();
  this.externalReference = clean(this.externalReference);
  this.clientRequestId = clean(this.clientRequestId);
  this.currency = clean(this.currency || "BDT").toUpperCase();
  this.reason = clean(this.reason);
  this.notes = clean(this.notes);

  if (this.expectedDeliveryDate && this.expectedDeliveryDate < this.transferDate) {
    this.invalidate("expectedDeliveryDate", "Expected delivery date cannot be before the transfer date.");
  }

  const seen = new Set();
  for (let index = 0; index < this.lines.length; index += 1) {
    const line = normalizeLine(this.lines[index]);
    const key = [
      idKey(line.product),
      idKey(line.sourceLocation) || "none",
      idKey(line.destinationLocation) || "none",
      line.lotNumber || "none",
    ].join(":");
    if (seen.has(key)) {
      this.invalidate("lines", `Duplicate transfer position at line ${index + 1}.`);
    }
    seen.add(key);

    if (line.approvedQuantity > line.requestedQuantity) {
      this.invalidate("lines", `Approved quantity cannot exceed requested quantity at line ${index + 1}.`);
    }
    if (line.dispatchedQuantity > line.approvedQuantity) {
      this.invalidate("lines", `Dispatched quantity cannot exceed approved quantity at line ${index + 1}.`);
    }
    if (line.receivedQuantity + line.shortQuantity > line.dispatchedQuantity) {
      this.invalidate("lines", `Received and short quantities cannot exceed dispatched quantity at line ${index + 1}.`);
    }
    if (line.receivedSerialNumbers.some((serial) => !line.serialNumbers.includes(serial))) {
      this.invalidate("lines", `Received serial numbers must exist in the dispatched serial list at line ${index + 1}.`);
    }
    if (line.manufactureDate && line.expiryDate && line.expiryDate < line.manufactureDate) {
      this.invalidate("lines", `Expiry date cannot be before manufacture date at line ${index + 1}.`);
    }
  }

  const sourcePosition = `${idKey(this.sourceWarehouse)}:${this.lines.map((line) => idKey(line.sourceLocation) || "none").join("|")}`;
  const destinationPosition = `${idKey(this.destinationWarehouse)}:${this.lines.map((line) => idKey(line.destinationLocation) || "none").join("|")}`;
  if (sourcePosition === destinationPosition) {
    this.invalidate("destinationWarehouse", "Source and destination stock positions must be different.");
  }

  this.products = uniqueObjectIds(this.lines.map((line) => line.product));
  this.lineCount = this.lines.length;
  this.totalRequestedQuantity = roundQuantity(this.lines.reduce((sum, line) => sum + Number(line.requestedQuantity || 0), 0));
  this.totalApprovedQuantity = roundQuantity(this.lines.reduce((sum, line) => sum + Number(line.approvedQuantity || 0), 0));
  this.totalDispatchedQuantity = roundQuantity(this.lines.reduce((sum, line) => sum + Number(line.dispatchedQuantity || 0), 0));
  this.totalReceivedQuantity = roundQuantity(this.lines.reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0));
  this.totalShortQuantity = roundQuantity(this.lines.reduce((sum, line) => sum + Number(line.shortQuantity || 0), 0));
  this.totalValue = roundMoney(this.lines.reduce((sum, line) => sum + Number(line.lineValue || 0), 0));

  next();
});

export { TRANSFER_MODES, TRANSFER_STATUSES };
export default mongoose.model("StockTransfer", stockTransferSchema);
