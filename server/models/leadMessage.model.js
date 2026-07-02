import mongoose from "mongoose";

const leadMessageSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    senderRole: {
      type: String,
      enum: ["admin", "superadmin", "employee"],
      required: true,
      index: true,
    },

    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        readAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, minimize: true }
);

leadMessageSchema.index({ leadId: 1, createdAt: -1 });
leadMessageSchema.index({ leadId: 1, senderId: 1, recipientId: 1, createdAt: -1 });
leadMessageSchema.index({ recipientId: 1, createdAt: -1 });
leadMessageSchema.index({ senderId: 1, createdAt: -1 });

export default mongoose.model("LeadMessage", leadMessageSchema);
