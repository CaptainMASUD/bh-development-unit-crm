// routes/purchaseType.routes.js
import express from "express";
import { protect, requireAnyPermission } from "../../middleware/auth.middleware.js";
import {
  listPurchaseTypes,
  createPurchaseType,
  updatePurchaseType,
  deletePurchaseType,
} from "../../controllers/purchaseType.controller.js";

const router = express.Router();

const viewPerm = requireAnyPermission(["purchase-type:view", "purchase-order:view"]);
const managePerm = requireAnyPermission(["purchase-type:manage", "purchase-order:manage"]);

router.use(protect, viewPerm);

router.get("/", listPurchaseTypes);
router.post("/", managePerm, createPurchaseType);
router.patch("/:id", managePerm, updatePurchaseType);
router.delete("/:id", managePerm, deletePurchaseType);

export default router;
