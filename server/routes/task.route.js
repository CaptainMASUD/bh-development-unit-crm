// routes/task.route.js
import express from "express";
import { protect, requirePermission } from "../middleware/auth.middleware.js";
import {
  // ✅ tasks
  getCustomerTasks,
  addTask,
  updateTaskByAdmin,
  deleteTask,
  updateTaskStatus,

  // ✅ subtitle files CRUD
  addSubtitleFiles,      
  getSubtitleFiles,      // R   ✅ NEW
  updateSubtitleFile,    // U   ✅ NEW
  deleteSubtitleFile,    // D   ✅ NEW

  // ✅ subtitle notes
  addSubtitleNote,

  // ⚠️ deprecated (kept for old UI)
  addTaskFile,

  // ✅ notifications
  getDeadlineNotificationsAdmin,
  getDeadlineNotificationsEmployee,
  getDeadlineNotificationsAuto,
} from "../controllers/task.controller.js";

const router = express.Router();
router.use(protect);

/* =========================
   ✅ TASKS
========================= */
router.get("/customers/:customerId/tasks", requirePermission("tasks:view"), getCustomerTasks);
router.post("/customers/:customerId/tasks", requirePermission("tasks:manage"), addTask);
router.patch("/customers/:customerId/tasks/:taskId", requirePermission("tasks:manage"), updateTaskByAdmin);
router.patch("/customers/:customerId/tasks/:taskId/status", requirePermission("tasks:manage"), updateTaskStatus);
router.delete("/customers/:customerId/tasks/:taskId", requirePermission("tasks:manage"), deleteTask);

/* =========================
   ✅ SUBTITLE FILES (FULL CRUD)
========================= */

// C: add file(s)
router.post(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  requirePermission("tasks:manage"),
  addSubtitleFiles
);

// R: list files
router.get(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  requirePermission("tasks:view"),
  getSubtitleFiles
);

// U: update file metadata (displayName)
router.patch(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files/:fileId",
  requirePermission("tasks:manage"),
  updateSubtitleFile
);

// D: delete file (DB + optional S3 delete)
router.delete(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files/:fileId",
  requirePermission("tasks:manage"),
  deleteSubtitleFile
);

/* =========================
   ✅ SUBTITLE NOTES
========================= */
router.post(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/notes",
  requirePermission("tasks:manage"),
  addSubtitleNote
);

// ⚠️ OLD: task-level files (deprecated)
router.post("/customers/:customerId/tasks/:taskId/files", requirePermission("tasks:manage"), addTaskFile);

/* =========================
   ✅ NOTIFICATIONS
========================= */
router.get("/notifications/deadlines/admin", getDeadlineNotificationsAdmin);
router.get("/notifications/deadlines/employee", requirePermission("notifications:view"), getDeadlineNotificationsEmployee);
router.get("/notifications/deadlines", requirePermission("notifications:view"), getDeadlineNotificationsAuto);

export default router;
