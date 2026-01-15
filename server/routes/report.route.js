import express from "express";
import {
  updateDraftReport,
  updateFinalReport,
  removeReportFile,
} from "../controllers/report.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.patch("/customers/:customerId/draft", updateDraftReport);
router.patch("/customers/:customerId/final", updateFinalReport);
router.delete("/customers/:customerId/report-file", removeReportFile);

export default router;
