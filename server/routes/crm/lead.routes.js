// routes/lead.routes.js
import express from "express";
import {
  createLead,
  getLeadConversionOptions,
  listLeads,
  getLeadById,
  updateLead,
  addLeadNote,
  updateLeadStage,
  updateLeadRequirement,
  markContacted,
  setFollowUp,
  markLeadWon,
  markLeadLost,
  convertLead,
  getLeadTimeline,
  updateLeadAccess,
  deleteLead,
} from "../../controllers/lead.controller.js";

import {
  protect,
  requirePermission,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("leads:view"));

/* =========================
   BASIC LEAD CRUD
========================= */
router.post("/", requirePermission("leads:manage"), createLead);
router.get("/", listLeads);
router.get("/conversion-options", requirePermission("leads:manage"), getLeadConversionOptions);
router.get("/:id", getLeadById);
router.put("/:id", requirePermission("leads:manage"), updateLead);

/* =========================
   CRM SALES FLOW
========================= */

// notes
router.post("/:id/notes", requirePermission("leads:manage"), addLeadNote);

// stage movement
router.patch("/:id/stage", requirePermission("leads:manage"), updateLeadStage);

// requirement / discovery
router.patch("/:id/requirement", requirePermission("leads:manage"), updateLeadRequirement);

// contact / follow-up
router.patch("/:id/contacted", requirePermission("leads:manage"), markContacted);
router.patch("/:id/followup", requirePermission("leads:manage"), setFollowUp);

// won / lost
router.patch("/:id/won", requirePermission("leads:manage"), markLeadWon);
router.patch("/:id/lost", requirePermission("leads:manage"), markLeadLost);

// timeline
router.get("/:id/timeline", getLeadTimeline);

// convert lead to customer
router.post("/:id/convert", requirePermission("leads:manage"), convertLead);

/* =========================
   ADMIN ACCESS CONTROL
========================= */
router.patch("/:id/access", requirePermission("leads:manage"), updateLeadAccess);

/* =========================
   DELETE
========================= */
router.delete("/:id", requirePermission("leads:manage"), deleteLead);

export default router;
