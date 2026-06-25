import { MdDashboard } from "react-icons/md"
import { FiUsers } from "react-icons/fi"
import { FaInfoCircle, FaClipboardList } from "react-icons/fa"
import { FiSettings, FiTarget } from "react-icons/fi"
import { PERMISSIONS } from "../Auth/permissions"

// components
import DashboardContent from "./DashboardContent"
import CustomersPage from "./CustomersPage"
import AboutPage from "./About"

// ✅ NEW: Workflow Procedure (Employee Read-only page)
import WorkflowProcedurePage from "./Workflowprocedure" // <-- adjust path if needed

// ✅ NEW: Profile (Employee) — keep BELOW Workflow Procedure and ABOVE About
import ProfileSettingsEmployee from "./ProfileSettings" // <-- adjust path if needed
import LeadOperationsDashboard from "./LeadOperationsDashboard"
import LeadPage from "./LeadPage"

export const sections = {
  Dashboard: {
    icon: <MdDashboard className="w-5 h-5" />,
    component: <DashboardContent />,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },

  Customers: {
    icon: <FiUsers className="w-5 h-5" />,
    component: <CustomersPage />,
    permission: PERMISSIONS.CUSTOMERS_VIEW,
  },

  "Marketing Leads": {
    icon: <FiTarget className="w-5 h-5" />,
    subcategories: {
      Dashboard: <LeadOperationsDashboard />,
      Leads: <LeadPage />,
    },
    permission: PERMISSIONS.LEADS_VIEW,
  },

  // ✅ ADDED: after Customers, before Profile Settings
  "Workflow Procedure": {
    icon: <FaClipboardList className="w-5 h-5" />,
    component: <WorkflowProcedurePage />,
    permission: PERMISSIONS.WORKFLOW_VIEW,
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
