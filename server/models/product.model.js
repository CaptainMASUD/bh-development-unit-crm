import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    sku: { type: String, trim: true, index: true },
    unit: { type: String, trim: true, default: "pcs" }, // pcs, kg, box, etc.

    basePrice: { type: Number, default: 0 },
    currency: { type: String, default: "BDT", index: true },

    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

productSchema.index({ sku: 1 }, { unique: true, sparse: true });

export default mongoose.model("Product", productSchema);
