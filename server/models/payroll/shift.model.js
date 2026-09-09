import mongoose from "mongoose";

const clean = (value) => String(value ?? "").trim();

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, default: "", trim: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    breakMinutes: { type: Number, default: 0, min: 0 },
    graceMinutes: { type: Number, default: 0, min: 0 },
    overtimeAfterMinutes: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    note: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

shiftSchema.index({ nameLower: 1 }, { unique: true });

shiftSchema.pre("validate", function (next) {
  this.name = clean(this.name);
  this.nameLower = this.name.toLowerCase();
  this.startTime = clean(this.startTime);
  this.endTime = clean(this.endTime);
  this.note = clean(this.note);
  next();
});

export default mongoose.model("Shift", shiftSchema);
