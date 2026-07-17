import mongoose from "mongoose";

const voucherTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    numberingRule: { type: String, enum: ["journal", "voucher"], default: "voucher" },
    defaultPattern: { type: String, enum: ["flexible", "cash_credit", "cash_debit", "bank_to_bank"], default: "flexible" },
    applicableModule: { type: String, trim: true, default: "accounting", index: true },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

voucherTypeSchema.pre("validate", function (next) {
  this.key = String(this.key || "").trim().toLowerCase();
  this.code = String(this.code || "").trim().toUpperCase();
  this.name = String(this.name || "").trim();
  next();
});

export default mongoose.model("VoucherType", voucherTypeSchema);
