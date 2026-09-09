import mongoose from "mongoose";
import AutomationRule from "../../models/automationRule.model.js";
import Lead from "../../models/lead.model.js";
import Activity from "../../models/activity.model.js";
import Proposal from "../../models/proposal.model.js";
import Deal from "../../models/deal.model.js";
import WorkQueue from "../../models/workQueue.model.js";
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

const assertAdmin = (req) => {
  if (!isAdminOrSuperAdmin(req)) {
    const err = new Error("Only admin/superadmin can manage automation rules.");
    err.statusCode = 403;
    throw err;
  }
};

const ENTITY_TYPES = ["Lead", "Activity", "Proposal", "Deal"];

const TRIGGERS = [
  "lead_created",
  "lead_updated",
  "stage_changed",
  "activity_created",
  "proposal_sent",
  "deal_updated",
  "daily_check",
];

const CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
  "older_than_days",
  "due_within_days",
  "is_empty",
  "is_not_empty",
];

const ACTION_TYPES = [
  "create_work_queue",
  "create_notification",
  "update_lead_priority",
  "update_lead_score",
  "set_next_action",
  "create_activity",
  "mark_overdue",
];

const getByPath = (obj, path) => {
  if (!obj || !path) return undefined;

  return String(path)
    .split(".")
    .reduce((acc, key) => {
      if (acc && acc[key] !== undefined) return acc[key];
      return undefined;
    }, obj);
};

const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const compareCondition = (entity, condition) => {
  const field = normalizeString(condition?.field);
  const operator = condition?.operator;
  const expected = condition?.value;
  const actual = getByPath(entity, field);

  if (!field || !CONDITION_OPERATORS.includes(operator)) return false;

  if (operator === "equals") {
    return String(actual ?? "") === String(expected ?? "");
  }

  if (operator === "not_equals") {
    return String(actual ?? "") !== String(expected ?? "");
  }

  if (operator === "contains") {
    return String(actual ?? "")
      .toLowerCase()
      .includes(String(expected ?? "").toLowerCase());
  }

  if (operator === "greater_than") {
    return Number(actual || 0) > Number(expected || 0);
  }

  if (operator === "less_than") {
    return Number(actual || 0) < Number(expected || 0);
  }

  if (operator === "is_empty") {
    return actual === undefined || actual === null || String(actual).trim() === "";
  }

  if (operator === "is_not_empty") {
    return !(actual === undefined || actual === null || String(actual).trim() === "");
  }

  if (operator === "older_than_days") {
    const dt = validateDateOrNull(actual);
    if (!dt) return false;

    const days = Number(expected || 0);
    const diffMs = Date.now() - dt.getTime();
    return diffMs >= days * 24 * 60 * 60 * 1000;
  }

  if (operator === "due_within_days") {
    const dt = validateDateOrNull(actual);
    if (!dt) return false;

    const days = Number(expected || 0);
    const diffMs = dt.getTime() - Date.now();

    return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
  }

  return false;
};

const entityMatchesRule = (entity, rule) => {
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  if (!conditions.length) return true;

  return conditions.every((condition) => compareCondition(entity, condition));
};

const calculateLeadQueueScore = (lead = {}) => {
  let score = Number(lead.leadScore || 0);

  if (lead.priority === "high") score += 20;
  if (lead.priority === "medium") score += 10;

  if (lead.leadTemperature === "hot") score += 25;
  if (lead.leadTemperature === "warm") score += 10;

  if (Number(lead.requirement?.expectedValue || 0) >= 100000) score += 25;
  else if (Number(lead.requirement?.expectedValue || 0) >= 50000) score += 15;
  else if (Number(lead.requirement?.expectedValue || 0) >= 10000) score += 8;

  if (["proposal", "negotiation"].includes(lead.pipelineStage)) score += 25;
  if (lead.pipelineStage === "qualified") score += 12;
  if (lead.pipelineStage === "discovery") score += 15;

  if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date()) {
    score += 30;
  }

  if (!lead.lastContactedAt) score += 10;

  return Math.max(0, Math.min(score, 1000));
};

const getQueuePriority = (score) => {
  if (score >= 120) return "urgent";
  if (score >= 85) return "high";
  if (score >= 45) return "normal";
  return "low";
};

const resolveEntityModel = (entityType) => {
  if (entityType === "Lead") return Lead;
  if (entityType === "Activity") return Activity;
  if (entityType === "Proposal") return Proposal;
  if (entityType === "Deal") return Deal;
  return null;
};

