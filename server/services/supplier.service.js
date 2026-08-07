import mongoose from "mongoose";
import Supplier, {
  ADDRESS_TYPES,
  DOCUMENT_TYPES,
  PAYMENT_TERM_TYPES,
  SupplierAudit,
  SupplierProduct,
  SUPPLIER_PRODUCT_STATUSES,
  SUPPLIER_SCOPES,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  TAX_TREATMENTS,
} from "../models/supplier.model.js";
import { runMongoTransaction } from "../utils/mongoTransaction.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\//i;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const CACHE_MAX_ENTRIES = 250;
const OPTIONS_CACHE_MS = 60_000;
const SUMMARY_CACHE_MS = 30_000;

const SUPPLIER_LIST_FIELDS = [
  "code",
  "businessName",
  "+businessNameLower",
  "legalName",
  "supplierType",
  "supplierScope",
  "isPreferred",
  "primaryEmail",
  "primaryPhone",
  "website",
  "contactPersons",
  "addresses",
  "tax",
  "procurement",
  "performance",
  "tags",
  "status",
  "onHoldReason",
  "submittedAt",
  "approvedAt",
  "rejectedAt",
  "rejectionReason",
  "archivedAt",
  "createdAt",
  "updatedAt",
].join(" ");

const SUPPLIER_OPTION_FIELDS = [
  "code",
  "businessName",
  "+businessNameLower",
  "supplierType",
  "supplierScope",
  "primaryEmail",
  "primaryPhone",
  "procurement.currency",
  "procurement.paymentTermType",
  "procurement.paymentTermDays",
  "isPreferred",
  "status",
].join(" ");

const SUPPLIER_PRODUCT_LIST_FIELDS = [
  "supplier",
  "product",
  "purchaseUnit",
  "supplierSku",
  "supplierProductName",
  "unitPrice",
  "currency",
  "minimumOrderQuantity",
  "packSize",
  "leadTimeDays",
  "discountPercent",
  "taxRate",
  "validFrom",
  "validTo",
  "isPreferred",
  "status",
  "archivedAt",
  "notes",
  "createdAt",
  "updatedAt",
].join(" ");

class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

class TtlCache {
  constructor(maxEntries = CACHE_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    const value = this.store.get(key);
    if (!value) return null;

    if (Date.now() >= value.expiresAt) {
      this.store.delete(key);
      return null;
    }

    this.store.delete(key);
    this.store.set(key, value);
    return value.data;
  }

  set(key, data, ttlMs) {
    if (this.store.has(key)) this.store.delete(key);

    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear() {
    this.store.clear();
  }
}

const readCache = new TtlCache();

const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const upper = (value) => clean(value).toUpperCase();
const asBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
};
const asNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);
const isId = (value) => OBJECT_ID_PATTERN.test(clean(value));
const toId = (value) => new mongoose.Types.ObjectId(value);
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseLimit = (value, defaultValue, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, maximum);
};

const encodeCursor = (supplier) =>
  Buffer.from(
    JSON.stringify({
      n: supplier.businessNameLower,
      i: String(supplier._id),
    })
  ).toString("base64url");

const decodeCursor = (value) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    );

    if (!clean(parsed.n) || !isId(parsed.i)) return null;

    return {
      name: parsed.n,
      id: toId(parsed.i),
    };
  } catch {
    return null;
  }
};

const encodeAuditCursor = (audit) =>
  Buffer.from(
    JSON.stringify({
      d: new Date(audit.createdAt).toISOString(),
      i: String(audit._id),
    })
  ).toString("base64url");

const decodeAuditCursor = (value) => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    );
    const date = new Date(parsed.d);

    if (Number.isNaN(date.getTime()) || !isId(parsed.i)) return null;

    return {
      createdAt: date,
      id: toId(parsed.i),
    };
  } catch {
    return null;
  }
};

const assertId = (value, label = "ID") => {
  if (!isId(value)) {
    throw new HttpError(400, `${label} is invalid.`);
  }
};

const assertEnum = (value, allowed, label) => {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `${label} has an invalid value.`);
  }
};

const normalizePrimary = (items = []) => {
  if (!Array.isArray(items)) return [];

  const firstPrimary = items.findIndex((item) => asBoolean(item?.isPrimary));
  const selectedIndex = firstPrimary >= 0 ? firstPrimary : items.length ? 0 : -1;

  return items.map((item, index) => ({
    ...item,
    isPrimary: index === selectedIndex,
  }));
};

const normalizeContacts = (items) =>
  normalizePrimary(
    (Array.isArray(items) ? items : []).slice(0, 10).map((item) => ({
      _id: isId(item?._id) ? item._id : undefined,
      name: clean(item?.name),
      designation: clean(item?.designation),
      department: clean(item?.department),
      email: lower(item?.email),
      phone: clean(item?.phone),
      mobile: clean(item?.mobile),
      isPrimary: asBoolean(item?.isPrimary),
      canReceivePurchaseOrders: asBoolean(
        item?.canReceivePurchaseOrders,
        true
      ),
      canReceivePaymentNotices: asBoolean(
        item?.canReceivePaymentNotices,
        false
      ),
      notes: clean(item?.notes),
    }))
  );

const normalizeAddresses = (items) =>
  normalizePrimary(
    (Array.isArray(items) ? items : []).slice(0, 10).map((item) => ({
      _id: isId(item?._id) ? item._id : undefined,
      addressType: ADDRESS_TYPES.includes(item?.addressType)
        ? item.addressType
        : "office",
      label: clean(item?.label),
      addressLine1: clean(item?.addressLine1),
      addressLine2: clean(item?.addressLine2),
      area: clean(item?.area),
      city: clean(item?.city),
      state: clean(item?.state),
      postalCode: clean(item?.postalCode),
      country: clean(item?.country) || "Bangladesh",
      isPrimary: asBoolean(item?.isPrimary),
    }))
  );

const normalizeBanks = (items) =>
  normalizePrimary(
    (Array.isArray(items) ? items : []).slice(0, 10).map((item) => ({
      _id: isId(item?._id) ? item._id : undefined,
      bankName: clean(item?.bankName),
      branchName: clean(item?.branchName),
      accountName: clean(item?.accountName),
      accountNumber: clean(item?.accountNumber),
      routingNumber: clean(item?.routingNumber),
      swiftCode: upper(item?.swiftCode),
      iban: upper(item?.iban),
      currency: upper(item?.currency) || "BDT",
      isPrimary: asBoolean(item?.isPrimary),
      isActive: asBoolean(item?.isActive, true),
    }))
  );

