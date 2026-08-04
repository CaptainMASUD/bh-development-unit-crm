import express from "express";
import {
  updateDraftReport,
  updateFinalReport,
  removeReportFile,
} from "../controllers/report.controller.js";

const router = express.Router();

router.patch("/:customerId/draft", updateDraftReport);
router.patch("/:customerId/final", updateFinalReport);
router.delete("/:customerId/report-file", removeReportFile);

export default router;
