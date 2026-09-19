import mongoose from "mongoose";
const checkSchema = new mongoose.Schema({
  parameter: { type: String, required: true, trim: true, maxlength: 160 },
  specification: { type: String, trim: true, maxlength: 500, default: "" },
  measuredValue: { type: String, trim: true, maxlength: 200, default: "" },
  result: { type: String, enum: ["pass", "fail", "na"], default: "na" },
  notes: { type: String, trim: true, maxlength: 500, default: "" },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  inspectionNumber: { type: String, required: true, trim: true, uppercase: true },
  inspectionType: { type: String, enum: ["incoming", "in_process", "final", "subcontract"], required: true, index: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", default: null, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantityInspected: { type: Number, min: 0, default: 0 },
  quantityPassed: { type: Number, min: 0, default: 0 },
  quantityFailed: { type: Number, min: 0, default: 0 },
  batchNumber: { type: String, trim: true, uppercase: true, default: "" },
  checks: { type: [checkSchema], default: [] },
  result: { type: String, enum: ["pending", "pass", "fail", "hold"], default: "pending", index: true },
  inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  inspectedAt: { type: Date, default: null },
  notes: { type: String, trim: true, maxlength: 1500, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, inspectionNumber: 1 }, { unique: true });
export default mongoose.models.QualityInspection || mongoose.model("QualityInspection", schema);
