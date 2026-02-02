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

  // ✅ NEW: jobs
  getCustomerJobs,
  addCustomerJob,
  updateCustomerJob,
  deleteCustomerJob,
} from "../controllers/customer.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

const blockMarketingCreateCustomer = (req, res, next) => {
  if (req.user?.role === "marketing_team") {
    return res
      .status(403)
      .json({ message: "Marketing team cannot create customers directly." });
  }
  next();
};

/* =========================
   ✅ EMPLOYEES (assign helper)
========================= */
router.get("/employees/search", isAdminOrSuperAdmin, searchEmployeesForCustomerAssign);

/* =========================
   ✅ CUSTOMERS
========================= */
router.get("/", getCustomers);
router.post("/", blockMarketingCreateCustomer, createCustomer);

// ✅ admin-only onboarding status update
router.patch("/:id/status", isAdminOrSuperAdmin, updateCustomerStatus);

/* =========================
   ✅ JOBS (Customer -> Job -> SubJob)
   Max depth = 2
========================= */
// get jobs tree + flat list
router.get("/:id/jobs", getCustomerJobs);

// create job (root) or sub-job (send parentJobId)
router.post("/:id/jobs", isAdminOrSuperAdmin, addCustomerJob);

// update job/sub-job
router.patch("/:id/jobs/:jobId", isAdminOrSuperAdmin, updateCustomerJob);

// delete job/sub-job (optional force=true deletes tasks for those jobs too)
router.delete("/:id/jobs/:jobId", isAdminOrSuperAdmin, deleteCustomerJob);

/* =========================
   ✅ CUSTOMER TASKS / ENGAGEMENTS
   (You can keep these OR remove tasks route here
    since task.route.js already serves /customers/:customerId/tasks)
========================= */
router.get("/:id/tasks", getCustomerTasks);
router.patch("/:id/engagements", upsertCustomerEngagement);

router.patch("/:id", updateCustomer);

router.patch("/:id/assign", isAdminOrSuperAdmin, assignCustomer);
router.delete("/:id", isAdminOrSuperAdmin, deleteCustomer);

router.get("/:id", getCustomerById);

export default router;
