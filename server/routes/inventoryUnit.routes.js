import express from "express";
import {
  createInventoryUnit,
  deleteInventoryUnit,
  getInventoryUnit,
  listInventoryUnitOptions,
  listInventoryUnits,
  lookupInventoryUnit,
  restoreInventoryUnit,
  updateInventoryUnit,
  updateInventoryUnitStatus,
} from "../controllers/inventoryUnit.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/options", requirePermission("inventory-unit:view"), listInventoryUnitOptions);
router.get("/lookup/:value", requirePermission("inventory-unit:view"), lookupInventoryUnit);
router.get("/", requirePermission("inventory-unit:view"), listInventoryUnits);
router.post("/", requirePermission("inventory-unit:manage"), createInventoryUnit);
router.get("/:id", requirePermission("inventory-unit:view"), getInventoryUnit);
router.patch("/:id", requirePermission("inventory-unit:manage"), updateInventoryUnit);
router.patch("/:id/status", requirePermission("inventory-unit:manage"), updateInventoryUnitStatus);
router.patch("/:id/restore", requirePermission("inventory-unit:delete"), restoreInventoryUnit);
router.delete("/:id", requirePermission("inventory-unit:delete"), deleteInventoryUnit);

export default router;
