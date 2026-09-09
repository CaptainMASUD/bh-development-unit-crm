import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

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
    orderNo: { type: String, trim: true, default: "" },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      default: null,
      index: true,
    },

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "draft",
      index: true,
    },

    deliveryStatus: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "on_hold", "cancelled"],
      default: "not_started",
      index: true,
    },

    currency: { type: String, default: "BDT", trim: true, index: true },

    items: { type: [orderItemSchema], default: [] },

    subtotal: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0, index: true },

    serviceStartDate: { type: Date, default: null, index: true },
    serviceEndDate: { type: Date, default: null, index: true },

    deliveryDate: { type: Date, default: null, index: true },
    deliveryNote: { type: String, trim: true, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true, minimize: true, optimisticConcurrency: true }
);

orderSchema.index({ orderNo: 1 }, { unique: true, sparse: true });
orderSchema.index({ customerId: 1, status: 1, createdAt: -1 });
orderSchema.index({ dealId: 1, createdAt: -1 });
orderSchema.index({ proposalId: 1, createdAt: -1 });
orderSchema.index({ deliveryStatus: 1, deliveryDate: 1 });
orderSchema.index({ createdBy: 1, createdAt: -1 });

orderSchema.pre("validate", function (next) {
  let subtotal = 0;
  let discountTotal = 0;

  for (const item of this.items || []) {
    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);

    const rawTotal = qty * unitPrice;
    const lineTotal = Math.max(rawTotal - discount, 0);

    item.lineTotal = lineTotal;
    subtotal += rawTotal;
    discountTotal += discount;
  }

  this.subtotal = subtotal;
  this.discountTotal = discountTotal;
  this.grandTotal = Math.max(subtotal - discountTotal, 0);

  if (!this.orderNo) {
    const idSuffix = String(this._id).slice(-4).toUpperCase();
    const y = new Date().getFullYear();
    this.orderNo = `ORD-${y}-${Date.now()}-${idSuffix}`;
  }

  next();
});

export default mongoose.model("Order", orderSchema);