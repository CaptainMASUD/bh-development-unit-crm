import mongoose from "mongoose";
import Bank from "../models/bank.model.js";
import BankAccount from "../models/bankAccount.model.js";
import BankTransaction from "../models/bankTransaction.model.js";
import Account from "../models/account.model.js";
import AccountingSettings from "../models/accountingSettings.model.js";
import Payroll from "../models/payroll.model.js";
import JournalEntry from "../models/journalEntry.model.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const parseLimit = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(Math.max(n, 1), 150);
};

const textRegex = (value) => {
  const q = clean(value);
  if (!q) return null;
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
};

const buildBankPayload = (body = {}, userId = null) => {
  const payload = {};
  if (body.bankName !== undefined) payload.bankName = clean(body.bankName);
  if (body.shortName !== undefined) payload.shortName = clean(body.shortName).toUpperCase();
  if (body.bankType !== undefined) payload.bankType = clean(body.bankType || "private").toLowerCase();
  if (body.country !== undefined) payload.country = clean(body.country || "Bangladesh");
  if (body.swiftCode !== undefined) payload.swiftCode = clean(body.swiftCode).toUpperCase();
  if (body.website !== undefined) payload.website = clean(body.website);
  if (body.status !== undefined) payload.status = clean(body.status || "active").toLowerCase();
  if (userId) payload.updatedBy = userId;
  return payload;
};

const buildBankAccountPayload = (body = {}, userId = null) => {
  const payload = {};
  if (body.bank !== undefined) payload.bank = clean(body.bank);
  if (body.ledgerAccount !== undefined) payload.ledgerAccount = clean(body.ledgerAccount) || null;
  if (body.accountName !== undefined) payload.accountName = clean(body.accountName);
  if (body.accountNumber !== undefined) payload.accountNumber = clean(body.accountNumber);
  if (body.accountType !== undefined) payload.accountType = clean(body.accountType || "current").toLowerCase();
  if (body.openingBalance !== undefined) payload.openingBalance = Number(body.openingBalance);
  if (body.branchName !== undefined) payload.branchName = clean(body.branchName);
  if (body.routingNumber !== undefined) payload.routingNumber = clean(body.routingNumber);
  if (body.swiftCode !== undefined) payload.swiftCode = clean(body.swiftCode).toUpperCase();
  if (body.currency !== undefined) payload.currency = clean(body.currency || "BDT").toUpperCase();
  if (body.description !== undefined) payload.description = clean(body.description);
  if (body.status !== undefined) payload.status = clean(body.status || "active").toLowerCase();
  if (userId) payload.updatedBy = userId;
  return payload;
};

const validateLedgerAccount = async (ledgerAccount, excludeBankAccountId = null, expectedCurrency = "") => {
  if (!isId(ledgerAccount)) return null;
  const ledger = await Account.findOne({ _id: ledgerAccount, isActive: true, isGroup: { $ne: true }, type: { $in: ["asset", "liability"] } });
  if (!ledger) return null;
  if (expectedCurrency && ledger.currency && String(ledger.currency).toUpperCase() !== String(expectedCurrency).toUpperCase()) return null;
  const linked = await BankAccount.exists({ ledgerAccount: ledger._id, ...(excludeBankAccountId ? { _id: { $ne: excludeBankAccountId } } : {}) });
  return linked ? null : ledger;
};

const createBankLedgerAccount = async ({ bankAccount, bank, userId }) => {
  const liability = ["loan", "credit_card"].includes(bankAccount.accountType);
  const settings = await AccountingSettings.findOne({ key: "company" }).select("coaPublishedAt").lean();
  return Account.create({
    code: `BANK-${String(bankAccount._id).slice(-8).toUpperCase()}`,
    name: `${bank?.shortName || bank?.bankName || "Bank"} - ${bankAccount.accountName}`,
    type: liability ? "liability" : "asset",
    subType: liability ? "Current Liability" : "Bank and Cash",
    currency: bankAccount.currency,
    description: `Linked bank ledger for account ${bankAccount.accountNumber}`,
    isActive: true,
    publishedAt: settings?.coaPublishedAt ? new Date() : null,
    publishedBy: settings?.coaPublishedAt ? userId : null,
    createdBy: userId,
    updatedBy: userId,
  });
};

