import express from "express";
import {
  createWarehouseLocation,
  deleteWarehouseLocation,
  getWarehouseLocation,
  listWarehouseLocationOptions,
  listWarehouseLocations,
  listWarehouseLocationTree,
  restoreWarehouseLocation,
  updateWarehouseLocation,
  updateWarehouseLocationStatus,
} from "../../controllers/inventory/warehouseLocation.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/options", requirePermission("inventory-location:view"), listWarehouseLocationOptions);
router.get("/tree", requirePermission("inventory-location:view"), listWarehouseLocationTree);
router.get("/", requirePermission("inventory-location:view"), listWarehouseLocations);
router.post("/", requirePermission("inventory-location:manage"), createWarehouseLocation);
router.get("/:id", requirePermission("inventory-location:view"), getWarehouseLocation);
router.patch("/:id", requirePermission("inventory-location:manage"), updateWarehouseLocation);
router.patch("/:id/status", requirePermission("inventory-location:manage"), updateWarehouseLocationStatus);
router.patch("/:id/restore", requirePermission("inventory-location:delete"), restoreWarehouseLocation);
router.delete("/:id", requirePermission("inventory-location:delete"), deleteWarehouseLocation);

export default router;
