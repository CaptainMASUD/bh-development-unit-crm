import { MdDashboard } from "react-icons/md"
import { FaInfoCircle } from "react-icons/fa"
import { FiUsers } from "react-icons/fi"

import DashboardContent from "./DashboardContent"
import LeadPage from "./LeadPage" // ✅ create/import your LeadPage component
import AboutPage from "./About"

export const sections = {
  Dashboard: {
    icon: <MdDashboard className="w-5 h-5" />,
    component: <DashboardContent />,
  },
  Leads: {
    icon: <FiUsers className="w-5 h-5" />,
    component: <LeadPage />,
  },
  About: {
    icon: <FaInfoCircle className="w-5 h-5" />,
    component: <AboutPage />,
  },
}
