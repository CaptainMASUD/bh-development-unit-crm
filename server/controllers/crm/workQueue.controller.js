import mongoose from "mongoose";
import WorkQueue from "../../models/workQueue.model.js";
import Lead from "../../models/lead.model.js";
import Activity from "../../models/activity.model.js";
import Notification from "../../models/notification.model.js";
import { getReqMeta, writeAudit, writeActivity } from "../../utils/audit.js";

const toObjectId = (v) => {
  if (!v) return null;
  return mongoose.Types.ObjectId.isValid(v)
    ? new mongoose.Types.ObjectId(v)
    : null;
};

const normalizeString = (value = "") => String(value || "").trim();

const validateDateOrNull = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const isAdminOrSuperAdmin = (req) => {
  const role = req?.user?.role;
  return role === "admin" || role === "superadmin";
};

const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const WORK_QUEUE_SOURCES = [
  "new_lead",
  "follow_up_due",
  "overdue_follow_up",
  "proposal_follow_up",
  "deal_stuck",
  "manual",
  "automation",
];

const RECOMMENDED_ACTIONS = [
  "call",
  "email",
  "whatsapp",
  "meeting",
  "follow_up",
  "send_proposal",
  "negotiate",
  "create_deal",
  "convert_customer",
  "mark_lost",
  "review",
];

const PRIORITIES = ["low", "normal", "high", "urgent"];

const STATUSES = ["pending", "in_progress", "done", "snoozed", "cancelled"];

const assertQueueAccessOrThrow = async ({ req, item }) => {
  if (isAdminOrSuperAdmin(req)) return true;

  if (String(item.assignedTo || "") === String(req.user._id)) return true;
  if (String(item.createdBy || "") === String(req.user._id)) return true;

  const err = new Error("Not authorized to access this work queue item");
  err.statusCode = 403;
  throw err;
};

const getAssignedUserFilter = (req, assignedTo) => {
  if (isAdminOrSuperAdmin(req)) {
    const aid = toObjectId(assignedTo);
    return aid ? aid : null;
  }

  return new mongoose.Types.ObjectId(req.user._id);
};

const createNotificationSafe = async ({
  userId,
  title,
  message,
  type = "work_queue",
  priority = "normal",
  entityType = "WorkQueue",
  entityId,
  createdBy,
}) => {
  try {
    if (!userId || !title) return null;

    return await Notification.create({
      userId,
      title,
      message,
      type,
      priority,
      entityType,
      entityId,
      createdBy,
    });
  } catch (err) {
    console.error("Notification failed:", err.message);
    return null;
  }
};

