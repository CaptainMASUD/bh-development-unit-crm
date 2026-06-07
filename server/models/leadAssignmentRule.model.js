import mongoose from "mongoose";

const leadAssignmentRuleSchema = new mongoose.Schema(
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

    source: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    purchaseType: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    priority: {
      type: String,
      enum: ["", "low", "medium", "high"],
      default: "",
      index: true,
    },

    leadTemperature: {
      type: String,
      enum: ["", "cold", "warm", "hot"],
      default: "",
      index: true,
    },

    assignToUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    strategy: {
      type: String,
      enum: ["round_robin", "least_loaded", "fixed_user"],
      default: "least_loaded",
      index: true,
    },

    maxDailyLeadsPerUser: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastAssignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    order: {
      type: Number,
      default: 100,
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

leadAssignmentRuleSchema.index({ isActive: 1, order: 1 });
leadAssignmentRuleSchema.index({ source: 1, purchaseType: 1, isActive: 1 });
leadAssignmentRuleSchema.index({ createdBy: 1, createdAt: -1 });

leadAssignmentRuleSchema.pre("validate", function (next) {
  if (!this.assignToUsers || this.assignToUsers.length === 0) {
    return next(new Error("At least one user is required for assignment rule"));
  }

  next();
});

export default mongoose.model("LeadAssignmentRule", leadAssignmentRuleSchema);