const normalizeDocuments = (items) =>
  (Array.isArray(items) ? items : []).slice(0, 30).map((item) => ({
    _id: isId(item?._id) ? item._id : undefined,
    documentType: DOCUMENT_TYPES.includes(item?.documentType)
      ? item.documentType
      : "other",
    title: clean(item?.title),
    documentNo: upper(item?.documentNo),
    url: clean(item?.url),
    issuedAt: asDate(item?.issuedAt),
    expiresAt: asDate(item?.expiresAt),
    isActive: asBoolean(item?.isActive, true),
    notes: clean(item?.notes),
  }));

const normalizeTags = (items) => [
  ...new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => lower(item))
      .filter(Boolean)
  ),
].slice(0, 20);

const buildSupplierPayload = (body = {}, { partial = false } = {}) => {
  const payload = {};

  const assign = (key, value) => {
    if (!partial || hasOwn(body, key)) payload[key] = value;
  };

  assign("code", upper(body.code));
  assign("businessName", clean(body.businessName));
  assign("legalName", clean(body.legalName));
  assign("supplierType", lower(body.supplierType) || "wholesaler");
  assign("supplierScope", lower(body.supplierScope) || "local");
  assign("isPreferred", asBoolean(body.isPreferred));
  assign("primaryEmail", lower(body.primaryEmail));
  assign("primaryPhone", clean(body.primaryPhone));
  assign("website", clean(body.website));
  assign("contactPersons", normalizeContacts(body.contactPersons));
  assign("addresses", normalizeAddresses(body.addresses));
  assign("bankAccounts", normalizeBanks(body.bankAccounts));
  assign("documents", normalizeDocuments(body.documents));
  assign("tags", normalizeTags(body.tags));
  assign("notes", clean(body.notes));

  if (!partial || hasOwn(body, "tax")) {
    const tax = body.tax || {};
    payload.tax = {
      taxTreatment: TAX_TREATMENTS.includes(tax.taxTreatment)
        ? tax.taxTreatment
        : "unregistered",
      tradeLicenseNo: upper(tax.tradeLicenseNo),
      tin: upper(tax.tin),
      bin: upper(tax.bin),
      registrationNo: upper(tax.registrationNo),
    };
  }

  if (!partial || hasOwn(body, "procurement")) {
    const procurement = body.procurement || {};
    payload.procurement = {
      currency: upper(procurement.currency) || "BDT",
      paymentTermType: PAYMENT_TERM_TYPES.includes(
        procurement.paymentTermType
      )
        ? procurement.paymentTermType
        : "immediate",
      paymentTermDays: asNumber(procurement.paymentTermDays, 0),
      creditLimit: asNumber(procurement.creditLimit, 0),
      minimumOrderValue: asNumber(procurement.minimumOrderValue, 0),
      leadTimeDays: asNumber(procurement.leadTimeDays, 0),
      preferredShippingMethod: clean(
        procurement.preferredShippingMethod
      ),
      incoterm: upper(procurement.incoterm),
    };
  }

  return payload;
};

const validateSupplierPayload = (payload, { partial = false } = {}) => {
  const errors = [];

  if ((!partial || payload.code !== undefined) && !clean(payload.code)) {
    errors.push("Supplier code is required.");
  }

  if (
    (!partial || payload.businessName !== undefined) &&
    !clean(payload.businessName)
  ) {
    errors.push("Supplier business name is required.");
  }

  if (
    payload.supplierType !== undefined &&
    !SUPPLIER_TYPES.includes(payload.supplierType)
  ) {
    errors.push("Supplier type is invalid.");
  }

  if (
    payload.supplierScope !== undefined &&
    !SUPPLIER_SCOPES.includes(payload.supplierScope)
  ) {
    errors.push("Supplier scope is invalid.");
  }

  if (payload.primaryEmail && !EMAIL_PATTERN.test(payload.primaryEmail)) {
    errors.push("Primary email is invalid.");
  }

  if (payload.website && !URL_PATTERN.test(payload.website)) {
    errors.push("Website must start with http:// or https://.");
  }

  for (const [index, contact] of (payload.contactPersons || []).entries()) {
    if (!clean(contact.name)) {
      errors.push(`Contact ${index + 1} name is required.`);
    }

    if (contact.email && !EMAIL_PATTERN.test(contact.email)) {
      errors.push(`Contact ${index + 1} email is invalid.`);
    }

    if (
      clean(contact.name) &&
      !clean(contact.email) &&
      !clean(contact.phone) &&
      !clean(contact.mobile)
    ) {
      errors.push(
        `Contact ${index + 1} requires an email, phone, or mobile number.`
      );
    }
  }

  for (const [index, document] of (payload.documents || []).entries()) {
    if (document.url && !URL_PATTERN.test(document.url)) {
      errors.push(
        `Document ${index + 1} URL must start with http:// or https://.`
      );
    }

    if (
      document.issuedAt &&
      document.expiresAt &&
      document.expiresAt < document.issuedAt
    ) {
      errors.push(
        `Document ${index + 1} expiry date cannot be before its issue date.`
      );
    }
  }

  for (const [index, bank] of (payload.bankAccounts || []).entries()) {
    const hasAnyValue = [
      bank.bankName,
      bank.accountName,
      bank.accountNumber,
    ].some(Boolean);

    if (
      hasAnyValue &&
      (!bank.bankName || !bank.accountName || !bank.accountNumber)
    ) {
      errors.push(
        `Bank account ${index + 1} requires bank name, account name, and account number.`
      );
    }
  }

  if (payload.procurement) {
    const procurement = payload.procurement;

    for (const [label, value] of [
      ["Payment term days", procurement.paymentTermDays],
      ["Credit limit", procurement.creditLimit],
      ["Minimum order value", procurement.minimumOrderValue],
      ["Lead time days", procurement.leadTimeDays],
    ]) {
      if (!Number.isFinite(value) || value < 0) {
        errors.push(`${label} must be a valid non-negative number.`);
      }
    }

    if (
      !Number.isInteger(procurement.paymentTermDays) ||
      procurement.paymentTermDays > 3650
    ) {
      errors.push(
        "Payment term days must be a whole number between 0 and 3650."
      );
    }

    if (
      !Number.isInteger(procurement.leadTimeDays) ||
      procurement.leadTimeDays > 3650
    ) {
      errors.push(
        "Lead time days must be a whole number between 0 and 3650."
      );
    }

    if (
      procurement.paymentTermType === "custom" &&
      procurement.paymentTermDays <= 0
    ) {
      errors.push(
        "Custom payment terms require payment term days greater than zero."
      );
    }
  }

  return errors;
};

