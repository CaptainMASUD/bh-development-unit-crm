import mongoose from "mongoose";
const lineSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  sourceType: { type: String, enum: ["manual", "sales_order", "forecast", "reorder"], default: "manual" },
  sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  demandQuantity: { type: Number, min: 0, default: 0 },
  availableQuantity: { type: Number, default: 0 },
  safetyStock: { type: Number, min: 0, default: 0 },
  plannedQuantity: { type: Number, min: 0.000001, required: true },
  bom: { type: mongoose.Schema.Types.ObjectId, ref: "BillOfMaterial", default: null },
  routing: { type: mongoose.Schema.Types.ObjectId, ref: "Routing", default: null },
  finishedGoodsWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
  requiredDate: { type: Date, default: null },
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  planNumber: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, trim: true, maxlength: 180, default: "" },
  planningDate: { type: Date, default: Date.now },
  periodStart: { type: Date, default: null },
  periodEnd: { type: Date, default: null },
  lines: { type: [lineSchema], default: [] },
  status: { type: String, enum: ["draft", "approved", "mrp_run", "released", "completed", "cancelled"], default: "draft", index: true },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, planNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, status: 1, planningDate: -1 });
export default mongoose.models.ProductionPlan || mongoose.model("ProductionPlan", schema);
