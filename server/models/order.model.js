import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    nameSnapshot: { type: String, trim: true, default: "" },

    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },

    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", default: null, index: true },

    orderNo: { type: String, trim: true, index: true }, // optional human-readable
    status: {
      type: String,
      enum: ["draft", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "draft",
      index: true,
    },

    currency: { type: String, default: "BDT", index: true },
    items: { type: [orderItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0, index: true },

    deliveryDate: { type: Date, default: null, index: true },
    deliveryNote: { type: String, trim: true, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, status: 1, createdAt: -1 });
orderSchema.index({ orderNo: 1 }, { unique: true, sparse: true });

export default mongoose.model("Order", orderSchema);
