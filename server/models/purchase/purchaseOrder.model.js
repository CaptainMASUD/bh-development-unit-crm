import mongoose from "mongoose";

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "partially_received",
  "received",
  "closed",
  "rejected",
  "cancelled",
];

export const PURCHASE_ORDER_EDITABLE_STATUSES = ["draft", "rejected"];
export const PURCHASE_ORDER_OPEN_STATUSES = [
  "approved",
  "partially_received",
];

export const DISCOUNT_TYPES = ["none", "percent", "fixed"];
export const TAX_TYPES = ["none", "exclusive", "inclusive"];
export const TRADE_TYPES = ["local", "import"];
export const IMPORT_STATUSES = ["not_applicable", "lc_pending", "lc_open", "shipped", "customs_clearance", "goods_received", "settled", "closed"];

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
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
  },
  { _id: false, id: false }
);

const purchaseOrderLineSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    itemName: { type: String, trim: true, maxlength: 180, default: "" },
    supplierProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProduct",
      default: null,
    },
    purchaseUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryUnit",
      default: null,
    },
    destinationWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
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
    supplierSku: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    orderedQuantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    receivedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    returnedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    cancelledQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: DISCOUNT_TYPES,
      default: "none",
    },
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxType: {
      type: String,
      enum: TAX_TYPES,
      default: "none",
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    lineSubtotal: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    lineTotal: { type: Number, min: 0, default: 0 },
    lineStatus: {
      type: String,
      enum: ["open", "partially_received", "received", "cancelled"],
      default: "open",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  { _id: true, id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 100, default: "" },
    addressLine1: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    city: { type: String, trim: true, maxlength: 120, default: "" },
    state: { type: String, trim: true, maxlength: 120, default: "" },
    postalCode: { type: String, trim: true, maxlength: 40, default: "" },
    country: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "Bangladesh",
    },
  },
  { _id: false, id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    orderNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
      unique: true,
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    purchaseType: {
      type: String,
      enum: ["quick_purchase", "industrial_purchase", "direct_order"],
      default: "direct_order",
      index: true,
    },
    tradeType: {
      type: String,
      enum: TRADE_TYPES,
      default: "local",
      index: true,
    },
    importStatus: {
      type: String,
      enum: IMPORT_STATUSES,
      default: "not_applicable",
      index: true,
    },
    purchaseReference: { type: String, trim: true, uppercase: true, maxlength: 80, default: "", index: true },
    requestReference: { type: String, trim: true, uppercase: true, maxlength: 80, default: "", index: true },
    purchaseIssue: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseIssue", default: null, index: true },
    expectedDeliveryDate: {
      type: Date,
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
    supplierQuotationRef: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    supplierReference: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    defaultWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    defaultLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WarehouseLocation",
      default: null,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },
    exchangeRate: {
      type: Number,
      min: 0.000001,
      default: 1,
    },
    paymentTermType: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 40,
      default: "immediate",
    },
    paymentTermDays: {
      type: Number,
      min: 0,
      max: 3650,
      default: 0,
    },
    incoterm: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 30,
      default: "",
    },
    shippingAddress: {
      type: shippingAddressSchema,
      default: () => ({}),
    },
    lines: {
      type: [purchaseOrderLineSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0 && items.length <= 500,
        message: "A purchase order requires 1 to 500 lines.",
      },
    },
    lineCount: { type: Number, min: 0, default: 0 },
    totalOrderedQuantity: { type: Number, min: 0, default: 0 },
    totalReceivedQuantity: { type: Number, min: 0, default: 0 },
    totalReturnedQuantity: { type: Number, min: 0, default: 0 },
    subtotal: { type: Number, min: 0, default: 0 },
    discountTotal: { type: Number, min: 0, default: 0 },
    taxTotal: { type: Number, min: 0, default: 0 },
    shippingCost: { type: Number, min: 0, default: 0 },
    otherCost: { type: Number, min: 0, default: 0 },
    grandTotal: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    dueAmount: { type: Number, min: 0, default: 0 },
    paymentPlan: { type: String, trim: true, default: "" },
    paymentStatus: { type: String, enum: ["unpaid", "partial", "paid", "awaiting_inspection", "awaiting_payment"], default: "unpaid", index: true },
    qualityStatus: { type: String, enum: ["not_required", "waiting", "processing", "passed", "partially_accepted", "rejected"], default: "waiting", index: true },
    inventoryStatus: { type: String, enum: ["not_ready", "pending_assignment", "partially_received", "received", "rejected"], default: "not_ready", index: true },
    returnStatus: { type: String, enum: ["none", "pending", "processing", "resolved", "closed"], default: "none", index: true },
    baseCurrencyTotal: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: PURCHASE_ORDER_STATUSES,
      default: "draft",
      index: true,
    },
    revision: { type: Number, min: 1, default: 1 },
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
    termsAndConditions: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: {
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
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    closeReason: {
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

purchaseOrderSchema.index({ supplier: 1, status: 1, orderDate: -1, _id: -1 });
purchaseOrderSchema.index({ tradeType: 1, importStatus: 1, orderDate: -1, _id: -1 });
purchaseOrderSchema.index({ status: 1, orderDate: -1, _id: -1 });
purchaseOrderSchema.index({ expectedDeliveryDate: 1, status: 1 });
purchaseOrderSchema.index({ "lines.product": 1, status: 1, orderDate: -1 });
purchaseOrderSchema.index({ updatedAt: -1, _id: -1 });
purchaseOrderSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } }
);

