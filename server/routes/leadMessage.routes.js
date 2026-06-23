import express from "express";
import {
  getLeadMessageParticipants,
  getLeadMessageUnreadCount,
  listLeadMessages,
  markLeadMessagesRead,
  sendLeadMessage,
} from "../controllers/leadMessage.controller.js";
import { protect, isMarketingOrAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, isMarketingOrAdmin);

router.get("/unread-count", getLeadMessageUnreadCount);
router.get("/:leadId/participants", getLeadMessageParticipants);
router.get("/:leadId", listLeadMessages);
router.post("/:leadId", sendLeadMessage);
router.patch("/:leadId/read", markLeadMessagesRead);

export default router;