const buildDailyFilter = (entityType) => {
  const now = new Date();

  if (entityType === "Lead") {
    return {
      pipelineStage: { $nin: ["won", "lost"] },
      $or: [
        { nextFollowUpAt: { $lte: now } },
        { lastContactedAt: null },
        { "automationFlags.needsFirstContact": true },
        { "automationFlags.needsFollowUp": true },
      ],
    };
  }

  if (entityType === "Proposal") {
    return {
      status: "sent",
      followupDueAt: { $lte: now },
    };
  }

  if (entityType === "Deal") {
    return {
      stage: { $nin: ["won", "lost"] },
      $or: [
        { nextDealActionAt: { $lte: now } },
        { dealHealth: { $in: ["stuck", "critical", "at_risk"] } },
      ],
    };
  }

  if (entityType === "Activity") {
    return {
      status: "pending",
      $or: [{ scheduledAt: { $lte: now } }, { nextActionDate: { $lte: now } }],
    };
  }

  return {};
};

const createQueueSafe = async ({ entity, entityType, payload, userId }) => {
  try {
    const assignedTo =
      entity.assignedTo ||
      entity.ownerId ||
      entity.createdBy ||
      payload?.assignedTo ||
      userId;

    const priorityScore =
      Number(payload?.priorityScore || 0) ||
      (entityType === "Lead" ? calculateLeadQueueScore(entity) : 80);

    const priority = payload?.priority || getQueuePriority(priorityScore);

    const dueAt =
      validateDateOrNull(payload?.dueAt) ||
      entity.nextFollowUpAt ||
      entity.nextActionAt ||
      entity.followupDueAt ||
      entity.nextDealActionAt ||
      entity.scheduledAt ||
      new Date();

    const queueBody = {
      queueDate: getStartOfDay(dueAt),
      assignedTo,
      source: payload?.source || "automation",
      title: normalizeString(payload?.title) || entity.nextAction || entity.title || "Review item",
      description: normalizeString(payload?.description),
      recommendedAction: payload?.recommendedAction || "review",
      priority,
      priorityScore,
      status: "pending",
      dueAt,
      createdBy: userId,
      autoGenerated: true,
    };

    if (entityType === "Lead") {
      queueBody.leadId = entity._id;
      queueBody.customerId = entity.customerId || null;
    }

    if (entityType === "Proposal") {
      queueBody.proposalId = entity._id;
      queueBody.leadId = entity.leadId || null;
      queueBody.customerId = entity.customerId || null;
      queueBody.dealId = entity.dealId || null;
    }

    if (entityType === "Deal") {
      queueBody.dealId = entity._id;
      queueBody.leadId = entity.leadId || null;
      queueBody.customerId = entity.customerId || null;
      queueBody.proposalId = entity.proposalId || null;
    }

    if (entityType === "Activity") {
      queueBody.activityId = entity._id;
      queueBody.leadId = entity.leadId || null;
      queueBody.customerId = entity.customerId || null;
      queueBody.dealId = entity.dealId || null;
    }

    const filter = {
      assignedTo,
      source: queueBody.source,
      status: { $in: ["pending", "in_progress", "snoozed"] },
    };

    if (queueBody.leadId) filter.leadId = queueBody.leadId;
    if (queueBody.proposalId) filter.proposalId = queueBody.proposalId;
    if (queueBody.dealId) filter.dealId = queueBody.dealId;
    if (queueBody.activityId) filter.activityId = queueBody.activityId;

    return await WorkQueue.findOneAndUpdate(
      filter,
      {
        $set: queueBody,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );
  } catch (err) {
    console.error("Automation queue failed:", err.message);
    return null;
  }
};

const createNotificationSafe = async ({ entity, entityType, payload, userId }) => {
  try {
    const targetUser =
      payload?.userId || entity.assignedTo || entity.ownerId || entity.createdBy || userId;

    const notification = await Notification.create({
      userId: targetUser,
      title: normalizeString(payload?.title) || "CRM notification",
      message: normalizeString(payload?.message) || "",
      type: payload?.type || "automation",
      priority: payload?.priority || "normal",
      entityType,
      entityId: entity._id,
      actionUrl: normalizeString(payload?.actionUrl),
      createdBy: userId,
    });

    return notification;
  } catch (err) {
    console.error("Automation notification failed:", err.message);
    return null;
  }
};

const updateLeadSafe = async ({ entity, payload }) => {
  try {
    if (!entity?._id) return null;

    const set = {};

    if (payload?.priority !== undefined) set.priority = payload.priority;
    if (payload?.leadScore !== undefined) {
      set.leadScore = Math.max(0, Math.min(Number(payload.leadScore || 0), 100));
    }
    if (payload?.nextAction !== undefined) set.nextAction = normalizeString(payload.nextAction);
    if (payload?.nextActionType !== undefined) set.nextActionType = payload.nextActionType;
    if (payload?.nextActionAt !== undefined) set.nextActionAt = validateDateOrNull(payload.nextActionAt);
    if (payload?.nextFollowUpAt !== undefined) set.nextFollowUpAt = validateDateOrNull(payload.nextFollowUpAt);

    if (payload?.markOverdue === true) {
      set.isOverdue = true;
      set.overdueSince = entity.nextFollowUpAt || entity.nextActionAt || new Date();
      set["automationFlags.needsFollowUp"] = true;
    }

    const score = calculateLeadQueueScore({ ...entity, ...set });
    set.workQueueScore = score;
    set.workQueuePriority = getQueuePriority(score);

    return await Lead.findByIdAndUpdate(
      entity._id,
      { $set: set },
      { new: true, runValidators: true }
    );
  } catch (err) {
    console.error("Automation lead update failed:", err.message);
    return null;
  }
};

const createActivitySafe = async ({ entity, entityType, payload, userId }) => {
  try {
    const activityBody = {
      type: payload?.type || "note",
      status: payload?.status || "pending",
      priority: payload?.priority || "medium",
      title: normalizeString(payload?.title) || "Automation activity",
      body: normalizeString(payload?.body),
      scheduledAt: validateDateOrNull(payload?.scheduledAt) || null,
      nextAction: normalizeString(payload?.nextAction),
      nextActionDate: validateDateOrNull(payload?.nextActionDate) || null,
      reminderStatus: validateDateOrNull(payload?.nextActionDate) ? "scheduled" : "none",
      autoGenerated: true,
      source: "automation",
      createdBy: userId,
      assignedTo: entity.assignedTo || entity.ownerId || userId,
    };

    if (entityType === "Lead") {
      activityBody.leadId = entity._id;
      activityBody.customerId = entity.customerId || null;
    }

    if (entityType === "Deal") {
      activityBody.dealId = entity._id;
      activityBody.leadId = entity.leadId || null;
      activityBody.customerId = entity.customerId || null;
    }

    if (entityType === "Proposal") {
      activityBody.leadId = entity.leadId || null;
      activityBody.customerId = entity.customerId || null;
      activityBody.dealId = entity.dealId || null;
    }

    if (!activityBody.leadId && !activityBody.customerId && !activityBody.dealId) {
      return null;
    }

    return await Activity.create(activityBody);
  } catch (err) {
    console.error("Automation activity failed:", err.message);
    return null;
  }
};

const applyAutomationAction = async ({ rule, entity, userId }) => {
  const results = [];

  for (const action of rule.actions || []) {
    if (!ACTION_TYPES.includes(action.type)) continue;

    let result = null;
    const payload = action.payload || {};

    if (action.type === "create_work_queue") {
      result = await createQueueSafe({
        entity,
        entityType: rule.entityType,
        payload,
        userId,
      });
    }

    if (action.type === "create_notification") {
      result = await createNotificationSafe({
        entity,
        entityType: rule.entityType,
        payload,
        userId,
      });
    }

    if (
      ["update_lead_priority", "update_lead_score", "set_next_action", "mark_overdue"].includes(
        action.type
      ) &&
      rule.entityType === "Lead"
    ) {
      result = await updateLeadSafe({
        entity,
        payload: {
          ...payload,
          markOverdue: action.type === "mark_overdue",
        },
      });
    }

    if (action.type === "create_activity") {
      result = await createActivitySafe({
        entity,
        entityType: rule.entityType,
        payload,
        userId,
      });
    }

    results.push({
      actionType: action.type,
      success: Boolean(result),
      resultId: result?._id || null,
    });
  }

  await AutomationRule.findByIdAndUpdate(rule._id, {
    $set: { lastRunAt: new Date() },
  });

  return results;
};

/* =======================
   CREATE AUTOMATION RULE
======================= */
export const createAutomationRule = async (req, res) => {
  try {
    assertAdmin(req);
    const meta = getReqMeta(req);

    const {
      name,
      description = "",
      entityType,
      trigger,
      conditions = [],
      actions = [],
      priority = 100,
      isActive = true,
      runOncePerEntityPerDay = true,
    } = req.body || {};

    if (!name || !normalizeString(name)) {
      return res.status(400).json({ message: "name is required" });
    }

    if (!ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({
        message: `Invalid entityType. Use: ${ENTITY_TYPES.join(", ")}`,
      });
    }

    if (!TRIGGERS.includes(trigger)) {
      return res.status(400).json({
        message: `Invalid trigger. Use: ${TRIGGERS.join(", ")}`,
      });
    }

    for (const condition of conditions || []) {
      if (!condition.field || !CONDITION_OPERATORS.includes(condition.operator)) {
        return res.status(400).json({
          message: "Invalid condition format.",
        });
      }
    }

    for (const action of actions || []) {
      if (!ACTION_TYPES.includes(action.type)) {
        return res.status(400).json({
          message: `Invalid action type: ${action.type}`,
        });
      }
    }

    const rule = await AutomationRule.create({
      name: normalizeString(name),
      description: normalizeString(description),
      entityType,
      trigger,
      conditions,
      actions,
      priority: Number(priority || 100),
      isActive: Boolean(isActive),
      runOncePerEntityPerDay: Boolean(runOncePerEntityPerDay),
      createdBy: req.user._id,
    });

    await writeAudit({
      actorId: req.user._id,
      action: "create",
      entityType: "AutomationRule",
      entityId: rule._id,
      before: null,
      after: rule.toObject(),
      meta,
    });

    return res.status(201).json({
      message: "Automation rule created",
      rule,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to create automation rule",
      error: err.message,
    });
  }
};

/* =======================
   LIST AUTOMATION RULES
======================= */
export const listAutomationRules = async (req, res) => {
  try {
    assertAdmin(req);

    const { entityType, trigger, isActive, limit = 100 } = req.query || {};

    const filter = {};

    if (entityType && ENTITY_TYPES.includes(String(entityType))) filter.entityType = entityType;
    if (trigger && TRIGGERS.includes(String(trigger))) filter.trigger = trigger;

    if (String(isActive).toLowerCase() === "true") filter.isActive = true;
    if (String(isActive).toLowerCase() === "false") filter.isActive = false;

    const pageSize = Math.min(Math.max(parseInt(limit || "100", 10), 1), 200);

    const rules = await AutomationRule.find(filter)
      .populate("createdBy", "name email role avatarUrl")
      .sort({ isActive: -1, priority: 1, createdAt: -1 })
      .limit(pageSize)
      .lean();

    return res.json({ rules });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to list automation rules",
      error: err.message,
    });
  }
};

