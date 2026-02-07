// routes/purchaseType.routes.js
import express from "express";
import { protect, isMarketingOrAdmin } from "../middleware/auth.middleware.js";
import {
  listPurchaseTypes,
  createPurchaseType,
  updatePurchaseType,
  deletePurchaseType,
} from "../controllers/purchaseType.controller.js";

const router = express.Router();

router.use(protect, isMarketingOrAdmin);

router.get("/", listPurchaseTypes);
router.post("/", createPurchaseType);
router.patch("/:id", updatePurchaseType);
router.delete("/:id", deletePurchaseType);

export default router;
