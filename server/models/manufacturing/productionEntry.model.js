import mongoose from "mongoose";
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  entryNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", default: null, index: true },
  entryDate: { type: Date, default: Date.now },
  goodQuantity: { type: Number, min: 0, default: 0 },
  rejectedQuantity: { type: Number, min: 0, default: 0 },
  scrapQuantity: { type: Number, min: 0, default: 0 },
  reworkQuantity: { type: Number, min: 0, default: 0 },
  laborMinutes: { type: Number, min: 0, default: 0 },
  machineMinutes: { type: Number, min: 0, default: 0 },
  downtimeMinutes: { type: Number, min: 0, default: 0 },
  batchNumber: { type: String, trim: true, uppercase: true, maxlength: 120, default: "" },
  manufactureDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null },
  status: { type: String, enum: ["draft", "posted", "cancelled"], default: "draft", index: true },
  stockMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
  notes: { type: String, trim: true, maxlength: 1500, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, entryNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, manufacturingOrder: 1, entryDate: -1 });
export default mongoose.models.ProductionEntry || mongoose.model("ProductionEntry", schema);
