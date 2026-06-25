import express from "express";
import {
  createSalaryProfile,
  deactivateSalaryProfile,
  deleteSalaryProfile,
  getActiveSalaryProfileByEmployee,
  getSalaryProfileById,
  listSalaryProfiles,
  previewSalaryProfile,
  updateSalaryProfile,
} from "../controllers/salaryProfile.controller.js";
import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/**
 * Admin/Superadmin can manage salary profiles.
 * Later you can replace isAdminOrSuperAdmin with permission middleware:
 * authorize("payroll:manage")
 */
router.get("/", isAdminOrSuperAdmin, listSalaryProfiles);
router.post("/", isAdminOrSuperAdmin, createSalaryProfile);

router.get("/employee/:employeeId/active", isAdminOrSuperAdmin, getActiveSalaryProfileByEmployee);

router.get("/:id", isAdminOrSuperAdmin, getSalaryProfileById);
router.get("/:id/preview", isAdminOrSuperAdmin, previewSalaryProfile);

router.patch("/:id", isAdminOrSuperAdmin, updateSalaryProfile);
router.patch("/:id/deactivate", isAdminOrSuperAdmin, deactivateSalaryProfile);

router.delete("/:id", isAdminOrSuperAdmin, deleteSalaryProfile);

export default router;