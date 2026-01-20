// routes/activity.routes.js
import express from "express";
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  markActivityDone,
  deleteActivity,
  getTimeline,
  getUpcomingFollowups,
} from "../controllers/activity.controller.js";

import { protect } from "../middleware/auth.middleware.js";
// If you want admin-only delete from routes, import this:
// import { isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// ✅ IMPORTANT: Put fixed routes BEFORE "/:id"
router.get("/timeline", getTimeline);
router.get("/upcoming", getUpcomingFollowups);

// create + list
router.post("/", createActivity);
router.get("/", getActivities);

// read + update
router.get("/:id", getActivityById);
router.patch("/:id", updateActivity);

// quick complete
router.patch("/:id/done", markActivityDone);

// delete (admin OR creator allowed inside controller)
router.delete("/:id", deleteActivity);

// If you want admin-only delete, use this instead:
// router.delete("/:id", isAdminOrSuperAdmin, deleteActivity);

export default router;
