import mongoose from "mongoose";

const dealItemSchema = new mongoose.Schema(
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

const dealRequirementSnapshotSchema = new mongoose.Schema(
  {
    summary: { type: String, trim: true, default: "" },
    budgetMin: { type: Number, default: 0 },
    budgetMax: { type: Number, default: 0 },
    expectedValue: { type: Number, default: 0 },
    timeline: { type: String, trim: true, default: "" },
    decisionMaker: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const dealSchema = new mongoose.Schema(
  {
    dealNo: { type: String, trim: true, default: "" },

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

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
      index: true,
    },

    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesQuotation",
      default: null,
      index: true,
    },

    salesOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      default: null,
      index: true,
    },

    title: { type: String, required: true, trim: true, index: true },

    stage: {
      type: String,
      enum: ["new", "qualified", "proposal", "negotiation", "won", "lost"],
      default: "negotiation",
      index: true,
    },

    currency: { type: String, default: "BDT", trim: true, index: true },

    items: { type: [dealItemSchema], default: [] },

    subtotal: { type: Number, default: 0, min: 0 },
    discountTotal: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0, index: true },

    /**
     * New deal quality fields
     */
    expectedRevenue: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    dealHealth: {
      type: String,
      enum: ["unknown", "healthy", "at_risk", "stuck", "critical"],
      default: "unknown",
      index: true,
    },

    nextDealAction: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    nextDealActionAt: {
      type: Date,
      default: null,
      index: true,
    },

    stuckReason: {
      type: String,
      trim: true,
      default: "",
    },

    lastStageChangedAt: {
      type: Date,
      default: null,
      index: true,
    },

    lastActivityAt: {
      type: Date,
      default: null,
      index: true,
    },

    probability: { type: Number, default: 10, min: 0, max: 100 },

    expectedCloseDate: { type: Date, default: null, index: true },

    proposalStatus: {
      type: String,
      enum: ["none", "draft", "sent", "accepted", "rejected", "expired"],
      default: "none",
      index: true,
    },

    proposalSentAt: { type: Date, default: null, index: true },
    quotationValidTill: { type: Date, default: null, index: true },

    requirementSnapshot: {
      type: dealRequirementSnapshotSchema,
      default: () => ({}),
    },

    wonAt: { type: Date, default: null, index: true },
    lostAt: { type: Date, default: null, index: true },
    lostReason: { type: String, trim: true, default: "" },
    wonReason: { type: String, trim: true, default: "" },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true, minimize: true, optimisticConcurrency: true }
);

dealSchema.index({ dealNo: 1 }, { unique: true, sparse: true });
dealSchema.index({ ownerId: 1, stage: 1, expectedCloseDate: 1 });
dealSchema.index({ ownerId: 1, dealHealth: 1, nextDealActionAt: 1 });
dealSchema.index({ customerId: 1, createdAt: -1 });
dealSchema.index({ leadId: 1, createdAt: -1 });
dealSchema.index({ proposalId: 1, createdAt: -1 });
dealSchema.index({ quotationId: 1, createdAt: -1 });
dealSchema.index({ salesOrderId: 1, createdAt: -1 });
dealSchema.index({ stage: 1, grandTotal: -1, _id: -1 });
dealSchema.index({ stage: 1, wonAt: -1, _id: -1 });
dealSchema.index({ stage: 1, updatedAt: -1, _id: -1 });
dealSchema.index({ proposalStatus: 1, quotationValidTill: 1 });
dealSchema.index(
  {
    dealNo: "text",
    title: "text",
    notes: "text",
    nextDealAction: "text",
    stuckReason: "text",
    "requirementSnapshot.summary": "text",
  },
  {
    name: "deal_text_search",
    weights: {
      dealNo: 8,
      title: 10,
      notes: 3,
      nextDealAction: 4,
      stuckReason: 4,
      "requirementSnapshot.summary": 4,
    },
  }
);

dealSchema.pre("validate", function (next) {
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

  this.expectedRevenue = Math.round(
    Number(this.grandTotal || 0) * (Number(this.probability || 0) / 100)
  );

  if (this.stage === "won" && !this.wonAt) {
    this.wonAt = new Date();
    this.probability = 100;
    this.dealHealth = "healthy";
  }

  if (this.stage === "lost" && !this.lostAt) {
    this.lostAt = new Date();
    this.probability = 0;
    this.dealHealth = "critical";
  }

  if (!this.dealNo) {
    const idSuffix = String(this._id).slice(-4).toUpperCase();
    const y = new Date().getFullYear();
    this.dealNo = `DL-${y}-${Date.now()}-${idSuffix}`;
  }

  if (!this.lastStageChangedAt) {
    this.lastStageChangedAt = new Date();
  }

  next();
});

export default mongoose.model("Deal", dealSchema);
