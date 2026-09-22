/**
 * ERP Role Accessibility Matrix Catalog
 * Defines all ERP modules, submodules, route paths, and action capability mappings.
 */

export const ROLE_MATRIX_CATALOG = [
  {
    moduleId: "manufacturing",
    moduleName: "Manufacturing",
    submodules: [
      {
        key: "manufacturing-bom",
        name: "Bill of Materials",
        route: "/manufacturing/bom",
        actions: {
          view: "manufacturing-bom:view",
          create: "manufacturing-bom:manage",
          edit: "manufacturing-bom:manage",
          delete: "manufacturing-bom:delete",
          approve: "manufacturing-bom:approve",
        },
      },
      {
        key: "manufacturing-routing",
        name: "Routings",
        route: "/manufacturing/routing",
        actions: {
          view: "manufacturing-routing:view",
          create: "manufacturing-routing:manage",
          edit: "manufacturing-routing:manage",
          delete: "manufacturing-routing:delete",
        },
      },
      {
        key: "manufacturing-work-center",
        name: "Work Centers",
        route: "/manufacturing/work-center",
        actions: {
          view: "manufacturing-work-center:view",
          create: "manufacturing-work-center:manage",
          edit: "manufacturing-work-center:manage",
          delete: "manufacturing-work-center:delete",
        },
      },
      {
        key: "manufacturing-machine",
        name: "Machines",
        route: "/manufacturing/machine",
        actions: {
          view: "manufacturing-machine:view",
          create: "manufacturing-machine:manage",
          edit: "manufacturing-machine:manage",
          delete: "manufacturing-machine:delete",
        },
      },
      {
        key: "manufacturing-plan",
        name: "Production Plans",
        route: "/manufacturing/plan",
        actions: {
          view: "manufacturing-plan:view",
          create: "manufacturing-plan:manage",
          edit: "manufacturing-plan:manage",
          delete: "manufacturing-plan:delete",
          approve: "manufacturing-plan:approve",
        },
      },
      {
        key: "manufacturing-mrp",
        name: "MRP",
        route: "/manufacturing/mrp",
        actions: {
          view: "manufacturing-mrp:view",
          create: "manufacturing-mrp:manage",
          edit: "manufacturing-mrp:manage",
        },
      },
      {
        key: "manufacturing-order",
        name: "Manufacturing Orders",
        route: "/manufacturing/order",
        actions: {
          view: "manufacturing-order:view",
          create: "manufacturing-order:manage",
          edit: "manufacturing-order:manage",
          delete: "manufacturing-order:delete",
          approve: "manufacturing-order:release",
        },
      },
      {
        key: "manufacturing-work-order",
        name: "Work Orders",
        route: "/manufacturing/work-order",
        actions: {
          view: "manufacturing-work-order:view",
          create: "manufacturing-work-order:manage",
          edit: "manufacturing-work-order:manage",
          approve: "manufacturing-work-order:execute",
        },
      },
      {
        key: "manufacturing-material",
        name: "Material Issues",
        route: "/manufacturing/material",
        actions: {
          view: "manufacturing-material:view",
          create: "manufacturing-material:manage",
          edit: "manufacturing-material:manage",
          approve: "manufacturing-material:post",
        },
      },
      {
        key: "manufacturing-production",
        name: "Production Entries",
        route: "/manufacturing/production",
        actions: {
          view: "manufacturing-production:view",
          create: "manufacturing-production:manage",
          edit: "manufacturing-production:manage",
          approve: "manufacturing-production:post",
        },
      },
      {
        key: "manufacturing-wip",
        name: "Work In Progress (WIP)",
        route: "/manufacturing/wip",
        actions: {
          view: "manufacturing-wip:view",
        },
      },
      {
        key: "manufacturing-quality",
        name: "Quality Inspections",
        route: "/manufacturing/quality",
        actions: {
          view: "manufacturing-quality:view",
          create: "manufacturing-quality:manage",
          edit: "manufacturing-quality:manage",
          approve: "manufacturing-quality:approve",
        },
      },
      {
        key: "manufacturing-scrap",
        name: "Scrap & Wastage",
        route: "/manufacturing/scrap",
        actions: {
          view: "manufacturing-scrap:view",
          create: "manufacturing-scrap:manage",
          edit: "manufacturing-scrap:manage",
          delete: "manufacturing-scrap:delete",
        },
      },
      {
        key: "manufacturing-rework",
        name: "Rework Orders",
        route: "/manufacturing/rework",
        actions: {
          view: "manufacturing-rework:view",
          create: "manufacturing-rework:manage",
          edit: "manufacturing-rework:manage",
          delete: "manufacturing-rework:delete",
        },
      },
      {
        key: "manufacturing-schedule",
        name: "Production Schedules",
        route: "/manufacturing/schedule",
        actions: {
          view: "manufacturing-schedule:view",
          create: "manufacturing-schedule:manage",
          edit: "manufacturing-schedule:manage",
          delete: "manufacturing-schedule:delete",
        },
      },
      {
        key: "manufacturing-maintenance",
        name: "Maintenance Plans",
        route: "/manufacturing/maintenance",
        actions: {
          view: "manufacturing-maintenance:view",
          create: "manufacturing-maintenance:manage",
          edit: "manufacturing-maintenance:manage",
        },
      },
      {
        key: "manufacturing-subcontract",
        name: "Subcontracting",
        route: "/manufacturing/subcontract",
        actions: {
          view: "manufacturing-subcontract:view",
          create: "manufacturing-subcontract:manage",
          edit: "manufacturing-subcontract:manage",
          delete: "manufacturing-subcontract:delete",
        },
      },
      {
        key: "manufacturing-cost",
        name: "Manufacturing Costing",
        route: "/manufacturing/cost",
        actions: {
          view: "manufacturing-cost:view",
          create: "manufacturing-cost:manage",
          edit: "manufacturing-cost:manage",
        },
      },
      {
        key: "manufacturing-report",
        name: "Manufacturing Reports",
        route: "/manufacturing/reports",
        actions: {
          view: "manufacturing-report:view",
        },
      },
    ],
  },

  {
    moduleId: "inventory",
    moduleName: "Inventory",
    submodules: [
      {
        key: "inventory-items",
        name: "Inventory Items",
        route: "/inventory/inventory-items",
        actions: {
          view: "inventory-product:view",
          create: "inventory-product:manage",
          edit: "inventory-product:manage",
          delete: "inventory-product:delete",
          approve: "inventory-adjustment:approve",
        },
      },
      {
        key: "item-profiles",
        name: "Item Profiles",
        route: "/inventory/item-profiles",
        actions: {
          view: "inventory-product:view",
          create: "inventory-product:manage",
          edit: "inventory-product:manage",
          delete: "inventory-product:delete",
        },
      },
      {
        key: "inventory-products",
        name: "Products",
        route: "/inventory/products",
        actions: {
          view: "inventory-product:view",
          create: "inventory-product:manage",
          edit: "inventory-product:manage",
          delete: "inventory-product:delete",
        },
      },
      {
        key: "inventory-categories",
        name: "Categories",
        route: "/inventory/categories",
        actions: {
          view: "inventory-category:view",
          create: "inventory-category:manage",
          edit: "inventory-category:manage",
          delete: "inventory-category:delete",
        },
      },
      {
        key: "inventory-units",
        name: "Units of Measure",
        route: "/inventory/units",
        actions: {
          view: "inventory-unit:view",
          create: "inventory-unit:manage",
          edit: "inventory-unit:manage",
          delete: "inventory-unit:delete",
        },
      },
      {
        key: "inventory-brands",
        name: "Brands",
        route: "/inventory/brands",
        actions: {
          view: "inventory-brand:view",
          create: "inventory-brand:manage",
          edit: "inventory-brand:manage",
          delete: "inventory-brand:delete",
        },
      },
      {
        key: "inventory-warehouses",
        name: "Warehouses",
        route: "/inventory/warehouses",
        actions: {
          view: "inventory-warehouse:view",
          create: "inventory-warehouse:manage",
          edit: "inventory-warehouse:manage",
          delete: "inventory-warehouse:delete",
        },
      },
      {
        key: "inventory-locations",
        name: "Locations / Bins / Shelves",
        route: "/inventory/warehouse-locations",
        actions: {
          view: "inventory-location:view",
          create: "inventory-location:manage",
          edit: "inventory-location:manage",
          delete: "inventory-location:delete",
        },
      },
      {
        key: "inventory-movements",
        name: "Stock Movements",
        route: "/inventory/stock-movements",
        actions: {
          view: "inventory-movement:view",
          create: "inventory-movement:manage",
          edit: "inventory-movement:manage",
          delete: "inventory-movement:delete",
          approve: "inventory-movement:post",
        },
      },
      {
        key: "inventory-adjustments",
        name: "Stock Adjustments",
        route: "/inventory/stock-adjustments",
        actions: {
          view: "inventory-adjustment:view",
          create: "inventory-adjustment:manage",
          edit: "inventory-adjustment:manage",
          delete: "inventory-adjustment:delete",
          approve: "inventory-adjustment:approve",
        },
      },
      {
        key: "inventory-transfers",
        name: "Stock Transfers",
        route: "/inventory/stock-transfers",
        actions: {
          view: "inventory-transfer:view",
          create: "inventory-transfer:manage",
          edit: "inventory-transfer:manage",
          delete: "inventory-transfer:delete",
          approve: "inventory-transfer:approve",
        },
      },
      {
        key: "inventory-revaluations",
        name: "Inventory Revaluations",
        route: "/inventory/revaluations",
        actions: {
          view: "inventory-adjustment:view",
          create: "inventory-adjustment:manage",
          edit: "inventory-adjustment:manage",
          approve: "inventory-adjustment:approve",
        },
      },
      {
        key: "inventory-reports",
        name: "Inventory Reports",
        route: "/inventory/reports",
        actions: {
          view: "inventory-report:view",
        },
      },
    ],
  },

  {
    moduleId: "sales",
    moduleName: "Sales",
    submodules: [
      {
        key: "sales-quotations",
        name: "Sales Quotations",
        route: "/sales/quotations",
        actions: {
          view: "sales-quotation:view",
          create: "sales-quotation:manage",
          edit: "sales-quotation:manage",
          delete: "sales-quotation:manage",
        },
      },
      {
        key: "sales-orders",
        name: "Sales Orders",
        route: "/sales/orders",
        actions: {
          view: "sales-order:view",
          create: "sales-order:manage",
          edit: "sales-order:manage",
          delete: "sales-order:manage",
          approve: "sales-order:approve",
        },
      },
      {
        key: "sales-deliveries",
        name: "Deliveries",
        route: "/sales/deliveries",
        actions: {
          view: "sales-delivery:view",
          create: "sales-delivery:manage",
          edit: "sales-delivery:manage",
          delete: "sales-delivery:manage",
          approve: "sales-delivery:post",
        },
      },
      {
        key: "sales-invoices",
        name: "Sales Invoices",
        route: "/sales/invoices",
        actions: {
          view: "sales-invoice:view",
          create: "sales-invoice:manage",
          edit: "sales-invoice:manage",
          delete: "sales-invoice:manage",
          approve: "sales-invoice:post",
        },
      },
      {
        key: "sales-payments",
        name: "Sales Receipts & Payments",
        route: "/sales/payments",
        actions: {
          view: "sales-invoice:view",
          create: "sales-payment:manage",
          edit: "sales-payment:manage",
          approve: "sales-payment:manage",
        },
      },
      {
        key: "sales-returns",
        name: "Sales Returns",
        route: "/sales/returns",
        actions: {
          view: "sales-return:view",
          create: "sales-return:manage",
          edit: "sales-return:manage",
          delete: "sales-return:manage",
          approve: "sales-return:approve",
        },
      },
      {
        key: "sales-reports",
        name: "Sales Reports",
        route: "/sales/reports",
        actions: {
          view: "sales-report:view",
        },
      },
    ],
  },

  {
    moduleId: "purchase",
    moduleName: "Purchase",
    submodules: [
      {
        key: "purchase-orders",
        name: "Purchase Orders",
        route: "/purchase/orders",
        actions: {
          view: "purchase-order:view",
          create: "purchase-order:manage",
          edit: "purchase-order:manage",
          delete: "purchase-order:delete",
          approve: "purchase-order:approve",
        },
      },
      {
        key: "goods-receipts",
        name: "Goods Receipts",
        route: "/purchase/goods-receipts",
        actions: {
          view: "goods-receipt:view",
          create: "goods-receipt:manage",
          edit: "goods-receipt:manage",
          delete: "goods-receipt:delete",
          approve: "goods-receipt:approve",
        },
      },
      {
        key: "purchase-returns",
        name: "Purchase Returns",
        route: "/purchase/returns",
        actions: {
          view: "purchase-return:view",
          create: "purchase-return:manage",
          edit: "purchase-return:manage",
          delete: "purchase-return:delete",
          approve: "purchase-return:approve",
        },
      },
      {
        key: "commercial-lcs",
        name: "Commercial LCs",
        route: "/purchase/commercial-lcs",
        actions: {
          view: "commercial-lc:view",
          create: "commercial-lc:manage",
          edit: "commercial-lc:manage",
          delete: "commercial-lc:manage",
          approve: "commercial-lc:approve",
        },
      },
      {
        key: "purchase-requests",
        name: "Purchase Requests",
        route: "/purchase/requests",
        actions: {
          view: "purchase-request:view",
          create: "purchase-request:manage",
          edit: "purchase-request:manage",
          approve: "purchase-request:approve",
        },
      },
      {
        key: "purchase-analysis",
        name: "Purchase Analysis",
        route: "/purchase/analysis",
        actions: {
          view: "purchase-analysis:view",
          create: "purchase-analysis:manage",
          edit: "purchase-analysis:manage",
        },
      },
      {
        key: "purchase-issues",
        name: "Purchase Issues",
        route: "/purchase/issues",
        actions: {
          view: "purchase-issue:view",
          create: "purchase-issue:manage",
          edit: "purchase-issue:manage",
        },
      },
      {
        key: "purchase-quality",
        name: "Purchase Quality Inspections",
        route: "/purchase/quality",
        actions: {
          view: "purchase-quality:view",
          create: "purchase-quality:manage",
          edit: "purchase-quality:manage",
        },
      },
      {
        key: "purchase-dues",
        name: "Purchase Dues",
        route: "/purchase/dues",
        actions: {
          view: "purchase-due:view",
          create: "purchase-due:pay",
          edit: "purchase-due:pay",
          approve: "purchase-due:pay",
        },
      },
      {
        key: "price-analysis",
        name: "Price Analysis",
        route: "/purchase/price-analysis",
        actions: {
          view: "price-analysis:view",
          create: "price-analysis:review",
          edit: "price-analysis:review",
        },
      },
      {
        key: "purchase-types",
        name: "Purchase Types",
        route: "/purchase/types",
        actions: {
          view: "purchase-type:view",
          create: "purchase-type:manage",
          edit: "purchase-type:manage",
        },
      },
    ],
  },

  {
    moduleId: "supplier",
    moduleName: "Supplier",
    submodules: [
      {
        key: "suppliers",
        name: "Suppliers",
        route: "/suppliers",
        actions: {
          view: "supplier:view",
          create: "supplier:manage",
          edit: "supplier:manage",
          delete: "supplier:delete",
          approve: "supplier:approve",
        },
      },
      {
        key: "supplier-products",
        name: "Supplier Products",
        route: "/supplier-products",
        actions: {
          view: "supplier:view",
          create: "supplier:manage",
          edit: "supplier:manage",
          delete: "supplier:delete",
        },
      },
    ],
  },

  {
    moduleId: "crm",
    moduleName: "CRM",
    submodules: [
      {
        key: "crm-dashboard",
        name: "CRM Dashboard",
        route: "/crm/dashboard",
        actions: {
          view: "dashboard:view",
        },
      },
      {
        key: "crm-customers",
        name: "Customers & Clients",
        route: "/crm/customers",
        actions: {
          view: "customers:view",
          create: "customers:manage",
          edit: "customers:manage",
          delete: "customers:manage",
        },
      },
      {
        key: "crm-leads",
        name: "Leads",
        route: "/crm/leads",
        actions: {
          view: "leads:view",
          create: "leads:manage",
          edit: "leads:manage",
          delete: "leads:manage",
        },
      },
      {
        key: "crm-deals",
        name: "Deals",
        route: "/crm/deals",
        actions: {
          view: "deals:view",
          create: "deals:manage",
          edit: "deals:manage",
          delete: "deals:manage",
        },
      },
      {
        key: "crm-tasks",
        name: "Tasks & Work Queue",
        route: "/crm/tasks",
        actions: {
          view: "tasks:view",
          create: "tasks:manage",
          edit: "tasks:manage",
          delete: "tasks:manage",
        },
      },
      {
        key: "crm-workflows",
        name: "Workflows & Templates",
        route: "/crm/workflows",
        actions: {
          view: "workflow:view",
          create: "workflow:view",
          edit: "workflow:view",
        },
      },
      {
        key: "crm-reports",
        name: "CRM Reports",
        route: "/crm/reports",
        actions: {
          view: "reports:view",
        },
      },
    ],
  },

  {
    moduleId: "accounting",
    moduleName: "Accounting",
    submodules: [
      {
        key: "chart-of-accounts",
        name: "Chart of Accounts",
        route: "/accounting/chart-of-accounts",
        actions: {
          view: "finance:view",
          create: "finance:manage",
          edit: "finance:manage",
          delete: "finance:manage",
        },
      },
      {
        key: "journal-entries",
        name: "Journal Entries",
        route: "/accounting/journal-entries",
        actions: {
          view: "finance:view",
          create: "finance:manage",
          edit: "finance:manage",
          delete: "finance:manage",
          approve: "finance:manage",
        },
      },
      {
        key: "cost-centers",
        name: "Cost Centers",
        route: "/accounting/cost-centers",
        actions: {
          view: "finance:cost-center:view",
          create: "finance:cost-center:manage",
          edit: "finance:cost-center:manage",
          delete: "finance:cost-center:manage",
        },
      },
      {
        key: "accounting-dimensions",
        name: "Accounting Dimensions",
        route: "/accounting/dimensions",
        actions: {
          view: "finance:dimension:view",
          create: "finance:dimension:manage",
          edit: "finance:dimension:manage",
          delete: "finance:dimension:manage",
        },
      },
      {
        key: "accounts-receivable",
        name: "Accounts Receivable",
        route: "/accounting/accounts-receivable",
        actions: {
          view: "finance:view",
          create: "finance:manage",
          edit: "finance:manage",
        },
      },
      {
        key: "accounts-payable",
        name: "Accounts Payable",
        route: "/accounting/accounts-payable",
        actions: {
          view: "finance:view",
          create: "finance:manage",
          edit: "finance:manage",
        },
      },
      {
        key: "cash-management",
        name: "Cash Management",
        route: "/accounting/cash-management",
        actions: {
          view: "finance:view",
          create: "finance:manage",
          edit: "finance:manage",
        },
      },
      {
        key: "treasury-vouchers",
        name: "Treasury & Vouchers",
        route: "/accounting/vouchers",
        actions: {
          view: "finance:view",
          create: "finance:manage",
          edit: "finance:manage",
          approve: "finance:manage",
        },
      },
      {
        key: "bank-reconciliation",
        name: "Bank Accounts & Reconciliation",
        route: "/accounting/banking",
        actions: {
          view: "finance:view",
          create: "finance:manage",
          edit: "finance:manage",
          approve: "finance:manage",
        },
      },
      {
        key: "accounting-expenses",
        name: "Expenses",
        route: "/accounting/expenses",
        actions: {
          view: "expenses:view",
          create: "expenses:manage",
          edit: "expenses:manage",
          approve: "expenses:manage",
        },
      },
      {
        key: "financial-reports",
        name: "Financial Reports",
        route: "/accounting/reports",
        actions: {
          view: "finance:view",
        },
      },
    ],
  },

  {
    moduleId: "payroll",
    moduleName: "HR Payroll",
    submodules: [
      {
        key: "payroll-employees",
        name: "Employees",
        route: "/payroll/employees",
        actions: {
          view: "employees:view",
          create: "employees:manage",
          edit: "employees:manage",
          delete: "employees:manage",
        },
      },
      {
        key: "payroll-attendance",
        name: "Attendance",
        route: "/payroll/attendance",
        actions: {
          view: "attendance:view",
          create: "attendance:manage",
          edit: "attendance:manage",
          approve: "attendance:manage",
        },
      },
      {
        key: "payroll-salary",
        name: "Salary Profiles",
        route: "/payroll/salary",
        actions: {
          view: "salary:view",
          create: "salary:manage",
          edit: "salary:manage",
          approve: "salary:manage",
        },
      },
      {
        key: "payroll-processing",
        name: "Payroll Processing",
        route: "/payroll/process",
        actions: {
          view: "payroll:view",
          create: "payroll:manage",
          edit: "payroll:manage",
          approve: "payroll:approve",
        },
      },
      {
        key: "payroll-tax",
        name: "Tax Management",
        route: "/payroll/tax",
        actions: {
          view: "tax.view",
          create: "tax.create",
          edit: "tax.update",
          delete: "tax.delete",
          approve: "tax.report",
        },
      },
      {
        key: "payroll-loans",
        name: "Employee Loans",
        route: "/payroll/loans",
        actions: {
          view: "loans:view",
          create: "loans:manage",
          edit: "loans:manage",
          approve: "loans:manage",
        },
      },
      {
        key: "payroll-leaves",
        name: "Leave Requests",
        route: "/payroll/leaves",
        actions: {
          view: "leaves:view",
          create: "leaves:manage",
          edit: "leaves:manage",
          approve: "leaves:manage",
        },
      },
      {
        key: "payroll-roster",
        name: "Roster & Shifts",
        route: "/payroll/roster",
        actions: {
          view: "roster:view",
          create: "roster:manage",
          edit: "roster:manage",
        },
      },
    ],
  },

  {
    moduleId: "administration",
    moduleName: "Administration",
    submodules: [
      {
        key: "admin-company",
        name: "Company Details",
        route: "/admin/company",
        actions: {
          view: "company:view",
          edit: "company:manage",
        },
      },
      {
        key: "admin-settings",
        name: "System Defaults",
        route: "/admin/settings",
        actions: {
          view: "system-settings:view",
          edit: "system-settings:manage",
        },
      },
      {
        key: "admin-document-numbering",
        name: "Document Numbering",
        route: "/admin/document-numbering",
        actions: {
          view: "system-settings:view",
          edit: "system-settings:manage",
        },
      },
      {
        key: "admin-audit-trail",
        name: "Audit Trail",
        route: "/admin/audit-trail",
        actions: {
          view: "access-control:view",
        },
      },
      {
        key: "admin-roles",
        name: "Role Management",
        route: "/admin/roles",
        actions: {
          view: "access-control:view",
          create: "access-control:manage",
          edit: "access-control:manage",
          delete: "access-control:manage",
        },
      },
      {
        key: "admin-departments",
        name: "Administration Departments",
        route: "/admin/departments",
        actions: {
          view: "access-control:view",
          create: "access-control:manage",
          edit: "access-control:manage",
          delete: "access-control:manage",
        },
      },
      {
        key: "admin-add-employee",
        name: "Add Employee",
        route: "/admin/add-employee",
        actions: {
          view: "employees:view",
          create: "employees:manage",
          edit: "employees:manage",
        },
      },
    ],
  },
];

