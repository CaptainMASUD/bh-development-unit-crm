/* eslint-disable react-refresh/only-export-components -- route registry intentionally owns lazy page references */
import { lazy } from "react"
import { MdDashboard } from "react-icons/md"
import { FiBarChart2, FiCalendar, FiClock, FiCreditCard, FiDollarSign, FiPackage, FiUsers } from "react-icons/fi"
import { FaInfoCircle, FaClipboardList } from "react-icons/fa"
import { FiSettings, FiTarget } from "react-icons/fi"
import { PERMISSIONS } from "../Auth/permissions"

// components
const UnifiedDashboard = lazy(() => import("./UnifiedDashboard"))
const CustomersPage = lazy(() => import("./ClientsPage"))
const AboutPage = lazy(() => import("./About"))

// ✅ NEW: Workflow Procedure (Employee Read-only page)
const WorkflowProcedurePage = lazy(() => import("./Workflowprocedure"))

// ✅ NEW: Profile (Employee) — keep BELOW Workflow Procedure and ABOVE About
const ProfileSettingsEmployee = lazy(() => import("./ProfileSettings"))
const LeadPage = lazy(() => import("./LeadPage"))
const DealsPage = lazy(() => import("./DealsPage"))
const EmployeeLeaveRequests = lazy(() => import("./LeaveRequests"))
const EmployeeAttendancePage = lazy(() => import("./SelfServicePages").then((module) => ({ default: module.EmployeeAttendancePage })))
const EmployeeLoansPage = lazy(() => import("./SelfServicePages").then((module) => ({ default: module.EmployeeLoansPage })))
const EmployeePayrollPage = lazy(() => import("./SelfServicePages").then((module) => ({ default: module.EmployeePayrollPage })))
const EmployeeRosterPage = lazy(() => import("./SelfServicePages").then((module) => ({ default: module.EmployeeRosterPage })))
const EmployeeManager = lazy(() => import("../Admin/payroll/Employee"))
const AttendanceManager = lazy(() => import("../Admin/payroll/Attendance"))
const SalaryManager = lazy(() => import("../Admin/payroll/AdminSalaryPage"))
const PayrollManager = lazy(() => import("../Admin/payroll/PayrollManager"))
const LoanManager = lazy(() => import("../Admin/payroll/EmployeeLoans"))
const LeaveManager = lazy(() => import("../Admin/payroll/LeaveRequests"))
const RosterManager = lazy(() => import("../Admin/payroll/RosterShiftSetup"))
const AccessControl = lazy(() => import("../Admin/system/AccessControl"))
const TaxSetup = lazy(() => import("../Admin/payroll/TaxSetup"))
const TaxReport = lazy(() => import("../Admin/reports/TaxReport"))
const Expenses = lazy(() => import("../Admin/accounting/Expenses"))
const ExpenseSetup = lazy(() => import("../Admin/accounting/ExpenseSetup"))
const ChartOfAccounts = lazy(() => import("../Admin/accounting/ChartOfAccounts"))
const AccountingSettings = lazy(() => import("../Admin/accounting/AccountingSettings"))
const FiscalYearPeriods = lazy(() => import("../Admin/accounting/FiscalYearPeriods"))
const JournalEntries = lazy(() => import("../Admin/accounting/JournalEntries"))
const GeneralLedger = lazy(() => import("../Admin/accounting/GeneralLedger"))
const CashBook = lazy(() => import("../Admin/accounting/CashBook"))
const AccountsReceivable = lazy(() => import("../Admin/accounting/AccountsReceivable"))
const AccountsPayable = lazy(() => import("../Admin/accounting/AccountsPayable"))
const OpeningBalances = lazy(() => import("../Admin/accounting/OpeningBalances"))
const TrialBalance = lazy(() => import("../Admin/accounting/TrialBalance"))
const BalanceSheet = lazy(() => import("../Admin/accounting/BalanceSheet"))
const CashFlowStatement = lazy(() => import("../Admin/accounting/CashFlowStatement"))
const BankTransactions = lazy(() => import("../Admin/banking/BankTransactions"))
const MoneyTransfer = lazy(() => import("../Admin/banking/MoneyTransfer"))
const BankReconciliation = lazy(() => import("../Admin/banking/BankReconciliation"))
const BankSetup = lazy(() => import("../Admin/banking/BankSetup"))
const CashManagement = lazy(() => import("../Admin/banking/CashManagement"))
const TreasuryVouchers = lazy(() => import("../Admin/banking/TreasuryVouchers"))
const ProfitLoss = lazy(() => import("../Admin/accounting/ProfitLoss"))
const Products = lazy(() => import("../Admin/inventory/Product"))
const ProductCategories = lazy(() => import("../Admin/inventory/ProductCategory"))
const ProductBrands = lazy(() => import("../Admin/inventory/ProductBrand"))
const InventoryUnits = lazy(() => import("../Admin/inventory/InventoryUnit"))
const Warehouses = lazy(() => import("../Admin/inventory/Warehouse"))
const WarehouseLocations = lazy(() => import("../Admin/inventory/WarehouseLocation"))
const StockOverview = lazy(() => import("../Admin/inventory/StockOverview"))
const StockMovements = lazy(() => import("../Admin/inventory/StockMovements"))
const StockAdjustments = lazy(() => import("../Admin/inventory/StockAdjustments"))
const StockTransfers = lazy(() => import("../Admin/inventory/StockTransfers"))
const Suppliers = lazy(() => import("../Admin/Supplier/SupplierSetup"))
const SupplierProducts = lazy(() => import("../Admin/Supplier/SupplierProducts"))

