// models/purchaseType.model.js
import mongoose from "mongoose";

const purchaseTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, trim: true, lowercase: true, index: true },
    key: { type: String, required: true, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

purchaseTypeSchema.pre("validate", function (next) {
  if (this.name !== undefined) this.nameLower = String(this.name || "").trim().toLowerCase();
  if (this.key !== undefined) this.key = String(this.key || "").trim().toLowerCase();
  next();
});

purchaseTypeSchema.index({ key: 1 }, { unique: true });
purchaseTypeSchema.index({ isActive: 1, nameLower: 1, _id: 1 });
purchaseTypeSchema.index({ nameLower: 1, _id: 1 });

export default mongoose.model("PurchaseType", purchaseTypeSchema);
