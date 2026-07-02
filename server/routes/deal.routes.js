// routes/deal.routes.js
import express from "express";
import {
  createDeal,
  createDealFromProposal,
  listDeals,
  getDealById,
  updateDeal,
  markDealWon,
  markDealLost,
  deleteDeal,
} from "../controllers/deal.controller.js";

import {
  protect,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("deals:view"));

/* =========================
   DEAL
========================= */
router.post("/", requirePermission("deals:manage"), createDeal);
router.post("/from-proposal/:proposalId", requirePermission("deals:manage"), createDealFromProposal);
router.get("/", listDeals);
router.get("/:id", getDealById);

router.put("/:id", requirePermission("deals:manage"), updateDeal);

router.patch("/:id/won", requirePermission("deals:manage"), markDealWon);
router.patch("/:id/lost", requirePermission("deals:manage"), markDealLost);

/* =========================
   DELETE
========================= */
router.delete("/:id", requirePermission("deals:manage"), deleteDeal);

export default router;
