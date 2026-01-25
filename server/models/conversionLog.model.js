import mongoose from "mongoose";

const conversionLogSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    convertedAt: { type: Date, default: Date.now, index: true },

    // ✅ snapshot at conversion-time (gold for reporting)
    leadSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    customerSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: false, minimize: true }
);

conversionLogSchema.index({ leadId: 1, customerId: 1 }, { unique: true });

export default mongoose.model("ConversionLog", conversionLogSchema);
