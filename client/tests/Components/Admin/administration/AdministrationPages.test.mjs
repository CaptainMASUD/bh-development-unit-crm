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