export const listBanks = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status).toLowerCase();
    if (req.query.bankType && req.query.bankType !== "all") filter.bankType = clean(req.query.bankType).toLowerCase();
    if (req.query.country) filter.country = clean(req.query.country);
    const rx = textRegex(req.query.q);
    if (rx) filter.$or = [{ bankName: rx }, { shortName: rx }, { country: rx }, { swiftCode: rx }];

    const banks = await Bank.find(filter)
      .sort({ status: 1, bankNameLower: 1, _id: 1 })
      .limit(limit)
      .lean();

    return res.json({ count: banks.length, banks });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load banks.", error: error.message });
  }
};

export const createBank = async (req, res) => {
  try {
    const payload = buildBankPayload(req.body, req.user?._id || null);
    if (!payload.bankName) return res.status(400).json({ message: "Bank name is required." });
    if (!payload.shortName) return res.status(400).json({ message: "Short name is required." });
    const bank = await Bank.create({ ...payload, createdBy: req.user?._id || null });
    return res.status(201).json({ message: "Bank created.", bank });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "A bank with this short name already exists." : "Failed to create bank.",
      error: error.message,
    });
  }
};

export const updateBank = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank ID." });
    const bank = await Bank.findByIdAndUpdate(
      req.params.id,
      buildBankPayload(req.body, req.user?._id || null),
      { new: true, runValidators: true }
    );
    if (!bank) return res.status(404).json({ message: "Bank not found." });
    return res.json({ message: "Bank updated.", bank });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "A bank with this short name already exists." : "Failed to update bank.",
      error: error.message,
    });
  }
};

export const deleteBank = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank ID." });
    const linkedAccounts = await BankAccount.exists({ bank: req.params.id });
    if (linkedAccounts) return res.status(409).json({ message: "This bank has accounts. Delete or move those accounts first." });
    const bank = await Bank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ message: "Bank not found." });
    return res.json({ message: "Bank deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete bank.", error: error.message });
  }
};

export const listBankAccounts = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const filter = {};
    if (isId(req.query.bank)) filter.bank = req.query.bank;
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status).toLowerCase();
    if (req.query.accountType && req.query.accountType !== "all") filter.accountType = clean(req.query.accountType).toLowerCase();
    if (req.query.currency && req.query.currency !== "all") filter.currency = clean(req.query.currency).toUpperCase();
    const rx = textRegex(req.query.q);
    if (rx) {
      filter.$or = [
        { accountName: rx },
        { accountNumber: rx },
        { branchName: rx },
        { routingNumber: rx },
        { swiftCode: rx },
        { currency: rx },
      ];
    }

    const accounts = await BankAccount.find(filter)
      .populate("bank", "bankName shortName bankType country status")
      .populate("ledgerAccount", "code name type currency isActive publishedAt")
      .sort({ status: 1, accountNameLower: 1, _id: 1 })
      .limit(limit)
      .lean();

    return res.json({ count: accounts.length, accounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load bank accounts.", error: error.message });
  }
};

export const createBankAccount = async (req, res) => {
  try {
    const payload = buildBankAccountPayload(req.body, req.user?._id || null);
    payload.currency = payload.currency || "BDT";
    if (!isId(payload.bank)) return res.status(400).json({ message: "Select bank is required." });
    if (!payload.accountName) return res.status(400).json({ message: "Account name is required." });
    if (!payload.accountNumber) return res.status(400).json({ message: "Account number is required." });
    if (!payload.accountType) return res.status(400).json({ message: "Account type is required." });
    if (!Number.isFinite(payload.openingBalance)) return res.status(400).json({ message: "Opening balance is required." });
    if (!payload.status) return res.status(400).json({ message: "Status is required." });

    const bank = await Bank.findById(payload.bank).select("bankName shortName status").lean();
    if (!bank) return res.status(404).json({ message: "Selected bank was not found." });

    let ledger = null;
    if (payload.ledgerAccount) {
      ledger = await validateLedgerAccount(payload.ledgerAccount, null, payload.currency);
      if (!ledger) return res.status(400).json({ message: "Select an active, unlinked asset or liability ledger in the same currency." });
    }

    const account = await BankAccount.create({ ...payload, ...(ledger ? { ledgerAccount: ledger._id } : {}), createdBy: req.user?._id || null });
    if (!ledger) {
      try {
        ledger = await createBankLedgerAccount({ bankAccount: account, bank, userId: req.user?._id || null });
        account.ledgerAccount = ledger._id;
        await account.save();
      } catch (ledgerError) {
        await account.deleteOne();
        throw ledgerError;
      }
    }
    const populated = await account.populate([
      { path: "bank", select: "bankName shortName bankType country status" },
      { path: "ledgerAccount", select: "code name type currency isActive publishedAt" },
    ]);
    return res.status(201).json({ message: "Bank account created and connected to accounting.", account: populated });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "This account number already exists under the selected bank." : "Failed to create bank account.",
      error: error.message,
    });
  }
};

