import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  scrapNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  reasonCode: { type: String, trim: true, maxlength: 80, default: "" },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  recoverable: { type: Boolean, default: false },
  recoveryValue: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["recorded", "approved", "disposed", "recovered", "cancelled"], default: "recorded", index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, scrapNumber: 1 }, { unique: true });
export default mongoose.models.ScrapEntry || mongoose.model("ScrapEntry", schema);
