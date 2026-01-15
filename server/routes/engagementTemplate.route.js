// routes/engagementTemplate.route.js
import express from "express";
import {
  createEngagementTemplate,
  listEngagementTemplates,
  getEngagementTemplateById,
  updateEngagementTemplate,
  deleteEngagementTemplate,
} from "../controllers/engagementTemplate.controller.js";

import { protect, isAdminOrSuperAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(protect);

// ✅ list (dropdown/search)
router.get("/", listEngagementTemplates);

// ✅ create (admin)
router.post("/", isAdminOrSuperAdmin, createEngagementTemplate);

// ✅ get one
router.get("/:id", getEngagementTemplateById);

// ✅ update (admin)
router.patch("/:id", isAdminOrSuperAdmin, updateEngagementTemplate);

// ✅ delete (admin)
router.delete("/:id", isAdminOrSuperAdmin, deleteEngagementTemplate);

export default router;
