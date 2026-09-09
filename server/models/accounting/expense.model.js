import mongoose from "mongoose";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    type: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    titleLower: { type: String, trim: true, default: "", index: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: true,
      index: true,
    },
    expenseDate: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0, set: roundMoney },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "card", "mobile_banking", "cheque", "online", "other"],
      required: true,
      index: true,
    },
    payeeVendor: { type: String, trim: true, default: "", index: true },
    invoiceBillNo: { type: String, trim: true, default: "", index: true },
    referenceNo: { type: String, trim: true, default: "", index: true },
    description: { type: String, trim: true, default: "" },
    attachment: { type: attachmentSchema, default: () => ({}) },
    branch: { type: String, trim: true, default: "", index: true },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

expenseSchema.index({ expenseDate: -1, createdAt: -1, _id: -1 });
expenseSchema.index({ status: 1, expenseDate: -1 });
expenseSchema.index({ category: 1, status: 1, expenseDate: -1 });
expenseSchema.index({ status: 1, expenseDate: -1, _id: -1 });
expenseSchema.index({ payeeVendor: 1, status: 1, expenseDate: -1 });

expenseSchema.pre("validate", function (next) {
  this.title = String(this.title || "").trim();
  this.titleLower = this.title.toLowerCase();
  this.amount = roundMoney(this.amount);
  next();
});

expenseSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const nextTitle = update.$set?.title ?? update.title;
  if (nextTitle !== undefined) {
    const title = String(nextTitle || "").trim();
    update.$set = {
      ...(update.$set || {}),
      title,
      titleLower: title.toLowerCase(),
    };
    if (update.title !== undefined) delete update.title;
  }
  this.setUpdate(update);
  next();
});

export default mongoose.model("Expense", expenseSchema);
