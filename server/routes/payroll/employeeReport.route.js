// routes/employeeReport.route.js
import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { getEmployeePerformance, getMyPerformance } from "../../controllers/employeeReport.controller.js";

const router = express.Router();
router.use(protect);

/**
 * Mount at:
 *   app.use("/api/employeeReport", employeeReportRoutes)
 */

// Employee self
// GET /api/employeeReport/me/performance?range=this_month&includeTasks=true
router.get("/me/performance", getMyPerformance);

// Admin/Employee
// GET /api/employeeReport/:employeeId/performance?range=last_6_months&includeTasks=true&tasksLimit=80
router.get("/:employeeId/performance", getEmployeePerformance);

export default router;
