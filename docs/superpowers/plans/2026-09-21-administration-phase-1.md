# Administration Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the Administration foundation: ordered navigation, tenant Administration dashboard, Company Details, System Defaults, shared Administration UI, granular authorization, and auditable writes.

**Architecture:** Extend the existing tenant-scoped `Company`, permission catalog, audit service, and Express route boundaries. Add one versioned `SystemSettings` document per tenant and small Administration domain services, then build React pages from shared CRM-aligned primitives. Existing company onboarding, branches, employees, payroll links, and compatibility endpoints remain operational.

**Tech Stack:** React 18, Vite, Tailwind CSS, Redux user state, Express 4, Mongoose 8, JWT middleware, Multer memory uploads, Cloudinary-backed image storage, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-21-administration-module-design.md`

## Global Constraints

- Preserve the existing tenant context, module entitlement checks, and protected `superadmin`, `admin`, and `employee` roles.
- Tenant Administration endpoints must use `/api/administration`, `protect`, `requireModule("administration")`, and granular permissions.
- Tenant Company Details must never accept subscription or enabled-module changes.
- `tablePageSize` is constrained to 10–200; server endpoint maximums still win.
- `auditStorageLimit` uses a safe operational minimum of 1,000 and maximum of 10,000,000 records.
- Audit retention defaults to `warn_only`; Phase 1 stores and explains the policy but does not purge records.
- Passwords, tokens, secrets, OTP values, authorization headers, cookies, and credentials must never be stored in audit snapshots.
- Use existing dependencies; do not add a frontend state, form, validation, or styling library.
- Preserve the user’s unrelated `client/package-lock.json` and `server/package-lock.json` changes.

## Review Focus

- A crafted tenant Company Details request containing `enabledModules`, `subscription`, `code`, or `status` must not mutate platform-owned fields; covered by Task 5 API tests.
- A company-logo upload with SVG, non-image MIME, or over 5 MB must fail before storage; covered by Task 4 service/controller tests.
- Concurrent first writes to System Defaults must still leave one tenant settings document; covered by Task 3 unique-index/upsert tests.
- An audit payload containing nested password/token/cookie values must persist only redacted markers; covered by Task 2 recursive-redaction tests.
- A stale employee permission group containing newly added Administration keys must be filtered by enabled modules without losing valid keys; covered by Task 1 permission-catalog tests.

---

## File Structure

### Server files created

- `server/models/administration/systemSettings.model.js` — one versioned settings document per tenant.
- `server/models/systemSettings.model.js` — compatibility re-export following current model conventions.
- `server/services/administration/systemSettings.service.js` — defaults, validation, read/upsert, and page-size resolution.
- `server/services/administration/companyProfile.service.js` — tenant-safe company reads/updates and logo lifecycle.
- `server/services/administration/administrationDashboard.service.js` — Phase 1 setup-completeness and warning projection.
- `server/utils/auditRedaction.js` — recursive sensitive-value redaction.
- `server/controllers/administration/administration.controller.js` — thin HTTP handlers for dashboard, company profile, logo, and defaults.
- `server/routes/administration/administration.routes.js` — canonical tenant Administration routes.
- `server/tests/administration/permissions.test.js` — new permission/module contracts.
- `server/tests/administration/auditRedaction.test.js` — redaction and strict audit behavior.
- `server/tests/administration/systemSettings.test.js` — settings validation and concurrency behavior.
- `server/tests/administration/companyProfile.test.js` — safe field selection and logo validation.
- `server/tests/administration/administrationApi.test.js` — routing, auth, permission, and response contracts.

### Server files modified

- `server/models/administration/company.model.js` — business type, VAT/TIN, contact person, and managed logo metadata.
- `server/models/administration/permissionGroup.model.js` — Phase 1 permission keys.
- `server/config/erpModules.js` — Administration permission prefixes.
- `server/utils/audit.js` — redaction and optional strict write behavior.
- `server/services/storage/documentStorage.service.js` — configurable image folder and safe image deletion already supported by the provider abstraction.
- `server/app.js` — canonical Administration router mount.

### Client files created

- `client/src/Components/Admin/administration/AdministrationUI.jsx` — shared shell, header, toolbar, modal, fields, status, table, pagination, and state surfaces.
- `client/src/Components/Admin/administration/administrationApi.js` — authenticated API client and response normalization.
- `client/src/Components/Admin/administration/AdministrationDashboard.jsx` — tenant setup summary and nearby administrative warnings.
- `client/src/Components/Admin/administration/CompanyDetails.jsx` — profile and logo management.
- `client/src/Components/Admin/administration/SystemDefaults.jsx` — typed defaults editor.
- `client/tests/Components/Admin/administration/AdministrationUI.test.mjs` — shared visual contract tests.
- `client/tests/Components/Admin/administration/AdministrationPages.test.mjs` — page/API wiring contracts.

### Client files modified

- `client/src/Components/Navigation/moduleConfig.js` — ordered Administration sidebar.
- `client/src/Components/Admin/sections.jsx` — lazy page registrations.
- `client/src/Components/Auth/permissions.js` — Phase 1 permission constants.
- `client/tests/Components/Navigation/moduleConfig.test.mjs` — exact sidebar order and route coverage.

---

### Task 1: Establish Phase 1 permission and navigation contracts

**Files:**
- Modify: `server/models/administration/permissionGroup.model.js`
- Modify: `server/config/erpModules.js`
- Modify: `client/src/Components/Auth/permissions.js`
- Modify: `client/src/Components/Navigation/moduleConfig.js`
- Test: `server/tests/administration/permissions.test.js`
- Test: `client/tests/Components/Navigation/moduleConfig.test.mjs`

**Interfaces:**
- Produces permission keys `administration-dashboard:view`, `system-settings:view`, and `system-settings:manage`.
- Produces exact tenant-admin section order consumed by Task 10.

- [ ] **Step 1: Write failing server permission tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION_KEYS } from "../../models/administration/permissionGroup.model.js";
import { permissionModule, permissionsForModules } from "../../config/erpModules.js";

test("Phase 1 Administration permissions belong to the Administration module", () => {
  const keys = ["administration-dashboard:view", "system-settings:view", "system-settings:manage"];
  keys.forEach((key) => {
    assert.ok(PERMISSION_KEYS.includes(key));
    assert.equal(permissionModule(key), "administration");
  });
  assert.deepEqual(permissionsForModules(keys, ["administration"]), keys);
});
```

