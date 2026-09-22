import mongoose from "mongoose";

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  typeKey: { type: String, required: true, trim: true },
  value: { type: String, required: true, trim: true, uppercase: true },
  source: { type: String, trim: true, default: "" },
  recordId: { type: mongoose.Schema.Types.ObjectId, default: null },
  idempotencyKey: { type: String, trim: true, default: "" },
  ruleRevision: { type: Number, min: 1, default: 1 },
}, { timestamps: true });

schema.index({ tenantId: 1, typeKey: 1, value: 1 }, { unique: true });
schema.index({ tenantId: 1, typeKey: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } });

export default mongoose.models.DocumentNumberClaim || mongoose.model("DocumentNumberClaim", schema);
