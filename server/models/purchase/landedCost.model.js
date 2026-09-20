import mongoose from "mongoose";

export const LANDED_COST_STATUSES = ["draft", "finalized", "reversed", "cancelled"];
export const LANDED_COST_ALLOCATION_BASES = ["value", "quantity", "manual"];

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const qty = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 1_000_000) / 1_000_000;
const clean = (value) => String(value ?? "").trim();

const componentSchema = new mongoose.Schema(
  {
    costType: {
      type: String,
      enum: ["freight", "insurance", "customs_duty", "vat_tax", "port_charge", "cnf_charge", "bank_charge", "transport", "inspection", "other"],
      required: true,
    },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    amount: { type: Number, required: true, min: 0, set: money },
    currency: { type: String, trim: true, uppercase: true, default: "BDT" },
    exchangeRate: { type: Number, min: 0.000001, default: 1 },
    baseAmount: { type: Number, min: 0, default: 0, set: money },
    reference: { type: String, trim: true, maxlength: 160, default: "" },
  },
  { _id: true }
);

const allocationSchema = new mongoose.Schema(
  {
    goodsReceipt: { type: mongoose.Schema.Types.ObjectId, ref: "GoodsReceipt", required: true },
    goodsReceiptLine: { type: mongoose.Schema.Types.ObjectId, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
    receivedQuantity: { type: Number, min: 0, default: 0, set: qty },
    baseValue: { type: Number, min: 0, default: 0, set: money },
    allocationWeight: { type: Number, min: 0, default: 0 },
    allocatedCost: { type: Number, min: 0, default: 0, set: money },
    landedUnitCostIncrease: { type: Number, min: 0, default: 0 },
  },
  { _id: true }
);

const landedCostSchema = new mongoose.Schema(
  {
    landedCostNo: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    commercialLC: { type: mongoose.Schema.Types.ObjectId, ref: "CommercialLC", required: true, index: true },
    importShipment: { type: mongoose.Schema.Types.ObjectId, ref: "ImportShipment", default: null, index: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    goodsReceipts: [{ type: mongoose.Schema.Types.ObjectId, ref: "GoodsReceipt" }],
    allocationBasis: { type: String, enum: LANDED_COST_ALLOCATION_BASES, default: "value" },
    components: { type: [componentSchema], default: [] },
    allocations: { type: [allocationSchema], default: [] },
    totalLandedCost: { type: Number, min: 0, default: 0, set: money },
    allocatedTotal: { type: Number, min: 0, default: 0, set: money },
    status: { type: String, enum: LANDED_COST_STATUSES, default: "draft", index: true },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    reversalJournalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reversalReason: { type: String, trim: true, maxlength: 1000, default: "" },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

landedCostSchema.index({ landedCostNo: 1 }, { unique: true });
landedCostSchema.index({ commercialLC: 1, status: 1, createdAt: -1 });
landedCostSchema.index({ purchaseOrder: 1, status: 1, createdAt: -1 });

landedCostSchema.pre("validate", function () {
  this.landedCostNo = clean(this.landedCostNo).toUpperCase();
  this.allocationBasis = clean(this.allocationBasis || "value").toLowerCase();
  this.status = clean(this.status || "draft").toLowerCase();
  for (const component of this.components || []) {
    component.currency = clean(component.currency || "BDT").toUpperCase();
    component.exchangeRate = Number(component.exchangeRate || 1);
    component.baseAmount = money(component.amount * component.exchangeRate);
  }
  this.totalLandedCost = money((this.components || []).reduce((sum, item) => sum + Number(item.baseAmount || 0), 0));
  this.allocatedTotal = money((this.allocations || []).reduce((sum, item) => sum + Number(item.allocatedCost || 0), 0));
  for (const allocation of this.allocations || []) {
    allocation.landedUnitCostIncrease = allocation.receivedQuantity > 0
      ? Math.round((allocation.allocatedCost / allocation.receivedQuantity + Number.EPSILON) * 1000000) / 1000000
      : 0;
  }
});

export default mongoose.model("LandedCost", landedCostSchema);
