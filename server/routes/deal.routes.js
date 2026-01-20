// routes/deal.routes.js
import express from "express";
import {
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  updateDealStage,
  upsertDealItems,
  closeDeal,
  deleteDeal,
} from "../controllers/deal.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// create + list
router.post("/", createDeal);
router.get("/", getDeals);

// read + update
router.get("/:id", getDealById);
router.patch("/:id", updateDeal);

// stage + items + close
router.patch("/:id/stage", updateDealStage);
router.patch("/:id/items", upsertDealItems);
router.post("/:id/close", closeDeal); // (you can change to PATCH if you want)

// admin only delete
router.delete("/:id", isAdminOrSuperAdmin, deleteDeal);

export default router;
