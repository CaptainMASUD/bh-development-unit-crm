import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
      default: null,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, maxlength: 30 },
    nameLower: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    head: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    expenseAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

departmentSchema.index({ tenantId: 1, nameLower: 1 }, { unique: true });
departmentSchema.index({ tenantId: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string" } } });

departmentSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.name = String(this.name || "").trim();
    this.nameLower = this.name.toLowerCase();
  }
  next();
});

departmentSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const nextName = update.$set?.name ?? update.name;

  if (nextName !== undefined) {
    const name = String(nextName || "").trim();
    update.$set = {
      ...(update.$set || {}),
      name,
      nameLower: name.toLowerCase(),
    };
    if (update.name !== undefined) delete update.name;
  }

  this.setUpdate(update);
  next();
});

export default mongoose.model("Department", departmentSchema);
