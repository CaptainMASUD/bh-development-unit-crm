import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

async function loadPage(t, path) {
  const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom" })
  t.after(() => server.close())
  return server.ssrLoadModule(path)
}

test("Company Details exposes the approved operational fields without platform subscription controls", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/CompanyDetails.jsx")
  const form = page.toCompanyForm({
    name: "Acme",
    code: "ACME",
    status: "active",
    settings: { currency: "BDT", timezone: "Asia/Dhaka", fiscalYearStart: "01-01" },
  })
  const html = renderToStaticMarkup(React.createElement(page.CompanyDetailsView, {
    form,
    company: { code: "ACME", status: "active" },
    canManage: true,
    loading: false,
    saving: false,
    onChange() {},
    onNestedChange() {},
    onSave() {},
    onReset() {},
    onReload() {},
    onLogoSelected() {},
    onLogoRemove() {},
  }))

  for (const label of [
    "Company Name", "Legal Name", "Business Type", "Registration Number",
    "Tax ID", "VAT Number", "TIN Number", "Email", "Phone", "Website",
    "Address Line 1", "City", "State / Division", "Postal Code", "Country",
    "Default Currency", "Time Zone", "Fiscal Year Start", "Contact Person",
  ]) assert.match(html, new RegExp(label.replace("/", "\\/"), "i"), label)

  assert.doesNotMatch(html, /Subscription Plan/i)
  assert.doesNotMatch(html, /Enabled Modules/i)
  assert.match(html, /Save Changes/)
})

test("Company Details payload cannot mutate platform-owned company fields", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/CompanyDetails.jsx")
  const form = page.toCompanyForm({
    name: "Acme",
    code: "ORIGINAL",
    status: "active",
    enabledModules: ["crm"],
    subscription: { plan: "Professional" },
  })
  form.code = "HACK"
  form.status = "suspended"
  form.enabledModules = ["sales"]
  form.subscription = { plan: "Free" }

  const payload = page.buildCompanyProfilePayload(form)
  assert.equal(payload.name, "Acme")
  assert.equal("code" in payload, false)
  assert.equal("status" in payload, false)
  assert.equal("enabledModules" in payload, false)
  assert.equal("subscription" in payload, false)
})

test("Company Details validation catches required and malformed fields before submission", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/CompanyDetails.jsx")
  assert.match(page.validateCompanyForm(page.toCompanyForm({ name: "" })), /company name/i)
  assert.match(page.validateCompanyForm(page.toCompanyForm({ name: "Acme", email: "broken" })), /email/i)
  assert.match(page.validateCompanyForm(page.toCompanyForm({ name: "Acme", website: "javascript:bad" })), /website/i)
  assert.equal(page.validateCompanyForm(page.toCompanyForm({ name: "Acme" })), "")
})

test("System Defaults renders exact operational bounds, retention choices, and warning copy", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/SystemDefaults.jsx")
  const form = page.toSystemDefaultsForm({
    tablePageSize: 20,
    auditStorageLimit: 100000,
    auditRetentionMode: "warn_only",
    revision: 3,
  })
  const html = renderToStaticMarkup(React.createElement(page.SystemDefaultsView, {
    form,
    saved: form,
    canManage: true,
    loading: false,
    saving: false,
    onChange() {},
    onSave() {},
    onReset() {},
    onReload() {},
    onKeepDraft() {},
  }))

  assert.match(html, /min="10"/)
  assert.match(html, /max="200"/)
  assert.match(html, /min="1000"/)
  assert.match(html, /max="10000000"/)
  assert.match(html, /Warn only/)
  assert.match(html, /Archive then purge/)
  assert.match(html, /does not delete audit records/i)
})

test("System Defaults validates and submits only the documented settings contract", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/SystemDefaults.jsx")
  assert.match(page.validateSystemDefaults({ tablePageSize: 9, auditStorageLimit: 100000, auditRetentionMode: "warn_only" }), /10 and 200/)
  assert.match(page.validateSystemDefaults({ tablePageSize: 20, auditStorageLimit: 999, auditRetentionMode: "warn_only" }), /1,000 and 10,000,000/)

  const payload = page.buildSystemDefaultsPayload({
    tablePageSize: "50",
    auditStorageLimit: "250000",
    auditRetentionMode: "archive_then_purge",
    revision: 4,
    tenantId: "must-not-leak",
  })
  assert.deepEqual(payload, {
    tablePageSize: 50,
    auditStorageLimit: 250000,
    auditRetentionMode: "archive_then_purge",
    revision: 4,
  })
})

test("System Defaults is read-only without manage permission and preserves a conflicting draft", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/SystemDefaults.jsx")
  const saved = page.toSystemDefaultsForm({ tablePageSize: 20, auditStorageLimit: 100000, auditRetentionMode: "warn_only", revision: 1 })
  const draft = { ...saved, tablePageSize: "75" }
  assert.deepEqual(page.preserveSettingsDraftOnConflict(draft, { revision: 2 }), draft)

  const html = renderToStaticMarkup(React.createElement(page.SystemDefaultsView, {
    form: draft,
    saved,
    canManage: false,
    conflict: true,
    loading: false,
    saving: false,
    onChange() {},
    onSave() {},
    onReset() {},
    onReload() {},
    onKeepDraft() {},
  }))
  assert.match(html, /Settings changed in another session/i)
  assert.match(html, /Reload/)
  assert.match(html, /Keep Draft/)
  assert.match(html, /read-only/i)
  assert.match(html, /disabled=""/)
})
