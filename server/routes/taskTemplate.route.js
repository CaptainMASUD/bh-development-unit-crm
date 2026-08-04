// routes/taskTemplate.route.js
import express from "express";
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

// templates CRUD
router.post("/", createTaskTemplate);
router.get("/", listTaskTemplates);
router.get("/:id", getTaskTemplateById);
router.patch("/:id", updateTaskTemplate);
router.delete("/:id", deleteTaskTemplate);

// subtitle files CRUD
router.get("/:id/subtitles/:subtitleId/files", listTemplateSubtitleFiles);
router.post("/:id/subtitles/:subtitleId/files", addTemplateSubtitleFile);
router.patch("/:id/subtitles/:subtitleId/files/:fileId", renameTemplateSubtitleFile);
router.patch("/:id/subtitles/:subtitleId/files/:fileId/replace", replaceTemplateSubtitleFile);
router.delete("/:id/subtitles/:subtitleId/files/:fileId", deleteTemplateSubtitleFile);

export default router;
