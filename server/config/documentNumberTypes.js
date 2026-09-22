// Application-owned, user-visible identifiers. External references are deliberately absent.
const define = (key, model, field, producer, options = {}) => {
  const module = key.split(".")[0];
  const suffix = key.split(".").slice(1).join(" ");
  return Object.freeze({
    key,
    module,
    label: options.label || suffix.replace(/(^|[ -])\w/g, (letter) => letter.toUpperCase()),
    model,
    field,
    producers: Object.freeze([producer, ...(options.additionalProducers || [])]),
    mode: options.mode || "auto",
    prefix: options.prefix || key.split(".")[1].replace(/[^a-z]/g, "").slice(0, 3).toUpperCase(),
    pattern: options.pattern || "{PREFIX}-{DATE}-{SERIAL}",
    serialWidth: options.serialWidth ?? 4,
    resetPolicy: options.resetPolicy || "none",
    contextTokens: Object.freeze(options.contextTokens || []),
    partitionBy: options.partitionBy || "none",
    maxLength: options.maxLength || 80,
    legacyFormatter: options.legacyFormatter || "",
  });
};

export const DOCUMENT_NUMBER_TYPES = Object.freeze([
  define("inventory.product", "Product", "sku", "controllers/inventory/product.controller.js", { label: "Product Code", prefix: "PC", pattern: "{CATEGORY}{SERIAL}", serialWidth: 1, contextTokens: ["CATEGORY"], partitionBy: "category" }),
  define("inventory.category", "ProductCategory", "code", "controllers/inventory/productCategory.controller.js", { label: "Category Code", prefix: "CAT", mode: "manual", maxLength: 50 }),
  define("inventory.unit", "InventoryUnit", "code", "controllers/inventory/inventoryUnit.controller.js", { label: "Unit Code", prefix: "UOM", maxLength: 50 }),
  define("inventory.warehouse", "Warehouse", "code", "controllers/inventory/warehouse.controller.js", { label: "Warehouse Code", prefix: "WH", mode: "manual", maxLength: 50 }),
  define("inventory.location", "WarehouseLocation", "code", "controllers/inventory/warehouseLocation.controller.js", { label: "Location / Bin Code", prefix: "LOC", mode: "manual", maxLength: 60 }),
  define("inventory.stock-request", "StockRequest", "requestReference", "controllers/inventory/inventoryOperations.controller.js", { label: "Stock Request No.", prefix: "SR", pattern: "{PREFIX}-{DATE}-{ITEM}-{SERIAL}", contextTokens: ["ITEM"], serialWidth: 1 }),
  define("inventory.stock-issue", "StockIssue", "issueReference", "controllers/inventory/inventoryOperations.controller.js", { label: "Stock Issue No.", prefix: "SI", pattern: "{PREFIX}-{DATE}-{ITEM}-{SERIAL}", contextTokens: ["ITEM"], serialWidth: 1 }),
  define("inventory.stock-transfer", "StockTransfer", "transferNo", "controllers/inventory/stockTransfer.controller.js", { label: "Request / Transfer Ref.", prefix: "ST" }),
  define("inventory.stock-adjustment", "StockAdjustment", "adjustmentNo", "controllers/inventory/stockAdjustment.controller.js", { label: "Adjustment No.", prefix: "SA" }),
  define("inventory.stock-movement", "StockMovement", "movementNo", "controllers/inventory/stockMovement.controller.js", { label: "Stock Movement No.", prefix: "SM", additionalProducers: ["services/inventory/inventoryPosting.service.js"] }),
  define("inventory.stock-inspection", "StockInspection", "inspectionReference", "controllers/inventory/inventoryOperations.controller.js", { label: "Stock Inspection No.", prefix: "SIQ" }),
  define("inventory.tracking", "InventoryTracking", "trackingReference", "controllers/inventory/inventoryOperations.controller.js", { label: "Tracking Number", prefix: "TN" }),
  define("inventory.revaluation", "InventoryRevaluation", "revaluationNo", "controllers/inventory/inventoryRevaluation.controller.js", { label: "Revaluation No.", prefix: "RV" }),
  define("inventory.loss", "InventoryLoss", "lossReference", "controllers/inventory/inventoryOperations.controller.js", { label: "Inventory Loss No.", prefix: "LOSS" }),

  define("purchase.request", "PurchaseRequest", "requestReference", "controllers/purchase/purchaseWorkflow.controller.js", { label: "Purchase Request No.", prefix: "PRQ" }),
  define("purchase.analysis", "PurchaseAnalysis", "analysisReference", "controllers/purchase/purchaseWorkflow.controller.js", { label: "Purchase Analysis No.", prefix: "PAN" }),
  define("purchase.issue", "PurchaseIssue", "purchaseReference", "controllers/purchase/purchaseWorkflow.controller.js", { label: "Purchase Issue No.", prefix: "IPI" }),
  define("purchase.order", "PurchaseOrder", "orderNo", "controllers/purchase/purchaseOrder.controller.js", { label: "Purchase Order No.", prefix: "PPO", serialWidth: 4, resetPolicy: "calendar_year", legacyFormatter: "purchase_year", additionalProducers: ["services/purchase/purchaseExecution.service.js"] }),
  define("purchase.receipt", "GoodsReceipt", "receiptNo", "controllers/purchase/goodsReceipt.controller.js", { label: "Goods Receipt No.", prefix: "GRN", serialWidth: 4, resetPolicy: "calendar_year", legacyFormatter: "purchase_year" }),
  define("purchase.return", "PurchaseReturn", "returnNo", "controllers/purchase/purchaseReturn.controller.js", { label: "Purchase Return No.", prefix: "PRT", serialWidth: 4, resetPolicy: "calendar_year", legacyFormatter: "purchase_year" }),
  define("purchase.payment", "PurchasePayment", "paymentReference", "services/purchase/purchaseExecution.service.js", { label: "Purchase Payment No.", prefix: "PAY" }),
  define("purchase.due", "PurchaseDue", "dueReference", "services/purchase/purchaseExecution.service.js", { label: "Purchase Due No.", prefix: "DUE" }),
  define("purchase.quality", "PurchaseQualityInspection", "inspectionReference", "controllers/purchase/goodsReceipt.controller.js", { label: "Purchase Quality No.", prefix: "PQI" }),
  define("purchase.price-analysis", "PriceAnalysis", "analysisReference", "controllers/purchase/purchaseWorkflow.controller.js", { label: "Price Analysis No.", prefix: "PRA" }),
  define("purchase.lc-application", "CommercialLC", "applicationNo", "controllers/purchase/commercialLC.controller.js", { label: "LC Application No.", prefix: "LCAPP", serialWidth: 5, resetPolicy: "calendar_year", legacyFormatter: "purchase_year" }),
  define("purchase.import-shipment", "ImportShipment", "shipmentNo", "controllers/purchase/importShipment.controller.js", { label: "Import Shipment No.", prefix: "IMPSHP", serialWidth: 5, resetPolicy: "calendar_year", legacyFormatter: "purchase_year" }),
  define("purchase.landed-cost", "LandedCost", "landedCostNo", "controllers/purchase/landedCost.controller.js", { label: "Landed Cost No.", prefix: "LDC", serialWidth: 5, resetPolicy: "calendar_year", legacyFormatter: "purchase_year" }),

  define("sales.quotation", "SalesQuotation", "quotationNumber", "controllers/sales/salesQuotation.controller.js", { label: "Quotation No.", prefix: "QTN", serialWidth: 6, resetPolicy: "monthly", legacyFormatter: "sales_month" }),
  define("sales.order", "SalesOrder", "orderNumber", "controllers/sales/salesOrder.controller.js", { label: "Sales Order No.", prefix: "SO", serialWidth: 6, resetPolicy: "monthly", legacyFormatter: "sales_month", additionalProducers: ["services/crm/leadOrder.service.js"] }),
  define("sales.delivery", "DeliveryNote", "deliveryNumber", "controllers/sales/deliveryNote.controller.js", { label: "Delivery Note No.", prefix: "DN", serialWidth: 6, resetPolicy: "monthly", legacyFormatter: "sales_month" }),
  define("sales.invoice", "SalesInvoice", "invoiceNumber", "controllers/sales/salesInvoice.controller.js", { label: "Sales Invoice No.", prefix: "INV", serialWidth: 6, resetPolicy: "monthly", legacyFormatter: "sales_month" }),
  define("sales.return", "SalesReturn", "returnNumber", "controllers/sales/salesReturn.controller.js", { label: "Sales Return No.", prefix: "SRT", serialWidth: 6, resetPolicy: "monthly", legacyFormatter: "sales_month" }),

  define("accounting.journal", "JournalEntry", "entryNo", "services/accounting/accountingNumbering.service.js", { label: "Journal Voucher No.", prefix: "JV", serialWidth: 6, resetPolicy: "fiscal_year", legacyFormatter: "accounting_fiscal" }),
  define("accounting.voucher", "JournalEntry", "entryNo", "services/accounting/accountingNumbering.service.js", { label: "Voucher No.", prefix: "PV", serialWidth: 6, resetPolicy: "fiscal_year", legacyFormatter: "accounting_fiscal" }),
  define("accounting.bill", "VendorBill", "billNo", "controllers/accounting/accounting.controller.js", { label: "Vendor Bill No.", prefix: "BILL", serialWidth: 6, resetPolicy: "fiscal_year", legacyFormatter: "accounting_fiscal" }),

  ...[
    ["bom", "BillOfMaterial", "bomNumber", "BOM"], ["routing", "Routing", "routeNumber", "RT"],
    ["plan", "ProductionPlan", "planNumber", "PP"], ["mrp", "MRPRun", "runNumber", "MRP"],
    ["mo", "ManufacturingOrder", "moNumber", "MO"], ["wo", "WorkOrder", "woNumber", "WO"],
    ["issue", "MaterialIssue", "issueNumber", "MI"], ["entry", "ProductionEntry", "entryNumber", "PE"],
    ["inspection", "QualityInspection", "inspectionNumber", "QI"], ["ncr", "NonConformance", "ncrNumber", "NCR"],
    ["scrap", "ScrapEntry", "scrapNumber", "SCR"], ["rework", "ReworkOrder", "reworkNumber", "RW"],
    ["schedule", "ProductionSchedule", "scheduleNumber", "SCH"], ["maintenance-plan", "MaintenancePlan", "planNumber", "MP"],
    ["maintenance-order", "MaintenanceOrder", "maintenanceNumber", "MT"], ["subcontract", "SubcontractOrder", "subcontractNumber", "SUB"],
    ["cost", "ManufacturingCost", "costNumber", "MC"],
  ].map(([key, model, field, prefix]) => define(`manufacturing.${key}`, model, field, "services/manufacturing/manufacturingNumbering.service.js", { prefix, serialWidth: 6, resetPolicy: "none", legacyFormatter: "manufacturing_year" })),

  define("crm.lead", "Lead", "leadNumber", "controllers/crm/lead.controller.js", { label: "Lead No.", prefix: "LD" }),
  define("crm.deal", "Deal", "dealNo", "controllers/crm/deal.controller.js", { label: "Deal No.", prefix: "DEAL" }),
  define("crm.proposal", "Proposal", "proposalNo", "controllers/crm/proposal.controller.js", { label: "Proposal No.", prefix: "PROP" }),
  define("payroll.loan", "EmployeeLoan", "loanNo", "controllers/payroll/employeeLoan.controller.js", { label: "Employee Loan No.", prefix: "EL", serialWidth: 4, resetPolicy: "daily" }),
  define("supplier.company", "Supplier", "code", "services/supplier/supplier.service.js", { label: "Supplier Code", prefix: "SUP", mode: "manual", maxLength: 50 }),
  define("administration.branch", "Branch", "code", "controllers/administration/company.controller.js", { label: "Branch Code", prefix: "BR", mode: "manual", maxLength: 50, additionalProducers: ["services/shared/tenant.service.js"] }),
  define("administration.employee", "User", "employeeId", "controllers/administration/user.controller.js", { label: "Employee Code", prefix: "EMP", maxLength: 50 }),
]);

const byKey = new Map(DOCUMENT_NUMBER_TYPES.map((type) => [type.key, type]));

export function getDocumentNumberType(typeKey) {
  return byKey.get(String(typeKey || "")) || null;
}
