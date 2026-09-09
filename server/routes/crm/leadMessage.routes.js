import express from "express";
import {
  getLeadMessageParticipants,
  getLeadMessageUnreadCount,
  listLeadMessages,
  markLeadMessagesRead,
  sendLeadMessage,
} from "../../controllers/leadMessage.controller.js";
import { protect, requirePermission } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("leads:view"));

router.get("/unread-count", getLeadMessageUnreadCount);
router.get("/:leadId/participants", getLeadMessageParticipants);
router.get("/:leadId", listLeadMessages);
router.post("/:leadId", requirePermission("leads:manage"), sendLeadMessage);
router.patch("/:leadId/read", requirePermission("leads:manage"), markLeadMessagesRead);

export default router;
