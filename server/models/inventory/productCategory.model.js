import mongoose from "mongoose";

const CATEGORY_STATUSES = ["active", "inactive", "archived"];

const productCategorySchema = new mongoose.Schema(
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
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory",
      default: null,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 1000,
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
      enum: CATEGORY_STATUSES,
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

productCategorySchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

productCategorySchema.set("toObject", {
  transform: (_doc, ret) => {
    delete ret.nameLower;
    return ret;
  },
});

productCategorySchema.index({ tenantId: 1, code: 1 }, { unique: true });
productCategorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productCategorySchema.index({ tenantId: 1, parent: 1, nameLower: 1 }, { unique: true });
productCategorySchema.index({ tenantId: 1, status: 1, sortOrder: 1, nameLower: 1, _id: 1 });
productCategorySchema.index({ tenantId: 1, parent: 1, status: 1, sortOrder: 1, nameLower: 1, _id: 1 });

const normalizeCategoryPatch = (source = {}) => {
  const patch = source;

  if (patch.name !== undefined) {
    patch.name = String(patch.name || "").trim();
    patch.nameLower = patch.name.toLowerCase();
  }
  if (patch.code !== undefined) {
    patch.code = String(patch.code || "").trim().toUpperCase();
  }
  if (patch.slug !== undefined) {
    patch.slug = String(patch.slug || "").trim().toLowerCase();
  }
  if (patch.description !== undefined) {
    patch.description = String(patch.description || "").trim();
  }
  if (patch.imageUrl !== undefined) {
    patch.imageUrl = String(patch.imageUrl || "").trim();
  }
  if (patch.status !== undefined) {
    patch.status = String(patch.status || "active").trim().toLowerCase();
  }
  if (patch.sortOrder !== undefined) {
    patch.sortOrder = Number(patch.sortOrder);
  }

  if (patch.status === "archived") {
    patch.archivedAt = patch.archivedAt || new Date();
  } else if (patch.status !== undefined) {
    patch.archivedAt = null;
  }

  return patch;
};

productCategorySchema.pre("validate", function (next) {
  normalizeCategoryPatch(this);

  if (this.parent && String(this.parent) === String(this._id)) {
    this.invalidate("parent", "A category cannot have itself as its parent.");
  }

  next();
});

productCategorySchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const patch = normalizeCategoryPatch(update.$set || update);

  if (update.$set) update.$set = patch;
  this.setUpdate(update);
  next();
});

export { CATEGORY_STATUSES };
export default mongoose.model("ProductCategory", productCategorySchema);
