// sections.js
import { FaUsers, FaCog, FaInfoCircle, FaChartBar, FaUserFriends } from "react-icons/fa"
import { LuLayoutDashboard } from "react-icons/lu"
import { FiBriefcase, FiCalendar, FiCreditCard, FiDollarSign, FiLayers, FiTarget } from "react-icons/fi"

import Dashboard from "./DashboardContent"
import Customers from "./CustomersPage"
import AdminLead from "./AdminLeadPage"
import AdminDealsPage from "./AdminDealsPage"
import Users from "./UserContent"
import Employee from "./Employee"
import Attendance from "./Attendance"
import AdminSalaryPage from "./AdminSalaryPage"
import PayrollManager from "./PayrollManager"
import EmployeeLoans from "./EmployeeLoans"
import LeaveRequests from "./LeaveRequests"
import LeaveSetup from "./LeaveSetup"
import RosterShiftSetup from "./RosterShiftSetup"
import TaxSetup from "./TaxSetup"
import ExpenseSetup from "./ExpenseSetup"
import BankSetup from "./BankSetup"
import Expenses from "./Expenses"
import AccountingModules from "./AccountingModules"
import BankTransactions from "./banking/BankTransactions"
import MoneyTransfer from "./banking/MoneyTransfer"
import BankReconciliation from "./banking/BankReconciliation"
import ChartOfAccounts from "./accounting/ChartOfAccounts"
import JournalEntries from "./accounting/JournalEntries"
import GeneralLedger from "./accounting/GeneralLedger"
import OpeningBalances from "./accounting/OpeningBalances"
import AccountingSettings from "./accounting/AccountingSettings"
import FiscalYearPeriods from "./accounting/FiscalYearPeriods"
import TrialBalance from "./accounting/TrialBalance"
import BalanceSheet from "./accounting/BalanceSheet"
import CashFlowStatement from "./accounting/CashFlowStatement"
import ProfileSettings from "./ProfileSettings"
import About from "./About"

import TitlesAdd from "./TittlesAdd"
import EngagementTemplatePage from "./EngagementTemplatePage"
import PurchaseTypePage from "./PurchaseTypePage"

import CustomerCRMInner from "./CustomerCRMInner"
import ClientReport from "./ClientReport"
import AdminEmployeeReportPage from "./EmployeeReportPage"
import TaxReport from "./TaxReport"
import AccessControl from "./AccessControl"



const sections = {
  Dashboard: {
    icon: <LuLayoutDashboard className="w-5 h-5" />,
    component: <Dashboard />,
  },

  Clients: {
    icon: <FaUserFriends className="w-5 h-5" />,
    subcategories: {
      Clients: <Customers />,
      "Client Tasks": <CustomerCRMInner />,
    },
  },

  Leads: {
    icon: <FiTarget className="w-5 h-5" />,
    component: <AdminLead />,
  },

  Deals: {
    icon: <FiBriefcase className="w-5 h-5" />,
    component: <AdminDealsPage />,
  },

  "Workflow Setup": {
    icon: <FiLayers className="w-5 h-5" />,
    subcategories: {
      "Task Titles": <TitlesAdd />,
      "Engagement Types": <EngagementTemplatePage />,
      "Purchase Types": <PurchaseTypePage />,
    },
  },

  Report: {
    icon: <FaChartBar className="w-5 h-5" />,
    subcategories: {
      "Client Report": <ClientReport />,
      // ✅ NEW sub option
      "Employee Report": <AdminEmployeeReportPage />,
      "Tax Report": <TaxReport />,
    },
    subcategoryPermissions: {
      "Tax Report": "tax.report",
    },
  },

  Users: {
    icon: <FaUsers className="w-5 h-5" />,
    component: <Users />,
  },

  Employee: {
    icon: <FaUsers className="w-5 h-5" />,
    component: <Employee />,
  },

  Attendance: {
    icon: <FiCalendar className="w-5 h-5" />,
    component: <Attendance />,
  },

  Salary: {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <AdminSalaryPage />,
  },

  "Payroll Manager": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <PayrollManager />,
  },

  Expenses: {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <Expenses />,
    permission: "expenses:view",
  },

  Finance: {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <AccountingModules />,
    permission: "finance:view",
  },

  "Accounting Setup": {
    icon: <FiLayers className="w-5 h-5" />,
    permission: "finance:view",
    subcategories: {
      "Accounting Settings": <AccountingSettings />,
      "Chart of Accounts": <ChartOfAccounts />,
      "Opening Balance": <OpeningBalances />,
      "Fiscal Year / Period": <FiscalYearPeriods />,
    },
    subcategoryPermissions: {
      "Accounting Settings": "finance:manage",
      "Chart of Accounts": "finance:manage",
      "Opening Balance": "finance:manage",
      "Fiscal Year / Period": "finance:manage",
    },
  },

  "Journal Entries": {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <JournalEntries />,
    permission: "finance:view",
  },

  "General Ledger": {
    icon: <FiLayers className="w-5 h-5" />,
    component: <GeneralLedger />,
    permission: "finance:view",
  },

  "Trial Balance": {
    icon: <FaChartBar className="w-5 h-5" />,
    component: <TrialBalance />,
    permission: "finance:view",
  },

  "Balance Sheet": {
    icon: <FiLayers className="w-5 h-5" />,
    component: <BalanceSheet />,
    permission: "finance:view",
  },

  "Cash Flow Statement": {
    icon: <FaChartBar className="w-5 h-5" />,
    component: <CashFlowStatement />,
    permission: "finance:view",
  },

  "Bank Transactions": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <BankTransactions />,
    permission: "finance:view",
  },

  "Money Transfer": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <MoneyTransfer />,
    permission: "finance:view",
  },

  "Bank Reconciliation": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <BankReconciliation />,
    permission: "finance:view",
  },

  "Employee Loans": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <EmployeeLoans />,
  },

  "Leave Requests": {
    icon: <FiCalendar className="w-5 h-5" />,
    component: <LeaveRequests />,
  },

  Setup: {
    icon: <FiLayers className="w-5 h-5" />,
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
    icon: <FiLayers className="w-5 h-5" />,
    component: <AccessControl />,
  },

  "Profile Settings": {
    icon: <FaCog className="w-5 h-5" />,
    component: <ProfileSettings />,
  },

  About: {
    icon: <FaInfoCircle className="w-5 h-5" />,
    component: <About />,
  },
}

export { sections }
export default sections
