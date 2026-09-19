import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  workCenter: { type: mongoose.Schema.Types.ObjectId, ref: "WorkCenter", default: null },
  stage: { type: String, trim: true, maxlength: 160, default: "" },
  quantity: { type: Number, min: 0, default: 0 },
  value: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["active", "hold", "completed"], default: "active", index: true },
  enteredAt: { type: Date, default: Date.now },
  exitedAt: { type: Date, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, manufacturingOrder: 1, workOrder: 1 }, { unique: true });
export default mongoose.models.WorkInProgress || mongoose.model("WorkInProgress", schema);
