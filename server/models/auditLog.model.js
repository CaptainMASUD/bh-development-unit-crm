import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    action: {
      type: String,
      enum: ["create", "update", "delete", "convert", "note", "status", "assign", "file"],
      required: true,
      index: true,
    },

    entityType: {
      type: String,
      enum: ["Lead", "Customer", "Task", "Engagement", "Upload", "User"],
      required: true,
      index: true,
    },

    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    // ✅ payload snapshot for audit (never trust client)
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },

    meta: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      requestId: { type: String, default: "" },
    },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, minimize: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
