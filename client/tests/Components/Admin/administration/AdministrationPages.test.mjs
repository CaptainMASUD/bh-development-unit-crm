import assert from "node:assert/strict"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Provider } from "react-redux"
import { MemoryRouter } from "react-router-dom"
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
    "Time Zone", "Fiscal Year Start", "Contact Person",
  ]) assert.match(html, new RegExp(label.replace("/", "\\/"), "i"), label)

  assert.doesNotMatch(html, /Subscription Plan/i)
  assert.doesNotMatch(html, /Enabled Modules/i)
  assert.doesNotMatch(html, /Default Currency/i)
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
  assert.equal("currency" in payload.settings, false)
  assert.equal("dateFormat" in payload.settings, false)
})

test("Company Details validation catches required and malformed fields before submission", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/CompanyDetails.jsx")
  assert.match(page.validateCompanyForm(page.toCompanyForm({ name: "" })), /company name/i)
  assert.match(page.validateCompanyForm(page.toCompanyForm({ name: "Acme", address: { country: "" } })), /country/i)
  assert.match(page.validateCompanyForm(page.toCompanyForm({ name: "Acme", email: "broken" })), /email/i)
  assert.match(page.validateCompanyForm(page.toCompanyForm({ name: "Acme", website: "javascript:bad" })), /website/i)
  assert.equal(page.validateCompanyForm(page.toCompanyForm({ name: "Acme" })), "")
})

test("Company Details preserves drafts on conflict, enforces read-only access, and validates logo files", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/CompanyDetails.jsx")
  const form = page.toCompanyForm({ name: "Draft Company" })
  assert.deepEqual(page.preserveCompanyDraftOnConflict(form), form)
  assert.equal(page.validateCompanyLogoFile({ type: "image/png", size: 1024 }), "")
  assert.match(page.validateCompanyLogoFile({ type: "image/svg+xml", size: 1024 }), /PNG, JPG, or WEBP/i)
  assert.match(page.validateCompanyLogoFile({ type: "image/png", size: 6 * 1024 * 1024 }), /5 MB/i)

  const html = renderToStaticMarkup(React.createElement(page.CompanyDetailsView, {
    form,
    company: { name: "Saved Company" },
    canManage: false,
    conflict: true,
    loading: false,
    saving: false,
    onChange() {},
    onNestedChange() {},
    onSave() {},
    onReset() {},
    onReload() {},
    onKeepDraft() {},
    onLogoSelected() {},
    onLogoRemove() {},
  }))
  assert.match(html, /Company details changed in another session/i)
  assert.match(html, /Reload/)
  assert.match(html, /Keep Draft/)
  assert.match(html, /read-only/i)
  assert.doesNotMatch(html, /Save Changes/)
  assert.match(html, /disabled=""/)
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
  for (const label of ["Default Rows Per Table", "Default Date Format", "Default Time Format", "Default Currency", "Currency Decimal Places", "Number Decimal Places", "Default Sort Order", "Default File Upload Limit", "Allowed File Types"]) assert.match(html, new RegExp(label, "i"))
  assert.match(html, /DD-MM-YYYY/)
  assert.match(html, /12-hour/)
  assert.match(html, /24-hour/)
  assert.match(html, /PDF/)
  assert.match(html, /DOCX/)
})

test("System Defaults opens its loading state before settings have been saved", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/SystemDefaults.jsx")
  const store = {
    getState: () => ({ user: { currentUser: { role: "admin" } } }),
    subscribe: () => () => {},
    dispatch: () => {},
  }
  const html = renderToStaticMarkup(React.createElement(Provider, { store }, React.createElement(page.default)))
  assert.match(html, /Loading/i)
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
    defaultDateFormat: "DD-MM-YYYY",
    defaultTimeFormat: "24-hour",
    defaultCurrency: "BDT",
    currencyDecimalPlaces: 2,
    numberDecimalPlaces: 2,
    defaultSortOrder: "newest_first",
    defaultFileUploadLimitMb: 10,
    allowedFileTypes: ["PDF", "JPG", "PNG", "XLSX", "DOCX"],
    auditStorageLimit: 250000,
    auditRetentionMode: "archive_then_purge",
    revision: 4,
  })
})

