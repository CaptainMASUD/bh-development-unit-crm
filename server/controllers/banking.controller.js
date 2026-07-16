import mongoose from "mongoose";
import BankAccount from "../models/bankAccount.model.js";
import BankTransaction from "../models/bankTransaction.model.js";
import BankReconciliation from "../models/bankReconciliation.model.js";
import Account from "../models/account.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import { createPostedJournal, movementLines, resolveAccountingAccount } from "../services/accountingPosting.service.js";
import { accountingCache } from "../utils/cache.js";

const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const parseLimit = (value, fallback = 50) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), 150);
};

const textRegex = (value) => {
  const q = clean(value);
  if (!q) return null;
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
};

const encodeCursor = (item) => {
  if (!item) return null;
  return Buffer.from(`${new Date(item.transactionDate).toISOString()}|${item._id}`).toString("base64url");
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const [date, id] = Buffer.from(String(cursor), "base64url").toString("utf8").split("|");
    if (!date || !isId(id)) return null;
    return { date: new Date(date), id: new mongoose.Types.ObjectId(id) };
  } catch {
    return null;
  }
};

const postedBalancePipeline = (bankAccount, to = null) => {
  const match = { bankAccount: new mongoose.Types.ObjectId(bankAccount), status: "posted" };
  if (to) match.transactionDate = { $lte: new Date(to) };
  return [
    { $match: match },
    {
      $group: {
        _id: null,
        inflow: { $sum: { $cond: [{ $eq: ["$direction", "in"] }, "$amount", 0] } },
        outflow: { $sum: { $cond: [{ $eq: ["$direction", "out"] }, "$amount", 0] } },
      },
    },
  ];
};

const getBookBalance = async (bankAccount, to = null) => {
  const [[row], account] = await Promise.all([
    BankTransaction.aggregate(postedBalancePipeline(bankAccount, to)),
    BankAccount.findById(bankAccount).select("openingBalance").lean(),
  ]);
  return money((account?.openingBalance || 0) + (row?.inflow || 0) - (row?.outflow || 0));
};

const ensureBankAccount = async (id) => {
  if (!isId(id)) return null;
  return BankAccount.findOne({ _id: id, status: "active" })
    .select("_id accountName accountNumber bank currency status ledgerAccount accountType")
    .populate("ledgerAccount", "code name type currency isActive isGroup publishedAt")
    .lean();
};

const ensureCounterpartLedger = async (id, kind) => {
  if (isId(id)) return Account.findOne({ _id: id, isActive: true, isGroup: { $ne: true } }).lean();
  if (kind === "opening_balance") return resolveAccountingAccount("retainedEarningsAccount", "3100");
  if (kind === "bank_charge") return resolveAccountingAccount("purchaseAccount", "5000");
  if (kind === "interest") return resolveAccountingAccount("salesAccount", "4000");
  return null;
};

const populateTransaction = (query) => query
  .populate({ path: "bankAccount", select: "accountName accountNumber currency bank ledgerAccount", populate: [{ path: "bank", select: "bankName shortName" }, { path: "ledgerAccount", select: "code name type" }] })
  .populate({ path: "counterpartyAccount", select: "accountName accountNumber" })
  .populate({ path: "counterpartLedgerAccount", select: "code name type" })
  .populate({ path: "journalEntry", select: "entryNo status date" });

const postBankTransactionJournal = async (transaction, bankAccount, counterpartLedger, userId, session) => {
  if (!bankAccount?.ledgerAccount?._id) throw Object.assign(new Error("The selected bank account is not connected to the Chart of Accounts."), { statusCode: 409 });
  return createPostedJournal({
    date: transaction.transactionDate,
    sourceType: transaction.sourceType === "opening_balance" ? "opening_balance" : "manual",
    sourceId: transaction._id,
    reference: transaction.reference,
    memo: transaction.description || `${transaction.kind} for ${bankAccount.accountName}`,
    currency: bankAccount.currency,
    userId,
    session,
    lines: movementLines({
      bankLedger: bankAccount.ledgerAccount,
      counterpartLedger,
      direction: transaction.direction,
      amount: transaction.amount,
      description: transaction.description,
    }),
  });
};

