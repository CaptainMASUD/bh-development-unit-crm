import express from "express";
import {
  createBankReconciliation,
  createBankTransaction,
  createMoneyTransfer,
  deleteBankTransaction,
  getBankingSummary,
  listBankReconciliations,
  listBankTransactions,
  listMoneyTransfers,
  updateBankTransaction,
} from "../controllers/banking.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(requirePermission("finance:view"));

router.get("/summary", getBankingSummary);
router.get("/transactions", listBankTransactions);
router.post("/transactions", requirePermission("finance:manage"), createBankTransaction);
router.patch("/transactions/:id", requirePermission("finance:manage"), updateBankTransaction);
router.delete("/transactions/:id", requirePermission("finance:manage"), deleteBankTransaction);

router.get("/transfers", listMoneyTransfers);
router.post("/transfers", requirePermission("finance:manage"), createMoneyTransfer);

router.get("/reconciliations", listBankReconciliations);
router.post("/reconciliations", requirePermission("finance:manage"), createBankReconciliation);

export default router;
