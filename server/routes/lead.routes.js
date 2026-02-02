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

router.use(protect, isMarketingOrAdmin);

router.post("/", createLead);
router.get("/", listLeads);
router.get("/:id", getLeadById);
router.put("/:id", updateLead);

router.post("/:id/notes", addLeadNote);
router.patch("/:id/contacted", markContacted);
router.patch("/:id/followup", setFollowUp);

router.post("/:id/convert", convertLeadToCustomer);

router.delete("/:id", isAdminOrSuperAdmin, deleteLead);

export default router;
