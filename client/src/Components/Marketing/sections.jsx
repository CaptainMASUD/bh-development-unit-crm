// ===============================
// ✅ sections.js (or sections.jsx)
// ✅ UPDATED: Adds Profile Settings before About
// ===============================

import { MdDashboard } from "react-icons/md"
import { FaInfoCircle } from "react-icons/fa"
import { FiUsers } from "react-icons/fi"
import { FiUser } from "react-icons/fi"

import DashboardContent from "./DashboardContent"
import LeadPage from "./LeadPage"
import AboutPage from "./About"
import MarketingTeamProfileSettings from "./ProfileSettings"


export const sections = {
  Dashboard: {
    icon: <MdDashboard className="w-5 h-5" />,
    component: <DashboardContent />,
  },
  Leads: {
    icon: <FiUsers className="w-5 h-5" />,
    component: <LeadPage />,
  },

  // ✅ NEW: Profile Settings
  "Profile Settings": {
    icon: <FiUser className="w-5 h-5" />,
    component: <MarketingTeamProfileSettings />,
  },

  About: {
    icon: <FaInfoCircle className="w-5 h-5" />,
    component: <AboutPage />,
  },
}