const validateForSubmission = (supplier) => {
  const errors = [];
  const primaryContact = supplier.contactPersons?.find(
    (item) => item.isPrimary
  );
  const primaryAddress = supplier.addresses?.find(
    (item) => item.isPrimary
  );

  if (!clean(supplier.code)) errors.push("Supplier code is required.");
  if (!clean(supplier.businessName)) {
    errors.push("Supplier business name is required.");
  }

  if (!primaryContact) {
    errors.push("A primary supplier contact is required.");
  } else if (
    !clean(primaryContact.email) &&
    !clean(primaryContact.phone) &&
    !clean(primaryContact.mobile)
  ) {
    errors.push(
      "The primary supplier contact requires an email, phone, or mobile number."
    );
  }

  if (!primaryAddress) {
    errors.push("A primary supplier address is required.");
  } else {
    if (!clean(primaryAddress.addressLine1)) {
      errors.push("The primary address requires address line 1.");
    }
    if (!clean(primaryAddress.city)) {
      errors.push("The primary address requires a city.");
    }
    if (!clean(primaryAddress.country)) {
      errors.push("The primary address requires a country.");
    }
  }

  if (
    supplier.tax?.taxTreatment === "registered" &&
    !clean(supplier.tax?.tin) &&
    !clean(supplier.tax?.bin)
  ) {
    errors.push("A registered supplier requires a TIN or BIN/VAT number.");
  }

  return errors;
};

const buildSupplierProductPayload = (body = {}, { partial = false } = {}) => {
  const payload = {};
  const assign = (key, value) => {
    if (!partial || hasOwn(body, key)) payload[key] = value;
  };

  assign("product", clean(body.product));
  assign("purchaseUnit", clean(body.purchaseUnit) || null);
  assign("supplierSku", upper(body.supplierSku));
  assign("supplierProductName", clean(body.supplierProductName));
  assign("unitPrice", asNumber(body.unitPrice, 0));
  assign("currency", upper(body.currency) || "BDT");
  assign(
    "minimumOrderQuantity",
    asNumber(body.minimumOrderQuantity, 0)
  );
  assign("packSize", asNumber(body.packSize, 1));
  assign("leadTimeDays", asNumber(body.leadTimeDays, 0));
  assign("discountPercent", asNumber(body.discountPercent, 0));
  assign("taxRate", asNumber(body.taxRate, 0));
  assign("validFrom", asDate(body.validFrom));
  assign("validTo", asDate(body.validTo));
  assign("isPreferred", asBoolean(body.isPreferred));
  assign(
    "status",
    SUPPLIER_PRODUCT_STATUSES.includes(body.status)
      ? body.status
      : "active"
  );
  assign("notes", clean(body.notes));

  return payload;
};

const validateSupplierProductPayload = (
  payload,
  { partial = false } = {}
) => {
  const errors = [];

  if ((!partial || payload.product !== undefined) && !isId(payload.product)) {
    errors.push("A valid product ID is required.");
  }

  if (payload.purchaseUnit && !isId(payload.purchaseUnit)) {
    errors.push("Purchase unit ID is invalid.");
  }

  for (const [label, value] of [
    ["Unit price", payload.unitPrice],
    ["Minimum order quantity", payload.minimumOrderQuantity],
    ["Pack size", payload.packSize],
    ["Lead time days", payload.leadTimeDays],
    ["Discount percent", payload.discountPercent],
    ["Tax rate", payload.taxRate],
  ]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      errors.push(`${label} must be a valid non-negative number.`);
    }
  }

  if (payload.packSize !== undefined && payload.packSize <= 0) {
    errors.push("Pack size must be greater than zero.");
  }

  if (
    payload.leadTimeDays !== undefined &&
    (!Number.isInteger(payload.leadTimeDays) || payload.leadTimeDays > 3650)
  ) {
    errors.push("Lead time days must be a whole number from 0 to 3650.");
  }

  for (const [label, value] of [
    ["Discount percent", payload.discountPercent],
    ["Tax rate", payload.taxRate],
  ]) {
    if (value !== undefined && value > 100) {
      errors.push(`${label} cannot exceed 100.`);
    }
  }

  if (
    payload.validFrom &&
    payload.validTo &&
    payload.validTo < payload.validFrom
  ) {
    errors.push("Valid-to date cannot be before valid-from date.");
  }

  if (
    payload.status !== undefined &&
    !SUPPLIER_PRODUCT_STATUSES.includes(payload.status)
  ) {
    errors.push("Supplier-product status is invalid.");
  }

  return errors;
};

const throwValidation = (errors) => {
  if (errors.length) {
    const error = new HttpError(400, errors[0]);
    error.errors = errors;
    throw error;
  }
};

const assertProductAndUnit = async (payload = {}) => {
  const ProductModel = mongoose.models.Product;
  const UnitModel = mongoose.models.InventoryUnit;

  if (payload.product && ProductModel) {
    const product = await ProductModel.exists({
      _id: payload.product,
      status: { $ne: "archived" },
    });

    if (!product) {
      throw new HttpError(404, "The selected product was not found or is archived.");
    }
  }

  if (payload.purchaseUnit && UnitModel) {
    const unit = await UnitModel.exists({
      _id: payload.purchaseUnit,
      status: { $ne: "archived" },
    });

    if (!unit) {
      throw new HttpError(404, "The selected purchase unit was not found or is archived.");
    }
  }
};

const supplierAuditSnapshot = (supplier = {}) => {
  const value =
    typeof supplier.toObject === "function"
      ? supplier.toObject()
      : { ...supplier };

  const bankAccountCount = Array.isArray(value.bankAccounts)
    ? value.bankAccounts.length
    : 0;

  delete value.bankAccounts;
  delete value.businessNameLower;
  delete value.archivedFromStatus;

  return {
    ...value,
    bankAccountCount,
  };
};

const normalizeAuditValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value?._bsontype === "ObjectId") return String(value);
  if (Array.isArray(value)) return value.map(normalizeAuditValue);

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        normalizeAuditValue(nested),
      ])
    );
  }

  return value;
};

const pickChanges = (before, after, fields) => {
  const changes = {};

  for (const field of fields) {
    const oldValue = field
      .split(".")
      .reduce((value, part) => value?.[part], before);
    const newValue = field
      .split(".")
      .reduce((value, part) => value?.[part], after);

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[field] = {
        before: normalizeAuditValue(oldValue),
        after: normalizeAuditValue(newValue),
      };
    }
  }

  return changes;
};

const writeAudit = async ({
  supplierId,
  supplierProductId = null,
  action,
  actorId = null,
  meta = {},
  changes = null,
  note = "",
}) => {
  try {
    await SupplierAudit.create({
      supplier: supplierId,
      supplierProduct: supplierProductId,
      action,
      actor: actorId,
      requestId: clean(meta.requestId),
      ip: clean(meta.ip),
      userAgent: clean(meta.userAgent),
      changes,
      note: clean(note),
    });
  } catch (error) {
    console.error("Supplier audit write failed:", error.message);
  }
};

const runAtomic = runMongoTransaction;

const sessionOption = (session) => (session ? { session } : {});

const invalidateReadCache = () => readCache.clear();

