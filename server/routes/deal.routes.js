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
  isMarketingOrAdmin,
  isAdminOrSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Deal access:
 * marketing_team + admin + superadmin
 */
router.use(protect, isMarketingOrAdmin);

/* =========================
   DEAL
========================= */
router.post("/", createDeal);
router.post("/from-proposal/:proposalId", createDealFromProposal);
router.get("/", listDeals);
router.get("/:id", getDealById);

router.put("/:id", updateDeal);

router.patch("/:id/won", markDealWon);
router.patch("/:id/lost", markDealLost);

/* =========================
   DELETE
========================= */
router.delete("/:id", isAdminOrSuperAdmin, deleteDeal);

export default router;
