import express from "express";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrderMeta,
  getPurchaseOrderSummary,
  listPurchaseOrderOptions,
  listPurchaseOrders,
  rejectPurchaseOrder,
  submitPurchaseOrder,
  updatePurchaseOrder,
} from "../../controllers/purchaseOrder.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/meta", requirePermission("purchase-order:view"), getPurchaseOrderMeta);
router.get("/summary", requirePermission("purchase-order:view"), getPurchaseOrderSummary);
router.get("/options", requirePermission("purchase-order:view"), listPurchaseOrderOptions);
router.get("/", requirePermission("purchase-order:view"), listPurchaseOrders);
router.post("/", requirePermission("purchase-order:manage"), createPurchaseOrder);
router.get("/:id", requirePermission("purchase-order:view"), getPurchaseOrder);
router.patch("/:id", requirePermission("purchase-order:manage"), updatePurchaseOrder);
router.post("/:id/submit", requirePermission("purchase-order:manage"), submitPurchaseOrder);
router.post("/:id/approve", requirePermission("purchase-order:approve"), approvePurchaseOrder);
router.post("/:id/reject", requirePermission("purchase-order:approve"), rejectPurchaseOrder);
router.post("/:id/cancel", requirePermission("purchase-order:manage"), cancelPurchaseOrder);
router.post("/:id/close", requirePermission("purchase-order:approve"), closePurchaseOrder);
router.delete("/:id", requirePermission("purchase-order:delete"), deletePurchaseOrder);

export default router;