const assertSupplier = (supplier, { allowArchived = false } = {}) => {
  if (!supplier) throw new HttpError(404, "Supplier not found.");

  if (!allowArchived && supplier.status === "archived") {
    throw new HttpError(
      409,
      "Restore the archived supplier before changing it."
    );
  }
};

const syncInventoryDefaultSupplier = async ({
  productId,
  supplierId,
  isPreferred,
  actorId = null,
  session = null,
}) => {
  const ProductModel = mongoose.models.Product;

  if (!ProductModel || !productId || !supplierId) return;

  const filter = { _id: productId };
  const update = isPreferred
    ? {
        $set: {
          defaultSupplier: supplierId,
          updatedBy: actorId,
        },
      }
    : {
        $set: {
          defaultSupplier: null,
          updatedBy: actorId,
        },
      };

  if (!isPreferred) {
    filter.defaultSupplier = supplierId;
  }

  const query = ProductModel.updateOne(filter, update);
  if (session) query.session(session);
  await query;
};

const clearSupplierFromInventoryProducts = async ({
  supplierId,
  actorId = null,
  session = null,
}) => {
  const ProductModel = mongoose.models.Product;

  if (!ProductModel || !supplierId) return;

  const query = ProductModel.updateMany(
    { defaultSupplier: supplierId },
    {
      $set: {
        defaultSupplier: null,
        updatedBy: actorId,
      },
    }
  );

  if (session) query.session(session);
  await query;
};

const buildSupplierFilter = (query = {}, { options = false } = {}) => {
  const filter = {};

  if (options) {
    filter.status = String(query.includeUnavailable) === "true"
      ? { $ne: "archived" }
      : "active";
  } else if (query.status && query.status !== "all") {
    const status = lower(query.status);
    assertEnum(status, SUPPLIER_STATUSES, "Supplier status");
    filter.status = status;
  } else {
    filter.status = { $ne: "archived" };
  }

  if (query.supplierType && query.supplierType !== "all") {
    const supplierType = lower(query.supplierType);
    assertEnum(supplierType, SUPPLIER_TYPES, "Supplier type");
    filter.supplierType = supplierType;
  }

  if (query.supplierScope && query.supplierScope !== "all") {
    const supplierScope = lower(query.supplierScope);
    assertEnum(supplierScope, SUPPLIER_SCOPES, "Supplier scope");
    filter.supplierScope = supplierScope;
  }

  if (query.currency && query.currency !== "all") {
    filter["procurement.currency"] = upper(query.currency);
  }

  if (query.isPreferred !== undefined && query.isPreferred !== "all") {
    filter.isPreferred = asBoolean(query.isPreferred);
  }

  if (clean(query.tag)) {
    filter.tags = lower(query.tag);
  }

  if (query.updatedFrom || query.updatedTo) {
    filter.updatedAt = {};

    if (query.updatedFrom) {
      const from = asDate(query.updatedFrom);
      if (!from) throw new HttpError(400, "updatedFrom date is invalid.");
      filter.updatedAt.$gte = from;
    }

    if (query.updatedTo) {
      const to = asDate(query.updatedTo);
      if (!to) throw new HttpError(400, "updatedTo date is invalid.");
      filter.updatedAt.$lte = to;
    }
  }

  const q = clean(query.q);

  if (q) {
    const namePrefix = new RegExp(`^${escapeRegex(q.toLowerCase())}`);
    const codePrefix = new RegExp(`^${escapeRegex(q.toUpperCase())}`);
    const rawPrefix = new RegExp(`^${escapeRegex(q)}`);

    filter.$or = [
      { businessNameLower: namePrefix },
      { code: codePrefix },
      { primaryEmail: namePrefix },
      { primaryPhone: rawPrefix },
      { "tax.tin": codePrefix },
      { "tax.bin": codePrefix },
      { "tax.tradeLicenseNo": codePrefix },
    ];
  }

  return filter;
};

const buildSupplierProductFilter = (query = {}) => {
  const filter = {};

  if (query.status && query.status !== "all") {
    const status = lower(query.status);
    assertEnum(status, SUPPLIER_PRODUCT_STATUSES, "Product-link status");
    filter.status = status;
  } else {
    filter.status = { $ne: "archived" };
  }

  if (query.product) {
    assertId(query.product, "Product ID");
    filter.product = toId(query.product);
  }

  if (query.currency && query.currency !== "all") {
    filter.currency = upper(query.currency);
  }

  if (query.isPreferred !== undefined && query.isPreferred !== "all") {
    filter.isPreferred = asBoolean(query.isPreferred);
  }

  const activeOn = asDate(query.activeOn);

  if (query.activeOn && !activeOn) {
    throw new HttpError(400, "activeOn date is invalid.");
  }

  if (activeOn) {
    filter.$and = [
      { $or: [{ validFrom: null }, { validFrom: { $lte: activeOn } }] },
      { $or: [{ validTo: null }, { validTo: { $gte: activeOn } }] },
    ];
  }

  return filter;
};

const populateSupplierProduct = (query) =>
  query
    .populate(
      "product",
      "name sku barcode productType baseUnit status purchasePrice currency trackInventory"
    )
    .populate(
      "purchaseUnit",
      "name code symbol unitType decimalAllowed decimalPrecision status"
    );

export const supplierReferenceData = {
  supplierTypes: SUPPLIER_TYPES,
  supplierScopes: SUPPLIER_SCOPES,
  supplierStatuses: SUPPLIER_STATUSES,
  supplierProductStatuses: SUPPLIER_PRODUCT_STATUSES,
  addressTypes: ADDRESS_TYPES,
  documentTypes: DOCUMENT_TYPES,
  taxTreatments: TAX_TREATMENTS,
  paymentTermTypes: PAYMENT_TERM_TYPES,
  permissions: {
    view: "supplier:view",
    manage: "supplier:manage",
    approve: "supplier:approve",
    delete: "supplier:delete",
  },
};

export const listSuppliersService = async (query = {}) => {
  const limit = parseLimit(query.limit, 30, 100);
  const cursor = decodeCursor(query.cursor);

  if (query.cursor && !cursor) {
    throw new HttpError(400, "Invalid supplier pagination cursor.");
  }

  const filter = buildSupplierFilter(query);

  if (cursor) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { businessNameLower: { $gt: cursor.name } },
          {
            businessNameLower: cursor.name,
            _id: { $gt: cursor.id },
          },
        ],
      },
    ];
  }

  const suppliers = await Supplier.find(filter)
    .select(SUPPLIER_LIST_FIELDS)
    .sort({ businessNameLower: 1, _id: 1 })
    .limit(limit + 1)
    .maxTimeMS(5000)
    .lean();

  const hasMore = suppliers.length > limit;
  if (hasMore) suppliers.pop();

  const nextCursor =
    hasMore && suppliers.length
      ? encodeCursor(suppliers[suppliers.length - 1])
      : null;

  return {
    count: suppliers.length,
    hasMore,
    nextCursor,
    suppliers: suppliers.map(({ businessNameLower, ...item }) => item),
  };
};

