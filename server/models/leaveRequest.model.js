import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    position: { type: mongoose.Schema.Types.ObjectId, ref: "Position", default: null, index: true },
    leaveType: { type: String, enum: ["paid", "unpaid"], required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    year: { type: Number, required: true, index: true },
    totalDays: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, required: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    adminNote: { type: String, trim: true, default: "", maxlength: 1000 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employee: 1, year: 1, status: 1 });
leaveRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("LeaveRequest", leaveRequestSchema);
