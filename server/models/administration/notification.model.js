import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      trim: true,
      default: "",
    },

    type: {
      type: String,
      enum: [
        "info",
        "success",
        "warning",
        "danger",
        "lead",
        "activity",
        "proposal",
        "deal",
        "work_queue",
        "automation",
        "inventory",
      ],
      default: "info",
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },

    entityType: {
      type: String,
      enum: [
        "",
        "Lead",
        "Activity",
        "Proposal",
        "Deal",
        "Customer",
        "WorkQueue",
        "AutomationRule",
        "Product",
        "StockRequest",
        "StockInspection",
        "StockTransfer",
        "InventoryTracking",
      ],
      default: "",
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    actionUrl: {
      type: String,
      trim: true,
      default: "",
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  { timestamps: true, minimize: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
