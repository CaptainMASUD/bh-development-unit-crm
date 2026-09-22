import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    actorName: {
      type: String,
      default: "System",
      index: true,
    },

    actorEmail: {
      type: String,
      default: "",
    },

    actorRole: {
      type: String,
      default: "",
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    module: {
      type: String,
      default: "general",
      index: true,
    },

    entityType: {
      type: String,
      required: true,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },

    recordIdentifier: {
      type: String,
      default: "",
      index: true,
    },

    changes: [
      {
        path: { type: String, required: true },
        before: { type: mongoose.Schema.Types.Mixed, default: null },
        after: { type: mongoose.Schema.Types.Mixed, default: null },
      },
    ],

    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    meta: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      method: { type: String, default: "" },
      path: { type: String, default: "" },
      oldStage: { type: String, default: "" },
      newStage: { type: String, default: "" },
      oldStatus: { type: String, default: "" },
      newStatus: { type: String, default: "" },
      reason: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      extra: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    minimize: true,
  }
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, module: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, entityType: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
