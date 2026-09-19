import express from "express";
import {
  createSalaryProfile,
  deactivateSalaryProfile,
  deleteSalaryProfile,
  getActiveSalaryProfileByEmployee,
  getSalaryProfileById,
  getSalaryProfileHistory,
  listSalaryProfiles,
  previewSalaryProfile,
  reviseSalaryProfile,
  updateSalaryProfile,
} from "../../controllers/salaryProfile.controller.js";
import { protect, requirePermission, requireAnyPermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", requirePermission("salary:view"), listSalaryProfiles);
router.post("/", requirePermission("salary:manage"), createSalaryProfile);

router.get("/employee/:employeeId/active", requirePermission("salary:view"), getActiveSalaryProfileByEmployee);
router.get("/employee/:employeeId/history", requirePermission("salary:view"), getSalaryProfileHistory);

router.get("/:id", requirePermission("salary:view"), getSalaryProfileById);
router.get("/:id/preview", requirePermission("salary:view"), previewSalaryProfile);

router.post("/:id/revise", requirePermission("salary:manage"), reviseSalaryProfile);
router.patch("/:id", requirePermission("salary:manage"), updateSalaryProfile);
router.patch("/:id/deactivate", requirePermission("salary:manage"), deactivateSalaryProfile);

router.delete("/:id", requirePermission("salary:manage"), deleteSalaryProfile);

export default router;
