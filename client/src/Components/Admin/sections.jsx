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
import RosterShiftSetup from "./RosterShiftSetup"
import ProfileSettings from "./ProfileSettings"
import About from "./About"

import TitlesAdd from "./TittlesAdd"
import EngagementTemplatePage from "./EngagementTemplatePage"
import PurchaseTypePage from "./PurchaseTypePage"

import CustomerCRMInner from "./CustomerCRMInner"
import ClientReport from "./ClientReport"
import AdminEmployeeReportPage from "./EmployeeReportPage"
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

  "Employee Loans": {
    icon: <FiCreditCard className="w-5 h-5" />,
    component: <EmployeeLoans />,
  },

  "Roster / Shift Setup": {
    icon: <FiCalendar className="w-5 h-5" />,
    component: <RosterShiftSetup />,
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
