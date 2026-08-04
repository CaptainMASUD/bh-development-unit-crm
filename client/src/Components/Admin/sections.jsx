/* eslint-disable react-refresh/only-export-components -- route registry intentionally owns lazy page references */
// sections.jsx
import { lazy } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Analytics01Icon,
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
const ProductBrands = lazy(() => import("./inventory/ProductBrand"))
const InventoryUnits = lazy(() => import("./inventory/InventoryUnit"))
const Warehouses = lazy(() => import("./inventory/Warehouse"))
const WarehouseLocations = lazy(() => import("./inventory/WarehouseLocation"))
const StockOverview = lazy(() => import("./inventory/StockOverview"))
const StockMovements = lazy(() => import("./inventory/StockMovements"))
const StockAdjustments = lazy(() => import("./inventory/StockAdjustments"))
const StockTransfers = lazy(() => import("./inventory/StockTransfers"))
const Suppliers = lazy(() => import("./Supplier/SupplierSetup"))
const SupplierProducts = lazy(() => import("./Supplier/SupplierProducts"))
const PurchaseOrders = lazy(() => import("./purchase/PurchaseOrders"))
const GoodsReceipts = lazy(() => import("./purchase/GoodsReceipts"))
const PurchaseReturns = lazy(() => import("./purchase/PurchaseReturns"))

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

  "Product Management": {
    icon: createSectionIcon(Package01Icon),
    subcategories: {
      Products: <Products />,
      Categories: <ProductCategories />,
      Brands: <ProductBrands />,
      Units: <InventoryUnits />,
    },
    subcategoryPermissions: {
      Products: "inventory-product:view",
      Categories: "inventory-category:view",
      Brands: "inventory-brand:view",
      Units: "inventory-unit:view",
    },
  },

  "Warehouse Management": {
    icon: createSectionIcon(Layers01Icon),
    subcategories: {
      Warehouses: <Warehouses />,
      Locations: <WarehouseLocations />,
    },
    subcategoryPermissions: {
      Warehouses: "inventory-warehouse:view",
      Locations: "inventory-location:view",
    },
  },

  "Stock Control": {
    icon: createSectionIcon(ArrowDataTransferHorizontalIcon),
    subcategories: {
      "Stock Overview": <StockOverview />,
      "Stock Movements": <StockMovements />,
      "Stock Adjustments": <StockAdjustments />,
      "Stock Transfers": <StockTransfers />,
    },
    subcategoryPermissions: {
      "Stock Overview": "inventory-stock:view",
      "Stock Movements": "inventory-movement:view",
      "Stock Adjustments": "inventory-adjustment:view",
      "Stock Transfers": "inventory-transfer:view",
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
