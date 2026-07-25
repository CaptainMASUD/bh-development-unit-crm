import express from "express";
import {
  createBankReconciliation,
  getBankReconciliationWorkspace,
  autoMatchBankReconciliation,
  matchBankReconciliationLine,
  completeBankReconciliation,
  reopenBankReconciliation,
  createBankTransaction,
  createMoneyTransfer,
  deleteBankTransaction,
  getBankingSummary,
  listBankReconciliations,
  listBankTransactions,
  listMoneyTransfers,
  listOperationalBankAccounts,
  listTreasuryAccounts,
  listTreasuryVouchers,
  createTreasuryVoucher,
  updateChequeStatus,
  listOpenSettlementDocuments,
  updateBankTransaction,
  voidBankTransaction,
  postDraftBankTransaction,
} from "../controllers/banking.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";
import { connectBankAccountLedgers } from "../controllers/bank.controller.js";

const router = express.Router();

router.use(protect);
router.use(requirePermission("finance:view"));

router.get("/summary", getBankingSummary);
router.get("/accounts", listOperationalBankAccounts);
router.get("/treasury-accounts", listTreasuryAccounts);
router.post("/treasury-accounts/synchronize", requirePermission("finance:manage"), connectBankAccountLedgers);
router.get("/vouchers", listTreasuryVouchers);
router.get("/open-documents", listOpenSettlementDocuments);
router.post("/vouchers", requirePermission("finance:manage"), createTreasuryVoucher);
router.patch("/vouchers/:id/cheque-status", requirePermission("finance:manage"), updateChequeStatus);
router.get("/transactions", listBankTransactions);
router.post("/transactions", requirePermission("finance:manage"), createBankTransaction);
router.patch("/transactions/:id", requirePermission("finance:manage"), updateBankTransaction);
router.patch("/transactions/:id/void", requirePermission("finance:manage"), voidBankTransaction);
router.patch("/transactions/:id/post", requirePermission("finance:manage"), postDraftBankTransaction);
router.delete("/transactions/:id", requirePermission("finance:manage"), deleteBankTransaction);

router.get("/transfers", listMoneyTransfers);
router.post("/transfers", requirePermission("finance:manage"), createMoneyTransfer);

router.get("/reconciliations", listBankReconciliations);
router.post("/reconciliations", requirePermission("finance:manage"), createBankReconciliation);
router.get("/reconciliations/:id", getBankReconciliationWorkspace);
router.post("/reconciliations/:id/auto-match", requirePermission("finance:manage"), autoMatchBankReconciliation);
router.patch("/reconciliations/:id/lines/:lineId/match", requirePermission("finance:manage"), matchBankReconciliationLine);
router.patch("/reconciliations/:id/complete", requirePermission("finance:manage"), completeBankReconciliation);
router.patch("/reconciliations/:id/reopen", requirePermission("finance:manage"), reopenBankReconciliation);

export default router;
