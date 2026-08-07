import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Expense from "../models/expense.model.js";
import Invoice from "../models/invoice.model.js";
import { SalesInvoice } from "../models/sales/salesInvoice.model.js";
import Account from "../models/account.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import AccountingPeriod from "../models/accountingPeriod.model.js";
import AccountingSettings from "../models/accountingSettings.model.js";
import FiscalYear from "../models/fiscalYear.model.js";
import OpeningBalance from "../models/openingBalance.model.js";
import CashAccount from "../models/cashAccount.model.js";
import BankAccount from "../models/bankAccount.model.js";
import BankReconciliation from "../models/bankReconciliation.model.js";
import BankTransaction from "../models/bankTransaction.model.js";
import VoucherType from "../models/voucherType.model.js";
import VendorBill from "../models/vendorBill.model.js";
import Supplier from "../models/supplier.model.js";
import PurchaseOrder from "../models/purchaseOrder.model.js";
import GoodsReceipt from "../models/goodsReceipt.model.js";
import User from "../models/user.model.js";
import { accountingCache } from "../utils/cache.js";
import { getReqMeta, writeAudit } from "../utils/audit.js";
import { nextAccountingNumber } from "../services/accountingNumbering.service.js";
import { createPostedJournal } from "../services/accountingPosting.service.js";
import { provisionSystemAccounts } from "../services/accountingSetup.service.js";
import { runMongoTransaction } from "../utils/mongoTransaction.js";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const toId = (value) => new mongoose.Types.ObjectId(String(value));
const ACTIVE_LEDGER_STATUSES = ["posted", "reversed"];
const VOUCHER_TYPES = ["journal", "payment", "receipt", "contra", "opening", "closing", "sales", "purchase", "payroll", "tax", "adjustment"];
const runAccountingWrite = runMongoTransaction;
const withAccountingSession = (query, session) => session ? query.session(session) : query;
const accountingSessionOptions = (session) => session ? { session } : {};
const validateVoucherSettlements = async (entry, session = null) => {
  if (entry.settlementAppliedAt || !entry.linkedDocuments?.length) return;
  for (const allocation of entry.linkedDocuments) {
    const amount = money(allocation.appliedAmount);
    if (amount <= 0) continue;
    if (allocation.documentType === "invoice") {
      const query = Invoice.findById(allocation.documentId).select("invoiceNo status dueTotal");
      if (session) query.session(session);
      const invoice = await query.lean();
      if (!invoice || ["draft", "void"].includes(invoice.status)) throw Object.assign(new Error("A linked customer invoice is no longer available."), { statusCode: 409 });
      if (amount > money(invoice.dueTotal) + 0.009) throw Object.assign(new Error(`Receipt allocation exceeds invoice ${invoice.invoiceNo} balance.`), { statusCode: 409 });
    }
    if (allocation.documentType === "supplier_bill") {
      const query = VendorBill.findById(allocation.documentId).select("billNo status dueTotal");
      if (session) query.session(session);
      const bill = await query.lean();
      if (!bill || ["draft", "void"].includes(bill.status)) throw Object.assign(new Error("A linked supplier bill is no longer available."), { statusCode: 409 });
      if (amount > money(bill.dueTotal) + 0.009) throw Object.assign(new Error(`Payment allocation exceeds bill ${bill.billNo} balance.`), { statusCode: 409 });
    }
  }
};
const applyVoucherSettlements = async (entry, userId, session = null) => {
  if (entry.settlementAppliedAt || !entry.linkedDocuments?.length) return;
  for (const allocation of entry.linkedDocuments) {
    const amount = money(allocation.appliedAmount);
    if (amount <= 0) continue;
    if (allocation.documentType === "invoice") {
      const query = Invoice.findById(allocation.documentId); if (session) query.session(session); const invoice = await query;
      if (!invoice || ["draft", "void"].includes(invoice.status)) throw Object.assign(new Error("A linked customer invoice is no longer available."), { statusCode: 409 });
      if (invoice.payments.some((payment) => String(payment.journalEntry || "") === String(entry._id))) continue;
      if (amount > money(invoice.dueTotal) + 0.009) throw Object.assign(new Error(`Receipt allocation exceeds invoice ${invoice.invoiceNo} balance.`), { statusCode: 409 });
      invoice.payments.push({ amount, method: ["cash", "bank", "card"].includes(entry.paymentMode) ? entry.paymentMode : "other", transactionId: entry.reference, paidAt: entry.date, note: entry.memo, receivedBy: userId, cashAccount: entry.cashAccount || null, bankAccount: entry.bankAccount || null, journalEntry: entry._id });
      await invoice.save(session ? { session } : undefined);
    }
    if (allocation.documentType === "supplier_bill") {
      const query = VendorBill.findById(allocation.documentId); if (session) query.session(session); const bill = await query;
      if (!bill || ["draft", "void"].includes(bill.status)) throw Object.assign(new Error("A linked supplier bill is no longer available."), { statusCode: 409 });
      if (bill.payments.some((payment) => String(payment.journalEntry || "") === String(entry._id))) continue;
      if (amount > money(bill.dueTotal) + 0.009) throw Object.assign(new Error(`Payment allocation exceeds bill ${bill.billNo} balance.`), { statusCode: 409 });
      bill.payments.push({ amount, paidAt: entry.date, cashAccount: entry.cashAccount || null, bankAccount: entry.bankAccount || null, journalEntry: entry._id, reference: entry.reference, note: entry.memo, paidBy: userId });
      await bill.save(session ? { session } : undefined);
    }
  }
  entry.settlementAppliedAt = new Date();
  await entry.save(session ? { session } : undefined);
};

const reverseVoucherSettlements = async (entry, session = null) => {
  if (!entry.settlementAppliedAt || entry.settlementReversedAt) return;
  const invoiceQuery = Invoice.find({ "payments.journalEntry": entry._id }); if (session) invoiceQuery.session(session);
  for (const invoice of await invoiceQuery) { invoice.payments = invoice.payments.filter((payment) => String(payment.journalEntry || "") !== String(entry._id)); await invoice.save(session ? { session } : undefined); }
  const billQuery = VendorBill.find({ "payments.journalEntry": entry._id }); if (session) billQuery.session(session);
  for (const bill of await billQuery) { bill.payments = bill.payments.filter((payment) => String(payment.journalEntry || "") !== String(entry._id)); await bill.save(session ? { session } : undefined); }
  entry.settlementReversedAt = new Date();
};
const voucherTypeForSource = (sourceType = "manual", requested = "") => {
  if (VOUCHER_TYPES.includes(clean(requested).toLowerCase())) return clean(requested).toLowerCase();
  const map = {
    opening_balance: "opening", fiscal_closing: "closing", invoice: "sales", customer_payment: "receipt",
    vendor_bill: "purchase", vendor_payment: "payment", expense: "payment", bank_transfer: "contra",
    payroll: "payroll", tax: "tax", manual: "journal",
  };
  return map[clean(sourceType).toLowerCase()] || "adjustment";
};
const DEFAULT_VOUCHER_TYPES = [
  { key: "journal", code: "JV", name: "Journal Voucher", numberingRule: "journal", defaultPattern: "flexible", applicableModule: "accounting" },
  { key: "payment", code: "PV", name: "Payment Voucher", numberingRule: "voucher", defaultPattern: "cash_credit", applicableModule: "cash_bank" },
  { key: "receipt", code: "RV", name: "Receipt Voucher", numberingRule: "voucher", defaultPattern: "cash_debit", applicableModule: "cash_bank" },
  { key: "contra", code: "CV", name: "Contra Voucher", numberingRule: "voucher", defaultPattern: "bank_to_bank", applicableModule: "cash_bank" },
  { key: "adjustment", code: "AV", name: "Adjustment Voucher", numberingRule: "voucher", defaultPattern: "flexible", applicableModule: "accounting" },
];
const numberingRuleForVoucher = async (voucherType) => (await VoucherType.findOne({ key: voucherType, isActive: true }).select("numberingRule").lean())?.numberingRule || (voucherType === "journal" ? "journal" : "voucher");

const CORE_SYSTEM_ACCOUNT_CODES = new Set(["A000", "L000", "E000", "I000", "X000"]);
const SYSTEM_ACCOUNT_LOCKED_FIELDS = new Set([
  "code",
  "type",
  "parent",
  "isGroup",
  "isControlAccount",
  "controlType",
]);
const CORE_ACCOUNT_LOCKED_FIELDS = new Set([
  ...SYSTEM_ACCOUNT_LOCKED_FIELDS,
  "isActive",
  "name",
  "subType",
  "currency",
  "taxApplicability",
]);

const resolveSystemAccount = async (code) => {
  const settingField = {
    1000: "defaultCashAccount",
    1010: "defaultBankAccount",
    1100: "receivableAccount",
    1200: "vatReceivableAccount",
    1300: "inventoryAccount",
    1500: "furnitureAccount",
    2000: "payableAccount",
    2050: "inventoryClearingAccount",
    2200: "payrollPayableAccount",
    2300: "loanAccount",
    2100: "vatAccount",
    4000: "salesAccount",
    5000: "purchaseAccount",
    5010: "purchaseAccount",
    5100: "payrollExpenseAccount",
  }[String(code)];
  if (settingField) {
    const settings = await AccountingSettings.findOne({ key: "company" }).select(settingField).lean();
    const configured = settings?.[settingField];
    if (configured) {
      const account = await Account.findOne({ _id: configured, isActive: true }).lean();
      if (account) return account._id;
    }
  }
  let account = await Account.findOne({ code: String(code), isActive: true }).lean();
  if (!account) {
    await provisionSystemAccounts();
    account = await Account.findOne({ code: String(code), isActive: true }).lean();
  }
  if (!account) throw new Error(`Missing system account ${code}. Run /api/accounting/accounts/bootstrap first.`);
  return account._id;
};

const parsePostingDate = (value, fallback = new Date()) => {
  if ((value === undefined || value === null || value === "") && fallback === null) return null;
  const date = value ? new Date(value) : new Date(fallback);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const isPeriodClosed = async (date) => {
  const period = await AccountingPeriod.findOne({
    startDate: { $lte: date },
    endDate: { $gte: date },
    status: { $in: ["closed", "locked"] },
  }).lean();
  return period;
};

const assertOpenPeriod = async (date) => {
  const postingDay = new Date(date);
  postingDay.setUTCHours(0, 0, 0, 0);
  const settings = await AccountingSettings.findOne({ key: "company" }).select("lockDate").lean();
  if (settings?.lockDate && postingDay <= settings.lockDate) {
    const err = new Error(`Posting is locked through ${new Date(settings.lockDate).toISOString().slice(0, 10)}.`);
    err.statusCode = 409;
    throw err;
  }
  const period = await AccountingPeriod.findOne({ startDate: { $lte: postingDay }, endDate: { $gte: postingDay } }).lean();
  if (!period && await FiscalYear.exists({})) {
    const err = new Error("Posting date is not inside a configured accounting period."); err.statusCode = 409; throw err;
  }
  if (period && period.status !== "open") {
    const err = new Error(`Accounting period ${period.periodKey} is ${period.status}.`); err.statusCode = 409; throw err;
  }
  return period;
};

const normalizeLines = (lines = []) =>
  lines.map((line) => ({
    account: line.account,
    debit: money(line.debit),
    credit: money(line.credit),
    description: clean(line.description),
    contactType: clean(line.contactType),
    contactId: isId(line.contactId) ? line.contactId : null,
    costCenter: isId(line.costCenter) ? line.costCenter : null,
    project: isId(line.project) ? line.project : null,
    taxCode: clean(line.taxCode).toUpperCase(),
  }));

const assertPostableAccounts = async (lines = []) => {
  const ids = [...new Set(lines.map((line) => String(line.account || "")).filter(isId))];
  if (ids.length !== new Set(lines.map((line) => String(line.account || ""))).size) {
    const err = new Error("Every journal line must reference a valid account."); err.statusCode = 400; throw err;
  }
  const accounts = await Account.find({ _id: { $in: ids } }).select("name code isActive isGroup publishedAt").lean();
  if (accounts.length !== ids.length) { const err = new Error("One or more journal accounts do not exist."); err.statusCode = 400; throw err; }
  const childParents = await Account.distinct("parent", { parent: { $in: ids }, isActive: true });
  const childSet = new Set(childParents.map(String));
  const publishedRequired = Boolean(await AccountingSettings.exists({ key: "company", coaPublishedAt: { $ne: null } }));
  const invalid = accounts.find((account) => !account.isActive || account.isGroup || childSet.has(String(account._id)) || (publishedRequired && !account.publishedAt));
  if (invalid) {
    let suggestion = "Activate the account and publish the Chart of Accounts before trying again.";
    if (invalid.isGroup || childSet.has(String(invalid._id))) {
      suggestion = "Use one of its active leaf accounts, or correct the hierarchy in Chart of Accounts and publish it again.";
    } else if (publishedRequired && !invalid.publishedAt) {
      suggestion = "Publish the Chart of Accounts, then reload Opening Balance and try again.";
    }
    const err = new Error(`Account ${invalid.code} - ${invalid.name} cannot receive an opening balance. ${suggestion}`);
    err.statusCode = 400;
    throw err;
  }
};

const postJournalEntry = async ({
  date,
  lines,
  sourceType = "manual",
  sourceId = null,
  reference = "",
  memo = "",
  currency = "BDT",
  voucherType = "",
  paymentMode = "",
  cashAccount = null,
  bankAccount = null,
  attachment = {},
  userId = null,
  allowClosedPeriod = false,
}) => {
  const postingDate = parsePostingDate(date);
  if (!postingDate) {
    const err = new Error("Valid posting date is required.");
    err.statusCode = 400;
    throw err;
  }
  const period = !allowClosedPeriod ? await assertOpenPeriod(postingDate) : await AccountingPeriod.findOne({ startDate: { $lte: postingDate }, endDate: { $gte: postingDate } }).lean();
  const fiscalYear = period?.fiscalYearRef || (await FiscalYear.findOne({ startDate: { $lte: postingDate }, endDate: { $gte: postingDate } }).select("_id").lean())?._id || null;
  await assertPostableAccounts(lines);
  const resolvedVoucherType = voucherTypeForSource(sourceType, voucherType);
  const entryNo = await nextAccountingNumber(await numberingRuleForVoucher(resolvedVoucherType), postingDate);
  const entry = await JournalEntry.create({
    entryNo,
    date: postingDate,
    status: "posted",
    sourceType,
    voucherType: resolvedVoucherType,
    origin: sourceType === "manual" ? "manual" : "system",
    fiscalYear,
    accountingPeriod: period?._id || null,
    sourceId: isId(sourceId) ? sourceId : null,
    reference: clean(reference),
    memo: clean(memo),
    currency: clean(currency || "BDT"),
    paymentMode: clean(paymentMode),
    cashAccount: isId(cashAccount) ? cashAccount : null,
    bankAccount: isId(bankAccount) ? bankAccount : null,
    attachment: {
      name: clean(attachment?.name), url: clean(attachment?.url), type: clean(attachment?.type), size: Number(attachment?.size || 0),
    },
    lines: normalizeLines(lines),
    createdBy: userId,
    postedBy: userId,
    postedAt: new Date(),
  });
  accountingCache.flushAll();
  return entry;
};

const listCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    const date = decoded.date ? new Date(decoded.date) : null;
    if (!decoded.id || !isId(decoded.id) || !date || Number.isNaN(date.getTime())) return null;
    return { date, id: toId(decoded.id) };
  } catch {
    return null;
  }
};

const makeListCursor = (doc, field = "date") =>
  Buffer.from(JSON.stringify({ date: doc[field] || doc.createdAt, id: doc._id })).toString("base64url");

const ledgerMatchForRange = ({ from, to }) => {
  const match = { status: { $in: ACTIVE_LEDGER_STATUSES } };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lte = to;
  }
  return match;
};

const accountBalanceExpression = {
  $cond: [
    { $in: ["$account.type", ["asset", "expense"]] },
    { $subtract: ["$debit", "$credit"] },
    { $subtract: ["$credit", "$debit"] },
  ],
};

const parseDateRange = (query = {}) => {
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && Number.isNaN(from.getTime())) return { error: "Invalid from date." };
  if (to && Number.isNaN(to.getTime())) return { error: "Invalid to date." };
  if (from) from.setHours(0, 0, 0, 0);
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
};

const parseLimit = (value, fallback = 50) => {
  const limit = Number(value || fallback);
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(limit, 1), 75);
};

const encodeCursor = (payload) => Buffer.from(JSON.stringify(payload)).toString("base64url");

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (!decoded?.date || !decoded?.id) return null;
    const date = new Date(decoded.date);
    if (Number.isNaN(date.getTime()) || !mongoose.Types.ObjectId.isValid(decoded.id)) return null;
    return { date, id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    return null;
  }
};

const cursorMatch = (dateField, cursor) => {
  if (!cursor) return {};
  return {
    $or: [
      { [dateField]: { $lt: cursor.date } },
      { [dateField]: cursor.date, _id: { $lt: cursor.id } },
    ],
  };
};

const cacheKey = (scope, query = {}, extra = "") =>
  `${scope}:${JSON.stringify({
    from: query.from || "",
    to: query.to || "",
    q: query.q || "",
    status: query.status || "",
    extra,
  })}`;

const dateExpr = (field, from, to) => {
  const match = {};
  if (from) match.$gte = from;
  if (to) match.$lte = to;
  return Object.keys(match).length ? { [field]: match } : {};
};

const dealAccountingDateStage = {
  $addFields: {
    accountingDate: { $ifNull: ["$wonAt", { $ifNull: ["$updatedAt", "$createdAt"] }] },
  },
};

const textRegex = (value) => {
  const q = String(value || "").trim();
  if (!q) return null;
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
};

const receivableBaseMatch = ({ from, to, q }) => {
  const rx = textRegex(q);
  const match = { stage: "won", ...dateExpr("accountingDate", from, to) };
  if (rx) match.$or = [{ title: rx }, { dealNo: rx }];
  return match;
};

const invoiceAccountingLookup = {
  $lookup: {
    from: "invoices",
    let: { dealId: "$_id" },
    pipeline: [
      { $match: { $expr: { $eq: ["$dealId", "$$dealId"] }, status: { $ne: "void" } } },
      {
        $group: {
          _id: "$dealId",
          invoiceCount: { $sum: 1 },
          invoicedAmount: { $sum: "$total" },
          paidAmount: { $sum: "$paidTotal" },
          invoiceDueAmount: { $sum: "$dueTotal" },
          oldestDueAt: { $min: "$dueAt" },
          lastInvoiceAt: { $max: "$issuedAt" },
          statuses: { $addToSet: "$status" },
        },
      },
    ],
    as: "invoiceAccounting",
  },
};

const addReceivableFields = [
  { $addFields: { invoiceAccounting: { $ifNull: [{ $first: "$invoiceAccounting" }, {}] } } },
  {
    $addFields: {
      invoicedAmount: { $ifNull: ["$invoiceAccounting.invoicedAmount", 0] },
      paidAmount: { $ifNull: ["$invoiceAccounting.paidAmount", 0] },
      invoiceDueAmount: { $ifNull: ["$invoiceAccounting.invoiceDueAmount", 0] },
      invoiceCount: { $ifNull: ["$invoiceAccounting.invoiceCount", 0] },
      unbilledAmount: { $max: [{ $subtract: ["$grandTotal", { $ifNull: ["$invoiceAccounting.invoicedAmount", 0] }] }, 0] },
      oldestDueAt: "$invoiceAccounting.oldestDueAt",
      lastInvoiceAt: "$invoiceAccounting.lastInvoiceAt",
      invoiceStatuses: { $ifNull: ["$invoiceAccounting.statuses", []] },
    },
  },
  {
    $addFields: {
      receivableAmount: { $add: ["$invoiceDueAmount", "$unbilledAmount"] },
      isOverdue: {
        $and: [
          { $gt: ["$invoiceDueAmount", 0] },
          { $ne: ["$oldestDueAt", null] },
          { $lt: ["$oldestDueAt", new Date()] },
        ],
      },
    },
  },
];

const customerLookup = [
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer",
      pipeline: [{ $project: { name: 1, companyName: 1, email: 1, phone: 1 } }],
    },
  },
  { $addFields: { customer: { $first: "$customer" } } },
];

const receivableProject = {
  $project: {
    dealNo: 1,
    title: 1,
    currency: 1,
    customer: 1,
    wonAt: 1,
    grandTotal: 1,
    invoicedAmount: 1,
    paidAmount: 1,
    invoiceDueAmount: 1,
    unbilledAmount: 1,
    receivableAmount: 1,
    invoiceCount: 1,
    invoiceStatuses: 1,
    oldestDueAt: 1,
    lastInvoiceAt: 1,
    accountingDate: 1,
    isOverdue: 1,
  },
};

const receivableRowsOnlyPipeline = ({ from, to, q, limit, cursor }) => [
  dealAccountingDateStage,
  { $match: receivableBaseMatch({ from, to, q }) },
  { $match: cursorMatch("accountingDate", cursor) },
  { $sort: { accountingDate: -1, _id: -1 } },
  { $limit: limit + 1 },
  invoiceAccountingLookup,
  ...addReceivableFields,
  ...customerLookup,
  receivableProject,
];

