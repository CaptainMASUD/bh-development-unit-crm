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
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/**
 * Manual attendance management
 * Admin/Superadmin only inside controller.
 */
router.get("/", listAttendance);
router.post("/mark", markAttendance);
router.post("/bulk", bulkMarkAttendance);

/**
 * Employee/admin monthly attendance + salary impact summary.
 */
router.get("/me/monthly-summary", requirePermission("attendance:view"), getEmployeeMonthlyAttendanceSummary);
router.get("/employee/:employeeId/monthly-summary", getEmployeeMonthlyAttendanceSummary);

router.get("/:id", getAttendanceById);
router.patch("/:id", updateAttendance);
router.delete("/:id", deleteAttendance);

export default router;