- [ ] **Step 2: Add a failing client navigation test**

```js
test("Administration exposes the approved Phase 1-first sidebar order", async (t) => {
  const config = await loadModuleConfig(t)
  assert.deepEqual(config.MODULES.administration.adminSections, [
    "Dashboard", "Company Details", "System Defaults", "Document Numbering",
    "Audit Trail", "Role Management", "Departments", "Employee Access Control",
    "Add Employee", "Employee Account Control", "System Security Settings",
  ])
})
```

- [ ] **Step 3: Run both tests and confirm contract failures**

Run: `cd server; node --test tests/administration/permissions.test.js`

Expected: FAIL because the permission keys/prefixes are absent.

Run: `cd client; node --test --test-concurrency=1 tests/Components/Navigation/moduleConfig.test.mjs`

Expected: FAIL because the Administration order is still the legacy five-item list.

- [ ] **Step 4: Add permission keys, module prefixes, constants, and sidebar order**

```js
// permissionGroup.model.js
"administration-dashboard:view",
"system-settings:view",
"system-settings:manage",

// erpModules.js administration.permissionPrefixes
["users", "notifications", "access-control", "profile", "company", "branch", "administration-dashboard", "system-settings"]

// permissions.js
ADMINISTRATION_DASHBOARD_VIEW: "administration-dashboard:view",
SYSTEM_SETTINGS_VIEW: "system-settings:view",
SYSTEM_SETTINGS_MANAGE: "system-settings:manage",
```

Set `MODULES.administration.adminSections` to the exact order asserted above. Keep Super Admin’s platform Company Setup handling separate in `buildModuleSections`.

