import mongoose from "mongoose";

const DIMENSION_SOURCES = ["cost_center", "branch", "department", "project", "custom_values"];
const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];

const accountingDimensionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    sourceType: {
      type: String,
      enum: DIMENSION_SOURCES,
      required: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    applicableAccountTypes: {
      type: [
        {
          type: String,
          enum: ACCOUNT_TYPES,
        },
      ],
      default: [],
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

accountingDimensionSchema.index({ tenantId: 1, code: 1 }, { unique: true });
accountingDimensionSchema.index({ tenantId: 1, isActive: 1 });

accountingDimensionSchema.pre("save", function (next) {
  if (this.isModified("code")) {
    this.code = String(this.code || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
  }
  next();
});

export default mongoose.models.AccountingDimension || mongoose.model("AccountingDimension", accountingDimensionSchema);
