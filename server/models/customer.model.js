// models/customer.model.js
import mongoose from "mongoose";

/* =========================
   SUB SCHEMAS
========================= */

const contactPersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
  },
  { _id: false }
);

// ✅ NEW (optional): multiple extra contacts per customer (keeps your main contactPerson)
const secondaryContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    isPrimary: { type: Boolean, default: false }, // optional flag
  },
  { _id: true }
);

const reminderSchema = new mongoose.Schema(
  {
    remindAt: { type: Date, required: true },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const fileSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // S3 key
    url: { type: String, required: true }, // S3 object URL (private url you store)

    originalName: { type: String, required: true, trim: true },
    displayName: { type: String, default: "", trim: true },

    mimeType: { type: String, trim: true },
    size: { type: Number, default: 0 },

    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true, // small win for file audit queries
    },
  },
  { _id: true }
);

const customerFileSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // S3 key
    url: { type: String, required: true }, // S3 object URL (private url you store)

    originalName: { type: String, required: true, trim: true },
    displayName: { type: String, default: "", trim: true },

    mimeType: { type: String, trim: true },
    size: { type: Number, default: 0 },

    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true, // small win for file audit queries
    },
  },
  { _id: true }
);

const subtitleNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null }, // optional

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

/**
 * ✅ Subtitle snapshot schema (saved inside a task)
 * Includes files + notes
 */
const subtitleSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },

    files: { type: [fileSchema], default: [] },
    notes: { type: [subtitleNoteSchema], default: [] },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // ✅ subtitles now contain files + notes
    subtitles: { type: [subtitleSchema], default: [] },

    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskTemplate",
      default: null,
      index: true,
    },

    // ✅ task-level notes remain
    description: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["pending", "in_progress", "done"], // (keeping your existing values)
      default: "pending",
      index: true,
    },

    dueAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null, index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],

    reminders: { type: [reminderSchema], default: [] },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

/**
 * ✅ Engagement history per year
 * IMPORTANT: subEngagementIds are subdocument _ids inside EngagementTemplate.subEngagements
 */
const customerEngagementSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true, min: 1900, max: 2200 },

    engagementTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EngagementTemplate",
      required: true,
      index: true,
    },

    subEngagementIds: {
      type: [mongoose.Schema.Types.ObjectId], // references EngagementTemplate.subEngagements._id
      default: [],
      index: true, // ✅ helps filtering by sub engagements
    },

    updatedAt: { type: Date, default: Date.now, index: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { _id: true }
);

// ✅ NEW (optional): structured addresses for real CRM + orders
const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: "" },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

/* =========================
   CUSTOMER SCHEMA
========================= */

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    companyName: { type: String, trim: true, index: true },

    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },

    // kept for backward compatibility
    address: { type: String, trim: true, default: "" },

    contactPerson: { type: contactPersonSchema, required: true },

    // ✅ NEW (optional): multiple contacts (does not remove current feature)
    secondaryContacts: { type: [secondaryContactSchema], default: [] },

    // ✅ NEW: tags + lifecycle stage (common CRM features)
    tags: { type: [String], default: [], index: true }, // ex: ["vip","wholesale"]
    lifecycleStage: {
      type: String,
      enum: ["prospect", "active", "dormant", "churned"],
      default: "prospect",
      index: true,
    },

    // ✅ NEW (optional): billing/shipping address
    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },

    // ✅ customer type (kept)
    customerType: {
      type: String,
      enum: ["new", "recurring"],
      default: "new",
      index: true,
    },

    status: {
      type: String,
      enum: ["pending", "in_progress", "complete"],
      default: "pending",
      index: true,
    },

    origin: {
      type: String,
      enum: ["direct", "lead"],
      default: "direct",
      index: true,
    },

    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],

    // ✅ Customer-level files (kept)
    customerFiles: { type: [customerFileSchema], default: [] },

    // ✅ Engagement history per year (kept)
    engagements: { type: [customerEngagementSchema], default: [] },

    // ✅ tasks with subtitle files + notes (kept)
    crmTasks: { type: [taskSchema], default: [] },
  },
  {
    timestamps: true,
    minimize: true,
  }
);

/* =========================
   INDEX OPTIMIZATION
========================= */

// existing indexes (kept)
customerSchema.index({ assignedTo: 1, status: 1 });
customerSchema.index({ createdBy: 1, status: 1 });
customerSchema.index({ origin: 1, status: 1 });

// embedded task indexes (kept)
customerSchema.index({ "crmTasks.status": 1 });
customerSchema.index({ "crmTasks.dueAt": 1 });
customerSchema.index({ "crmTasks.assignedTo": 1 });
customerSchema.index({ "crmTasks.templateId": 1 });

// subtitle-level indexes (kept)
customerSchema.index({ "crmTasks.subtitles._id": 1 });
customerSchema.index({ "crmTasks.subtitles.notes.createdAt": 1 });

// ✅ Engagement indexes (kept)
customerSchema.index({ "engagements.engagementTemplateId": 1, "engagements.year": 1 });
customerSchema.index({ "engagements.engagementTemplateId": 1 });
customerSchema.index({ "engagements.subEngagementIds": 1 });
customerSchema.index({ "engagements.engagementTemplateId": 1, _id: -1 });
customerSchema.index({ "engagements.subEngagementIds": 1, _id: -1 });

customerSchema.index({ customerType: 1, _id: -1 });

// newest-first listing
customerSchema.index({ createdAt: -1 });

// lead unique constraint (kept)
customerSchema.index({ leadId: 1 }, { unique: true, sparse: true });

// cursor pagination indexes (kept)
customerSchema.index({ assignedTo: 1, _id: -1 });
customerSchema.index({ createdBy: 1, _id: -1 });
customerSchema.index({ origin: 1, _id: -1 });

// optional combined filters (kept)
customerSchema.index({ assignedTo: 1, status: 1, _id: -1 });
customerSchema.index({ createdBy: 1, status: 1, _id: -1 });
customerSchema.index({ origin: 1, status: 1, _id: -1 });

// ✅ NEW: helpful indexes for CRM filters
customerSchema.index({ lifecycleStage: 1, _id: -1 });
customerSchema.index({ tags: 1, _id: -1 });

/* fast text search (kept) */
customerSchema.index(
  {
    name: "text",
    companyName: "text",
    phone: "text",
    email: "text",
    "contactPerson.name": "text",
    "contactPerson.phone": "text",
    "contactPerson.email": "text",
  },
  {
    name: "customer_text_search",
    weights: {
      name: 10,
      companyName: 6,
      "contactPerson.name": 6,
      phone: 3,
      email: 3,
      "contactPerson.phone": 3,
      "contactPerson.email": 3,
    },
  }
);

export default mongoose.model("Customer", customerSchema);
