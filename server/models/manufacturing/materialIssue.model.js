import mongoose from "mongoose";
const lineSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "WarehouseLocation", default: null },
  lotNumber: { type: String, trim: true, uppercase: true, default: "" },
  serialNumbers: { type: [String], default: [] },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  issueNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  issueDate: { type: Date, default: Date.now },
  lines: { type: [lineSchema], default: [] },
  status: { type: String, enum: ["draft", "posted", "reversed", "cancelled"], default: "draft", index: true },
  stockMovement: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement", default: null },
  journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
  notes: { type: String, trim: true, maxlength: 1500, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, issueNumber: 1 }, { unique: true });
export default mongoose.models.MaterialIssue || mongoose.model("MaterialIssue", schema);
