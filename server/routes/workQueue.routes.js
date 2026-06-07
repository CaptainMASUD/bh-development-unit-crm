// routes/workQueue.routes.js
import express from "express";
import {
  createWorkQueueItem,
  getTodayWorkQueue,
  listWorkQueue,
  getWorkQueueItem,
  startWorkQueueItem,
  markWorkQueueDone,
  snoozeWorkQueueItem,
  reassignWorkQueueItem,
  cancelWorkQueueItem,
  getWorkQueueSummary,
} from "../controllers/workQueue.controller.js";

import {
  protect,
  isMarketingOrAdmin,
  isAdminOrSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Work queue access:
 * marketing_team + admin + superadmin
 */
router.use(protect, isMarketingOrAdmin);

/* =========================
   WORK QUEUE LIST / SUMMARY
========================= */
router.get("/", listWorkQueue);
router.get("/today", getTodayWorkQueue);
router.get("/summary", getWorkQueueSummary);
router.get("/:id", getWorkQueueItem);

/* =========================
   CREATE MANUAL QUEUE ITEM
========================= */
router.post("/", createWorkQueueItem);

/* =========================
   QUEUE ACTIONS
========================= */
router.patch("/:id/start", startWorkQueueItem);
router.patch("/:id/done", markWorkQueueDone);
router.patch("/:id/snooze", snoozeWorkQueueItem);
router.patch("/:id/cancel", cancelWorkQueueItem);

/* =========================
   ADMIN REASSIGN
========================= */
router.patch("/:id/reassign", isAdminOrSuperAdmin, reassignWorkQueueItem);

export default router;