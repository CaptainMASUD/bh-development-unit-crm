// models/engagementTemplate.model.js
import mongoose from "mongoose";

const subEngagementSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: true }
);

const engagementTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    // ✅ Can be empty => "single title only" engagement type
    subEngagements: {
      type: [subEngagementSchema],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, minimize: true }
);

/**
 * ✅ FAST SEARCH
 * Enables: ?q=some words  (uses Mongo text search)
 */
engagementTemplateSchema.index({ title: "text" });

/**
 * ✅ FAST LISTING / FILTERING
 */
engagementTemplateSchema.index({ isActive: 1, title: 1 });
engagementTemplateSchema.index({ createdBy: 1, isActive: 1, createdAt: -1 });

/**
 * ✅ CASE-INSENSITIVE UNIQUE TITLE
 */
engagementTemplateSchema.index(
  { title: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);

export default mongoose.model("EngagementTemplate", engagementTemplateSchema);
