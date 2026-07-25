import mongoose from "mongoose";
import BankAccount from "../models/bankAccount.model.js";
import BankTransaction from "../models/bankTransaction.model.js";
import BankReconciliation from "../models/bankReconciliation.model.js";
import Account from "../models/account.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import CashAccount from "../models/cashAccount.model.js";
import AccountingSettings from "../models/accountingSettings.model.js";
import Invoice from "../models/invoice.model.js";
import VendorBill from "../models/vendorBill.model.js";
import { createPostedJournal, movementLines, resolveAccountingAccount, assertOpenAccountingPeriod, assertPostableLedgerAccounts, parsePostingDate } from "../services/accountingPosting.service.js";
import { accountingCache } from "../utils/cache.js";

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

const runBankingWrite = async (work) => {
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

const withSession = (query, session) => session ? query.session(session) : query;
const sessionOptions = (session) => session ? { session } : {};

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
  const account = await BankAccount.findById(bankAccount).populate("ledgerAccount", "type").lean();
  if (!account?.ledgerAccount?._id) return 0;
  const match = { status: { $in: ["posted", "reversed"] }, "lines.account": account.ledgerAccount._id };
  if (to) match.date = { $lte: new Date(to) };
  const [row] = await JournalEntry.aggregate([
    { $match: match }, { $unwind: "$lines" }, { $match: { "lines.account": account.ledgerAccount._id } },
    { $group: { _id: null, debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
  ]);
  return money(account.ledgerAccount.type === "liability" ? Number(row?.credit || 0) - Number(row?.debit || 0) : Number(row?.debit || 0) - Number(row?.credit || 0));
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

export const listOperationalBankAccounts = async (req, res) => {
  try {
    const accounts = await BankAccount.find({ status: "active", ledgerAccount: { $ne: null } })
      .select("bank ledgerAccount accountName accountNumber accountType currency branchName status")
      .populate("bank", "bankName shortName status")
      .populate("ledgerAccount", "code name type currency isActive publishedAt")
      .sort({ accountNameLower: 1, _id: 1 })
      .limit(300)
      .lean();
    return res.json({ accounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load operational bank accounts.", error: error.message });
  }
};

const treasuryBalanceMap = async (ledgerIds) => {
  if (!ledgerIds.length) return new Map();
  const rows = await JournalEntry.aggregate([
    { $match: { status: { $in: ["posted", "reversed"] }, "lines.account": { $in: ledgerIds } } },
    { $unwind: "$lines" }, { $match: { "lines.account": { $in: ledgerIds } } },
    { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), money(row.debit - row.credit)]));
};

export const listTreasuryAccounts = async (req, res) => {
  try {
    const [cashAccounts, bankAccounts, settings] = await Promise.all([
      CashAccount.find({ type: "cash", isActive: true }).populate("account", "code name type currency isActive publishedAt").populate("custodian", "name email").sort({ nameLower: 1 }).lean(),
      BankAccount.find({ status: "active" }).populate("ledgerAccount", "code name type currency isActive publishedAt").populate("bank", "bankName shortName").sort({ accountNameLower: 1 }).lean(),
      AccountingSettings.findOne({ key: "company" }).select("defaultCashAccount").lean(),
    ]);
    const eligibleCash = cashAccounts.filter((item) => item.account?.type === "asset" && item.account?.isActive !== false);
    const eligibleBanks = bankAccounts.filter((item) => item.ledgerAccount?.type === "asset" && item.ledgerAccount?.isActive !== false);
    const ledgers = [...eligibleCash.map((item) => item.account._id), ...eligibleBanks.map((item) => item.ledgerAccount._id)];
    const balances = await treasuryBalanceMap(ledgers);
    const unlinkedBankAccounts = bankAccounts
      .filter((item) => !item.ledgerAccount?._id)
      .map((item) => ({ _id: item._id, name: item.accountName, accountNumber: item.accountNumber }));
    const defaultCashLinked = !settings?.defaultCashAccount || eligibleCash.some(
      (item) => String(item.account?._id || "") === String(settings.defaultCashAccount)
    );
    return res.json({ accounts: [
      ...eligibleCash.map((item) => ({ _id: item._id, treasuryType: "cash", name: item.name, detail: item.location || "Cash account", currency: item.currency, ledgerAccount: item.account, currentBalance: balances.get(String(item.account._id)) || 0, alert: item.minimumBalance > 0 && (balances.get(String(item.account._id)) || 0) < item.minimumBalance ? "below_minimum" : item.maximumBalance > 0 && (balances.get(String(item.account._id)) || 0) > item.maximumBalance ? "above_maximum" : "" })),
      ...eligibleBanks.map((item) => ({ _id: item._id, treasuryType: "bank", name: item.accountName, detail: `${item.bank?.shortName || item.bank?.bankName || "Bank"} · ${item.accountNumber}`, currency: item.currency, ledgerAccount: item.ledgerAccount, currentBalance: balances.get(String(item.ledgerAccount._id)) || 0, lastReconciledAt: item.lastReconciledAt, lastReconciledBalance: item.lastReconciledBalance })),
    ],
    unlinkedBankAccounts,
    unlinkedCount: unlinkedBankAccounts.length,
    defaultCashLinked,
    requiresSynchronization: unlinkedBankAccounts.length > 0 || !defaultCashLinked,
    });
  } catch (error) { return res.status(500).json({ message: "Failed to load cash and bank accounts.", error: error.message }); }
};

const resolveTreasuryAccount = async (type, id) => {
  if (!isId(id)) return null;
  if (type === "cash") {
    const cash = await CashAccount.findOne({ _id: id, type: "cash", isActive: true }).populate("account", "code name type currency isActive isGroup publishedAt").lean();
    return cash?.account?.type === "asset" ? { type: "cash", record: cash, ledger: cash.account, name: cash.name, currency: cash.currency } : null;
  }
  if (type === "bank") {
    const bank = await BankAccount.findOne({ _id: id, status: "active" }).populate("ledgerAccount", "code name type currency isActive isGroup publishedAt").lean();
    return bank?.ledgerAccount?.type === "asset" ? { type: "bank", record: bank, ledger: bank.ledgerAccount, name: bank.accountName, currency: bank.currency } : null;
  }
  return null;
};

export const listTreasuryVouchers = async (req, res) => {
  try {
    const requestedType = ["payment", "receipt", "contra"].includes(req.query.voucherType)
      ? req.query.voucherType
      : "";
    const bankTransactionFilter = { status: { $in: ["posted", "void"] }, journalEntry: { $ne: null } };
    if (requestedType === "payment") { bankTransactionFilter.direction = "out"; bankTransactionFilter.sourceType = { $ne: "money_transfer" }; }
    if (requestedType === "receipt") { bankTransactionFilter.direction = "in"; bankTransactionFilter.sourceType = { $ne: "money_transfer" }; }
    if (requestedType === "contra") bankTransactionFilter.sourceType = "money_transfer";
    const bankJournalIds = await BankTransaction.distinct("journalEntry", bankTransactionFilter);
    const voucherTypes = requestedType ? [requestedType] : ["payment", "receipt", "contra"];
    const filter = { $or: [{ voucherType: { $in: voucherTypes } }, { _id: { $in: bankJournalIds } }] };
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
    const rows = await JournalEntry.find(filter)
      .populate("cashAccount", "name currency location").populate({ path: "bankAccount", select: "accountName accountNumber bank currency", populate: { path: "bank", select: "bankName shortName" } })
      .populate("createdBy approvedBy postedBy", "name email").populate("lines.account", "code name type")
      .sort({ date: -1, _id: -1 }).limit(parseLimit(req.query.limit, 100)).lean();
    return res.json({ vouchers: rows });
  } catch (error) { return res.status(500).json({ message: "Failed to load cash and bank vouchers.", error: error.message }); }
};

export const listOpenSettlementDocuments = async (req, res) => {
  try {
    const voucherType = clean(req.query.voucherType).toLowerCase();
    if (voucherType === "receipt") {
      const invoices = await Invoice.find({ status: { $in: ["sent", "partially_paid", "overdue"] }, dueTotal: { $gt: 0 } }).select("invoiceNo customerId currency total paidTotal dueTotal issuedAt dueAt status").populate("customerId", "name companyName email").sort({ dueAt: 1, _id: 1 }).limit(200).lean();
      return res.json({ documents: invoices.map((item) => ({ _id: item._id, documentType: "invoice", number: item.invoiceNo, partyName: item.customerId?.companyName || item.customerId?.name || item.customerId?.email || "Customer", date: item.issuedAt, dueDate: item.dueAt, currency: item.currency, total: item.total, due: item.dueTotal, status: item.status })) });
    }
    if (voucherType === "payment") {
      const bills = await VendorBill.find({ status: { $in: ["approved", "partially_paid"] }, dueTotal: { $gt: 0 } }).select("billNo vendorName currency total paidTotal dueTotal billDate dueDate status").sort({ dueDate: 1, _id: 1 }).limit(200).lean();
      return res.json({ documents: bills.map((item) => ({ _id: item._id, documentType: "supplier_bill", number: item.billNo, partyName: item.vendorName, date: item.billDate, dueDate: item.dueDate, currency: item.currency, total: item.total, due: item.dueTotal, status: item.status })) });
    }
    return res.json({ documents: [] });
  } catch (error) { return res.status(500).json({ message: "Failed to load open settlement documents.", error: error.message }); }
};

export const createTreasuryVoucher = async (req, res) => {
  try {
    const voucherType = clean(req.body.voucherType).toLowerCase();
    if (!["payment", "receipt", "contra"].includes(voucherType)) return res.status(400).json({ message: "Voucher type must be Payment, Receipt, or Contra." });
    const date = parsePostingDate(req.body.date, null);
    if (!date) return res.status(400).json({ message: "Valid voucher date is required." });
    await assertOpenAccountingPeriod(date);
    let journalLines = [];
    let voucherTotal = 0;
    let primary = null;
    let secondary = null;
    if (voucherType === "contra") {
      primary = await resolveTreasuryAccount(clean(req.body.fromType), req.body.fromAccount);
      secondary = await resolveTreasuryAccount(clean(req.body.toType), req.body.toAccount);
      if (!primary || !secondary) return res.status(400).json({ message: "Contra requires valid active Cash/Bank From and To accounts." });
      if (String(primary.ledger._id) === String(secondary.ledger._id)) return res.status(400).json({ message: "Contra From and To accounts must be different." });
      if (primary.currency !== secondary.currency) return res.status(409).json({ message: "Cross-currency Contra requires an exchange-rate journal." });
      const amount = money(req.body.amount);
      if (amount <= 0) return res.status(400).json({ message: "Amount must be greater than zero." });
      journalLines = [
        { account: secondary.ledger._id, debit: amount, credit: 0, description: clean(req.body.narration || "Contra transfer in") },
        { account: primary.ledger._id, debit: 0, credit: amount, description: clean(req.body.narration || "Contra transfer out") },
      ];
      voucherTotal = amount;
    } else {
      primary = await resolveTreasuryAccount(clean(req.body.treasuryType), req.body.treasuryAccount);
      if (!primary) return res.status(400).json({ message: `Select a valid active Cash/Bank account for this ${voucherType}.` });
      const inputLines = Array.isArray(req.body.lines) ? req.body.lines : [];
      const flexible = inputLines.map((line) => ({
        account: line.account, amount: money(line.amount), description: clean(line.description),
        contactType: clean(line.contactType), contactId: isId(line.contactId) ? line.contactId : null,
        costCenter: isId(line.costCenter) ? line.costCenter : null, project: isId(line.project) ? line.project : null, taxCode: clean(line.taxCode),
      })).filter((line) => isId(line.account) && line.amount > 0);
      if (!flexible.length) return res.status(400).json({ message: "Add at least one voucher allocation line." });
      const total = money(flexible.reduce((sum, line) => sum + line.amount, 0));
      voucherTotal = total;
      journalLines = voucherType === "payment"
        ? [...flexible.map((line) => ({ ...line, debit: line.amount, credit: 0 })), { account: primary.ledger._id, debit: 0, credit: total, description: `Paid from ${primary.name}` }]
        : [{ account: primary.ledger._id, debit: total, credit: 0, description: `Received in ${primary.name}` }, ...flexible.map((line) => ({ ...line, debit: 0, credit: line.amount }))];
    }
    await assertPostableLedgerAccounts(journalLines);
    const paymentMode = clean(req.body.paymentMode).toLowerCase();
    if (paymentMode === "cheque" && !clean(req.body.chequeNo)) return res.status(400).json({ message: "Cheque number is required for cheque vouchers." });
    const linkedDocuments = Array.isArray(req.body.linkedDocuments) ? req.body.linkedDocuments.filter((item) => ["invoice", "supplier_bill", "expense"].includes(item.documentType) && isId(item.documentId) && money(item.appliedAmount) > 0).map((item) => ({ documentType: item.documentType, documentId: item.documentId, appliedAmount: money(item.appliedAmount) })) : [];
    if (voucherType === "receipt" && linkedDocuments.some((item) => item.documentType !== "invoice")) return res.status(400).json({ message: "Receive vouchers can only settle customer invoices." });
    if (voucherType === "payment" && linkedDocuments.some((item) => !["supplier_bill", "expense"].includes(item.documentType))) return res.status(400).json({ message: "Payment vouchers can only settle supplier bills or expenses." });
    if (money(linkedDocuments.reduce((sum, item) => sum + item.appliedAmount, 0)) > voucherTotal) return res.status(400).json({ message: "Document allocations cannot exceed the voucher total." });
    const entry = await JournalEntry.create({
      date, status: "draft", sourceType: "manual", voucherType, origin: "manual",
      reference: clean(req.body.reference), memo: clean(req.body.narration), currency: primary.currency,
      paymentMode, treasuryAccountType: primary.type,
      cashAccount: primary.type === "cash" ? primary.record._id : null,
      bankAccount: primary.type === "bank" ? primary.record._id : null,
      partyType: clean(req.body.partyType), partyId: isId(req.body.partyId) ? req.body.partyId : null, partyName: clean(req.body.partyName),
      chequeNo: clean(req.body.chequeNo), chequeDate: parsePostingDate(req.body.chequeDate, null), chequeStatus: paymentMode === "cheque" ? "issued" : "",
      linkedDocuments,
      lines: journalLines, createdBy: req.user?._id || null, updatedBy: req.user?._id || null,
    });
    return res.status(201).json({ message: `${voucherType[0].toUpperCase() + voucherType.slice(1)} voucher saved as draft.`, voucher: entry });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Failed to create cash/bank voucher.", error: error.message }); }
};

export const updateChequeStatus = async (req, res) => {
  try {
    const status = clean(req.body.status).toLowerCase();
    if (!["issued", "presented", "cleared", "bounced"].includes(status)) return res.status(400).json({ message: "Invalid cheque status." });
    const voucher = await JournalEntry.findOne({ _id: req.params.id, paymentMode: "cheque", voucherType: { $in: ["payment", "receipt"] } });
    if (!voucher) return res.status(404).json({ message: "Cheque voucher not found." });
    voucher.chequeStatus = status; voucher.updatedBy = req.user?._id || null; await voucher.save();
    return res.json({ message: `Cheque marked ${status}.`, voucher });
  } catch (error) { return res.status(500).json({ message: "Failed to update cheque status.", error: error.message }); }
};

const postBankTransactionJournal = async (transaction, bankAccount, counterpartLedger, userId, session) => {
  if (!bankAccount?.ledgerAccount?._id) throw Object.assign(new Error("The selected bank account is not connected to the Chart of Accounts."), { statusCode: 409 });
  return createPostedJournal({
    date: transaction.transactionDate,
    sourceType: transaction.sourceType === "opening_balance" ? "opening_balance" : "manual",
    sourceId: transaction._id,
    reference: transaction.reference,
    memo: transaction.description || `${transaction.kind} for ${bankAccount.accountName}`,
    currency: bankAccount.currency,
    voucherType: transaction.direction === "in" ? "receipt" : "payment",
    paymentMode: "bank",
    treasuryAccountType: "bank",
    bankAccount: bankAccount._id,
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
    await runBankingWrite(async (session) => {
      if (status === "posted") {
        const journal = await postBankTransactionJournal(transaction, bankAccount, counterpartLedger, req.user?._id || null, session);
        transaction.journalEntry = journal._id;
      }
      await transaction.save(sessionOptions(session));
    });
    const populated = await populateTransaction(BankTransaction.findById(transaction._id));
    return res.status(201).json({ message: status === "posted" ? "Bank transaction posted to banking and accounting." : "Bank transaction saved as draft.", transaction: populated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to create bank transaction.", error: error.message });
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
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
    let transaction;
    await runBankingWrite(async (session) => {
      transaction = await withSession(BankTransaction.findById(req.params.id), session);
      if (!transaction) throw Object.assign(new Error("Bank transaction not found."), { statusCode: 404 });
      if (transaction.reconciled) throw Object.assign(new Error("Reconciled transactions cannot be voided."), { statusCode: 409 });
      if (transaction.status !== "posted") throw Object.assign(new Error("Only posted transactions can be voided."), { statusCode: 409 });
      transaction.status = "void";
      transaction.updatedBy = req.user?._id || null;
      await transaction.save(sessionOptions(session));
      if (transaction.journalEntry) {
        await JournalEntry.updateOne(
          { _id: transaction.journalEntry, status: "posted" },
          { $set: { status: "void", voidedAt: new Date(), voidReason: clean(req.body.reason) || "Bank transaction voided", voidedBy: req.user?._id || null } },
          sessionOptions(session)
        );
      }
    });
    accountingCache.flushAll();
    const populated = await populateTransaction(BankTransaction.findById(transaction._id));
    return res.json({ message: "Bank transaction and accounting journal voided.", transaction: populated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to void bank transaction.", error: error.message });
  }
};

export const postDraftBankTransaction = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
    let transaction;
    await runBankingWrite(async (session) => {
      transaction = await withSession(BankTransaction.findById(req.params.id), session);
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
      await transaction.save(sessionOptions(session));
    });
    const populated = await populateTransaction(BankTransaction.findById(transaction._id));
    return res.json({ message: "Bank transaction posted to accounting.", transaction: populated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to post bank transaction.", error: error.message });
  }
};

export const createMoneyTransfer = async (req, res) => {
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

    await runBankingWrite(async (session) => {
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
        voucherType: "contra",
        paymentMode: "bank",
        treasuryAccountType: "bank",
        bankAccount: from._id,
        userId: req.user?._id || null,
        session,
        lines: [
          { account: to.ledgerAccount._id, debit: amount, credit: 0, description },
          { account: from.ledgerAccount._id, debit: 0, credit: amount, description },
        ],
      });
      documents.forEach((document) => { document.journalEntry = journal._id; });
      rows = await BankTransaction.insertMany(documents, sessionOptions(session));
    });

    return res.status(201).json({ message: "Money transfer posted.", transferGroupId, transactions: rows });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create money transfer.", error: error.message });
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
  try {
    const bankAccount = await ensureBankAccount(req.body.bankAccount);
    if (!bankAccount) return res.status(400).json({ message: "Valid bank account is required." });
    const statementDate = parsePostingDate(req.body.statementDate, null);
    if (!statementDate) return res.status(400).json({ message: "Valid statement closing date is required." });
    const statementBalance = money(req.body.statementBalance);
    const bookBalance = await getBookBalance(bankAccount._id, statementDate);
    const statementLines = (Array.isArray(req.body.statementLines) ? req.body.statementLines : []).map((line) => ({
      statementDate: parsePostingDate(line.statementDate, statementDate), description: clean(line.description), reference: clean(line.reference),
      direction: clean(line.direction).toLowerCase(), amount: money(line.amount),
    })).filter((line) => line.statementDate && ["in", "out"].includes(line.direction) && line.amount > 0);
    const reconciliation = await BankReconciliation.create({
      bankAccount: bankAccount._id, statementDate, statementBalance, bookBalance,
      difference: money(statementBalance - bookBalance), status: "in_progress", notes: clean(req.body.notes), statementLines,
      createdBy: req.user?._id || null, updatedBy: req.user?._id || null,
    });
    const populated = await reconciliation.populate({ path: "bankAccount", select: "accountName accountNumber currency bank", populate: { path: "bank", select: "bankName shortName" } });
    return res.status(201).json({ message: "Bank reconciliation session started.", reconciliation: populated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to start reconciliation.", error: error.message });
  }
};

const reconciliationWorkspace = async (reconciliation) => {
  const bankAccount = await BankAccount.findById(reconciliation.bankAccount).populate("ledgerAccount", "code name type").populate("bank", "bankName shortName").lean();
  if (!bankAccount?.ledgerAccount?._id) throw Object.assign(new Error("Bank account is not connected to the Chart of Accounts."), { statusCode: 409 });
  const previous = await BankReconciliation.findOne({ _id: { $ne: reconciliation._id }, bankAccount: bankAccount._id, status: { $in: ["completed", "reconciled"] }, statementDate: { $lt: reconciliation.statementDate } }).sort({ statementDate: -1 }).select("statementDate").lean();
  const dateFilter = { $lte: reconciliation.statementDate };
  if (previous?.statementDate) dateFilter.$gt = previous.statementDate;
  const journals = await JournalEntry.find({ status: { $in: ["posted", "reversed"] }, date: dateFilter, "lines.account": bankAccount.ledgerAccount._id })
    .select("entryNo date voucherType reference memo paymentMode chequeNo chequeStatus lines status").sort({ date: 1, _id: 1 }).lean();
  const normalCredit = bankAccount.ledgerAccount.type === "liability";
  const bookTransactions = journals.map((journal) => {
    const line = journal.lines.find((item) => String(item.account) === String(bankAccount.ledgerAccount._id));
    const signed = money(normalCredit ? Number(line?.credit || 0) - Number(line?.debit || 0) : Number(line?.debit || 0) - Number(line?.credit || 0));
    return { _id: journal._id, journalEntry: journal._id, entryNo: journal.entryNo, date: journal.date, voucherType: journal.voucherType, reference: journal.reference, description: line?.description || journal.memo, paymentMode: journal.paymentMode, chequeNo: journal.chequeNo, chequeStatus: journal.chequeStatus, direction: signed >= 0 ? "in" : "out", amount: Math.abs(signed), signed, matched: false };
  }).filter((row) => row.amount > 0);
  const matchedIds = new Set(reconciliation.statementLines.filter((line) => line.matchedJournalEntry).map((line) => String(line.matchedJournalEntry)));
  bookTransactions.forEach((row) => { row.matched = matchedIds.has(String(row.journalEntry)); });
  const unmatchedBook = bookTransactions.filter((row) => !row.matched);
  const unmatchedStatement = reconciliation.statementLines.filter((line) => !line.matchedJournalEntry);
  const adjustedBankBalance = money(reconciliation.statementBalance + unmatchedBook.reduce((sum, row) => sum + row.signed, 0));
  const adjustedBookBalance = money(reconciliation.bookBalance + unmatchedStatement.reduce((sum, line) => sum + (line.direction === "in" ? line.amount : -line.amount), 0));
  return { bankAccount, bookTransactions, unmatchedBook, unmatchedStatement, adjustedBankBalance, adjustedBookBalance, difference: money(adjustedBankBalance - adjustedBookBalance), previousStatementDate: previous?.statementDate || null };
};

export const getBankReconciliationWorkspace = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid reconciliation ID." });
    const reconciliation = await BankReconciliation.findById(req.params.id).populate("statementLines.matchedJournalEntry", "entryNo date voucherType reference").populate("createdBy completedBy", "name email");
    if (!reconciliation) return res.status(404).json({ message: "Reconciliation not found." });
    const workspace = await reconciliationWorkspace(reconciliation);
    return res.json({ reconciliation, ...workspace });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: "Failed to load reconciliation workspace.", error: error.message }); }
};

export const autoMatchBankReconciliation = async (req, res) => {
  try {
    const reconciliation = await BankReconciliation.findById(req.params.id);
    if (!reconciliation) return res.status(404).json({ message: "Reconciliation not found." });
    if (["completed", "reconciled", "void"].includes(reconciliation.status)) return res.status(409).json({ message: "Reopen the reconciliation before changing matches." });
    const workspace = await reconciliationWorkspace(reconciliation);
    const used = new Set(reconciliation.statementLines.filter((line) => line.matchedJournalEntry).map((line) => String(line.matchedJournalEntry)));
    let matched = 0;
    for (const statement of reconciliation.statementLines.filter((line) => !line.matchedJournalEntry)) {
      const candidates = workspace.bookTransactions.filter((row) => !used.has(String(row.journalEntry)) && row.direction === statement.direction && money(row.amount) === money(statement.amount) && Math.abs(new Date(row.date) - new Date(statement.statementDate)) <= 3 * 86400000);
      candidates.sort((a, b) => {
        const refA = statement.reference && clean(a.reference).toLowerCase() === clean(statement.reference).toLowerCase() ? 1 : 0;
        const refB = statement.reference && clean(b.reference).toLowerCase() === clean(statement.reference).toLowerCase() ? 1 : 0;
        return refB - refA || Math.abs(new Date(a.date) - new Date(statement.statementDate)) - Math.abs(new Date(b.date) - new Date(statement.statementDate));
      });
      if (candidates[0]) { statement.matchedJournalEntry = candidates[0].journalEntry; statement.matchMethod = "auto"; statement.matchedAt = new Date(); used.add(String(candidates[0].journalEntry)); matched += 1; }
    }
    reconciliation.updatedBy = req.user?._id || null; await reconciliation.save();
    return res.json({ message: `${matched} statement line(s) auto-matched.`, reconciliation });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: "Auto-matching failed.", error: error.message }); }
};

export const matchBankReconciliationLine = async (req, res) => {
  try {
    const reconciliation = await BankReconciliation.findById(req.params.id);
    if (!reconciliation) return res.status(404).json({ message: "Reconciliation not found." });
    if (["completed", "reconciled", "void"].includes(reconciliation.status)) return res.status(409).json({ message: "Reopen the reconciliation before changing matches." });
    const line = reconciliation.statementLines.id(req.params.lineId);
    if (!line) return res.status(404).json({ message: "Statement line not found." });
    if (!req.body.journalEntry) { line.matchedJournalEntry = null; line.matchMethod = ""; line.matchedAt = null; }
    else {
      if (!isId(req.body.journalEntry)) return res.status(400).json({ message: "Valid voucher is required." });
      const workspace = await reconciliationWorkspace(reconciliation);
      if (!workspace.bookTransactions.some((row) => String(row.journalEntry) === String(req.body.journalEntry))) return res.status(400).json({ message: "Voucher is not eligible for this reconciliation period." });
      if (reconciliation.statementLines.some((item) => String(item._id) !== String(line._id) && String(item.matchedJournalEntry || "") === String(req.body.journalEntry))) return res.status(409).json({ message: "That voucher is already matched to another statement line." });
      line.matchedJournalEntry = req.body.journalEntry; line.matchMethod = "manual"; line.matchedAt = new Date();
    }
    reconciliation.updatedBy = req.user?._id || null; await reconciliation.save();
    return res.json({ message: line.matchedJournalEntry ? "Statement line matched." : "Match removed.", reconciliation });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: "Failed to update match.", error: error.message }); }
};

export const completeBankReconciliation = async (req, res) => {
  try {
    let reconciliation;
    await runBankingWrite(async (session) => {
      reconciliation = await withSession(BankReconciliation.findById(req.params.id), session);
      if (!reconciliation) throw Object.assign(new Error("Reconciliation not found."), { statusCode: 404 });
      if (["completed", "reconciled"].includes(reconciliation.status)) throw Object.assign(new Error("Reconciliation is already completed."), { statusCode: 409 });
      const workspace = await reconciliationWorkspace(reconciliation);
      if (Math.abs(workspace.difference) > 0.009) throw Object.assign(new Error(`Adjusted balances do not match. Remaining difference: ${workspace.difference}.`), { statusCode: 409 });
      reconciliation.adjustedBankBalance = workspace.adjustedBankBalance; reconciliation.adjustedBookBalance = workspace.adjustedBookBalance;
      reconciliation.difference = 0; reconciliation.status = "completed"; reconciliation.completedAt = new Date(); reconciliation.completedBy = req.user?._id || null; reconciliation.reconciledAt = new Date(); reconciliation.updatedBy = req.user?._id || null;
      await reconciliation.save(sessionOptions(session));
      await BankAccount.findByIdAndUpdate(reconciliation.bankAccount, { lastReconciledAt: reconciliation.statementDate, lastReconciledBalance: reconciliation.statementBalance, updatedBy: req.user?._id || null }, sessionOptions(session));
      const journalIds = reconciliation.statementLines.filter((line) => line.matchedJournalEntry).map((line) => line.matchedJournalEntry);
      await BankTransaction.updateMany({ journalEntry: { $in: journalIds } }, { $set: { reconciled: true, reconciledAt: new Date(), reconciliation: reconciliation._id } }, sessionOptions(session));
    });
    return res.json({ message: "Bank reconciliation completed and matched vouchers locked.", reconciliation });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Failed to complete reconciliation.", error: error.message }); }
};

export const reopenBankReconciliation = async (req, res) => {
  try {
    const reconciliation = await BankReconciliation.findById(req.params.id);
    if (!reconciliation) return res.status(404).json({ message: "Reconciliation not found." });
    if (!["completed", "reconciled"].includes(reconciliation.status)) return res.status(409).json({ message: "Only a completed reconciliation can be reopened." });
    reconciliation.status = "in_progress"; reconciliation.completedAt = null; reconciliation.completedBy = null; reconciliation.reconciledAt = null; reconciliation.updatedBy = req.user?._id || null; await reconciliation.save();
    await BankTransaction.updateMany({ reconciliation: reconciliation._id }, { $set: { reconciled: false, reconciledAt: null, reconciliation: null } });
    const previous = await BankReconciliation.findOne({ bankAccount: reconciliation.bankAccount, status: { $in: ["completed", "reconciled"] } }).sort({ statementDate: -1 }).lean();
    await BankAccount.findByIdAndUpdate(reconciliation.bankAccount, { lastReconciledAt: previous?.statementDate || null, lastReconciledBalance: previous?.statementBalance || 0, updatedBy: req.user?._id || null });
    return res.json({ message: "Reconciliation reopened; voucher locks removed.", reconciliation });
  } catch (error) { return res.status(500).json({ message: "Failed to reopen reconciliation.", error: error.message }); }
};
