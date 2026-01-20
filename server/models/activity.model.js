import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: "Deal", default: null, index: true },

    type: {
      type: String,
      enum: ["note", "call", "email", "meeting", "whatsapp", "task_followup"],
      default: "note",
      index: true,
    },

    title: { type: String, trim: true, default: "" },
    body: { type: String, trim: true, default: "" },

    scheduledAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null, index: true },

    outcome: { type: String, trim: true, default: "" },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

activitySchema.index({ customerId: 1, createdAt: -1 });
activitySchema.index({ dealId: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);
