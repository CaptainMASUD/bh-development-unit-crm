import express from "express";
import {
  approvePurchaseReturn,
  cancelPurchaseReturn,
  createPurchaseReturn,
  deletePurchaseReturn,
  getPurchaseReturn,
  getPurchaseReturnMeta,
  getPurchaseReturnSummary,
  listPurchaseReturns,
  postPurchaseReturn,
  reversePurchaseReturn,
  submitPurchaseReturn,
  updatePurchaseReturn,
} from "../../controllers/purchaseReturn.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/meta", requirePermission("purchase-return:view"), getPurchaseReturnMeta);
router.get("/summary", requirePermission("purchase-return:view"), getPurchaseReturnSummary);
router.get("/", requirePermission("purchase-return:view"), listPurchaseReturns);
router.post("/", requirePermission("purchase-return:manage"), createPurchaseReturn);
router.get("/:id", requirePermission("purchase-return:view"), getPurchaseReturn);
router.patch("/:id", requirePermission("purchase-return:manage"), updatePurchaseReturn);
router.post("/:id/submit", requirePermission("purchase-return:manage"), submitPurchaseReturn);
router.post("/:id/approve", requirePermission("purchase-return:approve"), approvePurchaseReturn);
router.post("/:id/post", requirePermission("purchase-return:post"), postPurchaseReturn);
router.post("/:id/reverse", requirePermission("purchase-return:reverse"), reversePurchaseReturn);
router.post("/:id/cancel", requirePermission("purchase-return:manage"), cancelPurchaseReturn);
router.delete("/:id", requirePermission("purchase-return:delete"), deletePurchaseReturn);

export default router;