/* =======================
   GET AUTOMATION RULE
======================= */
export const getAutomationRuleById = async (req, res) => {
  try {
    assertAdmin(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid automation rule id" });

    const rule = await AutomationRule.findById(id)
      .populate("createdBy", "name email role avatarUrl")
      .lean();

    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    return res.json({ rule });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to get automation rule",
      error: err.message,
    });
  }
};

/* =======================
   UPDATE AUTOMATION RULE
======================= */
export const updateAutomationRule = async (req, res) => {
  try {
    assertAdmin(req);
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid automation rule id" });

    const before = await AutomationRule.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Automation rule not found" });

    const set = {};

    if (req.body?.name !== undefined) set.name = normalizeString(req.body.name);
    if (req.body?.description !== undefined) {
      set.description = normalizeString(req.body.description);
    }

    if (req.body?.entityType !== undefined) {
      if (!ENTITY_TYPES.includes(req.body.entityType)) {
        return res.status(400).json({ message: "Invalid entityType" });
      }
      set.entityType = req.body.entityType;
    }

    if (req.body?.trigger !== undefined) {
      if (!TRIGGERS.includes(req.body.trigger)) {
        return res.status(400).json({ message: "Invalid trigger" });
      }
      set.trigger = req.body.trigger;
    }

    if (req.body?.conditions !== undefined) {
      set.conditions = Array.isArray(req.body.conditions) ? req.body.conditions : [];
    }

    if (req.body?.actions !== undefined) {
      set.actions = Array.isArray(req.body.actions) ? req.body.actions : [];
    }

    if (req.body?.priority !== undefined) {
      set.priority = Number(req.body.priority || 100);
    }

    if (req.body?.isActive !== undefined) {
      set.isActive = Boolean(req.body.isActive);
    }

    if (req.body?.runOncePerEntityPerDay !== undefined) {
      set.runOncePerEntityPerDay = Boolean(req.body.runOncePerEntityPerDay);
    }

    const rule = await AutomationRule.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, runValidators: true }
    );

    await writeAudit({
      actorId: req.user._id,
      action: "update",
      entityType: "AutomationRule",
      entityId: id,
      before,
      after: rule.toObject(),
      meta,
    });

    return res.json({
      message: "Automation rule updated",
      rule,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to update automation rule",
      error: err.message,
    });
  }
};

