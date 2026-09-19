import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  scheduleNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", required: true, index: true },
  workCenter: { type: mongoose.Schema.Types.ObjectId, ref: "WorkCenter", required: true, index: true },
  machine: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", default: null, index: true },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true, index: true },
  priority: { type: Number, min: 1, max: 100, default: 50 },
  status: { type: String, enum: ["scheduled", "locked", "in_progress", "completed", "cancelled"], default: "scheduled", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, scheduleNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, machine: 1, startAt: 1, endAt: 1 });
schema.pre("validate", function(next){ if(this.endAt <= this.startAt) this.invalidate("endAt", "Schedule end must be after start."); next(); });
export default mongoose.models.ProductionSchedule || mongoose.model("ProductionSchedule", schema);
