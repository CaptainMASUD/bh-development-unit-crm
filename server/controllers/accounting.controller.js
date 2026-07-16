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
import VendorBill from "../models/vendorBill.model.js";
import { accountingCache } from "../utils/cache.js";
import { getReqMeta, writeAudit } from "../utils/audit.js";
import { nextAccountingNumber } from "../services/accountingNumbering.service.js";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const toId = (value) => new mongoose.Types.ObjectId(String(value));

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
};

const normalizeLines = (lines = []) =>
  lines.map((line) => ({
    account: line.account,
    debit: money(line.debit),
    credit: money(line.credit),
    description: clean(line.description),
    contactType: clean(line.contactType),
    contactId: isId(line.contactId) ? line.contactId : null,
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
  userId = null,
  allowClosedPeriod = false,
}) => {
  const postingDate = parsePostingDate(date);
  if (!postingDate) {
    const err = new Error("Valid posting date is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!allowClosedPeriod) await assertOpenPeriod(postingDate);
  await assertPostableAccounts(lines);
  const entryNo = await nextAccountingNumber("journal", postingDate);
  const entry = await JournalEntry.create({
    entryNo,
    date: postingDate,
    status: "posted",
    sourceType,
    sourceId: isId(sourceId) ? sourceId : null,
    reference: clean(reference),
    memo: clean(memo),
    currency: clean(currency || "BDT"),
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
  const match = { status: "posted" };
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
        { $match: { status: "posted" } },
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

export const listJournalEntries = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const limit = parseLimit(req.query.limit);
    const cursor = listCursor(req.query.cursor);
    const filter = {};
    if (req.query.status && req.query.status !== "all") filter.status = clean(req.query.status);
    if (req.query.sourceType) filter.sourceType = clean(req.query.sourceType);
    if (range.from || range.to) filter.date = {};
    if (range.from) filter.date.$gte = range.from;
    if (range.to) filter.date.$lte = range.to;
    if (cursor) {
      filter.$or = [{ date: { $lt: cursor.date } }, { date: cursor.date, _id: { $lt: cursor.id } }];
    }
    const rows = await JournalEntry.find(filter)
      .populate("lines.account", "code name type normalBalance")
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

export const createJournalEntry = async (req, res) => {
  try {
    let status = clean(req.body.status || "posted");
    if (!["draft", "posted"].includes(status)) return res.status(400).json({ message: "Journal status must be draft or posted." });
    const normalizedLines = normalizeLines(req.body.lines);
    await assertPostableAccounts(normalizedLines);
    const settings = await AccountingSettings.findOne({ key: "company" }).select("approvalEnabled journalApprovalThreshold").lean();
    const totalDebit = money(normalizedLines.reduce((sum, line) => sum + line.debit, 0));
    const approvalRequired = clean(req.body.sourceType || "manual") === "manual" && settings?.approvalEnabled && totalDebit > Number(settings.journalApprovalThreshold || 0);
    if (approvalRequired) status = "draft";
    if (status === "posted") {
      const entry = await postJournalEntry({
        date: req.body.date,
        lines: normalizedLines,
        sourceType: clean(req.body.sourceType || "manual"),
        sourceId: req.body.sourceId,
        reference: req.body.reference,
        memo: req.body.memo,
        currency: req.body.currency,
        userId: req.user?._id || null,
      });
      return res.status(201).json({ message: "Journal entry posted.", journalEntry: entry });
    }
    const entry = await JournalEntry.create({
      date: parsePostingDate(req.body.date),
      status: "draft",
      sourceType: clean(req.body.sourceType || "manual"),
      sourceId: isId(req.body.sourceId) ? req.body.sourceId : null,
      reference: clean(req.body.reference),
      memo: clean(req.body.memo),
      currency: clean(req.body.currency || "BDT"),
      lines: normalizedLines,
      createdBy: req.user?._id || null,
    });
    return res.status(201).json({ message: approvalRequired ? "Journal exceeds the approval threshold and was saved as draft." : "Journal entry saved as draft.", approvalRequired, journalEntry: entry });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to save journal entry.", error: error.message });
  }
};

export const postDraftJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Journal entry not found." });
    if (entry.status !== "draft") return res.status(409).json({ message: "Only draft journal entries can be posted." });
    await assertOpenPeriod(entry.date);
    await assertPostableAccounts(entry.lines);
    if (!entry.entryNo) entry.entryNo = await nextAccountingNumber("journal", entry.date);
    entry.status = "posted";
    entry.postedAt = new Date();
    entry.postedBy = req.user?._id || null;
    await entry.save();
    accountingCache.flushAll();
    return res.json({ message: "Journal entry posted.", journalEntry: entry });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to post journal entry.", error: error.message });
  }
};

export const voidJournalEntry = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid journal entry ID." });
    const entry = await JournalEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: "Journal entry not found." });
    if (entry.status !== "posted") return res.status(409).json({ message: "Only posted journal entries can be voided." });
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
    { $match: { status: "posted", date: { $lte: throughDate } } },
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
      { $match: { status: "posted", date: { $gte: fiscalYear.startDate, $lte: fiscalYear.endDate } } },
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
    const accounts = await CashAccount.find(req.query.active === "all" ? {} : { isActive: { $ne: false } })
      .populate("account", "code name type")
      .sort({ type: 1, nameLower: 1, _id: 1 })
      .limit(parseLimit(req.query.limit, 100))
      .lean();
    return res.json({ cashAccounts: accounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load cash/bank accounts.", error: error.message });
  }
};

export const createCashAccount = async (req, res) => {
  try {
    const cashAccount = await CashAccount.create({
      name: req.body.name,
      type: clean(req.body.type || "bank"),
      account: req.body.account || await resolveSystemAccount(clean(req.body.type) === "cash" ? "1000" : "1010"),
      currency: clean(req.body.currency || "BDT"),
      institution: clean(req.body.institution),
      accountNo: clean(req.body.accountNo),
      openingBalance: money(req.body.openingBalance),
      createdBy: req.user?._id || null,
    });
    return res.status(201).json({ message: "Cash/bank account created.", cashAccount });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create cash/bank account.", error: error.message });
  }
};

export const reconcileCashAccount = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid cash account ID." });
    const cashAccount = await CashAccount.findByIdAndUpdate(
      req.params.id,
      { lastReconciledAt: parsePostingDate(req.body.reconciledAt) || new Date(), lastReconciledBalance: money(req.body.balance), updatedBy: req.user?._id || null },
      { new: true, runValidators: true }
    );
    if (!cashAccount) return res.status(404).json({ message: "Cash/bank account not found." });
    return res.json({ message: "Cash/bank account reconciled.", cashAccount });
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
    const debit = money(lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = money(lines.reduce((sum, line) => sum + line.credit, 0));
    if (debit <= 0 || debit !== credit) return res.status(400).json({ message: "Total debit and total credit must be equal and greater than zero." });
    const journalLines = lines.flatMap((line) => line.partySplits.length ? line.partySplits.map((party) => ({ account: line.account, debit: party.debit, credit: party.credit, description: party.partyName || line.description, contactType: party.partyType === "supplier" ? "vendor" : party.partyType, contactId: party.partyId })) : [{ account: line.account, debit: line.debit, credit: line.credit, description: line.description }]);
    const journal = await postJournalEntry({ date: openingBalance.date, sourceType: "opening_balance", sourceId: openingBalance._id, reference: openingBalance.reference || `OPEN-${openingBalance.fiscalYear.name}`, memo: openingBalance.memo, currency: openingBalance.currency, userId: req.user?._id || null, lines: journalLines });
    openingBalance.status = "posted"; openingBalance.journalEntry = journal._id; openingBalance.postedBy = req.user?._id || null; openingBalance.postedAt = new Date(); await openingBalance.save();
    await writeAudit({ actorId: req.user?._id, action: "confirm", entityType: "OpeningBalance", entityId: openingBalance._id, after: openingBalance.toObject(), meta: getReqMeta(req) });
    return res.json({ message: "Opening balance posted to the General Ledger.", openingBalance, journalEntry: journal });
  } catch (error) { return res.status(error.statusCode || 500).json({ message: "Failed to post opening balance.", error: error.message }); }
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
    const limit = parseLimit(req.query.limit);
    if (!isId(req.query.account)) return res.status(400).json({ message: "Account is required." });
    const accountId = toId(req.query.account);
    const cursor = listCursor(req.query.cursor);
    const filter = { status: "posted", "lines.account": accountId };
    if (range.from || range.to) filter.date = {};
    if (range.from) filter.date.$gte = range.from;
    if (range.to) filter.date.$lte = range.to;
    if (cursor) filter.$or = [{ date: { $lt: cursor.date } }, { date: cursor.date, _id: { $lt: cursor.id } }];
    const rows = await JournalEntry.find(filter)
      .select("entryNo date sourceType reference memo currency lines")
      .populate("lines.account", "code name type normalBalance")
      .sort({ date: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const sliced = rows.map((entry) => ({ ...entry, lines: (entry.lines || []).filter((line) => String(line.account?._id || line.account) === String(accountId)) }));
    const hasNextPage = sliced.length > limit;
    const entries = hasNextPage ? sliced.slice(0, limit) : sliced;
    const nextCursor = hasNextPage && entries.length ? makeListCursor(entries[entries.length - 1]) : "";
    return res.json({ entries, pageInfo: { limit, hasNextPage, nextCursor } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load general ledger.", error: error.message });
  }
};

export const getTrialBalance = async (req, res) => {
  try {
    const range = parseDateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const rows = await JournalEntry.aggregate([
      { $match: ledgerMatchForRange(range) },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.account", debit: { $sum: "$lines.debit" }, credit: { $sum: "$lines.credit" } } },
      { $lookup: { from: "accounts", localField: "_id", foreignField: "_id", as: "account" } },
      { $unwind: "$account" },
      { $sort: { "account.type": 1, "account.code": 1 } },
      { $project: { _id: 0, account: { _id: "$account._id", code: "$account.code", name: "$account.name", type: "$account.type" }, debit: 1, credit: 1, balance: { $subtract: ["$debit", "$credit"] } } },
    ]).allowDiskUse(true);
    const totals = rows.reduce((acc, row) => ({ debit: money(acc.debit + row.debit), credit: money(acc.credit + row.credit) }), { debit: 0, credit: 0 });
    return res.json({ rows: rows.map((row) => ({ ...row, debit: money(row.debit), credit: money(row.credit), balance: money(row.balance) })), totals, isBalanced: totals.debit === totals.credit });
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
      { $match: { status: "posted", date: { $lte: to } } },
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