- [ ] **Step 5: Run the focused tests**

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add server/models/administration/permissionGroup.model.js server/config/erpModules.js server/tests/administration/permissions.test.js client/src/Components/Auth/permissions.js client/src/Components/Navigation/moduleConfig.js client/tests/Components/Navigation/moduleConfig.test.mjs
git commit -m "feat: define administration navigation permissions"
```

### Task 2: Redact sensitive audit data and support strict Administration writes

**Files:**
- Create: `server/utils/auditRedaction.js`
- Modify: `server/utils/audit.js`
- Modify: `server/models/administration/auditLog.model.js`
- Test: `server/tests/administration/auditRedaction.test.js`

**Interfaces:**
- Produces `redactAuditValue(value)`.
- Extends `writeAudit(payload, { strict = false } = {})`; existing callers remain compatible.
- Produces new audit entity types `Company`, `SystemSettings`, and `AdministrationDashboard`.

- [ ] **Step 1: Write failing recursive-redaction tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { redactAuditValue } from "../../utils/auditRedaction.js";

test("audit redaction removes nested credentials without changing safe values", () => {
  assert.deepEqual(redactAuditValue({
    name: "Acme",
    password: "plain",
    nested: { accessToken: "jwt", phone: "123", headers: { authorization: "Bearer x" } },
    cookies: ["session=x"],
  }), {
    name: "Acme",
    password: "[REDACTED]",
    nested: { accessToken: "[REDACTED]", phone: "123", headers: { authorization: "[REDACTED]" } },
    cookies: "[REDACTED]",
  });
});
```

Add a model-stub test that makes `AuditLog.create` reject and asserts best-effort mode returns `null` while strict mode rejects with the original error.

- [ ] **Step 2: Run the audit test**

Run: `cd server; node --test tests/administration/auditRedaction.test.js`

Expected: FAIL because `auditRedaction.js` and strict mode do not exist.

- [ ] **Step 3: Implement recursive redaction**

```js
const SENSITIVE = /(password|passcode|token|secret|otp|credential|authorization|cookie|sessionid|resetcode)/i;

export function redactAuditValue(value, seen = new WeakSet()) {
  if (value == null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE.test(key) ? "[REDACTED]" : redactAuditValue(item, seen),
  ]));
}
```

Call `redactAuditValue` on `before`, `after`, and `meta.extra`. In strict mode, rethrow persistence errors; otherwise preserve current best-effort behavior.

- [ ] **Step 4: Run the focused test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/auditRedaction.js server/utils/audit.js server/models/administration/auditLog.model.js server/tests/administration/auditRedaction.test.js
git commit -m "feat: protect sensitive administration audit data"
```

### Task 3: Add central System Defaults model and service

**Files:**
- Create: `server/models/administration/systemSettings.model.js`
- Create: `server/models/systemSettings.model.js`
- Create: `server/services/administration/systemSettings.service.js`
- Test: `server/tests/administration/systemSettings.test.js`

**Interfaces:**
- Produces `SYSTEM_DEFAULTS`.
- Produces `getSystemSettings({ tenantId, session })`.
- Produces `updateSystemSettings({ tenantId, actorId, input, reqMeta, expectedVersion, session })`.
- Produces `resolveTablePageSize({ tenantId, requestedLimit, endpointMax })`.

- [ ] **Step 1: Write failing validation and upsert tests**

```js
test("settings bounds reject unsafe values", () => {
  assert.throws(() => validateSystemSettingsInput({ tablePageSize: 9 }), /10 and 200/);
  assert.throws(() => validateSystemSettingsInput({ auditStorageLimit: 999 }), /1,000/);
  assert.deepEqual(validateSystemSettingsInput({ tablePageSize: 50, auditStorageLimit: 100000 }), {
    tablePageSize: 50,
    auditStorageLimit: 100000,
    auditRetentionMode: "warn_only",
  });
});

test("requested page size cannot exceed endpoint maximum", async () => {
  assert.equal(await resolveTablePageSize({ tenantId, requestedLimit: 500, endpointMax: 100 }), 100);
});
```

Add an integration test using the project test database helper or mocked `findOneAndUpdate` that invokes two first-write updates and asserts the unique `{ tenantId: 1 }` index plus upsert leaves one document.

- [ ] **Step 2: Run the focused test**

Run: `cd server; node --test tests/administration/systemSettings.test.js`

Expected: FAIL because the model/service are absent.

- [ ] **Step 3: Implement the model**

```js
const systemSettingsSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, unique: true, index: true },
  schemaVersion: { type: Number, default: 1, min: 1 },
  revision: { type: Number, default: 1, min: 1 },
  tablePageSize: { type: Number, default: 20, min: 10, max: 200 },
  auditStorageLimit: { type: Number, default: 100000, min: 1000, max: 10000000 },
  auditRetentionMode: { type: String, enum: ["warn_only", "archive_then_purge"], default: "warn_only" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });
