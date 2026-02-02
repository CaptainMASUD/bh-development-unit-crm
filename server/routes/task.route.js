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

  // ✅ subtitle features
  addSubtitleFiles,
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
   Base: /api (or wherever mounted)
========================= */

// list (cursor pagination)
// GET /customers/:customerId/tasks?limit=20&cursor=<taskId>&jobId=&rootJobId=
router.get("/customers/:customerId/tasks", getCustomerTasks);

// create task (admin/superadmin)
// POST /customers/:customerId/tasks
router.post("/customers/:customerId/tasks", addTask);

// admin update full task
// PATCH /customers/:customerId/tasks/:taskId
router.patch("/customers/:customerId/tasks/:taskId", updateTaskByAdmin);

// employee/admin update status
// PATCH /customers/:customerId/tasks/:taskId/status
router.patch("/customers/:customerId/tasks/:taskId/status", updateTaskStatus);

// ✅ upload file(s) under a subtitle (+ optional note)
// POST /customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files
router.post(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/files",
  addSubtitleFiles
);

// ✅ add note under a subtitle (or under a specific file via fileId)
// POST /customers/:customerId/tasks/:taskId/subtitles/:subtitleId/notes
router.post(
  "/customers/:customerId/tasks/:taskId/subtitles/:subtitleId/notes",
  addSubtitleNote
);

// ⚠️ OLD: task-level files (deprecated)
router.post("/customers/:customerId/tasks/:taskId/files", addTaskFile);

// delete task (admin/superadmin)
// DELETE /customers/:customerId/tasks/:taskId
router.delete("/customers/:customerId/tasks/:taskId", deleteTask);

/* =========================
   ✅ NOTIFICATIONS
========================= */

router.get("/notifications/deadlines/admin", getDeadlineNotificationsAdmin);
router.get("/notifications/deadlines/employee", getDeadlineNotificationsEmployee);

// fallback: auto-pick route based on role
router.get("/notifications/deadlines", getDeadlineNotificationsAuto);

export default router;