/* =======================
   CREATE MANUAL QUEUE ITEM
======================= */
export const createWorkQueueItem = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const {
      assignedTo,
      leadId = null,
      customerId = null,
      dealId = null,
      proposalId = null,
      activityId = null,
      source = "manual",
      title,
      description = "",
      recommendedAction = "review",
      priority = "normal",
      priorityScore = 50,
      dueAt = null,
    } = req.body || {};

    const safeAssignedTo = toObjectId(assignedTo) || req.user._id;

    const safeLeadId = toObjectId(leadId);
    const safeCustomerId = toObjectId(customerId);
    const safeDealId = toObjectId(dealId);
    const safeProposalId = toObjectId(proposalId);
    const safeActivityId = toObjectId(activityId);

    if (!safeLeadId && !safeCustomerId && !safeDealId && !safeProposalId && !safeActivityId) {
      return res.status(400).json({
        message: "Work queue item must be connected to a CRM entity.",
      });
    }

    if (!title || !normalizeString(title)) {
      return res.status(400).json({ message: "title is required" });
    }

    if (!WORK_QUEUE_SOURCES.includes(source)) {
      return res.status(400).json({
        message: `Invalid source. Use: ${WORK_QUEUE_SOURCES.join(", ")}`,
      });
    }

    if (!RECOMMENDED_ACTIONS.includes(recommendedAction)) {
      return res.status(400).json({
        message: `Invalid recommendedAction. Use: ${RECOMMENDED_ACTIONS.join(", ")}`,
      });
    }

    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: `Invalid priority. Use: ${PRIORITIES.join(", ")}`,
      });
    }

    const safeDueAt = validateDateOrNull(dueAt);

    const item = await WorkQueue.create({
      queueDate: getStartOfDay(safeDueAt || new Date()),
      assignedTo: safeAssignedTo,
      leadId: safeLeadId,
      customerId: safeCustomerId,
      dealId: safeDealId,
      proposalId: safeProposalId,
      activityId: safeActivityId,
      source,
      title: normalizeString(title),
      description: normalizeString(description),
      recommendedAction,
      priority,
      priorityScore: Math.max(0, Math.min(Number(priorityScore || 0), 1000)),
      status: "pending",
      dueAt: safeDueAt,
      createdBy: req.user._id,
      autoGenerated: false,
    });

    await createNotificationSafe({
      userId: safeAssignedTo,
      title: "New work item assigned",
      message: item.title,
      priority,
      entityId: item._id,
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "queue_created",
      entityType: "WorkQueue",
      entityId: item._id,
      before: null,
      after: item.toObject(),
      meta,
    });

    await writeActivity({
      leadId: safeLeadId,
      customerId: safeCustomerId,
      dealId: safeDealId,
      proposalId: safeProposalId,
      entityType: "WorkQueue",
      entityId: item._id,
      type: "work_queue_created",
      message: `Work queue item created: ${item.title}`,
      createdBy: req.user._id,
      meta: {
        source,
        priority,
        recommendedAction,
        dueAt: safeDueAt,
      },
    });

    return res.status(201).json({
      message: "Work queue item created",
      item,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to create work queue item",
      error: err.message,
    });
  }
};

/* =======================
   GET TODAY WORK QUEUE
======================= */
export const getTodayWorkQueue = async (req, res) => {
  try {
    const {
      assignedTo,
      status = "pending",
      priority,
      source,
      date,
      limit = 100,
    } = req.query || {};

    const targetDate = validateDateOrNull(date) || new Date();

    const filter = {
      queueDate: {
        $gte: getStartOfDay(targetDate),
        $lte: getEndOfDay(targetDate),
      },
    };

    const assignedFilter = getAssignedUserFilter(req, assignedTo);
    if (assignedFilter) filter.assignedTo = assignedFilter;

    if (status && STATUSES.includes(String(status))) {
      filter.status = status;
    }

    if (priority && PRIORITIES.includes(String(priority))) {
      filter.priority = priority;
    }

    if (source && WORK_QUEUE_SOURCES.includes(String(source))) {
      filter.source = source;
    }

    const pageSize = Math.min(Math.max(parseInt(limit || "100", 10), 1), 200);

    const items = await WorkQueue.find(filter)
      .populate("assignedTo", "name email role avatarUrl teamRole workStatus")
      .populate("createdBy", "name email role avatarUrl")
      .populate("leadId", "leadNumber contact status pipelineStage priority leadTemperature leadScore nextFollowUpAt nextAction isOverdue")
      .populate("customerId", "name email phone companyName")
      .populate("dealId", "dealNo title stage grandTotal currency dealHealth nextDealActionAt")
      .populate("proposalId", "proposalNo title status grandTotal currency followupDueAt")
      .populate("activityId", "title type status scheduledAt nextActionDate")
      .sort({
        priorityScore: -1,
        dueAt: 1,
        createdAt: -1,
      })
      .limit(pageSize)
      .lean();

    const summary = {
      total: items.length,
      urgent: items.filter((x) => x.priority === "urgent").length,
      high: items.filter((x) => x.priority === "high").length,
      overdue: items.filter((x) => x.dueAt && new Date(x.dueAt) < new Date()).length,
    };

    return res.json({
      items,
      summary,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to get work queue",
      error: err.message,
    });
  }
};

