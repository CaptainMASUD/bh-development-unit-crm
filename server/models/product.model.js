import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },

    nameLower: { type: String, trim: true, default: "", index: true },

    sku: { type: String, trim: true, index: true },

    unit: { type: String, trim: true, default: "pcs" },

    category: { type: String, trim: true, default: "", index: true },

    basePrice: { type: Number, default: 0, min: 0 },

    currency: { type: String, default: "BDT", trim: true, index: true },

    isActive: { type: Boolean, default: true, index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true, minimize: true }
);

productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ isActive: 1, nameLower: 1, _id: -1 });
productSchema.index({ category: 1, isActive: 1, _id: -1 });
productSchema.index({ createdBy: 1, createdAt: -1 });

productSchema.index(
  {
    name: "text",
    sku: "text",
    category: "text",
  },
  {
    name: "product_text_search",
    weights: {
      name: 10,
      sku: 8,
      category: 4,
    },
  }
);

productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.nameLower = String(this.name || "").trim().toLowerCase();
  }

  if (this.isModified("sku") && this.sku) {
    this.sku = String(this.sku || "").trim().toUpperCase();
  }

  next();
});

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};

  const nextName = $set.name ?? update.name;
  const nextSku = $set.sku ?? update.sku;

  if (nextName !== undefined) {
    update.$set = {
      ...$set,
      name: String(nextName || "").trim(),
      nameLower: String(nextName || "").trim().toLowerCase(),
    };
    if (update.name !== undefined) delete update.name;
  }

  if (nextSku !== undefined) {
    update.$set = {
      ...(update.$set || {}),
      sku: String(nextSku || "").trim().toUpperCase(),
    };
    if (update.sku !== undefined) delete update.sku;
  }

  this.setUpdate(update);
  next();
});

export default mongoose.model("Product", productSchema);