const normalizeLine = (line) => {
  line.itemName = clean(line.itemName);
  line.supplierSku = clean(line.supplierSku).toUpperCase();
  line.description = clean(line.description);
  line.notes = clean(line.notes);
  line.discountType = clean(line.discountType || "none").toLowerCase();
  line.taxType = clean(line.taxType || "none").toLowerCase();

  line.orderedQuantity = roundQuantity(line.orderedQuantity);
  line.receivedQuantity = roundQuantity(line.receivedQuantity);
  line.returnedQuantity = roundQuantity(line.returnedQuantity);
  line.cancelledQuantity = roundQuantity(line.cancelledQuantity);
  line.unitPrice = roundMoney(line.unitPrice);
  line.discountValue = roundMoney(line.discountValue);
  line.taxRate = roundMoney(line.taxRate);

  const activeQuantity = Math.max(
    roundQuantity(line.orderedQuantity - line.cancelledQuantity),
    0
  );
  const subtotal = roundMoney(activeQuantity * line.unitPrice);

  let discountAmount = 0;
  if (line.discountType === "percent") {
    discountAmount = roundMoney(subtotal * (line.discountValue / 100));
  } else if (line.discountType === "fixed") {
    discountAmount = Math.min(roundMoney(line.discountValue), subtotal);
  }

  const netBeforeTax = roundMoney(Math.max(subtotal - discountAmount, 0));
  let taxableAmount = netBeforeTax;
  let taxAmount = 0;
  let lineTotal = netBeforeTax;

  if (line.taxType === "exclusive") {
    taxAmount = roundMoney(netBeforeTax * (line.taxRate / 100));
    lineTotal = roundMoney(netBeforeTax + taxAmount);
  } else if (line.taxType === "inclusive" && line.taxRate > 0) {
    taxableAmount = roundMoney(netBeforeTax / (1 + line.taxRate / 100));
    taxAmount = roundMoney(netBeforeTax - taxableAmount);
  }

  line.lineSubtotal = subtotal;
  line.discountAmount = discountAmount;
  line.taxableAmount = taxableAmount;
  line.taxAmount = taxAmount;
  line.lineTotal = lineTotal;

  if (activeQuantity <= 0) line.lineStatus = "cancelled";
  else if (line.receivedQuantity >= activeQuantity) line.lineStatus = "received";
  else if (line.receivedQuantity > 0) line.lineStatus = "partially_received";
  else line.lineStatus = "open";
};

