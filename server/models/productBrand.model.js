import mongoose from "mongoose";

const BRAND_STATUSES = ["active", "inactive", "archived"];

const productBrandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    nameLower: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },
    logoUrl: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    sortOrder: {
      type: Number,
      min: 0,
      max: 1000000,
      default: 0,
    },
    status: {
      type: String,
      enum: BRAND_STATUSES,
      default: "active",
    },
    archivedAt: {
      type: Date,
      default: null,
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
  {
    timestamps: true,
    versionKey: false,
    minimize: true,
  }
);

productBrandSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

productBrandSchema.set("toObject", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

productBrandSchema.index({ code: 1 }, { unique: true });
productBrandSchema.index({ nameLower: 1 }, { unique: true });
productBrandSchema.index({ status: 1, sortOrder: 1, nameLower: 1, _id: 1 });
productBrandSchema.index({ country: 1, status: 1, sortOrder: 1, nameLower: 1, _id: 1 });

const normalizeBrandPatch = (source = {}) => {
  const patch = source;

  if (patch.name !== undefined) {
    patch.name = String(patch.name || "").trim();
    patch.nameLower = patch.name.toLowerCase();
  }
  if (patch.code !== undefined) {
    patch.code = String(patch.code || "").trim().toUpperCase();
  }
  if (patch.description !== undefined) {
    patch.description = String(patch.description || "").trim();
  }
  if (patch.logoUrl !== undefined) {
    patch.logoUrl = String(patch.logoUrl || "").trim();
  }
  if (patch.website !== undefined) {
    patch.website = String(patch.website || "").trim();
  }
  if (patch.country !== undefined) {
    patch.country = String(patch.country || "").trim();
  }
  if (patch.sortOrder !== undefined) {
    patch.sortOrder = Number(patch.sortOrder);
  }
  if (patch.status !== undefined) {
    patch.status = String(patch.status || "active").trim().toLowerCase();
  }

  if (patch.status === "archived") {
    patch.archivedAt = patch.archivedAt || new Date();
  } else if (patch.status !== undefined) {
    patch.archivedAt = null;
  }

  return patch;
};

productBrandSchema.pre("validate", function (next) {
  normalizeBrandPatch(this);
  next();
});

productBrandSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = normalizeBrandPatch(update.$set || update);

  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export { BRAND_STATUSES };
export default mongoose.model("ProductBrand", productBrandSchema);
