import mongoose from "mongoose";

const TYPES = ["asset", "liability", "equity", "revenue", "expense"];
const NORMAL_BALANCE = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  equity: "credit",
  revenue: "credit",
};

const accountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, trim: true, default: "", index: true },
    type: { type: String, enum: TYPES, required: true, index: true },
    normalBalance: { type: String, enum: ["debit", "credit"], required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null, index: true },
    currency: { type: String, trim: true, default: "BDT", index: true },
    description: { type: String, trim: true, default: "" },
    isSystem: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

accountSchema.index({ code: 1 }, { unique: true });
accountSchema.index({ type: 1, isActive: 1, code: 1, _id: 1 });
accountSchema.index({ nameLower: 1, _id: 1 });

accountSchema.pre("validate", function (next) {
  this.code = String(this.code || "").trim().toUpperCase();
  this.name = String(this.name || "").trim();
  this.nameLower = this.name.toLowerCase();
  this.normalBalance = NORMAL_BALANCE[this.type] || this.normalBalance;
  next();
});

accountSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = update.$set || update;
  if (patch.code !== undefined) patch.code = String(patch.code || "").trim().toUpperCase();
  if (patch.name !== undefined) {
    patch.name = String(patch.name || "").trim();
    patch.nameLower = patch.name.toLowerCase();
  }
  if (patch.type !== undefined) patch.normalBalance = NORMAL_BALANCE[patch.type] || patch.normalBalance;
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export const ACCOUNT_TYPES = TYPES;
export const ACCOUNT_NORMAL_BALANCE = NORMAL_BALANCE;
export default mongoose.model("Account", accountSchema);
