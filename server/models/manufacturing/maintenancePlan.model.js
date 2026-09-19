import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  planNumber: { type: String, required: true, trim: true, uppercase: true },
  machine: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 180 },
  triggerType: { type: String, enum: ["calendar", "meter"], default: "calendar" },
  frequencyDays: { type: Number, min: 1, default: 30 },
  frequencyMeter: { type: Number, min: 1, default: null },
  nextDueAt: { type: Date, default: null, index: true },
  nextDueMeter: { type: Number, min: 0, default: null },
  checklist: { type: [String], default: [] },
  estimatedMinutes: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["active", "paused", "inactive"], default: "active", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, planNumber: 1 }, { unique: true });
export default mongoose.models.MaintenancePlan || mongoose.model("MaintenancePlan", schema);
