import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },

    method: {
      type: String,
      enum: ["cash", "bank", "bkash", "nagad", "rocket", "card", "other"],
      default: "cash",
      index: true,
    },

    transactionId: { type: String, trim: true, default: "" },

    paidAt: { type: Date, default: Date.now, index: true },

    note: { type: String, trim: true, default: "" },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null, index: true },
  },
  { _id: true }
);

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    nameSnapshot: { type: String, trim: true, default: "" },
    qty: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, trim: true, default: "", index: true },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
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
      enum: ["draft", "sent", "partially_paid", "paid", "overdue", "void"],
      default: "draft",
      index: true,
    },

    currency: { type: String, default: "BDT", trim: true, index: true },

    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    paidTotal: { type: Number, default: 0, min: 0 },
    dueTotal: { type: Number, default: 0, min: 0, index: true },

    issuedAt: { type: Date, default: Date.now, index: true },
    dueAt: { type: Date, default: null, index: true },

    payments: { type: [paymentSchema], default: [] },

    notes: { type: String, trim: true, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true, minimize: true, optimisticConcurrency: true }
);

invoiceSchema.index({ invoiceNo: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ customerId: 1, status: 1, dueAt: 1 });
invoiceSchema.index({ customerId: 1, createdAt: -1 });
invoiceSchema.index({ orderId: 1, createdAt: -1 });
invoiceSchema.index({ dealId: 1, createdAt: -1 });
invoiceSchema.index({ proposalId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, dueAt: 1 });
invoiceSchema.index({ dueTotal: 1, dueAt: 1 });

invoiceSchema.pre("validate", function (next) {
  if (Array.isArray(this.items) && this.items.length) {
    let subtotal = 0;
    let discountTotal = 0;

    for (const item of this.items) {
      const qty = Math.max(Number(item.qty || 0), 0);
      const unitPrice = Math.max(Number(item.unitPrice || 0), 0);
      const discount = Math.max(Number(item.discount || 0), 0);
      const rawTotal = qty * unitPrice;

      item.lineTotal = Math.max(rawTotal - discount, 0);
      subtotal += rawTotal;
      discountTotal += discount;
    }

    this.subtotal = subtotal;
    this.discountTotal = discountTotal;
    this.total = Math.max(subtotal - discountTotal, 0);
  }

  const paidTotal = (this.payments || []).reduce((sum, p) => {
    return sum + Number(p.amount || 0);
  }, 0);

  this.paidTotal = paidTotal;
  this.dueTotal = Math.max(Number(this.total || 0) - paidTotal, 0);

  if (this.status !== "void" && this.status !== "draft") {
    if (this.dueTotal <= 0 && Number(this.total || 0) > 0) {
      this.status = "paid";
    } else if (this.paidTotal > 0 && this.dueTotal > 0) {
      this.status = "partially_paid";
    } else if (this.dueAt && new Date(this.dueAt) < new Date() && this.dueTotal > 0) {
      this.status = "overdue";
    }
  }

  if (!this.invoiceNo) {
    const idSuffix = String(this._id).slice(-4).toUpperCase();
    const y = new Date().getFullYear();
    this.invoiceNo = `INV-${y}-${Date.now()}-${idSuffix}`;
  }

  next();
});

export default mongoose.model("Invoice", invoiceSchema);