purchaseOrderSchema.pre("validate", function (next) {
  this.orderNo = clean(this.orderNo).toUpperCase();
  this.supplierQuotationRef = clean(this.supplierQuotationRef).toUpperCase();
  this.supplierReference = clean(this.supplierReference);
  this.currency = clean(this.currency || "BDT").toUpperCase();
  this.tradeType = clean(this.tradeType || "local").toLowerCase();
  this.importStatus = clean(this.importStatus || (this.tradeType === "import" ? "lc_pending" : "not_applicable")).toLowerCase();
  if (this.tradeType === "local") this.importStatus = "not_applicable";
  if (this.tradeType === "import" && this.importStatus === "not_applicable") this.importStatus = "lc_pending";
  this.paymentTermType = clean(this.paymentTermType || "immediate").toLowerCase();
  this.incoterm = clean(this.incoterm).toUpperCase();
  this.status = clean(this.status || "draft").toLowerCase();
  this.idempotencyKey = clean(this.idempotencyKey);
  this.notes = clean(this.notes);
  this.termsAndConditions = clean(this.termsAndConditions);
  this.rejectionReason = clean(this.rejectionReason);
  this.cancellationReason = clean(this.cancellationReason);
  this.closeReason = clean(this.closeReason);
  this.shippingCost = roundMoney(this.shippingCost);
  this.otherCost = roundMoney(this.otherCost);
  this.exchangeRate = Number(this.exchangeRate || 1);

  for (const line of this.lines || []) normalizeLine(line);

  this.lineCount = this.lines?.length || 0;
  this.totalOrderedQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.orderedQuantity || 0), 0)
  );
  this.totalReceivedQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.receivedQuantity || 0), 0)
  );
  this.totalReturnedQuantity = roundQuantity(
    (this.lines || []).reduce((sum, line) => sum + Number(line.returnedQuantity || 0), 0)
  );
  this.subtotal = roundMoney(
    (this.lines || []).reduce((sum, line) => sum + Number(line.lineSubtotal || 0), 0)
  );
  this.discountTotal = roundMoney(
    (this.lines || []).reduce((sum, line) => sum + Number(line.discountAmount || 0), 0)
  );
  this.taxTotal = roundMoney(
    (this.lines || []).reduce((sum, line) => sum + Number(line.taxAmount || 0), 0)
  );
  this.grandTotal = roundMoney(
    (this.lines || []).reduce((sum, line) => sum + Number(line.lineTotal || 0), 0) +
      Number(this.shippingCost || 0) +
      Number(this.otherCost || 0)
  );
  this.baseCurrencyTotal = roundMoney(this.grandTotal * this.exchangeRate);

  if (
    this.expectedDeliveryDate &&
    this.orderDate &&
    new Date(this.expectedDeliveryDate) < new Date(this.orderDate)
  ) {
    this.invalidate(
      "expectedDeliveryDate",
      "Expected delivery date cannot be before the purchase-order date."
    );
  }

  for (const line of this.lines || []) {
    if (!line.product && !line.itemName) {
      line.invalidate("itemName", "A purchase-order line requires a Product or item name.");
    }
    const maxReceivable = roundQuantity(
      Number(line.orderedQuantity || 0) - Number(line.cancelledQuantity || 0)
    );
    if (line.receivedQuantity > maxReceivable) {
      line.invalidate(
        "receivedQuantity",
        "Received quantity cannot exceed the active ordered quantity."
      );
    }
    if (line.returnedQuantity > line.receivedQuantity) {
      line.invalidate(
        "returnedQuantity",
        "Returned quantity cannot exceed the received quantity."
      );
    }
    if (line.discountType === "percent" && line.discountValue > 100) {
      line.invalidate("discountValue", "Percentage discount cannot exceed 100%.");
    }
  }

  next();
});

export { roundMoney, roundQuantity };
export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
