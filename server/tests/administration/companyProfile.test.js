import assert from "node:assert/strict";
import test from "node:test";

import Company from "../../models/administration/company.model.js";
import {
  normalizeCompanyProfileInput,
  validateCompanyLogo,
  validateCompanyProfileInput,
} from "../../services/administration/companyProfile.service.js";

test("Company schema supports operational profile and managed-logo fields", () => {
  for (const path of [
    "businessType",
    "vatNumber",
    "tinNumber",
    "contactPerson.name",
    "contactPerson.email",
    "contactPerson.phone",
    "logo.url",
    "logo.storageProvider",
    "logo.storageKey",
  ]) {
    assert.ok(Company.schema.path(path), `${path} must be persisted`);
  }
});

test("company profile normalization ignores platform-owned and unknown fields", () => {
  assert.deepEqual(
    normalizeCompanyProfileInput({
      name: "  Acme Limited  ",
      businessType: " Private Limited ",
      code: "HACK",
      status: "suspended",
      enabledModules: ["sales"],
      subscription: { plan: "Free" },
      note: "platform only",
      unexpected: "ignored",
    }),
    {
      name: "Acme Limited",
      businessType: "Private Limited",
    }
  );
});

test("company profile validation rejects malformed contact and localization values", () => {
  assert.throws(() => validateCompanyProfileInput({ name: "" }), /Company name is required/i);
  assert.throws(() => validateCompanyProfileInput({ email: "invalid" }), /company email/i);
  assert.throws(() => validateCompanyProfileInput({ website: "javascript:alert(1)" }), /website/i);
  assert.throws(() => validateCompanyProfileInput({ settings: { currency: "TAKA" } }), /three-letter/i);
  assert.throws(() => validateCompanyProfileInput({ settings: { timezone: "Moon/Base" } }), /time zone/i);
  assert.throws(() => validateCompanyProfileInput({ settings: { fiscalYearStart: "02-31" } }), /fiscal year/i);
  assert.throws(() => validateCompanyProfileInput({ contactPerson: { email: "broken" } }), /contact-person email/i);
});

test("company logos accept only safe raster formats up to five megabytes", () => {
  for (const mimetype of ["image/png", "image/jpeg", "image/webp"]) {
    assert.doesNotThrow(() => validateCompanyLogo({ mimetype, size: 5 * 1024 * 1024, buffer: Buffer.from([1]) }));
  }

  assert.throws(
    () => validateCompanyLogo({ mimetype: "image/svg+xml", size: 100, buffer: Buffer.from([1]) }),
    /PNG, JPG, or WEBP/i
  );
  assert.throws(
    () => validateCompanyLogo({ mimetype: "application/pdf", size: 100, buffer: Buffer.from([1]) }),
    /PNG, JPG, or WEBP/i
  );
  assert.throws(
    () => validateCompanyLogo({ mimetype: "image/png", size: 5 * 1024 * 1024 + 1, buffer: Buffer.from([1]) }),
    /5 MB/i
  );
  assert.throws(() => validateCompanyLogo(null), /Select a company logo/i);
});
