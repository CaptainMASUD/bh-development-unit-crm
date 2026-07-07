import mongoose from "mongoose";

const bankSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true, trim: true },
    bankNameLower: { type: String, trim: true, default: "", index: true },
    shortName: { type: String, required: true, trim: true, uppercase: true, index: true },
    bankType: {
      type: String,
      enum: ["private", "public", "state_owned", "foreign", "specialized", "microfinance", "other"],
      default: "private",
      index: true,
    },
    country: { type: String, required: true, trim: true, default: "Bangladesh", index: true },
    swiftCode: { type: String, trim: true, uppercase: true, default: "", index: true },
    website: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

bankSchema.index({ shortName: 1 }, { unique: true });
bankSchema.index({ bankNameLower: 1, _id: 1 });
bankSchema.index({ status: 1, country: 1, bankNameLower: 1, _id: 1 });
bankSchema.index(
  { bankName: "text", shortName: "text", country: "text", swiftCode: "text" },
  { default_language: "none" }
);

bankSchema.pre("validate", function (next) {
  this.bankName = String(this.bankName || "").trim();
  this.bankNameLower = this.bankName.toLowerCase();
  this.shortName = String(this.shortName || "").trim().toUpperCase();
  this.country = String(this.country || "").trim() || "Bangladesh";
  this.swiftCode = String(this.swiftCode || "").trim().toUpperCase();
  this.website = String(this.website || "").trim();
  next();
});

bankSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = update.$set || update;
  if (patch.bankName !== undefined) {
    patch.bankName = String(patch.bankName || "").trim();
    patch.bankNameLower = patch.bankName.toLowerCase();
  }
  if (patch.shortName !== undefined) patch.shortName = String(patch.shortName || "").trim().toUpperCase();
  if (patch.country !== undefined) patch.country = String(patch.country || "").trim() || "Bangladesh";
  if (patch.swiftCode !== undefined) patch.swiftCode = String(patch.swiftCode || "").trim().toUpperCase();
  if (patch.website !== undefined) patch.website = String(patch.website || "").trim();
  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export default mongoose.model("Bank", bankSchema);