const receivablePipeline = ({ from, to, q, limit, cursor, includeSummary = true }) => {
  return [
    dealAccountingDateStage,
    { $match: receivableBaseMatch({ from, to, q }) },
    invoiceAccountingLookup,
    ...addReceivableFields,
    {
      $facet: {
        rows: [
          { $match: cursorMatch("accountingDate", cursor) },
          { $sort: { accountingDate: -1, _id: -1 } },
          { $limit: limit + 1 },
          ...customerLookup,
          receivableProject,
        ],
        summary: includeSummary ? [
          {
            $group: {
              _id: null,
              dealCount: { $sum: 1 },
              dealValue: { $sum: "$grandTotal" },
              invoicedAmount: { $sum: "$invoicedAmount" },
              paidAmount: { $sum: "$paidAmount" },
              invoiceDueAmount: { $sum: "$invoiceDueAmount" },
              unbilledAmount: { $sum: "$unbilledAmount" },
              receivableAmount: { $sum: "$receivableAmount" },
              overdueAmount: { $sum: { $cond: ["$isOverdue", "$invoiceDueAmount", 0] } },
              overdueCount: { $sum: { $cond: ["$isOverdue", 1, 0] } },
            },
          },
        ] : [{ $match: { _id: { $exists: false } } }],
      },
    },
  ];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const agingBucket = (dueDate, asOf = new Date()) => {
  if (!dueDate) return "current";
  const days = Math.floor((asOf.getTime() - new Date(dueDate).getTime()) / DAY_MS);
  if (days <= 0) return "current";
  if (days <= 30) return "days1to30";
  if (days <= 60) return "days31to60";
  if (days <= 90) return "days61to90";
  return "days90plus";
};
const emptyAging = () => ({ current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 });
const addAging = (target, bucket, amount) => {
  target[bucket] = money(target[bucket] + amount);
  target.total = money(target.total + amount);
};
const controlAccountBalance = async (accountId) => {
  const [row] = await JournalEntry.aggregate([
    { $match: { status: { $in: ACTIVE_LEDGER_STATUSES }, "lines.account": toId(accountId) } },
    { $unwind: "$lines" },
    { $match: { "lines.account": toId(accountId) } },
    { $group: { _id: null, debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
  ]);
  return money(Number(row?.debit || 0) - Number(row?.credit || 0));
};
const paymentDayAverage = (documents, issueField, paymentsField = "payments") => {
  const values = documents.flatMap((document) => (document[paymentsField] || []).map((payment) => {
    const start = new Date(document[issueField]); const end = new Date(payment.paidAt);
    return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? null : Math.max(Math.round((end - start) / DAY_MS), 0);
  })).filter((value) => value !== null);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
};
const paymentDaysTrend = (documents, issueField, paymentsField = "payments") => {
  const groups = new Map();
  for (const document of documents) {
    const issuedAt = new Date(document[issueField]);
    if (Number.isNaN(issuedAt.getTime())) continue;
    for (const payment of document[paymentsField] || []) {
      const paidAt = new Date(payment.paidAt); if (Number.isNaN(paidAt.getTime())) continue;
      const key = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, "0")}`;
      const row = groups.get(key) || { month: key, days: 0, paymentCount: 0 };
      row.days += Math.max(Math.round((paidAt - issuedAt) / DAY_MS), 0); row.paymentCount += 1; groups.set(key, row);
    }
  }
  return [...groups.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map((row) => ({ month: row.month, days: Math.round(row.days / row.paymentCount), paymentCount: row.paymentCount }));
};
const subledgerOutstanding = async (Model, match) => {
  const [row] = await Model.aggregate([{ $match: match }, { $group: { _id: null, amount: { $sum: "$dueTotal" } } }]);
  return money(row?.amount);
};
const reconciliationResult = async (controlCode, subledgerTotal, label) => {
  const accountId = await resolveSystemAccount(controlCode);
  const account = await Account.findById(accountId).select("code name").lean();
  const rawBalance = await controlAccountBalance(accountId);
  const glBalance = controlCode === "2000" ? money(-rawBalance) : rawBalance;
  const difference = money(subledgerTotal - glBalance);
  return { account, subledgerBalance: money(subledgerTotal), glBalance, difference, reconciled: Math.abs(difference) < 0.01, label };
};

export const postCustomerInvoice = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid invoice ID." });
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    if (invoice.journalEntry) return res.status(409).json({ message: "Invoice is already posted." });
    if (invoice.status === "void" || Number(invoice.paidTotal || 0) > 0) return res.status(409).json({ message: "A void or legacy-paid invoice cannot be posted automatically; reconcile its historical payments first." });
    if (Number(invoice.total || 0) <= 0) return res.status(400).json({ message: "Invoice total must be greater than zero." });
    const receivableAccount = await resolveSystemAccount("1100");
    const salesAccount = await resolveSystemAccount("4000");
    const journal = await postJournalEntry({
      date: invoice.issuedAt, sourceType: "invoice", sourceId: invoice._id, reference: invoice.invoiceNo,
      memo: clean(invoice.notes || `Customer invoice ${invoice.invoiceNo}`), currency: invoice.currency,
      userId: req.user?._id || null,
      lines: [
        { account: receivableAccount, debit: invoice.total, credit: 0, description: invoice.invoiceNo, contactType: "customer", contactId: invoice.customerId },
        { account: salesAccount, debit: 0, credit: invoice.total, description: invoice.invoiceNo, contactType: "customer", contactId: invoice.customerId },
      ],
    });
    invoice.status = "sent"; invoice.journalEntry = journal._id; await invoice.save();
    accountingCache.flushAll();
    return res.json({ message: "Invoice posted to Accounts Receivable and Sales Revenue.", invoice, journalEntry: journal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to post invoice.", error: error.message });
  }
};

export const getReceivables = async (req, res) => {
  try {
    const range = parseDateRange(req.query); if (range.error) return res.status(400).json({ message: range.error });
    const asOf = req.query.asOf ? parsePostingDate(req.query.asOf, null) : new Date();
    if (!asOf) return res.status(400).json({ message: "Invalid as-of date." });
    asOf.setHours(23, 59, 59, 999);
    const controlFilter = { journalEntry: { $ne: null }, status: { $nin: ["draft", "void"] }, dueTotal: { $gt: 0 }, issuedAt: { $lte: asOf } };
    const filter = { ...controlFilter, issuedAt: { ...controlFilter.issuedAt } };
    if (range.from) filter.issuedAt.$gte = range.from;
    if (range.to && range.to < asOf) filter.issuedAt.$lte = range.to;
    const salesControlFilter = { "accountingPosting.journalEntryId": { $ne: null }, status: { $nin: ["draft", "void", "cancelled"] }, dueAmount: { $gt: 0 }, invoiceDate: { $lte: asOf } };
    const salesFilter = { ...salesControlFilter, invoiceDate: { ...salesControlFilter.invoiceDate } };
    if (range.from) salesFilter.invoiceDate.$gte = range.from;
    if (range.to && range.to < asOf) salesFilter.invoiceDate.$lte = range.to;
    const [legacyDocuments, salesDocuments] = await Promise.all([
      Invoice.find(filter)
        .populate("customerId", "name companyName email phone")
        .populate({ path: "dealId", select: "dealNo title ownerId", populate: { path: "ownerId", select: "name email" } })
        .sort({ dueAt: 1, issuedAt: 1 }).lean(),
      SalesInvoice.find(salesFilter)
        .populate("customerId", "name companyName email phone")
        .populate("salespersonId", "name email")
        .sort({ dueDate: 1, invoiceDate: 1 }).lean(),
    ]);
    const documents = [
      ...legacyDocuments,
      ...salesDocuments.map((invoice) => ({
        ...invoice,
        invoiceNo: invoice.invoiceNumber,
        issuedAt: invoice.invoiceDate,
        dueAt: invoice.dueDate,
        total: invoice.totals?.grandTotal || 0,
        paidTotal: invoice.paidAmount || 0,
        dueTotal: invoice.dueAmount || 0,
        salesperson: invoice.salespersonId || null,
        sourceModule: "sales",
      })),
    ];
    const q = clean(req.query.q).toLowerCase(); const salespersonId = clean(req.query.salespersonId);
    const filtered = documents.filter((invoice) => {
      const customer = invoice.customerId || {}; const owner = invoice.dealId?.ownerId || invoice.salesperson || {};
      const haystack = [invoice.invoiceNo, customer.name, customer.companyName, customer.email, owner.name, owner.email].map(clean).join(" ").toLowerCase();
      return (!q || haystack.includes(q)) && (!salespersonId || String(owner._id || owner) === salespersonId);
    });
    const partyMap = new Map(); const totalAging = emptyAging();
    for (const invoice of filtered) {
      const party = invoice.customerId || {}; const key = String(party._id || "unassigned"); const bucket = agingBucket(invoice.dueAt, asOf);
      const row = partyMap.get(key) || { party: { _id: party._id, name: party.companyName || party.name || "Unassigned customer", email: party.email, phone: party.phone }, ...emptyAging(), invoices: [] };
      addAging(row, bucket, invoice.dueTotal); addAging(totalAging, bucket, invoice.dueTotal);
      row.invoices.push({ _id: invoice._id, invoiceNo: invoice.invoiceNo, issuedAt: invoice.issuedAt, dueAt: invoice.dueAt, total: invoice.total, paidTotal: invoice.paidTotal, dueTotal: invoice.dueTotal, status: bucket === "current" ? invoice.status : "overdue", daysOverdue: invoice.dueAt ? Math.max(Math.floor((asOf - new Date(invoice.dueAt)) / DAY_MS), 0) : 0, salesperson: invoice.dealId?.ownerId || invoice.salesperson || null, sourceModule: invoice.sourceModule || "crm" });
      partyMap.set(key, row);
    }
    const aging = [...partyMap.values()].sort((a, b) => b.total - a.total);
    const overdueAmount = money(totalAging.total - totalAging.current);
    const [legacySubledgerTotal, salesSubledgerRows, legacySettled, salesSettled] = await Promise.all([
      subledgerOutstanding(Invoice, controlFilter),
      SalesInvoice.aggregate([{ $match: salesControlFilter }, { $group: { _id: null, amount: { $sum: "$dueAmount" } } }]),
      Invoice.find({ journalEntry: { $ne: null }, status: { $nin: ["draft", "void"] }, paidTotal: { $gt: 0 } }).select("issuedAt payments").lean(),
      SalesInvoice.find({ "accountingPosting.journalEntryId": { $ne: null }, paidAmount: { $gt: 0 }, status: { $nin: ["draft", "void", "cancelled"] } }).select("invoiceDate paymentAllocations").lean(),
    ]);
    const controlSubledgerTotal = money(legacySubledgerTotal + Number(salesSubledgerRows[0]?.amount || 0));
    const settled = [
      ...legacySettled,
      ...salesSettled.map((invoice) => ({ issuedAt: invoice.invoiceDate, payments: (invoice.paymentAllocations || []).map((payment) => ({ paidAt: payment.paymentDate })) })),
    ];
    const reconciliation = await reconciliationResult("1100", controlSubledgerTotal, "All open posted CRM and Sales invoices");
    const limit = parseLimit(req.query.limit, 75); const rows = aging.flatMap((party) => party.invoices.map((invoice) => ({ ...invoice, customer: party.party }))).slice(0, limit);
    return res.json({
      summary: { outstandingAmount: totalAging.total, receivableAmount: totalAging.total, invoiceDueAmount: totalAging.total, overdueAmount, overdueCount: filtered.filter((invoice) => invoice.dueAt && new Date(invoice.dueAt) < asOf).length, customerCount: aging.length, openInvoiceCount: filtered.length, dso: paymentDayAverage(settled, "issuedAt") },
      aging, agingTotals: totalAging, rows, topCustomers: aging.slice(0, 5).map(({ party, total }) => ({ party, amount: total })), dsoTrend: paymentDaysTrend(settled, "issuedAt"), reconciliation,
      filters: { salespersonId: salespersonId || null }, pageInfo: { limit, hasNextPage: filtered.length > limit, nextCursor: "" },
      basis: "Posted CRM and Sales invoices less applied receipt-voucher payments. Unbilled deals and draft invoices are excluded.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load receivables.", error: error.message });
  }
};

export const getCustomerStatement = async (req, res) => {
  try {
    if (!isId(req.params.customerId)) return res.status(400).json({ message: "Invalid customer ID." });
    const asOf = req.query.asOf ? parsePostingDate(req.query.asOf, null) : new Date();
    if (!asOf) return res.status(400).json({ message: "Invalid as-of date." }); asOf.setHours(23, 59, 59, 999);
    const [legacyInvoices, salesInvoices] = await Promise.all([
      Invoice.find({ customerId: req.params.customerId, journalEntry: { $ne: null }, status: { $nin: ["draft", "void"] }, issuedAt: { $lte: asOf } }).populate("customerId", "name companyName email phone").sort({ issuedAt: 1 }).lean(),
      SalesInvoice.find({ customerId: req.params.customerId, "accountingPosting.journalEntryId": { $ne: null }, status: { $nin: ["draft", "void", "cancelled"] }, invoiceDate: { $lte: asOf } }).populate("customerId", "name companyName email phone").sort({ invoiceDate: 1 }).lean(),
    ]);
    const invoices = [
      ...legacyInvoices,
      ...salesInvoices.map((invoice) => ({
        ...invoice,
        invoiceNo: invoice.invoiceNumber,
        issuedAt: invoice.invoiceDate,
        total: invoice.totals?.grandTotal || 0,
        payments: (invoice.paymentAllocations || []).map((payment) => ({ amount: payment.amount, paidAt: payment.paymentDate, transactionId: payment.reference })),
      })),
    ];
    const transactions = invoices.flatMap((invoice) => [
      { date: invoice.issuedAt, reference: invoice.invoiceNo, description: "Customer invoice", charge: money(invoice.total), payment: 0, invoiceId: invoice._id },
      ...(invoice.payments || []).filter((payment) => new Date(payment.paidAt) <= asOf).map((payment) => ({ date: payment.paidAt, reference: payment.transactionId || invoice.invoiceNo, description: `Payment received - ${invoice.invoiceNo}`, charge: 0, payment: money(payment.amount), invoiceId: invoice._id })),
    ]).sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = 0; for (const item of transactions) { balance = money(balance + item.charge - item.payment); item.balance = balance; }
    return res.json({ party: invoices[0]?.customerId || null, asOf, transactions, balanceDue: balance });
  } catch (error) { return res.status(500).json({ message: "Failed to load customer statement.", error: error.message }); }
};

export const getPayables = async (req, res) => {
  try {
    const range = parseDateRange(req.query); if (range.error) return res.status(400).json({ message: range.error });
    const asOf = req.query.asOf ? parsePostingDate(req.query.asOf, null) : new Date();
    if (!asOf) return res.status(400).json({ message: "Invalid as-of date." }); asOf.setHours(23, 59, 59, 999);
    const controlFilter = { journalEntry: { $ne: null }, status: { $nin: ["draft", "void"] }, dueTotal: { $gt: 0 }, billDate: { $lte: asOf } };
    const filter = { ...controlFilter, billDate: { ...controlFilter.billDate } };
    if (range.from) filter.billDate.$gte = range.from; if (range.to && range.to < asOf) filter.billDate.$lte = range.to;
    const documents = await VendorBill.find(filter).populate("expenseAccount payableAccount", "code name type").sort({ dueDate: 1, billDate: 1 }).lean();
    const q = clean(req.query.q).toLowerCase(); const filtered = documents.filter((bill) => !q || [bill.vendorName, bill.billNo, bill.memo].map(clean).join(" ").toLowerCase().includes(q));
    const partyMap = new Map(); const totalAging = emptyAging();
    for (const bill of filtered) {
      const key = bill.vendorNameLower || clean(bill.vendorName).toLowerCase(); const bucket = agingBucket(bill.dueDate, asOf);
      const row = partyMap.get(key) || { party: { name: bill.vendorName }, ...emptyAging(), bills: [] };
      addAging(row, bucket, bill.dueTotal); addAging(totalAging, bucket, bill.dueTotal);
      row.bills.push({ _id: bill._id, billNo: bill.billNo, billDate: bill.billDate, dueDate: bill.dueDate, total: bill.total, paidTotal: bill.paidTotal, dueTotal: bill.dueTotal, status: bill.status, daysOverdue: bill.dueDate ? Math.max(Math.floor((asOf - new Date(bill.dueDate)) / DAY_MS), 0) : 0 }); partyMap.set(key, row);
    }
    const aging = [...partyMap.values()].sort((a, b) => b.total - a.total); const now = new Date(); const in7 = new Date(now.getTime() + 7 * DAY_MS); const in30 = new Date(now.getTime() + 30 * DAY_MS);
    const upcomingPayments = filtered.filter((bill) => bill.dueDate && new Date(bill.dueDate) >= now && new Date(bill.dueDate) <= in30).map((bill) => ({ _id: bill._id, billNo: bill.billNo, vendorName: bill.vendorName, dueDate: bill.dueDate, amount: bill.dueTotal })).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const controlSubledgerTotal = await subledgerOutstanding(VendorBill, controlFilter);
    const [settled, reconciliation] = await Promise.all([
      VendorBill.find({ journalEntry: { $ne: null }, status: { $nin: ["draft", "void"] }, paidTotal: { $gt: 0 } }).select("billDate payments").lean(),
      reconciliationResult("2000", controlSubledgerTotal, "All open posted supplier bills"),
    ]);
    const dueIn7 = money(upcomingPayments.filter((item) => new Date(item.dueDate) <= in7).reduce((sum, item) => sum + item.amount, 0)); const dueIn30 = money(upcomingPayments.reduce((sum, item) => sum + item.amount, 0));
    const limit = parseLimit(req.query.limit, 75); const rows = aging.flatMap((party) => party.bills.map((bill) => ({ ...bill, vendorName: party.party.name }))).slice(0, limit);
    return res.json({
      summary: { outstandingAmount: totalAging.total, payableAmount: totalAging.total, overdueAmount: money(totalAging.total - totalAging.current), dueIn7, dueIn30, supplierCount: aging.length, openBillCount: filtered.length, dpo: paymentDayAverage(settled, "billDate") },
      aging, agingTotals: totalAging, rows, upcomingPayments, topSuppliers: aging.slice(0, 5).map(({ party, total }) => ({ party, amount: total })), dpoTrend: paymentDaysTrend(settled, "billDate"), reconciliation,
      pageInfo: { limit, hasNextPage: filtered.length > limit, nextCursor: "" }, vendorSummary: aging.slice(0, 8).map(({ party, total, bills }) => ({ vendor: party.name, amount: total, count: bills.length })),
      basis: "Posted supplier bills less applied Payment Voucher payments. Draft bills and expense commitments are excluded.",
    });
  } catch (error) { return res.status(500).json({ message: "Failed to load payables.", error: error.message }); }
};

export const getSupplierStatement = async (req, res) => {
  try {
    const vendor = clean(req.query.vendor); if (!vendor) return res.status(400).json({ message: "Supplier name is required." });
    const asOf = req.query.asOf ? parsePostingDate(req.query.asOf, null) : new Date(); if (!asOf) return res.status(400).json({ message: "Invalid as-of date." }); asOf.setHours(23, 59, 59, 999);
    const bills = await VendorBill.find({ vendorNameLower: vendor.toLowerCase(), journalEntry: { $ne: null }, status: { $nin: ["draft", "void"] }, billDate: { $lte: asOf } }).sort({ billDate: 1 }).lean();
    const transactions = bills.flatMap((bill) => [
      { date: bill.billDate, reference: bill.billNo, description: "Supplier bill", charge: money(bill.total), payment: 0, billId: bill._id },
      ...(bill.payments || []).filter((payment) => new Date(payment.paidAt) <= asOf).map((payment) => ({ date: payment.paidAt, reference: payment.reference || bill.billNo, description: `Payment made - ${bill.billNo}`, charge: 0, payment: money(payment.amount), billId: bill._id })),
    ]).sort((a, b) => new Date(a.date) - new Date(b.date));
    let balance = 0; for (const item of transactions) { balance = money(balance + item.charge - item.payment); item.balance = balance; }
    return res.json({ party: { name: bills[0]?.vendorName || vendor }, asOf, transactions, balanceDue: balance });
  } catch (error) { return res.status(500).json({ message: "Failed to load supplier statement.", error: error.message }); }
};

const PROFIT_LOSS_GROUPS = [
  { key: "income", label: "Income" },
  { key: "cogs", label: "Cost of Goods Sold" },
  { key: "operating_expenses", label: "Operating Expenses" },
  { key: "other_income", label: "Other Income" },
  { key: "other_expenses", label: "Other Expenses" },
];

const profitLossGroupForAccount = (account = {}) => {
  const subtype = clean(account.subType).toLowerCase();
  const name = clean(account.name).toLowerCase();
  if (account.type === "revenue") {
    return subtype.includes("other") || subtype.includes("non-operating") || name.includes("interest income")
      ? "other_income"
      : "income";
  }
  if (subtype.includes("cost of goods") || subtype.includes("direct expense") || name.includes("cost of goods") || name === "purchases") return "cogs";
  if (subtype.includes("other") || subtype.includes("non-operating") || name.includes("interest expense") || name.includes("finance cost")) return "other_expenses";
  return "operating_expenses";
};

const aggregateAccrualProfitLoss = async (range) => JournalEntry.aggregate([
  { $match: { ...ledgerMatchForRange(range), sourceType: { $nin: ["opening_balance", "fiscal_closing"] } } },
  { $unwind: "$lines" },
  { $lookup: { from: "accounts", localField: "lines.account", foreignField: "_id", as: "account" } },
  { $unwind: "$account" },
  { $match: { "account.type": { $in: ["revenue", "expense"] }, "account.isGroup": { $ne: true } } },
  { $group: {
    _id: "$account._id",
    account: { $first: { _id: "$account._id", code: "$account.code", name: "$account.name", type: "$account.type", subType: "$account.subType", currency: "$account.currency" } },
    debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" }, voucherCount: { $sum: 1 },
  } },
  { $project: { account: 1, voucherCount: 1, amount: { $cond: [{ $eq: ["$account.type", "revenue"] }, { $subtract: ["$credit", "$debit"] }, { $subtract: ["$debit", "$credit"] }] } } },
  { $sort: { "account.code": 1 } },
]).allowDiskUse(true);

const aggregateDirectCashProfitLoss = async (range, cashLedgerIds) => {
  if (!cashLedgerIds.length) return [];
  return JournalEntry.aggregate([
    { $match: { ...ledgerMatchForRange(range), sourceType: { $nin: ["opening_balance", "fiscal_closing"] }, "lines.account": { $in: cashLedgerIds } } },
    { $unwind: "$lines" },
    { $lookup: { from: "accounts", localField: "lines.account", foreignField: "_id", as: "account" } },
    { $unwind: "$account" },
    { $match: { "account.type": { $in: ["revenue", "expense"] }, "account.isGroup": { $ne: true } } },
    { $group: {
      _id: "$account._id",
      account: { $first: { _id: "$account._id", code: "$account.code", name: "$account.name", type: "$account.type", subType: "$account.subType", currency: "$account.currency" } },
      debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" }, voucherCount: { $sum: 1 },
    } },
    { $project: { account: 1, voucherCount: 1, amount: { $cond: [{ $eq: ["$account.type", "revenue"] }, { $subtract: ["$credit", "$debit"] }, { $subtract: ["$debit", "$credit"] }] } } },
  ]).allowDiskUse(true);
};

const cashSettlementProfitLossRows = async (range) => {
  const paidAt = {};
  if (range.from) paidAt.$gte = range.from;
  if (range.to) paidAt.$lte = range.to;
  const paymentDateMatch = Object.keys(paidAt).length ? { "payments.paidAt": paidAt } : {};
  const [invoicePayments, billPayments] = await Promise.all([
    Invoice.aggregate([
      { $unwind: "$payments" }, { $match: { ...paymentDateMatch, "payments.journalEntry": { $ne: null }, status: { $ne: "void" } } },
      { $lookup: { from: "journalentries", localField: "payments.journalEntry", foreignField: "_id", as: "paymentJournal" } },
      { $match: { "paymentJournal.status": "posted" } },
      { $lookup: { from: "journalentries", let: { documentId: "$_id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$sourceId", "$$documentId"] }, { $eq: ["$sourceType", "invoice"] }, { $in: ["$status", ACTIVE_LEDGER_STATUSES] }] } } }], as: "sourceJournal" } },
      { $project: { journalId: { $arrayElemAt: ["$sourceJournal._id", 0] }, amount: "$payments.amount", total: "$total" } },
      { $match: { journalId: { $ne: null }, amount: { $gt: 0 }, total: { $gt: 0 } } },
    ]).allowDiskUse(true),
    VendorBill.aggregate([
      { $unwind: "$payments" }, { $match: { ...paymentDateMatch, "payments.journalEntry": { $ne: null }, status: { $ne: "void" }, journalEntry: { $ne: null } } },
      { $lookup: { from: "journalentries", localField: "payments.journalEntry", foreignField: "_id", as: "paymentJournal" } },
      { $match: { "paymentJournal.status": "posted" } },
      { $project: { journalId: "$journalEntry", amount: "$payments.amount", total: "$total" } },
      { $match: { amount: { $gt: 0 }, total: { $gt: 0 } } },
    ]).allowDiskUse(true),
  ]);
  const allocations = [...invoicePayments, ...billPayments];
  if (!allocations.length) return [];
  const journalIds = [...new Map(allocations.map((item) => [String(item.journalId), item.journalId])).values()];
  const journals = await JournalEntry.find({ _id: { $in: journalIds }, status: { $in: ACTIVE_LEDGER_STATUSES } }).select("lines").lean();
  const accountIds = [...new Map(journals.flatMap((entry) => entry.lines || []).map((line) => [String(line.account), line.account])).values()];
  const accounts = await Account.find({ _id: { $in: accountIds }, type: { $in: ["revenue", "expense"] }, isGroup: { $ne: true } }).select("code name type subType currency").lean();
  const accountMap = new Map(accounts.map((account) => [String(account._id), account]));
  const journalMap = new Map(journals.map((entry) => [String(entry._id), entry]));
  const rows = new Map();
  for (const allocation of allocations) {
    const ratio = Math.min(Math.max(Number(allocation.amount || 0) / Number(allocation.total || 1), 0), 1);
    const source = journalMap.get(String(allocation.journalId));
    for (const line of source?.lines || []) {
      const account = accountMap.get(String(line.account));
      if (!account) continue;
      const base = account.type === "revenue" ? Number(line.credit || 0) - Number(line.debit || 0) : Number(line.debit || 0) - Number(line.credit || 0);
      const existing = rows.get(String(account._id)) || { account, amount: 0, voucherCount: 0 };
      existing.amount = money(existing.amount + base * ratio); existing.voucherCount += 1; rows.set(String(account._id), existing);
    }
  }
  return [...rows.values()];
};

const aggregateCashProfitLoss = async (range) => {
  const [cashAccounts, bankAccounts] = await Promise.all([
    CashAccount.find({ isActive: { $ne: false } }).select("account").lean(),
    BankAccount.find({ status: "active", ledgerAccount: { $ne: null } }).select("ledgerAccount").lean(),
  ]);
  const cashLedgerIds = [...new Map([...cashAccounts.map((item) => item.account), ...bankAccounts.map((item) => item.ledgerAccount)].filter(Boolean).map((id) => [String(id), id])).values()];
  const [directRows, settlementRows] = await Promise.all([aggregateDirectCashProfitLoss(range, cashLedgerIds), cashSettlementProfitLossRows(range)]);
  const merged = new Map();
  for (const row of [...directRows, ...settlementRows]) {
    const key = String(row.account?._id || row._id);
    const existing = merged.get(key) || { account: row.account, amount: 0, voucherCount: 0 };
    existing.amount = money(existing.amount + Number(row.amount || 0)); existing.voucherCount += Number(row.voucherCount || 0); merged.set(key, existing);
  }
  return [...merged.values()].sort((a, b) => clean(a.account?.code).localeCompare(clean(b.account?.code)));
};

const previousProfitLossRanges = (range, comparison) => {
  const ranges = { current: range };
  const duration = range.to.getTime() - range.from.getTime();
  if (["prior_period", "both"].includes(comparison)) {
    const to = new Date(range.from.getTime() - 1); const from = new Date(to.getTime() - duration);
    ranges.priorPeriod = { from, to };
  }
  if (["prior_year", "both"].includes(comparison)) {
    const from = new Date(range.from); const to = new Date(range.to);
    from.setUTCFullYear(from.getUTCFullYear() - 1); to.setUTCFullYear(to.getUTCFullYear() - 1);
    ranges.priorYear = { from, to };
  }
  return ranges;
};

const profitLossSummary = (totals = {}) => {
  const revenue = money(totals.income || 0); const costOfGoodsSold = money(totals.cogs || 0);
  const grossProfit = money(revenue - costOfGoodsSold); const operatingExpenses = money(totals.operating_expenses || 0);
  const netOperatingIncome = money(grossProfit - operatingExpenses); const otherIncome = money(totals.other_income || 0); const otherExpenses = money(totals.other_expenses || 0);
  const netProfit = money(netOperatingIncome + otherIncome - otherExpenses);
  return { revenue, totalIncome: revenue, costOfGoodsSold, grossProfit, operatingExpenses, netOperatingIncome, otherIncome, otherExpenses, netProfit, netMargin: revenue ? money((netProfit / revenue) * 100) : 0 };
};

export const getProfitLoss = async (req, res) => {
  try {
    let range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const settings = await AccountingSettings.findOne({ key: "company" }).select("legalName currency accountingMethod defaultFiscalYear").lean();
    if (!range.to) { range.to = new Date(); range.to.setHours(23, 59, 59, 999); }
    if (!range.from) {
      range.from = (await FiscalYear.findOne({ startDate: { $lte: range.to }, endDate: { $gte: range.to } }).select("startDate").lean())?.startDate || new Date(range.to.getFullYear(), 0, 1);
      range.from = new Date(range.from); range.from.setHours(0, 0, 0, 0);
    }
    if (range.from > range.to) return res.status(400).json({ message: "From date cannot be after to date." });
    const basis = ["accrual", "cash"].includes(clean(req.query.basis).toLowerCase()) ? clean(req.query.basis).toLowerCase() : settings?.accountingMethod || "accrual";
    const comparison = ["none", "prior_period", "prior_year", "both"].includes(clean(req.query.comparison).toLowerCase()) ? clean(req.query.comparison).toLowerCase() : "none";
    const cacheId = cacheKey("profit-loss", req.query, `${basis}:${comparison}`);
    const cached = accountingCache.get(cacheId); if (cached) return res.json(cached);
    const ranges = previousProfitLossRanges(range, comparison); const periodKeys = Object.keys(ranges);
    const periodRows = Object.fromEntries(await Promise.all(periodKeys.map(async (key) => [key, await (basis === "cash" ? aggregateCashProfitLoss(ranges[key]) : aggregateAccrualProfitLoss(ranges[key]))])));
    const accountRows = new Map();
    for (const key of periodKeys) for (const row of periodRows[key]) {
      const id = String(row.account?._id || row._id); const existing = accountRows.get(id) || { account: row.account, values: {}, voucherCount: 0 };
      existing.values[key] = money(row.amount); if (key === "current") existing.voucherCount = Number(row.voucherCount || 0); accountRows.set(id, existing);
    }
    const grouped = Object.fromEntries(PROFIT_LOSS_GROUPS.map((group) => [group.key, []]));
    for (const row of accountRows.values()) grouped[profitLossGroupForAccount(row.account)].push(row);
    const periodTotals = Object.fromEntries(periodKeys.map((key) => [key, {}]));
    const groups = PROFIT_LOSS_GROUPS.map((definition) => {
      const rows = grouped[definition.key].sort((a, b) => clean(a.account?.code).localeCompare(clean(b.account?.code)));
      const totals = Object.fromEntries(periodKeys.map((key) => [key, money(rows.reduce((sum, row) => sum + Number(row.values[key] || 0), 0))]));
      for (const key of periodKeys) periodTotals[key][definition.key] = totals[key];
      return { ...definition, rows, totals };
    });
    const summary = profitLossSummary(periodTotals.current); summary.cashCollected = basis === "cash" ? money(summary.revenue + summary.otherIncome) : 0; summary.dealCount = 0; summary.expenseCount = groups.find((group) => group.key === "operating_expenses")?.rows.length || 0;
    const comparisonSummaries = Object.fromEntries(periodKeys.filter((key) => key !== "current").map((key) => [key, profitLossSummary(periodTotals[key])]));
    const totalIncome = summary.revenue;
    for (const group of groups) for (const row of group.rows) {
      row.amount = money(row.values.current || 0); row.percentOfIncome = totalIncome ? money((row.amount / totalIncome) * 100) : 0;
      row.comparison = Object.fromEntries(periodKeys.filter((key) => key !== "current").map((key) => [key, money(row.values[key] || 0)]));
      row.variancePercent = Object.fromEntries(periodKeys.filter((key) => key !== "current").map((key) => { const previous = Number(row.values[key] || 0); return [key, previous ? money(((row.amount - previous) / Math.abs(previous)) * 100) : null]; }));
    }
    const response = {
      company: { legalName: settings?.legalName || "Company", currency: settings?.currency || "BDT" }, basis, comparison,
      periods: Object.fromEntries(periodKeys.map((key) => [key, { from: ranges[key].from, to: ranges[key].to }])),
      groups, summary, comparisons: comparisonSummaries,
      revenueByCurrency: [{ currency: settings?.currency || "BDT", revenue: summary.revenue, count: groups.find((group) => group.key === "income")?.rows.length || 0 }],
      expensesByCategory: groups.filter((group) => ["cogs", "operating_expenses", "other_expenses"].includes(group.key)).flatMap((group) => group.rows.map((row) => ({ category: row.account?.name, amount: row.amount, count: row.voucherCount }))),
      basisDescription: basis === "cash" ? "Cash basis uses posted cash/bank journals plus the paid proportion of GL-posted customer invoices and supplier bills." : "Accrual basis uses revenue and expense lines from posted and reversing General Ledger vouchers in the selected period.",
    };
    accountingCache.set(cacheId, response); return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load profit and loss.", error: error.message });
  }
};

export const bootstrapChartOfAccounts = async (req, res) => {
  try {
    const { created, updated } = await provisionSystemAccounts({
      userId: req.user?._id || null,
      updateExisting: true,
    });
    return res.json({ message: "Chart of accounts bootstrapped.", created: created.length, updated: updated.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to bootstrap accounts.", error: error.message });
  }
};

const SETTINGS_ACCOUNT_FIELDS = [
  "defaultCashAccount",
  "defaultBankAccount",
  "salesAccount",
  "purchaseAccount",
  "cogsAccount",
  "receivableAccount",
  "payableAccount",
  "inventoryAccount",
  "inventoryClearingAccount",
  "purchasePriceVarianceAccount",
  "inventoryAdjustmentAccount",
  "furnitureAccount",
  "loanAccount",
  "payrollExpenseAccount",
  "payrollPayableAccount",
  "retainedEarningsAccount",
  "exchangeGainAccount",
  "exchangeLossAccount",
  "roundingAccount",
  "vatPayableAccount",
  "vatReceivableAccount",
  "vatAccount",
];

const SETTINGS_ACCOUNT_LABELS = {
  defaultCashAccount: "Default Cash",
  defaultBankAccount: "Default Bank",
  salesAccount: "Sales / Income",
  purchaseAccount: "Purchases",
  cogsAccount: "Cost of Goods Sold",
  receivableAccount: "Accounts Receivable Control",
  payableAccount: "Accounts Payable Control",
  inventoryAccount: "Inventory Control",
  inventoryClearingAccount: "Goods Received Not Invoiced",
  purchasePriceVarianceAccount: "Purchase Price Variance",
  inventoryAdjustmentAccount: "Inventory Adjustment Gain or Loss",
  furnitureAccount: "Furniture",
  loanAccount: "Loan",
  payrollExpenseAccount: "Payroll Expense",
  payrollPayableAccount: "Payroll Payable",
  retainedEarningsAccount: "Retained Earnings",
  exchangeGainAccount: "Exchange Gain",
  exchangeLossAccount: "Exchange Loss",
  roundingAccount: "Rounding Off",
  vatPayableAccount: "VAT Payable",
  vatReceivableAccount: "VAT Receivable",
  vatAccount: "Legacy VAT Account",
};

const normalizedAccountText = (account) =>
  [account?.code, account?.name, account?.subType]
    .map((value) => clean(value).toLowerCase())
    .join(" ");

const matchesSettingsAccountPurpose = (field, account, links) => {
  if (!account || account.isGroup || account.isActive === false) return false;

  const id = String(account._id);
  const text = normalizedAccountText(account);
  const isType = (type) => account.type === type;
  const hasText = (...values) => values.some((value) => text.includes(value));

  switch (field) {
    case "defaultCashAccount":
      return (
        isType("asset") &&
        !links.bankLedgerIds.has(id) &&
        (links.cashLedgerIds.has(id) ||
          account.code === "1000" ||
          (hasText("cash", "petty cash") && !hasText("bank")))
      );
    case "defaultBankAccount":
      return isType("asset") && links.bankLedgerIds.has(id);
    case "salesAccount":
      return (
        isType("revenue") &&
        (account.code === "4000" ||
          hasText("sales", "operating income", "service revenue"))
      );
    case "purchaseAccount":
      return (
        isType("expense") &&
        (account.code === "5010" ||
          hasText("purchase", "cost of goods", "cost of sales"))
      );
    case "cogsAccount":
      return (
        isType("expense") &&
        (account.code === "5020" || hasText("cost of goods sold", "cost of sales", "cogs"))
      );
    case "receivableAccount":
      return isType("asset") && account.controlType === "receivable";
    case "payableAccount":
      return isType("liability") && account.controlType === "payable";
    case "inventoryAccount":
      return isType("asset") && account.controlType === "inventory";
    case "inventoryClearingAccount":
      return isType("liability") && (account.code === "2050" || hasText("goods received not invoiced", "grni", "inventory clearing"));
    case "purchasePriceVarianceAccount":
      return isType("expense") && (account.code === "5030" || hasText("purchase price variance"));
    case "inventoryAdjustmentAccount":
      return isType("expense") && (account.code === "5040" || hasText("inventory adjustment", "stock adjustment"));
    case "furnitureAccount":
      return (
        isType("asset") &&
        (account.code === "1500" || hasText("furniture", "fixtures"))
      );
    case "loanAccount":
      return (
        isType("liability") &&
        (links.loanLedgerIds.has(id) ||
          account.code === "2300" ||
          hasText("loan", "borrowings"))
      );
    case "payrollExpenseAccount":
      return (
        isType("expense") &&
        (["5100", "5110"].includes(account.code) ||
          hasText("payroll", "salary expense", "wages expense"))
      );
    case "payrollPayableAccount":
      return (
        isType("liability") &&
        (account.code === "2200" ||
          hasText("payroll payable", "salary payable", "wages payable"))
      );
    case "retainedEarningsAccount":
      return (
        isType("equity") &&
        (account.code === "3200" || hasText("retained earnings"))
      );
    case "exchangeGainAccount":
      return (
        isType("revenue") &&
        hasText("exchange gain", "forex gain", "currency gain")
      );
    case "exchangeLossAccount":
      return (
        isType("expense") &&
        hasText("exchange loss", "forex loss", "currency loss")
      );
    case "roundingAccount":
      return (
        ["expense", "revenue"].includes(account.type) &&
        hasText("rounding", "round off", "round-off")
      );
    case "vatPayableAccount":
      return (
        isType("liability") &&
        account.controlType === "tax" &&
        hasText("vat", "tax")
      );
    case "vatReceivableAccount":
      return (
        isType("asset") &&
        account.controlType === "tax" &&
        hasText("vat", "tax")
      );
    case "vatAccount":
      return (
        ["asset", "liability"].includes(account.type) &&
        account.controlType === "tax"
      );
    default:
      return false;
  }
};

const buildSettingsAccountOptions = async () => {
  const [accounts, cashLinks, bankLinks] = await Promise.all([
    Account.find({ isActive: true, isGroup: { $ne: true } })
      .select("code name type subType controlType currency isActive isGroup")
      .sort({ type: 1, code: 1, _id: 1 })
      .lean(),
    CashAccount.find({
      isActive: { $ne: false },
      type: "cash",
      account: { $ne: null },
    })
      .select("account")
      .lean(),
    BankAccount.find({
      status: "active",
      ledgerAccount: { $ne: null },
    })
      .select("ledgerAccount accountType")
      .lean(),
  ]);

  const links = {
    cashLedgerIds: new Set(cashLinks.map((item) => String(item.account))),
    bankLedgerIds: new Set(
      bankLinks
        .filter((item) => !["loan", "credit_card"].includes(item.accountType))
        .map((item) => String(item.ledgerAccount))
    ),
    loanLedgerIds: new Set(
      bankLinks
        .filter((item) => item.accountType === "loan")
        .map((item) => String(item.ledgerAccount))
    ),
  };

  return Object.fromEntries(
    SETTINGS_ACCOUNT_FIELDS.map((field) => [
      field,
      accounts.filter((account) =>
        matchesSettingsAccountPurpose(field, account, links)
      ),
    ])
  );
};

const populateSettings = (query) =>
  query.populate([
    ...SETTINGS_ACCOUNT_FIELDS.map((path) => ({
      path,
      select: "code name type subType controlType currency isActive isGroup",
    })),
    { path: "defaultFiscalYear", select: "name startDate endDate status" },
    { path: "updatedBy", select: "name email role" },
  ]);

export const getAccountingSettings = async (req, res) => {
  try {
    let settings = await populateSettings(AccountingSettings.findOne({ key: "company" }));
    if (!settings) settings = await AccountingSettings.create({ key: "company" });
    settings = await populateSettings(AccountingSettings.findById(settings._id));
    const accountOptions = await buildSettingsAccountOptions();
    return res.json({ settings, accountOptions });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load accounting settings.", error: error.message });
  }
};

export const updateAccountingSettings = async (req, res) => {
  try {
    const before = await AccountingSettings.findOne({ key: "company" }).lean();
    const patch = {};
    for (const key of [
      "legalName", "address", "taxId", "vatRegistrationNumber", "fiscalYearStartMonth", "fiscalYearStartDay",
      "currency", "multiCurrencyEnabled", "accountingMethod", "roundingPrecision", "voucherPrefix", "voucherNumberLength",
      "voucherReset", "voucherFormat", "numberingRules", "approvalEnabled", "journalApprovalThreshold", "lockDate",
      "periodCloseRequireReconciliation", "defaultTaxScheme", "taxCalculationMethod",
    ]) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    for (const key of SETTINGS_ACCOUNT_FIELDS) {
      if (req.body[key] !== undefined) {
        if (req.body[key] && !isId(req.body[key])) return res.status(400).json({ message: `${key} must be a valid account.` });
        patch[key] = req.body[key] || null;
      }
    }
    if (req.body.defaultFiscalYear !== undefined) {
      if (req.body.defaultFiscalYear && !isId(req.body.defaultFiscalYear)) return res.status(400).json({ message: "defaultFiscalYear must be a valid fiscal year." });
      if (req.body.defaultFiscalYear && !(await FiscalYear.exists({ _id: req.body.defaultFiscalYear }))) return res.status(400).json({ message: "Selected fiscal year does not exist." });
      patch.defaultFiscalYear = req.body.defaultFiscalYear || null;
    }
    const ids = SETTINGS_ACCOUNT_FIELDS.map((key) => patch[key]).filter(Boolean);
    if (ids.length) {
      const uniqueIds = [...new Set(ids.map(String))];
      const selectedAccounts = await Account.find({
        _id: { $in: uniqueIds },
        isActive: true,
        isGroup: { $ne: true },
      }).select("_id code name type subType controlType currency isActive isGroup").lean();
      if (selectedAccounts.length !== uniqueIds.length) return res.status(400).json({ message: "All selected default accounts must be active accounts." });

      const accountOptions = await buildSettingsAccountOptions();
      const eligibleByField = new Map(
        Object.entries(accountOptions).map(([field, options]) => [
          field,
          new Set(options.map((account) => String(account._id))),
        ])
      );

      for (const field of SETTINGS_ACCOUNT_FIELDS) {
        const accountId = patch[field];
        if (
          accountId &&
          !eligibleByField.get(field)?.has(String(accountId))
        ) {
          return res.status(400).json({
            message: `${SETTINGS_ACCOUNT_LABELS[field] || field} does not match the required accounting purpose.`,
          });
        }
      }
    }
    patch.updatedBy = req.user?._id || null;
    const settings = await populateSettings(AccountingSettings.findOneAndUpdate(
      { key: "company" },
      { $set: patch, $setOnInsert: { key: "company" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ));
    await writeAudit({ actorId: req.user?._id, action: "update", entityType: "AccountingSettings", entityId: settings._id, before, after: settings.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Accounting settings saved.", settings });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save accounting settings.", error: error.message });
  }
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const generatePeriods = async (fiscalYear, userId) => {
  const step = fiscalYear.periodFrequency === "quarterly" ? 3 : 1;
  const rows = [];
  let cursor = new Date(fiscalYear.startDate);
  let sequence = 1;
  while (cursor <= fiscalYear.endDate) {
    const startDate = new Date(cursor);
    const nextStart = addMonths(startDate, step);
    const endDate = new Date(Math.min(nextStart.getTime() - 1, fiscalYear.endDate.getTime()));
    const label = fiscalYear.periodFrequency === "quarterly" ? `Q${sequence}` : startDate.toLocaleString("en", { month: "long", timeZone: "UTC" });
    const periodKey = `${fiscalYear.name}-${fiscalYear.periodFrequency === "quarterly" ? `Q${sequence}` : String(sequence).padStart(2, "0")}`;
    rows.push({
      updateOne: {
        filter: { periodKey },
        update: { $setOnInsert: { periodKey, fiscalYear: fiscalYear.name, fiscalYearRef: fiscalYear._id, periodType: fiscalYear.periodFrequency, name: `${label} (${fiscalYear.name})`, startDate, endDate, status: "open", closedBy: null, lockedBy: null, note: "" } },
        upsert: true,
      },
    });
    cursor = nextStart;
    sequence += 1;
  }
  if (rows.length) await AccountingPeriod.bulkWrite(rows);
};

export const listFiscalYears = async (req, res) => {
  try {
    const fiscalYears = await FiscalYear.find({}).sort({ startDate: -1 }).lean();
    return res.json({ fiscalYears });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load fiscal years.", error: error.message });
  }
};

export const createFiscalYear = async (req, res) => {
  try {
    const startDate = parsePostingDate(req.body.startDate, null);
    const endDate = parsePostingDate(req.body.endDate, null);
    if (!startDate || !endDate || startDate >= endDate) return res.status(400).json({ message: "Fiscal year start date must be before its end date." });
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);
    const overlap = await FiscalYear.findOne({ startDate: { $lte: endDate }, endDate: { $gte: startDate } }).lean();
    if (overlap) return res.status(409).json({ message: `Dates overlap fiscal year ${overlap.name}.` });
    const isCurrentYear = req.body.isCurrentYear === true || !(await FiscalYear.exists({ isCurrentYear: true, status: "open" }));
    if (isCurrentYear) await FiscalYear.updateMany({ isCurrentYear: true }, { $set: { isCurrentYear: false } });
    const fiscalYear = await FiscalYear.create({
      name: clean(req.body.name),
      startDate,
      endDate,
      periodFrequency: clean(req.body.periodFrequency || "monthly"),
      isCurrentYear,
      note: clean(req.body.note),
      createdBy: req.user?._id || null,
    });
    await generatePeriods(fiscalYear, req.user?._id || null);
    await writeAudit({ actorId: req.user?._id, action: "create", entityType: "FiscalYear", entityId: fiscalYear._id, after: fiscalYear.toObject(), meta: getReqMeta(req) });
    return res.status(201).json({ message: "Fiscal year and accounting periods created.", fiscalYear });
  } catch (error) {
    const status = error?.code === 11000 ? 409 : 500;
    return res.status(status).json({ message: status === 409 ? "Fiscal year name or dates already exist." : "Failed to create fiscal year.", error: error.message });
  }
};

export const listAccounts = async (req, res) => {
  try {
    await provisionSystemAccounts({ userId: req.user?._id || null });
    const requestedLimit = Number(req.query.limit || 200);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 200;
    const filter = {};
    if (req.query.type) filter.type = clean(req.query.type);
    if (req.query.active !== undefined && req.query.active !== "all") filter.isActive = String(req.query.active) === "true";
    if (req.query.q) {
      const rx = textRegex(req.query.q);
      filter.$or = [{ code: rx }, { name: rx }];
    }
    const accounts = await Account.find(filter)
      .populate("parent", "code name type")
      .sort({ type: 1, code: 1, _id: 1 })
      .limit(limit)
      .lean();
    const [linkedBankLedgerIds, activeChildParentIds] = accounts.length
      ? await Promise.all([
          BankAccount.distinct("ledgerAccount", {
            ledgerAccount: { $in: accounts.map((account) => account._id) },
          }),
          Account.distinct("parent", {
            parent: { $in: accounts.map((account) => account._id) },
            isActive: true,
          }),
        ])
      : [[], []];
    const linkedBankLedgerSet = new Set(linkedBankLedgerIds.map(String));
    const activeChildParentSet = new Set(activeChildParentIds.map(String));
    for (const account of accounts) {
      account.isBankManaged =
        account.code === "1010" || linkedBankLedgerSet.has(String(account._id));
      account.hasActiveChildren = activeChildParentSet.has(String(account._id));
    }
    if (String(req.query.includeBalances) === "true" && accounts.length) {
      const balances = await JournalEntry.aggregate([
        { $match: { status: { $in: ACTIVE_LEDGER_STATUSES } } },
        { $unwind: "$lines" },
        { $match: { "lines.account": { $in: accounts.map((account) => account._id) } } },
        { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
      ]);
      const map = new Map(balances.map((row) => [String(row._id), row]));
      for (const account of accounts) {
        const row = map.get(String(account._id)) || { debit: 0, credit: 0 };
        account.currentBalance = money(["asset", "expense"].includes(account.type) ? row.debit - row.credit : row.credit - row.debit);
      }
    }
    return res.json({ accounts, count: accounts.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load accounts.", error: error.message });
  }
};

export const createAccount = async (req, res) => {
  try {
    let parent = null;
    if (req.body.parent) {
      parent = await Account.findById(req.body.parent).lean();
      if (!parent || !parent.isGroup) return res.status(400).json({ message: "Parent account must be an active group account." });
      if (parent.type !== req.body.type) return res.status(400).json({ message: "Parent and child account types must match." });
    }
    const account = await Account.create({
      code: req.body.code,
      name: req.body.name,
      type: req.body.type,
      parent: parent?._id || null,
      subType: clean(req.body.subType),
      isGroup: Boolean(req.body.isGroup),
      isControlAccount: Boolean(req.body.isControlAccount),
      controlType: req.body.isControlAccount ? clean(req.body.controlType) : "",
      taxApplicability: clean(req.body.taxApplicability || "none"),
      currency: clean(req.body.currency || "BDT"),
      description: clean(req.body.description),
      createdBy: req.user?._id || null,
    });
    return res.status(201).json({ message: "Account created.", account });
  } catch (error) {
    const status = error?.code === 11000 ? 409 : 500;
    return res.status(status).json({ message: status === 409 ? "Account code already exists." : "Failed to create account.", error: error.message });
  }
};

export const updateAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid account ID." });

    const current = await Account.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ message: "Account not found." });

    if (current.isSystem) {
      const lockedFields = CORE_SYSTEM_ACCOUNT_CODES.has(current.code)
        ? CORE_ACCOUNT_LOCKED_FIELDS
        : SYSTEM_ACCOUNT_LOCKED_FIELDS;
      const attemptedLockedField = Object.keys(req.body || {}).find((key) => lockedFields.has(key));

      if (attemptedLockedField) {
        return res.status(409).json({
          message: CORE_SYSTEM_ACCOUNT_CODES.has(current.code)
            ? "Fundamental Chart of Accounts roots are protected. Only the description can be updated."
            : `System account structure is protected. ${attemptedLockedField} cannot be changed.`,
        });
      }
    }

    const patch = {};
    const editableFields = [
      "code",
      "name",
      "type",
      "subType",
      "currency",
      "description",
      "isActive",
      "isGroup",
      "isControlAccount",
      "controlType",
      "taxApplicability",
    ];

    for (const key of editableFields) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    if (req.body.isActive === false) {
      const activeChild = await Account.exists({ parent: current._id, isActive: true });
      if (activeChild) {
        return res.status(409).json({
          message: "Deactivate or move the active child accounts before deactivating this group.",
        });
      }
    }

    if (
      req.body.isGroup === true &&
      await JournalEntry.exists({ "lines.account": current._id })
    ) {
      return res.status(409).json({
        message: "An account with posting history cannot be converted into a group.",
      });
    }

    if (req.body.parent !== undefined) {
      if (!req.body.parent) {
        patch.parent = null;
      } else {
        if (!isId(req.body.parent) || String(req.body.parent) === String(current._id)) {
          return res.status(400).json({ message: "Invalid parent account." });
        }

        const parent = await Account.findById(req.body.parent).lean();
        const nextType = req.body.type || current.type;
        if (!parent?.isGroup || !parent.isActive || parent.type !== nextType) {
          return res.status(400).json({
            message: "Parent must be an active group of the same account type.",
          });
        }
        patch.parent = parent._id;
      }
    }

    if (Object.keys(patch).length) {
      patch.publishedAt = null;
      patch.publishedBy = null;
    }
    patch.updatedBy = req.user?._id || null;

    const account = await Account.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });
    if (!account) return res.status(404).json({ message: "Account not found." });

    accountingCache.flushAll();
    await writeAudit({
      actorId: req.user?._id,
      action: "update",
      entityType: "Account",
      entityId: account._id,
      before: current,
      after: account.toObject(),
      meta: getReqMeta(req),
    });

    return res.json({ message: "Account updated.", account });
  } catch (error) {
    const status = error?.code === 11000 ? 409 : error.statusCode || 500;
    return res.status(status).json({
      message: status === 409 ? error.message || "Account update conflicts with existing data." : "Failed to update account.",
      error: error.message,
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid account ID." });

    const account = await Account.findById(req.params.id).lean();
    if (!account) return res.status(404).json({ message: "Account not found." });

    if (account.isSystem) {
      return res.status(409).json({
        message: CORE_SYSTEM_ACCOUNT_CODES.has(account.code)
          ? "Assets, Liabilities, Equity, Income, and Expenses are fundamental system roots and cannot be deleted."
          : "Standard system accounts are protected and cannot be deleted. Deactivate a permitted custom account instead.",
      });
    }

    const [childAccount, journalUsage, openingBalanceUsage, cashUsage, bankUsage, settingsUsage] =
      await Promise.all([
        Account.exists({ parent: account._id }),
        JournalEntry.exists({ "lines.account": account._id }),
        OpeningBalance.exists({ "lines.account": account._id }),
        CashAccount.exists({ account: account._id }),
        BankAccount.exists({ ledgerAccount: account._id }),
        AccountingSettings.exists({
          $or: SETTINGS_ACCOUNT_FIELDS.map((field) => ({ [field]: account._id })),
        }),
      ]);

    if (childAccount) {
      return res.status(409).json({
        message: "This account has child accounts. Move or delete the children first.",
      });
    }
    if (journalUsage) {
      return res.status(409).json({
        message: "Accounts with journal history cannot be deleted. Set the account inactive instead.",
      });
    }
    if (openingBalanceUsage) {
      return res.status(409).json({
        message: "This account is used in an opening balance and cannot be deleted.",
      });
    }
    if (cashUsage || bankUsage) {
      return res.status(409).json({
        message: "This account is connected to Cash or Bank Management and cannot be deleted.",
      });
    }
    if (settingsUsage) {
      return res.status(409).json({
        message: "This account is selected in Accounting Settings. Replace that reference before deleting it.",
      });
    }

    await Account.findByIdAndDelete(account._id);
    accountingCache.flushAll();
    await writeAudit({
      actorId: req.user?._id,
      action: "delete",
      entityType: "Account",
      entityId: account._id,
      before: account,
      meta: getReqMeta(req),
    });

    return res.json({ message: "Custom account deleted." });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to delete account.",
      error: error.message,
    });
  }
};

export const publishChartOfAccounts = async (req, res) => {
  try {
    const invalid = await Account.findOne({ isActive: true, $or: [{ type: { $exists: false } }, { normalBalance: { $exists: false } }] }).lean();
    if (invalid) return res.status(400).json({ message: `Account ${invalid.code} is incomplete.` });
    const parentIds = await Account.distinct("parent", { isActive: true, parent: { $ne: null } });
    const nonGroupParent = await Account.findOne({ _id: { $in: parentIds }, isGroup: { $ne: true } }).lean();
    if (nonGroupParent) return res.status(400).json({ message: `Account ${nonGroupParent.code} has child accounts and must be marked as a group.` });
    const invalidControl = await Account.findOne({ isActive: true, isControlAccount: true, controlType: { $in: ["", null] } }).lean();
    if (invalidControl) return res.status(400).json({ message: `Control account ${invalidControl.code} requires a control type.` });
    const now = new Date();
    const result = await Account.updateMany({ isActive: true, publishedAt: null }, { $set: { publishedAt: now, publishedBy: req.user?._id || null } });
    await AccountingSettings.findOneAndUpdate({ key: "company" }, { $set: { coaPublishedAt: now, updatedBy: req.user?._id || null }, $setOnInsert: { key: "company" } }, { upsert: true });
    await writeAudit({ actorId: req.user?._id, action: "publish", entityType: "Account", entityId: (await Account.findOne({ isActive: true }).select("_id").lean())?._id, meta: getReqMeta(req) });
    return res.json({ message: "Chart of Accounts published.", published: result.modifiedCount, publishedAt: now });
  } catch (error) {
    return res.status(500).json({ message: "Failed to publish Chart of Accounts.", error: error.message });
  }
};

export const listVoucherTypes = async (req, res) => {
  try {
    await VoucherType.bulkWrite(DEFAULT_VOUCHER_TYPES.map((item) => ({
      updateOne: { filter: { key: item.key }, update: { $setOnInsert: item }, upsert: true },
    })));
    const filter = String(req.query.active || "true") === "all" ? {} : { isActive: String(req.query.active || "true") === "true" };
    const voucherTypes = await VoucherType.find(filter).sort({ code: 1 }).lean();
    return res.json({ voucherTypes });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load voucher types.", error: error.message });
  }
};

export const updateVoucherType = async (req, res) => {
  try {
    const key = clean(req.params.key).toLowerCase();
    if (!VOUCHER_TYPES.includes(key)) return res.status(400).json({ message: "Invalid voucher type." });
    const patch = { updatedBy: req.user?._id || null };
    for (const field of ["code", "name", "numberingRule", "defaultPattern", "applicableModule", "description", "isActive"]) {
      if (req.body[field] !== undefined) patch[field] = req.body[field];
    }
    const voucherType = await VoucherType.findOneAndUpdate({ key }, { $set: patch, $setOnInsert: { key, createdBy: req.user?._id || null } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    return res.json({ message: "Voucher type updated.", voucherType });
  } catch (error) {
    return res.status(error?.code === 11000 ? 409 : 500).json({ message: error?.code === 11000 ? "Voucher code already exists." : "Failed to update voucher type.", error: error.message });
  }
};

export const listJournalEntries = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const limit = parseLimit(req.query.limit);
    const cursor = listCursor(req.query.cursor);
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
    if (req.query.sourceType) filter.sourceType = clean(req.query.sourceType);
    if (req.query.voucherType && req.query.voucherType !== "all") filter.voucherType = clean(req.query.voucherType);
    if (isId(req.query.preparedBy)) filter.createdBy = req.query.preparedBy;
    const search = textRegex(req.query.q);
    if (search) filter.$and = [{ $or: [{ entryNo: search }, { memo: search }, { reference: search }, { "lines.description": search }] }];
    if (range.from || range.to) filter.date = {};
    if (range.from) filter.date.$gte = range.from;
    if (range.to) filter.date.$lte = range.to;
    if (cursor) {
      filter.$or = [{ date: { $lt: cursor.date } }, { date: cursor.date, _id: { $lt: cursor.id } }];
    }
    const rows = await JournalEntry.find(filter)
      .populate("lines.account", "code name type normalBalance")
      .populate("createdBy submittedBy approvedBy postedBy reversedBy", "name email role")
      .populate("reversalOf reversedByEntry", "entryNo date status voucherType")
      .sort({ date: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasNextPage = rows.length > limit;
    const journalEntries = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage && journalEntries.length ? makeListCursor(journalEntries[journalEntries.length - 1]) : "";
    return res.json({ journalEntries, pageInfo: { limit, hasNextPage, nextCursor } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load journal entries.", error: error.message });
  }
};

const populateJournal = (query) => query
  .populate("lines.account", "code name type normalBalance isActive isGroup")
  .populate("createdBy submittedBy approvedBy postedBy reversedBy", "name email role")
  .populate("fiscalYear", "name startDate endDate status")
  .populate("accountingPeriod", "periodKey name startDate endDate status")
  .populate("reversalOf reversedByEntry", "entryNo date status voucherType memo");

const journalApprovalRequired = async (entry) => {
  if (entry.origin === "system" || entry.sourceType !== "manual") return false;
  const settings = await AccountingSettings.findOne({ key: "company" }).select("approvalEnabled journalApprovalThreshold").lean();
  return Boolean(settings?.approvalEnabled && Number(entry.totalDebit || 0) > Number(settings.journalApprovalThreshold || 0));
};

const journalPeriodContext = async (date) => {
  const postingDate = parsePostingDate(date, null);
  if (!postingDate) throw Object.assign(new Error("Valid journal date is required."), { statusCode: 400 });
  const period = await assertOpenPeriod(postingDate);
  const fiscalYear = period?.fiscalYearRef || (await FiscalYear.findOne({ startDate: { $lte: postingDate }, endDate: { $gte: postingDate } }).select("_id").lean())?._id || null;
  return { postingDate, period: period?._id || null, fiscalYear };
};

export const getJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    const journalEntry = await populateJournal(JournalEntry.findById(req.params.id)).lean();
    if (!journalEntry) return res.status(404).json({ message: "Journal entry not found." });
    return res.json({ journalEntry });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load journal entry.", error: error.message });
  }
};

export const createJournalEntry = async (req, res) => {
  try {
    let status = clean(req.body.status || "posted");
    if (!["draft", "posted"].includes(status)) return res.status(400).json({ message: "Journal status must be draft or posted." });
    const normalizedLines = normalizeLines(req.body.lines);
    await assertPostableAccounts(normalizedLines);
    const context = await journalPeriodContext(req.body.date);
    const sourceType = clean(req.body.sourceType || "manual");
    const draftEntry = new JournalEntry({
      date: context.postingDate,
      status: "draft",
      voucherType: voucherTypeForSource(sourceType, req.body.voucherType),
      sourceType,
      origin: sourceType === "manual" ? "manual" : "system",
      fiscalYear: context.fiscalYear,
      accountingPeriod: context.period,
      sourceId: isId(req.body.sourceId) ? req.body.sourceId : null,
      reference: clean(req.body.reference), memo: clean(req.body.memo), currency: clean(req.body.currency || "BDT").toUpperCase(),
      paymentMode: clean(req.body.paymentMode).toLowerCase(), attachment: req.body.attachment || {}, lines: normalizedLines,
      createdBy: req.user?._id || null,
    });
    await draftEntry.validate();
    const approvalRequired = await journalApprovalRequired(draftEntry);
    if (status === "posted" && !approvalRequired) {
      const entry = await postJournalEntry({
        date: context.postingDate,
        lines: normalizedLines,
        sourceType,
        sourceId: req.body.sourceId,
        reference: req.body.reference,
        memo: req.body.memo,
        currency: req.body.currency,
        voucherType: req.body.voucherType,
        paymentMode: req.body.paymentMode,
        attachment: req.body.attachment,
        userId: req.user?._id || null,
      });
      await writeAudit({ actorId: req.user?._id, action: "create", entityType: "JournalEntry", entityId: entry._id, after: entry.toObject(), meta: getReqMeta(req) });
      return res.status(201).json({ message: "Journal entry posted.", journalEntry: entry });
    }
    draftEntry.status = approvalRequired && status === "posted" ? "pending_approval" : "draft";
    if (draftEntry.status === "pending_approval") {
      draftEntry.submittedAt = new Date();
      draftEntry.submittedBy = req.user?._id || null;
    }
    await draftEntry.save();
    await writeAudit({ actorId: req.user?._id, action: "create", entityType: "JournalEntry", entityId: draftEntry._id, after: draftEntry.toObject(), meta: getReqMeta(req) });
    return res.status(201).json({ message: approvalRequired && status === "posted" ? "Journal submitted for approval." : "Journal entry saved as draft.", approvalRequired, journalEntry: draftEntry });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to save journal entry.", error: error.message });
  }
};

export const updateDraftJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Journal entry not found." });
    if (entry.status !== "draft") return res.status(409).json({ message: "Only draft journal entries can be edited." });
    const context = await journalPeriodContext(req.body.date ?? entry.date);
    const lines = req.body.lines ? normalizeLines(req.body.lines) : entry.lines;
    await assertPostableAccounts(lines);
    entry.date = context.postingDate; entry.fiscalYear = context.fiscalYear; entry.accountingPeriod = context.period;
    entry.reference = clean(req.body.reference ?? entry.reference); entry.memo = clean(req.body.memo ?? entry.memo);
    entry.currency = clean(req.body.currency ?? entry.currency).toUpperCase(); entry.paymentMode = clean(req.body.paymentMode ?? entry.paymentMode).toLowerCase();
    entry.voucherType = voucherTypeForSource(entry.sourceType, req.body.voucherType ?? entry.voucherType);
    if (req.body.attachment !== undefined) entry.attachment = req.body.attachment || {};
    entry.lines = lines;
    await entry.save();
    await writeAudit({ actorId: req.user?._id, action: "update", entityType: "JournalEntry", entityId: entry._id, after: entry.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Draft journal updated.", journalEntry: entry });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to update draft journal.", error: error.message });
  }
};

export const submitJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Journal entry not found." });
    if (entry.status !== "draft") return res.status(409).json({ message: "Only draft journal entries can be submitted." });
    await journalPeriodContext(entry.date);
    await assertPostableAccounts(entry.lines);
    entry.submittedAt = new Date(); entry.submittedBy = req.user?._id || null;
    const approvalRequired = await journalApprovalRequired(entry);
    if (approvalRequired) entry.status = "pending_approval";
    else {
      await validateVoucherSettlements(entry);
      if (!entry.entryNo) entry.entryNo = await nextAccountingNumber(await numberingRuleForVoucher(entry.voucherType), entry.date);
      entry.status = "posted"; entry.postedAt = new Date(); entry.postedBy = req.user?._id || null;
    }
    await entry.save();
    if (!approvalRequired) await applyVoucherSettlements(entry, req.user?._id || null);
    accountingCache.flushAll();
    await writeAudit({ actorId: req.user?._id, action: approvalRequired ? "submit" : "confirm", entityType: "JournalEntry", entityId: entry._id, after: entry.toObject(), meta: getReqMeta(req) });
    return res.json({ message: approvalRequired ? "Journal submitted for approval." : "Journal entry posted.", approvalRequired, journalEntry: entry });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Failed to submit journal entry.", error: error.message });
  }
};

export const postDraftJournalEntry = submitJournalEntry;

export const approveJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Journal entry not found." });
    if (entry.status !== "pending_approval") return res.status(409).json({ message: "Only pending journal entries can be approved." });
    await journalPeriodContext(entry.date); await assertPostableAccounts(entry.lines);
    await validateVoucherSettlements(entry);
    if (!entry.entryNo) entry.entryNo = await nextAccountingNumber(await numberingRuleForVoucher(entry.voucherType), entry.date);
    entry.status = "posted"; entry.approvedAt = new Date(); entry.approvedBy = req.user?._id || null; entry.postedAt = new Date(); entry.postedBy = req.user?._id || null;
    await entry.save(); await applyVoucherSettlements(entry, req.user?._id || null); accountingCache.flushAll();
    await writeAudit({ actorId: req.user?._id, action: "approve", entityType: "JournalEntry", entityId: entry._id, after: entry.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Journal approved and posted.", journalEntry: entry });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Failed to approve journal entry.", error: error.message });
  }
};

export const reverseJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    let original; let reversal;
    await runAccountingWrite(async (session) => {
      original = await withAccountingSession(JournalEntry.findById(req.params.id), session);
      if (!original) throw Object.assign(new Error("Journal entry not found."), { statusCode: 404 });
      if (original.status !== "posted") throw Object.assign(new Error("Only posted journal entries can be reversed."), { statusCode: 409 });
      if (original.origin !== "manual") throw Object.assign(new Error("System-generated entries must be reversed from their source module."), { statusCode: 409 });
      const [completedReconciliation, legacyReconciledTransaction] = await Promise.all([
        withAccountingSession(BankReconciliation.exists({ status: { $in: ["completed", "reconciled"] }, "statementLines.matchedJournalEntry": original._id }), session),
        withAccountingSession(BankTransaction.exists({ journalEntry: original._id, reconciled: true }), session),
      ]);
      if (completedReconciliation || legacyReconciledTransaction) throw Object.assign(new Error("This voucher is locked by a completed bank reconciliation. Reopen that reconciliation before reversing it."), { statusCode: 409 });
      await reverseVoucherSettlements(original, session);
      const reversalDate = parsePostingDate(req.body.date, null);
      if (!reversalDate) throw Object.assign(new Error("Valid reversal date is required."), { statusCode: 400 });
      reversal = await createPostedJournal({
        date: reversalDate, sourceType: "manual", sourceId: original._id, voucherType: original.voucherType, origin: "manual",
        reference: clean(req.body.reference) || `REV-${original.entryNo}`, memo: clean(req.body.reason) || `Reversal of ${original.entryNo}`,
        currency: original.currency, userId: req.user?._id || null, session,
        lines: original.lines.map((line) => ({ account: line.account, debit: line.credit, credit: line.debit, description: `Reversal: ${line.description || original.memo}`, contactType: line.contactType, contactId: line.contactId, costCenter: line.costCenter, project: line.project, taxCode: line.taxCode })),
      });
      reversal.reversalOf = original._id; reversal.reversalReason = clean(req.body.reason);
      reversal.treasuryAccountType = original.treasuryAccountType; reversal.cashAccount = original.cashAccount; reversal.bankAccount = original.bankAccount;
      reversal.partyType = original.partyType; reversal.partyId = original.partyId; reversal.partyName = original.partyName;
      await reversal.save(accountingSessionOptions(session));
      original.status = "reversed"; original.reversedAt = new Date(); original.reversedBy = req.user?._id || null; original.reversedByEntry = reversal._id; original.reversalReason = clean(req.body.reason); await original.save(accountingSessionOptions(session));
    });
    accountingCache.flushAll();
    await writeAudit({ actorId: req.user?._id, action: "reverse", entityType: "JournalEntry", entityId: original._id, before: { status: "posted" }, after: original.toObject(), meta: { ...getReqMeta(req), reason: clean(req.body.reason) } });
    return res.json({ message: "Reversal journal posted with a complete audit link.", journalEntry: original, reversalEntry: reversal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to reverse journal entry.", error: error.message });
  }
};

export const voidJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Journal entry not found." });
    if (entry.status !== "posted") return res.status(409).json({ message: "Only posted journal entries can be voided." });
    if (entry.origin === "manual") return res.status(409).json({ message: "Manual posted journals must be corrected with a reversal entry." });
    await assertOpenPeriod(entry.date);
    entry.status = "void";
    entry.voidedAt = new Date();
    entry.voidedBy = req.user?._id || null;
    entry.voidReason = clean(req.body.reason);
    await entry.save();
    accountingCache.flushAll();
    return res.json({ message: "Journal entry voided.", journalEntry: entry });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to void journal entry.", error: error.message });
  }
};

export const listAccountingPeriods = async (req, res) => {
  try {
    const filter = req.query.fiscalYearRef && isId(req.query.fiscalYearRef) ? { fiscalYearRef: req.query.fiscalYearRef } : {};
    const periods = await AccountingPeriod.find(filter)
      .populate("fiscalYearRef", "name startDate endDate periodFrequency status")
      .sort({ startDate: -1, _id: -1 })
      .limit(parseLimit(req.query.limit, 60))
      .lean();
    return res.json({ periods });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load accounting periods.", error: error.message });
  }
};

export const upsertAccountingPeriod = async (req, res) => {
  try {
    const startDate = parsePostingDate(req.body.startDate);
    const endDate = parsePostingDate(req.body.endDate);
    if (!startDate || !endDate || startDate > endDate) return res.status(400).json({ message: "Valid start and end dates are required." });
    const periodKey = clean(req.body.periodKey);
    if (!periodKey) return res.status(400).json({ message: "Period key is required." });
    const period = await AccountingPeriod.findOneAndUpdate(
      { periodKey },
      {
        fiscalYear: clean(req.body.fiscalYear || periodKey.slice(0, 4)),
        name: clean(req.body.name || periodKey),
        startDate,
        endDate,
        status: clean(req.body.status || "open"),
        note: clean(req.body.note),
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ message: "Accounting period saved.", period });
  } catch (error) {
    return res.status(500).json({ message: "Failed to save accounting period.", error: error.message });
  }
};

export const closeAccountingPeriod = async (req, res) => {
  try {
    const current = await AccountingPeriod.findOne({ periodKey: req.params.periodKey }).lean();
    if (!current) return res.status(404).json({ message: "Accounting period not found." });
    const drafts = await JournalEntry.countDocuments({ status: "draft", date: { $gte: current.startDate, $lte: current.endDate } });
    if (drafts) return res.status(409).json({ message: `Period has ${drafts} unposted draft journal entr${drafts === 1 ? "y" : "ies"}. Post or void them before closing.` });
    const settings = await AccountingSettings.findOne({ key: "company" }).select("periodCloseRequireReconciliation").lean();
    if (settings?.periodCloseRequireReconciliation) {
      const [legacyUnreconciled, reconciledBankIds] = await Promise.all([
        CashAccount.countDocuments({ type: { $in: ["bank", "mobile_banking", "card"] }, isActive: true, $or: [{ lastReconciledAt: null }, { lastReconciledAt: { $lt: current.endDate } }] }),
        BankReconciliation.distinct("bankAccount", { status: "reconciled", statementDate: { $gte: current.endDate } }),
      ]);
      const connectedUnreconciled = await BankAccount.countDocuments({ status: "active", _id: { $nin: reconciledBankIds } });
      const unreconciled = legacyUnreconciled + connectedUnreconciled;
      if (unreconciled) return res.status(409).json({ message: `${unreconciled} active bank account(s) are not reconciled through the period end.` });
    }
    const period = await AccountingPeriod.findOneAndUpdate(
      { periodKey: req.params.periodKey, status: "open" },
      { status: "closed", closedAt: new Date(), closedBy: req.user?._id || null, note: clean(req.body.note) },
      { new: true, runValidators: true }
    );
    if (!period) return res.status(404).json({ message: "Accounting period not found." });
    await writeAudit({ actorId: req.user?._id, action: "close", entityType: "AccountingPeriod", entityId: period._id, before: current, after: period.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Accounting period closed.", period });
  } catch (error) {
    return res.status(500).json({ message: "Failed to close period.", error: error.message });
  }
};

export const reopenAccountingPeriod = async (req, res) => {
  try {
    const period = await AccountingPeriod.findOneAndUpdate(
      { periodKey: req.params.periodKey, status: { $ne: "locked" } },
      { status: "open", closedAt: null, closedBy: null, note: clean(req.body.note) },
      { new: true, runValidators: true }
    );
    if (!period) return res.status(404).json({ message: "Accounting period not found or locked." });
    await writeAudit({ actorId: req.user?._id, action: "unlock", entityType: "AccountingPeriod", entityId: period._id, after: period.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Accounting period reopened.", period });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reopen period.", error: error.message });
  }
};

export const lockAccountingPeriod = async (req, res) => {
  try {
    const period = await AccountingPeriod.findOneAndUpdate(
      { periodKey: req.params.periodKey },
      { status: "locked", lockedAt: new Date(), lockedBy: req.user?._id || null, note: clean(req.body.note) },
      { new: true, runValidators: true }
    );
    if (!period) return res.status(404).json({ message: "Accounting period not found." });
    await writeAudit({ actorId: req.user?._id, action: "lock", entityType: "AccountingPeriod", entityId: period._id, after: period.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Accounting period locked.", period });
  } catch (error) {
    return res.status(500).json({ message: "Failed to lock period.", error: error.message });
  }
};

export const unlockAccountingPeriod = async (req, res) => {
  try {
    const period = await AccountingPeriod.findOneAndUpdate(
      { periodKey: req.params.periodKey, status: "locked" },
      { status: "open", lockedAt: null, lockedBy: null, closedAt: null, closedBy: null, note: clean(req.body.note) },
      { new: true, runValidators: true }
    );
    if (!period) return res.status(404).json({ message: "Locked accounting period not found." });
    await writeAudit({ actorId: req.user?._id, action: "unlock", entityType: "AccountingPeriod", entityId: period._id, after: period.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Accounting period unlocked.", period });
  } catch (error) {
    return res.status(500).json({ message: "Failed to unlock period.", error: error.message });
  }
};

const carryForwardLines = async (throughDate) => {
  const rows = await JournalEntry.aggregate([
    { $match: { status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $lte: throughDate } } },
    { $unwind: "$lines" },
    { $group: { _id: { account: "$lines.account", contactType: "$lines.contactType", contactId: "$lines.contactId" }, debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" }, partyName: { $first: "$lines.description" } } },
    { $lookup: { from: "accounts", localField: "_id.account", foreignField: "_id", as: "account" } },
    { $unwind: "$account" },
    { $match: { "account.type": { $in: ["asset", "liability", "equity"] }, "account.isGroup": { $ne: true }, "account.isActive": true } },
  ]);
  const grouped = new Map();
  for (const row of rows) {
    const key = String(row._id.account);
    const current = grouped.get(key) || { account: row._id.account, accountDoc: row.account, debit: 0, credit: 0, partySplits: [] };
    current.debit += Number(row.debit || 0); current.credit += Number(row.credit || 0);
    if (row.account.isControlAccount && ["receivable", "payable"].includes(row.account.controlType)) {
      const partyType = row._id.contactType === "vendor" ? "supplier" : row._id.contactType === "customer" ? "customer" : "other";
      const natural = row.account.type === "asset" ? money(row.debit - row.credit) : money(row.credit - row.debit);
      current.partySplits.push({ partyType, partyId: row._id.contactId || null, partyName: clean(row.partyName || "Unallocated"), debit: row.account.type === "asset" ? Math.max(natural, 0) : Math.max(-natural, 0), credit: row.account.type === "asset" ? Math.max(-natural, 0) : Math.max(natural, 0) });
    }
    grouped.set(key, current);
  }
  return [...grouped.values()].map((row) => {
    const natural = row.accountDoc.type === "asset" ? money(row.debit - row.credit) : money(row.credit - row.debit);
    const debit = row.accountDoc.type === "asset" ? Math.max(natural, 0) : Math.max(-natural, 0);
    const credit = row.accountDoc.type === "asset" ? Math.max(-natural, 0) : Math.max(natural, 0);
    return { account: row.account, debit: money(debit), credit: money(credit), description: "Balance carried forward", partySplits: row.partySplits.filter((party) => party.debit || party.credit) };
  }).filter((line) => line.debit || line.credit);
};

export const closeFiscalYear = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid fiscal year ID." });
    const fiscalYear = await FiscalYear.findById(req.params.id);
    if (!fiscalYear) return res.status(404).json({ message: "Fiscal year not found." });
    if (fiscalYear.status !== "open") return res.status(409).json({ message: "Only an open fiscal year can be closed." });
    const openPeriods = await AccountingPeriod.countDocuments({ fiscalYearRef: fiscalYear._id, status: "open" });
    if (openPeriods) return res.status(409).json({ message: `${openPeriods} accounting period(s) are still open.` });
    const drafts = await JournalEntry.countDocuments({ status: "draft", date: { $gte: fiscalYear.startDate, $lte: fiscalYear.endDate } });
    if (drafts) return res.status(409).json({ message: `${drafts} draft journal entr${drafts === 1 ? "y is" : "ies are"} still unposted.` });
    const settings = await AccountingSettings.findOne({ key: "company" }).lean();
    if (!settings?.retainedEarningsAccount) return res.status(409).json({ message: "Configure the Retained Earnings account before closing the fiscal year." });
    const rows = await JournalEntry.aggregate([
      { $match: { status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $gte: fiscalYear.startDate, $lte: fiscalYear.endDate } } },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
      { $lookup: { from: "accounts", localField: "_id", foreignField: "_id", as: "account" } },
      { $unwind: "$account" },
      { $match: { "account.type": { $in: ["revenue", "expense"] }, "account.isGroup": { $ne: true } } },
    ]);
    const lines = [];
    let retainedCredit = 0;
    for (const row of rows) {
      if (row.account.type === "revenue") {
        const balance = money(row.credit - row.debit);
        if (balance > 0) lines.push({ account: row._id, debit: balance, credit: 0, description: `Close ${fiscalYear.name}` });
        if (balance < 0) lines.push({ account: row._id, debit: 0, credit: Math.abs(balance), description: `Close ${fiscalYear.name}` });
        retainedCredit += balance;
      } else {
        const balance = money(row.debit - row.credit);
        if (balance > 0) lines.push({ account: row._id, debit: 0, credit: balance, description: `Close ${fiscalYear.name}` });
        if (balance < 0) lines.push({ account: row._id, debit: Math.abs(balance), credit: 0, description: `Close ${fiscalYear.name}` });
        retainedCredit -= balance;
      }
    }
    retainedCredit = money(retainedCredit);
    if (retainedCredit > 0) lines.push({ account: settings.retainedEarningsAccount, debit: 0, credit: retainedCredit, description: "Net profit transferred to retained earnings" });
    if (retainedCredit < 0) lines.push({ account: settings.retainedEarningsAccount, debit: Math.abs(retainedCredit), credit: 0, description: "Net loss transferred to retained earnings" });
    let closingEntry = null;
    if (lines.length >= 2) closingEntry = await postJournalEntry({ date: fiscalYear.endDate, lines, sourceType: "fiscal_closing", reference: `CLOSE-${fiscalYear.name}`, memo: `Fiscal year closing for ${fiscalYear.name}`, currency: settings.currency, userId: req.user?._id || null, allowClosedPeriod: true });
    fiscalYear.status = "closed";
    fiscalYear.isCurrentYear = false;
    fiscalYear.closingEntry = closingEntry?._id || null;
    fiscalYear.closedAt = new Date();
    fiscalYear.closedBy = req.user?._id || null;
    await fiscalYear.save();
    const nextYear = await FiscalYear.findOne({ startDate: { $gt: fiscalYear.endDate }, status: "open" }).sort({ startDate: 1 });
    let openingBalance = null;
    if (nextYear) {
      const linesToCarry = await carryForwardLines(fiscalYear.endDate);
      openingBalance = await OpeningBalance.findOneAndUpdate(
        { fiscalYear: nextYear._id },
        { $setOnInsert: { fiscalYear: nextYear._id, date: nextYear.startDate, referenceType: "carried_forward", reference: `CF-${fiscalYear.name}`, memo: `Carried forward from ${fiscalYear.name}`, currency: settings.currency, lines: linesToCarry, status: "draft", createdBy: req.user?._id || null } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }
    await writeAudit({ actorId: req.user?._id, action: "close", entityType: "FiscalYear", entityId: fiscalYear._id, after: fiscalYear.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Fiscal year closed successfully.", fiscalYear, closingEntry, openingBalance });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to close fiscal year.", error: error.message });
  }
};

export const listCashAccounts = async (req, res) => {
  try {
    const filter = req.query.active === "all" ? {} : { isActive: { $ne: false } };
    if (req.query.type && req.query.type !== "all") filter.type = clean(req.query.type);
    const accounts = await CashAccount.find(filter)
      .populate("account", "code name type currency isActive publishedAt")
      .populate("custodian lastVerifiedBy", "name email")
      .sort({ type: 1, nameLower: 1, _id: 1 })
      .limit(parseLimit(req.query.limit, 100))
      .lean();
    const ledgerIds = accounts.map((item) => item.account?._id).filter(Boolean);
    const balances = ledgerIds.length ? await JournalEntry.aggregate([
      { $match: { status: { $in: ACTIVE_LEDGER_STATUSES }, "lines.account": { $in: ledgerIds } } },
      { $unwind: "$lines" },
      { $match: { "lines.account": { $in: ledgerIds } } },
      { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
    ]) : [];
    const balanceMap = new Map(balances.map((row) => [String(row._id), money(row.debit - row.credit)]));
    const enriched = accounts.map((item) => {
      const currentBalance = balanceMap.get(String(item.account?._id || "")) || 0;
      const alert = item.minimumBalance > 0 && currentBalance < item.minimumBalance
        ? "below_minimum"
        : item.maximumBalance > 0 && currentBalance > item.maximumBalance ? "above_maximum" : "";
      return { ...item, currentBalance, alert, variance: money(Number(item.lastReconciledBalance || 0) - currentBalance) };
    });
    return res.json({ cashAccounts: enriched });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load cash/bank accounts.", error: error.message });
  }
};

export const listCashCustodians = async (_req, res) => {
  try {
    const users = await User.find({ isActive: { $ne: false } }).select("name email role").sort({ name: 1 }).limit(500).lean();
    return res.json({ users });
  } catch (error) { return res.status(500).json({ message: "Failed to load cash custodians.", error: error.message }); }
};

export const createCashAccount = async (req, res) => {
  try {
    if (!clean(req.body.name)) return res.status(400).json({ message: "Cash account name is required." });
    let cashAccount;
    await runAccountingWrite(async (session) => {
      let ledger = isId(req.body.account) ? await withAccountingSession(Account.findOne({ _id: req.body.account, type: "asset", isActive: true, isGroup: { $ne: true } }), session) : null;
      if (req.body.account && !ledger) throw Object.assign(new Error("Select an active leaf Asset ledger."), { statusCode: 400 });
      if (ledger && await withAccountingSession(CashAccount.exists({ account: ledger._id }), session)) throw Object.assign(new Error("That ledger is already connected to another cash account."), { statusCode: 409 });
      if (ledger && await withAccountingSession(BankAccount.exists({ ledgerAccount: ledger._id }), session)) throw Object.assign(new Error("That ledger is already connected to a bank account."), { statusCode: 409 });
      if (!ledger) {
        const settings = await withAccountingSession(AccountingSettings.findOne({ key: "company" }).select("coaPublishedAt"), session).lean();
        ledger = new Account({
          code: `CASH-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`,
          name: clean(req.body.name), type: "asset", subType: "Cash and Cash Equivalents",
          currency: clean(req.body.currency || "BDT").toUpperCase(), isActive: true,
          description: `Linked cash ledger for ${clean(req.body.name)}`,
          publishedAt: settings?.coaPublishedAt ? new Date() : null,
          publishedBy: settings?.coaPublishedAt ? req.user?._id || null : null,
          createdBy: req.user?._id || null, updatedBy: req.user?._id || null,
        });
        await ledger.save(accountingSessionOptions(session));
      }
      cashAccount = new CashAccount({
        name: req.body.name, type: "cash", account: ledger._id,
        currency: clean(req.body.currency || "BDT").toUpperCase(), location: clean(req.body.location),
        custodian: isId(req.body.custodian) ? req.body.custodian : null,
        minimumBalance: money(req.body.minimumBalance), maximumBalance: money(req.body.maximumBalance),
        openingBalance: 0, isActive: req.body.isActive !== false,
        createdBy: req.user?._id || null, updatedBy: req.user?._id || null,
      });
      await cashAccount.save(accountingSessionOptions(session));
    });
    return res.status(201).json({ message: "Cash account created and connected to the Chart of Accounts. Set its starting amount through Opening Balance.", cashAccount });
  } catch (error) {
    return res.status(error.statusCode || (error?.code === 11000 ? 409 : 500)).json({ message: error.statusCode ? error.message : "Failed to create cash account.", error: error.message });
  }
};

export const updateCashAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid cash account ID." });
    const patch = {};
    for (const field of ["name", "location", "currency"]) if (req.body[field] !== undefined) patch[field] = clean(req.body[field]);
    for (const field of ["minimumBalance", "maximumBalance"]) if (req.body[field] !== undefined) patch[field] = money(req.body[field]);
    if (req.body.custodian !== undefined) patch.custodian = isId(req.body.custodian) ? req.body.custodian : null;
    if (req.body.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    patch.updatedBy = req.user?._id || null;
    const cashAccount = await CashAccount.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true })
      .populate("account", "code name type currency").populate("custodian", "name email");
    if (!cashAccount) return res.status(404).json({ message: "Cash account not found." });
    return res.json({ message: "Cash account updated.", cashAccount });
  } catch (error) { return res.status(error?.code === 11000 ? 409 : 500).json({ message: "Failed to update cash account.", error: error.message }); }
};

export const deleteCashAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid cash account ID." });
    const cashAccount = await CashAccount.findById(req.params.id).lean();
    if (!cashAccount) return res.status(404).json({ message: "Cash account not found." });
    if (await JournalEntry.exists({ "lines.account": cashAccount.account })) return res.status(409).json({ message: "Cash accounts with ledger history cannot be deleted. Set the account inactive instead." });
    await CashAccount.findByIdAndDelete(req.params.id);
    return res.json({ message: "Cash account deleted." });
  } catch (error) { return res.status(500).json({ message: "Failed to delete cash account.", error: error.message }); }
};

export const reconcileCashAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid cash account ID." });
    const cashAccount = await CashAccount.findByIdAndUpdate(
      req.params.id,
      { lastReconciledAt: parsePostingDate(req.body.reconciledAt) || new Date(), lastReconciledBalance: money(req.body.balance), lastVerifiedBy: req.user?._id || null, lastVerificationNote: clean(req.body.note), updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    );
    if (!cashAccount) return res.status(404).json({ message: "Cash/bank account not found." });
    return res.json({ message: "Physical cash count verified.", cashAccount });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reconcile cash/bank account.", error: error.message });
  }
};

export const listVendorBills = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const limit = parseLimit(req.query.limit);
    const cursor = listCursor(req.query.cursor);
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
    if (req.query.vendor) filter.vendorNameLower = textRegex(req.query.vendor);
    if (range.from || range.to) filter.billDate = {};
    if (range.from) filter.billDate.$gte = range.from;
    if (range.to) filter.billDate.$lte = range.to;
    if (cursor) filter.$or = [{ billDate: { $lt: cursor.date } }, { billDate: cursor.date, _id: { $lt: cursor.id } }];
    const rows = await VendorBill.find(filter)
      .populate("expenseAccount payableAccount", "code name type")
      .populate("supplier", "supplierCode businessName tradingName contactPerson")
      .populate("purchaseOrder", "orderNo orderDate grandTotal status")
      .populate("goodsReceipts", "receiptNo receiptDate totalAcceptedValue status")
      .sort({ billDate: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasNextPage = rows.length > limit;
    const vendorBills = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage && vendorBills.length ? makeListCursor(vendorBills[vendorBills.length - 1], "billDate") : "";
    return res.json({ vendorBills, pageInfo: { limit, hasNextPage, nextCursor } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load vendor bills.", error: error.message });
  }
};

export const getVendorBillMatchOptions = async (req, res) => {
  try {
    const supplierFilter = { status: "active" };
    if (isId(req.query.supplier)) supplierFilter._id = req.query.supplier;
    const usedReceiptIds = await VendorBill.distinct("goodsReceipts", {
      status: { $in: ["approved", "partially_paid", "paid"] },
      goodsReceipts: { $ne: null },
    });
    const receiptFilter = {
      status: "posted",
      _id: { $nin: usedReceiptIds },
    };
    const orderFilter = { status: { $in: ["approved", "partially_received", "received", "closed"] } };
    if (isId(req.query.supplier)) {
      receiptFilter.supplier = req.query.supplier;
      orderFilter.supplier = req.query.supplier;
    }
    const [suppliers, purchaseOrders, goodsReceipts] = await Promise.all([
      Supplier.find(supplierFilter).select("code businessName status").sort({ businessName: 1 }).limit(500).lean(),
      PurchaseOrder.find(orderFilter).select("orderNo orderDate supplier currency grandTotal status").sort({ orderDate: -1 }).limit(500).lean(),
      GoodsReceipt.find(receiptFilter).select("receiptNo receiptDate purchaseOrder supplier currency totalAcceptedValue status").sort({ receiptDate: -1 }).limit(500).lean(),
    ]);
    return res.json({ suppliers, purchaseOrders, goodsReceipts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load supplier invoice matching options.", error: error.message });
  }
};

const resolveVendorBillMatch = async ({ supplierId, purchaseOrderId, goodsReceiptIds, subtotal, currency, toleranceAmount = 0.01 }) => {
  if (!purchaseOrderId && !goodsReceiptIds.length) {
    return { purchaseOrder: null, goodsReceipts: [], matchStatus: "unlinked", receivedAmount: 0, variance: 0, currency: clean(currency || "BDT").toUpperCase() };
  }
  if (!isId(supplierId) || !isId(purchaseOrderId)) {
    throw Object.assign(new Error("Supplier and purchase order are required for a matched inventory bill."), { statusCode: 400 });
  }
  const order = await PurchaseOrder.findOne({ _id: purchaseOrderId, supplier: supplierId }).select("_id supplier orderNo status currency").lean();
  if (!order) throw Object.assign(new Error("Purchase order does not belong to the selected supplier."), { statusCode: 400 });
  if (currency && clean(order.currency).toUpperCase() !== clean(currency).toUpperCase()) {
    throw Object.assign(new Error("Supplier bill currency must match the purchase order currency."), { statusCode: 400 });
  }
  const matchCurrency = clean(currency || order.currency).toUpperCase();
  const ids = [...new Set(goodsReceiptIds.filter(isId).map(String))];
  if (!ids.length) throw Object.assign(new Error("Select at least one posted goods receipt for invoice matching."), { statusCode: 400 });
  const receipts = await GoodsReceipt.find({ _id: { $in: ids }, purchaseOrder: order._id, supplier: supplierId, status: "posted" })
    .select("_id totalAcceptedValue currency")
    .lean();
  if (receipts.length !== ids.length) {
    throw Object.assign(new Error("Every matched goods receipt must be posted and belong to the selected supplier and purchase order."), { statusCode: 400 });
  }
  if (receipts.some((receipt) => clean(receipt.currency).toUpperCase() !== matchCurrency)) {
    throw Object.assign(new Error("Every matched goods receipt must use the supplier bill currency."), { statusCode: 400 });
  }
  const receivedAmount = money(receipts.reduce((sum, receipt) => sum + Number(receipt.totalAcceptedValue || 0), 0));
  const variance = money(Number(subtotal || 0) - receivedAmount);
  return {
    purchaseOrder: order._id,
    goodsReceipts: receipts.map((receipt) => receipt._id),
    matchStatus: Math.abs(variance) <= Number(toleranceAmount || 0.01) ? "matched" : "exception",
    receivedAmount,
    variance,
    currency: matchCurrency,
  };
};

const vendorBillPostingLines = async (bill) => {
  const lines = [{
    account: bill.expenseAccount,
    debit: bill.subtotal,
    credit: 0,
    description: bill.memo,
    contactType: "vendor",
    contactId: bill.supplier,
  }];
  if (Number(bill.taxAmount || 0) > 0) {
    lines.push({ account: await resolveSystemAccount("1200"), debit: bill.taxAmount, credit: 0, description: `Input tax - ${bill.billNo}` });
  }
  lines.push({ account: bill.payableAccount, debit: 0, credit: bill.total, description: bill.vendorName, contactType: "vendor", contactId: bill.supplier });
  return lines;
};

const assertReceiptsAvailableForBill = async (bill) => {
  if (!bill.goodsReceipts?.length) return;
  const conflict = await VendorBill.findOne({
    _id: { $ne: bill._id },
    goodsReceipts: { $in: bill.goodsReceipts },
    status: { $in: ["approved", "partially_paid", "paid"] },
  }).select("billNo").lean();
  if (conflict) {
    throw Object.assign(new Error(`One or more goods receipts are already matched to ${conflict.billNo}.`), { statusCode: 409 });
  }
};

export const createVendorBill = async (req, res) => {
  try {
    const supplier = isId(req.body.supplier) ? await Supplier.findById(req.body.supplier).select("_id businessName tradingName contactPerson").lean() : null;
    if (req.body.supplier && !supplier) return res.status(400).json({ message: "Selected supplier was not found." });
    if (!supplier && !clean(req.body.vendorName)) return res.status(400).json({ message: "Supplier is required." });
    const supplierInvoiceNo = clean(req.body.supplierInvoiceNo).toUpperCase();
    if (supplier && supplierInvoiceNo && await VendorBill.exists({ supplier: supplier._id, supplierInvoiceNo, status: { $ne: "void" } })) {
      return res.status(409).json({ message: "This supplier invoice number is already registered." });
    }
    const subtotal = money(req.body.subtotal || req.body.total);
    const taxAmount = money(req.body.taxAmount);
    const total = money(subtotal + taxAmount);
    const requestedCurrency = clean(req.body.currency).toUpperCase();
    if (subtotal <= 0 || total <= 0) return res.status(400).json({ message: "A positive bill subtotal is required." });
    const goodsReceiptIds = Array.isArray(req.body.goodsReceipts) ? req.body.goodsReceipts : [];
    const match = await resolveVendorBillMatch({ supplierId: supplier?._id, purchaseOrderId: req.body.purchaseOrder, goodsReceiptIds, subtotal, currency: requestedCurrency, toleranceAmount: req.body.toleranceAmount });
    const currency = match.currency || requestedCurrency || "BDT";
    const expenseAccount = match.matchStatus === "unlinked"
      ? (req.body.expenseAccount || await resolveSystemAccount("5000"))
      : await resolveSystemAccount("2050");
    const payableAccount = req.body.payableAccount || await resolveSystemAccount("2000");
    const billDate = parsePostingDate(req.body.billDate) || new Date();
    const bill = await VendorBill.create({
      billNo: await nextAccountingNumber("bill", billDate),
      vendorName: supplier?.businessName || supplier?.tradingName || supplier?.contactPerson || req.body.vendorName,
      supplier: supplier?._id || null,
      supplierInvoiceNo,
      purchaseOrder: match.purchaseOrder,
      goodsReceipts: match.goodsReceipts,
      expense: isId(req.body.expense) ? req.body.expense : null,
      expenseAccount,
      payableAccount,
      currency,
      billDate,
      dueDate: parsePostingDate(req.body.dueDate, null),
      subtotal,
      taxAmount,
      total,
      memo: clean(req.body.memo),
      matchStatus: match.matchStatus,
      matchSummary: { receivedAmount: match.receivedAmount, invoicedAmount: subtotal, amountVariance: match.variance, toleranceAmount: money(req.body.toleranceAmount || 0.01), checkedAt: match.matchStatus === "unlinked" ? null : new Date() },
      createdBy: req.user?._id || null,
    });
    if (req.body.post === true || req.body.status === "approved") {
      if (bill.matchStatus === "exception") throw Object.assign(new Error("The supplier invoice does not match the selected goods receipts. Resolve the variance before posting."), { statusCode: 409 });
      await assertReceiptsAvailableForBill(bill);
      const journal = await postJournalEntry({
        date: bill.billDate,
        sourceType: "vendor_bill",
        sourceId: bill._id,
        reference: bill.billNo,
        memo: bill.memo || `Vendor bill from ${bill.vendorName}`,
        currency: bill.currency,
        userId: req.user?._id || null,
        lines: await vendorBillPostingLines(bill),
      });
      bill.status = "approved";
      bill.approvedBy = req.user?._id || null;
      bill.journalEntry = journal._id;
      await bill.save();
    }
    return res.status(201).json({ message: "Vendor bill created.", vendorBill: bill });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to create vendor bill.", error: error.message });
  }
};

export const approveVendorBill = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid vendor bill ID." });
    const bill = await VendorBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Vendor bill not found." });
    if (bill.status !== "draft") return res.status(409).json({ message: "Only draft bills can be approved." });
    if (bill.matchStatus === "exception") return res.status(409).json({ message: "The supplier invoice does not match the selected goods receipts. Resolve the variance before approval." });
    await assertReceiptsAvailableForBill(bill);
    const journal = await postJournalEntry({
      date: bill.billDate,
      sourceType: "vendor_bill",
      sourceId: bill._id,
      reference: bill.billNo,
      memo: bill.memo || `Vendor bill from ${bill.vendorName}`,
      currency: bill.currency,
      userId: req.user?._id || null,
      lines: await vendorBillPostingLines(bill),
    });
    bill.status = "approved";
    bill.approvedBy = req.user?._id || null;
    bill.journalEntry = journal._id;
    await bill.save();
    return res.json({ message: "Vendor bill approved and posted.", vendorBill: bill, journalEntry: journal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to approve vendor bill.", error: error.message });
  }
};

const resolvePaymentTreasury = async (body = {}, expectedCurrency = "") => {
  const id = body.treasuryAccount || body.cashAccount || body.bankAccount;
  const requestedType = clean(body.treasuryType).toLowerCase();
  if (!isId(id)) return null;
  if (requestedType !== "bank") {
    const cash = await CashAccount.findOne({ _id: id, isActive: true }).populate("account", "code name type currency isActive isGroup").lean();
    if (cash?.account?.type === "asset" && cash.account.isActive !== false && !cash.account.isGroup) {
      if (expectedCurrency && clean(cash.currency).toUpperCase() !== clean(expectedCurrency).toUpperCase()) return null;
      return { type: "cash", id: cash._id, ledger: cash.account, name: cash.name, paymentMode: cash.type === "cash" ? "cash" : clean(cash.type || "other") };
    }
  }
  if (requestedType !== "cash") {
    const bank = await BankAccount.findOne({ _id: id, status: "active" }).populate("ledgerAccount", "code name type currency isActive isGroup").lean();
    if (bank?.ledgerAccount?.type === "asset" && bank.ledgerAccount.isActive !== false && !bank.ledgerAccount.isGroup) {
      if (expectedCurrency && clean(bank.currency).toUpperCase() !== clean(expectedCurrency).toUpperCase()) return null;
      return { type: "bank", id: bank._id, ledger: bank.ledgerAccount, name: bank.accountName, paymentMode: "bank" };
    }
  }
  return null;
};

export const payVendorBill = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid vendor bill ID." });
    const bill = await VendorBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Vendor bill not found." });
    if (!["approved", "partially_paid"].includes(bill.status)) return res.status(409).json({ message: "Bill must be approved before payment." });
    const treasury = await resolvePaymentTreasury(req.body, bill.currency);
    if (!treasury) return res.status(400).json({ message: "Select an active cash or linked bank account in the bill currency." });
    const amount = money(req.body.amount || bill.dueTotal);
    if (amount <= 0 || amount > Number(bill.dueTotal || 0)) return res.status(400).json({ message: "Payment amount must be greater than 0 and not exceed bill due." });
    const journal = await postJournalEntry({
      date: req.body.paidAt || new Date(),
      sourceType: "vendor_payment",
      sourceId: bill._id,
      reference: clean(req.body.reference || bill.billNo),
      memo: clean(req.body.note || `Payment to ${bill.vendorName}`),
      currency: bill.currency,
      paymentMode: treasury.paymentMode,
      cashAccount: treasury.type === "cash" ? treasury.id : null,
      bankAccount: treasury.type === "bank" ? treasury.id : null,
      userId: req.user?._id || null,
      lines: [
        { account: bill.payableAccount, debit: amount, credit: 0, description: bill.vendorName, contactType: "vendor" },
        { account: treasury.ledger._id, debit: 0, credit: amount, description: treasury.name },
      ],
    });
    bill.payments.push({ amount, paidAt: parsePostingDate(req.body.paidAt) || new Date(), cashAccount: treasury.type === "cash" ? treasury.id : null, bankAccount: treasury.type === "bank" ? treasury.id : null, journalEntry: journal._id, reference: req.body.reference, note: req.body.note, paidBy: req.user?._id || null });
    await bill.save();
    return res.json({ message: "Vendor payment recorded.", vendorBill: bill, journalEntry: journal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to record vendor payment.", error: error.message });
  }
};

export const recordCustomerPayment = async (req, res) => {
  try {
    const invoiceId = req.body.invoiceId || req.params.invoiceId || req.params.id;
    if (!isId(invoiceId)) return res.status(400).json({ message: "Valid invoice is required." });
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice || invoice.status === "void") return res.status(404).json({ message: "Invoice not found." });
    if (invoice.status === "draft" || !invoice.journalEntry) return res.status(409).json({ message: "Invoice must be posted before a payment can be applied." });
    const treasury = await resolvePaymentTreasury(req.body, invoice.currency);
    if (!treasury) return res.status(400).json({ message: "Select an active cash or linked bank account in the invoice currency." });
    const amount = money(req.body.amount || invoice.dueTotal);
    if (amount <= 0 || amount > Number(invoice.dueTotal || 0)) return res.status(400).json({ message: "Payment amount must be greater than 0 and not exceed invoice due." });
    const arAccount = req.body.receivableAccount || await resolveSystemAccount("1100");
    const journal = await postJournalEntry({
      date: req.body.paidAt || new Date(),
      sourceType: "customer_payment",
      sourceId: invoice._id,
      reference: clean(req.body.reference || invoice.invoiceNo),
      memo: clean(req.body.note || `Payment for invoice ${invoice.invoiceNo}`),
      currency: invoice.currency,
      paymentMode: treasury.paymentMode,
      cashAccount: treasury.type === "cash" ? treasury.id : null,
      bankAccount: treasury.type === "bank" ? treasury.id : null,
      userId: req.user?._id || null,
      lines: [
        { account: treasury.ledger._id, debit: amount, credit: 0, description: treasury.name },
        { account: arAccount, debit: 0, credit: amount, description: invoice.invoiceNo, contactType: "customer", contactId: invoice.customerId },
      ],
    });
    invoice.payments.push({ amount, method: ["cash", "bank", "card"].includes(treasury.paymentMode) ? treasury.paymentMode : "other", transactionId: clean(req.body.reference), paidAt: parsePostingDate(req.body.paidAt) || new Date(), note: clean(req.body.note), receivedBy: req.user?._id || null, cashAccount: treasury.type === "cash" ? treasury.id : null, bankAccount: treasury.type === "bank" ? treasury.id : null, journalEntry: journal._id });
    await invoice.save();
    return res.json({ message: "Customer payment recorded.", invoice, journalEntry: journal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to record customer payment.", error: error.message });
  }
};

const normalizeOpeningLines = (lines = []) => lines.map((line) => ({
  account: line.account,
  debit: money(line.debit),
  credit: money(line.credit),
  description: clean(line.description || "Opening balance"),
  partySplits: (Array.isArray(line.partySplits) ? line.partySplits : []).map((party) => ({
    partyType: clean(party.partyType || "other"),
    partyId: isId(party.partyId) ? party.partyId : null,
    partyName: clean(party.partyName),
    debit: money(party.debit),
    credit: money(party.credit),
  })),
}));

const validateOpeningLines = async (lines, { posting = false } = {}) => {
  if (!lines.length) throw Object.assign(new Error("At least one opening balance line is required."), { statusCode: 400 });
  if (new Set(lines.map((line) => String(line.account))).size !== lines.length) throw Object.assign(new Error("Each account can appear only once in an opening balance."), { statusCode: 400 });
  if (lines.some((line) => !isId(line.account) || (line.debit > 0 && line.credit > 0) || (posting && line.debit <= 0 && line.credit <= 0))) throw Object.assign(new Error("Each line needs a valid account and either a debit or credit amount."), { statusCode: 400 });
  await assertPostableAccounts(lines);
  const accounts = await Account.find({ _id: { $in: lines.map((line) => line.account) } }).select("code isControlAccount controlType").lean();
  const accountMap = new Map(accounts.map((account) => [String(account._id), account]));
  for (const line of lines) {
    const account = accountMap.get(String(line.account));
    if (posting && account?.isControlAccount && ["receivable", "payable"].includes(account.controlType)) {
      if (!line.partySplits.length) throw Object.assign(new Error(`Control account ${account.code} requires customer/supplier breakdowns.`), { statusCode: 400 });
      const partyDebit = money(line.partySplits.reduce((sum, party) => sum + party.debit, 0));
      const partyCredit = money(line.partySplits.reduce((sum, party) => sum + party.credit, 0));
      if (money(partyDebit - partyCredit) !== money(line.debit - line.credit)) throw Object.assign(new Error(`Party breakdown for account ${account.code} must reconcile to the account line.`), { statusCode: 400 });
    }
  }
};

export const listOpeningBalances = async (req, res) => {
  try {
    const filter = req.query.fiscalYear && isId(req.query.fiscalYear) ? { fiscalYear: req.query.fiscalYear } : {};
    const openingBalances = await OpeningBalance.find(filter)
      .populate("fiscalYear", "name startDate endDate status isCurrentYear")
      .populate("lines.account", "code name type subType isControlAccount controlType")
      .populate("createdBy updatedBy postedBy", "name email")
      .sort({ date: -1 }).limit(25).lean();
    return res.json({ openingBalances });
  } catch (error) { return res.status(500).json({ message: "Failed to load opening balances.", error: error.message }); }
};

export const postOpeningBalances = async (req, res) => {
  try {
    const setup = await AccountingSettings.findOne({ key: "company" }).select("coaPublishedAt updatedBy").lean();
    if (!setup?.coaPublishedAt) return res.status(409).json({ message: "Publish the Chart of Accounts before preparing opening balances." });
    if (!setup?.updatedBy) return res.status(409).json({ message: "Save Accounting Settings before preparing opening balances." });
    let fiscalYear = isId(req.body.fiscalYear) ? await FiscalYear.findById(req.body.fiscalYear) : null;
    const date = parsePostingDate(req.body.date, null);
    if (!fiscalYear && date) {
      const period = await AccountingPeriod.findOne({ startDate: { $lte: date }, endDate: { $gte: date } }).lean();
      if (period?.fiscalYearRef) fiscalYear = await FiscalYear.findById(period.fiscalYearRef);
    }
    if (!fiscalYear || !date || date < fiscalYear.startDate || date > fiscalYear.endDate) return res.status(400).json({ message: "A valid fiscal year and opening date within that year are required." });
    const lines = normalizeOpeningLines(Array.isArray(req.body.lines) ? req.body.lines : []);
    await validateOpeningLines(lines, { posting: false });
    let openingBalance = await OpeningBalance.findOne({ fiscalYear: fiscalYear._id });
    if (openingBalance?.status === "posted") return res.status(409).json({ message: "Posted opening balances are locked and cannot be edited." });
    const payload = { fiscalYear: fiscalYear._id, date, referenceType: clean(req.body.referenceType || "manual"), reference: clean(req.body.reference), memo: clean(req.body.memo || "Opening balances"), currency: clean(req.body.currency || "BDT"), lines, updatedBy: req.user?._id || null };
    if (openingBalance) { openingBalance.set(payload); await openingBalance.save(); }
    else openingBalance = await OpeningBalance.create({ ...payload, status: "draft", createdBy: req.user?._id || null });
    await writeAudit({ actorId: req.user?._id, action: openingBalance.createdAt.getTime() === openingBalance.updatedAt.getTime() ? "create" : "update", entityType: "OpeningBalance", entityId: openingBalance._id, after: openingBalance.toObject(), meta: getReqMeta(req) });
    return res.status(201).json({ message: "Opening balance saved as draft.", openingBalance });
  } catch (error) {
    const status = error?.code === 11000 ? 409 : error.statusCode || 500;
    return res.status(status).json({
      message:
        status === 409
          ? "An opening balance already exists for this fiscal year."
          : error?.statusCode
            ? error.message
            : "Failed to save opening balance.",
      error: error.message,
    });
  }
};

export const postOpeningBalanceDraft = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid opening balance ID." });
    const openingBalance = await OpeningBalance.findById(req.params.id).populate("fiscalYear");
    if (!openingBalance) return res.status(404).json({ message: "Opening balance not found." });
    if (openingBalance.status !== "draft") return res.status(409).json({ message: "Opening balance is already posted." });
    const lines = normalizeOpeningLines(openingBalance.lines.map((line) => line.toObject()));
    await validateOpeningLines(lines, { posting: true });
    const synchronizedBank = await BankAccount.findOne({
      ledgerAccount: { $in: lines.map((line) => line.account) },
      openingJournalEntry: { $ne: null },
      openingBalance: { $gt: 0 },
    }).select("accountName accountNumber").lean();
    if (synchronizedBank) {
      return res.status(409).json({ message: `${synchronizedBank.accountName} (${synchronizedBank.accountNumber}) already has a bank opening voucher. Remove that ledger from this opening-balance draft to prevent duplication.` });
    }
    const debit = money(lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = money(lines.reduce((sum, line) => sum + line.credit, 0));
    if (debit <= 0 || debit !== credit) return res.status(400).json({ message: "Total debit and total credit must be equal and greater than zero." });
    const journalLines = lines.flatMap((line) => line.partySplits.length ? line.partySplits.map((party) => ({ account: line.account, debit: party.debit, credit: party.credit, description: party.partyName || line.description, contactType: party.partyType === "supplier" ? "vendor" : party.partyType, contactId: party.partyId })) : [{ account: line.account, debit: line.debit, credit: line.credit, description: line.description }]);
    const journal = await postJournalEntry({ date: openingBalance.date, sourceType: "opening_balance", sourceId: openingBalance._id, reference: openingBalance.reference || `OPEN-${openingBalance.fiscalYear.name}`, memo: openingBalance.memo, currency: openingBalance.currency, userId: req.user?._id || null, lines: journalLines });
    openingBalance.status = "posted"; openingBalance.journalEntry = journal._id; openingBalance.postedBy = req.user?._id || null; openingBalance.postedAt = new Date(); await openingBalance.save();
    await writeAudit({ actorId: req.user?._id, action: "confirm", entityType: "OpeningBalance", entityId: openingBalance._id, after: openingBalance.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Opening balance posted to the General Ledger.", openingBalance, journalEntry: journal });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Failed to post opening balance.", error: error.message }); }
};

export const carryForwardOpeningBalance = async (req, res) => {
  try {
    if (!isId(req.params.fiscalYearId)) return res.status(400).json({ message: "Invalid target fiscal year." });
    const target = await FiscalYear.findById(req.params.fiscalYearId);
    if (!target) return res.status(404).json({ message: "Target fiscal year not found." });
    const previous = await FiscalYear.findOne({ endDate: { $lt: target.startDate }, status: "closed" }).sort({ endDate: -1 });
    if (!previous) return res.status(409).json({ message: "No previously closed fiscal year was found." });
    const existing = await OpeningBalance.findOne({ fiscalYear: target._id }).select("status").lean();
    if (existing?.status === "posted") return res.status(409).json({ message: "The target fiscal year's opening balance is already posted." });
    const lines = await carryForwardLines(previous.endDate);
    const settings = await AccountingSettings.findOne({ key: "company" }).lean();
    const openingBalance = await OpeningBalance.findOneAndUpdate({ fiscalYear: target._id }, { $set: { date: target.startDate, referenceType: "carried_forward", reference: `CF-${previous.name}`, memo: `Carried forward from ${previous.name}`, currency: settings?.currency || "BDT", lines, updatedBy: req.user?._id || null }, $setOnInsert: { fiscalYear: target._id, status: "draft", createdBy: req.user?._id || null } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
    return res.json({ message: "Balance Sheet accounts carried forward as a draft.", openingBalance });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: "Failed to carry opening balances forward.", error: error.message }); }
};

export const getGeneralLedger = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const rawAccountIds = clean(req.query.accounts || req.query.account).split(",").map((value) => value.trim()).filter(isId);
    const accountIds = [...new Set(rawAccountIds)].map(toId);
    if (!accountIds.length) return res.status(400).json({ message: "Select at least one ledger account." });
    if (accountIds.length > 50) return res.status(400).json({ message: "A consolidated ledger can include at most 50 accounts." });
    const selectedAccounts = await Account.find({ _id: { $in: accountIds }, isGroup: { $ne: true } }).select("code name type subType normalBalance currency isActive").sort({ code: 1 }).lean();
    if (selectedAccounts.length !== accountIds.length) return res.status(400).json({ message: "General Ledger supports leaf accounts only." });

    const filter = { status: { $in: ACTIVE_LEDGER_STATUSES }, "lines.account": { $in: accountIds } };
    if (range.from || range.to) filter.date = {};
    if (range.from) filter.date.$gte = range.from;
    if (range.to) filter.date.$lte = range.to;
    if (req.query.voucherType && req.query.voucherType !== "all") filter.voucherType = clean(req.query.voucherType);
    if (req.query.sourceType && req.query.sourceType !== "all") filter.sourceType = clean(req.query.sourceType);
    const search = textRegex(req.query.q);
    if (search) filter.$and = [{ $or: [{ entryNo: search }, { reference: search }, { memo: search }, { "lines.description": search }] }];
    const reportLimit = Math.min(Math.max(Number(req.query.limit || 2000), 1), 5000);
    const entries = await JournalEntry.find(filter)
      .select("entryNo date status voucherType sourceType sourceId origin reference memo currency paymentMode reversalOf reversedByEntry lines createdAt")
      .populate("lines.account", "code name type normalBalance")
      .sort({ date: 1, createdAt: 1, _id: 1 })
      .limit(reportLimit + 1)
      .lean();
    const truncated = entries.length > reportLimit;
    const journalEntries = truncated ? entries.slice(0, reportLimit) : entries;

    const openingRows = range.from ? await JournalEntry.aggregate([
      { $match: { status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $lt: range.from }, "lines.account": { $in: accountIds } } },
      { $unwind: "$lines" }, { $match: { "lines.account": { $in: accountIds } } },
      { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
    ]).allowDiskUse(true) : [];
    const openingByAccount = new Map(openingRows.map((row) => [String(row._id), money(row.debit - row.credit)]));
    const accountRunning = new Map(selectedAccounts.map((account) => [String(account._id), openingByAccount.get(String(account._id)) || 0]));
    let consolidatedRunning = money([...accountRunning.values()].reduce((sum, value) => sum + value, 0));
    const lineAllowed = (line) => {
      if (!accountRunning.has(String(line.account?._id || line.account))) return false;
      if (req.query.contactType && req.query.contactType !== "all" && line.contactType !== req.query.contactType) return false;
      if (isId(req.query.party) && String(line.contactId || "") !== String(req.query.party)) return false;
      if (isId(req.query.costCenter) && String(line.costCenter || "") !== String(req.query.costCenter)) return false;
      if (isId(req.query.project) && String(line.project || "") !== String(req.query.project)) return false;
      return true;
    };
    const rows = [];
    const compatibleEntries = journalEntries.map((entry) => {
      const selectedLines = (entry.lines || []).filter(lineAllowed);
      for (const line of selectedLines) {
        const accountId = String(line.account?._id || line.account);
        const movement = money(Number(line.debit || 0) - Number(line.credit || 0));
        const nextAccountBalance = money((accountRunning.get(accountId) || 0) + movement);
        accountRunning.set(accountId, nextAccountBalance);
        consolidatedRunning = money(consolidatedRunning + movement);
        rows.push({
          _id: line._id, journalEntryId: entry._id, date: entry.date, entryNo: entry.entryNo, voucherType: entry.voucherType,
          sourceType: entry.sourceType, reference: entry.reference, description: line.description || entry.memo, debit: money(line.debit), credit: money(line.credit),
          currency: entry.currency, account: line.account, contactType: line.contactType, contactId: line.contactId, costCenter: line.costCenter, project: line.project, taxCode: line.taxCode,
          accountBalance: Math.abs(nextAccountBalance), accountBalanceSide: nextAccountBalance >= 0 ? "Dr" : "Cr",
          balance: Math.abs(consolidatedRunning), balanceSide: consolidatedRunning >= 0 ? "Dr" : "Cr",
        });
      }
      return { ...entry, lines: selectedLines };
    }).filter((entry) => entry.lines.length);
    const totalDebit = money(rows.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = money(rows.reduce((sum, row) => sum + row.credit, 0));
    const openingSigned = money(openingRows.reduce((sum, row) => sum + Number(row.debit || 0) - Number(row.credit || 0), 0));
    return res.json({
      accounts: selectedAccounts,
      openingBalance: { amount: Math.abs(openingSigned), side: openingSigned >= 0 ? "Dr" : "Cr", signed: openingSigned },
      rows,
      entries: compatibleEntries,
      totals: { debit: totalDebit, credit: totalCredit, movement: money(totalDebit - totalCredit) },
      closingBalance: { amount: Math.abs(consolidatedRunning), side: consolidatedRunning >= 0 ? "Dr" : "Cr", signed: consolidatedRunning },
      pageInfo: { limit: reportLimit, hasNextPage: truncated, nextCursor: "" },
      basis: "Live from posted and reversed-source voucher lines; no separate General Ledger records are stored.",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to load general ledger.", error: error.message });
  }
};

export const getCashBook = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const from = range.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = range.to || new Date();
    from.setHours(0, 0, 0, 0); to.setHours(23, 59, 59, 999);
    if (from > to) return res.status(400).json({ message: "From date cannot be after to date." });

    const [cashLinks, bankLinks] = await Promise.all([
      CashAccount.find({ account: { $ne: null } }).select("name type currency account isActive location institution accountNo").populate("account", "code name type currency isActive").lean(),
      BankAccount.find({ ledgerAccount: { $ne: null } }).select("accountName accountNumber accountType currency ledgerAccount status bank").populate("ledgerAccount", "code name type currency isActive").populate("bank", "bankName shortName").lean(),
    ]);
    const treasuryMap = new Map();
    for (const link of cashLinks) {
      if (!link.account?._id || link.account.type !== "asset") continue;
      treasuryMap.set(String(link.account._id), {
        ledger: link.account, treasuryId: link._id, kind: link.type === "cash" ? "cash" : "bank",
        name: link.name, detail: link.location || link.institution || link.accountNo || "Cash Management", currency: link.currency || link.account.currency, active: link.isActive !== false,
      });
    }
    for (const link of bankLinks) {
      if (!link.ledgerAccount?._id || link.ledgerAccount.type !== "asset") continue;
      treasuryMap.set(String(link.ledgerAccount._id), {
        ledger: link.ledgerAccount, treasuryId: link._id, kind: "bank", name: link.accountName,
        detail: `${link.bank?.shortName || link.bank?.bankName || "Bank"} - ${link.accountNumber}`, currency: link.currency || link.ledgerAccount.currency, active: link.status === "active",
      });
    }
    const allAccounts = [...treasuryMap.values()].sort((a, b) => `${a.kind}-${a.name}`.localeCompare(`${b.kind}-${b.name}`));
    const scope = ["all", "cash", "bank", "account"].includes(clean(req.query.scope).toLowerCase()) ? clean(req.query.scope).toLowerCase() : "all";
    const requestedAccount = clean(req.query.account);
    let selectedAccounts = allAccounts.filter((item) => scope === "all" || item.kind === scope);
    if (scope === "account") {
      selectedAccounts = allAccounts.filter((item) => String(item.ledger._id) === requestedAccount || String(item.treasuryId) === requestedAccount);
      if (!selectedAccounts.length) return res.status(400).json({ message: "Select a valid linked cash or bank account." });
    }
    const currency = clean(req.query.currency).toUpperCase();
    if (currency) selectedAccounts = selectedAccounts.filter((item) => clean(item.currency).toUpperCase() === currency);
    const ledgerIds = selectedAccounts.map((item) => item.ledger._id);
    if (!ledgerIds.length) return res.json({ accounts: allAccounts, selectedAccounts: [], rows: [], openingBalance: 0, closingBalance: 0, summary: { cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0, netMovement: 0 }, from, to, scope, basis: "No linked treasury ledgers match this scope." });

    const openingMatch = { status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $lt: from }, "lines.account": { $in: ledgerIds } };
    const entryMatch = { status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $gte: from, $lte: to }, "lines.account": { $in: ledgerIds } };
    if (req.query.voucherType && req.query.voucherType !== "all") entryMatch.voucherType = clean(req.query.voucherType).toLowerCase();
    const search = textRegex(req.query.q);
    if (search) entryMatch.$or = [{ entryNo: search }, { reference: search }, { memo: search }, { "lines.description": search }];
    const reportLimit = Math.min(Math.max(Number(req.query.limit || 3000), 1), 5000);
    const [openingRows, periodMovementRows, entries] = await Promise.all([
      JournalEntry.aggregate([
        { $match: openingMatch }, { $unwind: "$lines" }, { $match: { "lines.account": { $in: ledgerIds } } },
        { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
      ]).allowDiskUse(true),
      JournalEntry.aggregate([
        { $match: entryMatch },
        { $unwind: "$lines" },
        { $match: { "lines.account": { $in: ledgerIds } } },
        { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
      ]).allowDiskUse(true),
      JournalEntry.find(entryMatch)
        .select("entryNo date status voucherType sourceType sourceId reference memo currency paymentMode cashAccount bankAccount partyType partyId partyName linkedDocuments reversalOf reversedByEntry lines createdAt")
        .populate("lines.account", "code name type subType")
        .sort({ date: 1, createdAt: 1, _id: 1 })
        .limit(reportLimit + 1)
        .lean(),
    ]);
    const truncated = entries.length > reportLimit; const periodEntries = truncated ? entries.slice(0, reportLimit) : entries;
    const openingByAccount = new Map(openingRows.map((row) => [String(row._id), money(Number(row.debit || 0) - Number(row.credit || 0))]));
    let runningBalance = money([...openingByAccount.values()].reduce((sum, value) => sum + value, 0));
    const periodMovementByAccount = new Map(periodMovementRows.map((row) => [
      String(row._id),
      {
        debit: money(row.debit),
        credit: money(row.credit),
        movement: money(Number(row.debit || 0) - Number(row.credit || 0)),
      },
    ]));
    const summary = selectedAccounts.reduce((totals, item) => {
      const movement = periodMovementByAccount.get(String(item.ledger._id)) || { debit: 0, credit: 0 };
      if (item.kind === "cash") {
        totals.cashIn = money(totals.cashIn + movement.debit);
        totals.cashOut = money(totals.cashOut + movement.credit);
      } else {
        totals.bankIn = money(totals.bankIn + movement.debit);
        totals.bankOut = money(totals.bankOut + movement.credit);
      }
      return totals;
    }, { cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0, netMovement: 0 });
    summary.netMovement = money(summary.cashIn + summary.bankIn - summary.cashOut - summary.bankOut);

    const linkedDocumentRows = periodEntries.flatMap((entry) => entry.linkedDocuments || []);
    const invoiceIds = [...new Set([
      ...periodEntries
        .filter((entry) => entry.sourceType === "customer_payment" && isId(entry.sourceId))
        .map((entry) => String(entry.sourceId)),
      ...linkedDocumentRows
        .filter((item) => item.documentType === "invoice" && isId(item.documentId))
        .map((item) => String(item.documentId)),
    ])];
    const supplierBillIds = [...new Set([
      ...periodEntries
        .filter((entry) => entry.sourceType === "vendor_payment" && isId(entry.sourceId))
        .map((entry) => String(entry.sourceId)),
      ...linkedDocumentRows
        .filter((item) => item.documentType === "supplier_bill" && isId(item.documentId))
        .map((item) => String(item.documentId)),
    ])];
    const expenseIds = [...new Set([
      ...periodEntries
        .filter((entry) => entry.sourceType === "expense" && isId(entry.sourceId))
        .map((entry) => String(entry.sourceId)),
      ...linkedDocumentRows
        .filter((item) => item.documentType === "expense" && isId(item.documentId))
        .map((item) => String(item.documentId)),
    ])];
    const [invoices, supplierBills, expenses, legacyDealInvoices] = await Promise.all([
      invoiceIds.length
        ? Invoice.find({ _id: { $in: invoiceIds } })
          .select("invoiceNo customerId dealId currency")
          .populate("customerId", "name companyName")
          .populate("dealId", "dealNo title")
          .lean()
        : [],
      supplierBillIds.length
        ? VendorBill.find({ _id: { $in: supplierBillIds } })
          .select("billNo vendorName currency")
          .lean()
        : [],
      expenseIds.length
        ? Expense.find({ _id: { $in: expenseIds } })
          .select("title payeeVendor invoiceBillNo")
          .lean()
        : [],
      Invoice.find({
        dealId: { $ne: null },
        status: { $ne: "void" },
        payments: { $elemMatch: { amount: { $gt: 0 }, journalEntry: null } },
      })
        .select("invoiceNo dealId customerId currency payments")
        .populate("customerId", "name companyName")
        .populate("dealId", "dealNo title")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);
    const invoiceById = new Map(invoices.map((item) => [String(item._id), item]));
    const supplierBillById = new Map(supplierBills.map((item) => [String(item._id), item]));
    const expenseById = new Map(expenses.map((item) => [String(item._id), item]));
    const unpostedDealCollections = legacyDealInvoices.flatMap((invoice) =>
      (invoice.payments || [])
        .filter((payment) => Number(payment.amount || 0) > 0 && !payment.journalEntry)
        .map((payment) => ({
          invoice: { _id: invoice._id, invoiceNo: invoice.invoiceNo },
          deal: invoice.dealId
            ? { _id: invoice.dealId._id, dealNo: invoice.dealId.dealNo, title: invoice.dealId.title }
            : null,
          customer: invoice.customerId
            ? { _id: invoice.customerId._id, name: invoice.customerId.companyName || invoice.customerId.name }
            : null,
          amount: money(payment.amount),
          currency: invoice.currency,
          paidAt: payment.paidAt,
          method: payment.method,
          reference: payment.transactionId,
          reason: "Legacy CRM payment has no posted General Ledger receipt and is excluded from treasury balances.",
        }))
    );
    const exceptions = {
      unpostedDealCollections,
      count: unpostedDealCollections.length,
      total: money(unpostedDealCollections.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
    };
    const sourceLabels = {
      customer_payment: "Customer receipt",
      vendor_payment: "Supplier payment",
      expense: "Expense payment",
      bank_transfer: "Bank transfer",
      payroll: "Payroll payment",
      tax: "Tax payment",
      opening_balance: "Opening balance",
      manual: "Treasury voucher",
    };

    const sourceDocumentsForEntry = (entry) => {
      const documents = [];
      const addInvoice = (id) => {
        const invoice = invoiceById.get(String(id || ""));
        if (!invoice || documents.some((item) => item.type === "invoice" && String(item._id) === String(invoice._id))) return;
        documents.push({
          _id: invoice._id,
          type: "invoice",
          number: invoice.invoiceNo,
          partyName: invoice.customerId?.companyName || invoice.customerId?.name || "Customer",
          deal: invoice.dealId
            ? { _id: invoice.dealId._id, dealNo: invoice.dealId.dealNo, title: invoice.dealId.title }
            : null,
        });
      };
      const addSupplierBill = (id) => {
        const bill = supplierBillById.get(String(id || ""));
        if (!bill || documents.some((item) => item.type === "supplier_bill" && String(item._id) === String(bill._id))) return;
        documents.push({ _id: bill._id, type: "supplier_bill", number: bill.billNo, partyName: bill.vendorName });
      };
      const addExpense = (id) => {
        const expense = expenseById.get(String(id || ""));
        if (!expense || documents.some((item) => item.type === "expense" && String(item._id) === String(expense._id))) return;
        documents.push({ _id: expense._id, type: "expense", number: expense.invoiceBillNo || expense.title, partyName: expense.payeeVendor });
      };

      if (entry.sourceType === "customer_payment") addInvoice(entry.sourceId);
      if (entry.sourceType === "vendor_payment") addSupplierBill(entry.sourceId);
      if (entry.sourceType === "expense") addExpense(entry.sourceId);
      for (const item of entry.linkedDocuments || []) {
        if (item.documentType === "invoice") addInvoice(item.documentId);
        if (item.documentType === "supplier_bill") addSupplierBill(item.documentId);
        if (item.documentType === "expense") addExpense(item.documentId);
      }
      return documents;
    };

    const rows = [];
    for (const entry of periodEntries) {
      const documents = sourceDocumentsForEntry(entry);
      const row = {
        journalEntryId: entry._id,
        date: entry.date,
        entryNo: entry.entryNo,
        voucherType: entry.voucherType,
        sourceType: entry.sourceType,
        sourceLabel: sourceLabels[entry.sourceType] || "Accounting entry",
        sourceId: entry.sourceId,
        reference: entry.reference,
        particulars: entry.memo || "",
        paymentMode: entry.paymentMode,
        partyType: entry.partyType,
        partyName: entry.partyName || documents.find((item) => item.partyName)?.partyName || "",
        documents,
        deal: documents.find((item) => item.deal)?.deal || null,
        cashIn: 0,
        cashOut: 0,
        bankIn: 0,
        bankOut: 0,
        accounts: [],
        counterparties: [],
      };
      for (const line of entry.lines || []) {
        const accountId = String(line.account?._id || line.account);
        const treasury = treasuryMap.get(accountId);
        if (!treasury || !ledgerIds.some((id) => String(id) === accountId)) {
          if (line.account?._id) {
            row.counterparties.push({
              _id: line.account._id,
              code: line.account.code,
              name: line.account.name,
              type: line.account.type,
              description: line.description,
            });
          }
          continue;
        }
        row.accounts.push({ _id: treasury.ledger._id, code: treasury.ledger.code, name: treasury.name, kind: treasury.kind, description: line.description });
        if (!row.particulars && line.description) row.particulars = line.description;
        const incoming = money(line.debit); const outgoing = money(line.credit);
        if (treasury.kind === "cash") { row.cashIn = money(row.cashIn + incoming); row.cashOut = money(row.cashOut + outgoing); }
        else { row.bankIn = money(row.bankIn + incoming); row.bankOut = money(row.bankOut + outgoing); }
      }
      if (!row.accounts.length) continue;
      const movement = money(row.cashIn + row.bankIn - row.cashOut - row.bankOut);
      runningBalance = money(runningBalance + movement);
      row.movement = movement;
      row.inflow = money(row.cashIn + row.bankIn);
      row.outflow = money(row.cashOut + row.bankOut);
      row.direction = row.inflow > 0 && row.outflow > 0 ? "transfer" : movement >= 0 ? "inflow" : "outflow";
      row.balance = runningBalance;
      rows.push(row);
    }
    const openingBalance = money([...openingByAccount.values()].reduce((sum, value) => sum + value, 0));
    const accountBalances = selectedAccounts.map((item) => {
      const movement = periodMovementByAccount.get(String(item.ledger._id))?.movement || 0;
      const opening = openingByAccount.get(String(item.ledger._id)) || 0;
      return { ...item, openingBalance: money(opening), closingBalance: money(opening + movement) };
    });
    return res.json({
      from, to, scope, currency: currency || null, accounts: allAccounts, selectedAccounts: accountBalances, openingBalance, rows, summary, exceptions,
      closingBalance: money(openingBalance + summary.netMovement), pageInfo: { limit: reportLimit, hasNextPage: truncated, nextCursor: "" },
      basis: "Live from posted and reversal-linked General Ledger lines touching connected cash and bank ledgers. Deal money appears only after its invoice receipt is posted; won or invoiced value alone is not cash.",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to load cash book.", error: error.message });
  }
};

export const getTrialBalance = async (req, res) => {
  try {
    const asOf = req.query.asOf || req.query.to ? new Date(req.query.asOf || req.query.to) : new Date();
    if (Number.isNaN(asOf.getTime())) return res.status(400).json({ message: "Invalid as-of date." });
    asOf.setHours(23, 59, 59, 999);
    let from = req.query.from ? new Date(req.query.from) : null;
    if (from && Number.isNaN(from.getTime())) return res.status(400).json({ message: "Invalid period start date." });
    if (!from) from = (await FiscalYear.findOne({ startDate: { $lte: asOf }, endDate: { $gte: asOf } }).select("startDate").lean())?.startDate || null;
    if (from) from = new Date(new Date(from).setHours(0, 0, 0, 0));
    if (from && from > asOf) return res.status(400).json({ message: "Period start date cannot be after the as-of date." });

    const aggregateAccountTotals = async (match) => JournalEntry.aggregate([
      { $match: match }, { $unwind: "$lines" },
      { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
    ]).allowDiskUse(true);
    const openingDateCondition = from
      ? { $or: [{ date: { $lt: from } }, { sourceType: "opening_balance", date: { $lte: asOf } }] }
      : { sourceType: "opening_balance", date: { $lte: asOf } };
    const movementDate = { $lte: asOf }; if (from) movementDate.$gte = from;
    const [accounts, openingRows, movementRows] = await Promise.all([
      Account.find({ isGroup: { $ne: true } }).select("code name type subType normalBalance currency isActive").sort({ type: 1, code: 1 }).lean(),
      aggregateAccountTotals({ status: { $in: ACTIVE_LEDGER_STATUSES }, ...openingDateCondition }),
      aggregateAccountTotals({ status: { $in: ACTIVE_LEDGER_STATUSES }, sourceType: { $ne: "opening_balance" }, date: movementDate }),
    ]);
    const openingMap = new Map(openingRows.map((row) => [String(row._id), row]));
    const movementMap = new Map(movementRows.map((row) => [String(row._id), row]));
    const includeZero = String(req.query.includeZero || "false") === "true";
    const rows = accounts.map((account) => {
      const opening = openingMap.get(String(account._id)) || { debit: 0, credit: 0 };
      const movement = movementMap.get(String(account._id)) || { debit: 0, credit: 0 };
      const openingSigned = money(opening.debit - opening.credit);
      const closingSigned = money(openingSigned + movement.debit - movement.credit);
      return {
        account,
        openingDebit: openingSigned > 0 ? openingSigned : 0, openingCredit: openingSigned < 0 ? Math.abs(openingSigned) : 0,
        periodDebit: money(movement.debit), periodCredit: money(movement.credit),
        closingDebit: closingSigned > 0 ? closingSigned : 0, closingCredit: closingSigned < 0 ? Math.abs(closingSigned) : 0,
        debit: closingSigned > 0 ? closingSigned : 0, credit: closingSigned < 0 ? Math.abs(closingSigned) : 0,
        balance: Math.abs(closingSigned), balanceSide: closingSigned >= 0 ? "Dr" : "Cr",
      };
    }).filter((row) => includeZero || row.openingDebit || row.openingCredit || row.periodDebit || row.periodCredit || row.closingDebit || row.closingCredit);
    const totalFields = ["openingDebit", "openingCredit", "periodDebit", "periodCredit", "closingDebit", "closingCredit"];
    const sumRows = (items) => Object.fromEntries(totalFields.map((field) => [field, money(items.reduce((sum, row) => sum + Number(row[field] || 0), 0))]));
    const grouped = ["asset", "liability", "equity", "revenue", "expense"].map((type) => {
      const groupRows = rows.filter((row) => row.account.type === type);
      return { type, rows: groupRows, totals: sumRows(groupRows) };
    }).filter((group) => group.rows.length);
    const totals = sumRows(rows); totals.debit = totals.closingDebit; totals.credit = totals.closingCredit;
    return res.json({
      asOf, from, rows, groups: grouped, totals,
      isBalanced: totals.closingDebit === totals.closingCredit,
      difference: money(totals.closingDebit - totals.closingCredit),
      basis: "Live aggregation of opening and posted voucher lines by leaf account.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load trial balance.", error: error.message });
  }
};

export const getBalanceSheet = async (req, res) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    if (Number.isNaN(to.getTime())) return res.status(400).json({ message: "Invalid to date." });
    to.setHours(23, 59, 59, 999);
    const fiscalYear = await FiscalYear.findOne({ startDate: { $lte: to }, endDate: { $gte: to } }).select("startDate name").lean();
    const earningsFrom = fiscalYear?.startDate ? new Date(fiscalYear.startDate) : new Date(to.getFullYear(), 0, 1);
    earningsFrom.setHours(0, 0, 0, 0);
    const [rows, earningsRows] = await Promise.all([
      JournalEntry.aggregate([
        { $match: { status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $lte: to } } },
        { $unwind: "$lines" },
        { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
        { $lookup: { from: "accounts", localField: "_id", foreignField: "_id", as: "account" } },
        { $unwind: "$account" },
        { $match: { "account.type": { $in: ["asset", "liability", "equity"] } } },
        { $project: { account: { _id: "$account._id", code: "$account.code", name: "$account.name", type: "$account.type" }, balance: accountBalanceExpression } },
        { $sort: { "account.type": 1, "account.code": 1 } },
      ]).allowDiskUse(true),
      aggregateAccrualProfitLoss({ from: earningsFrom, to }),
    ]);
    const groups = { assets: [], liabilities: [], equity: [] };
    for (const row of rows) {
      const key = row.account.type === "asset" ? "assets" : row.account.type === "liability" ? "liabilities" : "equity";
      groups[key].push({ ...row, balance: money(row.balance) });
    }
    const earningsTotals = {};
    for (const row of earningsRows) {
      const key = profitLossGroupForAccount(row.account); earningsTotals[key] = money(Number(earningsTotals[key] || 0) + Number(row.amount || 0));
    }
    const closingPosted = await JournalEntry.exists({ sourceType: "fiscal_closing", status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $gte: earningsFrom, $lte: to } });
    const currentYearEarnings = closingPosted ? 0 : profitLossSummary(earningsTotals).netProfit;
    groups.equity.push({ account: { _id: "current-year-earnings", code: "CYE", name: "Current Year Earnings", type: "equity" }, balance: currentYearEarnings, synthetic: true });
    const sum = (items) => money(items.reduce((total, item) => total + Number(item.balance || 0), 0));
    return res.json({
      asOf: to,
      ...groups,
      totals: {
        assets: sum(groups.assets),
        liabilities: sum(groups.liabilities),
        equity: sum(groups.equity),
        liabilitiesAndEquity: money(sum(groups.liabilities) + sum(groups.equity)),
      },
      currentYearEarnings: { amount: currentYearEarnings, from: earningsFrom, to, fiscalYear: fiscalYear?.name || String(to.getFullYear()) },
      basis: "Assets, liabilities, and equity are live GL balances. Current Year Earnings is linked to the accrual Profit & Loss for the active fiscal year.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load balance sheet.", error: error.message });
  }
};

export const getCashFlowStatement = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const settings = await AccountingSettings.findOne({ key: "company" }).select("currency").lean();
    const currency = clean(req.query.currency || settings?.currency || "BDT").toUpperCase();
    const [cashAccounts, bankAccounts] = await Promise.all([
      CashAccount.find({ account: { $ne: null }, currency }).select("account name type currency").lean(),
      BankAccount.find({ ledgerAccount: { $ne: null }, currency }).select("ledgerAccount accountName accountNumber currency").lean(),
    ]);
    const cashIds = [...new Map(
      [...cashAccounts.map((item) => item.account), ...bankAccounts.map((item) => item.ledgerAccount)]
        .filter(Boolean)
        .map((id) => [String(id), id])
    ).values()];
    const emptyTotals = { inflow: 0, outflow: 0, net: 0 };
    if (!cashIds.length) {
      return res.json({
        currency,
        activities: [
          { key: "operating", name: "Operating Activities", items: [], totals: { ...emptyTotals } },
          { key: "investing", name: "Investing Activities", items: [], totals: { ...emptyTotals } },
          { key: "financing", name: "Financing Activities", items: [], totals: { ...emptyTotals } },
        ],
        items: [],
        totals: { ...emptyTotals, openingBalance: 0, closingBalance: 0, internalTransfers: 0, excludedOpeningAdjustments: 0 },
        basis: `No linked cash or bank ledgers were found in ${currency}.`,
      });
    }

    const treasurySet = new Set(cashIds.map(String));
    const openingMatch = {
      status: { $in: ACTIVE_LEDGER_STATUSES },
      ...(range.from ? { date: { $lt: range.from } } : { _id: { $exists: false } }),
      "lines.account": { $in: cashIds },
    };
    const closingMatch = {
      status: { $in: ACTIVE_LEDGER_STATUSES },
      ...(range.to ? { date: { $lte: range.to } } : {}),
      "lines.account": { $in: cashIds },
    };
    const balancePipeline = (match) => [
      { $match: match },
      { $unwind: "$lines" },
      { $match: { "lines.account": { $in: cashIds } } },
      { $group: { _id: null, debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
    ];
    const [openingRows, closingRows, entries] = await Promise.all([
      JournalEntry.aggregate(balancePipeline(openingMatch)).allowDiskUse(true),
      JournalEntry.aggregate(balancePipeline(closingMatch)).allowDiskUse(true),
      JournalEntry.find({ ...ledgerMatchForRange(range), "lines.account": { $in: cashIds }, currency })
        .select("entryNo date voucherType sourceType reference memo currency lines")
        .populate("lines.account", "code name type subType normalBalance")
        .sort({ date: 1, createdAt: 1, _id: 1 })
        .lean(),
    ]);

    const classifyAccount = (account) => {
      const subtype = clean(account?.subType).toLowerCase();
      const name = clean(account?.name).toLowerCase();
      if (
        account?.type === "equity" ||
        (account?.type === "liability" && /loan|long.?term|non.?current|finance/.test(`${subtype} ${name}`))
      ) return "financing";
      if (
        account?.type === "asset" &&
        /fixed|non.?current|property|plant|equipment|furniture|investment|intangible/.test(`${subtype} ${name}`)
      ) return "investing";
      return "operating";
    };
    const labels = {
      operating: "Operating Activities",
      investing: "Investing Activities",
      financing: "Financing Activities",
    };
    const activityMaps = {
      operating: new Map(),
      investing: new Map(),
      financing: new Map(),
    };
    let internalTransfers = 0;
    let excludedOpeningAdjustments = 0;

    const addActivity = (key, account, inflow, outflow, entry) => {
      const id = String(account?._id || `${key}-unclassified`);
      const current = activityMaps[key].get(id) || {
        account: account ? { _id: account._id, code: account.code, name: account.name, type: account.type, subType: account.subType } : null,
        name: account?.name || "Other cash activity",
        inflow: 0,
        outflow: 0,
        net: 0,
        count: 0,
        lastDate: null,
      };
      current.inflow = money(current.inflow + inflow);
      current.outflow = money(current.outflow + outflow);
      current.net = money(current.inflow - current.outflow);
      current.count += 1;
      current.lastDate = entry.date;
      activityMaps[key].set(id, current);
    };

    for (const entry of entries) {
      const treasuryLines = [];
      const counterpartLines = [];
      for (const line of entry.lines || []) {
        const accountId = String(line.account?._id || line.account);
        if (treasurySet.has(accountId)) treasuryLines.push(line);
        else counterpartLines.push(line);
      }
      const treasuryNet = money(treasuryLines.reduce(
        (sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0),
        0
      ));
      if (Math.abs(treasuryNet) < 0.005) {
        if (treasuryLines.length > 1) internalTransfers += 1;
        continue;
      }
      if (entry.sourceType === "opening_balance") {
        excludedOpeningAdjustments = money(excludedOpeningAdjustments + treasuryNet);
        continue;
      }

      const inflow = treasuryNet > 0;
      let allocated = 0;
      for (const line of counterpartLines) {
        const amount = money(inflow
          ? Number(line.credit || 0) - Number(line.debit || 0)
          : Number(line.debit || 0) - Number(line.credit || 0));
        if (amount <= 0) continue;
        const key = classifyAccount(line.account);
        addActivity(key, line.account, inflow ? amount : 0, inflow ? 0 : amount, entry);
        allocated = money(allocated + amount);
      }
      const remainder = money(Math.abs(treasuryNet) - allocated);
      if (remainder > 0.005) addActivity("operating", null, inflow ? remainder : 0, inflow ? 0 : remainder, entry);
    }

    const activities = Object.entries(activityMaps).map(([key, rows]) => {
      const items = [...rows.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      const totals = items.reduce(
        (acc, row) => ({
          inflow: money(acc.inflow + row.inflow),
          outflow: money(acc.outflow + row.outflow),
          net: money(acc.net + row.net),
        }),
        { ...emptyTotals }
      );
      return { key, name: labels[key], items, totals };
    });
    const items = activities.map((activity) => ({
      sourceType: activity.key,
      name: activity.name,
      ...activity.totals,
      count: activity.items.reduce((sum, item) => sum + item.count, 0),
    }));
    const activityTotals = items.reduce(
      (acc, row) => ({
        inflow: money(acc.inflow + row.inflow),
        outflow: money(acc.outflow + row.outflow),
        net: money(acc.net + row.net),
      }),
      { ...emptyTotals }
    );
    const openingBalance = money(Number(openingRows[0]?.debit || 0) - Number(openingRows[0]?.credit || 0));
    const closingBalance = money(Number(closingRows[0]?.debit || 0) - Number(closingRows[0]?.credit || 0));
    const totals = {
      ...activityTotals,
      openingBalance,
      closingBalance,
      internalTransfers,
      excludedOpeningAdjustments,
      reconciliationDifference: money(closingBalance - openingBalance - activityTotals.net - excludedOpeningAdjustments),
    };
    return res.json({
      currency,
      from: range.from,
      to: range.to,
      activities,
      items,
      totals,
      basis: "IAS 7-style direct-method classification from posted General Ledger lines linked to cash and bank accounts. Internal treasury transfers and opening-balance setup entries are excluded from operating, investing, and financing cash flows.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load cash flow.", error: error.message });
  }
};
