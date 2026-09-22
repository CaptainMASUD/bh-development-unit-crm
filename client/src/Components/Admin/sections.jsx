/* eslint-disable react-refresh/only-export-components -- route registry intentionally owns lazy page references */
// sections.jsx
import { lazy } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { InventoryThemeBoundary } from "./inventory/InventoryUI"
import {
  Analytics01Icon,
  Archive02Icon,
  ArrowDataTransferHorizontalIcon,
  BankIcon,
  BanknoteIcon,
  Briefcase01Icon,
  Calendar03Icon,
  CalendarMinus01Icon,
  ChartLineData01Icon,
  ChartLineData02Icon,
  DashboardSquare01Icon,
  DollarCircleIcon,
  FileChartColumnIcon,
  HandCoinsIcon,
  Package01Icon,
  Layers01Icon,
  NoteEditIcon,
  ReceiptDollarIcon,
  Setup02Icon,
  ShieldUserIcon,
  Target01Icon,
  UserGroup03Icon,
  UserIcon,
  UserMultiple02Icon,
  UserSettings01Icon,
  Wallet03Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons"

const Dashboard = lazy(() => import("./crm/DashboardContent"))
const Customers = lazy(() => import("./crm/CustomersPage"))
const AdminLead = lazy(() => import("./crm/AdminLeadPage"))
const AdminDealsPage = lazy(() => import("./crm/AdminDealsPage"))
const Users = lazy(() => import("./system/UserContent"))
const Employee = lazy(() => import("./payroll/Employee"))
const Attendance = lazy(() => import("./payroll/Attendance"))
const AdminSalaryPage = lazy(() => import("./payroll/AdminSalaryPage"))
const PayrollManager = lazy(() => import("./payroll/PayrollManager"))
const EmployeeLoans = lazy(() => import("./payroll/EmployeeLoans"))
const LeaveRequests = lazy(() => import("./payroll/LeaveRequests"))
const LeaveSetup = lazy(() => import("./payroll/LeaveSetup"))
const RosterShiftSetup = lazy(() => import("./payroll/RosterShiftSetup"))
const TaxSetup = lazy(() => import("./payroll/TaxSetup"))
const ExpenseSetup = lazy(() => import("./accounting/ExpenseSetup"))
const BankSetup = lazy(() => import("./banking/BankSetup"))
const Expenses = lazy(() => import("./accounting/Expenses"))
const BankTransactions = lazy(() => import("./banking/BankTransactions"))
const MoneyTransfer = lazy(() => import("./banking/MoneyTransfer"))
const BankReconciliation = lazy(() => import("./banking/BankReconciliation"))
const CashManagement = lazy(() => import("./banking/CashManagement"))
const TreasuryVouchers = lazy(() => import("./banking/TreasuryVouchers"))
const ChartOfAccounts = lazy(() => import("./accounting/ChartOfAccounts"))
const CostCenters = lazy(() => import("./accounting/CostCenters"))
const AccountingDimensions = lazy(() => import("./accounting/AccountingDimensions"))
const JournalEntries = lazy(() => import("./accounting/JournalEntries"))
const GeneralLedger = lazy(() => import("./accounting/GeneralLedger"))
const CashBook = lazy(() => import("./accounting/CashBook"))
const AccountsReceivable = lazy(() => import("./accounting/AccountsReceivable"))
const AccountsPayable = lazy(() => import("./accounting/AccountsPayable"))
const ProfitLoss = lazy(() => import("./accounting/ProfitLoss"))
const OpeningBalances = lazy(() => import("./accounting/OpeningBalances"))
const AccountingSettings = lazy(() => import("./accounting/AccountingSettings"))
const FiscalYearPeriods = lazy(() => import("./accounting/FiscalYearPeriods"))
const TrialBalance = lazy(() => import("./accounting/TrialBalance"))
const BalanceSheet = lazy(() => import("./accounting/BalanceSheet"))
const CashFlowStatement = lazy(() => import("./accounting/CashFlowStatement"))
const ProfileSettings = lazy(() => import("./system/ProfileSettings"))
const InventoryRevaluations = lazy(() => import("./inventory/InventoryRevaluations"))
const AdminCompanySetupPage = lazy(() => import("./CompanySetup/AdminCompanySetupPage"))
const AdministrationDashboard = lazy(() => import("./administration/AdministrationDashboard"))
const CompanyDetails = lazy(() => import("./administration/CompanyDetails"))
const SystemDefaults = lazy(() => import("./administration/SystemDefaults"))
const DocumentNumbering = lazy(() => import("./administration/DocumentNumbering"))
const AdministrationDepartments = lazy(() => import("./administration/AdministrationDepartments"))
const AuditTrail = lazy(() => import("./administration/AuditTrail"))
const RoleManagement = lazy(() => import("./administration/RoleManagement"))
const UpcomingAdministrationFeature = lazy(() => import("./administration/AdministrationDashboard").then((module) => ({ default: module.UpcomingAdministrationFeature })))
const TitlesAdd = lazy(() => import("./workflow/TittlesAdd"))
const EngagementTemplatePage = lazy(() => import("./workflow/EngagementTemplatePage"))
const PurchaseTypePage = lazy(() => import("./workflow/PurchaseTypePage"))
const CustomerCRMInner = lazy(() => import("./crm/CustomerCRMInner"))
const ClientReport = lazy(() => import("./reports/ClientReport"))
const AdminEmployeeReportPage = lazy(() => import("./reports/EmployeeReportPage"))
const TaxReport = lazy(() => import("./reports/TaxReport"))
const AccessControl = lazy(() => import("./system/AccessControl"))
const DepartmentPosition = lazy(() => import("./payroll/DepartmentPosition"))
const Products = lazy(() => import("./inventory/Product"))
const ProductCategories = lazy(() => import("./inventory/ProductCategory"))
const InventoryUnits = lazy(() => import("./inventory/InventoryUnit"))
const Warehouses = lazy(() => import("./inventory/Warehouse"))
const WarehouseLocations = lazy(() => import("./inventory/WarehouseLocation"))
const StockAdjustments = lazy(() => import("./inventory/StockAdjustments"))
const StockTransfers = lazy(() => import("./inventory/StockTransfers"))
const InventoryDashboard = lazy(() => import("./inventory/InventoryDashboard"))
const TotalInventory = lazy(() => import("./inventory/TotalInventory"))
const ItemProfiles = lazy(() => import("./inventory/ItemProfiles"))
const WarehouseChecks = lazy(() => import("./inventory/WarehouseChecks"))
const StockRequests = lazy(() => import("./inventory/StockRequests"))
const StockIssues = lazy(() => import("./inventory/StockIssues"))
const StockInspection = lazy(() => import("./inventory/StockInspection"))
const BatchLots = lazy(() => import("./inventory/BatchLots"))
const SerialNumbers = lazy(() => import("./inventory/SerialNumbers"))
const ExpiryTracking = lazy(() => import("./inventory/ExpiryTracking"))
const ConsumptionHistory = lazy(() => import("./inventory/ConsumptionHistory"))
const LowStock = lazy(() => import("./inventory/LowStock"))
const InventoryValuation = lazy(() => import("./inventory/InventoryValuation"))
const InventoryLossAnalysis = lazy(() => import("./inventory/InventoryLossAnalysis"))
const StockBalanceReport = lazy(() => import("./inventory/StockBalanceReport"))
const InventoryReports = lazy(() => import("./inventory/InventoryReports"))
const Suppliers = lazy(() => import("./Supplier/SupplierSetup"))
const SupplierProducts = lazy(() => import("./Supplier/SupplierProducts"))
const PurchaseOrders = lazy(() => import("./purchase/PurchaseOrders"))
const PurchaseOrderPrint = lazy(() => import("./purchase/PurchaseOrderPrint"))
const GoodsReceipts = lazy(() => import("./purchase/GoodsReceipts"))
const PurchaseReturns = lazy(() => import("./purchase/PurchaseReturns"))
const QuickPurchase = lazy(() => import("./purchase/QuickPurchase"))
const PurchaseRequests = lazy(() => import("./purchase/PurchaseRequests"))
const PurchaseAnalysis = lazy(() => import("./purchase/PurchaseAnalysis"))
const PurchaseIssues = lazy(() => import("./purchase/PurchaseIssues"))
const PurchaseDues = lazy(() => import("./purchase/PurchaseDues"))
const PriceAnalysis = lazy(() => import("./purchase/PriceAnalysis"))
const PurchaseReportsPage = lazy(() => import("./purchase/PurchaseReportsPage"))
const PurchaseQualityInspections = lazy(() => import("./purchase/PurchaseQualityInspections"))
const CommercialLC = lazy(() => import("./purchase/CommercialLC"))
const ImportShipments = lazy(() => import("./purchase/ImportShipments"))
const ImportDocuments = lazy(() => import("./purchase/ImportDocuments"))
const LandedCosts = lazy(() => import("./purchase/LandedCosts"))
const SalesPage = lazy(() => import("./sales/SalesPage"))
const SalesReports = lazy(() => import("./sales/SalesReports"))
const ManufacturingDashboard = lazy(() => import("./manufacturing/ManufacturingDashboard"))
const ProductionPlanning = lazy(() => import("./manufacturing/ProductionPlanning"))
const MRP = lazy(() => import("./manufacturing/MRP"))
const ProductionSchedule = lazy(() => import("./manufacturing/ProductionSchedule"))
const CapacityPlanning = lazy(() => import("./manufacturing/CapacityPlanning"))
const ManufacturingOrders = lazy(() => import("./manufacturing/ManufacturingOrders"))
const WorkOrders = lazy(() => import("./manufacturing/WorkOrders"))
const MaterialIssues = lazy(() => import("./manufacturing/MaterialIssues"))
const ProductionEntries = lazy(() => import("./manufacturing/ProductionEntries"))
const WorkInProgress = lazy(() => import("./manufacturing/WorkInProgress"))
const BillOfMaterials = lazy(() => import("./manufacturing/BillOfMaterials"))
const Routings = lazy(() => import("./manufacturing/Routings"))
const WorkCenters = lazy(() => import("./manufacturing/WorkCenters"))
const Machines = lazy(() => import("./manufacturing/Machines"))
const QualityInspections = lazy(() => import("./manufacturing/QualityInspections"))
const NonConformance = lazy(() => import("./manufacturing/NonConformance"))
const ReworkOrders = lazy(() => import("./manufacturing/ReworkOrders"))
const ScrapWastage = lazy(() => import("./manufacturing/ScrapWastage"))
const MaintenancePlans = lazy(() => import("./manufacturing/MaintenancePlans"))
const MaintenanceOrders = lazy(() => import("./manufacturing/MaintenanceOrders"))
const Subcontracting = lazy(() => import("./manufacturing/Subcontracting"))
const ManufacturingCosting = lazy(() => import("./manufacturing/ManufacturingCosting"))
const ManufacturingReports = lazy(() => import("./manufacturing/ManufacturingReports"))

const createSectionIcon = (icon) => (
  <HugeiconsIcon
    icon={icon}
    size={20}
    color="currentColor"
    strokeWidth={1.8}
  />
)

const withInventoryTheme = (component) => (
  <InventoryThemeBoundary>{component}</InventoryThemeBoundary>
)

const sections = {
  "Administration Dashboard": {
    icon: createSectionIcon(DashboardSquare01Icon),
    component: <AdministrationDashboard />,
    permission: "administration-dashboard:view",
  },

  "Company Details": {
    icon: createSectionIcon(Briefcase01Icon),
    component: <CompanyDetails />,
    permission: "company:view",
  },

  "System Defaults": {
    icon: createSectionIcon(Setup02Icon),
    component: <SystemDefaults />,
    permission: "system-settings:view",
  },

  "Document Numbering": {
    icon: createSectionIcon(NoteEditIcon),
    component: <DocumentNumbering />,
    permission: "system-settings:view",
  },

  "Audit Trail": {
    icon: createSectionIcon(FileChartColumnIcon),
    component: <AuditTrail />,
    permission: "access-control:view",
  },

  "Role Management": {
    icon: createSectionIcon(ShieldUserIcon),
    component: <RoleManagement />,
    permission: "access-control:view",
  },

  "Administration Departments": {
    icon: createSectionIcon(Layers01Icon),
    component: <AdministrationDepartments />,
    permission: "access-control:view",
  },

  "Employee Access Control": {
    icon: createSectionIcon(UserSettings01Icon),
    component: <UpcomingAdministrationFeature title="Employee Access Control" />,
    permission: "access-control:view",
    comingSoon: true,
  },

  "Add Employee": {
    icon: createSectionIcon(UserMultiple02Icon),
    component: <Employee />,
    permission: "users:manage",
  },

  "Employee Account Control": {
    icon: createSectionIcon(UserIcon),
    component: <UpcomingAdministrationFeature title="Employee Account Control" />,
    permission: "users:view",
    comingSoon: true,
  },

  "System Security Settings": {
    icon: createSectionIcon(ShieldUserIcon),
    component: <UpcomingAdministrationFeature title="System Security Settings" />,
    permission: "access-control:view",
    comingSoon: true,
  },

  Dashboard: {
    icon: createSectionIcon(DashboardSquare01Icon),
    component: <Dashboard />,
  },

  "Inventory Dashboard": {
    icon: createSectionIcon(DashboardSquare01Icon),
    component: withInventoryTheme(<InventoryDashboard />),
    permission: "inventory-report:view",
  },

  "CRM Analytics": {
    icon: createSectionIcon(Analytics01Icon),
    component: <Dashboard />,
  },

  Clients: {
    icon: createSectionIcon(UserGroup03Icon),
    subcategories: {
      Clients: <Customers />,
      "Client Tasks": <CustomerCRMInner />,
    },
  },

  Leads: {
    icon: createSectionIcon(Target01Icon),
    component: <AdminLead />,
  },

  Deals: {
    icon: createSectionIcon(Briefcase01Icon),
    component: <AdminDealsPage />,
  },

  "Inventory Items": {
    icon: createSectionIcon(Package01Icon),
    component: withInventoryTheme(<TotalInventory />),
    permission: "inventory-stock:view",
  },

  "Item Profiles": {
    icon: createSectionIcon(Package01Icon),
    component: withInventoryTheme(<ItemProfiles />),
    permission: "inventory-product:view",
  },

  "Product Management": {
    icon: createSectionIcon(Package01Icon),
    subcategories: {
      Products: withInventoryTheme(<Products />),
      Categories: withInventoryTheme(<ProductCategories />),
      "Units of Measure": withInventoryTheme(<InventoryUnits />),
    },
    subcategoryPermissions: {
      Products: "inventory-product:view",
      Categories: "inventory-category:view",
      "Units of Measure": "inventory-unit:view",
    },
  },

  "Warehouse Management": {
    icon: createSectionIcon(Layers01Icon),
    subcategories: {
      Warehouses: withInventoryTheme(<Warehouses />),
      "Scheduled Warehouse Checks": withInventoryTheme(<WarehouseChecks />),
      "Locations / Bins / Shelves": withInventoryTheme(<WarehouseLocations />),
    },
    subcategoryPermissions: {
      Warehouses: "inventory-warehouse:view",
      "Scheduled Warehouse Checks": "inventory-warehouse:view",
      "Locations / Bins / Shelves": "inventory-location:view",
    },
  },

  "Inventory Operations": {
    icon: createSectionIcon(ArrowDataTransferHorizontalIcon),
    subcategories: {
      "Stock Requests": withInventoryTheme(<StockRequests />),
      "Stock Issues": withInventoryTheme(<StockIssues />),
      "Stock Transfers": withInventoryTheme(<StockTransfers />),
      "Stock Adjustments": withInventoryTheme(<StockAdjustments />),
      "Inventory Revaluations": withInventoryTheme(<InventoryRevaluations />),
      "Stock Report": withInventoryTheme(<StockBalanceReport />),
    },
    subcategoryPermissions: {
      "Stock Requests": "inventory-stock:view",
      "Stock Issues": "inventory-movement:view",
      "Stock Transfers": "inventory-transfer:view",
      "Stock Adjustments": "inventory-adjustment:view",
      "Inventory Revaluations": "inventory-adjustment:view",
      "Stock Report": "inventory-report:view",
    },
  },

  "Quality Management": {
    icon: createSectionIcon(Archive02Icon),
    subcategories: {
      "Quality Inspection": withInventoryTheme(<PurchaseQualityInspections />),
      "Stock Inspection": withInventoryTheme(<StockInspection />),
    },
    subcategoryPermissions: {
      "Quality Inspection": "inventory-stock:view",
      "Stock Inspection": "inventory-stock:view",
    },
  },

  "Batch, Serial & Expiry": {
    icon: createSectionIcon(Archive02Icon),
    subcategories: {
      "Batches / Lots": withInventoryTheme(<BatchLots />),
      "Serial Numbers": withInventoryTheme(<SerialNumbers />),
      "Expiry Management": withInventoryTheme(<ExpiryTracking />),
      "Low Stock Requests": withInventoryTheme(<LowStock />),
    },
    subcategoryPermissions: {
      "Batches / Lots": "inventory-stock:view",
      "Serial Numbers": "inventory-stock:view",
      "Expiry Management": "inventory-stock:view",
      "Low Stock Requests": "inventory-report:view",
    },
  },

  "Consumption History": {
    icon: createSectionIcon(Archive02Icon),
    component: withInventoryTheme(<ConsumptionHistory />),
    permission: "inventory-movement:view",
  },

  "Inventory Valuation": {
    icon: createSectionIcon(ChartLineData01Icon),
    component: withInventoryTheme(<InventoryValuation />),
    permission: "inventory-report:view",
  },

  "Inventory Loss Analysis": {
    icon: createSectionIcon(ChartLineData02Icon),
    component: withInventoryTheme(<InventoryLossAnalysis />),
    permission: "inventory-report:view",
  },

  "Inventory Reports": {
    icon: createSectionIcon(FileChartColumnIcon),
    component: withInventoryTheme(<InventoryReports />),
    permission: "inventory-report:view",
  },

  Suppliers: {
    icon: createSectionIcon(UserGroup03Icon),
    component: <Suppliers />,
    permission: "supplier:view",
  },

  "Supplier Products": {
    icon: createSectionIcon(Package01Icon),
    component: <SupplierProducts />,
    permission: "supplier:view",
  },

  "Purchase Orders": {
    icon: createSectionIcon(NoteEditIcon),
    component: <PurchaseOrders />,
    permission: "purchase-order:view",
  },

  "Goods Receipts": {
    icon: createSectionIcon(Package01Icon),
    component: <GoodsReceipts />,
    permission: "goods-receipt:view",
  },

  "Purchase Returns": {
    icon: createSectionIcon(ArrowDataTransferHorizontalIcon),
    component: <PurchaseReturns />,
    permission: "purchase-return:view",
  },

  "Quick Purchase": { icon: createSectionIcon(Package01Icon), component: <QuickPurchase />, permission: "purchase-order:manage" },
  "Purchase Operations": {
    icon: createSectionIcon(WorkflowSquare03Icon),
    subcategories: {
      "Purchase Requests": <PurchaseRequests />,
      "Purchase Analysis": <PurchaseAnalysis />,
      "Purchase Issues": <PurchaseIssues />,
      "Goods Receipts": <GoodsReceipts />,
      "Quality Inspection": <PurchaseQualityInspections />,
    },
    subcategoryPermissions: {
      "Purchase Requests": "purchase-request:view",
      "Purchase Analysis": "purchase-analysis:view",
      "Purchase Issues": "purchase-issue:view",
      "Goods Receipts": "goods-receipt:view",
      "Quality Inspection": "purchase-quality:view",
    },
  },
  "Purchase Order Management": {
    icon: createSectionIcon(NoteEditIcon),
    subcategories: {
      "Purchase Orders": <PurchaseOrders />,
      "PO Print / PDF": <PurchaseOrderPrint />,
    },
    subcategoryPermissions: {
      "Purchase Orders": "purchase-order:view",
      "PO Print / PDF": "purchase-order:view",
    },
  },
  "Import & Commercial LC": {
    icon: createSectionIcon(BankIcon),
    subcategories: {
      "Commercial LCs": <CommercialLC />,
      "Import Shipments": <ImportShipments />,
      "Import Documents": <ImportDocuments />,
      "Landed Costs": <LandedCosts />,
    },
    subcategoryPermissions: {
      "Commercial LCs": "commercial-lc:view",
      "Import Shipments": "commercial-lc:view",
      "Import Documents": "commercial-lc:view",
      "Landed Costs": "commercial-lc:view",
    },
  },
  "Financial / Review": {
    icon: createSectionIcon(ReceiptDollarIcon),
    subcategories: {
      "Purchase Dues": <PurchaseDues />,
      "Price Analysis": <PriceAnalysis />,
    },
    subcategoryPermissions: {
      "Purchase Dues": "purchase-due:view",
      "Price Analysis": "price-analysis:view",
    },
  },
  "Price Analysis": { icon: createSectionIcon(ChartLineData01Icon), component: <PriceAnalysis />, permission: "price-analysis:view" },
  "Purchase Reports": { icon: createSectionIcon(FileChartColumnIcon), component: <PurchaseReportsPage />, permission: "purchase-order:view" },

  "Sales Quotations": { icon: createSectionIcon(NoteEditIcon), component: <SalesPage kind="quotations" />, permission: "sales-quotation:view" },
  "Sales Orders": { icon: createSectionIcon(Briefcase01Icon), component: <SalesPage kind="orders" />, permission: "sales-order:view" },
  Deliveries: { icon: createSectionIcon(ArrowDataTransferHorizontalIcon), component: <SalesPage kind="deliveries" />, permission: "sales-delivery:view" },
  "Sales Invoices": { icon: createSectionIcon(ReceiptDollarIcon), component: <SalesPage kind="invoices" />, permission: "sales-invoice:view" },
  "Sales Returns": { icon: createSectionIcon(Archive02Icon), component: <SalesPage kind="returns" />, permission: "sales-return:view" },
  "Sales Reports": { icon: createSectionIcon(ChartLineData01Icon), component: <SalesReports />, permission: "sales-report:view" },

  "Manufacturing Dashboard": {
    icon: createSectionIcon(DashboardSquare01Icon),
    component: <ManufacturingDashboard />,
    permission: "manufacturing-report:view",
  },

  Planning: {
    icon: createSectionIcon(Calendar03Icon),
    subcategories: {
      "Production Plans": <ProductionPlanning />,
      MRP: <MRP />,
      "Production Schedule": <ProductionSchedule />,
      "Capacity Planning": <CapacityPlanning />,
    },
    subcategoryPermissions: {
      "Production Plans": "manufacturing-plan:view",
      MRP: "manufacturing-mrp:view",
      "Production Schedule": "manufacturing-schedule:view",
      "Capacity Planning": "manufacturing-work-center:view",
    },
  },

  Production: {
    icon: createSectionIcon(WorkflowSquare03Icon),
    subcategories: {
      "Manufacturing Orders": <ManufacturingOrders />,
      "Work Orders": <WorkOrders />,
      "Material Issues": <MaterialIssues />,
      "Production Entries": <ProductionEntries />,
      "Shop Floor": <WorkOrders />,
      "Work In Progress": <WorkInProgress />,
    },
    subcategoryPermissions: {
      "Manufacturing Orders": "manufacturing-order:view",
      "Work Orders": "manufacturing-work-order:view",
      "Material Issues": "manufacturing-material:view",
      "Production Entries": "manufacturing-production:view",
      "Shop Floor": "manufacturing-work-order:view",
      "Work In Progress": "manufacturing-wip:view",
    },
  },

  Engineering: {
    icon: createSectionIcon(Setup02Icon),
    subcategories: {
      "Bill of Materials": <BillOfMaterials />,
      Routings: <Routings />,
      "Work Centers": <WorkCenters />,
      Machines: <Machines />,
    },
    subcategoryPermissions: {
      "Bill of Materials": "manufacturing-bom:view",
      Routings: "manufacturing-routing:view",
      "Work Centers": "manufacturing-work-center:view",
      Machines: "manufacturing-machine:view",
    },
  },

  Quality: {
    icon: createSectionIcon(ShieldUserIcon),
    subcategories: {
      "Quality Inspections": <QualityInspections />,
      "Non-Conformance": <NonConformance />,
      "Rework Orders": <ReworkOrders />,
      "Scrap & Wastage": <ScrapWastage />,
    },
    subcategoryPermissions: {
      "Quality Inspections": "manufacturing-quality:view",
      "Non-Conformance": "manufacturing-quality:view",
      "Rework Orders": "manufacturing-rework:view",
      "Scrap & Wastage": "manufacturing-scrap:view",
    },
  },

  Maintenance: {
    icon: createSectionIcon(Setup02Icon),
    subcategories: {
      "Maintenance Plans": <MaintenancePlans />,
      "Maintenance Orders": <MaintenanceOrders />,
    },
    subcategoryPermissions: {
      "Maintenance Plans": "manufacturing-maintenance:view",
      "Maintenance Orders": "manufacturing-maintenance:view",
    },
  },

  Outsourcing: {
    icon: createSectionIcon(ArrowDataTransferHorizontalIcon),
    subcategories: { Subcontracting: <Subcontracting /> },
    subcategoryPermissions: { Subcontracting: "manufacturing-subcontract:view" },
  },

  Costing: {
    icon: createSectionIcon(DollarCircleIcon),
    subcategories: { "Manufacturing Costing": <ManufacturingCosting /> },
    subcategoryPermissions: { "Manufacturing Costing": "manufacturing-cost:view" },
  },

  "Manufacturing Reports Group": {
    icon: createSectionIcon(FileChartColumnIcon),
    subcategories: { "Manufacturing Reports": <ManufacturingReports /> },
    subcategoryPermissions: { "Manufacturing Reports": "manufacturing-report:view" },
  },

  "Workflow Setup": {
    icon: createSectionIcon(WorkflowSquare03Icon),
    subcategories: {
      "Task Titles": <TitlesAdd />,
      "Engagement Types": <EngagementTemplatePage />,
      "Purchase Types": <PurchaseTypePage />,
    },
  },

  Report: {
    icon: createSectionIcon(ChartLineData01Icon),
    subcategories: {
      "Client Report": <ClientReport />,
      "Employee Report": <AdminEmployeeReportPage />,
      "Tax Report": <TaxReport />,
    },
    subcategoryPermissions: {
      "Tax Report": "tax.report",
    },
  },

  Users: {
    icon: createSectionIcon(UserMultiple02Icon),
    component: <Users />,
    permission: "users:view",
  },

  Employee: {
    icon: createSectionIcon(UserIcon),
    component: <Employee />,
  },

  Attendance: {
    icon: createSectionIcon(Calendar03Icon),
    component: <Attendance />,
  },

  Salary: {
    icon: createSectionIcon(DollarCircleIcon),
    component: <AdminSalaryPage />,
  },

  "Payroll Manager": {
    icon: createSectionIcon(Wallet03Icon),
    component: <PayrollManager />,
  },

  Expenses: {
    icon: createSectionIcon(ReceiptDollarIcon),
    component: <Expenses />,
    permission: "expenses:view",
  },

  "Cash Management": { icon: createSectionIcon(Wallet03Icon), component: <CashManagement />, permission: "finance:view" },
  Voucher: {
    icon: createSectionIcon(ReceiptDollarIcon),
    component: <TreasuryVouchers />,
    permission: "finance:view",
  },

  "Accounting Setup": {
    icon: createSectionIcon(Layers01Icon),
    permission: "finance:view",
    subcategories: {
      "Chart of Accounts": <ChartOfAccounts />,
      "Cost Centers": <CostCenters />,
      "Accounting Dimensions": <AccountingDimensions />,
      "Fiscal Year / Period": <FiscalYearPeriods />,
      "Accounting Settings": <AccountingSettings />,
      "Opening Balance": <OpeningBalances />,
    },
    subcategoryPermissions: {
      "Accounting Settings": "finance:manage",
      "Chart of Accounts": "finance:manage",
      "Cost Centers": "finance:cost-center:view",
      "Accounting Dimensions": "finance:dimension:view",
      "Opening Balance": "finance:manage",
      "Fiscal Year / Period": "finance:manage",
    },
  },

  "Journal Entries": {
    icon: createSectionIcon(NoteEditIcon),
    component: <JournalEntries />,
    permission: "finance:view",
  },

  Reports: {
    icon: createSectionIcon(FileChartColumnIcon),
    permission: "finance:view",
    subcategories: {
      "Cash Book": <CashBook />,
      "General Ledger": <GeneralLedger />,
      "Balance Sheet": <BalanceSheet />,
      "Trial Balance": <TrialBalance />,
    },
  },

  "Accounts Receivable": {
    icon: createSectionIcon(ReceiptDollarIcon),
    component: <AccountsReceivable />,
    permission: "finance:view",
  },

  "Accounts Payable": {
    icon: createSectionIcon(HandCoinsIcon),
    component: <AccountsPayable />,
    permission: "finance:view",
  },

  "Profit & Loss": {
    icon: createSectionIcon(ChartLineData01Icon),
    component: <ProfitLoss />,
    permission: "finance:view",
  },

  "Cash Flow Statement": {
    icon: createSectionIcon(ChartLineData02Icon),
    component: <CashFlowStatement />,
    permission: "finance:view",
  },

  "Bank Transactions": {
    icon: createSectionIcon(BankIcon),
    component: <BankTransactions />,
    permission: "finance:view",
  },

  "Money Transfer": {
    icon: createSectionIcon(ArrowDataTransferHorizontalIcon),
    component: <MoneyTransfer />,
    permission: "finance:view",
  },

  "Bank Reconciliation": {
    icon: createSectionIcon(BanknoteIcon),
    component: <BankReconciliation />,
    permission: "finance:view",
  },

  "Employee Loans": {
    icon: createSectionIcon(HandCoinsIcon),
    component: <EmployeeLoans />,
  },

  "Leave Requests": {
    icon: createSectionIcon(CalendarMinus01Icon),
    component: <LeaveRequests />,
  },

  Departments: {
    icon: createSectionIcon(Layers01Icon),
    component: <DepartmentPosition key="departments" defaultTab="departments" />,
    permission: "employees:view",
  },

  Positions: {
    icon: createSectionIcon(Briefcase01Icon),
    component: <DepartmentPosition key="positions" defaultTab="positions" />,
    permission: "employees:view",
  },

  "Departments & Positions": {
    icon: createSectionIcon(Layers01Icon),
    component: <DepartmentPosition key="dept-pos" />,
    permission: "employees:view",
  },

  Setup: {
    icon: createSectionIcon(Setup02Icon),
    subcategories: {
      "Roster / Shift Setup": <RosterShiftSetup />,
      "Leave Setup": <LeaveSetup />,
      "Tax Setup": <TaxSetup />,
      "Expense Setup": <ExpenseSetup />,
      "Bank Setup": <BankSetup />,
    },
    subcategoryPermissions: {
      "Roster / Shift Setup": "roster:view",
      "Leave Setup": "leaves:manage",
      "Tax Setup": "tax.view",
      "Expense Setup": "expense-setup:view",
      "Bank Setup": "bank-setup:view",
    },
  },

  "Access Control": {
    icon: createSectionIcon(ShieldUserIcon),
    component: <AccessControl />,
  },

  "Profile Settings": {
    icon: createSectionIcon(UserSettings01Icon),
    component: <ProfileSettings />,
  },

  "Company Setup": {
    icon: createSectionIcon(Setup02Icon),
    component: <AdminCompanySetupPage />,
  },
}

export { sections }
export default sections
