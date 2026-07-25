import express from "express";
import {
  deleteProductStock,
  getProductAvailability,
  getProductStock,
  getProductStockSummary,
  getStockPosition,
  initializeProductStock,
  listProductStocks,
  restoreProductStock,
  updateProductStockSettings,
} from "../../controllers/inventory/productStock.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/summary", requirePermission("inventory-stock:view"), getProductStockSummary);
router.get("/position", requirePermission("inventory-stock:view"), getStockPosition);
router.get("/availability/:productId", requirePermission("inventory-stock:view"), getProductAvailability);
router.get("/", requirePermission("inventory-stock:view"), listProductStocks);
router.post("/initialize", requirePermission("inventory-stock:manage"), initializeProductStock);
router.get("/:id", requirePermission("inventory-stock:view"), getProductStock);
router.patch("/:id/settings", requirePermission("inventory-stock:manage"), updateProductStockSettings);
router.patch("/:id/restore", requirePermission("inventory-stock:delete"), restoreProductStock);
router.delete("/:id", requirePermission("inventory-stock:delete"), deleteProductStock);

export default router;