export const getBankingSummary = async (req, res) => {
  try {
    const accountMatch = {};
    if (req.query.status && req.query.status !== "all") accountMatch.status = clean(req.query.status).toLowerCase();
    const [accounts, openingRows] = await Promise.all([
      BankAccount.countDocuments(accountMatch),
      BankAccount.aggregate([{ $match: accountMatch }, { $group: { _id: null, total: { $sum: "$openingBalance" } } }]),
    ]);
    const posted = await BankTransaction.aggregate([
      { $match: { status: "posted" } },
      {
        $group: {
          _id: "$direction",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);
    const inflow = posted.find((row) => row._id === "in")?.total || 0;
    const outflow = posted.find((row) => row._id === "out")?.total || 0;
    const unreconciled = await BankTransaction.countDocuments({ status: "posted", reconciled: false });
    const openingBalance = openingRows[0]?.total || 0;
    return res.json({ accounts, openingBalance: money(openingBalance), inflow: money(inflow), outflow: money(outflow), balance: money(openingBalance + inflow - outflow), unreconciled });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load banking summary.", error: error.message });
  }
};

export const listBankTransactions = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const filter = {};
    if (isId(req.query.bankAccount)) filter.bankAccount = req.query.bankAccount;
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status).toLowerCase();
    if (req.query.kind && req.query.kind !== "all") filter.kind = clean(req.query.kind).toLowerCase();
    if (req.query.sourceType && req.query.sourceType !== "all") filter.sourceType = clean(req.query.sourceType).toLowerCase();
    if (req.query.direction && req.query.direction !== "all") filter.direction = clean(req.query.direction).toLowerCase();
    if (req.query.reconciled === "true") filter.reconciled = true;
    if (req.query.reconciled === "false") filter.reconciled = false;
    if (req.query.from || req.query.to) {
      filter.transactionDate = {};
      if (req.query.from) filter.transactionDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.transactionDate.$lte = new Date(req.query.to);
    }
    const rx = textRegex(req.query.q);
    if (rx) filter.$or = [{ reference: rx }, { description: rx }];

    const cursor = decodeCursor(req.query.cursor);
    if (cursor) {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { transactionDate: { $lt: cursor.date } },
            { transactionDate: cursor.date, _id: { $lt: cursor.id } },
          ],
        },
      ];
    }

    const rows = await populateTransaction(BankTransaction.find(filter))
      .sort({ transactionDate: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const transactions = hasMore ? rows.slice(0, limit) : rows;
    return res.json({ transactions, nextCursor: hasMore ? encodeCursor(transactions[transactions.length - 1]) : null });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load bank transactions.", error: error.message });
  }
};

export const createBankTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const bankAccount = await ensureBankAccount(req.body.bankAccount);
    if (!bankAccount) return res.status(400).json({ message: "Valid bank account is required." });
    const amount = money(req.body.amount);
    if (amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero." });
    const kind = clean(req.body.kind || "deposit").toLowerCase();
    const direction = clean(req.body.direction || "").toLowerCase() || (["deposit", "opening_balance", "interest"].includes(kind) ? "in" : "out");
    const status = clean(req.body.status || "posted").toLowerCase();
    if (!["draft", "posted"].includes(status)) return res.status(400).json({ message: "New bank transactions must be draft or posted." });
    const counterpartLedger = await ensureCounterpartLedger(req.body.counterpartLedgerAccount, kind);
    if (status === "posted" && !counterpartLedger) return res.status(400).json({ message: "Select the offset accounting ledger for this transaction." });
    if (counterpartLedger && String(counterpartLedger._id) === String(bankAccount.ledgerAccount?._id || "")) {
      return res.status(400).json({ message: "Bank ledger and offset ledger must be different accounts." });
    }
    const transaction = new BankTransaction({
      bankAccount: bankAccount._id,
      kind,
      direction,
      amount,
      transactionDate: req.body.transactionDate || new Date(),
      reference: clean(req.body.reference),
      description: clean(req.body.description),
      status,
      sourceType: kind === "opening_balance" ? "opening_balance" : "manual",
      counterpartLedgerAccount: counterpartLedger?._id || null,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    });
    await session.withTransaction(async () => {
      if (status === "posted") {
        const journal = await postBankTransactionJournal(transaction, bankAccount, counterpartLedger, req.user?._id || null, session);
        transaction.journalEntry = journal._id;
      }
      await transaction.save({ session });
    });
    const populated = await populateTransaction(BankTransaction.findById(transaction._id));
    return res.status(201).json({ message: status === "posted" ? "Bank transaction posted to banking and accounting." : "Bank transaction saved as draft.", transaction: populated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to create bank transaction.", error: error.message });
  } finally {
    session.endSession();
  }
};

export const updateBankTransaction = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
    const existing = await BankTransaction.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Bank transaction not found." });
    if (existing.reconciled) return res.status(409).json({ message: "Reconciled transactions cannot be edited." });
    if (existing.journalEntry) return res.status(409).json({ message: "Posted accounting transactions are immutable. Void the transaction instead." });
    const patch = {};
    for (const key of ["kind", "direction", "reference", "description", "status"]) {
      if (req.body[key] !== undefined) patch[key] = clean(req.body[key]).toLowerCase();
    }
    if (req.body.reference !== undefined) patch.reference = clean(req.body.reference);
    if (req.body.description !== undefined) patch.description = clean(req.body.description);
    if (req.body.amount !== undefined) patch.amount = money(req.body.amount);
    if (req.body.transactionDate !== undefined) patch.transactionDate = req.body.transactionDate;
    if (req.body.bankAccount !== undefined) {
      const account = await ensureBankAccount(req.body.bankAccount);
      if (!account) return res.status(400).json({ message: "Valid bank account is required." });
      patch.bankAccount = account._id;
    }
    if (req.body.counterpartLedgerAccount !== undefined) {
      const counterpart = await ensureCounterpartLedger(req.body.counterpartLedgerAccount, patch.kind || existing.kind);
      if (!counterpart) return res.status(400).json({ message: "Select a valid offset accounting ledger." });
      patch.counterpartLedgerAccount = counterpart._id;
    }
    if (patch.status && patch.status !== "draft") return res.status(409).json({ message: "Use the dedicated post or void action to change transaction status." });
    patch.updatedBy = req.user?._id || null;
    const transaction = await populateTransaction(BankTransaction.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true }));
    return res.json({ message: "Bank transaction updated.", transaction });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update bank transaction.", error: error.message });
  }
};

