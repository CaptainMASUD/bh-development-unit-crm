import mongoose from "mongoose";
import Bank from "../models/bank.model.js";
import BankAccount from "../models/bankAccount.model.js";
import BankTransaction from "../models/bankTransaction.model.js";
import Account from "../models/account.model.js";
import AccountingSettings from "../models/accountingSettings.model.js";
import Payroll from "../models/payroll.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import { createPostedJournal, movementLines, parsePostingDate } from "../services/accountingPosting.service.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const money = (value) => Math.round(Number(value || 0) * 100) / 100;

let transactionSupport;
const supportsTransactions = async () => {
  if (transactionSupport !== undefined) return transactionSupport;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(hello?.setName || hello?.msg === "isdbgrid");
  } catch {
    transactionSupport = false;
  }
  return transactionSupport;
};

const runBankWrite = async (work) => {
  if (!(await supportsTransactions())) return work(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
};

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
  if (body.openingBalanceDate !== undefined) payload.openingBalanceDate = parsePostingDate(body.openingBalanceDate, null);
  if (body.branchName !== undefined) payload.branchName = clean(body.branchName);
  if (body.routingNumber !== undefined) payload.routingNumber = clean(body.routingNumber);
  if (body.swiftCode !== undefined) payload.swiftCode = clean(body.swiftCode).toUpperCase();
  if (body.currency !== undefined) payload.currency = clean(body.currency || "BDT").toUpperCase();
  if (body.description !== undefined) payload.description = clean(body.description);
  if (body.signatories !== undefined) payload.signatories = Array.isArray(body.signatories) ? body.signatories.filter(isId) : [];
  if (body.status !== undefined) payload.status = clean(body.status || "active").toLowerCase();
  if (userId) payload.updatedBy = userId;
  return payload;
};

const validateLedgerAccount = async (ledgerAccount, excludeBankAccountId = null, expectedCurrency = "", session = null) => {
  if (!isId(ledgerAccount)) return null;
  const ledgerQuery = Account.findOne({ _id: ledgerAccount, isActive: true, isGroup: { $ne: true }, type: { $in: ["asset", "liability"] } });
  if (session) ledgerQuery.session(session);
  const ledger = await ledgerQuery;
  if (!ledger) return null;
  if (expectedCurrency && ledger.currency && String(ledger.currency).toUpperCase() !== String(expectedCurrency).toUpperCase()) return null;
  const linkedQuery = BankAccount.exists({ ledgerAccount: ledger._id, ...(excludeBankAccountId ? { _id: { $ne: excludeBankAccountId } } : {}) });
  if (session) linkedQuery.session(session);
  const linked = await linkedQuery;
  return linked ? null : ledger;
};