```

- [ ] **Step 4: Implement typed validation, optimistic revision, and size resolution**

Use `findOneAndUpdate({ tenantId, revision: expectedVersion }, { $set: values, $inc: { revision: 1 } }, { new: true, upsert: expectedVersion == null, runValidators: true, session })`. Translate duplicate/stale writes to status code `409`. Call strict `writeAudit` with redacted before/after values after a successful change.

- [ ] **Step 5: Run the focused test**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/models/administration/systemSettings.model.js server/models/systemSettings.model.js server/services/administration/systemSettings.service.js server/tests/administration/systemSettings.test.js
git commit -m "feat: add tenant system defaults service"
```

### Task 4: Build the tenant-safe Company Profile service and managed logo lifecycle

**Files:**
- Modify: `server/models/administration/company.model.js`
- Create: `server/services/administration/companyProfile.service.js`
- Modify: `server/services/storage/documentStorage.service.js`
- Test: `server/tests/administration/companyProfile.test.js`

**Interfaces:**
- Produces `getCompanyProfile({ tenantId })`.
- Produces `updateCompanyProfile({ tenantId, actorId, input, reqMeta })`.
- Produces `replaceCompanyLogo({ tenantId, actorId, file, reqMeta })`.
- Produces `removeCompanyLogo({ tenantId, actorId, reqMeta })`.

- [ ] **Step 1: Write failing safe-field and logo tests**

```js
test("company profile payload excludes platform-owned fields", () => {
  assert.deepEqual(normalizeCompanyProfileInput({
    name: "Acme", businessType: "Private", status: "suspended",
    enabledModules: ["sales"], subscription: { plan: "Free" }, code: "HACK",
  }), { name: "Acme", businessType: "Private" });
});

test("company logos accept only PNG, JPEG, or WEBP up to 5 MB", () => {
  assert.throws(() => validateCompanyLogo({ mimetype: "image/svg+xml", size: 100 }), /PNG, JPG, or WEBP/);
  assert.throws(() => validateCompanyLogo({ mimetype: "image/png", size: 5 * 1024 * 1024 + 1 }), /5 MB/);
});
```

- [ ] **Step 2: Run the focused test**

Run: `cd server; node --test tests/administration/companyProfile.test.js`

Expected: FAIL because the profile service is absent.

- [ ] **Step 3: Extend the Company model**

Add `businessType`, `vatNumber`, `tinNumber`, `contactPerson`, and `logo` with `{ url, storageProvider, storageKey, updatedAt }`. Preserve `logoUrl` as a compatibility mirror during migration.

- [ ] **Step 4: Implement safe profile normalization and audited updates**

Build the update object from an allowlist containing company operational fields only. Reject missing name, invalid email/website, invalid fiscal `MM-DD`, unsupported currency/timezone strings, and malformed address/contact values. Use `findOneAndUpdate({ _id: tenantId }, { $set: patch }, { new: true, runValidators: true })`, then strict-audit `Company` before/after snapshots.

- [ ] **Step 5: Implement managed logo replacement/removal**

Upload images using `uploadImageToCloudinary(file.buffer, { folder: `companies/${tenantId}/logo` })`. Persist new metadata first, then delete the old stored object. On database failure, delete the newly uploaded object. Removal clears `logo` and `logoUrl`, then deletes the prior object and writes a strict audit event. Do not expose storage credentials.

- [ ] **Step 6: Run the focused test**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/models/administration/company.model.js server/services/administration/companyProfile.service.js server/services/storage/documentStorage.service.js server/tests/administration/companyProfile.test.js
git commit -m "feat: add auditable company profile management"
```

### Task 5: Expose canonical Administration APIs

**Files:**
- Create: `server/controllers/administration/administration.controller.js`
- Create: `server/routes/administration/administration.routes.js`
- Modify: `server/app.js`
- Test: `server/tests/administration/administrationApi.test.js`
- Modify: `server/tests/core/routing.test.js`

**Interfaces:**
- Produces `GET/PATCH /api/administration/company`.
- Produces `PUT/DELETE /api/administration/company/logo`.
- Produces `GET/PATCH /api/administration/settings`.
- Reserves `GET /api/administration/dashboard` for Task 6.

- [ ] **Step 1: Write failing route-boundary tests**

```js
test("Administration endpoints require authentication", async (t) => {
  const origin = await startApp(t);
  for (const path of ["/api/administration/company", "/api/administration/settings", "/api/administration/dashboard"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 401, path);
  }
});
```

Add controller tests with stubbed services that assert `req.tenantId` is passed, status `200` uses `{ success: true, data }`, missing tenant gives `403`, and crafted platform-owned fields are ignored by the service. Assert write routes require `company:manage` or `system-settings:manage`.

- [ ] **Step 2: Run the API tests**

Run: `cd server; node --test tests/administration/administrationApi.test.js tests/core/routing.test.js`

Expected: FAIL because `/api/administration` is not mounted.

- [ ] **Step 3: Implement thin handlers**

```js
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getSystemSettings({ tenantId: req.tenantId });
  res.json({ success: true, data: { settings } });
});

