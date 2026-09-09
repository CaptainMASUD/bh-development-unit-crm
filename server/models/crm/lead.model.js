import mongoose from "mongoose";

const leadContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    companyName: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const leadRequirementSchema = new mongoose.Schema(
  {
    summary: { type: String, trim: true, default: "" },
    painPoints: { type: [String], default: [] },
    expectedSolution: { type: String, trim: true, default: "" },
    budgetMin: { type: Number, default: 0, min: 0 },
    budgetMax: { type: Number, default: 0, min: 0 },
    expectedValue: { type: Number, default: 0, min: 0 },
    timeline: { type: String, trim: true, default: "" },
    decisionMaker: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const leadStageNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true },

    type: {
      type: String,
      enum: [
        "general",
        "call",
        "email",
        "meeting",
        "whatsapp",
        "follow_up",
        "stage_change",
        "stage_changed",
        "status_change",
        "status_changed",
        "lost_reason",
        "won_reason",
        "quick_action",
        "automation",
      ],
      default: "general",
      index: true,
    },

    oldStage: { type: String, trim: true, default: "" },
    newStage: { type: String, trim: true, default: "" },
    oldStatus: { type: String, trim: true, default: "" },
    newStatus: { type: String, trim: true, default: "" },
    reason: { type: String, trim: true, default: "" },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { _id: true }
);

const leadSchema = new mongoose.Schema(
  {
    leadNumber: { type: String, default: "", trim: true, index: true },

    contact: { type: leadContactSchema, required: true },

    status: {
      type: String,
      enum: ["new", "contacted", "pending", "confirmed", "lost"],
      default: "new",
      index: true,
    },

    pipelineStage: {
      type: String,
      enum: [
        "new",
        "qualified",
        "discovery",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      default: "new",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },

    leadTemperature: {
      type: String,
      enum: ["cold", "warm", "hot"],
      default: "warm",
      index: true,
    },

    leadScore: { type: Number, default: 0, min: 0, max: 100, index: true },

    /**
     * New real-life work queue fields
     */
    workQueuePriority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },

    workQueueScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1000,
      index: true,
    },

    lastActivityAt: {
      type: Date,
      default: null,
      index: true,
    },

    nextAction: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    nextActionType: {
      type: String,
      enum: [
        "",
        "call",
        "email",
        "meeting",
        "whatsapp",
        "follow_up",
        "proposal",
        "deal",
        "convert",
        "sales_order",
        "lost_review",
      ],
      default: "",
      index: true,
    },

    nextActionAt: {
      type: Date,
      default: null,
      index: true,
    },

    isOverdue: {
      type: Boolean,
      default: false,
      index: true,
    },

    overdueSince: {
      type: Date,
      default: null,
      index: true,
    },

    untouchedSinceCreated: {
      type: Boolean,
      default: true,
      index: true,
    },

    automationFlags: {
      needsFirstContact: { type: Boolean, default: true, index: true },
      needsFollowUp: { type: Boolean, default: false, index: true },
      proposalFollowUpDue: { type: Boolean, default: false, index: true },
      dealStuck: { type: Boolean, default: false, index: true },
    },

    purchaseType: { type: String, trim: true, default: "", index: true },
    source: { type: String, trim: true, default: "", index: true },

    company: {
      website: { type: String, trim: true, default: "" },
      industry: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
    },

    requirement: { type: leadRequirementSchema, default: () => ({}) },

    tags: { type: [String], default: [], index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    notes: { type: [leadStageNoteSchema], default: [] },

    lastContactedAt: { type: Date, default: null, index: true },
    nextFollowUpAt: { type: Date, default: null, index: true },

    lostReason: { type: String, trim: true, default: "" },
    lostAt: { type: Date, default: null, index: true },

    wonReason: { type: String, trim: true, default: "" },
    wonAt: { type: Date, default: null, index: true },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    convertedCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    convertedAt: { type: Date, default: null, index: true },

    ownerLocked: { type: Boolean, default: false, index: true },

    allowedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
  },
  {
    timestamps: true,
    minimize: true,
    optimisticConcurrency: true,
  }
);

leadSchema.index({ assignedTo: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, status: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, pipelineStage: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, nextFollowUpAt: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, nextActionAt: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, isOverdue: 1, nextActionAt: 1 });
leadSchema.index({ assignedTo: 1, workQueueScore: -1, nextActionAt: 1 });
leadSchema.index({ createdBy: 1, status: 1, _id: -1 });
leadSchema.index({ pipelineStage: 1, assignedTo: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, priority: 1, _id: -1 });
leadSchema.index({ priority: 1, _id: -1 });
leadSchema.index({ leadTemperature: 1, leadScore: -1, _id: -1 });
leadSchema.index({ purchaseType: 1, _id: -1 });
leadSchema.index({ allowedUsers: 1, _id: -1 });
leadSchema.index({ createdBy: 1, ownerLocked: 1, _id: -1 });
leadSchema.index({ convertedCustomer: 1 }, { sparse: true });
leadSchema.index({ "notes.createdAt": -1 });

leadSchema.index(
  {
    "contact.name": "text",
    "contact.email": "text",
    "contact.phone": "text",
    "contact.companyName": "text",
    leadNumber: "text",
    source: "text",
    purchaseType: "text",
    "requirement.summary": "text",
    "requirement.expectedSolution": "text",
    nextAction: "text",
  },
  {
    name: "lead_text_search",
    weights: {
      "contact.name": 10,
      "contact.companyName": 8,
      leadNumber: 8,
      "contact.phone": 5,
      "contact.email": 5,
      purchaseType: 4,
      source: 3,
      "requirement.summary": 3,
      "requirement.expectedSolution": 3,
      nextAction: 4,
    },
  }
);

leadSchema.pre("save", function (next) {
  if (!this.leadNumber) {
    const idSuffix = String(this._id).slice(-4).toUpperCase();
    const y = new Date().getFullYear();
    this.leadNumber = `LD-${y}-${Date.now()}-${idSuffix}`;
  }

  if (this.pipelineStage === "lost" && !this.lostAt) {
    this.lostAt = new Date();
  }

  if (this.pipelineStage === "won" && !this.wonAt) {
    this.wonAt = new Date();
  }

  const followUpDate = this.nextActionAt || this.nextFollowUpAt;
  if (followUpDate && new Date(followUpDate) < new Date()) {
    this.isOverdue = !["won", "lost"].includes(this.pipelineStage);
    if (this.isOverdue && !this.overdueSince) this.overdueSince = followUpDate;
  } else {
    this.isOverdue = false;
    this.overdueSince = null;
  }

  next();
});

export default mongoose.model("Lead", leadSchema);
