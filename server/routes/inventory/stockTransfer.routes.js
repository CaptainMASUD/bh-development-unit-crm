import express from "express";
import {
  approveStockTransfer,
  cancelStockTransfer,
  closeShortStockTransfer,
  createStockTransfer,
  deleteStockTransfer,
  dispatchStockTransfer,
  getStockTransfer,
  getStockTransferSummary,
  listStockTransfers,
  postDirectStockTransfer,
  receiveStockTransfer,
  rejectStockTransfer,
  reverseStockTransfer,
  submitStockTransfer,
  updateStockTransfer,
} from "../../controllers/inventory/stockTransfer.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/summary", requirePermission("inventory-transfer:view"), getStockTransferSummary);
router.get("/", requirePermission("inventory-transfer:view"), listStockTransfers);
router.post("/", requirePermission("inventory-transfer:manage"), createStockTransfer);
router.get("/:id", requirePermission("inventory-transfer:view"), getStockTransfer);
router.patch("/:id", requirePermission("inventory-transfer:manage"), updateStockTransfer);
router.post("/:id/submit", requirePermission("inventory-transfer:manage"), submitStockTransfer);
router.post("/:id/approve", requirePermission("inventory-transfer:approve"), approveStockTransfer);
router.post("/:id/reject", requirePermission("inventory-transfer:approve"), rejectStockTransfer);
router.post("/:id/post-direct", requirePermission("inventory-transfer:dispatch"), postDirectStockTransfer);
router.post("/:id/dispatch", requirePermission("inventory-transfer:dispatch"), dispatchStockTransfer);
router.post("/:id/receive", requirePermission("inventory-transfer:receive"), receiveStockTransfer);
router.post("/:id/close-short", requirePermission("inventory-transfer:receive"), closeShortStockTransfer);
router.post("/:id/reverse", requirePermission("inventory-transfer:reverse"), reverseStockTransfer);
router.post("/:id/cancel", requirePermission("inventory-transfer:manage"), cancelStockTransfer);
router.delete("/:id", requirePermission("inventory-transfer:delete"), deleteStockTransfer);

export default router;
