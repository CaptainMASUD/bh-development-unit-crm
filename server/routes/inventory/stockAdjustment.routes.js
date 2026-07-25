import express from "express";
import {
  approveStockAdjustment,
  cancelStockAdjustment,
  createStockAdjustment,
  deleteStockAdjustment,
  getStockAdjustment,
  getStockAdjustmentSummary,
  listStockAdjustments,
  postStockAdjustment,
  refreshStockAdjustment,
  rejectStockAdjustment,
  reverseStockAdjustment,
  submitStockAdjustment,
  updateStockAdjustment,
} from "../../controllers/inventory/stockAdjustment.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/summary", requirePermission("inventory-adjustment:view"), getStockAdjustmentSummary);
router.get("/", requirePermission("inventory-adjustment:view"), listStockAdjustments);
router.post("/", requirePermission("inventory-adjustment:manage"), createStockAdjustment);
router.get("/:id", requirePermission("inventory-adjustment:view"), getStockAdjustment);
router.patch("/:id", requirePermission("inventory-adjustment:manage"), updateStockAdjustment);
router.post("/:id/refresh", requirePermission("inventory-adjustment:manage"), refreshStockAdjustment);
router.post("/:id/submit", requirePermission("inventory-adjustment:manage"), submitStockAdjustment);
router.post("/:id/approve", requirePermission("inventory-adjustment:approve"), approveStockAdjustment);
router.post("/:id/reject", requirePermission("inventory-adjustment:approve"), rejectStockAdjustment);
router.post("/:id/post", requirePermission("inventory-adjustment:post"), postStockAdjustment);
router.post("/:id/reverse", requirePermission("inventory-adjustment:reverse"), reverseStockAdjustment);
router.post("/:id/cancel", requirePermission("inventory-adjustment:manage"), cancelStockAdjustment);
router.delete("/:id", requirePermission("inventory-adjustment:delete"), deleteStockAdjustment);

export default router;