test("System Defaults rejects invalid user preferences before saving", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/SystemDefaults.jsx")
  const valid = page.toSystemDefaultsForm()
  for (const [field, value] of Object.entries({ defaultCurrency: "12$", defaultDateFormat: "bad", defaultTimeFormat: "bad", currencyDecimalPlaces: 7, numberDecimalPlaces: -1, defaultSortOrder: "random", defaultFileUploadLimitMb: 0, allowedFileTypes: [] })) {
    assert.notEqual(page.validateSystemDefaults({ ...valid, [field]: value }), "", field)
  }
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

test("Administration Dashboard renders summary, completeness, ordered internal task links, and empty state", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/AdministrationDashboard.jsx")
  const tasks = page.sortAdministrationTasks([
    { key: "low", title: "Low", priority: "low", dueDate: null, navigationTarget: "/admin/administration/company-details" },
    { key: "later", title: "Later", priority: "high", dueDate: "2026-10-02", navigationTarget: "/admin/administration/company-details" },
    { key: "overdue", title: "Overdue", priority: "medium", dueDate: "2026-09-01", navigationTarget: "/admin/administration/company-details" },
  ], new Date("2026-09-22T00:00:00Z"))
  assert.deepEqual(tasks.map((task) => task.key), ["overdue", "later", "low"])

  const props = {
    data: {
      summary: { companyStatus: "active", activeEmployees: 8, inactiveEmployees: 1, lockedAccounts: 2, auditRecords: 120 },
      completeness: { percent: 80, missing: ["Company logo"] },
      tasks: [{ key: "logo", title: "Upload company logo", description: "Required for documents", priority: "medium", navigationTarget: "/admin/administration/company-details" }],
    },
    loading: false,
    onReload() {},
  }
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(page.AdministrationDashboardView, props)))
  assert.match(html, /Active Employees/)
  assert.match(html, /Locked Accounts/)
  assert.match(html, /Audit Records/)
  assert.match(html, /80%/)
  assert.match(html, /Nearby Tasks/)
  assert.match(html, /href="\/admin\/administration\/company-details"/)

  const emptyHtml = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(page.AdministrationDashboardView, { ...props, data: { ...props.data, tasks: [] } })))
  assert.match(emptyHtml, /No administrative actions need attention/i)
})

test("Administration Dashboard renders retryable API failure state", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/AdministrationDashboard.jsx")
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(page.AdministrationDashboardView, {
    data: null,
    loading: false,
    error: "Network unavailable",
    onReload() {},
  })))
  assert.match(html, /Unable to load Administration Dashboard/i)
  assert.match(html, /Retry/i)
})

test("Administration Departments is a real managed page rather than an upcoming placeholder", async (t) => {
  const registry = await loadPage(t, "/src/Components/Admin/sections.jsx")
  const section = registry.sections["Administration Departments"]
  assert.ok(section)
  assert.notEqual(section.comingSoon, true)
  assert.equal(section.permission, "access-control:view")
})

test("Administration Departments validates required fields and sends the shared record contract", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/AdministrationDepartments.jsx")
  assert.match(page.validateDepartmentForm({ name: "Finance", code: "" }), /code/i)
  assert.match(page.validateDepartmentForm({ name: "", code: "FIN" }), /name/i)
  assert.equal(page.validateDepartmentForm({ name: "Finance", code: "FIN_01", status: "active" }), "")
  assert.deepEqual(page.buildDepartmentPayload({ name: " Finance ", code: " fin_01 ", description: " Accounts ", head: "head-id", status: "inactive" }), {
    name: "Finance", code: "FIN_01", description: "Accounts", head: "head-id", status: "inactive",
  })
})

