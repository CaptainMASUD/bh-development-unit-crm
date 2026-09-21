import express from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";
import {
  listCostCenters,
  getCostCenter,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
} from "../../controllers/accounting/costCenter.controller.js";

const router = express.Router();

router.use(protect);

router.get("/", requirePermission("finance:cost-center:view"), listCostCenters);
router.get("/:id", requirePermission("finance:cost-center:view"), getCostCenter);
router.post("/", requirePermission("finance:cost-center:manage"), createCostCenter);
router.patch("/:id", requirePermission("finance:cost-center:manage"), updateCostCenter);
router.delete("/:id", requirePermission("finance:cost-center:manage"), deleteCostCenter);

export default router;