export const deleteBankTransaction = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
    const transaction = await BankTransaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: "Bank transaction not found." });
    if (transaction.reconciled) return res.status(409).json({ message: "Reconciled transactions cannot be deleted." });
    if (transaction.journalEntry) return res.status(409).json({ message: "Posted accounting transactions cannot be deleted. Void the transaction instead." });
    await transaction.deleteOne();
    return res.json({ message: "Bank transaction deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete bank transaction.", error: error.message });
  }
};

export const voidBankTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
    let transaction;
    await session.withTransaction(async () => {
      transaction = await BankTransaction.findById(req.params.id).session(session);
      if (!transaction) throw Object.assign(new Error("Bank transaction not found."), { statusCode: 404 });
      if (transaction.reconciled) throw Object.assign(new Error("Reconciled transactions cannot be voided."), { statusCode: 409 });
      if (transaction.status !== "posted") throw Object.assign(new Error("Only posted transactions can be voided."), { statusCode: 409 });
      transaction.status = "void";
      transaction.updatedBy = req.user?._id || null;
      await transaction.save({ session });
      if (transaction.journalEntry) {
        await JournalEntry.updateOne(
          { _id: transaction.journalEntry, status: "posted" },
          { $set: { status: "void", voidedAt: new Date(), voidReason: clean(req.body.reason) || "Bank transaction voided", voidedBy: req.user?._id || null } },
          { session }
        );
      }
    });
    accountingCache.flushAll();
    const populated = await populateTransaction(BankTransaction.findById(transaction._id));
    return res.json({ message: "Bank transaction and accounting journal voided.", transaction: populated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to void bank transaction.", error: error.message });
  } finally {
    session.endSession();
  }
};

export const postDraftBankTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
    let transaction;
    await session.withTransaction(async () => {
      transaction = await BankTransaction.findById(req.params.id).session(session);
      if (!transaction) throw Object.assign(new Error("Bank transaction not found."), { statusCode: 404 });
      if (transaction.status !== "draft") throw Object.assign(new Error("Only draft bank transactions can be posted."), { statusCode: 409 });
      const bankAccount = await ensureBankAccount(transaction.bankAccount);
      const counterpart = await ensureCounterpartLedger(transaction.counterpartLedgerAccount, transaction.kind);
      if (!bankAccount?.ledgerAccount?._id || !counterpart) throw Object.assign(new Error("Connect the bank account and select an offset ledger before posting."), { statusCode: 409 });
      if (String(bankAccount.ledgerAccount._id) === String(counterpart._id)) {
        throw Object.assign(new Error("Bank ledger and offset ledger must be different accounts."), { statusCode: 400 });
      }
      const journal = await postBankTransactionJournal(transaction, bankAccount, counterpart, req.user?._id || null, session);
      transaction.status = "posted";
      transaction.journalEntry = journal._id;
      transaction.updatedBy = req.user?._id || null;
      await transaction.save({ session });
    });
    const populated = await populateTransaction(BankTransaction.findById(transaction._id));
    return res.json({ message: "Bank transaction posted to accounting.", transaction: populated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to post bank transaction.", error: error.message });
  } finally {
    session.endSession();
  }
};