test("Administration Departments displays code, head, status, and an Administration-only create form", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/AdministrationDepartments.jsx")
  const html = renderToStaticMarkup(React.createElement(page.AdministrationDepartmentsView, {
    departments: [{ _id: "department", name: "Finance", code: "FIN", description: "Accounts", head: { name: "Ayesha" }, isActive: true }],
    heads: [{ _id: "head-id", name: "Ayesha" }],
    form: { name: "", code: "", description: "", head: "", status: "active" },
    canManage: true, modalOpen: true, loading: false,
    onSearch() {}, onOpenCreate() {}, onEdit() {}, onClose() {}, onChange() {}, onSave() {}, onReload() {},
  }))
  for (const label of ["Finance", "FIN", "Ayesha", "Status"]) assert.match(html, new RegExp(label))
  assert.match(html, /Add Department/)
  const formHtml = renderToStaticMarkup(React.createElement(page.DepartmentForm, {
    form: { name: "", code: "", description: "", head: "", status: "active" },
    heads: [{ _id: "head-id", name: "Ayesha" }], onChange() {},
  }))
  for (const label of ["Department Name", "Department Code", "Description", "Department Head", "Status"]) assert.match(formHtml, new RegExp(label))
})

test("Payroll Departments remains a read-only consumer of Administration's master list", async (t) => {
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: () => JSON.stringify({ role: "admin" }) }
  try {
    const page = await loadPage(t, "/src/Components/Admin/payroll/DepartmentPosition.jsx")
    const html = renderToStaticMarkup(React.createElement(page.default, { defaultTab: "departments" }))
    assert.doesNotMatch(html, /Add Department/)
    assert.match(html, /Departments &amp; Positions/)
  } finally { globalThis.localStorage = previousStorage }
})

test("Administration Audit Trail is a real managed page rather than an upcoming placeholder", async (t) => {
  const registry = await loadPage(t, "/src/Components/Admin/sections.jsx")
  const section = registry.sections["Audit Trail"]
  assert.ok(section)
  assert.notEqual(section.comingSoon, true)
  assert.equal(section.permission, "access-control:view")
  assert.ok(section.component)
})

test("Audit Trail utility formatters and badge components produce expected output", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/AuditTrail.jsx")
  assert.equal(page.formatAuditValue(null), "—")
  assert.equal(page.formatAuditValue(undefined), "—")
  assert.equal(page.formatAuditValue(true), "true")
  assert.equal(page.formatAuditValue(false), "false")
  assert.equal(page.formatAuditValue({ a: 1 }), '{"a":1}')
  assert.equal(page.formatAuditValue("short text"), "short text")

  const actionHtml = renderToStaticMarkup(React.createElement(page.ActionBadge, { action: "update" }))
  assert.match(actionHtml, /UPDATE/)

  const moduleHtml = renderToStaticMarkup(React.createElement(page.ModuleBadge, { module: "crm" }))
  assert.match(moduleHtml, /CRM/)
})

test("Administration Role Management is a real managed page rather than an upcoming placeholder", async (t) => {
  const registry = await loadPage(t, "/src/Components/Admin/sections.jsx")
  const section = registry.sections["Role Management"]
  assert.ok(section)
  assert.notEqual(section.comingSoon, true)
  assert.equal(section.permission, "access-control:view")
  assert.ok(section.component)
})

test("Role Management validates form input and serializes role payload", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/RoleManagement.jsx")
  assert.match(page.validateRoleForm({ name: "" }), /role name is required/i)
  assert.match(page.validateRoleForm({ name: "admin" }), /protected system role/i)
  assert.match(page.validateRoleForm({ name: "superadmin" }), /protected system role/i)
  assert.match(page.validateRoleForm({ name: "employee" }), /protected system role/i)
  assert.equal(page.validateRoleForm({ name: "IT Manager" }), "")

  const payload = page.buildRolePayload({
    name: " IT Manager ",
    department: "dept-123",
    description: " Manages IT ",
    status: "active",
    modules: ["manufacturing", "inventory"],
    accessMatrix: [{ submodule: "manufacturing-bom", view: true, create: true }],
  })

  assert.equal(payload.name, "IT Manager")
  assert.equal(payload.department, "dept-123")
  assert.equal(payload.description, "Manages IT")
  assert.equal(payload.isActive, true)
  assert.deepEqual(payload.modules, ["manufacturing", "inventory"])
  assert.equal(payload.accessMatrix.length, 1)
})

