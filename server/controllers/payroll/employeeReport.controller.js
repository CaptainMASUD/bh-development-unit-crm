// controllers/employeeReport.controller.js
import mongoose from "mongoose";
import ServiceLog from "../../models/serviceLog.model.js";
import Customer from "../../models/customer.model.js";

const { Types } = mongoose;

/* ---------------- helpers ---------------- */

const toObjectIdSafe = (id) => {
  try {
    if (!id) return null;
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(String(id));
    return null;
  } catch {
    return null;
  }
};

const isAdminOrSuperAdmin = (req) => {
  const role = req?.user?.role ?? req?.role;
  return role === "admin" || role === "superadmin";
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

// Monday as week start
const startOfWeekMonday = (date) => {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun,1=Mon...
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d;
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const parseRange = (req) => {
  const now = new Date();

  const range = String(req.query.range ?? "this_month");
  const fromQ = req.query.from ? new Date(req.query.from) : null;
  const toQ = req.query.to ? new Date(req.query.to) : null;

  // custom range takes priority if valid
  if (fromQ && !isNaN(fromQ.getTime()) && toQ && !isNaN(toQ.getTime())) {
    return { range: "custom", from: startOfDay(fromQ), to: endOfDay(toQ) };
  }

  if (range === "this_week") {
    return { range, from: startOfWeekMonday(now), to: endOfDay(now) };
  }

  if (range === "this_month") {
    const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    return { range, from, to: endOfDay(now) };
  }

  if (range === "last_6_months") {
    const to = endOfDay(now);
    const from = startOfDay(addMonths(now, -6));
    return { range, from, to };
  }

  if (range === "last_1_year") {
    const to = endOfDay(now);
    const from = startOfDay(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
    return { range, from, to };
  }

  // default
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  return { range: "this_month", from, to: endOfDay(now) };
};

const buildEmployeeMatch = ({ employeeId, from, to }) => {
  return {
    status: "done",
    assignedTo: employeeId,
    completedAt: { $gte: from, $lte: to },
  };
};

const clampInt = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  const t = Math.trunc(v);
  return Math.max(min, Math.min(max, t));
};

const scoreEmployee = ({ tasksDoneInRange, avgMinutes, openTasksCount }) => {
  // Simple scoring model you can adjust anytime
  // - more done => better
  // - faster avg => slightly better
  // - too many open tasks => penalty
  const done = Number(tasksDoneInRange || 0);
  const avg = Number(avgMinutes || 0);
  const open = Number(openTasksCount || 0);

  let score = 0;
  score += done * 2;
  score += avg > 0 ? Math.max(0, 60 - avg) * 0.15 : 0; // reward if under ~60min avg
  score -= open * 0.8;

  // Normalize to 0-100-ish (soft clamp)
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "average";
  if (score >= 80) label = "outstanding";
  else if (score >= 60) label = "good";
  else if (score >= 40) label = "average";
  else label = "needs_improvement";

  return { score, label };
};

/* =========================================================
   ✅ EMPLOYEE PERFORMANCE REPORT (UPDATED)
   GET /api/employeeReport/employees/:employeeId/performance?range=... OR from/to
   + optional: includeTasks=true (returns tasks with subtitles)
   + optional: tasksLimit=50
========================================================= */
export const getEmployeePerformance = async (req, res) => {
  try {
    const employeeId = toObjectIdSafe(req.params.employeeId);
    if (!employeeId) return res.status(400).json({ message: "Invalid employeeId." });

    // permissions
    if (!isAdminOrSuperAdmin(req)) {
      // employee can only view self
      if (String(req.user?._id) !== String(employeeId)) {
        return res.status(403).json({ message: "You can only view your own report." });
      }
    }

    const { range, from, to } = parseRange(req);
    const match = buildEmployeeMatch({ employeeId, from, to });

    /* ---------------- DONE TASKS (ServiceLog) ---------------- */

    // totals for done tasks within range
    const totalsAgg = await ServiceLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          tasksDone: { $sum: 1 },
          totalMinutes: { $sum: "$durationMinutes" },
          avgMinutes: { $avg: "$durationMinutes" },
          lastCompletedAt: { $max: "$completedAt" },
        },
      },
      {
        $project: {
          _id: 0,
          tasksDone: 1,
          totalMinutes: 1,
          avgMinutes: { $round: ["$avgMinutes", 0] },
          lastCompletedAt: 1,
        },
      },
    ]);

    const totals = totalsAgg?.[0] || {
      tasksDone: 0,
      totalMinutes: 0,
      avgMinutes: 0,
      lastCompletedAt: null,
    };

    // by service
    const byService = await ServiceLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { serviceId: "$serviceId", title: "$serviceTitleSnapshot" },
          count: { $sum: 1 },
          minutes: { $sum: "$durationMinutes" },
          avgMinutes: { $avg: "$durationMinutes" },
          lastCompletedAt: { $max: "$completedAt" },
        },
      },
      { $sort: { count: -1, minutes: -1, lastCompletedAt: -1 } },
      {
        $project: {
          _id: 0,
          serviceId: "$_id.serviceId",
          title: "$_id.title",
          count: 1,
          minutes: 1,
          avgMinutes: { $round: ["$avgMinutes", 0] },
          lastCompletedAt: 1,
        },
      },
    ]);

    // by customer (done logs)
    const byCustomerRaw = await ServiceLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$customerId",
          count: { $sum: 1 },
          minutes: { $sum: "$durationMinutes" },
          lastCompletedAt: { $max: "$completedAt" },
        },
      },
      { $sort: { count: -1, minutes: -1, lastCompletedAt: -1 } },
      { $limit: 50 },
    ]);

    const customerIds = byCustomerRaw.map((x) => x._id).filter(Boolean);
    const customers = await Customer.find({ _id: { $in: customerIds } })
      .select("_id name companyName")
      .lean();

    const cMap = new Map(customers.map((c) => [String(c._id), c]));

    const byCustomer = byCustomerRaw.map((x) => {
      const c = cMap.get(String(x._id));
      return {
        customerId: x._id,
        customerName: c?.name || "",
        companyName: c?.companyName || "",
        count: x.count,
        minutes: x.minutes,
        lastCompletedAt: x.lastCompletedAt,
      };
    });

    // trend (monthly)
    const trend = await ServiceLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            y: { $year: "$completedAt" },
            m: { $month: "$completedAt" },
          },
          count: { $sum: 1 },
          minutes: { $sum: "$durationMinutes" },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
      {
        $project: {
          _id: 0,
          period: {
            $concat: [
              { $toString: "$_id.y" },
              "-",
              {
                $cond: [
                  { $lt: ["$_id.m", 10] },
                  { $concat: ["0", { $toString: "$_id.m" }] },
                  { $toString: "$_id.m" },
                ],
              },
            ],
          },
          count: 1,
          minutes: 1,
        },
      },
    ]);

    /* ---------------- LIVE TASKS (Customer.crmTasks) ---------------- */

    // counts for employee tasks (pending/in_progress/done) from crmTasks (all-time)
    const taskCountsAgg = await Customer.aggregate([
      { $project: { crmTasks: 1 } },
      { $unwind: "$crmTasks" },
      {
        $match: {
          "crmTasks.assignedTo": employeeId,
          "crmTasks.status": { $in: ["pending", "in_progress", "done"] },
        },
      },
      {
        $group: {
          _id: "$crmTasks.status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = { pending: 0, in_progress: 0, done: 0 };
    for (const r of taskCountsAgg) {
      const k = String(r?._id || "");
      if (k in statusCounts) statusCounts[k] = r.count || 0;
    }

    const totalAssignedTasks = statusCounts.pending + statusCounts.in_progress + statusCounts.done;

    // in-progress list count (and optionally list)
    const includeInProgressList = String(req.query.includeInProgressList ?? "false") === "true";

    const inProgressAgg = await Customer.aggregate([
      { $project: { crmTasks: 1, name: 1, companyName: 1 } },
      { $unwind: "$crmTasks" },
      {
        $match: {
          "crmTasks.status": "in_progress",
          "crmTasks.assignedTo": employeeId,
        },
      },
      { $sort: { "crmTasks.startedAt": 1, "crmTasks._id": -1 } },
      ...(includeInProgressList
        ? [
            { $limit: 100 },
            {
              $project: {
                _id: 0,
                customerId: "$_id",
                customerName: "$name",
                companyName: "$companyName",
                // ❌ do not expose taskId
                title: "$crmTasks.title",
                status: "$crmTasks.status",
                startedAt: "$crmTasks.startedAt",
                dueAt: "$crmTasks.dueAt",
              },
            },
          ]
        : [{ $count: "count" }]),
    ]);

    let inProgressNow = { count: 0, tasks: [] };
    if (includeInProgressList) {
      inProgressNow = { count: inProgressAgg.length, tasks: inProgressAgg };
    } else {
      const count = inProgressAgg?.[0]?.count || 0;
      inProgressNow = { count, tasks: [] };
    }

    /* ---------------- OPTIONAL: TASK LIST WITH SUBTITLES ---------------- */

    const includeTasks = String(req.query.includeTasks ?? "false") === "true";
    const tasksLimit = clampInt(req.query.tasksLimit, 1, 200, 60);

    let tasks = [];
    if (includeTasks) {
      // show employee tasks across customers (no taskId returned)
      tasks = await Customer.aggregate([
        { $project: { name: 1, companyName: 1, crmTasks: 1 } },
        { $unwind: "$crmTasks" },
        {
          $match: {
            "crmTasks.assignedTo": employeeId,
            "crmTasks.status": { $in: ["pending", "in_progress", "done"] },
          },
        },
        {
          $addFields: {
            _statusSort: {
              $switch: {
                branches: [
                  { case: { $eq: ["$crmTasks.status", "in_progress"] }, then: 0 },
                  { case: { $eq: ["$crmTasks.status", "pending"] }, then: 1 },
                  { case: { $eq: ["$crmTasks.status", "done"] }, then: 2 },
                ],
                default: 9,
              },
            },
          },
        },
        { $sort: { _statusSort: 1, "crmTasks.dueAt": 1, "crmTasks.createdAt": -1 } },
        { $limit: tasksLimit },
        {
          $project: {
            _id: 0,
            customerId: "$_id",
            customerName: "$name",
            companyName: "$companyName",

            title: "$crmTasks.title",
            description: "$crmTasks.description",
            status: "$crmTasks.status",

            dueAt: "$crmTasks.dueAt",
            startedAt: "$crmTasks.startedAt",
            completedAt: "$crmTasks.completedAt",
            createdAt: "$crmTasks.createdAt",
            updatedAt: "$crmTasks.updatedAt",

            // ✅ subtitles with simple info (no internal ids)
            subtitles: {
              $map: {
                input: { $ifNull: ["$crmTasks.subtitles", []] },
                as: "s",
                in: {
                  text: "$$s.text",
                  filesCount: { $size: { $ifNull: ["$$s.files", []] } },
                  notesCount: { $size: { $ifNull: ["$$s.notes", []] } },
                },
              },
            },
          },
        },
      ]);
    }

    /* ---------------- PERFORMANCE LABEL ---------------- */

    const perf = scoreEmployee({
      tasksDoneInRange: totals.tasksDone,
      avgMinutes: totals.avgMinutes,
      openTasksCount: statusCounts.pending + statusCounts.in_progress,
    });

    return res.status(200).json({
      message: "Employee performance report fetched.",
      range: { preset: range, from, to },
      employeeId: String(employeeId),

      // ✅ Done stats (range-based)
      totals,
      byService,
      byCustomer,
      trend,

      // ✅ Task counts (all-time from crmTasks)
      taskCounts: {
        totalAssigned: totalAssignedTasks,
        pending: statusCounts.pending,
        inProgress: statusCounts.in_progress,
        done: statusCounts.done,
      },

      // ✅ Optional detailed tasks list (title + subtitles)
      tasks,

      // ✅ Current in-progress
      inProgressNow,

      // ✅ Simple label for UI (good/better/outstanding etc.)
      performance: perf,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeePerformance.",
      error: err.message,
    });
  }
};

/* =========================================================
   ✅ SELF REPORT
   GET /api/employeeReport/me/performance
========================================================= */
export const getMyPerformance = async (req, res) => {
  req.params.employeeId = String(req.user?._id || "");
  return getEmployeePerformance(req, res);
};
