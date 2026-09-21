import mongoose from "mongoose";

const costCenterSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
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
    nameLower: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    parentCostCenter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CostCenter",
      default: null,
      index: true,
    },
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
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

costCenterSchema.index({ tenantId: 1, code: 1 }, { unique: true });
costCenterSchema.index({ tenantId: 1, parentCostCenter: 1 });
costCenterSchema.index({ tenantId: 1, isActive: 1 });
costCenterSchema.index({ tenantId: 1, isGroup: 1, isActive: 1 });

costCenterSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = String(this.name || "").trim();
    this.nameLower = this.name.toLowerCase();
  }
  if (this.isModified("code")) {
    this.code = String(this.code || "").trim().toUpperCase();
  }
  next();
});

costCenterSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const nextName = update.$set?.name ?? update.name;
  const nextCode = update.$set?.code ?? update.code;

  if (nextName !== undefined) {
    const name = String(nextName || "").trim();
    update.$set = {
      ...(update.$set || {}),
      name,
      nameLower: name.toLowerCase(),
    };
    if (update.name !== undefined) delete update.name;
  }

  if (nextCode !== undefined) {
    const code = String(nextCode || "").trim().toUpperCase();
    update.$set = {
      ...(update.$set || {}),
      code,
    };
    if (update.code !== undefined) delete update.code;
  }

  this.setUpdate(update);
  next();
});

export default mongoose.models.CostCenter || mongoose.model("CostCenter", costCenterSchema);
