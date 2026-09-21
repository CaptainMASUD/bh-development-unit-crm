/* eslint-disable react-refresh/only-export-components -- route registry intentionally owns lazy page references */
import { lazy } from "react"
import { MdDashboard } from "react-icons/md"
import { FiBarChart2, FiBriefcase, FiCalendar, FiClock, FiCreditCard, FiDollarSign, FiLayers, FiPackage, FiSettings, FiTarget, FiUsers } from "react-icons/fi"
import { FaInfoCircle, FaClipboardList } from "react-icons/fa"
import { PERMISSIONS } from "../Auth/permissions"
import { sections as adminSections } from "../Admin/sections"

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
const DepartmentPosition = lazy(() => import("../Admin/payroll/DepartmentPosition"))
const TaxSetup = lazy(() => import("../Admin/payroll/TaxSetup"))
const TaxReport = lazy(() => import("../Admin/reports/TaxReport"))
const Expenses = lazy(() => import("../Admin/accounting/Expenses"))
const ExpenseSetup = lazy(() => import("../Admin/accounting/ExpenseSetup"))
const ChartOfAccounts = lazy(() => import("../Admin/accounting/ChartOfAccounts"))
const CostCenters = lazy(() => import("../Admin/accounting/CostCenters"))
const AccountingDimensions = lazy(() => import("../Admin/accounting/AccountingDimensions"))
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
const Suppliers = lazy(() => import("../Admin/Supplier/SupplierSetup"))
const SupplierProducts = lazy(() => import("../Admin/Supplier/SupplierProducts"))
const PurchaseOrders = lazy(() => import("../Admin/purchase/PurchaseOrders"))
const GoodsReceipts = lazy(() => import("../Admin/purchase/GoodsReceipts"))
const PurchaseReturns = lazy(() => import("../Admin/purchase/PurchaseReturns"))
const SalesPage = lazy(() => import("../Admin/sales/SalesPage"))
const SalesReports = lazy(() => import("../Admin/sales/SalesReports"))

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

  "Inventory Dashboard": adminSections["Inventory Dashboard"],
  "Inventory Items": adminSections["Inventory Items"],
  "Item Profiles": adminSections["Item Profiles"],
  "Product Management": adminSections["Product Management"],
  "Warehouse Management": adminSections["Warehouse Management"],
  "Inventory Operations": adminSections["Inventory Operations"],
  "Quality Management": adminSections["Quality Management"],
  "Batch, Serial & Expiry": adminSections["Batch, Serial & Expiry"],
  "Consumption History": adminSections["Consumption History"],
  "Inventory Valuation": adminSections["Inventory Valuation"],
  "Inventory Loss Analysis": adminSections["Inventory Loss Analysis"],
  "Inventory Reports": adminSections["Inventory Reports"],

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

  "Purchase Orders": {
    icon: <FaClipboardList className="w-5 h-5" />,
    component: <PurchaseOrders />,
    permission: PERMISSIONS.PURCHASE_ORDER_VIEW,
  },

  "Goods Receipts": {
    icon: <FiPackage className="w-5 h-5" />,
    component: <GoodsReceipts />,
    permission: PERMISSIONS.GOODS_RECEIPT_VIEW,
  },

  "Purchase Returns": {
    icon: <FiPackage className="w-5 h-5" />,
    component: <PurchaseReturns />,
    permission: PERMISSIONS.PURCHASE_RETURN_VIEW,
  },

  "Quick Purchase": adminSections["Quick Purchase"],
  "Purchase Operations": adminSections["Purchase Operations"],
  "Purchase Order Management": adminSections["Purchase Order Management"],
  "Import & Commercial LC": adminSections["Import & Commercial LC"],
  "Price Analysis": adminSections["Price Analysis"],
  "Purchase Reports": adminSections["Purchase Reports"],

  "Sales Quotations": { icon: <FaClipboardList className="w-5 h-5" />, component: <SalesPage kind="quotations" />, permission: PERMISSIONS.SALES_QUOTATION_VIEW },
  "Sales Orders": { icon: <FiCreditCard className="w-5 h-5" />, component: <SalesPage kind="orders" />, permission: PERMISSIONS.SALES_ORDER_VIEW },
  Deliveries: { icon: <FiPackage className="w-5 h-5" />, component: <SalesPage kind="deliveries" />, permission: PERMISSIONS.SALES_DELIVERY_VIEW },
  "Sales Invoices": { icon: <FiDollarSign className="w-5 h-5" />, component: <SalesPage kind="invoices" />, permission: PERMISSIONS.SALES_INVOICE_VIEW },
  "Sales Returns": { icon: <FiPackage className="w-5 h-5" />, component: <SalesPage kind="returns" />, permission: PERMISSIONS.SALES_RETURN_VIEW },
  "Sales Reports": { icon: <FiBarChart2 className="w-5 h-5" />, component: <SalesReports />, permission: PERMISSIONS.SALES_REPORT_VIEW },

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
      "Cost Centers": <CostCenters />,
      "Accounting Dimensions": <AccountingDimensions />,
      "Fiscal Year / Period": <FiscalYearPeriods />,
      "Accounting Settings": <AccountingSettings />,
      "Opening Balance": <OpeningBalances />,
    },
    subcategoryPermissions: {
      "Chart of Accounts": PERMISSIONS.FINANCE_MANAGE,
      "Cost Centers": PERMISSIONS.COST_CENTER_VIEW,
      "Accounting Dimensions": PERMISSIONS.DIMENSION_VIEW,
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

  Reports: {
    icon: <FiBarChart2 className="w-5 h-5" />,
    permission: PERMISSIONS.FINANCE_VIEW,
    subcategories: {
      "Cash Book": <CashBook />,
      "General Ledger": <GeneralLedger />,
      "Balance Sheet": <BalanceSheet />,
      "Trial Balance": <TrialBalance />,
    },
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

  Departments: {
    icon: <FiLayers className="w-5 h-5" />,
    component: <DepartmentPosition key="emp-departments" defaultTab="departments" />,
    permission: PERMISSIONS.EMPLOYEES_VIEW,
  },

  Positions: {
    icon: <FiBriefcase className="w-5 h-5" />,
    component: <DepartmentPosition key="emp-positions" defaultTab="positions" />,
    permission: PERMISSIONS.EMPLOYEES_VIEW,
  },

  "Departments & Positions": {
    icon: <FiLayers className="w-5 h-5" />,
    component: <DepartmentPosition key="emp-dept-pos" />,
    permission: PERMISSIONS.EMPLOYEES_VIEW,
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
