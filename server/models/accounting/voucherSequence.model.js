import mongoose from "mongoose";

const voucherSequenceSchema = new mongoose.Schema(
  {
    sequenceKey: { type: String, required: true, unique: true, index: true },
    value: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("VoucherSequence", voucherSequenceSchema);