/* =======================
   LIST WORK QUEUE
======================= */
export const listWorkQueue = async (req, res) => {
  try {
    const {
      assignedTo,
      status,
      priority,
      source,
      leadId,
      customerId,
      dealId,
      proposalId,
      from,
      to,
      q,
      limit = 100,
    } = req.query || {};

    const filter = {};

    const assignedFilter = getAssignedUserFilter(req, assignedTo);
    if (assignedFilter) filter.assignedTo = assignedFilter;

    if (status && STATUSES.includes(String(status))) filter.status = status;
    if (priority && PRIORITIES.includes(String(priority))) filter.priority = priority;
    if (source && WORK_QUEUE_SOURCES.includes(String(source))) filter.source = source;

    const safeLeadId = toObjectId(leadId);
    const safeCustomerId = toObjectId(customerId);
    const safeDealId = toObjectId(dealId);
    const safeProposalId = toObjectId(proposalId);

    if (safeLeadId) filter.leadId = safeLeadId;
    if (safeCustomerId) filter.customerId = safeCustomerId;
    if (safeDealId) filter.dealId = safeDealId;
    if (safeProposalId) filter.proposalId = safeProposalId;

    if (from || to) {
      filter.queueDate = {};
      const fromDt = validateDateOrNull(from);
      const toDt = validateDateOrNull(to);
      if (fromDt) filter.queueDate.$gte = getStartOfDay(fromDt);
      if (toDt) filter.queueDate.$lte = getEndOfDay(toDt);
    }

    if (q && normalizeString(q)) {
      filter.$or = [
        { title: { $regex: normalizeString(q), $options: "i" } },
        { description: { $regex: normalizeString(q), $options: "i" } },
      ];
    }

    const pageSize = Math.min(Math.max(parseInt(limit || "100", 10), 1), 200);

    const items = await WorkQueue.find(filter)
      .populate("assignedTo", "name email role avatarUrl teamRole workStatus")
      .populate("createdBy", "name email role avatarUrl")
      .populate("leadId", "leadNumber contact status pipelineStage priority leadTemperature nextFollowUpAt nextAction isOverdue")
      .populate("customerId", "name email phone companyName")
      .populate("dealId", "dealNo title stage grandTotal currency dealHealth")
      .populate("proposalId", "proposalNo title status grandTotal currency followupDueAt")
      .populate("activityId", "title type status scheduledAt nextActionDate")
      .sort({ status: 1, priorityScore: -1, dueAt: 1, createdAt: -1 })
      .limit(pageSize)
      .lean();

    return res.json({ items });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to list work queue",
      error: err.message,
    });
  }
};

/* =======================
   GET WORK QUEUE ITEM
======================= */
export const getWorkQueueItem = async (req, res) => {
  try {
    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid work queue id" });

    const item = await WorkQueue.findById(id)
      .populate("assignedTo", "name email role avatarUrl teamRole workStatus")
      .populate("createdBy", "name email role avatarUrl")
      .populate("leadId")
      .populate("customerId")
      .populate("dealId")
      .populate("proposalId")
      .populate("activityId")
      .lean();

    if (!item) return res.status(404).json({ message: "Work queue item not found" });

    await assertQueueAccessOrThrow({ req, item });

    return res.json({ item });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to get work queue item",
      error: err.message,
    });
  }
};

/* =======================
   START WORK QUEUE ITEM
======================= */
export const startWorkQueueItem = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid work queue id" });

    const before = await WorkQueue.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Work queue item not found" });

    await assertQueueAccessOrThrow({ req, item: before });

    if (!["pending", "snoozed"].includes(before.status)) {
      return res.status(400).json({
        message: "Only pending or snoozed queue items can be started.",
      });
    }

    const item = await WorkQueue.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "in_progress",
          startedAt: new Date(),
          snoozedUntil: null,
        },
      },
      { new: true, runValidators: true }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "update",
      entityType: "WorkQueue",
      entityId: id,
      before,
      after: item.toObject(),
      meta,
    });

    return res.json({
      message: "Work queue item started",
      item,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to start work queue item",
      error: err.message,
    });
  }
};

