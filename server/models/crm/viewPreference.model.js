import mongoose from "mongoose";

const viewPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // example: "leads.list"
    key: { type: String, required: true, trim: true, index: true },

    // list of column keys: ["contact.name", "status", ...]
    columns: { type: [String], default: [] },
  },
  { timestamps: true, minimize: true }
);

viewPreferenceSchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model("ViewPreference", viewPreferenceSchema);
