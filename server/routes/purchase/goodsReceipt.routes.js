import express from "express";
import {
  approveGoodsReceipt,
  cancelGoodsReceipt,
  createGoodsReceipt,
  deleteGoodsReceipt,
  getGoodsReceipt,
  getGoodsReceiptMeta,
  getGoodsReceiptSummary,
  listGoodsReceiptOptions,
  listGoodsReceipts,
  postGoodsReceipt,
  reverseGoodsReceipt,
  submitGoodsReceipt,
  updateGoodsReceipt,
} from "../../controllers/goodsReceipt.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/meta", requirePermission("goods-receipt:view"), getGoodsReceiptMeta);
router.get("/summary", requirePermission("goods-receipt:view"), getGoodsReceiptSummary);
router.get("/options", requirePermission("goods-receipt:view"), listGoodsReceiptOptions);
router.get("/", requirePermission("goods-receipt:view"), listGoodsReceipts);
router.post("/", requirePermission("goods-receipt:manage"), createGoodsReceipt);
router.get("/:id", requirePermission("goods-receipt:view"), getGoodsReceipt);
router.patch("/:id", requirePermission("goods-receipt:manage"), updateGoodsReceipt);
router.post("/:id/submit", requirePermission("goods-receipt:manage"), submitGoodsReceipt);
router.post("/:id/approve", requirePermission("goods-receipt:approve"), approveGoodsReceipt);
router.post("/:id/post", requirePermission("goods-receipt:post"), postGoodsReceipt);
router.post("/:id/reverse", requirePermission("goods-receipt:reverse"), reverseGoodsReceipt);
router.post("/:id/cancel", requirePermission("goods-receipt:manage"), cancelGoodsReceipt);
router.delete("/:id", requirePermission("goods-receipt:delete"), deleteGoodsReceipt);

export default router;
