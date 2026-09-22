import mongoose from "mongoose";

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  typeKey: { type: String, required: true, trim: true },
  mode: { type: String, enum: ["auto", "manual"], required: true },
  prefix: { type: String, trim: true, uppercase: true, required: true },
  pattern: { type: String, required: true },
  resetPolicy: { type: String, enum: ["none", "daily", "monthly", "calendar_year", "fiscal_year"], required: true },
  serialWidth: { type: Number, min: 1, max: 12, required: true },
  customPattern: { type: Boolean, default: false },
  revision: { type: Number, min: 1, default: 1 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ tenantId: 1, typeKey: 1 }, { unique: true });

export default mongoose.models.DocumentNumberRule || mongoose.model("DocumentNumberRule", schema);
