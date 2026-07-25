import express from "express";
import {
  createWarehouse,
  deleteWarehouse,
  getWarehouse,
  listWarehouseOptions,
  listWarehouses,
  restoreWarehouse,
  updateWarehouse,
  updateWarehouseStatus,
} from "../../controllers/inventory/warehouse.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/options", requirePermission("inventory-warehouse:view"), listWarehouseOptions);
router.get("/", requirePermission("inventory-warehouse:view"), listWarehouses);
router.post("/", requirePermission("inventory-warehouse:manage"), createWarehouse);
router.get("/:id", requirePermission("inventory-warehouse:view"), getWarehouse);
router.patch("/:id", requirePermission("inventory-warehouse:manage"), updateWarehouse);
router.patch("/:id/status", requirePermission("inventory-warehouse:manage"), updateWarehouseStatus);
router.patch("/:id/restore", requirePermission("inventory-warehouse:delete"), restoreWarehouse);
router.delete("/:id", requirePermission("inventory-warehouse:delete"), deleteWarehouse);

export default router;
