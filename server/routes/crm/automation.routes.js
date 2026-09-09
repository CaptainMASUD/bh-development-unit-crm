// routes/automation.routes.js
import express from "express";
import {
  createAutomationRule,
  listAutomationRules,
  getAutomationRuleById,
  updateAutomationRule,
  deleteAutomationRule,
  runAutomationRule,
  runDailyAutomations,
} from "../../controllers/automation.controller.js";

import {
  protect,
  isAdminOrSuperAdmin,
} from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, isAdminOrSuperAdmin);

router.post("/run/daily", runDailyAutomations);

router.post("/", createAutomationRule);
router.get("/", listAutomationRules);
router.get("/:id", getAutomationRuleById);
router.put("/:id", updateAutomationRule);
router.delete("/:id", deleteAutomationRule);

router.post("/:id/run", runAutomationRule);

export default router;