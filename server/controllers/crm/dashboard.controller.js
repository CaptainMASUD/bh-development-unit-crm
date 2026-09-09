// src/controllers/dashboard.controller.js
import Customer from "../../models/customer.model.js";
import User from "../../models/user.model.js";
import Company from "../../models/company.model.js";
import Branch from "../../models/branch.model.js";
import { evaluateCompanyAccess } from "../../services/tenant.service.js";
import { dashboardCache } from "../../utils/cache.js";
import {
  customerAccessMatch,
  canSeeUserCounts,
  canSeeSuperAdminCounts,
} from "../../utils/accessMatch.js";

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function yyyyMmDd(d) {
  return d.toISOString().slice(0, 10);
}

function buildTrend(days) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const arr = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(now);
    dt.setDate(now.getDate() - i);
    arr.push({
      key: yyyyMmDd(dt),
      label: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: 0,
    });
  }
  return arr;
}

// --------- Cursor helpers (simple + safe) ---------

/**
 * For customers sorted by createdAt desc, _id desc
 * Cursor is last item's { createdAt, _id } encoded as "ISO|id"
 */
function encodeCustomerCursor(doc) {
  if (!doc?._id || !doc?.createdAt) return null;
  return `${new Date(doc.createdAt).toISOString()}|${String(doc._id)}`;
}

function decodeCustomerCursor(cursor) {
  if (!cursor) return null;
  const [iso, id] = String(cursor).split("|");
  const dt = new Date(iso);
  if (!id || Number.isNaN(dt.getTime())) return null;
  return { dt, id: String(id) };
}

/**
 * For tasks sorted by crmTasks.updatedAt desc, crmTasks._id desc
 * Cursor is last item's { updatedAt, taskId } encoded as "ISO|taskId"
 */
function encodeTaskCursor(taskRow) {
  if (!taskRow?._id || !taskRow?.updatedAt) return null;
  return `${new Date(taskRow.updatedAt).toISOString()}|${String(taskRow._id)}`;
}

