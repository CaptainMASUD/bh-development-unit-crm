import express from "express";
import {
  createBank,
  createBankAccount,
  deleteBank,
  deleteBankAccount,
  listBankAccounts,
  listBankLedgerOptions,
  listBanks,
  updateBank,
  updateBankAccount,
  connectBankAccountLedgers,
} from "../controllers/bank.controller.js";
import { protect, requirePermission } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/accounts", requirePermission("bank-setup:view"), listBankAccounts);
router.get("/accounts/ledger-options", requirePermission("bank-setup:view"), listBankLedgerOptions);
router.post("/accounts/connect-ledgers", requirePermission("bank-setup:manage"), connectBankAccountLedgers);
router.post("/accounts", requirePermission("bank-setup:manage"), createBankAccount);
router.patch("/accounts/:id", requirePermission("bank-setup:manage"), updateBankAccount);
router.delete("/accounts/:id", requirePermission("bank-setup:manage"), deleteBankAccount);

router.get("/", requirePermission("bank-setup:view"), listBanks);
router.post("/", requirePermission("bank-setup:manage"), createBank);
router.patch("/:id", requirePermission("bank-setup:manage"), updateBank);
router.delete("/:id", requirePermission("bank-setup:manage"), deleteBank);

export default router;
