import mongoose from "mongoose";

const dealItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    nameSnapshot: { type: String, trim: true, default: "" }, // in case product changes later

    qty: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },

    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 }, // store computed for fast reporting
  },
  { _id: true }
);

const dealSchema = new mongoose.Schema(
  {
    // can start from lead OR directly from customer
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },

    title: { type: String, required: true, trim: true, index: true },

    stage: {
      type: String,
      enum: ["new", "qualified", "proposal", "negotiation", "won", "lost"],
      default: "new",
      index: true,
    },

    currency: { type: String, default: "BDT", index: true },

    items: { type: [dealItemSchema], default: [] },

    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0, index: true },

    probability: { type: Number, default: 10, min: 0, max: 100 },
    expectedCloseDate: { type: Date, default: null, index: true },

    wonAt: { type: Date, default: null, index: true },
    lostAt: { type: Date, default: null, index: true },
    lostReason: { type: String, trim: true, default: "" },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // sales owner
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

dealSchema.index({ ownerId: 1, stage: 1, expectedCloseDate: 1 });
dealSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.model("Deal", dealSchema);
