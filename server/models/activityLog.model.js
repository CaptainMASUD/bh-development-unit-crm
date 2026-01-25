import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    // ✅ Primary grouping
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },

    // one of these should exist
    entityType: { type: String, enum: ["Lead", "Customer"], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    type: {
      type: String,
      enum: ["created", "updated", "note_added", "contacted", "followup_set", "converted"],
      required: true,
      index: true,
    },

    message: { type: String, default: "", trim: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, minimize: true }
);

activityLogSchema.index({ leadId: 1, createdAt: -1 });
activityLogSchema.index({ customerId: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