export const patchSettings = asyncHandler(async (req, res) => {
  const settings = await updateSystemSettings({
    tenantId: req.tenantId,
    actorId: req.user._id,
    input: req.body,
    expectedVersion: req.body.revision,
    reqMeta: getReqMeta(req),
  });
  res.json({ success: true, message: "System defaults updated.", data: { settings } });
});
```

Use the same pattern for company reads/updates and logo actions. Convert service `statusCode` errors through `next(error)` so the global handler owns formatting.

- [ ] **Step 4: Create and mount the router**

Apply `router.use(protect, requireModule("administration"))`; then protect each route with `requirePermission`. Use memory Multer with a route-specific 5 MB image limit for the logo endpoint. Mount once in `app.js` at `/api/administration`.

- [ ] **Step 5: Run the focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/controllers/administration/administration.controller.js server/routes/administration/administration.routes.js server/app.js server/tests/administration/administrationApi.test.js server/tests/core/routing.test.js
git commit -m "feat: expose tenant administration APIs"
```

### Task 6: Add the Phase 1 Administration dashboard projection

**Files:**
- Create: `server/services/administration/administrationDashboard.service.js`
- Modify: `server/controllers/administration/administration.controller.js`
- Modify: `server/routes/administration/administration.routes.js`
- Test: `server/tests/administration/administrationDashboard.test.js`

**Interfaces:**
- Produces `getAdministrationDashboard({ tenantId })` returning `{ summary, tasks, completeness }`.

- [ ] **Step 1: Write failing dashboard projection tests**

```js
test("dashboard derives stable tasks for incomplete configuration", async () => {
  const result = await buildAdministrationDashboard({
    company: { name: "Acme", email: "", logo: null },
    settings: { tablePageSize: 20, auditRetentionMode: "warn_only" },
    auditCount: 100001,
    lockedAccountCount: 2,
  });
  assert.deepEqual(result.tasks.map((item) => item.key), [
    "company-contact-incomplete", "company-logo-missing", "audit-storage-limit", "locked-accounts",
  ]);
  assert.ok(result.tasks.every((item) => item.navigationTarget.startsWith("/admin/administration/")));
});
```

- [ ] **Step 2: Run the focused test**

Run: `cd server; node --test tests/administration/administrationDashboard.test.js`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement the projection**

Query the current company, settings, audit count, active employee count, inactive employee count, and any currently representable lock-state count. Produce deterministic task keys and links. Do not persist these derived tasks. Return zero rather than fabricate unsupported session/security metrics.

- [ ] **Step 4: Wire `GET /dashboard`**

Require `administration-dashboard:view`; return `{ success: true, data: dashboard }`.

