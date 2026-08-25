/* eslint-disable react-refresh/only-export-components -- route registry intentionally owns lazy page references */
// sections.jsx
import { lazy } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Analytics01Icon,
  Alert02Icon,
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
const AdminCompanySetupPage = lazy(() => import("./CompanySetup/AdminCompanySetupPage"))
const TitlesAdd = lazy(() => import("./workflow/TittlesAdd"))
const EngagementTemplatePage = lazy(() => import("./workflow/EngagementTemplatePage"))
const PurchaseTypePage = lazy(() => import("./workflow/PurchaseTypePage"))
const CustomerCRMInner = lazy(() => import("./crm/CustomerCRMInner"))
const ClientReport = lazy(() => import("./reports/ClientReport"))
const AdminEmployeeReportPage = lazy(() => import("./reports/EmployeeReportPage"))
const TaxReport = lazy(() => import("./reports/TaxReport"))
const AccessControl = lazy(() => import("./system/AccessControl"))
const Products = lazy(() => import("./inventory/Product"))
const ProductCategories = lazy(() => import("./inventory/ProductCategory"))
const InventoryUnits = lazy(() => import("./inventory/InventoryUnit"))
const Warehouses = lazy(() => import("./inventory/Warehouse"))
const WarehouseLocations = lazy(() => import("./inventory/WarehouseLocation"))
const StockOverview = lazy(() => import("./inventory/StockOverview"))
const StockMovements = lazy(() => import("./inventory/StockMovements"))
const StockAdjustments = lazy(() => import("./inventory/StockAdjustments"))
const StockTransfers = lazy(() => import("./inventory/StockTransfers"))
const InventoryDashboard = lazy(() => import("./inventory/InventoryDashboard"))
const TotalInventory = lazy(() => import("./inventory/TotalInventory"))
const WarehouseInventory = lazy(() => import("./inventory/WarehouseInventory"))
const PendingInventory = lazy(() => import("./inventory/PendingInventory"))
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
const WarehouseStockReport = lazy(() => import("./inventory/WarehouseStockReport"))
const StockLedgerReport = lazy(() => import("./inventory/StockLedgerReport"))
const ConsumptionReport = lazy(() => import("./inventory/ConsumptionReport"))
const LowStockReport = lazy(() => import("./inventory/LowStockReport"))
const ExpiryReport = lazy(() => import("./inventory/ExpiryReport"))
const ValuationReport = lazy(() => import("./inventory/ValuationReport"))
const LossAnalysisReport = lazy(() => import("./inventory/LossAnalysisReport"))
const Suppliers = lazy(() => import("./Supplier/SupplierSetup"))
const SupplierProducts = lazy(() => import("./Supplier/SupplierProducts"))
const PurchaseOrders = lazy(() => import("./purchase/PurchaseOrders"))
const GoodsReceipts = lazy(() => import("./purchase/GoodsReceipts"))
const PurchaseReturns = lazy(() => import("./purchase/PurchaseReturns"))
const QuickPurchase = lazy(() => import("./purchase/QuickPurchase"))
const PurchaseRequests = lazy(() => import("./purchase/PurchaseRequests"))
const PurchaseAnalysis = lazy(() => import("./purchase/PurchaseAnalysis"))
const PurchaseIssues = lazy(() => import("./purchase/PurchaseIssues"))
const PurchaseDues = lazy(() => import("./purchase/PurchaseDues"))
const PriceAnalysis = lazy(() => import("./purchase/PriceAnalysis"))
const PurchaseReportsPage = lazy(() => import("./purchase/PurchaseReportsPage"))
const SalesPage = lazy(() => import("./sales/SalesPage"))
const SalesReports = lazy(() => import("./sales/SalesReports"))

const createSectionIcon = (icon) => (
  <HugeiconsIcon
    icon={icon}
    size={20}
    color="currentColor"
    strokeWidth={1.8}
  />
)