export const listSupplierOptionsService = async (query = {}) => {
  const limit = parseLimit(query.limit, 20, 200);
  const normalized = {
    tenantId: clean(query._verifiedTenantId),
    includeUnavailable: String(query.includeUnavailable) === "true",
    q: lower(query.q),
    supplierType: lower(query.supplierType),
    supplierScope: lower(query.supplierScope),
    currency: upper(query.currency),
    isPreferred: clean(query.isPreferred),
    limit,
  };
  const cacheKey = `options:${JSON.stringify(normalized)}`;
  const cached = readCache.get(cacheKey);
  if (cached) return cached;

  const suppliers = await Supplier.find(
    buildSupplierFilter(query, { options: true })
  )
    .select(SUPPLIER_OPTION_FIELDS)
    .sort({ isPreferred: -1, businessNameLower: 1, _id: 1 })
    .limit(limit)
    .maxTimeMS(3000)
    .lean();

  const result = {
    count: suppliers.length,
    suppliers: suppliers.map(({ businessNameLower, ...item }) => ({
      ...item,
      isSelectable: item.status === "active",
    })),
  };

  readCache.set(cacheKey, result, OPTIONS_CACHE_MS);
  return result;
};

export const getSupplierSummaryService = async (query = {}) => {
  const normalized = {
    status: lower(query.status),
    supplierType: lower(query.supplierType),
    supplierScope: lower(query.supplierScope),
    currency: upper(query.currency),
    isPreferred: clean(query.isPreferred),
    tag: lower(query.tag),
    q: lower(query.q),
    updatedFrom: clean(query.updatedFrom),
    updatedTo: clean(query.updatedTo),
  };
  const cacheKey = `summary:${JSON.stringify(normalized)}`;
  const cached = readCache.get(cacheKey);
  if (cached) return cached;

  const filter = buildSupplierFilter(query);

  if (!query.status || query.status === "all") {
    delete filter.status;
  }

  const [summary] = await Supplier.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        supplierCount: { $sum: 1 },
        draftCount: {
          $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
        },
        pendingApprovalCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "pending_approval"] }, 1, 0],
          },
        },
        activeCount: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
        },
        onHoldCount: {
          $sum: { $cond: [{ $eq: ["$status", "on_hold"] }, 1, 0] },
        },
        inactiveCount: {
          $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
        },
        archivedCount: {
          $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] },
        },
        preferredCount: {
          $sum: { $cond: ["$isPreferred", 1, 0] },
        },
        totalCreditLimit: {
          $sum: { $ifNull: ["$procurement.creditLimit", 0] },
        },
        averageRating: {
          $avg: { $ifNull: ["$performance.overallRating", 0] },
        },
      },
    },
    { $project: { _id: 0 } },
  ]).option({ maxTimeMS: 5000 });

  const result = {
    summary: summary || {
      supplierCount: 0,
      draftCount: 0,
      pendingApprovalCount: 0,
      activeCount: 0,
      onHoldCount: 0,
      inactiveCount: 0,
      archivedCount: 0,
      preferredCount: 0,
      totalCreditLimit: 0,
      averageRating: 0,
    },
  };

  readCache.set(cacheKey, result, SUMMARY_CACHE_MS);
  return result;
};

export const getSupplierService = async (
  id,
  { includeSensitive = false, includeStats = true } = {}
) => {
  assertId(id, "Supplier ID");

  let query = Supplier.findById(id)
    .select(includeSensitive ? "+bankAccounts" : "-bankAccounts")
    .populate("submittedBy", "name email")
    .populate("approvedBy", "name email")
    .populate("rejectedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .maxTimeMS(4000);

  const supplier = await query.lean({ virtuals: true });
  assertSupplier(supplier, { allowArchived: true });

  let stats = null;

  if (includeStats) {
    const [productStats] = await SupplierProduct.aggregate([
      { $match: { supplier: toId(id) } },
      {
        $group: {
          _id: null,
          productLinkCount: { $sum: 1 },
          activeProductLinkCount: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          inactiveProductLinkCount: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
          archivedProductLinkCount: {
            $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] },
          },
          preferredProductLinkCount: {
            $sum: { $cond: ["$isPreferred", 1, 0] },
          },
        },
      },
      { $project: { _id: 0 } },
    ]).option({ maxTimeMS: 4000 });

    stats = productStats || {
      productLinkCount: 0,
      activeProductLinkCount: 0,
      inactiveProductLinkCount: 0,
      archivedProductLinkCount: 0,
      preferredProductLinkCount: 0,
    };
  }

  return { supplier, stats };
};

export const lookupSupplierService = async (value) => {
  const lookup = clean(value);
  if (!lookup || lookup.length > 180) {
    throw new HttpError(400, "Supplier lookup value is invalid.");
  }

  const supplier = await Supplier.findOne({
    $or: [
      { code: lookup.toUpperCase() },
      { primaryEmail: lookup.toLowerCase() },
      { primaryPhone: lookup },
      { "tax.tin": lookup.toUpperCase() },
      { "tax.bin": lookup.toUpperCase() },
      { "tax.tradeLicenseNo": lookup.toUpperCase() },
    ],
  })
    .select(SUPPLIER_LIST_FIELDS)
    .maxTimeMS(3000)
    .lean();

  if (!supplier) throw new HttpError(404, "Supplier not found.");

  const { businessNameLower, ...safeSupplier } = supplier;
  return { supplier: safeSupplier };
};

export const createSupplierService = async ({
  body,
  actorId,
  meta,
}) => {
  const payload = buildSupplierPayload(body, { partial: false });
  throwValidation(validateSupplierPayload(payload));

  const supplier = await Supplier.create({
    ...payload,
    status: "draft",
    createdBy: actorId,
    updatedBy: actorId,
  });

  invalidateReadCache();

  await writeAudit({
    supplierId: supplier._id,
    action: "supplier_created",
    actorId,
    meta,
    changes: {
      supplier: { before: null, after: supplierAuditSnapshot(supplier) },
    },
  });

  return {
    message: "Supplier draft created.",
    supplier,
  };
};

