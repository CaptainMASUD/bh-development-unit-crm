import Company from "../../models/company.model.js";
import { writeAudit } from "../../utils/audit.js";
import { runMongoTransaction, sessionOptions, withSession } from "../../utils/mongoTransaction.js";
import {
  deleteDocumentFile,
  uploadImageToCloudinary,
} from "../storage/documentStorage.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const PROFILE_FIELDS = [
  "name",
  "legalName",
  "businessType",
  "industry",
  "registrationNo",
  "taxId",
  "vatNumber",
  "tinNumber",
  "email",
  "phone",
  "website",
];
const ADDRESS_FIELDS = ["line1", "line2", "city", "state", "postalCode", "country"];
const CONTACT_FIELDS = ["name", "designation", "email", "phone"];
const SETTINGS_FIELDS = ["currency", "timezone", "fiscalYearStart", "dateFormat"];
const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_LOGO_SIZE = 5 * 1024 * 1024;

const has = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const clean = (value) => String(value ?? "").trim();
const fail = (message, statusCode = 400) => {
  throw Object.assign(new Error(message), { statusCode });
};

const normalizedObject = (source, fields, transform = {}) => Object.fromEntries(
  fields
    .filter((field) => has(source, field))
    .map((field) => [field, transform[field] ? transform[field](source[field]) : clean(source[field])])
);

export function normalizeCompanyProfileInput(input = {}) {
  const result = normalizedObject(input, PROFILE_FIELDS, {
    email: (value) => clean(value).toLowerCase(),
  });

  if (has(input, "address")) {
    result.address = normalizedObject(input.address || {}, ADDRESS_FIELDS);
  }
  if (has(input, "contactPerson")) {
    result.contactPerson = normalizedObject(input.contactPerson || {}, CONTACT_FIELDS, {
      email: (value) => clean(value).toLowerCase(),
    });
  }
  if (has(input, "settings")) {
    result.settings = normalizedObject(input.settings || {}, SETTINGS_FIELDS, {
      currency: (value) => clean(value).toUpperCase(),
    });
  }

  return result;
}

const isValidWebUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const isValidTimeZone = (value) => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const isValidFiscalStart = (value) => {
  const match = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value || "");
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const daysInMonth = new Date(2024, month, 0).getDate();
  return day <= daysInMonth;
};

export function validateCompanyProfileInput(input = {}) {
  if (has(input, "name") && !clean(input.name)) fail("Company name is required.");
  if (input.email && !EMAIL_PATTERN.test(input.email)) fail("Enter a valid company email address.");
  if (input.website && !isValidWebUrl(input.website)) fail("Enter a valid HTTP or HTTPS company website.");
  if (input.contactPerson?.email && !EMAIL_PATTERN.test(input.contactPerson.email)) {
    fail("Enter a valid contact-person email address.");
  }
  if (input.settings) {
    if (has(input.settings, "currency") && !CURRENCY_PATTERN.test(input.settings.currency || "")) {
      fail("Default currency must be a three-letter ISO code.");
    }
    if (has(input.settings, "timezone") && !isValidTimeZone(input.settings.timezone)) {
      fail("Select a valid IANA time zone.");
    }
    if (has(input.settings, "fiscalYearStart") && !isValidFiscalStart(input.settings.fiscalYearStart)) {
      fail("Fiscal year start must be a valid MM-DD date.");
    }
  }
  return input;
}

export function validateCompanyLogo(file) {
  if (!file) fail("Select a company logo.");
  const mimetype = String(file.mimetype || "").toLowerCase();
  if (!LOGO_MIME_TYPES.has(mimetype)) fail("Company logo must be PNG, JPG, or WEBP.");
  if (Number(file.size || file.buffer?.length || 0) > MAX_LOGO_SIZE) {
    fail("Company logo must not exceed 5 MB.");
  }
  if (!file.buffer) fail("Company logo file content is missing.");
  return file;
}

const toCompanyProfile = (company) => ({
  _id: company._id,
  name: company.name || "",
  legalName: company.legalName || "",
  code: company.code || "",
  businessType: company.businessType || "",
  industry: company.industry || "",
  registrationNo: company.registrationNo || "",
  taxId: company.taxId || "",
  vatNumber: company.vatNumber || "",
  tinNumber: company.tinNumber || "",
  email: company.email || "",
  phone: company.phone || "",
  website: company.website || "",
  address: company.address || {},
  settings: company.settings || {},
  contactPerson: company.contactPerson || {},
  logo: company.logo?.url ? company.logo : {
    url: company.logoUrl || "",
    storageProvider: "",
    storageKey: "",
    updatedAt: null,
  },
  status: company.status || "active",
  updatedAt: company.updatedAt || null,
});

