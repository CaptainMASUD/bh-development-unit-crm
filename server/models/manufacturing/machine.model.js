import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 50 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  workCenter: { type: mongoose.Schema.Types.ObjectId, ref: "WorkCenter", required: true, index: true },
  serialNumber: { type: String, trim: true, maxlength: 100, default: "" },
  capacityPerHour: { type: Number, min: 0, default: 0 },
  hourlyCost: { type: Number, min: 0, default: 0 },
  meterReading: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["available", "running", "maintenance", "breakdown", "inactive"], default: "available", index: true },
  lastMaintenanceAt: { type: Date, default: null },
  nextMaintenanceAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, code: 1 }, { unique: true });
schema.index({ tenantId: 1, workCenter: 1, status: 1 });
export default mongoose.models.Machine || mongoose.model("Machine", schema);
