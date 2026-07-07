import mongoose from "mongoose";

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const vendorBillPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0, set: roundMoney },
    paidAt: { type: Date, default: Date.now, index: true },
    cashAccount: { type: mongoose.Schema.Types.ObjectId, ref: "CashAccount", default: null, index: true },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    reference: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

const vendorBillSchema = new mongoose.Schema(
  {
    billNo: { type: String, trim: true, default: "", index: true },
    vendorName: { type: String, required: true, trim: true, index: true },
    vendorNameLower: { type: String, trim: true, default: "", index: true },
    expense: { type: mongoose.Schema.Types.ObjectId, ref: "Expense", default: null, index: true },
    expenseAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    payableAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    currency: { type: String, trim: true, default: "BDT", index: true },
    billDate: { type: Date, required: true, index: true },
    dueDate: { type: Date, default: null, index: true },
    subtotal: { type: Number, default: 0, min: 0, set: roundMoney },
    taxAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    total: { type: Number, required: true, min: 0, set: roundMoney },
    paidTotal: { type: Number, default: 0, min: 0, set: roundMoney },
    dueTotal: { type: Number, default: 0, min: 0, set: roundMoney, index: true },
    status: { type: String, enum: ["draft", "approved", "partially_paid", "paid", "void"], default: "draft", index: true },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry", default: null },
    payments: { type: [vendorBillPaymentSchema], default: [] },
    memo: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

vendorBillSchema.index({ billNo: 1 }, { unique: true, sparse: true });
vendorBillSchema.index({ status: 1, dueDate: 1, _id: -1 });
vendorBillSchema.index({ vendorNameLower: 1, status: 1, dueDate: 1 });
vendorBillSchema.index({ billDate: -1, _id: -1 });

vendorBillSchema.pre("validate", function (next) {
  this.vendorName = String(this.vendorName || "").trim();
  this.vendorNameLower = this.vendorName.toLowerCase();
  this.subtotal = roundMoney(this.subtotal || this.total);
  this.taxAmount = roundMoney(this.taxAmount);
  this.total = roundMoney(this.total || Number(this.subtotal || 0) + Number(this.taxAmount || 0));
  this.paidTotal = roundMoney((this.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
  this.dueTotal = roundMoney(Math.max(this.total - this.paidTotal, 0));
  if (this.status !== "void" && this.status !== "draft") {
    if (this.dueTotal <= 0 && this.total > 0) this.status = "paid";
    else if (this.paidTotal > 0) this.status = "partially_paid";
    else this.status = "approved";
  }
  if (!this.billNo) {
    const y = new Date(this.billDate || Date.now()).getFullYear();
    this.billNo = `BILL-${y}-${Date.now()}-${String(this._id).slice(-4).toUpperCase()}`;
  }
  next();
});

export default mongoose.model("VendorBill", vendorBillSchema);
