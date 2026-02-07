// sections.js
import React from "react"
import { FaUsers, FaCog, FaInfoCircle, FaChartBar, FaUserFriends } from "react-icons/fa"
import { LuLayoutDashboard } from "react-icons/lu"
import { FiLayers, FiTarget } from "react-icons/fi"

import Dashboard from "./DashboardContent"
import Customers from "./CustomersPage"
import AdminLead from "./AdminLeadPage"
import Users from "./UserContent"
import ProfileSettings from "./ProfileSettings"
import About from "./About"

import TitlesAdd from "./TittlesAdd"
import EngagementTemplatePage from "./EngagementTemplatePage"
import PurchaseTypePage from "./PurchaseTypePage"

import CustomerCRMInner from "./CustomerCRMInner"
import ClientReport from "./ClientReport"
import AdminEmployeeReportPage from "./EmployeeReportPage"



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
