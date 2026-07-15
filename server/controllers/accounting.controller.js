import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Expense from "../models/expense.model.js";
import Invoice from "../models/invoice.model.js";
import Account from "../models/account.model.js";
import JournalEntry from "../models/journalEntry.model.js";
import AccountingPeriod from "../models/accountingPeriod.model.js";
import AccountingSettings from "../models/accountingSettings.model.js";
import FiscalYear from "../models/fiscalYear.model.js";
import VoucherSequence from "../models/voucherSequence.model.js";
import CashAccount from "../models/cashAccount.model.js";
import VendorBill from "../models/vendorBill.model.js";
import { accountingCache } from "../utils/cache.js";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const clean = (value) => String(value ?? "").trim();
const isId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const toId = (value) => new mongoose.Types.ObjectId(String(value));

const SYSTEM_ACCOUNTS = [
  { code: "1000", name: "Cash on Hand", type: "asset" },
  { code: "1010", name: "Bank Account", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1200", name: "Input VAT / Tax Receivable", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "Output VAT / Tax Payable", type: "liability" },
  { code: "2200", name: "Payroll Payable", type: "liability" },
  { code: "3000", name: "Owner Equity", type: "equity" },
  { code: "3100", name: "Opening Balance Equity", type: "equity" },
  { code: "4000", name: "Sales Revenue", type: "revenue" },
  { code: "5000", name: "Operating Expense", type: "expense" },
  { code: "5010", name: "Purchases", type: "expense" },
  { code: "5100", name: "Payroll Expense", type: "expense" },
  { code: "5110", name: "Salary Expense", type: "expense" },
  { code: "5120", name: "Rent Expense", type: "expense" },
  { code: "5200", name: "Tax Expense", type: "expense" },
];

const resolveSystemAccount = async (code) => {
  const settingField = {
    1000: "defaultCashAccount",
    1010: "defaultBankAccount",
    1100: "receivableAccount",
    2000: "payableAccount",
    2100: "vatAccount",
    4000: "salesAccount",
    5000: "purchaseAccount",
    5010: "purchaseAccount",
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
  const period = await isPeriodClosed(date);
  if (period) {
    const err = new Error(`Accounting period ${period.periodKey} is ${period.status}.`);
    err.statusCode = 409;
    throw err;
  }
};

const voucherNumber = async (date) => {
  const settings = await AccountingSettings.findOne({ key: "company" }).lean();
  const prefix = clean(settings?.voucherPrefix || "JV").toUpperCase();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const fiscalYear = await FiscalYear.findOne({ startDate: { $lte: date }, endDate: { $gte: date } }).lean();
  const fy = fiscalYear?.name || String(year);
  const reset = settings?.voucherReset || "fiscal_year";
  const bucket = reset === "monthly" ? `${year}-${month}` : reset === "calendar_year" ? String(year) : reset === "fiscal_year" ? fy : "all";
  const sequence = await VoucherSequence.findOneAndUpdate(
    { sequenceKey: `${prefix}:${bucket}` },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  const number = String(sequence.value).padStart(Number(settings?.voucherNumberLength || 6), "0");
  return clean(settings?.voucherFormat || "{PREFIX}-{FY}-{NUMBER}")
    .replaceAll("{PREFIX}", prefix)
    .replaceAll("{FY}", fy)
    .replaceAll("{YYYY}", String(year))
    .replaceAll("{MM}", month)
    .replaceAll("{NUMBER}", number);
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

const postJournalEntry = async ({
  date,
  lines,
  sourceType = "manual",
  sourceId = null,
  reference = "",
  memo = "",
  currency = "BDT",
  userId = null,
}) => {
  const postingDate = parsePostingDate(date);
  if (!postingDate) {
    const err = new Error("Valid posting date is required.");
    err.statusCode = 400;
    throw err;
  }
  await assertOpenPeriod(postingDate);
  const entryNo = await voucherNumber(postingDate);
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
        ] : [{ $limit: 0 }],
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
          statusSummary: cachedSummary ? [{ $limit: 0 }] : [{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
          vendorSummary: cachedSummary ? [{ $limit: 0 }] : [
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
    for (const item of SYSTEM_ACCOUNTS) {
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
  "vatAccount",
];

const populateSettings = (query) =>
  query.populate([
    ...SETTINGS_ACCOUNT_FIELDS.map((path) => ({ path, select: "code name type isActive" })),
    { path: "defaultFiscalYear", select: "name startDate endDate status" },
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
    const patch = {};
    for (const key of ["fiscalYearStartMonth", "currency", "voucherPrefix", "voucherNumberLength", "voucherReset", "voucherFormat"]) {
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
      const count = await Account.countDocuments({ _id: { $in: ids }, isActive: true });
      if (count !== new Set(ids.map(String)).size) return res.status(400).json({ message: "All selected default accounts must be active accounts." });
    }
    patch.updatedBy = req.user?._id || null;
    const settings = await populateSettings(AccountingSettings.findOneAndUpdate(
      { key: "company" },
      { $set: patch, $setOnInsert: { key: "company" } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ));
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
    const overlap = await FiscalYear.findOne({ startDate: { $lte: endDate }, endDate: { $gte: startDate } }).lean();
    if (overlap) return res.status(409).json({ message: `Dates overlap fiscal year ${overlap.name}.` });
    const fiscalYear = await FiscalYear.create({
      name: clean(req.body.name),
      startDate,
      endDate,
      periodFrequency: clean(req.body.periodFrequency || "monthly"),
      note: clean(req.body.note),
      createdBy: req.user?._id || null,
    });
    await generatePeriods(fiscalYear, req.user?._id || null);
    return res.status(201).json({ message: "Fiscal year and accounting periods created.", fiscalYear });
  } catch (error) {
    const status = error?.code === 11000 ? 409 : 500;
    return res.status(status).json({ message: status === 409 ? "Fiscal year name or dates already exist." : "Failed to create fiscal year.", error: error.message });
  }
};

export const listAccounts = async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 100);
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
    return res.json({ accounts, count: accounts.length });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load accounts.", error: error.message });
  }
};

export const createAccount = async (req, res) => {
  try {
    const account = await Account.create({
      code: req.body.code,
      name: req.body.name,
      type: req.body.type,
      parent: isId(req.body.parent) ? req.body.parent : null,
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
    for (const key of ["code", "name", "type", "currency", "description", "isActive"]) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    if (req.body.parent !== undefined) patch.parent = isId(req.body.parent) ? req.body.parent : null;
    patch.updatedBy = req.user?._id || null;
    const account = await Account.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!account) return res.status(404).json({ message: "Account not found." });
    return res.json({ message: "Account updated.", account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update account.", error: error.message });
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
    const status = clean(req.body.status || "posted");
    if (!["draft", "posted"].includes(status)) return res.status(400).json({ message: "Journal status must be draft or posted." });
    if (status === "posted") {
      const entry = await postJournalEntry({
        date: req.body.date,
        lines: req.body.lines,
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
      lines: normalizeLines(req.body.lines),
      createdBy: req.user?._id || null,
    });
    return res.status(201).json({ message: "Journal entry saved as draft.", journalEntry: entry });
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
    if (!entry.entryNo) entry.entryNo = await voucherNumber(entry.date);
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
    const period = await AccountingPeriod.findOneAndUpdate(
      { periodKey: req.params.periodKey },
      { status: "closed", closedAt: new Date(), closedBy: req.user?._id || null, note: clean(req.body.note) },
      { new: true, runValidators: true }
    );
    if (!period) return res.status(404).json({ message: "Accounting period not found." });
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
    return res.json({ message: "Accounting period unlocked.", period });
  } catch (error) {
    return res.status(500).json({ message: "Failed to unlock period.", error: error.message });
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
    const bill = await VendorBill.create({
      vendorName: req.body.vendorName,
      expense: isId(req.body.expense) ? req.body.expense : null,
      expenseAccount,
      payableAccount,
      currency: clean(req.body.currency || "BDT"),
      billDate: parsePostingDate(req.body.billDate) || new Date(),
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

export const postOpeningBalances = async (req, res) => {
  try {
    const date = parsePostingDate(req.body.date);
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    if (!date || lines.length < 2) return res.status(400).json({ message: "Opening balance date and at least two account lines are required." });
    const normalized = lines.map((line) => ({ account: line.account, debit: money(line.debit), credit: money(line.credit), description: clean(line.description || "Opening balance") }));
    if (normalized.some((line) => !isId(line.account) || (line.debit > 0 && line.credit > 0) || (line.debit <= 0 && line.credit <= 0))) {
      return res.status(400).json({ message: "Each line needs a valid account and either a debit or a credit amount." });
    }
    const debit = normalized.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = normalized.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    const difference = money(debit - credit);
    if (difference !== 0) return res.status(400).json({ message: "Opening balances are not balanced. Total debit must equal total credit.", totals: { debit: money(debit), credit: money(credit), difference } });
    const journal = await postJournalEntry({
      date,
      sourceType: "opening_balance",
      reference: clean(req.body.reference || "OPENING-BALANCE"),
      memo: clean(req.body.memo || "Opening balances"),
      currency: clean(req.body.currency || "BDT"),
      userId: req.user?._id || null,
      lines: normalized,
    });
    return res.status(201).json({ message: "Opening balances posted.", journalEntry: journal });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: "Failed to post opening balances.", error: error.message });
  }
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
    const cashAccounts = await CashAccount.find({ isActive: { $ne: false } }).select("account name type").lean();
    const cashIds = cashAccounts.map((item) => item.account);
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
