import mongoose from "mongoose";

export const SUPPLIER_TYPES = [
  "manufacturer",
  "wholesaler",
  "distributor",
  "importer",
  "service_provider",
  "contractor",
  "other",
];

export const SUPPLIER_SCOPES = ["local", "international", "both"];

export const SUPPLIER_STATUSES = [
  "draft",
  "pending_approval",
  "active",
  "on_hold",
  "inactive",
  "archived",
];

export const SUPPLIER_PRODUCT_STATUSES = [
  "active",
  "inactive",
  "archived",
];

export const ADDRESS_TYPES = [
  "office",
  "billing",
  "shipping",
  "factory",
  "warehouse",
  "other",
];

export const DOCUMENT_TYPES = [
  "trade_license",
  "tin_certificate",
  "bin_vat_certificate",
  "company_registration",
  "bank_document",
  "contract",
  "quality_certificate",
  "compliance_certificate",
  "other",
];

export const TAX_TREATMENTS = [
  "registered",
  "unregistered",
  "exempt",
  "non_resident",
];

export const PAYMENT_TERM_TYPES = [
  "immediate",
  "net_7",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
  "net_90",
  "custom",
];

const compactString = {
  type: String,
  trim: true,
  maxlength: 180,
  default: "",
};

const contactPersonSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    department: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 180,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    mobile: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    canReceivePurchaseOrders: {
      type: Boolean,
      default: true,
    },
    canReceivePaymentNotices: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { _id: true, id: false }
);

const addressSchema = new mongoose.Schema(
  {
    addressType: {
      type: String,
      enum: ADDRESS_TYPES,
      default: "office",
    },
    label: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    addressLine1: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    area: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "Bangladesh",
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true, id: false }
);

const bankAccountSchema = new mongoose.Schema(
  {
    bankName: compactString,
    branchName: compactString,
    accountName: compactString,
    accountNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    routingNumber: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    swiftCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
      default: "",
    },
    iban: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
      default: "",
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true, id: false }
);

const complianceDocumentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: DOCUMENT_TYPES,
      default: "other",
    },
    title: compactString,
    documentNo: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    url: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    issuedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { _id: true, id: false }
);

const taxSchema = new mongoose.Schema(
  {
    taxTreatment: {
      type: String,
      enum: TAX_TREATMENTS,
      default: "unregistered",
    },
    tradeLicenseNo: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    tin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    bin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    registrationNo: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
  },
  { _id: false, id: false }
);

const procurementSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },
    paymentTermType: {
      type: String,
      enum: PAYMENT_TERM_TYPES,
      default: "immediate",
    },
    paymentTermDays: {
      type: Number,
      min: 0,
      max: 3650,
      default: 0,
    },
    creditLimit: {
      type: Number,
      min: 0,
      default: 0,
    },
    minimumOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    leadTimeDays: {
      type: Number,
      min: 0,
      max: 3650,
      default: 0,
    },
    preferredShippingMethod: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    incoterm: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 40,
      default: "",
    },
  },
  { _id: false, id: false }
);

const performanceSchema = new mongoose.Schema(
  {
    orderCount: { type: Number, min: 0, default: 0 },
    completedOrderCount: { type: Number, min: 0, default: 0 },
    onTimeDeliveryRate: { type: Number, min: 0, max: 100, default: 0 },
    qualityAcceptanceRate: { type: Number, min: 0, max: 100, default: 0 },
    returnRate: { type: Number, min: 0, max: 100, default: 0 },
    averageLeadTimeDays: { type: Number, min: 0, default: 0 },
    priceRating: { type: Number, min: 0, max: 5, default: 0 },
    qualityRating: { type: Number, min: 0, max: 5, default: 0 },
    deliveryRating: { type: Number, min: 0, max: 5, default: 0 },
    overallRating: { type: Number, min: 0, max: 5, default: 0 },
    lastEvaluatedAt: { type: Date, default: null },
  },
  { _id: false, id: false }
);

const supplierSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      immutable: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    businessNameLower: {
      type: String,
      required: true,
      select: false,
    },
    legalName: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    supplierType: {
      type: String,
      enum: SUPPLIER_TYPES,
      default: "wholesaler",
    },
    supplierScope: {
      type: String,
      enum: SUPPLIER_SCOPES,
      default: "local",
    },
    isPreferred: {
      type: Boolean,
      default: false,
    },
    primaryEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 180,
      default: "",
    },
    primaryPhone: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    contactPersons: {
      type: [contactPersonSchema],
      default: [],
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    bankAccounts: {
      type: [bankAccountSchema],
      default: [],
      select: false,
    },
    documents: {
      type: [complianceDocumentSchema],
      default: [],
    },
    tax: {
      type: taxSchema,
      default: () => ({}),
    },
    procurement: {
      type: procurementSchema,
      default: () => ({}),
    },
    performance: {
      type: performanceSchema,
      default: () => ({}),
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    status: {
      type: String,
      enum: SUPPLIER_STATUSES,
      default: "draft",
      index: true,
    },
    onHoldReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    onHoldAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedFromStatus: {
      type: String,
      enum: [...SUPPLIER_STATUSES, ""],
      default: "",
      select: false,
    },
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
  {
    timestamps: true,
    versionKey: "recordVersion",
    optimisticConcurrency: true,
    minimize: true,
    id: false,
    toJSON: {
      virtuals: true,
      transform(_document, result) {
        delete result.businessNameLower;
        delete result.archivedFromStatus;
        return result;
      },
    },
    toObject: { virtuals: true },
  }
);

supplierSchema.pre("validate", function normalizeSupplier(next) {
  this.code = String(this.code || "").trim().toUpperCase();
  this.businessName = String(this.businessName || "").trim();
  this.businessNameLower = this.businessName.toLowerCase();
  this.primaryEmail = String(this.primaryEmail || "").trim().toLowerCase();
  this.primaryPhone = String(this.primaryPhone || "").trim();
  this.tags = [
    ...new Set(
      (this.tags || [])
        .map((tag) => String(tag || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ].slice(0, 20);

  const ensureSinglePrimary = (items = []) => {
    const primaryIndex = items.findIndex((item) => item.isPrimary);
    if (primaryIndex < 0 && items.length) items[0].isPrimary = true;
    items.forEach((item, index) => {
      item.isPrimary = index === (primaryIndex < 0 ? 0 : primaryIndex);
    });
  };

  ensureSinglePrimary(this.contactPersons);
  ensureSinglePrimary(this.addresses);
  ensureSinglePrimary(this.bankAccounts);

  next();
});

supplierSchema.virtual("primaryContact").get(function getPrimaryContact() {
  return this.contactPersons?.find((item) => item.isPrimary) || null;
});

supplierSchema.virtual("primaryAddress").get(function getPrimaryAddress() {
  return this.addresses?.find((item) => item.isPrimary) || null;
});

supplierSchema.index({ code: 1 }, { unique: true });
supplierSchema.index({ businessNameLower: 1, _id: 1 });
supplierSchema.index({ status: 1, businessNameLower: 1, _id: 1 });
supplierSchema.index({ status: 1, supplierType: 1, supplierScope: 1, updatedAt: -1 });
supplierSchema.index({ "procurement.currency": 1, status: 1, businessNameLower: 1 });
supplierSchema.index({ primaryEmail: 1 });
supplierSchema.index({ primaryPhone: 1 });
supplierSchema.index({ "tax.tin": 1 });
supplierSchema.index({ "tax.bin": 1 });
supplierSchema.index({ "tax.tradeLicenseNo": 1 });
supplierSchema.index({ tags: 1, status: 1 });
supplierSchema.index({ archivedAt: 1 }, { sparse: true });

const supplierProductSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    purchaseUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryUnit",
      default: null,
    },
    supplierSku: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 120,
      default: "",
    },
    supplierProductName: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },
    unitPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 12,
      default: "BDT",
    },
    minimumOrderQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    packSize: {
      type: Number,
      min: 0,
      default: 1,
    },
    leadTimeDays: {
      type: Number,
      min: 0,
      max: 3650,
      default: 0,
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    validFrom: {
      type: Date,
      default: null,
    },
    validTo: {
      type: Date,
      default: null,
    },
    isPreferred: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: SUPPLIER_PRODUCT_STATUSES,
      default: "active",
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBySupplier: {
      type: Boolean,
      default: false,
      select: false,
    },
    previousStatus: {
      type: String,
      enum: [...SUPPLIER_PRODUCT_STATUSES, ""],
      default: "",
      select: false,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
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
  {
    timestamps: true,
    versionKey: "recordVersion",
    optimisticConcurrency: true,
    id: false,
  }
);

supplierProductSchema.pre("validate", function normalizeSupplierProduct(next) {
  this.supplierSku = String(this.supplierSku || "").trim().toUpperCase();
  this.currency = String(this.currency || "BDT").trim().toUpperCase();
  next();
});

supplierProductSchema.index({ supplier: 1, product: 1 }, { unique: true });
supplierProductSchema.index({ supplier: 1, status: 1, _id: 1 });
supplierProductSchema.index({ product: 1, status: 1, unitPrice: 1 });
supplierProductSchema.index(
  { product: 1, isPreferred: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isPreferred: true,
      status: "active",
    },
  }
);
supplierProductSchema.index({ validFrom: 1, validTo: 1, status: 1 });

const supplierAuditSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    supplierProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupplierProduct",
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    requestId: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    id: false,
  }
);

supplierAuditSchema.index({ supplier: 1, createdAt: -1, _id: -1 });
supplierAuditSchema.index({ supplierProduct: 1, createdAt: -1 });

export const Supplier =
  mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);

export const SupplierProduct =
  mongoose.models.SupplierProduct ||
  mongoose.model("SupplierProduct", supplierProductSchema);

export const SupplierAudit =
  mongoose.models.SupplierAudit ||
  mongoose.model("SupplierAudit", supplierAuditSchema);

export default Supplier;
