// models/reportViewPreference.model.js
import mongoose from "mongoose";

const reportViewPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // example keys:
    // "reports.draft.list", "reports.final.list"
    key: { type: String, required: true, trim: true, index: true },

    // list of column keys
    columns: { type: [String], default: [] },
  },
  { timestamps: true, minimize: true }
);

reportViewPreferenceSchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model("ReportViewPreference", reportViewPreferenceSchema);