const createBankLedgerAccount = async ({ bankAccount, bank, userId, session = null }) => {
  const liability = ["loan", "credit_card"].includes(bankAccount.accountType);
  const settingsQuery = AccountingSettings.findOne({ key: "company" }).select("coaPublishedAt");
  if (session) settingsQuery.session(session);
  const settings = await settingsQuery.lean();
  const ledger = new Account({
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
  await ledger.save(session ? { session } : undefined);
  return ledger;
};

const postBankOpeningBalance = async ({ bankAccount, ledger, userId, session = null }) => {
  const amount = Number(bankAccount.openingBalance || 0);
  if (amount <= 0 || bankAccount.openingJournalEntry) return null;
  const equityQuery = Account.findOne({ code: "3100", type: "equity", isActive: true, isGroup: { $ne: true } });
  if (session) equityQuery.session(session);
  const openingEquity = await equityQuery;
  if (!openingEquity) {
    throw Object.assign(new Error("Opening Balance Equity (3100) is missing. Bootstrap the Chart of Accounts before entering a bank opening balance."), { statusCode: 409 });
  }
  const date = parsePostingDate(bankAccount.openingBalanceDate || bankAccount.createdAt);
  const journal = await createPostedJournal({
    date,
    sourceType: "opening_balance",
    sourceId: bankAccount._id,
    reference: `BANK-OPEN-${String(bankAccount._id).slice(-8).toUpperCase()}`,
    memo: `Opening balance for ${bankAccount.accountName}`,
    currency: bankAccount.currency,
    voucherType: "opening",
    origin: "system",
    userId,
    session,
    lines: movementLines({
      bankLedger: ledger,
      counterpartLedger: openingEquity,
      direction: "in",
      amount,
      description: `Bank opening balance - ${bankAccount.accountName}`,
    }),
  });
  bankAccount.openingBalanceDate = date;
  bankAccount.openingJournalEntry = journal._id;
  await bankAccount.save(session ? { session } : undefined);
  return journal;
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
      .populate("openingJournalEntry", "entryNo date status")
      .populate("signatories", "name email")
      .sort({ status: 1, accountNameLower: 1, _id: 1 })
      .limit(limit)
      .lean();
    const accountIds = accounts.map((account) => account._id);
    const ledgerIds = accounts.map((account) => account.ledgerAccount?._id).filter(Boolean);
    const [bankingHistory, accountingHistory, ledgerBalances] = await Promise.all([
      BankTransaction.distinct("bankAccount", { bankAccount: { $in: accountIds } }),
      JournalEntry.distinct("lines.account", { "lines.account": { $in: ledgerIds } }),
      ledgerIds.length ? JournalEntry.aggregate([
        { $match: { status: { $in: ["posted", "reversed"] }, "lines.account": { $in: ledgerIds } } },
        { $unwind: "$lines" }, { $match: { "lines.account": { $in: ledgerIds } } },
        { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
      ]) : [],
    ]);
    const bankingSet = new Set(bankingHistory.map(String));
    const accountingSet = new Set(accountingHistory.map(String));
    const balanceMap = new Map(ledgerBalances.map((row) => [String(row._id), row]));
    const enriched = accounts.map((account) => {
      const balance = balanceMap.get(String(account.ledgerAccount?._id || ""));
      const normalCredit = account.ledgerAccount?.type === "liability";
      const currentBookBalance = money(normalCredit ? Number(balance?.credit || 0) - Number(balance?.debit || 0) : Number(balance?.debit || 0) - Number(balance?.credit || 0));
      return {
        ...account, currentBookBalance,
        hasHistory: bankingSet.has(String(account._id)) || accountingSet.has(String(account.ledgerAccount?._id || "")),
        needsOpeningSync: Number(account.openingBalance || 0) > 0 && !account.openingJournalEntry,
      };
    });

    return res.json({ count: enriched.length, accounts: enriched });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load bank accounts.", error: error.message });
  }
};

export const listBankLedgerOptions = async (req, res) => {
  try {
    const currency = clean(req.query.currency).toUpperCase();
    const bankAccountId = isId(req.query.bankAccount) ? req.query.bankAccount : null;
    const linked = await BankAccount.find({ ...(bankAccountId ? { _id: { $ne: bankAccountId } } : {}), ledgerAccount: { $ne: null } }).distinct("ledgerAccount");
    const filter = {
      isActive: true,
      isGroup: { $ne: true },
      type: { $in: ["asset", "liability"] },
      _id: { $nin: linked },
      ...(currency ? { $or: [{ currency }, { currency: "" }, { currency: null }] } : {}),
    };
    const settings = await AccountingSettings.findOne({ key: "company" }).select("coaPublishedAt").lean();
    if (settings?.coaPublishedAt) filter.publishedAt = { $ne: null };
    const accounts = await Account.find(filter).select("code name type currency isActive publishedAt").sort({ code: 1, name: 1 }).limit(300).lean();
    return res.json({ accounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load eligible accounting ledgers.", error: error.message });
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
    if (payload.openingBalance > 0 && req.body.openingBalanceDate && !payload.openingBalanceDate) return res.status(400).json({ message: "Valid opening balance date is required." });
    if (!payload.status) return res.status(400).json({ message: "Status is required." });

    const bank = await Bank.findById(payload.bank).select("bankName shortName status").lean();
    if (!bank) return res.status(404).json({ message: "Selected bank was not found." });

    let account;
    await runBankWrite(async (session) => {
      let ledger = null;
      if (payload.ledgerAccount) {
        ledger = await validateLedgerAccount(payload.ledgerAccount, null, payload.currency, session);
        if (!ledger) throw Object.assign(new Error("Select an active, unlinked asset or liability ledger in the same currency."), { statusCode: 400 });
      }
      account = new BankAccount({ ...payload, openingBalanceDate: payload.openingBalanceDate || (payload.openingBalance > 0 ? new Date() : null), ...(ledger ? { ledgerAccount: ledger._id } : {}), createdBy: req.user?._id || null });
      await account.save({ session });
      if (!ledger) {
        ledger = await createBankLedgerAccount({ bankAccount: account, bank, userId: req.user?._id || null, session });
        account.ledgerAccount = ledger._id;
        await account.save({ session });
      }
      await postBankOpeningBalance({ bankAccount: account, ledger, userId: req.user?._id || null, session });
    });
    const populated = await account.populate([
      { path: "bank", select: "bankName shortName bankType country status" },
      { path: "ledgerAccount", select: "code name type currency isActive publishedAt" },
      { path: "openingJournalEntry", select: "entryNo date status" },
    ]);
    return res.status(201).json({ message: payload.openingBalance > 0 ? "Bank account created; opening balance posted to accounting." : "Bank account created and connected to accounting.", account: populated });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : error?.statusCode || 500).json({
      message: duplicate ? "This account number already exists under the selected bank." : error?.statusCode ? error.message : "Failed to create bank account.",
      error: error.message,
    });
  }
};

export const updateBankAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid bank account ID." });
    const payload = buildBankAccountPayload(req.body, req.user?._id || null);
    const current = await BankAccount.findById(req.params.id).select("ledgerAccount currency openingBalance openingBalanceDate openingJournalEntry createdAt").lean();
    if (!current) return res.status(404).json({ message: "Bank account not found." });
    if (payload.bank !== undefined && !isId(payload.bank)) return res.status(400).json({ message: "Select bank is required." });
    if (payload.openingBalance !== undefined && !Number.isFinite(payload.openingBalance)) {
      return res.status(400).json({ message: "Opening balance is required." });
    }
    if (payload.openingBalance > 0 && req.body.openingBalanceDate && !payload.openingBalanceDate) return res.status(400).json({ message: "Valid opening balance date is required." });
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

    await runBankWrite(async (session) => {
      const updated = await BankAccount.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true, ...(session ? { session } : {}) });
      if (!updated) throw Object.assign(new Error("Bank account not found."), { statusCode: 404 });
      if (!hasHistory && Number(updated.openingBalance || 0) > 0 && !updated.openingJournalEntry) {
        const ledgerQuery = Account.findById(updated.ledgerAccount);
        if (session) ledgerQuery.session(session);
        const ledger = await ledgerQuery;
        if (!ledger) throw Object.assign(new Error("Connect this bank account to an accounting ledger first."), { statusCode: 409 });
        await postBankOpeningBalance({ bankAccount: updated, ledger, userId: req.user?._id || null, session });
      }
    });
    const account = await BankAccount.findById(req.params.id)
      .populate("bank", "bankName shortName bankType country status")
      .populate("ledgerAccount", "code name type currency isActive publishedAt")
      .populate("openingJournalEntry", "entryNo date status");
    return res.json({ message: "Bank account updated.", account });
  } catch (error) {
    const duplicate = error?.code === 11000;
    return res.status(duplicate ? 409 : error?.statusCode || 500).json({
      message: duplicate ? "This account number already exists under the selected bank." : error?.statusCode ? error.message : "Failed to update bank account.",
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
    const accounts = await BankAccount.find({ $or: [{ ledgerAccount: null }, { openingBalance: { $gt: 0 }, openingJournalEntry: null }] }).populate("bank", "bankName shortName status");
    const connected = [];
    const failed = [];
    for (const bankAccount of accounts) {
      try {
        let ledger;
        await runBankWrite(async (session) => {
          ledger = bankAccount.ledgerAccount
            ? await (() => { const query = Account.findById(bankAccount.ledgerAccount); if (session) query.session(session); return query; })()
            : await createBankLedgerAccount({ bankAccount, bank: bankAccount.bank, userId: req.user?._id || null, session });
          if (!ledger) throw Object.assign(new Error("Connected accounting ledger was not found."), { statusCode: 409 });
          bankAccount.ledgerAccount = ledger._id;
          bankAccount.updatedBy = req.user?._id || null;
          await bankAccount.save({ session });
          await postBankOpeningBalance({ bankAccount, ledger, userId: req.user?._id || null, session });
        });
        connected.push({ bankAccount: bankAccount._id, ledgerAccount: ledger._id, openingJournalEntry: bankAccount.openingJournalEntry || null });
      } catch (error) {
        failed.push({ bankAccount: bankAccount._id, name: bankAccount.accountName, message: error.message });
      }
    }
    return res.json({ message: `${connected.length} bank account(s) connected/synchronized.${failed.length ? ` ${failed.length} require attention.` : ""}`, connected, failed });
  } catch (error) {
    return res.status(500).json({ message: "Failed to connect bank accounts to accounting.", error: error.message });
  }
};