/* =======================
   MARK WORK QUEUE ITEM DONE
======================= */
export const markWorkQueueDone = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid work queue id" });

    const before = await WorkQueue.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Work queue item not found" });

    await assertQueueAccessOrThrow({ req, item: before });

    const { result = "", createActivity = true } = req.body || {};

    const item = await WorkQueue.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "done",
          doneAt: new Date(),
          result: normalizeString(result) || "Done",
          snoozedUntil: null,
        },
      },
      { new: true, runValidators: true }
    );

    let activity = null;

    if (createActivity && item.leadId) {
      activity = await Activity.create({
        leadId: item.leadId,
        customerId: item.customerId || null,
        dealId: item.dealId || null,
        type:
          item.recommendedAction === "call"
            ? "call"
            : item.recommendedAction === "email"
            ? "email"
            : item.recommendedAction === "whatsapp"
            ? "whatsapp"
            : item.recommendedAction === "meeting"
            ? "meeting"
            : "note",
        status: "completed",
        priority: item.priority === "urgent" || item.priority === "high" ? "high" : "medium",
        title: item.title,
        body: normalizeString(result) || item.description || "",
        completedAt: new Date(),
        outcome: normalizeString(result),
        quickActionKey: "",
        activityResult: "",
        reminderStatus: "done",
        source: "manual",
        createdBy: req.user._id,
        assignedTo: item.assignedTo,
      });

      await Lead.findByIdAndUpdate(item.leadId, {
        $set: {
          lastActivityAt: new Date(),
          untouchedSinceCreated: false,
          ...(item.recommendedAction === "call" || item.recommendedAction === "follow_up"
            ? { lastContactedAt: new Date(), status: "contacted" }
            : {}),
        },
      });
    }

    await writeAudit({
      actorId: req.user._id,
      action: "queue_done",
      entityType: "WorkQueue",
      entityId: id,
      before,
      after: item.toObject(),
      meta,
    });

    await writeActivity({
      leadId: item.leadId,
      customerId: item.customerId,
      dealId: item.dealId,
      proposalId: item.proposalId,
      entityType: "WorkQueue",
      entityId: item._id,
      type: "work_queue_done",
      message: `Work queue done: ${item.title}`,
      createdBy: req.user._id,
      meta: {
        result,
        activityId: activity?._id || null,
      },
    });

    return res.json({
      message: "Work queue item completed",
      item,
      activity,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to complete work queue item",
      error: err.message,
    });
  }
};

/* =======================
   SNOOZE WORK QUEUE ITEM
======================= */
export const snoozeWorkQueueItem = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid work queue id" });

    const before = await WorkQueue.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Work queue item not found" });

    await assertQueueAccessOrThrow({ req, item: before });

    const { snoozedUntil, reason = "" } = req.body || {};
    const snoozeDate = validateDateOrNull(snoozedUntil);

    if (!snoozeDate) {
      return res.status(400).json({ message: "Valid snoozedUntil is required" });
    }

    const item = await WorkQueue.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "snoozed",
          snoozedUntil: snoozeDate,
          queueDate: getStartOfDay(snoozeDate),
          dueAt: snoozeDate,
          result: normalizeString(reason),
        },
      },
      { new: true, runValidators: true }
    );

    if (item.leadId) {
      await Lead.findByIdAndUpdate(item.leadId, {
        $set: {
          nextFollowUpAt: snoozeDate,
          nextActionAt: snoozeDate,
          nextAction: item.title || "Follow up",
        },
      });
    }

    await writeAudit({
      actorId: req.user._id,
      action: "queue_snoozed",
      entityType: "WorkQueue",
      entityId: id,
      before,
      after: item.toObject(),
      meta,
    });

    await writeActivity({
      leadId: item.leadId,
      customerId: item.customerId,
      dealId: item.dealId,
      proposalId: item.proposalId,
      entityType: "WorkQueue",
      entityId: item._id,
      type: "work_queue_snoozed",
      message: `Work queue snoozed: ${item.title}`,
      createdBy: req.user._id,
      meta: {
        reason,
        snoozedUntil: snoozeDate,
      },
    });

    return res.json({
      message: "Work queue item snoozed",
      item,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to snooze work queue item",
      error: err.message,
    });
  }
};