export const updateSupplierService = async ({
  id,
  body,
  actorId,
  meta,
}) => {
  assertId(id, "Supplier ID");
  const payload = buildSupplierPayload(body, { partial: true });
  throwValidation(validateSupplierPayload(payload, { partial: true }));

  delete payload.status;
  delete payload.approvedAt;
  delete payload.approvedBy;
  delete payload.archivedAt;

  const supplier = await Supplier.findById(id).select("+bankAccounts");
  assertSupplier(supplier);

  if (payload.code !== undefined && payload.code !== supplier.code) {
    throw new HttpError(
      409,
      "Supplier code cannot be changed after creation."
    );
  }

  const before = supplier.toObject();

  Object.assign(supplier, payload, {
    updatedBy: actorId,
  });

  if (supplier.status === "pending_approval") {
    supplier.status = "draft";
    supplier.submittedAt = null;
    supplier.submittedBy = null;
  }

  if (supplier.status !== "active") {
    supplier.isPreferred = false;
  }

  await supplier.save();
  invalidateReadCache();

  await writeAudit({
    supplierId: supplier._id,
    action: "supplier_updated",
    actorId,
    meta,
    changes: {
      ...pickChanges(before, supplier.toObject(), [
      "businessName",
      "legalName",
      "supplierType",
      "supplierScope",
      "isPreferred",
      "primaryEmail",
      "primaryPhone",
      "website",
      "contactPersons",
      "addresses",
      "documents",
      "tax",
      "procurement",
      "tags",
      "notes",
      "status",
      ]),
      bankAccountCount: {
        before: Array.isArray(before.bankAccounts) ? before.bankAccounts.length : 0,
        after: Array.isArray(supplier.bankAccounts) ? supplier.bankAccounts.length : 0,
      },
    },
  });

  return {
    message: "Supplier updated.",
    supplier,
  };
};

export const submitSupplierService = async ({
  id,
  actorId,
  meta,
}) => {
  assertId(id, "Supplier ID");
  const supplier = await Supplier.findById(id).select("+bankAccounts");
  assertSupplier(supplier);

  if (supplier.status !== "draft") {
    throw new HttpError(409, "Only a draft supplier can be submitted.");
  }

  throwValidation(validateForSubmission(supplier.toObject()));

  supplier.status = "pending_approval";
  supplier.submittedAt = new Date();
  supplier.submittedBy = actorId;
  supplier.rejectedAt = null;
  supplier.rejectedBy = null;
  supplier.rejectionReason = "";
  supplier.updatedBy = actorId;
  await supplier.save();

  invalidateReadCache();
  await writeAudit({
    supplierId: supplier._id,
    action: "supplier_submitted",
    actorId,
    meta,
  });

  return {
    message: "Supplier submitted for approval.",
    supplier,
  };
};

export const approveSupplierService = async ({
  id,
  actorId,
  meta,
}) => {
  assertId(id, "Supplier ID");
  const supplier = await Supplier.findById(id).select("+bankAccounts");
  assertSupplier(supplier);

  if (supplier.status !== "pending_approval") {
    throw new HttpError(
      409,
      "Only a pending supplier can be approved."
    );
  }

  throwValidation(validateForSubmission(supplier.toObject()));

  supplier.status = "active";
  supplier.approvedAt = new Date();
  supplier.approvedBy = actorId;
  supplier.updatedBy = actorId;
  await supplier.save();

  invalidateReadCache();
  await writeAudit({
    supplierId: supplier._id,
    action: "supplier_approved",
    actorId,
    meta,
  });

  return {
    message: "Supplier approved and activated.",
    supplier,
  };
};

export const rejectSupplierService = async ({
  id,
  reason,
  actorId,
  meta,
}) => {
  assertId(id, "Supplier ID");
  const note = clean(reason);

  if (!note) throw new HttpError(400, "Rejection reason is required.");

  const supplier = await Supplier.findById(id).select("+bankAccounts");
  assertSupplier(supplier);

  if (supplier.status !== "pending_approval") {
    throw new HttpError(
      409,
      "Only a pending supplier can be rejected."
    );
  }

  supplier.status = "draft";
  supplier.rejectedAt = new Date();
  supplier.rejectedBy = actorId;
  supplier.rejectionReason = note;
  supplier.updatedBy = actorId;
  await supplier.save();

  invalidateReadCache();
  await writeAudit({
    supplierId: supplier._id,
    action: "supplier_rejected",
    actorId,
    meta,
    note,
  });

  return {
    message: "Supplier rejected and returned to draft.",
    supplier,
  };
};

export const updateSupplierStatusService = async ({
  id,
  status,
  reason,
  actorId,
  meta,
}) => {
  assertId(id, "Supplier ID");
  const normalizedStatus = lower(status);

  if (!['active', 'on_hold', 'inactive'].includes(normalizedStatus)) {
    throw new HttpError(
      400,
      "Status must be active, on_hold, or inactive."
    );
  }

  const note = clean(reason);
  if (normalizedStatus === "on_hold" && !note) {
    throw new HttpError(400, "A hold reason is required.");
  }

  const result = await runAtomic(async (session) => {
    const supplierQuery = Supplier.findById(id).select("+bankAccounts");
    if (session) supplierQuery.session(session);
    const supplier = await supplierQuery;
    assertSupplier(supplier);

    if (!supplier.approvedAt) {
      throw new HttpError(
        409,
        "Approve the supplier before changing its operational status."
      );
    }

    const previousStatus = supplier.status;

    supplier.status = normalizedStatus;
    supplier.isPreferred =
      normalizedStatus === "active" ? supplier.isPreferred : false;
    supplier.onHoldReason = normalizedStatus === "on_hold" ? note : "";
    supplier.onHoldAt =
      normalizedStatus === "on_hold" ? new Date() : null;
    supplier.updatedBy = actorId;
    await supplier.save(sessionOption(session));

    if (normalizedStatus !== "active") {
      await SupplierProduct.updateMany(
        { supplier: supplier._id, isPreferred: true },
        { $set: { isPreferred: false, updatedBy: actorId } },
        sessionOption(session)
      );

      await clearSupplierFromInventoryProducts({
        supplierId: supplier._id,
        actorId,
        session,
      });
    }

    return { supplier, previousStatus };
  });

  invalidateReadCache();
  await writeAudit({
    supplierId: result.supplier._id,
    action: "supplier_status_changed",
    actorId,
    meta,
    changes: {
      status: {
        before: result.previousStatus,
        after: normalizedStatus,
      },
    },
    note,
  });

  return {
    message: `Supplier marked as ${normalizedStatus.replace(/_/g, " ")}.`,
    supplier: result.supplier,
  };
};