export const createMoneyTransfer = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const from = await ensureBankAccount(req.body.fromAccount);
    const to = await ensureBankAccount(req.body.toAccount);
    if (!from || !to) return res.status(400).json({ message: "Valid from and to accounts are required." });
    if (!from.ledgerAccount?._id || !to.ledgerAccount?._id) return res.status(409).json({ message: "Both bank accounts must be connected to accounting ledgers." });
    if (String(from.currency) !== String(to.currency)) return res.status(409).json({ message: "Cross-currency transfers require an exchange-rate journal and are not supported by this form." });
    if (String(from._id) === String(to._id)) return res.status(400).json({ message: "From and to accounts must be different." });
    const amount = money(req.body.amount);
    if (amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero." });

    const transferGroupId = `TRF-${Date.now()}-${String(from._id).slice(-4)}${String(to._id).slice(-4)}`.toUpperCase();
    const transactionDate = req.body.transferDate || new Date();
    const reference = clean(req.body.reference) || transferGroupId;
    const description = clean(req.body.description);
    let rows = [];

    await session.withTransaction(async () => {
      const documents = [new BankTransaction({
          bankAccount: from._id,
          kind: "transfer_out",
          direction: "out",
          amount,
          transactionDate,
          reference,
          description,
          status: "posted",
          transferGroupId,
          counterpartyAccount: to._id,
          sourceType: "money_transfer",
          createdBy: req.user?._id || null,
          updatedBy: req.user?._id || null,
        }), new BankTransaction({
          bankAccount: to._id,
          kind: "transfer_in",
          direction: "in",
          amount,
          transactionDate,
          reference,
          description,
          status: "posted",
          transferGroupId,
          counterpartyAccount: from._id,
          sourceType: "money_transfer",
          createdBy: req.user?._id || null,
          updatedBy: req.user?._id || null,
        })];
      const journal = await createPostedJournal({
        date: transactionDate,
        sourceType: "bank_transfer",
        sourceId: documents[0]._id,
        reference,
        memo: description || `Transfer from ${from.accountName} to ${to.accountName}`,
        currency: from.currency,
        userId: req.user?._id || null,
        session,
        lines: [
          { account: to.ledgerAccount._id, debit: amount, credit: 0, description },
          { account: from.ledgerAccount._id, debit: 0, credit: amount, description },
        ],
      });
      documents.forEach((document) => { document.journalEntry = journal._id; });
      rows = await BankTransaction.insertMany(documents, { session });
    });

    return res.status(201).json({ message: "Money transfer posted.", transferGroupId, transactions: rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create money transfer.", error: error.message });
  } finally {
    session.endSession();
  }
};

export const listMoneyTransfers = async (req, res) => {
  req.query.sourceType = "money_transfer";
  req.query.kind = "transfer_out";
  return listBankTransactions(req, res);
};

export const listBankReconciliations = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const filter = {};
    if (isId(req.query.bankAccount)) filter.bankAccount = req.query.bankAccount;
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status).toLowerCase();
    const rows = await BankReconciliation.find(filter)
      .populate({ path: "bankAccount", select: "accountName accountNumber currency bank", populate: { path: "bank", select: "bankName shortName" } })
      .sort({ statementDate: -1, _id: -1 })
      .limit(limit)
      .lean();
    return res.json({ reconciliations: rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load reconciliations.", error: error.message });
  }
};

export const createBankReconciliation = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const bankAccount = await ensureBankAccount(req.body.bankAccount);
    if (!bankAccount) return res.status(400).json({ message: "Valid bank account is required." });
    const statementDate = req.body.statementDate || new Date();
    const statementBalance = money(req.body.statementBalance);
    const bookBalance = await getBookBalance(bankAccount._id, statementDate);
    const difference = money(statementBalance - bookBalance);
    const status = clean(req.body.status || (difference === 0 ? "reconciled" : "draft")).toLowerCase();
    const transactionIds = Array.isArray(req.body.transactionIds) ? req.body.transactionIds.filter(isId) : [];
    let reconciliation;

    await session.withTransaction(async () => {
      const [created] = await BankReconciliation.create([{
        bankAccount: bankAccount._id,
        statementDate,
        statementBalance,
        bookBalance,
        difference,
        status,
        notes: clean(req.body.notes),
        transactionIds,
        createdBy: req.user?._id || null,
        updatedBy: req.user?._id || null,
      }], { session });
      reconciliation = created;
      if (status === "reconciled" && transactionIds.length) {
        await BankTransaction.updateMany(
          { _id: { $in: transactionIds }, bankAccount: bankAccount._id, status: "posted", reconciled: false },
          { $set: { reconciled: true, reconciledAt: new Date(), reconciliation: created._id, updatedBy: req.user?._id || null } },
          { session }
        );
      }
    });

    const populated = await reconciliation.populate({ path: "bankAccount", select: "accountName accountNumber currency bank", populate: { path: "bank", select: "bankName shortName" } });
    return res.status(201).json({ message: "Bank reconciliation saved.", reconciliation: populated });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save reconciliation.", error: error.message });
  } finally {
    session.endSession();
  }
};
