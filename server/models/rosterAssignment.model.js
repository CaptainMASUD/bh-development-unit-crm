import mongoose from "mongoose";

const normalizeDateOnly = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const rosterAssignmentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true, index: true },
    rosterType: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "weekly",
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, default: null, index: true },
    weekdays: { type: [Number], default: [] },
    monthDays: { type: [Number], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    note: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

rosterAssignmentSchema.index({ employee: 1, startDate: 1, endDate: 1, isActive: 1 });
rosterAssignmentSchema.index({ shift: 1, isActive: 1 });

rosterAssignmentSchema.pre("validate", function (next) {
  this.startDate = normalizeDateOnly(this.startDate);
  this.endDate = this.endDate ? normalizeDateOnly(this.endDate) : null;
  this.weekdays = [...new Set((this.weekdays || []).map(Number).filter((d) => d >= 0 && d <= 6))];
  this.monthDays = [...new Set((this.monthDays || []).map(Number).filter((d) => d >= 1 && d <= 31))];
  this.note = String(this.note || "").trim();
  next();
});

export default mongoose.model("RosterAssignment", rosterAssignmentSchema);
