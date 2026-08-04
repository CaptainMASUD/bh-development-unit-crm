// routes/task.route.js
import express from "express";
import { requirePermission } from "../middleware/auth.middleware.js";
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
const deadlineRouter = express.Router();

/* =========================
   ✅ TASKS
========================= */
router.get("/:customerId/tasks", requirePermission("tasks:view"), getCustomerTasks);
router.post("/:customerId/tasks", requirePermission("tasks:manage"), addTask);
router.patch("/:customerId/tasks/:taskId", requirePermission("tasks:manage"), updateTaskByAdmin);
router.patch("/:customerId/tasks/:taskId/status", requirePermission("tasks:manage"), updateTaskStatus);
router.delete("/:customerId/tasks/:taskId", requirePermission("tasks:manage"), deleteTask);

/* =========================
   ✅ SUBTITLE FILES (FULL CRUD)
========================= */

// C: add file(s)
router.post(
  "/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  requirePermission("tasks:manage"),
  addSubtitleFiles
);

// R: list files
router.get(
  "/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  requirePermission("tasks:view"),
  getSubtitleFiles
);

// U: update file metadata (displayName)
router.patch(
  "/:customerId/tasks/:taskId/subtitles/:subtitleId/files/:fileId",
  requirePermission("tasks:manage"),
  updateSubtitleFile
);

// D: delete file (DB + optional S3 delete)
router.delete(
  "/:customerId/tasks/:taskId/subtitles/:subtitleId/files/:fileId",
  requirePermission("tasks:manage"),
  deleteSubtitleFile
);

/* =========================
   ✅ SUBTITLE NOTES
========================= */
router.post(
  "/:customerId/tasks/:taskId/subtitles/:subtitleId/notes",
  requirePermission("tasks:manage"),
  addSubtitleNote
);

// ⚠️ OLD: task-level files (deprecated)
router.post("/:customerId/tasks/:taskId/files", requirePermission("tasks:manage"), addTaskFile);

/* =========================
   ✅ NOTIFICATIONS
========================= */
deadlineRouter.get("/admin", getDeadlineNotificationsAdmin);
deadlineRouter.get("/employee", requirePermission("notifications:view"), getDeadlineNotificationsEmployee);
deadlineRouter.get("/", requirePermission("notifications:view"), getDeadlineNotificationsAuto);

export default router;
export { deadlineRouter as deadlineNotificationRoutes };