/**
 * Maps a list of accessMatrix rows to an array of canonical permission strings.
 * @param {Array<{ submodule: string, view: boolean, create: boolean, edit: boolean, delete: boolean, approve: boolean }>} matrix
 * @returns {string[]}
 */
export function matrixToPermissions(matrix = []) {
  if (!Array.isArray(matrix)) return [];

  const submodulesMap = new Map();
  for (const mod of ROLE_MATRIX_CATALOG) {
    for (const sub of mod.submodules) {
      submodulesMap.set(sub.key, sub);
    }
  }

  const permissions = new Set();

  for (const row of matrix) {
    if (!row || !row.submodule) continue;
    const sub = submodulesMap.get(row.submodule);
    if (!sub || !sub.actions) continue;

    const hasAnyActiveAction = Boolean(
      row.view || row.create || row.edit || row.delete || row.approve
    );

    // If any action is selected, view permission is automatically included
    if (hasAnyActiveAction && sub.actions.view) {
      permissions.add(sub.actions.view);
    }

    if (row.create && sub.actions.create) {
      permissions.add(sub.actions.create);
    }
    if (row.edit && sub.actions.edit) {
      permissions.add(sub.actions.edit);
    }
    if (row.delete && sub.actions.delete) {
      permissions.add(sub.actions.delete);
    }
    if (row.approve && sub.actions.approve) {
      permissions.add(sub.actions.approve);
    }
  }

  return [...permissions];
}

