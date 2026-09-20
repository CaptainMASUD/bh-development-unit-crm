export const ERP_MODULES = [
  { id: "crm", code: "CRM", name: "CRM", category: "Sales", description: "Customers, leads, deals, workflows, and CRM reporting.", permissionPrefixes: ["dashboard", "customers", "leads", "deals", "tasks", "reports", "workflow"] },
  { id: "accounting", code: "ACCOUNTING", name: "Accounting", category: "Finance", description: "Accounting setup, ledgers, vouchers, reports, cash, and banking.", permissionPrefixes: ["finance", "expenses", "expense-setup", "bank-setup"] },
  { id: "inventory", code: "INVENTORY", name: "Inventory", category: "Operations", description: "Products, warehouses, stock control, and inventory reporting.", permissionPrefixes: ["inventory-product", "inventory-category", "inventory-brand", "inventory-unit", "inventory-warehouse", "inventory-location", "inventory-stock", "inventory-movement", "inventory-adjustment", "inventory-transfer", "inventory-report", "inventory-reconciliation", "inventory-integrity"] },
  { id: "supplier", code: "SUPPLIER", name: "Supplier", category: "Operations", description: "Supplier onboarding, approvals, and product sourcing.", permissionPrefixes: ["supplier"] },
  { id: "purchase", code: "PURCHASE", name: "Purchase", category: "Operations", description: "Purchase orders, goods receipts, and supplier returns.", permissionPrefixes: ["purchase-order", "commercial-lc", "goods-receipt", "purchase-return", "purchase-request", "purchase-analysis", "purchase-issue", "purchase-quality", "purchase-due", "price-analysis", "purchase-type"] },
  { id: "sales", code: "SALES", name: "Sales", category: "Sales", description: "Quotations, sales orders, deliveries, invoices, customer receipts, returns, and sales reporting.", permissionPrefixes: ["sales-quotation", "sales-order", "sales-delivery", "sales-invoice", "sales-payment", "sales-return", "sales-report"] },
  { id: "manufacturing", code: "MANUFACTURING", name: "Manufacturing", category: "Operations", description: "BOM, routing, MRP, production execution, quality, maintenance, costing, and manufacturing reporting.", permissionPrefixes: ["manufacturing-bom", "manufacturing-routing", "manufacturing-work-center", "manufacturing-machine", "manufacturing-plan", "manufacturing-mrp", "manufacturing-order", "manufacturing-work-order", "manufacturing-material", "manufacturing-production", "manufacturing-wip", "manufacturing-quality", "manufacturing-scrap", "manufacturing-rework", "manufacturing-schedule", "manufacturing-maintenance", "manufacturing-subcontract", "manufacturing-cost", "manufacturing-report"] },
  { id: "payroll", code: "PAYROLL", name: "HR Payroll", category: "People", description: "Employees, attendance, salary, payroll, leave, loans, and tax.", permissionPrefixes: ["attendance", "payroll", "tax", "loans", "leaves", "roster", "employees", "salary"] },
  { id: "administration", code: "ADMINISTRATION", name: "Administration", category: "Operations", description: "Company profile, branches, users, roles, permissions, and settings.", permissionPrefixes: ["users", "notifications", "access-control", "profile", "company", "branch"] },
];

export const ERP_MODULE_IDS = ERP_MODULES.map((item) => item.id);

// This snapshot is intentionally not derived from ERP_MODULE_IDS. Companies
// created before module entitlements existed keep the modules they historically
// had, while modules added to ERP_MODULES later remain opt-in.
export const LEGACY_ENABLED_MODULE_IDS = Object.freeze([
  "crm", "accounting", "inventory", "supplier", "purchase", "payroll", "administration",
]);

export const REQUIRED_MODULE_IDS = Object.freeze(["administration"]);
export const TENANT_ADMIN_ONLY_PERMISSIONS = Object.freeze(["company:view", "company:manage"]);

export const ERP_MODULE_DEPENDENCIES = Object.freeze({
  supplier: Object.freeze(["inventory"]),
  purchase: Object.freeze(["supplier", "inventory"]),
  sales: Object.freeze(["crm", "inventory", "accounting"]),
  manufacturing: Object.freeze(["inventory", "purchase", "accounting"]),
  payroll: Object.freeze(["accounting"]),
});

export const missingModuleDependencies = (values = []) => {
  const selected = new Set(normalizeModuleIds(values));
  return [...selected].flatMap((moduleId) =>
    (ERP_MODULE_DEPENDENCIES[moduleId] || [])
      .filter((dependency) => !selected.has(dependency))
      .map((dependency) => ({ moduleId, dependency }))
  );
};

const PREFIX_MODULE = Object.fromEntries(
  ERP_MODULES.flatMap((module) => (module.permissionPrefixes || []).map((prefix) => [prefix, module.id]))
);

export const normalizeModuleIds = (values, { legacyDefault = false } = {}) => {
  const source = Array.isArray(values)
    ? values
    : legacyDefault ? LEGACY_ENABLED_MODULE_IDS : [];
  return [...new Set([
    ...source.map((item) => String(item || "").trim().toLowerCase()).filter((item) => ERP_MODULE_IDS.includes(item)),
    ...REQUIRED_MODULE_IDS,
  ])];
};

export const unknownModuleIds = (values) => Array.isArray(values)
  ? [...new Set(values.map((item) => String(item || "").trim().toLowerCase()).filter((item) => item && !ERP_MODULE_IDS.includes(item)))]
  : [];

export const permissionModule = (permission) => {
  const value = String(permission || "");
  const prefix = value.includes(":") ? value.split(":")[0] : value.split(".")[0];
  return PREFIX_MODULE[prefix] || null;
};

export const permissionsForModules = (permissions, moduleIds = []) => {
  const enabled = new Set(normalizeModuleIds(moduleIds));
  return (permissions || []).filter((permission) => enabled.has(permissionModule(permission)));
};

export const delegablePermissionsForModules = (permissions, moduleIds = []) => {
  const adminOnly = new Set(TENANT_ADMIN_ONLY_PERMISSIONS);
  return permissionsForModules(permissions, moduleIds).filter((permission) => !adminOnly.has(permission));
};
