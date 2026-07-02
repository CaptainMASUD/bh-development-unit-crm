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
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("leads:view"));

/* =========================
   MESSAGE TEMPLATES
========================= */
router.post("/", requirePermission("leads:manage"), createTemplate);
router.get("/", listTemplates);
router.get("/:id", getTemplateById);
router.put("/:id", requirePermission("leads:manage"), updateTemplate);

/* =========================
   USE / RENDER TEMPLATE
========================= */
router.post("/:id/use", requirePermission("leads:manage"), useTemplate);

/* =========================
   DELETE
========================= */
router.delete("/:id", requirePermission("leads:manage"), deleteTemplate);

export default router;
