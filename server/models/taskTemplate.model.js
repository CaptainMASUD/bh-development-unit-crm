// models/taskTemplate.model.js
import mongoose from "mongoose";

const templateSubtitleSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: true }
);

const taskTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },

    subtitles: {
      type: [templateSubtitleSchema],
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
taskTemplateSchema.index({ title: "text" });

/**
 * ✅ FAST LISTING / FILTERING
 */
taskTemplateSchema.index({ isActive: 1, title: 1 });
taskTemplateSchema.index({ createdBy: 1, isActive: 1, createdAt: -1 });

/**
 * ✅ CASE-INSENSITIVE UNIQUE TITLE
 * Prevents duplicates like "Invoice" vs "invoice"
 */
taskTemplateSchema.index(
  { title: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);

export default mongoose.model("TaskTemplate", taskTemplateSchema);