export const updateBankAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank account ID." });
    const payload = buildBankAccountPayload(req.body, req.user?._id || null);
    const current = await BankAccount.findById(req.params.id).select("ledgerAccount currency openingBalance").lean();
    if (!current) return res.status(404).json({ message: "Bank account not found." });
    if (payload.bank !== undefined && !isId(payload.bank)) return res.status(400).json({ message: "Select bank is required." });
    if (payload.openingBalance !== undefined && !Number.isFinite(payload.openingBalance)) {
      return res.status(400).json({ message: "Opening balance is required." });
    }
    if (payload.bank) {
      const bank = await Bank.exists({ _id: payload.bank });
      if (!bank) return res.status(404).json({ message: "Selected bank was not found." });
    }

    const [hasTransactions, hasAccountingHistory] = await Promise.all([
      BankTransaction.exists({ bankAccount: req.params.id }),
      current.ledgerAccount ? JournalEntry.exists({ "lines.account": current.ledgerAccount }) : null,
    ]);
    const hasHistory = Boolean(hasTransactions || hasAccountingHistory);
    if (hasHistory && payload.currency && payload.currency !== current.currency) {
      return res.status(409).json({ message: "Currency cannot be changed after banking or accounting entries exist." });
    }
    if (hasHistory && payload.openingBalance !== undefined && Number(payload.openingBalance) !== Number(current.openingBalance)) {
      return res.status(409).json({ message: "Opening balance cannot be changed after banking or accounting entries exist. Post an adjustment instead." });
    }

    if (payload.ledgerAccount !== undefined) {
      if (!payload.ledgerAccount) return res.status(400).json({ message: "A linked accounting ledger is required." });
      const ledger = await validateLedgerAccount(payload.ledgerAccount, req.params.id, payload.currency || current.currency);
      if (!ledger) return res.status(400).json({ message: "Select an active, unlinked asset or liability ledger in the same currency." });
      if (hasHistory && String(current?.ledgerAccount || "") !== String(ledger._id)) {
        return res.status(409).json({ message: "The accounting ledger cannot be changed after banking or accounting entries exist." });
      }
      payload.ledgerAccount = ledger._id;
    }

    const account = await BankAccount.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .populate("bank", "bankName shortName bankType country status")
      .populate("ledgerAccount", "code name type currency isActive publishedAt");
    if (!account) return res.status(404).json({ message: "Bank account not found." });
    return res.json({ message: "Bank account updated.", account });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : 500).json({
      message: duplicate ? "This account number already exists under the selected bank." : "Failed to update bank account.",
      error: error.message,
    });
  }
};

export const deleteBankAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank account ID." });
    const current = await BankAccount.findById(req.params.id).select("ledgerAccount").lean();
    if (!current) return res.status(404).json({ message: "Bank account not found." });
    if (await BankTransaction.exists({ $or: [{ bankAccount: req.params.id }, { counterpartyAccount: req.params.id }] })) {
      return res.status(409).json({ message: "Bank accounts with transaction history cannot be deleted. Set the account inactive instead." });
    }
    if (await Payroll.exists({ bankAccount: req.params.id })) {
      return res.status(409).json({ message: "This bank account is referenced by payroll payments and cannot be deleted." });
    }
    if (current.ledgerAccount && await JournalEntry.exists({ "lines.account": current.ledgerAccount })) {
      return res.status(409).json({ message: "This bank account has accounting history and cannot be deleted. Set it inactive instead." });
    }
    const account = await BankAccount.findByIdAndDelete(req.params.id);
    return res.json({ message: "Bank account deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete bank account.", error: error.message });
  }
};

export const connectBankAccountLedgers = async (req, res) => {
  try {
    const accounts = await BankAccount.find({ ledgerAccount: null }).populate("bank", "bankName shortName status");
    const connected = [];
    for (const bankAccount of accounts) {
      const ledger = await createBankLedgerAccount({ bankAccount, bank: bankAccount.bank, userId: req.user?._id || null });
      bankAccount.ledgerAccount = ledger._id;
      bankAccount.updatedBy = req.user?._id || null;
      await bankAccount.save();
      connected.push({ bankAccount: bankAccount._id, ledgerAccount: ledger._id });
    }
    return res.json({ message: `${connected.length} bank account(s) connected to the Chart of Accounts.`, connected });
  } catch (error) {
    return res.status(500).json({ message: "Failed to connect bank accounts to accounting.", error: error.message });
  }
};