export async function getCompanyProfile({ tenantId, session = null }) {
  if (!tenantId) fail("A verified tenant is required.", 403);
  const company = await withSession(Company.findById(tenantId), session).lean();
  if (!company) fail("Company not found.", 404);
  return toCompanyProfile(company);
}

export async function updateCompanyProfile({ tenantId, actorId, input, reqMeta = {} }) {
  if (!tenantId) fail("A verified tenant is required.", 403);
  if (!actorId) fail("An authenticated administrator is required.", 401);
  const patch = validateCompanyProfileInput(normalizeCompanyProfileInput(input));
  if (!Object.keys(patch).length) fail("At least one company field is required.");

  return runMongoTransaction(async (session) => {
    const before = await withSession(Company.findById(tenantId), session).lean();
    if (!before) fail("Company not found.", 404);
    const company = await Company.findByIdAndUpdate(
      tenantId,
      { $set: { ...patch, updatedBy: actorId } },
      { new: true, runValidators: true, ...sessionOptions(session) }
    );
    await writeAudit({
      session,
      tenantId,
      actorId,
      action: "update",
      entityType: "Company",
      entityId: company._id,
      before: toCompanyProfile(before),
      after: toCompanyProfile(company.toObject()),
      meta: reqMeta,
    }, { strict: true });
    return toCompanyProfile(company.toObject());
  });
}

export async function replaceCompanyLogo({ tenantId, actorId, file, reqMeta = {} }) {
  validateCompanyLogo(file);
  if (!tenantId) fail("A verified tenant is required.", 403);
  if (!actorId) fail("An authenticated administrator is required.", 401);

  const uploaded = await uploadImageToCloudinary(file.buffer, {
    folder: `companies/${tenantId}/logo`,
  });
  const nextLogo = {
    url: uploaded.secure_url,
    storageProvider: "cloudinary",
    storageKey: uploaded.public_id,
    updatedAt: new Date(),
  };

  let previousLogo = null;
  try {
    const result = await runMongoTransaction(async (session) => {
      const before = await withSession(Company.findById(tenantId), session).lean();
      if (!before) fail("Company not found.", 404);
      previousLogo = before.logo;
      const company = await Company.findByIdAndUpdate(
        tenantId,
        { $set: { logo: nextLogo, logoUrl: nextLogo.url, updatedBy: actorId } },
        { new: true, runValidators: true, ...sessionOptions(session) }
      );
      await writeAudit({
        session,
        tenantId,
        actorId,
        action: "update",
        entityType: "Company",
        entityId: company._id,
        before: { logo: before.logo || { url: before.logoUrl || "" } },
        after: { logo: nextLogo },
        meta: { ...reqMeta, extra: { change: "company_logo_replaced" } },
      }, { strict: true });
      return toCompanyProfile(company.toObject());
    });

    if (previousLogo?.storageKey && previousLogo.storageKey !== nextLogo.storageKey) {
      await deleteDocumentFile(previousLogo);
    }
    return result;
  } catch (error) {
    await deleteDocumentFile(nextLogo);
    throw error;
  }
}

export async function removeCompanyLogo({ tenantId, actorId, reqMeta = {} }) {
  if (!tenantId) fail("A verified tenant is required.", 403);
  if (!actorId) fail("An authenticated administrator is required.", 401);
  let previousLogo = null;

  const result = await runMongoTransaction(async (session) => {
    const before = await withSession(Company.findById(tenantId), session).lean();
    if (!before) fail("Company not found.", 404);
    previousLogo = before.logo;
    const company = await Company.findByIdAndUpdate(
      tenantId,
      {
        $set: {
          logo: { url: "", storageProvider: "", storageKey: "", updatedAt: null },
          logoUrl: "",
          updatedBy: actorId,
        },
      },
      { new: true, runValidators: true, ...sessionOptions(session) }
    );
    await writeAudit({
      session,
      tenantId,
      actorId,
      action: "update",
      entityType: "Company",
      entityId: company._id,
      before: { logo: before.logo || { url: before.logoUrl || "" } },
      after: { logo: null },
      meta: { ...reqMeta, extra: { change: "company_logo_removed" } },
    }, { strict: true });
    return toCompanyProfile(company.toObject());
  });

  if (previousLogo?.storageKey) await deleteDocumentFile(previousLogo);
  return result;
}