test("Role Matrix Table renders submodules and action columns matching the user specification", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/RoleManagement.jsx")
  const sampleCatalogModule = {
    moduleId: "inventory",
    moduleName: "Inventory",
    submodules: [
      {
        key: "inventory-items",
        name: "Inventory Items",
        route: "/inventory/inventory-items",
        actions: { view: "inventory-product:view", create: "inventory-product:manage", edit: "inventory-product:manage", delete: "inventory-product:delete", approve: "inventory-adjustment:approve" },
      },
    ],
  }

  const html = renderToStaticMarkup(
    React.createElement(page.RoleMatrixTable, {
      catalogModule: sampleCatalogModule,
      accessMap: { "inventory-items": { submodule: "inventory-items", view: true, create: true, all: false } },
      onChangeRowAction() {},
      onChangeRowAll() {},
      onToggleColumn() {},
      readOnly: false,
    })
  )

  for (const label of ["Inventory Items", "/inventory/inventory-items", "VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "ALL"]) {
    assert.match(html, new RegExp(label.replace("/", "\\/"), "i"), label)
  }
})

test("Role Management renders Create Role header button and Edit/Delete options for roles", async (t) => {
  const page = await loadPage(t, "/src/Components/Admin/administration/RoleManagement.jsx")

  const sampleRoles = [
    {
      _id: "system:admin",
      name: "Admin",
      description: "Built-in Administrator role",
      isSystem: true,
      isActive: true,
      modules: ["inventory", "manufacturing"],
      permissions: ["inventory-product:view"],
      employeeCount: 2,
    },
    {
      _id: "role-101",
      name: "IT Manager",
      description: "Manages IT operations",
      department: { _id: "dept-1", name: "IT" },
      isSystem: false,
      isActive: true,
      modules: ["manufacturing"],
      permissions: ["manufacturing-work-order:view"],
      employeeCount: 1,
    },
  ]

  const html = renderToStaticMarkup(
    React.createElement(page.RoleManagementView, {
      roles: sampleRoles,
      departments: [{ _id: "dept-1", name: "IT", code: "IT" }],
      catalog: [],
      stats: { totalRoles: 2, activeRoles: 2, customRoles: 1, departmentsCovered: 1 },
      canManage: true,
      loading: false,
    })
  )

  // Verify header has "Create Role" button
  assert.match(html, /Create Role/i, "Create Role button must be visible in header")

  // Verify custom role has Edit and Delete buttons
  assert.match(html, /IT Manager/i)
  assert.match(html, /Edit/i, "Edit button must be visible for custom role")
  assert.match(html, /Delete/i, "Delete button must be visible for custom role")

  // Verify system role has View button
  assert.match(html, /Admin/i)
  assert.match(html, /View/i, "View button must be visible for system role")

  // Verify read-only mode behavior
  const readOnlyHtml = renderToStaticMarkup(
    React.createElement(page.RoleManagementView, {
      roles: sampleRoles,
      departments: [{ _id: "dept-1", name: "IT", code: "IT" }],
      catalog: [],
      stats: { totalRoles: 2, activeRoles: 2, customRoles: 1, departmentsCovered: 1 },
      canManage: false,
      loading: false,
    })
  )
  assert.doesNotMatch(readOnlyHtml, /Create Role/i, "Create Role button must be hidden when cannot manage")
  assert.match(readOnlyHtml, /View/i, "View button must still be available for roles in read-only mode")
  assert.doesNotMatch(readOnlyHtml, /Delete/i, "Delete button must be hidden when cannot manage")

  // Verify empty state renders Create Role button
  const emptyHtml = renderToStaticMarkup(
    React.createElement(page.RoleManagementView, {
      roles: [],
      departments: [],
      catalog: [],
      canManage: true,
      loading: false,
    })
  )
  assert.match(emptyHtml, /No roles configured/i)
  assert.match(emptyHtml, /Create Role/i)
})

