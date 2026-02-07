// routes/customer.route.js
import express from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  getCustomerTasks,
  updateCustomer,
  deleteCustomer,
  assignCustomer,
  upsertCustomerEngagement,
  searchEmployeesForCustomerAssign,
  updateCustomerStatus,

  // ✅ jobs
  getCustomerJobs,
  addCustomerJob,
  updateCustomerJob,
  deleteCustomerJob,
} from "../controllers/customer.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

/**
 * ✅ Decide customer-module access at route level.
 * Option A (recommended): Only employee/admin/superadmin can use /customers at all.
 * - If you DO want marketing (assigned) to view customers, remove the marketing check below.
 */
const blockMarketingAccessCustomers = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();

  // support both naming styles used in your codebase
  if (role === "marketing" || role === "marketing_team") {
    return res.status(403).json({ message: "Marketing team cannot access customers module." });
  }
  return next();
};

router.use(blockMarketingAccessCustomers);

/* =========================
   ✅ EMPLOYEES (assign helper)
========================= */
router.get("/employees/search", isAdminOrSuperAdmin, searchEmployeesForCustomerAssign);

/* =========================
   ✅ CUSTOMERS
========================= */
router.get("/", getCustomers);

// employee can create direct customer; marketing blocked by middleware above
router.post("/", createCustomer);

// ✅ admin-only onboarding status update
router.patch("/:id/status", isAdminOrSuperAdmin, updateCustomerStatus);

/* =========================
   ✅ JOBS (Customer -> Job -> SubJob)
   Max depth = 2
========================= */
router.get("/:id/jobs", getCustomerJobs);
router.post("/:id/jobs", isAdminOrSuperAdmin, addCustomerJob);
router.patch("/:id/jobs/:jobId", isAdminOrSuperAdmin, updateCustomerJob);
router.delete("/:id/jobs/:jobId", isAdminOrSuperAdmin, deleteCustomerJob);

/* =========================
   ✅ CUSTOMER TASKS / ENGAGEMENTS
========================= */
router.get("/:id/tasks", getCustomerTasks);
router.patch("/:id/engagements", upsertCustomerEngagement);

router.patch("/:id", updateCustomer);

// ✅ assignment + delete are admin-only
router.patch("/:id/assign", isAdminOrSuperAdmin, assignCustomer);
router.delete("/:id", isAdminOrSuperAdmin, deleteCustomer);

router.get("/:id", getCustomerById);

export default router;
