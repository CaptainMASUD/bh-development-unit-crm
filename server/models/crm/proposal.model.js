import mongoose from "mongoose";

const proposalItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    nameSnapshot: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },

    qty: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const proposalSchema = new mongoose.Schema(
  {
    proposalNo: { type: String, trim: true, default: "" },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      default: null,
      index: true,
    },

    title: { type: String, required: true, trim: true, index: true },

    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "rejected", "expired", "cancelled"],
      default: "draft",
      index: true,
    },

    currency: { type: String, default: "BDT", trim: true, index: true },

    items: { type: [proposalItemSchema], default: [] },

    subtotal: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0, index: true },

    validTill: { type: Date, default: null, index: true },

    sentAt: { type: Date, default: null, index: true },
    acceptedAt: { type: Date, default: null, index: true },
    rejectedAt: { type: Date, default: null, index: true },

    /**
     * New proposal follow-up automation fields
     */
    followupDueAt: {
      type: Date,
      default: null,
      index: true,
    },

    sentReminderAt: {
      type: Date,
      default: null,
      index: true,
    },

    reminderCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    lastClientResponse: {
      type: String,
      enum: [
        "",
        "no_response",
        "interested",
        "needs_revision",
        "price_issue",
        "accepted",
        "rejected",
      ],
      default: "",
      index: true,
    },

    lastClientResponseAt: {
      type: Date,
      default: null,
      index: true,
    },

    terms: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    rejectReason: { type: String, trim: true, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true, minimize: true, optimisticConcurrency: true }
);

proposalSchema.index({ proposalNo: 1 }, { unique: true, sparse: true });
proposalSchema.index({ leadId: 1, createdAt: -1 });
proposalSchema.index({ customerId: 1, createdAt: -1 });
proposalSchema.index({ dealId: 1, createdAt: -1 });
proposalSchema.index({ status: 1, validTill: 1 });
proposalSchema.index({ status: 1, followupDueAt: 1 });
proposalSchema.index({ ownerId: 1, status: 1, createdAt: -1 });

proposalSchema.index(
  {
    proposalNo: "text",
    title: "text",
    notes: "text",
    terms: "text",
  },
  {
    name: "proposal_text_search",
    weights: {
      proposalNo: 8,
      title: 10,
      notes: 3,
      terms: 2,
    },
  }
);

proposalSchema.pre("validate", function (next) {
  if (!this.leadId && !this.customerId && !this.dealId) {
    return next(new Error("Proposal must be connected to lead, customer, or deal"));
  }

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

  if (this.status === "sent" && !this.sentAt) {
    this.sentAt = new Date();

    if (!this.followupDueAt) {
      const due = new Date();
      due.setDate(due.getDate() + 3);
      this.followupDueAt = due;
    }

    if (!this.lastClientResponse) {
      this.lastClientResponse = "no_response";
    }
  }

  if (this.status === "accepted" && !this.acceptedAt) {
    this.acceptedAt = new Date();
    this.lastClientResponse = "accepted";
    this.lastClientResponseAt = new Date();
  }

  if (this.status === "rejected" && !this.rejectedAt) {
    this.rejectedAt = new Date();
    this.lastClientResponse = "rejected";
    this.lastClientResponseAt = new Date();
  }

  if (this.isNew && !this.proposalNo) return next(new Error("Proposal number must be allocated before save."));

  next();
});

export default mongoose.model("Proposal", proposalSchema);
