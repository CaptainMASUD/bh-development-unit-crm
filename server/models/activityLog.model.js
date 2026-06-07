import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
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

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
      index: true,
    },

    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      default: null,
      index: true,
    },

    entityType: {
      type: String,
      enum: [
        "Lead",
        "Customer",
        "Activity",
        "Deal",
        "Proposal",
        "Order",
        "Invoice",
        "Product",
        "PurchaseType",
        "User",
        "Payment",
        "WorkQueue",
        "AutomationRule",
        "Notification",
        "MessageTemplate",
        "LeadAssignmentRule",
      ],
      required: true,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",

        "note_added",
        "contacted",
        "followup_set",

        "stage_change",
        "stage_changed",
        "status_change",
        "status_changed",

        "requirement_updated",

        "proposal_created",
        "proposal_sent",
        "proposal_accepted",
        "proposal_rejected",
        "proposal_cancelled",

        "deal_created",
        "deal_won",
        "deal_lost",

        "converted",

        "order_created",
        "order_confirmed",

        "invoice_created",
        "invoice_sent",
        "payment_received",
        "invoice_paid",

        "activity_created",
        "activity_completed",
        "activity_cancelled",

        "quick_action",
        "automation_triggered",
        "work_queue_created",
        "work_queue_done",
        "work_queue_snoozed",
        "notification_created",
        "template_used",
        "lead_assigned",
        "lead_reassigned",
      ],
      required: true,
      index: true,
    },

    message: { type: String, default: "", trim: true },

    meta: {
      oldStage: { type: String, default: "" },
      newStage: { type: String, default: "" },
      oldStatus: { type: String, default: "" },
      newStatus: { type: String, default: "" },
      reason: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      extra: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, minimize: true }
);

activityLogSchema.index({ leadId: 1, createdAt: -1 });
activityLogSchema.index({ customerId: 1, createdAt: -1 });
activityLogSchema.index({ dealId: 1, createdAt: -1 });
activityLogSchema.index({ orderId: 1, createdAt: -1 });
activityLogSchema.index({ invoiceId: 1, createdAt: -1 });
activityLogSchema.index({ proposalId: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ type: 1, createdAt: -1 });
activityLogSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);