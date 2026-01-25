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
  updateCustomerStatus, // ✅ NEW
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

router.get("/employees/search", isAdminOrSuperAdmin, searchEmployeesForCustomerAssign);

router.get("/", getCustomers);
router.post("/", blockMarketingCreateCustomer, createCustomer);

// ✅ NEW: admin-only onboarding status update
router.patch("/:id/status", isAdminOrSuperAdmin, updateCustomerStatus);

router.get("/:id/tasks", getCustomerTasks);
router.patch("/:id/engagements", upsertCustomerEngagement);
router.patch("/:id", updateCustomer);

router.patch("/:id/assign", isAdminOrSuperAdmin, assignCustomer);
router.delete("/:id", isAdminOrSuperAdmin, deleteCustomer);

router.get("/:id", getCustomerById);

export default router;
