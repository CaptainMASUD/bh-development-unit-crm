import express from "express";
import {
  bulkMarkAttendance,
  deleteAttendance,
  getAttendanceById,
  getEmployeeMonthlyAttendanceSummary,
  listAttendance,
  markAttendance,
  updateAttendance,
} from "../controllers/attendance.controller.js";
import { protect, requireAnyPermission, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/**
 * Manual attendance management
 * Admin/Superadmin only inside controller.
 */
router.get("/", requirePermission("attendance:manage"), listAttendance);
router.post("/mark", requirePermission("attendance:manage"), markAttendance);
router.post("/bulk", requirePermission("attendance:manage"), bulkMarkAttendance);

/**
 * Employee/admin monthly attendance + salary impact summary.
 */
router.get("/me/monthly-summary", requirePermission("attendance:view"), getEmployeeMonthlyAttendanceSummary);
router.get("/employee/:employeeId/monthly-summary", requireAnyPermission(["attendance:view", "attendance:manage"]), getEmployeeMonthlyAttendanceSummary);

router.get("/:id", requireAnyPermission(["attendance:view", "attendance:manage"]), getAttendanceById);
router.patch("/:id", requirePermission("attendance:manage"), updateAttendance);
router.delete("/:id", requirePermission("attendance:manage"), deleteAttendance);

export default router;
