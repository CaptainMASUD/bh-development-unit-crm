// routes/activity.routes.js
import express from "express";
import {
  createActivity,
  quickAction,
  listActivities,
  completeActivity,
  cancelActivity,
  deleteActivity,
} from "../controllers/activity.controller.js";

import {
  protect,
  isMarketingOrAdmin,
  isAdminOrSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Activity access:
 * marketing_team + admin + superadmin
 */
router.use(protect, isMarketingOrAdmin);

/* =========================
   ACTIVITY
========================= */
router.post("/", createActivity);
router.get("/", listActivities);

/* =========================
   QUICK ACTION
========================= */
router.post("/quick-action", quickAction);

/* =========================
   ACTIVITY ACTIONS
========================= */
router.patch("/:id/complete", completeActivity);
router.patch("/:id/cancel", cancelActivity);

/* =========================
   DELETE
========================= */
router.delete("/:id", isAdminOrSuperAdmin, deleteActivity);

export default router;