- [ ] **Step 5: Run the focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/administration/administrationDashboard.service.js server/controllers/administration/administration.controller.js server/routes/administration/administration.routes.js server/tests/administration/administrationDashboard.test.js
git commit -m "feat: add administration dashboard projection"
```

### Task 7: Create shared Administration frontend primitives and API client

**Files:**
- Create: `client/src/Components/Admin/administration/AdministrationUI.jsx`
- Create: `client/src/Components/Admin/administration/administrationApi.js`
- Test: `client/tests/Components/Admin/administration/AdministrationUI.test.mjs`

**Interfaces:**
- Produces `AdministrationPage`, `AdministrationHeader`, `AdministrationToolbar`, `AdministrationCard`, `AdministrationField`, `AdministrationModal`, `AdministrationStatus`, and `AdministrationTableState`.
- Produces `administrationApi.get`, `.patch`, `.upload`, and `.remove`.

- [ ] **Step 1: Write failing SSR contract tests**

Render the primitives with `react-dom/server` and assert the CRM-aligned page max width, rounded white header, full-width search surface, embedded Filters button, visible label association, status role, and retry button are present. Test that the API client adds the bearer token and turns `{ message }` failures into an `Error` with `status`.

- [ ] **Step 2: Run the focused test**

Run: `cd client; node --test --test-concurrency=1 tests/Components/Admin/administration/AdministrationUI.test.mjs`

Expected: FAIL because the shared files are absent.

- [ ] **Step 3: Implement the shared API client**

```js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`${API_BASE}/administration${path}`, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) Object.assign(new Error(payload.message || "Request failed."), { status: response.status, payload });
  return payload;
}
```

Throw the constructed error explicitly before returning. JSON helpers set `Content-Type`; upload sends `FormData` without manually setting its boundary.

- [ ] **Step 4: Implement shared UI primitives**

Match the CRM Leads spacing and controls using Tailwind classes already present in the repository. Keep state outside primitives. Dialogs must close on Escape, restore scroll, include `role="dialog"`, and use labelled headings. Toolbars must stack on mobile and keep search full-width.

- [ ] **Step 5: Run the focused test**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/Components/Admin/administration/AdministrationUI.jsx client/src/Components/Admin/administration/administrationApi.js client/tests/Components/Admin/administration/AdministrationUI.test.mjs
git commit -m "feat: add administration UI foundations"
```

### Task 8: Build Company Details

**Files:**
- Create: `client/src/Components/Admin/administration/CompanyDetails.jsx`
- Test: `client/tests/Components/Admin/administration/AdministrationPages.test.mjs`

**Interfaces:**
- Consumes `GET/PATCH /company`, `PUT/DELETE /company/logo`, shared UI, and `COMPANY_MANAGE`.

- [ ] **Step 1: Add failing Company Details page tests**

Assert the source/SSR output includes every approved operational field, does not expose subscription/module entitlement controls, disables mutation controls without `company:manage`, accepts PNG/JPEG/WEBP, and supplies update/remove logo actions.

- [ ] **Step 2: Run the page test**

Run: `cd client; node --test --test-concurrency=1 tests/Components/Admin/administration/AdministrationPages.test.mjs`

Expected: FAIL because `CompanyDetails.jsx` is absent.

- [ ] **Step 3: Implement loading and form state**

Map API data into a stable form object with empty-string defaults. Render skeleton, retryable error, and form states. Track `revision` only if returned by the API. Keep saved data separate from draft data so Cancel restores the last server snapshot.

- [ ] **Step 4: Implement validation and save**

Require company name, valid optional email/website, valid `MM-DD` fiscal start, and complete address country. Send only the documented operational fields. Surface `409` as a reload-required conflict and field/server errors without discarding the draft.

- [ ] **Step 5: Implement logo lifecycle**

Validate type/size before upload, show local preview, upload through `FormData`, update the saved company snapshot, and require confirmation before removal. Revoke object URLs on replacement/unmount.

- [ ] **Step 6: Run the focused tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add client/src/Components/Admin/administration/CompanyDetails.jsx client/tests/Components/Admin/administration/AdministrationPages.test.mjs
git commit -m "feat: build administration company details"
```

### Task 9: Build System Defaults

**Files:**
- Create: `client/src/Components/Admin/administration/SystemDefaults.jsx`
- Modify: `client/tests/Components/Admin/administration/AdministrationPages.test.mjs`

**Interfaces:**
- Consumes `GET/PATCH /settings`, shared UI, and `SYSTEM_SETTINGS_MANAGE`.

- [ ] **Step 1: Add failing System Defaults tests**

Assert bounds 10–200 and 1,000–10,000,000, the two retention modes, explicit warning text that `warn_only` does not delete records, read-only behavior without manage permission, and conflict handling that preserves the user draft.

- [ ] **Step 2: Run the focused page test**

Expected: FAIL because `SystemDefaults.jsx` is absent.

- [ ] **Step 3: Implement the settings editor**

Use numeric inputs with exact min/max, a retention-mode select, explanatory copy, unsaved-change detection, reset/cancel, and Save. Send `{ tablePageSize, auditStorageLimit, auditRetentionMode, revision }`. On `409`, show “Settings changed in another session” with Reload and Keep Draft actions.

- [ ] **Step 4: Run the focused tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/Components/Admin/administration/SystemDefaults.jsx client/tests/Components/Admin/administration/AdministrationPages.test.mjs
git commit -m "feat: build administration system defaults"
```

### Task 10: Build the Administration dashboard and register Phase 1 pages

