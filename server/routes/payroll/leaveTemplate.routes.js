import express from "express";
import {
  applyLeaveTemplate,
  createLeaveTemplate,
  deleteLeaveTemplate,
  listLeaveTemplates,
  updateLeaveTemplate,
} from "../../controllers/leaveTemplate.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("leaves:manage"));

router.get("/", listLeaveTemplates);
router.post("/", createLeaveTemplate);
router.post("/:id/apply", applyLeaveTemplate);
router.patch("/:id", updateLeaveTemplate);
router.delete("/:id", deleteLeaveTemplate);

export default router;
