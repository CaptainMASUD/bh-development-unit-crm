// routes/purchaseType.routes.js
import express from "express";
import { protect, requirePermission } from "../middleware/auth.middleware.js";
import {
  listPurchaseTypes,
  createPurchaseType,
  updatePurchaseType,
  deletePurchaseType,
} from "../controllers/purchaseType.controller.js";

const router = express.Router();

router.use(protect, requirePermission("leads:view"));

router.get("/", listPurchaseTypes);
router.post("/", requirePermission("leads:manage"), createPurchaseType);
router.patch("/:id", requirePermission("leads:manage"), updatePurchaseType);
router.delete("/:id", requirePermission("leads:manage"), deletePurchaseType);

export default router;
