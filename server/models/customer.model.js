// models/customer.model.js
import mongoose from "mongoose";
import { clearEmbeddedPathIndexes, compactTenantIndexes } from "../config/tenant.plugin.js";

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

const secondaryContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    isPrimary: { type: Boolean, default: false },
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
    key: { type: String, required: true },
    url: { type: String, required: true },

    originalName: { type: String, required: true, trim: true },
    displayName: { type: String, default: "", trim: true },

    mimeType: { type: String, trim: true },
    size: { type: Number, default: 0 },

    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { _id: true }
);

const customerFileSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    url: { type: String, required: true },

    originalName: { type: String, required: true, trim: true },
    displayName: { type: String, default: "", trim: true },

    mimeType: { type: String, trim: true },
    size: { type: Number, default: 0 },

    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { _id: true }
);

const subtitleNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, default: null },

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
 * ✅ UPDATED subtitle schema:
 * - Each TASK subtitle keeps its own _id (already unique per task)
 * - Also stores templateSubtitleId (to map back to template subtitle safely)
 * - Files/notes remain per-task-subtitle (isolated)
 */
const subtitleSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },

    // ✅ NEW: Link to template subtitle id (if created from a template)
    // This helps you map S1 from template => this task's subtitle instance
    templateSubtitleId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    files: { type: [fileSchema], default: [] },
    notes: { type: [subtitleNoteSchema], default: [] },
  },
  { _id: true }
);

/**
 * ✅ Customer Job Tree (max depth=2)
 * - parentJobId: null => top-level Job
 * - parentJobId: <jobId> => Sub-Job
 *
 * We store ALL job nodes in ONE flat array and build tree in controller.
 */
const jobNodeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },

    // null = root job, otherwise points to another node inside customer.jobs._id
    parentJobId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    status: {
      type: String,
      enum: ["active", "on_hold", "completed"],
      default: "active",
      index: true,
    },

    // optional metadata
    code: { type: String, trim: true, default: "" }, // ex: "STEEL-2026"
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
  },
  { _id: true, timestamps: true } // ✅ use timestamps instead of manual createdAt/updatedAt
);

/**
 * ✅ Task schema (service instance)
 * - Uses timestamps: true => adds createdAt + updatedAt automatically
 * - Adds startedAt to support "running service" time tracking
 * - Removes manual createdAt (duplicate with timestamps)
 */
const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },

    // tasks belong to a job node (job or sub-job)
    jobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    // always store top-level job id for reporting/grouping
    rootJobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    subtitles: { type: [subtitleSchema], default: [] },

    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskTemplate",
      default: null,
      index: true,
    },

    description: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["pending", "in_progress", "done"],
      default: "pending",
      index: true,
    },

    // ✅ NEW: real start time for “running service”
    startedAt: { type: Date, default: null, index: true },

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
  },
  { timestamps: true }
);

/**
 * Engagement history per year
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
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      index: true,
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

    address: { type: String, trim: true, default: "" },

    contactPerson: { type: contactPersonSchema, required: true },

    secondaryContacts: { type: [secondaryContactSchema], default: [] },

    tags: { type: [String], default: [], index: true },
    lifecycleStage: {
      type: String,
      enum: ["prospect", "active", "dormant", "churned"],
      default: "prospect",
      index: true,
    },

    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },

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

    customerFiles: { type: [customerFileSchema], default: [] },

    engagements: { type: [customerEngagementSchema], default: [] },

    // job nodes stored here (flat list, tree via parentJobId)
    jobs: { type: [jobNodeSchema], default: [] },

    // tasks belong to a job node now
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

// tasks indexes (kept + new)
customerSchema.index({ "crmTasks.status": 1 });
customerSchema.index({ "crmTasks.dueAt": 1 });
customerSchema.index({ "crmTasks.assignedTo": 1 });
customerSchema.index({ "crmTasks.templateId": 1 });
customerSchema.index({ "crmTasks.jobId": 1 });
customerSchema.index({ "crmTasks.rootJobId": 1 });

// ✅ NEW: running services queries
customerSchema.index({ "crmTasks.startedAt": 1 });

// subtitle-level indexes (kept + new)
customerSchema.index({ "crmTasks.subtitles._id": 1 });
customerSchema.index({ "crmTasks.subtitles.templateSubtitleId": 1 }); // ✅ NEW for mapping
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

// job indexes (kept)
customerSchema.index({ "jobs.parentJobId": 1, _id: -1 });
customerSchema.index({ "jobs.status": 1, _id: -1 });

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

clearEmbeddedPathIndexes(customerSchema);
compactTenantIndexes(customerSchema);

export default mongoose.model("Customer", customerSchema);
