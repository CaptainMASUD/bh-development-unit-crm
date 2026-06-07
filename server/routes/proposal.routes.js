// routes/proposal.routes.js
import express from "express";
import {
  createProposal,
  listProposals,
  getProposalById,
  updateProposal,
  sendProposal,
  acceptProposal,
  rejectProposal,
  deleteProposal,
} from "../controllers/proposal.controller.js";

import {
  protect,
  isMarketingOrAdmin,
  isAdminOrSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Proposal access:
 * marketing_team + admin + superadmin
 */
router.use(protect, isMarketingOrAdmin);

/* =========================
   PROPOSAL / QUOTATION
========================= */
router.post("/", createProposal);
router.get("/", listProposals);
router.get("/:id", getProposalById);

router.put("/:id", updateProposal);

router.patch("/:id/send", sendProposal);
router.patch("/:id/accept", acceptProposal);
router.patch("/:id/reject", rejectProposal);

/* =========================
   DELETE
========================= */
router.delete("/:id", isAdminOrSuperAdmin, deleteProposal);

export default router;