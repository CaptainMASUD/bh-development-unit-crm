import mongoose from "mongoose";

const companyMembershipSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  role: { type: String, enum: ["admin", "employee"], required: true },
  defaultBranch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
  isActive: { type: Boolean, default: true, index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true, tenantScoped: false });

companyMembershipSchema.index({ tenantId: 1, user: 1 }, { unique: true });

export default mongoose.model("CompanyMembership", companyMembershipSchema);
