// src/routes/dashboard.routes.js
import express from "express";
import { protect, requirePermission } from "../middleware/auth.middleware.js";
import {
  getDashboard,
  getAdministrationDashboard,
  getDashboardCustomersReport,
  getDashboardTasksReport,
  getDashboardNewCustomersReport,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/administration", protect, requirePermission("company:view"), getAdministrationDashboard);

// Overview
router.get("/", protect, requirePermission("dashboard:view"), getDashboard);

// Reports (drill-down)
router.get("/reports/customers", protect, requirePermission("reports:view"), getDashboardCustomersReport);
router.get("/reports/tasks", protect, requirePermission("reports:view"), getDashboardTasksReport);
router.get("/reports/new-customers", protect, requirePermission("reports:view"), getDashboardNewCustomersReport);

export default router;