/**
 * Reconstitutes the accessMatrix rows for a given array of permissions.
 * @param {string[]} permissions
 * @param {string[]} selectedModules
 * @returns {Array<{ submodule: string, view: boolean, create: boolean, edit: boolean, delete: boolean, approve: boolean, all: boolean }>}
 */
export function permissionsToMatrix(permissions = [], selectedModules = null) {
  const permSet = new Set(Array.isArray(permissions) ? permissions : []);
  const activeModuleSet = selectedModules
    ? new Set(selectedModules.map((m) => String(m).toLowerCase()))
    : null;

  const matrix = [];

  for (const mod of ROLE_MATRIX_CATALOG) {
    if (activeModuleSet && !activeModuleSet.has(mod.moduleId.toLowerCase())) {
      continue;
    }

    for (const sub of mod.submodules) {
      const actions = sub.actions || {};
      const view = actions.view ? permSet.has(actions.view) : false;
      const create = actions.create ? permSet.has(actions.create) : false;
      const edit = actions.edit ? permSet.has(actions.edit) : false;
      const del = actions.delete ? permSet.has(actions.delete) : false;
      const approve = actions.approve ? permSet.has(actions.approve) : false;

      // Count available actions for this submodule
      const available = [
        actions.view,
        actions.create,
        actions.edit,
        actions.delete,
        actions.approve,
      ].filter(Boolean);

      const all =
        available.length > 0 &&
        (!actions.view || view) &&
        (!actions.create || create) &&
        (!actions.edit || edit) &&
        (!actions.delete || del) &&
        (!actions.approve || approve);

      matrix.push({
        submodule: sub.key,
        view,
        create,
        edit,
        delete: del,
        approve,
        all,
      });
    }
  }

  return matrix;
}
