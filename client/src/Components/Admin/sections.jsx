// sections.js (or whatever your sections config file is named)
import React from "react"
import { FaUserFriends, FaUsers, FaCog, FaInfoCircle, FaChartBar } from "react-icons/fa"
import { LuLayoutDashboard } from "react-icons/lu"
import { FiLayers } from "react-icons/fi"

import Dashboard from "./DashboardContent"
import Customers from "./CustomersPage"
import Users from "./UserContent"
import ProfileSettings from "./ProfileSettings"
import About from "./About"

import TitlesAdd from "./TittlesAdd"
import EngagementTemplatePage from "./EngagementTemplatePage"

// ✅ NEW: Employee Report page/component
import EmployeeReportPage from "./EmployeeReportPage"

const sections = {
  Dashboard: {
    icon: <LuLayoutDashboard className="w-5 h-5" />,
    component: <Dashboard />,
  },

  Customers: {
    icon: <FaUserFriends className="w-5 h-5" />,
    component: <Customers />,
  },

  "Workflow Setup": {
    icon: <FiLayers className="w-5 h-5" />,
    subcategories: {
      "Task Titles": <TitlesAdd />,
      "Engagement Types": <EngagementTemplatePage />,
    },
  },

  // ✅ NEW: Report dropdown (like Workflow Setup)
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
