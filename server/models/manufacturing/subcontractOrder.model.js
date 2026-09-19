import mongoose from "mongoose";
const materialSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, min: 0.000001, required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", required: true },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  subcontractNumber: { type: String, required: true, trim: true, uppercase: true },
  manufacturingOrder: { type: mongoose.Schema.Types.ObjectId, ref: "ManufacturingOrder", required: true, index: true },
  workOrder: { type: mongoose.Schema.Types.ObjectId, ref: "WorkOrder", default: null },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
  operationName: { type: String, required: true, trim: true, maxlength: 160 },
  quantity: { type: Number, min: 0.000001, required: true },
  materials: { type: [materialSchema], default: [] },
  unitRate: { type: Number, min: 0, default: 0 },
  totalCost: { type: Number, min: 0, default: 0 },
  sentAt: { type: Date, default: null },
  expectedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  receivedQuantity: { type: Number, min: 0, default: 0 },
  rejectedQuantity: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["draft", "approved", "sent", "partially_received", "received", "cancelled"], default: "draft", index: true },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, subcontractNumber: 1 }, { unique: true });
export default mongoose.models.SubcontractOrder || mongoose.model("SubcontractOrder", schema);
