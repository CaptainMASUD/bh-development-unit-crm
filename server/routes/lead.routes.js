// routes/lead.route.js
import express from "express";
import {
  createLead,
  listLeads,
  getLeadById,
  updateLead,
  addLeadNote,
  markContacted,
  setFollowUp,
  convertLeadToCustomer,
  deleteLead,
} from "../controllers/lead.controller.js";

import { protect, isMarketingOrAdmin, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * ✅ Lead module access:
 * marketing + admin + superadmin
 */
router.use(protect, isMarketingOrAdmin);

router.post("/", createLead);
router.get("/", listLeads);
router.get("/:id", getLeadById);

// keep PUT or change to PATCH based on your API style.
// (You used PUT before, so keeping it.)
router.put("/:id", updateLead);

router.post("/:id/notes", addLeadNote);
router.patch("/:id/contacted", markContacted);
router.patch("/:id/followup", setFollowUp);

// ✅ conversion allowed for marketing/admin
router.post("/:id/convert", convertLeadToCustomer);

// ✅ delete: admin/superadmin only
router.delete("/:id", isAdminOrSuperAdmin, deleteLead);

export default router;
