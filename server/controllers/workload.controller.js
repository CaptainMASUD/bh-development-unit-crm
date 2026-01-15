// controllers/workload.controller.js
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

// ✅ Admin view: employee -> customers -> tasks
// GET /api/workload/employees
// Query:
//   employeeId?=<ObjectId>
//   taskStatus=all|pending|in_progress|done
//   includeEmptyCustomers=true|false
//   windowDays=7
//   completedFrom=2026-01-01
//   completedTo=2026-01-31
export const getEmployeeWorkload = async (req, res) => {
  try {
    // ✅ safety: admin/superadmin only (route middleware should enforce too)
    const role = req.user?.role;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ message: "Only admin/superadmin can view workload." });
    }

    const employeeId = toObjectIdSafe(req.query.employeeId);

    const taskStatusRaw = String(req.query.taskStatus ?? "all");
    const taskStatus = taskStatusRaw === "all" ? "all" : String(taskStatusRaw);

    if (taskStatus !== "all" && !ALLOWED_TASK_STATUSES.includes(taskStatus)) {
      return res.status(400).json({ message: "Invalid taskStatus." });
    }

    const includeEmptyCustomers = String(req.query.includeEmptyCustomers ?? "true") === "true";
    const windowDays = clampInt(req.query.windowDays, 1, 365, 7);

    const completedFromRaw = req.query.completedFrom ? new Date(req.query.completedFrom) : null;
    const completedToRaw = req.query.completedTo ? new Date(req.query.completedTo) : null;

    const completedFrom =
      completedFromRaw && !Number.isNaN(completedFromRaw.getTime()) ? completedFromRaw : null;
    const completedTo =
      completedToRaw && !Number.isNaN(completedToRaw.getTime()) ? completedToRaw : null;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

    // Build task filter condition for $filter
    // Base: employee must be in task.assignedTo
    // Optional: status, completedAt range
    const taskCond = {
      $and: [
        { $in: ["$assignedTo", "$$t.assignedTo"] }, // current employeeId is in task.assignedTo
      ],
    };

    if (taskStatus !== "all") {
      taskCond.$and.push({ $eq: ["$$t.status", taskStatus] });
    }

    // completed range applies ONLY when tasks are done (or you want to filter done tasks)
    // If user supplies completedFrom/completedTo, we filter tasks that have completedAt within range.
    if (completedFrom || completedTo) {
      // only tasks with completedAt as date
      const dateChecks = [{ $eq: ["$$t.status", "done"] }];

      if (completedFrom) dateChecks.push({ $gte: ["$$t.completedAt", completedFrom] });
      if (completedTo) dateChecks.push({ $lte: ["$$t.completedAt", completedTo] });

      taskCond.$and.push({ $and: dateChecks });
    }

    const pipeline = [
      // (Optional) if admin wants one employee
      ...(employeeId ? [{ $match: { assignedTo: employeeId } }] : []),

      // Each customer has multiple assigned employees
      { $unwind: "$assignedTo" },

      // (Optional) filter only that employee after unwind too
      ...(employeeId ? [{ $match: { assignedTo: employeeId } }] : []),

      // Build tasksForEmployee by filtering embedded crmTasks
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

      // Compute counts per customer per employee
      {
        $addFields: {
          pendingCount: {
            $size: {
              $filter: {
                input: "$tasksForEmployee",
                as: "t",
                cond: { $eq: ["$$t.status", "pending"] },
              },
            },
          },
          inProgressCount: {
            $size: {
              $filter: {
                input: "$tasksForEmployee",
                as: "t",
                cond: { $eq: ["$$t.status", "in_progress"] },
              },
            },
          },
          doneCount: {
            $size: {
              $filter: {
                input: "$tasksForEmployee",
                as: "t",
                cond: { $eq: ["$$t.status", "done"] },
              },
            },
          },

          overdueCount: {
            $size: {
              $filter: {
                input: "$tasksForEmployee",
                as: "t",
                cond: {
                  $and: [
                    { $ne: ["$$t.status", "done"] },
                    { $eq: [{ $type: "$$t.dueAt" }, "date"] },
                    { $lt: ["$$t.dueAt", now] },
                  ],
                },
              },
            },
          },

          dueSoonCount: {
            $size: {
              $filter: {
                input: "$tasksForEmployee",
                as: "t",
                cond: {
                  $and: [
                    { $ne: ["$$t.status", "done"] },
                    { $eq: [{ $type: "$$t.dueAt" }, "date"] },
                    { $gte: ["$$t.dueAt", now] },
                    { $lte: ["$$t.dueAt", windowEnd] },
                  ],
                },
              },
            },
          },
        },
      },

      // Optionally remove customers with zero tasks for that employee
      ...(includeEmptyCustomers
        ? []
        : [
            {
              $match: {
                $expr: { $gt: [{ $size: "$tasksForEmployee" }, 0] },
              },
            },
          ]),

      // Only keep fields needed
      {
        $project: {
          _id: 1,
          name: 1,
          companyName: 1,
          email: 1,
          phone: 1,

          employeeId: "$assignedTo",

          tasksForEmployee: {
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

          pendingCount: 1,
          inProgressCount: 1,
          doneCount: 1,
          overdueCount: 1,
          dueSoonCount: 1,
        },
      },

      // Group by employee -> push customers
      {
        $group: {
          _id: "$employeeId",
          customers: {
            $push: {
              customerId: "$_id",
              customerName: "$name",
              companyName: "$companyName",
              customerEmail: "$email",
              customerPhone: "$phone",

              tasks: "$tasksForEmployee",

              counts: {
                pending: "$pendingCount",
                in_progress: "$inProgressCount",
                done: "$doneCount",
                overdue: "$overdueCount",
                dueSoon: "$dueSoonCount",
              },
            },
          },

          totals: {
            $sum: 0, // placeholder (not used)
          },

          totalPending: { $sum: "$pendingCount" },
          totalInProgress: { $sum: "$inProgressCount" },
          totalDone: { $sum: "$doneCount" },
          totalOverdue: { $sum: "$overdueCount" },
          totalDueSoon: { $sum: "$dueSoonCount" },
        },
      },

      // Join employee info from users
      {
        $lookup: {
          from: "users",
          let: { eid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$eid"] } } },
            { $match: { role: "employee" } },
            { $project: { _id: 1, name: 1, email: 1, role: 1, isActive: 1 } },
          ],
          as: "employee",
        },
      },

      // Remove non-employee rows (just in case)
      { $unwind: "$employee" },

      // Final shape
      {
        $project: {
          _id: 0,
          employee: 1,
          totals: {
            pending: "$totalPending",
            in_progress: "$totalInProgress",
            done: "$totalDone",
            overdue: "$totalOverdue",
            dueSoon: "$totalDueSoon",
          },
          customers: 1,
        },
      },

      // Sort: employees with most done tasks first (shows "completing employees")
      { $sort: { "totals.done": -1 } },
    ];

    const rows = await Customer.aggregate(pipeline);

    return res.status(200).json({
      message: "Employee workload fetched.",
      windowDays,
      includeEmptyCustomers,
      taskStatus,
      filters: {
        employeeId: employeeId ? String(employeeId) : null,
        completedFrom: completedFrom ? completedFrom.toISOString() : null,
        completedTo: completedTo ? completedTo.toISOString() : null,
      },
      count: rows.length,
      employees: rows,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error in getEmployeeWorkload.",
      error: err.message,
    });
  }
};
