import express from "express";
import {
  cancelMyLeaveRequest,
  createMyLeaveRequest,
  getMyLeaveRequests,
  listLeaveRequests,
  reviewLeaveRequest,
} from "../controllers/leaveRequest.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/me", requirePermission("leaves:view"), getMyLeaveRequests);
router.post("/me", requirePermission("leaves:view"), createMyLeaveRequest);
router.patch("/me/:id/cancel", requirePermission("leaves:view"), cancelMyLeaveRequest);

router.get("/", requirePermission("leaves:manage"), listLeaveRequests);
router.patch("/:id/review", requirePermission("leaves:manage"), reviewLeaveRequest);

export default router;
