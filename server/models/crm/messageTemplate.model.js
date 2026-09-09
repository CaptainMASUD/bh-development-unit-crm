import mongoose from "mongoose";

const messageTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    channel: {
      type: String,
      enum: ["call_note", "whatsapp", "email", "meeting", "proposal_note", "general"],
      default: "general",
      index: true,
    },

    purpose: {
      type: String,
      enum: [
        "first_contact",
        "follow_up",
        "proposal_sent",
        "proposal_reminder",
        "meeting_schedule",
        "lost_reason",
        "won_note",
        "general",
      ],
      default: "general",
      index: true,
    },

    subject: {
      type: String,
      trim: true,
      default: "",
    },

    body: {
      type: String,
      required: true,
      trim: true,
    },

    variables: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    usageCount: {
      type: Number,
      default: 0,
      min: 0,
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

messageTemplateSchema.index({ key: 1 }, { unique: true });
messageTemplateSchema.index({ channel: 1, purpose: 1, isActive: 1 });
messageTemplateSchema.index({ createdBy: 1, createdAt: -1 });

messageTemplateSchema.pre("validate", function (next) {
  if (this.isModified("key") && this.key) {
    this.key = String(this.key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  next();
});

export default mongoose.model("MessageTemplate", messageTemplateSchema);