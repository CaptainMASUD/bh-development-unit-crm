import mongoose from "mongoose";

const salesSequenceSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    current: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

salesSequenceSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const SalesSequence =
  mongoose.models.SalesSequence ||
  mongoose.model("SalesSequence", salesSequenceSchema);
