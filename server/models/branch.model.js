import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  email: { type: String, trim: true, lowercase: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  address: {
    line1: { type: String, trim: true, default: "" }, line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" }, state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" }, country: { type: String, trim: true, default: "Bangladesh" },
    latitude: { type: String, trim: true, default: "" }, longitude: { type: String, trim: true, default: "" },
  },
  isMain: { type: Boolean, default: false, index: true },
  isDefault: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

branchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
branchSchema.index({ tenantId: 1, isDefault: 1 });

export default mongoose.model("Branch", branchSchema);
