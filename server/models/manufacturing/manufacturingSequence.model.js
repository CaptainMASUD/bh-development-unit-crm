import mongoose from "mongoose";

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  key: { type: String, required: true, trim: true, uppercase: true },
  value: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false });

schema.index({ tenantId: 1, key: 1 }, { unique: true });
export default mongoose.models.ManufacturingSequence || mongoose.model("ManufacturingSequence", schema);
