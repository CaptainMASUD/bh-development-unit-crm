// sections.js (or whatever your sections config file is named)
import React from "react"
import { FaUsers, FaCog, FaInfoCircle, FaChartBar, FaUserFriends } from "react-icons/fa"
import { LuLayoutDashboard } from "react-icons/lu"
import { FiLayers } from "react-icons/fi"
import { FiTarget } from "react-icons/fi"

import Dashboard from "./DashboardContent"
import Customers from "./CustomersPage"
import AdminLead from "./AdminLeadPage"
import Users from "./UserContent"
import ProfileSettings from "./ProfileSettings"
import About from "./About"

import TitlesAdd from "./TittlesAdd"
import EngagementTemplatePage from "./EngagementTemplatePage"

// ✅ Employee Report page/component
import EmployeeReportPage from "./EmployeeReportPage"
import CustomerCRMInner from "./CustomerCRMInner"



const sections = {
  Dashboard: {
    icon: <LuLayoutDashboard className="w-5 h-5" />,
    component: <Dashboard />,
  },

  // ✅ NEW: Clients dropdown (replaces old Customers + Client Task Add)
  Clients: {
    icon: <FaUserFriends className="w-5 h-5" />,
    subcategories: {
      // ✅ renamed: Customers -> Clients
      Clients: <Customers />,
      // ✅ renamed: Client Task Add -> Client Tasks
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
    },
  },

  Report: {
    icon: <FaChartBar className="w-5 h-5" />,
    subcategories: {
      "Employee Report": <EmployeeReportPage />,
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
