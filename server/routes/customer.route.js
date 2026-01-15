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
} from "../controllers/customer.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// marketing_team cannot create customers directly
const blockMarketingCreateCustomer = (req, res, next) => {
  if (req.user?.role === "marketing_team") {
    return res
      .status(403)
      .json({ message: "Marketing team cannot create customers directly." });
  }
  next();
};

// list customers (NOW supports engagement filters)
router.get("/", getCustomers);

// create customer
router.post("/", blockMarketingCreateCustomer, createCustomer);

// customer details
router.get("/:id", getCustomerById);

// customer tasks
router.get("/:id/tasks", getCustomerTasks);

// update customer
router.patch("/:id", updateCustomer);

// upsert engagement
router.patch("/:id/engagements", upsertCustomerEngagement);

// admin only
router.delete("/:id", isAdminOrSuperAdmin, deleteCustomer);
router.patch("/:id/assign", isAdminOrSuperAdmin, assignCustomer);

export default router;
