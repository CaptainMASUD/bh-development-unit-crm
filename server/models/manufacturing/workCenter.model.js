import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, enum: ["internal", "subcontract"], default: "internal" },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "WarehouseLocation", default: null },
  capacityPerHour: { type: Number, min: 0, default: 0 },
  hoursPerDay: { type: Number, min: 0, max: 24, default: 8 },
  laborRatePerHour: { type: Number, min: 0, default: 0 },
  overheadRatePerHour: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  notes: { type: String, trim: true, maxlength: 1500, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, code: 1 }, { unique: true });
schema.index({ tenantId: 1, status: 1, name: 1 });
export default mongoose.models.WorkCenter || mongoose.model("WorkCenter", schema);
