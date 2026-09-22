import { isSensitiveAuditKey, redactAuditValue } from "../utils/auditRedaction.js";

export const EXCLUDED_AUDIT_MODELS = new Set([
  "AuditLog",
  "auditlogs",
  "DocumentNumberCounter",
  "DocumentNumberClaim",
  "Session",
  "ViewPreference",
  "Notification",
  "NotificationPreference",
  "ActivityLog",
  "ConversionLog",
]);

export const MODEL_MODULE_MAP = Object.freeze({
  // CRM
  Customer: "crm",
  Lead: "crm",
  Deal: "crm",
  Proposal: "crm",
  Activity: "crm",
  WorkQueue: "crm",
  Template: "crm",
  MessageTemplate: "crm",
  LeadAssignmentRule: "crm",
  AutomationRule: "crm",
  SalesStageHistory: "crm",
  Note: "crm",

  // Inventory
  Product: "inventory",
  ProductCategory: "inventory",
  ProductBrand: "inventory",
  InventoryUnit: "inventory",
  Warehouse: "inventory",
  WarehouseLocation: "inventory",
  StockMovement: "inventory",
  StockAdjustment: "inventory",
  StockTransfer: "inventory",
  WarehouseCheck: "inventory",
  BatchLot: "inventory",
  SerialNumber: "inventory",
  ExpiryTracking: "inventory",
  InventoryValuation: "inventory",
  InventoryRevaluation: "inventory",
  InventoryLoss: "inventory",
  ProductStock: "inventory",
  StockRequest: "inventory",
  ItemProfile: "inventory",

  // Purchase
  PurchaseOrder: "purchase",
  PurchaseRequest: "purchase",
  GoodsReceipt: "purchase",
  PurchaseReturn: "purchase",
  CommercialLC: "purchase",
  LandedCost: "purchase",
  PurchaseType: "purchase",
  PurchaseInvoice: "purchase",

  // Supplier
  Supplier: "supplier",
  SupplierProduct: "supplier",
  SupplierQuote: "supplier",

  // Sales
  SalesQuotation: "sales",
  SalesOrder: "sales",
  SalesDelivery: "sales",
  SalesInvoice: "sales",
  SalesReturn: "sales",
  Payment: "sales",

  // Manufacturing
  BillOfMaterial: "manufacturing",
  Routing: "manufacturing",
  WorkCenter: "manufacturing",
  Machine: "manufacturing",
  ProductionPlan: "manufacturing",
  MRP: "manufacturing",
  ManufacturingOrder: "manufacturing",
  WorkOrder: "manufacturing",
  MaterialIssue: "manufacturing",
  ProductionEntry: "manufacturing",
  WorkInProgress: "manufacturing",
  QualityInspection: "manufacturing",
  ReworkOrder: "manufacturing",
  ScrapWastage: "manufacturing",
  MaintenancePlan: "manufacturing",
  MaintenanceOrder: "manufacturing",
  Subcontracting: "manufacturing",
  ManufacturingCosting: "manufacturing",

  // Accounting
  Account: "accounting",
  JournalEntry: "accounting",
  FiscalYear: "accounting",
  AccountingPeriod: "accounting",
  Bank: "accounting",
  BankAccount: "accounting",
  BankTransaction: "accounting",
  BankReconciliation: "accounting",
  CashAccount: "accounting",
  Expense: "accounting",
  ExpenseCategory: "accounting",
  CostCenter: "accounting",
  AccountingDimension: "accounting",
  AccountingDimensionValue: "accounting",
  OpeningBalance: "accounting",
  TaxSlab: "accounting",
  VendorBill: "accounting",
  TreasuryVoucher: "accounting",
  AccountingSettings: "accounting",
  VoucherType: "accounting",
  VoucherSequence: "accounting",

  // Payroll
  Department: "payroll",
  Position: "payroll",
  Attendance: "payroll",
  Salary: "payroll",
  Payroll: "payroll",
  EmployeeLoan: "payroll",
  LeaveRequest: "payroll",
  LeaveTemplate: "payroll",
  RosterShift: "payroll",
  WeeklyOff: "payroll",
  Holiday: "payroll",
  Payslip: "payroll",

  // Administration
  Company: "administration",
  Branch: "administration",
  User: "administration",
  CompanyMembership: "administration",
  AccessRole: "administration",
  PermissionGroup: "administration",
  SystemSettings: "administration",
  DocumentNumberRule: "administration",
});

