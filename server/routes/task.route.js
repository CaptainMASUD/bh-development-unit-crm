// routes/task.route.js
import express from "express";
import { protect } from "../middleware/auth.middleware.js";
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
router.get("/customers/:customerId/tasks", getCustomerTasks);
router.post("/customers/:customerId/tasks", addTask);
router.patch("/customers/:customerId/tasks/:taskId", updateTaskByAdmin);
router.patch("/customers/:customerId/tasks/:taskId/status", updateTaskStatus);
router.delete("/customers/:customerId/tasks/:taskId", deleteTask);

/* =========================
   ✅ SUBTITLE FILES (FULL CRUD)
========================= */

// C: add file(s)
router.post(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  addSubtitleFiles
);

// R: list files
router.get(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  getSubtitleFiles
);

// U: update file metadata (displayName)
router.patch(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files/:fileId",
  updateSubtitleFile
);

// D: delete file (DB + optional S3 delete)
router.delete(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files/:fileId",
  deleteSubtitleFile
);

/* =========================
   ✅ SUBTITLE NOTES
========================= */
router.post(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/notes",
  addSubtitleNote
);

// ⚠️ OLD: task-level files (deprecated)
router.post("/customers/:customerId/tasks/:taskId/files", addTaskFile);

/* =========================
   ✅ NOTIFICATIONS
========================= */
router.get("/notifications/deadlines/admin", getDeadlineNotificationsAdmin);
router.get("/notifications/deadlines/employee", getDeadlineNotificationsEmployee);
router.get("/notifications/deadlines", getDeadlineNotificationsAuto);

export default router;
