import express from "express";
import {
  calculateRosterAttendance,
  createHoliday,
  createRosterAssignment,
  createShift,
  createWeeklyOff,
  deleteHoliday,
  deleteRosterAssignment,
  deleteShift,
  deleteWeeklyOff,
  getMonthlyRosterReport,
  listHolidays,
  listRosterAssignments,
  listShifts,
  listWeeklyOffs,
  updateHoliday,
  updateRosterAssignment,
  updateShift,
  updateWeeklyOff,
  getMyRoster,
} from "../controllers/roster.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.get("/me", requirePermission("roster:view"), getMyRoster);

router.get("/shifts", requirePermission("roster:manage"), listShifts);
router.post("/shifts", requirePermission("roster:manage"), createShift);
router.patch("/shifts/:id", requirePermission("roster:manage"), updateShift);
router.delete("/shifts/:id", requirePermission("roster:manage"), deleteShift);

router.get("/assignments", requirePermission("roster:manage"), listRosterAssignments);
router.post("/assignments", requirePermission("roster:manage"), createRosterAssignment);
router.patch("/assignments/:id", requirePermission("roster:manage"), updateRosterAssignment);
router.delete("/assignments/:id", requirePermission("roster:manage"), deleteRosterAssignment);

router.get("/weekly-offs", requirePermission("leaves:manage"), listWeeklyOffs);
router.post("/weekly-offs", requirePermission("leaves:manage"), createWeeklyOff);
router.patch("/weekly-offs/:id", requirePermission("leaves:manage"), updateWeeklyOff);
router.delete("/weekly-offs/:id", requirePermission("leaves:manage"), deleteWeeklyOff);

router.get("/holidays", requirePermission("leaves:manage"), listHolidays);
router.post("/holidays", requirePermission("leaves:manage"), createHoliday);
router.patch("/holidays/:id", requirePermission("leaves:manage"), updateHoliday);
router.delete("/holidays/:id", requirePermission("leaves:manage"), deleteHoliday);

router.post("/attendance/calculate", requirePermission("roster:manage"), calculateRosterAttendance);
router.get("/reports/monthly", requirePermission("roster:manage"), getMonthlyRosterReport);

export default router;
