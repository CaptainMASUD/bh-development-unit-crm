import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
      index: true,
    },
    schemaVersion: { type: Number, default: 1, min: 1 },
    revision: { type: Number, default: 1, min: 1 },
    tablePageSize: { type: Number, default: 20, min: 10, max: 200 },
    auditStorageLimit: {
      type: Number,
      default: 100000,
      min: 1000,
      max: 10000000,
    },
    auditRetentionMode: {
      type: String,
      enum: ["warn_only", "archive_then_purge"],
      default: "warn_only",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SystemSettings", systemSettingsSchema);
