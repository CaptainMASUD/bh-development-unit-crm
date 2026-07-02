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
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("leads:view"));

/* =========================
   ACTIVITY
========================= */
router.post("/", requirePermission("leads:manage"), createActivity);
router.get("/", listActivities);

/* =========================
   QUICK ACTION
========================= */
router.post("/quick-action", requirePermission("leads:manage"), quickAction);

/* =========================
   ACTIVITY ACTIONS
========================= */
router.patch("/:id/complete", requirePermission("leads:manage"), completeActivity);
router.patch("/:id/cancel", requirePermission("leads:manage"), cancelActivity);

/* =========================
   DELETE
========================= */
router.delete("/:id", requirePermission("leads:manage"), deleteActivity);

export default router;
