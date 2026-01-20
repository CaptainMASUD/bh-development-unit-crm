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

  // ✅ CRM endpoints
  getCustomerSummary,
  getCustomerTimeline,
  getCustomerDeals,
  getCustomerOrders,
  getCustomerInvoices,

  // ✅ employee search for assignment
  searchEmployeesForCustomerAssign,
} from "../controllers/customer.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * ✅ All customer routes are protected
 */
router.use(protect);

/**
 * marketing_team cannot create customers directly
 */
const blockMarketingCreateCustomer = (req, res, next) => {
  if (req.user?.role === "marketing_team") {
    return res
      .status(403)
      .json({ message: "Marketing team cannot create customers directly." });
  }
  next();
};

/* =========================================================
   ✅ SPECIAL ROUTES (MUST be BEFORE /:id)
========================================================= */

/**
 * ✅ Employee autocomplete for assigning customer (admin only)
 * GET /customers/employees/search?q=masu&limit=10&cursor=<userId>&active=true|false|all
 */
router.get("/employees/search", isAdminOrSuperAdmin, searchEmployeesForCustomerAssign);

/* =========================================================
   ✅ BASE ROUTES
========================================================= */

/**
 * ✅ Customer list
 * Supports filters in controller (status, customerType, engagement filters, etc.)
 * GET /customers?status=pending&customerType=new&...
 */
router.get("/", getCustomers);

/**
 * ✅ Create customer
 * POST /customers
 */
router.post("/", blockMarketingCreateCustomer, createCustomer);

/* =========================================================
   ✅ CUSTOMER ROUTES
========================================================= */

/**
 * ✅ CRM summary endpoints
 * Keep BEFORE "/:id"
 */
router.get("/:id/summary", getCustomerSummary);
router.get("/:id/timeline", getCustomerTimeline);
router.get("/:id/deals", getCustomerDeals);
router.get("/:id/orders", getCustomerOrders);
router.get("/:id/invoices", getCustomerInvoices);

/**
 * ✅ Customer tasks
 */
router.get("/:id/tasks", getCustomerTasks);

/**
 * ✅ Upsert engagement
 */
router.patch("/:id/engagements", upsertCustomerEngagement);

/**
 * ✅ Update customer
 */
router.patch("/:id", updateCustomer);

/**
 * ✅ Admin only actions
 */
router.patch("/:id/assign", isAdminOrSuperAdmin, assignCustomer);
router.delete("/:id", isAdminOrSuperAdmin, deleteCustomer);

/**
 * ✅ Customer details (keep last so it doesn’t shadow /:id/summary etc.)
 */
router.get("/:id", getCustomerById);

export default router;