export const getModuleForModel = (modelName = "") => {
  const name = String(modelName || "").trim();
  if (MODEL_MODULE_MAP[name]) return MODEL_MODULE_MAP[name];

  const lower = name.toLowerCase();
  if (lower.includes("crm") || lower.includes("lead") || lower.includes("deal") || lower.includes("customer")) return "crm";
  if (lower.includes("stock") || lower.includes("inventory") || lower.includes("warehouse") || lower.includes("product")) return "inventory";
  if (lower.includes("purchase") || lower.includes("lc") || lower.includes("receipt")) return "purchase";
  if (lower.includes("supplier") || lower.includes("vendor")) return "supplier";
  if (lower.includes("sales") || lower.includes("delivery") || lower.includes("invoice") || lower.includes("quotation")) return "sales";
  if (lower.includes("manufacturing") || lower.includes("bom") || lower.includes("routing") || lower.includes("workorder")) return "manufacturing";
  if (lower.includes("account") || lower.includes("finance") || lower.includes("journal") || lower.includes("ledger") || lower.includes("fiscal")) return "accounting";
  if (lower.includes("payroll") || lower.includes("salary") || lower.includes("attendance") || lower.includes("roster") || lower.includes("leave")) return "payroll";
  if (lower.includes("company") || lower.includes("branch") || lower.includes("setting") || lower.includes("role") || lower.includes("permission") || lower.includes("user")) return "administration";

  return "general";
};

export const getRecordIdentifier = (doc = {}) => {
  if (!doc || typeof doc !== "object") return "";
  const values = [
    doc.documentNumber,
    doc.invoiceNumber,
    doc.soNumber,
    doc.poNumber,
    doc.orderNo,
    doc.leadNo,
    doc.dealNo,
    doc.customerNo,
    doc.voucherNo,
    doc.code,
    doc.accountCode,
    doc.reference,
    doc.name,
    doc.title,
    doc.subject,
    doc.username,
    doc.email,
    doc.companyName,
  ];

  for (const v of values) {
    if (v != null && String(v).trim()) {
      return String(v).trim();
    }
  }

  return doc._id ? String(doc._id) : "";
};

const IGNORED_PATHS = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "passwordResetToken",
  "passwordResetExpires",
  "_originalState",
  "_wasNew",
  "_auditChanges",
  "_auditBefore",
  "_auditAfter",
  "_skipAutoAudit",
]);

export function computeFieldDiff(beforeObj = {}, afterObj = {}, modifiedPaths = null) {
  const before = beforeObj || {};
  const after = afterObj || {};
  const changes = [];
  const changedBefore = {};
  const changedAfter = {};

  const paths = Array.isArray(modifiedPaths) && modifiedPaths.length
    ? modifiedPaths
    : [...new Set([...Object.keys(before), ...Object.keys(after)])];

  for (const path of paths) {
    const rootKey = String(path).split(".")[0];
    if (IGNORED_PATHS.has(rootKey) || IGNORED_PATHS.has(path)) continue;

    const beforeVal = before[path] !== undefined ? before[path] : getNestedProperty(before, path);
    const afterVal = after[path] !== undefined ? after[path] : getNestedProperty(after, path);

    const beforeStr = JSON.stringify(beforeVal);
    const afterStr = JSON.stringify(afterVal);

    if (beforeStr !== afterStr) {
      const isSensitive = isSensitiveAuditKey(path) || isSensitiveAuditKey(rootKey);
      const safeBefore = isSensitive ? "[REDACTED]" : redactAuditValue(beforeVal);
      const safeAfter = isSensitive ? "[REDACTED]" : redactAuditValue(afterVal);

      changes.push({
        path,
        before: safeBefore,
        after: safeAfter,
      });
      changedBefore[path] = safeBefore;
      changedAfter[path] = safeAfter;
    }
  }

  return { changes, before: changedBefore, after: changedAfter };
}

function getNestedProperty(obj, path) {
  if (!obj || typeof obj !== "object" || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}