/* =======================
   DELETE AUTOMATION RULE
======================= */
export const deleteAutomationRule = async (req, res) => {
  try {
    assertAdmin(req);
    const meta = getReqMeta(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid automation rule id" });

    const before = await AutomationRule.findById(id).lean();
    if (!before) return res.status(404).json({ message: "Automation rule not found" });

    await AutomationRule.findByIdAndDelete(id);

    await writeAudit({
      actorId: req.user._id,
      action: "delete",
      entityType: "AutomationRule",
      entityId: id,
      before,
      after: null,
      meta,
    });

    return res.json({
      message: "Automation rule deleted",
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to delete automation rule",
      error: err.message,
    });
  }
};

/* =======================
   RUN AUTOMATION RULE BY ID
======================= */
export const runAutomationRule = async (req, res) => {
  try {
    assertAdmin(req);

    const id = toObjectId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid automation rule id" });

    const rule = await AutomationRule.findById(id).lean();
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });

    if (!rule.isActive) {
      return res.status(400).json({ message: "Automation rule is inactive" });
    }

    const Model = resolveEntityModel(rule.entityType);
    if (!Model) return res.status(400).json({ message: "Invalid rule entityType" });

    const filter =
      rule.trigger === "daily_check"
        ? buildDailyFilter(rule.entityType)
        : {};

    const entities = await Model.find(filter).limit(200).lean();

    const results = [];

    for (const entity of entities) {
      if (!entityMatchesRule(entity, rule)) continue;

      const actionResults = await applyAutomationAction({
        rule,
        entity,
        userId: req.user._id,
      });

      await writeActivity({
        leadId: rule.entityType === "Lead" ? entity._id : entity.leadId || null,
        customerId: entity.customerId || null,
        dealId: rule.entityType === "Deal" ? entity._id : entity.dealId || null,
        proposalId: rule.entityType === "Proposal" ? entity._id : entity.proposalId || null,
        entityType: "AutomationRule",
        entityId: rule._id,
        type: "automation_triggered",
        message: `Automation triggered: ${rule.name}`,
        createdBy: req.user._id,
        meta: {
          sourceEntityType: rule.entityType,
          sourceEntityId: entity._id,
          actions: actionResults,
        },
      });

      results.push({
        entityType: rule.entityType,
        entityId: entity._id,
        actions: actionResults,
      });
    }

    return res.json({
      message: "Automation rule executed",
      matched: results.length,
      results,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to run automation rule",
      error: err.message,
    });
  }
};

