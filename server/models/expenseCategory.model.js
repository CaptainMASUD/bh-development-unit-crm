import mongoose from "mongoose";

const expenseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      default: null,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

expenseCategorySchema.index({ parent: 1, nameLower: 1 }, { unique: true });
expenseCategorySchema.index({ isActive: 1, nameLower: 1 });

expenseCategorySchema.pre("validate", function (next) {
  this.name = String(this.name || "").trim();
  this.nameLower = this.name.toLowerCase();
  next();
});

expenseCategorySchema.pre("findOneAndUpdate", function (next) {
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

export default mongoose.model("ExpenseCategory", expenseCategorySchema);