export const sections = {
  Dashboard: {
    icon: <MdDashboard className="w-5 h-5" />,
    component: <UnifiedDashboard />,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },

  "CRM Analytics": {
    icon: <MdDashboard className="w-5 h-5" />,
    component: <UnifiedDashboard />,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },

  Clients: {
    icon: <FiUsers className="w-5 h-5" />,
    component: <CustomersPage />,
    permission: PERMISSIONS.CUSTOMERS_VIEW,
  },

  Leads: {
    icon: <FiTarget className="w-5 h-5" />,
    component: <LeadPage />,
    permission: PERMISSIONS.LEADS_VIEW,
  },

  Deals: {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <DealsPage />,
    permission: PERMISSIONS.DEALS_VIEW,
  },

  "Product Management": {
    icon: <FiPackage className="w-5 h-5" />,
    subcategories: {
      Products: <Products />,
      Categories: <ProductCategories />,
      Brands: <ProductBrands />,
      Units: <InventoryUnits />,
    },
    subcategoryPermissions: {
      Products: PERMISSIONS.INVENTORY_PRODUCT_VIEW,
      Categories: PERMISSIONS.INVENTORY_CATEGORY_VIEW,
      Brands: PERMISSIONS.INVENTORY_BRAND_VIEW,
      Units: PERMISSIONS.INVENTORY_UNIT_VIEW,
    },
  },

  "Warehouse Management": {
    icon: <FiPackage className="w-5 h-5" />,
    subcategories: {
      Warehouses: <Warehouses />,
      Locations: <WarehouseLocations />,
    },
    subcategoryPermissions: {
      Warehouses: PERMISSIONS.INVENTORY_WAREHOUSE_VIEW,
      Locations: PERMISSIONS.INVENTORY_LOCATION_VIEW,
    },
  },

  "Stock Control": {
    icon: <FiPackage className="w-5 h-5" />,
    subcategories: {
      "Stock Overview": <StockOverview />,
      "Stock Movements": <StockMovements />,
      "Stock Adjustments": <StockAdjustments />,
      "Stock Transfers": <StockTransfers />,
    },
    subcategoryPermissions: {
      "Stock Overview": PERMISSIONS.INVENTORY_STOCK_VIEW,
      "Stock Movements": PERMISSIONS.INVENTORY_MOVEMENT_VIEW,
      "Stock Adjustments": PERMISSIONS.INVENTORY_ADJUSTMENT_VIEW,
      "Stock Transfers": PERMISSIONS.INVENTORY_TRANSFER_VIEW,
    },
  },

  Suppliers: {
    icon: <FiUsers className="w-5 h-5" />,
    component: <Suppliers />,
    permission: PERMISSIONS.SUPPLIER_VIEW,
  },

  "Supplier Products": {
    icon: <FiPackage className="w-5 h-5" />,
    component: <SupplierProducts />,
    permission: PERMISSIONS.SUPPLIER_VIEW,
  },

  Expenses: {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <Expenses />,
    permission: PERMISSIONS.EXPENSES_VIEW,
  },

  "Cash Management": { icon: <FiDollarSign className="w-5 h-5" />, component: <CashManagement />, permission: PERMISSIONS.FINANCE_VIEW },
  Voucher: {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <TreasuryVouchers />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  Setup: {
    icon: <FiSettings className="w-5 h-5" />,
    subcategories: {
      "Expense Setup": <ExpenseSetup />,
      "Bank Setup": <BankSetup />,
    },
    subcategoryPermissions: {
      "Expense Setup": PERMISSIONS.EXPENSE_SETUP_VIEW,
      "Bank Setup": PERMISSIONS.BANK_SETUP_VIEW,
    },
  },

  "Accounting Setup": {
    icon: <FiDollarSign className="w-5 h-5" />,
    permission: PERMISSIONS.FINANCE_VIEW,
    subcategories: {
      "Chart of Accounts": <ChartOfAccounts />,
      "Fiscal Year / Period": <FiscalYearPeriods />,
      "Accounting Settings": <AccountingSettings />,
      "Opening Balance": <OpeningBalances />,
    },
    subcategoryPermissions: {
      "Chart of Accounts": PERMISSIONS.FINANCE_MANAGE,
      "Fiscal Year / Period": PERMISSIONS.FINANCE_MANAGE,
      "Accounting Settings": PERMISSIONS.FINANCE_MANAGE,
      "Opening Balance": PERMISSIONS.FINANCE_MANAGE,
    },
  },

  "Journal Entries": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <JournalEntries />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "General Ledger": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <GeneralLedger />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Cash Book": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <CashBook />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Accounts Receivable": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <AccountsReceivable />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Accounts Payable": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <AccountsPayable />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Profit & Loss": {
    icon: <FiBarChart2 className="w-5 h-5" />,
    component: <ProfitLoss />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Trial Balance": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <TrialBalance />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Balance Sheet": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <BalanceSheet />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Cash Flow Statement": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <CashFlowStatement />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Bank Transactions": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <BankTransactions />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Money Transfer": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <MoneyTransfer />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "Bank Reconciliation": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <BankReconciliation />,
    permission: PERMISSIONS.FINANCE_VIEW,
  },

  "My Attendance": {
    icon: <FiCalendar className="w-5 h-5" />,
    component: <EmployeeAttendancePage />,
    permission: PERMISSIONS.ATTENDANCE_VIEW,
  },

  "My Roster": {
    icon: <FiClock className="w-5 h-5" />,
    component: <EmployeeRosterPage />,
    permission: PERMISSIONS.ROSTER_VIEW,
  },

  "My Payroll": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <EmployeePayrollPage />,
    permission: PERMISSIONS.PAYROLL_VIEW,
  },

  "My Loans": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <EmployeeLoansPage />,
    permission: PERMISSIONS.LOANS_VIEW,
  },

  "My Leave": {
    icon: <FiCalendar className="w-5 h-5" />,
    component: <EmployeeLeaveRequests />,
    permission: PERMISSIONS.LEAVES_VIEW,
  },

  "Employee Management": {
    icon: <FiUsers className="w-5 h-5" />,
    component: <EmployeeManager />,
    permission: PERMISSIONS.EMPLOYEES_VIEW,
  },

  "Attendance Management": {
    icon: <FiCalendar className="w-5 h-5" />,
    component: <AttendanceManager />,
    permission: PERMISSIONS.ATTENDANCE_MANAGE,
  },

  "Salary Management": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <SalaryManager />,
    permission: PERMISSIONS.SALARY_MANAGE,
  },

  "Payroll Management": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <PayrollManager />,
    permission: PERMISSIONS.PAYROLL_MANAGE,
  },

  "Tax Setup": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <TaxSetup />,
    permission: PERMISSIONS.TAX_VIEW,
  },

  "Tax Report": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <TaxReport />,
    permission: PERMISSIONS.TAX_REPORT,
  },

  "Loan Management": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <LoanManager />,
    permission: PERMISSIONS.LOANS_MANAGE,
  },

  "Leave Management": {
    icon: <FiCalendar className="w-5 h-5" />,
    component: <LeaveManager />,
    permission: PERMISSIONS.LEAVES_MANAGE,
  },

  "Roster Management": {
    icon: <FiClock className="w-5 h-5" />,
    component: <RosterManager />,
    permission: PERMISSIONS.ROSTER_MANAGE,
  },

  "Access Control": {
    icon: <FiUsers className="w-5 h-5" />,
    component: <AccessControl />,
    permission: PERMISSIONS.ACCESS_CONTROL_VIEW,
  },

  // ✅ ADDED: after Clients, before Profile Settings
  "Workflow Procedure": {
    icon: <FaClipboardList className="w-5 h-5" />,
    component: <WorkflowProcedurePage />,
    permission: PERMISSIONS.WORKFLOW_VIEW,
  },

  "Profile Settings": {
    icon: <FiSettings className="w-5 h-5" />,
    component: <ProfileSettingsEmployee />,
    permission: PERMISSIONS.PROFILE_VIEW,
  },

  About: {
    icon: <FaInfoCircle className="w-5 h-5" />,
    component: <AboutPage />,
  },
}
