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
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "restore",

        "stage_change",
        "stage_changed",
        "status_change",
        "status_changed",
        "requirement_updated",
        "contacted",
        "followup_set",
        "won",
        "lost",
        "convert",
        "converted",

        "complete",
        "completed",
        "cancel",
        "cancelled",

        "send",
        "sent",
        "accept",
        "accepted",
        "reject",
        "rejected",

        "assign",
        "reassign",
        "auto_assign",

        "queue_created",
        "queue_done",
        "queue_snoozed",

        "notification_created",
        "template_used",

        "confirm",
        "confirmed",
        "payment_received",
        "paid",
        "void",
        "publish",
        "close",
        "lock",
        "unlock",
        "submit",
        "approve",
        "reverse",
      ],
      required: true,
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
        "Dashboard",
        "ViewPreference",
        "WorkQueue",
        "AutomationRule",
        "Notification",
        "MessageTemplate",
        "LeadAssignmentRule",
        "AccountingSettings",
        "Account",
        "FiscalYear",
        "AccountingPeriod",
        "OpeningBalance",
        "JournalEntry",
        "SalesQuotation",
        "SalesOrder",
        "SalesDelivery",
        "SalesInvoice",
        "SalesReturn",
        "StockMovement",
        "StockAdjustment",
        "StockTransfer",
        "InventoryValuation",
        "InventoryRevaluation",
        "InventoryLoss",
        "WarehouseCheck",
        "InventoryPreference",
      ],
      required: true,
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

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

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, entityType: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
