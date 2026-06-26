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
} from "../controllers/roster.controller.js";
import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(isAdminOrSuperAdmin);

router.get("/shifts", listShifts);
router.post("/shifts", createShift);
router.patch("/shifts/:id", updateShift);
router.delete("/shifts/:id", deleteShift);

router.get("/assignments", listRosterAssignments);
router.post("/assignments", createRosterAssignment);
router.patch("/assignments/:id", updateRosterAssignment);
router.delete("/assignments/:id", deleteRosterAssignment);

router.get("/weekly-offs", listWeeklyOffs);
router.post("/weekly-offs", createWeeklyOff);
router.patch("/weekly-offs/:id", updateWeeklyOff);
router.delete("/weekly-offs/:id", deleteWeeklyOff);

router.get("/holidays", listHolidays);
router.post("/holidays", createHoliday);
router.patch("/holidays/:id", updateHoliday);
router.delete("/holidays/:id", deleteHoliday);

router.post("/attendance/calculate", calculateRosterAttendance);
router.get("/reports/monthly", getMonthlyRosterReport);

export default router;
