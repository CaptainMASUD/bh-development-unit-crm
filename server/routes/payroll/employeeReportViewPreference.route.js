import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  getEmployeeReportViewPreference,
  upsertEmployeeReportViewPreference,
} from "../../controllers/employeeReportViewPreference.controller.js";

const router = express.Router();
router.use(protect);

// GET /api/view-preferences/employee-report/:key
router.get("/:key", getEmployeeReportViewPreference);

// PUT /api/view-preferences/employee-report/:key
router.put("/:key", upsertEmployeeReportViewPreference);

export default router;
