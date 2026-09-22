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
    defaultDateFormat: { type: String, enum: ["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"], default: "DD-MM-YYYY" },
    defaultTimeFormat: { type: String, enum: ["12-hour", "24-hour"], default: "24-hour" },
    defaultCurrency: { type: String, uppercase: true, trim: true, match: /^[A-Z]{3}$/, default: "BDT" },
    currencyDecimalPlaces: { type: Number, min: 0, max: 6, default: 2 },
    numberDecimalPlaces: { type: Number, min: 0, max: 6, default: 2 },
    defaultSortOrder: { type: String, enum: ["newest_first", "oldest_first"], default: "newest_first" },
    defaultFileUploadLimitMb: { type: Number, min: 1, max: 100, default: 10 },
    allowedFileTypes: {
      type: [String],
      default: () => ["PDF", "JPG", "PNG", "XLSX", "DOCX"],
      validate: {
        validator: (values) => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length && values.every((value) => ["PDF", "JPG", "PNG", "XLSX", "DOCX"].includes(value)),
        message: "Allowed file types must be a non-empty unique selection of PDF, JPG, PNG, XLSX, or DOCX.",
      },
    },
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
