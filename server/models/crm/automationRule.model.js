import mongoose from "mongoose";

const automationConditionSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, trim: true },
    operator: {
      type: String,
      enum: [
        "equals",
        "not_equals",
        "contains",
        "greater_than",
        "less_than",
        "older_than_days",
        "due_within_days",
        "is_empty",
        "is_not_empty",
      ],
      required: true,
    },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: true }
);

const automationActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "create_work_queue",
        "create_notification",
        "update_lead_priority",
        "update_lead_score",
        "set_next_action",
        "create_activity",
        "mark_overdue",
      ],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

const automationRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    entityType: {
      type: String,
      enum: ["Lead", "Activity", "Proposal", "Deal"],
      required: true,
      index: true,
    },

    trigger: {
      type: String,
      enum: [
        "lead_created",
        "lead_updated",
        "stage_changed",
        "activity_created",
        "proposal_sent",
        "deal_updated",
        "daily_check",
      ],
      required: true,
      index: true,
    },

    conditions: {
      type: [automationConditionSchema],
      default: [],
    },

    actions: {
      type: [automationActionSchema],
      default: [],
    },

    priority: {
      type: Number,
      default: 100,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    runOncePerEntityPerDay: {
      type: Boolean,
      default: true,
    },

    lastRunAt: {
      type: Date,
      default: null,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true, minimize: true }
);

automationRuleSchema.index({ entityType: 1, trigger: 1, isActive: 1 });
automationRuleSchema.index({ isActive: 1, priority: 1 });

export default mongoose.model("AutomationRule", automationRuleSchema);