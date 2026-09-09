import mongoose from "mongoose";

const customerViewPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // example: "customers.list"
    key: { type: String, required: true, trim: true, index: true },

    // list of column keys: ["name", "status", ...]
    columns: { type: [String], default: [] },
  },
  { timestamps: true, minimize: true }
);

customerViewPreferenceSchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model("CustomerViewPreference", customerViewPreferenceSchema);
