// models/taskTemplate.model.js
import mongoose from "mongoose";

const templateFileSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    nameLower: { type: String, required: true, trim: true, lowercase: true, index: true }, // ✅ for fast case-insensitive filtering/sort
    type: { type: String, trim: true, maxlength: 120, default: "" },
    size: { type: Number, min: 0 },
    uploadedAt: { type: Date, default: Date.now, index: true },
  },
  { _id: true }
);

const templateSubtitleSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 200 },
    textLower: { type: String, required: true, trim: true, lowercase: true, index: true }, // ✅
    files: { type: [templateFileSchema], default: [] },
  },
  { _id: true }
);

const taskTemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    titleLower: { type: String, required: true, trim: true, lowercase: true, index: true }, // ✅ for fast sort + cursor

    subtitles: { type: [templateSubtitleSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, minimize: true }
);

/* ---------------- NORMALIZE LOWER FIELDS ---------------- */
taskTemplateSchema.pre("validate", function (next) {
  if (this.title !== undefined) {
    const t = String(this.title || "").trim();
    this.title = t;
    this.titleLower = t.toLowerCase();
  }

  if (Array.isArray(this.subtitles)) {
    this.subtitles = this.subtitles.map((s) => {
      const text = String(s?.text || "").trim();
      const files = Array.isArray(s?.files) ? s.files : [];

      const normalizedFiles = files.map((f) => {
        const nm = String(f?.name || "").trim();
        return {
          ...f,
          name: nm,
          nameLower: nm.toLowerCase(),
          type: f?.type ? String(f.type).trim() : "",
        };
      });

      return {
        ...s,
        text,
        textLower: text.toLowerCase(),
        files: normalizedFiles,
      };
    });
  }

  next();
});

/* ---------------- INDEXES (HIGH PERFORMANCE) ---------------- */

/**
 * ✅ FULL TEXT SEARCH (Title + Subtitle text)
 * - This is what you need to search BOTH task title and subtask text with `q=...`
 */
taskTemplateSchema.index(
  { title: "text", "subtitles.text": "text" },
  { weights: { title: 10, "subtitles.text": 5 }, name: "task_templates_text" }
);

/**
 * ✅ FAST LISTING / FILTERING / SORTING
 * - titleLower + _id for stable sort + cursor pagination
 * - _id descending for newest pagination
 */
taskTemplateSchema.index({ isActive: 1, titleLower: 1, _id: 1 });
taskTemplateSchema.index({ isActive: 1, _id: -1 });

/**
 * ✅ CreatedBy listing (admin panel / audit / reporting)
 */
taskTemplateSchema.index({ createdBy: 1, isActive: 1, createdAt: -1 });

/**
 * ✅ CASE-INSENSITIVE UNIQUE TITLE
 * - best-practice: make unique on titleLower (not collation unique on title)
 * - avoids collation edge cases + faster checks
 */
taskTemplateSchema.index({ titleLower: 1 }, { unique: true });

export default mongoose.model("TaskTemplate", taskTemplateSchema);
