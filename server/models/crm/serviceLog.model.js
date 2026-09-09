import mongoose from "mongoose";

const serviceLogSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    // ✅ unique per task so we don’t log duplicates
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },

    // ✅ serviceId = TaskTemplate._id (your “service template” identity)
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskTemplate",
      default: null,
      index: true,
    },

    // snapshot title for history (if template title changes later)
    serviceTitleSnapshot: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },

    jobId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    rootJobId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    status: {
      type: String,
      enum: ["done", "cancelled"],
      default: "done",
      index: true,
    },

    startedAt: { type: Date, default: null, index: true },
    completedAt: { type: Date, required: true, index: true },

    durationMinutes: { type: Number, default: 0, index: true },

    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true, minimize: true }
);

// ✅ Optimized reporting indexes
serviceLogSchema.index({ customerId: 1, serviceId: 1, completedAt: -1 });
serviceLogSchema.index({ serviceId: 1, completedAt: -1 });
serviceLogSchema.index({ assignedTo: 1, completedAt: -1 });
serviceLogSchema.index({ status: 1, completedAt: -1 });

export default mongoose.model("ServiceLog", serviceLogSchema);
