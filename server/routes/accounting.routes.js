import express from "express";
import {
  approveVendorBill,
  bootstrapChartOfAccounts,
  closeAccountingPeriod,
  closeFiscalYear,
  carryForwardOpeningBalance,
  createFiscalYear,
  createAccount,
  createCashAccount,
  createJournalEntry,
  createVendorBill,
  getBalanceSheet,
  getCashFlowStatement,
  getGeneralLedger,
  getAccountingSettings,
  getPayables,
  getProfitLoss,
  getReceivables,
  getTrialBalance,
  listAccounts,
  listAccountingPeriods,
  listFiscalYears,
  listOpeningBalances,
  listCashAccounts,
  listJournalEntries,
  listVendorBills,
  payVendorBill,
  postDraftJournalEntry,
  postOpeningBalances,
  postOpeningBalanceDraft,
  publishChartOfAccounts,
  reconcileCashAccount,
  recordCustomerPayment,
  reopenAccountingPeriod,
  lockAccountingPeriod,
  unlockAccountingPeriod,
  updateAccountingSettings,
  updateAccount,
  upsertAccountingPeriod,
  voidJournalEntry,
} from "../controllers/accounting.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requirePermission("finance:view"));

router.get("/receivables", getReceivables);
router.get("/payables", getPayables);
router.get("/profit-loss", getProfitLoss);

router.get("/accounts", listAccounts);
router.post("/accounts/bootstrap", requirePermission("finance:manage"), bootstrapChartOfAccounts);
router.post("/accounts", requirePermission("finance:manage"), createAccount);
router.patch("/accounts/:id", requirePermission("finance:manage"), updateAccount);
router.post("/accounts/publish", requirePermission("finance:manage"), publishChartOfAccounts);

router.get("/settings", getAccountingSettings);
router.put("/settings", requirePermission("finance:manage"), updateAccountingSettings);

router.get("/fiscal-years", listFiscalYears);
router.post("/fiscal-years", requirePermission("finance:manage"), createFiscalYear);
router.patch("/fiscal-years/:id/close", requirePermission("finance:manage"), closeFiscalYear);

router.get("/journals", listJournalEntries);
router.post("/journals", requirePermission("finance:manage"), createJournalEntry);
router.patch("/journals/:id/post", requirePermission("finance:manage"), postDraftJournalEntry);
router.patch("/journals/:id/void", requirePermission("finance:manage"), voidJournalEntry);

router.get("/periods", listAccountingPeriods);
router.post("/periods", requirePermission("finance:manage"), upsertAccountingPeriod);
router.patch("/periods/:periodKey/close", requirePermission("finance:manage"), closeAccountingPeriod);
router.patch("/periods/:periodKey/reopen", requirePermission("finance:manage"), reopenAccountingPeriod);
router.patch("/periods/:periodKey/lock", requirePermission("finance:manage"), lockAccountingPeriod);
router.patch("/periods/:periodKey/unlock", requirePermission("finance:manage"), unlockAccountingPeriod);

router.get("/cash-accounts", listCashAccounts);
router.post("/cash-accounts", requirePermission("finance:manage"), createCashAccount);
router.patch("/cash-accounts/:id/reconcile", requirePermission("finance:manage"), reconcileCashAccount);

router.get("/vendor-bills", listVendorBills);
router.post("/vendor-bills", requirePermission("finance:manage"), createVendorBill);
router.patch("/vendor-bills/:id/approve", requirePermission("finance:manage"), approveVendorBill);
router.post("/vendor-bills/:id/payments", requirePermission("finance:manage"), payVendorBill);

router.post("/customer-payments", requirePermission("finance:manage"), recordCustomerPayment);
router.post("/invoices/:invoiceId/payments", requirePermission("finance:manage"), recordCustomerPayment);
router.get("/opening-balances", listOpeningBalances);
router.post("/opening-balances", requirePermission("finance:manage"), postOpeningBalances);
router.patch("/opening-balances/:id/post", requirePermission("finance:manage"), postOpeningBalanceDraft);
router.post("/opening-balances/carry-forward/:fiscalYearId", requirePermission("finance:manage"), carryForwardOpeningBalance);

router.get("/general-ledger", getGeneralLedger);
router.get("/trial-balance", getTrialBalance);
router.get("/balance-sheet", getBalanceSheet);
router.get("/cash-flow", getCashFlowStatement);

export default router;
