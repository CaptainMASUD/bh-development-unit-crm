import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  reworkNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  nonConformance: { type: mongoose.Schema.Types.ObjectId, ref: "NonConformance", default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  routing: { type: mongoose.Schema.Types.ObjectId, ref: "Routing", default: null },
  reason: { type: String, required: true, trim: true, maxlength: 1500 },
  plannedCost: { type: Number, min: 0, default: 0 },
  actualCost: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["draft", "released", "in_progress", "completed", "cancelled"], default: "draft", index: true },
  completedQuantity: { type: Number, min: 0, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, reworkNumber: 1 }, { unique: true });
export default mongoose.models.ReworkOrder || mongoose.model("ReworkOrder", schema);
