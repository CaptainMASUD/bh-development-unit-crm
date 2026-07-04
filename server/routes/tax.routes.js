import express from "express";
import {
  createTaxSlab,
  deleteTaxSlab,
  getTaxReport,
  listEmployeeTaxProfiles,
  listTaxSlabs,
  markTaxRemittance,
  updateEmployeeTaxProfile,
  updateTaxSlab,
} from "../controllers/tax.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/slabs", requirePermission("tax.view"), listTaxSlabs);
router.post("/slabs", requirePermission("tax.create"), createTaxSlab);
router.patch("/slabs/:id", requirePermission("tax.update"), updateTaxSlab);
router.delete("/slabs/:id", requirePermission("tax.delete"), deleteTaxSlab);

router.get("/employee-profiles", requirePermission("tax.view"), listEmployeeTaxProfiles);
router.patch("/employee-profiles/:employeeId", requirePermission("tax.assign_employee"), updateEmployeeTaxProfile);

router.get("/reports", requirePermission("tax.report"), getTaxReport);
router.patch("/reports/remittance", requirePermission("tax.report"), markTaxRemittance);

export default router;
