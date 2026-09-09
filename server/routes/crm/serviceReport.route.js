// routes/serviceReport.route.js
import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  getCustomerServiceHistory,
  getCustomerServiceSummary,
  getGlobalServiceSummary,
} from "../../controllers/serviceReport.controller.js";

const router = express.Router();
router.use(protect);

/**
 * We will mount this router at:
 *   app.use("/api/reports", serviceReportRoutes)
 *
 * So here paths should NOT start with /api/reports again.
 */

// customer reports
// GET /api/reports/services/customer/:customerId/history
router.get("/services/customer/:customerId/history", getCustomerServiceHistory);

// GET /api/reports/services/customer/:customerId/summary
router.get("/services/customer/:customerId/summary", getCustomerServiceSummary);

// global reports
// GET /api/reports/services/global/summary
router.get("/services/global/summary", getGlobalServiceSummary);

export default router;
