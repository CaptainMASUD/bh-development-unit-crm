import express from "express";
import {
  createAndPostRevaluation,
  listRevaluations,
  getRevaluationById,
} from "../../controllers/inventory/inventoryRevaluation.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.get("/", requirePermission("inventory-adjustment:view"), listRevaluations);
router.post("/", requirePermission("inventory-adjustment:manage"), createAndPostRevaluation);
router.get("/:id", requirePermission("inventory-adjustment:view"), getRevaluationById);

export default router;
