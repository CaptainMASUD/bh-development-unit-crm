import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Expense from "../models/expense.model.js";
import Invoice from "../models/invoice.model.js";
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
import User from "../models/user.model.js";
import { accountingCache } from "../utils/cache.js";
import { getReqMeta, writeAudit } from "../utils/audit.js";
import { nextAccountingNumber } from "../services/accountingNumbering.service.js";
import { createPostedJournal } from "../services/accountingPosting.service.js";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const toId = (value) => new mongoose.Types.ObjectId(String(value));
const ACTIVE_LEDGER_STATUSES = ["posted", "reversed"];
const VOUCHER_TYPES = ["journal", "payment", "receipt", "contra", "opening", "closing", "sales", "purchase", "payroll", "tax", "adjustment"];
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
      invoice.payments.push({ amount, method: ["cash", "bank", "card"].includes(entry.paymentMode) ? entry.paymentMode : "other", transactionId: entry.reference, paidAt: entry.date, note: entry.memo, receivedBy: userId, journalEntry: entry._id });
      await invoice.save(session ? { session } : undefined);
    }
    if (allocation.documentType === "supplier_bill") {
      const query = VendorBill.findById(allocation.documentId); if (session) query.session(session); const bill = await query;
      if (!bill || ["draft", "void"].includes(bill.status)) throw Object.assign(new Error("A linked supplier bill is no longer available."), { statusCode: 409 });
      if (bill.payments.some((payment) => String(payment.journalEntry || "") === String(entry._id))) continue;
      if (amount > money(bill.dueTotal) + 0.009) throw Object.assign(new Error(`Payment allocation exceeds bill ${bill.billNo} balance.`), { statusCode: 409 });
      bill.payments.push({ amount, paidAt: entry.date, cashAccount: entry.cashAccount || null, journalEntry: entry._id, reference: entry.reference, note: entry.memo, paidBy: userId });
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

const SYSTEM_ACCOUNTS = [
  { code: "A000", name: "ASSETS", type: "asset", subType: "Asset", isGroup: true },
  { code: "L000", name: "LIABILITIES", type: "liability", subType: "Liability", isGroup: true },
  { code: "E000", name: "EQUITY", type: "equity", subType: "Equity", isGroup: true },
  { code: "I000", name: "INCOME", type: "revenue", subType: "Income", isGroup: true },
  { code: "X000", name: "EXPENSES", type: "expense", subType: "Expense", isGroup: true },
  { code: "1000", name: "Cash on Hand", type: "asset", subType: "Current Asset", parentCode: "A000" },
  { code: "1010", name: "Bank Account", type: "asset", subType: "Current Asset", parentCode: "A000" },
  { code: "1100", name: "Accounts Receivable", type: "asset", subType: "Current Asset", parentCode: "A000", isControlAccount: true, controlType: "receivable" },
  { code: "1200", name: "Input VAT / Tax Receivable", type: "asset", subType: "Current Asset", parentCode: "A000", isControlAccount: true, controlType: "tax" },
  { code: "2000", name: "Accounts Payable", type: "liability", subType: "Current Liability", parentCode: "L000", isControlAccount: true, controlType: "payable" },
  { code: "2100", name: "Output VAT / Tax Payable", type: "liability", subType: "Current Liability", parentCode: "L000", isControlAccount: true, controlType: "tax" },
  { code: "2200", name: "Payroll Payable", type: "liability", subType: "Current Liability", parentCode: "L000" },
  { code: "3000", name: "Owner Equity", type: "equity", subType: "Capital", parentCode: "E000" },
  { code: "3100", name: "Opening Balance Equity", type: "equity", subType: "Equity", parentCode: "E000" },
  { code: "3200", name: "Retained Earnings", type: "equity", subType: "Retained Earnings", parentCode: "E000" },
  { code: "4000", name: "Sales Revenue", type: "revenue", subType: "Operating Income", parentCode: "I000" },
  { code: "5000", name: "Operating Expense", type: "expense", subType: "Indirect Expense", parentCode: "X000" },
  { code: "5010", name: "Purchases", type: "expense", subType: "Direct Expense", parentCode: "X000" },
  { code: "5100", name: "Payroll Expense", type: "expense", subType: "Indirect Expense", parentCode: "X000" },
  { code: "5110", name: "Salary Expense", type: "expense", subType: "Indirect Expense", parentCode: "X000" },
  { code: "5120", name: "Rent Expense", type: "expense", subType: "Indirect Expense", parentCode: "X000" },
  { code: "5200", name: "Tax Expense", type: "expense", subType: "Indirect Expense", parentCode: "X000" },
];

const resolveSystemAccount = async (code) => {
  const settingField = {
    1000: "defaultCashAccount",
    1010: "defaultBankAccount",
    1100: "receivableAccount",
    2000: "payableAccount",
    2200: "payrollPayableAccount",
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
  const account = await Account.findOne({ code: String(code), isActive: true }).lean();
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
  if (invalid) { const err = new Error(`Account ${invalid.code} - ${invalid.name} is not an active, published leaf account and cannot receive postings.`); err.statusCode = 400; throw err; }
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

export const getReceivables = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const cacheId = cacheKey("receivables", req.query);
    const cachedSummary = accountingCache.get(cacheId);
    const data = cachedSummary
      ? { rows: await Deal.aggregate(receivableRowsOnlyPipeline({ ...range, q: req.query.q, limit, cursor })).allowDiskUse(true), summary: [] }
      : (await Deal.aggregate(receivablePipeline({ ...range, q: req.query.q, limit, cursor })).allowDiskUse(true))[0] || {};
    const summary = data.summary?.[0] || {};
    const rows = data.rows || [];
    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor = hasNextPage && last ? encodeCursor({ date: last.accountingDate || last.wonAt, id: last._id }) : "";
    const nextSummary = cachedSummary || {
      dealCount: Number(summary.dealCount || 0),
      dealValue: money(summary.dealValue),
      invoicedAmount: money(summary.invoicedAmount),
      paidAmount: money(summary.paidAmount),
      invoiceDueAmount: money(summary.invoiceDueAmount),
      unbilledAmount: money(summary.unbilledAmount),
      receivableAmount: money(summary.receivableAmount),
      overdueAmount: money(summary.overdueAmount),
      overdueCount: Number(summary.overdueCount || 0),
    };
    if (!cachedSummary) accountingCache.set(cacheId, nextSummary);
    return res.json({
      summary: nextSummary,
      rows: pageRows,
      pageInfo: { limit, hasNextPage, nextCursor },
      basis: "Accrual receivables from won deals. Outstanding equals invoice due plus won deal value not invoiced yet.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load receivables.", error: error.message });
  }
};

export const getPayables = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const limit = parseLimit(req.query.limit);
    const cursor = decodeCursor(req.query.cursor);
    const rx = textRegex(req.query.q);
    const match = { ...dateExpr("expenseDate", range.from, range.to) };
    if (req.query.status && req.query.status !== "all") match.status = String(req.query.status).toLowerCase();
    if (rx) match.$or = [{ title: rx }, { payeeVendor: rx }, { invoiceBillNo: rx }, { referenceNo: rx }];
    const cacheId = cacheKey("payables", req.query);
    const cachedSummary = accountingCache.get(cacheId);

    const [data = {}] = await Expense.aggregate([
      { $match: match },
      {
        $facet: {
          rows: [
            { $match: cursorMatch("expenseDate", cursor) },
            { $sort: { expenseDate: -1, createdAt: -1, _id: -1 } },
            { $limit: limit + 1 },
            {
              $lookup: {
                from: "expensecategories",
                localField: "category",
                foreignField: "_id",
                as: "category",
                pipeline: [{ $project: { name: 1, parent: 1 } }],
              },
            },
            { $addFields: { category: { $first: "$category" } } },
            { $project: { title: 1, category: 1, expenseDate: 1, amount: 1, status: 1, paymentMethod: 1, payeeVendor: 1, invoiceBillNo: 1, referenceNo: 1, branch: 1 } },
          ],
          statusSummary: cachedSummary ? [{ $match: { _id: { $exists: false } } }] : [{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
          vendorSummary: cachedSummary ? [{ $match: { _id: { $exists: false } } }] : [
            { $match: { status: { $in: ["pending", "approved"] } } },
            { $group: { _id: { $ifNull: ["$payeeVendor", ""] }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
            { $sort: { amount: -1 } },
            { $limit: 8 },
          ],
        },
      },
    ]).allowDiskUse(true);

    const statusSummary = cachedSummary?.statusSummary || (data.statusSummary || []).reduce((acc, item) => {
      acc[item._id || "unknown"] = { count: Number(item.count || 0), amount: money(item.amount) };
      return acc;
    }, {});
    const pending = statusSummary.pending?.amount || 0;
    const approved = statusSummary.approved?.amount || 0;
    const paid = statusSummary.paid?.amount || 0;
    const rows = data.rows || [];
    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor = hasNextPage && last ? encodeCursor({ date: last.expenseDate, id: last._id }) : "";

    const summary = cachedSummary?.summary || {
        pendingAmount: money(pending),
        approvedAmount: money(approved),
        paidAmount: money(paid),
        payableAmount: money(pending + approved),
        pendingCount: statusSummary.pending?.count || 0,
        approvedCount: statusSummary.approved?.count || 0,
        paidCount: statusSummary.paid?.count || 0,
        rejectedAmount: money(statusSummary.rejected?.amount || 0),
      };
    const vendorSummary = cachedSummary?.vendorSummary || (data.vendorSummary || []).map((item) => ({ vendor: item._id || "Unassigned", amount: money(item.amount), count: item.count }));
    if (!cachedSummary) accountingCache.set(cacheId, { summary, statusSummary, vendorSummary });

    return res.json({
      summary,
      rows: pageRows,
      pageInfo: { limit, hasNextPage, nextCursor },
      vendorSummary,
      basis: "Payables are expense records not yet marked paid. Approved expenses are recognized liabilities; pending expenses are shown as commitments awaiting approval.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load payables.", error: error.message });
  }
};

export const getProfitLoss = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const cacheId = cacheKey("profit-loss", req.query);
    const cached = accountingCache.get(cacheId);
    if (cached) return res.json(cached);
    const revenueMatch = { stage: "won", ...dateExpr("accountingDate", range.from, range.to) };
    const expenseMatch = { status: { $in: ["approved", "paid"] }, ...dateExpr("expenseDate", range.from, range.to) };
    const paymentMatch = { status: { $ne: "void" } };

    const [revenueRows, expenseRows, invoiceCash] = await Promise.all([
      Deal.aggregate([
        dealAccountingDateStage,
        { $match: revenueMatch },
        { $group: { _id: "$currency", revenue: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
      ]).allowDiskUse(true),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $lookup: {
            from: "expensecategories",
            localField: "category",
            foreignField: "_id",
            as: "category",
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        { $addFields: { categoryName: { $ifNull: [{ $first: "$category.name" }, "Uncategorized"] } } },
        { $group: { _id: "$categoryName", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { amount: -1 } },
      ]).allowDiskUse(true),
      Invoice.aggregate([
        { $match: paymentMatch },
        { $unwind: "$payments" },
        ...(range.from || range.to ? [{ $match: dateExpr("payments.paidAt", range.from, range.to) }] : []),
        { $group: { _id: null, collected: { $sum: "$payments.amount" } } },
      ]).allowDiskUse(true),
    ]);

    const revenue = money(revenueRows.reduce((sum, item) => sum + Number(item.revenue || 0), 0));
    const operatingExpenses = money(expenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    const netProfit = money(revenue - operatingExpenses);
    const dealCount = revenueRows.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const expenseCount = expenseRows.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const cashCollected = money(invoiceCash?.[0]?.collected || 0);

    const response = {
      summary: {
        revenue,
        costOfGoodsSold: 0,
        grossProfit: revenue,
        operatingExpenses,
        netProfit,
        netMargin: revenue > 0 ? money((netProfit / revenue) * 100) : 0,
        dealCount,
        expenseCount,
        cashCollected,
      },
      revenueByCurrency: revenueRows.map((item) => ({ currency: item._id || "BDT", revenue: money(item.revenue), count: item.count })),
      expensesByCategory: expenseRows.map((item) => ({ category: item._id, amount: money(item.amount), count: item.count })),
      basis: "Accrual P&L: revenue is recognized from won deals; operating expenses include approved and paid expenses. Cash collected is shown separately.",
    };
    accountingCache.set(cacheId, response);
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load profit and loss.", error: error.message });
  }
};

export const bootstrapChartOfAccounts = async (req, res) => {
  try {
    const created = [];
    const updated = [];
    const ordered = [...SYSTEM_ACCOUNTS].sort((a, b) => Number(Boolean(a.parentCode)) - Number(Boolean(b.parentCode)));
    for (const source of ordered) {
      const item = { ...source };
      delete item.parentCode;
      if (source.parentCode) item.parent = (await Account.findOne({ code: source.parentCode }).select("_id").lean())?._id || null;
      const existing = await Account.findOne({ code: item.code });
      if (existing) {
        existing.set({ ...item, isSystem: true, isActive: existing.isActive !== false, updatedBy: req.user?._id || null });
        await existing.save();
        updated.push(existing);
      } else {
        created.push(await Account.create({ ...item, isSystem: true, createdBy: req.user?._id || null }));
      }
    }
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
  "receivableAccount",
  "payableAccount",
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

const populateSettings = (query) =>
  query.populate([
    ...SETTINGS_ACCOUNT_FIELDS.map((path) => ({ path, select: "code name type isActive" })),
    { path: "defaultFiscalYear", select: "name startDate endDate status" },
    { path: "updatedBy", select: "name email role" },
  ]);

export const getAccountingSettings = async (req, res) => {
  try {
    let settings = await populateSettings(AccountingSettings.findOne({ key: "company" }));
    if (!settings) settings = await AccountingSettings.create({ key: "company" });
    settings = await populateSettings(AccountingSettings.findById(settings._id));
    return res.json({ settings });
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
      const count = await Account.countDocuments({ _id: { $in: ids }, isActive: true, isGroup: { $ne: true } });
      if (count !== new Set(ids.map(String)).size) return res.status(400).json({ message: "All selected default accounts must be active accounts." });
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
    const patch = {};
    for (const key of ["code", "name", "type", "subType", "currency", "description", "isActive", "isGroup", "isControlAccount", "controlType", "taxApplicability"]) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    const current = await Account.findById(req.params.id).lean();
    if (!current) return res.status(404).json({ message: "Account not found." });
    if (req.body.isActive === false && await JournalEntry.exists({ "lines.account": current._id })) patch.isActive = false;
    if (req.body.isGroup === true && await JournalEntry.exists({ "lines.account": current._id })) return res.status(409).json({ message: "An account with posting history cannot be converted into a group." });
    if (req.body.parent !== undefined) {
      if (!req.body.parent) patch.parent = null;
      else {
        if (!isId(req.body.parent) || String(req.body.parent) === String(current._id)) return res.status(400).json({ message: "Invalid parent account." });
        const parent = await Account.findById(req.body.parent).lean();
        const nextType = req.body.type || current.type;
        if (!parent?.isGroup || !parent.isActive || parent.type !== nextType) return res.status(400).json({ message: "Parent must be an active group of the same account type." });
        patch.parent = parent._id;
      }
    }
    if (Object.keys(patch).some((key) => !["updatedBy"].includes(key))) {
      patch.publishedAt = null;
      patch.publishedBy = null;
    }
    patch.updatedBy = req.user?._id || null;
    const account = await Account.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!account) return res.status(404).json({ message: "Account not found." });
    return res.json({ message: "Account updated.", account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update account.", error: error.message });
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
  const session = await mongoose.startSession();
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    let original; let reversal;
    await session.withTransaction(async () => {
      original = await JournalEntry.findById(req.params.id).session(session);
      if (!original) throw Object.assign(new Error("Journal entry not found."), { statusCode: 404 });
      if (original.status !== "posted") throw Object.assign(new Error("Only posted journal entries can be reversed."), { statusCode: 409 });
      if (original.origin !== "manual") throw Object.assign(new Error("System-generated entries must be reversed from their source module."), { statusCode: 409 });
      const [completedReconciliation, legacyReconciledTransaction] = await Promise.all([
        BankReconciliation.exists({ status: { $in: ["completed", "reconciled"] }, "statementLines.matchedJournalEntry": original._id }).session(session),
        BankTransaction.exists({ journalEntry: original._id, reconciled: true }).session(session),
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
      await reversal.save({ session });
      original.status = "reversed"; original.reversedAt = new Date(); original.reversedBy = req.user?._id || null; original.reversedByEntry = reversal._id; original.reversalReason = clean(req.body.reason); await original.save({ session });
    });
    accountingCache.flushAll();
    await writeAudit({ actorId: req.user?._id, action: "reverse", entityType: "JournalEntry", entityId: original._id, before: { status: "posted" }, after: original.toObject(), meta: { ...getReqMeta(req), reason: clean(req.body.reason) } });
    return res.json({ message: "Reversal journal posted with a complete audit link.", journalEntry: original, reversalEntry: reversal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to reverse journal entry.", error: error.message });
  } finally { session.endSession(); }
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
  const session = await mongoose.startSession();
  try {
    if (!clean(req.body.name)) return res.status(400).json({ message: "Cash account name is required." });
    let cashAccount;
    await session.withTransaction(async () => {
      let ledger = isId(req.body.account) ? await Account.findOne({ _id: req.body.account, type: "asset", isActive: true, isGroup: { $ne: true } }).session(session) : null;
      if (req.body.account && !ledger) throw Object.assign(new Error("Select an active leaf Asset ledger."), { statusCode: 400 });
      if (ledger && await CashAccount.exists({ account: ledger._id }).session(session)) throw Object.assign(new Error("That ledger is already connected to another cash account."), { statusCode: 409 });
      if (!ledger) {
        const settings = await AccountingSettings.findOne({ key: "company" }).select("coaPublishedAt").session(session).lean();
        ledger = new Account({
          code: `CASH-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`,
          name: clean(req.body.name), type: "asset", subType: "Cash and Cash Equivalents",
          currency: clean(req.body.currency || "BDT").toUpperCase(), isActive: true,
          description: `Linked cash ledger for ${clean(req.body.name)}`,
          publishedAt: settings?.coaPublishedAt ? new Date() : null,
          publishedBy: settings?.coaPublishedAt ? req.user?._id || null : null,
          createdBy: req.user?._id || null, updatedBy: req.user?._id || null,
        });
        await ledger.save({ session });
      }
      cashAccount = new CashAccount({
        name: req.body.name, type: "cash", account: ledger._id,
        currency: clean(req.body.currency || "BDT").toUpperCase(), location: clean(req.body.location),
        custodian: isId(req.body.custodian) ? req.body.custodian : null,
        minimumBalance: money(req.body.minimumBalance), maximumBalance: money(req.body.maximumBalance),
        openingBalance: 0, isActive: req.body.isActive !== false,
        createdBy: req.user?._id || null, updatedBy: req.user?._id || null,
      });
      await cashAccount.save({ session });
    });
    return res.status(201).json({ message: "Cash account created and connected to the Chart of Accounts. Set its starting amount through Opening Balance.", cashAccount });
  } catch (error) {
    return res.status(error.statusCode || (error?.code === 11000 ? 409 : 500)).json({ message: error.statusCode ? error.message : "Failed to create cash account.", error: error.message });
  } finally {
    await session.endSession();
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

export const createVendorBill = async (req, res) => {
  try {
    const expenseAccount = req.body.expenseAccount || await resolveSystemAccount("5000");
    const payableAccount = req.body.payableAccount || await resolveSystemAccount("2000");
    const billDate = parsePostingDate(req.body.billDate) || new Date();
    const bill = await VendorBill.create({
      billNo: await nextAccountingNumber("bill", billDate),
      vendorName: req.body.vendorName,
      expense: isId(req.body.expense) ? req.body.expense : null,
      expenseAccount,
      payableAccount,
      currency: clean(req.body.currency || "BDT"),
      billDate,
      dueDate: parsePostingDate(req.body.dueDate, null),
      subtotal: money(req.body.subtotal || req.body.total),
      taxAmount: money(req.body.taxAmount),
      total: money(req.body.total),
      memo: clean(req.body.memo),
      createdBy: req.user?._id || null,
    });
    if (req.body.post === true || req.body.status === "approved") {
      const journal = await postJournalEntry({
        date: bill.billDate,
        sourceType: "vendor_bill",
        sourceId: bill._id,
        reference: bill.billNo,
        memo: bill.memo || `Vendor bill from ${bill.vendorName}`,
        currency: bill.currency,
        userId: req.user?._id || null,
        lines: [
          { account: bill.expenseAccount, debit: bill.total, credit: 0, description: bill.memo },
          { account: bill.payableAccount, debit: 0, credit: bill.total, description: bill.vendorName, contactType: "vendor" },
        ],
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
    const journal = await postJournalEntry({
      date: bill.billDate,
      sourceType: "vendor_bill",
      sourceId: bill._id,
      reference: bill.billNo,
      memo: bill.memo || `Vendor bill from ${bill.vendorName}`,
      currency: bill.currency,
      userId: req.user?._id || null,
      lines: [
        { account: bill.expenseAccount, debit: bill.total, credit: 0, description: bill.memo },
        { account: bill.payableAccount, debit: 0, credit: bill.total, description: bill.vendorName, contactType: "vendor" },
      ],
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

export const payVendorBill = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid vendor bill ID." });
    const bill = await VendorBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Vendor bill not found." });
    if (!["approved", "partially_paid"].includes(bill.status)) return res.status(409).json({ message: "Bill must be approved before payment." });
    const cashAccount = await CashAccount.findById(req.body.cashAccount).lean();
    if (!cashAccount) return res.status(400).json({ message: "Valid cash/bank account is required." });
    const amount = money(req.body.amount || bill.dueTotal);
    if (amount <= 0 || amount > Number(bill.dueTotal || 0)) return res.status(400).json({ message: "Payment amount must be greater than 0 and not exceed bill due." });
    const journal = await postJournalEntry({
      date: req.body.paidAt || new Date(),
      sourceType: "vendor_payment",
      sourceId: bill._id,
      reference: clean(req.body.reference || bill.billNo),
      memo: clean(req.body.note || `Payment to ${bill.vendorName}`),
      currency: bill.currency,
      userId: req.user?._id || null,
      lines: [
        { account: bill.payableAccount, debit: amount, credit: 0, description: bill.vendorName, contactType: "vendor" },
        { account: cashAccount.account, debit: 0, credit: amount, description: cashAccount.name },
      ],
    });
    bill.payments.push({ amount, paidAt: parsePostingDate(req.body.paidAt) || new Date(), cashAccount: cashAccount._id, journalEntry: journal._id, reference: req.body.reference, note: req.body.note, paidBy: req.user?._id || null });
    await bill.save();
    return res.json({ message: "Vendor payment recorded.", vendorBill: bill, journalEntry: journal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to record vendor payment.", error: error.message });
  }
};

export const recordCustomerPayment = async (req, res) => {
  try {
    const invoiceId = req.body.invoiceId || req.params.invoiceId;
    if (!isId(invoiceId)) return res.status(400).json({ message: "Valid invoice is required." });
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice || invoice.status === "void") return res.status(404).json({ message: "Invoice not found." });
    const cashAccount = await CashAccount.findById(req.body.cashAccount).lean();
    if (!cashAccount) return res.status(400).json({ message: "Valid cash/bank account is required." });
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
      userId: req.user?._id || null,
      lines: [
        { account: cashAccount.account, debit: amount, credit: 0, description: cashAccount.name },
        { account: arAccount, debit: 0, credit: amount, description: invoice.invoiceNo, contactType: "customer", contactId: invoice.customerId },
      ],
    });
    invoice.payments.push({ amount, method: cashAccount.type === "mobile_banking" ? "other" : cashAccount.type, transactionId: clean(req.body.reference), paidAt: parsePostingDate(req.body.paidAt) || new Date(), note: clean(req.body.note), receivedBy: req.user?._id || null });
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
    return res.status(status).json({ message: status === 409 ? "An opening balance already exists for this fiscal year." : "Failed to save opening balance.", error: error.message });
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
    const rows = await JournalEntry.aggregate([
      { $match: { status: { $in: ACTIVE_LEDGER_STATUSES }, date: { $lte: to } } },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
      { $lookup: { from: "accounts", localField: "_id", foreignField: "_id", as: "account" } },
      { $unwind: "$account" },
      { $match: { "account.type": { $in: ["asset", "liability", "equity"] } } },
      { $project: { account: { _id: "$account._id", code: "$account.code", name: "$account.name", type: "$account.type" }, balance: accountBalanceExpression } },
      { $sort: { "account.type": 1, "account.code": 1 } },
    ]).allowDiskUse(true);
    const groups = { assets: [], liabilities: [], equity: [] };
    for (const row of rows) {
      const key = row.account.type === "asset" ? "assets" : row.account.type === "liability" ? "liabilities" : "equity";
      groups[key].push({ ...row, balance: money(row.balance) });
    }
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
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load balance sheet.", error: error.message });
  }
};

export const getCashFlowStatement = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const [cashAccounts, bankAccounts] = await Promise.all([
      CashAccount.find({ isActive: { $ne: false } }).select("account name type").lean(),
      BankAccount.find({ status: "active", ledgerAccount: { $ne: null } }).select("ledgerAccount").lean(),
    ]);
    const cashIds = [...new Map(
      [...cashAccounts.map((item) => item.account), ...bankAccounts.map((item) => item.ledgerAccount)]
        .filter(Boolean)
        .map((id) => [String(id), id])
    ).values()];
    const rows = await JournalEntry.aggregate([
      { $match: ledgerMatchForRange(range) },
      { $unwind: "$lines" },
      { $match: { "lines.account": { $in: cashIds } } },
      { $group: { _id: "$sourceType", inflow: { $sum: "$lines.debit" }, outflow: { $sum: "$lines.credit" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).allowDiskUse(true);
    const items = rows.map((row) => ({ sourceType: row._id, inflow: money(row.inflow), outflow: money(row.outflow), net: money(row.inflow - row.outflow), count: row.count }));
    const totals = items.reduce((acc, row) => ({ inflow: money(acc.inflow + row.inflow), outflow: money(acc.outflow + row.outflow), net: money(acc.net + row.net) }), { inflow: 0, outflow: 0, net: 0 });
    return res.json({ items, totals, basis: "Cash flow is calculated from posted journal lines hitting configured cash/bank accounts." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load cash flow.", error: error.message });
  }
};
