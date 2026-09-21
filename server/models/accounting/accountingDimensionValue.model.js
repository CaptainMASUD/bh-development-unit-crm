import mongoose from "mongoose";

const accountingDimensionValueSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    dimension: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountingDimension",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

accountingDimensionValueSchema.index({ tenantId: 1, dimension: 1, code: 1 }, { unique: true });
accountingDimensionValueSchema.index({ tenantId: 1, dimension: 1, isActive: 1 });

accountingDimensionValueSchema.pre("save", function (next) {
  if (this.isModified("code")) {
    this.code = String(this.code || "").trim().toUpperCase();
  }
  next();
});

export default mongoose.models.AccountingDimensionValue ||
  mongoose.model("AccountingDimensionValue", accountingDimensionValueSchema);
