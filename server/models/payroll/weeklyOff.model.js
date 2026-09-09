import mongoose from "mongoose";

const normalizeDateOnly = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const weeklyOffSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    scope: { type: String, enum: ["company", "employee"], default: "company", index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    offType: { type: String, enum: ["fixed", "custom", "rotating"], default: "fixed", index: true },
    fixedDays: { type: [Number], default: [] },
    customDates: {
      type: [
        {
          date: { type: Date, required: true },
          paid: { type: Boolean, default: true },
          note: { type: String, default: "", trim: true },
        },
      ],
      default: [],
    },
    rotationStartDate: { type: Date, default: null },
    rotationCycleDays: { type: Number, default: 7, min: 1 },
    rotationOffDays: { type: [Number], default: [] },
    paid: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

weeklyOffSchema.index({ scope: 1, employee: 1, isActive: 1 });

weeklyOffSchema.pre("validate", function (next) {
  this.name = String(this.name || "").trim();
  this.fixedDays = [...new Set((this.fixedDays || []).map(Number).filter((d) => d >= 0 && d <= 6))];
  this.rotationOffDays = [...new Set((this.rotationOffDays || []).map(Number).filter((d) => d >= 0))];
  this.rotationStartDate = this.rotationStartDate ? normalizeDateOnly(this.rotationStartDate) : null;
  this.customDates = (this.customDates || [])
    .map((item) => ({
      ...item,
      date: normalizeDateOnly(item.date),
      note: String(item.note || "").trim(),
      paid: item.paid !== false,
    }))
    .filter((item) => item.date);
  next();
});

export default mongoose.model("WeeklyOff", weeklyOffSchema);
