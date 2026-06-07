// routes/assignment.routes.js
import express from "express";
import {
  createAssignmentRule,
  listAssignmentRules,
  getAssignmentRuleById,
  updateAssignmentRule,
  deleteAssignmentRule,
  autoAssignLead,
  manualAssignLead,
  autoAssignBulkLeads,
  listAvailableAssignees,
} from "../controllers/assignment.controller.js";

import {
  protect,
  isAdminOrSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Assignment access:
 * admin + superadmin only
 */
router.use(protect, isAdminOrSuperAdmin);

/* =========================
   AVAILABLE USERS
========================= */
router.get("/available-users", listAvailableAssignees);

/* =========================
   LEAD ASSIGN ACTIONS
========================= */
router.post("/lead/auto", autoAssignLead);
router.post("/lead/manual", manualAssignLead);
router.post("/lead/bulk-auto", autoAssignBulkLeads);

/* =========================
   ASSIGNMENT RULE CRUD
========================= */
router.post("/rules", createAssignmentRule);
router.get("/rules", listAssignmentRules);
router.get("/rules/:id", getAssignmentRuleById);
router.put("/rules/:id", updateAssignmentRule);
router.delete("/rules/:id", deleteAssignmentRule);

export default router;