**Files:**
- Create: `client/src/Components/Admin/administration/AdministrationDashboard.jsx`
- Modify: `client/src/Components/Admin/sections.jsx`
- Modify: `client/src/Components/Navigation/moduleConfig.js`
- Modify: `client/tests/Components/Admin/administration/AdministrationPages.test.mjs`
- Modify: `client/tests/Components/Navigation/moduleConfig.test.mjs`

**Interfaces:**
- Consumes `GET /dashboard` and the page components from Tasks 8–9.
- Produces real section registrations and routes for Dashboard, Company Details, and System Defaults.
- Produces disabled “Coming in the approved next phase” placeholders only for later-phase navigation items; placeholders must not claim functionality exists.

- [ ] **Step 1: Add failing dashboard and registry tests**

Assert summary cards, setup completeness, deterministic task links, empty/error states, and that `buildModuleSections(sections, "administration", "admin")` resolves all eleven approved keys. Assert the first three keys render real Phase 1 components with their required permissions.

- [ ] **Step 2: Run focused tests**

Expected: FAIL because page registrations are absent.

- [ ] **Step 3: Implement the dashboard**

Render company/setup/account/audit summary cards and Nearby Tasks ordered by overdue, due date, then priority. Each task link must use internal React Router navigation and only target routes available to the current user. Show a clean “No administrative actions need attention” state when empty.

- [ ] **Step 4: Register pages and permissions**

Lazy-load the three pages in `sections.jsx`. Assign `administration-dashboard:view`, `company:view`, and `system-settings:view`. Define later section entries as honest informational states until their own phase replaces them; do not reuse unrelated CRM Dashboard or legacy Access Control pages under misleading names.

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/Components/Admin/administration/AdministrationDashboard.jsx client/src/Components/Admin/sections.jsx client/src/Components/Navigation/moduleConfig.js client/tests/Components/Admin/administration/AdministrationPages.test.mjs client/tests/Components/Navigation/moduleConfig.test.mjs
git commit -m "feat: launch administration foundation pages"
```

### Task 11: Phase 1 regression and completion verification

**Files:**
- Modify only files required by failures discovered in the commands below.

**Interfaces:**
- Verifies the complete Phase 1 deliverable and compatibility boundaries.

- [ ] **Step 1: Run all Administration server tests**

Run: `cd server; node --test tests/administration/*.test.js tests/core/routing.test.js tests/auth/registerSuperAdmin.test.js`

Expected: PASS with zero skipped or failed Administration tests.

- [ ] **Step 2: Run full server tests**

Run: `cd server; npm test`

Expected: PASS. Fix only regressions caused by Phase 1 changes; document unrelated pre-existing failures with their exact command/output rather than weakening assertions.

- [ ] **Step 3: Run Administration and navigation client tests**

Run: `cd client; node --test --test-concurrency=1 tests/Components/Admin/administration/*.test.mjs tests/Components/Navigation/moduleConfig.test.mjs`

Expected: PASS.

- [ ] **Step 4: Run lint and production build**

Run: `cd client; npx eslint src/Components/Admin/administration src/Components/Admin/sections.jsx src/Components/Navigation/moduleConfig.js src/Components/Auth/permissions.js`

Expected: exit code 0.

Run: `cd client; npm run build`

Expected: Vite production build completes successfully.

- [ ] **Step 5: Review security-sensitive diffs**

Run: `git diff --check`

Run: `rg -n "password|token|secret|authorization|cookie" server/services/administration server/controllers/administration server/utils/auditRedaction.js`

Expected: sensitive terms appear only in validation/redaction/authentication logic; no logged raw values or response fields.

- [ ] **Step 6: Commit final Phase 1 fixes**

```bash
git add server client
git commit -m "test: verify administration phase one"
```

Only create this commit when the verification task produced necessary code/test adjustments; do not create an empty commit.

## Subsequent Plans

After Phase 1 passes and is reviewed, write separate plans from the approved specification for:

1. Phase 2 — shared document numbering and legacy adapters.
2. Phase 3 — centralized Audit Trail, retention execution, and expanded Nearby Tasks.
3. Phase 4 — roles, departments, effective authorization, and employee overrides.
4. Phase 5 — focused employee creation and account administration.
5. Phase 6 — security policy enforcement and hardening.

Each plan must begin from the shipped interfaces of the preceding phase and repeat the same TDD, tenant-isolation, authorization, audit, and full-regression gates.
