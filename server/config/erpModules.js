export const ERP_MODULES = [
  { id: "crm", code: "CRM", name: "CRM", category: "Sales", description: "Customers, leads, deals, workflows, and CRM reporting.", permissionPrefixes: ["dashboard", "customers", "leads", "deals", "tasks", "reports", "workflow"] },
  { id: "accounting", code: "ACCOUNTING", name: "Accounting", category: "Finance", description: "Accounting setup, ledgers, vouchers, reports, cash, and banking.", permissionPrefixes: ["finance", "expenses", "expense-setup", "bank-setup"] },
  { id: "inventory", code: "INVENTORY", name: "Inventory", category: "Operations", description: "Products, warehouses, stock control, and inventory reporting.", permissionPrefixes: ["inventory-product", "inventory-category", "inventory-brand", "inventory-unit", "inventory-warehouse", "inventory-location", "inventory-stock", "inventory-movement", "inventory-adjustment", "inventory-transfer", "inventory-report"] },
  { id: "supplier", code: "SUPPLIER", name: "Supplier", category: "Operations", description: "Supplier onboarding, approvals, and product sourcing.", permissionPrefixes: ["supplier"] },
  { id: "purchase", code: "PURCHASE", name: "Purchase", category: "Operations", description: "Purchase orders, goods receipts, and supplier returns.", permissionPrefixes: ["purchase-order", "goods-receipt", "purchase-return"] },
  { id: "payroll", code: "PAYROLL", name: "HR Payroll", category: "People", description: "Employees, attendance, salary, payroll, leave, loans, and tax.", permissionPrefixes: ["attendance", "payroll", "tax", "loans", "leaves", "roster", "employees", "salary"] },
  { id: "administration", code: "ADMINISTRATION", name: "Administration", category: "Operations", description: "Company profile, branches, users, roles, permissions, and settings.", permissionPrefixes: ["notifications", "access-control", "profile", "company", "branch"] },
];

export const ERP_MODULE_IDS = ERP_MODULES.map((item) => item.id);

// This snapshot is intentionally not derived from ERP_MODULE_IDS. Companies
// created before module entitlements existed keep the modules they historically
// had, while modules added to ERP_MODULES later remain opt-in.
export const LEGACY_ENABLED_MODULE_IDS = Object.freeze([
  "crm", "accounting", "inventory", "supplier", "purchase", "payroll", "administration",
]);

export const REQUIRED_MODULE_IDS = Object.freeze(["administration"]);

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
