import { MdDashboard } from "react-icons/md"
import { FiUsers } from "react-icons/fi"
import { FaInfoCircle } from "react-icons/fa"
import { FiSettings } from "react-icons/fi"

// components
import DashboardContent from "./DashboardContent"
import CustomersPage from "./CustomersPage"
import AboutPage from "./About"

// ✅ NEW: Profile (Employee) — put ABOVE About
import ProfileSettingsEmployee from "./ProfileSettings" // <-- adjust path if needed

export const sections = {
  Dashboard: {
    icon: <MdDashboard className="w-5 h-5" />,
    component: <DashboardContent />,
  },
  Customers: {
    icon: <FiUsers className="w-5 h-5" />,
    component: <CustomersPage />,
  },

  // ✅ NEW: add this option and keep it ABOVE About
  "Profile Settings": {
    icon: <FiSettings className="w-5 h-5" />,
    component: <ProfileSettingsEmployee />,
  },

  About: {
    icon: <FaInfoCircle className="w-5 h-5" />,
    component: <AboutPage />,
  },
}
