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

import {
  protect,
  isAdminOrSuperAdmin,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

/**
 * ✅ Decide customer-module access at route level.
 * Option A (recommended): Only employee/admin/superadmin can use /customers at all.
 * - If you DO want marketing (assigned) to view customers, remove the marketing check below.
 */
router.use(requirePermission("customers:view"));

/* =========================
   ✅ EMPLOYEES (assign helper)
========================= */
router.get("/employees/search", isAdminOrSuperAdmin, searchEmployeesForCustomerAssign);

/* =========================
   ✅ CUSTOMERS
========================= */
router.get("/", getCustomers);

// employee can create direct customer; marketing blocked by middleware above
router.post("/", requirePermission("customers:manage"), createCustomer);

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
router.patch("/:id/engagements", requirePermission("customers:manage"), upsertCustomerEngagement);

router.patch("/:id", requirePermission("customers:manage"), updateCustomer);

// ✅ assignment + delete are admin-only
router.patch("/:id/assign", isAdminOrSuperAdmin, assignCustomer);
router.delete("/:id", isAdminOrSuperAdmin, deleteCustomer);

router.get("/:id", getCustomerById);

export default router;
