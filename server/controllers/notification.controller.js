import mongoose from "mongoose";
import Notification from "../models/notification.model.js";
import { getReqMeta, writeAudit } from "../utils/audit.js";

const toObjectId = (v) => {
  if (!v) return null;
  return mongoose.Types.ObjectId.isValid(v)
    ? new mongoose.Types.ObjectId(v)
    : null;
};

const normalizeString = (value = "") => String(value || "").trim();

const isAdminOrSuperAdmin = (req) => {
  const role = req?.user?.role;
  return role === "admin" || role === "superadmin";
};

const NOTIFICATION_TYPES = [
  "info",
  "success",
  "warning",
  "danger",
  "lead",
  "activity",
  "proposal",
  "deal",
  "work_queue",
  "automation",
];

const PRIORITIES = ["low", "normal", "high", "urgent"];

const ENTITY_TYPES = [
  "",
  "Lead",
  "Activity",
  "Proposal",
  "Deal",
  "Customer",
  "WorkQueue",
  "AutomationRule",
];

/* =======================
   CREATE NOTIFICATION
======================= */
export const createNotification = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const {
      userId,
      title,
      message = "",
      type = "info",
      priority = "normal",
      entityType = "",
      entityId = null,
      actionUrl = "",
    } = req.body || {};

    const safeUserId = toObjectId(userId) || req.user._id;
    const safeEntityId = toObjectId(entityId);

    if (!title || !normalizeString(title)) {
      return res.status(400).json({ message: "title is required" });
    }

    if (!NOTIFICATION_TYPES.includes(type)) {
      return res.status(400).json({
        message: `Invalid type. Use: ${NOTIFICATION_TYPES.join(", ")}`,
      });
    }

    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: `Invalid priority. Use: ${PRIORITIES.join(", ")}`,
      });
    }

    if (!ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({
        message: `Invalid entityType. Use: ${ENTITY_TYPES.join(", ")}`,
      });
    }

    if (!isAdminOrSuperAdmin(req) && String(safeUserId) !== String(req.user._id)) {
      return res.status(403).json({
        message: "You can only create notifications for yourself.",
      });
    }

    const notification = await Notification.create({
      userId: safeUserId,
      title: normalizeString(title),
      message: normalizeString(message),
      type,
      priority,
      entityType,
      entityId: safeEntityId,
      actionUrl: normalizeString(actionUrl),
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "notification_created",
      entityType: "Notification",
      entityId: notification._id,
      before: null,
      after: notification.toObject(),
      meta,
    });

    return res.status(201).json({
      message: "Notification created",
      notification,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to create notification",
      error: err.message,
    });
  }
};

/* =======================
   LIST MY NOTIFICATIONS
======================= */
export const listMyNotifications = async (req, res) => {
  try {
    const {
      isRead,
      type,
      priority,
      entityType,
      limit = 50,
    } = req.query || {};

    const filter = {
      userId: req.user._id,
    };

    if (String(isRead).toLowerCase() === "true") filter.isRead = true;
    if (String(isRead).toLowerCase() === "false") filter.isRead = false;

    if (type && NOTIFICATION_TYPES.includes(String(type))) {
      filter.type = type;
    }

    if (priority && PRIORITIES.includes(String(priority))) {
      filter.priority = priority;
    }

    if (entityType && ENTITY_TYPES.includes(String(entityType))) {
      filter.entityType = entityType;
    }

    const pageSize = Math.min(Math.max(parseInt(limit || "50", 10), 1), 100);

    const items = await Notification.find(filter)
      .populate("createdBy", "name email role avatarUrl")
      .sort({ isRead: 1, createdAt: -1 })
      .limit(pageSize)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });

    return res.json({
      items,
      unreadCount,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to list notifications",
      error: err.message,
    });
  }
};

/* =======================
   LIST ALL NOTIFICATIONS ADMIN
======================= */
export const listAllNotifications = async (req, res) => {
  try {
    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({
        message: "Only admin/superadmin can list all notifications.",
      });
    }

    const {
      userId,
      isRead,
      type,
      priority,
      entityType,
      limit = 100,
    } = req.query || {};

    const filter = {};

    const safeUserId = toObjectId(userId);
    if (safeUserId) filter.userId = safeUserId;

    if (String(isRead).toLowerCase() === "true") filter.isRead = true;
    if (String(isRead).toLowerCase() === "false") filter.isRead = false;

    if (type && NOTIFICATION_TYPES.includes(String(type))) {
      filter.type = type;
    }

    if (priority && PRIORITIES.includes(String(priority))) {
      filter.priority = priority;
    }

    if (entityType && ENTITY_TYPES.includes(String(entityType))) {
      filter.entityType = entityType;
    }

    const pageSize = Math.min(Math.max(parseInt(limit || "100", 10), 1), 200);

    const items = await Notification.find(filter)
      .populate("userId", "name email role avatarUrl")
      .populate("createdBy", "name email role avatarUrl")
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .lean();

    return res.json({ items });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to list all notifications",
      error: err.message,
    });
  }
};

/* =======================
   MARK NOTIFICATION READ
======================= */
export const markNotificationRead = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid notification id" });

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (!isAdminOrSuperAdmin(req) && String(notification.userId) !== String(req.user._id)) {
      return res.status(403).json({
        message: "Not authorized to update this notification.",
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();

    await notification.save();

    return res.json({
      message: "Notification marked as read",
      notification,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to mark notification read",
      error: err.message,
    });
  }
};

/* =======================
   MARK NOTIFICATION UNREAD
======================= */
export const markNotificationUnread = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid notification id" });

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (!isAdminOrSuperAdmin(req) && String(notification.userId) !== String(req.user._id)) {
      return res.status(403).json({
        message: "Not authorized to update this notification.",
      });
    }

    notification.isRead = false;
    notification.readAt = null;

    await notification.save();

    return res.json({
      message: "Notification marked as unread",
      notification,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to mark notification unread",
      error: err.message,
    });
  }
};

/* =======================
   MARK ALL MY NOTIFICATIONS READ
======================= */
export const markAllMyNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        userId: req.user._id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to mark all notifications read",
      error: err.message,
    });
  }
};

/* =======================
   DELETE NOTIFICATION
======================= */
export const deleteNotification = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid notification id" });

    const before = await Notification.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Notification not found" });

    if (!isAdminOrSuperAdmin(req) && String(before.userId) !== String(req.user._id)) {
      return res.status(403).json({
        message: "Not authorized to delete this notification.",
      });
    }

    await Notification.findByIdAndDelete(id);

    await writeAudit({
      actorId: req.user._id,
      action: "delete",
      entityType: "Notification",
      entityId: id,
      before,
      after: null,
      meta,
    });

    return res.json({
      message: "Notification deleted",
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to delete notification",
      error: err.message,
    });
  }
};