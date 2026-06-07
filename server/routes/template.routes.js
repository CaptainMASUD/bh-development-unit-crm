// routes/template.routes.js
import express from "express";
import {
  createTemplate,
  listTemplates,
  getTemplateById,
  updateTemplate,
  useTemplate,
  deleteTemplate,
} from "../controllers/template.controller.js";

import {
  protect,
  isMarketingOrAdmin,
} from "../middleware/auth.middleware.js";

const router = express.Router();

/**
 * Template access:
 * marketing_team + admin + superadmin
 */
router.use(protect, isMarketingOrAdmin);

/* =========================
   MESSAGE TEMPLATES
========================= */
router.post("/", createTemplate);
router.get("/", listTemplates);
router.get("/:id", getTemplateById);
router.put("/:id", updateTemplate);

/* =========================
   USE / RENDER TEMPLATE
========================= */
router.post("/:id/use", useTemplate);

/* =========================
   DELETE
========================= */
router.delete("/:id", deleteTemplate);

export default router;