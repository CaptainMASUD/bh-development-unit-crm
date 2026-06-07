// routes/lead.routes.js
import express from "express";
import {
  createLead,
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
} from "../controllers/lead.controller.js";

import {
  protect,
  isMarketingOrAdmin,
  isAdminOrSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Lead module access:
 * marketing_team + admin + superadmin
 */
router.use(protect, isMarketingOrAdmin);

/* =========================
   BASIC LEAD CRUD
========================= */
router.post("/", createLead);
router.get("/", listLeads);
router.get("/:id", getLeadById);
router.put("/:id", updateLead);

/* =========================
   CRM SALES FLOW
========================= */

// notes
router.post("/:id/notes", addLeadNote);

// stage movement
router.patch("/:id/stage", updateLeadStage);

// requirement / discovery
router.patch("/:id/requirement", updateLeadRequirement);

// contact / follow-up
router.patch("/:id/contacted", markContacted);
router.patch("/:id/followup", setFollowUp);

// won / lost
router.patch("/:id/won", markLeadWon);
router.patch("/:id/lost", markLeadLost);

// timeline
router.get("/:id/timeline", getLeadTimeline);

// convert lead to customer
router.post("/:id/convert", convertLead);

/* =========================
   ADMIN ACCESS CONTROL
========================= */
router.patch("/:id/access", isAdminOrSuperAdmin, updateLeadAccess);

/* =========================
   DELETE
========================= */
router.delete("/:id", isAdminOrSuperAdmin, deleteLead);

export default router;