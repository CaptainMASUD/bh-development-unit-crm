import express from "express";
import {
  approveVendorBill,
  bootstrapChartOfAccounts,
  carryForwardOpeningBalance,
  closeAccountingPeriod,
  closeFiscalYear,
  createAccount,
  createCashAccount,
  createFiscalYear,
  createJournalEntry,
  createVendorBill,
  deleteAccount,
  deleteCashAccount,
  getAccountingSettings,
  getBalanceSheet,
  getCashFlowStatement,
  getGeneralLedger,
  getJournalEntry,
  getPayables,
  getProfitLoss,
  getReceivables,
  getTrialBalance,
  listAccountingPeriods,
  listAccounts,
  listCashAccounts,
  listCashCustodians,
  listFiscalYears,
  listJournalEntries,
  listOpeningBalances,
  listVendorBills,
  listVoucherTypes,
  lockAccountingPeriod,
  payVendorBill,
  postDraftJournalEntry,
  postOpeningBalanceDraft,
  postOpeningBalances,
  publishChartOfAccounts,
  reconcileCashAccount,
  recordCustomerPayment,
  reopenAccountingPeriod,
  reverseJournalEntry,
  submitJournalEntry,
  unlockAccountingPeriod,
  updateAccount,
  updateAccountingSettings,
  updateCashAccount,
  updateDraftJournalEntry,
  updateVoucherType,
  upsertAccountingPeriod,
  voidJournalEntry,
  approveJournalEntry,
} from "../controllers/accounting.controller.js";
import {
  protect,
  requireAnyPermission,
  requirePermission,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get(
  "/payables",
  requireAnyPermission(["finance:view", "expenses:view"]),
  getPayables
);

router.use(requirePermission("finance:view"));

router.get("/receivables", getReceivables);
router.get("/profit-loss", getProfitLoss);

router.get("/accounts", listAccounts);
router.post(
  "/accounts/bootstrap",
  requirePermission("finance:manage"),
  bootstrapChartOfAccounts
);
router.post("/accounts", requirePermission("finance:manage"), createAccount);
router.patch(
  "/accounts/:id",
  requirePermission("finance:manage"),
  updateAccount
);
router.delete(
  "/accounts/:id",
  requirePermission("finance:manage"),
  deleteAccount
);
router.post(
  "/accounts/publish",
  requirePermission("finance:manage"),
  publishChartOfAccounts
);

router.get("/settings", getAccountingSettings);
router.put(
  "/settings",
  requirePermission("finance:manage"),
  updateAccountingSettings
);

router.get("/fiscal-years", listFiscalYears);
router.post(
  "/fiscal-years",
  requirePermission("finance:manage"),
  createFiscalYear
);
router.patch(
  "/fiscal-years/:id/close",
  requirePermission("finance:manage"),
  closeFiscalYear
);

router.get("/voucher-types", listVoucherTypes);
router.patch(
  "/voucher-types/:key",
  requirePermission("finance:manage"),
  updateVoucherType
);

router.get("/journals", listJournalEntries);
router.get("/journals/:id", getJournalEntry);
router.post(
  "/journals",
  requirePermission("finance:manage"),
  createJournalEntry
);
router.patch(
  "/journals/:id",
  requirePermission("finance:manage"),
  updateDraftJournalEntry
);
router.patch(
  "/journals/:id/submit",
  requirePermission("finance:manage"),
  submitJournalEntry
);
router.patch(
  "/journals/:id/approve",
  requirePermission("finance:manage"),
  approveJournalEntry
);
router.post(
  "/journals/:id/reverse",
  requirePermission("finance:manage"),
  reverseJournalEntry
);
router.patch(
  "/journals/:id/post",
  requirePermission("finance:manage"),
  postDraftJournalEntry
);
router.patch(
  "/journals/:id/void",
  requirePermission("finance:manage"),
  voidJournalEntry
);

router.get("/periods", listAccountingPeriods);
router.post(
  "/periods",
  requirePermission("finance:manage"),
  upsertAccountingPeriod
);
router.patch(
  "/periods/:periodKey/close",
  requirePermission("finance:manage"),
  closeAccountingPeriod
);
router.patch(
  "/periods/:periodKey/reopen",
  requirePermission("finance:manage"),
  reopenAccountingPeriod
);
router.patch(
  "/periods/:periodKey/lock",
  requirePermission("finance:manage"),
  lockAccountingPeriod
);
router.patch(
  "/periods/:periodKey/unlock",
  requirePermission("finance:manage"),
  unlockAccountingPeriod
);

router.get("/cash-accounts", listCashAccounts);
router.get("/cash-custodians", listCashCustodians);
router.post(
  "/cash-accounts",
  requirePermission("finance:manage"),
  createCashAccount
);
router.patch(
  "/cash-accounts/:id",
  requirePermission("finance:manage"),
  updateCashAccount
);
router.delete(
  "/cash-accounts/:id",
  requirePermission("finance:manage"),
  deleteCashAccount
);
router.patch(
  "/cash-accounts/:id/reconcile",
  requirePermission("finance:manage"),
  reconcileCashAccount
);

router.get("/vendor-bills", listVendorBills);
router.post(
  "/vendor-bills",
  requirePermission("finance:manage"),
  createVendorBill
);
router.patch(
  "/vendor-bills/:id/approve",
  requirePermission("finance:manage"),
  approveVendorBill
);
router.post(
  "/vendor-bills/:id/payments",
  requirePermission("finance:manage"),
  payVendorBill
);

router.post(
  "/customer-payments",
  requirePermission("finance:manage"),
  recordCustomerPayment
);
router.post(
  "/invoices/:invoiceId/payments",
  requirePermission("finance:manage"),
  recordCustomerPayment
);
router.get("/opening-balances", listOpeningBalances);
router.post(
  "/opening-balances",
  requirePermission("finance:manage"),
  postOpeningBalances
);
router.patch(
  "/opening-balances/:id/post",
  requirePermission("finance:manage"),
  postOpeningBalanceDraft
);
router.post(
  "/opening-balances/carry-forward/:fiscalYearId",
  requirePermission("finance:manage"),
  carryForwardOpeningBalance
);

router.get("/general-ledger", getGeneralLedger);
router.get("/trial-balance", getTrialBalance);
router.get("/balance-sheet", getBalanceSheet);
router.get("/cash-flow", getCashFlowStatement);

export default router;
