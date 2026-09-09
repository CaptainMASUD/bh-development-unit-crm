import mongoose from "mongoose";

const normalizeDateOnly = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    holidayDate: { type: Date, required: true, index: true },
    dayKey: { type: String, required: true, index: true },
    holidayType: { type: String, enum: ["paid", "unpaid"], default: "paid", index: true },
    appliesTo: { type: String, enum: ["company", "department", "employee"], default: "company" },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    note: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

holidaySchema.index({ dayKey: 1, appliesTo: 1, department: 1, employee: 1 });

holidaySchema.pre("validate", function (next) {
  const date = normalizeDateOnly(this.holidayDate);
  if (!date) return next(new Error("Invalid holiday date."));
  this.holidayDate = date;
  this.dayKey = date.toISOString().slice(0, 10);
  this.name = String(this.name || "").trim();
  this.note = String(this.note || "").trim();
  next();
});

export default mongoose.model("Holiday", holidaySchema);