export const archiveSupplierService = async ({
  id,
  actorId,
  meta,
}) => {
  assertId(id, "Supplier ID");

  const supplier = await runAtomic(async (session) => {
    const supplierQuery = Supplier.findById(id).select("+bankAccounts +archivedFromStatus");
    if (session) supplierQuery.session(session);
    const current = await supplierQuery;
    assertSupplier(current);

    current.archivedFromStatus = current.status;
    current.status = "archived";
    current.isPreferred = false;
    current.archivedAt = new Date();
    current.updatedBy = actorId;
    await current.save(sessionOption(session));

    await SupplierProduct.updateMany(
      {
        supplier: current._id,
        status: { $ne: "archived" },
      },
      [
        {
          $set: {
            previousStatus: "$status",
            status: "archived",
            isPreferred: false,
            archivedAt: new Date(),
            archivedBySupplier: true,
            updatedBy: actorId,
            updatedAt: new Date(),
          },
        },
      ],
      sessionOption(session)
    );

    await clearSupplierFromInventoryProducts({
      supplierId: current._id,
      actorId,
      session,
    });

    return current;
  });

  invalidateReadCache();
  await writeAudit({
    supplierId: supplier._id,
    action: "supplier_archived",
    actorId,
    meta,
  });

  return {
    message: "Supplier archived with its active product links.",
    supplier,
  };
};

