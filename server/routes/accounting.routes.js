import express from "express";
import {
  getPayables,
  getProfitLoss,
  getReceivables,
} from "../controllers/accounting.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("finance:view"));

router.get("/receivables", getReceivables);
router.get("/payables", getPayables);
router.get("/profit-loss", getProfitLoss);

export default router;
