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
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("leads:view"));

/* =========================
   PROPOSAL / QUOTATION
========================= */
router.post("/", requirePermission("leads:manage"), createProposal);
router.get("/", listProposals);
router.get("/:id", getProposalById);

router.put("/:id", requirePermission("leads:manage"), updateProposal);

router.patch("/:id/send", requirePermission("leads:manage"), sendProposal);
router.patch("/:id/accept", requirePermission("leads:manage"), acceptProposal);
router.patch("/:id/reject", requirePermission("leads:manage"), rejectProposal);

/* =========================
   DELETE
========================= */
router.delete("/:id", requirePermission("leads:manage"), deleteProposal);

export default router;
