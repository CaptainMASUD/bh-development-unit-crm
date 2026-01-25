// ===============================
// ✅ controllers/workload.controller.js (FULL UPDATED)
// Customer-first + cursor pagination + avatars + optimized payload
// ===============================
import mongoose from "mongoose";
import Customer from "../models/customer.model.js";

const { Types } = mongoose;

const ALLOWED_TASK_STATUSES = ["pending", "in_progress", "done"];

const toObjectIdSafe = (id) => {
  try {
    if (!id) return null;
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(String(id));
    return null;
  } catch {
    return null;
  }
};

const clampInt = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
};

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCustomerSearchFilter = (qRaw) => {
  const q = String(qRaw || "").trim();
  if (!q) return null;

  const safe = escapeRegex(q);
  const rx = new RegExp(safe, "i");

  // Lightweight search fields (your schema also has a text index; you can switch to $text if desired)
  return {
    $or: [{ name: rx }, { companyName: rx }, { email: rx }, { phone: rx }],
  };
};

// cursor = base64url(JSON.stringify({ ts: createdAtISO, id: _id }))
const encodeCursor = (doc) => {
  if (!doc?._id || !doc?.createdAt) return null;
  const payload = { ts: new Date(doc.createdAt).toISOString(), id: String(doc._id) };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(String(cursor), "base64url").toString("utf8");
    const obj = JSON.parse(raw);
    if (!obj?.ts || !obj?.id) return null;

    const ts = new Date(obj.ts);
    if (Number.isNaN(ts.getTime())) return null;

    const oid = toObjectIdSafe(obj.id);
    if (!oid) return null;

    return { ts, id: oid };
  } catch {
    return null;
  }
};

const parseSort = (v) => (String(v || "newest") === "oldest" ? "oldest" : "newest");

const buildCursorFilter = ({ cursorObj, sort }) => {
  if (!cursorObj) return null;
  const { ts, id } = cursorObj;

  if (sort === "newest") {
    // createdAt desc, _id desc
    return { $or: [{ createdAt: { $lt: ts } }, { createdAt: ts, _id: { $lt: id } }] };
  }
  // createdAt asc, _id asc
  return { $or: [{ createdAt: { $gt: ts } }, { createdAt: ts, _id: { $gt: id } }] };
};

