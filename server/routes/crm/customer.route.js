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
} from "../../controllers/customer.controller.js";

import {
  protect,
  isAdminOrSuperAdmin,
  requirePermission,
} from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

/**
 * Decide customer-module access at route level through permission groups.
 */
router.use(requirePermission("customers:view"));

/* =========================
   ✅ EMPLOYEES (assign helper)
========================= */
router.get("/employees/search", requirePermission("customers:manage"), searchEmployeesForCustomerAssign);

/* =========================
   ✅ CUSTOMERS
========================= */
router.get("/", getCustomers);

// Permissioned users can create direct customers.
router.post("/", requirePermission("customers:manage"), createCustomer);

// ✅ admin-only onboarding status update
router.patch("/:id/status", requirePermission("customers:manage"), updateCustomerStatus);

/* =========================
   ✅ JOBS (Customer -> Job -> SubJob)
   Max depth = 2
========================= */
router.get("/:id/jobs", getCustomerJobs);
router.post("/:id/jobs", requirePermission("customers:manage"), addCustomerJob);
router.patch("/:id/jobs/:jobId", requirePermission("customers:manage"), updateCustomerJob);
router.delete("/:id/jobs/:jobId", requirePermission("customers:manage"), deleteCustomerJob);

/* =========================
   ✅ CUSTOMER TASKS / ENGAGEMENTS
========================= */
router.get("/:id/tasks", getCustomerTasks);
router.patch("/:id/engagements", requirePermission("customers:manage"), upsertCustomerEngagement);

router.patch("/:id", requirePermission("customers:manage"), updateCustomer);

// ✅ assignment + delete are admin-only
router.patch("/:id/assign", requirePermission("customers:manage"), assignCustomer);
router.delete("/:id", requirePermission("customers:manage"), deleteCustomer);

router.get("/:id", getCustomerById);

export default router;
