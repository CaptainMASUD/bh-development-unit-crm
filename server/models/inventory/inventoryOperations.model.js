import mongoose from "mongoose";

const ref = (model, required = false) => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: model,
  required,
  default: required ? undefined : null,
  index: true,
});
const userRef = () => ref("User");
const tenantRef = () => ({
  type: mongoose.Schema.Types.ObjectId,
  ref: "Tenant",
  required: true,
  index: true,
});

const trackingSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    trackingReference: { type: String, required: true, uppercase: true, trim: true },
    trackingType: {
      type: String,
      enum: ["batch", "serial", "expiry", "batch_expiry"],
      required: true,
      index: true,
    },
    product: ref("Product", true),
    warehouse: ref("Warehouse", true),
    location: ref("WarehouseLocation"),
    batchNumber: { type: String, uppercase: true, trim: true, default: "" },
    serialNumber: { type: String, uppercase: true, trim: true, default: "" },
    arrivalDate: { type: Date, default: Date.now, index: true },
    manufactureDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null, index: true },
    originalQuantity: { type: Number, min: 0, required: true },
    remainingQuantity: { type: Number, min: 0, required: true },
    usableQuantity: { type: Number, min: 0, required: true },
    unitCost: { type: Number, min: 0, default: 0 },
    qualityState: {
      type: String,
      enum: ["released", "quarantine", "removed"],
      default: "released",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "depleted", "expired", "removed"],
      default: "active",
      index: true,
    },
    sourceType: { type: String, trim: true, default: "inventory_arrival" },
    sourceId: ref("StockMovement"),
    createdBy: userRef(),
    updatedBy: userRef(),
  },
  { timestamps: true, versionKey: false }
);
trackingSchema.index({ tenantId: 1, trackingReference: 1 }, { unique: true });
trackingSchema.index(
  { tenantId: 1, product: 1, serialNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { serialNumber: { $type: "string", $gt: "" } },
  }
);
trackingSchema.index({ tenantId: 1, product: 1, warehouse: 1, qualityState: 1, arrivalDate: 1 });

const pendingInventorySchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    reference: { type: String, required: true, uppercase: true, trim: true },
    product: ref("Product"),
    quickProductName: { type: String, trim: true, default: "" },
    quickProductCode: { type: String, uppercase: true, trim: true, default: "" },
    acceptedQuantity: { type: Number, min: 0.000001, required: true },
    remainingQuantity: { type: Number, min: 0, required: true },
    unitCost: { type: Number, min: 0, required: true },
    trackingType: {
      type: String,
      enum: ["none", "batch", "serial", "expiry", "batch_expiry"],
      default: "none",
    },
    source: {
      type: String,
      enum: ["quality_inspection", "quick_purchase", "manual"],
      required: true,
      index: true,
    },
    purchaseReference: { type: String, trim: true, default: "" },
    purchaseId: { type: mongoose.Schema.Types.ObjectId, default: null },
    arrivalDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "partially_assigned", "assigned", "cancelled"],
      default: "pending",
      index: true,
    },
    assignments: [
      {
        warehouse: ref("Warehouse", true),
        location: ref("WarehouseLocation", true),
        quantity: { type: Number, min: 0.000001 },
        movement: ref("StockMovement"),
        assignedAt: Date,
        assignedBy: userRef(),
      },
    ],
    createdBy: userRef(),
    updatedBy: userRef(),
  },
  { timestamps: true, versionKey: false }
);
pendingInventorySchema.index({ tenantId: 1, reference: 1 }, { unique: true });

const stockRequestSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    requestReference: { type: String, required: true, uppercase: true, trim: true },
    requestDate: { type: Date, default: Date.now, index: true },
    product: ref("Product", true),
    requestedQuantity: { type: Number, min: 0.000001, required: true },
    requester: ref("User", true),
    department: ref("Department"),
    requiredDate: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ["pending", "approved", "issued", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    approver: userRef(),
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: { type: String, trim: true, default: "" },
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "StockIssue", default: null },
    notes: { type: String, trim: true, default: "" },
    createdBy: userRef(),
    updatedBy: userRef(),
  },
  { timestamps: true, versionKey: false }
);
stockRequestSchema.index({ tenantId: 1, requestReference: 1 }, { unique: true });
stockRequestSchema.index({ tenantId: 1, requester: 1, product: 1, status: 1 });

const allocationSchema = new mongoose.Schema(
  {
    tracking: ref("InventoryTracking"),
    trackingReference: String,
    quantity: Number,
  },
  { _id: false }
);

const stockIssueSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    issueReference: { type: String, required: true, uppercase: true, trim: true },
    issueDate: { type: Date, default: Date.now, index: true },
    request: ref("StockRequest"),
    transfer: ref("StockTransfer"),
    product: ref("Product", true),
    quantity: { type: Number, min: 0.000001, required: true },
    warehouse: ref("Warehouse", true),
    location: ref("WarehouseLocation"),
    requester: ref("User"),
    department: ref("Department"),
    approver: ref("User"),
    issuedBy: ref("User", true),
    issueMethod: { type: String, enum: ["fifo", "lifo"], default: "fifo" },
    allocations: [allocationSchema],
    movement: ref("StockMovement", true),
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    costAmount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["issued", "reversed"], default: "issued" },
  },
  { timestamps: true, versionKey: false }
);
stockIssueSchema.index({ tenantId: 1, issueReference: 1 }, { unique: true });

const consumptionSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    issue: ref("StockIssue", true),
    issueReference: String,
    issueDate: Date,
    product: ref("Product", true),
    quantity: Number,
    employee: ref("User"),
    department: ref("Department"),
    warehouse: ref("Warehouse"),
    location: ref("WarehouseLocation"),
    allocations: [allocationSchema],
    approver: ref("User"),
    issuedBy: ref("User"),
  },
  { timestamps: true, versionKey: false }
);
consumptionSchema.index({ tenantId: 1, employee: 1, product: 1, issueDate: -1 });
consumptionSchema.index({ tenantId: 1, department: 1, product: 1, issueDate: -1 });

const inspectionSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    inspectionReference: { type: String, required: true, uppercase: true, trim: true },
    product: ref("Product", true),
    warehouse: ref("Warehouse", true),
    location: ref("WarehouseLocation"),
    tracking: ref("InventoryTracking"),
    previousQuantity: { type: Number, min: 0, required: true },
    inspectedQuantity: { type: Number, min: 0, default: 0 },
    damagedQuantity: { type: Number, min: 0, default: 0 },
    remainingQuantity: { type: Number, min: 0, default: 0 },
    result: {
      type: String,
      enum: ["pending", "accepted", "damaged", "restricted", "removed"],
      default: "pending",
    },
    note: { type: String, trim: true, default: "" },
    requestSource: {
      type: String,
      enum: ["inventory_item", "warehouse_schedule", "tracking"],
      default: "inventory_item",
    },
    status: {
      type: String,
      enum: ["waiting", "processing", "completed", "cancelled"],
      default: "waiting",
      index: true,
    },
    requestedBy: ref("User"),
    inspector: ref("User"),
    completedAt: Date,
    movement: ref("StockMovement"),
    loss: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryLoss", default: null },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "WarehouseCheck", default: null },
    scheduleCycle: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true, versionKey: false }
);
inspectionSchema.index({ tenantId: 1, inspectionReference: 1 }, { unique: true });

const warehouseCheckSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    warehouse: ref("Warehouse", true),
    frequencyDays: { type: Number, min: 1, required: true },
    inspectionMode: {
      type: String,
      enum: ["full_warehouse", "item_by_item"],
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "processing", "paused", "completed"],
      default: "waiting",
      index: true,
    },
    cycleNumber: { type: Number, min: 1, default: 1 },
    lastInspectionDate: Date,
    nextInspectionDate: { type: Date, required: true, index: true },
    queuedInspections: [{ type: mongoose.Schema.Types.ObjectId, ref: "StockInspection" }],
    createdBy: userRef(),
    updatedBy: userRef(),
  },
  { timestamps: true, versionKey: false }
);
warehouseCheckSchema.index({ tenantId: 1, warehouse: 1 }, { unique: true });

const lossSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    lossReference: { type: String, required: true, uppercase: true, trim: true },
    lossDate: { type: Date, default: Date.now, index: true },
    product: ref("Product", true),
    warehouse: ref("Warehouse", true),
    location: ref("WarehouseLocation"),
    quantity: { type: Number, min: 0.000001, required: true },
    unitCost: { type: Number, min: 0, default: 0 },
    lossValue: { type: Number, min: 0, default: 0 },
    lossType: {
      type: String,
      enum: [
        "damage",
        "expiry",
        "adjustment",
        "tracking_removal",
        "inspection",
        "scrap",
        "shrinkage",
        "transfer_shortage",
        "other",
      ],
      required: true,
      index: true,
    },
    reason: { type: String, trim: true, default: "" },
    sourceType: String,
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    movement: ref("StockMovement"),
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    approvedBy: ref("User"),
    approvedAt: { type: Date, default: null },
    recordedBy: ref("User"),
  },
  { timestamps: true, versionKey: false }
);
lossSchema.index({ tenantId: 1, lossReference: 1 }, { unique: true });
lossSchema.index({ tenantId: 1, product: 1, warehouse: 1, lossDate: -1 });

const preferenceSchema = new mongoose.Schema(
  {
    tenantId: tenantRef(),
    key: { type: String, default: "default" },
    stockIssueMethod: { type: String, enum: ["fifo", "lifo"], default: "fifo" },
    nearExpiryAlertDays: { type: Number, min: 1, max: 3650, default: 30 },
    automaticProductCodes: { type: Boolean, default: true },
    enforceSegregationOfDuties: { type: Boolean, default: false },
    sodThresholdAmount: { type: Number, default: 0 },
    enforceClosedPeriodLock: { type: Boolean, default: true },
    allowNegativeStock: {
      type: Boolean,
      default: false,
      validate: {
        validator: function (v) {
          return v !== true;
        },
        message: "Negative stock is strictly disabled until GL variance accounting is implemented.",
      },
    },
    updatedBy: userRef(),
  },
  { timestamps: true, versionKey: false }
);
preferenceSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const InventoryTracking = mongoose.model("InventoryTracking", trackingSchema);
export const PendingInventory = mongoose.model("PendingInventory", pendingInventorySchema);
export const StockRequest = mongoose.model("StockRequest", stockRequestSchema);
export const StockIssue = mongoose.model("StockIssue", stockIssueSchema);
export const ConsumptionHistory = mongoose.model("ConsumptionHistory", consumptionSchema);
export const StockInspection = mongoose.model("StockInspection", inspectionSchema);
export const WarehouseCheck = mongoose.model("WarehouseCheck", warehouseCheckSchema);
export const InventoryLoss = mongoose.model("InventoryLoss", lossSchema);
export const InventoryPreference = mongoose.model("InventoryPreference", preferenceSchema);
