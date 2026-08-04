// routes/notification.routes.js
import express from "express";
import {
  createNotification,
  listMyNotifications,
  listAllNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllMyNotificationsRead,
  deleteNotification,
} from "../controllers/notification.controller.js";

import {
  protect,
  isAdminOrSuperAdmin,
  requireModule,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requireModule("administration"));

/* =========================
   MY NOTIFICATIONS
========================= */
router.get("/my", listMyNotifications);
router.patch("/my/read-all", markAllMyNotificationsRead);

/* =========================
   ADMIN
========================= */
router.get("/all", isAdminOrSuperAdmin, listAllNotifications);

/* =========================
   CREATE
========================= */
router.post("/", createNotification);

/* =========================
   ACTIONS
========================= */
router.patch("/:id/read", markNotificationRead);
router.patch("/:id/unread", markNotificationUnread);
router.delete("/:id", deleteNotification);

export default router;
