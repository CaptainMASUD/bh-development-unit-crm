// src/controllers/dashboard.controller.js
import Customer from "../models/customer.model.js";
import User from "../models/user.model.js";
import { dashboardCache } from "../utils/cache.js";
import {
  customerAccessMatch,
  canSeeUserCounts,
  canSeeSuperAdminCounts,
} from "../utils/accessMatch.js";

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

export const getDashboard = async (req, res, next) => {
  try {
    const user = req.user; // from protect middleware
    const userId = String(user._id);

    // caps to avoid abuse + keep response small
    const days = Math.min(30, Math.max(1, toInt(req.query.days, 7)));
    const limit = Math.min(12, Math.max(1, toInt(req.query.limit, 6)));

    // ✅ include visibility scope in cache key (important)
    // If your accessMatch depends on more than role/userId (ex: assignedTo),
    // this key is still safe because we invalidate cache on writes.
    const cacheKey = `dashboard:v1:${userId}:${user.role}:${days}:${limit}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) return res.json(cached);

    // ✅ access filter for this user
    const match = customerAccessMatch(user);

    // Trend start date (last N days)
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    // ✅ ONE DB CALL: Aggregation with $facet
    const [agg] = await Customer.aggregate([
      { $match: match }, // ✅ EARLY MATCH (huge perf gain)
      {
        $facet: {
          customersTotal: [{ $count: "count" }],

          customerStatus: [
            { $group: { _id: "$status", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
          ],

          // ✅ dashboard "Recent Customers"
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

          // ✅ dashboard "Recent Tasks"
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

          // ✅ last N days trend (created customers)
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

    // Normalize customer stats (matches frontend)
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

    // Build stable trend array (fill missing days with 0)
    const baseTrend = buildTrend(days);
    const trendMap = new Map((agg?.trend || []).map((x) => [x.key, x.value]));
    const newCustomersTrend = baseTrend.map((d) => ({
      name: d.label,
      value: trendMap.get(d.key) || 0,
    }));

    // Role-gated user counts (extra DB ops)
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
