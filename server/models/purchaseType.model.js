// models/purchaseType.model.js
import mongoose from "mongoose";

const purchaseTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true }, // e.g. "bulk", "trial"
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

purchaseTypeSchema.index({ key: 1 }, { unique: true });

export default mongoose.model("PurchaseType", purchaseTypeSchema);
