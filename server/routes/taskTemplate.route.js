// routes/taskTemplate.route.js
import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  createTaskTemplate,
  listTaskTemplates,
  getTaskTemplateById,
  updateTaskTemplate,
  deleteTaskTemplate,
} from "../controllers/taskTemplate.controller.js";

const router = express.Router();
router.use(protect);

// templates
router.post("/task-templates", createTaskTemplate);
router.get("/task-templates", listTaskTemplates);
router.get("/task-templates/:id", getTaskTemplateById);
router.patch("/task-templates/:id", updateTaskTemplate);
router.delete("/task-templates/:id", deleteTaskTemplate);

export default router;