const sections = {
  Dashboard: {
    icon: createSectionIcon(DashboardSquare01Icon),
    component: <Dashboard />,
  },

  "Inventory Dashboard": {
    icon: createSectionIcon(DashboardSquare01Icon),
    component: <InventoryDashboard />,
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
    subcategories: {
      "Total Inventory": <TotalInventory />,
      "Warehouse Inventory": <WarehouseInventory />,
      "Pending Inventory": <PendingInventory />,
    },
    subcategoryPermissions: {
      "Total Inventory": "inventory-stock:view",
      "Warehouse Inventory": "inventory-stock:view",
      "Pending Inventory": "inventory-stock:view",
    },
  },

  "Product Management": {
    icon: createSectionIcon(Package01Icon),
    subcategories: {
      Products: <Products />,
      Categories: <ProductCategories />,
      "Units of Measure": <InventoryUnits />,
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
      Warehouses: <Warehouses />,
      "Locations / Bins": <WarehouseLocations />,
      "Warehouse Checks": <WarehouseChecks />,
    },
    subcategoryPermissions: {
      Warehouses: "inventory-warehouse:view",
      "Locations / Bins": "inventory-location:view",
      "Warehouse Checks": "inventory-warehouse:view",
    },
  },

  "Inventory Operations": {
    icon: createSectionIcon(ArrowDataTransferHorizontalIcon),
    subcategories: {
      "Stock Requests": <StockRequests />,
      "Stock Issues": <StockIssues />,
      "Stock Transfers": <StockTransfers />,
      "Stock Adjustments": <StockAdjustments />,
    },
    subcategoryPermissions: {
      "Stock Requests": "inventory-stock:view",
      "Stock Issues": "inventory-movement:view",
      "Stock Transfers": "inventory-transfer:view",
      "Stock Adjustments": "inventory-adjustment:view",
    },
  },

  "Stock Inspection": {
    icon: createSectionIcon(Archive02Icon),
    component: <StockInspection />,
    permission: "inventory-stock:view",
  },

  Tracking: {
    icon: createSectionIcon(Archive02Icon),
    subcategories: {
      "Batch / Lots": <BatchLots />,
      "Serial Numbers": <SerialNumbers />,
      "Expiry Tracking": <ExpiryTracking />,
    },
    subcategoryPermissions: {
      "Batch / Lots": "inventory-stock:view",
      "Serial Numbers": "inventory-stock:view",
      "Expiry Tracking": "inventory-stock:view",
    },
  },

  "Consumption History": {
    icon: createSectionIcon(Archive02Icon),
    component: <ConsumptionHistory />,
    permission: "inventory-movement:view",
  },

  "Low Stock": {
    icon: createSectionIcon(Alert02Icon),
    component: <LowStock />,
    permission: "inventory-report:view",
  },

  "Inventory Valuation": {
    icon: createSectionIcon(ChartLineData01Icon),
    component: <InventoryValuation />,
    permission: "inventory-report:view",
  },

  "Inventory Loss Analysis": {
    icon: createSectionIcon(ChartLineData02Icon),
    component: <InventoryLossAnalysis />,
    permission: "inventory-report:view",
  },

  "Inventory Reports": {
    icon: createSectionIcon(FileChartColumnIcon),
    subcategories: {
      "Stock Balance": <StockBalanceReport />,
      "Warehouse Stock": <WarehouseStockReport />,
      "Stock Ledger": <StockLedgerReport />,
      Consumption: <ConsumptionReport />,
      "Low Stock": <LowStockReport />,
      Expiry: <ExpiryReport />,
      Valuation: <ValuationReport />,
      "Loss Analysis": <LossAnalysisReport />,
    },
    subcategoryPermissions: {
      "Stock Balance": "inventory-report:view",
      "Warehouse Stock": "inventory-report:view",
      "Stock Ledger": "inventory-report:view",
      Consumption: "inventory-report:view",
      "Low Stock": "inventory-report:view",
      Expiry: "inventory-report:view",
      Valuation: "inventory-report:view",
      "Loss Analysis": "inventory-report:view",
    },
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
  "Purchase Operations": { icon: createSectionIcon(WorkflowSquare03Icon), subcategories: { "Purchase Requests": <PurchaseRequests />, "Purchase Analysis": <PurchaseAnalysis />, "Purchase Issues": <PurchaseIssues />, "Purchase Dues": <PurchaseDues />, "Purchase Return": <PurchaseReturns /> }, subcategoryPermissions: { "Purchase Requests":"purchase-order:view","Purchase Analysis":"purchase-order:view","Purchase Issues":"purchase-order:view","Purchase Dues":"purchase-order:view","Purchase Return":"purchase-return:view" } },
  "Purchase Order Management": { icon: createSectionIcon(NoteEditIcon), subcategories: { "Purchase Orders": <PurchaseOrders />, "PO Print / PDF": <PurchaseOrders /> }, subcategoryPermissions: { "Purchase Orders":"purchase-order:view","PO Print / PDF":"purchase-order:view" } },
  "Price Analysis": { icon: createSectionIcon(ChartLineData01Icon), component: <PriceAnalysis />, permission: "purchase-order:view" },
  "Purchase Reports": { icon: createSectionIcon(FileChartColumnIcon), component: <PurchaseReportsPage />, permission: "purchase-order:view" },

  "Sales Quotations": { icon: createSectionIcon(NoteEditIcon), component: <SalesPage kind="quotations" />, permission: "sales-quotation:view" },
  "Sales Orders": { icon: createSectionIcon(Briefcase01Icon), component: <SalesPage kind="orders" />, permission: "sales-order:view" },
  Deliveries: { icon: createSectionIcon(ArrowDataTransferHorizontalIcon), component: <SalesPage kind="deliveries" />, permission: "sales-delivery:view" },
  "Sales Invoices": { icon: createSectionIcon(ReceiptDollarIcon), component: <SalesPage kind="invoices" />, permission: "sales-invoice:view" },
  "Sales Returns": { icon: createSectionIcon(Archive02Icon), component: <SalesPage kind="returns" />, permission: "sales-return:view" },
  "Sales Reports": { icon: createSectionIcon(ChartLineData01Icon), component: <SalesReports />, permission: "sales-report:view" },

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
      "Fiscal Year / Period": <FiscalYearPeriods />,
      "Accounting Settings": <AccountingSettings />,
      "Opening Balance": <OpeningBalances />,
    },
    subcategoryPermissions: {
      "Accounting Settings": "finance:manage",
      "Chart of Accounts": "finance:manage",
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
