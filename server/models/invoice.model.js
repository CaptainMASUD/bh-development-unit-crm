import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, trim: true, default: "" }, // cash/bank/mobile etc
    paidAt: { type: Date, default: Date.now, index: true },
    note: { type: String, trim: true, default: "" },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, trim: true, index: true }, // unique human-readable
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },

    status: {
      type: String,
      enum: ["draft", "sent", "partially_paid", "paid", "overdue", "void"],
      default: "draft",
      index: true,
    },

    currency: { type: String, default: "BDT", index: true },

    total: { type: Number, default: 0 },
    paidTotal: { type: Number, default: 0 },
    dueTotal: { type: Number, default: 0, index: true },

    issuedAt: { type: Date, default: Date.now, index: true },
    dueAt: { type: Date, default: null, index: true },

    payments: { type: [paymentSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceNo: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ customerId: 1, status: 1, dueAt: 1 });

export default mongoose.model("Invoice", invoiceSchema);
