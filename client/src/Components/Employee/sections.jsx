import { MdDashboard } from "react-icons/md"
import { FiUsers } from "react-icons/fi"
import { FaInfoCircle, FaClipboardList } from "react-icons/fa"
import { FiSettings } from "react-icons/fi"

// components
import DashboardContent from "./DashboardContent"
import CustomersPage from "./CustomersPage"
import AboutPage from "./About"

// ✅ NEW: Workflow Procedure (Employee Read-only page)
import WorkflowProcedurePage from "./Workflowprocedure" // <-- adjust path if needed

// ✅ NEW: Profile (Employee) — keep BELOW Workflow Procedure and ABOVE About
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

  // ✅ ADDED: after Customers, before Profile Settings
  "Workflow Procedure": {
    icon: <FaClipboardList className="w-5 h-5" />,
    component: <WorkflowProcedurePage />,
  },

  "Profile Settings": {
    icon: <FiSettings className="w-5 h-5" />,
    component: <ProfileSettingsEmployee />,
  },

  About: {
    icon: <FaInfoCircle className="w-5 h-5" />,
    component: <AboutPage />,
  },
}