const computeCountsReduceStage = ({ now, windowEnd }) => ({
  $addFields: {
    taskStats: {
      $reduce: {
        input: "$tasksForEmployee",
        initialValue: {
          pending: 0,
          in_progress: 0,
          done: 0,
          overdue: 0,
          dueSoon: 0,
          total: 0,
        },
        in: {
          pending: {
            $add: [
              "$$value.pending",
              { $cond: [{ $eq: ["$$this.status", "pending"] }, 1, 0] },
            ],
          },
          in_progress: {
            $add: [
              "$$value.in_progress",
              { $cond: [{ $eq: ["$$this.status", "in_progress"] }, 1, 0] },
            ],
          },
          done: {
            $add: ["$$value.done", { $cond: [{ $eq: ["$$this.status", "done"] }, 1, 0] }],
          },

          overdue: {
            $add: [
              "$$value.overdue",
              {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$$this.status", "done"] },
                      { $eq: [{ $type: "$$this.dueAt" }, "date"] },
                      { $lt: ["$$this.dueAt", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            ],
          },

          dueSoon: {
            $add: [
              "$$value.dueSoon",
              {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$$this.status", "done"] },
                      { $eq: [{ $type: "$$this.dueAt" }, "date"] },
                      { $gte: ["$$this.dueAt", now] },
                      { $lte: ["$$this.dueAt", windowEnd] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            ],
          },

          total: { $add: ["$$value.total", 1] },
        },
      },
    },
  },
});

/**
 * ✅ Customer-first workload (Admin/Superadmin only)
 *
 * GET /api/workload/customers
 * Query:
 *   limit=20
 *   cursor=<base64url>
 *   sort=newest|oldest
 *   q=<search customers>
 *   employeeId=<ObjectId> (optional: only customers assigned to this employee)
 *
 *   taskStatus=all|pending|in_progress|done
 *   includeEmptyEmployees=true|false
 *   windowDays=7
 *   completedFrom=2026-01-01
 *   completedTo=2026-01-31
 *
 *   includeTasks=true|false   (default false for lighter dashboard)
 *   tasksMode=open|all        (default open => pending+in_progress; if taskStatus is specified, it wins)
 *   taskLimit=10              (only used when includeTasks=true)
 */
export const getCustomerWorkload = async (req, res) => {
  try {
    // ✅ safety: admin/superadmin only (route middleware should enforce too)
    const role = req.user?.role;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ message: "Only admin/superadmin can view workload." });
    }

    // ---------- pagination ----------
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;

    const limit = clampInt(req.query.limit, 1, MAX_LIMIT, DEFAULT_LIMIT);
    const sort = parseSort(req.query.sort);
    const cursorObj = decodeCursor(req.query.cursor);

    const sortSpec = sort === "newest" ? { createdAt: -1, _id: -1 } : { createdAt: 1, _id: 1 };

    // ---------- filters ----------
    const employeeId = toObjectIdSafe(req.query.employeeId);

    const qFilter = buildCustomerSearchFilter(req.query.q);

    const taskStatusRaw = String(req.query.taskStatus ?? "all");
    const taskStatus = taskStatusRaw === "all" ? "all" : String(taskStatusRaw);
    if (taskStatus !== "all" && !ALLOWED_TASK_STATUSES.includes(taskStatus)) {
      return res.status(400).json({ message: "Invalid taskStatus." });
    }

    const includeEmptyEmployees = String(req.query.includeEmptyEmployees ?? "true") === "true";
    const windowDays = clampInt(req.query.windowDays, 1, 365, 7);

    const includeTasks = String(req.query.includeTasks ?? "false") === "true";
    const tasksMode = String(req.query.tasksMode ?? "open"); // open | all
    const taskLimit = clampInt(req.query.taskLimit, 1, 100, 10);

    const completedFromRaw = req.query.completedFrom ? new Date(req.query.completedFrom) : null;
    const completedToRaw = req.query.completedTo ? new Date(req.query.completedTo) : null;

    const completedFrom =
      completedFromRaw && !Number.isNaN(completedFromRaw.getTime()) ? completedFromRaw : null;
    const completedTo =
      completedToRaw && !Number.isNaN(completedToRaw.getTime()) ? completedToRaw : null;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

    // ---------- base customer match (customer-level, before aggregation) ----------
    const baseMatch = {};
    if (qFilter) Object.assign(baseMatch, qFilter);
    if (employeeId) baseMatch.assignedTo = employeeId;

    const cursorFilter = buildCursorFilter({ cursorObj, sort });
    if (cursorFilter) Object.assign(baseMatch, cursorFilter);

    // ✅ Query 1 (cheap): get customer page first (prevents unwind exploding pagination)
    const pageRows = await Customer.find(baseMatch)
      .select("_id name companyName email phone createdAt updatedAt assignedTo")
      .sort(sortSpec)
      .limit(limit + 1)
      .lean();

    const hasMore = pageRows.length > limit;
    const pageCustomers = hasMore ? pageRows.slice(0, limit) : pageRows;

    const nextCursor = hasMore ? encodeCursor(pageCustomers[pageCustomers.length - 1]) : null;

    const customerIds = pageCustomers.map((c) => c._id);
    if (customerIds.length === 0) {
      return res.status(200).json({
        message: "Customer workload fetched.",
        count: 0,
        hasMore: false,
        nextCursor: null,
        windowDays,
        includeEmptyEmployees,
        includeTasks,
        taskLimit: includeTasks ? taskLimit : 0,
        taskStatus,
        tasksMode,
        filters: {
          employeeId: employeeId ? String(employeeId) : null,
          completedFrom: completedFrom ? completedFrom.toISOString() : null,
          completedTo: completedTo ? completedTo.toISOString() : null,
          q: String(req.query.q || "").trim() || null,
        },
        customers: [],
      });
    }

    // ---------- task filter condition (inside $filter) ----------
    // Base: this customer's current unwind employee must be in task.assignedTo
    const taskCond = { $and: [{ $in: ["$assignedTo", "$$t.assignedTo"] }] };

    // tasksMode only applies when taskStatus=all
    // If taskStatus is specific, it wins (and tasksMode is ignored).
    if (taskStatus !== "all") {
      taskCond.$and.push({ $eq: ["$$t.status", taskStatus] });
    } else if (tasksMode === "open") {
      taskCond.$and.push({ $ne: ["$$t.status", "done"] });
    }

    // completed range applies ONLY when filtering completed tasks
    if (completedFrom || completedTo) {
      const dateChecks = [{ $eq: ["$$t.status", "done"] }];
      if (completedFrom) dateChecks.push({ $gte: ["$$t.completedAt", completedFrom] });
      if (completedTo) dateChecks.push({ $lte: ["$$t.completedAt", completedTo] });
      taskCond.$and.push({ $and: dateChecks });
    }

    // ✅ Query 2 (targeted aggregation): build customer -> employees -> tasks
    const pipeline = [
      { $match: { _id: { $in: customerIds } } },

      // Keep customer identity fields (so group can rebuild)
      {
        $project: {
          _id: 1,
          name: 1,
          companyName: 1,
          email: 1,
          phone: 1,
          createdAt: 1,
          updatedAt: 1,
          assignedTo: 1,
          crmTasks: 1,
        },
      },

      // Expand employees assigned to each customer
      { $unwind: { path: "$assignedTo", preserveNullAndEmptyArrays: true } },

      // If admin passed employeeId, apply after unwind too
      ...(employeeId ? [{ $match: { assignedTo: employeeId } }] : []),

      // Build tasksForEmployee (embedded filter)
      {
        $addFields: {
          tasksForEmployee: {
            $filter: {
              input: "$crmTasks",
              as: "t",
              cond: taskCond,
            },
          },
        },
      },

      // Compute counts in ONE pass (reduce)
      computeCountsReduceStage({ now, windowEnd }),

      // Lookup employee info (include avatarUrl)
      {
        $lookup: {
          from: "users",
          let: { eid: "$assignedTo" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$eid"] } } },
            { $match: { role: "employee" } },
            { $project: { _id: 1, name: 1, email: 1, role: 1, isActive: 1, avatarUrl: 1 } },
          ],
          as: "employee",
        },
      },

      // Create an employee entry only when lookup found a real employee
      {
        $addFields: {
          employeeEntry: {
            $cond: [
              { $gt: [{ $size: "$employee" }, 0] },
              {
                employee: { $arrayElemAt: ["$employee", 0] },

                counts: {
                  pending: "$taskStats.pending",
                  in_progress: "$taskStats.in_progress",
                  done: "$taskStats.done",
                  overdue: "$taskStats.overdue",
                  dueSoon: "$taskStats.dueSoon",
                  total: "$taskStats.total",
                },

                // tasks are optional to reduce payload
                tasks: includeTasks
                  ? {
                      $slice: [
                        {
                          $map: {
                            input: "$tasksForEmployee",
                            as: "t",
                            in: {
                              _id: "$$t._id",
                              title: "$$t.title",
                              status: "$$t.status",
                              dueAt: "$$t.dueAt",
                              completedAt: "$$t.completedAt",
                              createdAt: "$$t.createdAt",
                              templateId: "$$t.templateId",
                            },
                          },
                        },
                        taskLimit,
                      ],
                    }
                  : [],
              },
              null,
            ],
          },
        },
      },

      // Group back to customers (customer-first)
      {
        $group: {
          _id: "$_id",
          name: { $first: "$name" },
          companyName: { $first: "$companyName" },
          email: { $first: "$email" },
          phone: { $first: "$phone" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },

          employees: { $push: "$employeeEntry" },

          // customer totals (sum of employee totals)
          totalPending: { $sum: "$taskStats.pending" },
          totalInProgress: { $sum: "$taskStats.in_progress" },
          totalDone: { $sum: "$taskStats.done" },
          totalOverdue: { $sum: "$taskStats.overdue" },
          totalDueSoon: { $sum: "$taskStats.dueSoon" },
          totalTasks: { $sum: "$taskStats.total" },
        },
      },

      // Remove null employees
      {
        $addFields: {
          employees: {
            $filter: {
              input: "$employees",
              as: "e",
              cond: { $ne: ["$$e", null] },
            },
          },
        },
      },

      // Optionally remove employees with 0 tasks (per current task filters)
      ...(includeEmptyEmployees
        ? []
        : [
            {
              $addFields: {
                employees: {
                  $filter: {
                    input: "$employees",
                    as: "e",
                    cond: { $gt: ["$$e.counts.total", 0] },
                  },
                },
              },
            },
          ]),

      // Final shape per customer
      {
        $project: {
          _id: 0,
          customer: {
            customerId: "$_id",
            name: "$name",
            companyName: "$companyName",
            email: "$email",
            phone: "$phone",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
          },
          totals: {
            pending: "$totalPending",
            in_progress: "$totalInProgress",
            done: "$totalDone",
            overdue: "$totalOverdue",
            dueSoon: "$totalDueSoon",
            total: "$totalTasks",
          },
          employees: 1,
        },
      },

      // Preserve the original page order (important!)
      {
        $addFields: {
          __order: { $indexOfArray: [customerIds, "$customer.customerId"] },
        },
      },
      { $sort: { __order: 1 } },
      { $project: { __order: 0 } },
    ];

    const customers = await Customer.aggregate(pipeline);

    return res.status(200).json({
      message: "Customer workload fetched.",
      windowDays,
      includeEmptyEmployees,
      includeTasks,
      taskLimit: includeTasks ? taskLimit : 0,
      taskStatus,
      tasksMode,
      filters: {
        employeeId: employeeId ? String(employeeId) : null,
        completedFrom: completedFrom ? completedFrom.toISOString() : null,
        completedTo: completedTo ? completedTo.toISOString() : null,
        q: String(req.query.q || "").trim() || null,
      },
      count: customers.length,
      hasMore,
      nextCursor,
      customers,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getCustomerWorkload.",
      error: err.message,
    });
  }
};
