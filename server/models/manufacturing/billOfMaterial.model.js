import mongoose from "mongoose";
const lineSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  unit: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUnit", default: null },
  scrapPercent: { type: Number, min: 0, max: 100, default: 0 },
  issueWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
  issueLocation: { type: mongoose.Schema.Types.ObjectId, ref: "WarehouseLocation", default: null },
  isAlternative: { type: Boolean, default: false },
  alternativeGroup: { type: String, trim: true, maxlength: 50, default: "" },
  notes: { type: String, trim: true, maxlength: 500, default: "" },
}, { _id: true });
const byProductSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  unit: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUnit", default: null },
  recoveryPercent: { type: Number, min: 0, max: 100, default: 100 },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  bomNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  version: { type: Number, min: 1, default: 1 },
  outputQuantity: { type: Number, min: 0.000001, default: 1 },
  outputUnit: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryUnit", default: null },
  lines: { type: [lineSchema], default: [] },
  byProducts: { type: [byProductSchema], default: [] },
  status: { type: String, enum: ["draft", "active", "obsolete"], default: "draft", index: true },
  effectiveFrom: { type: Date, default: null },
  effectiveTo: { type: Date, default: null },
  revisionNotes: { type: String, trim: true, maxlength: 2000, default: "" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, bomNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, product: 1, version: 1 }, { unique: true });
schema.index({ tenantId: 1, product: 1, status: 1, version: -1 });
schema.pre("validate", function(next){
  if (!this.lines?.length) this.invalidate("lines", "BOM must contain at least one component.");
  if (this.effectiveFrom && this.effectiveTo && this.effectiveTo < this.effectiveFrom) this.invalidate("effectiveTo", "Effective-to date cannot precede effective-from date.");
  next();
});
export default mongoose.models.BillOfMaterial || mongoose.model("BillOfMaterial", schema);