/* =======================
   REASSIGN WORK QUEUE ITEM
======================= */
export const reassignWorkQueueItem = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    if (!isAdminOrSuperAdmin(req)) {
      return res.status(403).json({
        message: "Only admin/superadmin can reassign work queue items.",
      });
    }

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid work queue id" });

    const before = await WorkQueue.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Work queue item not found" });

    const { assignedTo } = req.body || {};
    const safeAssignedTo = toObjectId(assignedTo);

    if (!safeAssignedTo) {
      return res.status(400).json({ message: "Valid assignedTo is required" });
    }

    const item = await WorkQueue.findByIdAndUpdate(
      id,
      {
        $set: {
          assignedTo: safeAssignedTo,
          status: before.status === "done" ? "done" : "pending",
        },
      },
      { new: true, runValidators: true }
    );

    await createNotificationSafe({
      userId: safeAssignedTo,
      title: "Work item reassigned to you",
      message: item.title,
      priority: item.priority,
      entityId: item._id,
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "reassign",
      entityType: "WorkQueue",
      entityId: id,
      before,
      after: item.toObject(),
      meta,
    });

    return res.json({
      message: "Work queue item reassigned",
      item,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to reassign work queue item",
      error: err.message,
    });
  }
};

/* =======================
   CANCEL WORK QUEUE ITEM
======================= */
export const cancelWorkQueueItem = async (req, res) => {
  try {
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid work queue id" });

    const before = await WorkQueue.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Work queue item not found" });

    await assertQueueAccessOrThrow({ req, item: before });

    const { reason = "" } = req.body || {};

    const item = await WorkQueue.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "cancelled",
          result: normalizeString(reason) || "Cancelled",
        },
      },
      { new: true, runValidators: true }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "cancel",
      entityType: "WorkQueue",
      entityId: id,
      before,
      after: item.toObject(),
      meta,
    });

    return res.json({
      message: "Work queue item cancelled",
      item,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to cancel work queue item",
      error: err.message,
    });
  }
};

/* =======================
   WORK QUEUE SUMMARY
======================= */
export const getWorkQueueSummary = async (req, res) => {
  try {
    const { assignedTo, date } = req.query || {};

    const targetDate = validateDateOrNull(date) || new Date();

    const filter = {
      queueDate: {
        $gte: getStartOfDay(targetDate),
        $lte: getEndOfDay(targetDate),
      },
    };

    const assignedFilter = getAssignedUserFilter(req, assignedTo);
    if (assignedFilter) filter.assignedTo = assignedFilter;

    const [
      total,
      pending,
      inProgress,
      done,
      snoozed,
      cancelled,
      urgent,
      high,
      overdue,
    ] = await Promise.all([
      WorkQueue.countDocuments(filter),
      WorkQueue.countDocuments({ ...filter, status: "pending" }),
      WorkQueue.countDocuments({ ...filter, status: "in_progress" }),
      WorkQueue.countDocuments({ ...filter, status: "done" }),
      WorkQueue.countDocuments({ ...filter, status: "snoozed" }),
      WorkQueue.countDocuments({ ...filter, status: "cancelled" }),
      WorkQueue.countDocuments({ ...filter, priority: "urgent" }),
      WorkQueue.countDocuments({ ...filter, priority: "high" }),
      WorkQueue.countDocuments({
        ...filter,
        status: { $in: ["pending", "in_progress", "snoozed"] },
        dueAt: { $lt: new Date() },
      }),
    ]);

    return res.json({
      summary: {
        total,
        pending,
        inProgress,
        done,
        snoozed,
        cancelled,
        urgent,
        high,
        overdue,
      },
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to get work queue summary",
      error: err.message,
    });
  }
};