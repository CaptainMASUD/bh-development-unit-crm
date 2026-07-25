import express from "express";
import {
  cancelStockMovement,
  createAndPostStockMovement,
  createStockMovement,
  deleteStockMovement,
  getStockMovement,
  getStockMovementSummary,
  listStockMovements,
  postStockMovement,
  reverseStockMovement,
  updateStockMovement,
} from "../../controllers/inventory/stockMovement.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/summary", requirePermission("inventory-movement:view"), getStockMovementSummary);
router.get("/", requirePermission("inventory-movement:view"), listStockMovements);
router.post("/post", requirePermission("inventory-movement:post"), createAndPostStockMovement);
router.post("/", requirePermission("inventory-movement:manage"), createStockMovement);
router.get("/:id", requirePermission("inventory-movement:view"), getStockMovement);
router.patch("/:id", requirePermission("inventory-movement:manage"), updateStockMovement);
router.post("/:id/post", requirePermission("inventory-movement:post"), postStockMovement);
router.post("/:id/reverse", requirePermission("inventory-movement:reverse"), reverseStockMovement);
router.post("/:id/cancel", requirePermission("inventory-movement:manage"), cancelStockMovement);
router.delete("/:id", requirePermission("inventory-movement:delete"), deleteStockMovement);

export default router;
