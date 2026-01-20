import express from "express";
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  addLeadNote,
  deleteLead,
  convertLeadToCustomer,
  updateLeadFollowup,
  getLeadTimeline,
  createDealFromLead,
} from "../controllers/lead.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

router.post("/", createLead);
router.get("/", getLeads);
router.get("/:id", getLeadById);
router.patch("/:id", updateLead);

router.post("/:id/notes", addLeadNote);
router.patch("/:id/followup", updateLeadFollowup);

router.get("/:id/timeline", getLeadTimeline);

router.post("/:id/deals", createDealFromLead);

router.post("/:id/convert", isAdminOrSuperAdmin, convertLeadToCustomer);
router.delete("/:id", isAdminOrSuperAdmin, deleteLead);

export default router;
