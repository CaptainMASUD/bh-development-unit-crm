// src/routes/dashboard.routes.js
import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getDashboard,
  getDashboardCustomersReport,
  getDashboardTasksReport,
  getDashboardNewCustomersReport,
} from "../controllers/dashboard.controller.js";

const router = express.Router();

// Overview
router.get("/", protect, getDashboard);

// Reports (drill-down)
router.get("/reports/customers", protect, getDashboardCustomersReport);
router.get("/reports/tasks", protect, getDashboardTasksReport);
router.get("/reports/new-customers", protect, getDashboardNewCustomersReport);

export default router;