/* =======================
   RUN DAILY AUTOMATIONS
======================= */
export const runDailyAutomations = async (req, res) => {
  try {
    assertAdmin(req);

    const rules = await AutomationRule.find({
      isActive: true,
      trigger: "daily_check",
    })
      .sort({ priority: 1 })
      .lean();

    const allResults = [];

    for (const rule of rules) {
      const Model = resolveEntityModel(rule.entityType);
      if (!Model) continue;

      const entities = await Model.find(buildDailyFilter(rule.entityType))
        .limit(300)
        .lean();

      for (const entity of entities) {
        if (!entityMatchesRule(entity, rule)) continue;

        const actionResults = await applyAutomationAction({
          rule,
          entity,
          userId: req.user._id,
        });

        await writeActivity({
          leadId: rule.entityType === "Lead" ? entity._id : entity.leadId || null,
          customerId: entity.customerId || null,
          dealId: rule.entityType === "Deal" ? entity._id : entity.dealId || null,
          proposalId: rule.entityType === "Proposal" ? entity._id : entity.proposalId || null,
          entityType: "AutomationRule",
          entityId: rule._id,
          type: "automation_triggered",
          message: `Daily automation triggered: ${rule.name}`,
          createdBy: req.user._id,
          meta: {
            sourceEntityType: rule.entityType,
            sourceEntityId: entity._id,
            actions: actionResults,
          },
        });

        allResults.push({
          ruleId: rule._id,
          ruleName: rule.name,
          entityType: rule.entityType,
          entityId: entity._id,
          actions: actionResults,
        });
      }
    }

    return res.json({
      message: "Daily automations executed",
      totalRules: rules.length,
      totalTriggered: allResults.length,
      results: allResults,
    });
  } catch (err) {
    const code = err.statusCode || 500;

    return res.status(code).json({
      message: err.statusCode ? err.message : "Failed to run daily automations",
      error: err.message,
    });
  }
};