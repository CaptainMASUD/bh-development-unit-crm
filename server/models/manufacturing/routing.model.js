import mongoose from "mongoose";
const operationSchema = new mongoose.Schema({
  sequence: { type: Number, min: 1, required: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  workCenter: { type: mongoose.Schema.Types.ObjectId, ref: "WorkCenter", required: true },
  machine: { type: mongoose.Schema.Types.ObjectId, ref: "Machine", default: null },
  setupMinutes: { type: Number, min: 0, default: 0 },
  runMinutesPerUnit: { type: Number, min: 0, default: 0 },
  laborRatePerHour: { type: Number, min: 0, default: 0 },
  machineRatePerHour: { type: Number, min: 0, default: 0 },
  qualityRequired: { type: Boolean, default: false },
  outsourced: { type: Boolean, default: false },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
  instructions: { type: String, trim: true, maxlength: 1500, default: "" },
}, { _id: true });
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  routeNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  version: { type: Number, min: 1, default: 1 },
  operations: { type: [operationSchema], default: [] },
  status: { type: String, enum: ["draft", "active", "obsolete"], default: "draft", index: true },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, versionKey: false });
schema.index({ tenantId: 1, routeNumber: 1 }, { unique: true });
schema.index({ tenantId: 1, product: 1, version: 1 }, { unique: true });
schema.pre("validate", function(next){
  if (!this.operations?.length) this.invalidate("operations", "Routing must contain at least one operation.");
  const sequences=(this.operations||[]).map(x=>x.sequence);
  if (new Set(sequences).size !== sequences.length) this.invalidate("operations", "Routing operation sequence numbers must be unique.");
  next();
});
export default mongoose.models.Routing || mongoose.model("Routing", schema);
