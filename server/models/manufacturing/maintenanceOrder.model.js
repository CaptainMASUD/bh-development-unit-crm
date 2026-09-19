import mongoose from "mongoose";
const partSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  cost: { type: Number, min: 0, default: 0 },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  maintenanceNumber: { type: String, required: true, trim: true, uppercase: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: "MaintenancePlan", default: null },
  machine: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true, index: true },
  type: { type: String, enum: ["preventive", "corrective", "breakdown", "inspection"], required: true },
  priority: { type: String, enum: ["low", "normal", "high", "critical"], default: "normal" },
  scheduledAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  downtimeMinutes: { type: Number, min: 0, default: 0 },
  laborCost: { type: Number, min: 0, default: 0 },
  externalCost: { type: Number, min: 0, default: 0 },
  parts: { type: [partSchema], default: [] },
  findings: { type: String, trim: true, maxlength: 2500, default: "" },
  resolution: { type: String, trim: true, maxlength: 2500, default: "" },
  status: { type: String, enum: ["open", "scheduled", "in_progress", "completed", "cancelled"], default: "open", index: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, maintenanceNumber: 1 }, { unique: true });
export default mongoose.models.MaintenanceOrder || mongoose.model("MaintenanceOrder", schema);
