import mongoose from "mongoose";
const reqSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  grossRequirement: { type: Number, min: 0, default: 0 },
  onHand: { type: Number, default: 0 },
  reserved: { type: Number, min: 0, default: 0 },
  available: { type: Number, default: 0 },
  incoming: { type: Number, min: 0, default: 0 },
  safetyStock: { type: Number, min: 0, default: 0 },
  netRequirement: { type: Number, min: 0, default: 0 },
  recommendedPurchaseQuantity: { type: Number, min: 0, default: 0 },
  recommendedProductionQuantity: { type: Number, min: 0, default: 0 },
  requiredDate: { type: Date, default: null },
  defaultSupplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  runNumber: { type: String, required: true, trim: true, uppercase: true },
  productionPlan: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionPlan", required: true, index: true },
  runAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["running", "completed", "failed", "cancelled"], default: "running", index: true },
  requirements: { type: [reqSchema], default: [] },
  warnings: { type: [String], default: [] },
  errorMessage: { type: String, trim: true, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, runNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, productionPlan: 1, createdAt: -1 });
export default mongoose.models.MRPRun || mongoose.model("MRPRun", schema);
