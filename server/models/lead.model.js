// models/lead.model.js
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

const leadNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { _id: false }
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
      enum: ["new", "qualified", "proposal", "negotiation", "won", "lost"],
      default: "new",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },

    purchaseType: { type: String, trim: true, default: "", index: true },
    source: { type: String, trim: true, default: "", index: true },

    company: {
      website: { type: String, trim: true, default: "" },
      industry: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" },
    },

    tags: { type: [String], default: [], index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // ✅ keep required (your system expects it)
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    notes: { type: [leadNoteSchema], default: [] },

    lastContactedAt: { type: Date, default: null, index: true },
    nextFollowUpAt: { type: Date, default: null, index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    convertedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    convertedAt: { type: Date, default: null, index: true },

    /* ======================
       ✅ ACCESS CONTROL (NEW)
       ====================== */
    // if true => creator is NOT automatically allowed anymore (admin can revoke)
    ownerLocked: { type: Boolean, default: false, index: true },

    // explicit allowlist (admin grants permission)
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
  },
  {
    timestamps: true,
    minimize: true,
    optimisticConcurrency: true,
  }
);

/* ✅ FAST LISTING INDEXES */
leadSchema.index({ assignedTo: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, status: 1, _id: -1 });
leadSchema.index({ assignedTo: 1, nextFollowUpAt: 1, _id: -1 });
leadSchema.index({ createdBy: 1, status: 1 });
leadSchema.index({ pipelineStage: 1, assignedTo: 1, _id: -1 });

leadSchema.index({ assignedTo: 1, priority: 1, _id: -1 });
leadSchema.index({ priority: 1, _id: -1 });
leadSchema.index({ purchaseType: 1, _id: -1 });

// ✅ NEW access indexes
leadSchema.index({ allowedUsers: 1, _id: -1 });
leadSchema.index({ createdBy: 1, ownerLocked: 1, _id: -1 });

/* ✅ TEXT SEARCH */
leadSchema.index(
  {
    "contact.name": "text",
    "contact.email": "text",
    "contact.phone": "text",
    "contact.companyName": "text",
    leadNumber: "text",
    source: "text",
    purchaseType: "text",
  },
  { name: "lead_text_search" }
);

/* ✅ leadNumber generation */
leadSchema.pre("save", function (next) {
  if (!this.leadNumber) {
    const idSuffix = String(this._id).slice(-4).toUpperCase();
    const y = new Date().getFullYear();
    this.leadNumber = `LD-${y}-${Date.now()}-${idSuffix}`;
  }
  next();
});

export default mongoose.model("Lead", leadSchema);
