import mongoose from "mongoose";

/* =========================
   SUB SCHEMAS
========================= */

const leadContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
  },
  { _id: false }
);

const leadNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* =========================
   LEAD SCHEMA
========================= */

const leadSchema = new mongoose.Schema(
  {
    /* Basic lead info */
    contact: {
      type: leadContactSchema,
      required: true,
    },

    /* Lead status */
    status: {
      type: String,
      enum: ["new", "contacted", "pending", "confirmed", "lost"],
      default: "new",
      index: true,
    },

    /* Lead source */
    source: {
      type: String,
      trim: true,
      index: true,
    },

    /* Marketing ownership */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* Assigned marketing team member */
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* Notes */
    notes: {
      type: [leadNoteSchema],
      default: [],
    },

    /* ✅ NEW: customer created immediately when lead is created */
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    /* (Optional) keep old conversion fields for backward compatibility */
    convertedCustomer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/* =========================
   INDEX OPTIMIZATION
========================= */

leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ createdBy: 1, status: 1 });

export default mongoose.model("Lead", leadSchema);
