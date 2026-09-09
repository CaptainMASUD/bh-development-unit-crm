import mongoose from "mongoose";

const unpaidChargeSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    calculationType: { type: String, enum: ["per_day", "fixed", "percentage"], default: "per_day" },
    value: { type: Number, default: 0, min: 0 },
    basedOn: { type: String, enum: ["basicSalary", "grossSalary", "manual"], default: "basicSalary" },
  },
  { _id: false }
);

const leaveTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    nameLower: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    year: { type: Number, default: () => new Date().getFullYear(), index: true },
    paidDays: { type: Number, default: 0, min: 0 },
    unpaidDays: { type: Number, default: 0, min: 0 },
    unpaidCharge: { type: unpaidChargeSchema, default: () => ({}) },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department", index: true }],
    positions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Position", index: true }],
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

leaveTemplateSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = String(this.name || "").trim();
    this.nameLower = this.name.toLowerCase();
  }
  this.departments = [...new Set((this.departments || []).map(String))];
  this.positions = [...new Set((this.positions || []).map(String))];
  next();
});

export default mongoose.model("LeaveTemplate", leaveTemplateSchema);
