import { MdDashboard } from "react-icons/md"
import { FiCalendar, FiClock, FiCreditCard, FiDollarSign, FiUsers } from "react-icons/fi"
import { FaInfoCircle, FaClipboardList } from "react-icons/fa"
import { FiSettings, FiTarget } from "react-icons/fi"
import { PERMISSIONS } from "../Auth/permissions"

// components
import UnifiedDashboard from "./UnifiedDashboard"
import CustomersPage from "./ClientsPage"
import AboutPage from "./About"

// ✅ NEW: Workflow Procedure (Employee Read-only page)
import WorkflowProcedurePage from "./Workflowprocedure" // <-- adjust path if needed

// ✅ NEW: Profile (Employee) — keep BELOW Workflow Procedure and ABOVE About
import ProfileSettingsEmployee from "./ProfileSettings" // <-- adjust path if needed
import LeadPage from "./LeadPage"
import DealsPage from "./DealsPage"
import { EmployeeAttendancePage, EmployeeLoansPage, EmployeePayrollPage, EmployeeRosterPage } from "./SelfServicePages"
import EmployeeLeaveRequests from "./LeaveRequests"
import EmployeeManager from "../Admin/Employee"
import AttendanceManager from "../Admin/Attendance"
import SalaryManager from "../Admin/AdminSalaryPage"
import PayrollManager from "../Admin/PayrollManager"
import LoanManager from "../Admin/EmployeeLoans"
import LeaveManager from "../Admin/LeaveRequests"
import RosterManager from "../Admin/RosterShiftSetup"
import AccessControl from "../Admin/AccessControl"
import TaxSetup from "../Admin/TaxSetup"
import TaxReport from "../Admin/TaxReport"
import AccountingModules from "../Admin/AccountingModules"
import Expenses from "../Admin/Expenses"

export const sections = {
  Dashboard: {
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

  Expenses: {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <Expenses />,
    permission: PERMISSIONS.EXPENSES_VIEW,
  },

  Finance: {
    icon: <FiDollarSign className="w-5 h-5" />,
    component: <AccountingModules />,
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
