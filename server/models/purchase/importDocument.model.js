import mongoose from "mongoose";

export const IMPORT_DOCUMENT_TYPES = [
  "proforma_invoice",
  "commercial_invoice",
  "packing_list",
  "bill_of_lading",
  "airway_bill",
  "certificate_of_origin",
  "insurance",
  "lc_copy",
  "lc_amendment",
  "customs_declaration",
  "bill_of_entry",
  "assessment_notice",
  "duty_tax_receipt",
  "cnf_document",
  "inspection_certificate",
  "other",
];

const clean = (value) => String(value ?? "").trim();

const importDocumentSchema = new mongoose.Schema(
  {
    commercialLC: { type: mongoose.Schema.Types.ObjectId, ref: "CommercialLC", required: true, index: true },
    importShipment: { type: mongoose.Schema.Types.ObjectId, ref: "ImportShipment", default: null, index: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    documentType: { type: String, enum: IMPORT_DOCUMENT_TYPES, required: true, index: true },
    documentNo: { type: String, trim: true, uppercase: true, maxlength: 180, default: "" },
    title: { type: String, trim: true, maxlength: 240, default: "" },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    issuer: { type: String, trim: true, maxlength: 180, default: "" },
    fileName: { type: String, trim: true, maxlength: 250, default: "" },
    fileUrl: { type: String, trim: true, maxlength: 2000, default: "" },
    mimeType: { type: String, trim: true, maxlength: 120, default: "" },
    fileSize: { type: Number, min: 0, default: 0 },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    storageProvider: { type: String, enum: ["cloudinary", "r2", "external"], default: "external", index: true },
    storageKey: { type: String, trim: true, maxlength: 500, default: "" },
    originalName: { type: String, trim: true, maxlength: 250, default: "" },
    storedName: { type: String, trim: true, maxlength: 300, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, optimisticConcurrency: true }
);

importDocumentSchema.index({ commercialLC: 1, documentType: 1, createdAt: -1 });
importDocumentSchema.index({ importShipment: 1, documentType: 1, createdAt: -1 });
importDocumentSchema.index(
  { commercialLC: 1, documentType: 1, documentNo: 1 },
  { unique: true, partialFilterExpression: { documentNo: { $type: "string", $gt: "" } } }
);

importDocumentSchema.pre("validate", function () {
  this.documentType = clean(this.documentType).toLowerCase();
  this.documentNo = clean(this.documentNo).toUpperCase();
  this.title = clean(this.title);
  this.fileName = clean(this.fileName);
  this.fileUrl = clean(this.fileUrl);
  this.mimeType = clean(this.mimeType);
  if (this.expiryDate && this.issueDate && new Date(this.expiryDate) < new Date(this.issueDate)) {
    this.invalidate("expiryDate", "Document expiry date cannot be before its issue date.");
  }
});

export default mongoose.model("ImportDocument", importDocumentSchema);
