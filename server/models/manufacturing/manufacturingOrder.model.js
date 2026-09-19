import mongoose from "mongoose";
const materialSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  requiredQuantity: { type: Number, min: 0, default: 0 },
  issuedQuantity: { type: Number, min: 0, default: 0 },
  returnedQuantity: { type: Number, min: 0, default: 0 },
  scrappedQuantity: { type: Number, min: 0, default: 0 },
  unit: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUnit", default: null },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "WarehouseLocation", default: null },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  moNumber: { type: String, required: true, trim: true, uppercase: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  quantity: { type: Number, min: 0.000001, required: true },
  completedQuantity: { type: Number, min: 0, default: 0 },
  rejectedQuantity: { type: Number, min: 0, default: 0 },
  reworkQuantity: { type: Number, min: 0, default: 0 },
  bom: { type: mongoose.Schema.Types.ObjectId, ref: "BillOfMaterial", required: true },
  routing: { type: mongoose.Schema.Types.ObjectId, ref: "Routing", default: null },
  productionPlan: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionPlan", default: null },
  salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder", default: null },
  rawMaterialWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
  finishedGoodsWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
  plannedStart: { type: Date, default: null },
  plannedEnd: { type: Date, default: null },
  actualStart: { type: Date, default: null },
  actualEnd: { type: Date, default: null },
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
  status: { type: String, enum: ["draft", "planned", "released", "in_progress", "paused", "quality_hold", "completed", "cancelled"], default: "draft", index: true },
  materialStatus: { type: String, enum: ["not_checked", "shortage", "ready", "partially_issued", "issued"], default: "not_checked" },
  qualityStatus: { type: String, enum: ["not_required", "pending", "passed", "failed", "hold"], default: "pending" },
  materials: { type: [materialSchema], default: [] },
  productionIssueMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: "StockMovement" }],
  productionReceiptMovements: [{ type: mongoose.Schema.Types.ObjectId, ref: "StockMovement" }],
  estimatedCost: { type: Number, min: 0, default: 0 },
  actualCost: { type: Number, min: 0, default: 0 },
  notes: { type: String, trim: true, maxlength: 3000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, moNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, status: 1, plannedStart: 1, priority: -1 });
schema.index({ tenantId: 1, product: 1, createdAt: -1 });
schema.pre("validate", function(next){
  if (this.completedQuantity + this.rejectedQuantity > this.quantity + this.reworkQuantity) this.invalidate("completedQuantity", "Produced quantities exceed the manufacturing order quantity.");
  next();
});
export default mongoose.models.ManufacturingOrder || mongoose.model("ManufacturingOrder", schema);