function decodeTaskCursor(cursor) {
  if (!cursor) return null;
  const [iso, id] = String(cursor).split("|");
  const dt = new Date(iso);
  if (!id || Number.isNaN(dt.getTime())) return null;
  return { dt, id: String(id) };
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =======================
// 1) OVERVIEW DASHBOARD
// =======================
export const getDashboard = async (req, res, next) => {
  try {
    const user = req.user; // from protect middleware
    const userId = String(user._id);

    // caps to avoid abuse + keep response small
    const days = Math.min(30, Math.max(1, toInt(req.query.days, 7)));
    const limit = Math.min(12, Math.max(1, toInt(req.query.limit, 6)));

    const cacheKey = `dashboard:v1:${userId}:${user.role}:${days}:${limit}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) return res.json(cached);

    if (user.role === "superadmin") {
      const [companies, superAdminsCount] = await Promise.all([
        Company.find({}).select("name code status subscription enabledModules createdAt").sort({ createdAt: -1 }).lean(),
        User.countDocuments({ role: "superadmin", isActive: true }),
      ]);
      const accessRows = companies.map((company) => ({ ...company, subscriptionAccess: evaluateCompanyAccess(company) }));
      const platform = {
        companiesCount: companies.length,
        activeSubscriptions: accessRows.filter((company) => company.subscriptionAccess.allowed).length,
        expiringSoon: accessRows.filter((company) => company.subscriptionAccess.allowed && company.subscriptionAccess.daysRemaining != null && company.subscriptionAccess.daysRemaining <= 30).length,
        blockedSubscriptions: accessRows.filter((company) => !company.subscriptionAccess.allowed).length,
        trialCompanies: companies.filter((company) => company.status === "trial").length,
        recentCompanies: accessRows.slice(0, limit),
      };
      const payload = {
        me: { _id: userId, role: user.role, name: user.name, email: user.email },
        superAdminsCount,
        employeesCount: 0,
        adminsCount: 0,
        platform,
      };
      dashboardCache.set(cacheKey, payload);
      return res.json(payload);
    }

    const match = customerAccessMatch(user);

    // Trend start date (last N days)
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const [agg] = await Customer.aggregate([
      { $match: match },
      {
        $facet: {
          customersTotal: [{ $count: "count" }],

          customerStatus: [
            { $group: { _id: "$status", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
          ],

          recentCustomers: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                companyName: 1,
                email: 1,
                phone: 1,
                status: 1,
                createdAt: 1,
              },
            },
          ],

          taskStatus: [
            { $unwind: { path: "$crmTasks", preserveNullAndEmptyArrays: false } },
            { $group: { _id: "$crmTasks.status", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
          ],

          recentTasks: [
            { $unwind: { path: "$crmTasks", preserveNullAndEmptyArrays: false } },
            {
              $sort: {
                "crmTasks.updatedAt": -1,
                "crmTasks.createdAt": -1,
                _id: -1,
              },
            },
            { $limit: limit },
            {
              $project: {
                _id: "$crmTasks._id",
                title: "$crmTasks.title",
                status: "$crmTasks.status",
                updatedAt: "$crmTasks.updatedAt",
                createdAt: "$crmTasks.createdAt",
                _customerName: "$name",
                _companyName: "$companyName",
                _customerStatus: "$status",
              },
            },
          ],

          trend: [
            { $match: { createdAt: { $gte: start } } },
            {
              $group: {
                _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } },
                value: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
          ],
        },
      },
    ]).allowDiskUse(true);

    const customersCount = agg?.customersTotal?.[0]?.count ?? 0;

    const cMap = new Map((agg?.customerStatus || []).map((x) => [x.key, x.value]));
    const customerStats = {
      total: customersCount,
      pending: cMap.get("pending") || 0,
      inProgress: cMap.get("in_progress") || 0,
      complete: cMap.get("complete") || 0,
      other: Math.max(
        0,
        customersCount -
          (cMap.get("pending") || 0) -
          (cMap.get("in_progress") || 0) -
          (cMap.get("complete") || 0)
      ),
    };

    const tMap = new Map((agg?.taskStatus || []).map((x) => [x.key, x.value]));
    const taskStats = {
      pending: tMap.get("pending") || 0,
      inProgress: tMap.get("in_progress") || 0,
      done: tMap.get("done") || 0,
    };
    const tasksCount = taskStats.pending + taskStats.inProgress + taskStats.done;

    const baseTrend = buildTrend(days);
    const trendMap = new Map((agg?.trend || []).map((x) => [x.key, x.value]));
    const newCustomersTrend = baseTrend.map((d) => ({
      name: d.label,
      value: trendMap.get(d.key) || 0,
    }));

    let employeesCount = 0;
    let adminsCount = 0;
    let superAdminsCount = 0;

    if (canSeeUserCounts(user)) {
      const [emp, adm] = await Promise.all([
        User.countDocuments({ role: "employee", isActive: true }),
        User.countDocuments({ role: "admin", isActive: true }),
      ]);
      employeesCount = emp;
      adminsCount = adm;
    }

    if (canSeeSuperAdminCounts(user)) {
      superAdminsCount = await User.countDocuments({
        role: "superadmin",
        isActive: true,
      });
    }

    const payload = {
      me: { _id: userId, role: user.role, name: user.name, email: user.email },

      customersCount,
      customerStats,

      customerStatusChart: [
        { name: "In Progress", value: customerStats.inProgress },
        { name: "Completed", value: customerStats.complete },
        { name: "Other", value: customerStats.other },
      ].filter((x) => x.value > 0),

      tasksCount,
      taskStats,
      taskStatusChart: [
        { name: "Pending", value: taskStats.pending },
        { name: "In Progress", value: taskStats.inProgress },
        { name: "Done", value: taskStats.done },
      ],

      recentCustomers: agg?.recentCustomers || [],
      recentTasks: agg?.recentTasks || [],

      newCustomersTrend,

      employeesCount,
      adminsCount,
      superAdminsCount,
    };

    dashboardCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
};

// Organization/platform overview that never depends on the CRM entitlement.
export const getAdministrationDashboard = async (req, res, next) => {
  if (req.user?.role === "superadmin") return getDashboard(req, res, next);

  try {
    const [company, branchesCount, employeesCount, adminsCount] = await Promise.all([
      Company.findById(req.tenantId).select("name code status subscription enabledModules").lean(),
      Branch.countDocuments({ isActive: { $ne: false } }),
      User.countDocuments({ role: "employee", isActive: true }),
      User.countDocuments({ role: "admin", isActive: true }),
    ]);

    return res.json({
      me: { _id: req.user._id, role: req.user.role, name: req.user.name, email: req.user.email },
      company,
      branchesCount,
      employeesCount,
      adminsCount,
      enabledModulesCount: Array.isArray(req.enabledModules) ? req.enabledModules.length : 0,
    });
  } catch (error) {
    return next(error);
  }
};

// ==================================
// 2) REPORT: CUSTOMERS (DRILL-DOWN)
// GET /api/dashboard/reports/customers
// ==================================
export const getDashboardCustomersReport = async (req, res, next) => {
  try {
    const user = req.user;
    const match = customerAccessMatch(user);

    const limit = Math.min(50, Math.max(1, toInt(req.query.limit, 20)));
    const cursor = decodeCustomerCursor(req.query.cursor);

    // status values expected: pending | in_progress | complete | other | all
    const status = String(req.query.status || "all").trim();

    const q = String(req.query.q || "").trim();
    const sort = String(req.query.sort || "createdAt_desc").trim();

    // Build filter
    const pipelineMatch = { ...match };

    if (status && status !== "all") {
      if (status === "other") {
        pipelineMatch.status = { $nin: ["pending", "in_progress", "complete"] };
      } else {
        pipelineMatch.status = status;
      }
    }

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      pipelineMatch.$or = [
        { name: rx },
        { companyName: rx },
        { email: rx },
        { phone: rx },
      ];
    }

    // Sorting (default: createdAt desc, _id desc)
    const sortStage =
      sort === "createdAt_asc"
        ? { createdAt: 1, _id: 1 }
        : { createdAt: -1, _id: -1 };

    // Cursor condition compatible with sort
    const cursorMatch = cursor
      ? sort === "createdAt_asc"
        ? {
            $or: [
              { createdAt: { $gt: cursor.dt } },
              { createdAt: cursor.dt, _id: { $gt: cursor.id } },
            ],
          }
        : {
            $or: [
              { createdAt: { $lt: cursor.dt } },
              { createdAt: cursor.dt, _id: { $lt: cursor.id } },
            ],
          }
      : null;

    const pipeline = [
      { $match: pipelineMatch },
      ...(cursorMatch ? [{ $match: cursorMatch }] : []),
      { $sort: sortStage },
      {
        $facet: {
          items: [
            { $limit: limit + 1 }, // fetch one extra to know if has more
            {
              $project: {
                _id: 1,
                name: 1,
                companyName: 1,
                email: 1,
                phone: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Customer.aggregate(pipeline).allowDiskUse(true);
    const itemsRaw = result?.items || [];
    const total = result?.total?.[0]?.count ?? 0;

    const hasMore = itemsRaw.length > limit;
    const items = hasMore ? itemsRaw.slice(0, limit) : itemsRaw;

    const nextCursor = hasMore ? encodeCustomerCursor(items[items.length - 1]) : null;

    return res.json({
      items,
      nextCursor,
      hasMore,
      total,
    });
  } catch (err) {
    return next(err);
  }
};

// ================================
// 3) REPORT: TASKS (DRILL-DOWN)
// GET /api/dashboard/reports/tasks
// ================================
export const getDashboardTasksReport = async (req, res, next) => {
  try {
    const user = req.user;
    const match = customerAccessMatch(user);

    const limit = Math.min(50, Math.max(1, toInt(req.query.limit, 20)));
    const cursor = decodeTaskCursor(req.query.cursor);

    // status: pending | in_progress | done | all
    const status = String(req.query.status || "all").trim();
    const q = String(req.query.q || "").trim();

    // Optional date filters (ISO or YYYY-MM-DD)
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    const taskMatch = {};
    if (status && status !== "all") taskMatch["crmTasks.status"] = status;

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      taskMatch["crmTasks.title"] = rx;
    }

    if (from && !Number.isNaN(from.getTime())) {
      taskMatch["crmTasks.updatedAt"] = taskMatch["crmTasks.updatedAt"] || {};
      taskMatch["crmTasks.updatedAt"].$gte = from;
    }
    if (to && !Number.isNaN(to.getTime())) {
      taskMatch["crmTasks.updatedAt"] = taskMatch["crmTasks.updatedAt"] || {};
      taskMatch["crmTasks.updatedAt"].$lte = to;
    }

    // Cursor paging on (updatedAt desc, taskId desc)
    const cursorMatch = cursor
      ? {
          $or: [
            { "crmTasks.updatedAt": { $lt: cursor.dt } },
            {
              "crmTasks.updatedAt": cursor.dt,
              "crmTasks._id": { $lt: cursor.id },
            },
          ],
        }
      : null;

    const pipeline = [
      { $match: match },
      { $unwind: { path: "$crmTasks", preserveNullAndEmptyArrays: false } },
      ...(Object.keys(taskMatch).length ? [{ $match: taskMatch }] : []),
      ...(cursorMatch ? [{ $match: cursorMatch }] : []),
      {
        $sort: {
          "crmTasks.updatedAt": -1,
          "crmTasks._id": -1,
        },
      },
      {
        $facet: {
          items: [
            { $limit: limit + 1 },
            {
              $project: {
                _id: "$crmTasks._id",
                title: "$crmTasks.title",
                status: "$crmTasks.status",
                updatedAt: "$crmTasks.updatedAt",
                createdAt: "$crmTasks.createdAt",
                customerId: "$_id",
                customerName: "$name",
                companyName: "$companyName",
                customerStatus: "$status",
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Customer.aggregate(pipeline).allowDiskUse(true);

    const itemsRaw = result?.items || [];
    const total = result?.total?.[0]?.count ?? 0;

    const hasMore = itemsRaw.length > limit;
    const items = hasMore ? itemsRaw.slice(0, limit) : itemsRaw;

    const nextCursor = hasMore ? encodeTaskCursor(items[items.length - 1]) : null;

    return res.json({
      items,
      nextCursor,
      hasMore,
      total,
    });
  } catch (err) {
    return next(err);
  }
};

// ========================================
// 4) REPORT: NEW CUSTOMERS (DRILL-DOWN)
// GET /api/dashboard/reports/new-customers
// ========================================
export const getDashboardNewCustomersReport = async (req, res, next) => {
  try {
    const user = req.user;
    const match = customerAccessMatch(user);

    const limit = Math.min(50, Math.max(1, toInt(req.query.limit, 20)));
    const cursor = decodeCustomerCursor(req.query.cursor);

    // Accept either:
    // - date=YYYY-MM-DD (single day)
    // or
    // - from=ISO/YYYY-MM-DD & to=ISO/YYYY-MM-DD (range)
    const dateStr = String(req.query.date || "").trim();
    const fromStr = String(req.query.from || "").trim();
    const toStr = String(req.query.to || "").trim();

    let from = null;
    let to = null;

    if (dateStr) {
      // Single day range
      from = new Date(dateStr);
      if (Number.isNaN(from.getTime())) from = null;
      if (from) {
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setDate(to.getDate() + 1); // next day
      }
    } else {
      if (fromStr) {
        from = new Date(fromStr);
        if (Number.isNaN(from.getTime())) from = null;
      }
      if (toStr) {
        to = new Date(toStr);
        if (Number.isNaN(to.getTime())) to = null;
      }
    }

    const pipelineMatch = { ...match };
    if (from || to) {
      pipelineMatch.createdAt = {};
      if (from) pipelineMatch.createdAt.$gte = from;
      if (to) pipelineMatch.createdAt.$lt = to;
    }

    // Cursor for createdAt desc, _id desc
    const cursorMatch = cursor
      ? {
          $or: [
            { createdAt: { $lt: cursor.dt } },
            { createdAt: cursor.dt, _id: { $lt: cursor.id } },
          ],
        }
      : null;

    const pipeline = [
      { $match: pipelineMatch },
      ...(cursorMatch ? [{ $match: cursorMatch }] : []),
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $limit: limit + 1 },
            {
              $project: {
                _id: 1,
                name: 1,
                companyName: 1,
                email: 1,
                phone: 1,
                status: 1,
                createdAt: 1,
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Customer.aggregate(pipeline).allowDiskUse(true);
    const itemsRaw = result?.items || [];
    const total = result?.total?.[0]?.count ?? 0;

    const hasMore = itemsRaw.length > limit;
    const items = hasMore ? itemsRaw.slice(0, limit) : itemsRaw;

    const nextCursor = hasMore ? encodeCustomerCursor(items[items.length - 1]) : null;

    return res.json({
      items,
      nextCursor,
      hasMore,
      total,
      range: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
    });
  } catch (err) {
    return next(err);
  }
};
