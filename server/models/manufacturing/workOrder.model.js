import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  woNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  operationId: { type: mongoose.Schema.Types.ObjectId, default: null },
  sequence: { type: Number, min: 1, required: true },
  operationName: { type: String, required: true, trim: true, maxlength: 160 },
  workCenter: { type: mongoose.Schema.Types.ObjectId, ref: "WorkCenter", required: true, index: true },
  machine: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", default: null },
  plannedQuantity: { type: Number, min: 0, required: true },
  completedQuantity: { type: Number, min: 0, default: 0 },
  rejectedQuantity: { type: Number, min: 0, default: 0 },
  plannedStart: { type: Date, default: null },
  plannedEnd: { type: Date, default: null },
  actualStart: { type: Date, default: null },
  actualEnd: { type: Date, default: null },
  setupMinutes: { type: Number, min: 0, default: 0 },
  laborMinutes: { type: Number, min: 0, default: 0 },
  machineMinutes: { type: Number, min: 0, default: 0 },
  downtimeMinutes: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["pending", "ready", "in_progress", "paused", "quality_hold", "completed", "cancelled"], default: "pending", index: true },
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, woNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, manufacturingOrder: 1, sequence: 1 }, { unique: true });
export default mongoose.models.WorkOrder || mongoose.model("WorkOrder", schema);
