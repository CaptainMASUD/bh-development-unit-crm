import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Expense from "../models/expense.model.js";
import Invoice from "../models/invoice.model.js";
import { accountingCache } from "../utils/cache.js";

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

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
