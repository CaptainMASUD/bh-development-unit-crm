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
} from "../../controllers/salaryProfile.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

/**
 * Admin/Superadmin can manage salary profiles.
 * Later you can replace isAdminOrSuperAdmin with permission middleware:
 * authorize("payroll:manage")
 */
router.get("/", requirePermission("salary:view"), listSalaryProfiles);
router.post("/", requirePermission("salary:manage"), createSalaryProfile);

router.get("/employee/:employeeId/active", requirePermission("salary:view"), getActiveSalaryProfileByEmployee);

router.get("/:id", requirePermission("salary:view"), getSalaryProfileById);
router.get("/:id/preview", requirePermission("salary:view"), previewSalaryProfile);

router.patch("/:id", requirePermission("salary:manage"), updateSalaryProfile);
router.patch("/:id/deactivate", requirePermission("salary:manage"), deactivateSalaryProfile);

router.delete("/:id", requirePermission("salary:manage"), deleteSalaryProfile);

export default router;