export const restoreSupplierService = async ({
  id,
  actorId,
  meta,
}) => {
  assertId(id, "Supplier ID");

  const supplier = await runAtomic(async (session) => {
    const supplierQuery = Supplier.findById(id).select("+bankAccounts +archivedFromStatus");
    if (session) supplierQuery.session(session);
    const current = await supplierQuery;

    if (!current) throw new HttpError(404, "Supplier not found.");
    if (current.status !== "archived") {
      throw new HttpError(409, "Only an archived supplier can be restored.");
    }

    current.status = "inactive";
    current.archivedAt = null;
    current.archivedFromStatus = "";
    current.isPreferred = false;
    current.updatedBy = actorId;
    await current.save(sessionOption(session));

    await SupplierProduct.updateMany(
      {
        supplier: current._id,
        status: "archived",
        archivedBySupplier: true,
      },
      {
        $set: {
          status: "inactive",
          previousStatus: "",
          archivedAt: null,
          archivedBySupplier: false,
          isPreferred: false,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      },
      sessionOption(session)
    );

    return current;
  });

  invalidateReadCache();
  await writeAudit({
    supplierId: supplier._id,
    action: "supplier_restored",
    actorId,
    meta,
  });

  return {
    message: "Supplier restored as inactive.",
    supplier,
  };
};

export const listSupplierProductsService = async ({
  supplierId,
  query = {},
}) => {
  assertId(supplierId, "Supplier ID");

  const supplierExists = await Supplier.exists({ _id: supplierId });
  if (!supplierExists) throw new HttpError(404, "Supplier not found.");

  const limit = parseLimit(query.limit, 30, 100);
  let cursor = null;

  if (query.cursor) {
    if (!isId(query.cursor)) {
      throw new HttpError(400, "Invalid product-link cursor.");
    }
    cursor = toId(query.cursor);
  }

  const filter = {
    supplier: toId(supplierId),
    ...buildSupplierProductFilter(query),
  };

  if (cursor) filter._id = { $gt: cursor };

  const links = await populateSupplierProduct(
    SupplierProduct.find(filter)
      .select(SUPPLIER_PRODUCT_LIST_FIELDS)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .maxTimeMS(5000)
  ).lean();

  const hasMore = links.length > limit;
  if (hasMore) links.pop();

  return {
    count: links.length,
    hasMore,
    nextCursor:
      hasMore && links.length
        ? String(links[links.length - 1]._id)
        : null,
    supplierProducts: links,
  };
};

export const getSupplierProductService = async ({
  supplierId,
  linkId,
}) => {
  assertId(supplierId, "Supplier ID");
  assertId(linkId, "Supplier-product link ID");

  const link = await populateSupplierProduct(
    SupplierProduct.findOne({
      _id: linkId,
      supplier: supplierId,
    }).select("+archivedBySupplier +previousStatus")
  )
    .maxTimeMS(4000)
    .lean();

  if (!link) {
    throw new HttpError(404, "Supplier-product link not found.");
  }

  return { supplierProduct: link };
};

export const createSupplierProductService = async ({
  supplierId,
  body,
  actorId,
  meta,
}) => {
  assertId(supplierId, "Supplier ID");
  const payload = buildSupplierProductPayload(body, { partial: false });
  throwValidation(validateSupplierProductPayload(payload));

  const supplier = await Supplier.findById(supplierId)
    .select("status procurement.currency")
    .lean();
  assertSupplier(supplier);
  await assertProductAndUnit(payload);

  if (payload.status === "archived") {
    throw new HttpError(
      400,
      "Create the link as active or inactive."
    );
  }

  const link = await runAtomic(async (session) => {
    const effectiveStatus =
      supplier.status === "active" ? payload.status : "inactive";
    const effectivePreferred =
      supplier.status === "active" &&
      effectiveStatus === "active" &&
      payload.isPreferred;

    if (effectivePreferred) {
      await SupplierProduct.updateMany(
        {
          product: payload.product,
          isPreferred: true,
          status: "active",
        },
        {
          $set: {
            isPreferred: false,
            updatedBy: actorId,
            updatedAt: new Date(),
          },
        },
        sessionOption(session)
      );
    }

    const documents = await SupplierProduct.create(
      [
        {
          ...payload,
          supplier: supplierId,
          currency:
            payload.currency || supplier.procurement?.currency || "BDT",
          status: effectiveStatus,
          isPreferred: effectivePreferred,
          createdBy: actorId,
          updatedBy: actorId,
        },
      ],
      sessionOption(session)
    );

    if (effectivePreferred) {
      await syncInventoryDefaultSupplier({
        productId: payload.product,
        supplierId,
        isPreferred: true,
        actorId,
        session,
      });
    }

    return documents[0];
  });

  invalidateReadCache();
  await writeAudit({
    supplierId,
    supplierProductId: link._id,
    action: "supplier_product_created",
    actorId,
    meta,
  });

  return {
    message: "Supplier-product link created.",
    supplierProduct: link,
  };
};

export const updateSupplierProductService = async ({
  supplierId,
  linkId,
  body,
  actorId,
  meta,
}) => {
  assertId(supplierId, "Supplier ID");
  assertId(linkId, "Supplier-product link ID");

  const payload = buildSupplierProductPayload(body, { partial: true });
  throwValidation(
    validateSupplierProductPayload(payload, { partial: true })
  );

  const supplier = await Supplier.findById(supplierId)
    .select("status")
    .lean();
  assertSupplier(supplier);

  const current = await SupplierProduct.findOne({
    _id: linkId,
    supplier: supplierId,
  }).select("+archivedBySupplier +previousStatus");

  if (!current) {
    throw new HttpError(404, "Supplier-product link not found.");
  }

  if (current.status === "archived") {
    throw new HttpError(
      409,
      "Restore the archived supplier-product link before editing it."
    );
  }

  if (
    payload.product !== undefined &&
    String(payload.product) !== String(current.product)
  ) {
    throw new HttpError(
      409,
      "The linked product cannot be changed. Archive this link and create another one."
    );
  }

  delete payload.product;
  await assertProductAndUnit({
    product: current.product,
    purchaseUnit: payload.purchaseUnit,
  });

  const updated = await runAtomic(async (session) => {
    const nextStatus = payload.status || current.status;
    const nextPreferred =
      payload.isPreferred !== undefined
        ? payload.isPreferred
        : current.isPreferred;

    if (nextStatus === "active" && supplier.status !== "active") {
      throw new HttpError(
        409,
        "Activate the supplier before activating its product link."
      );
    }

    const effectivePreferred =
      supplier.status === "active" &&
      nextStatus === "active" &&
      nextPreferred;

    if (effectivePreferred) {
      await SupplierProduct.updateMany(
        {
          product: current.product,
          _id: { $ne: current._id },
          isPreferred: true,
          status: "active",
        },
        {
          $set: {
            isPreferred: false,
            updatedBy: actorId,
            updatedAt: new Date(),
          },
        },
        sessionOption(session)
      );
    }

    const query = SupplierProduct.findOneAndUpdate(
      { _id: linkId, supplier: supplierId },
      {
        $set: {
          ...payload,
          isPreferred: effectivePreferred,
          updatedBy: actorId,
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      }
    );

    if (session) query.session(session);
    const nextLink = await query;

    await syncInventoryDefaultSupplier({
      productId: current.product,
      supplierId,
      isPreferred: effectivePreferred,
      actorId,
      session,
    });

    return nextLink;
  });

  invalidateReadCache();
  await writeAudit({
    supplierId,
    supplierProductId: updated._id,
    action: "supplier_product_updated",
    actorId,
    meta,
  });

  return {
    message: "Supplier-product link updated.",
    supplierProduct: updated,
  };
};

export const updateSupplierProductStatusService = async ({
  supplierId,
  linkId,
  status,
  actorId,
  meta,
}) => {
  assertId(supplierId, "Supplier ID");
  assertId(linkId, "Supplier-product link ID");
  const normalizedStatus = lower(status);

  if (!['active', 'inactive'].includes(normalizedStatus)) {
    throw new HttpError(400, "Status must be active or inactive.");
  }

  const supplier = await Supplier.findById(supplierId)
    .select("status")
    .lean();
  assertSupplier(supplier);

  if (normalizedStatus === "active" && supplier.status !== "active") {
    throw new HttpError(
      409,
      "Activate the supplier before activating the product link."
    );
  }

  const link = await SupplierProduct.findOne({
    _id: linkId,
    supplier: supplierId,
  }).select("+archivedBySupplier");

  if (!link) throw new HttpError(404, "Supplier-product link not found.");
  if (link.status === "archived") {
    throw new HttpError(409, "Restore the archived product link first.");
  }

  link.status = normalizedStatus;
  if (normalizedStatus !== "active") link.isPreferred = false;
  link.updatedBy = actorId;
  await link.save();

  if (normalizedStatus !== "active") {
    await syncInventoryDefaultSupplier({
      productId: link.product,
      supplierId,
      isPreferred: false,
      actorId,
    });
  }

  invalidateReadCache();
  await writeAudit({
    supplierId,
    supplierProductId: link._id,
    action: "supplier_product_status_changed",
    actorId,
    meta,
    note: normalizedStatus,
  });

  return {
    message: `Supplier-product link marked as ${normalizedStatus}.`,
    supplierProduct: link,
  };
};

export const archiveSupplierProductService = async ({
  supplierId,
  linkId,
  actorId,
  meta,
}) => {
  assertId(supplierId, "Supplier ID");
  assertId(linkId, "Supplier-product link ID");

  const link = await SupplierProduct.findOne({
    _id: linkId,
    supplier: supplierId,
  }).select("+archivedBySupplier +previousStatus");

  if (!link) throw new HttpError(404, "Supplier-product link not found.");
  if (link.status === "archived") {
    throw new HttpError(409, "Supplier-product link is already archived.");
  }

  link.previousStatus = link.status;
  link.status = "archived";
  link.isPreferred = false;
  link.archivedAt = new Date();
  link.archivedBySupplier = false;
  link.updatedBy = actorId;
  await link.save();

  await syncInventoryDefaultSupplier({
    productId: link.product,
    supplierId,
    isPreferred: false,
    actorId,
  });

  invalidateReadCache();
  await writeAudit({
    supplierId,
    supplierProductId: link._id,
    action: "supplier_product_archived",
    actorId,
    meta,
  });

  return {
    message: "Supplier-product link archived.",
    supplierProduct: link,
  };
};

export const restoreSupplierProductService = async ({
  supplierId,
  linkId,
  actorId,
  meta,
}) => {
  assertId(supplierId, "Supplier ID");
  assertId(linkId, "Supplier-product link ID");

  const supplier = await Supplier.findById(supplierId)
    .select("status")
    .lean();
  assertSupplier(supplier);

  const link = await SupplierProduct.findOne({
    _id: linkId,
    supplier: supplierId,
  }).select("+archivedBySupplier +previousStatus");

  if (!link) throw new HttpError(404, "Supplier-product link not found.");
  if (link.status !== "archived") {
    throw new HttpError(409, "Only an archived product link can be restored.");
  }

  link.status = "inactive";
  link.previousStatus = "";
  link.archivedAt = null;
  link.archivedBySupplier = false;
  link.isPreferred = false;
  link.updatedBy = actorId;
  await link.save();

  invalidateReadCache();
  await writeAudit({
    supplierId,
    supplierProductId: link._id,
    action: "supplier_product_restored",
    actorId,
    meta,
  });

  return {
    message: "Supplier-product link restored as inactive.",
    supplierProduct: link,
  };
};

export const listSupplierAuditsService = async ({
  supplierId,
  query = {},
}) => {
  assertId(supplierId, "Supplier ID");

  const supplierExists = await Supplier.exists({ _id: supplierId });
  if (!supplierExists) throw new HttpError(404, "Supplier not found.");

  const limit = parseLimit(query.limit, 30, 100);
  const cursor = decodeAuditCursor(query.cursor);

  if (query.cursor && !cursor) {
    throw new HttpError(400, "Invalid audit pagination cursor.");
  }

  const filter = { supplier: toId(supplierId) };

  if (clean(query.action)) {
    filter.action = lower(query.action);
  }

  if (cursor) {
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        _id: { $lt: cursor.id },
      },
    ];
  }

  const audits = await SupplierAudit.find(filter)
    .select(
      "supplier supplierProduct action actor requestId ip changes note createdAt"
    )
    .populate("actor", "name email")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .maxTimeMS(4000)
    .lean();

  const hasMore = audits.length > limit;
  if (hasMore) audits.pop();

  return {
    count: audits.length,
    hasMore,
    nextCursor:
      hasMore && audits.length
        ? encodeAuditCursor(audits[audits.length - 1])
        : null,
    audits,
  };
};

export { HttpError };
