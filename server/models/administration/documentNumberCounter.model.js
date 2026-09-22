import mongoose from "mongoose";

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  typeKey: { type: String, required: true, trim: true },
  bucket: { type: String, required: true, default: "all" },
  partition: { type: String, required: true, default: "all" },
  value: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

schema.index({ tenantId: 1, typeKey: 1, bucket: 1, partition: 1 }, { unique: true });

export default mongoose.models.DocumentNumberCounter || mongoose.model("DocumentNumberCounter", schema);
