import express from "express";
import {
  createBranch, createCompany, getCompany, listBranches, listCompanies, listModules,
  setDefaultBranch, updateBranch, updateCompany, updateCompanyStatus,
} from "../controllers/company.controller.js";
import { isAdmin, isSuperAdmin, protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/modules", listModules);
router.get("/", requirePermission("company:view"), listCompanies);
router.post("/", isSuperAdmin, createCompany);
router.get("/:id", requirePermission("company:view"), getCompany);
router.patch("/:id", requirePermission("company:manage"), updateCompany);
router.patch("/:id/status", isSuperAdmin, updateCompanyStatus);
router.get("/:companyId/branches", requirePermission("branch:view"), listBranches);
router.post("/:companyId/branches", requirePermission("branch:manage"), createBranch);
router.patch("/:companyId/branches/:branchId", requirePermission("branch:manage"), updateBranch);
router.patch("/:companyId/branches/:branchId/default", isAdmin, setDefaultBranch);

export default router;
