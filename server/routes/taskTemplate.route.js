// routes/taskTemplate.route.js
import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  createTaskTemplate,
  listTaskTemplates,
  getTaskTemplateById,
  updateTaskTemplate,
  deleteTaskTemplate,

  listTemplateSubtitleFiles,
  addTemplateSubtitleFile,
  renameTemplateSubtitleFile,
  replaceTemplateSubtitleFile, 
  deleteTemplateSubtitleFile,
} from "../controllers/taskTemplate.controller.js";

const router = express.Router();
router.use(protect);

// templates CRUD
router.post("/task-templates", createTaskTemplate);
router.get("/task-templates", listTaskTemplates);
router.get("/task-templates/:id", getTaskTemplateById);
router.patch("/task-templates/:id", updateTaskTemplate);
router.delete("/task-templates/:id", deleteTaskTemplate);

// subtitle files CRUD
router.get("/task-templates/:id/subtitles/:subtitleId/files", listTemplateSubtitleFiles);
router.post("/task-templates/:id/subtitles/:subtitleId/files", addTemplateSubtitleFile);
router.patch("/task-templates/:id/subtitles/:subtitleId/files/:fileId", renameTemplateSubtitleFile);
router.patch("/task-templates/:id/subtitles/:subtitleId/files/:fileId/replace", replaceTemplateSubtitleFile);
router.delete("/task-templates/:id/subtitles/:subtitleId/files/:fileId", deleteTemplateSubtitleFile);

export default router;
