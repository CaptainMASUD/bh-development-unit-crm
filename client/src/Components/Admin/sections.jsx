/* eslint-disable react-refresh/only-export-components -- route registry intentionally owns lazy page references */
// sections.jsx
import { lazy } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Analytics01Icon,
  ArrowDataTransferHorizontalIcon,
  BalanceScaleIcon,
  BankIcon,
  BanknoteIcon,
  BookOpen01Icon,
  Briefcase01Icon,
  Calculator01Icon,
  Calendar03Icon,
  CalendarMinus01Icon,
  ChartLineData01Icon,
  ChartLineData02Icon,
  DashboardSquare01Icon,
  DollarCircleIcon,
  FileChartColumnIcon,
  HandCoinsIcon,
  InformationCircleIcon,
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
const OpeningBalances = lazy(() => import("./accounting/OpeningBalances"))
const AccountingSettings = lazy(() => import("./accounting/AccountingSettings"))
const FiscalYearPeriods = lazy(() => import("./accounting/FiscalYearPeriods"))
const TrialBalance = lazy(() => import("./accounting/TrialBalance"))
const BalanceSheet = lazy(() => import("./accounting/BalanceSheet"))
const CashFlowStatement = lazy(() => import("./accounting/CashFlowStatement"))
const ProfileSettings = lazy(() => import("./system/ProfileSettings"))
const About = lazy(() => import("./system/About"))
const TitlesAdd = lazy(() => import("./workflow/TittlesAdd"))
const EngagementTemplatePage = lazy(() => import("./workflow/EngagementTemplatePage"))
const PurchaseTypePage = lazy(() => import("./workflow/PurchaseTypePage"))
const CustomerCRMInner = lazy(() => import("./crm/CustomerCRMInner"))
const ClientReport = lazy(() => import("./reports/ClientReport"))
const AdminEmployeeReportPage = lazy(() => import("./reports/EmployeeReportPage"))
const TaxReport = lazy(() => import("./reports/TaxReport"))
const AccessControl = lazy(() => import("./system/AccessControl"))

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
  "Bank Management": { icon: createSectionIcon(BankIcon), component: <BankSetup />, permission: "bank-setup:view" },
  "Payment Voucher": { icon: createSectionIcon(HandCoinsIcon), component: <TreasuryVouchers defaultType="payment" />, permission: "finance:view" },
  "Receive Voucher": { icon: createSectionIcon(ReceiptDollarIcon), component: <TreasuryVouchers defaultType="receipt" />, permission: "finance:view" },
  "Contra Voucher": { icon: createSectionIcon(ArrowDataTransferHorizontalIcon), component: <TreasuryVouchers defaultType="contra" />, permission: "finance:view" },

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

  "General Ledger": {
    icon: createSectionIcon(BookOpen01Icon),
    component: <GeneralLedger />,
    permission: "finance:view",
  },

  "Trial Balance": {
    icon: createSectionIcon(BalanceScaleIcon),
    component: <TrialBalance />,
    permission: "finance:view",
  },

  "Balance Sheet": {
    icon: createSectionIcon(FileChartColumnIcon),
    component: <BalanceSheet />,
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

  About: {
    icon: createSectionIcon(InformationCircleIcon),
    component: <About />,
  },
}

export { sections }
export default sections
