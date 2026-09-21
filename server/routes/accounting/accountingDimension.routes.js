import express from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";
import {
  listDimensions,
  getDimension,
  createDimension,
  updateDimension,
  deleteDimension,
  listDimensionValues,
  createDimensionValue,
  updateDimensionValue,
  deleteDimensionValue,
} from "../../controllers/accounting/accountingDimension.controller.js";

const router = express.Router();

router.use(protect);

router.get("/", requirePermission("finance:dimension:view"), listDimensions);
router.get("/:id", requirePermission("finance:dimension:view"), getDimension);
router.post("/", requirePermission("finance:dimension:manage"), createDimension);
router.patch("/:id", requirePermission("finance:dimension:manage"), updateDimension);
router.delete("/:id", requirePermission("finance:dimension:manage"), deleteDimension);

// Dimension Values
router.get("/:dimensionId/values", requirePermission("finance:dimension:view"), listDimensionValues);
router.post("/:dimensionId/values", requirePermission("finance:dimension:manage"), createDimensionValue);
router.patch("/:dimensionId/values/:valueId", requirePermission("finance:dimension:manage"), updateDimensionValue);
router.delete("/:dimensionId/values/:valueId", requirePermission("finance:dimension:manage"), deleteDimensionValue);

export default router;
