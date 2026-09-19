import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  costNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, unique: true, index: true },
  materialCost: { type: Number, min: 0, default: 0 },
  laborCost: { type: Number, min: 0, default: 0 },
  machineCost: { type: Number, min: 0, default: 0 },
  overheadCost: { type: Number, min: 0, default: 0 },
  subcontractCost: { type: Number, min: 0, default: 0 },
  scrapCost: { type: Number, min: 0, default: 0 },
  reworkCost: { type: Number, min: 0, default: 0 },
  totalCost: { type: Number, min: 0, default: 0 },
  producedQuantity: { type: Number, min: 0, default: 0 },
  unitCost: { type: Number, min: 0, default: 0 },
  standardUnitCost: { type: Number, min: 0, default: 0 },
  variance: { type: Number, default: 0 },
  status: { type: String, enum: ["estimated", "provisional", "final"], default: "estimated", index: true },
  calculatedAt: { type: Date, default: Date.now },
  calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, costNumber: 1 }, { unique: true });
export default mongoose.models.ManufacturingCost || mongoose.model("ManufacturingCost", schema);
