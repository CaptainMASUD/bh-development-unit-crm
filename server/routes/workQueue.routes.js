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
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("leads:view"));

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
router.post("/", requirePermission("leads:manage"), createWorkQueueItem);

/* =========================
   QUEUE ACTIONS
========================= */
router.patch("/:id/start", requirePermission("leads:manage"), startWorkQueueItem);
router.patch("/:id/done", requirePermission("leads:manage"), markWorkQueueDone);
router.patch("/:id/snooze", requirePermission("leads:manage"), snoozeWorkQueueItem);
router.patch("/:id/cancel", requirePermission("leads:manage"), cancelWorkQueueItem);

/* =========================
   ADMIN REASSIGN
========================= */
router.patch("/:id/reassign", requirePermission("leads:manage"), reassignWorkQueueItem);

export default router;
