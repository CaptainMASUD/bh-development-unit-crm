import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  ncrNumber: { type: String, required: true, trim: true, uppercase: true },
  inspection: { type: mongoose.Schema.Types.ObjectId, ref: "QualityInspection", default: null },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", default: null, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  defectType: { type: String, required: true, trim: true, maxlength: 160 },
  severity: { type: String, enum: ["minor", "major", "critical"], default: "minor", index: true },
  quantity: { type: Number, min: 0.000001, required: true },
  disposition: { type: String, enum: ["pending", "rework", "scrap", "use_as_is", "return_to_supplier"], default: "pending" },
  rootCause: { type: String, trim: true, maxlength: 2500, default: "" },
  correctiveAction: { type: String, trim: true, maxlength: 2500, default: "" },
  preventiveAction: { type: String, trim: true, maxlength: 2500, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  dueDate: { type: Date, default: null },
  status: { type: String, enum: ["open", "investigating", "action_required", "closed"], default: "open", index: true },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  closedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, ncrNumber: 1 }, { unique: true });
export default mongoose.models.NonConformance || mongoose.model("NonConformance", schema);
