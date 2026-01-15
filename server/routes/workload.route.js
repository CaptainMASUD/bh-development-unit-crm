// routes/workload.route.js
import express from "express";
import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";
import { getEmployeeWorkload } from "../controllers/workload.controller.js";

const router = express.Router();

router.use(protect);

// ✅ Admin-only dashboard endpoint
// GET /api/workload/employees?taskStatus=all&includeEmptyCustomers=true&windowDays=7
router.get("/employees", isAdminOrSuperAdmin, getEmployeeWorkload);

export default router;
